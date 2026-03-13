import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Moon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isSameDay, isSameMonth,
} from "date-fns";
import ESSFeatureGate from "@/components/ess/ESSFeatureGate";

interface ShiftPolicy {
  id: string;
  name: string;
  shift_start: string;
  shift_end: string;
  is_night_shift: boolean;
  allowance_per_day: number;
}

interface DayInfo {
  date: Date;
  type: "working" | "weekly_off" | "holiday" | "leave";
  label?: string;
}

const ESSSchedule = () => {
  const [shift, setShift] = useState<ShiftPolicy | null>(null);
  const [calendarDays, setCalendarDays] = useState<DayInfo[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [currentMonth]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: emp } = await supabase
        .from("employees")
        .select("id, company_id, shift_policy_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!emp) return;

      // Fetch shift policy
      if (emp.shift_policy_id) {
        const { data: shiftData } = await supabase
          .from("shift_policies")
          .select("id, name, shift_start, shift_end, is_night_shift, allowance_per_day")
          .eq("id", emp.shift_policy_id)
          .maybeSingle();
        if (shiftData) setShift(shiftData as ShiftPolicy);
      }

      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      const days = eachDayOfInterval({ start, end });

      // Fetch holidays for this month from compliance_calendar
      const { data: holidays } = await supabase
        .from("compliance_calendar")
        .select("date, name")
        .eq("company_id", emp.company_id)
        .gte("date", format(start, "yyyy-MM-dd"))
        .lte("date", format(end, "yyyy-MM-dd"));

      const holidayDates = new Map(
        (holidays ?? []).map((h: any) => [h.date, h.name])
      );

      // Fetch approved leaves
      const { data: leaves } = await supabase
        .from("leave_requests")
        .select("start_date, end_date, leave_type")
        .eq("employee_id", emp.id)
        .eq("status", "approved")
        .lte("start_date", format(end, "yyyy-MM-dd"))
        .gte("end_date", format(start, "yyyy-MM-dd"));

      const leaveDates = new Set<string>();
      (leaves ?? []).forEach((l: any) => {
        const s = new Date(l.start_date);
        const e = new Date(l.end_date);
        const daysInLeave = eachDayOfInterval({ start: s, end: e });
        daysInLeave.forEach((d) => leaveDates.add(format(d, "yyyy-MM-dd")));
      });

      const result: DayInfo[] = days.map((d) => {
        const dateStr = format(d, "yyyy-MM-dd");
        const dow = getDay(d); // 0 = Sun, 6 = Sat
        if (leaveDates.has(dateStr)) return { date: d, type: "leave", label: "Leave" };
        if (holidayDates.has(dateStr)) return { date: d, type: "holiday", label: holidayDates.get(dateStr) };
        if (dow === 0 || dow === 6) return { date: d, type: "weekly_off" };
        return { date: d, type: "working" };
      });

      setCalendarDays(result);
    } finally {
      setLoading(false);
    }
  };

  const dayBg = (type: DayInfo["type"]) => {
    switch (type) {
      case "holiday": return "bg-blue-100 text-blue-800";
      case "weekly_off": return "bg-gray-100 text-gray-500";
      case "leave": return "bg-green-100 text-green-800";
      default: return "bg-white";
    }
  };

  const fmtTime = (t: string) => {
    if (!t) return "";
    const [h, m] = t.split(":");
    const hr = parseInt(h);
    return `${hr > 12 ? hr - 12 : hr}:${m} ${hr >= 12 ? "PM" : "AM"}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Build calendar grid with leading empty cells
  const firstDow = calendarDays.length > 0 ? getDay(calendarDays[0].date) : 0;
  const weeks = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <ESSFeatureGate feature="shift_schedule">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">My Schedule</h1>

        {/* Shift card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              My Shift
            </CardTitle>
          </CardHeader>
          <CardContent>
            {shift ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-semibold">{shift.name}</span>
                  {shift.is_night_shift && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Moon className="h-3 w-3" /> Night Shift
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span>🕐 {fmtTime(shift.shift_start)} – {fmtTime(shift.shift_end)}</span>
                  {shift.allowance_per_day > 0 && (
                    <span>💰 ₹{shift.allowance_per_day}/day allowance</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Contact HR for shift changes.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No shift assigned. Contact your HR team.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Monthly calendar */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {format(currentMonth, "MMMM yyyy")}
              </CardTitle>
              <CardDescription>Monthly day-type overview</CardDescription>
            </div>
            <div className="flex gap-2">
              <button
                className="rounded border px-2 py-1 text-sm hover:bg-muted"
                onClick={() => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              >
                ‹
              </button>
              <button
                className="rounded border px-2 py-1 text-sm hover:bg-muted"
                onClick={() => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              >
                ›
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Legend */}
            <div className="mb-3 flex flex-wrap gap-3 text-xs">
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-white border" /> Working</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-gray-100" /> Weekly Off</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-blue-100" /> Holiday</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-green-100" /> Leave</span>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {weeks.map((w) => (
                <div key={w} className="py-1 text-xs font-medium text-muted-foreground">{w}</div>
              ))}
              {Array.from({ length: firstDow }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {calendarDays.map((d) => (
                <div
                  key={d.date.toISOString()}
                  className={`relative rounded-md border p-1.5 text-xs ${dayBg(d.type)} ${isSameDay(d.date, new Date()) ? "ring-2 ring-primary" : ""}`}
                  title={d.label}
                >
                  <span className="font-medium">{format(d.date, "d")}</span>
                  {d.label && (
                    <p className="mt-0.5 truncate text-[10px] leading-none opacity-80">{d.label}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </ESSFeatureGate>
  );
};

export default ESSSchedule;
