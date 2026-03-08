import { useState, useEffect, useMemo } from "react";
import { PageSkeleton } from "@/components/PageSkeleton";
import { format, differenceInBusinessDays } from "date-fns";
import {
    Calculator, FileText, CheckCircle, Clock, Plus, Search,
    Trash2, Loader2, IndianRupee, HandCoins, MinusCircle, AlertCircle
} from "lucide-react";
import {
    Card, CardContent, CardDescription, CardHeader, CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getSafeErrorMessage } from "@/lib/safe-error";
import EmployeeCombobox from "@/components/EmployeeCombobox";

// Data Types
type FnFStatus = 'Initiated' | 'Processing' | 'Settled' | 'On Hold';

interface FnFSettlement {
    id: string;
    company_id: string;
    employee_id: string;
    resignation_date: string;
    last_working_day: string;
    years_of_service: number;
    leave_encashment: number;
    gratuity_amount: number;
    salary_arrears: number;
    bonus: number;
    notice_period_recovery: number;
    loans_advances: number;
    other_deductions: number;
    net_payable: number;
    status: FnFStatus;
    notes?: string;
    ir_event_id?: string;
    created_at: string;
    employees?: { name: string; basic: number };
}

interface Employee {
    id: string;
    name: string;
    basic: number;
    employment_type?: string;
}

interface AllocatedAsset {
    id: string;
    asset_code: string;
    name: string;
    category: string;
}

const GRATUITY_MAX_LIMIT = 2000000; // ₹20 Lakhs max limit

