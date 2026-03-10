import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getSafeErrorMessage } from "@/lib/safe-error";
import { employeeSchema, getValidationError } from "@/lib/validations";
import { defineWages } from "@/lib/calculations";
import { validateWages } from "@/lib/wageValidation";
import { checkWomenNightShift } from "@/lib/oshCompliance";
import EmployeeBulkUpload from "@/components/EmployeeBulkUpload";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import PaginationControls from "@/components/PaginationControls";

const ESIC_WAGE_CEILING = 21000; // ESIC wage ceiling (₹ per month)

function getDefaultRiskRate(category: string | null | undefined): number {
  switch (category) {
    case "office_workers":
      return 0.5;
    case "light_manual":
      return 1.2;
    case "heavy_manual":
      return 2.5;
    case "construction":
      return 4.0;
    default:
      return 0.5;
  }
}

interface Employee {
  id: string;
  emp_code: string;
  name: string;
  basic: number;
  hra: number;
  allowances: number;
  da: number;
  retaining_allowance: number;
  gross: number;
  epf_applicable: boolean;
  esic_applicable: boolean;
  pt_applicable: boolean;
  uan_number?: string | null;
  esic_number?: string | null;
  status: string;
  skill_category?: string | null;
  ec_act_applicable?: boolean;
  wc_industry_classification?: string | null;
  wc_risk_category?: "office_workers" | "light_manual" | "heavy_manual" | "construction" | null;
  risk_rate?: number | null;
  worker_type?: "employee" | "contract" | "fixed_term" | "gig" | "platform" | "unorganised";
  social_security_portal_registered?: boolean;
  nduw_eshram_id?: string | null;
  gender?: string | null;
  night_shift_consent?: boolean;
  shift_policy_id?: string | null;
}

