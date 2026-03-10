import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── OSH Working Hours Config (inlined — Edge Functions can't import from src/lib/) ───

interface OSHConfig {
  maxDailyHours: number;
  maxWeeklyHours: number;
  maxSpreadOverDaily: number;
  maxOvertimeQuarterly: number;
  overtimeRateMultiplier: number;
}

const NATIONAL_OSH: OSHConfig = {
  maxDailyHours: 8,
  maxWeeklyHours: 48,
  maxSpreadOverDaily: 10.5,
  maxOvertimeQuarterly: 125,
  overtimeRateMultiplier: 2.0,
};

const STATE_OSH_OVERRIDES: Record<string, OSHConfig> = {
  maharashtra: { maxDailyHours: 9, maxWeeklyHours: 48, maxSpreadOverDaily: 10.5, maxOvertimeQuarterly: 125, overtimeRateMultiplier: 2.0 },
  karnataka:   { maxDailyHours: 9, maxWeeklyHours: 48, maxSpreadOverDaily: 10.5, maxOvertimeQuarterly: 125, overtimeRateMultiplier: 2.0 },
  delhi:       { maxDailyHours: 9, maxWeeklyHours: 48, maxSpreadOverDaily: 10.5, maxOvertimeQuarterly: 125, overtimeRateMultiplier: 2.0 },
  telangana:   { maxDailyHours: 9, maxWeeklyHours: 48, maxSpreadOverDaily: 12,   maxOvertimeQuarterly: 75,  overtimeRateMultiplier: 2.0 },
};

// ─── S&E Working Hours Config (inlined) ───

interface SEConfig {
  maxDailyHours: number;
  maxWeeklyHours: number;
  maxSpreadOverHours: number;
  maxContinuousHoursBeforeRest: number;
  minRestIntervalHours: number;
}

const SE_RULES: Record<string, SEConfig> = {
  maharashtra: { maxDailyHours: 9, maxWeeklyHours: 48, maxSpreadOverHours: 10.5, maxContinuousHoursBeforeRest: 5, minRestIntervalHours: 0.5 },
  karnataka:   { maxDailyHours: 9, maxWeeklyHours: 48, maxSpreadOverHours: 12,   maxContinuousHoursBeforeRest: 5, minRestIntervalHours: 1 },
  delhi:       { maxDailyHours: 9, maxWeeklyHours: 48, maxSpreadOverHours: 10.5, maxContinuousHoursBeforeRest: 5, minRestIntervalHours: 0.5 },
  telangana:   { maxDailyHours: 9, maxWeeklyHours: 48, maxSpreadOverHours: 12,   maxContinuousHoursBeforeRest: 5, minRestIntervalHours: 1 },
};

// ─── Helpers ───

const BATCH_SIZE = 500;

function getQuarterStart(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.getMonth();
  const quarterMonth = month - (month % 3);
  return `${d.getFullYear()}-${String(quarterMonth + 1).padStart(2, '0')}-01`;
}

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0=Sun, 1=Mon
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(d.getFullYear(), d.getMonth(), diff);
  return monday.toISOString().split('T')[0];
}

interface Violation {
  employee_id: string;
  violation_date: string;
  violation_type: string;
  rule_source: string;
  state: string;
  limit_value: number;
  actual_value: number;
  issue_description: string;
  week_start_date: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ─── 1. Authenticate ───
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing or invalid Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── 2. Parse input ───
    const body = await req.json();
    const { companyId, month, year } = body;

