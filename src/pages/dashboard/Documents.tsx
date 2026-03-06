import { useState, useEffect, useCallback, useRef } from "react";
import { format } from "date-fns";
import {
    FileText, Plus, Download, Eye, Pencil, Save, Loader2, ChevronDown
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getSafeErrorMessage } from "@/lib/safe-error";
import EmployeeCombobox from "@/components/EmployeeCombobox";


type DocType = "Offer Letter" | "Appointment Letter" | "NDA" | "Relieving Letter";

interface DocTemplate {
    id?: string;
    template_type: DocType;
    body_html: string;
    letterhead_line: string;
}

interface Employee {
    id: string;
    name: string;
    emp_code: string;
    designation?: string | null;
    department?: string | null;
    basic: number;
    gross: number;
    joining_date?: string | null;
    status: string;
}

// ─── Default Templates ───────────────────────────────────────────────────────
const DEFAULT_TEMPLATES: Record<DocType, string> = {
    "Offer Letter": `Dear {{employee_name}},

We are pleased to offer you the position of {{designation}} in the {{department}} department at {{company_name}}, effective {{start_date}}.

Your compensation package will be as follows:
  • Basic Salary:    ₹{{basic_salary}} per month
  • Gross Salary:   ₹{{gross_salary}} per month

This offer is contingent upon the successful completion of pre-employment verification and joining formalities.

We look forward to welcoming you to the team.

Sincerely,
Human Resources
{{company_name}}`,

    "Appointment Letter": `Dear {{employee_name}},

With reference to your application and subsequent interview, we are pleased to appoint you as {{designation}} in the {{department}} department, with effect from {{start_date}}.

Terms of Employment:
  • Designation:    {{designation}}
  • Department:    {{department}}
  • Basic Salary:   ₹{{basic_salary}} per month
  • Gross CTC:     ₹{{gross_salary}} per month

Your appointment is subject to the rules and regulations of the company as in force from time to time.

Please sign and return a copy of this letter as a token of your acceptance.

Yours faithfully,
Authorised Signatory
{{company_name}}`,

    "NDA": `NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into on {{today_date}} between:

{{company_name}} ("Company"), and
{{employee_name}}, an employee in the role of {{designation}} ("Employee").

1. CONFIDENTIAL INFORMATION
   The Employee agrees not to disclose any confidential or proprietary information of the Company during or after employment.

2. OBLIGATIONS
   The Employee shall not use confidential information for personal gain or disclose it to any third party without prior written consent.

3. DURATION
   This Agreement remains in effect during the entire period of employment and for three (3) years thereafter.

4. REMEDIES
   Breach of this Agreement entitles the Company to seek injunctive relief and other legal remedies.

Employee Signature: _____________________     Date: ___________
Name: {{employee_name}}

Company Signature: _____________________     Date: ___________
For {{company_name}}`,

    "Relieving Letter": `Date: {{today_date}}

To Whom It May Concern,

This is to certify that {{employee_name}} (Employee Code: {{emp_code}}) has been employed with {{company_name}} as {{designation}} in the {{department}} department from {{start_date}} to {{today_date}}.

{{employee_name}} has been relieved from duties with all formalities completed to the satisfaction of the Management. We wish {{employee_name}} the very best in their future endeavours.

Sincerely,
Human Resources
{{company_name}}`
};

const DOC_TYPES: DocType[] = ["Offer Letter", "Appointment Letter", "NDA", "Relieving Letter"];

const PLACEHOLDERS: { key: string; description: string }[] = [
    { key: "{{employee_name}}", description: "Employee full name" },
    { key: "{{emp_code}}", description: "Employee code" },
    { key: "{{designation}}", description: "Role / designation" },
    { key: "{{department}}", description: "Department" },
    { key: "{{company_name}}", description: "Your company name" },
    { key: "{{start_date}}", description: "Joining / start date" },
    { key: "{{today_date}}", description: "Today's date" },
    { key: "{{basic_salary}}", description: "Basic salary ₹" },
    { key: "{{gross_salary}}", description: "Gross salary ₹" },
];

