import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getSafeErrorMessage } from "@/lib/safe-error";
import { Plus, Banknote } from "lucide-react";

interface EmployeeAdvance {
    id: string;
    company_id: string;
    employee_id: string;
    amount: number;
    date: string;
    purpose: string | null;
    instalment_count: number;
    repaid_amount: number;
    status: string;
    employees?: { name: string; emp_code: string; department: string | null } | null;
}

const Advances = () => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [companyId, setCompanyId] = useState<string | null>(null);
    const [advances, setAdvances] = useState<EmployeeAdvance[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);

    // Dialog State
    const [showDialog, setShowDialog] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        employee_id: "",
        amount: "",
        date: format(new Date(), "yyyy-MM-dd"),
        purpose: "",
        instalment_count: "1",
    });

    const loadData = useCallback(async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: company } = await supabase
            .from("companies")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (company) {
            setCompanyId(company.id);

            const [empRes, advRes] = await Promise.all([
                supabase.from("employees").select("id, name, emp_code, department").eq("company_id", company.id).eq("status", "Active"),
                supabase.from("employee_advances").select("*, employees(name, emp_code, department)").eq("company_id", company.id).order("date", { ascending: false })
            ]);

            if (empRes.data) setEmployees(empRes.data);
            if (advRes.data) setAdvances(advRes.data as any);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSubmit = async () => {
        if (!formData.employee_id || !formData.amount || !formData.date) {
            toast({ title: "Validation Error", description: "Employee, Amount, and Date are required.", variant: "destructive" });
            return;
        }

        if (!companyId) return;

        setSubmitting(true);
        try {
            const { error } = await supabase.from("employee_advances").insert({
                company_id: companyId,
                employee_id: formData.employee_id,
                amount: Number(formData.amount),
                date: formData.date,
                purpose: formData.purpose,
                instalment_count: Number(formData.instalment_count),
                repaid_amount: 0,
                status: "Active"
            });

            if (error) throw error;

            toast({ title: "Success", description: "Advance recorded successfully" });
            setShowDialog(false);
            setFormData({ employee_id: "", amount: "", date: format(new Date(), "yyyy-MM-dd"), purpose: "", instalment_count: "1" });
            loadData();
        } catch (err: any) {
            toast({ title: "Error", description: getSafeErrorMessage(err), variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    };

    const activeAdvancesCount = advances.filter(a => a.status === "Active").length;
    const totalActiveAmount = advances.filter(a => a.status === "Active").reduce((acc, a) => acc + Number(a.amount) - Number(a.repaid_amount), 0);

    if (loading) return <div className="p-8 text-muted-foreground">Loading Advances...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Employee Advances</h1>
                    <p className="text-muted-foreground">Track salary advances and loan recoveries (Form XVIII).</p>
                </div>
                <Button onClick={() => setShowDialog(true)} className="gap-2">
                    <Plus className="h-4 w-4" /> Issue Advance
                </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                    <CardContent className="flex items-center gap-3 pt-6">
                        <Banknote className="h-8 w-8 text-primary" />
                        <div>
                            <p className="text-2xl font-bold">{activeAdvancesCount}</p>
                            <p className="text-sm text-muted-foreground">Active Advances</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-3 pt-6">
                        <Banknote className="h-8 w-8 text-orange-500" />
                        <div>
                            <p className="text-2xl font-bold">₹{totalActiveAmount.toLocaleString("en-IN")}</p>
                            <p className="text-sm text-muted-foreground">Outstanding Balance to Recover</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Advances Register</CardTitle>
                    <CardDescription>Record of all advances granted to employees.</CardDescription>
                </CardHeader>
                <CardContent>
                    {advances.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">No advances recorded.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Employee</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Purpose</TableHead>
                                        <TableHead className="text-right">Amount (₹)</TableHead>
                                        <TableHead className="text-right">Instalments</TableHead>
                                        <TableHead className="text-right">Repaid (₹)</TableHead>
                                        <TableHead className="text-right">Balance (₹)</TableHead>
                                        <TableHead className="text-right">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {advances.map((adv) => {
                                        const balance = Number(adv.amount) - Number(adv.repaid_amount);
                                        return (
                                            <TableRow key={adv.id}>
                                                <TableCell>
                                                    <div className="font-medium">{adv.employees?.name}</div>
                                                    <div className="text-xs text-muted-foreground">{adv.employees?.emp_code}</div>
                                                </TableCell>
                                                <TableCell>{adv.date}</TableCell>
                                                <TableCell>{adv.purpose || "—"}</TableCell>
                                                <TableCell className="text-right font-medium">₹{Number(adv.amount).toLocaleString("en-IN")}</TableCell>
                                                <TableCell className="text-right">{adv.instalment_count}</TableCell>
                                                <TableCell className="text-right text-green-600">₹{Number(adv.repaid_amount).toLocaleString("en-IN")}</TableCell>
                                                <TableCell className="text-right font-bold text-orange-600">₹{balance.toLocaleString("en-IN")}</TableCell>
                                                <TableCell className="text-right">
                                                    <Badge variant={adv.status === "Active" ? "default" : "secondary"}>
                                                        {adv.status}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Issue Employee Advance</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Employee</Label>
                            <Select value={formData.employee_id} onValueChange={(val) => setFormData({ ...formData, employee_id: val })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select an employee" />
                                </SelectTrigger>
                                <SelectContent>
                                    {employees.map(e => (
                                        <SelectItem key={e.id} value={e.id}>{e.emp_code} - {e.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Advance Amount (₹)</Label>
                            <Input type="number" placeholder="5000" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Date of Advance</Label>
                            <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Purpose (Optional)</Label>
                            <Input placeholder="Personal / Medical" value={formData.purpose} onChange={(e) => setFormData({ ...formData, purpose: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Number of Instalments for Recovery</Label>
                            <Input type="number" min="1" max="24" value={formData.instalment_count} onChange={(e) => setFormData({ ...formData, instalment_count: e.target.value })} />
                            <p className="text-xs text-muted-foreground">The system will automatically deduct this amount from monthly payroll until fully recovered.</p>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
                        <Button onClick={handleSubmit} disabled={submitting}>
                            {submitting ? "Saving..." : "Save Advance"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Advances;
