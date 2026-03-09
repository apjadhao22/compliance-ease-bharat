import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { getSafeErrorMessage } from "@/lib/safe-error";
import { Download, AlertCircle, Clock } from "lucide-react";
import { validateWagePayment } from "@/lib/wageCompliance";
import { Badge } from "@/components/ui/badge";
import { PayrollAuditModal } from "@/components/PayrollAuditModal";
import { addOpticompBharatFooter } from "@/lib/pdfUtils";

/** Lazy-load jsPDF + autotable only when user clicks a download button */
const loadJsPDF = async () => {
  const { default: jsPDF } = await import("jspdf");
  await import("jspdf-autotable");
  return jsPDF;
};

const Payroll = () => {
  const { toast } = useToast();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [complianceRegime, setComplianceRegime] = useState<'legacy_acts' | 'labour_codes'>('legacy_acts');
  const [employees, setEmployees] = useState<any[]>([]);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [workingDays, setWorkingDays] = useState(26);
  const [processing, setProcessing] = useState(false);
  const [payrollData, setPayrollData] = useState<any[]>([]);
  const [complianceAlerts, setComplianceAlerts] = useState<string[]>([]);
  const [existingRun, setExistingRun] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // ── Gap 2: Payment deadline banner ──────────────────────────────────────────
  const paymentDeadlineInfo = useMemo(() => {
    if (!month) return null;
    const [year, mon] = month.split('-').map(Number);
    const nextMonth = mon === 12 ? 1 : mon + 1;
    const nextYear = mon === 12 ? year + 1 : year;
    const deadline = new Date(nextYear, nextMonth - 1, 7);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { status: 'overdue' as const, days: -diffDays, deadline };
    if (diffDays <= 2) return { status: 'urgent' as const, days: diffDays, deadline };
    if (diffDays <= 5) return { status: 'approaching' as const, days: diffDays, deadline };
    return { status: 'ok' as const, days: diffDays, deadline };
  }, [month]);

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: company } = await supabase
        .from("companies")
        .select("id, compliance_regime")
        .eq("user_id", user.id)
        .maybeSingle();

      if (company) {
        setCompanyId(company.id);
        setComplianceRegime(((company as any).compliance_regime as any) || "legacy_acts");

        const { data: emps } = await supabase
          .from("employees")
          .select("*")
          .eq("company_id", company.id)
          .in("status", ["Active", "active"])
          .limit(500);

        if (emps) setEmployees(emps);

        await checkExistingPayroll(company.id);
      }
    };
    init();
  }, [month]);

  const checkExistingPayroll = async (compId: string) => {
    const { data: run } = await supabase
      .from("payroll_runs")
      .select("*")
      .eq("company_id", compId)
      .eq("month", month)
      .maybeSingle();

    if (run) {
      setExistingRun(run);
      setWorkingDays(run.working_days ?? 26);

      const { data: details } = await supabase
        .from("payroll_details")
        .select("*, employees(emp_code, name, uan, skill_category)")
        .eq("payroll_run_id", run.id);

      setPayrollData(details || []);
    } else {
      setExistingRun(null);
      setPayrollData([]);
    }
  };

  const processPayroll = async () => {
    if (!companyId) {
      toast({ title: "Setup required", description: "Please set up your company first.", variant: "destructive" });
      return;
    }

    if (employees.length === 0) {
      toast({ title: "No employees", description: "Add employees before processing payroll.", variant: "destructive" });
      return;
    }

    setProcessing(true);

    try {
      const { data: run, error: runError } = await supabase
        .from("payroll_runs")
        .upsert(
          {
            company_id: companyId,
            month,
            working_days: workingDays,
            status: "processed",
            processed_at: new Date().toISOString(),
          },
          { onConflict: "company_id,month" }
        )
        .select()
        .single();

      if (runError) throw runError;

      // ─── Call Edge Function — it queries employees/leaves/expenses server-side ───
      // Explicitly get the auth token and pass it — required with publishable key format
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        toast({
          title: "Session expired",
          description: "Please sign in again and retry payroll processing.",
          variant: "destructive",
        });
        setProcessing(false);
        return;
      }

      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('calculate-payroll', {
        body: {
          companyId,
          month,
          workingDays,
          regime: complianceRegime
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (edgeError) {
        // Distinguish timeout from other edge function failures
        const msg = getSafeErrorMessage(edgeError).toLowerCase();
        const isTimeout = msg.includes('timeout') || msg.includes('time out') || msg.includes('524') || msg.includes('504');
        const isFunctionError = msg.includes('non-2xx') || msg.includes('failed to send') || msg.includes('function');

        if (isTimeout) {
          toast({
            title: "Payroll calculation timed out",
            description: "The server took too long to respond. This can happen for very large companies. Please try again — the calculation will resume from where it left off.",
            variant: "destructive",
            duration: 10_000,
          });
        } else if (isFunctionError) {
          toast({
            title: "Payroll function error",
            description: "The calculation server returned an error. Please check your employee data is complete (basic salary, joining date) and try again.",
            variant: "destructive",
            duration: 8_000,
          });
        } else {
          toast({
            title: "Payroll processing failed",
            description: getSafeErrorMessage(edgeError),
            variant: "destructive",
          });
        }

        // Roll back the payroll run record since calculation didn't complete
        await supabase.from("payroll_runs").delete().eq("id", run.id).eq("status", "processed");
        return;
      }

      if (!edgeData?.payrollDetails || edgeData.payrollDetails.length === 0) {
        toast({
          title: "No employees to process",
          description: "No active employees were found for this month. Make sure employees have Active status and a joining date on or before this month.",
          variant: "destructive",
        });
        await supabase.from("payroll_runs").delete().eq("id", run.id);
        return;
      }

      const payrollDetails = edgeData.payrollDetails.map((pd: any) => ({
        ...pd,
        payroll_run_id: run.id
      }));

      const alerts: string[] = edgeData.alerts || [];

      await supabase.from("payroll_details").delete().eq("payroll_run_id", run.id);

      // Insert payroll details in batches of 500
      const BATCH_SIZE = 500;
      for (let i = 0; i < payrollDetails.length; i += BATCH_SIZE) {
        const batch = payrollDetails.slice(i, i + BATCH_SIZE);
        const { error: detailsError } = await supabase.from("payroll_details").insert(batch);
        if (detailsError) throw detailsError;
      }

      // Refetch with employee names (paginated)
      const { data: fullData } = await supabase
        .from("payroll_details")
        .select("*, employees (emp_code, name, uan, skill_category)")
        .eq("payroll_run_id", run.id)
        .limit(100);

      setPayrollData(fullData || []);
      setComplianceAlerts(alerts);
      setExistingRun(run);

      toast({
        title: "✅ Payroll Processed",
        description: `Payroll calculated for ${edgeData.totalProcessed || payrollDetails.length} employee${payrollDetails.length === 1 ? '' : 's'} for ${month}.`,
      });
    } catch (error: any) {
      const msg = getSafeErrorMessage(error);
      toast({
        title: "Payroll processing failed",
        description: msg || "An unexpected error occurred. Please try again or contact support.",
        variant: "destructive",
        duration: 8_000,
      });
      console.error("[Payroll] processPayroll error:", error);
    } finally {
      setProcessing(false);
    }
  };

  const downloadECR = async () => {
    if (!existingRun || payrollData.length === 0) {
      toast({ title: "No data", description: "Process payroll first.", variant: "destructive" });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: company } = await supabase
        .from("companies")
        .select("name, epf_code")
        .eq("user_id", user.id)
        .maybeSingle();

      let content = "Salary Details\n";
      content += `Return Month: ${month} (MMYYYY)\n`;
      content += `Establishment ID: ${company?.epf_code || "MHPUN12345"}\n`;
      content += `ECR Submitted Date: ${format(new Date(), "dd/MM/yyyy")}\n\n`;
      content += "UAN|Member Name|Gross Wages|EPF Wages|EPS Wages|EDLI Wages|EE Share|EPS Contribution|ER Share|NCP Days|Refund of Advances\n";

      payrollData.forEach((item: any) => {
        const emp = (item as any).employees;
        const uan = (emp?.uan || "000000000000").padStart(12, "0");
        const name = (emp?.name || "UNKNOWN").toUpperCase().replace(/[^A-Z\s.]/g, "").slice(0, 85);
        const gross = Math.round(Number(item.gross_earnings || 0));
        const epfWages = Math.min(Math.round(Number(item.basic_paid || 0)), 15000);
        const epsWages = epfWages;
        const edliWages = epsWages;
        const eeShare = Math.round(Number(item.epf_employee || 0));
        const epsContribution = Math.round(Number(item.eps_employer || 0));
        const erShare = Math.round(Number(item.epf_employer || 0) - epsContribution);
        const ncpDays = Number(item.days_present || 0) < workingDays ? workingDays - Number(item.days_present) : 0;

        const line = [
          uan,
          name,
          gross.toString().padStart(10, "0"),
          epfWages.toString().padStart(10, "0"),
          epsWages.toString().padStart(10, "0"),
          edliWages.toString().padStart(10, "0"),
          eeShare.toString().padStart(10, "0"),
          epsContribution.toString().padStart(10, "0"),
          erShare.toString().padStart(10, "0"),
          ncpDays.toString().padStart(3, "0"),
          "0",
        ].join("#~#");

        content += line + "\n";
      });

      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ECR_${month.replace("-", "")}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "ECR Downloaded! 🎉", description: `EPF ECR file generated for ${payrollData.length} employees. Ready for EPFO Unified Portal upload.` });
    } catch (error: any) {
      toast({ title: "ECR generation failed", description: getSafeErrorMessage(error), variant: "destructive" });
    }
  };

  const downloadESICForm5 = async () => {
    if (!existingRun || payrollData.length === 0) {
      toast({ title: "No data", description: "Process payroll first.", variant: "destructive" });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: company } = await supabase
        .from("companies")
        .select("name, esic_code")
        .eq("user_id", user.id)
        .maybeSingle();

      const jsPDF = await loadJsPDF();
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();

      // Header
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("EMPLOYEES' STATE INSURANCE CORPORATION", pageW / 2, 15, { align: "center" });
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text("FORM 5 - RETURN OF CONTRIBUTIONS", pageW / 2, 22, { align: "center" });

      // Employer details box
      doc.setFontSize(10);
      doc.setDrawColor(0);
      doc.setLineWidth(0.5);
      doc.rect(14, 28, pageW - 28, 18);
      doc.text(`Employer's Name: ${company?.name || "Your Company"}`, 16, 34);
      doc.text(`Employer's Code No.: ${company?.esic_code || "31000123456789"}`, 16, 39);
      doc.text(`Period: ${month} (${workingDays} days)`, 140, 34);

      // Table data
      let yPos = 52;
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      const cols = [14, 22, 42, 100, 120, 145, 170, 195, 220];
      doc.text("Sl.", cols[0], yPos);
      doc.text("Insurance No.", cols[1], yPos);
      doc.text("Name of Insured Person", cols[2], yPos);
      doc.text("Days Paid", cols[3], yPos);
      doc.text("Total Wages", cols[4], yPos);
      doc.text("EE Contrib", cols[5], yPos);
      doc.text("ER Contrib", cols[6], yPos);
      doc.text("Total Contrib", cols[7], yPos);
      doc.text("Remarks", cols[8], yPos);

      yPos += 5;
      let rowNum = 1;
      let totalWages = 0, totalEE = 0, totalER = 0;

      doc.setFont("helvetica", "normal");
      payrollData.forEach((item: any) => {
        const emp = (item as any).employees;
        const esicNo = emp?.esic_number || "N/A";
        const name = (emp?.name || "UNKNOWN").slice(0, 40);
        const days = Number(item.days_present || 0);
        const wages = Math.round(Number(item.gross_earnings || 0));
        const ee = Math.round(Number(item.esic_employee || 0));
        const er = Math.round(Number(item.esic_employer || 0));

        doc.text(rowNum.toString(), cols[0], yPos);
        doc.text(esicNo.slice(0, 17), cols[1], yPos);
        doc.text(name, cols[2], yPos);
        doc.text(days.toString(), cols[3] + 8, yPos);
        doc.text(wages.toLocaleString("en-IN"), cols[4] + 20, yPos, { align: "right" });
        doc.text(ee.toLocaleString("en-IN"), cols[5] + 20, yPos, { align: "right" });
        doc.text(er.toLocaleString("en-IN"), cols[6] + 20, yPos, { align: "right" });
        doc.text((ee + er).toLocaleString("en-IN"), cols[7] + 20, yPos, { align: "right" });

        totalWages += wages;
        totalEE += ee;
        totalER += er;
        rowNum++;
        yPos += 5;

        if (yPos > 185) {
          doc.addPage();
          yPos = 20;
        }
      });

      // Totals
      yPos += 2;
      doc.setFont("helvetica", "bold");
      doc.text("TOTAL", cols[0], yPos);
      doc.text(totalWages.toLocaleString("en-IN"), cols[4] + 20, yPos, { align: "right" });
      doc.text(totalEE.toLocaleString("en-IN"), cols[5] + 20, yPos, { align: "right" });
      doc.text(totalER.toLocaleString("en-IN"), cols[6] + 20, yPos, { align: "right" });
      doc.text((totalEE + totalER).toLocaleString("en-IN"), cols[7] + 20, yPos, { align: "right" });

      // Signature block
      yPos += 12;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.rect(14, yPos, 80, 15);
      doc.text("Signature of Employer", 18, yPos + 6);
      doc.text(`Date: ${format(new Date(), "dd/MM/yyyy")}`, 18, yPos + 11);
      doc.rect(pageW - 114, yPos, 100, 15);
      doc.text("For Official Use Only", pageW - 110, yPos + 6);

      await addOpticompBharatFooter(doc as any);
      doc.save(`ESIC_Form5_${month}_${format(new Date(), "yyyyMMdd")}.pdf`);

      toast({ title: "ESIC Form 5 Generated! 📄", description: `Official ESIC Form 5 PDF for ${payrollData.length} employees (${month}).` });
    } catch (error: any) {
      toast({ title: "ESIC Form 5 failed", description: getSafeErrorMessage(error), variant: "destructive" });
    }
  };

  const downloadPTFormV = async () => {
    if (!existingRun || payrollData.length === 0) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: company } = await supabase
        .from("companies")
        .select("name, pt_rc_number, state")
        .eq("user_id", user.id)
        .maybeSingle();

      const jsPDF = await loadJsPDF();
      const doc = new jsPDF();

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("MAHARASHTRA PROFESSIONAL TAX RETURN", 105, 20, { align: "center" });
      doc.setFontSize(12);
      doc.text("Form III-B (Return of Tax Payable by Employer)", 105, 28, { align: "center" });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Name of Employer: ${company?.name || ""}`, 15, 40);
      doc.text(`PT Registration No. (PTRC): ${company?.pt_rc_number || ""}`, 15, 46);
      doc.text(`Period / Month: ${month}`, 15, 52);

      const tableData: any[][] = [];
      let totalPT = 0;

      payrollData.forEach((item: any, index: number) => {
        const pt = Math.round(Number(item.pt || 0));
        totalPT += pt;
        tableData.push([
          index + 1,
          (item as any).employees?.emp_code || "",
          (item as any).employees?.name || "",
          pt.toLocaleString("en-IN"),
        ]);
      });

      tableData.push(["", "", "TOTAL", totalPT.toLocaleString("en-IN")]);

      (doc as any).autoTable({
        startY: 60,
        head: [["Sr.No.", "Emp Code", "Name", "PT Amount (₹)"]],
        body: tableData,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [41, 128, 185] },
        columnStyles: {
          0: { halign: "center", cellWidth: 15 },
          1: { halign: "center", cellWidth: 25 },
          2: { halign: "left", cellWidth: 80 },
          3: { halign: "right", cellWidth: 30 },
        },
      });

      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.rect(15, finalY, 80, 15);
      doc.text("Signature of Employer", 17, finalY + 6);
      doc.text(`Date: ${format(new Date(), "dd/MM/yyyy")}`, 17, finalY + 11);

      await addOpticompBharatFooter(doc as any);
      doc.save(`PT_Return_FormIIIB_${month}_${format(new Date(), "yyyyMMdd")}.pdf`);

      toast({ title: "PT Return Generated! 📄", description: `Maharashtra PT Form III-B for ${payrollData.length} employees (${month}).` });
    } catch (error: any) {
      toast({ title: "PT Return failed", description: getSafeErrorMessage(error), variant: "destructive" });
    }
  };

  const downloadForm16 = async () => {
    if (!existingRun || payrollData.length === 0) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: company } = await supabase
        .from("companies")
        .select("name, tan")
        .eq("user_id", user.id)
        .maybeSingle();

      const jsPDF = await loadJsPDF();
      const doc = new jsPDF();

      const fy = `${month.slice(0, 4)}-${(parseInt(month.slice(0, 4)) + 1).toString().slice(-2)}`;

      payrollData.forEach((item: any, idx: number) => {
        if (idx > 0) doc.addPage();

        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("FORM No. 16", 105, 20, { align: "center" });
        doc.setFontSize(12);
        doc.text("PART A & B", 105, 28, { align: "center" });
        doc.setFontSize(10);
        doc.text("Certificate under section 203 of the Income-tax Act, 1961", 105, 35, { align: "center" });
        doc.text("for tax deducted at source on salary", 105, 41, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.text(`Name of Deductor: ${company?.name || ""}`, 15, 55);
        doc.text(`TAN: ${company?.tan || ""}`, 15, 61);
        doc.text(`Assessment Year: ${fy}`, 15, 67);

        const empName = item.employees?.name || "Employee";
        doc.text(`Name of Employee: ${empName}`, 120, 55);
        const pan = item.employees?.pan_number || "Not Available";
        doc.text(`PAN of Employee: ${pan}`, 120, 61);
        doc.text(`Period: April to March`, 120, 67);

        const annualGross = Number(item.gross_earnings || 0) * 12;
        const annualTDS = Number(item.tds || 0) * 12;
        const taxableIncome = Math.max(0, annualGross - 75000);

        (doc as any).autoTable({
          startY: 75,
          head: [["Particulars", "Amount (₹)"]],
          body: [
            ["1. Gross Salary (u/s 17(1))", Math.round(annualGross).toLocaleString("en-IN")],
            ["2. Less: Standard Deduction (u/s 16(ia))", "75,000"],
            ["3. Total Income (1 - 2)", Math.round(taxableIncome).toLocaleString("en-IN")],
            ["4. Tax on Total Income", Math.round(annualTDS).toLocaleString("en-IN")],
            ["5. Less: Rebate u/s 87A", taxableIncome <= 700000 ? Math.round(annualTDS).toLocaleString("en-IN") : "0"],
            ["6. Tax Payable", taxableIncome <= 700000 ? "0" : Math.round(annualTDS).toLocaleString("en-IN")],
            ["7. Add: Cess @ 4%", Math.round(annualTDS * 0.04).toLocaleString("en-IN")],
            ["8. Total Tax Deducted", Math.round(annualTDS).toLocaleString("en-IN")],
          ],
          theme: "grid",
          styles: { fontSize: 9, cellPadding: 3 },
          columnStyles: { 1: { halign: "right" } },
        });

        const finalY = (doc as any).lastAutoTable.finalY + 12;
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Verification", 105, finalY, { align: "center" });
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");

        const sigY = finalY + 15;
        doc.rect(15, sigY, 180, 25);
        doc.text(`I, ${company?.name || "Employer"}, certify that a sum of Rs. ${Math.round(annualTDS)} has been deducted and deposited`, 17, sigY + 7);
        doc.text(`to the credit of the Central Government. The information is true and correct based on records.`, 17, sigY + 13);

        doc.text(`Signature of Deductor: _____________________`, 130, sigY + 20);
        doc.text(`Date: ${format(new Date(), "dd/MM/yyyy")}`, 17, sigY + 20);
      });

      await addOpticompBharatFooter(doc as any);
      doc.save(`Form16_AllEmployees_${fy}.pdf`);

      toast({ title: "Form 16 Generated! 📄", description: "TDS certificate (Part A+B) ready." });
    } catch (error: any) {
      toast({ title: "Form 16 failed", description: getSafeErrorMessage(error), variant: "destructive" });
    }
  };

  // ─── Payslip PDF Generator ──────────────────────────────────────────────────
  const generatePayslips = async () => {
    if (!existingRun || payrollData.length === 0) {
      toast({ title: "No payroll data", description: "Process payroll for this month first.", variant: "destructive" });
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: company } = await supabase.from("companies").select("name").eq("user_id", user.id).maybeSingle();
      const compName = (company as any)?.name || "Company";

      // Helper: amount to words (simplified)
      const toWords = (n: number) => {
        const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
        const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
        if (n === 0) return "Zero";
        const convert = (x: number): string => {
          if (x < 20) return units[x];
          if (x < 100) return tens[Math.floor(x / 10)] + (x % 10 > 0 ? " " + units[x % 10] : "");
          if (x < 1000) return units[Math.floor(x / 100)] + " Hundred" + (x % 100 > 0 ? " " + convert(x % 100) : "");
          if (x < 100000) return convert(Math.floor(x / 1000)) + " Thousand" + (x % 1000 > 0 ? " " + convert(x % 1000) : "");
          return convert(Math.floor(x / 100000)) + " Lakh" + (x % 100000 > 0 ? " " + convert(x % 100000) : "");
        };
        return convert(Math.round(n)) + " Rupees Only";
      };

      const [yr, mn] = month.split("-");
      const monthLabel = format(new Date(Number(yr), Number(mn) - 1, 1), "MMMM yyyy");

      payrollData.forEach((row: any, idx: number) => {
        setTimeout(async () => {
          const jsPDF = await loadJsPDF();
          const doc = new jsPDF({ unit: "mm", format: "a4" });
          const pageW = doc.internal.pageSize.getWidth(); const m = 18;
          let y = 12;

          // Header strip
          doc.setFillColor(30, 58, 138); doc.rect(0, 0, pageW, 10, "F");
          doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.setTextColor(20, 20, 80);
          doc.text(compName.toUpperCase(), pageW / 2, y + 4, { align: "center" }); y += 10;
          doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(80, 80, 80);
          doc.text(`PAYSLIP — ${monthLabel}`, pageW / 2, y, { align: "center" }); y += 7;
          doc.setDrawColor(200, 205, 225); doc.line(m, y, pageW - m, y); y += 5;

          // Employee info block
          const empName = row.employees?.name || `Employee ${idx + 1}`;
          const empCode = row.employees?.emp_code || "-";
          const desig = row.employees?.designation || "-";
          const dept = row.employees?.department || "-";
          doc.setFontSize(8.5); doc.setTextColor(40, 40, 40);
          doc.text(`Employee: ${empName}`, m, y); doc.text(`Emp Code: ${empCode}`, pageW - m, y, { align: "right" }); y += 5;
          doc.text(`Designation: ${desig}`, m, y); doc.text(`Department: ${dept}`, pageW - m, y, { align: "right" }); y += 5;
          doc.text(`Month: ${monthLabel}`, m, y); doc.text(`Days Worked: ${row.days_present || "-"}`, pageW - m, y, { align: "right" }); y += 5;
          doc.setDrawColor(210, 215, 230); doc.line(m, y, pageW - m, y); y += 5;

          // Two-column pay table
          const halfW = (pageW - m * 2) / 2 - 3;
          const colLeft = m; const colRight = m + halfW + 6;

          // Headers
          doc.setFont("helvetica", "bold"); doc.setFontSize(8);
          doc.setFillColor(30, 58, 138); doc.rect(colLeft, y - 4, halfW, 7, "F"); doc.rect(colRight, y - 4, halfW, 7, "F");
          doc.setTextColor(255, 255, 255);
          doc.text("EARNINGS", colLeft + 2, y); doc.text("Amount (₹)", colLeft + halfW - 2, y, { align: "right" });
          doc.text("DEDUCTIONS", colRight + 2, y); doc.text("Amount (₹)", colRight + halfW - 2, y, { align: "right" });
          y += 6; doc.setTextColor(30, 30, 30); doc.setFont("helvetica", "normal");

          const earnings: [string, number][] = [
            ["Basic Salary", Number(row.basic_paid || 0)],
            ["House Rent Allowance", Number(row.hra_paid || 0)],
            ["DA", Number(row.da_paid || 0)],
            ["Other Allowances", Number(row.other_allowances || 0)],
            ["Overtime Pay", Number(row.overtime_pay || 0)],
          ].filter(([, v]) => (v as number) > 0);

          const deductions: [string, number][] = [
            ["Provident Fund (EPF)", Number(row.epf_employee || 0)],
            ["State Insurance (ESIC)", Number(row.esic_employee || 0)],
            ["Professional Tax (PT)", Number(row.pt || 0)],
            ["TDS", Number(row.tds || 0)],
            ["Labour Welfare Fund", Number(row.lwf_employee || 0)],
          ].filter(([, v]) => (v as number) > 0);

          const maxLen = Math.max(earnings.length, deductions.length);
          for (let i = 0; i < maxLen; i++) {
            if (i % 2 === 0) {
              doc.setFillColor(245, 247, 255);
              doc.rect(colLeft, y - 4, halfW, 6, "F");
              doc.rect(colRight, y - 4, halfW, 6, "F");
            }
            if (earnings[i]) { doc.text(earnings[i][0], colLeft + 2, y); doc.text(earnings[i][1].toLocaleString("en-IN"), colLeft + halfW - 2, y, { align: "right" }); }
            if (deductions[i]) { doc.text(deductions[i][0], colRight + 2, y); doc.text(deductions[i][1].toLocaleString("en-IN"), colRight + halfW - 2, y, { align: "right" }); }
            y += 6;
          }

          // Totals row
          const grossEarnings = Number(row.gross_earnings || 0);
          const totalDed = Number(row.total_deductions || 0);
          const netPay = Number(row.net_pay || 0);
          doc.setFont("helvetica", "bold"); doc.setFillColor(220, 227, 245);
          doc.rect(colLeft, y - 4, halfW, 7, "F"); doc.rect(colRight, y - 4, halfW, 7, "F");
          doc.text("Gross Earnings", colLeft + 2, y); doc.text(grossEarnings.toLocaleString("en-IN"), colLeft + halfW - 2, y, { align: "right" });
          doc.text("Total Deductions", colRight + 2, y); doc.text(totalDed.toLocaleString("en-IN"), colRight + halfW - 2, y, { align: "right" });
          y += 10;

          // Net pay
          doc.setFillColor(30, 58, 138); doc.rect(m, y - 5, pageW - m * 2, 10, "F");
          doc.setTextColor(255, 255, 255); doc.setFontSize(10);
          doc.text(`NET PAY: ₹${netPay.toLocaleString("en-IN")}`, m + 4, y + 1);
          doc.setFontSize(7.5); doc.text(`(${toWords(netPay)})`, m + 4, y + 5);
          y += 14; doc.setTextColor(40, 40, 40);

          // Signature
          doc.setFontSize(8); doc.setFont("helvetica", "normal");
          doc.text("Employee Signature: _______________________", m, y);
          doc.text("Authorised Signatory: _______________________", pageW - m, y, { align: "right" }); y += 6;
          doc.setFontSize(7); doc.setTextColor(130, 130, 130);
          doc.text("This is a computer-generated payslip and does not require a physical signature.", pageW / 2, y, { align: "center" }); y += 5;
          doc.text(`Generated: ${format(new Date(), "dd MMM yyyy HH:mm")} — ${compName}`, pageW / 2, y, { align: "center" });

          await addOpticompBharatFooter(doc as any);
          doc.save(`Payslip_${empCode || idx + 1}_${month}.pdf`);
        }, idx * 150);
      });

      toast({ title: "Payslips Generating…", description: `${payrollData.length} individual payslip PDFs will download shortly.` });
    } catch (err: any) {
      toast({ title: "Error", description: getSafeErrorMessage(err), variant: "destructive" });
    }
  };

  const totals = useMemo(() => payrollData.reduce(
    (acc, item) => ({
      gross: acc.gross + Number(item.gross_earnings || 0),
      epfEmployee: acc.epfEmployee + Number(item.epf_employee || 0),
      epfEmployer: acc.epfEmployer + Number(item.epf_employer || 0),
      epsEmployer: acc.epsEmployer + Number(item.eps_employer || 0),
      esicEmployee: acc.esicEmployee + Number(item.esic_employee || 0),
      esicEmployer: acc.esicEmployer + Number(item.esic_employer || 0),
      pt: acc.pt + Number(item.pt || 0),
      tds: acc.tds + Number(item.tds || 0),
      lwfEmployee: acc.lwfEmployee + Number(item.lwf_employee || 0),
      lwfEmployer: acc.lwfEmployer + Number(item.lwf_employer || 0),
      wcLiability: acc.wcLiability + Number(item.wc_liability || 0),
      netPay: acc.netPay + Number(item.net_pay || 0),
    }),
    { gross: 0, epfEmployee: 0, epfEmployer: 0, epsEmployer: 0, esicEmployee: 0, esicEmployer: 0, pt: 0, tds: 0, lwfEmployee: 0, lwfEmployer: 0, wcLiability: 0, netPay: 0 }
  ), [payrollData]);

  const filteredPayrollData = useMemo(() => {
    if (!searchQuery.trim()) return payrollData;
    const lowerQuery = searchQuery.toLowerCase();
    return payrollData.filter(item => {
      const empCode = (item as any).employees?.emp_code || "";
      const empName = (item as any).employees?.name || "";
      return empCode.toLowerCase().includes(lowerQuery) || empName.toLowerCase().includes(lowerQuery);
    });
  }, [payrollData, searchQuery]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Payroll Processing</h1>
      <p className="mt-1 text-muted-foreground">Calculate and save monthly payroll with statutory deductions</p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Processing Parameters</CardTitle>
          <CardDescription>Select month and working days to process payroll</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="month">Month</Label>
              <Input id="month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="workingDays">Working Days</Label>
              <Input
                id="workingDays"
                type="number"
                value={workingDays}
                onChange={(e) => setWorkingDays(parseInt(e.target.value) || 26)}
                min={1}
                max={31}
                className="w-24"
              />
            </div>
            <div>
              {existingRun ? (
                <div className="flex gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button disabled={processing} className="w-full sm:w-auto">
                        {processing ? "Processing..." : "Reprocess Payroll"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reprocess payroll for {month}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will recalculate payroll for all {employees.length} employees. Existing payroll data for this month will be overwritten. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={processPayroll}>Yes, Reprocess</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  {payrollData.length > 0 && <PayrollAuditModal payrollData={payrollData} disabled={processing} />}
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button onClick={processPayroll} disabled={processing} className="w-full sm:w-auto">
                    {processing ? "Processing..." : "Process Payroll"}
                  </Button>
                  {payrollData.length > 0 && <PayrollAuditModal payrollData={payrollData} disabled={processing} />}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {existingRun && payrollData.length > 0 && (
        <div className="mt-6 flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg dark:bg-green-950/20 dark:border-green-800">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          <span className="font-medium text-green-800 dark:text-green-300">
            ECR Ready — {payrollData.length} employees, {month}
          </span>
          <Button size="sm" onClick={downloadECR} variant="outline">
            <Download className="mr-1 h-4 w-4" />
            EPF ECR (.txt)
          </Button>
          <Button size="sm" onClick={downloadESICForm5} variant="outline">
            <Download className="mr-1 h-4 w-4" />
            ESIC Form 5 (.pdf)
          </Button>
          <Button size="sm" onClick={downloadPTFormV} variant="outline">
            <Download className="mr-1 h-4 w-4" />
            PT Return (.pdf)
          </Button>
          <Button size="sm" onClick={downloadForm16} variant="outline">
            <Download className="mr-1 h-4 w-4" />
            Form 16 (.pdf)
          </Button>
          <Button size="sm" onClick={generatePayslips} className="gap-1 bg-green-600 hover:bg-green-700 text-white">
            <Download className="mr-1 h-4 w-4" />
            Payslips (All)
          </Button>
        </div>
      )}

      {payrollData.length > 0 && (
        <>
          {/* ── Gap 2: Wage payment deadline banner (Code on Wages Ch III) ── */}
          {paymentDeadlineInfo && paymentDeadlineInfo.status !== 'ok' && (
            <div className={`mt-4 flex items-start gap-3 p-3 rounded-lg border text-sm ${
              paymentDeadlineInfo.status === 'overdue'
                ? 'bg-red-50 border-red-200 text-red-900 dark:bg-red-950/20 dark:border-red-800 dark:text-red-300'
                : paymentDeadlineInfo.status === 'urgent'
                ? 'bg-orange-50 border-orange-200 text-orange-900 dark:bg-orange-950/20 dark:border-orange-800 dark:text-orange-300'
                : 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-300'
            }`}>
              <Clock className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">
                  {paymentDeadlineInfo.status === 'overdue'
                    ? `⚠ Payment overdue by ${paymentDeadlineInfo.days} day${paymentDeadlineInfo.days === 1 ? '' : 's'}`
                    : paymentDeadlineInfo.status === 'urgent'
                    ? `⚠ Payment due in ${paymentDeadlineInfo.days} day${paymentDeadlineInfo.days === 1 ? '' : 's'}`
                    : `Payment deadline approaching — ${paymentDeadlineInfo.days} days remaining`}
                </p>
                <p className="text-xs mt-0.5 opacity-80">
                  Code on Wages, 2019 — Chapter III: monthly wages must be paid by the 7th of the succeeding month
                  (deadline: {paymentDeadlineInfo.deadline.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}).
                </p>
              </div>
            </div>
          )}
          <Card className="mt-4 bg-muted/30">
            <CardContent className="p-4 text-xs">
              <p className="font-medium mb-2">Maharashtra PT Slabs</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-blue-500 rounded" />
                  <span>≤ ₹7,500: ₹0</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-500 rounded" />
                  <span>₹7,501–₹10,000: ₹175</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-yellow-500 rounded" />
                  <span>₹10,001–₹15,000: ₹200</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-orange-500 rounded" />
                  <span>&gt; ₹15,000: ₹200 (₹300 Feb)</span>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Gross</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">₹{totals.gross.toLocaleString("en-IN")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>EPF (EE)</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">₹{totals.epfEmployee.toLocaleString("en-IN")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>LWF (EE+ER)</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">₹{(totals.lwfEmployee + totals.lwfEmployer).toLocaleString("en-IN")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>WC/EC Premium</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">₹{totals.wcLiability.toLocaleString("en-IN")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Net Pay</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">₹{totals.netPay.toLocaleString("en-IN")}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader className="flex flex-row flex-wrap items-center gap-4 justify-between border-b pb-4 mb-4">
              <div>
                <CardTitle>Payroll Details</CardTitle>
                <CardDescription>{filteredPayrollData.length} of {payrollData.length} employees • {month}</CardDescription>
              </div>
              <div className="w-full sm:w-auto relative">
                <Input
                  placeholder="Search by name or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-64"
                />
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {complianceAlerts.length > 0 && (
                <div className="mb-4 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300">
                  <p className="font-semibold flex items-center gap-2 mb-1">
                    <AlertCircle className="h-4 w-4" /> Compliance Warnings (Code on Wages)
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    {complianceAlerts.map((alert, idx) => (
                      <li key={idx}>{alert}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">EPF (EE)</TableHead>
                      <TableHead className="text-right">ESIC (EE)</TableHead>
                      <TableHead className="text-right">PT</TableHead>
                      <TableHead className="text-right">WC/EC (ER)</TableHead>
                      <TableHead className="text-center">Min Wage</TableHead>
                      <TableHead className="text-right">LWF (EE)</TableHead>
                      <TableHead className="text-right">Net Pay</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayrollData.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell>{(item as any).employees?.emp_code}</TableCell>
                        <TableCell className="font-medium">{(item as any).employees?.name}</TableCell>
                        <TableCell className="text-right">₹{Number(item.gross_earnings).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right">₹{Number(item.epf_employee).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right">₹{Number(item.esic_employee).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right">₹{Number(item.pt).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right">₹{Number(item.wc_liability || 0).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-center">
                          {item.min_wage_status === 'compliant' ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">OK</Badge>
                          ) : item.min_wage_status === 'below_floor' || item.min_wage_status === 'below_state_min' ? (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs" title={`Min wage: ₹${Number(item.min_wage_applicable || 0).toLocaleString('en-IN')}`}>
                              -₹{Number(item.min_wage_shortfall || 0).toLocaleString('en-IN')}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 text-xs">N/A</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">₹{Number(item.lwf_employee).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right font-semibold">
                          ₹{Number(item.net_pay).toLocaleString("en-IN")}
                          {(() => {
                            const gross = Number(item.gross_earnings || 0);
                            const deds = Number(item.epf_employee || 0) + Number(item.esic_employee || 0) + Number(item.pt || 0) + Number(item.lwf_employee || 0);
                            const pct = gross > 0 ? (deds / gross) * 100 : 0;
                            return pct > 50 ? (
                              <AlertCircle
                                className="inline h-3 w-3 text-amber-500 ml-1 cursor-help"
                                title={`Deductions ${pct.toFixed(1)}% of gross — exceeds 50% statutory limit (Code on Wages §26)`}
                              />
                            ) : null;
                          })()}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={2}>Total</TableCell>
                      <TableCell className="text-right">₹{totals.gross.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right">₹{totals.epfEmployee.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right">₹{totals.esicEmployee.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right">₹{totals.pt.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right">₹{totals.wcLiability.toLocaleString("en-IN")}</TableCell>
                      <TableCell />
                      <TableCell className="text-right">₹{totals.lwfEmployee.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right">₹{totals.netPay.toLocaleString("en-IN")}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default Payroll;
