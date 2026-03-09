import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, FileText, CheckCircle2, Clock, Users, Activity, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/PageSkeleton";
import { differenceInDays, parseISO, format } from "date-fns";
import { validateWorkingHours } from "@/lib/oshCompliance";

const EXPIRY_WARNING_DAYS = 30;

function getValidityStatus(validUntil?: string | null) {
    if (!validUntil) return { label: "Valid", color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" };
    const daysLeft = differenceInDays(parseISO(validUntil), new Date());
    if (daysLeft < 0) return { label: "Expired", color: "bg-destructive/10 text-destructive border-destructive/20" };
    if (daysLeft <= EXPIRY_WARNING_DAYS) return { label: "Expiring Soon", color: "bg-amber-500/10 text-amber-700 border-amber-500/20" };
    return { label: "Valid", color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" };
}

// Simple stub for OSH Code dashboard. In a real system this would have full CRUD.
export default function OSHCompliance() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { data: company } = await supabase
                    .from("companies")
                    .select("id, state")
                    .eq("user_id", user.id)
                    .maybeSingle();

                if (!company) return;
                const companyState: string = (company as any).state || 'Maharashtra';

                // Fetch OSH Registrations
                const { data: registrations } = await supabase
                    .from("osh_registrations")
                    .select("*")
                    .eq("company_id", company.id);

                // Fetch OSH Licences
                const { data: licenses } = await supabase
                    .from("osh_licenses")
                    .select("*")
                    .eq("company_id", company.id);

                // Fetch Safety Committees
                const { data: committees } = await supabase
                    .from("safety_committees")
                    .select("*")
                    .eq("company_id", company.id);

                const { data: employees } = await supabase
                    .from("employees")
                    .select("id, gender, night_shift_consent")
                    .eq("company_id", company.id)
                    .in("status", ["Active", "active"]);

                const activeHeadcount = employees?.length || 0;
                const womenWithConsent = employees?.filter(e => e.gender?.toLowerCase() === 'female' && e.night_shift_consent).length || 0;
                const totalWomen = employees?.filter(e => e.gender?.toLowerCase() === 'female').length || 0;

                // Fetch Medical checkups joining employees
                const empIds = employees?.map(e => e.id) || [];
                let overdueMedical = [];
                if (empIds.length > 0) {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const { data: checks } = await supabase
                        .from("medical_checkups")
                        .select("*")
                        .in("employee_id", empIds)
                        .lt("next_due_date", todayStr);
                    if (checks) overdueMedical = checks;
                }

                // ── Gap 5: Feed validateWorkingHours() from actual timesheets ────────
                const since = new Date();
                since.setDate(since.getDate() - 28); // last 4 weeks
                const sinceStr = since.toISOString().split('T')[0];
                const { data: tsheets } = await supabase
                    .from('timesheets')
                    .select('employee_id, date, normal_hours, overtime_hours, employees(name, emp_code)')
                    .eq('company_id', company.id)
                    .gte('date', sinceStr)
                    .order('date', { ascending: true });

                // Helper: get ISO week start (Monday)
                const getWeekStart = (dateStr: string) => {
                    const d = new Date(dateStr);
                    const day = d.getDay();
                    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                    d.setDate(diff);
                    return d.toISOString().split('T')[0];
                };

                // Group timesheets by employee + week
                const weekMap: Record<string, Record<string, { entries: any[], empName: string, empCode: string }>> = {};
                (tsheets || []).forEach((t: any) => {
                    const ws = getWeekStart(t.date);
                    if (!weekMap[t.employee_id]) weekMap[t.employee_id] = {};
                    if (!weekMap[t.employee_id][ws]) {
                        weekMap[t.employee_id][ws] = {
                            entries: [],
                            empName: t.employees?.name || 'Unknown',
                            empCode: t.employees?.emp_code || '',
                        };
                    }
                    const total = Number(t.normal_hours || 0) + Number(t.overtime_hours || 0);
                    weekMap[t.employee_id][ws].entries.push({ date: t.date, hoursWorked: total, spreadOverHours: total });
                });

                // Run validator per employee per week
                const oshViolations: Array<{ empName: string; empCode: string; week: string; violations: string[] }> = [];
                for (const empId of Object.keys(weekMap)) {
                    for (const [weekStart, { entries, empName, empCode }] of Object.entries(weekMap[empId])) {
                        const result = validateWorkingHours({
                            employeeId: empId,
                            state: companyState,
                            weekStartDate: weekStart,
                            timesheetEntries: entries,
                            quarterlyOvertimeHoursAccumulated: 0,
                        });
                        if (result.violations.length > 0) {
                            oshViolations.push({
                                empName, empCode, week: weekStart,
                                violations: result.violations.map(v => v.issue),
                            });
                        }
                    }
                }

                setData({
                    registrations: registrations || [],
                    licenses: licenses || [],
                    committees: committees || [],
                    overdueMedical,
                    activeHeadcount,
                    totalWomen,
                    womenWithConsent,
                    oshViolations,
                    companyState,
                });

            } catch (e) {
                console.error("Failed to load OSH data:", e);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) return <PageSkeleton />;

    if (!data) return <div>Failed to load.</div>;

    return (
        <div className="space-y-6 pb-8">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Occupational Safety & Health (OSH)</h1>
                <p className="mt-1 text-muted-foreground">Monitor establishment registrations, licences, and welfare compliance under the OSH Code, 2020.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Welfare Triggers Card */}
                <Card className="md:col-span-1 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-md flex items-center justify-between">
                            Welfare Thresholds
                            <Activity className="h-4 w-4 text-muted-foreground" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-3xl font-bold">{data.activeHeadcount} <span className="text-sm font-normal text-muted-foreground">Total Workers</span></div>

                        <div className="space-y-3 pt-2">
                            <div className="flex justify-between items-center text-sm border-b pb-2">
                                <span>Canteen Facility (100+)</span>
                                <Badge variant={data.activeHeadcount >= 100 ? "destructive" : "secondary"}>
                                    {data.activeHeadcount >= 100 ? "Mandatory" : "Not Required"}
                                </Badge>
                            </div>
                            <div className="flex justify-between items-center text-sm border-b pb-2">
                                <span>Safety Committee (250+)</span>
                                <Badge variant={data.activeHeadcount >= 250 ? "destructive" : "secondary"}>
                                    {data.activeHeadcount >= 250 ? "Mandatory" : "Not Required"}
                                </Badge>
                            </div>
                            <div className="flex justify-between items-center text-sm pb-2">
                                <span>Crèche Facility (50+)</span>
                                <Badge variant={data.activeHeadcount >= 50 ? "destructive" : "secondary"}>
                                    {data.activeHeadcount >= 50 ? "Mandatory" : "Not Required"}
                                </Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Women Night Shift Card */}
                <Card className="md:col-span-1 shadow-sm border-purple-200">
                    <CardHeader className="bg-purple-50/50 rounded-t-xl pb-4">
                        <CardTitle className="text-md flex items-center gap-2 text-purple-900">
                            <ShieldAlert className="h-4 w-4" />
                            Women Night Work consent
                        </CardTitle>
                        <CardDescription className="text-purple-800/70">OSH Code Chapter X, Section 43</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 text-center">
                        <div className="flex items-center justify-center gap-4">
                            <div className="flex flex-col">
                                <span className="text-4xl font-bold text-purple-700">{data.womenWithConsent}</span>
                                <span className="text-xs text-muted-foreground uppercase pt-1">Consents</span>
                            </div>
                            <div className="h-12 w-px bg-border"></div>
                            <div className="flex flex-col">
                                <span className="text-4xl font-bold text-slate-700">{data.totalWomen}</span>
                                <span className="text-xs text-muted-foreground uppercase pt-1">Total Women</span>
                            </div>
                        </div>
                        {data.totalWomen > 0 && data.womenWithConsent < data.totalWomen && (
                            <p className="text-xs text-orange-600 mt-4 bg-orange-50 p-2 rounded-md">
                                Warning: {data.totalWomen - data.womenWithConsent} female workers cannot be assigned night shifts legally.
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Action Items */}
                <Card className="md:col-span-1 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-md flex items-center gap-2">
                            <Clock className="h-4 w-4 text-amber-500" />
                            Action Required
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {data.registrations.length === 0 ? (
                            <div className="bg-amber-50 p-3 rounded-md border border-amber-200 text-sm text-amber-900 flex flex-col gap-2">
                                <span><strong>Missing OSH Registration</strong></span>
                                <span>You have no active establishment registrations under the OSH Code. Check Section 3 applicability.</span>
                                <Button variant="outline" size="sm" className="w-fit mt-1 bg-white">Add Registration</Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-emerald-600 font-medium text-sm">
                                <CheckCircle2 className="h-4 w-4" /> All OSH Registrations Active
                            </div>
                        )}

                        {data.committees.length === 0 && data.activeHeadcount >= 250 && (
                            <div className="bg-destructive/10 p-3 rounded-md border border-destructive/20 text-sm text-destructive mt-3 flex flex-col gap-2">
                                <span><strong>Missing Safety Committee</strong></span>
                                <span>Establishment crossed 250 workers. A formal safety committee must be formed immediately.</span>
                                <Button variant="outline" size="sm" className="w-fit mt-1 bg-white text-destructive">Form Committee</Button>
                            </div>
                        )}

                        {data.overdueMedical && data.overdueMedical.length > 0 && (
                            <div className="bg-amber-50 p-3 rounded-md border border-amber-200 text-sm text-amber-900 mt-3 flex flex-col gap-2">
                                <span><strong>Overdue Medical Assessments ({data.overdueMedical.length})</strong></span>
                                <span>As per Section 6(1)(c), {data.overdueMedical.length} employees have overdue mandatory medical examinations.</span>
                                <Button variant="outline" size="sm" className="w-fit mt-1 bg-white">Schedule Checks</Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Registrations List */}
            <h3 className="text-lg font-semibold mt-8 mb-4">Statutory Registrations & Licences</h3>
            {data.registrations.length === 0 && data.licenses.length === 0 ? (
                <div className="border border-dashed rounded-lg p-12 text-center text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-3 opacity-20" />
                    <p>No active registrations or licences uploaded.</p>
                </div>
            ) : (
                <div className="rounded-md border">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 border-b">
                            <tr>
                                <th className="p-3 font-medium">Type</th>
                                <th className="p-3 font-medium">Number</th>
                                <th className="p-3 font-medium">Valid Until</th>
                                <th className="p-3 font-medium">State</th>
                                <th className="p-3 font-medium text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {data.registrations.map((r: any) => {
                                const status = getValidityStatus(r.valid_until);
                                return (
                                    <tr key={r.id} className="hover:bg-muted/20">
                                        <td className="p-3 font-medium">OSH Registration ({r.establishment_type})</td>
                                        <td className="p-3 text-muted-foreground">{r.registration_number}</td>
                                        <td className="p-3">{r.valid_until || 'Indefinite'}</td>
                                        <td className="p-3">{r.state || 'National'}</td>
                                        <td className="p-3 text-right">
                                            <Badge variant="default" className={`hover:bg-transparent ${status.color}`}>{status.label}</Badge>
                                        </td>
                                    </tr>
                                );
                            })}
                            {data.licenses.map((l: any) => {
                                const status = getValidityStatus(l.valid_until);
                                return (
                                    <tr key={l.id} className="hover:bg-muted/20">
                                        <td className="p-3 font-medium">{l.license_type} License</td>
                                        <td className="p-3 text-muted-foreground">{l.license_number}</td>
                                        <td className="p-3">{l.valid_until || 'Indefinite'}</td>
                                        <td className="p-3">{l.state}</td>
                                        <td className="p-3 text-right">
                                            <Badge variant="default" className={`hover:bg-transparent ${status.color}`}>{status.label}</Badge>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Gap 5: Working Hours Violations (last 4 weeks) ──────────── */}
            <div className="flex items-center justify-between mt-8 mb-4">
                <h3 className="text-lg font-semibold">Working Hours Violations — Last 4 Weeks</h3>
                {data.oshViolations.length > 0 && (
                    <Badge variant="destructive" className="text-xs">
                        {data.oshViolations.length} violation{data.oshViolations.length > 1 ? 's' : ''}
                    </Badge>
                )}
            </div>

            {data.oshViolations.length === 0 ? (
                <div className="border border-dashed rounded-lg p-10 text-center text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-3 text-emerald-500 opacity-60" />
                    <p className="font-medium text-emerald-700">No OSH working-hour violations detected</p>
                    <p className="text-xs mt-1">All timesheet data for the last 28 days is within OSH Code limits for {data.companyState}.</p>
                </div>
            ) : (
                <div className="rounded-md border">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 border-b">
                            <tr>
                                <th className="p-3 font-medium">Employee</th>
                                <th className="p-3 font-medium">Week of</th>
                                <th className="p-3 font-medium">OSH Violation</th>
                                <th className="p-3 font-medium text-right">Severity</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {data.oshViolations.flatMap((v: any, vi: number) =>
                                v.violations.map((issue: string, ii: number) => (
                                    <tr key={`${vi}-${ii}`} className="hover:bg-muted/20">
                                        <td className="p-3">
                                            <div className="font-medium">{v.empName}</div>
                                            {v.empCode && <div className="text-xs text-muted-foreground">{v.empCode}</div>}
                                        </td>
                                        <td className="p-3 text-muted-foreground">
                                            {format(new Date(v.week), 'd MMM yyyy')}
                                        </td>
                                        <td className="p-3 text-destructive">{issue}</td>
                                        <td className="p-3 text-right">
                                            <Badge variant="destructive" className="text-xs">Critical</Badge>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    <div className="p-3 bg-muted/30 border-t text-xs text-muted-foreground flex items-start gap-2">
                        <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
                        <span>
                            Violations computed against OSH Code 2020 limits for <strong>{data.companyState}</strong> from timesheet data.
                            Max daily: 9 hrs · Max weekly: 48 hrs · Max OT: 2 hrs/day · Max quarterly OT: 115 hrs. (Ch IV, Sections 25–27)
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
