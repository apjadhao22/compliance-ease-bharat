import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import {
  CreditCard, Plus, Loader2, IndianRupee, Clock, CheckCircle, XCircle, Receipt,
} from "lucide-react";
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

const CATEGORIES = ["Travel", "Meals", "Supplies", "Internet/Phone", "Training", "Other"];

interface Expense {
  id: string;
  category: string;
  amount: number;
  date: string;
  description: string | null;
  status: string;
  receipt_url: string | null;
  manager_notes: string | null;
  created_at: string;
}

const statusStyle = (s: string) => {
  switch (s) {
    case "Approved": return "bg-green-100 text-green-800";
    case "Rejected": return "bg-red-100 text-red-800";
    case "Paid": return "bg-blue-100 text-blue-800";
    default: return "bg-yellow-100 text-yellow-800";
  }
};

const ESSExpenses = () => {
  const { toast } = useToast();
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    category: "",
    amount: "",
    date: format(new Date(), "yyyy-MM-dd"),
    description: "",
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: emp } = await supabase
      .from("employees")
      .select("id, company_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (!emp) { setLoading(false); return; }
    setEmployeeId(emp.id);
    setCompanyId(emp.company_id);

    const { data } = await supabase
      .from("expenses")
      .select("id, category, amount, date, description, status, receipt_url, manager_notes, created_at")
      .eq("employee_id", emp.id)
      .order("created_at", { ascending: false });
    setExpenses(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const totalPending = expenses.filter((e) => e.status === "Pending").reduce((s, e) => s + e.amount, 0);
  const approvedThisMonth = expenses
    .filter((e) => e.status === "Approved" && e.date.startsWith(format(new Date(), "yyyy-MM")))
    .reduce((s, e) => s + e.amount, 0);
  const totalPaid = expenses.filter((e) => e.status === "Paid").reduce((s, e) => s + e.amount, 0);

  const handleSubmit = async () => {
    if (!employeeId || !companyId) return;
    if (!form.category || !form.amount || !form.date) {
      toast({ title: "Validation", description: "Category, amount and date are required.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      let receipt_url: string | null = null;
      if (receiptFile) {
        const ext = receiptFile.name.split(".").pop();
        const path = `expense-receipts/${companyId}/${employeeId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("expense-receipts")
          .upload(path, receiptFile);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from("expense-receipts").getPublicUrl(path);
        receipt_url = urlData?.publicUrl ?? null;
      }

      const { error } = await supabase.from("expenses").insert({
        employee_id: employeeId,
        category: form.category,
        amount: parseFloat(form.amount),
        date: form.date,
        description: form.description || null,
        status: "Pending",
        receipt_url,
      });
      if (error) throw error;

      toast({ title: "Claim submitted", description: "Your expense claim has been submitted for approval." });
      setOpen(false);
      setForm({ category: "", amount: "", date: format(new Date(), "yyyy-MM-dd"), description: "" });
      setReceiptFile(null);
      await load();
    } catch (err) {
      toast({ title: "Error", description: getSafeErrorMessage(err), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ESSFeatureGate feature="expenses">
      <div className="space-y-6 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Expense Claims</h1>
            <p className="text-muted-foreground text-sm">Submit and track your expense reimbursements.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> New Claim</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>New Expense Claim</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>Category *</Label>
                  <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Amount (₹) *</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={form.amount}
                      onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label>Date *</Label>
                    <Input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Describe the expense..."
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Receipt (optional)</Label>
                  <Input
                    ref={fileRef}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                  />
                  {receiptFile && (
                    <p className="text-xs text-muted-foreground mt-1">{receiptFile.name}</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Claim
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-yellow-100 p-2">
                  <Clock className="h-4 w-4 text-yellow-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Pending</p>
                  <p className="text-lg font-bold">₹{totalPending.toLocaleString("en-IN")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-green-100 p-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Approved This Month</p>
                  <p className="text-lg font-bold">₹{approvedThisMonth.toLocaleString("en-IN")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-blue-100 p-2">
                  <IndianRupee className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Reimbursed</p>
                  <p className="text-lg font-bold">₹{totalPaid.toLocaleString("en-IN")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Claims List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">My Claims</CardTitle>
            <CardDescription>All expense claims you have submitted</CardDescription>
          </CardHeader>
          <CardContent>
            {expenses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No expense claims yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Manager Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((exp) => (
                    <TableRow key={exp.id}>
                      <TableCell className="text-sm">{format(new Date(exp.date), "d MMM yyyy")}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{exp.category}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">₹{exp.amount.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate">
                        {exp.description || "—"}
                      </TableCell>
                      <TableCell>
                        {exp.receipt_url ? (
                          <a href={exp.receipt_url} target="_blank" rel="noopener noreferrer">
                            <Receipt className="h-4 w-4 text-blue-500" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusStyle(exp.status)}>{exp.status}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate">
                        {exp.manager_notes || "—"}
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

export default ESSExpenses;
