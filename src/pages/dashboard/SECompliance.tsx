import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, MapPin, Building, Upload, Download, MoreVertical, Plus, Calendar as CalendarIcon, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/PageSkeleton";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function SECompliance() {
    const [loading, setLoading] = useState(true);
    const [registrations, setRegistrations] = useState<any[]>([]);
    const [companyId, setCompanyId] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        fetchRegistrations();
    }, []);

    const fetchRegistrations = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: company } = await supabase
                .from("companies")
                .select("id")
                .eq("user_id", user.id)
                .maybeSingle();

            if (!company) return;
            setCompanyId(company.id);

            const { data: regs, error } = await supabase
                .from("se_registrations")
                .select("*")
                .eq("company_id", company.id)
                .order("state", { ascending: true });

            if (error) throw error;
            setRegistrations(regs || []);

        } catch (e: any) {
            console.error("Failed to load S&E registrations:", e);
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    // ── Gap 7: Real CSV register generation ─────────────────────────────────────
    const handleGenerateRegister = async (state: string, registerName: string) => {
        if (!companyId) {
            toast({ title: "Not ready", description: "Company data not loaded yet.", variant: "destructive" });
            return;
        }

        toast({ title: `${registerName} — generating…`, description: "Fetching employee & payroll data." });

        // Fetch active employees
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
        let csvContent = "";
        let filename = "";

        // ── Form II – Maharashtra Muster Roll (S&E Act 2017, Rule 20) ──
        if (state === 'Maharashtra' && registerName.includes('Form II')) {
            const { data: pd } = await supabase
                .from('payroll_details')
                .select('employee_id, gross_earnings, net_pay')
                .in('employee_id', empIds)
                .order('created_at', { ascending: false })
                .limit(employees.length * 3);
            const wageMap: Record<string, number> = {};
            (pd || []).forEach((p: any) => { if (!wageMap[p.employee_id]) wageMap[p.employee_id] = Number(p.gross_earnings); });

            const rows = [
                ['Sr No', 'Employee Code', 'Name of Employee', 'Designation', 'Date of Employment', 'Department', 'Monthly Wages (₹)', 'Nature of Work'],
                ...employees.map((emp: any, i: number) => [
                    String(i + 1), emp.emp_code || '', emp.name, emp.designation || 'Staff',
                    emp.date_of_joining ? format(new Date(emp.date_of_joining), 'dd/MM/yyyy') : '-',
                    emp.department || 'General',
                    String(wageMap[emp.id] || emp.basic || 0), emp.department || 'General',
                ])
            ];
            csvContent = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
            filename = `Form_II_Muster_Roll_Maharashtra_${format(new Date(), 'MMM_yyyy')}.csv`;

        // ── Form V – Maharashtra Leave Register (S&E Act 2017, Rule 26) ──
        } else if (state === 'Maharashtra' && registerName.includes('Form V')) {
            const { data: leaves } = await supabase
                .from('leave_requests')
                .select('employee_id, leave_type, start_date, end_date, days_count, status')
                .eq('company_id', companyId)
                .eq('status', 'Approved');
            const leaveMap: Record<string, any[]> = {};
            (leaves || []).forEach((l: any) => {
                if (!leaveMap[l.employee_id]) leaveMap[l.employee_id] = [];
                leaveMap[l.employee_id].push(l);
            });

            const rows = [
                ['Sr No', 'Name', 'EL Entitlement', 'EL Taken', 'SL Taken', 'CL Taken', 'EL Balance', 'Maternity Days'],
                ...employees.map((emp: any, i: number) => {
                    const empLeaves = leaveMap[emp.id] || [];
                    const el = empLeaves.filter((l: any) => l.leave_type === 'Earned').reduce((s: number, l: any) => s + Number(l.days_count), 0);
                    const sl = empLeaves.filter((l: any) => l.leave_type === 'Sick').reduce((s: number, l: any) => s + Number(l.days_count), 0);
                    const cl = empLeaves.filter((l: any) => l.leave_type === 'Casual').reduce((s: number, l: any) => s + Number(l.days_count), 0);
                    const mat = empLeaves.filter((l: any) => l.leave_type === 'Maternity').reduce((s: number, l: any) => s + Number(l.days_count), 0);
                    return [String(i + 1), emp.name, '15', String(el), String(sl), String(cl), String(Math.max(0, 15 - el)), String(mat)];
                })
            ];
            csvContent = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
            filename = `Form_V_Leave_Register_Maharashtra_${format(new Date(), 'MMM_yyyy')}.csv`;

        // ── Form T – Karnataka Combined Register (S&E Act 1961, Rule 24) ──
        } else if (state === 'Karnataka' && registerName.includes('Form T')) {
            const { data: pd } = await supabase
                .from('payroll_details')
                .select('employee_id, gross_earnings, net_pay, epf_employee, esic_employee, pt, lwf_employee')
                .in('employee_id', empIds)
                .order('created_at', { ascending: false })
                .limit(employees.length * 3);
            const wageMap: Record<string, any> = {};
            (pd || []).forEach((p: any) => { if (!wageMap[p.employee_id]) wageMap[p.employee_id] = p; });

            const rows = [
                ['Token No', 'Name', 'Designation', 'Date of Joining', 'Gross Wages (₹)', 'EPF EE (₹)', 'ESIC EE (₹)', 'PT (₹)', 'LWF (₹)', 'Net Pay (₹)', 'Signature'],
                ...employees.map((emp: any, i: number) => {
                    const p = wageMap[emp.id] || {};
                    return [
                        emp.emp_code || String(i + 1), emp.name, emp.designation || 'Staff',
                        emp.date_of_joining ? format(new Date(emp.date_of_joining), 'dd/MM/yyyy') : '-',
                        String(Number(p.gross_earnings) || emp.basic || 0),
                        String(Number(p.epf_employee) || 0), String(Number(p.esic_employee) || 0),
                        String(Number(p.pt) || 0), String(Number(p.lwf_employee) || 0),
                        String(Number(p.net_pay) || 0), '',
                    ];
                })
            ];
            csvContent = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
            filename = `Form_T_Combined_Register_Karnataka_${format(new Date(), 'MMM_yyyy')}.csv`;

        // ── Form XIV – Tamil Nadu Register of Wages (TN S&E Act 1947, Rule 22) ──
        } else if (state === 'Tamil Nadu' && registerName.includes('Form XIV')) {
            const { data: pd } = await supabase
                .from('payroll_details')
                .select('employee_id, gross_earnings, net_pay, epf_employee, esic_employee, pt, basic_paid')
                .in('employee_id', empIds)
                .order('created_at', { ascending: false })
                .limit(employees.length * 3);
            const wageMap: Record<string, any> = {};
            (pd || []).forEach((p: any) => { if (!wageMap[p.employee_id]) wageMap[p.employee_id] = p; });

            const rows = [
                ['Sl No', 'Employee Name', 'Father/Husband Name', 'Designation', 'Date of Appointment', 'Basic Pay (₹)', 'Gross Wages (₹)', 'Total Deductions (₹)', 'Net Amount Paid (₹)', 'Date of Payment', 'Signature'],
                ...employees.map((emp: any, i: number) => {
                    const p = wageMap[emp.id] || {};
                    const deds = (Number(p.epf_employee) || 0) + (Number(p.esic_employee) || 0) + (Number(p.pt) || 0);
                    return [
                        String(i + 1), emp.name, '', emp.designation || 'Staff',
                        emp.date_of_joining ? format(new Date(emp.date_of_joining), 'dd/MM/yyyy') : '-',
                        String(Number(p.basic_paid) || emp.basic || 0),
                        String(Number(p.gross_earnings) || emp.basic || 0),
                        String(deds), String(Number(p.net_pay) || 0),
                        format(new Date(), 'dd/MM/yyyy'), '',
                    ];
                })
            ];
            csvContent = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
            filename = `Form_XIV_Register_of_Wages_TamilNadu_${format(new Date(), 'MMM_yyyy')}.csv`;

        // ── Default: generic employment register ──
        } else {
            const rows = [
                ['Sr No', 'Name', 'Emp Code', 'Designation', 'Date of Joining', 'Department', 'Basic (₹)'],
                ...employees.map((emp: any, i: number) => [
                    String(i + 1), emp.name, emp.emp_code || '', emp.designation || '-',
                    emp.date_of_joining ? format(new Date(emp.date_of_joining), 'dd/MM/yyyy') : '-',
                    emp.department || '-', String(emp.basic || 0),
                ])
            ];
            csvContent = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
            filename = `${registerName.replace(/[\s/()]/g, '_')}_${state}_${format(new Date(), 'MMM_yyyy')}.csv`;
        }

        // Trigger browser download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);

        toast({ title: `${registerName} downloaded`, description: `${filename} ready.` });
    };

    if (loading) return <PageSkeleton />;

    const expiringSoon = registrations.filter(r => {
        if (!r.valid_until) return false;
        const daysLeft = (new Date(r.valid_until).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
        return daysLeft > 0 && daysLeft <= 60;
    });

    return (
        <div className="space-y-6 pb-8">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">State Shops & Establishments (S&E)</h1>
                    <p className="mt-1 text-muted-foreground">Manage state-specific registrations, renewals, and statutory registers.</p>
                </div>
                <Button className="gap-2">
                    <Plus className="h-4 w-4" /> Add Registration
                </Button>
            </div>

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
                                <Button variant="outline" size="sm" className="w-fit mt-4 bg-white dark:bg-transparent text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700">Initiate Renewal</Button>
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

            {/* Statutory Registers Section */}
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
                            <Button variant="ghost" size="sm" onClick={() => handleGenerateRegister('Maharashtra', 'Form II (Muster')} className="h-8"><Download className="h-4 w-4" /></Button>
                        </div>
                        <div className="flex items-center justify-between text-sm group">
                            <div className="flex items-center gap-2 text-muted-foreground group-hover:text-foreground">
                                <FileSpreadsheet className="h-4 w-4" />
                                <span>Form V (Leave Register)</span>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => handleGenerateRegister('Maharashtra', 'Form V (Leave')} className="h-8"><Download className="h-4 w-4" /></Button>
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

                {/* Tamil Nadu — Gap 7: Form XIV */}
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

            </div>

        </div>
    );
}
