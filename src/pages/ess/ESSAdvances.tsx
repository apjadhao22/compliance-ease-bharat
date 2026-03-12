import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Banknote, Plus, Loader2, CreditCard, Calendar } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getSafeErrorMessage } from "@/lib/safe-error";
import ESSFeatureGate from "@/components/ess/ESSFeatureGate";

const TENURE_OPTIONS = [
  { value: "1", label: "1 month" },
  { value: "2", label: "2 months" },
  { value: "3", label: "3 months" },
  { value: "6", label: "6 months" },
  { value: "12", label: "12 months" },
];

interface Advance {
  id: string;
  amount: number;
  date: string;
  purpose: string | null;
  instalment_count: number;
  repaid_amount: number;
  status: string;
}

const statusStyle = (s: string) => {
  switch (s?.toLowerCase()) {
    case "approved": return "bg-green-100 text-green-800";
    case "rejected": return "bg-red-100 text-red-800";
    case "repaid": return "bg-blue-100 text-blue-800";
    default: return "bg-yellow-100 text-yellow-800";
  }
};

const ESSAdvances = () => {
  const { toast } = useToast();
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    amount: "",
    reason: "",
    tenure: "3",
  });

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (!emp) { setLoading(false); return; }
    setEmployeeId(emp.id);

    const { data } = await supabase
      .from("advances")
      .select("id, amount, date, purpose, instalment_count, repaid_amount, status")
      .eq("employee_id", emp.id)
      .order("date", { ascending: false });
    setAdvances(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    if (!employeeId) return;
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast({ title: "Validation", description: "Please enter a valid amount.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("advances").insert({
        employee_id: employeeId,
        amount: parseFloat(form.amount),
        date: format(new Date(), "yyyy-MM-dd"),
        purpose: form.reason || null,
        instalment_count: parseInt(form.tenure),
        repaid_amount: 0,
        status: "Pending",
      });
      if (error) throw error;
      toast({ title: "Advance requested", description: "Your advance request has been submitted for approval." });
      setOpen(false);
      setForm({ amount: "", reason: "", tenure: "3" });
      await load();
    } catch (err) {
      toast({ title: "Error", description: getSafeErrorMessage(err), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const activeAdvances = advances.filter((a) => a.status?.toLowerCase() === "approved" && a.repaid_amount < a.amount);
  const pastRequests = advances.filter((a) => a.status?.toLowerCase() !== "approved" || a.repaid_amount >= a.amount);

  const emiEstimate = (amount: string, tenure: string) => {
    const amt = parseFloat(amount);
    const t = parseInt(tenure);
    if (!amt || !t) return "—";
    return `₹${(amt / t).toLocaleString("en-IN", { maximumFractionDigits: 0 })}/mo`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ESSFeatureGate feature="advances">
      <div className="space-y-6 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Salary Advances</h1>
            <p className="text-muted-foreground text-sm">Request and track salary advances.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Request Advance</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Request Salary Advance</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>Amount (₹) *</Label>
                  <Input
                    type="number"
                    min={0}
                    step={100}
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="e.g. 10000"
                  />
                </div>
                <div>
                  <Label>Repayment Tenure *</Label>
                  <Select value={form.tenure} onValueChange={(v) => setForm((f) => ({ ...f, tenure: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TENURE_OPTIONS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.amount && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Estimated monthly deduction: {emiEstimate(form.amount, form.tenure)}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Reason</Label>
                  <Textarea
                    value={form.reason}
                    onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                    placeholder="Briefly describe the reason..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Request
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Active Advances */}
        {activeAdvances.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Banknote className="h-4 w-4" /> Active Advances
              </CardTitle>
              <CardDescription>Advances currently being repaid via salary deduction</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activeAdvances.map((adv) => {
                  const outstanding = adv.amount - adv.repaid_amount;
                  const emi = adv.amount / adv.instalment_count;
                  const progress = Math.round((adv.repaid_amount / adv.amount) * 100);
                  return (
                    <div key={adv.id} className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">₹{adv.amount.toLocaleString("en-IN")}</p>
                        <Badge className="bg-green-100 text-green-800">Active</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{adv.purpose || "No reason provided"}</p>
                      <div className="flex gap-4 text-sm">
                        <span>Outstanding: <strong>₹{outstanding.toLocaleString("en-IN")}</strong></span>
                        <span>Monthly EMI: <strong>₹{Math.round(emi).toLocaleString("en-IN")}</strong></span>
                        <span>Progress: <strong>{progress}%</strong></span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-500 rounded-full h-2 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Past Requests */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All Requests</CardTitle>
            <CardDescription>History of all your advance requests</CardDescription>
          </CardHeader>
          <CardContent>
            {advances.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No advance requests yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Tenure</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Repaid</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {advances.map((adv) => (
                    <TableRow key={adv.id}>
                      <TableCell className="text-sm">{format(new Date(adv.date), "d MMM yyyy")}</TableCell>
                      <TableCell className="font-medium">₹{adv.amount.toLocaleString("en-IN")}</TableCell>
                      <TableCell>{adv.instalment_count} mo</TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate">
                        {adv.purpose || "—"}
                      </TableCell>
                      <TableCell>₹{(adv.repaid_amount || 0).toLocaleString("en-IN")}</TableCell>
                      <TableCell>
                        <Badge className={statusStyle(adv.status)}>{adv.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </ESSFeatureGate>
  );
};

export default ESSAdvances;
