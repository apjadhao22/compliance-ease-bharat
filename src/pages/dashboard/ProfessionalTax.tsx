import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calculatePT } from "@/lib/calculations";

const employees = [
  { id: "1", name: "Rajesh Kumar", gross: 40000 },
  { id: "2", name: "Priya Sharma", gross: 28200 },
  { id: "3", name: "Amit Patel", gross: 18800 },
];

const ProfessionalTax = () => {
  const isFebruary = new Date().getMonth() === 1;
  const data = employees.map((e) => ({ ...e, pt: calculatePT(e.gross, isFebruary) }));
  const total = data.reduce((s, e) => s + e.pt, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Professional Tax</h1>
      <p className="mt-1 text-muted-foreground">Maharashtra slab-based calculation{isFebruary ? " (February — ₹312 slab)" : ""}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">≤ ₹7,500</CardTitle></CardHeader><CardContent><p className="text-xl font-bold text-foreground">₹0</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">₹7,501–₹10,000</CardTitle></CardHeader><CardContent><p className="text-xl font-bold text-foreground">₹175</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">₹10,001–₹15,000</CardTitle></CardHeader><CardContent><p className="text-xl font-bold text-foreground">₹200</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">&gt; ₹15,000</CardTitle></CardHeader><CardContent><p className="text-xl font-bold text-foreground">{isFebruary ? "₹312" : "₹300"}</p></CardContent></Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Employee-wise PT</CardTitle><CardDescription>Current month deductions</CardDescription></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead className="text-right">Gross Salary</TableHead><TableHead className="text-right">PT Amount</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.map((e) => (
                <TableRow key={e.id}><TableCell className="font-medium">{e.name}</TableCell><TableCell className="text-right">₹{e.gross.toLocaleString("en-IN")}</TableCell><TableCell className="text-right">₹{e.pt}</TableCell></TableRow>
              ))}
              <TableRow className="bg-muted/50 font-bold"><TableCell>Total</TableCell><TableCell /><TableCell className="text-right">₹{total}</TableCell></TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfessionalTax;
