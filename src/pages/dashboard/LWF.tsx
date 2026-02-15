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
  const lwf = calculateLWF();

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Labour Welfare Fund</h1>
      <p className="mt-1 text-muted-foreground">Maharashtra — Half-yearly contribution (June 30 & December 31)</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Employee Share</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-primary">₹{lwf.employee}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Employer Share</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-primary">₹{lwf.employer}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total per Employee</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-accent">₹{lwf.total}</p></CardContent></Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Half-yearly LWF Summary</CardTitle><CardDescription>Frequency: {lwf.frequency} · Deadlines: June 30 & December 31</CardDescription></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead className="text-right">Employee (₹)</TableHead><TableHead className="text-right">Employer (₹)</TableHead><TableHead className="text-right">Total (₹)</TableHead></TableRow></TableHeader>
            <TableBody>
              {employees.map((e) => (
                <TableRow key={e.id}><TableCell className="font-medium">{e.name}</TableCell><TableCell className="text-right">₹{lwf.employee}</TableCell><TableCell className="text-right">₹{lwf.employer}</TableCell><TableCell className="text-right font-semibold">₹{lwf.total}</TableCell></TableRow>
              ))}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell>Total ({employees.length} employees)</TableCell>
                <TableCell className="text-right">₹{lwf.employee * employees.length}</TableCell>
                <TableCell className="text-right">₹{lwf.employer * employees.length}</TableCell>
                <TableCell className="text-right">₹{lwf.total * employees.length}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default LWFPage;
