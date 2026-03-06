import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import {
    ShieldAlert, Plus, Loader2, Users, FileText, ChevronRight, AlertCircle, Download
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getSafeErrorMessage } from "@/lib/safe-error";

type CaseStatus = "Received" | "Under Inquiry" | "Inquiry Complete" | "Closed";
type ICCRole = "Presiding Officer" | "Member" | "External Member";

interface POSHCase {
    id: string;
    case_number: string;
    complainant_name: string;
    respondent_name: string;
    incident_date: string;
    complaint_date: string;
    description: string;
    status: CaseStatus;
    inquiry_findings: string | null;
    action_taken: string | null;
    closure_date: string | null;
    created_at: string;
}

interface ICCMember {
    id: string;
    name: string;
    designation: string | null;
    role: ICCRole;
    appointed_on: string;
    contact_email: string | null;
    employee_id: string | null;
}

const statusOrder: CaseStatus[] = ["Received", "Under Inquiry", "Inquiry Complete", "Closed"];

const getStatusBadge = (status: CaseStatus) => {
    switch (status) {
        case "Received": return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Received</Badge>;
        case "Under Inquiry": return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Under Inquiry</Badge>;
        case "Inquiry Complete": return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Inquiry Complete</Badge>;
        case "Closed": return <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">Closed</Badge>;
    }
};

