import { useState, useEffect } from "react";
import { PageSkeleton } from "@/components/PageSkeleton";
import { format } from "date-fns";
import {
    CreditCard, FileText, CheckCircle, XCircle, Plus, Search,
    Trash2, Loader2, IndianRupee, Clock, Check, X
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Data Types
type ExpenseCategory = 'Travel' | 'Meals' | 'Supplies' | 'Internet/Phone' | 'Training' | 'Other';
type ExpenseStatus = 'Pending' | 'Approved' | 'Rejected' | 'Paid';

interface Expense {
    id: string;
    employee_id: string;
    amount: number;
    category: ExpenseCategory;
    date: string;
    description: string;
    status: ExpenseStatus;
    receipt_url?: string;
    manager_notes?: string;
    created_at: string;
    employees?: { name: string };
}

const Expenses = () => {
    const { toast } = useToast();
    const [companyId, setCompanyId] = useState<string | null>(null);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [newExpense, setNewExpense] = useState<Partial<Expense>>({
        category: "Travel",
        date: new Date().toISOString().split('T')[0]
    });

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
                .select("id")
                .eq("user_id", user.id)
                .maybeSingle();

            if (company) {
                setCompanyId(company.id);

                const { data: exps, error: expsError } = await supabase
                    .from("expenses")
                    .select("*, employees(name)")
                    .eq("company_id", company.id)
                    .order("created_at", { ascending: false })
                    .limit(100);

                if (expsError) {
                    console.error(expsError);
                    toast({ title: "Warning", description: "Failed to load expenses.", variant: "destructive" });
                } else if (exps) {
                    setExpenses(exps as any[]);
                }
            }
        } catch (e: any) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: ExpenseStatus) => {
        switch (status) {
            case "Pending": return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
            case "Approved": return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><CheckCircle className="w-3 h-3 mr-1" /> Approved</Badge>;
            case "Paid": return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" /> Paid</Badge>;
            case "Rejected": return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    const handleAddExpense = async () => {
        if (!companyId) return;

        if (!newExpense.employee_id || !newExpense.amount || !newExpense.date || !newExpense.description) {
            toast({
                title: "Missing Information",
                description: "Please fill in all mandatory fields (Employee, Amount, Date, Description).",
                variant: "destructive"
            });
            return;
        }

        setIsSubmitting(true);

        try {
            const { data, error } = await supabase
                .from("expenses")
                .insert({
                    company_id: companyId,
                    employee_id: newExpense.employee_id,
                    amount: parseFloat(newExpense.amount.toString()),
                    category: newExpense.category,
                    date: newExpense.date,
                    description: newExpense.description,
                    status: "Pending"
                })
                .select("*, employees(name)")
                .single();

            if (error) throw error;

            setExpenses([data as any, ...expenses]);
            setIsSubmitDialogOpen(false);
            setNewExpense({ category: "Travel", date: new Date().toISOString().split('T')[0] });

            toast({
                title: "Expense Submitted",
                description: "Claim has been submitted and is pending review."
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

    const handleUpdateStatus = async (id: string, newStatus: ExpenseStatus) => {
        try {
            const { error } = await supabase
                .from("expenses")
                .update({ status: newStatus })
                .eq("id", id);

            if (error) throw error;

            setExpenses(expenses.map(e => e.id === id ? { ...e, status: newStatus } : e));

            toast({
                title: "Status Updated",
                description: `Expense claim marked as ${newStatus}.`
            });
        } catch (error: any) {
            toast({
                title: "Status update failed",
                description: getSafeErrorMessage(error),
                variant: "destructive"
            });
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this expense claim?")) return;

        try {
            const { error } = await supabase.from("expenses").delete().eq("id", id);
            if (error) throw error;

            setExpenses(expenses.filter(e => e.id !== id));
            toast({
                title: "Expense Removed",
                description: "The claim has been deleted."
            });
        } catch (error: any) {
            toast({
                title: "Deletion failed",
                description: getSafeErrorMessage(error),
                variant: "destructive"
            });
        }
    };

    const filteredExpenses = expenses.filter(e => {
        const term = searchTerm.toLowerCase();
        const empName = e.employees && !Array.isArray(e.employees) ? e.employees.name : "";
        return e.description.toLowerCase().includes(term) ||
            (empName && empName.toLowerCase().includes(term)) ||
            e.category.toLowerCase().includes(term) ||
            e.amount.toString().includes(term);
    });

    const aggregateAmount = (statusArr: ExpenseStatus[]) => {
        return expenses
            .filter(e => statusArr.includes(e.status))
            .reduce((sum, e) => sum + Number(e.amount), 0);
    };

    const stats = {
        pendingAmount: aggregateAmount(["Pending"]),
        approvedAmount: aggregateAmount(["Approved"]),
        paidAmount: aggregateAmount(["Paid"]),
        rejectedAmount: aggregateAmount(["Rejected"]),
        pendingCount: expenses.filter(e => e.status === "Pending").length,
    };

    if (loading) {
        return <PageSkeleton />;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Expenses & Claims</h1>
                    <p className="text-muted-foreground mt-1">Manage employee reimbursements and corporate expenses.</p>
                </div>

                <Dialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> Submit Claim
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[450px]">
                        <DialogHeader>
                            <DialogTitle>Submit Expense Claim</DialogTitle>
                            <DialogDescription>
                                Record a new corporate expense or employee reimbursement.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="employee">Employee</Label>
                                <EmployeeCombobox
                                    companyId={companyId}
                                    value={newExpense.employee_id}
                                    onSelect={(id) => setNewExpense({ ...newExpense, employee_id: id })}
                                    placeholder="Search employee by name or code..."
                                    className="w-full mt-1"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="amount">Amount (₹)</Label>
                                    <Input
                                        id="amount"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={newExpense.amount || ""}
                                        onChange={(e) => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="date">Date</Label>
                                    <Input
                                        id="date"
                                        type="date"
                                        value={newExpense.date || ""}
                                        onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="category">Category</Label>
                                <Select
                                    value={newExpense.category}
                                    onValueChange={(val) => setNewExpense({ ...newExpense, category: val as ExpenseCategory })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Travel">Travel</SelectItem>
                                        <SelectItem value="Meals">Meals</SelectItem>
                                        <SelectItem value="Supplies">Supplies</SelectItem>
                                        <SelectItem value="Internet/Phone">Internet/Phone</SelectItem>
                                        <SelectItem value="Training">Training</SelectItem>
                                        <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="description">Description & Business Purpose</Label>
                                <Textarea
                                    id="description"
                                    placeholder="e.g. Client lunch at Mumbai office"
                                    className="resize-none"
                                    value={newExpense.description || ""}
                                    onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsSubmitDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                            <Button type="submit" onClick={handleAddExpense} disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Submit Claim
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Pending Claims</CardTitle>
                        <Clock className="h-4 w-4 text-yellow-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-700">₹{stats.pendingAmount.toLocaleString('en-IN')}</div>
                        <p className="text-xs text-muted-foreground mt-1">{stats.pendingCount} claims awaiting approval</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Approved to Pay</CardTitle>
                        <CheckCircle className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-700">₹{stats.approvedAmount.toLocaleString('en-IN')}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
                        <IndianRupee className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-700">₹{stats.paidAmount.toLocaleString('en-IN')}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Rejected</CardTitle>
                        <XCircle className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-700">₹{stats.rejectedAmount.toLocaleString('en-IN')}</div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="all">
                <TabsList>
                    <TabsTrigger value="all">All Claims</TabsTrigger>
                    <TabsTrigger value="pending" className="flex items-center gap-1">
                        Pending Approvals
                        {expenses.filter(e => e.status === "Pending").length > 0 && (
                            <span className="ml-1 rounded-full bg-amber-500 text-white text-xs px-1.5 py-0.5">
                                {expenses.filter(e => e.status === "Pending").length}
                            </span>
                        )}
                    </TabsTrigger>
                </TabsList>

                {/* Pending Approvals Tab */}
                <TabsContent value="pending">
                    {expenses.filter(e => e.status === "Pending").length === 0 ? (
                        <div className="rounded-md border p-8 text-center text-sm text-muted-foreground mt-4">
                            No pending expense claims awaiting approval.
                        </div>
                    ) : (
                        <div className="space-y-3 mt-4">
                            {expenses.filter(e => e.status === "Pending").map((expense) => (
                                <Card key={expense.id} className="border-amber-100">
                                    <CardContent className="py-4 flex items-center justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">
                                                    {expense.employees && !Array.isArray(expense.employees) ? expense.employees.name : "Unknown"}
                                                </span>
                                                <Badge variant="secondary" className="font-normal">{expense.category}</Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground mt-0.5 truncate">{expense.description}</p>
                                            <p className="text-xs text-muted-foreground">{format(new Date(expense.date), "d MMM yyyy")}</p>
                                        </div>
                                        <div className="text-lg font-bold whitespace-nowrap">
                                            ₹{Number(expense.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Button
                                                size="sm"
                                                className="bg-green-600 hover:bg-green-700 text-white"
                                                onClick={() => handleUpdateStatus(expense.id, "Approved")}
                                            >
                                                <Check className="h-4 w-4 mr-1" /> Approve
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => handleUpdateStatus(expense.id, "Rejected")}
                                            >
                                                <X className="h-4 w-4 mr-1" /> Reject
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* All Claims Tab */}
                <TabsContent value="all">
            <Card>
                <CardHeader className="px-6 py-4 border-b">
                    <div className="flex justify-between items-center sm:flex-row flex-col gap-4">
                        <CardTitle className="text-lg">Recent Claims</CardTitle>
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search description, employee, category..."
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
                                <TableHead>Date</TableHead>
                                <TableHead>Employee</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Amount (₹)</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                                <TableHead className="text-right">Admin Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredExpenses.length > 0 ? (
                                filteredExpenses.map((expense) => (
                                    <TableRow key={expense.id} className="hover:bg-muted/30">
                                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                            {format(new Date(expense.date), "dd MMM yyyy")}
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {expense.employees && !Array.isArray(expense.employees) ? expense.employees.name : "Unknown"}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="font-normal">{expense.category}</Badge>
                                        </TableCell>
                                        <TableCell className="text-sm max-w-[200px] truncate" title={expense.description}>
                                            {expense.description}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {Number(expense.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell className="text-center">{getStatusBadge(expense.status)}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                {expense.status === "Pending" && (
                                                    <>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                            title="Approve"
                                                            onClick={() => handleUpdateStatus(expense.id, "Approved")}
                                                        >
                                                            <Check className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                            title="Reject"
                                                            onClick={() => handleUpdateStatus(expense.id, "Rejected")}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </>
                                                )}
                                                {expense.status === "Approved" && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                        title="Mark Paid"
                                                        onClick={() => handleUpdateStatus(expense.id, "Paid")}
                                                    >
                                                        <IndianRupee className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-red-700 hover:bg-red-50 ml-2"
                                                    title="Delete Claim"
                                                    onClick={() => handleDelete(expense.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                        No expense claims found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default Expenses;
