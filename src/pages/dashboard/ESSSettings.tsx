import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, Users, ExternalLink, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// ─── Feature definitions ─────────────────────────────────────

type FeatureKey =
  | "payslips_enabled"
  | "tax_declarations_enabled"
  | "leave_requests_enabled"
  | "profile_edit_enabled"
  | "timesheets_enabled"
  | "shift_schedule_enabled"
  | "comp_off_enabled"
  | "regularization_enabled"
  | "expenses_enabled"
  | "advances_enabled"
  | "annual_statement_enabled"
  | "documents_enabled"
  | "assets_enabled"
  | "notices_enabled"
  | "grievance_enabled"
  | "posh_complaint_enabled"
  | "maternity_tracking_enabled"
  | "exit_request_enabled";

interface FeatureDef {
  key: FeatureKey;
  label: string;
  description: string;
}

const FEATURE_GROUPS: { title: string; features: FeatureDef[] }[] = [
  {
    title: "Core",
    features: [
      { key: "payslips_enabled", label: "Payslips", description: "Employees can view and download their monthly payslips." },
      { key: "tax_declarations_enabled", label: "Tax Declarations", description: "Employees can declare investments and claim exemptions (80C, HRA, etc.)." },
      { key: "leave_requests_enabled", label: "Leave Requests", description: "Employees can apply for and track leave requests." },
      { key: "profile_edit_enabled", label: "Profile Edit", description: "Employees can update contact details and emergency information." },
    ],
  },
  {
    title: "Time & Attendance",
    features: [
      { key: "timesheets_enabled", label: "Timesheets", description: "Employees can view and submit their attendance timesheets." },
      { key: "shift_schedule_enabled", label: "Shift Schedule", description: "Employees can view their upcoming shift schedule." },
      { key: "comp_off_enabled", label: "Comp-Off Requests", description: "Employees can request compensatory off for extra hours worked." },
      { key: "regularization_enabled", label: "Attendance Regularization", description: "Employees can raise regularization requests for missed punches." },
    ],
  },
  {
    title: "Finance",
    features: [
      { key: "expenses_enabled", label: "Expense Claims", description: "Employees can submit and track expense reimbursement requests." },
      { key: "advances_enabled", label: "Advance Requests", description: "Employees can request salary advances." },
      { key: "annual_statement_enabled", label: "Annual Salary Statement", description: "Employees can download the annual salary statement for tax filing." },
    ],
  },
  {
    title: "Documents & Communication",
    features: [
      { key: "documents_enabled", label: "Document Downloads", description: "Employees can download HR documents (offer letters, experience letters, etc.)." },
      { key: "assets_enabled", label: "Asset Acknowledgment", description: "Employees can view and acknowledge company assets assigned to them." },
      { key: "notices_enabled", label: "Notice Board", description: "Employees can read company-wide notices and announcements." },
    ],
  },
  {
    title: "Compliance & Grievance",
    features: [
      { key: "grievance_enabled", label: "Grievance Submission", description: "Employees can raise and track HR grievances." },
      { key: "posh_complaint_enabled", label: "POSH Complaints", description: "Employees can file complaints under the Prevention of Sexual Harassment policy." },
      { key: "maternity_tracking_enabled", label: "Maternity Tracking", description: "Employees can view maternity benefit entitlements and status." },
    ],
  },
  {
    title: "Lifecycle",
    features: [
      { key: "exit_request_enabled", label: "Exit / Resignation", description: "Employees can submit and track resignation requests." },
    ],
  },
];

type FeatureState = Record<FeatureKey, boolean>;

const DEFAULT_FEATURES: FeatureState = {
  payslips_enabled: true,
  tax_declarations_enabled: true,
  leave_requests_enabled: true,
  profile_edit_enabled: true,
  timesheets_enabled: false,
  shift_schedule_enabled: false,
  comp_off_enabled: false,
  regularization_enabled: false,
  expenses_enabled: false,
  advances_enabled: false,
  annual_statement_enabled: false,
  documents_enabled: false,
  assets_enabled: false,
  notices_enabled: false,
  grievance_enabled: false,
  posh_complaint_enabled: false,
  maternity_tracking_enabled: false,
  exit_request_enabled: false,
};

// ─── Component ───────────────────────────────────────────────

