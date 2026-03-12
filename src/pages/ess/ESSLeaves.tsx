import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInBusinessDays, addDays } from "date-fns";

const LEAVE_TYPES = [
  { value: "casual", label: "Casual Leave" },
  { value: "sick", label: "Sick Leave" },
  { value: "earned", label: "Earned Leave" },
  { value: "maternity", label: "Maternity Leave" },
  { value: "paternity", label: "Paternity Leave" },
  { value: "comp_off", label: "Comp Off" },
  { value: "lwp", label: "Leave Without Pay (LWP)" },
];

const LEAVE_BALANCES: Record<string, { total: number }> = {
  casual: { total: 12 },
  sick: { total: 10 },
  earned: { total: 18 },
  maternity: { total: 84 },
  paternity: { total: 15 },
  comp_off: { total: 0 },
  lwp: { total: 0 },
};

interface LeaveRequest {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string | null;
  status: string;
  review_comment: string | null;
  created_at: string;
}

const statusStyle = (s: string) => {
  switch (s) {
    case "approved": return "bg-green-100 text-green-800";
    case "rejected": return "bg-red-100 text-red-800";
    case "cancelled": return "bg-gray-100 text-gray-600";
    default: return "bg-yellow-100 text-yellow-800";
  }
};

const ESSLeaves = () => {
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const { toast } = useToast();

  const [form, setForm] = useState({
    leave_type: "casual",
    start_date: "",
    end_date: "",
    reason: "",
  });

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: emp } = await supabase
        .from("employees")
        .select("id, company_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (emp) {
        setEmployeeId(emp.id);
        setCompanyId(emp.company_id);
        await fetchLeaves(emp.id);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaves = async (empId: string) => {
    const { data, error } = await supabase
      .from("leave_requests")
      .select("id, leave_type, start_date, end_date, days, reason, status, review_comment, created_at")
      .eq("employee_id", empId)
      .order("created_at", { ascending: false });
    if (!error && data) setLeaves(data);
  };

  // Calculate business days between two dates
  const calcDays = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    if (e < s) return 0;
    // differenceInBusinessDays is exclusive of end, add 1
    return Math.max(1, differenceInBusinessDays(addDays(e, 1), s));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !companyId) return;

    const days = calcDays(form.start_date, form.end_date);
    if (days <= 0) {
      toast({ variant: "destructive", title: "Invalid dates", description: "End date must be on or after start date." });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("leave_requests").insert({
        employee_id: employeeId,
        company_id: companyId,
        leave_type: form.leave_type,
        start_date: form.start_date,
        end_date: form.end_date,
        days,
        reason: form.reason || null,
        status: "pending",
      });
      if (error) throw error;

      toast({ title: "Leave applied", description: "Your leave request has been submitted for approval." });
      setDialogOpen(false);
      setForm({ leave_type: "casual", start_date: "", end_date: "", reason: "" });
      await fetchLeaves(employeeId);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    setCancelling(id);
    try {
      const { error } = await supabase
        .from("leave_requests")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Leave cancelled" });
      if (employeeId) await fetchLeaves(employeeId);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setCancelling(null);
    }
  };

  // Build usage summary
  const usageSummary = LEAVE_TYPES.map(({ value, label }) => {
    const used = leaves
      .filter((l) => l.leave_type === value && l.status === "approved")
      .reduce((acc, l) => acc + l.days, 0);
    const total = LEAVE_BALANCES[value]?.total ?? 0;
    return { value, label, used, total, available: Math.max(0, total - used) };
  }).filter((l) => l.total > 0); // hide zero-total types like comp_off/lwp

  const days = calcDays(form.start_date, form.end_date);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leave Management</h1>
          <p className="text-muted-foreground">Apply for leave and track your requests</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Apply Leave
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Apply for Leave</DialogTitle>
              <DialogDescription>Fill in the details below to submit a leave request.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Leave Type</Label>
                <Select
                  value={form.leave_type}
                  onValueChange={(v) => setForm((p) => ({ ...p, leave_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAVE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
                    required
                    min={form.start_date}
                  />
                </div>
              </div>

              {form.start_date && form.end_date && (
                <p className="text-sm text-muted-foreground">
                  Business days: <strong>{days}</strong>
                </p>
              )}

              <div className="space-y-2">
                <Label htmlFor="reason">Reason (optional)</Label>
                <Textarea
                  id="reason"
                  placeholder="Brief reason for leave..."
                  value={form.reason}
                  onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                  rows={3}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Request
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Leave balance summary */}
      {usageSummary.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {usageSummary.map((s) => (
            <Card key={s.value} className="text-center">
              <CardHeader className="pb-1 pt-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">{s.label.replace(" Leave", "")}</CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <p className="text-2xl font-bold">{s.available}</p>
                <p className="text-xs text-muted-foreground">{s.used} used / {s.total} total</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Requests list */}
      <Card>
        <CardHeader>
          <CardTitle>My Leave Requests</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {leaves.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No leave requests yet.</p>
          ) : (
            <div className="divide-y">
              {leaves.map((l) => (
                <div key={l.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium capitalize">
                      {LEAVE_TYPES.find((t) => t.value === l.leave_type)?.label ?? l.leave_type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(l.start_date), "dd MMM")} – {format(new Date(l.end_date), "dd MMM yyyy")} · {l.days} day{l.days !== 1 ? "s" : ""}
                    </p>
                    {l.reason && (
                      <p className="mt-0.5 text-xs text-muted-foreground truncate">{l.reason}</p>
                    )}
                    {l.review_comment && (
                      <p className="mt-0.5 text-xs italic text-muted-foreground">"{l.review_comment}"</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusStyle(l.status)}`}>
                      {l.status}
                    </span>
                    {l.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Cancel request"
                        disabled={cancelling === l.id}
                        onClick={() => handleCancel(l.id)}
                      >
                        {cancelling === l.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <X className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ESSLeaves;
