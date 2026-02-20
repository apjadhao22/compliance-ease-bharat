import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { getSafeErrorMessage } from "@/lib/safe-error";
import { accidentSchema, wcPolicySchema, getValidationError } from "@/lib/validations";
import { estimateWCPremium } from "@/lib/calculations";
import { Download, Plus, AlertTriangle, ShieldCheck, ShieldAlert, Calendar } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import jsPDF from "jspdf";

// ─── Types ───

interface Accident {
  id: string;
  accident_date: string;
  injury_type: string;
  description: string;
  medical_costs: number;
  compensation_paid: number;
  insurer_notified: boolean;
  form_ee_filed: boolean;
  employees?: { name: string; emp_code: string } | null;
}

interface WCPolicy {
  id: string;
  policy_no: string;
  insurer: string;
  start_date: string;
  end_date: string;
  premium_amount: number;
  total_covered_employees: number;
  status: string;
  created_at: string;
}

interface ECEmployee {
  id: string;
  name: string;
  gross: number;
  risk_rate: number;
}

const injuryColors: Record<string, string> = {
  death: "bg-destructive text-destructive-foreground",
  permanent_disability: "bg-destructive/80 text-destructive-foreground",
  temporary_disability: "bg-accent text-accent-foreground",
  minor: "bg-muted text-muted-foreground",
};

// ─── Accidents Tab (extracted) ───

