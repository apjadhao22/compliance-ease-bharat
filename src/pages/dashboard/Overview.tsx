import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calculator, Calendar, AlertTriangle, CheckCircle, Clock, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface OverviewData {
  totalEmployees: number;
  latestPayrollTotal: number;
  pendingLeaves: number;
  pendingExpenses: number;
  activeMaternity: number;
  payrollProcessedThisMonth: boolean;
  activeFnf: number;
}

const DashboardOverview = () => {
  const [data, setData] = useState<OverviewData | null>(null);
  const [complianceRegime, setComplianceRegime] = useState<'legacy_acts' | 'labour_codes'>('legacy_acts');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOverview = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: company } = await supabase
        .from("companies")
        .select("id, compliance_regime")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!company) { setLoading(false); return; }

      const cid = company.id;
      setComplianceRegime((company as any).compliance_regime || "legacy_acts");
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      // Parallel queries
      const [empRes, payrollRes, leaveRes, expenseRes, maternityRes, fnfRes] = await Promise.all([
        supabase.from("employees").select("id", { count: "exact", head: true }).eq("company_id", cid).eq("status", "Active"),
        supabase.from("payroll_runs").select("id, status").eq("company_id", cid).eq("month", currentMonth).maybeSingle(),
        supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("company_id", cid).eq("status", "Pending"),
        supabase.from("expenses").select("id", { count: "exact", head: true }).eq("company_id", cid).eq("status", "Pending"),
        supabase.from("maternity_cases").select("id", { count: "exact", head: true }).eq("company_id", cid).neq("status", "closed"),
        supabase.from("fnf_settlements").select("id", { count: "exact", head: true }).eq("company_id", cid).neq("status", "Settled"),
      ]);

      let latestPayrollTotal = 0;
      if (payrollRes.data?.id) {
        const { data: details } = await supabase
          .from("payroll_details")
          .select("net_pay")
          .eq("payroll_run_id", payrollRes.data.id);
        if (details) {
          latestPayrollTotal = details.reduce((s, d) => s + Number(d.net_pay || 0), 0);
        }
      }

      setData({
        totalEmployees: empRes.count || 0,
        latestPayrollTotal,
        pendingLeaves: leaveRes.count || 0,
        pendingExpenses: expenseRes.count || 0,
        activeMaternity: maternityRes.count || 0,
        payrollProcessedThisMonth: payrollRes.data?.status === "processed",
        activeFnf: fnfRes.count || 0,
      });

      setLoading(false);
    };
    loadOverview();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground opacity-50" />
      </div>
    );
  }

  const d = data || { totalEmployees: 0, latestPayrollTotal: 0, pendingLeaves: 0, pendingExpenses: 0, activeMaternity: 0, payrollProcessedThisMonth: false, activeFnf: 0 };

  const pendingActions = d.pendingLeaves + d.pendingExpenses + d.activeFnf;

  const stats = [
    { label: "Total Employees", value: String(d.totalEmployees), icon: Users, color: "text-primary" },
    { label: "Net Payroll (Current)", value: `₹${d.latestPayrollTotal.toLocaleString("en-IN")}`, icon: Calculator, color: "text-green-600" },
    { label: "Pending Leaves", value: String(d.pendingLeaves), icon: Calendar, color: "text-accent" },
    { label: "Pending Actions", value: String(pendingActions), icon: AlertTriangle, color: pendingActions > 0 ? "text-destructive" : "text-muted-foreground" },
  ];

  const compliances = [
    {
      title: "EPF & ESIC",
      statusText: d.payrollProcessedThisMonth ? "Payroll processed — ready to file" : "Pending processing for current month",
      severity: d.payrollProcessedThisMonth ? "Low" : "High",
      badgeVariant: d.payrollProcessedThisMonth ? "default" : "destructive",
      icon: d.payrollProcessedThisMonth ? CheckCircle : AlertTriangle,
    },
    {
      title: "Professional Tax",
      statusText: d.payrollProcessedThisMonth ? "Calculated with payroll" : "Process payroll to generate PT",
      severity: d.payrollProcessedThisMonth ? "Low" : "Medium",
      badgeVariant: d.payrollProcessedThisMonth ? "default" : "secondary",
      icon: d.payrollProcessedThisMonth ? CheckCircle : Clock,
    },
    {
      title: "LWF (Labour Welfare Fund)",
      statusText: d.payrollProcessedThisMonth ? "Deducted in payroll" : "Pending payroll run",
      severity: d.payrollProcessedThisMonth ? "Low" : "Medium",
      badgeVariant: d.payrollProcessedThisMonth ? "default" : "secondary",
      icon: d.payrollProcessedThisMonth ? CheckCircle : Clock,
    },
    {
      title: "Leaves",
      statusText: d.pendingLeaves > 0 ? `${d.pendingLeaves} pending request(s)` : "No pending requests",
      severity: d.pendingLeaves > 0 ? "Medium" : "Low",
      badgeVariant: d.pendingLeaves > 0 ? "secondary" : "default",
      icon: d.pendingLeaves > 0 ? Clock : CheckCircle,
    },
    {
      title: "Maternity",
      statusText: d.activeMaternity > 0 ? `${d.activeMaternity} active case(s)` : "No active cases",
      severity: d.activeMaternity > 0 ? "Medium" : "Low",
      badgeVariant: d.activeMaternity > 0 ? "secondary" : "outline",
      icon: d.activeMaternity > 0 ? Clock : CheckCircle,
    },
    {
      title: "F&F Settlements",
      statusText: d.activeFnf > 0 ? `${d.activeFnf} pending settlement(s)` : "No pending exits",
      severity: d.activeFnf > 0 ? "Medium" : "Low",
      badgeVariant: d.activeFnf > 0 ? "secondary" : "outline",
      icon: d.activeFnf > 0 ? Clock : CheckCircle,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Overview</h1>
        <p className="mt-1 text-muted-foreground">Monitor the status of all your core compliances.</p>
      </div>

      {/* IR Code Standing Orders Threshold Alert */}
      {complianceRegime === "labour_codes" && d.totalEmployees >= 300 && (
        <div className="rounded-md bg-destructive/15 border border-destructive/50 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-destructive">IR Code Mandate: Certified Standing Orders Required</h3>
            <p className="text-sm text-destructive/90 mt-1">
              Your establishment has crossed the threshold of 300 employees under the Industrial Relations Code, 2020.
              You are legally required to formally structure and publish Certified Standing Orders.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compliance Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {compliances.map((compliance, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 rounded-lg border bg-card text-card-foreground shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-full ${compliance.badgeVariant === 'destructive' ? 'bg-destructive/10 text-destructive' :
                    compliance.badgeVariant === 'secondary' ? 'bg-secondary text-secondary-foreground' :
                      compliance.badgeVariant === 'default' ? 'bg-primary/10 text-primary' :
                        'bg-muted text-muted-foreground'
                    }`}>
                    <compliance.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{compliance.title}</h3>
                    <p className="text-sm text-muted-foreground">{compliance.statusText}</p>
                  </div>
                </div>
                <div>
                  <Badge variant={compliance.badgeVariant as any}>
                    {compliance.severity}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardOverview;