const Employees = () => {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyState, setCompanyState] = useState<string>("Maharashtra");
  const [shiftPolicies, setShiftPolicies] = useState<any[]>([]);
  const { toast } = useToast();

  const [newEmp, setNewEmp] = useState({
    emp_code: "",
    name: "",
    basic: "",
    hra: "",
    allowances: "",
    da: "",
    retaining_allowance: "",
    employment_type: "permanent",
    epf_applicable: true,
    esic_applicable: false,
    pt_applicable: true,
    uan_number: "",
    esic_number: "",
    wc_industry_classification: "",
    wc_risk_category: "office_workers",
    risk_rate: "",
    worker_type: "employee" as any,
    social_security_portal_registered: false,
    nduw_eshram_id: "",
    gender: "male",
    night_shift_consent: false,
    shift_policy_id: "",
  });

  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkScope, setBulkScope] = useState<"filtered" | "all">("filtered");
  const [bulkRiskCategory, setBulkRiskCategory] = useState<
    "office_workers" | "light_manual" | "heavy_manual" | "construction"
  >("office_workers");
  const [bulkRiskRate, setBulkRiskRate] = useState("");

  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);

  // Fetch company ID on mount
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: company } = await supabase
        .from("companies")
        .select("id, state")
        .eq("user_id", user.id)
        .maybeSingle();
      if (company) {
        setCompanyId(company.id);
        setCompanyState(company.state || "Maharashtra");
        const { data: policies } = await supabase.from("shift_policies").select("*").eq("company_id", company.id);
        if (policies) setShiftPolicies(policies);
      }
    };
    init();
  }, []);

  // Paginated employee query with server-side search
  const {
    data: paginatedEmployees,
    page,
    pageSize,
    totalCount,
    totalPages,
    isLoading,
    setSearchTerm,
    goToPage,
    nextPage,
    prevPage,
    refresh: refreshEmployees,
  } = usePaginatedQuery<Employee>({
    table: "employees",
    select: "*",
    filters: companyId ? { company_id: companyId } : {},
    orderBy: { column: "name", ascending: true },
    pageSize: 50,
    searchColumn: "name",
    enabled: !!companyId,
  });

  const employees = paginatedEmployees.map((e: any) => {
    const grossNum = Number(e.gross);
    // Real-time derivation to ensure consistency against stale data
    const isEsic = !!e.esic_number || (e.esic_applicable && grossNum <= 21000);
    const isEc = !isEsic;

    return {
      ...e,
      basic: Number(e.basic) || 0,
      hra: Number(e.hra) || 0,
      allowances: Number(e.allowances) || 0,
      da: Number(e.da) || 0,
      retaining_allowance: Number(e.retaining_allowance) || 0,
      gross: grossNum,
      uan_number: e.uan_number || null,
      esic_number: e.esic_number || null,
      risk_rate: e.risk_rate !== null ? Number(e.risk_rate) : null,
      esic_applicable: isEsic,
      ec_act_applicable: isEc
    };
  });

  const filteredEmployees = employees;

  const handleAdd = async () => {
    if (!companyId) {
      toast({
        title: "Setup required",
        description: "Please set up your company first.",
        variant: "destructive",
      });
      return;
    }

    const basic = parseFloat(newEmp.basic) || 0;
    const hra = parseFloat(newEmp.hra) || 0;
    const allowances = parseFloat(newEmp.allowances) || 0;
    const da = parseFloat(newEmp.da) || 0;
    const retaining = parseFloat(newEmp.retaining_allowance) || 0;
    const gross = basic + hra + allowances + da + retaining;

    const validated = employeeSchema.safeParse({
      emp_code: newEmp.emp_code,
      name: newEmp.name,
      basic,
      hra,
      allowances,
      da,
      retaining_allowance: retaining,
      employment_type: newEmp.employment_type,
      epf_applicable: newEmp.epf_applicable,
      esic_applicable: newEmp.esic_applicable,
      pt_applicable: newEmp.pt_applicable,
    });

    if (!validated.success) {
      toast({
        title: "Validation Error",
        description: getValidationError(validated.error),
        variant: "destructive",
      });
      return;
    }

    const wagesResult = defineWages({
      basic,
      da,
      retainingAllowance: retaining,
      allowances: hra + allowances,
    });

    const aboveEsicLimit = gross > ESIC_WAGE_CEILING;
    // Auto-disable ESIC if gross exceeds the ceiling
    const finalEsicApplicable = aboveEsicLimit ? false : validated.data.esic_applicable;
    const ecActApplicable = aboveEsicLimit || !finalEsicApplicable;

    const explicitRisk = parseFloat(newEmp.risk_rate || "0");
    const risk_rate =
      Number.isFinite(explicitRisk) && explicitRisk > 0
        ? explicitRisk
        : getDefaultRiskRate(newEmp.wc_risk_category);

    // Wire checkWomenNightShift() — OSH Code Section 43
    if (newEmp.gender === 'female' && newEmp.shift_policy_id) {
      const selectedShift = shiftPolicies.find(sp => sp.id === newEmp.shift_policy_id);
      if (selectedShift?.is_night_shift) {
        const nightCheck = checkWomenNightShift(
          'female',
          19, // night shift typically starts at 19:00
          6,  // and ends before 06:00
          newEmp.night_shift_consent
        );
        if (!nightCheck.allowed) {
          toast({
            title: "OSH Code § 43 Warning",
            description: nightCheck.warning || "Night shift consent is required for female employees.",
            variant: "destructive",
          });
          // Non-blocking: shows warning but allows save after user acknowledges
        } else if (nightCheck.warning) {
          toast({
            title: "Night Shift Safeguards Required",
            description: nightCheck.warning,
          });
        }
      }
    }

    const { data, error } = await supabase
      .from("employees")
      .insert({
        company_id: companyId,
        emp_code: newEmp.emp_code,
        name: newEmp.name,
        basic,
        hra,
        allowances,
        da,
        retaining_allowance: retaining,
        employment_type: newEmp.employment_type,
        gross,
        epf_applicable: newEmp.epf_applicable,
        esic_applicable: finalEsicApplicable,
        pt_applicable: newEmp.pt_applicable,
        uan_number: newEmp.uan_number || null,
        esic_number: newEmp.esic_number || null,
        ec_act_applicable: ecActApplicable,
        wc_industry_classification: newEmp.wc_industry_classification || null,
        wc_risk_category: newEmp.wc_risk_category || null,
        risk_rate,
        worker_type: newEmp.worker_type,
        social_security_portal_registered: newEmp.social_security_portal_registered,
        nduw_eshram_id: newEmp.nduw_eshram_id || null,
        gender: newEmp.gender,
        night_shift_consent: newEmp.night_shift_consent,
        shift_policy_id: newEmp.shift_policy_id || null,
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Error",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
      return;
    }

    refreshEmployees();

    setDialogOpen(false);
    setNewEmp({
      emp_code: "",
      name: "",
      basic: "",
      hra: "",
      allowances: "",
      da: "",
      retaining_allowance: "",
      employment_type: "permanent",
      epf_applicable: true,
      esic_applicable: false,
      pt_applicable: true,
      uan_number: "",
      esic_number: "",
      wc_industry_classification: "",
      wc_risk_category: "office_workers",
      risk_rate: "",
      worker_type: "employee",
      social_security_portal_registered: false,
      nduw_eshram_id: "",
      gender: "male",
      night_shift_consent: false,
      shift_policy_id: "",
    });

    toast({
      title: "Employee added",
      description: "Employee saved with EC/WC coverage and risk factor.",
    });
  };

  const handleBulkApply = async () => {
    const target = bulkScope === "filtered" ? filteredEmployees : employees;
    const ids = target.map((e) => e.id);

    if (!companyId || ids.length === 0) {
      toast({
        title: "Nothing to update",
        description: "No matching employees found.",
        variant: "destructive",
      });
      return;
    }

    const explicit = parseFloat(bulkRiskRate || "0");
    const finalRate =
      Number.isFinite(explicit) && explicit > 0
        ? explicit
        : getDefaultRiskRate(bulkRiskCategory);

    const { error } = await supabase
      .from("employees")
      .update({
        wc_risk_category: bulkRiskCategory,
        risk_rate: finalRate,
      })
      .in("id", ids);

    if (error) {
      toast({
        title: "Error",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
      return;
    }

    refreshEmployees();

    setBulkDialogOpen(false);
    toast({
      title: "WC risk updated",
      description: `Updated ${ids.length} employee(s).`,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground">
            Maintain employee master with EPF/ESIC/PT flags and WC/EC risk
            factors.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkUploadOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Import Excel
          </Button>
          <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">Bulk WC Risk Update</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk update WC risk factor</DialogTitle>
                <DialogDescription>
                  Apply a new WC risk category and optional risk rate to many
                  employees at once.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Apply to</Label>
                  <div className="flex flex-col gap-2 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="bulkScope"
                        value="filtered"
                        checked={bulkScope === "filtered"}
                        onChange={() => setBulkScope("filtered")}
                      />
                      <span>
                        Current search results ({filteredEmployees.length})
                      </span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="bulkScope"
                        value="all"
                        checked={bulkScope === "all"}
                        onChange={() => setBulkScope("all")}
                      />
                      <span>All employees ({employees.length})</span>
                    </label>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>WC risk category</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={bulkRiskCategory}
                      onChange={(e) =>
                        setBulkRiskCategory(e.target.value as any)
                      }
                    >
                      <option value="office_workers">
                        Office workers (low risk)
                      </option>
                      <option value="light_manual">
                        Light manual / warehouse
                      </option>
                      <option value="heavy_manual">
                        Heavy manual / factory
                      </option>
                      <option value="construction">
                        Construction / high risk
                      </option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Override risk rate (per ₹100 annual wages)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={bulkRiskRate}
                      onChange={(e) => setBulkRiskRate(e.target.value)}
                      placeholder="Leave blank to use suggested rate"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Leave blank to use the suggested rate for this category.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setBulkDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleBulkApply}>Apply changes</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Employee
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Employee</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Employee code</Label>
                    <Input
                      value={newEmp.emp_code}
                      onChange={(e) =>
                        setNewEmp((p) => ({ ...p, emp_code: e.target.value }))
                      }
                      placeholder="EMP001"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Name</Label>
                    <Input
                      value={newEmp.name}
                      onChange={(e) =>
                        setNewEmp((p) => ({ ...p, name: e.target.value }))
                      }
                      placeholder="Employee name"
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Basic</Label>
                    <Input
                      type="number"
                      value={newEmp.basic}
                      onChange={(e) =>
                        setNewEmp((p) => ({ ...p, basic: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>HRA</Label>
                    <Input
                      type="number"
                      value={newEmp.hra}
                      onChange={(e) =>
                        setNewEmp((p) => ({ ...p, hra: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Allowances</Label>
                    <Input
                      type="number"
                      value={newEmp.allowances}
                      onChange={(e) =>
                        setNewEmp((p) => ({
                          ...p,
                          allowances: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>DA</Label>
                    <Input
                      type="number"
                      value={newEmp.da}
                      onChange={(e) =>
                        setNewEmp((p) => ({ ...p, da: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Retaining allowance</Label>
                    <Input
                      type="number"
                      value={newEmp.retaining_allowance}
                      onChange={(e) =>
                        setNewEmp((p) => ({
                          ...p,
                          retaining_allowance: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Engagement / Worker Type</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={newEmp.worker_type}
                      onChange={(e) =>
                        setNewEmp((p) => ({
                          ...p,
                          worker_type: e.target.value as any,
                        }))
                      }
                    >
                      <option value="employee">Regular Employee</option>
                      <option value="fixed_term">Fixed Term</option>
                      <option value="contract">Contractor</option>
                      <option value="gig">Gig Worker</option>
                      <option value="platform">Platform Worker</option>
                      <option value="unorganised">Unorganised Worker</option>
                    </select>
                    <p className="text-[11px] text-muted-foreground">
                      Social Security Code categorisation. Determines EPF/ESIC vs Cess rules.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 mt-4 p-3 border rounded border-border bg-muted/10">
                  <div className="space-y-1.5">
                    <Label>Gender</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={newEmp.gender || ''}
                      onChange={(e) => setNewEmp((p) => ({ ...p, gender: e.target.value }))}
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Shift Policy</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={newEmp.shift_policy_id || ''}
                      onChange={(e) => setNewEmp((p) => ({ ...p, shift_policy_id: e.target.value }))}
                    >
                      <option value="">-- No Shift Assigned --</option>
                      {shiftPolicies.map(sp => (
                        <option key={sp.id} value={sp.id}>{sp.name} {sp.is_night_shift ? '(Night Shift)' : ''}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {(() => {
                  const selShift = shiftPolicies.find(sp => sp.id === newEmp.shift_policy_id);
                  if (selShift && newEmp.gender === 'female' && selShift.is_night_shift) {
                    return (
                      <div className="mt-1 p-3 rounded border border-orange-200 bg-orange-50 mb-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-orange-900 font-semibold">Night Shift Consent Recorded?</Label>
                          <Switch checked={newEmp.night_shift_consent} onCheckedChange={v => setNewEmp(p => ({ ...p, night_shift_consent: v }))} />
                        </div>
                        {!newEmp.night_shift_consent && (
                          <p className="text-xs text-red-600 mt-2 font-medium">
                            ⚠ OSH Code Sec 43 Violation: Women cannot be assigned night shifts without documented consent and safety measures (transport, security).
                          </p>
                        )}
                      </div>
                    )
                  }
                  return null;
                })()}

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="flex items-center justify-between space-x-2 rounded-md border p-2">
                    <div>
                      <Label className="text-sm">EPF applicable</Label>
                      <p className="text-xs text-muted-foreground">
                        Include in EPF calculations.
                      </p>
                    </div>
                    <Switch
                      checked={newEmp.epf_applicable}
                      onCheckedChange={(v) =>
                        setNewEmp((p) => ({ ...p, epf_applicable: v }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between space-x-2 rounded-md border p-2">
                    <div>
                      <Label className="text-sm">ESIC applicable</Label>
                      <p className="text-xs text-muted-foreground">
                        Below ESIC wage ceiling and covered.
                      </p>
                    </div>
                    <Switch
                      checked={newEmp.esic_applicable}
                      onCheckedChange={(v) =>
                        setNewEmp((p) => ({ ...p, esic_applicable: v }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between space-x-2 rounded-md border p-2">
                    <div>
                      <Label className="text-sm">PT applicable</Label>
                      <p className="text-xs text-muted-foreground">
                        Include in Professional Tax.
                      </p>
                    </div>
                    <Switch
                      checked={newEmp.pt_applicable}
                      onCheckedChange={(v) =>
                        setNewEmp((p) => ({ ...p, pt_applicable: v }))
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>UAN Number</Label>
                    <Input
                      value={newEmp.uan_number}
                      onChange={(e) =>
                        setNewEmp((p) => ({ ...p, uan_number: e.target.value }))
                      }
                      placeholder="12-digit UAN"
                      maxLength={12}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>ESIC Number</Label>
                    <Input
                      value={newEmp.esic_number}
                      onChange={(e) =>
                        setNewEmp((p) => ({ ...p, esic_number: e.target.value }))
                      }
                      placeholder="17-digit ESIC No."
                      maxLength={17}
                    />
                  </div>
                </div>

                {['gig', 'platform', 'unorganised'].includes(newEmp.worker_type) && (
                  <div className="grid gap-3 md:grid-cols-2 rounded-md border border-orange-200 bg-orange-50/30 p-3">
                    <div className="flex items-center justify-between space-x-2">
                      <div>
                        <Label className="text-sm">Social Security Portal (e-Shram/NDUW)</Label>
                        <p className="text-xs text-muted-foreground">
                          Worker registered on Government portal?
                        </p>
                      </div>
                      <Switch
                        checked={newEmp.social_security_portal_registered}
                        onCheckedChange={(v) =>
                          setNewEmp((p) => ({ ...p, social_security_portal_registered: v }))
                        }
                      />
                    </div>

                    {newEmp.social_security_portal_registered && (
                      <div className="space-y-1.5">
                        <Label>UAN / NDUW / e-Shram No.</Label>
                        <Input
                          value={newEmp.nduw_eshram_id}
                          onChange={(e) =>
                            setNewEmp((p) => ({ ...p, nduw_eshram_id: e.target.value }))
                          }
                          placeholder="Registration ID"
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-2 rounded-md border p-3 space-y-3">
                  <p className="text-sm font-medium text-foreground">
                    WC / EC Coverage
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Employees above the ESIC wage limit (₹{ESIC_WAGE_CEILING}) or
                    not under ESIC are automatically treated as EC / WC covered
                    for premium estimates.
                  </p>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Industry classification</Label>
                      <Input
                        placeholder="e.g. Engineering, IT services, Construction"
                        value={newEmp.wc_industry_classification}
                        onChange={(e) =>
                          setNewEmp((p) => ({
                            ...p,
                            wc_industry_classification: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>WC risk category</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={newEmp.wc_risk_category}
                        onChange={(e) =>
                          setNewEmp((p) => ({
                            ...p,
                            wc_risk_category: e.target.value as any,
                          }))
                        }
                      >
                        <option value="office_workers">
                          Office workers (low risk)
                        </option>
                        <option value="light_manual">
                          Light manual / warehouse
                        </option>
                        <option value="heavy_manual">
                          Heavy manual / factory
                        </option>
                        <option value="construction">
                          Construction / high risk
                        </option>
                      </select>
                      <p className="text-[11px] text-muted-foreground">
                        This decides the suggested WC premium rate per ₹100 of
                        annual wages.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Override risk rate (per ₹100 annual wages)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={newEmp.risk_rate}
                        onChange={(e) =>
                          setNewEmp((p) => ({
                            ...p,
                            risk_rate: e.target.value,
                          }))
                        }
                        placeholder="Leave blank to use suggested rate"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Leave blank to use the suggested rate from the selected
                        category. Enter a value to override.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleAdd}>Save employee</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            className="pl-8 w-64"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSearchTerm(e.target.value); }}
          />
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
          Showing {filteredEmployees.length} of {totalCount.toLocaleString("en-IN")} employees
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead>Skill Cat.</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-center">EPF</TableHead>
                <TableHead className="text-center">ESIC</TableHead>
                <TableHead className="text-center">PT</TableHead>
                <TableHead className="text-center">Social Sec. (SSP)</TableHead>
                <TableHead>WC Risk category</TableHead>
                <TableHead className="text-right">Risk rate</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">
                    {e.emp_code}
                  </TableCell>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-0.5">
                      <span>₹{Number(e.gross).toLocaleString("en-IN")}</span>
                      {(() => {
                        const wagesDef = defineWages({
                          basic: e.basic,
                          da: e.da,
                          retainingAllowance: e.retaining_allowance,
                          allowances: e.hra + e.allowances
                        });

                        const validation = validateWages({
                          employeeId: e.id,
                          state: companyState,
                          category: e.wc_industry_classification || '', // Approximation, could be improved
                          skillLevel: e.skill_category || '',
                          actualMonthlyWages: wagesDef.wages // Defined wages used for statutory checks
                        });

                        if (!validation.isCompliant || !wagesDef.isCompliant) {
                          return (
                            <div className="flex flex-col gap-1 mt-1 text-right">
                              {!wagesDef.isCompliant && (
                                <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 rounded px-1 py-0.5" title={`Exclusions exceed 50% of total remuneration. Suggested Basic+DA: ₹${wagesDef.suggestedStructure.basicDaRetaining}`}>
                                  ⚠ 50% Wage Rule
                                </span>
                              )}
                              {!validation.isCompliant && validation.violations.map((v, i) => (
                                <span key={`wage-viol-${i}`} className="text-[10px] font-semibold text-red-600 bg-red-50 rounded px-1 py-0.5" title={v.issue}>
                                  ⚠ {v.issue.includes('Floor Wage') ? 'Floor Wage' : 'Min Wage'} short by ₹{v.shortfall.toLocaleString("en-IN")}
                                </span>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.skill_category || "—"}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={e.epf_applicable ? "secondary" : "outline"}>
                      {e.epf_applicable ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={e.esic_applicable ? "secondary" : "outline"}
                    >
                      {e.esic_applicable ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    <Badge variant="outline" className="capitalize">
                      {(e.worker_type || "").replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={e.pt_applicable ? "secondary" : "outline"}>
                      {e.pt_applicable ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {['gig', 'platform', 'unorganised'].includes(e.worker_type || '') ? (
                      <Badge variant={e.social_security_portal_registered ? "default" : "destructive"}>
                        {e.social_security_portal_registered ? "Registered" : "Pending"}
                      </Badge>
                    ) : (
                      <Badge variant={e.ec_act_applicable ? "default" : "outline"}>
                        {e.ec_act_applicable ? "Covered (EC)" : "Not covered"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {e.wc_risk_category
                      ? e.wc_risk_category.replace("_", " ")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {e.risk_rate != null ? `${e.risk_rate.toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {e.status || "Active"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {filteredEmployees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                    No employees found. Add an employee to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        <PaginationControls
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={goToPage}
          onNext={nextPage}
          onPrev={prevPage}
          isLoading={isLoading}
        />
      </Card>
      <EmployeeBulkUpload
        companyId={companyId!}
        open={bulkUploadOpen}
        onOpenChange={setBulkUploadOpen}
        onRefresh={refreshEmployees}
      />
    </div >
  );
};

export default Employees;
