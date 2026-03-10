import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, FileText, CheckCircle2, Clock, Activity, AlertCircle, RefreshCw, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { differenceInDays, parseISO, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const EXPIRY_WARNING_DAYS = 30;

function getValidityStatus(validUntil?: string | null) {
    if (!validUntil) return { label: "Valid", color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" };
    const daysLeft = differenceInDays(parseISO(validUntil), new Date());
    if (daysLeft < 0) return { label: "Expired", color: "bg-destructive/10 text-destructive border-destructive/20" };
    if (daysLeft <= EXPIRY_WARNING_DAYS) return { label: "Expiring Soon", color: "bg-amber-500/10 text-amber-700 border-amber-500/20" };
    return { label: "Valid", color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" };
}

interface OSHViolation {
    id: string;
    employee_id: string;
    violation_date: string;
    violation_type: string;
    limit_value: number;
    actual_value: number;
    issue_description: string;
    week_start_date: string | null;
    employees: { name: string; emp_code: string | null } | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OSHCompliance() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [companyId, setCompanyId] = useState<string | null>(null);

    // Phase 2: violations from DB
    const [oshViolations, setOshViolations] = useState<OSHViolation[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    // Phase 5: Add Registration dialog
    const [addRegOpen, setAddRegOpen] = useState(false);
    const [addRegForm, setAddRegForm] = useState({ establishment_type: '', registration_number: '', registration_date: '', valid_until: '', state: '' });
    const [addRegLoading, setAddRegLoading] = useState(false);

    // Phase 5: Form Safety Committee dialog
    const [committeeOpen, setCommitteeOpen] = useState(false);
    const [committeeForm, setCommitteeForm] = useState({ meeting_frequency: 'Quarterly', last_meeting_date: '', members_text: '', roles_text: '' });
    const [committeeLoading, setCommitteeLoading] = useState(false);

    // Phase 5: Schedule Medical Check dialog
    const [medCheckOpen, setMedCheckOpen] = useState(false);
    const [medCheckForm, setMedCheckForm] = useState({ employee_id: '', checkup_date: '', type: '', next_due_date: '', clinic_details: '', findings_summary: '' });
    const [medCheckLoading, setMedCheckLoading] = useState(false);

    // Phase 3: Record Consent dialog
    const [consentOpen, setConsentOpen] = useState(false);
    const [consentForm, setConsentForm] = useState({ employee_id: '', consent_given: true, consent_date: '', valid_until: '', safeguards_documented: false, notes: '' });
    const [consentLoading, setConsentLoading] = useState(false);

    const { toast } = useToast();

    useEffect(() => {
        loadAll();
    }, []);

    const loadAll = async () => {
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
            setCompanyId(company.id);

            // All at once
            const [regsResult, licensesResult, committeesResult, empsResult] = await Promise.all([
                supabase.from("osh_registrations").select("*").eq("company_id", company.id),
                supabase.from("osh_licenses").select("*").eq("company_id", company.id),
                supabase.from("safety_committees").select("*").eq("company_id", company.id),
                supabase.from("employees").select("id, name, emp_code, gender, night_shift_consent").eq("company_id", company.id).in("status", ["Active", "active"]),
            ]);

            const employees = empsResult.data || [];
            const activeHeadcount = employees.length;
            const womenWithConsent = employees.filter(e => (e as any).gender?.toLowerCase() === 'female' && (e as any).night_shift_consent).length;
            const totalWomen = employees.filter(e => (e as any).gender?.toLowerCase() === 'female').length;

            // Medical checkups
            const empIds = employees.map(e => e.id);
            let overdueMedical: any[] = [];
            if (empIds.length > 0) {
                const todayStr = new Date().toISOString().split('T')[0];
                const { data: checks } = await supabase
                    .from("medical_checkups").select("*").in("employee_id", empIds).lt("next_due_date", todayStr);
                if (checks) overdueMedical = checks;
            }

            // Night shift consent log
            const femaleEmployees = employees.filter(e => (e as any).gender?.toLowerCase() === 'female');
            const femaleEmpIds = femaleEmployees.map(e => e.id);
            let consentLog: any[] = [];
            if (femaleEmpIds.length > 0) {
                const { data: consents } = await supabase
                    .from('night_shift_consents')
                    .select('employee_id, consent_given, consent_date, valid_until, safeguards_documented')
                    .eq('company_id', company.id)
                    .in('employee_id', femaleEmpIds);
                const consentMap: Record<string, any> = {};
                (consents || []).forEach((c: any) => { consentMap[c.employee_id] = c; });
                consentLog = femaleEmployees.map((emp: any) => {
                    const consent = consentMap[emp.id];
                    const isExpired = consent?.valid_until && new Date(consent.valid_until) < new Date();
                    const status = !consent ? 'missing' : !consent.consent_given ? 'declined' : isExpired ? 'expired' : 'valid';
                    return {
                        empId: emp.id,
                        empName: emp.name || 'Unknown',
                        empCode: emp.emp_code || '',
                        consentDate: consent?.consent_date || null,
                        validUntil: consent?.valid_until || null,
                        safeguardsDocumented: consent?.safeguards_documented ?? false,
                        status,
                    };
                });
            }

            setData({
                registrations: regsResult.data || [],
                licenses: licensesResult.data || [],
                committees: committeesResult.data || [],
                overdueMedical,
                activeHeadcount,
                totalWomen,
                womenWithConsent,
                companyState: (company as any).state || 'Maharashtra',
                consentLog,
                employees,  // stored for dropdowns in dialogs
            });

            // Phase 2: fetch violations from DB
            await fetchViolations(company.id);

        } catch (e) {
            console.error("Failed to load OSH data:", e);
        } finally {
            setLoading(false);
        }
    };

    const fetchViolations = async (cid: string) => {
        const since = new Date();
        since.setDate(since.getDate() - 28);
        const sinceStr = since.toISOString().split('T')[0];
        const { data } = await supabase
            .from('working_hour_violations')
            .select('id, employee_id, violation_date, violation_type, limit_value, actual_value, issue_description, week_start_date, employees(name, emp_code)')
            .eq('company_id', cid)
            .eq('rule_source', 'OSH')
            .gte('violation_date', sinceStr)
            .order('violation_date', { ascending: false });
        setOshViolations((data as any) || []);
    };

    // Phase 2: Refresh violations via Edge Function
    const handleRefreshViolations = async () => {
        if (!companyId) return;
        setRefreshing(true);
        try {
            const now = new Date();
            const { error } = await supabase.functions.invoke('compute-violations', {
                body: { companyId, month: now.getMonth() + 1, year: now.getFullYear() },
            });
            if (error) throw error;
            await fetchViolations(companyId);
            toast({ title: "Violations refreshed", description: "Compliance check complete." });
        } catch (e: any) {
            toast({ title: "Refresh failed", description: e.message, variant: "destructive" });
        } finally {
            setRefreshing(false);
        }
    };

    // Phase 5: Add Registration
    const handleAddRegistration = async () => {
        if (!companyId) return;
        setAddRegLoading(true);
        try {
            const { error } = await supabase.from('osh_registrations').insert({
                company_id: companyId,
                establishment_type: addRegForm.establishment_type,
                registration_number: addRegForm.registration_number,
                registration_date: addRegForm.registration_date || null,
                valid_until: addRegForm.valid_until || null,
                state: addRegForm.state || null,
            });
            if (error) throw error;
            toast({ title: "Registration added", description: "OSH registration saved." });
            setAddRegOpen(false);
            setAddRegForm({ establishment_type: '', registration_number: '', registration_date: '', valid_until: '', state: '' });
            await loadAll();
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setAddRegLoading(false);
        }
    };

    // Phase 5: Form Committee
    const handleFormCommittee = async () => {
        if (!companyId) return;
        setCommitteeLoading(true);
        try {
            const members = committeeForm.members_text.split('\n').map(s => s.trim()).filter(Boolean);
            const { error } = await supabase.from('safety_committees').insert({
                company_id: companyId,
                members,
                meeting_frequency: committeeForm.meeting_frequency,
                last_meeting_date: committeeForm.last_meeting_date || null,
            });
            if (error) throw error;
            toast({ title: "Committee formed", description: "Safety committee record saved." });
            setCommitteeOpen(false);
            setCommitteeForm({ meeting_frequency: 'Quarterly', last_meeting_date: '', members_text: '', roles_text: '' });
            await loadAll();
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setCommitteeLoading(false);
        }
    };

    // Phase 5: Schedule Medical Checkup
    const handleScheduleMedCheck = async () => {
        if (!medCheckForm.employee_id || !medCheckForm.checkup_date) return;
        setMedCheckLoading(true);
        try {
            const { error } = await supabase.from('medical_checkups').insert({
                employee_id: medCheckForm.employee_id,
                checkup_date: medCheckForm.checkup_date,
                type: medCheckForm.type,
                next_due_date: medCheckForm.next_due_date || null,
                clinic_details: medCheckForm.clinic_details || null,
                findings_summary: medCheckForm.findings_summary || null,
            });
            if (error) throw error;
            toast({ title: "Medical checkup scheduled", description: "Record saved." });
            setMedCheckOpen(false);
            setMedCheckForm({ employee_id: '', checkup_date: '', type: '', next_due_date: '', clinic_details: '', findings_summary: '' });
            await loadAll();
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setMedCheckLoading(false);
        }
    };

    // Phase 3: Record Consent
    const handleRecordConsent = async () => {
        if (!companyId || !consentForm.employee_id) return;
        setConsentLoading(true);
        try {
            const { error } = await supabase.from('night_shift_consents').upsert({
                company_id: companyId,
                employee_id: consentForm.employee_id,
                consent_given: consentForm.consent_given,
                consent_date: consentForm.consent_date || new Date().toISOString().split('T')[0],
                valid_until: consentForm.valid_until || null,
                safeguards_documented: consentForm.safeguards_documented,
                notes: consentForm.notes || null,
            }, { onConflict: 'company_id,employee_id' });
            if (error) throw error;
            toast({ title: "Consent recorded", description: "Night shift consent log updated." });
            setConsentOpen(false);
            setConsentForm({ employee_id: '', consent_given: true, consent_date: '', valid_until: '', safeguards_documented: false, notes: '' });
            await loadAll();
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setConsentLoading(false);
        }
    };

    if (loading) return <PageSkeleton />;
    if (!data) return <div>Failed to load.</div>;

    const femaleEmployees = data.employees?.filter((e: any) => e.gender?.toLowerCase() === 'female') || [];

    return (
        <div className="space-y-6 pb-8">

            {/* ── Header ── */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Occupational Safety & Health (OSH)</h1>
                <p className="mt-1 text-muted-foreground">Monitor establishment registrations, licences, and welfare compliance under the OSH Code, 2020.</p>
            </div>

            {/* ── Stats Row ── */}
            <div className="grid gap-6 md:grid-cols-3">

                {/* Welfare Triggers */}
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

                {/* Women Night Shift */}
                <Card className="md:col-span-1 shadow-sm border-purple-200">
                    <CardHeader className="bg-purple-50/50 rounded-t-xl pb-4">
                        <CardTitle className="text-md flex items-center gap-2 text-purple-900">
                            <ShieldAlert className="h-4 w-4" />
                            Women Night Work Consent
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
                                Warning: {data.totalWomen - data.womenWithConsent} female worker(s) cannot be legally assigned night shifts without consent.
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Action Items — Phase 5: buttons wired */}
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
                                <span>No active establishment registrations found under the OSH Code. Check Section 3 applicability.</span>
                                <Button variant="outline" size="sm" className="w-fit mt-1 bg-white" onClick={() => setAddRegOpen(true)}>
                                    <Plus className="h-3 w-3 mr-1" /> Add Registration
                                </Button>
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
                                <Button variant="outline" size="sm" className="w-fit mt-1 bg-white text-destructive" onClick={() => setCommitteeOpen(true)}>
                                    Form Committee
                                </Button>
                            </div>
                        )}

                        {data.overdueMedical && data.overdueMedical.length > 0 && (
                            <div className="bg-amber-50 p-3 rounded-md border border-amber-200 text-sm text-amber-900 mt-3 flex flex-col gap-2">
                                <span><strong>Overdue Medical Assessments ({data.overdueMedical.length})</strong></span>
                                <span>As per Section 6(1)(c), {data.overdueMedical.length} employees have overdue mandatory medical examinations.</span>
                                <Button variant="outline" size="sm" className="w-fit mt-1 bg-white" onClick={() => setMedCheckOpen(true)}>
                                    Schedule Checks
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ── Registrations List ── */}
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

            {/* ── Phase 2: Working Hours Violations (DB-sourced) ── */}
            <div className="flex items-center justify-between mt-8 mb-4">
                <h3 className="text-lg font-semibold">Working Hours Violations — Last 4 Weeks</h3>
                <div className="flex items-center gap-2">
                    {oshViolations.length > 0 && (
                        <Badge variant="destructive" className="text-xs">
                            {oshViolations.length} violation{oshViolations.length > 1 ? 's' : ''}
                        </Badge>
                    )}
                    <Button variant="outline" size="sm" className="gap-2" onClick={handleRefreshViolations} disabled={refreshing}>
                        <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                        {refreshing ? 'Checking…' : 'Refresh Violations'}
                    </Button>
                </div>
            </div>

            {oshViolations.length === 0 ? (
                <div className="border border-dashed rounded-lg p-10 text-center text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-3 text-emerald-500 opacity-60" />
                    <p className="font-medium text-emerald-700">No OSH working-hour violations detected</p>
                    <p className="text-xs mt-1">Click "Refresh Violations" to run a compliance check against OSH Code 2020 limits for {data.companyState}.</p>
                </div>
            ) : (
                <div className="rounded-md border">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 border-b">
                            <tr>
                                <th className="p-3 font-medium">Employee</th>
                                <th className="p-3 font-medium">Date</th>
                                <th className="p-3 font-medium">Violation</th>
                                <th className="p-3 font-medium">Limit</th>
                                <th className="p-3 font-medium">Actual</th>
                                <th className="p-3 font-medium text-right">Severity</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {oshViolations.map(v => (
                                <tr key={v.id} className="hover:bg-muted/20">
                                    <td className="p-3">
                                        <div className="font-medium">{v.employees?.name || 'Unknown'}</div>
                                        {v.employees?.emp_code && <div className="text-xs text-muted-foreground">{v.employees.emp_code}</div>}
                                    </td>
                                    <td className="p-3 text-muted-foreground">{format(new Date(v.violation_date), 'd MMM yyyy')}</td>
                                    <td className="p-3 text-destructive">{v.issue_description}</td>
                                    <td className="p-3 text-muted-foreground">{v.limit_value}h</td>
                                    <td className="p-3 font-medium text-destructive">{v.actual_value}h</td>
                                    <td className="p-3 text-right">
                                        <Badge variant="destructive" className="text-xs">Critical</Badge>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="p-3 bg-muted/30 border-t text-xs text-muted-foreground flex items-start gap-2">
                        <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
                        <span>
                            Violations computed by server-side Edge Function against OSH Code 2020 limits for <strong>{data.companyState}</strong>.
                            Max daily: 9 hrs · Max weekly: 48 hrs · Quarterly OT cap per state · Section 25–27.
                        </span>
                    </div>
                </div>
            )}

            {/* ── Phase 3: Night Shift Consent Log ── */}
            {data.totalWomen > 0 && (
                <>
                    <div className="flex items-center justify-between mt-8 mb-4">
                        <div>
                            <h3 className="text-lg font-semibold">Women Night Shift Consent Log</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">OSH Code 2020, Chapter X § 43 — individual consent required before assigning women to night shifts</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {data.consentLog.some((c: any) => c.status !== 'valid') && (
                                <Badge variant="destructive" className="text-xs">
                                    {data.consentLog.filter((c: any) => c.status !== 'valid').length} action(s) required
                                </Badge>
                            )}
                            <Button variant="outline" size="sm" className="gap-2" onClick={() => setConsentOpen(true)}>
                                <Plus className="h-3 w-3" /> Record Consent
                            </Button>
                        </div>
                    </div>
                    <div className="rounded-md border">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 border-b">
                                <tr>
                                    <th className="p-3 font-medium">Employee</th>
                                    <th className="p-3 font-medium">Consent Date</th>
                                    <th className="p-3 font-medium">Valid Until</th>
                                    <th className="p-3 font-medium">Safeguards</th>
                                    <th className="p-3 font-medium text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {data.consentLog.map((c: any, i: number) => (
                                    <tr key={i} className={`hover:bg-muted/20 ${c.status !== 'valid' ? 'bg-destructive/5' : ''}`}>
                                        <td className="p-3">
                                            <div className="font-medium">{c.empName}</div>
                                            {c.empCode && <div className="text-xs text-muted-foreground">{c.empCode}</div>}
                                        </td>
                                        <td className="p-3 text-muted-foreground">
                                            {c.consentDate ? format(new Date(c.consentDate), 'd MMM yyyy') : <span className="text-destructive">—</span>}
                                        </td>
                                        <td className="p-3 text-muted-foreground">
                                            {c.validUntil ? format(new Date(c.validUntil), 'd MMM yyyy') : <span className="italic opacity-60">Indefinite</span>}
                                        </td>
                                        <td className="p-3">
                                            {c.safeguardsDocumented
                                                ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                : <AlertCircle className="h-4 w-4 text-amber-500" />}
                                        </td>
                                        <td className="p-3 text-right">
                                            {c.status === 'valid' && <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20">Valid</Badge>}
                                            {c.status === 'missing' && <Badge variant="destructive">Missing</Badge>}
                                            {c.status === 'expired' && <Badge variant="destructive">Expired</Badge>}
                                            {c.status === 'declined' && <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/20">Declined</Badge>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="p-3 bg-purple-50/50 border-t text-xs text-purple-800 flex items-start gap-2">
                            <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0 text-purple-500" />
                            <span>
                                Female workers with <strong>Missing</strong> or <strong>Expired</strong> consent records cannot be legally assigned to night shifts without first obtaining written consent and documenting adequate safeguards.
                            </span>
                        </div>
                    </div>
                </>
            )}

            {/* ── Phase 5: Add OSH Registration Dialog ── */}
            <Dialog open={addRegOpen} onOpenChange={setAddRegOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add OSH Registration</DialogTitle>
                        <DialogDescription>Record an establishment registration under the OSH Code, 2020 (Section 3).</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1">
                            <Label>Establishment Type *</Label>
                            <Select value={addRegForm.establishment_type} onValueChange={v => setAddRegForm(f => ({ ...f, establishment_type: v }))}>
                                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                                <SelectContent>
                                    {['Factory', 'Mine', 'Building & Other Construction', 'Beedi / Cigar', 'Contract Labour', 'Inter-State Migrant', 'Other'].map(t => (
                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label>Registration Number *</Label>
                            <Input placeholder="e.g. MH/FACTORY/2024/001" value={addRegForm.registration_number} onChange={e => setAddRegForm(f => ({ ...f, registration_number: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                            <Label>State</Label>
                            <Select value={addRegForm.state} onValueChange={v => setAddRegForm(f => ({ ...f, state: v }))}>
                                <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                                <SelectContent>
                                    {['Maharashtra', 'Karnataka', 'Delhi', 'Tamil Nadu', 'Telangana', 'Gujarat', 'Rajasthan', 'Uttar Pradesh', 'West Bengal', 'National'].map(s => (
                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Registration Date</Label>
                                <Input type="date" value={addRegForm.registration_date} onChange={e => setAddRegForm(f => ({ ...f, registration_date: e.target.value }))} />
                            </div>
                            <div className="space-y-1">
                                <Label>Valid Until</Label>
                                <Input type="date" value={addRegForm.valid_until} onChange={e => setAddRegForm(f => ({ ...f, valid_until: e.target.value }))} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddRegOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddRegistration} disabled={addRegLoading || !addRegForm.establishment_type || !addRegForm.registration_number}>
                            {addRegLoading ? 'Saving…' : 'Save Registration'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Phase 5: Form Safety Committee Dialog ── */}
            <Dialog open={committeeOpen} onOpenChange={setCommitteeOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Form Safety Committee</DialogTitle>
                        <DialogDescription>Create a Safety Committee as required under OSH Code 2020, Section 22 (for 250+ workers).</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1">
                            <Label>Meeting Frequency</Label>
                            <Select value={committeeForm.meeting_frequency} onValueChange={v => setCommitteeForm(f => ({ ...f, meeting_frequency: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {['Monthly', 'Quarterly', 'Half-Yearly', 'Annually'].map(freq => (
                                        <SelectItem key={freq} value={freq}>{freq}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label>Last Meeting Date</Label>
                            <Input type="date" value={committeeForm.last_meeting_date} onChange={e => setCommitteeForm(f => ({ ...f, last_meeting_date: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                            <Label>Members (one per line)</Label>
                            <Textarea
                                placeholder={"Ravi Kumar (Chairperson)\nPriya Singh (Worker Rep)\nSuresh Reddy (Management Rep)"}
                                rows={4}
                                value={committeeForm.members_text}
                                onChange={e => setCommitteeForm(f => ({ ...f, members_text: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCommitteeOpen(false)}>Cancel</Button>
                        <Button onClick={handleFormCommittee} disabled={committeeLoading}>
                            {committeeLoading ? 'Saving…' : 'Save Committee'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Phase 5: Schedule Medical Check Dialog ── */}
            <Dialog open={medCheckOpen} onOpenChange={setMedCheckOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Schedule Medical Checkup</DialogTitle>
                        <DialogDescription>Record a mandatory medical examination as required under OSH Code Section 6(1)(c).</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1">
                            <Label>Employee *</Label>
                            <Select value={medCheckForm.employee_id} onValueChange={v => setMedCheckForm(f => ({ ...f, employee_id: v }))}>
                                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                                <SelectContent>
                                    {(data.employees || []).map((emp: any) => (
                                        <SelectItem key={emp.id} value={emp.id}>{emp.name} {emp.emp_code ? `(${emp.emp_code})` : ''}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label>Checkup Type *</Label>
                            <Select value={medCheckForm.type} onValueChange={v => setMedCheckForm(f => ({ ...f, type: v }))}>
                                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                                <SelectContent>
                                    {['Pre-Employment', 'Annual', 'Hazardous Process Specific', 'Post-Illness', 'Exit Medical'].map(t => (
                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Checkup Date *</Label>
                                <Input type="date" value={medCheckForm.checkup_date} onChange={e => setMedCheckForm(f => ({ ...f, checkup_date: e.target.value }))} />
                            </div>
                            <div className="space-y-1">
                                <Label>Next Due Date</Label>
                                <Input type="date" value={medCheckForm.next_due_date} onChange={e => setMedCheckForm(f => ({ ...f, next_due_date: e.target.value }))} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label>Clinic / Doctor Details</Label>
                            <Input placeholder="Clinic name, doctor name" value={medCheckForm.clinic_details} onChange={e => setMedCheckForm(f => ({ ...f, clinic_details: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                            <Label>Findings Summary</Label>
                            <Textarea placeholder="Fit for duty / Minor observations / Referred…" rows={2} value={medCheckForm.findings_summary} onChange={e => setMedCheckForm(f => ({ ...f, findings_summary: e.target.value }))} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMedCheckOpen(false)}>Cancel</Button>
                        <Button onClick={handleScheduleMedCheck} disabled={medCheckLoading || !medCheckForm.employee_id || !medCheckForm.checkup_date || !medCheckForm.type}>
                            {medCheckLoading ? 'Saving…' : 'Save Checkup Record'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Phase 3: Record Night Shift Consent Dialog ── */}
            <Dialog open={consentOpen} onOpenChange={setConsentOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Record Night Shift Consent</DialogTitle>
                        <DialogDescription>Record written consent under OSH Code 2020, Chapter X § 43 before assigning a female employee to night shifts.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1">
                            <Label>Female Employee *</Label>
                            <Select value={consentForm.employee_id} onValueChange={v => setConsentForm(f => ({ ...f, employee_id: v }))}>
                                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                                <SelectContent>
                                    {femaleEmployees.map((emp: any) => (
                                        <SelectItem key={emp.id} value={emp.id}>{emp.name} {emp.emp_code ? `(${emp.emp_code})` : ''}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-3">
                            <Checkbox
                                id="consent_given"
                                checked={consentForm.consent_given}
                                onCheckedChange={(checked) => setConsentForm(f => ({ ...f, consent_given: !!checked }))}
                            />
                            <Label htmlFor="consent_given">Employee has given written consent</Label>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Consent Date</Label>
                                <Input type="date" value={consentForm.consent_date} onChange={e => setConsentForm(f => ({ ...f, consent_date: e.target.value }))} />
                            </div>
                            <div className="space-y-1">
                                <Label>Valid Until</Label>
                                <Input type="date" value={consentForm.valid_until} onChange={e => setConsentForm(f => ({ ...f, valid_until: e.target.value }))} />
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Checkbox
                                id="safeguards"
                                checked={consentForm.safeguards_documented}
                                onCheckedChange={(checked) => setConsentForm(f => ({ ...f, safeguards_documented: !!checked }))}
                            />
                            <Label htmlFor="safeguards">Adequate safeguards documented (transport, security, amenities)</Label>
                        </div>
                        <div className="space-y-1">
                            <Label>Notes</Label>
                            <Textarea placeholder="Any additional conditions, references to safeguard documents…" rows={2} value={consentForm.notes} onChange={e => setConsentForm(f => ({ ...f, notes: e.target.value }))} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConsentOpen(false)}>Cancel</Button>
                        <Button onClick={handleRecordConsent} disabled={consentLoading || !consentForm.employee_id}>
                            {consentLoading ? 'Saving…' : 'Record Consent'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
