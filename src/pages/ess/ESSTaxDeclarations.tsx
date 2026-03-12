import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const FY_OPTIONS = ["2023-24", "2024-25", "2025-26", "2026-27"];

const STANDARD_DEDUCTION = 75000; // New regime FY 2025-26+

interface Declaration {
  id?: string;
  regime: "old" | "new";
  section_80c: number;
  section_80d: number;
  section_80d_parents: number;
  hra_exemption: number;
  section_24b: number;
  section_80ccd_nps: number;
  section_80e: number;
  section_80tta: number;
  other_deductions: number;
  proof_status: string;
}

const BLANK: Omit<Declaration, "id"> = {
  regime: "new",
  section_80c: 0,
  section_80d: 0,
  section_80d_parents: 0,
  hra_exemption: 0,
  section_24b: 0,
  section_80ccd_nps: 0,
  section_80e: 0,
  section_80tta: 0,
  other_deductions: 0,
  proof_status: "declared",
};

// Rough TDS estimate (new regime slabs, FY 2025-26)
function estimateTax(grossMonthly: number, decl: Omit<Declaration, "id">) {
  const annualGross = grossMonthly * 12;
  let taxable = annualGross - STANDARD_DEDUCTION;
  if (decl.regime === "old") {
    taxable -=
      Math.min(decl.section_80c, 150000) +
      Math.min(decl.section_80d, 50000) +
      Math.min(decl.section_80d_parents, 50000) +
      decl.hra_exemption +
      Math.min(decl.section_24b, 200000) +
      Math.min(decl.section_80ccd_nps, 50000) +
      decl.section_80e +
      Math.min(decl.section_80tta, 10000) +
      decl.other_deductions;
  } else {
    taxable -= Math.min(decl.section_80ccd_nps, 50000);
  }
  taxable = Math.max(0, taxable);

  let tax = 0;
  if (decl.regime === "new") {
    // New regime slabs 2025-26
    const slabs = [
      [400000, 0],
      [400000, 0.05],
      [400000, 0.10],
      [400000, 0.15],
      [400000, 0.20],
      [Infinity, 0.30],
    ] as [number, number][];
    let rem = taxable;
    for (const [limit, rate] of slabs) {
      if (rem <= 0) break;
      const chunk = Math.min(rem, limit);
      tax += chunk * rate;
      rem -= chunk;
    }
    // Rebate u/s 87A: no tax if taxable ≤ 7L (new regime)
    if (taxable <= 700000) tax = 0;
  } else {
    // Old regime
    const slabs = [
      [250000, 0],
      [250000, 0.05],
      [500000, 0.20],
      [Infinity, 0.30],
    ] as [number, number][];
    let rem = taxable;
    for (const [limit, rate] of slabs) {
      if (rem <= 0) break;
      const chunk = Math.min(rem, limit);
      tax += chunk * rate;
      rem -= chunk;
    }
    if (taxable <= 500000) tax = 0; // 87A old regime
  }
  const cess = tax * 0.04;
  const annualTax = Math.round(tax + cess);
  return { taxable: Math.round(taxable), annualTax, monthlyTDS: Math.round(annualTax / 12) };
}

interface FieldDef {
  key: keyof Omit<Declaration, "id" | "regime" | "proof_status">;
  label: string;
  max?: number;
  hint: string;
  oldOnly?: boolean;
}

const FIELDS: FieldDef[] = [
  { key: "section_80c", label: "Section 80C", max: 150000, hint: "PPF, ELSS, LIC, tuition fees — max ₹1.5L", oldOnly: true },
  { key: "section_80d", label: "80D – Self Health Insurance", max: 50000, hint: "Max ₹25K (₹50K if senior citizen)", oldOnly: true },
  { key: "section_80d_parents", label: "80D – Parents Health Insurance", max: 50000, hint: "Max ₹25K (₹50K if parents senior citizen)", oldOnly: true },
  { key: "hra_exemption", label: "HRA Exemption", hint: "Actual HRA claim amount", oldOnly: true },
  { key: "section_24b", label: "Section 24(b) – Home Loan Interest", max: 200000, hint: "Max ₹2L for self-occupied property", oldOnly: true },
  { key: "section_80ccd_nps", label: "80CCD(1B) – NPS Additional", max: 50000, hint: "Additional NPS contribution — max ₹50K" },
  { key: "section_80e", label: "Section 80E – Education Loan", hint: "Interest on education loan (no limit)", oldOnly: true },
  { key: "section_80tta", label: "Section 80TTA – Savings Interest", max: 10000, hint: "Savings account interest — max ₹10K", oldOnly: true },
  { key: "other_deductions", label: "Other Deductions", hint: "Any other eligible deductions", oldOnly: true },
];

