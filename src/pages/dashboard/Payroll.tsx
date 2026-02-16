import { useState, useEffect } from "react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Download } from "lucide-react";
import {
  calculateEPF,
  calculateESIC,
  calculatePT,
  calculateProration,
  calculateOvertime,
  calculateTDS,
  calculateLWF,
  defineWages,
} from "@/lib/calculations";

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
  const [existingRun, setExistingRun] = useState<any>(null);

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
          .eq("status", "Active");

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
        .select("*")
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

      const payrollDetails: any[] = [];

      for (const emp of employees) {
        const basic = Number(emp.basic || 0);
        const da = Number(emp.da || 0);
        const retaining = Number(emp.retaining_allowance || 0);
        const hra = Number(emp.hra || 0);
        const otherAllowances = Number(emp.allowances || 0);

        const daysPresent = workingDays;
        const payableDays = daysPresent;

        const basicPaid = calculateProration(basic, workingDays, payableDays);
        const daPaid = calculateProration(da, workingDays, payableDays);
        const retainingPaid = calculateProration(retaining, workingDays, payableDays);
        const hraPaid = calculateProration(hra, workingDays, payableDays);
        const allowancesPaid = calculateProration(otherAllowances, workingDays, payableDays);

        const totalAllowancesPaid = hraPaid + allowancesPaid;

        // Determine statutory "wages" base depending on regime
        let wagesBase = basicPaid;
        if (complianceRegime === "labour_codes") {
          const wageResult = defineWages({
            basic: basicPaid,
            da: daPaid,
            retainingAllowance: retainingPaid,
            allowances: totalAllowancesPaid,
          });
          wagesBase = wageResult.wages;
        }

        const overtimePay = calculateOvertime(basic, workingDays, 0);

        const grossEarnings = basicPaid + daPaid + retainingPaid + hraPaid + allowancesPaid + overtimePay;

        const epf = emp.epf_applicable
          ? calculateEPF(complianceRegime === "labour_codes" ? wagesBase : basicPaid)
          : { employeeEPF: 0, employerEPF: 0, employerEPS: 0 };
        const esic = emp.esic_applicable ? calculateESIC(grossEarnings) : { employeeESIC: 0, employerESIC: 0 };
        const pt = emp.pt_applicable ? calculatePT(grossEarnings, month) : 0;

        const annualGross = grossEarnings * 12;
        const tds = calculateTDS(annualGross);
        const lwf = calculateLWF(month, true);

        const totalDeductions =
          epf.employeeEPF +
          esic.employeeESIC +
          pt +
          tds.monthlyTDS +
          lwf.employeeContribution;

        const netPay = grossEarnings - totalDeductions;

        payrollDetails.push({
          payroll_run_id: run.id,
          employee_id: emp.id,
          days_present: daysPresent,
          paid_leaves: 0,
          unpaid_leaves: 0,
          overtime_hours: 0,
          basic_paid: basicPaid,
          hra_paid: hraPaid,
          allowances_paid: allowancesPaid,
          overtime_pay: overtimePay,
          gross_earnings: grossEarnings,
          epf_employee: epf.employeeEPF,
          epf_employer: epf.employerEPF,
          eps_employer: epf.employerEPS,
          esic_employee: esic.employeeESIC,
          esic_employer: esic.employerESIC,
          pt,
          tds: tds.monthlyTDS,
          lwf_employee: lwf.employeeContribution,
          lwf_employer: lwf.employerContribution,
          total_deductions: totalDeductions,
          net_pay: netPay,
        });
      }

      await supabase.from("payroll_details").delete().eq("payroll_run_id", run.id);

      const { error: detailsError } = await supabase.from("payroll_details").insert(payrollDetails);
      if (detailsError) throw detailsError;

      // Refetch with employee names
      const { data: fullData } = await supabase
        .from("payroll_details")
        .select("*, employees (emp_code, name, uan)")
        .eq("payroll_run_id", run.id);

      setPayrollData(fullData || []);
      setExistingRun(run);

      toast({ title: "Success!", description: `Payroll processed for ${employees.length} employees.` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
      toast({ title: "ECR generation failed", description: error.message, variant: "destructive" });
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

      doc.save(`ESIC_Form5_${month}_${format(new Date(), "yyyyMMdd")}.pdf`);

      toast({ title: "ESIC Form 5 Generated! 📄", description: `Official ESIC Form 5 PDF for ${payrollData.length} employees (${month}).` });
    } catch (error: any) {
      toast({ title: "ESIC Form 5 failed", description: error.message, variant: "destructive" });
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

      const doc = new jsPDF();

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("MAHARASHTRA PROFESSIONAL TAX FORM V", 105, 20, { align: "center" });
      doc.setFontSize(12);
      doc.text("Monthly Return", 105, 28, { align: "center" });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Name: ${company?.name || ""}`, 15, 40);
      doc.text(`PT Registration No.: ${company?.pt_rc_number || ""}`, 15, 46);
      doc.text(`Period: ${month}`, 15, 52);

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

      doc.save(`PT_FormV_${month}_${format(new Date(), "yyyyMMdd")}.pdf`);

      toast({ title: "PT Form V Generated! 📄", description: `Maharashtra PT Form V for ${payrollData.length} employees (${month}).` });
    } catch (error: any) {
      toast({ title: "PT Form V failed", description: error.message, variant: "destructive" });
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

      const doc = new jsPDF();

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("FORM No. 16", 105, 20, { align: "center" });
      doc.setFontSize(12);
      doc.text("PART A", 105, 28, { align: "center" });
      doc.setFontSize(10);
      doc.text("Certificate under section 203 of the Income-tax Act, 1961", 105, 35, { align: "center" });
      doc.text("for tax deducted at source on salary", 105, 41, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.text(`Name of Deductor: ${company?.name || ""}`, 15, 55);
      doc.text(`TAN: ${company?.tan || ""}`, 15, 61);
      const fy = `${month.slice(0, 4)}-${(parseInt(month.slice(0, 4)) + 1).toString().slice(-2)}`;
      doc.text(`Assessment Year: ${fy}`, 15, 67);

      // Summary per employee — aggregate
      const annualGross = payrollData.reduce((s: number, i: any) => s + Number(i.gross_earnings || 0), 0) * 12;
      const annualTDS = payrollData.reduce((s: number, i: any) => s + Number(i.tds || 0), 0) * 12;
      const taxableIncome = Math.max(0, annualGross - 75000);

      (doc as any).autoTable({
        startY: 75,
        head: [["Particulars", "Amount (₹)"]],
        body: [
          ["1. Gross Salary (u/s 17(1))", annualGross.toLocaleString("en-IN")],
          ["2. Less: Standard Deduction (u/s 16(ia))", "75,000"],
          ["3. Total Income (1 - 2)", taxableIncome.toLocaleString("en-IN")],
          ["4. Tax on Total Income", annualTDS.toLocaleString("en-IN")],
          ["5. Less: Rebate u/s 87A", taxableIncome <= 700000 ? annualTDS.toLocaleString("en-IN") : "0"],
          ["6. Tax Payable", taxableIncome <= 700000 ? "0" : annualTDS.toLocaleString("en-IN")],
          ["7. Add: Cess @ 4%", Math.round(annualTDS * 0.04).toLocaleString("en-IN")],
          ["8. Total Tax Deducted", annualTDS.toLocaleString("en-IN")],
        ],
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 1: { halign: "right" } },
      });

      const finalY = (doc as any).lastAutoTable.finalY + 12;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("PART B (Annexure)", 105, finalY, { align: "center" });
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Details of salary paid and any other income and tax deducted", 105, finalY + 7, { align: "center" });

      doc.setFontSize(10);
      const sigY = finalY + 25;
      doc.rect(15, sigY, 80, 18);
      doc.text("Signature of Deductor", 17, sigY + 6);
      doc.text(`Date: ${format(new Date(), "dd/MM/yyyy")}`, 17, sigY + 12);
      doc.rect(110, sigY, 85, 18);
      doc.text("Verification", 112, sigY + 6);
      doc.text("I certify the information is correct.", 112, sigY + 12);

      doc.save(`Form16_${month}_${format(new Date(), "yyyyMMdd")}.pdf`);

      toast({ title: "Form 16 Generated! 📄", description: "TDS certificate (Part A+B) ready." });
    } catch (error: any) {
      toast({ title: "Form 16 failed", description: error.message, variant: "destructive" });
    }
  };

  const totals = payrollData.reduce(
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
      netPay: acc.netPay + Number(item.net_pay || 0),
    }),
    { gross: 0, epfEmployee: 0, epfEmployer: 0, epsEmployer: 0, esicEmployee: 0, esicEmployer: 0, pt: 0, tds: 0, lwfEmployee: 0, lwfEmployer: 0, netPay: 0 }
  );

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
              <Button onClick={processPayroll} disabled={processing}>
                {processing ? "Processing..." : existingRun ? "Reprocess Payroll" : "Process Payroll"}
              </Button>
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
            PT Form V (.pdf)
          </Button>
          <Button size="sm" onClick={downloadForm16} variant="outline">
            <Download className="mr-1 h-4 w-4" />
            Form 16 (.pdf)
          </Button>
        </div>
      )}

      {payrollData.length > 0 && (
        <>
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
                <CardDescription>Net Pay</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">₹{totals.netPay.toLocaleString("en-IN")}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Payroll Details</CardTitle>
              <CardDescription>{payrollData.length} employees • {month}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">EPF (EE)</TableHead>
                    <TableHead className="text-right">ESIC (EE)</TableHead>
                    <TableHead className="text-right">PT</TableHead>
                    <TableHead className="text-right">TDS</TableHead>
                    <TableHead className="text-right">LWF (EE)</TableHead>
                    <TableHead className="text-right">Net Pay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollData.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell>{(item as any).employees?.emp_code}</TableCell>
                      <TableCell className="font-medium">{(item as any).employees?.name}</TableCell>
                      <TableCell className="text-right">₹{Number(item.gross_earnings).toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right">₹{Number(item.epf_employee).toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right">₹{Number(item.esic_employee).toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right">₹{Number(item.pt).toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right">₹{Number(item.tds).toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right">₹{Number(item.lwf_employee).toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right font-semibold">₹{Number(item.net_pay).toLocaleString("en-IN")}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={2}>Total</TableCell>
                    <TableCell className="text-right">₹{totals.gross.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-right">₹{totals.epfEmployee.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-right">₹{totals.esicEmployee.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-right">₹{totals.pt.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-right">₹{totals.tds.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-right">₹{totals.lwfEmployee.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-right">₹{totals.netPay.toLocaleString("en-IN")}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default Payroll;