function AccidentsTab({
  accidents,
  employees,
  companyId,
  companyName,
  onReload,
}: {
  accidents: Accident[];
  employees: any[];
  companyId: string | null;
  companyName: string;
  onReload: () => void;
}) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    employee_id: "",
    accident_date: format(new Date(), "yyyy-MM-dd"),
    injury_type: "minor",
    description: "",
    medical_costs: 0,
  });

  const saveAccident = async () => {
    if (!companyId) {
      toast({ title: "Setup required", description: "Please set up your company first.", variant: "destructive" });
      return;
    }

    const validated = accidentSchema.safeParse(form);
    if (!validated.success) {
      toast({ title: "Validation Error", description: getValidationError(validated.error), variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("accidents").insert({
      company_id: companyId,
      employee_id: validated.data.employee_id,
      accident_date: validated.data.accident_date,
      injury_type: validated.data.injury_type,
      description: validated.data.description,
      medical_costs: validated.data.medical_costs,
    });

    if (error) {
      toast({ title: "Error", description: getSafeErrorMessage(error), variant: "destructive" });
    } else {
      toast({ title: "Recorded", description: "Accident logged in register." });
      setShowForm(false);
      setForm({ employee_id: "", accident_date: format(new Date(), "yyyy-MM-dd"), injury_type: "minor", description: "", medical_costs: 0 });
      onReload();
    }
  };

  const downloadFormEE = () => {
    if (accidents.length === 0) {
      toast({ title: "No data", description: "No accidents recorded.", variant: "destructive" });
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("FORM EE", 105, 20, { align: "center" });
    doc.setFontSize(11);
    doc.text("Notice of Accident or Dangerous Occurrence", 105, 28, { align: "center" });
    doc.setFontSize(9);
    doc.text("[Under Rule 103 of the Factories Act, 1948]", 105, 34, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Establishment: ${companyName}`, 15, 48);
    doc.text(`Date of Report: ${format(new Date(), "dd-MMM-yyyy")}`, 15, 53);

    let yPos = 65;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Sl.", 15, yPos);
    doc.text("Employee", 25, yPos);
    doc.text("Date", 75, yPos);
    doc.text("Injury Type", 100, yPos);
    doc.text("Description", 135, yPos);
    doc.text("Medical ₹", 180, yPos);

    yPos += 6;
    doc.setFont("helvetica", "normal");

    accidents.forEach((acc, i) => {
      doc.text(String(i + 1), 15, yPos);
      doc.text(acc.employees?.name || "—", 25, yPos);
      doc.text(acc.accident_date, 75, yPos);
      doc.text(acc.injury_type.replace("_", " "), 100, yPos);
      doc.text((acc.description || "").slice(0, 30), 135, yPos);
      doc.text(Number(acc.medical_costs).toLocaleString("en-IN"), 180, yPos);
      yPos += 5;
      if (yPos > 270) { doc.addPage(); yPos = 20; }
    });

    yPos += 10;
    doc.setFont("helvetica", "bold");
    doc.text("Signature of Occupier / Manager", 15, yPos);
    doc.rect(15, yPos + 2, 80, 15);

    doc.save(`FormEE_${format(new Date(), "yyyyMMdd")}.pdf`);
    toast({ title: "Form EE Generated! 📄", description: `Accident register report for ${accidents.length} record(s).` });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={downloadFormEE} disabled={accidents.length === 0}>
          <Download className="mr-1 h-4 w-4" /> Form EE (.pdf)
        </Button>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-1 h-4 w-4" /> Log Accident
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Log New Accident</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Employee</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.employee_id}
                  onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                >
                  <option value="">Select employee</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.emp_code} — {e.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Date of Accident</Label>
                <Input type="date" value={form.accident_date} onChange={(e) => setForm({ ...form, accident_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Injury Type</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.injury_type}
                  onChange={(e) => setForm({ ...form, injury_type: e.target.value })}
                >
                  <option value="minor">Minor</option>
                  <option value="temporary_disability">Temporary Disability</option>
                  <option value="permanent_disability">Permanent Disability</option>
                  <option value="death">Death</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Medical Costs (₹)</Label>
                <Input type="number" value={form.medical_costs} onChange={(e) => setForm({ ...form, medical_costs: Number(e.target.value) })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Description</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description of the accident" />
              </div>
            </div>
            <Button className="mt-4" onClick={saveAccident}>Save Record</Button>
          </CardContent>
        </Card>
      )}

      {accidents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <AlertTriangle className="h-10 w-10 text-muted-foreground mb-2" />
            <p className="font-medium text-foreground">No accidents recorded</p>
            <p className="text-sm text-muted-foreground">Use "Log Accident" to add entries.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Accident Register ({accidents.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {accidents.map((acc) => (
                <div key={acc.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Badge className={injuryColors[acc.injury_type]}>{acc.injury_type.replace("_", " ")}</Badge>
                    <div>
                      <p className="font-medium text-foreground">{acc.employees?.name || "—"} ({acc.employees?.emp_code})</p>
                      <p className="text-xs text-muted-foreground">{acc.accident_date} — {acc.description || "No description"}</p>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-foreground">₹{Number(acc.medical_costs).toLocaleString("en-IN")}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── WC Policy Tab ───

function WCPolicyTab({ companyId, onReload }: { companyId: string | null; onReload: () => void }) {
  const { toast } = useToast();
  const [policies, setPolicies] = useState<WCPolicy[]>([]);
  const [ecEmployees, setEcEmployees] = useState<ECEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    policy_no: "",
    insurer: "",
    start_date: format(new Date(), "yyyy-MM-dd"),
    end_date: "",
    premium_amount: 0,
    total_covered_employees: 0,
    status: "active" as "active" | "expired",
  });

  const loadWCData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);

    const [{ data: polData }, { data: empData }] = await Promise.all([
      supabase
        .from("wc_policies")
        .select("*")
        .eq("company_id", companyId)
        .order("end_date", { ascending: false }),
      supabase
        .from("employees")
        .select("id, name, gross, risk_rate")
        .eq("company_id", companyId)
        .eq("ec_act_applicable", true)
        .eq("status", "Active"),
    ]);

    setPolicies((polData as WCPolicy[]) || []);
    setEcEmployees((empData as ECEmployee[]) || []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    loadWCData();
  }, [loadWCData]);

  const today = new Date();
  const activePolicy = policies.find(
    (p) => p.status === "active" && new Date(p.end_date) >= today
  );

  const daysToExpiry = activePolicy
    ? differenceInDays(new Date(activePolicy.end_date), today)
    : null;

  // Premium estimate from employee data
  const totalAnnualWages = ecEmployees.reduce((s, e) => s + (Number(e.gross) || 0) * 12, 0);
  const avgRiskRate =
    ecEmployees.length > 0
      ? ecEmployees.reduce((s, e) => s + (Number(e.risk_rate) || 0), 0) / ecEmployees.length
      : 0;
  const premiumEstimate = estimateWCPremium({
    annualWages: totalAnnualWages,
    avgRiskRate,
    employeeCount: ecEmployees.length,
  });

  const resetForm = () => {
    setForm({ policy_no: "", insurer: "", start_date: format(new Date(), "yyyy-MM-dd"), end_date: "", premium_amount: 0, total_covered_employees: 0, status: "active" });
    setEditingId(null);
    setShowForm(false);
  };

  const openEditForm = (policy: WCPolicy) => {
    setForm({
      policy_no: policy.policy_no,
      insurer: policy.insurer,
      start_date: policy.start_date,
      end_date: policy.end_date,
      premium_amount: policy.premium_amount,
      total_covered_employees: policy.total_covered_employees,
      status: policy.status as "active" | "expired",
    });
    setEditingId(policy.id);
    setShowForm(true);
  };

  const savePolicy = async () => {
    if (!companyId) return;

    const validated = wcPolicySchema.safeParse(form);
    if (!validated.success) {
      toast({ title: "Validation Error", description: getValidationError(validated.error), variant: "destructive" });
      return;
    }

    if (editingId) {
      const { error } = await supabase
        .from("wc_policies")
        .update({ ...validated.data })
        .eq("id", editingId);
      if (error) {
        toast({ title: "Error", description: getSafeErrorMessage(error), variant: "destructive" });
        return;
      }
      toast({ title: "Updated", description: "WC policy updated." });
    } else {
      const { error } = await supabase
        .from("wc_policies")
        .insert({ company_id: companyId, ...validated.data } as any);
      if (error) {
        toast({ title: "Error", description: getSafeErrorMessage(error), variant: "destructive" });
        return;
      }
      toast({ title: "Saved", description: "WC policy added." });
    }

    resetForm();
    loadWCData();
    onReload();
  };

  if (loading) return <div className="text-muted-foreground p-4">Loading WC data...</div>;

  return (
    <div className="space-y-4">
      {/* Warning if EC employees exist but no active policy */}
      {ecEmployees.length > 0 && !activePolicy && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>No Active WC Policy</AlertTitle>
          <AlertDescription>
            You have {ecEmployees.length} EC-covered employee(s) but no active WC policy. Please add a policy to stay compliant.
          </AlertDescription>
        </Alert>
      )}

      {/* Active Policy Card */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> Active WC Policy
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activePolicy ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Policy No.</span><span className="font-medium">{activePolicy.policy_no}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Insurer</span><span className="font-medium">{activePolicy.insurer}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Period</span><span className="font-medium">{activePolicy.start_date} → {activePolicy.end_date}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Premium</span><span className="font-medium">₹{Number(activePolicy.premium_amount).toLocaleString("en-IN")}</span></div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={daysToExpiry != null && daysToExpiry <= 30 ? "destructive" : "default"}>
                    {daysToExpiry != null && daysToExpiry >= 0 ? `${daysToExpiry} days left` : "Active"}
                  </Badge>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active policy found.</p>
            )}
          </CardContent>
        </Card>

        {/* Premium Estimate Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" /> Premium Estimate (Employee Data)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ecEmployees.length === 0 ? (
              <p className="text-sm text-muted-foreground">No EC-applicable employees found. Mark employees as EC-applicable in the Employees page.</p>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">EC Employees</span><span className="font-medium">{ecEmployees.length}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total Annual Wages</span><span className="font-medium">₹{totalAnnualWages.toLocaleString("en-IN")}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Avg Risk Rate</span><span className="font-medium">{avgRiskRate.toFixed(2)}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Estimated Premium</span><span className="font-medium text-primary">₹{premiumEstimate.estimatedPremium.toLocaleString("en-IN")}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Per Employee / Year</span><span className="font-medium">₹{premiumEstimate.perEmployeePerYear.toLocaleString("en-IN")}</span></div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add / Edit Policy */}
      <div className="flex justify-end">
        <Button onClick={() => { resetForm(); setShowForm(!showForm); }}>
          <Plus className="mr-1 h-4 w-4" /> {showForm ? "Cancel" : "Add Policy"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>{editingId ? "Edit Policy" : "Add New WC Policy"}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Policy Number</Label>
                <Input value={form.policy_no} onChange={(e) => setForm({ ...form, policy_no: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Insurer</Label>
                <Input value={form.insurer} onChange={(e) => setForm({ ...form, insurer: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Premium Amount (₹)</Label>
                <Input type="number" value={form.premium_amount} onChange={(e) => setForm({ ...form, premium_amount: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Covered Employees</Label>
                <Input type="number" value={form.total_covered_employees} onChange={(e) => setForm({ ...form, total_covered_employees: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as "active" | "expired" })}
                >
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
            </div>
            <Button className="mt-4" onClick={savePolicy}>{editingId ? "Update Policy" : "Save Policy"}</Button>
          </CardContent>
        </Card>
      )}

      {/* Policy History Table */}
      {policies.length > 0 && (
        <Card>
          <CardHeader><CardTitle>All Policies ({policies.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {policies.map((p) => {
                const expired = new Date(p.end_date) < today || p.status === "expired";
                return (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <Badge variant={expired ? "secondary" : "default"}>{expired ? "Expired" : "Active"}</Badge>
                      <div>
                        <p className="font-medium text-foreground">{p.policy_no} — {p.insurer}</p>
                        <p className="text-xs text-muted-foreground">{p.start_date} → {p.end_date} · ₹{Number(p.premium_amount).toLocaleString("en-IN")} · {p.total_covered_employees} employees</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => openEditForm(p)}>Edit</Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main Page ───

const AccidentsPage = () => {
  const [accidents, setAccidents] = useState<Accident[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: comp } = await supabase
      .from("companies")
      .select("id, name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!comp) { setLoading(false); return; }
    setCompanyId(comp.id);
    setCompanyName(comp.name);

    const [{ data: accData }, { data: empData }] = await Promise.all([
      supabase
        .from("accidents")
        .select("*, employees(name, emp_code)")
        .eq("company_id", comp.id)
        .order("accident_date", { ascending: false }),
      supabase
        .from("employees")
        .select("id, name, emp_code")
        .eq("company_id", comp.id)
        .eq("status", "Active"),
    ]);

    setAccidents((accData as any) || []);
    setEmployees(empData || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) return <div className="text-muted-foreground p-8">Loading...</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Accident Register & WC/EC Policy</h1>
        <p className="mt-1 text-muted-foreground">Workmen's Compensation Act compliance</p>
      </div>

      <Tabs defaultValue="accidents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="accidents">Accidents</TabsTrigger>
          <TabsTrigger value="wc-policy">WC Policy & EC Coverage</TabsTrigger>
        </TabsList>

        <TabsContent value="accidents">
          <AccidentsTab
            accidents={accidents}
            employees={employees}
            companyId={companyId}
            companyName={companyName}
            onReload={loadData}
          />
        </TabsContent>

        <TabsContent value="wc-policy">
          <WCPolicyTab companyId={companyId} onReload={loadData} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AccidentsPage;