const POSH = () => {
    const { toast } = useToast();
    const [companyId, setCompanyId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [cases, setCases] = useState<POSHCase[]>([]);
    const [members, setMembers] = useState<ICCMember[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Case dialog state
    const [newCaseOpen, setNewCaseOpen] = useState(false);
    const [advanceOpen, setAdvanceOpen] = useState(false);
    const [selectedCase, setSelectedCase] = useState<POSHCase | null>(null);
    const [findings, setFindings] = useState("");
    const [actionTaken, setActionTaken] = useState("");

    const [newCase, setNewCase] = useState({
        complainant_name: "", respondent_name: "",
        incident_date: "", description: ""
    });

    // ICC member dialog state
    const [memberOpen, setMemberOpen] = useState(false);
    const [newMember, setNewMember] = useState({
        name: "", designation: "", role: "Member" as ICCRole,
        appointed_on: new Date().toISOString().split("T")[0], contact_email: ""
    });

    const fetchData = useCallback(async (cid: string) => {
        const db = supabase as any;
        const [casesRes, membersRes] = await Promise.all([
            db.from("posh_cases").select("*").eq("company_id", cid).order("created_at", { ascending: false }).limit(200),
            db.from("posh_icc_members").select("*").eq("company_id", cid).order("appointed_on", { ascending: true }).limit(50)
        ]);
        if (casesRes.data) setCases(casesRes.data as POSHCase[]);
        if (membersRes.data) setMembers(membersRes.data as ICCMember[]);
    }, []);

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { setLoading(false); return; }
            const { data: comp } = await supabase.from("companies").select("id").eq("user_id", user.id).maybeSingle();
            if (comp) {
                setCompanyId(comp.id);
                await fetchData(comp.id);
            }
            setLoading(false);
        };
        init();
    }, [fetchData]);

    const generateCaseNumber = (existingCount: number) => {
        const year = new Date().getFullYear();
        return `POSH/${year}/${String(existingCount + 1).padStart(3, "0")}`;
    };

    const handleFileCase = async () => {
        if (!companyId) return;
        if (!newCase.complainant_name || !newCase.respondent_name || !newCase.incident_date || !newCase.description) {
            toast({ title: "Missing fields", description: "All fields are mandatory.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        try {
            const db = supabase as any;
            const caseNumber = generateCaseNumber(cases.length);
            const { data, error } = await db.from("posh_cases").insert({
                company_id: companyId,
                case_number: caseNumber,
                complainant_name: newCase.complainant_name,
                respondent_name: newCase.respondent_name,
                incident_date: newCase.incident_date,
                complaint_date: new Date().toISOString().split("T")[0],
                description: newCase.description,
                status: "Received"
            }).select().single();
            if (error) throw error;
            setCases([data as POSHCase, ...cases]);
            setNewCaseOpen(false);
            setNewCase({ complainant_name: "", respondent_name: "", incident_date: "", description: "" });
            toast({ title: "Complaint Registered", description: `Case ${caseNumber} has been confidentially registered.` });
        } catch (e: any) {
            toast({ title: "Error", description: getSafeErrorMessage(e), variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAdvanceStatus = async () => {
        if (!selectedCase) return;
        const currentIdx = statusOrder.indexOf(selectedCase.status);
        if (currentIdx >= statusOrder.length - 1) return;
        const nextStatus = statusOrder[currentIdx + 1];
        setIsSubmitting(true);
        try {
            const db = supabase as any;
            const updates: any = { status: nextStatus, updated_at: new Date().toISOString() };
            if (findings) updates.inquiry_findings = findings;
            if (actionTaken) updates.action_taken = actionTaken;
            if (nextStatus === "Closed") updates.closure_date = new Date().toISOString().split("T")[0];

            const { error } = await db.from("posh_cases").update(updates).eq("id", selectedCase.id);
            if (error) throw error;
            setCases(cases.map(c => c.id === selectedCase.id ? { ...c, ...updates } : c));
            setAdvanceOpen(false);
            setFindings(""); setActionTaken("");
            toast({ title: "Status Updated", description: `Case ${selectedCase.case_number} moved to "${nextStatus}".` });
        } catch (e: any) {
            toast({ title: "Error", description: getSafeErrorMessage(e), variant: "destructive" });
        } finally {
            setIsSubmitting(false);
            setSelectedCase(null);
        }
    };

    const handleAddMember = async () => {
        if (!companyId || !newMember.name || !newMember.role) {
            toast({ title: "Missing fields", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        try {
            const db = supabase as any;
            const { data, error } = await db.from("posh_icc_members").insert({
                company_id: companyId,
                name: newMember.name,
                designation: newMember.designation || null,
                role: newMember.role,
                appointed_on: newMember.appointed_on,
                contact_email: newMember.contact_email || null,
            }).select().single();
            if (error) throw error;
            setMembers([...members, data as ICCMember]);
            setMemberOpen(false);
            setNewMember({ name: "", designation: "", role: "Member", appointed_on: new Date().toISOString().split("T")[0], contact_email: "" });
            toast({ title: "ICC Member Added", description: `${newMember.name} has been added to the committee.` });
        } catch (e: any) {
            toast({ title: "Error", description: getSafeErrorMessage(e), variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemoveMember = async (id: string, name: string) => {
        if (!window.confirm(`Remove ${name} from the ICC?`)) return;
        const { error } = await (supabase as any).from("posh_icc_members").delete().eq("id", id);
        if (error) { toast({ title: "Error", description: getSafeErrorMessage(error), variant: "destructive" }); return; }
        setMembers(members.filter(m => m.id !== id));
        toast({ title: "Member Removed" });
    };

    const exportRegister = () => {
        // Simple CSV export of POSH cases
        const header = "Case No.,Complaint Date,Complainant,Respondent,Incident Date,Status,Findings,Action Taken,Closure Date\n";
        const rows = cases.map(c =>
            `"${c.case_number}","${c.complaint_date}","${c.complainant_name}","${c.respondent_name}","${c.incident_date}","${c.status}","${c.inquiry_findings || ""}","${c.action_taken || ""}","${c.closure_date || ""}"`
        ).join("\n");
        const blob = new Blob([header + rows], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `POSH_Register_${new Date().getFullYear()}.csv`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        toast({ title: "Register Exported" });
    };

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin opacity-40" /></div>;

    const openCases = cases.filter(c => c.status !== "Closed").length;
    const inquiryCases = cases.filter(c => c.status === "Under Inquiry").length;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <ShieldAlert className="h-6 w-6 text-rose-500" /> POSH Compliance
                    </h1>
                    <p className="mt-1 text-muted-foreground text-sm">
                        Prevention of Sexual Harassment at Workplace Act, 2013 &mdash; Confidential Register & ICC Management
                    </p>
                </div>
                <Button variant="outline" onClick={exportRegister} className="gap-2">
                    <Download className="h-4 w-4" /> Export Register
                </Button>
            </div>

            {/* Disclosure Banner */}
            <div className="flex items-start gap-3 p-4 rounded-lg border border-rose-200 bg-rose-50">
                <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                <div className="text-sm text-rose-800">
                    <span className="font-semibold">Confidentiality Notice:</span> All information in this register is strictly confidential under Section 16 of the POSH Act.
                    Disclosure to any person not involved in the inquiry process is a punishable offense.
                </div>
            </div>

            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Cases (All Time)</CardTitle></CardHeader>
                    <CardContent><div className="text-3xl font-bold">{cases.length}</div></CardContent>
                </Card>
                <Card className={openCases > 0 ? "border-amber-200" : ""}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            Open Cases {openCases > 0 && <span className="text-amber-600">(Action Required)</span>}
                        </CardTitle>
                    </CardHeader>
                    <CardContent><div className={`text-3xl font-bold ${openCases > 0 ? "text-amber-600" : ""}`}>{openCases}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">ICC Strength</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{members.length}</div>
                        {members.length < 3 && <p className="text-xs text-destructive mt-1">Min. 3 members required by law</p>}
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="cases">
                <TabsList>
                    <TabsTrigger value="cases" className="gap-2">
                        <FileText className="h-4 w-4" /> Complaints Register
                        {inquiryCases > 0 && <span className="ml-1 w-5 h-5 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center">{inquiryCases}</span>}
                    </TabsTrigger>
                    <TabsTrigger value="icc" className="gap-2"><Users className="h-4 w-4" /> ICC Roster</TabsTrigger>
                </TabsList>

                {/* Complaints Tab */}
                <TabsContent value="cases" className="mt-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between px-6 py-4 border-b">
                            <div>
                                <CardTitle className="text-base">Confidential Complaints Register</CardTitle>
                                <CardDescription>All cases are auto-numbered and time-stamped.</CardDescription>
                            </div>
                            <Button size="sm" onClick={() => setNewCaseOpen(true)} className="gap-2">
                                <Plus className="h-4 w-4" /> File Complaint
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Case No.</TableHead>
                                        <TableHead>Incident Date</TableHead>
                                        <TableHead>Complainant</TableHead>
                                        <TableHead>Respondent</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Filed On</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {cases.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                                                No complaints registered. The register is currently clean.
                                            </TableCell>
                                        </TableRow>
                                    ) : cases.map(c => (
                                        <TableRow key={c.id}>
                                            <TableCell className="font-mono text-xs font-semibold">{c.case_number}</TableCell>
                                            <TableCell className="text-sm">{format(new Date(c.incident_date), "dd MMM yyyy")}</TableCell>
                                            <TableCell className="text-sm">{c.complainant_name}</TableCell>
                                            <TableCell className="text-sm">{c.respondent_name}</TableCell>
                                            <TableCell>{getStatusBadge(c.status)}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{format(new Date(c.complaint_date), "dd MMM yyyy")}</TableCell>
                                            <TableCell className="text-right">
                                                {c.status !== "Closed" && (
                                                    <Button variant="ghost" size="sm" className="gap-1 text-xs h-7"
                                                        onClick={() => { setSelectedCase(c); setAdvanceOpen(true); }}>
                                                        Advance <ChevronRight className="h-3 w-3" />
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ICC Roster Tab */}
                <TabsContent value="icc" className="mt-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between px-6 py-4 border-b">
                            <div>
                                <CardTitle className="text-base">Internal Complaints Committee (ICC)</CardTitle>
                                <CardDescription>Must have minimum 3 members including a Presiding Officer and 1 External Member.</CardDescription>
                            </div>
                            <Button size="sm" onClick={() => setMemberOpen(true)} className="gap-2">
                                <Plus className="h-4 w-4" /> Add Member
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Designation</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Appointed On</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {members.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                                                No ICC members configured. Please add at least 3 members (incl. Presiding Officer & External Member).
                                            </TableCell>
                                        </TableRow>
                                    ) : members.map(m => (
                                        <TableRow key={m.id}>
                                            <TableCell className="font-medium">{m.name}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={
                                                    m.role === "Presiding Officer" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                                        m.role === "External Member" ? "bg-purple-50 text-purple-700 border-purple-200" :
                                                            "bg-gray-50 text-gray-700 border-gray-200"
                                                }>{m.role}</Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{m.designation || "—"}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{m.contact_email || "—"}</TableCell>
                                            <TableCell className="text-sm">{format(new Date(m.appointed_on), "dd MMM yyyy")}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs h-7"
                                                    onClick={() => handleRemoveMember(m.id, m.name)}>
                                                    Remove
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* File New Complaint Dialog */}
            <Dialog open={newCaseOpen} onOpenChange={setNewCaseOpen}>
                <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-rose-500" /> File Confidential Complaint</DialogTitle>
                        <DialogDescription>All information is stored securely under POSH Act confidentiality provisions.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="comp">Complainant Name</Label>
                                <Input id="comp" className="mt-1" value={newCase.complainant_name}
                                    onChange={e => setNewCase({ ...newCase, complainant_name: e.target.value })} />
                            </div>
                            <div>
                                <Label htmlFor="resp">Respondent Name</Label>
                                <Input id="resp" className="mt-1" value={newCase.respondent_name}
                                    onChange={e => setNewCase({ ...newCase, respondent_name: e.target.value })} />
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="idate">Date of Incident</Label>
                            <Input type="date" id="idate" className="mt-1" value={newCase.incident_date}
                                onChange={e => setNewCase({ ...newCase, incident_date: e.target.value })} />
                        </div>
                        <div>
                            <Label htmlFor="desc">Brief Description of Complaint</Label>
                            <Textarea id="desc" className="mt-1 min-h-[100px]" placeholder="Describe the incident factually..."
                                value={newCase.description} onChange={e => setNewCase({ ...newCase, description: e.target.value })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setNewCaseOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button onClick={handleFileCase} disabled={isSubmitting} className="gap-2">
                            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />} Register Complaint
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Advance Status Dialog */}
            <Dialog open={advanceOpen} onOpenChange={setAdvanceOpen}>
                <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle>Advance Case Status — {selectedCase?.case_number}</DialogTitle>
                        <DialogDescription>
                            Moving from <strong>{selectedCase?.status}</strong> →{" "}
                            <strong>{selectedCase ? statusOrder[statusOrder.indexOf(selectedCase.status) + 1] : ""}</strong>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div>
                            <Label>Inquiry Findings (optional)</Label>
                            <Textarea className="mt-1 min-h-[80px]" placeholder="Document factual findings of the inquiry..."
                                value={findings} onChange={e => setFindings(e.target.value)} />
                        </div>
                        <div>
                            <Label>Action Taken (optional)</Label>
                            <Textarea className="mt-1" placeholder="Disciplinary action, counseling, warning, etc..."
                                value={actionTaken} onChange={e => setActionTaken(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAdvanceOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button onClick={handleAdvanceStatus} disabled={isSubmitting} className="gap-2">
                            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />} Confirm Advance
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add ICC Member Dialog */}
            <Dialog open={memberOpen} onOpenChange={setMemberOpen}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle>Add ICC Member</DialogTitle>
                        <DialogDescription>External members must be from an NGO or legal expertise background.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Full Name</Label>
                                <Input className="mt-1" value={newMember.name} onChange={e => setNewMember({ ...newMember, name: e.target.value })} />
                            </div>
                            <div>
                                <Label>Designation</Label>
                                <Input className="mt-1" placeholder="e.g. HR Manager" value={newMember.designation} onChange={e => setNewMember({ ...newMember, designation: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Role</Label>
                                <Select value={newMember.role} onValueChange={(v: ICCRole) => setNewMember({ ...newMember, role: v })}>
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Presiding Officer">Presiding Officer</SelectItem>
                                        <SelectItem value="Member">Member</SelectItem>
                                        <SelectItem value="External Member">External Member</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Appointed On</Label>
                                <Input type="date" className="mt-1" value={newMember.appointed_on} onChange={e => setNewMember({ ...newMember, appointed_on: e.target.value })} />
                            </div>
                        </div>
                        <div>
                            <Label>Contact Email</Label>
                            <Input type="email" className="mt-1" value={newMember.contact_email} onChange={e => setNewMember({ ...newMember, contact_email: e.target.value })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMemberOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button onClick={handleAddMember} disabled={isSubmitting} className="gap-2">
                            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />} Add Member
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default POSH;
