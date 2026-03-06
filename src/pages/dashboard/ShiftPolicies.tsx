import { PageSkeleton } from "@/components/PageSkeleton";
import { useState, useEffect, useCallback } from "react";
import { Clock, Plus, Trash2, Loader2, Moon, Sun, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getSafeErrorMessage } from "@/lib/safe-error";

interface ShiftPolicy {
    id: string;
    name: string;
    shift_start: string;
    shift_end: string;
    is_night_shift: boolean;
    allowance_per_day: number;
    late_mark_grace_minutes: number;
    max_late_marks_per_month: number;
    company_id: string;
}

type PolicyForm = Omit<ShiftPolicy, "id" | "company_id">;

const DEFAULT_FORM: PolicyForm = {
    name: "",
    shift_start: "09:00",
    shift_end: "18:00",
    is_night_shift: false,
    allowance_per_day: 0,
    late_mark_grace_minutes: 15,
    max_late_marks_per_month: 3,
};

const ShiftPolicies = () => {
    const { toast } = useToast();
    const [companyId, setCompanyId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [policies, setPolicies] = useState<ShiftPolicy[]>([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [form, setForm] = useState<PolicyForm>({ ...DEFAULT_FORM });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const loadPolicies = useCallback(async (cid: string) => {
        const { data } = await (supabase as any).from("shift_policies").select("*").eq("company_id", cid).order("name");
        if (data) setPolicies(data as ShiftPolicy[]);
    }, []);

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { setLoading(false); return; }
            const { data: comp } = await supabase.from("companies").select("id").eq("user_id", user.id).maybeSingle();
            if (comp) { setCompanyId(comp.id); await loadPolicies(comp.id); }
            setLoading(false);
        };
        init();
    }, [loadPolicies]);

    const handleSave = async () => {
        if (!companyId || !form.name) {
            toast({ title: "Policy name is required", variant: "destructive" }); return;
        }
        setIsSubmitting(true);
        try {
            const { data, error } = await (supabase as any).from("shift_policies").insert({ ...form, company_id: companyId }).select().single();
            if (error) throw error;
            setPolicies([...policies, data as ShiftPolicy].sort((a, b) => a.name.localeCompare(b.name)));
            setDialogOpen(false);
            setForm({ ...DEFAULT_FORM });
            toast({ title: "Shift Policy Created", description: `"${form.name}" is now available for assignment.` });
        } catch (e: any) {
            toast({ title: "Error", description: getSafeErrorMessage(e), variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Delete shift policy "${name}"? Employees assigned to it will be unassigned.`)) return;
        const { error } = await (supabase as any).from("shift_policies").delete().eq("id", id);
        if (error) { toast({ title: "Error", description: getSafeErrorMessage(error), variant: "destructive" }); return; }
        setPolicies(policies.filter(p => p.id !== id));
        toast({ title: "Policy Deleted" });
    };

    const set = (field: keyof PolicyForm, value: any) => setForm(f => ({ ...f, [field]: value }));

    if (loading) return <PageSkeleton />;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Clock className="h-6 w-6 text-primary" /> Shift Policies
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Define shift timings, night shift allowances, and late-mark thresholds for payroll.
                    </p>
                </div>
                <Button onClick={() => setDialogOpen(true)} className="gap-2 self-start sm:self-auto">
                    <Plus className="h-4 w-4" /> New Shift Policy
                </Button>
            </div>

            {/* How it works */}
            <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <Info className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                <div className="text-sm text-blue-800">
                    <span className="font-semibold">How Late Marks work:</span> When you upload a timesheet with a{" "}
                    <code className="bg-blue-100 px-1 rounded">clock_in</code> column, the system compares each entry against the assigned
                    shift's start time + grace period. Each late arrival is counted. If an employee exceeds the{" "}
                    <span className="font-semibold">Max Late Marks</span> per month, a half-day salary deduction is automatically flagged
                    and passed to the payroll run.
                </div>
            </div>

            {/* Policies Table */}
            <Card>
                <CardHeader className="border-b px-6 py-4">
                    <CardTitle className="text-base">Configured Shift Policies ({policies.length})</CardTitle>
                    <CardDescription>Assign these to employees via the Employees module.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Hours</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Allowance/Day</TableHead>
                                <TableHead>Grace Period</TableHead>
                                <TableHead>Late-Mark Limit</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {policies.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                                        No shift policies configured. Create one to assign to employees.
                                    </TableCell>
                                </TableRow>
                            ) : policies.map(p => (
                                <TableRow key={p.id}>
                                    <TableCell className="font-medium">{p.name}</TableCell>
                                    <TableCell className="text-sm">{p.shift_start} – {p.shift_end}</TableCell>
                                    <TableCell>
                                        {p.is_night_shift
                                            ? <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 gap-1"><Moon className="h-3 w-3" /> Night</Badge>
                                            : <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1"><Sun className="h-3 w-3" /> Day</Badge>
                                        }
                                    </TableCell>
                                    <TableCell>
                                        {p.allowance_per_day > 0
                                            ? <span className="text-green-700 font-medium">₹{p.allowance_per_day.toLocaleString("en-IN")}</span>
                                            : <span className="text-muted-foreground">—</span>
                                        }
                                    </TableCell>
                                    <TableCell className="text-sm">{p.late_mark_grace_minutes} mins</TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{p.max_late_marks_per_month}× / month</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => handleDelete(p.id, p.name)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Create Policy Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle>New Shift Policy</DialogTitle>
                        <DialogDescription>Define timings, allowances, and late-mark rules.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div>
                            <Label>Policy Name</Label>
                            <Input className="mt-1" placeholder="e.g. General Shift, Night Shift, Rotating A" value={form.name} onChange={e => set("name", e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Shift Start Time</Label>
                                <Input type="time" className="mt-1" value={form.shift_start} onChange={e => set("shift_start", e.target.value)} />
                            </div>
                            <div>
                                <Label>Shift End Time</Label>
                                <Input type="time" className="mt-1" value={form.shift_end} onChange={e => set("shift_end", e.target.value)} />
                            </div>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border p-4">
                            <div>
                                <Label>Night Shift</Label>
                                <p className="text-xs text-muted-foreground mt-0.5">Marks this as a night shift for reporting purposes</p>
                            </div>
                            <Switch checked={form.is_night_shift} onCheckedChange={v => set("is_night_shift", v)} />
                        </div>
                        <div>
                            <Label>Shift Allowance (₹/day)</Label>
                            <Input type="number" className="mt-1" min="0" placeholder="e.g. 200" value={form.allowance_per_day}
                                onChange={e => set("allowance_per_day", Number(e.target.value))} />
                            <p className="text-xs text-muted-foreground mt-1">Added to gross salary on payroll for each day worked in this shift</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Late-Mark Grace Period (mins)</Label>
                                <Input type="number" className="mt-1" min="0" max="60" value={form.late_mark_grace_minutes}
                                    onChange={e => set("late_mark_grace_minutes", Number(e.target.value))} />
                            </div>
                            <div>
                                <Label>Max Late Marks / Month</Label>
                                <Input type="number" className="mt-1" min="1" max="31" value={form.max_late_marks_per_month}
                                    onChange={e => set("max_late_marks_per_month", Number(e.target.value))} />
                                <p className="text-xs text-muted-foreground mt-1">Exceeding triggers half-day deduction</p>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button onClick={handleSave} disabled={isSubmitting} className="gap-2">
                            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />} Create Policy
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ShiftPolicies;
