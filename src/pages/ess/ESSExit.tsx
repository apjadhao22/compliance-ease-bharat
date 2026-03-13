import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DoorOpen, Loader2, CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, addDays } from "date-fns";
import ESSFeatureGate from "@/components/ess/ESSFeatureGate";

const STATUS_STEPS = ["Submitted", "Acknowledged", "Processing FnF", "Completed"];
const STATUS_MAP: Record<string, number> = {
  submitted: 0, acknowledged: 1, processing: 2, completed: 3,
};

interface ExitRequest {
  id: string;
  resignation_date: string;
  last_working_date: string;
  reason: string | null;
  notice_period_days: number;
  status: string;
  acknowledged_at: string | null;
  fnf_settlement_id: string | null;
  asset_return_completed: boolean;
}

interface Asset {
  id: string;
  name: string;
  acknowledged: boolean;
}

interface Advance {
  id: string;
  amount: number;
  outstanding_balance?: number;
  status: string;
}

const ESSExit = () => {
  const [employee, setEmployee] = useState<{ id: string; company_id: string } | null>(null);
  const [exitRequest, setExitRequest] = useState<ExitRequest | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [pendingAdvances, setPendingAdvances] = useState<Advance[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();

  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    resignation_date: today,
    last_working_date: format(addDays(new Date(), 30), "yyyy-MM-dd"),
    reason: "",
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

      const { data: er } = await supabase
        .from("exit_requests")
        .select("*")
        .eq("employee_id", emp.id)
        .neq("status", "withdrawn")
        .maybeSingle();

      if (er) setExitRequest(er as ExitRequest);

      const { data: myAssets } = await supabase
        .from("assets")
        .select("id, name, acknowledged")
        .eq("assigned_to", emp.id);
      if (myAssets) setAssets(myAssets as Asset[]);

      const { data: advData } = await supabase
        .from("advances")
        .select("id, amount, outstanding_balance, status")
        .eq("employee_id", emp.id)
        .eq("status", "approved");
      if (advData) setPendingAdvances((advData as Advance[]).filter((a) => (a.outstanding_balance ?? a.amount) > 0));
    } finally {
      setLoading(false);
    }
  };

  const updateLastDate = (resignDate: string) => {
    const d = addDays(new Date(resignDate), form.notice_period_days ?? 30);
    setForm((p) => ({ ...p, resignation_date: resignDate, last_working_date: format(d, "yyyy-MM-dd") }));
  };

  const handleSubmit = async () => {
    if (!employee) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("exit_requests").insert({
        employee_id: employee.id,
        company_id: employee.company_id,
        resignation_date: form.resignation_date,
        last_working_date: form.last_working_date,
        reason: form.reason || null,
        notice_period_days: 30,
        status: "submitted",
      });
      if (error) throw error;
      toast({ title: "Resignation submitted", description: "HR has been notified. You can withdraw while the status is 'Submitted'." });
      setConfirmOpen(false);
      await loadData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!exitRequest) return;
    const { error } = await supabase
      .from("exit_requests")
      .update({ status: "withdrawn" })
      .eq("id", exitRequest.id);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Resignation withdrawn" });
      setExitRequest(null);
      await loadData();
    }
  };

  const stepIdx = exitRequest ? STATUS_MAP[exitRequest.status] ?? 0 : -1;
  const unacknowledgedAssets = assets.filter((a) => !a.acknowledged);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ESSFeatureGate feature="exit_request">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Exit / Resignation</h1>
          <p className="text-muted-foreground">Initiate and track your resignation process</p>
        </div>

        {!exitRequest ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DoorOpen className="h-5 w-5" />
                Initiate Resignation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="resign_date">Resignation Date</Label>
                  <Input
                    id="resign_date"
                    type="date"
                    value={form.resignation_date}
                    onChange={(e) => updateLastDate(e.target.value)}
                    max={today}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lwd">Proposed Last Working Date</Label>
                  <Input
                    id="lwd"
                    type="date"
                    value={form.last_working_date}
                    onChange={(e) => setForm((p) => ({ ...p, last_working_date: e.target.value }))}
                    min={form.resignation_date}
                  />
                  <p className="text-xs text-muted-foreground">
                    Auto-calculated: resignation date + 30 days notice period
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Reason (optional)</Label>
                <Textarea
                  id="reason"
                  value={form.reason}
                  onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                  placeholder="Reason for resignation..."
                  rows={3}
                />
              </div>

              <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <DoorOpen className="mr-2 h-4 w-4" />
                    Submit Resignation
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Resignation</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will formally notify HR of your resignation. You can withdraw while the request is in 'Submitted' status.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Go Back</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleSubmit}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={submitting}
                    >
                      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Yes, Submit Resignation
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Status timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Resignation Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-0">
                  {STATUS_STEPS.map((step, i) => {
                    const done = i <= stepIdx;
                    return (
                      <div key={step} className="flex flex-1 items-center">
                        <div className="flex flex-col items-center gap-1">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"}`}>
                            {done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                          </div>
                          <span className={`text-xs font-medium text-center ${done ? "text-primary" : "text-muted-foreground"}`}>{step}</span>
                        </div>
                        {i < STATUS_STEPS.length - 1 && (
                          <div className={`mb-4 h-0.5 flex-1 ${i < stepIdx ? "bg-primary" : "bg-muted-foreground/20"}`} />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Resignation Date</p>
                    <p className="font-medium">{format(new Date(exitRequest.resignation_date), "dd MMM yyyy")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Last Working Date</p>
                    <p className="font-medium">{format(new Date(exitRequest.last_working_date), "dd MMM yyyy")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Notice Period</p>
                    <p className="font-medium">{exitRequest.notice_period_days} days</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Exit checklist */}
            <Card>
              <CardHeader>
                <CardTitle>Exit Checklist</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  {
                    label: "Manager Acknowledged",
                    done: !!exitRequest.acknowledged_at,
                    note: exitRequest.acknowledged_at ? `Acknowledged on ${format(new Date(exitRequest.acknowledged_at), "dd MMM yyyy")}` : "Pending",
                  },
                  {
                    label: "Assets Returned",
                    done: exitRequest.asset_return_completed,
                    note: unacknowledgedAssets.length > 0 ? `${unacknowledgedAssets.length} asset(s) pending return` : "All assets cleared",
                  },
                  {
                    label: "Advance Balance Cleared",
                    done: pendingAdvances.length === 0,
                    note: pendingAdvances.length > 0 ? `${pendingAdvances.length} advance(s) outstanding` : "No outstanding advances",
                  },
                  {
                    label: "FnF Computed",
                    done: !!exitRequest.fnf_settlement_id,
                    note: exitRequest.fnf_settlement_id ? "Full & Final settlement computed" : "Pending",
                  },
                  {
                    label: "Relieving Letter Generated",
                    done: exitRequest.status === "completed",
                    note: exitRequest.status === "completed" ? "Available for download" : "Available after completion",
                  },
                ].map(({ label, done, note }) => (
                  <div key={label} className="flex items-start gap-3">
                    {done ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                    ) : (
                      <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground/50" />
                    )}
                    <div>
                      <p className={`text-sm font-medium ${done ? "text-green-800" : ""}`}>{label}</p>
                      <p className="text-xs text-muted-foreground">{note}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Unacknowledged assets */}
            {unacknowledgedAssets.length > 0 && (
              <Card className="border-orange-200 bg-orange-50">
                <CardHeader>
                  <CardTitle className="text-sm text-orange-800 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" /> Assets Pending Return
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 text-sm text-orange-900">
                    {unacknowledgedAssets.map((a) => (
                      <li key={a.id}>• {a.name}</li>
                    ))}
                  </ul>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.href = "/ess/assets"}>
                    Go to Assets
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Withdraw button */}
            {exitRequest.status === "submitted" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline">Withdraw Resignation</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Withdraw Resignation?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will cancel your resignation request. Your employment will continue as normal.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Resignation</AlertDialogCancel>
                    <AlertDialogAction onClick={handleWithdraw}>Yes, Withdraw</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )}
      </div>
    </ESSFeatureGate>
  );
};

export default ESSExit;
