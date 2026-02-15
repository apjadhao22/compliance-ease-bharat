import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { calculateLWF } from "@/lib/calculations";

const employees = [
  { id: "1", name: "Rajesh Kumar" },
  { id: "2", name: "Priya Sharma" },
  { id: "3", name: "Amit Patel" },
];

const LWFPage = () => {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lwf = calculateLWF(currentMonth);

  // Show June contribution for display purposes
  const juneLwf = calculateLWF(`${now.getFullYear()}-06`);

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Labour Welfare Fund</h1>
      <p className="mt-1 text-muted-foreground">Maharashtra — Half-yearly contribution (June 30 & December 31)</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Employee Share</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-primary">₹25</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Employer Share</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-primary">₹75</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total per Employee</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-accent">₹100</p></CardContent></Card>
      </div>

      {!lwf.applicableMonth && (
        <Card className="mt-6 border-accent">
          <CardContent className="p-4 text-sm text-muted-foreground">
            LWF is not due this month. Next applicable months: June & December.
            {juneLwf.dueDate && ` Next due date: ${juneLwf.dueDate}`}
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader><CardTitle>Half-yearly LWF Summary</CardTitle><CardDescription>Frequency: Half-yearly · Deadlines: June 30 & December 31</CardDescription></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead className="text-right">Employee (₹)</TableHead><TableHead className="text-right">Employer (₹)</TableHead><TableHead className="text-right">Total (₹)</TableHead></TableRow></TableHeader>
            <TableBody>
              {employees.map((e) => (
                <TableRow key={e.id}><TableCell className="font-medium">{e.name}</TableCell><TableCell className="text-right">₹25</TableCell><TableCell className="text-right">₹75</TableCell><TableCell className="text-right font-semibold">₹100</TableCell></TableRow>
              ))}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell>Total ({employees.length} employees)</TableCell>
                <TableCell className="text-right">₹{25 * employees.length}</TableCell>
                <TableCell className="text-right">₹{75 * employees.length}</TableCell>
                <TableCell className="text-right">₹{100 * employees.length}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default LWFPage;
