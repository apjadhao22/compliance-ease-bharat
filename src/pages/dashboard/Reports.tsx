import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Scale } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import jsPDF from "jspdf";
import "jspdf-autotable";

const reports = [
  { name: "Monthly Compliance Summary", description: "EPF, ESIC, PT, TDS overview for the current month", icon: FileText },
  { name: "ECR File (EPF)", description: "Electronic Challan cum Return for EPFO portal upload", icon: Download },
  { name: "Form D (ESIC)", description: "ESIC contribution statement", icon: Download },
  { name: "Form 16", description: "Annual TDS certificate for employees", icon: Download },
  { name: "Employee-wise Breakdown", description: "Detailed salary and deduction report per employee", icon: FileText },
  { name: "Compliance Audit Report", description: "Summary of all filings and pending actions", icon: FileText },
];

const Reports = () => {
  const { toast } = useToast();

  const generatePayEquityReport = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: company } = await supabase
        .from("companies")
        .select("id, name, state")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!company) {
        toast({ title: "No company", description: "Set up your company first.", variant: "destructive" });
        return;
      }

      // Get payroll runs for this company
      const { data: runs } = await supabase
        .from("payroll_runs")
        .select("id")
        .eq("company_id", company.id);

      if (!runs || runs.length === 0) {
        toast({ title: "No payroll data", description: "Process payroll first.", variant: "destructive" });
        return;
      }

      const runIds = runs.map(r => r.id);

      const { data: payroll } = await supabase
        .from("payroll_details")
        .select("basic_paid, gross_earnings, employee_id, employees(gender, emp_code, name)")
        .in("payroll_run_id", runIds)
        .limit(200);

      if (!payroll || payroll.length === 0) {
        toast({ title: "No payroll data", description: "Process payroll first.", variant: "destructive" });
        return;
      }

      const doc = new jsPDF();

      // Header
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("PAY EQUITY AUDIT REPORT", 105, 25, { align: "center" });
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text("Equal Remuneration Act 1976 / Code on Wages 2019", 105, 33, { align: "center" });
      doc.text(company.name || "Your Company", 105, 43, { align: "center" });
      doc.text(`Generated: ${format(new Date(), "dd MMM yyyy")}`, 105, 50, { align: "center" });

      // Gender breakdown
      const maleRecords = payroll.filter(p => (p.employees as any)?.gender === "Male");
      const femaleRecords = payroll.filter(p => (p.employees as any)?.gender === "Female");
      const otherRecords = payroll.filter(p => (p.employees as any)?.gender === "Other");
      const total = payroll.length;

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("1. WORKFORCE BREAKDOWN", 20, 65);

      (doc as any).autoTable({
        startY: 70,
        head: [["Gender", "Count", "%"]],
        body: [
          ["Male", maleRecords.length, `${((maleRecords.length / total) * 100).toFixed(1)}%`],
          ["Female", femaleRecords.length, `${((femaleRecords.length / total) * 100).toFixed(1)}%`],
          ["Other", otherRecords.length, `${((otherRecords.length / total) * 100).toFixed(1)}%`],
        ],
        styles: { fontSize: 10 },
        columnStyles: { 2: { halign: "right" } },
      });

      // Average pay by gender
      const avg = (arr: any[], field: string) => {
        if (arr.length === 0) return 0;
        return arr.reduce((s, p) => s + Number(p[field] || 0), 0) / arr.length;
      };

      const maleAvgBasic = avg(maleRecords, "basic_paid");
      const femaleAvgBasic = avg(femaleRecords, "basic_paid");
      const maleGrossAvg = avg(maleRecords, "gross_earnings");
      const femaleGrossAvg = avg(femaleRecords, "gross_earnings");

      const maxBasic = Math.max(maleAvgBasic, femaleAvgBasic);
      const payGap = maxBasic > 0 ? (Math.abs(maleAvgBasic - femaleAvgBasic) / maxBasic) * 100 : 0;
      const maxGross = Math.max(maleGrossAvg, femaleGrossAvg);
      const grossGap = maxGross > 0 ? (Math.abs(maleGrossAvg - femaleGrossAvg) / maxGross) * 100 : 0;
      const complianceStatus = payGap < 5 ? "PASS" : "REVIEW";

      const finalY1 = (doc as any).lastAutoTable.finalY + 10;
      doc.setFont("helvetica", "bold");
      doc.text("2. GENDER PAY ANALYSIS", 20, finalY1);

      (doc as any).autoTable({
        startY: finalY1 + 5,
        head: [["Metric", "Male", "Female", "Gap %"]],
        body: [
          ["Avg Basic Salary", `₹${Math.round(maleAvgBasic).toLocaleString("en-IN")}`, `₹${Math.round(femaleAvgBasic).toLocaleString("en-IN")}`, `${payGap.toFixed(1)}%`],
          ["Avg Gross", `₹${Math.round(maleGrossAvg).toLocaleString("en-IN")}`, `₹${Math.round(femaleGrossAvg).toLocaleString("en-IN")}`, `${grossGap.toFixed(1)}%`],
        ],
        styles: { fontSize: 10 },
        columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
      });

      // Compliance verdict
      const finalY2 = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(complianceStatus === "PASS" ? "PASS ✅" : "REVIEW ⚠️", 20, finalY2);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(
        payGap < 5
          ? "Gender pay gap within acceptable threshold (<5%). COMPLIANT."
          : "Gap exceeds 5%. Review designations and equal work classifications.",
        20,
        finalY2 + 6
      );

      // Declaration
      const finalY3 = finalY2 + 25;
      doc.rect(20, finalY3, 170, 20);
      doc.text("Declaration:", 22, finalY3 + 5);
      doc.text(
        "I confirm that wages are paid equally for equal/similar work without gender discrimination.",
        22,
        finalY3 + 10
      );
      doc.text("Signature:", 22, finalY3 + 15);
      doc.text("Date:", 22, finalY3 + 18);

      doc.save(`PayEquityReport_${format(new Date(), "yyyyMMdd")}.pdf`);

      toast({
        title: "Pay Equity Report Generated! 📊",
        description: `${complianceStatus} | Gender pay gap: ${payGap.toFixed(1)}%`,
      });
    } catch (error: any) {
      toast({ title: "Report failed", description: "An error occurred generating the report. Please try again.", variant: "destructive" });
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Reports & Forms</h1>
      <p className="mt-1 text-muted-foreground">Generate compliance reports and statutory forms</p>

      {/* Pay Equity Report */}
      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            Equal Pay Compliance
          </CardTitle>
          <CardDescription>Equal Remuneration Act 1976 / Code on Wages 2019</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={generatePayEquityReport} className="w-full">
            <Download className="mr-2 h-4 w-4" /> Generate Pay Equity Report
          </Button>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => (
          <Card key={r.name} className="flex flex-col">
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <r.icon className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-base">{r.name}</CardTitle>
              <CardDescription className="text-sm">{r.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => toast({ title: "Coming soon", description: "Navigate to the relevant module to generate this report." })}
              >
                <Download className="mr-2 h-4 w-4" /> Generate
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Reports;
