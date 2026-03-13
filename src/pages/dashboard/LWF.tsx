import { PageSkeleton } from "@/components/PageSkeleton";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calculateLWF } from "@/lib/calculations";
import { Loader2 } from "lucide-react";

interface Employee {
  id: string;
  name: string;
  gross?: number;
  work_state?: string;
}

const LWFPage = () => {
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
          .select("id, name, gross, work_state")
          .eq("company_id", comp.id)
          .in("status", ["Active", "active"]);

        if (emps) {
          setEmployees(emps as Employee[]);
        }
      }
      setLoading(false);
    };
    loadEmployees();
  }, []);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const processedEmployees = employees.map(e => {
    const lwf = calculateLWF(currentMonth, e.work_state || "Maharashtra", e.gross || 0);
    return {
      ...e,
      lwf_employee: lwf.employeeContribution,
      lwf_employer: lwf.employerContribution,
      lwf_total: lwf.employeeContribution + lwf.employerContribution,
      applicableMonth: lwf.applicableMonth
    };
  });

  const totalEmployeeLWF = processedEmployees.reduce((sum, e) => sum + (e.lwf_employee || 0), 0);
  const totalEmployerLWF = processedEmployees.reduce((sum, e) => sum + (e.lwf_employer || 0), 0);
  const grandTotalLWF = totalEmployeeLWF + totalEmployerLWF;

  const isAnyApplicable = processedEmployees.length > 0 ? processedEmployees.some(e => e.applicableMonth) : calculateLWF(currentMonth, "Maharashtra").applicableMonth;
  const genericNextDate = calculateLWF(`${now.getFullYear()}-06`, "Maharashtra").dueDate;

  if (loading) return <PageSkeleton />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Labour Welfare Fund</h1>
      <p className="mt-1 text-muted-foreground">Maharashtra — Half-yearly contribution (June 30 & December 31)</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Employee Share</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-primary">₹{totalEmployeeLWF}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Employer Share</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-primary">₹{totalEmployerLWF}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total per Employee</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-accent">₹{grandTotalLWF}</p></CardContent></Card>
      </div>

      {!isAnyApplicable && (
        <Card className="mt-6 border-accent">
          <CardContent className="p-4 text-sm text-muted-foreground">
            LWF is not due this month. Next applicable months typically June & December.
            {genericNextDate && ` Next due date: ${genericNextDate}`}
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader><CardTitle>Half-yearly LWF Summary</CardTitle><CardDescription>Frequency: Half-yearly · Deadlines: June 30 & December 31</CardDescription></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead className="text-right">Employee (₹)</TableHead><TableHead className="text-right">Employer (₹)</TableHead><TableHead className="text-right">Total (₹)</TableHead></TableRow></TableHeader>
            <TableBody>
              {processedEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center p-4 text-muted-foreground">No active employees found.</TableCell>
                </TableRow>
              ) : (
                processedEmployees.map((e) => (
                  <TableRow key={e.id}><TableCell className="font-medium">{e.name}</TableCell><TableCell className="text-right">₹{e.lwf_employee}</TableCell><TableCell className="text-right">₹{e.lwf_employer}</TableCell><TableCell className="text-right font-semibold">₹{e.lwf_total}</TableCell></TableRow>
                ))
              )}
              {processedEmployees.length > 0 && (
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>Total ({processedEmployees.length} employees)</TableCell>
                  <TableCell className="text-right">₹{totalEmployeeLWF}</TableCell>
                  <TableCell className="text-right">₹{totalEmployerLWF}</TableCell>
                  <TableCell className="text-right">₹{grandTotalLWF}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default LWFPage;
