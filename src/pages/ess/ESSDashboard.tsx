import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText, CalendarDays, PiggyBank, User, ChevronRight, Bell,
  Laptop, Clock, Receipt, AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useESSFeatures } from "@/hooks/useESSFeatures";
import { format } from "date-fns";

interface UnreadNotice {
  id: string;
  title: string;
  priority: "high" | "normal" | "low";
  posted_at: string;
}

interface LatestPayslip {
  month: string;
  gross_salary: number;
  net_salary: number;
}

interface LeaveRow {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  status: string;
}

const LEAVE_TOTALS: Record<string, number> = { casual: 12, sick: 10, earned: 18 };

const leaveStatusColor = (s: string) => {
  switch (s) {
    case "approved": return "bg-green-100 text-green-800";
    case "rejected": return "bg-red-100 text-red-800";
    case "cancelled": return "bg-gray-100 text-gray-600";
    default: return "bg-yellow-100 text-yellow-800";
  }
};

const ESSDashboard = () => {
  const { features } = useESSFeatures();
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [employeeName, setEmployeeName] = useState("");
  const [latestPayslip, setLatestPayslip] = useState<LatestPayslip | null>(null);
  const [leaveRows, setLeaveRows] = useState<LeaveRow[]>([]);
  const [unreadNotices, setUnreadNotices] = useState<UnreadNotice[]>([]);
  const [unacknowledgedAssets, setUnacknowledgedAssets] = useState(0);
  const [pendingTimesheets, setPendingTimesheets] = useState(0);
  const [hasExitRequest, setHasExitRequest] = useState(false);
  const [exitStatus, setExitStatus] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: emp } = await supabase
        .from("employees")
        .select("id, name, company_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!emp) { setLoading(false); return; }
      setEmployeeId(emp.id);
      setEmployeeName(emp.name);

      const tasks: Promise<void>[] = [];

      tasks.push(
        supabase
          .from("payroll_details")
          .select("gross_earnings, net_pay, payroll_runs!inner(month)")
          .eq("employee_id", emp.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .then(({ data }) => {
            if (data && data.length > 0) {
              const p = data[0] as any;
              setLatestPayslip({ month: p.payroll_runs?.month ?? "", gross_salary: p.gross_earnings ?? 0, net_salary: p.net_pay ?? 0 });
            }
          })
      );

      tasks.push(
        supabase
          .from("leave_requests")
          .select("id, leave_type, start_date, end_date, days, status")
          .eq("employee_id", emp.id)
          .order("created_at", { ascending: false })
          .limit(5)
          .then(({ data }) => { if (data) setLeaveRows(data as LeaveRow[]); })
      );

      tasks.push(
        supabase
          .from("notices")
          .select("id, title, priority, posted_at")
          .eq("company_id", emp.company_id)
          .order("posted_at", { ascending: false })
          .limit(10)
          .then(async ({ data: noticeData }) => {
            if (noticeData && noticeData.length > 0) {
              const { data: readData } = await supabase
                .from("notice_reads")
                .select("notice_id")
                .eq("employee_id", emp.id);
              const readSet = new Set((readData ?? []).map((r: any) => r.notice_id));
              setUnreadNotices((noticeData as any[]).filter((n) => !readSet.has(n.id)).slice(0, 3));
            }
          })
      );

      tasks.push(
        supabase
          .from("assets")
          .select("id", { count: "exact", head: true })
          .eq("assigned_to", emp.id)
          .eq("acknowledged", false)
          .then(({ count }) => setUnacknowledgedAssets(count ?? 0))
      );

      const weekStart = format(
        new Date(Date.now() - new Date().getDay() * 86400000),
        "yyyy-MM-dd"
      );
      tasks.push(
        supabase
          .from("timesheets")
          .select("id", { count: "exact", head: true })
          .eq("employee_id", emp.id)
          .eq("week_start", weekStart)
          .eq("status", "draft")
          .then(({ count }) => setPendingTimesheets(count ?? 0))
      );

      tasks.push(
        supabase
          .from("exit_requests")
          .select("status")
          .eq("employee_id", emp.id)
          .neq("status", "withdrawn")
          .maybeSingle()
          .then(({ data }) => {
            if (data) { setHasExitRequest(true); setExitStatus(data.status); }
          })
      );

      await Promise.allSettled(tasks);
    } finally {
      setLoading(false);
    }
  };

  const leaveBalances = Object.entries(LEAVE_TOTALS).map(([lt, total]) => ({
    leave_type: lt,
    used: leaveRows.filter((l) => l.leave_type === lt && l.status === "approved").reduce((s, l) => s + l.days, 0),
    total,
  }));

  const pendingActionsCount = unacknowledgedAssets + pendingTimesheets + unreadNotices.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {employeeName || "Employee"} 👋</h1>
        <p className="text-muted-foreground">Here's your self-service summary</p>
      </div>

      {/* Active exit alert */}
      {hasExitRequest && features.exit_request && (
        <Card className="border-orange-300 bg-orange-50">
          <CardContent className="flex items-center justify-between pt-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              <div>
                <p className="font-medium text-orange-900">Active Resignation</p>
                <p className="text-xs text-orange-700 capitalize">Status: {exitStatus.replace(/_/g, " ")}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/ess/exit">View Details</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Pending actions */}
      {pendingActionsCount > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-yellow-900">Pending Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {unacknowledgedAssets > 0 && features.assets && (
              <Link to="/ess/assets" className="flex items-center gap-1 rounded-md border border-yellow-300 bg-yellow-100 px-3 py-1.5 text-xs font-medium hover:bg-yellow-200">
                <Laptop className="h-3.5 w-3.5" /> {unacknowledgedAssets} asset{unacknowledgedAssets !== 1 ? "s" : ""} to acknowledge
              </Link>
            )}
            {pendingTimesheets > 0 && features.timesheets && (
              <Link to="/ess/timesheets" className="flex items-center gap-1 rounded-md border border-yellow-300 bg-yellow-100 px-3 py-1.5 text-xs font-medium hover:bg-yellow-200">
                <Clock className="h-3.5 w-3.5" /> Timesheet not submitted this week
              </Link>
            )}
            {unreadNotices.length > 0 && features.notices && (
              <Link to="/ess/notices" className="flex items-center gap-1 rounded-md border border-yellow-300 bg-yellow-100 px-3 py-1.5 text-xs font-medium hover:bg-yellow-200">
                <Bell className="h-3.5 w-3.5" /> {unreadNotices.length} unread notice{unreadNotices.length !== 1 ? "s" : ""}
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick action cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.payslips && (
          <Link to="/ess/payslips">
            <Card className="cursor-pointer transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Payslips</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><p className="text-xs text-muted-foreground">View & download payslips</p></CardContent>
            </Card>
          </Link>
        )}
        {features.leave_requests && (
          <Link to="/ess/leaves">
            <Card className="cursor-pointer transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Leaves</CardTitle>
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><p className="text-xs text-muted-foreground">Apply for leave</p></CardContent>
            </Card>
          </Link>
        )}
        {features.tax_declarations && (
          <Link to="/ess/tax">
            <Card className="cursor-pointer transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Tax Declarations</CardTitle>
                <PiggyBank className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><p className="text-xs text-muted-foreground">Submit investment proofs</p></CardContent>
            </Card>
          </Link>
        )}
        {features.expenses && (
          <Link to="/ess/expenses">
            <Card className="cursor-pointer transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Expenses</CardTitle>
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><p className="text-xs text-muted-foreground">Claim reimbursements</p></CardContent>
            </Card>
          </Link>
        )}
        {features.profile_edit && (
          <Link to="/ess/profile">
            <Card className="cursor-pointer transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">My Profile</CardTitle>
                <User className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><p className="text-xs text-muted-foreground">View & update details</p></CardContent>
            </Card>
          </Link>
        )}
      </div>

      {/* Latest payslip */}
      {latestPayslip && features.payslips && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Latest Payslip</CardTitle>
              <p className="text-sm text-muted-foreground">{latestPayslip.month}</p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/ess/payslips">View all <ChevronRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex gap-6">
              <div>
                <p className="text-xs text-muted-foreground">Gross Pay</p>
                <p className="text-xl font-bold">₹{latestPayslip.gross_salary.toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net Pay</p>
                <p className="text-xl font-bold text-green-700">₹{latestPayslip.net_salary.toLocaleString("en-IN")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leave balances */}
      {features.leave_requests && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Leave Balance</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/ess/leaves">Apply Leave <ChevronRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              {leaveBalances.map((b) => (
                <div key={b.leave_type} className="rounded-md border p-3 text-center">
                  <p className="text-xs text-muted-foreground capitalize">{b.leave_type} Leave</p>
                  <p className="text-2xl font-bold">{Math.max(0, b.total - b.used)}</p>
                  <p className="text-xs text-muted-foreground">{b.used} used / {b.total} total</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unread notices */}
      {unreadNotices.length > 0 && features.notices && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              New Notices
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/ess/notices">View all <ChevronRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {unreadNotices.map((n) => (
              <div key={n.id} className="flex items-center justify-between rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(n.posted_at), "dd MMM yyyy")}</p>
                </div>
                {n.priority === "high" && (
                  <span className="rounded border border-red-200 bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">High</span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent leaves */}
      {leaveRows.length > 0 && features.leave_requests && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Leave Requests</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/ess/leaves">View all <ChevronRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {leaveRows.map((leave) => (
              <div key={leave.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <p className="text-sm font-medium capitalize">{leave.leave_type} Leave</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(leave.start_date), "dd MMM")} – {format(new Date(leave.end_date), "dd MMM yyyy")} · {leave.days} day{leave.days !== 1 ? "s" : ""}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${leaveStatusColor(leave.status)}`}>
                  {leave.status}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ESSDashboard;
