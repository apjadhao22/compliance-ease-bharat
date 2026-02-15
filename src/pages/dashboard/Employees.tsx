import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
}

const sampleEmployees: Employee[] = [
  { id: "1", emp_code: "EMP001", name: "Rajesh Kumar", basic: 25000, hra: 10000, allowances: 5000, gross: 40000, epf_applicable: true, esic_applicable: false, pt_applicable: true, status: "Active" },
  { id: "2", emp_code: "EMP002", name: "Priya Sharma", basic: 18000, hra: 7200, allowances: 3000, gross: 28200, epf_applicable: true, esic_applicable: true, pt_applicable: true, status: "Active" },
  { id: "3", emp_code: "EMP003", name: "Amit Patel", basic: 12000, hra: 4800, allowances: 2000, gross: 18800, epf_applicable: true, esic_applicable: true, pt_applicable: true, status: "Active" },
];

const Employees = () => {
  const [employees, setEmployees] = useState<Employee[]>(sampleEmployees);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const [newEmp, setNewEmp] = useState({
    emp_code: "", name: "", basic: "", hra: "", allowances: "",
    epf_applicable: true, esic_applicable: false, pt_applicable: true,
  });

  const filteredEmployees = employees.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()) || e.emp_code.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = () => {
    const basic = parseFloat(newEmp.basic) || 0;
    const hra = parseFloat(newEmp.hra) || 0;
    const allowances = parseFloat(newEmp.allowances) || 0;
    const emp: Employee = {
      id: crypto.randomUUID(),
      emp_code: newEmp.emp_code,
      name: newEmp.name,
      basic, hra, allowances,
      gross: basic + hra + allowances,
      epf_applicable: newEmp.epf_applicable,
      esic_applicable: newEmp.esic_applicable,
      pt_applicable: newEmp.pt_applicable,
      status: "Active",
    };
    setEmployees([...employees, emp]);
    setDialogOpen(false);
    setNewEmp({ emp_code: "", name: "", basic: "", hra: "", allowances: "", epf_applicable: true, esic_applicable: false, pt_applicable: true });
    toast({ title: "Employee added (local)", description: "Data stored in memory. Enable Cloud to persist." });
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
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Employees;
