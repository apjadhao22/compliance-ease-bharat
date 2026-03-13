import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Scale, Plus, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getSafeErrorMessage } from "@/lib/safe-error";
import { format } from "date-fns";
import ESSFeatureGate from "@/components/ess/ESSFeatureGate";

interface CompOffRequest {
  id: string;
  worked_date: string;
  avail_date: string | null;
  reason: string;
  status: "pending" | "approved" | "rejected" | "availed";
  review_comment: string | null;
  created_at: string;
}

const statusConfig = {
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800" },
  approved: { label: "Approved", className: "bg-green-100 text-green-800" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800" },
  availed: { label: "Availed", className: "bg-blue-100 text-blue-800" },
};

const ESSCompOff = () => {
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [requests, setRequests] = useState<CompOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    worked_date: "",
    avail_date: "",
    reason: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

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
      setEmployeeId(emp.id);
      setCompanyId(emp.company_id);

      const { data } = await supabase
        .from("comp_off_requests")
        .select("id, worked_date, avail_date, reason, status, review_comment, created_at")
        .eq("employee_id", emp.id)
        .order("created_at", { ascending: false });

      setRequests((data ?? []) as CompOffRequest[]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!employeeId || !companyId) return;
    if (!form.worked_date || !form.reason.trim()) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }

    // Validate: worked_date must be in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(form.worked_date) >= today) {
      toast({ title: "Worked date must be in the past", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        employee_id: employeeId,
        company_id: companyId,
        worked_date: form.worked_date,
        reason: form.reason.trim(),
      };
      if (form.avail_date) payload.avail_date = form.avail_date;

      const { error } = await supabase.from("comp_off_requests").insert(payload);
      if (error) throw error;

      toast({ title: "Comp-off request submitted" });
      setDialogOpen(false);
      setForm({ worked_date: "", avail_date: "", reason: "" });
      loadData();
    } catch (err) {
      toast({ title: "Failed to submit", description: getSafeErrorMessage(err), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const maxDate = format(new Date(Date.now() - 86400000), "yyyy-MM-dd");

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ESSFeatureGate feature="comp_off">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Comp-Off Requests</h1>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Request
          </Button>
        </div>

        {/* Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Comp-Off</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Date Worked (holiday/off-day) *</Label>
                <input
                  type="date"
                  max={maxDate}
                  value={form.worked_date}
                  onChange={(e) => setForm((f) => ({ ...f, worked_date: e.target.value }))}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Must be a holiday or weekly off when you worked.
                </p>
              </div>
              <div>
                <Label>Preferred Avail Date (optional)</Label>
                <input
                  type="date"
                  min={format(new Date(), "yyyy-MM-dd")}
                  value={form.avail_date}
                  onChange={(e) => setForm((f) => ({ ...f, avail_date: e.target.value }))}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                />
              </div>
              <div>
                <Label>Reason *</Label>
                <Textarea
                  className="mt-1"
                  rows={3}
                  placeholder="Describe why you worked on this day..."
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Requests list */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              My Comp-Off Requests
            </CardTitle>
            <CardDescription>Track your comp-off requests and their approval status</CardDescription>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No requests yet. Click "New Request" to submit one.
              </p>
            ) : (
              <div className="divide-y">
                {requests.map((req) => (
                  <div key={req.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          Worked: {format(new Date(req.worked_date), "dd MMM yyyy")}
                        </p>
                        {req.avail_date && (
                          <p className="text-xs text-muted-foreground">
                            Avail: {format(new Date(req.avail_date), "dd MMM yyyy")}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">{req.reason}</p>
                        {req.review_comment && (
                          <p className="text-xs italic text-muted-foreground">
                            HR: {req.review_comment}
                          </p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig[req.status].className}`}
                      >
                        {statusConfig[req.status].label}
                      </span>
                    </div>
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

export default ESSCompOff;
