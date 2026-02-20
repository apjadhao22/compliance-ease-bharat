import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getSafeErrorMessage } from "@/lib/safe-error";
import { employeeSchema, getValidationError } from "@/lib/validations";

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
  gross: number;
  epf_applicable: boolean;
  esic_applicable: boolean;
  pt_applicable: boolean;
  status: string;

  ec_act_applicable?: boolean;
  wc_industry_classification?: string | null;
  wc_risk_category?: "office_workers" | "light_manual" | "heavy_manual" | "construction" | null;
  risk_rate?: number | null;
}

const Employees = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
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
    wc_industry_classification: "",
    wc_risk_category: "office_workers",
    risk_rate: "",
  });

  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkScope, setBulkScope] = useState<"filtered" | "all">("filtered");
  const [bulkRiskCategory, setBulkRiskCategory] = useState<
    "office_workers" | "light_manual" | "heavy_manual" | "construction"
  >("office_workers");
  const [bulkRiskRate, setBulkRiskRate] = useState("");

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: company } = await supabase
        .from("companies")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (company) {
        setCompanyId(company.id);
        const { data: emps } = await supabase
          .from("employees")
          .select("*")
          .eq("company_id", company.id);

        if (emps) {
          setEmployees(
            emps.map((e: any) => ({
              ...e,
              basic: Number(e.basic),
              hra: Number(e.hra),
              allowances: Number(e.allowances),
              gross: Number(e.gross),
              risk_rate: e.risk_rate !== null ? Number(e.risk_rate) : null,
            }))
          );
        }
      }
    };
    init();
  }, []);

  const filteredEmployees = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.emp_code.toLowerCase().includes(search.toLowerCase())
  );

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
    const gross = basic + hra + allowances;

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

    const aboveEsicLimit = gross > ESIC_WAGE_CEILING;
    const ecActApplicable = aboveEsicLimit || !validated.data.esic_applicable;

    const explicitRisk = parseFloat(newEmp.risk_rate || "0");
    const risk_rate =
      Number.isFinite(explicitRisk) && explicitRisk > 0
        ? explicitRisk
        : getDefaultRiskRate(newEmp.wc_risk_category);

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
        esic_applicable: newEmp.esic_applicable,
        pt_applicable: newEmp.pt_applicable,
        ec_act_applicable: ecActApplicable,
        wc_industry_classification: newEmp.wc_industry_classification || null,
        wc_risk_category: newEmp.wc_risk_category || null,
        risk_rate,
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

    setEmployees((prev) => [
      ...prev,
      {
        ...(data as any),
        basic: Number((data as any).basic),
        hra: Number((data as any).hra),
        allowances: Number((data as any).allowances),
        gross: Number((data as any).gross),
        risk_rate:
          (data as any).risk_rate !== null
            ? Number((data as any).risk_rate)
            : null,
      } as Employee,
    ]);

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
      wc_industry_classification: "",
      wc_risk_category: "office_workers",
      risk_rate: "",
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

    setEmployees((prev) =>
      prev.map((e) =>
        ids.includes(e.id)
          ? {
              ...e,
              wc_risk_category: bulkRiskCategory,
              risk_rate: finalRate,
            }
          : e
      )
    );

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
                    <Label>Employment type</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={newEmp.employment_type}
                      onChange={(e) =>
                        setNewEmp((p) => ({
                          ...p,
                          employment_type: e.target.value,
                        }))
                      }
                    >
                      <option value="permanent">Permanent</option>
                      <option value="fixed_term">Fixed term</option>
                      <option value="contractor">Contractor</option>
                    </select>
                  </div>
                </div>

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
            placeholder="Search by name or code..."
            className="pl-8 w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="text-xs text-muted-foreground">
          Showing {filteredEmployees.length} of {employees.length} employees
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
                <TableHead className="text-center">EPF</TableHead>
                <TableHead className="text-center">ESIC</TableHead>
                <TableHead className="text-center">PT</TableHead>
                <TableHead className="text-center">EC / WC</TableHead>
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
                    ₹{Number(e.gross).toLocaleString("en-IN")}
                  </TableCell>
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
                  <TableCell className="text-center">
                    <Badge variant={e.pt_applicable ? "secondary" : "outline"}>
                      {e.pt_applicable ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={e.ec_act_applicable ? "default" : "outline"}
                    >
                      {e.ec_act_applicable ? "Covered" : "Not covered"}
                    </Badge>
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
      </Card>
    </div>
  );
};

export default Employees;
