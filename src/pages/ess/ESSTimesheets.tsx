import { useState, useEffect } from "react";
import {
  startOfWeek, endOfWeek, addWeeks, subWeeks, format,
  eachDayOfInterval, parseISO, isValid,
} from "date-fns";
import { ChevronLeft, ChevronRight, Clock, AlertTriangle, Loader2, CheckCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getSafeErrorMessage } from "@/lib/safe-error";
import { validateWorkingHours } from "@/lib/oshCompliance";
import ESSFeatureGate from "@/components/ess/ESSFeatureGate";

interface DayEntry {
  date: string; // yyyy-MM-dd
  normal_hours: number;
  overtime_hours: number;
  notes: string;
}

interface TimesheetRow {
  id: string;
  date: string;
  normal_hours: number;
  overtime_hours: number;
  status: string;
  notes: string | null;
}

function buildWeekEntries(weekStart: Date): DayEntry[] {
  const days = eachDayOfInterval({
    start: startOfWeek(weekStart, { weekStartsOn: 1 }),
    end: endOfWeek(weekStart, { weekStartsOn: 1 }),
  });
  return days.map((d) => ({
    date: format(d, "yyyy-MM-dd"),
    normal_hours: 0,
    overtime_hours: 0,
    notes: "",
  }));
}

