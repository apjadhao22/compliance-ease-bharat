import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Download, Loader2, FileBarChart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ESSFeatureGate from "@/components/ess/ESSFeatureGate";

const MONTH_NAMES = ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];

const FY_OPTIONS = [
  { value: "2024-25", label: "FY 2024-25", startYear: 2024 },
  { value: "2025-26", label: "FY 2025-26", startYear: 2025 },
  { value: "2026-27", label: "FY 2026-27", startYear: 2026 },
];

const currentFY = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-based
  return month >= 4
    ? `${year}-${String(year + 1).slice(2)}`
    : `${year - 1}-${String(year).slice(2)}`;
};

interface PayslipRow {
  month: string; // "YYYY-MM"
  label: string;
  basic: number; hra: number; allowances: number; gross: number;
  epf_ee: number; esic_ee: number; pt: number; tds: number; lwf: number;
  epf_er: number; esic_er: number;
  net: number;
}

interface EmployeeInfo {
  id: string; name: string; employee_code?: string; pan?: string; uan?: string; company_id: string;
}

interface CompanyInfo {
  name: string; pan?: string; tan?: string;
}

const ESSAnnualStatement = () => {
  const [fy, setFy] = useState(currentFY());
  const [employee, setEmployee] = useState<EmployeeInfo | null>(null);
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [rows, setRows] = useState<PayslipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();

  useEffect(() => { initEmployee(); }, []);
  useEffect(() => { if (employee) fetchData(); }, [fy, employee?.id]);

  const initEmployee = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: emp } = await supabase
      .from("employees")
      .select("id, name, employee_code, pan, uan, company_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (emp) {
      setEmployee(emp as EmployeeInfo);
      const { data: co } = await supabase
        .from("companies")
        .select("name, pan, tan")
        .eq("id", emp.company_id)
        .maybeSingle();
      if (co) setCompany(co as CompanyInfo);
    }
  };

  const fyMonths = (fyStr: string): string[] => {
    const startYear = parseInt(fyStr.split("-")[0]);
    const months: string[] = [];
    for (let m = 4; m <= 12; m++) months.push(`${startYear}-${String(m).padStart(2, "0")}`);
    for (let m = 1; m <= 3; m++) months.push(`${startYear + 1}-${String(m).padStart(2, "0")}`);
    return months;
  };

  const fetchData = async () => {
    if (!employee) return;
    setLoading(true);
    try {
      const months = fyMonths(fy);
      const { data } = await supabase
        .from("payroll_details")
        .select(`
          basic_paid, hra_paid, allowances_paid, gross_earnings,
          epf_employee, epf_employer, esic_employee, esic_employer,
          pt, tds, lwf_employee, net_pay,
          payroll_runs!inner(month, company_id)
        `)
        .eq("employee_id", employee.id)
        .in("payroll_runs.month", months);

      const rowMap: Record<string, PayslipRow> = {};
      months.forEach((m, i) => {
        rowMap[m] = {
          month: m, label: MONTH_NAMES[i],
          basic: 0, hra: 0, allowances: 0, gross: 0,
          epf_ee: 0, esic_ee: 0, pt: 0, tds: 0, lwf: 0,
          epf_er: 0, esic_er: 0, net: 0,
        };
      });

      if (data) {
        data.forEach((d: any) => {
          const m = d.payroll_runs?.month;
          if (m && rowMap[m]) {
            rowMap[m] = {
              ...rowMap[m],
              basic: d.basic_paid ?? 0,
              hra: d.hra_paid ?? 0,
              allowances: d.allowances_paid ?? 0,
              gross: d.gross_earnings ?? 0,
              epf_ee: d.epf_employee ?? 0,
              esic_ee: d.esic_employee ?? 0,
              pt: d.pt ?? 0,
              tds: d.tds ?? 0,
              lwf: d.lwf_employee ?? 0,
              epf_er: d.epf_employer ?? 0,
              esic_er: d.esic_employer ?? 0,
              net: d.net_pay ?? 0,
            };
          }
        });
      }
      setRows(Object.values(rowMap));
    } finally {
      setLoading(false);
    }
  };

  const sum = (key: keyof PayslipRow) =>
    rows.reduce((acc, r) => acc + (r[key] as number), 0);

  const fmt = (n: number) => n === 0 ? "—" : `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0 })}`;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({ orientation: "landscape" });

      doc.setFontSize(14);
      doc.text(`Annual Salary Statement — FY ${fy}`, 14, 14);
      doc.setFontSize(10);
      doc.text(`Company: ${company?.name ?? "—"}`, 14, 22);
      if (company?.pan) doc.text(`Company PAN: ${company.pan}`, 14, 28);
      if (company?.tan) doc.text(`TAN: ${company.tan}`, 80, 28);
      doc.text(`Employee: ${employee?.name ?? "—"}`, 14, 36);
      if (employee?.employee_code) doc.text(`Emp Code: ${employee.employee_code}`, 80, 36);
      if (employee?.pan) doc.text(`PAN: ${employee.pan}`, 150, 36);
      if (employee?.uan) doc.text(`UAN: ${employee.uan}`, 210, 36);

      const tableRows = rows.map((r) => [
        r.label,
        fmt(r.basic), fmt(r.hra), fmt(r.allowances), fmt(r.gross),
        fmt(r.epf_ee), fmt(r.esic_ee), fmt(r.pt), fmt(r.tds), fmt(r.lwf),
        fmt(r.net),
      ]);
      tableRows.push([
        "TOTAL",
        fmt(sum("basic")), fmt(sum("hra")), fmt(sum("allowances")), fmt(sum("gross")),
        fmt(sum("epf_ee")), fmt(sum("esic_ee")), fmt(sum("pt")), fmt(sum("tds")), fmt(sum("lwf")),
        fmt(sum("net")),
      ]);

      autoTable(doc, {
        head: [["Month","Basic","HRA","Allowances","Gross","EPF (EE)","ESIC (EE)","PT","TDS","LWF","Net Pay"]],
        body: tableRows,
        startY: 44,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
        footStyles: { fontStyle: "bold" },
      });

      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text("This is a system-generated document from OpticompBharat.", 14, doc.internal.pageSize.getHeight() - 6);
      }

      doc.save(`Annual_Statement_${fy}_${employee?.name?.replace(/\s+/g, "_")}.pdf`);
      toast({ title: "PDF downloaded" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Download failed", description: err.message });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <ESSFeatureGate feature="annual_statement">
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Annual Salary Statement</h1>
            <p className="text-muted-foreground">Month-wise earnings and deductions for a financial year</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="space-y-1">
              <Label htmlFor="fy-select" className="text-xs text-muted-foreground">Financial Year</Label>
              <Select value={fy} onValueChange={setFy}>
                <SelectTrigger id="fy-select" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleDownload} disabled={downloading || loading} className="mt-5">
              {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Download PDF
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        {!loading && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Total Gross Earned", value: sum("gross"), color: "text-blue-700" },
              { label: "Total Deductions", value: sum("epf_ee") + sum("esic_ee") + sum("pt") + sum("tds") + sum("lwf"), color: "text-red-700" },
              { label: "Total Net Paid", value: sum("net"), color: "text-green-700" },
              { label: "Employer PF Contribution", value: sum("epf_er"), color: "text-purple-700" },
              { label: "Employer ESIC Contribution", value: sum("esic_er"), color: "text-orange-700" },
            ].map(({ label, value, color }) => (
              <Card key={label}>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={`mt-1 text-lg font-bold ${color}`}>
                    ₹{value.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Monthly table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileBarChart className="h-5 w-5" />
              Monthly Breakdown — FY {fy}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center p-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-xs font-medium text-muted-foreground">
                      <th className="whitespace-nowrap px-4 py-2 text-left">Month</th>
                      <th className="whitespace-nowrap px-3 py-2 text-right">Basic</th>
                      <th className="whitespace-nowrap px-3 py-2 text-right">HRA</th>
                      <th className="whitespace-nowrap px-3 py-2 text-right">Allow.</th>
                      <th className="whitespace-nowrap px-3 py-2 text-right font-semibold">Gross</th>
                      <th className="whitespace-nowrap px-3 py-2 text-right">EPF (EE)</th>
                      <th className="whitespace-nowrap px-3 py-2 text-right">ESIC (EE)</th>
                      <th className="whitespace-nowrap px-3 py-2 text-right">PT</th>
                      <th className="whitespace-nowrap px-3 py-2 text-right">TDS</th>
                      <th className="whitespace-nowrap px-3 py-2 text-right">LWF</th>
                      <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-green-700">Net Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.month} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-2 font-medium">{r.label}</td>
                        {[r.basic, r.hra, r.allowances, r.gross, r.epf_ee, r.esic_ee, r.pt, r.tds, r.lwf, r.net].map((v, i) => (
                          <td key={i} className={`whitespace-nowrap px-3 py-2 text-right ${i === 3 ? "font-semibold" : ""} ${i === 9 ? "font-semibold text-green-700" : ""}`}>
                            {v === 0 ? <span className="text-muted-foreground">—</span> : `₹${v.toLocaleString("en-IN")}`}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/60 font-bold">
                      <td className="px-4 py-2">Total</td>
                      {[sum("basic"), sum("hra"), sum("allowances"), sum("gross"), sum("epf_ee"), sum("esic_ee"), sum("pt"), sum("tds"), sum("lwf"), sum("net")].map((v, i) => (
                        <td key={i} className={`whitespace-nowrap px-3 py-2 text-right ${i === 9 ? "text-green-700" : ""}`}>
                          {v === 0 ? "—" : `₹${v.toLocaleString("en-IN")}`}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ESSFeatureGate>
  );
};

export default ESSAnnualStatement;
