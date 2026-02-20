import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { buildPayEquityBands, flagPayGaps, type PayEquityBand, type PayGapFlag } from "@/lib/calculations";
import { Scale, AlertTriangle, Users, TrendingDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, Cell } from "recharts";

// ─── Types ───

interface EmpRow {
  id: string;
  name: string;
  gender: string | null;
  department: string | null;
  grade: string | null;
}

interface PayrollRow {
  employee_id: string;
  gross_earnings: number | null;
}

// ─── Helpers ───

const WAGE_BANDS = [
  { label: "0–10k", min: 0, max: 10000 },
  { label: "10–25k", min: 10000, max: 25000 },
  { label: "25–50k", min: 25000, max: 50000 },
  { label: "50–75k", min: 50000, max: 75000 },
  { label: "75k+", min: 75000, max: Infinity },
];

function buildDistributionChart(
  employees: EmpRow[],
  payrollRows: PayrollRow[]
): { band: string; Male: number; Female: number; Other: number }[] {
  const payMap = new Map<string, number>();
  for (const r of payrollRows) {
    if (r.gross_earnings != null) payMap.set(r.employee_id, r.gross_earnings);
  }

  const result = WAGE_BANDS.map((b) => ({ band: b.label, Male: 0, Female: 0, Other: 0 }));

  for (const emp of employees) {
    const gross = payMap.get(emp.id);
    if (gross == null) continue;
    const gender = (emp.gender || "Other") as "Male" | "Female" | "Other";
    const idx = WAGE_BANDS.findIndex((b) => gross >= b.min && gross < b.max);
    if (idx >= 0 && (gender === "Male" || gender === "Female" || gender === "Other")) {
      result[idx][gender]++;
    }
  }

  return result;
}

const chartConfig: ChartConfig = {
  Male: { label: "Male", color: "hsl(var(--primary))" },
  Female: { label: "Female", color: "hsl(var(--accent))" },
  Other: { label: "Other", color: "hsl(var(--muted-foreground))" },
};

// ─── Component ───

