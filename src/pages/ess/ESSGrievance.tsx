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
import { Switch } from "@/components/ui/switch";
import { Plus, Loader2, Info, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import ESSFeatureGate from "@/components/ess/ESSFeatureGate";

const CATEGORIES = [
  { value: "workplace_safety", label: "Workplace Safety" },
  { value: "harassment", label: "Harassment" },
  { value: "wage_dispute", label: "Wage Dispute" },
  { value: "discrimination", label: "Discrimination" },
  { value: "working_conditions", label: "Working Conditions" },
  { value: "other", label: "Other" },
];

const STATUS_STYLE: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-800",
  under_review: "bg-yellow-100 text-yellow-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-600",
};

interface Grievance {
  id: string;
  description: string;
  created_at: string;
  category: string | null;
  is_anonymous: boolean;
  employee_visible_status: string;
  resolution_notes: string | null;
  subject?: string;
}

const ESSGrievance = () => {
  const [employee, setEmployee] = useState<{ id: string; company_id: string } | null>(null);
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const [form, setForm] = useState({
    subject: "",
    category: "workplace_safety",
    description: "",
    is_anonymous: false,
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
        .from("grievances")
        .select("id, description, created_at, category, is_anonymous, employee_visible_status, resolution_notes")
        .eq("submitted_by_employee_id", emp.id)
        .order("created_at", { ascending: false });

      if (data) setGrievances(data as Grievance[]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    if (form.description.length < 50) {
      toast({ variant: "destructive", title: "Description too short", description: "Please provide at least 50 characters." });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("grievances").insert({
        company_id: employee.company_id,
        employee_id: employee.id,
        submitted_by: user?.id,
        submitted_by_employee_id: employee.id,
        description: `[${form.subject}]\n\n${form.description}`,
        category: form.category,
        is_anonymous: form.is_anonymous,
        employee_visible_status: "submitted",
        status: "open",
      });
      if (error) throw error;
      toast({ title: "Grievance filed", description: "Your grievance has been submitted to the Grievance Redressal Committee." });
      setDialogOpen(false);
      setForm({ subject: "", category: "workplace_safety", description: "", is_anonymous: false });
      await loadData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ESSFeatureGate feature="grievance">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Grievance</h1>
            <p className="text-muted-foreground">File and track workplace grievances</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />File Grievance</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>File a Grievance</DialogTitle>
                <DialogDescription>All submissions are reviewed by the Grievance Redressal Committee.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    value={form.subject}
                    onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                    placeholder="Brief subject of the grievance"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="desc">Description <span className="text-muted-foreground text-xs">(min 50 characters)</span></Label>
                  <Textarea
                    id="desc"
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Describe the grievance in detail..."
                    rows={5}
                    required
                  />
                  <p className="text-xs text-muted-foreground text-right">{form.description.length}/50 min</p>
                </div>
                <div className="flex items-start gap-3 rounded-md border p-3">
                  <Switch
                    id="anonymous"
                    checked={form.is_anonymous}
                    onCheckedChange={(v) => setForm((p) => ({ ...p, is_anonymous: v }))}
                  />
                  <div>
                    <Label htmlFor="anonymous" className="cursor-pointer font-medium">File Anonymously</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Your identity is recorded for tracking but hidden from the review committee.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Submit
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Info banner */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="flex items-start gap-3 pt-4 text-sm text-blue-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Grievances are reviewed by the Grievance Redressal Committee. For companies with 20+ employees,
              this committee is mandatory under the <strong>Industrial Relations Code, 2020</strong>.
            </p>
          </CardContent>
        </Card>

        {/* Grievances list */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              My Grievances
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {grievances.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No grievances filed yet.</p>
            ) : (
              <div className="divide-y">
                {grievances.map((g) => {
                  const lines = g.description.split("\n\n");
                  const subject = lines[0]?.replace(/^\[|\]$/g, "") ?? "Grievance";
                  const body = lines.slice(1).join("\n\n");
                  const isOpen = expanded.has(g.id);
                  return (
                    <div key={g.id} className="px-4 py-3">
                      <div
                        className="flex cursor-pointer items-start justify-between gap-3"
                        onClick={() => toggleExpand(g.id)}
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{subject}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(g.created_at), "dd MMM yyyy")}
                            </span>
                            {g.category && (
                              <span className="text-xs text-muted-foreground capitalize">
                                {g.category.replace(/_/g, " ")}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLE[g.employee_visible_status] ?? "bg-gray-100 text-gray-600"}`}>
                            {g.employee_visible_status.replace(/_/g, " ")}
                          </span>
                          {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>
                      {isOpen && (
                        <div className="mt-3 space-y-2">
                          <div className="rounded-md bg-muted/40 p-3 text-sm whitespace-pre-wrap">{body}</div>
                          {g.resolution_notes && (
                            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm">
                              <p className="font-medium text-green-800 mb-1">Resolution Notes</p>
                              <p className="text-green-900">{g.resolution_notes}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ESSFeatureGate>
  );
};

export default ESSGrievance;
