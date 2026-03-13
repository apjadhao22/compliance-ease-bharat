import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Plus, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getSafeErrorMessage } from "@/lib/safe-error";
import { format } from "date-fns";
import ESSFeatureGate from "@/components/ess/ESSFeatureGate";

interface RegularizationRequest {
  id: string;
  request_date: string;
  original_status: string | null;
  requested_status: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  review_comment: string | null;
  created_at: string;
}

const statusConfig = {
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800" },
  approved: { label: "Approved", className: "bg-green-100 text-green-800" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800" },
};

const requestedStatusOptions = [
  { value: "present", label: "Present" },
  { value: "half_day", label: "Half Day" },
  { value: "on_duty", label: "On Duty" },
  { value: "comp_off", label: "Comp-Off" },
];

const ESSRegularization = () => {
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [requests, setRequests] = useState<RegularizationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    request_date: "",
    requested_status: "",
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
        .from("regularization_requests")
        .select("id, request_date, original_status, requested_status, reason, status, review_comment, created_at")
        .eq("employee_id", emp.id)
        .order("created_at", { ascending: false });

      setRequests((data ?? []) as RegularizationRequest[]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!employeeId || !companyId) return;
    if (!form.request_date || !form.requested_status || !form.reason.trim()) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }

    // Validate: only past dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(form.request_date) >= today) {
      toast({ title: "Request date must be in the past", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      // Try to find timesheet status for that date
      const { data: ts } = await supabase
        .from("timesheets")
        .select("status")
        .eq("employee_id", employeeId)
        .eq("date", form.request_date)
        .maybeSingle();

      const { error } = await supabase.from("regularization_requests").insert({
        employee_id: employeeId,
        company_id: companyId,
        request_date: form.request_date,
        original_status: ts ? ts.status : "absent",
        requested_status: form.requested_status,
        reason: form.reason.trim(),
      });

      if (error) throw error;

      toast({ title: "Regularization request submitted" });
      setDialogOpen(false);
      setForm({ request_date: "", requested_status: "", reason: "" });
      loadData();
    } catch (err) {
      toast({ title: "Failed to submit", description: getSafeErrorMessage(err), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date();
  const maxDate = format(new Date(today.getTime() - 86400000), "yyyy-MM-dd"); // yesterday

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ESSFeatureGate feature="regularization">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Attendance Regularization</h1>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Request
          </Button>
        </div>

        {/* Submit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Regularization</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Date (past dates only)</Label>
                <input
                  type="date"
                  max={maxDate}
                  value={form.request_date}
                  onChange={(e) => setForm((f) => ({ ...f, request_date: e.target.value }))}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                />
              </div>
              <div>
                <Label>Requested Status</Label>
                <Select
                  value={form.requested_status}
                  onValueChange={(v) => setForm((f) => ({ ...f, requested_status: v }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {requestedStatusOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reason</Label>
                <Textarea
                  className="mt-1"
                  rows={3}
                  placeholder="Explain why this date should be regularized..."
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
              <AlertCircle className="h-5 w-5" />
              My Requests
            </CardTitle>
            <CardDescription>Track your regularization requests</CardDescription>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No requests yet. Submit one using the button above.
              </p>
            ) : (
              <div className="divide-y">
                {requests.map((req) => (
                  <div key={req.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {format(new Date(req.request_date), "dd MMM yyyy")}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            → {requestedStatusOptions.find((o) => o.value === req.requested_status)?.label ?? req.requested_status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{req.reason}</p>
                        {req.review_comment && (
                          <p className="text-xs text-muted-foreground italic">
                            HR note: {req.review_comment}
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

export default ESSRegularization;
