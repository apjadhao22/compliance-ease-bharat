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
import { Baby, Loader2, CheckCircle2, Clock, Info, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, addDays } from "date-fns";
import ESSFeatureGate from "@/components/ess/ESSFeatureGate";

interface MaternityCase {
  id: string;
  type: string;
  expected_delivery_date: string;
  actual_delivery_date: string | null;
  eligible_from: string;
  eligible_to: string;
  weeks_allowed: number;
  weeks_taken: number;
  status: string;
}

interface Employee {
  id: string;
  company_id: string;
  gender?: string;
}

const STATUS_STEPS = ["Applied", "Approved", "On Leave", "Returned"];

const ESSMaternity = () => {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [activeCase, setActiveCase] = useState<MaternityCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const [form, setForm] = useState({
    expected_due_date: "",
    type: "maternity",
    notes: "",
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: emp } = await supabase
        .from("employees")
        .select("id, company_id, gender")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!emp) return;
      setEmployee(emp as Employee);

      const { data: cases } = await supabase
        .from("maternity_cases")
        .select("*")
        .eq("employee_id", emp.id)
        .neq("status", "closed")
        .order("created_at", { ascending: false })
        .limit(1);

      if (cases && cases.length > 0) setActiveCase(cases[0] as MaternityCase);
    } finally {
      setLoading(false);
    }
  };

  const getStepIndex = (status: string) => {
    switch (status) {
      case "applied": return 0;
      case "approved": return 1;
      case "ongoing": return 2;
      case "closed": return 3;
      default: return 0;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee || !form.expected_due_date) return;
    setSubmitting(true);
    try {
      const dueDate = new Date(form.expected_due_date);
      const eligibleFrom = addDays(dueDate, -84); // 12 weeks before
      const weeksAllowed = form.type === "maternity" ? 26 : 12;

      const { error } = await supabase.from("maternity_cases").insert({
        employee_id: employee.id,
        company_id: employee.company_id,
        type: form.type === "maternity" ? "birth" : "adoption",
        expected_delivery_date: form.expected_due_date,
        eligible_from: format(eligibleFrom, "yyyy-MM-dd"),
        eligible_to: format(addDays(dueDate, weeksAllowed * 7), "yyyy-MM-dd"),
        weeks_allowed: weeksAllowed,
        status: "planned",
      });

      if (error) throw error;

      // Also create a leave request
      await supabase.from("leave_requests").insert({
        employee_id: employee.id,
        company_id: employee.company_id,
        leave_type: "maternity",
        start_date: format(eligibleFrom, "yyyy-MM-dd"),
        end_date: format(addDays(dueDate, weeksAllowed * 7), "yyyy-MM-dd"),
        days: weeksAllowed * 7,
        reason: form.notes || `${form.type === "maternity" ? "Maternity" : "Adoption"} leave application`,
        status: "pending",
      });

      toast({ title: "Application submitted", description: "Your maternity leave application has been submitted for HR review." });
      setDialogOpen(false);
      setForm({ expected_due_date: "", type: "maternity", notes: "" });
      await loadData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const weeksRemaining = activeCase
    ? Math.max(0, activeCase.weeks_allowed - activeCase.weeks_taken)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ESSFeatureGate feature="maternity_tracking">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Maternity / Leave Tracking</h1>
            <p className="text-muted-foreground">Track maternity entitlements and status</p>
          </div>
          {!activeCase && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Baby className="mr-2 h-4 w-4" />
                  Apply for Maternity Leave
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Apply for Maternity Leave</DialogTitle>
                  <DialogDescription>
                    Submit your application. HR will review and approve.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Leave Type</Label>
                    <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="maternity">Maternity (26 weeks, first 2 children)</SelectItem>
                        <SelectItem value="adoption">Adoption / Commissioning (12 weeks)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="due_date">Expected Due Date</Label>
                    <Input
                      id="due_date"
                      type="date"
                      value={form.expected_due_date}
                      onChange={(e) => setForm((p) => ({ ...p, expected_due_date: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      placeholder="Any additional information..."
                      value={form.notes}
                      onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                      rows={3}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Submit Application
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {activeCase ? (
          <div className="space-y-4">
            {/* Status timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Baby className="h-5 w-5" />
                  Application Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-0">
                  {STATUS_STEPS.map((step, i) => {
                    const stepIdx = getStepIndex(activeCase.status);
                    const done = i <= stepIdx;
                    return (
                      <div key={step} className="flex flex-1 items-center">
                        <div className="flex flex-col items-center gap-1">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold ${done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30 text-muted-foreground"}`}>
                            {done ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                          </div>
                          <span className={`text-xs font-medium ${done ? "text-primary" : "text-muted-foreground"}`}>{step}</span>
                        </div>
                        {i < STATUS_STEPS.length - 1 && (
                          <div className={`mb-4 h-0.5 flex-1 ${i < stepIdx ? "bg-primary" : "bg-muted-foreground/20"}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Details */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Expected Due Date", value: format(new Date(activeCase.expected_delivery_date), "dd MMM yyyy") },
                { label: "Leave Start", value: format(new Date(activeCase.eligible_from), "dd MMM yyyy") },
                { label: "Leave End", value: format(new Date(activeCase.eligible_to), "dd MMM yyyy") },
                { label: "Weeks Entitled", value: `${activeCase.weeks_allowed} weeks` },
                { label: "Weeks Used", value: `${activeCase.weeks_taken} weeks` },
                { label: "Weeks Remaining", value: `${weeksRemaining} weeks` },
              ].map(({ label, value }) => (
                <Card key={label}>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-0.5 text-lg font-semibold">{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Eligibility info */}
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-800">
                  <Info className="h-5 w-5" />
                  Maternity Leave Entitlement
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-blue-900">
                <p><strong>26 weeks</strong> paid maternity leave for first two children.</p>
                <p><strong>12 weeks</strong> for third child onwards.</p>
                <p>Eligibility: Must have worked at least <strong>80 days</strong> in the preceding 12 months.</p>
                <p>For adoption / commissioning mothers: <strong>12 weeks</strong> from the date the child is handed over.</p>
              </CardContent>
            </Card>

            {/* Paternity info for male employees */}
            {employee?.gender === "male" && (
              <Card className="border-green-200 bg-green-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-800">
                    <Info className="h-5 w-5" />
                    Paternity Leave
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-green-900 space-y-2">
                  <p>Paternity leave is governed by company policy (not statutory under central law).</p>
                  <p>Apply via the Leave management section.</p>
                  <Button variant="outline" size="sm" className="mt-1" onClick={() => window.location.href = "/ess/leaves"}>
                    Go to Leave Management <ExternalLink className="ml-1 h-3 w-3" />
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </ESSFeatureGate>
  );
};

export default ESSMaternity;
