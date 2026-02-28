import { useState, useEffect, useCallback } from "react";
import {
    History, Filter, Download, ChevronDown, ChevronRight, Loader2, Search
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface AuditEntry {
    id: string;
    actor_email: string;
    action: string;
    entity_type: string;
    entity_label: string | null;
    old_values: Record<string, any> | null;
    new_values: Record<string, any> | null;
    created_at: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
    salary_change: { label: "Salary Change", color: "bg-amber-50 text-amber-700 border-amber-200" },
    status_change: { label: "Status Change", color: "bg-blue-50 text-blue-700 border-blue-200" },
    new_employee: { label: "New Employee", color: "bg-green-50 text-green-700 border-green-200" },
    payroll_run: { label: "Payroll Run", color: "bg-purple-50 text-purple-700 border-purple-200" },
    posh_status_change: { label: "POSH Status", color: "bg-red-50 text-red-700 border-red-200" },
    employee_terminated: { label: "Termination", color: "bg-red-50 text-red-700 border-red-200" },
    general: { label: "General", color: "bg-gray-50 text-gray-700 border-gray-200" },
};

const ENTITY_ICONS: Record<string, string> = {
    employee: "👤",
    payroll_run: "💰",
    posh_case: "🛡",
};

function DiffView({ oldValues, newValues }: { oldValues: Record<string, any> | null; newValues: Record<string, any> | null }) {
    if (!oldValues && !newValues) return <p className="text-xs text-muted-foreground">No details available.</p>;

    const allKeys = Array.from(new Set([
        ...Object.keys(oldValues || {}),
        ...Object.keys(newValues || {})
    ]));

    return (
        <div className="grid gap-1 mt-2">
            {allKeys.map(key => {
                const oldVal = oldValues?.[key];
                const newVal = newValues?.[key];
                const changed = String(oldVal) !== String(newVal);
                return (
                    <div key={key} className={`flex items-center gap-2 text-xs rounded px-2 py-1 ${changed ? "bg-amber-50" : "bg-muted/30"}`}>
                        <span className="font-mono text-muted-foreground w-32 shrink-0">{key}:</span>
                        {oldVal !== undefined && <span className="line-through text-red-500">{String(oldVal)}</span>}
                        {changed && oldVal !== undefined && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                        {newVal !== undefined && <span className="text-green-700 font-medium">{String(newVal)}</span>}
                    </div>
                );
            })}
        </div>
    );
}

const AuditLog = () => {
    const { toast } = useToast();
    const [companyId, setCompanyId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [entries, setEntries] = useState<AuditEntry[]>([]);
    const [expanded, setExpanded] = useState<string | null>(null);

    // Filters
    const [search, setSearch] = useState("");
    const [actionFilter, setActionFilter] = useState("all");
    const [dateFrom, setDateFrom] = useState("");

    const loadLog = useCallback(async (cid: string) => {
        setLoading(true);
        let q = (supabase as any).from("audit_log").select("*").eq("company_id", cid).order("created_at", { ascending: false }).limit(200);
        if (actionFilter !== "all") q = q.eq("action", actionFilter);
        if (dateFrom) q = q.gte("created_at", `${dateFrom}T00:00:00`);
        const { data, error } = await q;
        if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
        setEntries((data || []) as AuditEntry[]);
        setLoading(false);
    }, [actionFilter, dateFrom]);

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data: comp } = await supabase.from("companies").select("id").eq("user_id", user.id).maybeSingle();
            if (comp) { setCompanyId(comp.id); await loadLog(comp.id); }
        };
        init();
    }, [loadLog]);

    const filtered = entries.filter(e => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (e.actor_email?.toLowerCase().includes(q) ||
            e.entity_label?.toLowerCase().includes(q) ||
            e.action?.toLowerCase().includes(q));
    });

    const handleExport = () => {
        if (!filtered.length) return;
        const rows = filtered.map(e => [
            format(new Date(e.created_at), "dd/MM/yyyy HH:mm"),
            e.actor_email,
            e.action,
            e.entity_type,
            e.entity_label || "",
            JSON.stringify(e.old_values || {}),
            JSON.stringify(e.new_values || {})
        ]);
        const csv = ["Date,Actor,Action,Entity Type,Entity,Old Values,New Values", ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `audit_log_${format(new Date(), "yyyyMMdd")}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <History className="h-6 w-6 text-primary" /> Audit Trail
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Immutable log of all compliance-critical changes — who changed what and when.
                    </p>
                </div>
                <Button variant="outline" onClick={handleExport} className="gap-2 self-start sm:self-auto">
                    <Download className="h-4 w-4" /> Export CSV
                </Button>
            </div>

            {/* Filters */}
            <Card className="p-4">
                <div className="flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[180px]">
                        <Label className="text-xs">Search</Label>
                        <div className="relative mt-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input className="pl-8" placeholder="Employee name, actor..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <Label className="text-xs">Action Type</Label>
                        <Select value={actionFilter} onValueChange={setActionFilter}>
                            <SelectTrigger className="mt-1 w-44"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Actions</SelectItem>
                                {Object.entries(ACTION_LABELS).map(([key, { label }]) => (
                                    <SelectItem key={key} value={key}>{label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label className="text-xs">From Date</Label>
                        <Input type="date" className="mt-1 w-40" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                    </div>
                    <Badge variant="outline" className="mb-0.5">{filtered.length} entries</Badge>
                </div>
            </Card>

            {/* Log Table */}
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin opacity-40" /></div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                            <History className="h-10 w-10 opacity-20" />
                            <p className="font-medium">No audit entries yet</p>
                            <p className="text-sm">Changes to employee salaries, statuses, and payroll runs will appear here.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-8"></TableHead>
                                    <TableHead>When</TableHead>
                                    <TableHead>Actor</TableHead>
                                    <TableHead>Action</TableHead>
                                    <TableHead>Entity</TableHead>
                                    <TableHead>Record</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map(e => {
                                    const actionMeta = ACTION_LABELS[e.action] || ACTION_LABELS.general;
                                    const isExpanded = expanded === e.id;
                                    return (
                                        <>
                                            <TableRow
                                                key={e.id}
                                                className="cursor-pointer hover:bg-muted/40"
                                                onClick={() => setExpanded(isExpanded ? null : e.id)}
                                            >
                                                <TableCell className="text-muted-foreground">
                                                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                </TableCell>
                                                <TableCell className="text-sm whitespace-nowrap">
                                                    {format(new Date(e.created_at), "dd MMM yyyy")}
                                                    <span className="block text-xs text-muted-foreground">{format(new Date(e.created_at), "HH:mm")}</span>
                                                </TableCell>
                                                <TableCell className="text-sm max-w-[160px] truncate">{e.actor_email}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={`text-xs ${actionMeta.color}`}>{actionMeta.label}</Badge>
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    <span className="mr-1">{ENTITY_ICONS[e.entity_type] || "📝"}</span>
                                                    {e.entity_type}
                                                </TableCell>
                                                <TableCell className="font-medium text-sm">{e.entity_label || "—"}</TableCell>
                                            </TableRow>
                                            {isExpanded && (
                                                <TableRow key={`${e.id}-detail`} className="bg-muted/20">
                                                    <TableCell colSpan={6} className="px-8 pb-4">
                                                        <DiffView oldValues={e.old_values} newValues={e.new_values} />
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default AuditLog;