    if (!companyId || !month || !year) {
      return new Response(JSON.stringify({ error: "companyId, month, and year are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const monthStr = String(month).padStart(2, '0');
    const yearStr = String(year);
    const dateFrom = `${yearStr}-${monthStr}-01`;
    const lastDay = new Date(Number(yearStr), Number(monthStr), 0).getDate();
    const dateTo = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

    // ─── 3. Service-role client ───
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ─── 4. Verify company ownership ───
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id, state")
      .eq("id", companyId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (companyError || !company) {
      return new Response(JSON.stringify({ error: "Forbidden: you do not own this company" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyState = company.state || 'Maharashtra';
    const stateKey = companyState.toLowerCase().replace(/\s+/g, '');
    const oshConfig = STATE_OSH_OVERRIDES[stateKey] || NATIONAL_OSH;
    const seConfig = SE_RULES[stateKey]; // undefined if not covered

    // ─── 5. Clear old violations for this date range ───
    await supabase
      .from("working_hour_violations")
      .delete()
      .eq("company_id", companyId)
      .gte("violation_date", dateFrom)
      .lte("violation_date", dateTo);

    // ─── 6. Fetch all timesheets in date range, batched ───
    const allViolations: Violation[] = [];
    const quarterOTUpdates: Map<string, { employee_id: string; quarter_start: string; ot_hours: number }> = new Map();
    let employeesChecked = 0;
    let offset = 0;
    let hasMore = true;

    // Get distinct employee IDs with timesheets in this period
    const { data: employeeIds } = await supabase
      .from("timesheets")
      .select("employee_id")
      .eq("company_id", companyId)
      .gte("date", dateFrom)
      .lte("date", dateTo);

    const uniqueEmployeeIds = [...new Set((employeeIds || []).map(t => t.employee_id))];

    // Fetch employee details (gender for night shift check)
    const employeeGenderMap = new Map<string, string>();
    if (uniqueEmployeeIds.length > 0) {
      // Batch fetch employee details
      let empOffset = 0;
      while (empOffset < uniqueEmployeeIds.length) {
        const batch = uniqueEmployeeIds.slice(empOffset, empOffset + BATCH_SIZE);
        const { data: emps } = await supabase
          .from("employees")
          .select("id, gender")
          .in("id", batch);

        for (const emp of emps || []) {
          if (emp.gender) {
            employeeGenderMap.set(emp.id, emp.gender);
          }
        }
        empOffset += BATCH_SIZE;
      }
    }

    // Fetch existing quarterly OT accumulation for relevant quarter(s)
    const quartersNeeded = new Set<string>();
    // Month could span two quarters (unlikely but handle edge)
    quartersNeeded.add(getQuarterStart(dateFrom));
    quartersNeeded.add(getQuarterStart(dateTo));

    const existingOT = new Map<string, number>();
    for (const qs of quartersNeeded) {
      const { data: otRecords } = await supabase
        .from("quarterly_ot_accumulation")
        .select("employee_id, total_ot_hours")
        .eq("company_id", companyId)
        .eq("quarter_start", qs);

      for (const rec of otRecords || []) {
        existingOT.set(`${rec.employee_id}_${qs}`, Number(rec.total_ot_hours || 0));
      }
    }

    // Fetch night shift consent records
    const consentMap = new Map<string, { consent_given: boolean; valid_until: string | null }>();
    const { data: consents } = await supabase
      .from("night_shift_consents")
      .select("employee_id, consent_given, valid_until")
      .eq("company_id", companyId);

    for (const c of consents || []) {
      consentMap.set(c.employee_id, { consent_given: c.consent_given, valid_until: c.valid_until });
    }

    // Process each employee's timesheets
    for (let i = 0; i < uniqueEmployeeIds.length; i += BATCH_SIZE) {
      const batch = uniqueEmployeeIds.slice(i, i + BATCH_SIZE);

      // Fetch timesheets for this batch
      const { data: timesheets } = await supabase
        .from("timesheets")
        .select("employee_id, date, normal_hours, overtime_hours")
        .eq("company_id", companyId)
        .in("employee_id", batch)
        .gte("date", dateFrom)
        .lte("date", dateTo)
        .order("date", { ascending: true });

      // Group timesheets by employee
      const empTimesheets = new Map<string, Array<{ date: string; normal_hours: number; overtime_hours: number }>>();
      for (const ts of timesheets || []) {
        if (!empTimesheets.has(ts.employee_id)) {
          empTimesheets.set(ts.employee_id, []);
        }
        empTimesheets.get(ts.employee_id)!.push({
          date: ts.date,
          normal_hours: Number(ts.normal_hours || 0),
          overtime_hours: Number(ts.overtime_hours || 0),
        });
      }

      // Validate each employee
      for (const [empId, entries] of empTimesheets.entries()) {
        employeesChecked++;
        const empGender = employeeGenderMap.get(empId);
        const isFemale = empGender && empGender.toLowerCase() === 'female';

        // Group entries by week for weekly checks
        const weekGroups = new Map<string, typeof entries>();
        for (const entry of entries) {
          const weekStart = getWeekStart(entry.date);
          if (!weekGroups.has(weekStart)) {
            weekGroups.set(weekStart, []);
          }
          weekGroups.get(weekStart)!.push(entry);
        }

        let monthlyOTHours = 0;

        // Per-day checks
        for (const entry of entries) {
          const totalHours = entry.normal_hours + entry.overtime_hours;
          // Estimate spread-over as total hours + 1 hr for breaks (no actual column in DB)
          const estimatedSpreadOver = totalHours > 0 ? totalHours + 1 : 0;
          const weekStart = getWeekStart(entry.date);

          // ─── OSH Daily Checks ───
          if (totalHours > oshConfig.maxDailyHours) {
            const dailyOT = totalHours - oshConfig.maxDailyHours;
            monthlyOTHours += dailyOT;

            allViolations.push({
              employee_id: empId,
              violation_date: entry.date,
              violation_type: 'daily_hours',
              rule_source: 'OSH',
              state: companyState,
              limit_value: oshConfig.maxDailyHours,
              actual_value: totalHours,
              issue_description: `Daily OSH limit exceeded by ${dailyOT.toFixed(1)} hours (overtime applies at ${oshConfig.overtimeRateMultiplier}x rate)`,
              week_start_date: weekStart,
            });
          }

          // OSH Spread-over check
          if (estimatedSpreadOver > oshConfig.maxSpreadOverDaily) {
            allViolations.push({
              employee_id: empId,
              violation_date: entry.date,
              violation_type: 'spread_over',
              rule_source: 'OSH',
              state: companyState,
              limit_value: oshConfig.maxSpreadOverDaily,
              actual_value: estimatedSpreadOver,
              issue_description: `Daily spread-over exceeded OSH limit by ${(estimatedSpreadOver - oshConfig.maxSpreadOverDaily).toFixed(1)} hours`,
              week_start_date: weekStart,
            });
          }

          // ─── S&E Daily Checks ───
          if (seConfig) {
            if (totalHours > seConfig.maxDailyHours) {
              allViolations.push({
                employee_id: empId,
                violation_date: entry.date,
                violation_type: 'daily_hours',
                rule_source: 'SE',
                state: companyState,
                limit_value: seConfig.maxDailyHours,
                actual_value: totalHours,
                issue_description: `Daily S&E working hours exceeded for ${companyState}`,
                week_start_date: weekStart,
              });
            }

            if (estimatedSpreadOver > seConfig.maxSpreadOverHours) {
              allViolations.push({
                employee_id: empId,
                violation_date: entry.date,
                violation_type: 'spread_over',
                rule_source: 'SE',
                state: companyState,
                limit_value: seConfig.maxSpreadOverHours,
                actual_value: estimatedSpreadOver,
                issue_description: `Daily S&E spread-over exceeded for ${companyState}`,
                week_start_date: weekStart,
              });
            }

            // Continuous hours check: if normal_hours > maxContinuous, potential violation
            if (entry.normal_hours > seConfig.maxContinuousHoursBeforeRest) {
              allViolations.push({
                employee_id: empId,
                violation_date: entry.date,
                violation_type: 'continuous_hours',
                rule_source: 'SE',
                state: companyState,
                limit_value: seConfig.maxContinuousHoursBeforeRest,
                actual_value: entry.normal_hours,
                issue_description: `Continuous work exceeds ${seConfig.maxContinuousHoursBeforeRest}hr S&E limit — rest interval of ${seConfig.minRestIntervalHours}hr required`,
                week_start_date: weekStart,
              });
            }
          }

          // ─── Night Shift Consent Check (OSH Code Section 43) ───
          if (isFemale) {
            // Check if this entry could be a night shift (very rough heuristic:
            // overtime_hours > 0 and total > 10 suggests late working hours)
            // A more accurate check would need actual clock-in/out times
            // For now, flag if employee has no valid consent regardless
            const consent = consentMap.get(empId);
            const today = new Date().toISOString().split('T')[0];
            const hasValidConsent = consent && consent.consent_given && (!consent.valid_until || consent.valid_until >= today);

            if (!hasValidConsent && entry.overtime_hours > 0 && totalHours > 10) {
              allViolations.push({
                employee_id: empId,
                violation_date: entry.date,
                violation_type: 'night_shift_no_consent',
                rule_source: 'OSH',
                state: companyState,
                limit_value: 0,
                actual_value: totalHours,
                issue_description: `Female employee working extended hours (${totalHours}h) without night shift consent on record — OSH Code Section 43`,
                week_start_date: weekStart,
              });
            }
          }
        }

        // ─── Weekly checks ───
        for (const [weekStart, weekEntries] of weekGroups.entries()) {
          const weeklyTotal = weekEntries.reduce((sum, e) => sum + e.normal_hours + e.overtime_hours, 0);

          // OSH Weekly check
          if (weeklyTotal > oshConfig.maxWeeklyHours) {
            const weeklyOT = weeklyTotal - oshConfig.maxWeeklyHours;
            allViolations.push({
              employee_id: empId,
              violation_date: weekEntries[0].date,
              violation_type: 'weekly_hours',
              rule_source: 'OSH',
              state: companyState,
              limit_value: oshConfig.maxWeeklyHours,
              actual_value: weeklyTotal,
              issue_description: `Weekly OSH limit exceeded by ${weeklyOT.toFixed(1)} hours`,
              week_start_date: weekStart,
            });
          }

          // S&E Weekly check
          if (seConfig && weeklyTotal > seConfig.maxWeeklyHours) {
            allViolations.push({
              employee_id: empId,
              violation_date: weekEntries[0].date,
              violation_type: 'weekly_hours',
              rule_source: 'SE',
              state: companyState,
              limit_value: seConfig.maxWeeklyHours,
              actual_value: weeklyTotal,
              issue_description: `Weekly S&E limit exceeded for ${companyState}`,
              week_start_date: weekStart,
            });
          }
        }

        // ─── Quarterly OT accumulation ───
        const quarterStart = getQuarterStart(dateFrom);
        const existingAccum = existingOT.get(`${empId}_${quarterStart}`) || 0;
        const newTotal = existingAccum + monthlyOTHours;

        if (newTotal > oshConfig.maxOvertimeQuarterly) {
          allViolations.push({
            employee_id: empId,
            violation_date: dateFrom,
            violation_type: 'quarterly_ot',
            rule_source: 'OSH',
            state: companyState,
            limit_value: oshConfig.maxOvertimeQuarterly,
            actual_value: newTotal,
            issue_description: `Quarterly overtime ceiling (${oshConfig.maxOvertimeQuarterly}h) exceeded — accumulated ${newTotal.toFixed(1)}h`,
            week_start_date: null,
          });
        }

        // Track OT update
        const otKey = `${empId}_${quarterStart}`;
        const existing = quarterOTUpdates.get(otKey);
        quarterOTUpdates.set(otKey, {
          employee_id: empId,
          quarter_start: quarterStart,
          ot_hours: (existing?.ot_hours || existingAccum) + monthlyOTHours,
        });
      }
    }

    // ─── 7. Insert violations ───
    if (allViolations.length > 0) {
      const violationRows = allViolations.map(v => ({
        company_id: companyId,
        employee_id: v.employee_id,
        violation_date: v.violation_date,
        violation_type: v.violation_type,
        rule_source: v.rule_source,
        state: v.state,
        limit_value: v.limit_value,
        actual_value: v.actual_value,
        issue_description: v.issue_description,
        week_start_date: v.week_start_date,
      }));

      // Insert in batches
      for (let i = 0; i < violationRows.length; i += BATCH_SIZE) {
        const batch = violationRows.slice(i, i + BATCH_SIZE);
        const { error: insertError } = await supabase
          .from("working_hour_violations")
          .insert(batch);
        if (insertError) {
          console.error("Error inserting violations batch:", insertError);
        }
      }
    }

    // ─── 8. Upsert quarterly OT accumulations ───
    for (const [, update] of quarterOTUpdates.entries()) {
      await supabase
        .from("quarterly_ot_accumulation")
        .upsert({
          company_id: companyId,
          employee_id: update.employee_id,
          quarter_start: update.quarter_start,
          total_ot_hours: update.ot_hours,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'company_id,employee_id,quarter_start' });
    }

    // ─── 9. Summarize ───
    const violationsByType: Record<string, number> = {};
    for (const v of allViolations) {
      const key = `${v.rule_source}_${v.violation_type}`;
      violationsByType[key] = (violationsByType[key] || 0) + 1;
    }

    return new Response(JSON.stringify({
      success: true,
      violations_count: allViolations.length,
      violations_by_type: violationsByType,
      employees_checked: employeesChecked,
      period: { from: dateFrom, to: dateTo },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
