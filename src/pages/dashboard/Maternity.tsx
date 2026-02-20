import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getSafeErrorMessage } from "@/lib/safe-error";
import { maternityCaseSchema, maternityPaymentSchema, getValidationError } from "@/lib/validations";
import { calculateAverageDailyWage, calculateMaternityBenefit } from "@/lib/calculations";
import { Baby, Plus, CalendarDays, IndianRupee, Users, Eye } from "lucide-react";
import { format, addWeeks, subWeeks, differenceInDays, startOfDay } from "date-fns";

// ─── Types ───

interface MaternityCase {
  id: string;
  company_id: string;
  employee_id: string;
  type: string;
  expected_delivery_date: string;
  actual_delivery_date: string | null;
  eligible_from: string;
  eligible_to: string;
  weeks_allowed: number;
  weeks_taken: number;
  status: string;
  created_at: string;
  employees?: { name: string; emp_code: string; department: string | null; grade: string | null } | null;
}

interface MaternityPayment {
  id: string;
  maternity_case_id: string;
  period_from: string;
  period_to: string;
  days_paid: number;
  average_daily_wage: number;
  amount: number;
  paid_on: string;
  mode: string | null;
  reference_no: string | null;
}

interface FemaleEmployee {
  id: string;
  name: string;
  emp_code: string;
  date_of_joining: string;
  gross: number;
  department: string | null;
  grade: string | null;
}

// ─── Helpers ───

const statusColors: Record<string, string> = {
  planned: "bg-muted text-muted-foreground",
  ongoing: "bg-primary text-primary-foreground",
  closed: "bg-secondary text-secondary-foreground",
};

/**
 * Maternity Benefit Act, 1961 — eligible_from / eligible_to computation.
 * For 'birth': 26 weeks total — 8 weeks before expected delivery, 18 weeks after.
 * For 'adoption'/'surrogacy': 12 weeks from the date (expected_delivery_date used as adoption/surrogacy date).
 */
function computeEligiblePeriod(type: string, expectedDate: string) {
  const d = new Date(expectedDate);
  if (type === "birth") {
    return {
      eligible_from: format(subWeeks(d, 8), "yyyy-MM-dd"),
      eligible_to: format(addWeeks(d, 18), "yyyy-MM-dd"),
      weeks_allowed: 26,
    };
  }
  // adoption / surrogacy — 12 weeks from date
  return {
    eligible_from: format(d, "yyyy-MM-dd"),
    eligible_to: format(addWeeks(d, 12), "yyyy-MM-dd"),
    weeks_allowed: 12,
  };
}

function currentFYStart(): Date {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(year, 3, 1);
}

// ─── Component ───

