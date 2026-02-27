import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calculateEPF, calculateESIC } from "@/lib/calculations";
import { Loader2 } from "lucide-react";

interface Employee {
  id: string;
  name: string;
  basic: number;
  gross: number;
  epf_applicable: boolean;
  esic_applicable: boolean;
}

const EPFESICPage = () => {
  const [month] = useState(new Date().toLocaleString('default', { month: 'long', year: 'numeric' }));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadEmployees = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: comp } = await supabase
        .from("companies")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (comp) {
        const { data: emps } = await supabase
          .from("employees")
          .select("id, name, basic, gross, epf_applicable, esic_applicable")
          .eq("company_id", comp.id)
          .eq("status", "Active");

        if (emps) {
          setEmployees(emps as unknown as Employee[]);
        }
      }
      setLoading(false);
    };
    loadEmployees();
  }, []);

  const epfData = employees.filter((e) => e.epf_applicable).map((e) => ({ ...e, ...calculateEPF(e.basic) }));
  const esicData = employees.filter((e) => e.esic_applicable).map((e) => ({ ...e, ...calculateESIC(e.gross) }));

  const totalEPFEmployee = epfData.reduce((s, e) => s + e.employeeEPF, 0);
  const totalEPFEmployer = epfData.reduce((s, e) => s + e.employerTotal, 0);
  const totalESICEmployee = esicData.reduce((s, e) => s + e.employeeESIC, 0);
  const totalESICEmployer = esicData.reduce((s, e) => s + e.employerESIC, 0);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin opacity-50" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">EPF & ESIC</h1>
      <p className="mt-1 text-muted-foreground">Monthly contributions for {month}</p>

      {/* EPF */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>EPF Contributions</CardTitle>
          <CardDescription>Employee 12% of basic · Employer 3.67% EPF + 8.33% EPS (EPS capped at ₹15,000)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Basic</TableHead>
                <TableHead className="text-right">Emp. EPF (12%)</TableHead>
                <TableHead className="text-right">Empr. EPF (3.67%)</TableHead>
                <TableHead className="text-right">EPS (8.33%)</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {epfData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground p-4">No employees match EPF criteria.</TableCell>
                </TableRow>
              ) : (
                epfData.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell className="text-right">₹{Number(e.basic).toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-right">₹{e.employeeEPF.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-right">₹{e.employerEPF.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-right">₹{e.employerEPS.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-right font-semibold">₹{e.totalContribution.toLocaleString("en-IN")}</TableCell>
                  </TableRow>
                ))
              )}
              {epfData.length > 0 && (
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>Total</TableCell>
                  <TableCell />
                  <TableCell className="text-right">₹{totalEPFEmployee.toLocaleString("en-IN")}</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell className="text-right">₹{(totalEPFEmployee + totalEPFEmployer).toLocaleString("en-IN")}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ESIC */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>ESIC Contributions</CardTitle>
          <CardDescription>Employee 0.75% + Employer 3.25% of gross (wage ceiling ₹21,000)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Emp. (0.75%)</TableHead>
                <TableHead className="text-right">Empr. (3.25%)</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {esicData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground p-4">No employees match ESIC criteria (Gross &le; 21k).</TableCell>
                </TableRow>
              ) : (
                esicData.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell className="text-right">₹{Number(e.gross).toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-right">₹{e.employeeESIC.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-right">₹{e.employerESIC.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-right font-semibold">₹{e.total.toLocaleString("en-IN")}</TableCell>
                  </TableRow>
                ))
              )}
              {esicData.length > 0 && (
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>Total</TableCell>
                  <TableCell />
                  <TableCell className="text-right">₹{totalESICEmployee.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right">₹{totalESICEmployer.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right">₹{(totalESICEmployee + totalESICEmployer).toLocaleString("en-IN")}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card >
    </div >
  );
};

export default EPFESICPage;
