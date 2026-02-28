import { useState, useEffect, useCallback } from "react";
import { format, addDays, getDaysInMonth, startOfMonth, getDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Calendar, Clock, AlertCircle, CheckCircle, RefreshCw, Plus, Download, Trash2, Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { getSafeErrorMessage } from "@/lib/safe-error";

interface Deadline {
  type: string;
  name: string;
  date: string;
  dueDate: Date;
  status: string;
  details: string;
}

type HolidayType = "National" | "State" | "Local" | "Company";

interface Holiday {
  id: string;
  name: string;
  date: string;
  type: HolidayType;
  is_optional: boolean;
}

// ─── Maharashtra 2025 Public Holidays Seed ───────────────────────────────────
const MH_HOLIDAYS_2025: Omit<Holiday, "id">[] = [
  // National
  { name: "Republic Day", date: "2025-01-26", type: "National", is_optional: false },
  { name: "Independence Day", date: "2025-08-15", type: "National", is_optional: false },
  { name: "Gandhi Jayanti", date: "2025-10-02", type: "National", is_optional: false },
  // Maharashtra State
  { name: "Makar Sankranti", date: "2025-01-14", type: "State", is_optional: false },
  { name: "Chhatrapati Shivaji Maharaj Jayanti", date: "2025-02-19", type: "State", is_optional: false },
  { name: "Holi (Dhuleti)", date: "2025-03-14", type: "State", is_optional: false },
  { name: "Gudi Padwa", date: "2025-03-30", type: "State", is_optional: false },
  { name: "Ramzan Id (Eid ul-Fitr)", date: "2025-03-31", type: "State", is_optional: false },
  { name: "Dr. Babasaheb Ambedkar Jayanti", date: "2025-04-14", type: "State", is_optional: false },
  { name: "Good Friday", date: "2025-04-18", type: "State", is_optional: false },
  { name: "Maharashtra Day", date: "2025-05-01", type: "State", is_optional: false },
  { name: "Bakri Eid (Eid ul-Adha)", date: "2025-06-07", type: "State", is_optional: false },
  { name: "Muharram", date: "2025-07-06", type: "State", is_optional: false },
  { name: "Dahi Handi (Janmashtami)", date: "2025-08-16", type: "State", is_optional: false },
  { name: "Ganesh Chaturthi", date: "2025-08-27", type: "State", is_optional: false },
  { name: "Id-e-Milad", date: "2025-09-05", type: "State", is_optional: false },
  { name: "Dussehra (Vijaya Dashami)", date: "2025-10-02", type: "State", is_optional: false },
  { name: "Navratri (Dussehra)", date: "2025-10-02", type: "State", is_optional: true },
  { name: "Diwali - Lakshmi Puja (Laxmi Pujan)", date: "2025-10-20", type: "State", is_optional: false },
  { name: "Diwali - Balipratipada (Padwa)", date: "2025-10-22", type: "State", is_optional: false },
  { name: "Christmas", date: "2025-12-25", type: "National", is_optional: false },
];

// ─── Penalty Calculation ──────────────────────────────────────────────────────
function calculatePenalty(type: string, dueDate: Date, today: Date, employeeCount: number) {
  const diffMs = today.getTime() - dueDate.getTime();
  const daysLate = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  if (daysLate === 0) return { penalty: 0, interest: 0, total: 0, daysLate: 0 };
  let penalty = 0; let interest = 0;
  const empCount = Math.max(employeeCount, 1);
  switch (type) {
    case "epf": interest = Math.round(empCount * 1800 * (daysLate / 30) * 0.015); penalty = daysLate > 30 ? Math.round(empCount * 500) : 0; break;
    case "esic": penalty = Math.round(empCount * 100 * Math.min(daysLate, 5)); interest = Math.round(empCount * 50 * (daysLate / 30) * 0.02); break;
    case "pt": penalty = Math.round(empCount * 50); interest = Math.round(empCount * 200 * 0.02 * (daysLate / 30)); break;
    case "lwf": penalty = Math.round(empCount * 25 * Math.min(daysLate, 15)); break;
    case "tds": penalty = Math.round(200 * daysLate); break;
    default: penalty = Math.round(empCount * 100 * (daysLate / 7));
  }
  return { penalty, interest, total: penalty + interest, daysLate };
}

const typeColors: Record<string, string> = {
  epf: "bg-primary/10 text-primary", esic: "bg-primary/10 text-primary",
  pt: "bg-accent/10 text-accent-foreground", tds: "bg-muted text-muted-foreground",
  lwf: "bg-secondary text-secondary-foreground", bonus: "bg-destructive/10 text-destructive",
};

const holidayTypeConfig: Record<HolidayType, { label: string; color: string; dot: string }> = {
  National: { label: "National", color: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  State: { label: "MH State", color: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  Local: { label: "Local", color: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  Company: { label: "Company", color: "bg-purple-50 text-purple-700 border-purple-200", dot: "bg-purple-500" },
};

// ─── Main Component ───────────────────────────────────────────────────────────
const ComplianceCalendar = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Holiday state
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayLoading, setHolidayLoading] = useState(true);
  const [addHolidayOpen, setAddHolidayOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMonth, setViewMonth] = useState(new Date());
  const [newHoliday, setNewHoliday] = useState({ name: "", date: "", type: "Company" as HolidayType, is_optional: false });

  const loadComplianceData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: comp } = await supabase.from("companies").select("id, state, pt_rc_number, lwf_number, epf_code, esic_code").eq("user_id", user.id).maybeSingle();
      if (!comp) { setLoading(false); return; }
      setCompany(comp);
      setCompanyId(comp.id);
      const [{ data: runs }, { count }] = await Promise.all([
        supabase.from("payroll_runs").select("month, status, processed_at").eq("company_id", comp.id).order("month", { ascending: false }).limit(6),
        supabase.from("employees").select("id", { count: "exact", head: true }).eq("company_id", comp.id).eq("status", "Active"),
      ]);
      setEmployeeCount(count || 0);
      const today = new Date();
      const next30Days = addDays(today, 30);
      const past30Days = addDays(today, -30);
      setDeadlines(generateDeadlines(today, next30Days, past30Days, comp, runs || []));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  const loadHolidays = useCallback(async (cid: string) => {
    setHolidayLoading(true);
    const db = supabase as any;
    const { data } = await db.from("company_holidays").select("*").eq("company_id", cid).order("date", { ascending: true });
    const existing: Holiday[] = data || [];

    // Auto-seed Maharashtra holidays if none from National/State exist
    const hasSeeded = existing.some(h => h.type === "National" || h.type === "State");
    if (!hasSeeded) {
      const toInsert = MH_HOLIDAYS_2025.map(h => ({ ...h, company_id: cid }));
      const { data: seeded } = await db.from("company_holidays").insert(toInsert).select();
      setHolidays((seeded || []) as Holiday[]);
    } else {
      setHolidays(existing);
    }
    setHolidayLoading(false);
  }, []);

  useEffect(() => {
    loadComplianceData();
  }, [loadComplianceData]);

  useEffect(() => {
    if (companyId) loadHolidays(companyId);
  }, [companyId, loadHolidays]);

  const generateDeadlines = (today: Date, next30: Date, past30: Date, comp: any, runs: any[]): Deadline[] => {
    const result: Deadline[] = [];
    const now = new Date();
    const currentMonth = format(now, "yyyy-MM");
    const yr = now.getFullYear();
    const mo = now.getMonth() + 1;
    const currentMonthNum = String(mo).padStart(2, "0");
    const isLWFMonth = ["06", "12"].includes(currentMonthNum);

    const add = (type: string, name: string, due: Date, details: string) => {
      if (due < past30 || due > next30) return;
      const lastRun = runs?.[0];
      let status = "upcoming";
      if (due < today) status = (lastRun?.status === "finalized") ? "completed" : "overdue";
      else if (lastRun?.status === "finalized") status = "completed";
      result.push({ type, name, date: format(due, "MMM do"), dueDate: due, status, details });
    };

    add("epf", "EPF ECR Filing", new Date(yr, mo - 1, 15), `Month: ${currentMonth}`);
    add("esic", "ESIC Monthly Return", new Date(yr, mo - 1, 21), `Code: ${comp.esic_code || "Not set"}`);
    add("pt", "Professional Tax (Form V)", new Date(yr, mo - 1, 15), `RC: ${comp.pt_rc_number || "Not set"}`);
    const prevMo = mo === 1 ? 12 : mo - 1;
    const prevYr = mo === 1 ? yr - 1 : yr;
    add("epf", "EPF ECR Filing", new Date(prevYr, prevMo - 1, 15), `Month: ${prevYr}-${String(prevMo).padStart(2, "0")}`);
    add("esic", "ESIC Monthly Return", new Date(prevYr, prevMo - 1, 21), `Code: ${comp.esic_code || "Not set"}`);
    if (isLWFMonth && comp.lwf_number) {
      const lwfDue = currentMonthNum === "06" ? new Date(yr, 6, 15) : new Date(yr + 1, 0, 15);
      add("lwf", "Labour Welfare Fund", lwfDue, "Half-yearly remittance");
    }
    [{ month: 7, day: 31, desc: "Q1 (Apr–Jun)" }, { month: 10, day: 31, desc: "Q2 (Jul–Sep)" }, { month: 1, day: 31, desc: "Q3 (Oct–Dec)" }, { month: 5, day: 31, desc: "Q4 (Jan–Mar)" }]
      .forEach(({ month: m, day, desc }) => add("tds", "TDS Form 24Q", new Date(yr, m - 1, day), desc));
    add("bonus", "Bonus Form D", new Date(yr, 1, 1), "Payment of Bonus Act annual return");

    const seen = new Set<string>();
    return result.filter(d => {
      const k = `${d.type}-${d.dueDate.getTime()}`;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    }).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  };

  const handleAddHoliday = async () => {
    if (!companyId || !newHoliday.name || !newHoliday.date) {
      toast({ title: "Missing fields", variant: "destructive" }); return;
    }
    setIsSubmitting(true);
    const db = supabase as any;
    try {
      const { data, error } = await db.from("company_holidays").insert({ company_id: companyId, ...newHoliday }).select().single();
      if (error) throw error;
      setHolidays([...holidays, data as Holiday].sort((a, b) => a.date.localeCompare(b.date)));
      setAddHolidayOpen(false);
      setNewHoliday({ name: "", date: "", type: "Company", is_optional: false });
      toast({ title: "Holiday Added", description: `${newHoliday.name} added to calendar.` });
    } catch (e: any) { toast({ title: "Error", description: getSafeErrorMessage(e), variant: "destructive" }); }
    finally { setIsSubmitting(false); }
  };

  const handleDeleteHoliday = async (holiday: Holiday) => {
    if (holiday.type !== "Company") {
      toast({ title: "Read-only", description: "National and State holidays cannot be removed.", variant: "destructive" }); return;
    }
    if (!window.confirm(`Remove "${holiday.name}"?`)) return;
    const { error } = await (supabase as any).from("company_holidays").delete().eq("id", holiday.id);
    if (error) { toast({ title: "Error", description: getSafeErrorMessage(error), variant: "destructive" }); return; }
    setHolidays(holidays.filter(h => h.id !== holiday.id));
    toast({ title: "Holiday Removed" });
  };

  const exportHolidays = () => {
    const header = "Date,Name,Type,Optional\n";
    const rows = holidays.map(h => `"${h.date}","${h.name}","${h.type}","${h.is_optional ? "Yes" : "No"}"`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `Holiday_List_${new Date().getFullYear()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    toast({ title: "Exported" });
  };

  // Build calendar grid for the view month
  const buildCalendarGrid = () => {
    const first = startOfMonth(viewMonth);
    const daysInM = getDaysInMonth(viewMonth);
    const startDow = getDay(first); // 0=Sun
    const cells: (number | null)[] = Array(startDow).fill(null);
    for (let i = 1; i <= daysInM; i++) cells.push(i);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  };

  const getHolidaysForDay = (day: number | null) => {
    if (!day) return [];
    const monthStr = format(viewMonth, "yyyy-MM");
    return holidays.filter(h => h.date === `${monthStr}-${String(day).padStart(2, "0")}`);
  };

  const today = new Date();
  const overdueDeadlines = deadlines.filter(d => d.status === "overdue");
  const totalPenalty = overdueDeadlines.reduce((sum, d) => sum + calculatePenalty(d.type, d.dueDate, today, employeeCount).total, 0);
  const calendarGrid = buildCalendarGrid();
  const todayDay = today.getMonth() === viewMonth.getMonth() && today.getFullYear() === viewMonth.getFullYear() ? today.getDate() : null;

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Compliance Calendar</h1>
            <p className="text-sm text-muted-foreground">Deadlines & Holidays — Maharashtra</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadComplianceData}><RefreshCw className="mr-1 h-4 w-4" />Refresh</Button>
      </div>

      <Tabs defaultValue="deadlines">
        <TabsList>
          <TabsTrigger value="deadlines">Statutory Deadlines</TabsTrigger>
          <TabsTrigger value="holidays">Holiday Calendar</TabsTrigger>
        </TabsList>

        {/* ─── Statutory Deadlines Tab ─────────────────────────────────────── */}
        <TabsContent value="deadlines" className="mt-4 space-y-4">
          {/* Penalty Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Penalty Exposure</CardTitle>
              <CardDescription>Interest & fines for late filings ({employeeCount} employees)</CardDescription>
            </CardHeader>
            <CardContent>
              {totalPenalty > 0 ? (
                <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <span className="font-bold text-destructive text-lg">TOTAL PENALTY EXPOSURE: ₹{totalPenalty.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    {overdueDeadlines.map((d, i) => {
                      const pen = calculatePenalty(d.type, d.dueDate, today, employeeCount);
                      if (pen.total === 0) return null;
                      return (
                        <div key={i} className="flex justify-between items-center">
                          <span>{d.name} <span className="text-muted-foreground">({pen.daysLate}d late)</span></span>
                          <div className="text-right">
                            {pen.interest > 0 && <span className="text-xs text-muted-foreground mr-2">Interest: ₹{pen.interest.toLocaleString("en-IN")}</span>}
                            <span className="font-mono font-medium text-destructive">₹{pen.total.toLocaleString("en-IN")}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border bg-primary/5 p-4 text-center">
                  <CheckCircle className="mx-auto h-8 w-8 text-primary mb-2" />
                  <p className="font-semibold">No penalty exposure</p>
                  <p className="text-sm text-muted-foreground">All filings up to date</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Deadlines List */}
          {deadlines.length === 0 ? (
            <Card><CardContent className="flex flex-col items-center justify-center py-12">
              <CheckCircle className="h-12 w-12 text-primary mb-3" />
              <p className="text-lg font-semibold">All caught up!</p>
              <p className="text-sm text-muted-foreground">No immediate deadlines in the next 30 days.</p>
            </CardContent></Card>
          ) : (
            <Card>
              <CardHeader><CardTitle>{deadlines.length} Deadline{deadlines.length !== 1 ? "s" : ""} (±30 days)</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {deadlines.map((deadline, index) => (
                    <div key={index} className="flex items-start gap-3 rounded-lg border p-3">
                      <Badge className={typeColors[deadline.type]}>{deadline.type.toUpperCase()}</Badge>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{deadline.name}</p>
                          <span className="text-sm text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{deadline.date}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{deadline.details}</p>
                        {deadline.status === "overdue" && (
                          <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Overdue — ₹{calculatePenalty(deadline.type, deadline.dueDate, today, employeeCount).total.toLocaleString("en-IN")} penalty exposure
                          </p>
                        )}
                      </div>
                      <Badge className={deadline.status === "overdue" ? "bg-destructive text-destructive-foreground" : deadline.status === "completed" ? "bg-primary/20 text-primary" : "bg-accent text-accent-foreground"}>
                        {deadline.status === "overdue" ? "OVERDUE" : deadline.status === "completed" ? "DONE" : "UPCOMING"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => navigate("/dashboard/payroll")}>Process Payroll</Button>
              <Button size="sm" variant="outline" onClick={() => navigate("/dashboard/epf-esic")}>Download ECR</Button>
              <Button size="sm" variant="outline" onClick={() => navigate("/dashboard/pt")}>PT Form V</Button>
              <Button size="sm" variant="outline" onClick={() => navigate("/dashboard/lwf")}>LWF Remittance</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Holiday Calendar Tab ─────────────────────────────────────────── */}
        <TabsContent value="holidays" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {(["National", "State", "Local", "Company"] as HolidayType[]).map(type => (
                <div key={type} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${holidayTypeConfig[type].dot}`} />
                  <span className="text-xs text-muted-foreground">{holidayTypeConfig[type].label}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportHolidays} className="gap-1"><Download className="h-4 w-4" />CSV</Button>
              <Button size="sm" onClick={() => setAddHolidayOpen(true)} className="gap-1"><Plus className="h-4 w-4" />Add Holiday</Button>
            </div>
          </div>

          {holidayLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin opacity-40" /></div>
          ) : (
            <>
              {/* Month Navigator */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}>‹ Prev</Button>
                    <h2 className="font-bold text-lg">{format(viewMonth, "MMMM yyyy")}</h2>
                    <Button variant="ghost" size="sm" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}>Next ›</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Day-of-week headers */}
                  <div className="grid grid-cols-7 text-center text-xs text-muted-foreground mb-2">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <div key={d} className="py-1 font-medium">{d}</div>)}
                  </div>
                  {/* Calendar grid */}
                  <div className="grid grid-cols-7 gap-0.5">
                    {calendarGrid.map((day, idx) => {
                      const dayHols = getHolidaysForDay(day);
                      const isToday = day === todayDay;
                      return (
                        <div key={idx} className={`min-h-[56px] rounded-md p-1 border text-xs ${day ? "bg-card" : "bg-muted/20 border-transparent"} ${isToday ? "border-primary ring-1 ring-primary" : "border-transparent"}`}>
                          {day && (
                            <>
                              <div className={`font-medium mb-1 ${isToday ? "text-primary" : "text-foreground"}`}>{day}</div>
                              {dayHols.map(h => (
                                <div key={h.id} className={`rounded px-1 py-0.5 text-[10px] leading-tight mb-0.5 truncate ${holidayTypeConfig[h.type].color} border`} title={h.name}>
                                  {h.name}
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Holiday List for the year */}
              <Card>
                <CardHeader><CardTitle>Full Year Holiday List ({holidays.length} days)</CardTitle><CardDescription>Pre-loaded with Maharashtra public holidays. Company holidays are editable.</CardDescription></CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y max-h-[400px] overflow-y-auto">
                    {holidays.map(h => (
                      <div key={h.id} className="flex items-center justify-between px-6 py-3 hover:bg-muted/20">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${holidayTypeConfig[h.type].dot}`} />
                          <div>
                            <div className="font-medium text-sm">{h.name} {h.is_optional && <span className="text-xs text-muted-foreground ml-1">(Optional)</span>}</div>
                            <div className="text-xs text-muted-foreground">{format(new Date(h.date), "EEEE, dd MMM yyyy")}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-xs ${holidayTypeConfig[h.type].color}`}>{holidayTypeConfig[h.type].label}</Badge>
                          {h.type === "Company" && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteHoliday(h)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Holiday Dialog */}
      <Dialog open={addHolidayOpen} onOpenChange={setAddHolidayOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Add Holiday</DialogTitle>
            <DialogDescription>Add a local or company-specific holiday to your calendar.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Holiday Name</Label>
              <Input className="mt-1" placeholder="e.g. Founder's Day" value={newHoliday.name} onChange={e => setNewHoliday({ ...newHoliday, name: e.target.value })} />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" className="mt-1" value={newHoliday.date} onChange={e => setNewHoliday({ ...newHoliday, date: e.target.value })} />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={newHoliday.type} onValueChange={(v: HolidayType) => setNewHoliday({ ...newHoliday, type: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Company">Company (Org-specific)</SelectItem>
                  <SelectItem value="Local">Local (City/District)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddHolidayOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleAddHoliday} disabled={isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />} Add Holiday
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ComplianceCalendar;
