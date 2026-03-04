import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, FileText } from "lucide-react";

interface PayrollRun {
  id: string;
  month: string;
  processed_at: string;
}

interface PayrollDetail {
  id: string;
  employee_id: string;
  gross_earnings: number;
  basic_paid: number;
  days_present: number;
  epf_employee: number;
  epf_employer: number;
  eps_employer: number;
  esic_employee: number;
  esic_employer: number;
  employees?: { name: string; uan_number: string | null; esic_number: string | null };
}

const EPFESICPage = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | "">("");
  const [details, setDetails] = useState<PayrollDetail[]>([]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: comp } = await supabase
        .from("companies")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (comp) {
        setCompanyId(comp.id);
        const { data: runs } = await supabase
          .from("payroll_runs")
          .select("id, month, processed_at")
          .eq("company_id", comp.id)
          .order("processed_at", { ascending: false })
          .limit(24);

        if (runs && runs.length > 0) {
          setPayrollRuns(runs);
          setSelectedRunId(runs[0].id);
        }
      }
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (!selectedRunId) return;
    const fetchDetails = async () => {
      const { data } = await supabase
        .from("payroll_details")
        .select("*, employees(name, uan_number, esic_number)")
        .eq("payroll_run_id", selectedRunId);

      if (data) {
        setDetails(data as any[]);
      }
    };
    fetchDetails();
  }, [selectedRunId]);

  const handleExportECR = () => {
    if (!details.length) {
      toast({ title: "No data", description: "No payload data found for this month.", variant: "destructive" });
      return;
    }

    const epfDetails = details.filter(d => d.epf_employee > 0 || d.epf_employer > 0);

    // ECR Text Format: UAN#~#Name#~#GrossWages#~#EPFWages#~#EPSWages#~#EDLIWages#~#EE_Share#~#ER_Share#~#EPS_Share#~#NCP_Days#~#Advances
    const lines = epfDetails.map(d => {
      const uan = d.employees?.uan_number || "";
      const name = d.employees?.name || "";
      const gross = Math.round(d.gross_earnings);

      // Calculate statutory basic bases
      const epfWages = Math.min(Math.round(d.basic_paid), 15000);
      const epsWages = epfWages;
      const edliWages = epfWages;

      const eeShare = Math.round(d.epf_employee);
      const epsShare = Math.round(d.eps_employer);
      const erShare = Math.round(d.epf_employer); // this is typically EE - EPS in ECR filing format
      const ncpDays = 0; // standard mock for non-contributory period
      const advances = 0; // refund of advances

      return `${uan}#~#${name}#~#${gross}#~#${epfWages}#~#${epsWages}#~#${edliWages}#~#${eeShare}#~#${erShare}#~#${epsShare}#~#${ncpDays}#~#${advances}`;
    });

    const fileContent = lines.join("\n");
    const blob = new Blob([fileContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    const currentRun = payrollRuns.find(r => r.id === selectedRunId);
    a.download = `ECR_${currentRun?.month || "Export"}.txt`;
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "ECR Downloaded", description: "Text file format ready for EPFO portal upload." });
  };

  const handleExportESIC = () => {
    // Basic CSV output for ESIC
    const esicDetails = details.filter(d => d.esic_employee > 0 || d.esic_employer > 0);
    if (!esicDetails.length) {
      toast({ title: "No data", description: "No ESIC data found for this month.", variant: "destructive" });
      return;
    }

    const header = "IP Number,IP Name,No of Days Worked,Total Monthly Wages,Reason Code for Zero Working Days,Last Working Day\n";
    const rows = esicDetails.map(d => {
      const ip = d.employees?.esic_number || "";
      const name = d.employees?.name || "";
      const days = d.days_present || 30;
      const wages = Math.round(d.gross_earnings);
      return `"${ip}","${name}","${days}","${wages}","",""`;
    }).join("\n");

    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    const currentRun = payrollRuns.find(r => r.id === selectedRunId);
    a.download = `ESIC_Return_${currentRun?.month || "Export"}.csv`;
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "ESIC Exported", description: "CSV ready for ESIC portal." });
  };

  const epfData = details.filter(d => d.epf_employee > 0 || d.epf_employer > 0);
  const esicData = details.filter(d => d.esic_employee > 0 || d.esic_employer > 0);

  const totalEPFEmployee = epfData.reduce((s, e) => s + Number(e.epf_employee), 0);
  const totalEPFEmployer = epfData.reduce((s, e) => s + Number(e.epf_employer), 0);
  const totalEPSEmployer = epfData.reduce((s, e) => s + Number(e.eps_employer), 0);

  const totalESICEmployee = esicData.reduce((s, e) => s + Number(e.esic_employee), 0);
  const totalESICEmployer = esicData.reduce((s, e) => s + Number(e.esic_employer), 0);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin opacity-50" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">EPF & ESIC Records</h1>
          <p className="mt-1 text-muted-foreground">Manage and export monthly statutory contributions aligned strictly with payroll runs.</p>
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          <Select value={selectedRunId} onValueChange={setSelectedRunId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select Payroll Run" />
            </SelectTrigger>
            <SelectContent>
              {payrollRuns.map(run => (
                <SelectItem key={run.id} value={run.id}>{format(new Date(run.month + "-01"), "MMMM yyyy")} (Processed)</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={handleExportECR} className="gap-2 text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100">
            <FileText className="h-4 w-4" /> ECR File
          </Button>

          <Button variant="outline" onClick={handleExportESIC} className="gap-2 text-green-700 bg-green-50 border-green-200 hover:bg-green-100">
            <Download className="h-4 w-4" /> ESIC CSV
          </Button>
        </div>
      </div>

      {!selectedRunId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No payroll runs have been processed yet. Process a payroll to view EPF & ESIC deductions.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* EPF */}
          <Card>
            <CardHeader>
              <CardTitle>Provident Fund (EPF)</CardTitle>
              <CardDescription>Employee 12% · Employer 3.67% EPF + 8.33% EPS</CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>UAN / Employee</TableHead>
                    <TableHead className="text-right">Basic Wages</TableHead>
                    <TableHead className="text-right">EE Share (12%)</TableHead>
                    <TableHead className="text-right">ER Share (3.67%)</TableHead>
                    <TableHead className="text-right">EPS (8.33%)</TableHead>
                    <TableHead className="text-right">Total Remitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {epfData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No employees match EPF criteria this month.</TableCell>
                    </TableRow>
                  ) : (
                    epfData.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>
                          <div className="font-medium">{e.employees?.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{e.employees?.uan_number || "No UAN"}</div>
                        </TableCell>
                        <TableCell className="text-right">₹{Number(e.basic_paid).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right">₹{Number(e.epf_employee).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right">₹{Number(e.epf_employer).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right">₹{Number(e.eps_employer).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right font-semibold">₹{(Number(e.epf_employee) + Number(e.epf_employer) + Number(e.eps_employer)).toLocaleString("en-IN")}</TableCell>
                      </TableRow>
                    ))
                  )}
                  {epfData.length > 0 && (
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell>Totals</TableCell>
                      <TableCell />
                      <TableCell className="text-right">₹{totalEPFEmployee.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right">₹{totalEPFEmployer.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right">₹{totalEPSEmployer.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right">₹{(totalEPFEmployee + totalEPFEmployer + totalEPSEmployer).toLocaleString("en-IN")}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* ESIC */}
          <Card>
            <CardHeader>
              <CardTitle>State Insurance (ESIC)</CardTitle>
              <CardDescription>Employee 0.75% + Employer 3.25% of gross</CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IP No / Employee</TableHead>
                    <TableHead className="text-right">Gross Wages</TableHead>
                    <TableHead className="text-right">EE Share (0.75%)</TableHead>
                    <TableHead className="text-right">ER Share (3.25%)</TableHead>
                    <TableHead className="text-right">Total Remitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {esicData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No employees match ESIC criteria this month.</TableCell>
                    </TableRow>
                  ) : (
                    esicData.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>
                          <div className="font-medium">{e.employees?.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{e.employees?.esic_number || "No IP No."}</div>
                        </TableCell>
                        <TableCell className="text-right">₹{Number(e.gross_earnings).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right">₹{Number(e.esic_employee).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right">₹{Number(e.esic_employer).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right font-semibold">₹{(Number(e.esic_employee) + Number(e.esic_employer)).toLocaleString("en-IN")}</TableCell>
                      </TableRow>
                    ))
                  )}
                  {esicData.length > 0 && (
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell>Totals</TableCell>
                      <TableCell />
                      <TableCell className="text-right">₹{totalESICEmployee.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right">₹{totalESICEmployer.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right">₹{(totalESICEmployee + totalESICEmployer).toLocaleString("en-IN")}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default EPFESICPage;
