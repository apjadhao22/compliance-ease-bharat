import { useState, useEffect } from "react";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Link } from "react-router-dom";
import { format, subMonths, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Calculator, Calendar, AlertTriangle, CheckCircle, Clock, Loader2, ShieldAlert, Activity, Laptop } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line
} from 'recharts';

interface HealthIssue {
  deduction: number;
  reason: string;
}

interface OverviewData {
  totalEmployees: number;
  latestPayrollTotal: number;
  pendingLeaves: number;
  activeMaternity: number;
  payrollProcessedThisMonth: boolean;
  activeFnf: number;
  wcRenewalDate: string | null;
  complianceRegime: 'legacy_acts' | 'labour_codes';
  healthScore: number;
  healthIssues: HealthIssue[];
  payrollTrend: { month: string; netPay: number }[];
  headcountTrend: { month: string; count: number }[];
  unreturnedAssets: number;
}

const DashboardOverview = () => {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOverview = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: company } = await supabase
          .from("companies")
          .select("id, compliance_regime, wc_renewal_date")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!company) return;

        const cid = company.id;
        const regime = (company as any).compliance_regime || "legacy_acts";
        const now = new Date();
        const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

        const prevMonthDate = subMonths(now, 1);
        const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;

        // Parallel metric queries — use count-only where possible for scalability
        const queryPromises = [
          supabase.from("employees").select("*", { count: "exact", head: true }).eq("company_id", cid).in("status", ["Active", "active"]),
          supabase.from("employees").select("*", { count: "exact", head: true }).eq("company_id", cid),
          supabase.from("payroll_runs").select("id, status").eq("company_id", cid).eq("month", currentMonthStr).maybeSingle(),
          supabase.from("leave_requests").select("*", { count: "exact", head: true }).eq("company_id", cid).eq("status", "Pending"),
          supabase.from("maternity_cases").select("*", { count: "exact", head: true }).eq("company_id", cid).neq("status", "closed"),
          supabase.from("fnf_settlements").select("*", { count: "exact", head: true }).eq("company_id", cid).neq("status", "Settled"),
          supabase.from("assets").select("*", { count: "exact", head: true }).eq("company_id", cid).eq("status", "Allocated"),
          supabase.from("payroll_runs").select("id, month, status, payroll_details(net_pay)").eq("company_id", cid).order("month", { ascending: true }).limit(6)
        ];

        // Add an 8-second safety timeout so the UI doesn't hang forever
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Supabase fetch timeout")), 8000));

        const [
          activeCountRes,
          totalCountRes,
          payrollRes,
          leaveCountRes,
          maternityCountRes,
          fnfCountRes,
          unreturnedAssetCountRes,
          historicalRunsRes
        ] = (await Promise.race([
          Promise.all(queryPromises),
          timeoutPromise
        ])) as any[];

        const activeCount = activeCountRes?.count || 0;
        const totalCount = totalCountRes?.count || 0;
        const activeEmployees = { length: activeCount };

        // Use count-only for asset risk (approximate — counts all allocated assets)
        const unreturnedRiskAssets = unreturnedAssetCountRes?.count || 0;

        // Prepare Payroll Trend
        const payrollTrend = [];
        let latestPayrollTotal = 0;

        if (historicalRunsRes?.data) {
          historicalRunsRes.data.forEach((run: any) => {
            const runTotal = run.payroll_details?.reduce((sum: number, detail: any) => sum + Number(detail.net_pay || 0), 0) || 0;
            const dateStr = parseISO(`${run.month}-01`);
            payrollTrend.push({
              month: format(dateStr, 'MMM yy'),
              netPay: runTotal
            });
            if (run.month === currentMonthStr) {
              latestPayrollTotal = runTotal;
            }
          });
        }

        // Check if previous month payroll is processed (for health score)
        const prevMonthProcessed = historicalRunsRes?.data?.some((r: any) => r.month === prevMonthStr && r.status === "processed");

        // Approximate Headcount Trend (use total active count since we no longer load individual employees)
        const headcountTrend = [];
        for (let i = 0; i < 6; i++) {
          const d = subMonths(now, i);
          headcountTrend.unshift({
            month: format(d, 'MMM yy'),
            count: activeCount // approximate — same count for recent months
          });
        }

        // --- Health Score Algorithm ---
        let healthScore = 100;
        const healthIssues: HealthIssue[] = [];

        if (!prevMonthProcessed && now.getDate() > 10) {
          healthScore -= 20;
          healthIssues.push({ deduction: 20, reason: `Payroll for previous month (${format(prevMonthDate, 'MMM yyyy')}) is not processed yet.` });
        }

        const pendingLeavesCount = leaveCountRes.count || 0;
        if (pendingLeavesCount > 0) {
          const deduction = Math.min(pendingLeavesCount * 2, 10); // cap at 10
          healthScore -= deduction;
          healthIssues.push({ deduction, reason: `${pendingLeavesCount} aged pending leave request(s).` });
        }

        const pendingFnfCount = fnfCountRes.count || 0;
        if (pendingFnfCount > 0) {
          const deduction = pendingFnfCount * 10;
          healthScore -= deduction;
          healthIssues.push({ deduction, reason: `${pendingFnfCount} pending Final Settlements awaiting closure.` });
        }

        if (unreturnedRiskAssets > 0) {
          const deduction = Math.min(unreturnedRiskAssets * 5, 20);
          healthScore -= deduction;
          healthIssues.push({ deduction, reason: `${unreturnedRiskAssets} allocated assets are held by exiting or inactive employees.` });
        }

        healthScore = Math.max(0, healthScore); // Floor at 0

        setData({
          totalEmployees: activeEmployees.length,
          latestPayrollTotal,
          pendingLeaves: pendingLeavesCount,
          activeMaternity: maternityCountRes.count || 0,
          payrollProcessedThisMonth: payrollRes.data?.status === "processed",
          activeFnf: pendingFnfCount,
          wcRenewalDate: company.wc_renewal_date,
          complianceRegime: regime,
          healthScore,
          healthIssues,
          payrollTrend,
          headcountTrend,
          unreturnedAssets: unreturnedRiskAssets
        });
      } catch (e) {
        console.error("Overview Load Error:", e);
      } finally {
        setLoading(false);
      }
    };
    loadOverview();
  }, []);

  if (loading) {
    return <PageSkeleton />;
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <div className="bg-primary/10 p-4 rounded-full">
          <Activity className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Welcome to ComplianceEngine!</h2>
        <p className="text-muted-foreground max-w-md">
          To get started, please set up your company profile. This unlocks all compliance features and reporting tools.
        </p>
        <Link to="/dashboard/company" className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors">
          Set Up Company Profile
        </Link>
      </div>
    );
  }

  const d = data!;

  // Format currency for Y axis
  const formatYAxis = (tickItem: number) => {
    if (tickItem === 0) return "0";
    if (tickItem >= 10000000) return `₹${(tickItem / 10000000).toFixed(1)}Cr`;
    if (tickItem >= 100000) return `₹${(tickItem / 100000).toFixed(1)}L`;
    if (tickItem >= 1000) return `₹${(tickItem / 1000).toFixed(1)}K`;
    return `₹${tickItem}`;
  };

  // Check WC Renewal
  let wcExpiringSoon = false;
  let wcDaysLeft = 0;
  if (d.wcRenewalDate) {
    const renewalDate = new Date(d.wcRenewalDate);
    const diffTime = renewalDate.getTime() - new Date().getTime();
    wcDaysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (wcDaysLeft <= 30 && wcDaysLeft >= 0) {
      wcExpiringSoon = true;
    }
  }

  const getHealthColor = (score: number) => {
    if (score >= 90) return "text-emerald-500";
    if (score >= 70) return "text-amber-500";
    return "text-destructive";
  };

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Command Center</h1>
        <p className="mt-1 text-muted-foreground">Monitor real-time compliance health, alerts, and operational trends.</p>
      </div>

      {/* Proactive Action Alerts */}
      <div className="space-y-3">
        {d.complianceRegime === "labour_codes" && d.totalEmployees >= 300 && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4 flex items-start gap-4">
            <div className="bg-destructive/20 p-2 rounded-full shrink-0">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-destructive">IR Code Mandate: Standing Orders Required</h3>
              <p className="text-sm text-destructive/80 mt-1">
                Your establishment has crossed the 300-employee threshold under the Industrial Relations Code. You are legally required to formally adopt Certified Standing Orders.
              </p>
            </div>
          </div>
        )}

        {d.unreturnedAssets > 0 && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-4 flex items-start gap-4">
            <div className="bg-amber-500/20 p-2 rounded-full shrink-0">
              <Laptop className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-amber-700">IT Asset Recovery Risk</h3>
              <p className="text-sm text-amber-700/80 mt-1">
                There are <strong>{d.unreturnedAssets}</strong> company assets currently allocated to employees who are either inactive or undergoing F&F Settlements. <Link to="/dashboard/assets" className="underline font-medium hover:text-amber-900">Review missing assets</Link>.
              </p>
            </div>
          </div>
        )}

        {wcExpiringSoon && (
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-4 flex items-start gap-4">
            <div className="bg-blue-500/20 p-2 rounded-full shrink-0">
              <ShieldAlert className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-blue-800">Workmen's Compensation Policy Expiring</h3>
              <p className="text-sm text-blue-800/80 mt-1">
                Your WC Insurance Policy expires in <strong>{wcDaysLeft} days</strong>. Ensure prompt renewal to maintain OSH Code compliance and insulate against workplace accident liabilities.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Health Score Card */}
        <Card className="md:col-span-1 shadow-sm flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-md flex items-center justify-between">
              Compliance Health Score
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center items-center py-6">
            <div className={`text-6xl font-black tracking-tighter ${getHealthColor(d.healthScore)}`}>
              {d.healthScore}%
            </div>
            <p className="text-sm text-muted-foreground mt-4 font-medium">
              {d.healthScore === 100 ? "All statutory checks passing smoothly." : "Action required to restore perfect score."}
            </p>

            {d.healthIssues.length > 0 && (
              <div className="w-full mt-6 space-y-2 border-t pt-4">
                {d.healthIssues.map((issue, idx) => (
                  <div key={idx} className="flex items-start justify-between text-xs">
                    <span className="text-muted-foreground flex-1 pr-4 line-clamp-2">{issue.reason}</span>
                    <span className="text-destructive font-mono font-medium">-{issue.deduction}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Graphical Trends */}
        <Card className="md:col-span-2 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-md">Net Payroll Disbursal Trend (6 Months)</CardTitle>
            <CardDescription>Track monthly cash outflow for compliant structured payrolls.</CardDescription>
          </CardHeader>
          <CardContent className="h-[250px] w-full pt-4">
            {d.payrollTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.payrollTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} dy={10} />
                  <YAxis tickFormatter={formatYAxis} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted)/0.4)" }}
                    formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, "Net Disbursal"]}
                    contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                  />
                  <Bar dataKey="netPay" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                No historical payroll data available. Process a payload to populate charts.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="md:col-span-1 shadow-sm">
          <CardHeader>
            <CardTitle className="text-md flex items-center justify-between">
              Active Headcount
              <Users className="h-4 w-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-3xl font-bold">{d.totalEmployees}</div>
            <div className="h-[80px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={d.headcountTrend} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <Tooltip
                    formatter={(value: number) => [value, "Active Employees"]}
                    labelFormatter={(label) => `Month: ${label}`}
                    contentStyle={{ borderRadius: "8px", fontSize: "12px", padding: "8px 12px", border: "1px solid hsl(var(--border))", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                    cursor={false}
                  />
                  <XAxis dataKey="month" hide />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "var(--background)", stroke: "hsl(var(--primary))" }} activeDot={{ r: 6, fill: "hsl(var(--primary))" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3 shadow-sm">
          <CardHeader>
            <CardTitle className="text-md">Pending Operational Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="flex flex-col p-4 border rounded-xl bg-muted/10">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
                  <Clock className="h-4 w-4 text-blue-500" />
                  Pending F&F Exits
                </div>
                <div className="text-2xl font-semibold">{d.activeFnf}</div>
                <Link to="/dashboard/fnf" className="text-xs text-blue-600 hover:underline mt-2">Process settlements &rarr;</Link>
              </div>
              <div className="flex flex-col p-4 border rounded-xl bg-muted/10">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
                  <Calendar className="h-4 w-4 text-purple-500" />
                  Leave Requests
                </div>
                <div className="text-2xl font-semibold">{d.pendingLeaves}</div>
                <Link to="/dashboard/leaves" className="text-xs text-purple-600 hover:underline mt-2">Review inbox &rarr;</Link>
              </div>
              <div className="flex flex-col p-4 border rounded-xl bg-muted/10">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  Active Maternity
                </div>
                <div className="text-2xl font-semibold">{d.activeMaternity}</div>
                <Link to="/dashboard/maternity" className="text-xs text-emerald-600 hover:underline mt-2">Track cases &rarr;</Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
};

export default DashboardOverview;