// ─── PDF Generator ────────────────────────────────────────────────────────────
async function generatePDF(
    body: string,
    employee: Employee,
    docType: DocType,
    letterheadLine: string,
    companyName: string
) {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 25;
    const textWidth = pageW - margin * 2;

    // Letterhead
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(companyName, pageW / 2, 22, { align: "center" });

    if (letterheadLine) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text(letterheadLine, pageW / 2, 29, { align: "center" });
        doc.setTextColor(0, 0, 0);
    }

    // Divider
    doc.setDrawColor(80, 80, 200);
    doc.setLineWidth(0.7);
    doc.line(margin, 33, pageW - margin, 33);

    // Doc type header
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 50, 150);
    doc.text(docType.toUpperCase(), pageW / 2, 41, { align: "center" });
    doc.setTextColor(0, 0, 0);

    // Body
    doc.setFontSize(10.5);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(body, textWidth);
    let y = 50;
    lines.forEach((line: string) => {
        if (y > 270) {
            doc.addPage();
            y = 20;
        }
        doc.text(line, margin, y);
        y += 6;
    });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(`Confidential — Generated on ${format(new Date(), "dd MMM yyyy 'at' HH:mm")}`, margin, 287);
    doc.text(companyName, pageW - margin, 287, { align: "right" });

    const filename = `${docType.replace(/ /g, "_")}_${employee.name.replace(/ /g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`;
    doc.save(filename);
}

// ─── Placeholder substitution ─────────────────────────────────────────────────
function fillTemplate(
    template: string,
    employee: Employee,
    companyName: string
): string {
    return template
        .replace(/{{employee_name}}/g, employee.name || "")
        .replace(/{{emp_code}}/g, employee.emp_code || "")
        .replace(/{{designation}}/g, employee.designation || "")
        .replace(/{{department}}/g, employee.department || "")
        .replace(/{{company_name}}/g, companyName)
        .replace(/{{start_date}}/g, employee.joining_date ? format(new Date(employee.joining_date), "dd MMM yyyy") : "")
        .replace(/{{today_date}}/g, format(new Date(), "dd MMM yyyy"))
        .replace(/{{basic_salary}}/g, employee.basic ? employee.basic.toLocaleString("en-IN") : "")
        .replace(/{{gross_salary}}/g, employee.gross ? employee.gross.toLocaleString("en-IN") : "");
}

