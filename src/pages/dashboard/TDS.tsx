import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calculateTDS } from "@/lib/calculations";

const employees = [
  { id: "1", name: "Rajesh Kumar", gross: 40000 },
  { id: "2", name: "Priya Sharma", gross: 28200 },
  { id: "3", name: "Amit Patel", gross: 18800 },
];

const TDSPage = () => {
  const data = employees.map((e) => {
    const tds = calculateTDS(e.gross * 12);
    return { ...e, ...tds };
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">TDS on Salaries</h1>
      <p className="mt-1 text-muted-foreground">New Tax Regime — FY 2025-26 · Standard Deduction ₹75,000</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { slab: "₹0 – ₹4L", rate: "Nil" },
          { slab: "₹4L – ₹8L", rate: "5%" },
          { slab: "₹8L – ₹12L", rate: "10%" },
          { slab: "₹12L – ₹16L", rate: "15%" },
        ].map((s) => (
          <Card key={s.slab}><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{s.slab}</CardTitle></CardHeader><CardContent><p className="text-xl font-bold text-foreground">{s.rate}</p></CardContent></Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Employee-wise TDS</CardTitle><CardDescription>Monthly TDS deduction with 4% Health & Education Cess</CardDescription></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead className="text-right">Annual Gross</TableHead><TableHead className="text-right">Taxable Income</TableHead><TableHead className="text-right">Annual Tax</TableHead><TableHead className="text-right">Monthly TDS</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell className="text-right">₹{(e.gross * 12).toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right">₹{e.taxableIncome.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right">₹{e.annualTax.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right font-semibold">₹{e.monthlyTDS.toLocaleString("en-IN")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default TDSPage;