const MaternityPage = () => {
  const { toast } = useToast();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [cases, setCases] = useState<MaternityCase[]>([]);
  const [payments, setPayments] = useState<MaternityPayment[]>([]);
  const [femaleEmployees, setFemaleEmployees] = useState<FemaleEmployee[]>([]);

  const [showNewCase, setShowNewCase] = useState(false);
  const [selectedCase, setSelectedCase] = useState<MaternityCase | null>(null);

  // New case form
  const [caseForm, setCaseForm] = useState({
    employee_id: "",
    type: "birth" as "birth" | "adoption" | "surrogacy",
    expected_delivery_date: "",
  });

  // New payment form
  const [payForm, setPayForm] = useState({
    period_from: "",
    period_to: "",
    days_paid: 0,
    average_daily_wage: 0,
    amount: 0,
    paid_on: format(new Date(), "yyyy-MM-dd"),
    mode: "",
    reference_no: "",
  });
  const [showPayForm, setShowPayForm] = useState(false);

  // ─── Data loading ───

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: comp } = await supabase
      .from("companies")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!comp) { setLoading(false); return; }
    setCompanyId(comp.id);

    const [{ data: cData }, { data: fData }] = await Promise.all([
      supabase
        .from("maternity_cases")
        .select("*, employees(name, emp_code, department, grade)")
        .eq("company_id", comp.id)
        .order("expected_delivery_date", { ascending: false }) as any,
      supabase
        .from("employees")
        .select("id, name, emp_code, date_of_joining, gross, department, grade")
        .eq("company_id", comp.id)
        .eq("gender", "Female")
        .eq("status", "Active"),
    ]);

    const loadedCases = (cData || []) as MaternityCase[];
    setCases(loadedCases);
    setFemaleEmployees((fData || []) as FemaleEmployee[]);

    // Load payments for all cases
    if (loadedCases.length > 0) {
      const caseIds = loadedCases.map((c) => c.id);
      const { data: pData } = await supabase
        .from("maternity_payments")
        .select("*")
        .in("maternity_case_id", caseIds)
        .order("period_from", { ascending: false }) as any;
      setPayments((pData || []) as MaternityPayment[]);
    } else {
      setPayments([]);
    }

    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Summary cards ───

  const activeCases = cases.filter((c) => c.status !== "closed").length;
  const today = startOfDay(new Date());

  const upcomingCases = cases.filter((c) => {
    const from = new Date(c.eligible_from);
    return c.status === "planned" && differenceInDays(from, today) <= 90 && differenceInDays(from, today) >= 0;
  }).length;

  const fyStart = currentFYStart();
  const totalPaidThisFY = payments
    .filter((p) => new Date(p.paid_on) >= fyStart)
    .reduce((s, p) => s + Number(p.amount), 0);

  // ─── Eligibility (80-day rule per Maternity Benefit Act) ───

  const eligibleEmployees = useMemo(() => {
    return femaleEmployees.filter((e) => {
      const doj = new Date(e.date_of_joining);
      return differenceInDays(today, doj) >= 80;
    });
  }, [femaleEmployees, today]);

  // ─── New Case ───

  const saveNewCase = async () => {
    if (!companyId) return;

    const { eligible_from, eligible_to, weeks_allowed } = computeEligiblePeriod(
      caseForm.type,
      caseForm.expected_delivery_date
    );

    const payload = {
      employee_id: caseForm.employee_id,
      type: caseForm.type,
      expected_delivery_date: caseForm.expected_delivery_date,
      eligible_from,
      eligible_to,
      weeks_allowed,
      weeks_taken: 0,
      status: "planned" as const,
    };

    const validated = maternityCaseSchema.safeParse(payload);
    if (!validated.success) {
      toast({ title: "Validation Error", description: getValidationError(validated.error), variant: "destructive" });
      return;
    }

    const { error } = await supabase
      .from("maternity_cases")
      .insert({ company_id: companyId, ...validated.data } as any);

    if (error) {
      toast({ title: "Error", description: getSafeErrorMessage(error), variant: "destructive" });
    } else {
      toast({ title: "Created", description: "Maternity case registered." });
      setShowNewCase(false);
      setCaseForm({ employee_id: "", type: "birth", expected_delivery_date: "" });
      loadData();
    }
  };

  // ─── New Payment ───

  const savePayment = async () => {
    if (!selectedCase) return;

    const validated = maternityPaymentSchema.safeParse({
      maternity_case_id: selectedCase.id,
      ...payForm,
    });

    if (!validated.success) {
      toast({ title: "Validation Error", description: getValidationError(validated.error), variant: "destructive" });
      return;
    }

    const { error } = await supabase
      .from("maternity_payments")
      .insert(validated.data as any);

    if (error) {
      toast({ title: "Error", description: getSafeErrorMessage(error), variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Payment recorded." });
      setShowPayForm(false);
      setPayForm({ period_from: "", period_to: "", days_paid: 0, average_daily_wage: 0, amount: 0, paid_on: format(new Date(), "yyyy-MM-dd"), mode: "", reference_no: "" });
      loadData();
    }
  };

  // Benefit calculator helper
  const suggestBenefit = () => {
    if (payForm.days_paid > 0 && payForm.average_daily_wage > 0) {
      const amt = calculateMaternityBenefit(payForm.days_paid, payForm.average_daily_wage);
      setPayForm((f) => ({ ...f, amount: amt }));
    }
  };

  // Payments for the selected case
  const casePayments = selectedCase
    ? payments.filter((p) => p.maternity_case_id === selectedCase.id)
    : [];

  if (loading) return <div className="text-muted-foreground p-8">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Maternity Benefit Register</h1>
          <p className="mt-1 text-muted-foreground">Maternity Benefit Act compliance (Pune, Maharashtra)</p>
        </div>
        <Button onClick={() => setShowNewCase(true)}>
          <Plus className="mr-1 h-4 w-4" /> New Maternity Case
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Baby className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{activeCases}</p>
              <p className="text-sm text-muted-foreground">Active Cases</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <CalendarDays className="h-8 w-8 text-accent" />
            <div>
              <p className="text-2xl font-bold">{upcomingCases}</p>
              <p className="text-sm text-muted-foreground">Starting in 90 days</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <IndianRupee className="h-8 w-8 text-success" />
            <div>
              <p className="text-2xl font-bold">₹{totalPaidThisFY.toLocaleString("en-IN")}</p>
              <p className="text-sm text-muted-foreground">Paid this FY</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Eligible Employees */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Eligible Employees ({eligibleEmployees.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {eligibleEmployees.length === 0 ? (
            <p className="text-sm text-muted-foreground">No eligible female employees found (requires 80+ days since DOJ).</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Code</th>
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Department</th>
                    <th className="pb-2 pr-4">DOJ</th>
                    <th className="pb-2 text-right">Gross</th>
                  </tr>
                </thead>
                <tbody>
                  {eligibleEmployees.map((e) => (
                    <tr key={e.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{e.emp_code}</td>
                      <td className="py-2 pr-4">{e.name}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{e.department || "—"}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{e.date_of_joining}</td>
                      <td className="py-2 text-right">₹{Number(e.gross).toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cases Table */}
      <Card>
        <CardHeader>
          <CardTitle>Cases ({cases.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {cases.length === 0 ? (
            <p className="text-sm text-muted-foreground">No maternity cases recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Employee</th>
                    <th className="pb-2 pr-4">Type</th>
                    <th className="pb-2 pr-4">Expected</th>
                    <th className="pb-2 pr-4">Actual</th>
                    <th className="pb-2 pr-4">Weeks</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">
                        <span className="font-medium">{c.employees?.name || "—"}</span>
                        <span className="ml-1 text-muted-foreground text-xs">({c.employees?.emp_code})</span>
                      </td>
                      <td className="py-2 pr-4 capitalize">{c.type}</td>
                      <td className="py-2 pr-4">{c.expected_delivery_date}</td>
                      <td className="py-2 pr-4">{c.actual_delivery_date || "—"}</td>
                      <td className="py-2 pr-4">{c.weeks_taken}/{c.weeks_allowed}</td>
                      <td className="py-2 pr-4">
                        <Badge className={statusColors[c.status]}>{c.status}</Badge>
                      </td>
                      <td className="py-2">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedCase(c)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Case Dialog */}
      <Dialog open={showNewCase} onOpenChange={setShowNewCase}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Maternity Case</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Employee</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={caseForm.employee_id}
                onChange={(e) => setCaseForm({ ...caseForm, employee_id: e.target.value })}
              >
                <option value="">Select employee</option>
                {eligibleEmployees.map((e) => (
                  <option key={e.id} value={e.id}>{e.emp_code} — {e.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={caseForm.type}
                onChange={(e) => setCaseForm({ ...caseForm, type: e.target.value as any })}
              >
                <option value="birth">Birth</option>
                <option value="adoption">Adoption</option>
                <option value="surrogacy">Surrogacy</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Expected Delivery / Adoption Date</Label>
              <Input
                type="date"
                value={caseForm.expected_delivery_date}
                onChange={(e) => setCaseForm({ ...caseForm, expected_delivery_date: e.target.value })}
              />
            </div>
            {caseForm.expected_delivery_date && (
              <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                {(() => {
                  const p = computeEligiblePeriod(caseForm.type, caseForm.expected_delivery_date);
                  return `Eligible period: ${p.eligible_from} → ${p.eligible_to} (${p.weeks_allowed} weeks)`;
                })()}
              </div>
            )}
            <Button onClick={saveNewCase}>Create Case</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Case Detail + Payments Dialog */}
      <Dialog open={!!selectedCase} onOpenChange={(open) => { if (!open) { setSelectedCase(null); setShowPayForm(false); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedCase && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selectedCase.employees?.name} — {selectedCase.type} ({selectedCase.status})
                </DialogTitle>
              </DialogHeader>

              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div><span className="text-muted-foreground">Expected:</span> {selectedCase.expected_delivery_date}</div>
                <div><span className="text-muted-foreground">Actual:</span> {selectedCase.actual_delivery_date || "—"}</div>
                <div><span className="text-muted-foreground">Eligible Period:</span> {selectedCase.eligible_from} → {selectedCase.eligible_to}</div>
                <div><span className="text-muted-foreground">Weeks:</span> {selectedCase.weeks_taken} / {selectedCase.weeks_allowed}</div>
              </div>

              {/* Payments list */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-foreground">Payments ({casePayments.length})</h3>
                  <Button size="sm" onClick={() => setShowPayForm(!showPayForm)}>
                    <Plus className="mr-1 h-3 w-3" /> Add Payment
                  </Button>
                </div>

                {casePayments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payments recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {casePayments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded border p-2 text-sm">
                        <div>
                          <span className="font-medium">{p.period_from} → {p.period_to}</span>
                          <span className="ml-2 text-muted-foreground">{p.days_paid} days</span>
                        </div>
                        <span className="font-medium">₹{Number(p.amount).toLocaleString("en-IN")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Payment Form */}
              {showPayForm && (
                <Card className="mt-4">
                  <CardHeader><CardTitle className="text-base">New Payment</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Period From</Label>
                        <Input type="date" value={payForm.period_from} onChange={(e) => setPayForm({ ...payForm, period_from: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Period To</Label>
                        <Input type="date" value={payForm.period_to} onChange={(e) => setPayForm({ ...payForm, period_to: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Days Paid</Label>
                        <Input type="number" value={payForm.days_paid} onChange={(e) => setPayForm({ ...payForm, days_paid: Number(e.target.value) })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Avg Daily Wage (₹)</Label>
                        <Input type="number" value={payForm.average_daily_wage} onChange={(e) => setPayForm({ ...payForm, average_daily_wage: Number(e.target.value) })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Amount (₹)</Label>
                        <div className="flex gap-2">
                          <Input type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: Number(e.target.value) })} />
                          <Button variant="outline" size="sm" onClick={suggestBenefit} title="Calculate from days × daily wage">
                            Calc
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Paid On</Label>
                        <Input type="date" value={payForm.paid_on} onChange={(e) => setPayForm({ ...payForm, paid_on: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Mode</Label>
                        <Input value={payForm.mode} onChange={(e) => setPayForm({ ...payForm, mode: e.target.value })} placeholder="NEFT / Cheque" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Reference No.</Label>
                        <Input value={payForm.reference_no} onChange={(e) => setPayForm({ ...payForm, reference_no: e.target.value })} />
                      </div>
                    </div>
                    <Button className="mt-3" size="sm" onClick={savePayment}>Save Payment</Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MaternityPage;