const ESSTimesheets = () => {
  const { toast } = useToast();
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Current week
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [entries, setEntries] = useState<DayEntry[]>(() =>
    buildWeekEntries(startOfWeek(new Date(), { weekStartsOn: 1 }))
  );

  // Existing rows for this week from DB (to detect already-submitted)
  const [existingRows, setExistingRows] = useState<TimesheetRow[]>([]);

  // History
  const [history, setHistory] = useState<TimesheetRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // OSH warnings
  const [oshWarnings, setOshWarnings] = useState<string[]>([]);

  // ── Fetch employee id ─────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: emp } = await supabase
        .from("employees")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (emp) setEmployeeId(emp.id);
      setLoading(false);
    })();
  }, []);

  // ── Fetch this week's existing rows ──────────────────────────────────────
  useEffect(() => {
    if (!employeeId) return;
    const ws = format(startOfWeek(weekStart, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const we = format(endOfWeek(weekStart, { weekStartsOn: 1 }), "yyyy-MM-dd");
    supabase
      .from("timesheets")
      .select("id, date, normal_hours, overtime_hours, status, notes")
      .eq("employee_id", employeeId)
      .gte("date", ws)
      .lte("date", we)
      .then(({ data }) => {
        setExistingRows(data ?? []);
        // Pre-fill entries from DB
        const fresh = buildWeekEntries(weekStart);
        if (data && data.length > 0) {
          for (const row of data) {
            const idx = fresh.findIndex((e) => e.date === row.date);
            if (idx !== -1) {
              fresh[idx].normal_hours = row.normal_hours ?? 0;
              fresh[idx].overtime_hours = row.overtime_hours ?? 0;
              fresh[idx].notes = row.notes ?? "";
            }
          }
        }
        setEntries(fresh);
      });
  }, [employeeId, weekStart]);

  // ── Fetch history (last 8 weeks) ─────────────────────────────────────────
  useEffect(() => {
    if (!employeeId) return;
    setHistoryLoading(true);
    const eightWeeksAgo = format(subWeeks(new Date(), 8), "yyyy-MM-dd");
    supabase
      .from("timesheets")
      .select("id, date, normal_hours, overtime_hours, status, notes")
      .eq("employee_id", employeeId)
      .gte("date", eightWeeksAgo)
      .order("date", { ascending: false })
      .then(({ data }) => {
        setHistory(data ?? []);
        setHistoryLoading(false);
      });
  }, [employeeId, submitting]);

  // ── OSH check whenever entries change ────────────────────────────────────
  useEffect(() => {
    const totalOT = entries.reduce((sum, e) => sum + (e.overtime_hours || 0), 0);
    const warnings: string[] = [];
    if (totalOT > 12) {
      warnings.push(`Weekly OT (${totalOT}h) exceeds OSH Code limit of 12 hours.`);
    }
    const anyDayExceeds = entries.some((e) => (e.normal_hours + e.overtime_hours) > 12);
    if (anyDayExceeds) {
      warnings.push("Daily working hours exceed 12h on one or more days (OSH Code §25).");
    }
    setOshWarnings(warnings);
  }, [entries]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const goToPrevWeek = () => {
    setWeekStart((w) => subWeeks(w, 1));
  };
  const goToNextWeek = () => {
    setWeekStart((w) => addWeeks(w, 1));
  };

  const updateEntry = (index: number, field: keyof DayEntry, value: string | number) => {
    setEntries((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // ── Submit week ───────────────────────────────────────────────────────────
  const submitWeek = async () => {
    if (!employeeId) return;
    setSubmitting(true);
    try {
      // Only submit days with hours > 0
      const toSubmit = entries.filter((e) => e.normal_hours > 0 || e.overtime_hours > 0);
      if (toSubmit.length === 0) {
        toast({ title: "No hours entered", description: "Enter hours for at least one day.", variant: "destructive" });
        return;
      }

      // Upsert approach: delete existing pending rows for this week, then insert
      const ws = format(startOfWeek(weekStart, { weekStartsOn: 1 }), "yyyy-MM-dd");
      const we = format(endOfWeek(weekStart, { weekStartsOn: 1 }), "yyyy-MM-dd");

      // Only delete pending rows (approved ones stay)
      const pendingIds = existingRows.filter((r) => r.status === "Pending").map((r) => r.id);
      if (pendingIds.length > 0) {
        await supabase.from("timesheets").delete().in("id", pendingIds);
      }

      const rows = toSubmit.map((e) => ({
        employee_id: employeeId,
        date: e.date,
        normal_hours: e.normal_hours,
        overtime_hours: e.overtime_hours,
        notes: e.notes || null,
        status: "Pending",
      }));

      const { error } = await supabase.from("timesheets").insert(rows);
      if (error) throw error;

      toast({ title: "Week submitted", description: `${rows.length} day(s) submitted for approval.` });
      // Re-fetch
      const { data } = await supabase
        .from("timesheets")
        .select("id, date, normal_hours, overtime_hours, status, notes")
        .eq("employee_id", employeeId)
        .gte("date", ws)
        .lte("date", we);
      setExistingRows(data ?? []);
    } catch (err) {
      toast({ title: "Error", description: getSafeErrorMessage(err), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const weekLabel = `${format(startOfWeek(weekStart, { weekStartsOn: 1 }), "d MMM")} – ${format(
    endOfWeek(weekStart, { weekStartsOn: 1 }), "d MMM yyyy"
  )}`;

  const weekStatus = () => {
    if (existingRows.length === 0) return null;
    if (existingRows.every((r) => r.status === "Approved")) return "approved";
    if (existingRows.some((r) => r.status === "Rejected")) return "rejected";
    if (existingRows.some((r) => r.status === "Pending")) return "pending";
    return null;
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case "Approved": return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case "Rejected": return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      default: return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ESSFeatureGate feature="timesheets">
      <div className="space-y-6 p-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Timesheets</h1>
          <p className="text-muted-foreground text-sm">Enter your daily hours and submit for approval.</p>
        </div>

        {/* OSH Warnings */}
        {oshWarnings.length > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 flex gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              {oshWarnings.map((w, i) => (
                <p key={i} className="text-sm text-amber-800">{w}</p>
              ))}
            </div>
          </div>
        )}

        {/* Week Entry Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Week: {weekLabel}
                </CardTitle>
                {weekStatus() && (
                  <div className="mt-1">{statusBadge(weekStatus()!)}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={goToPrevWeek}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={goToNextWeek}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Day</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Normal Hrs</TableHead>
                    <TableHead>OT Hrs</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry, idx) => {
                    const existing = existingRows.find((r) => r.date === entry.date);
                    const isApproved = existing?.status === "Approved";
                    const d = isValid(parseISO(entry.date)) ? parseISO(entry.date) : new Date();
                    return (
                      <TableRow key={entry.date}>
                        <TableCell className="font-medium">{format(d, "EEE")}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{format(d, "d MMM")}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={12}
                            step={0.5}
                            value={entry.normal_hours || ""}
                            onChange={(e) => updateEntry(idx, "normal_hours", parseFloat(e.target.value) || 0)}
                            disabled={isApproved}
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={8}
                            step={0.5}
                            value={entry.overtime_hours || ""}
                            onChange={(e) => updateEntry(idx, "overtime_hours", parseFloat(e.target.value) || 0)}
                            disabled={isApproved}
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={entry.notes}
                            onChange={(e) => updateEntry(idx, "notes", e.target.value)}
                            disabled={isApproved}
                            placeholder="Optional"
                            className="w-40"
                          />
                        </TableCell>
                        <TableCell>
                          {existing ? statusBadge(existing.status) : <span className="text-xs text-muted-foreground">Not submitted</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Total: {entries.reduce((s, e) => s + e.normal_hours, 0)}h normal +{" "}
                {entries.reduce((s, e) => s + e.overtime_hours, 0)}h OT
              </div>
              <Button onClick={submitWeek} disabled={submitting || weekStatus() === "approved"}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                Submit Week
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Past Timesheets (last 8 weeks)</CardTitle>
            <CardDescription>Your submitted timesheet history</CardDescription>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No timesheet history yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Normal Hrs</TableHead>
                    <TableHead>OT Hrs</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{format(parseISO(row.date), "d MMM yyyy")}</TableCell>
                      <TableCell>{row.normal_hours}</TableCell>
                      <TableCell>{row.overtime_hours}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{row.notes || "—"}</TableCell>
                      <TableCell>{statusBadge(row.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </ESSFeatureGate>
  );
};

export default ESSTimesheets;
