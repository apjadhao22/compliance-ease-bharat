import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, MapPin, Building, Upload, Download, MoreVertical, Plus, Calendar as CalendarIcon, FileSpreadsheet, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/PageSkeleton";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { generateSERegister, downloadCSV } from "@/lib/reports/seRegisters";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SEViolation {
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

export default function SECompliance() {
    const [loading, setLoading] = useState(true);
    const [registrations, setRegistrations] = useState<any[]>([]);
    const [companyId, setCompanyId] = useState<string | null>(null);
    const [companyState, setCompanyState] = useState<string>('');

    // Phase 2: violations from DB
    const [seViolations, setSeViolations] = useState<SEViolation[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    // Phase 5: Add Registration dialog
    const [addRegOpen, setAddRegOpen] = useState(false);
    const [addRegForm, setAddRegForm] = useState({
        state: '',
        registration_number: '',
        registration_date: '',
        valid_until: '',
        establishment_category: '',
        address: '',
    });
    const [addRegLoading, setAddRegLoading] = useState(false);

    // Phase 5: Initiate Renewal dialog
    const [renewalOpen, setRenewalOpen] = useState(false);
    const [renewalForm, setRenewalForm] = useState({
        registration_id: '',
        new_valid_until: '',
        application_date: '',
        fee_paid: '',
        notes: '',
    });
    const [renewalLoading, setRenewalLoading] = useState(false);

    const { toast } = useToast();

    useEffect(() => {
        fetchData();
    }, []);

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
            setCompanyId(company.id);
            setCompanyState((company as any).state || 'Maharashtra');

            // Registrations
            const { data: regs, error } = await supabase
                .from("se_registrations")
                .select("*")
                .eq("company_id", company.id)
                .order("state", { ascending: true });

            if (error) throw error;
            setRegistrations(regs || []);

            // Phase 2: fetch violations from DB
            await fetchViolations(company.id);

        } catch (e: any) {
            console.error("Failed to load S&E data:", e);
            toast({ title: "Error", description: e.message, variant: "destructive" });
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
            .eq('rule_source', 'SE')
            .gte('violation_date', sinceStr)
            .order('violation_date', { ascending: false });

        setSeViolations((data as any) || []);
    };

    // Phase 2: Refresh violations via Edge Function
    const handleRefreshViolations = async () => {
        if (!companyId) return;
        setRefreshing(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");

            const now = new Date();
            const { error } = await supabase.functions.invoke('compute-violations', {
                body: {
                    companyId,
                    month: now.getMonth() + 1,
                    year: now.getFullYear(),
                },
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

    // Phase 6: Registry-based register generation
    const handleGenerateRegister = async (state: string, formName: string) => {
        if (!companyId) {
            toast({ title: "Not ready", description: "Company data not loaded yet.", variant: "destructive" });
            return;
        }

        toast({ title: `${formName} — generating…`, description: "Fetching employee & payroll data." });

        const { data: employees } = await supabase
            .from('employees')
            .select('id, emp_code, name, designation, date_of_joining, basic, department')
            .eq('company_id', companyId)
            .in('status', ['Active', 'active'])
            .order('emp_code');

        if (!employees || employees.length === 0) {
            toast({ title: "No employees", description: "Add active employees before generating registers.", variant: "destructive" });
            return;
        }

        const empIds = employees.map((e: any) => e.id);

        const { data: pd } = await supabase
            .from('payroll_details')
            .select('employee_id, gross_earnings, net_pay, basic_paid, epf_employee, esic_employee, pt, lwf_employee')
            .in('employee_id', empIds)
            .order('created_at', { ascending: false })
            .limit(employees.length * 3);

        const payrollByEmp: Record<string, any> = {};
        (pd || []).forEach((p: any) => { if (!payrollByEmp[p.employee_id]) payrollByEmp[p.employee_id] = p; });

        const { data: leaves } = await supabase
            .from('leave_requests')
            .select('employee_id, leave_type, days_count')
            .eq('company_id', companyId)
            .eq('status', 'Approved');

        const leavesByEmp: Record<string, any[]> = {};
        (leaves || []).forEach((l: any) => {
            if (!leavesByEmp[l.employee_id]) leavesByEmp[l.employee_id] = [];
            leavesByEmp[l.employee_id].push(l);
        });

        const now = new Date();
        const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        const { csv, filename } = generateSERegister(state, formName, { employees, payrollByEmp, leavesByEmp, month });
        downloadCSV(csv, filename);

        toast({
            title: `${formName} downloaded`,
            description: `${filename} — Fields marked [MANUAL] require employer review before filing.`,
        });
    };

    // Phase 5: Add Registration
    const handleAddRegistration = async () => {
        if (!companyId) return;
        setAddRegLoading(true);
        try {
            const { error } = await supabase
                .from('se_registrations')
                .insert({
                    company_id: companyId,
                    state: addRegForm.state,
                    registration_number: addRegForm.registration_number || null,
                    registration_date: addRegForm.registration_date || null,
                    valid_until: addRegForm.valid_until || null,
                    establishment_category: addRegForm.establishment_category || null,
                    address: addRegForm.address || null,
                });

            if (error) throw error;

            toast({ title: "Registration added", description: `${addRegForm.state} S&E registration saved.` });
            setAddRegOpen(false);
            setAddRegForm({ state: '', registration_number: '', registration_date: '', valid_until: '', establishment_category: '', address: '' });
            await fetchData();
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setAddRegLoading(false);
        }
    };

    // Phase 5: Initiate Renewal
    const handleInitiateRenewal = async () => {
        if (!companyId || !renewalForm.registration_id) return;
        setRenewalLoading(true);
        try {
            const { error } = await supabase
                .from('se_registrations')
                .update({
                    valid_until: renewalForm.new_valid_until || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', renewalForm.registration_id)
                .eq('company_id', companyId);

            if (error) throw error;

            toast({ title: "Renewal initiated", description: "Registration validity updated." });
            setRenewalOpen(false);
            setRenewalForm({ registration_id: '', new_valid_until: '', application_date: '', fee_paid: '', notes: '' });
            await fetchData();
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setRenewalLoading(false);
        }
    };

    if (loading) return <PageSkeleton />;

    const expiringSoon = registrations.filter(r => {
        if (!r.valid_until) return false;
        const daysLeft = (new Date(r.valid_until).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
        return daysLeft > 0 && daysLeft <= 60;
    });

    return (
        <div className="space-y-6 pb-8">

            {/* ── Header ── */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">State Shops & Establishments (S&E)</h1>
                    <p className="mt-1 text-muted-foreground">Manage state-specific registrations, renewals, and statutory registers.</p>
                </div>
                <Button className="gap-2" onClick={() => setAddRegOpen(true)}>
                    <Plus className="h-4 w-4" /> Add Registration
                </Button>
            </div>

            {/* ── Stats ── */}
            <div className="grid gap-6 md:grid-cols-3">
                <Card className="md:col-span-1 shadow-sm border-blue-100 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-900/10">
                    <CardHeader>
                        <CardTitle className="text-md flex items-center justify-between text-blue-700 dark:text-blue-400">
                            Active Registrations
                            <Building className="h-4 w-4 opacity-70" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-900 dark:text-blue-300">{registrations.length}</div>
                        <p className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-1">Across multiple states</p>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-md flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4 text-amber-500" />
                            Renewal Pipeline
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {expiringSoon.length > 0 ? (
                            <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-md border border-amber-200 dark:border-amber-900/50 text-sm flex flex-col justify-between">
                                <div>
                                    <strong className="text-amber-800 dark:text-amber-500">{expiringSoon.length} Registration(s) Expiring Soon</strong>
                                    <ul className="mt-2 space-y-1">
                                        {expiringSoon.map(r => (
                                            <li key={r.id} className="text-xs text-amber-700 dark:text-amber-400 flex justify-between">
                                                <span>{r.state} ({r.registration_number})</span>
                                                <span className="font-semibold">{format(new Date(r.valid_until), 'dd MMM yyyy')}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <Button variant="outline" size="sm" className="w-fit mt-4 bg-white dark:bg-transparent text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700" onClick={() => setRenewalOpen(true)}>Initiate Renewal</Button>
                            </div>
                        ) : (
                            <div className="text-center p-6 text-muted-foreground flex flex-col items-center justify-center h-full">
                                <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2 opacity-50" />
                                <p className="text-sm">All registrations are up to date.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ── Registrations Table ── */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
                    <div>
                        <CardTitle className="text-lg">State Registrations List</CardTitle>
                        <CardDescription>Track Form A/B/C certificates and establishment sizes.</CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {registrations.length === 0 ? (
                        <div className="border-t-0 p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
                            <MapPin className="h-12 w-12 mx-auto mb-4 opacity-10" />
                            <p>No S&E Registrations added yet.</p>
                            <p className="text-xs max-w-sm mt-2 opacity-70">Begin by adding your principal place of business registration certificate details.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-muted/50 border-b">
                                    <tr>
                                        <th className="p-4 font-medium">State</th>
                                        <th className="p-4 font-medium">Registration No.</th>
                                        <th className="p-4 font-medium">Category</th>
                                        <th className="p-4 font-medium">Valid Until</th>
                                        <th className="p-4 font-medium text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {registrations.map((r: any) => (
                                        <tr key={r.id} className="hover:bg-muted/20">
                                            <td className="p-4 font-medium flex items-center gap-2">
                                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                                {r.state}
                                            </td>
                                            <td className="p-4 font-mono text-xs">{r.registration_number || 'Pending'}</td>
                                            <td className="p-4">{r.establishment_category || '-'}</td>
                                            <td className="p-4">
                                                {r.valid_until ? (
                                                    <Badge variant={new Date(r.valid_until) < new Date() ? 'destructive' : 'outline'}>
                                                        {format(new Date(r.valid_until), 'MMM yyyy')}
                                                    </Badge>
                                                ) : 'Lifetime'}
                                            </td>
                                            <td className="p-4 text-right">
                                                <Button variant="ghost" size="icon" className="h-8 w-8"><Upload className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ── Statutory Registers (Phase 6: registry pattern) ── */}
            <h2 className="text-lg font-semibold tracking-tight mt-10 mb-4">Statutory Registers (State Rules)</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">

                {/* Maharashtra */}
                <Card className="border shadow-sm">
                    <CardHeader className="pb-3 border-b bg-muted/20">
                        <CardTitle className="text-base flex items-center justify-between">
                            Maharashtra
                            <Badge variant="secondary" className="font-normal text-[10px]">S&E Act 2017</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3">
                        <div className="flex items-center justify-between text-sm group">
                            <div className="flex items-center gap-2 text-muted-foreground group-hover:text-foreground">
                                <FileSpreadsheet className="h-4 w-4" />
                                <span>Form II (Muster Roll)</span>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => handleGenerateRegister('Maharashtra', 'Form II')} className="h-8"><Download className="h-4 w-4" /></Button>
                        </div>
                        <div className="flex items-center justify-between text-sm group">
                            <div className="flex items-center gap-2 text-muted-foreground group-hover:text-foreground">
                                <FileSpreadsheet className="h-4 w-4" />
                                <span>Form V (Leave Register)</span>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => handleGenerateRegister('Maharashtra', 'Form V')} className="h-8"><Download className="h-4 w-4" /></Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Karnataka */}
                <Card className="border shadow-sm">
                    <CardHeader className="pb-3 border-b bg-muted/20">
                        <CardTitle className="text-base flex items-center justify-between">
                            Karnataka
                            <Badge variant="secondary" className="font-normal text-[10px]">S&E Act 1961</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3">
                        <div className="flex items-center justify-between text-sm group">
                            <div className="flex items-center gap-2 text-muted-foreground group-hover:text-foreground">
                                <FileSpreadsheet className="h-4 w-4" />
                                <span>Form T (Combined Register)</span>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => handleGenerateRegister('Karnataka', 'Form T')} className="h-8"><Download className="h-4 w-4" /></Button>
                        </div>
                        <div className="flex items-center justify-between text-sm group">
                            <div className="flex items-center gap-2 text-muted-foreground group-hover:text-foreground">
                                <FileText className="h-4 w-4" />
                                <span>Form U (Annual Return)</span>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => handleGenerateRegister('Karnataka', 'Form U')} className="h-8"><Download className="h-4 w-4" /></Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Delhi */}
                <Card className="border shadow-sm">
                    <CardHeader className="pb-3 border-b bg-muted/20">
                        <CardTitle className="text-base flex items-center justify-between">
                            Delhi
                            <Badge variant="secondary" className="font-normal text-[10px]">S&E Act 1954</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3">
                        <div className="flex items-center justify-between text-sm group">
                            <div className="flex items-center gap-2 text-muted-foreground group-hover:text-foreground">
                                <FileSpreadsheet className="h-4 w-4" />
                                <span>Form G (Register of Employment)</span>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => handleGenerateRegister('Delhi', 'Form G')} className="h-8"><Download className="h-4 w-4" /></Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Tamil Nadu */}
                <Card className="border shadow-sm">
                    <CardHeader className="pb-3 border-b bg-muted/20">
                        <CardTitle className="text-base flex items-center justify-between">
                            Tamil Nadu
                            <Badge variant="secondary" className="font-normal text-[10px]">S&E Act 1947</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3">
                        <div className="flex items-center justify-between text-sm group">
                            <div className="flex items-center gap-2 text-muted-foreground group-hover:text-foreground">
                                <FileSpreadsheet className="h-4 w-4" />
                                <span>Form XIV (Register of Wages)</span>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => handleGenerateRegister('Tamil Nadu', 'Form XIV')} className="h-8"><Download className="h-4 w-4" /></Button>
                        </div>
                        <div className="flex items-center justify-between text-sm group">
                            <div className="flex items-center gap-2 text-muted-foreground group-hover:text-foreground">
                                <FileText className="h-4 w-4" />
                                <span>Form S (Annual Return)</span>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => handleGenerateRegister('Tamil Nadu', 'Form S')} className="h-8"><Download className="h-4 w-4" /></Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Telangana — Phase 4e: New */}
                <Card className="border shadow-sm">
                    <CardHeader className="pb-3 border-b bg-muted/20">
                        <CardTitle className="text-base flex items-center justify-between">
                            Telangana
                            <Badge variant="secondary" className="font-normal text-[10px]">S&E Act 1988</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3">
                        <div className="flex items-center justify-between text-sm group">
                            <div className="flex items-center gap-2 text-muted-foreground group-hover:text-foreground">
                                <FileSpreadsheet className="h-4 w-4" />
                                <span>Form A (Combined Register)</span>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => handleGenerateRegister('Telangana', 'Form A')} className="h-8"><Download className="h-4 w-4" /></Button>
                        </div>
                    </CardContent>
                </Card>

            </div>

            {/* ── Phase 2: S&E Working Hours Violations (from DB) ── */}
            <div className="flex items-center justify-between mt-8 mb-4">
                <h2 className="text-lg font-semibold tracking-tight">S&amp;E Working Hours Violations — Last 4 Weeks</h2>
                <div className="flex items-center gap-2">
                    {seViolations.length > 0 && (
                        <Badge variant="destructive" className="text-xs">
                            {seViolations.length} violation{seViolations.length > 1 ? 's' : ''}
                        </Badge>
                    )}
                    <Button variant="outline" size="sm" className="gap-2" onClick={handleRefreshViolations} disabled={refreshing}>
                        <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                        {refreshing ? 'Checking…' : 'Refresh Violations'}
                    </Button>
                </div>
            </div>

            {seViolations.length === 0 ? (
                <div className="border border-dashed rounded-lg p-10 text-center text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-3 text-emerald-500 opacity-60" />
                    <p className="font-medium text-emerald-700">No S&amp;E working-hour violations detected</p>
                    <p className="text-xs mt-1">
                        Click "Refresh Violations" to run a compliance check against{' '}
                        {companyState ? <strong>{companyState}</strong> : 'state'} S&amp;E Act limits.
                    </p>
                </div>
            ) : (
                <div className="rounded-md border">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 border-b">
                            <tr>
                                <th className="p-3 font-medium">Employee</th>
                                <th className="p-3 font-medium">Date</th>
                                <th className="p-3 font-medium">Violation Type</th>
                                <th className="p-3 font-medium">Limit</th>
                                <th className="p-3 font-medium">Actual</th>
                                <th className="p-3 font-medium text-right">Severity</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {seViolations.map(v => (
                                <tr key={v.id} className="hover:bg-muted/20">
                                    <td className="p-3">
                                        <div className="font-medium">{v.employees?.name || 'Unknown'}</div>
                                        {v.employees?.emp_code && <div className="text-xs text-muted-foreground">{v.employees.emp_code}</div>}
                                    </td>
                                    <td className="p-3 text-muted-foreground">
                                        {format(new Date(v.violation_date), 'd MMM yyyy')}
                                    </td>
                                    <td className="p-3">
                                        <span className="text-destructive">{v.issue_description}</span>
                                    </td>
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
                            Violations detected against <strong>{companyState}</strong> Shops &amp; Establishments Act rules.
                            Review shift scheduling and overtime to ensure S&amp;E compliance.
                        </span>
                    </div>
                </div>
            )}

            {/* ── Phase 5: Add Registration Dialog ── */}
            <Dialog open={addRegOpen} onOpenChange={setAddRegOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add S&E Registration</DialogTitle>
                        <DialogDescription>Record a new Shops &amp; Establishments registration certificate.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1">
                            <Label>State *</Label>
                            <Select value={addRegForm.state} onValueChange={v => setAddRegForm(f => ({ ...f, state: v }))}>
                                <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                                <SelectContent>
                                    {['Maharashtra', 'Karnataka', 'Delhi', 'Tamil Nadu', 'Telangana', 'Gujarat', 'Rajasthan', 'Uttar Pradesh', 'West Bengal', 'Other'].map(s => (
                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label>Registration Number</Label>
                            <Input placeholder="e.g. MH/2024/12345" value={addRegForm.registration_number} onChange={e => setAddRegForm(f => ({ ...f, registration_number: e.target.value }))} />
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
                        <div className="space-y-1">
                            <Label>Category</Label>
                            <Select value={addRegForm.establishment_category} onValueChange={v => setAddRegForm(f => ({ ...f, establishment_category: v }))}>
                                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                                <SelectContent>
                                    {['Shop', 'Commercial Establishment', 'IT/ITES', 'Restaurant', 'Theatre / Cinema', 'Hotel', 'Other'].map(c => (
                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label>Address</Label>
                            <Input placeholder="Registered address" value={addRegForm.address} onChange={e => setAddRegForm(f => ({ ...f, address: e.target.value }))} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddRegOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddRegistration} disabled={addRegLoading || !addRegForm.state}>
                            {addRegLoading ? 'Saving…' : 'Save Registration'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Phase 5: Initiate Renewal Dialog ── */}
            <Dialog open={renewalOpen} onOpenChange={setRenewalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Initiate Renewal</DialogTitle>
                        <DialogDescription>Update the validity of an expiring S&E registration.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1">
                            <Label>Registration *</Label>
                            <Select value={renewalForm.registration_id} onValueChange={v => setRenewalForm(f => ({ ...f, registration_id: v }))}>
                                <SelectTrigger><SelectValue placeholder="Select registration" /></SelectTrigger>
                                <SelectContent>
                                    {registrations.map(r => (
                                        <SelectItem key={r.id} value={r.id}>
                                            {r.state} — {r.registration_number || 'No number'} {r.valid_until ? `(expires ${format(new Date(r.valid_until), 'MMM yyyy')})` : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Application Date</Label>
                                <Input type="date" value={renewalForm.application_date} onChange={e => setRenewalForm(f => ({ ...f, application_date: e.target.value }))} />
                            </div>
                            <div className="space-y-1">
                                <Label>New Valid Until *</Label>
                                <Input type="date" value={renewalForm.new_valid_until} onChange={e => setRenewalForm(f => ({ ...f, new_valid_until: e.target.value }))} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label>Fee Paid (₹)</Label>
                            <Input type="number" placeholder="0" value={renewalForm.fee_paid} onChange={e => setRenewalForm(f => ({ ...f, fee_paid: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                            <Label>Notes</Label>
                            <Input placeholder="Reference number, remarks…" value={renewalForm.notes} onChange={e => setRenewalForm(f => ({ ...f, notes: e.target.value }))} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRenewalOpen(false)}>Cancel</Button>
                        <Button onClick={handleInitiateRenewal} disabled={renewalLoading || !renewalForm.registration_id || !renewalForm.new_valid_until}>
                            {renewalLoading ? 'Saving…' : 'Confirm Renewal'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
