import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, CalendarDays, PiggyBank, User, ChevronRight, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface UnreadNotice {
  id: string;
  title: string;
  priority: "high" | "normal" | "low";
  posted_at: string;
}

interface LatestPayslip {
  month: number;
  year: number;
  gross_salary: number;
  net_salary: number;
}

interface PendingLeave {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  status: string;
}

const ESSDashboard = () => {
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [employeeName, setEmployeeName] = useState("");
  const [latestPayslip, setLatestPayslip] = useState<LatestPayslip | null>(null);
  const [pendingLeaves, setPendingLeaves] = useState<PendingLeave[]>([]);
  const [unreadNotices, setUnreadNotices] = useState<UnreadNotice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
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
      setEmployeeId(emp.id);
      setEmployeeName(emp.name);

      // Latest payslip
      const { data: payslips } = await supabase
        .from("payroll_details")
        .select("gross_salary, net_salary, payroll_runs(month, year)")
        .eq("employee_id", emp.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (payslips && payslips.length > 0) {
        const p = payslips[0] as any;
        setLatestPayslip({
          month: p.payroll_runs?.month,
          year: p.payroll_runs?.year,
          gross_salary: p.gross_salary,
          net_salary: p.net_salary,
        });
      }

      // Recent leaves
      const { data: leaves } = await supabase
        .from("leave_requests")
        .select("id, leave_type, start_date, end_date, days, status")
        .eq("employee_id", emp.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (leaves) setPendingLeaves(leaves);

      // Latest 3 unread notices
      const { data: noticeData } = await supabase
        .from("notices")
        .select("id, title, priority, posted_at")
        .eq("company_id", emp.company_id)
        .order("posted_at", { ascending: false })
        .limit(10);

      if (noticeData && noticeData.length > 0) {
        const { data: readData } = await supabase
          .from("notice_reads")
          .select("notice_id")
          .eq("employee_id", emp.id);
        const readSet = new Set((readData ?? []).map((r: any) => r.notice_id));
        const unread = (noticeData as any[])
          .filter((n) => !readSet.has(n.id))
          .slice(0, 3);
        setUnreadNotices(unread);
      }
    } finally {
      setLoading(false);
    }
  };

  const monthName = (m: number) =>
    new Date(2000, m - 1, 1).toLocaleString("en-IN", { month: "long" });

  const leaveStatusColor = (s: string) => {
    switch (s) {
      case "approved": return "bg-green-100 text-green-800";
      case "rejected": return "bg-red-100 text-red-800";
      case "cancelled": return "bg-gray-100 text-gray-600";
      default: return "bg-yellow-100 text-yellow-800";
    }
  };

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

      {/* Quick action cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/ess/payslips">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Payslips</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">View & download payslips</p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/ess/leaves">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Leaves</CardTitle>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Apply for leave</p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/ess/tax">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Tax Declarations</CardTitle>
              <PiggyBank className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Submit investment proofs</p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/ess/profile">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">My Profile</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">View & update details</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Latest payslip summary */}
      {latestPayslip && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Latest Payslip</CardTitle>
              <CardDescription>
                {monthName(latestPayslip.month)} {latestPayslip.year}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/ess/payslips">
                View all <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
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

      {/* Unread notices widget */}
      {unreadNotices.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                New Notices
              </CardTitle>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/ess/notices">
                View all <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {unreadNotices.map((n) => (
              <div key={n.id} className="flex items-center justify-between rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold">{n.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(n.posted_at), "dd MMM yyyy")}
                  </p>
                </div>
                {n.priority === "high" && (
                  <span className="rounded border border-red-200 bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                    High
                  </span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent leave requests */}
      {pendingLeaves.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Leave Requests</CardTitle>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/ess/leaves">
                View all <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingLeaves.map((leave) => (
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
