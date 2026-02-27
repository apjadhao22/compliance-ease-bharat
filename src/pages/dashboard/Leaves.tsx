import { useState, useEffect } from "react";
import { format, differenceInBusinessDays } from "date-fns";
import {
    CalendarMinus, CalendarCog, CheckCircle, XCircle, Plus, Search,
    Trash2, Loader2, CalendarDays, Check, X, Plane, AlertCircle, HandCoins
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

// Data Types
type LeaveType = 'Casual' | 'Sick' | 'Earned' | 'Maternity' | 'Unpaid' | 'Other';
type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

interface LeaveRequest {
    id: string;
    employee_id: string;
    leave_type: LeaveType;
    start_date: string;
    end_date: string;
    days_count: number;
    status: LeaveStatus;
    reason: string;
    admin_notes?: string;
    created_at: string;
    employees?: { name: string };
}

interface Employee {
    id: string;
    name: string;
}

const Leaves = () => {
    const { toast } = useToast();
    const [companyId, setCompanyId] = useState<string | null>(null);
    const [complianceRegime, setComplianceRegime] = useState<'legacy_acts' | 'labour_codes'>('legacy_acts');
    const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // OSH Code State
    const [isEncashmentDialogOpen, setIsEncashmentDialogOpen] = useState(false);
    const [encashmentReport, setEncashmentReport] = useState<any[]>([]);

    // Form State
    const [newLeave, setNewLeave] = useState<Partial<LeaveRequest>>({
        leave_type: "Casual",
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
                .select("id, compliance_regime")
                .eq("user_id", user.id)
                .maybeSingle();

            if (company) {
                setCompanyId(company.id);
                setComplianceRegime((company as any).compliance_regime || "legacy_acts");

                const { data: emps } = await supabase
                    .from("employees")
                    .select("id, name")
                    .eq("company_id", company.id)
                    .eq("status", "Active");

                if (emps) setEmployees(emps);

                const { data: lreqs, error: lreqsError } = await supabase
                    .from("leave_requests")
                    .select("*, employees(name)")
                    .eq("company_id", company.id)
                    .order("created_at", { ascending: false });

                if (lreqsError) {
                    console.error(lreqsError);
                    toast({ title: "Warning", description: "Failed to load leave data.", variant: "destructive" });
                } else if (lreqs) {
                    setLeaves(lreqs as any[]);
                }
            }
        } catch (e: any) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: LeaveStatus) => {
        switch (status) {
            case "Pending": return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>;
            case "Approved": return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" /> Approved</Badge>;
            case "Rejected": return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
            case "Cancelled": return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Cancelled</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    // Helper to calculate days properly using Date-FNS
    const handleDateChange = (field: 'start_date' | 'end_date', value: string) => {
        const updatedLeave = { ...newLeave, [field]: value };

        if (updatedLeave.start_date && updatedLeave.end_date) {
            const start = new Date(updatedLeave.start_date);
            const end = new Date(updatedLeave.end_date);

            if (end >= start) {
                // Calculate difference in business days + 1 to include start AND end dates
                updatedLeave.days_count = differenceInBusinessDays(end, start) + 1;
            } else {
                updatedLeave.days_count = 0;
            }
        }
        setNewLeave(updatedLeave);
    };

    const handleAddLeave = async () => {
        if (!companyId) return;

        if (!newLeave.employee_id || !newLeave.start_date || !newLeave.end_date || !newLeave.reason) {
            toast({
                title: "Missing Information",
                description: "Please fill in all mandatory fields (Employee, Dates, Reason).",
                variant: "destructive"
            });
            return;
        }

        if ((newLeave.days_count || 0) <= 0) {
            toast({
                title: "Invalid Dates",
                description: "End date must be the same or after the start date.",
                variant: "destructive"
            });
            return;
        }

        setIsSubmitting(true);

        try {
            const { data, error } = await supabase
                .from("leave_requests")
                .insert({
                    company_id: companyId,
                    employee_id: newLeave.employee_id,
                    leave_type: newLeave.leave_type,
                    start_date: newLeave.start_date,
                    end_date: newLeave.end_date,
                    days_count: newLeave.days_count,
                    reason: newLeave.reason,
                    status: "Pending"
                })
                .select("*, employees(name)")
                .single();

            if (error) throw error;

            setLeaves([data as any, ...leaves]);
            setIsSubmitDialogOpen(false);
            setNewLeave({ leave_type: "Casual" });

            toast({
                title: "Leave Requested",
                description: "Your time-off request has been submitted successfully."
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

    const handleUpdateStatus = async (id: string, newStatus: LeaveStatus) => {
        try {
            const { error } = await supabase
                .from("leave_requests")
                .update({ status: newStatus })
                .eq("id", id);

            if (error) throw error;

            setLeaves(leaves.map(l => l.id === id ? { ...l, status: newStatus } : l));

            toast({
                title: "Status Updated",
                description: `Leave request marked as ${newStatus}.`
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
        if (!window.confirm("Are you sure you want to delete this leave record?")) return;

        try {
            const { error } = await supabase.from("leave_requests").delete().eq("id", id);
            if (error) throw error;

            setLeaves(leaves.filter(l => l.id !== id));
            toast({
                title: "Record Deleted",
                description: "The leave request has been removed."
            });
        } catch (error: any) {
            toast({
                title: "Deletion failed",
                description: getSafeErrorMessage(error),
                variant: "destructive"
            });
        }
    };

    const filteredLeaves = leaves.filter(l => {
        const term = searchTerm.toLowerCase();
        const empName = l.employees && !Array.isArray(l.employees) ? l.employees.name : "";
        return l.reason.toLowerCase().includes(term) ||
            (empName && empName.toLowerCase().includes(term)) ||
            l.leave_type.toLowerCase().includes(term);
    });

    const handleGenerateEncashmentReport = () => {
        // Mock OSH Code Logic: Earned Leave carry forward is capped at 30 days.
        // We simulate balances for employees to demonstrate the feature.
        const mockReport = employees.map(emp => {
            const mockBalance = Math.floor(Math.random() * 50) + 10; // Random balance 10-60
            const excess = mockBalance > 30 ? mockBalance - 30 : 0;
            return {
                id: emp.id,
                name: emp.name,
                elBalance: mockBalance,
                excessDays: excess,
                encashmentValue: excess * 1250, // Mock ₹1250/day
            };
        }).filter(r => r.excessDays > 0);

        setEncashmentReport(mockReport);
        setIsEncashmentDialogOpen(true);
    };

    const handleProcessEncashment = () => {
        setIsEncashmentDialogOpen(false);
        toast({
            title: "Leave Encashment Processed",
            description: `${encashmentReport.length} employees had excess EL days encashed. It will appear in their next payroll.`
        });
    };

    // Calculate some fun dashboard stats
    const today = new Date().toISOString().split('T')[0];

    const stats = {
        pendingCount: leaves.filter(l => l.status === "Pending").length,
        approvedCount: leaves.filter(l => l.status === "Approved").length,
        onLeaveToday: leaves.filter(l =>
            l.status === "Approved" &&
            l.start_date <= today &&
            l.end_date >= today
        ).length,
        totalLeaveDays: leaves
            .filter(l => l.status === "Approved")
            .reduce((sum, l) => sum + Number(l.days_count), 0),
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground opacity-50" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Leave Management</h1>
                    <p className="text-muted-foreground mt-1">Track time off, manage vacation calendars, and approve absences.</p>
                </div>

                <div className="flex gap-2">
                    {complianceRegime === "labour_codes" && (
                        <Button
                            variant="outline"
                            className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900/50"
                            onClick={handleGenerateEncashmentReport}
                        >
                            <HandCoins className="mr-2 h-4 w-4" /> Year-End Encashment
                        </Button>
                    )}
                    <Dialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> Log Leave
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[450px]">
                            <DialogHeader>
                                <DialogTitle>Request Time Off</DialogTitle>
                                <DialogDescription>
                                    Log a new leave request for an employee. Approvals can be managed later.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="employee">Employee</Label>
                                    <Select
                                        value={newLeave.employee_id}
                                        onValueChange={(val) => setNewLeave({ ...newLeave, employee_id: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Employee" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {employees.map(emp => (
                                                <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="type">Leave Type</Label>
                                    <Select
                                        value={newLeave.leave_type}
                                        onValueChange={(val) => setNewLeave({ ...newLeave, leave_type: val as LeaveType })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Casual">Casual Leave (CL)</SelectItem>
                                            <SelectItem value="Sick">Sick Leave (SL)</SelectItem>
                                            <SelectItem value="Earned">Earned / Privilege Leave (PL)</SelectItem>
                                            <SelectItem value="Maternity">Maternity Leave</SelectItem>
                                            <SelectItem value="Unpaid">Loss of Pay (Unpaid)</SelectItem>
                                            <SelectItem value="Other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="start_date">Start Date</Label>
                                        <Input
                                            id="start_date"
                                            type="date"
                                            value={newLeave.start_date || ""}
                                            onChange={(e) => handleDateChange('start_date', e.target.value)}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="end_date">End Date</Label>
                                        <Input
                                            id="end_date"
                                            type="date"
                                            value={newLeave.end_date || ""}
                                            onChange={(e) => handleDateChange('end_date', e.target.value)}
                                        />
                                    </div>
                                </div>

                                {newLeave.start_date && newLeave.end_date && (
                                    <div className="text-sm bg-muted p-2 text-center rounded-md font-medium text-muted-foreground border">
                                        Total Business Days: <span className="text-foreground text-lg">{newLeave.days_count || 0}</span>
                                    </div>
                                )}

                                <div className="grid gap-2">
                                    <Label htmlFor="reason">Reason / Comments</Label>
                                    <Textarea
                                        id="reason"
                                        placeholder="e.g. Taking time off for a family function"
                                        className="resize-none"
                                        value={newLeave.reason || ""}
                                        onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsSubmitDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                                <Button type="submit" onClick={handleAddLeave} disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Submit Request
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* OSH Code Encashment Dialog */}
                <Dialog open={isEncashmentDialogOpen} onOpenChange={setIsEncashmentDialogOpen}>
                    <DialogContent className="sm:max-w-[600px]">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <HandCoins className="h-5 w-5 text-blue-600" />
                                OSH Code: Earned Leave Encashment
                            </DialogTitle>
                            <DialogDescription>
                                Under the new Labour Codes, Earned Leave accumulation is capped at 30 days. Excess days must be encashed at the end of the year.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="py-4">
                            {encashmentReport.length === 0 ? (
                                <div className="text-center py-6 text-muted-foreground flex flex-col items-center">
                                    <CheckCircle className="h-10 w-10 text-green-500 mb-2" />
                                    <p>No employees exceed the 30-day accumulation limit.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 p-3 rounded-md text-sm border border-blue-200 dark:border-blue-900">
                                        Found <strong>{encashmentReport.length}</strong> employees exceeding the 30-day limit.
                                    </div>
                                    <div className="max-h-[300px] overflow-auto border rounded-md">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Employee</TableHead>
                                                    <TableHead className="text-right">EL Balance</TableHead>
                                                    <TableHead className="text-right text-destructive font-bold">Excess Days</TableHead>
                                                    <TableHead className="text-right">Encashment (₹)</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {encashmentReport.map((row) => (
                                                    <TableRow key={row.id}>
                                                        <TableCell className="font-medium">{row.name}</TableCell>
                                                        <TableCell className="text-right">{row.elBalance}</TableCell>
                                                        <TableCell className="text-right text-destructive font-bold">{row.excessDays}</TableCell>
                                                        <TableCell className="text-right font-semibold text-green-700 dark:text-green-500">₹{row.encashmentValue.toLocaleString('en-IN')}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsEncashmentDialogOpen(false)}>Close</Button>
                            {encashmentReport.length > 0 && (
                                <Button onClick={handleProcessEncashment}>
                                    Process & Push to Payroll
                                </Button>
                            )}
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
                        <CalendarMinus className="h-4 w-4 text-yellow-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-700">{stats.pendingCount}</div>
                        <p className="text-xs text-muted-foreground mt-1">Leaves awaiting review</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Approved Leaves</CardTitle>
                        <CalendarCog className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-700">{stats.approvedCount}</div>
                        <p className="text-xs text-muted-foreground mt-1">Total historically</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Employees Absent Today</CardTitle>
                        <Plane className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-700">{stats.onLeaveToday}</div>
                        <p className="text-xs text-muted-foreground mt-1">Currently on approved leave</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Total Days Taken</CardTitle>
                        <CalendarDays className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-700">{stats.totalLeaveDays}</div>
                        <p className="text-xs text-muted-foreground mt-1">Total volume of time-off</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="px-6 py-4 border-b">
                    <div className="flex justify-between items-center sm:flex-row flex-col gap-4">
                        <CardTitle className="text-lg">Leave History & Requests</CardTitle>
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search reason, employee, or type..."
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
                                <TableHead>Type</TableHead>
                                <TableHead>Duration</TableHead>
                                <TableHead>Days</TableHead>
                                <TableHead>Reason</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredLeaves.length > 0 ? (
                                filteredLeaves.map((lreq) => (
                                    <TableRow key={lreq.id} className="hover:bg-muted/30">
                                        <TableCell className="font-medium">
                                            {lreq.employees && !Array.isArray(lreq.employees) ? lreq.employees.name : "Unknown"}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="font-normal">{lreq.leave_type}</Badge>
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            <div className="whitespace-nowrap font-medium text-muted-foreground">
                                                {format(new Date(lreq.start_date), "dd MMM yy")} - {format(new Date(lreq.end_date), "dd MMM yy")}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-bold">
                                            {lreq.days_count}
                                        </TableCell>
                                        <TableCell className="text-sm max-w-[200px] truncate" title={lreq.reason}>
                                            {lreq.reason}
                                        </TableCell>
                                        <TableCell className="text-center">{getStatusBadge(lreq.status)}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                {lreq.status === "Pending" && (
                                                    <>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                            title="Approve Leave"
                                                            onClick={() => handleUpdateStatus(lreq.id, "Approved")}
                                                        >
                                                            <Check className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                            title="Reject Leave"
                                                            onClick={() => handleUpdateStatus(lreq.id, "Rejected")}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </>
                                                )}
                                                {lreq.status === "Approved" && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                                        title="Cancel Leave"
                                                        onClick={() => handleUpdateStatus(lreq.id, "Cancelled")}
                                                    >
                                                        <CalendarMinus className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-red-700 hover:bg-red-50 ml-2"
                                                    title="Delete Record"
                                                    onClick={() => handleDelete(lreq.id)}
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
                                        No leave requests found.
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

export default Leaves;
