import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addOpticompBharatFooter } from "@/lib/pdfUtils";

interface PayslipRow {
  id: string;
  month: number;
  year: number;
  gross_salary: number;
  basic: number;
  hra: number;
  da: number;
  allowances: number;
  epf_employee: number;
  esic_employee: number;
  professional_tax: number;
  tds: number;
  lwf_employee: number;
  other_deductions: number;
  net_salary: number;
}

const monthName = (m: number) =>
  new Date(2000, m - 1, 1).toLocaleString("en-IN", { month: "long" });

const ESSPayslips = () => {
  const [payslips, setPayslips] = useState<PayslipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [employeeName, setEmployeeName] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadPayslips();
  }, []);

  const loadPayslips = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: emp } = await supabase
        .from("employees")
        .select("id, name")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!emp) { setLoading(false); return; }
      setEmployeeName(emp.name);

      const { data, error } = await supabase
        .from("payroll_details")
        .select(`
          id,
          gross_salary,
          basic,
          hra,
          da,
          allowances,
          epf_employee,
          esic_employee,
          professional_tax,
          tds,
          lwf_employee,
          other_deductions,
          net_salary,
          payroll_runs ( month, year )
        `)
        .eq("employee_id", emp.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows: PayslipRow[] = (data ?? []).map((d: any) => ({
        id: d.id,
        month: d.payroll_runs?.month ?? 0,
        year: d.payroll_runs?.year ?? 0,
        gross_salary: d.gross_salary ?? 0,
        basic: d.basic ?? 0,
        hra: d.hra ?? 0,
        da: d.da ?? 0,
        allowances: d.allowances ?? 0,
        epf_employee: d.epf_employee ?? 0,
        esic_employee: d.esic_employee ?? 0,
        professional_tax: d.professional_tax ?? 0,
        tds: d.tds ?? 0,
        lwf_employee: d.lwf_employee ?? 0,
        other_deductions: d.other_deductions ?? 0,
        net_salary: d.net_salary ?? 0,
      }));

      setPayslips(rows);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const totalDeductions = (p: PayslipRow) =>
    (p.epf_employee ?? 0) +
    (p.esic_employee ?? 0) +
    (p.professional_tax ?? 0) +
    (p.tds ?? 0) +
    (p.lwf_employee ?? 0) +
    (p.other_deductions ?? 0);

  const downloadPDF = async (p: PayslipRow) => {
    const doc = new jsPDF();
    const title = `Payslip — ${monthName(p.month)} ${p.year}`;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("OpticompBharat · Employee Payslip", 14, 20);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Employee: ${employeeName}`, 14, 30);
    doc.text(`Period: ${monthName(p.month)} ${p.year}`, 14, 36);

    autoTable(doc, {
      startY: 44,
      head: [["Earnings", "Amount (₹)"]],
      body: [
        ["Basic Salary", p.basic.toLocaleString("en-IN")],
        ["HRA", p.hra.toLocaleString("en-IN")],
        ["Dearness Allowance (DA)", p.da.toLocaleString("en-IN")],
        ["Other Allowances", p.allowances.toLocaleString("en-IN")],
        ["Gross Pay", p.gross_salary.toLocaleString("en-IN")],
      ],
      foot: [["Gross Pay", `₹${p.gross_salary.toLocaleString("en-IN")}`]],
      theme: "striped",
    });

    const deductY = (doc as any).lastAutoTable.finalY + 8;
    autoTable(doc, {
      startY: deductY,
      head: [["Deductions", "Amount (₹)"]],
      body: [
        ["EPF (Employee)", p.epf_employee.toLocaleString("en-IN")],
        ["ESIC (Employee)", p.esic_employee.toLocaleString("en-IN")],
        ["Professional Tax", p.professional_tax.toLocaleString("en-IN")],
        ["TDS", p.tds.toLocaleString("en-IN")],
        ["LWF", p.lwf_employee.toLocaleString("en-IN")],
        ["Other Deductions", p.other_deductions.toLocaleString("en-IN")],
      ],
      foot: [["Total Deductions", `₹${totalDeductions(p).toLocaleString("en-IN")}`]],
      theme: "striped",
    });

    const netY = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(`Net Pay: ₹${p.net_salary.toLocaleString("en-IN")}`, 14, netY + 4);

    await addOpticompBharatFooter(doc);
    doc.save(`Payslip_${monthName(p.month)}_${p.year}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">My Payslips</h1>

      {payslips.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No payslips found yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {payslips.map((p) => (
            <Card key={p.id}>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {monthName(p.month)} {p.year}
                    </CardTitle>
                    <CardDescription className="mt-0.5 flex gap-4">
                      <span>Gross: ₹{p.gross_salary.toLocaleString("en-IN")}</span>
                      <span>Deductions: ₹{totalDeductions(p).toLocaleString("en-IN")}</span>
                      <span className="font-semibold text-green-700">Net: ₹{p.net_salary.toLocaleString("en-IN")}</span>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadPDF(p)}
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      PDF
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                    >
                      {expanded === p.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {expanded === p.id && (
                <CardContent className="border-t pt-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Earnings */}
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Earnings</h3>
                      <div className="space-y-1 text-sm">
                        {[
                          ["Basic Salary", p.basic],
                          ["HRA", p.hra],
                          ["DA", p.da],
                          ["Other Allowances", p.allowances],
                        ].map(([label, val]) => (
                          <div key={label as string} className="flex justify-between">
                            <span className="text-muted-foreground">{label}</span>
                            <span>₹{(val as number).toLocaleString("en-IN")}</span>
                          </div>
                        ))}
                        <div className="flex justify-between border-t pt-1 font-semibold">
                          <span>Gross Pay</span>
                          <span>₹{p.gross_salary.toLocaleString("en-IN")}</span>
                        </div>
                      </div>
                    </div>
                    {/* Deductions */}
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Deductions</h3>
                      <div className="space-y-1 text-sm">
                        {[
                          ["EPF (Employee)", p.epf_employee],
                          ["ESIC (Employee)", p.esic_employee],
                          ["Professional Tax", p.professional_tax],
                          ["TDS", p.tds],
                          ["LWF", p.lwf_employee],
                          ["Other", p.other_deductions],
                        ].map(([label, val]) => (
                          <div key={label as string} className="flex justify-between">
                            <span className="text-muted-foreground">{label}</span>
                            <span>₹{(val as number).toLocaleString("en-IN")}</span>
                          </div>
                        ))}
                        <div className="flex justify-between border-t pt-1 font-semibold">
                          <span>Total Deductions</span>
                          <span>₹{totalDeductions(p).toLocaleString("en-IN")}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between rounded-md bg-green-50 px-4 py-3">
                    <span className="font-semibold text-green-800">Net Pay</span>
                    <span className="text-xl font-bold text-green-700">₹{p.net_salary.toLocaleString("en-IN")}</span>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ESSPayslips;
