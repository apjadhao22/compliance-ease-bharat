import { PageSkeleton } from "@/components/PageSkeleton";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { calculatePT } from "@/lib/calculations";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, FileText, Save } from "lucide-react";
import { format } from "date-fns";
import { addOpticompBharatFooter } from "@/lib/pdfUtils";


interface Employee { id: string; name: string; gross: number; work_state?: string; gender?: string; }
interface PTPayment { month: string; challan_number: string | null; payment_date: string | null; total_pt_amount: number; }

const ProfessionalTax = () => {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");

  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [ptPayments, setPtPayments] = useState<Record<string, PTPayment>>({});
  const [challanInput, setChallanInput] = useState("");
  const [challanDate, setChallanDate] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: comp } = await supabase.from("companies").select("id, name").eq("user_id", user.id).maybeSingle();
    if (!comp) { setLoading(false); return; }
    setCompanyId(comp.id);
    setCompanyName(comp.name || "");

    const { data: emps } = await supabase.from("employees")
      .select("id, name, gross, work_state, gender")
      .eq("company_id", comp.id).eq("pt_applicable", true).in("status", ["Active", "active"]);
    setEmployees((emps as unknown as Employee[]) || []);

    // Load PT payment records
    const { data: payments } = await (supabase as any).from("pt_payments").select("*").eq("company_id", comp.id);
    if (payments) {
      const map: Record<string, PTPayment> = {};
      (payments as PTPayment[]).forEach(p => { map[p.month] = p; });
      setPtPayments(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Sync challan fields when month changes
  useEffect(() => {
    const existing = ptPayments[month];
    setChallanInput(existing?.challan_number || "");
    setChallanDate(existing?.payment_date || "");
  }, [month, ptPayments]);

  const isFebruary = month.endsWith("-02");
  const data = employees.map(e => ({ ...e, pt: calculatePT(e.gross, e.work_state || "Maharashtra", { isFebruary, gender: e.gender || "male" }) }));
  const totalPT = data.reduce((s, e) => s + e.pt, 0);

  const handleSaveChallan = async () => {
    if (!companyId) return;
    setSaving(true);
    const payload = {
      company_id: companyId,
      month,
      total_pt_amount: totalPT,
      challan_number: challanInput || null,
      payment_date: challanDate || null,
    };
    try {
      const existing = ptPayments[month];
      if (existing) {
        await (supabase as any).from("pt_payments").update(payload).eq("company_id", companyId).eq("month", month);
      } else {
        await (supabase as any).from("pt_payments").insert(payload);
      }
      setPtPayments(prev => ({ ...prev, [month]: payload as PTPayment }));
      toast({ title: "Challan saved", description: `PT payment record for ${month} updated.` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  // ─── PT Form III PDF ──────────────────────────────────────────────────────
  const generateFormIII = async () => {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 20;
    const tw = pageW - margin * 2;
    let y = 15;

    doc.setFontSize(13); doc.setFont("helvetica", "bold");
    doc.text("FORM III", pageW / 2, y, { align: "center" }); y += 7;
    doc.setFontSize(10);
    doc.text("[See rule 11(1) of Maharashtra State Tax on Professions, Trades, Callings and Employments Rules, 1975]", pageW / 2, y, { align: "center" }); y += 7;
    doc.text("RETURN OF TAX PAYABLE BY AN EMPLOYER", pageW / 2, y, { align: "center" }); y += 10;

    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    const [yr, mn] = month.split("-");
    const monthLabel = format(new Date(Number(yr), Number(mn) - 1, 1), "MMMM yyyy");
    doc.text(`Employer / Company: ${companyName}`, margin, y); y += 6;
    doc.text(`Month: ${monthLabel}`, margin, y);
    doc.text(`Challan No: ${challanInput || "________________"}`, margin + 80, y);
    doc.text(`Date: ${challanDate ? format(new Date(challanDate), "dd/MM/yyyy") : "________________"}`, margin + 150, y); y += 10;

    // Divider
    doc.setDrawColor(80, 80, 200); doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y); y += 5;

    // Table header
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    const cols = [8, 60, 40, 30, 30];
    const headers = ["Sr.", "Employee Name", "Gross Salary (₹)", "PT Slab", "PT Amount (₹)"];
    let x = margin;
    headers.forEach((h, i) => { doc.text(h, x, y); x += cols[i]; });
    y += 5;
    doc.setLineWidth(0.3); doc.line(margin, y, pageW - margin, y); y += 4;

    // Table rows
    doc.setFont("helvetica", "normal");
    data.forEach((e, i) => {
      if (y > 270) { doc.addPage(); y = 20; }
      x = margin;
      const row = [String(i + 1), e.name, e.gross.toLocaleString("en-IN"), isFebruary ? "Feb Slab (₹300)" : `₹${e.pt > 0 ? e.pt : "Nil"}`, String(e.pt)];
      row.forEach((cell, ci) => {
        doc.text(String(cell).substring(0, ci === 1 ? 28 : 15), x, y);
        x += cols[ci];
      });
      y += 5;
      doc.setDrawColor(220, 220, 220); doc.line(margin, y - 1, pageW - margin, y - 1);
    });

    y += 3;
    doc.setFont("helvetica", "bold");
    doc.text(`Total PT to be remitted: ₹${totalPT.toLocaleString("en-IN")}`, margin, y);
    y += 15;

    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text("I hereby declare that the information given above is correct and complete.", margin, y); y += 10;
    doc.text("Authorised Signatory: ________________________", margin, y);
    doc.text(`Date: ________________`, margin + 110, y); y += 10;
    doc.text("Designation: ________________________", margin, y);

    // Footer
    doc.setFontSize(8); doc.setTextColor(150, 150, 150);
    doc.text(`Generated on ${format(new Date(), "dd MMM yyyy 'at' HH:mm")} — ${companyName}`, margin, 287);
    doc.setTextColor(0, 0, 0);

    await addOpticompBharatFooter(doc as any);
    doc.save(`PT_Form_III_${month}_${companyName.replace(/\s+/g, "_")}.pdf`);
    toast({ title: "Form III Downloaded", description: `PT Form III for ${monthLabel} ready.` });
  };

  // ─── PT Form IIIA (Annual Summary) ────────────────────────────────────────
  const generateFormIIIA = async () => {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 15;

    doc.setFontSize(13); doc.setFont("helvetica", "bold");
    doc.text("FORM IIIA — ANNUAL PT RETURN", pageW / 2, y, { align: "center" }); y += 7;
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text("Maharashtra State Tax on Professions, Trades, Callings and Employments Rules, 1975", pageW / 2, y, { align: "center" }); y += 10;

    doc.setFontSize(10);
    doc.text(`Employer: ${companyName}`, margin, y); y += 7;
    doc.setLineWidth(0.3); doc.line(margin, y, pageW - margin, y); y += 5;

    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("Month", margin, y);
    doc.text("Total PT Remitted (₹)", margin + 40, y);
    doc.text("Challan No.", margin + 100, y);
    doc.text("Payment Date", margin + 140, y); y += 5;
    doc.line(margin, y - 1, pageW - margin, y - 1);

    doc.setFont("helvetica", "normal");
    let grandTotal = 0;
    const months = Object.values(ptPayments).sort((a, b) => a.month.localeCompare(b.month));
    months.forEach(p => {
      if (y > 265) { doc.addPage(); y = 20; }
      const [yr, mn] = p.month.split("-");
      const label = format(new Date(Number(yr), Number(mn) - 1, 1), "MMM yyyy");
      doc.text(label, margin, y);
      doc.text(`₹${Number(p.total_pt_amount).toLocaleString("en-IN")}`, margin + 40, y);
      doc.text(p.challan_number || "—", margin + 100, y);
      doc.text(p.payment_date ? format(new Date(p.payment_date), "dd/MM/yy") : "—", margin + 140, y);
      grandTotal += Number(p.total_pt_amount || 0);
      y += 6;
      doc.setDrawColor(220, 220, 220); doc.line(margin, y - 1, pageW - margin, y - 1);
    });

    y += 4;
    doc.setFont("helvetica", "bold");
    doc.text(`Total Annual PT: ₹${grandTotal.toLocaleString("en-IN")}`, margin, y);

    doc.setFontSize(8); doc.setTextColor(150, 150, 150);
    doc.text(`Generated ${format(new Date(), "dd MMM yyyy")} — ${companyName}`, margin, 287);

    await addOpticompBharatFooter(doc as any);
    doc.save(`PT_Form_IIIA_${companyName.replace(/\s+/g, "_")}_Annual.pdf`);
    toast({ title: "Form IIIA Downloaded" });
  };

  if (loading) return <PageSkeleton />;

  const currentPayment = ptPayments[month];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Professional Tax</h1>
          <p className="mt-1 text-muted-foreground">Maharashtra slab-based PT calculation, challan tracking, and Form III/IIIA export.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-40" />
          <Button variant="outline" onClick={generateFormIII} className="gap-2 text-blue-700 border-blue-200 bg-blue-50">
            <FileText className="h-4 w-4" /> Form III PDF
          </Button>
          <Button variant="outline" onClick={generateFormIIIA} className="gap-2 text-purple-700 border-purple-200 bg-purple-50">
            <Download className="h-4 w-4" /> Form IIIA (Annual)
          </Button>
        </div>
      </div>

      {/* PT Slabs */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">≤ ₹7,500</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">₹0</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">₹7,501–₹10,000</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">₹175</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">₹10,001–₹15,000</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">₹200</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">&gt; ₹15,000</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{isFebruary ? "₹300" : "₹200"}</p></CardContent></Card>
      </div>

      {/* Challan Number Entry */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b px-6 py-4">
          <div>
            <CardTitle className="text-base">PT Remittance Record — {format(new Date(Number(month.split("-")[0]), Number(month.split("-")[1]) - 1, 1), "MMMM yyyy")}</CardTitle>
            <CardDescription className="text-xs mt-0.5">Record the challan number after depositing PT. This appears in Form IIIA.</CardDescription>
          </div>
          {currentPayment?.challan_number && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">✓ Challan Recorded</Badge>
          )}
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <Label className="text-xs">Challan / Reference Number</Label>
              <Input className="mt-1 w-56" placeholder="e.g. PT/2026-02/001234" value={challanInput} onChange={e => setChallanInput(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Payment Date</Label>
              <Input type="date" className="mt-1 w-40" value={challanDate} onChange={e => setChallanDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Total PT (₹)</Label>
              <Input className="mt-1 w-32" value={totalPT} readOnly />
            </div>
            <Button onClick={handleSaveChallan} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Employee Table */}
      <Card>
        <CardHeader><CardTitle>Employee-wise PT — {isFebruary ? "February (₹300 slab)" : "Current Month"}</CardTitle><CardDescription>Only employees with PT Applicable = Yes are shown.</CardDescription></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Employee</TableHead>
              <TableHead className="text-right">Gross Salary</TableHead>
              <TableHead className="text-right">PT Amount</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center p-8 text-muted-foreground">No active employees with PT applicable.</TableCell></TableRow>
              ) : (
                data.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell className="text-right">₹{Number(e.gross).toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-right font-semibold">₹{e.pt}</TableCell>
                  </TableRow>
                ))
              )}
              {data.length > 0 && (
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>Total</TableCell><TableCell /><TableCell className="text-right">₹{totalPT}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfessionalTax;