const ESSTaxDeclarations = () => {
  const [fy, setFy] = useState("2025-26");
  const [form, setForm] = useState<Omit<Declaration, "id">>(BLANK);
  const [declId, setDeclId] = useState<string | undefined>();
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [grossMonthly, setGrossMonthly] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadFieldRef = useRef<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    loadDeclaration();
  }, [fy, employeeId]);

  const init = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: emp } = await supabase
        .from("employees")
        .select("id, basic, hra, da, allowances")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (emp) {
        setEmployeeId(emp.id);
        const gross =
          (emp.basic ?? 0) + (emp.hra ?? 0) + (emp.da ?? 0) + (emp.allowances ?? 0);
        setGrossMonthly(gross);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadDeclaration = async () => {
    if (!employeeId) return;
    const { data } = await supabase
      .from("investment_declarations")
      .select("*")
      .eq("employee_id", employeeId)
      .eq("financial_year", fy)
      .maybeSingle();

    if (data) {
      setDeclId(data.id);
      setForm({
        regime: data.regime as "old" | "new",
        section_80c: data.section_80c ?? 0,
        section_80d: data.section_80d ?? 0,
        section_80d_parents: data.section_80d_parents ?? 0,
        hra_exemption: data.hra_exemption ?? 0,
        section_24b: data.section_24b ?? 0,
        section_80ccd_nps: data.section_80ccd_nps ?? 0,
        section_80e: data.section_80e ?? 0,
        section_80tta: data.section_80tta ?? 0,
        other_deductions: data.other_deductions ?? 0,
        proof_status: data.proof_status ?? "declared",
      });
    } else {
      setDeclId(undefined);
      setForm(BLANK);
    }
  };

  const handleSave = async () => {
    if (!employeeId) return;
    setSaving(true);
    try {
      const payload = {
        employee_id: employeeId,
        financial_year: fy,
        ...form,
        submitted_at: new Date().toISOString(),
      };

      if (declId) {
        const { error } = await supabase
          .from("investment_declarations")
          .update(payload)
          .eq("id", declId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("investment_declarations")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        setDeclId(data.id);
      }
      toast({ title: "Declaration saved", description: "Your investment declaration has been saved." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const field = uploadFieldRef.current;
    if (!field || !e.target.files?.[0] || !employeeId) return;

    const file = e.target.files[0];
    setUploadingField(field);
    try {
      const path = `tax-proofs/${employeeId}/${fy}/${field}_${Date.now()}_${file.name}`;
      const { error } = await supabase.storage
        .from("tax-proofs")
        .upload(path, file, { upsert: true });
      if (error) throw error;

      // Update proof_status to submitted
      const payload = { proof_status: "submitted" };
      if (declId) {
        await supabase.from("investment_declarations").update(payload).eq("id", declId);
        setForm((prev) => ({ ...prev, proof_status: "submitted" }));
      }
      toast({ title: "Proof uploaded", description: "Your proof has been submitted for verification." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload failed", description: err.message });
    } finally {
      setUploadingField(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const est = estimateTax(grossMonthly, form);

  const proofStatusBadge = (s: string) => {
    switch (s) {
      case "verified": return <Badge className="bg-green-100 text-green-800">Verified</Badge>;
      case "submitted": return <Badge className="bg-blue-100 text-blue-800">Submitted</Badge>;
      default: return <Badge variant="secondary">Declared</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tax Declarations</h1>
          <p className="text-muted-foreground">Declare investments for TDS computation</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={fy} onValueChange={setFy}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FY_OPTIONS.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {proofStatusBadge(form.proof_status)}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tax Regime</CardTitle>
          <CardDescription>New regime has lower rates but fewer deductions. Old regime allows more exemptions.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {(["new", "old"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setForm((p) => ({ ...p, regime: r }))}
                className={`flex-1 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                  form.regime === r
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-muted text-muted-foreground hover:border-muted-foreground"
                }`}
              >
                {r === "new" ? "New Regime" : "Old Regime"}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Investment Declarations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.filter((f) => !f.oldOnly || form.regime === "old").map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={f.key}>
                  {f.label}
                  {f.max && <span className="ml-1 text-xs text-muted-foreground">(max ₹{f.max.toLocaleString("en-IN")})</span>}
                </Label>
                <Input
                  id={f.key}
                  type="number"
                  min={0}
                  max={f.max}
                  value={form[f.key] === 0 ? "" : form[f.key]}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, [f.key]: Number(e.target.value) || 0 }))
                  }
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">{f.hint}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Declaration
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Estimated TDS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estimated TDS (FY {fy})</CardTitle>
          <CardDescription>Based on your declared investments and gross salary</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Annual Taxable Income</p>
              <p className="text-lg font-bold">₹{est.taxable.toLocaleString("en-IN")}</p>
            </div>
            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Estimated Annual Tax</p>
              <p className="text-lg font-bold">₹{est.annualTax.toLocaleString("en-IN")}</p>
            </div>
            <div className="rounded-md bg-primary/5 p-3">
              <p className="text-xs text-muted-foreground">Estimated Monthly TDS</p>
              <p className="text-lg font-bold text-primary">₹{est.monthlyTDS.toLocaleString("en-IN")}</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            * Estimates include 4% Health & Education Cess. Actual TDS may differ based on verified proofs and HR configuration.
          </p>
        </CardContent>
      </Card>

      {/* Proof Upload */}
      {declId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload Proof Documents</CardTitle>
            <CardDescription>Upload supporting documents (PDF/image) per section. Status: {form.proof_status}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {FIELDS.filter((f) => !f.oldOnly || form.regime === "old").map((f) => (
                <div key={f.key} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className="text-sm">{f.label}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploadingField === f.key}
                    onClick={() => {
                      uploadFieldRef.current = f.key;
                      fileInputRef.current?.click();
                    }}
                  >
                    {uploadingField === f.key ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Upload
                  </Button>
                </div>
              ))}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ESSTaxDeclarations;
