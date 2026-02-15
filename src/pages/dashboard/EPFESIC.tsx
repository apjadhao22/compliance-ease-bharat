import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { calculateEPF, calculateESIC } from "@/lib/calculations";

const sampleEmployees = [
  { id: "1", name: "Rajesh Kumar", basic: 25000, gross: 40000, epf: true, esic: false },
  { id: "2", name: "Priya Sharma", basic: 18000, gross: 28200, epf: true, esic: true },
  { id: "3", name: "Amit Patel", basic: 12000, gross: 18800, epf: true, esic: true },
];

const EPFESICPage = () => {
  const [month] = useState("February 2026");

  const epfData = sampleEmployees.filter((e) => e.epf).map((e) => ({ ...e, ...calculateEPF(e.basic) }));
  const esicData = sampleEmployees.filter((e) => e.esic).map((e) => ({ ...e, ...calculateESIC(e.gross) }));

  const totalEPFEmployee = epfData.reduce((s, e) => s + e.employeeEPF, 0);
  const totalEPFEmployer = epfData.reduce((s, e) => s + e.employerTotal, 0);
  const totalESICEmployee = esicData.reduce((s, e) => s + e.employeeESIC, 0);
  const totalESICEmployer = esicData.reduce((s, e) => s + e.employerESIC, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">EPF & ESIC</h1>
      <p className="mt-1 text-muted-foreground">Monthly contributions for {month}</p>

      {/* EPF */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>EPF Contributions</CardTitle>
          <CardDescription>Employee 12% of basic · Employer 3.67% EPF + 8.33% EPS (EPS capped at ₹15,000)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Basic</TableHead>
                <TableHead className="text-right">Emp. EPF (12%)</TableHead>
                <TableHead className="text-right">Empr. EPF (3.67%)</TableHead>
                <TableHead className="text-right">EPS (8.33%)</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {epfData.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell className="text-right">₹{e.basic.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right">₹{e.employeeEPF.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right">₹{e.employerEPF.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right">₹{e.employerEPS.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right font-semibold">₹{e.totalContribution.toLocaleString("en-IN")}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell>Total</TableCell>
                <TableCell />
                <TableCell className="text-right">₹{totalEPFEmployee.toLocaleString("en-IN")}</TableCell>
                <TableCell />
                <TableCell />
                <TableCell className="text-right">₹{(totalEPFEmployee + totalEPFEmployer).toLocaleString("en-IN")}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ESIC */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>ESIC Contributions</CardTitle>
          <CardDescription>Employee 0.75% + Employer 3.25% of gross (wage ceiling ₹21,000)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Emp. (0.75%)</TableHead>
                <TableHead className="text-right">Empr. (3.25%)</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {esicData.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell className="text-right">₹{e.gross.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right">₹{e.employeeESIC.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right">₹{e.employerESIC.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right font-semibold">₹{e.total.toLocaleString("en-IN")}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell>Total</TableCell>
                <TableCell />
                <TableCell className="text-right">₹{totalESICEmployee.toLocaleString("en-IN")}</TableCell>
                <TableCell className="text-right">₹{totalESICEmployer.toLocaleString("en-IN")}</TableCell>
                <TableCell className="text-right">₹{(totalESICEmployee + totalESICEmployer).toLocaleString("en-IN")}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default EPFESICPage;
