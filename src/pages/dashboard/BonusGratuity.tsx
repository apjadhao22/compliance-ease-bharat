import { useState, useEffect } from "react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Download } from "lucide-react";
import { calculateBonus, calculateGratuity, defineWages } from "@/lib/calculations";

interface BonusRow {
  employeeId: string;
  empCode: string;
  name: string;
  basic: number;
  eligibleMonths: number;
  bonusPercent: number;
  bonusWages: number;
  bonusAmount: number;
}

const BonusGratuity = () => {
  const { toast } = useToast();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [complianceRegime, setComplianceRegime] = useState<'legacy_acts' | 'labour_codes'>('legacy_acts');
  const [employees, setEmployees] = useState<any[]>([]);

  // Bonus state
  const [financialYear, setFinancialYear] = useState("2025-26");
  const [bonusPercent, setBonusPercent] = useState(8.33);
  const [bonusData, setBonusData] = useState<BonusRow[]>([]);
  const [savingBonus, setSavingBonus] = useState(false);

  // Gratuity state
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [leavingDate, setLeavingDate] = useState("");
  const [isDeathOrDisability, setIsDeathOrDisability] = useState(false);
  const [gratuityResult, setGratuityResult] = useState<any>(null);
  const [savingGratuity, setSavingGratuity] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: company } = await supabase
        .from("companies")
        .select("id, compliance_regime")
        .eq("user_id", user.id)
        .maybeSingle();

      if (company) {
        setCompanyId(company.id);
        setComplianceRegime(((company as any).compliance_regime as any) || "legacy_acts");
        const { data: emps } = await supabase
          .from("employees")
          .select("*")
          .eq("company_id", company.id);
        if (emps) setEmployees(emps);
      }
    };
    init();
  }, []);

  const activeEmployees = employees.filter((e) => e.status === "Active");
  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId) || null;

  // ─── Bonus ───

  const handleCalculateBonus = () => {
    if (!companyId) {
      toast({ title: "Setup required", description: "Please set up your company first.", variant: "destructive" });
      return;
    }

    const eligible = activeEmployees.filter((e) => e.bonus_applicable !== false);
    const rows: BonusRow[] = [];

    for (const emp of eligible) {
      const basic = Number(emp.basic);
      const result = calculateBonus(basic, 12, 240, bonusPercent);
      if (result.isEligible) {
        rows.push({
          employeeId: emp.id,
          empCode: emp.emp_code,
          name: emp.name,
          basic,
          eligibleMonths: result.eligibleMonths,
          bonusPercent: result.bonusPercent,
          bonusWages: result.bonusWages,
          bonusAmount: result.bonusAmount,
        });
      }
    }

    setBonusData(rows);
    if (rows.length === 0) {
      toast({ title: "No eligible employees", description: "No employees qualify for bonus.", variant: "destructive" });
    }
  };

  const handleSaveBonus = async () => {
    if (!companyId || bonusData.length === 0) return;
    setSavingBonus(true);
    try {
      const records = bonusData.map((row) => ({
        company_id: companyId,
        employee_id: row.employeeId,
        financial_year: financialYear,
        eligible_months: row.eligibleMonths,
        bonus_percent: row.bonusPercent,
        bonus_wages: row.bonusWages,
        bonus_amount: row.bonusAmount,
        payment_status: "calculated",
      }));

      const { error } = await supabase
        .from("bonus_calculations")
        .upsert(records, { onConflict: "company_id,employee_id,financial_year" });

      if (error) throw error;
      toast({ title: "Saved", description: "Bonus calculations saved to database." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingBonus(false);
    }
  };

  const totalBonus = bonusData.reduce((s, r) => s + r.bonusAmount, 0);

  const downloadBonusFormD = async () => {
    if (!bonusData.length) {
      toast({ title: "No data", description: "Calculate bonus first.", variant: "destructive" });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: company } = await supabase
        .from("companies")
        .select("name, pan")
        .eq("user_id", user.id)
        .maybeSingle();

      const doc = new jsPDF();

      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("FORM D", 105, 20, { align: "center" });
      doc.setFontSize(12);
      doc.text("[See sub-rule (1) of rule 4]", 105, 28, { align: "center" });
      doc.setFontSize(14);
      doc.text("Annual Return under the Payment of Bonus Act, 1965", 105, 38, { align: "center" });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Name of Establishment: ${company?.name || "Your Company"}`, 15, 50);
      doc.text(`PAN: ${company?.pan || ""}`, 15, 56);
      doc.text(`Accounting Year: ${financialYear}`, 15, 62);

      const tableTop = 75;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Sl.", 15, tableTop);
      doc.text("Emp Code", 23, tableTop);
      doc.text("Name of Employee", 45, tableTop);
      doc.text("Basic (₹)", 105, tableTop);
      doc.text("Bonus %", 125, tableTop);
      doc.text("Bonus Amount (₹)", 148, tableTop);
      doc.text("Remarks", 178, tableTop);

      let yPos = tableTop + 6;
      let rowNum = 1;
      let total = 0;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      bonusData.forEach((emp) => {
        doc.text(rowNum.toString(), 16, yPos);
        doc.text(emp.empCode, 23, yPos);
        doc.text(emp.name.slice(0, 40), 45, yPos);
        doc.text(emp.basic.toLocaleString("en-IN"), 120, yPos, { align: "right" });
        doc.text(`${emp.bonusPercent}%`, 135, yPos, { align: "right" });
        doc.text(emp.bonusAmount.toLocaleString("en-IN"), 170, yPos, { align: "right" });
        doc.text("Eligible", 178, yPos);

        total += emp.bonusAmount;
        rowNum++;
        yPos += 5;

        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
      });

      yPos += 5;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(`Total eligible employees: ${bonusData.length}`, 15, yPos);
      yPos += 5;
      doc.text(`Total bonus payable: Rs. ${total.toLocaleString("en-IN")}`, 15, yPos);
      yPos += 5;
      doc.text(`Calculation basis: ${bonusPercent.toFixed(2)}%`, 15, yPos);

      yPos += 12;
      doc.setFont("helvetica", "normal");
      doc.rect(15, yPos, 80, 18);
      doc.text("Place:", 17, yPos + 6);
      doc.text(`Date: ${format(new Date(), "dd/MM/yyyy")}`, 17, yPos + 11);
      doc.text("Signature of Employer", 17, yPos + 16);

      doc.rect(105, yPos, 85, 18);
      doc.text("Seal of Establishment", 110, yPos + 6);

      doc.save(`Bonus_FormD_${financialYear}_${format(new Date(), "yyyyMMdd")}.pdf`);

      toast({ title: "Bonus Form D Generated! 📄", description: `Official Form D for ${bonusData.length} employees (${financialYear}).` });
    } catch (error: any) {
      toast({ title: "Form D failed", description: error.message, variant: "destructive" });
    }
  };

  // ─── Gratuity ───

  const downloadGratuityFormF = () => {
    if (!selectedEmployee || !gratuityResult) return;

    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("FORM 'F'", 105, 20, { align: "center" });
    doc.setFontSize(12);
    doc.text("NOMINATION [See Rule 8(1)]", 105, 28, { align: "center" });
    doc.setFontSize(10);
    doc.text("Payment of Gratuity Act, 1972", 105, 35, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.text("1. Name of Employee:", 15, 50);
    doc.text(selectedEmployee.name, 55, 50);
    doc.text("2. Father's/Husband's Name:", 15, 57);
    doc.text("________________________", 60, 57);
    doc.text("3. Sex:", 15, 64);
    doc.text(selectedEmployee.gender || "", 35, 64);
    doc.text("4. Date of Joining:", 15, 71);
    doc.text(selectedEmployee.date_of_joining || "", 55, 71);
    doc.text("5. Emp Code:", 15, 78);
    doc.text(selectedEmployee.emp_code || "", 55, 78);
    doc.text("6. Permanent Address:", 15, 85);
    doc.text("________________________", 55, 85);

    doc.setFont("helvetica", "bold");
    doc.text("7. Details of Nominee(s):", 15, 100);
    doc.setFont("helvetica", "normal");
    doc.rect(15, 103, 180, 25);
    doc.setFontSize(9);
    doc.text("Name", 17, 108);
    doc.text("Relationship", 65, 108);
    doc.text("Share %", 115, 108);
    doc.text("Address", 140, 108);
    doc.line(15, 110, 195, 110);
    doc.text("________________________", 17, 118);
    doc.text("________________________", 65, 118);
    doc.text("___%", 115, 118);
    doc.text("________________________", 140, 118);

    doc.setFontSize(10);
    doc.text("I declare that the person(s) mentioned above is/are my nominee(s).", 15, 140);
    doc.text("Signature of Employee: ________________________", 15, 155);
    doc.text(`Date: ${format(new Date(), "dd/MM/yyyy")}`, 15, 162);

    doc.setFont("helvetica", "bold");
    doc.text("WITNESSES:", 15, 178);
    doc.setFont("helvetica", "normal");
    doc.rect(15, 181, 85, 18);
    doc.text("1. Signature:", 17, 187);
    doc.text("Name:", 17, 193);
    doc.rect(105, 181, 90, 18);
    doc.text("2. Signature:", 107, 187);
    doc.text("Name:", 107, 193);

    doc.save(`Gratuity_FormF_${selectedEmployee.emp_code || "EMP"}_${format(new Date(), "yyyyMMdd")}.pdf`);
    toast({ title: "Form F Generated! 📄", description: "Gratuity nomination form ready." });
  };

  const handleCalculateGratuity = () => {
    if (!selectedEmployee || !leavingDate) {
      toast({ title: "Missing fields", description: "Select an employee and leaving date.", variant: "destructive" });
      return;
    }

    const basic = Number(selectedEmployee.basic || 0);
    const da = Number(selectedEmployee.da || 0);
    const retaining = Number(selectedEmployee.retaining_allowance || 0);
    const hra = Number(selectedEmployee.hra || 0);
    const otherAllowances = Number(selectedEmployee.allowances || 0);

    // Under labour codes, use wages (after 50% rule) as last drawn base
    let lastDrawnBase = basic;
    if (complianceRegime === "labour_codes") {
      const wageResult = defineWages({
        basic,
        da,
        retainingAllowance: retaining,
        allowances: hra + otherAllowances,
      });
      lastDrawnBase = wageResult.wages;
    }

    // Fixed-term employees eligible after 1 year under labour codes
    const employmentType = selectedEmployee.employment_type || "permanent";
    let minYears = 5;
    if (complianceRegime === "labour_codes" && employmentType === "fixed_term") {
      minYears = 1;
    }

    const result = calculateGratuity(
      selectedEmployee.date_of_joining,
      leavingDate,
      lastDrawnBase,
      isDeathOrDisability,
      minYears
    );
    setGratuityResult(result);
  };

  const handleSaveGratuity = async () => {
    if (!companyId || !selectedEmployee || !gratuityResult?.isEligible) return;
    setSavingGratuity(true);
    try {
      const { error } = await supabase.from("gratuity_calculations").insert({
        company_id: companyId,
        employee_id: selectedEmployee.id,
        date_of_leaving: leavingDate,
        years_of_service: gratuityResult.yearsOfService,
        last_drawn_basic: gratuityResult.lastDrawnBasic,
        gratuity_amount: gratuityResult.gratuityAmount,
        payment_status: "calculated",
      });
      if (error) throw error;
      toast({ title: "Saved", description: "Gratuity record saved successfully." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingGratuity(false);
    }
  };

  const noEmployees = activeEmployees.length === 0;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Bonus &amp; Gratuity Management</h1>
      <p className="mt-1 text-muted-foreground">Annual bonus calculation and gratuity for exiting employees</p>

      {/* ─── Card 1: Bonus ─── */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Annual Bonus (Payment of Bonus Act, 1965)</CardTitle>
          <CardDescription>Min 8.33%, Max 20% · Wage ceiling ₹21,000 · Requires 30+ working days</CardDescription>
        </CardHeader>
        <CardContent>
          {noEmployees ? (
            <p className="text-sm text-muted-foreground">Add active employees before calculating bonus.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-1.5">
                  <Label>Financial Year</Label>
                  <Select value={financialYear} onValueChange={setFinancialYear}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2024-25">2024-25</SelectItem>
                      <SelectItem value="2025-26">2025-26</SelectItem>
                      <SelectItem value="2026-27">2026-27</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Bonus %</Label>
                  <Input
                    type="number"
                    className="w-24"
                    value={bonusPercent}
                    onChange={(e) => setBonusPercent(parseFloat(e.target.value) || 8.33)}
                    min={8.33}
                    max={20}
                    step={0.01}
                  />
                </div>
                <Button onClick={handleCalculateBonus}>Calculate Bonus</Button>
                <Button
                  variant="secondary"
                  onClick={handleSaveBonus}
                  disabled={bonusData.length === 0 || savingBonus}
                >
                  {savingBonus ? "Saving..." : "Save All to Database"}
                </Button>
                {bonusData.length > 0 && (
                  <Button variant="secondary" onClick={downloadBonusFormD}>
                    <Download className="mr-2 h-4 w-4" />
                    Download Form D (.pdf)
                  </Button>
                )}
              </div>

              {bonusData.length > 0 && (
                <>
                  <div className="mt-4 flex flex-wrap gap-6 text-sm">
                    <div>
                      <span className="text-muted-foreground">Eligible Employees:</span>{" "}
                      <span className="font-semibold">{bonusData.length}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Bonus:</span>{" "}
                      <span className="font-semibold">₹{totalBonus.toLocaleString("en-IN")}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Average:</span>{" "}
                      <span className="font-semibold">
                        ₹{Math.round(totalBonus / bonusData.length).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Emp Code</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead className="text-right">Basic (₹)</TableHead>
                          <TableHead className="text-right">Eligible Months</TableHead>
                          <TableHead className="text-right">Bonus %</TableHead>
                          <TableHead className="text-right">Bonus Wages (₹)</TableHead>
                          <TableHead className="text-right">Bonus Amount (₹)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bonusData.map((row) => (
                          <TableRow key={row.employeeId}>
                            <TableCell>{row.empCode}</TableCell>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell className="text-right">₹{row.basic.toLocaleString("en-IN")}</TableCell>
                            <TableCell className="text-right">{row.eligibleMonths}</TableCell>
                            <TableCell className="text-right">{row.bonusPercent}%</TableCell>
                            <TableCell className="text-right">₹{row.bonusWages.toLocaleString("en-IN")}</TableCell>
                            <TableCell className="text-right font-semibold">₹{row.bonusAmount.toLocaleString("en-IN")}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ─── Card 2: Gratuity ─── */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Gratuity (Payment of Gratuity Act, 1972)</CardTitle>
          <CardDescription>Formula: (15 × last drawn salary × years of service) / 26 · Eligible after 5 years</CardDescription>
        </CardHeader>
        <CardContent>
          {employees.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add employees before calculating gratuity.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-1.5">
                  <Label>Employee</Label>
                  <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.emp_code} — {emp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Date of Leaving</Label>
                  <Input
                    type="date"
                    value={leavingDate}
                    onChange={(e) => setLeavingDate(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2 pb-1">
                  <Checkbox
                    id="deathDisability"
                    checked={isDeathOrDisability}
                    onCheckedChange={(v) => setIsDeathOrDisability(!!v)}
                  />
                  <Label htmlFor="deathDisability" className="text-sm">Death / Permanent Disability</Label>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <Button onClick={handleCalculateGratuity}>Calculate Gratuity</Button>
                <Button
                  variant="secondary"
                  onClick={handleSaveGratuity}
                  disabled={!gratuityResult?.isEligible || savingGratuity}
                >
                  {savingGratuity ? "Saving..." : "Save Gratuity Record"}
                </Button>
                {gratuityResult?.isEligible && (
                  <Button variant="outline" onClick={downloadGratuityFormF}>
                    <Download className="mr-1 h-4 w-4" />
                    Form F (.pdf)
                  </Button>
                )}
              </div>

              {gratuityResult && (
                <div
                  className={`mt-4 rounded-lg border p-4 ${
                    gratuityResult.isEligible
                      ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30"
                      : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
                  }`}
                >
                  {gratuityResult.isEligible ? (
                    <div className="space-y-1 text-sm">
                      <p>
                        <span className="text-muted-foreground">Years of Service:</span>{" "}
                        <span className="font-semibold">
                          {gratuityResult.yearsOfService} years, {gratuityResult.monthsOfService} months
                        </span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Last Drawn Basic:</span>{" "}
                        <span className="font-semibold">₹{gratuityResult.lastDrawnBasic.toLocaleString("en-IN")}</span>
                      </p>
                      <p className="text-lg font-bold mt-2">
                        Gratuity Amount: ₹{gratuityResult.gratuityAmount.toLocaleString("en-IN")}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-destructive">{gratuityResult.reason}</p>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BonusGratuity;
