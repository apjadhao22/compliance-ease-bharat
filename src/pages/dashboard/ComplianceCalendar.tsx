import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Clock, AlertCircle, CheckCircle, RefreshCw } from "lucide-react";
import { format, addDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface Deadline {
  type: string;
  name: string;
  date: string;
  dueDate: Date;
  status: string;
  details: string;
}

const statusColors: Record<string, string> = {
  upcoming: "bg-accent text-accent-foreground",
  completed: "bg-primary/20 text-primary",
  overdue: "bg-destructive text-destructive-foreground",
};

const typeColors: Record<string, string> = {
  epf: "bg-primary/10 text-primary",
  esic: "bg-primary/10 text-primary",
  pt: "bg-accent/10 text-accent-foreground",
  tds: "bg-muted text-muted-foreground",
  lwf: "bg-secondary text-secondary-foreground",
  bonus: "bg-destructive/10 text-destructive",
};

// Penalty calculation logic per compliance type
function calculatePenalty(type: string, dueDate: Date, today: Date, employeeCount: number) {
  const diffMs = today.getTime() - dueDate.getTime();
  const daysLate = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  if (daysLate === 0) return { penalty: 0, interest: 0, total: 0, daysLate: 0 };

  let penalty = 0;
  let interest = 0;
  const empCount = Math.max(employeeCount, 1);

  switch (type) {
    case "epf":
      // 1.5% per month on contribution amount (~₹1800/emp avg)
      interest = Math.round(empCount * 1800 * (daysLate / 30) * 0.015);
      penalty = daysLate > 30 ? Math.round(empCount * 500) : 0;
      break;
    case "esic":
      // ₹100/emp/day up to 5 days + 2% interest
      penalty = Math.round(empCount * 100 * Math.min(daysLate, 5));
      interest = Math.round(empCount * 50 * (daysLate / 30) * 0.02);
      break;
    case "pt":
      // Flat ₹50/emp + 2% interest on PT amount (~₹200/emp)
      penalty = Math.round(empCount * 50);
      interest = Math.round(empCount * 200 * 0.02 * (daysLate / 30));
      break;
    case "lwf":
      penalty = Math.round(empCount * 25 * Math.min(daysLate, 15));
      break;
    case "tds":
      // ₹200/day under section 234E
      penalty = Math.round(200 * daysLate);
      break;
    default:
      penalty = Math.round(empCount * 100 * (daysLate / 7));
  }

  return { penalty, interest, total: penalty + interest, daysLate };
}

const ComplianceCalendar = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadComplianceData();
  }, []);

  const loadComplianceData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: comp } = await supabase
        .from("companies")
        .select("id, state, pt_rc_number, lwf_number, epf_code, esic_code")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!comp) {
        setDeadlines([]);
        setLoading(false);
        return;
      }
      setCompany(comp);

      const [{ data: runs }, { count }] = await Promise.all([
        supabase
          .from("payroll_runs")
          .select("month, status, processed_at")
          .eq("company_id", comp.id)
          .order("month", { ascending: false })
          .limit(6),
        supabase
          .from("employees")
          .select("id", { count: "exact", head: true })
          .eq("company_id", comp.id)
          .eq("status", "Active"),
      ]);

      setEmployeeCount(count || 0);

      const today = new Date();
      const next30Days = addDays(today, 30);
      const past30Days = addDays(today, -30);
      const allDeadlines = generateDeadlines(today, next30Days, past30Days, comp, runs || []);
      setDeadlines(allDeadlines);
    } catch (error) {
      console.error("Calendar load error:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateDeadlines = (
    today: Date,
    next30Days: Date,
    past30Days: Date,
    comp: any,
    payrollRuns: any[]
  ) => {
    const result: Deadline[] = [];
    const now = new Date();
    const currentMonth = format(now, "yyyy-MM");
    const [currentYear, currentMonthNum] = currentMonth.split("-");
    const yr = Number(currentYear);
    const mo = Number(currentMonthNum);
    const isLWFMonth = ["06", "12"].includes(currentMonthNum!);

    const addDeadline = (type: string, name: string, due: Date, details: string, payrollRuns: any[]) => {
      if (due < past30Days || due > next30Days) return;
      const lastRun = payrollRuns?.[0];
      let status = "upcoming";
      if (due < today) {
        status = lastRun && lastRun.status === "finalized" ? "completed" : "overdue";
      } else if (lastRun && lastRun.status === "finalized") {
        status = "completed";
      }
      result.push({ type, name, date: format(due, "MMM do"), dueDate: due, status, details });
    };

    // EPF ECR - 15th
    addDeadline("epf", "EPF ECR Filing", new Date(yr, mo - 1, 15), `Month: ${currentMonth}`, payrollRuns);
    // ESIC - 21st
    addDeadline("esic", "ESIC Monthly Return", new Date(yr, mo - 1, 21), `Code: ${comp.esic_code || "Not set"}`, payrollRuns);
    // PT - 15th
    addDeadline("pt", "Professional Tax (Form V)", new Date(yr, mo - 1, 15), `RC: ${comp.pt_rc_number || "Not set"}`, payrollRuns);

    // Also check previous month deadlines for overdue detection
    const prevMo = mo === 1 ? 12 : mo - 1;
    const prevYr = mo === 1 ? yr - 1 : yr;
    addDeadline("epf", "EPF ECR Filing", new Date(prevYr, prevMo - 1, 15), `Month: ${prevYr}-${String(prevMo).padStart(2, "0")}`, payrollRuns);
    addDeadline("esic", "ESIC Monthly Return", new Date(prevYr, prevMo - 1, 21), `Code: ${comp.esic_code || "Not set"}`, payrollRuns);

    // LWF half-yearly
    if (isLWFMonth && comp.lwf_number) {
      const lwfDueDate = currentMonthNum === "06" ? new Date(yr, 6, 15) : new Date(yr + 1, 0, 15);
      addDeadline("lwf", "Labour Welfare Fund", lwfDueDate, "Half-yearly remittance", payrollRuns);
    }

    // TDS Quarterly
    [
      { month: 7, day: 31, desc: "Q1 (Apr-Jun)" },
      { month: 10, day: 31, desc: "Q2 (Jul-Sep)" },
      { month: 1, day: 31, desc: "Q3 (Oct-Dec)" },
      { month: 5, day: 31, desc: "Q4 (Jan-Mar)" },
    ].forEach(({ month: tdsMonth, day, desc }) => {
      addDeadline("tds", "TDS Form 24Q", new Date(yr, tdsMonth - 1, day), desc, payrollRuns);
    });

    // Bonus Form D - Feb 1
    addDeadline("bonus", "Bonus Form D", new Date(yr, 1, 1), "Payment of Bonus Act annual return", payrollRuns);

    // Deduplicate by type+dueDate
    const seen = new Set<string>();
    return result.filter(d => {
      const key = `${d.type}-${d.dueDate.getTime()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  };

  const overdueDeadlines = deadlines.filter(d => d.status === "overdue");
  const today = new Date();
  const totalPenalty = overdueDeadlines.reduce((sum, d) => {
    return sum + calculatePenalty(d.type, d.dueDate, today, employeeCount).total;
  }, 0);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Compliance Calendar</h1>
            <p className="text-sm text-muted-foreground">
              Upcoming deadlines for {company?.state || "Maharashtra"} — Next 30 days
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadComplianceData}>
          <RefreshCw className="mr-1 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Penalty Exposure Card */}
      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle>Penalty Exposure</CardTitle>
          <CardDescription>Interest & fines for late filings ({employeeCount} employees)</CardDescription>
        </CardHeader>
        <CardContent>
          {totalPenalty > 0 ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <span className="font-bold text-destructive text-lg">
                    TOTAL PENALTY EXPOSURE: ₹{totalPenalty.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  {overdueDeadlines.map((d, i) => {
                    const pen = calculatePenalty(d.type, d.dueDate, today, employeeCount);
                    if (pen.total === 0) return null;
                    return (
                      <div key={i} className="flex justify-between items-center">
                        <span className="text-foreground">
                          {d.name} <span className="text-muted-foreground">({pen.daysLate}d late)</span>
                        </span>
                        <div className="text-right">
                          {pen.interest > 0 && (
                            <span className="text-xs text-muted-foreground mr-2">
                              Interest: ₹{pen.interest.toLocaleString("en-IN")}
                            </span>
                          )}
                          <span className="font-mono font-medium text-destructive">
                            ₹{pen.total.toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-primary/5 p-4 text-center">
              <CheckCircle className="mx-auto h-8 w-8 text-primary mb-2" />
              <p className="font-semibold text-foreground">No penalty exposure</p>
              <p className="text-sm text-muted-foreground">All filings up to date</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deadlines */}
      {deadlines.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-primary mb-3" />
            <p className="text-lg font-semibold text-foreground">All caught up!</p>
            <p className="text-sm text-muted-foreground">No immediate deadlines. Check back soon.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{deadlines.length} Deadline{deadlines.length !== 1 ? "s" : ""}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {deadlines.map((deadline, index) => (
                <div key={index} className="flex items-start gap-3 rounded-lg border p-3">
                  <Badge className={typeColors[deadline.type]}>{deadline.type.toUpperCase()}</Badge>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-foreground">{deadline.name}</p>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {deadline.date}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{deadline.details}</p>
                    {deadline.status === "overdue" && (
                      <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Overdue — ₹{calculatePenalty(deadline.type, deadline.dueDate, today, employeeCount).total.toLocaleString("en-IN")} penalty exposure
                      </p>
                    )}
                  </div>
                  <Badge className={statusColors[deadline.status]}>
                    {deadline.status === "overdue" ? "OVERDUE" : deadline.status === "completed" ? "DONE" : "UPCOMING"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => navigate("/dashboard/payroll")}>Process Payroll</Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/dashboard/payroll")}>Download ECR</Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/dashboard/payroll")}>ESIC Form 5</Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/dashboard/payroll")}>PT Form V</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ComplianceCalendar;
