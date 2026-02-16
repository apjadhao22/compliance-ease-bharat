import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const CompanySetup = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState({
    name: "", pan: "", tan: "", state: "Maharashtra", city: "Pune",
    epf_code: "", esic_code: "", pt_rc_number: "", lwf_number: "",
    compliance_regime: "legacy_acts",
  });

  useEffect(() => {
    const fetchCompany = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("companies").select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        setCompany({
          name: data.name || "", pan: data.pan || "", tan: data.tan || "",
          state: data.state || "Maharashtra", city: data.city || "Pune",
          epf_code: data.epf_code || "", esic_code: data.esic_code || "",
          pt_rc_number: data.pt_rc_number || "", lwf_number: data.lwf_number || "",
          compliance_regime: (data as any).compliance_regime || "legacy_acts",
        });
      }
    };
    fetchCompany();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("companies").upsert({
        user_id: user.id,
        ...company,
      }, { onConflict: "user_id" });

      if (error) throw error;
      toast({ title: "Saved!", description: "Company details saved successfully." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Company Setup</h1>
      <p className="mt-1 text-muted-foreground">Enter your company details and registration numbers</p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
          <CardDescription>Basic details and statutory registration numbers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: "Company Name", key: "name", placeholder: "Acme Pvt Ltd" },
              { label: "PAN", key: "pan", placeholder: "AAACA1234A" },
              { label: "TAN", key: "tan", placeholder: "PNEA12345A" },
              { label: "State", key: "state", placeholder: "Maharashtra" },
              { label: "City", key: "city", placeholder: "Pune" },
              { label: "EPF Code", key: "epf_code", placeholder: "MH/PUN/12345" },
              { label: "ESIC Code", key: "esic_code", placeholder: "31000123456789" },
              { label: "PT RC Number", key: "pt_rc_number", placeholder: "PT/MH/123456" },
              { label: "LWF Number", key: "lwf_number", placeholder: "LWF/MH/123" },
            ].map((field) => (
              <div key={field.key} className="space-y-2">
                <Label>{field.label}</Label>
                <Input
                  placeholder={field.placeholder}
                  value={company[field.key as keyof typeof company]}
                  onChange={(e) => setCompany({ ...company, [field.key]: e.target.value })}
                />
              </div>
            ))}
            <div className="space-y-2 sm:col-span-2">
              <Label>Compliance Regime</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={company.compliance_regime}
                onChange={(e) => setCompany({ ...company, compliance_regime: e.target.value })}
              >
                <option value="legacy_acts">Legacy Acts (Pre-Codes)</option>
                <option value="labour_codes">New Labour Codes (50% wage rule)</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Use "New Labour Codes" when your state has fully implemented the Codes and salary structures are updated.
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={loading} className="mt-6 bg-accent text-accent-foreground hover:bg-accent/90">
            {loading ? "Saving..." : "Save Company Details"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompanySetup;
