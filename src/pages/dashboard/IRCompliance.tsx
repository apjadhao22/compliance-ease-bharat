import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, BookOpen, Users, AlertTriangle, FileText, CheckCircle2, MoreVertical, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function IRCompliance() {
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
                    .select("id")
                    .eq("user_id", user.id)
                    .maybeSingle();

                if (!company) return;

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
                                <Button variant="outline" size="sm" className="w-fit mt-3 bg-white text-destructive border-destructive/30">Form GRC</Button>
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
                                <Button variant="outline" size="sm" className="w-fit mt-3 bg-white text-destructive border-destructive/30">Adopt Orders</Button>
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
                            <Button size="sm" variant="outline" className="gap-2"><Plus className="h-4 w-4" /> New Draft</Button>
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
                            <Button size="sm" variant="outline" className="gap-2"><Plus className="h-4 w-4" /> Log Grievance</Button>
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
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="border border-dashed rounded-lg p-12 text-center text-muted-foreground mt-4 flex flex-col items-center justify-center">
                                <ShieldAlert className="h-8 w-8 mx-auto mb-3 opacity-20 text-destructive" />
                                <p>No major employment events logged.</p>
                                <p className="text-xs max-w-lg mx-auto mt-2">Any layoff or retrenchment must be processed through the F&F Module and linked to an overarching IR Event entry here to track compensation and authority notifications under the IR Code.</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

            </Tabs>
        </div>
    );
}
