import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Download, Plus, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";

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

const injuryColors: Record<string, string> = {
  death: "bg-destructive text-destructive-foreground",
  permanent_disability: "bg-destructive/80 text-destructive-foreground",
  temporary_disability: "bg-accent text-accent-foreground",
  minor: "bg-muted text-muted-foreground",
};

const AccidentsPage = () => {
  const { toast } = useToast();
  const [accidents, setAccidents] = useState<Accident[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    employee_id: "",
    accident_date: format(new Date(), "yyyy-MM-dd"),
    injury_type: "minor",
    description: "",
    medical_costs: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
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
  };

  const saveAccident = async () => {
    if (!companyId || !form.employee_id || !form.accident_date) {
      toast({ title: "Missing fields", description: "Employee and date are required.", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("accidents").insert({
      company_id: companyId,
      employee_id: form.employee_id,
      accident_date: form.accident_date,
      injury_type: form.injury_type,
      description: form.description,
      medical_costs: form.medical_costs,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Recorded", description: "Accident logged in register." });
      setShowForm(false);
      setForm({ employee_id: "", accident_date: format(new Date(), "yyyy-MM-dd"), injury_type: "minor", description: "", medical_costs: 0 });
      loadData();
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

  if (loading) return <div className="text-muted-foreground p-8">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Accident Register (WC/EC)</h1>
          <p className="mt-1 text-muted-foreground">Workmen's Compensation Act compliance</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadFormEE} disabled={accidents.length === 0}>
            <Download className="mr-1 h-4 w-4" /> Form EE (.pdf)
          </Button>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="mr-1 h-4 w-4" /> Log Accident
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="mt-4">
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
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center py-12">
            <AlertTriangle className="h-10 w-10 text-muted-foreground mb-2" />
            <p className="font-medium text-foreground">No accidents recorded</p>
            <p className="text-sm text-muted-foreground">Use "Log Accident" to add entries.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-6">
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
};

export default AccidentsPage;
