import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, BookOpen, Users, AlertTriangle, FileText, CheckCircle2, MoreVertical, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function IRCompliance() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [companyId, setCompanyId] = useState<string | null>(null);
    const [employees, setEmployees] = useState<any[]>([]);

    // Dialog States
    const [isOrderOpen, setIsOrderOpen] = useState(false);
    const [isGrcOpen, setIsGrcOpen] = useState(false);
    const [isGrievanceOpen, setIsGrievanceOpen] = useState(false);
    const [isEventOpen, setIsEventOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form States
    const [orderType, setOrderType] = useState("model");
    const [grcRemarks, setGrcRemarks] = useState("");
    const [grievanceEmp, setGrievanceEmp] = useState("");
    const [grievanceDesc, setGrievanceDesc] = useState("");
    const [eventType, setEventType] = useState("layoff");
    const [eventDate, setEventDate] = useState("");
    const [eventWorkers, setEventWorkers] = useState("");

    useEffect(() => {
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

                if (!company) return;
                setCompanyId(company.id);

                const { data: emps } = await supabase
                    .from("employees")
                    .select("id, first_name, last_name")
                    .eq("company_id", company.id)
                    .in("status", ["Active", "active"]);

                if (emps) setEmployees(emps);

                // Fetch Standing Orders
                const { data: orders } = await supabase
                    .from("standing_orders")
                    .select("*")
                    .eq("company_id", company.id)
                    .order("created_at", { ascending: false });

                // Fetch GRCs
                const { data: committees } = await supabase
                    .from("grievance_committees")
                    .select("*")
                    .eq("company_id", company.id)
                    .order("created_at", { ascending: false });

                // Fetch Grievances
                const { data: grievances } = await supabase
                    .from("grievances")
                    .select(`*, employee:employees(first_name, last_name)`)
                    .eq("company_id", company.id)
                    .order("raised_at", { ascending: false });

                // Aggregate workers
                const { count: employeeCount } = await supabase
                    .from("employees")
                    .select("*", { count: 'exact', head: true })
                    .eq("company_id", company.id)
                    .in("status", ["Active", "active"]);

                setData({
                    orders: orders || [],
                    committees: committees || [],
                    grievances: grievances || [],
                    activeHeadcount: employeeCount || 0
                });

            } catch (e) {
                console.error("Failed to load IR data:", e);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const fetchLatest = async () => {
        if (!companyId) return;
        const { data: orders } = await supabase.from("standing_orders").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
        const { data: committees } = await supabase.from("grievance_committees").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
        const { data: grievances } = await supabase.from("grievances").select(`*, employee:employees(first_name, last_name)`).eq("company_id", companyId).order("raised_at", { ascending: false });
        const { data: events } = await supabase.from("ir_events").select("*").eq("company_id", companyId).order("event_date", { ascending: false });

        setData(prev => ({
            ...prev,
            orders: orders || [],
            committees: committees || [],
            grievances: grievances || [],
            events: events || []
        }));
    };

    const handleCreateOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await supabase.from("standing_orders").insert({ company_id: companyId, order_type: orderType, status: "submitted" });
            toast({ title: "Standing Order Drafted", description: "The standing order has been submitted for certification." });
            setIsOrderOpen(false);
            fetchLatest();
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally { setIsSubmitting(false); }
    };

    const handleCreateGRC = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            // Placeholder: A real GRC takes an array of members.
            const members = [
                { name: "Employer Rep 1", role: "Chairperson", is_employee_rep: false },
                { name: "Employee Rep 1", role: "Member", is_employee_rep: true }
            ];
            await supabase.from("grievance_committees").insert({ company_id: companyId, remarks: grcRemarks, members });
            toast({ title: "GRC Constituted", description: "The Grievance Redressal Committee has been registered." });
            setIsGrcOpen(false);
            fetchLatest();
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally { setIsSubmitting(false); }
    };

    const handleLogGrievance = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!grievanceEmp || !grievanceDesc) return;
        setIsSubmitting(true);
        try {
            const committeeId = data.committees.length > 0 ? data.committees[0].id : null;
            await supabase.from("grievances").insert({ company_id: companyId, employee_id: grievanceEmp, description: grievanceDesc, committee_id: committeeId, status: "open" });
            toast({ title: "Grievance Logged", description: "The grievance has been recorded and assigned to the GRC." });
            setIsGrievanceOpen(false);
            setGrievanceEmp(""); setGrievanceDesc("");
            fetchLatest();
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally { setIsSubmitting(false); }
    };

    const handleLogEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!eventDate || !eventWorkers) return;
        setIsSubmitting(true);
        try {
            await supabase.from("ir_events").insert({ company_id: companyId, event_type: eventType, event_date: eventDate, affected_workers_count: parseInt(eventWorkers) });
            toast({ title: "IR Event Logged", description: "The employment event has been registered for compliance tracking." });
            setIsEventOpen(false);
            setEventDate(""); setEventWorkers("");
            fetchLatest();
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally { setIsSubmitting(false); }
    };

    if (loading) return <PageSkeleton />;
    if (!data) return <div>Failed to load.</div>;

    const activeStandingOrder = data.orders.find((o: any) => o.status === "approved" || o.status === "submitted");
    const modelOrdersOnly = data.orders.length > 0 && data.orders.every((o: any) => o.order_type === "model");
    const openGrievances = data.grievances.filter((g: any) => g.status === "open" || g.status === "in_review").length;

    return (
        <div className="space-y-6 pb-8">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Industrial Relations (IR)</h1>
                    <p className="mt-1 text-muted-foreground">Manage Standing Orders, Grievances, and Employment Events securely under the IR Code, 2020.</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Headcount Triggers */}
                <Card className="md:col-span-1 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-md flex items-center justify-between">
                            Statutory Thresholds
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-3xl font-bold">{data.activeHeadcount} <span className="text-sm font-normal text-muted-foreground">Workers</span></div>

                        <div className="space-y-3 pt-2">
                            <div className="flex justify-between items-center text-sm border-b pb-2">
                                <span className="flex flex-col">
                                    <span>GRC Required</span>
                                    <span className="text-[10px] text-muted-foreground uppercase">Chapter II, Sec 4 (≥ 20)</span>
                                </span>
                                <Badge variant={data.activeHeadcount >= 20 ? "destructive" : "secondary"}>
                                    {data.activeHeadcount >= 20 ? "Applicable" : "Not Required"}
                                </Badge>
                            </div>
                            <div className="flex justify-between items-center text-sm pb-2">
                                <span className="flex flex-col">
                                    <span>Standing Orders</span>
                                    <span className="text-[10px] text-muted-foreground uppercase">Chapter IV, Sec 28 (≥ 300)</span>
                                </span>
                                <Badge variant={data.activeHeadcount >= 300 ? "destructive" : "secondary"}>
                                    {data.activeHeadcount >= 300 ? "Applicable" : "Not Required"}
                                </Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Action Items */}
                <Card className="md:col-span-2 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-md flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            IR Action Items
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2">

                        {/* GRC Alert */}
                        {data.activeHeadcount >= 20 && data.committees.length === 0 ? (
                            <div className="bg-destructive/10 p-4 rounded-md border border-destructive/20 text-sm text-destructive flex flex-col justify-between">
                                <div>
                                    <strong>Missing Grievance Redressal Committee (GRC)</strong>
                                    <p className="text-xs opacity-90 mt-1">Establishment crossed 20 workers. You must constitute a GRC containing equal employer & employee representation.</p>
                                </div>
                                <Button onClick={() => setIsGrcOpen(true)} variant="outline" size="sm" className="w-fit mt-3 bg-white text-destructive border-destructive/30">Form GRC</Button>
                            </div>
                        ) : data.committees.length > 0 ? (
                            <div className="bg-emerald-500/10 p-4 rounded-md border border-emerald-500/20 text-sm text-emerald-800 flex flex-col justify-between">
                                <div>
                                    <strong className="flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> GRC Formed</strong>
                                    <p className="text-xs opacity-90 mt-1">{openGrievances} open grievance(s) waiting for review by the committee.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-50 p-4 rounded-md border text-sm text-slate-500 flex items-center justify-center text-center">
                                Headcount under 20. Formal GRC not yet statutory.
                            </div>
                        )}

                        {/* Standing Orders Alert */}
                        {data.activeHeadcount >= 300 && !activeStandingOrder ? (
                            <div className="bg-destructive/10 p-4 rounded-md border border-destructive/20 text-sm text-destructive flex flex-col justify-between">
                                <div>
                                    <strong>Missing Certified Standing Orders</strong>
                                    <p className="text-xs opacity-90 mt-1">Establishment crossed 300 workers. You must draft and submit standing orders to the certifying officer immediately.</p>
                                </div>
                                <Button onClick={() => setIsOrderOpen(true)} variant="outline" size="sm" className="w-fit mt-3 bg-white text-destructive border-destructive/30">Adopt Orders</Button>
                            </div>
                        ) : activeStandingOrder ? (
                            <div className="bg-blue-500/10 p-4 rounded-md border border-blue-500/20 text-sm text-blue-800 flex flex-col justify-between">
                                <div>
                                    <strong className="flex items-center gap-1"><BookOpen className="h-4 w-4" /> Rules Adopted</strong>
                                    <p className="text-xs opacity-90 mt-1">Currently operating under {activeStandingOrder.order_type} standing orders. Status is "{activeStandingOrder.status}".</p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-50 p-4 rounded-md border text-sm text-slate-500 flex items-center justify-center text-center">
                                Headcount under 300. Formal Standing Orders not statutory.
                            </div>
                        )}

                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="orders" className="w-full mt-6">
                <TabsList className="grid w-full grid-cols-3 max-w-md">
                    <TabsTrigger value="orders">Standing Orders</TabsTrigger>
                    <TabsTrigger value="grievances">Grievances ({openGrievances})</TabsTrigger>
                    <TabsTrigger value="events">IR Events</TabsTrigger>
                </TabsList>

                <TabsContent value="orders" className="pt-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <div>
                                <CardTitle className="text-lg">Standing Orders Drafts</CardTitle>
                                <CardDescription>Rules of conduct, classifications, and shift structures.</CardDescription>
                            </div>
                            <Button onClick={() => setIsOrderOpen(true)} size="sm" variant="outline" className="gap-2"><Plus className="h-4 w-4" /> New Draft</Button>
                        </CardHeader>
                        <CardContent>
                            {data.orders.length === 0 ? (
                                <div className="border border-dashed rounded-lg p-12 text-center text-muted-foreground mt-4">
                                    <BookOpen className="h-8 w-8 mx-auto mb-3 opacity-20" />
                                    <p>No Custom or Model Standing Orders adopted currently.</p>
                                </div>
                            ) : (
                                <div className="rounded-md border mt-4">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-muted/50 border-b">
                                            <tr>
                                                <th className="p-3 font-medium">Type</th>
                                                <th className="p-3 font-medium">Status</th>
                                                <th className="p-3 font-medium">Effective From</th>
                                                <th className="p-3 font-medium">Certifying Authority</th>
                                                <th className="p-3 font-medium text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {data.orders.map((o: any) => (
                                                <tr key={o.id} className="hover:bg-muted/20">
                                                    <td className="p-3 font-medium capitalize">{o.order_type} Orders</td>
                                                    <td className="p-3">
                                                        <Badge variant={o.status === 'approved' ? 'default' : 'outline'}>{o.status}</Badge>
                                                    </td>
                                                    <td className="p-3">{o.effective_from || '-'}</td>
                                                    <td className="p-3">{o.approval_authority || 'Pending Submission'}</td>
                                                    <td className="p-3 text-right">
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
                </TabsContent>

                <TabsContent value="grievances" className="pt-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <div>
                                <CardTitle className="text-lg">Grievance Register</CardTitle>
                                <CardDescription>Employee complaints and committee resolutions.</CardDescription>
                            </div>
                            <Button onClick={() => setIsGrievanceOpen(true)} size="sm" variant="outline" className="gap-2"><Plus className="h-4 w-4" /> Log Grievance</Button>
                        </CardHeader>
                        <CardContent>
                            {data.grievances.length === 0 ? (
                                <div className="border border-dashed rounded-lg p-12 text-center text-muted-foreground mt-4">
                                    <FileText className="h-8 w-8 mx-auto mb-3 opacity-20" />
                                    <p>No active grievances logged.</p>
                                </div>
                            ) : (
                                <div className="rounded-md border mt-4">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-muted/50 border-b">
                                            <tr>
                                                <th className="p-3 font-medium">Date</th>
                                                <th className="p-3 font-medium">Employee</th>
                                                <th className="p-3 font-medium">Description</th>
                                                <th className="p-3 font-medium">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {data.grievances.map((g: any) => (
                                                <tr key={g.id} className="hover:bg-muted/20">
                                                    <td className="p-3 whitespace-nowrap">{new Date(g.raised_at).toLocaleDateString()}</td>
                                                    <td className="p-3 font-medium">{g.employee?.first_name} {g.employee?.last_name}</td>
                                                    <td className="p-3 truncate max-w-[300px]" title={g.description}>{g.description}</td>
                                                    <td className="p-3">
                                                        <Badge variant={g.status === 'open' ? 'destructive' : g.status === 'in_review' ? 'default' : 'secondary'} className="capitalize">
                                                            {g.status.replace('_', ' ')}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="events" className="pt-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <div>
                                <CardTitle className="text-lg">IR Employment Events</CardTitle>
                                <CardDescription>Log Layoffs, Retrenchments, and Closures for statutory tracking.</CardDescription>
                                <Button onClick={() => setIsEventOpen(true)} size="sm" variant="outline" className="gap-2"><Plus className="h-4 w-4" /> Log Event</Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {data.events && data.events.length > 0 ? (
                                <div className="rounded-md border mt-4">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-muted/50 border-b">
                                            <tr>
                                                <th className="p-3 font-medium">Date</th>
                                                <th className="p-3 font-medium">Event Type</th>
                                                <th className="p-3 font-medium">Affected Workers</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {data.events.map((ev: any) => (
                                                <tr key={ev.id} className="hover:bg-muted/20">
                                                    <td className="p-3">{new Date(ev.event_date).toLocaleDateString()}</td>
                                                    <td className="p-3 font-medium capitalize">{ev.event_type}</td>
                                                    <td className="p-3">{ev.affected_workers_count}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="border border-dashed rounded-lg p-12 text-center text-muted-foreground mt-4 flex flex-col items-center justify-center">
                                    <ShieldAlert className="h-8 w-8 mx-auto mb-3 opacity-20 text-destructive" />
                                    <p>No major employment events logged.</p>
                                    <p className="text-xs max-w-lg mx-auto mt-2">Any layoff or retrenchment must be processed through the F&amp;F Module and linked to an overarching IR Event entry here to track compensation and authority notifications under the IR Code.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

            </Tabs>

            {/* --- Dialogs --- */}
            <Dialog open={isOrderOpen} onOpenChange={setIsOrderOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Adopt Standing Orders</DialogTitle>
                        <DialogDescription>Submit model or custom standing orders for certification.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateOrder} className="space-y-4 py-2">
                        <div className="grid gap-2">
                            <Label>Order Type</Label>
                            <Select value={orderType} onValueChange={setOrderType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="model">Model Standing Orders</SelectItem>
                                    <SelectItem value="custom">Custom Standing Orders</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">Model orders usually have faster adoption processes.</p>
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4" />} Draft Submission</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isGrcOpen} onOpenChange={setIsGrcOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Constitute Grievance Redressal Committee (GRC)</DialogTitle>
                        <DialogDescription>Form a committee to handle workplace grievances (Max 10 members, equal employer & employee representation).</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateGRC} className="space-y-4 py-2">
                        <div className="grid gap-2">
                            <Label>Remarks / Notification Reference</Label>
                            <Textarea value={grcRemarks} onChange={e => setGrcRemarks(e.target.value)} placeholder="Enter details about committee formation mandate." />
                        </div>
                        <div className="bg-slate-50 p-3 rounded text-sm text-slate-600 border">
                            <Users className="h-4 w-4 inline mr-2" />
                            (Simulation) The committee will be populated with 1 Employer Rep and 1 Employee Rep for structural compliance.
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4" />} Constitute GRC</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isGrievanceOpen} onOpenChange={setIsGrievanceOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Log Employee Grievance</DialogTitle>
                        <DialogDescription>Register a dispute for the GRC to review.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleLogGrievance} className="space-y-4 py-2">
                        <div className="grid gap-2">
                            <Label>Employee</Label>
                            <Select value={grievanceEmp} onValueChange={setGrievanceEmp}>
                                <SelectTrigger><SelectValue placeholder="Select who raised it..." /></SelectTrigger>
                                <SelectContent>
                                    {employees.map(emp => <SelectItem key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Dispute Details</Label>
                            <Textarea required value={grievanceDesc} onChange={e => setGrievanceDesc(e.target.value)} placeholder="Describe the grievance..." />
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4" />} Submit to GRC</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isEventOpen} onOpenChange={setIsEventOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Register IR Employment Event</DialogTitle>
                        <DialogDescription>Statutory tracking of Layoffs, Retrenchments, or Site Closures.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleLogEvent} className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Event Type</Label>
                                <Select value={eventType} onValueChange={setEventType}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="layoff">Layoff (Temp)</SelectItem>
                                        <SelectItem value="retrenchment">Retrenchment</SelectItem>
                                        <SelectItem value="closure">Establishment Closure</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label>Effective Date</Label>
                                <Input type="date" required value={eventDate} onChange={e => setEventDate(e.target.value)} />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>Affected Workers (Estimated count)</Label>
                            <Input type="number" required value={eventWorkers} onChange={e => setEventWorkers(e.target.value)} />
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4" />} Log Event</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