const ESSSettings = () => {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [essEnabled, setEssEnabled] = useState(false);
  const [features, setFeatures] = useState<FeatureState>(DEFAULT_FEATURES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ invited: 0, activated: 0, total: 0 });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: cm } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (!cm) { setLoading(false); return; }
      setCompanyId(cm.company_id);

      // Load company ess_enabled
      const { data: company } = await supabase
        .from("companies")
        .select("ess_enabled")
        .eq("id", cm.company_id)
        .maybeSingle();

      if (company) setEssEnabled(company.ess_enabled ?? false);

      // Load feature config
      const { data: config } = await supabase
        .from("ess_feature_config")
        .select("*")
        .eq("company_id", cm.company_id)
        .maybeSingle();

      if (config) {
        const loaded: FeatureState = { ...DEFAULT_FEATURES };
        (Object.keys(DEFAULT_FEATURES) as FeatureKey[]).forEach((key) => {
          if (key in config) loaded[key] = (config as any)[key] ?? DEFAULT_FEATURES[key];
        });
        setFeatures(loaded);
      }

      // ESS adoption stats
      const { data: emps } = await supabase
        .from("employees")
        .select("id, ess_invited_at, ess_activated_at")
        .eq("company_id", cm.company_id);

      if (emps) {
        setStats({
          total: emps.length,
          invited: emps.filter((e) => e.ess_invited_at).length,
          activated: emps.filter((e) => e.ess_activated_at).length,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMasterToggle = async (checked: boolean) => {
    if (!companyId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("companies")
        .update({ ess_enabled: checked })
        .eq("id", companyId);
      if (error) throw error;
      setEssEnabled(checked);
      toast({
        title: checked ? "ESS portal enabled" : "ESS portal disabled",
        description: checked
          ? "Employees can now access the self-service portal."
          : "The employee portal has been disabled for your organization.",
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFeatures = async () => {
    if (!companyId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("ess_feature_config")
        .upsert({ company_id: companyId, ...features, updated_at: new Date().toISOString() }, { onConflict: "company_id" });
      if (error) throw error;
      // Invalidate cache so hooks reload
      await queryClient.invalidateQueries({ queryKey: ["ess_feature_config"] });
      toast({ title: "Changes saved", description: "ESS feature configuration has been updated." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const essUrl = `${window.location.origin}/ess/login`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Employee Self-Service Configuration</h1>
        <p className="text-muted-foreground">Control which ESS features are available to your employees.</p>
      </div>

      {/* Master portal toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Portal Status</CardTitle>
          <CardDescription>
            When enabled, invited employees can sign in at{" "}
            <a href={essUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline underline-offset-2">
              {essUrl}
              <ExternalLink className="h-3 w-3" />
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch
              id="ess_enabled"
              checked={essEnabled}
              onCheckedChange={handleMasterToggle}
              disabled={saving}
            />
            <Label htmlFor="ess_enabled" className="cursor-pointer">
              {essEnabled ? (
                <Badge className="bg-green-100 text-green-800">ESS Portal Enabled</Badge>
              ) : (
                <Badge variant="secondary">ESS Portal Disabled</Badge>
              )}
            </Label>
            {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          {!essEnabled && (
            <p className="mt-2 text-sm text-muted-foreground">
              When disabled, employees visiting the portal will see a "Portal Unavailable" message.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Feature groups */}
      <div className={!essEnabled ? "pointer-events-none opacity-50" : ""}>
        {FEATURE_GROUPS.map((group, gi) => (
          <Card key={gi} className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{group.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0 divide-y">
              {group.features.map((feat, fi) => (
                <div key={feat.key} className={fi === 0 ? "pb-3" : "py-3"}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">{feat.label}</p>
                      <p className="text-xs text-muted-foreground">{feat.description}</p>
                    </div>
                    <Switch
                      checked={features[feat.key]}
                      onCheckedChange={(checked) =>
                        setFeatures((prev) => ({ ...prev, [feat.key]: checked }))
                      }
                      disabled={saving || !essEnabled}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        <Button onClick={handleSaveFeatures} disabled={saving || !essEnabled} className="mt-2">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      <Separator />

      {/* ESS adoption stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Adoption Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-md bg-muted/40 p-4 text-center">
              <p className="text-3xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total employees</p>
            </div>
            <div className="rounded-md bg-yellow-50 p-4 text-center">
              <p className="text-3xl font-bold text-yellow-700">{stats.invited}</p>
              <p className="text-sm text-muted-foreground">Invited</p>
            </div>
            <div className="rounded-md bg-green-50 p-4 text-center">
              <p className="text-3xl font-bold text-green-700">{stats.activated}</p>
              <p className="text-sm text-muted-foreground">Active on ESS</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            To invite employees, go to the <strong>Employees</strong> page and click "Invite" next to each employee.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ESSSettings;