const FnFSettlement = () => {
    const { toast } = useToast();
    const [companyId, setCompanyId] = useState<string | null>(null);
    const [complianceRegime, setComplianceRegime] = useState<'legacy_acts' | 'labour_codes'>('legacy_acts');
    const [settlements, setSettlements] = useState<FnFSettlement[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // F&F Form State
    const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
    const [resignationDate, setResignationDate] = useState("");
    const [lwd, setLwd] = useState("");
    const [yearsOfService, setYearsOfService] = useState<number | "">("");
    const [unavailedLeaves, setUnavailedLeaves] = useState<number | "">("");

    // Earnings
    const [leaveEncash, setLeaveEncash] = useState<number>(0);
    const [gratuity, setGratuity] = useState<number>(0);
    const [arrears, setArrears] = useState<number | "">("");
    const [bonus, setBonus] = useState<number | "">("");

    // Deductions
    const [noticeRecovery, setNoticeRecovery] = useState<number | "">("");
    const [loans, setLoans] = useState<number | "">("");
    const [otherDeds, setOtherDeds] = useState<number | "">("");

    const [notes, setNotes] = useState("");

    // Auto-fetched data
    const [allocatedAssets, setAllocatedAssets] = useState<AllocatedAsset[]>([]);
    const [autoFillInfo, setAutoFillInfo] = useState<string[]>([]);
    const [irEvents, setIrEvents] = useState<any[]>([]);
    const [selectedIrEvent, setSelectedIrEvent] = useState<string | "none">("none");

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
                .select("id, compliance_regime")
                .eq("user_id", user.id)
                .maybeSingle();

            if (company) {
                setCompanyId(company.id);
                setComplianceRegime((company as any).compliance_regime || "legacy_acts");

                const { data: fnfs, error: fnfError } = await supabase
                    .from("fnf_settlements")
                    .select("*, employees(name, basic)")
                    .eq("company_id", company.id)
                    .order("created_at", { ascending: false })
                    .limit(100);

                if (fnfError) {
                    console.error(fnfError);
                    toast({ title: "Warning", description: "Failed to load F&F data.", variant: "destructive" });
                } else if (fnfs) {
                    setSettlements(fnfs as any[]);
                }

                // Fetch open IR Events for linking
                const { data: events } = await supabase
                    .from("ir_events")
                    .select("id, event_type, event_date")
                    .eq("company_id", company.id)
                    .order("event_date", { ascending: false })
                    .limit(10);

                if (events) {
                    setIrEvents(events);
                }
            }
        } catch (e: any) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Auto-fetch assets, bonus, gratuity, and leave balance when employee is selected
    const handleSelectEmployee = async (emp: Employee) => {
        setSelectedEmp(emp);
        setAllocatedAssets([]);
        setAutoFillInfo([]);

        if (!companyId) return;
        const info: string[] = [];

        // 1. Fetch allocated assets
        const { data: assetData } = await supabase
            .from("assets")
            .select("id, asset_code, name, category")
            .eq("company_id", companyId)
            .eq("assigned_to", emp.id)
            .eq("status", "Allocated");
        if (assetData && assetData.length > 0) {
            setAllocatedAssets(assetData as AllocatedAsset[]);
            info.push(`${assetData.length} asset(s) to recover`);
        }

        // 2. Auto-fill bonus from bonus_calculations
        const { data: bonusData } = await supabase
            .from("bonus_calculations")
            .select("bonus_amount")
            .eq("company_id", companyId)
            .eq("employee_id", emp.id)
            .order("financial_year", { ascending: false })
            .limit(1)
            .maybeSingle();
        if (bonusData && Number(bonusData.bonus_amount) > 0) {
            setBonus(Number(bonusData.bonus_amount));
            info.push(`Bonus auto-filled: ₹${Number(bonusData.bonus_amount).toLocaleString("en-IN")}`);
        }

        // 3. Auto-fill gratuity from gratuity_calculations
        const { data: gratData } = await supabase
            .from("gratuity_calculations")
            .select("gratuity_amount, years_of_service")
            .eq("company_id", companyId)
            .eq("employee_id", emp.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        if (gratData && Number(gratData.gratuity_amount) > 0) {
            setGratuity(Math.round(Number(gratData.gratuity_amount)));
            setYearsOfService(Number(gratData.years_of_service) || "");
            info.push(`Gratuity auto-filled: ₹${Number(gratData.gratuity_amount).toLocaleString("en-IN")}`);
        }

        // 4. Compute leave balance (earned leaves approved)
        const { data: leaveData } = await supabase
            .from("leave_requests")
            .select("days_count, leave_type")
            .eq("company_id", companyId)
            .eq("employee_id", emp.id)
            .eq("status", "Approved");
        if (leaveData) {
            const earnedUsed = leaveData.filter(l => l.leave_type === "Earned").reduce((s, l) => s + Number(l.days_count), 0);
            const annualELEntitlement = 15; // standard EL entitlement per year
            const remaining = Math.max(0, annualELEntitlement - earnedUsed);
            if (remaining > 0) {
                setUnavailedLeaves(remaining);
                info.push(`EL balance: ${remaining} days (${annualELEntitlement} entitled - ${earnedUsed} used)`);
            }
        }

        setAutoFillInfo(info);
    };

    // Automated Calculations based on Basic Salary
    const handleCalculate = async () => {
        if (!selectedEmp) return;

        try {
            const { data, error } = await supabase.functions.invoke('calculate-fnf', {
                body: {
                    basicSalary: selectedEmp.basic || 0,
                    unavailedLeaves,
                    yearsOfService,
                    arrears,
                    bonus,
                    noticeRecovery,
                    loans,
                    otherDeds,
                    regime: complianceRegime,
                    employmentType: selectedEmp.employment_type
                }
            });

            if (error) throw error;

            setLeaveEncash(data.leave_encashment);
            setGratuity(data.gratuity_amount);

        } catch (error: any) {
            toast({
                title: "Calculation failed",
                description: getSafeErrorMessage(error),
                variant: "destructive"
            });
        }
    };

    const calculateNetPayable = () => {
        const totalEarnings =
            leaveEncash +
            gratuity +
            (Number(arrears) || 0) +
            (Number(bonus) || 0);

        const totalDeductions =
            (Number(noticeRecovery) || 0) +
            (Number(loans) || 0) +
            (Number(otherDeds) || 0);

        return totalEarnings - totalDeductions;
    };

    const netPayable = calculateNetPayable();

    const handleAddFnF = async () => {
        if (!companyId || !selectedEmp) return;

        if (!resignationDate || !lwd) {
            toast({
                title: "Missing Information",
                description: "Please specify the Resignation Date and Last Working Day.",
                variant: "destructive"
            });
            return;
        }

        setIsSubmitting(true);

        try {
            const { data, error } = await supabase
                .from("fnf_settlements")
                .insert({
                    company_id: companyId,
                    employee_id: selectedEmp.id,
                    resignation_date: resignationDate,
                    last_working_day: lwd,
                    years_of_service: Number(yearsOfService) || 0,
                    leave_encashment: leaveEncash,
                    gratuity_amount: gratuity,
                    salary_arrears: Number(arrears) || 0,
                    bonus: Number(bonus) || 0,
                    notice_period_recovery: Number(noticeRecovery) || 0,
                    loans_advances: Number(loans) || 0,
                    other_deductions: Number(otherDeds) || 0,
                    net_payable: netPayable,
                    status: "Initiated",
                    notes: notes,
                    ir_event_id: selectedIrEvent === "none" ? null : selectedIrEvent
                })
                .select("*, employees(name, basic)")
                .single();

            if (error) throw error;

            setSettlements([data as any, ...settlements]);
            setIsSubmitDialogOpen(false);

            // Reset Form State
            setSelectedEmp(null);
            setResignationDate("");
            setLwd("");
            setYearsOfService("");
            setUnavailedLeaves("");
            setLeaveEncash(0);
            setGratuity(0);
            setArrears("");
            setBonus("");
            setNoticeRecovery("");
            setLoans("");
            setOtherDeds("");
            setNotes("");
            setSelectedIrEvent("none");

            toast({
                title: "F&F Initiated",
                description: `Full & Final Settlement for ${data.employees.name} has been initiated.`
            });
        } catch (error: any) {
            toast({
                title: "Submission failed",
                description: getSafeErrorMessage(error),
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateStatus = async (id: string, newStatus: FnFStatus) => {
        try {
            const { error } = await supabase
                .from("fnf_settlements")
                .update({ status: newStatus })
                .eq("id", id);

            if (error) throw error;

            setSettlements(settlements.map(s => s.id === id ? { ...s, status: newStatus } : s));

            toast({
                title: "Status Updated",
                description: `Settlement marked as ${newStatus}.`
            });
        } catch (error: any) {
            toast({
                title: "Status update failed",
                description: getSafeErrorMessage(error),
                variant: "destructive"
            });
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Are you sure you want to delete the F&F record for ${name}?`)) return;

        try {
            const { error } = await supabase.from("fnf_settlements").delete().eq("id", id);
            if (error) throw error;

            setSettlements(settlements.filter(s => s.id !== id));
            toast({
                title: "Record Deleted",
                description: "The F&F settlement record has been deleted."
            });
        } catch (error: any) {
            toast({
                title: "Deletion failed",
                description: getSafeErrorMessage(error),
                variant: "destructive"
            });
        }
    };

    const getStatusBadge = (status: FnFStatus) => {
        switch (status) {
            case "Initiated": return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Initiated</Badge>;
            case "Processing": return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 mr-1" /> Processing</Badge>;
            case "Settled": return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" /> Settled</Badge>;
            case "On Hold": return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><AlertCircle className="w-3 h-3 mr-1" /> On Hold</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    const filteredSettlements = settlements.filter(s => {
        const term = searchTerm.toLowerCase();
        const empName = s.employees && !Array.isArray(s.employees) ? s.employees.name : "";
        return (empName && empName.toLowerCase().includes(term));
    });

    const stats = {
        totalActive: settlements.filter(s => s.status !== "Settled").length,
        settledCount: settlements.filter(s => s.status === "Settled").length,
        totalPayable: settlements.filter(s => s.status !== "Settled").reduce((sum, s) => sum + Number(s.net_payable), 0),
        totalDisbursed: settlements.filter(s => s.status === "Settled").reduce((sum, s) => sum + Number(s.net_payable), 0),
    };

    if (loading) {
        return <PageSkeleton />;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Full & Final Settlement</h1>
                    <p className="text-muted-foreground mt-1">Manage employee exits, calculate gratuity, and process final payouts.</p>
                </div>

                <Dialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> Initiate F&F
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Initiate Full & Final Settlement</DialogTitle>
                            <DialogDescription>
                                Calculate gratuity and leave encashment to process the employee's final exit.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-6 py-4">

                            {/* Context Block */}
                            <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg border">
                                <div className="col-span-2 grid gap-2">
                                    <Label htmlFor="employee">Select Exiting Employee <span className="text-red-500">*</span></Label>
                                    <EmployeeCombobox
                                        companyId={companyId}
                                        value={selectedEmp?.id || ""}
                                        onSelect={async (id) => {
                                            const { data } = await supabase.from('employees').select('id, name, basic, employment_type, emp_code').eq('id', id).single();
                                            if (data) handleSelectEmployee(data);
                                        }}
                                        placeholder="Search employee by name or code..."
                                        className="w-full mt-1"
                                    />
                                    {selectedEmp && (
                                        <p className="text-xs text-muted-foreground">Basic Salary registered: ₹{selectedEmp.basic.toLocaleString('en-IN')} (used for Gratuity & Leave formulae)</p>
                                    )}
                                    {autoFillInfo.length > 0 && (
                                        <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-2 text-xs text-blue-700 dark:text-blue-300 space-y-0.5">
                                            <p className="font-semibold">Auto-filled from database:</p>
                                            {autoFillInfo.map((info, i) => <p key={i}>• {info}</p>)}
                                        </div>
                                    )}
                                    {allocatedAssets.length > 0 && (
                                        <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2 text-xs text-amber-700 dark:text-amber-300">
                                            <p className="font-semibold flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Assets to recover before settlement:</p>
                                            {allocatedAssets.map(a => (
                                                <p key={a.id}>• {a.asset_code} — {a.name} ({a.category})</p>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="resignationDate">Resignation Date <span className="text-red-500">*</span></Label>
                                    <Input
                                        id="resignationDate"
                                        type="date"
                                        value={resignationDate}
                                        onChange={(e) => setResignationDate(e.target.value)}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="lwd">Last Working Day <span className="text-red-500">*</span></Label>
                                    <Input
                                        id="lwd"
                                        type="date"
                                        value={lwd}
                                        onChange={(e) => setLwd(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Automation Block */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="years">Years of Service</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            id="years"
                                            type="number"
                                            step="0.1"
                                            placeholder="e.g. 5.5"
                                            value={yearsOfService}
                                            onChange={(e) => setYearsOfService(e.target.value === "" ? "" : parseFloat(e.target.value))}
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">Gratuity requires ≥ 5 years of continuous service.</p>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="leaves">Unavailed Leaves (EL/PL)</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            id="leaves"
                                            type="number"
                                            placeholder="e.g. 12"
                                            value={unavailedLeaves}
                                            onChange={(e) => setUnavailedLeaves(e.target.value === "" ? "" : parseFloat(e.target.value))}
                                        />
                                        <Button variant="secondary" onClick={handleCalculate} disabled={!selectedEmp}>Calculate</Button>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">For Leave Encashment computation.</p>
                                </div>
                            </div>

                            {/* Financials Block */}
                            <div className="grid grid-cols-2 gap-6">

                                {/* Earnings */}
                                <div className="space-y-4">
                                    <h4 className="font-semibold text-sm flex items-center text-green-700">
                                        <HandCoins className="w-4 h-4 mr-1" /> Earnings (Payables)
                                    </h4>
                                    <div className="grid grid-cols-2 items-center gap-2">
                                        <Label className="text-xs">Leave Encashment (₹)</Label>
                                        <Input
                                            type="number"
                                            value={leaveEncash}
                                            onChange={(e) => setLeaveEncash(Number(e.target.value))}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 items-center gap-2">
                                        <Label className="text-xs">
                                            Gratuity Amount (₹)
                                            <p className="text-[10px] text-muted-foreground mt-0.5 font-normal leading-tight">
                                                Code on Social Security, Ch V: Pro-rata for Fixed Term {">"} 1 yr. Max ₹20L.
                                            </p>
                                        </Label>
                                        <Input
                                            type="number"
                                            value={gratuity}
                                            onChange={(e) => setGratuity(Number(e.target.value))}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 items-center gap-2">
                                        <Label className="text-xs">Salary Arrears (₹)</Label>
                                        <Input
                                            type="number"
                                            placeholder="0"
                                            value={arrears}
                                            onChange={(e) => setArrears(e.target.value === "" ? "" : Number(e.target.value))}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 items-center gap-2">
                                        <Label className="text-xs">Bonus / Incentives (₹)</Label>
                                        <Input
                                            type="number"
                                            placeholder="0"
                                            value={bonus}
                                            onChange={(e) => setBonus(e.target.value === "" ? "" : Number(e.target.value))}
                                        />
                                    </div>
                                </div>

                                {/* Deductions */}
                                <div className="space-y-4">
                                    <h4 className="font-semibold text-sm flex items-center text-red-700">
                                        <MinusCircle className="w-4 h-4 mr-1" /> Deductions (Recoveries)
                                    </h4>
                                    <div className="grid grid-cols-2 items-center gap-2">
                                        <Label className="text-xs">Notice Period Recovery (₹)</Label>
                                        <Input
                                            type="number"
                                            placeholder="0"
                                            value={noticeRecovery}
                                            onChange={(e) => setNoticeRecovery(e.target.value === "" ? "" : Number(e.target.value))}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 items-center gap-2">
                                        <Label className="text-xs">Loans / Advances (₹)</Label>
                                        <Input
                                            type="number"
                                            placeholder="0"
                                            value={loans}
                                            onChange={(e) => setLoans(e.target.value === "" ? "" : Number(e.target.value))}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 items-center gap-2">
                                        <Label className="text-xs">Other (TDS, PF, Asset) (₹)</Label>
                                        <Input
                                            type="number"
                                            placeholder="0"
                                            value={otherDeds}
                                            onChange={(e) => setOtherDeds(e.target.value === "" ? "" : Number(e.target.value))}
                                        />
                                    </div>
                                </div>

                            </div>

                            {/* Total Block */}
                            <div className="mt-2 bg-slate-900 text-slate-50 p-4 rounded-lg flex justify-between items-center">
                                <span className="font-semibold text-sm">Net F&F Payable</span>
                                <span className="text-xl font-bold tracking-tight">₹{netPayable.toLocaleString('en-IN')}</span>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="notes" className="text-sm">Admin Notes</Label>
                                <Textarea
                                    id="notes"
                                    placeholder="e.g. Asset laptop delayed return. Deducted ₹5000."
                                    className="resize-none"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                />
                            </div>

                            {complianceRegime === 'labour_codes' && (
                                <div className="grid gap-2 border-t pt-4 mt-2">
                                    <Label htmlFor="irLink" className="text-sm">Link to IR Event (Optional)</Label>
                                    <Select value={selectedIrEvent} onValueChange={(val) => setSelectedIrEvent(val)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Layoff/Retrenchment/Closure Event" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">None — Normal Separation</SelectItem>
                                            {irEvents.map(ev => (
                                                <SelectItem key={ev.id} value={ev.id}>
                                                    {format(new Date(ev.event_date), "MMM dd, yyyy")} - {ev.event_type.toUpperCase()}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-muted-foreground">Required under Chapter IX of IR Code if this exit is part of a mass retrenchment or closure.</p>
                                </div>
                            )}

                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsSubmitDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                            <Button type="submit" onClick={handleAddFnF} disabled={isSubmitting || !selectedEmp}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Settlement
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Pending F&F Count</CardTitle>
                        <Clock className="h-4 w-4 text-yellow-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-700">{stats.totalActive}</div>
                        <p className="text-xs text-muted-foreground mt-1">Exits processing or initiated</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Net Payable Pipeline</CardTitle>
                        <Calculator className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-700">₹{stats.totalPayable.toLocaleString('en-IN')}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Fully Settled Count</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-700">{stats.settledCount}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Total Amount Disbursed</CardTitle>
                        <IndianRupee className="h-4 w-4 text-slate-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-700">₹{stats.totalDisbursed.toLocaleString('en-IN')}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="px-6 py-4 border-b">
                    <div className="flex justify-between items-center sm:flex-row flex-col gap-4">
                        <CardTitle className="text-lg">Settlement Records</CardTitle>
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search by employee name..."
                                className="pl-9 bg-background w-full"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Employee</TableHead>
                                <TableHead>Last Working Day</TableHead>
                                <TableHead className="text-right">Earnings</TableHead>
                                <TableHead className="text-right">Deductions</TableHead>
                                <TableHead className="text-right">Net Payable</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredSettlements.length > 0 ? (
                                filteredSettlements.map((s) => {
                                    const empName = s.employees && !Array.isArray(s.employees) ? s.employees.name : "Unknown";
                                    const earnings = Number(s.leave_encashment) + Number(s.gratuity_amount) + Number(s.salary_arrears) + Number(s.bonus);
                                    const deductions = Number(s.notice_period_recovery) + Number(s.loans_advances) + Number(s.other_deductions);

                                    // 48-Hour SLA Breach Check for Labour Codes
                                    let isSlaBreached = false;
                                    if (complianceRegime === "labour_codes" && (s.status === "Initiated" || s.status === "Processing")) {
                                        const daysSinceLwd = differenceInBusinessDays(new Date(), new Date(s.last_working_day));
                                        if (daysSinceLwd > 2) isSlaBreached = true;
                                    }

                                    return (
                                        <TableRow key={s.id} className="hover:bg-muted/30">
                                            <TableCell className="font-medium">
                                                {empName}
                                                {isSlaBreached && (
                                                    <span className="ml-2 inline-flex items-center rounded-md bg-red-50 dark:bg-red-950/50 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900">
                                                        <AlertCircle className="w-3 h-3 mr-1" />
                                                        SLA Breach (48h)
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {format(new Date(s.last_working_day), "dd MMM yyyy")}
                                            </TableCell>
                                            <TableCell className="text-right text-sm text-green-700">
                                                +₹{earnings.toLocaleString('en-IN')}
                                            </TableCell>
                                            <TableCell className="text-right text-sm text-red-700">
                                                -₹{deductions.toLocaleString('en-IN')}
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-sm">
                                                ₹{Number(s.net_payable).toLocaleString('en-IN')}
                                            </TableCell>
                                            <TableCell className="text-center">{getStatusBadge(s.status)}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Select
                                                        value={s.status}
                                                        onValueChange={(val) => handleUpdateStatus(s.id, val as FnFStatus)}
                                                    >
                                                        <SelectTrigger className="w-[110px] h-8 text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Initiated">Initiated</SelectItem>
                                                            <SelectItem value="Processing">Processing</SelectItem>
                                                            <SelectItem value="On Hold">On Hold</SelectItem>
                                                            <SelectItem value="Settled">Settled</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-red-700 hover:bg-red-50 ml-1"
                                                        title="Delete Record"
                                                        onClick={() => handleDelete(s.id, empName)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                        No active or past F&F settlements found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

export default FnFSettlement;
