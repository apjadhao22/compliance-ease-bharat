import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, FileText, CheckCircle2, Clock, Users, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/PageSkeleton";

// Simple stub for OSH Code dashboard. In a real system this would have full CRUD.
export default function OSHCompliance() {
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

                // Fetch OSH Registrations
                const { data: registrations } = await supabase
                    .from("osh_registrations")
                    .select("*")
                    .eq("company_id", company.id);

                // Fetch OSH Licences
                const { data: licenses } = await supabase
                    .from("osh_licenses")
                    .select("*")
                    .eq("company_id", company.id);

                // Fetch Safety Committees
                const { data: committees } = await supabase
                    .from("safety_committees")
                    .select("*")
                    .eq("company_id", company.id);

                // Aggregate active employees and women night shift stats
                const { data: employees } = await supabase
                    .from("employees")
                    .select("id, gender, night_shift_consent")
                    .eq("company_id", company.id)
                    .in("status", ["Active", "active"]);

                const activeHeadcount = employees?.length || 0;
                const womenWithConsent = employees?.filter(e => e.gender?.toLowerCase() === 'female' && e.night_shift_consent).length || 0;
                const totalWomen = employees?.filter(e => e.gender?.toLowerCase() === 'female').length || 0;

                setData({
                    registrations: registrations || [],
                    licenses: licenses || [],
                    committees: committees || [],
                    activeHeadcount,
                    totalWomen,
                    womenWithConsent
                });

            } catch (e) {
                console.error("Failed to load OSH data:", e);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) return <PageSkeleton />;

    if (!data) return <div>Failed to load.</div>;

    return (
        <div className="space-y-6 pb-8">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Occupational Safety & Health (OSH)</h1>
                <p className="mt-1 text-muted-foreground">Monitor establishment registrations, licences, and welfare compliance under the OSH Code, 2020.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Welfare Triggers Card */}
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

                {/* Women Night Shift Card */}
                <Card className="md:col-span-1 shadow-sm border-purple-200">
                    <CardHeader className="bg-purple-50/50 rounded-t-xl pb-4">
                        <CardTitle className="text-md flex items-center gap-2 text-purple-900">
                            <ShieldAlert className="h-4 w-4" />
                            Women Night Work consent
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
                                Warning: {data.totalWomen - data.womenWithConsent} female workers cannot be assigned night shifts legally.
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Action Items */}
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
                                <span>You have no active establishment registrations under the OSH Code. Check Section 3 applicability.</span>
                                <Button variant="outline" size="sm" className="w-fit mt-1 bg-white">Add Registration</Button>
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
                                <Button variant="outline" size="sm" className="w-fit mt-1 bg-white text-destructive">Form Committee</Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Registrations List */}
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
                            {data.registrations.map((r: any) => (
                                <tr key={r.id} className="hover:bg-muted/20">
                                    <td className="p-3 font-medium">OSH Registration ({r.establishment_type})</td>
                                    <td className="p-3 text-muted-foreground">{r.registration_number}</td>
                                    <td className="p-3">{r.valid_until || 'Indefinite'}</td>
                                    <td className="p-3">{r.state || 'National'}</td>
                                    <td className="p-3 text-right">
                                        <Badge variant="default" className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 border-emerald-500/20">Valid</Badge>
                                    </td>
                                </tr>
                            ))}
                            {data.licenses.map((l: any) => (
                                <tr key={l.id} className="hover:bg-muted/20">
                                    <td className="p-3 font-medium">{l.license_type} License</td>
                                    <td className="p-3 text-muted-foreground">{l.license_number}</td>
                                    <td className="p-3">{l.valid_until}</td>
                                    <td className="p-3">{l.state}</td>
                                    <td className="p-3 text-right">
                                        <Badge variant="outline">{l.renewal_status}</Badge>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
