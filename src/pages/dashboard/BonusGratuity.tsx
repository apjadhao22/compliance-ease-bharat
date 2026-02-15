import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculateBonus, calculateGratuity } from "@/lib/calculations";

const employees = [
  { id: "1", name: "Rajesh Kumar", basic: 25000, doj: "2019-04-01" },
  { id: "2", name: "Priya Sharma", basic: 18000, doj: "2021-07-15" },
  { id: "3", name: "Amit Patel", basic: 12000, doj: "2018-01-10" },
];

const BonusGratuity = () => {
  const [bonusRate, setBonusRate] = useState(8.33);

  const now = new Date();
  const data = employees.map((e) => {
    const years = Math.floor((now.getTime() - new Date(e.doj).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    const bonus = calculateBonus(e.basic, bonusRate);
    const gratuity = calculateGratuity(e.basic + (e.basic * 0.4), years); // last drawn = basic + DA (40%)
    return { ...e, years, bonus, gratuity };
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Bonus & Gratuity</h1>
      <p className="mt-1 text-muted-foreground">Annual calculations per Payment of Bonus Act & Gratuity Act</p>

      {/* Bonus */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Bonus Calculator</CardTitle>
          <CardDescription>Payment of Bonus Act, 1965 — Min 8.33%, Max 20% of basic</CardDescription>
          <div className="mt-2 flex items-center gap-3">
            <Label>Bonus Rate (%)</Label>
            <Input type="number" className="w-24" value={bonusRate} onChange={(e) => setBonusRate(parseFloat(e.target.value) || 8.33)} min={8.33} max={20} step={0.01} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead className="text-right">Monthly Basic</TableHead><TableHead className="text-right">Annual Basic</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Annual Bonus</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.map((e) => (
                <TableRow key={e.id}><TableCell className="font-medium">{e.name}</TableCell><TableCell className="text-right">₹{e.basic.toLocaleString("en-IN")}</TableCell><TableCell className="text-right">₹{(e.basic * 12).toLocaleString("en-IN")}</TableCell><TableCell className="text-right">{e.bonus.rate}%</TableCell><TableCell className="text-right font-semibold">₹{e.bonus.annualBonus.toLocaleString("en-IN")}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Gratuity */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Gratuity Calculator</CardTitle>
          <CardDescription>Payment of Gratuity Act, 1972 — (15 × last drawn salary × years) / 26. Eligible after 5 years.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead className="text-right">Last Drawn</TableHead><TableHead className="text-right">Years</TableHead><TableHead>Eligible</TableHead><TableHead className="text-right">Gratuity</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell className="text-right">₹{Math.round(e.basic * 1.4).toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right">{e.years}</TableCell>
                  <TableCell>{e.gratuity.eligible ? <span className="text-success font-medium">Yes</span> : <span className="text-destructive font-medium">No</span>}</TableCell>
                  <TableCell className="text-right font-semibold">{e.gratuity.eligible ? `₹${e.gratuity.amount.toLocaleString("en-IN")}` : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default BonusGratuity;
