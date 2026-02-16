import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const ComplianceCalendar = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [company, setCompany] = useState<any>(null);
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

      const { data: runs } = await supabase
        .from("payroll_runs")
        .select("month, status, processed_at")
        .eq("company_id", comp.id)
        .order("month", { ascending: false })
        .limit(6);

      const today = new Date();
      const next30Days = addDays(today, 30);
      const upcomingDeadlines = generateDeadlines(today, next30Days, comp, runs || []);
      setDeadlines(upcomingDeadlines);
    } catch (error) {
      console.error("Calendar load error:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateDeadlines = (
    today: Date,
    next30Days: Date,
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

    // EPF ECR - 15th of current month
    const epfDue = new Date(yr, mo - 1, 15);
    if (epfDue >= today && epfDue <= next30Days) {
      const lastRun = payrollRuns?.[0];
      const status = lastRun && lastRun.status === "finalized" ? "completed" : "upcoming";
      result.push({
        type: "epf", name: "EPF ECR Filing", date: format(epfDue, "MMM do"),
        status, details: `Month: ${currentMonth}`,
      });
    }

    // ESIC - 21st
    const esicDue = new Date(yr, mo - 1, 21);
    if (esicDue >= today && esicDue <= next30Days) {
      result.push({
        type: "esic", name: "ESIC Monthly Return", date: format(esicDue, "MMM do"),
        status: "upcoming", details: `Code: ${comp.esic_code || "Not set"}`,
      });
    }

    // PT - 15th
    const ptDue = new Date(yr, mo - 1, 15);
    if (ptDue >= today && ptDue <= next30Days) {
      result.push({
        type: "pt", name: "Professional Tax (Form V)", date: format(ptDue, "MMM do"),
        status: "upcoming", details: `RC: ${comp.pt_rc_number || "Not set"}`,
      });
    }

    // LWF half-yearly
    if (isLWFMonth && comp.lwf_number) {
      const lwfDueDate = currentMonthNum === "06"
        ? new Date(yr, 6, 15)
        : new Date(yr + 1, 0, 15);
      if (lwfDueDate >= today && lwfDueDate <= next30Days) {
        result.push({
          type: "lwf", name: "Labour Welfare Fund", date: format(lwfDueDate, "MMM do"),
          status: "upcoming", details: "Half-yearly remittance",
        });
      }
    }

    // TDS Quarterly
    const tdsDates = [
      { month: 7, day: 31, desc: "Q1 (Apr-Jun)" },
      { month: 10, day: 31, desc: "Q2 (Jul-Sep)" },
      { month: 1, day: 31, desc: "Q3 (Oct-Dec)" },
      { month: 5, day: 31, desc: "Q4 (Jan-Mar)" },
    ];
    tdsDates.forEach(({ month: tdsMonth, day, desc }) => {
      const tdsDue = new Date(yr, tdsMonth - 1, day);
      if (tdsDue >= today && tdsDue <= next30Days) {
        result.push({
          type: "tds", name: "TDS Form 24Q", date: format(tdsDue, "MMM do"),
          status: "upcoming", details: desc,
        });
      }
    });

    // Bonus Form D - Feb 1
    const bonusDue = new Date(yr, 1, 1);
    if (bonusDue >= today && bonusDue <= next30Days) {
      result.push({
        type: "bonus", name: "Bonus Form D", date: format(bonusDue, "MMM do"),
        status: "upcoming", details: "Payment of Bonus Act annual return",
      });
    }

    return result;
  };

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
            <CardTitle>{deadlines.length} Upcoming Deadline{deadlines.length !== 1 ? "s" : ""}</CardTitle>
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
                        File & pay penalty interest immediately!
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
