import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
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

      {payrollData.length > 0 && (
        <>
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
