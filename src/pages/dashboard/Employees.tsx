import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getSafeErrorMessage } from "@/lib/safe-error";
import { employeeSchema, getValidationError } from "@/lib/validations";

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

  // NEW: EC/WC + risk metadata
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
    emp_code: "", name: "", basic: "", hra: "", allowances: "",
    da: "", retaining_allowance: "", employment_type: "permanent",
    epf_applicable: true, esic_applicable: false, pt_applicable: true,
  });

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: company } = await supabase.from("companies").select("id").eq("user_id", user.id).maybeSingle();
      if (company) {
        setCompanyId(company.id);
        const { data: emps } = await supabase.from("employees").select("*").eq("company_id", company.id);
        if (emps) setEmployees(emps.map(e => ({ ...e, basic: Number(e.basic), hra: Number(e.hra), allowances: Number(e.allowances), gross: Number(e.gross) })));
      }
    };
    init();
  }, []);

  const filteredEmployees = employees.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()) || e.emp_code.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async () => {
    if (!companyId) {
      toast({ title: "Setup required", description: "Please set up your company first.", variant: "destructive" });
      return;
    }
    const basic = parseFloat(newEmp.basic) || 0;
    const hra = parseFloat(newEmp.hra) || 0;
    const allowances = parseFloat(newEmp.allowances) || 0;
    const da = parseFloat(newEmp.da) || 0;
    const retaining = parseFloat(newEmp.retaining_allowance) || 0;

    const validated = employeeSchema.safeParse({
      emp_code: newEmp.emp_code,
      name: newEmp.name,
      basic, hra, allowances, da,
      retaining_allowance: retaining,
      employment_type: newEmp.employment_type,
      epf_applicable: newEmp.epf_applicable,
      esic_applicable: newEmp.esic_applicable,
      pt_applicable: newEmp.pt_applicable,
    });

    if (!validated.success) {
      toast({ title: "Validation Error", description: getValidationError(validated.error), variant: "destructive" });
      return;
    }

    const { data, error } = await supabase.from("employees").insert({
      company_id: companyId,
      emp_code: newEmp.emp_code,
      name: newEmp.name,
      basic, hra, allowances,
      da, retaining_allowance: retaining,
      employment_type: newEmp.employment_type,
      gross: basic + hra + allowances,
      epf_applicable: newEmp.epf_applicable,
      esic_applicable: newEmp.esic_applicable,
      pt_applicable: newEmp.pt_applicable,
    }).select().single();

    if (error) {
      toast({ title: "Error", description: getSafeErrorMessage(error), variant: "destructive" });
      return;
    }

    setEmployees([...employees, { ...data, basic: Number(data.basic), hra: Number(data.hra), allowances: Number(data.allowances), gross: Number(data.gross) }]);
    setDialogOpen(false);
    setNewEmp({ emp_code: "", name: "", basic: "", hra: "", allowances: "", da: "", retaining_allowance: "", employment_type: "permanent", epf_applicable: true, esic_applicable: false, pt_applicable: true });
    toast({ title: "Employee added", description: "Employee saved to database." });
  };

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employees</h1>
          <p className="mt-1 text-muted-foreground">{employees.length} employees</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="mr-2 h-4 w-4" /> Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add New Employee</DialogTitle></DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Employee Code</Label><Input value={newEmp.emp_code} onChange={(e) => setNewEmp({ ...newEmp, emp_code: e.target.value })} placeholder="EMP004" /></div>
              <div className="space-y-2"><Label>Full Name</Label><Input value={newEmp.name} onChange={(e) => setNewEmp({ ...newEmp, name: e.target.value })} placeholder="Full Name" /></div>
              <div className="space-y-2"><Label>Basic (₹)</Label><Input type="number" value={newEmp.basic} onChange={(e) => setNewEmp({ ...newEmp, basic: e.target.value })} /></div>
              <div className="space-y-2"><Label>HRA (₹)</Label><Input type="number" value={newEmp.hra} onChange={(e) => setNewEmp({ ...newEmp, hra: e.target.value })} /></div>
              <div className="space-y-2"><Label>Allowances (₹)</Label><Input type="number" value={newEmp.allowances} onChange={(e) => setNewEmp({ ...newEmp, allowances: e.target.value })} /></div>
              <div className="space-y-2"><Label>DA (₹)</Label><Input type="number" value={newEmp.da} onChange={(e) => setNewEmp({ ...newEmp, da: e.target.value })} placeholder="0" /></div>
              <div className="space-y-2"><Label>Retaining Allowance (₹)</Label><Input type="number" value={newEmp.retaining_allowance} onChange={(e) => setNewEmp({ ...newEmp, retaining_allowance: e.target.value })} placeholder="0" /></div>
              <div className="space-y-2">
                <Label>Employment Type</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={newEmp.employment_type}
                  onChange={(e) => setNewEmp({ ...newEmp, employment_type: e.target.value })}
                >
                  <option value="permanent">Permanent</option>
                  <option value="fixed_term">Fixed Term</option>
                  <option value="contractor">Contractor</option>
                </select>
              </div>
              <div className="space-y-4 sm:col-span-2">
                <div className="flex items-center gap-2"><Switch checked={newEmp.epf_applicable} onCheckedChange={(v) => setNewEmp({ ...newEmp, epf_applicable: v })} /><Label>EPF Applicable</Label></div>
                <div className="flex items-center gap-2"><Switch checked={newEmp.esic_applicable} onCheckedChange={(v) => setNewEmp({ ...newEmp, esic_applicable: v })} /><Label>ESIC Applicable</Label></div>
                <div className="flex items-center gap-2"><Switch checked={newEmp.pt_applicable} onCheckedChange={(v) => setNewEmp({ ...newEmp, pt_applicable: v })} /><Label>PT Applicable</Label></div>
              </div>
            </div>
            <Button onClick={handleAdd} className="mt-4 w-full bg-accent text-accent-foreground hover:bg-accent/90">Add Employee</Button>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative mt-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by name or code..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card className="mt-4">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Basic</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead>EPF</TableHead>
                <TableHead>ESIC</TableHead>
                <TableHead>PT</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell className="font-medium">{emp.emp_code}</TableCell>
                  <TableCell>{emp.name}</TableCell>
                  <TableCell className="text-right">₹{emp.basic.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right">₹{emp.gross.toLocaleString("en-IN")}</TableCell>
                  <TableCell>{emp.epf_applicable ? <Badge variant="default" className="bg-success text-success-foreground">Yes</Badge> : <Badge variant="secondary">No</Badge>}</TableCell>
                  <TableCell>{emp.esic_applicable ? <Badge variant="default" className="bg-success text-success-foreground">Yes</Badge> : <Badge variant="secondary">No</Badge>}</TableCell>
                  <TableCell>{emp.pt_applicable ? <Badge variant="default" className="bg-success text-success-foreground">Yes</Badge> : <Badge variant="secondary">No</Badge>}</TableCell>
                  <TableCell><Badge variant={emp.status === "Active" ? "default" : "secondary"}>{emp.status}</Badge></TableCell>
                </TableRow>
              ))}
              {filteredEmployees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {companyId ? "No employees yet. Add your first employee above." : "Please set up your company first."}
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
