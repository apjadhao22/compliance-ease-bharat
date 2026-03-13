import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Shield, Plus, Loader2, Info, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import ESSFeatureGate from "@/components/ess/ESSFeatureGate";

const NATURES = [
  { value: "verbal", label: "Verbal" },
  { value: "physical", label: "Physical" },
  { value: "visual", label: "Visual" },
  { value: "quid_pro_quo", label: "Quid Pro Quo" },
  { value: "hostile_environment", label: "Hostile Environment" },
  { value: "cyber_online", label: "Cyber / Online" },
  { value: "other", label: "Other" },
];

const STATUS_STYLE: Record<string, string> = {
  Received: "bg-blue-100 text-blue-800",
  "Under Inquiry": "bg-yellow-100 text-yellow-800",
  "Inquiry Complete": "bg-purple-100 text-purple-800",
  Closed: "bg-gray-100 text-gray-600",
};

interface PoshCase {
  id: string;
  complaint_date: string;
  status: string;
  next_hearing_date: string | null;
  complaint_nature: string | null;
}

const ESSPosh = () => {
  const [employee, setEmployee] = useState<{ id: string; company_id: string } | null>(null);
  const [cases, setCases] = useState<PoshCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const [form, setForm] = useState({
    complaint_nature: "verbal",
    incident_date: "",
    description: "",
    witness_names: "",
    evidence_file: null as File | null,
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: emp } = await supabase
        .from("employees")
        .select("id, company_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (!emp) return;
      setEmployee(emp);

      const { data } = await supabase
        .from("posh_cases")
        .select("id, complaint_date, status, next_hearing_date, complaint_nature")
        .eq("complainant_employee_id", emp.id)
        .order("created_at", { ascending: false });

      if (data) setCases(data as PoshCase[]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee || !form.description || !form.incident_date) return;
    setSubmitting(true);
    try {
      let evidencePath: string | null = null;

      if (form.evidence_file) {
        const ext = form.evidence_file.name.split(".").pop();
        const path = `posh-complaints/${employee.company_id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("documents")
          .upload(path, form.evidence_file);
        if (!upErr) evidencePath = path;
      }

      const caseNumber = `POSH-${Date.now().toString(36).toUpperCase()}`;

      const { error } = await supabase.from("posh_cases").insert({
        company_id: employee.company_id,
        complainant_employee_id: employee.id,
        case_number: caseNumber,
        complainant_name: "Confidential",
        respondent_name: "Under Review",
        incident_date: form.incident_date,
        complaint_date: new Date().toISOString().split("T")[0],
        description: form.description,
        complaint_nature: form.complaint_nature,
        witness_names: form.witness_names || null,
        evidence_path: evidencePath,
        description_ess: form.description,
        status: "Received",
        is_confidential: true,
      });

      if (error) throw error;
      toast({ title: "Complaint filed", description: "Your complaint has been received and will be treated with strict confidentiality." });
      setDialogOpen(false);
      setForm({ complaint_nature: "verbal", incident_date: "", description: "", witness_names: "", evidence_file: null });
      await loadData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ESSFeatureGate feature="posh_complaint">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">POSH — Complaint Filing</h1>
            <p className="text-muted-foreground">Sexual Harassment of Women at Workplace Act, 2013</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive">
                <Plus className="mr-2 h-4 w-4" />
                File Complaint
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>File a POSH Complaint</DialogTitle>
                <DialogDescription>All complaints are treated with strict confidentiality.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nature of Complaint</Label>
                  <Select value={form.complaint_nature} onValueChange={(v) => setForm((p) => ({ ...p, complaint_nature: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {NATURES.map((n) => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="incident_date">Date of Incident</Label>
                  <Input
                    id="incident_date"
                    type="date"
                    value={form.incident_date}
                    onChange={(e) => setForm((p) => ({ ...p, incident_date: e.target.value }))}
                    required
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="desc_posh">Description</Label>
                  <Textarea
                    id="desc_posh"
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Describe the incident in detail..."
                    rows={5}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="witnesses">Witness Names (optional)</Label>
                  <Input
                    id="witnesses"
                    value={form.witness_names}
                    onChange={(e) => setForm((p) => ({ ...p, witness_names: e.target.value }))}
                    placeholder="Comma-separated names of witnesses"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="evidence">Evidence (optional)</Label>
                  <Input
                    id="evidence"
                    type="file"
                    onChange={(e) => setForm((p) => ({ ...p, evidence_file: e.target.files?.[0] ?? null }))}
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  />
                  <p className="text-xs text-muted-foreground">PDF, images, or documents accepted.</p>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" variant="destructive" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Submit Complaint
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Info section */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm text-red-800">
                <Shield className="h-4 w-4" /> What POSH Covers
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-red-900 space-y-2">
              <p>The <strong>Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013</strong> protects women from sexual harassment at the workplace.</p>
              <p>This includes verbal, physical, visual, and online forms of harassment.</p>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm text-blue-800">
                <Lock className="h-4 w-4" /> Confidentiality & Recourse
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-blue-900 space-y-2">
              <p>All complaints are treated with <strong>strict confidentiality</strong>.</p>
              <p>The Internal Committee (IC) will review within the prescribed timeline.</p>
              <p>You may also file a complaint with the <strong>Local Complaints Committee</strong> through the District Officer.</p>
            </CardContent>
          </Card>
        </div>

        {/* My complaints */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              My Complaints
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {cases.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No complaints filed.</p>
            ) : (
              <div className="divide-y">
                {cases.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">
                        {c.complaint_nature ? c.complaint_nature.replace(/_/g, " ") : "Complaint"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Filed: {format(new Date(c.complaint_date), "dd MMM yyyy")}
                        {c.next_hearing_date && (
                          <> · Next hearing: {format(new Date(c.next_hearing_date), "dd MMM yyyy")}</>
                        )}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[c.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {c.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ESSFeatureGate>
  );
};

export default ESSPosh;