const EqualRemunerationPage = () => {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [filterDept, setFilterDept] = useState("");
  const [filterGrade, setFilterGrade] = useState("");

  const [employees, setEmployees] = useState<EmpRow[]>([]);
  const [payrollRows, setPayrollRows] = useState<PayrollRow[]>([]);

  // ─── Data loading ───

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: comp } = await supabase
      .from("companies")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!comp) { setLoading(false); return; }
    setCompanyId(comp.id);

    // Fetch employees
    const { data: empData } = await supabase
      .from("employees")
      .select("id, name, gender, department, grade")
      .eq("company_id", comp.id)
      .eq("status", "Active");

    setEmployees((empData as EmpRow[]) || []);

    // Fetch payroll for the month: find the payroll run, then details
    const { data: run } = await supabase
      .from("payroll_runs")
      .select("id")
      .eq("company_id", comp.id)
      .eq("month", month)
      .maybeSingle();

    if (run) {
      const { data: details } = await supabase
        .from("payroll_details")
        .select("employee_id, gross_earnings")
        .eq("payroll_run_id", run.id);
      setPayrollRows((details as PayrollRow[]) || []);
    } else {
      setPayrollRows([]);
    }

    setLoading(false);
  }, [month]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Compute analytics ───

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      if (filterDept && (e.department || "").toLowerCase() !== filterDept.toLowerCase()) return false;
      if (filterGrade && (e.grade || "").toLowerCase() !== filterGrade.toLowerCase()) return false;
      return true;
    });
  }, [employees, filterDept, filterGrade]);

  const bands = useMemo(
    () => buildPayEquityBands(filteredEmployees, payrollRows),
    [filteredEmployees, payrollRows]
  );

  const gaps = useMemo(() => flagPayGaps(bands, 10), [bands]);

  // Overall median pay gap
  const overallGap = useMemo(() => {
    const maleMedians = bands.filter((b) => b.gender.toLowerCase() === "male").map((b) => b.medianGross);
    const femaleMedians = bands.filter((b) => b.gender.toLowerCase() === "female").map((b) => b.medianGross);
    if (maleMedians.length === 0 || femaleMedians.length === 0) return null;
    const maleAvg = maleMedians.reduce((s, v) => s + v, 0) / maleMedians.length;
    const femaleAvg = femaleMedians.reduce((s, v) => s + v, 0) / femaleMedians.length;
    if (maleAvg === 0) return null;
    return Math.round(((maleAvg - femaleAvg) / maleAvg) * 10000) / 100;
  }, [bands]);

  const flaggedEmployeeCount = useMemo(() => {
    const flaggedKeys = new Set(gaps.map((g) => `${g.grade || ""}|${g.department || ""}`));
    return bands
      .filter((b) => flaggedKeys.has(`${b.grade || ""}|${b.department || ""}`))
      .reduce((s, b) => s + b.headcount, 0);
  }, [bands, gaps]);

  const distributionData = useMemo(
    () => buildDistributionChart(filteredEmployees, payrollRows),
    [filteredEmployees, payrollRows]
  );

  // Unique departments/grades for filter hints
  const departments = useMemo(() => [...new Set(employees.map((e) => e.department).filter(Boolean))], [employees]);
  const grades = useMemo(() => [...new Set(employees.map((e) => e.grade).filter(Boolean))], [employees]);

  if (loading) return <div className="text-muted-foreground p-8">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Equal Remuneration Analytics</h1>
        <p className="mt-1 text-muted-foreground">Equal Remuneration Act compliance — gender pay equity analysis</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Month</Label>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Department</Label>
          <select
            className="flex h-10 w-40 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
          >
            <option value="">All</option>
            {departments.map((d) => <option key={d} value={d!}>{d}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Grade</Label>
          <select
            className="flex h-10 w-40 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={filterGrade}
            onChange={(e) => setFilterGrade(e.target.value)}
          >
            <option value="">All</option>
            {grades.map((g) => <option key={g} value={g!}>{g}</option>)}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <TrendingDown className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{overallGap != null ? `${overallGap}%` : "—"}</p>
              <p className="text-sm text-muted-foreground">Median Gender Pay Gap</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-2xl font-bold">{gaps.length}</p>
              <p className="text-sm text-muted-foreground">Grades with High Gaps (≥10%)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Users className="h-8 w-8 text-accent" />
            <div>
              <p className="text-2xl font-bold">{flaggedEmployeeCount}</p>
              <p className="text-sm text-muted-foreground">Employees in Flagged Grades</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {payrollRows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <Scale className="h-10 w-10 text-muted-foreground mb-2" />
            <p className="font-medium text-foreground">No payroll data for {month}</p>
            <p className="text-sm text-muted-foreground">Run payroll for this month first to see analytics.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Pay Equity Bands Table */}
          <Card>
            <CardHeader><CardTitle>Pay Equity by Grade × Department × Gender</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4">Grade</th>
                      <th className="pb-2 pr-4">Department</th>
                      <th className="pb-2 pr-4">Gender</th>
                      <th className="pb-2 pr-4 text-right">Headcount</th>
                      <th className="pb-2 pr-4 text-right">Avg Gross</th>
                      <th className="pb-2 text-right">Median Gross</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bands.map((b, i) => {
                      const isFlagged = gaps.some(
                        (g) => g.grade === b.grade && g.department === b.department
                      );
                      return (
                        <tr
                          key={i}
                          className={`border-b last:border-0 ${isFlagged ? "bg-destructive/5" : ""}`}
                        >
                          <td className="py-2 pr-4">{b.grade || "—"}</td>
                          <td className="py-2 pr-4">{b.department || "—"}</td>
                          <td className="py-2 pr-4">
                            <Badge variant="outline">{b.gender}</Badge>
                          </td>
                          <td className="py-2 pr-4 text-right">{b.headcount}</td>
                          <td className="py-2 pr-4 text-right">₹{b.avgGross.toLocaleString("en-IN")}</td>
                          <td className="py-2 text-right">₹{b.medianGross.toLocaleString("en-IN")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* High-Risk Bands */}
          {gaps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" /> High-Risk Pay Gap Bands
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4">Grade</th>
                        <th className="pb-2 pr-4">Department</th>
                        <th className="pb-2 pr-4 text-right">Male Avg</th>
                        <th className="pb-2 pr-4 text-right">Female Avg</th>
                        <th className="pb-2 text-right">Gap %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gaps.map((g, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-medium">{g.grade || "—"}</td>
                          <td className="py-2 pr-4">{g.department || "—"}</td>
                          <td className="py-2 pr-4 text-right">₹{g.maleAvg.toLocaleString("en-IN")}</td>
                          <td className="py-2 pr-4 text-right">₹{g.femaleAvg.toLocaleString("en-IN")}</td>
                          <td className="py-2 text-right">
                            <Badge variant="destructive">{g.gapPercent}%</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Distribution Chart */}
          <Card>
            <CardHeader><CardTitle>Gross Pay Distribution by Gender</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <BarChart data={distributionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="band" />
                  <YAxis allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar dataKey="Male" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Female" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Other" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default EqualRemunerationPage;