// ─── Main Component ───────────────────────────────────────────────────────────
const Documents = () => {
    const { toast } = useToast();
    const [companyId, setCompanyId] = useState<string | null>(null);
    const [companyName, setCompanyName] = useState("");
    const [letterheadLine, setLetterheadLine] = useState("");
    const [loading, setLoading] = useState(true);

    const [templates, setTemplates] = useState<Record<DocType, string>>({ ...DEFAULT_TEMPLATES });
    const [templateIds, setTemplateIds] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);

    // Template editor state
    const [editingType, setEditingType] = useState<DocType>("Offer Letter");
    const [editBody, setEditBody] = useState(DEFAULT_TEMPLATES["Offer Letter"]);

    // Generate dialog state
    const [genOpen, setGenOpen] = useState(false);
    const [selectedEmpId, setSelectedEmpId] = useState("");
    const [selectedEmpData, setSelectedEmpData] = useState<Employee | null>(null);
    const [selectedDocType, setSelectedDocType] = useState<DocType>("Offer Letter");
    const [previewBody, setPreviewBody] = useState("");
    const [showPreview, setShowPreview] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        const { data: comp } = await supabase.from("companies").select("id, name").eq("user_id", user.id).maybeSingle();
        if (!comp) { setLoading(false); return; }
        setCompanyId(comp.id);
        setCompanyName(comp.name || "");

        const db = supabase as any;
        const [tmplRes] = await Promise.all([
            db.from("document_templates").select("*").eq("company_id", comp.id)
        ]);

        if (tmplRes.data && tmplRes.data.length > 0) {
            const tmplMap: Record<DocType, string> = { ...DEFAULT_TEMPLATES };
            const idMap: Record<string, string> = {};
            (tmplRes.data as any[]).forEach(t => {
                tmplMap[t.template_type as DocType] = t.body_html;
                idMap[t.template_type] = t.id;
                if (t.letterhead_line) setLetterheadLine(t.letterhead_line);
            });
            setTemplates(tmplMap);
            setTemplateIds(idMap);
            setEditBody(tmplMap["Offer Letter"]);
        }
        setLoading(false);
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // Sync editor when switching template type
    useEffect(() => {
        setEditBody(templates[editingType]);
        setShowPreview(false);
    }, [editingType]);

    const handleSaveTemplate = async () => {
        if (!companyId) return;
        setIsSaving(true);
        const db = supabase as any;
        const payload = {
            company_id: companyId,
            template_type: editingType,
            body_html: editBody,
            letterhead_line: letterheadLine,
            updated_at: new Date().toISOString()
        };
        try {
            const existingId = templateIds[editingType];
            if (existingId) {
                const { error } = await db.from("document_templates").update(payload).eq("id", existingId);
                if (error) throw error;
            } else {
                const { data, error } = await db.from("document_templates").insert(payload).select().single();
                if (error) throw error;
                setTemplateIds({ ...templateIds, [editingType]: data.id });
            }
            setTemplates({ ...templates, [editingType]: editBody });
            toast({ title: "Template Saved", description: `${editingType} template updated.` });
        } catch (e: any) {
            toast({ title: "Error", description: getSafeErrorMessage(e), variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handlePreview = async () => {
        if (!selectedEmpId) { toast({ title: "Select an employee first", variant: "destructive" }); return; }
        const { data: emp, error } = await supabase.from('employees').select('id, name, emp_code, designation, department, basic, gross, joining_date, status').eq('id', selectedEmpId).single();
        if (error || !emp) { toast({ title: "Failed to load employee data", variant: "destructive" }); return; }
        setSelectedEmpData(emp as Employee);
        const filled = fillTemplate(templates[selectedDocType], emp as Employee, companyName);
        setPreviewBody(filled);
        setShowPreview(true);
    };

    const handleDownloadPDF = async () => {
        const emp = selectedEmpData;
        if (!emp) { await handlePreview(); return; }
        const body = fillTemplate(templates[selectedDocType], emp, companyName);
        generatePDF(body, emp, selectedDocType, letterheadLine, companyName);
        toast({ title: "PDF Downloaded", description: `${selectedDocType} for ${emp.name} saved.` });
    };

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin opacity-40" /></div>;

    const selectedEmp = selectedEmpData;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <FileText className="h-6 w-6 text-primary" /> Document Generator
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Create branded, pre-filled HR letters using customisable templates.
                    </p>
                </div>
                <Button className="gap-2 self-start sm:self-auto" onClick={() => { setGenOpen(true); setShowPreview(false); setSelectedEmpId(""); }}>
                    <Plus className="h-4 w-4" /> Generate Letter
                </Button>
            </div>

            <Tabs defaultValue="templates">
                <TabsList>
                    <TabsTrigger value="templates">📝 Templates</TabsTrigger>
                    <TabsTrigger value="placeholders">📌 Placeholders</TabsTrigger>
                </TabsList>

                {/* ── Templates tab ─────────────────────────────────────────── */}
                <TabsContent value="templates" className="mt-4">
                    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
                        {/* Sidebar: doc type selector */}
                        <div className="space-y-2">
                            {/* Letterhead line */}
                            <Card className="p-4">
                                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Company Tagline / Address</Label>
                                <Input className="mt-2 text-sm" placeholder="e.g. 123 Business Park, Mumbai" value={letterheadLine} onChange={e => setLetterheadLine(e.target.value)} />
                            </Card>

                            {DOC_TYPES.map(type => (
                                <button
                                    key={type}
                                    onClick={() => setEditingType(type)}
                                    className={`w-full text-left rounded-lg px-4 py-3 text-sm font-medium border transition-colors ${editingType === type ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-accent"
                                        }`}
                                >
                                    {type}
                                    {templateIds[type] && (
                                        <span className="ml-2 text-xs opacity-60">✓ Saved</span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Editor */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between border-b px-6 py-4">
                                <div>
                                    <CardTitle className="text-base">{editingType}</CardTitle>
                                    <CardDescription className="text-xs mt-1">Edit template body. Use {"{{placeholder}}"} syntax for dynamic data.</CardDescription>
                                </div>
                                <Button size="sm" onClick={handleSaveTemplate} disabled={isSaving} className="gap-2">
                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
                                </Button>
                            </CardHeader>
                            <CardContent className="p-4">
                                <Textarea
                                    className="min-h-[460px] font-mono text-sm leading-relaxed"
                                    value={editBody}
                                    onChange={e => setEditBody(e.target.value)}
                                />
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* ── Placeholders tab (reference) ──────────────────────────── */}
                <TabsContent value="placeholders" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Available Placeholders</CardTitle>
                            <CardDescription>These will be auto-filled from the selected employee's profile when generating a letter.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {PLACEHOLDERS.map(p => (
                                    <div key={p.key} className="flex items-center gap-3 rounded-lg border p-3 bg-muted/30">
                                        <code className="text-xs font-mono bg-primary/10 text-primary rounded px-2 py-1 shrink-0">{p.key}</code>
                                        <span className="text-sm text-muted-foreground">{p.description}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* ── Generate Letter Dialog ────────────────────────────────────── */}
            <Dialog open={genOpen} onOpenChange={setGenOpen}>
                <DialogContent className="sm:max-w-[680px] max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Generate Letter</DialogTitle>
                        <DialogDescription>Select an employee and document type to preview or download the letter.</DialogDescription>
                    </DialogHeader>

                    <div className="flex gap-4 py-4 shrink-0">
                        <div className="flex-1">
                            <Label>Employee</Label>
                            <EmployeeCombobox
                                companyId={companyId}
                                value={selectedEmpId}
                                onSelect={(id) => {
                                    setSelectedEmpId(id);
                                    setShowPreview(false);
                                }}
                                placeholder="Search by name or code..."
                                className="w-full mt-1"
                            />
                        </div>
                        <div className="flex-1">
                            <Label>Document Type</Label>
                            <Select value={selectedDocType} onValueChange={v => { setSelectedDocType(v as DocType); setShowPreview(false); }}>
                                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Employee info pill */}
                    {selectedEmp && (
                        <div className="flex flex-wrap gap-2 shrink-0">
                            <Badge variant="outline">🏷 {selectedEmp.designation || "No designation"}</Badge>
                            <Badge variant="outline">🏢 {selectedEmp.department || "No department"}</Badge>
                            <Badge variant="outline">📅 {selectedEmp.joining_date ? format(new Date(selectedEmp.joining_date), "dd MMM yyyy") : "No joining date"}</Badge>
                            <Badge variant="outline">💰 ₹{selectedEmp.gross?.toLocaleString("en-IN")} gross</Badge>
                        </div>
                    )}

                    {/* Preview area */}
                    {showPreview && (
                        <div className="overflow-y-auto flex-1 border rounded-md bg-white p-6 mt-2">
                            <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-gray-800">{previewBody}</pre>
                        </div>
                    )}

                    <DialogFooter className="gap-2 pt-2 shrink-0">
                        <Button variant="outline" onClick={() => setGenOpen(false)}>Close</Button>
                        <Button variant="outline" onClick={handlePreview} className="gap-2" disabled={!selectedEmpId}>
                            <Eye className="h-4 w-4" /> {showPreview ? "Refresh Preview" : "Preview"}
                        </Button>
                        <Button onClick={handleDownloadPDF} className="gap-2" disabled={!selectedEmpId}>
                            <Download className="h-4 w-4" /> Download PDF
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Documents;
