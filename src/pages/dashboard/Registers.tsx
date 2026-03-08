import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { addOpticompBharatFooter } from "@/lib/pdfUtils";


const Registers = () => {
    const [selectedRegister, setSelectedRegister] = useState<string>("overtime");
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [companyId, setCompanyId] = useState<string | null>(null);
    const { toast } = useToast();

    const [month, setMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    });
    const [fy, setFy] = useState("2025-26");

    // Data stores for each register
    const [registerData, setRegisterData] = useState<{ columns: string[]; data: any[]; name: string; description: string }>({
        columns: [], data: [], name: "", description: "",
    });

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data: company } = await supabase
                .from("companies").select("id").eq("user_id", user.id).maybeSingle();
            if (company) setCompanyId(company.id);
        };
        init();
    }, []);

    const loadRegister = useCallback(async () => {
        if (!companyId) return;
        setLoading(true);

        const [yearStr, monthStr] = month.split("-");
        const monthStart = `${yearStr}-${monthStr}-01`;
        const lastDay = new Date(Number(yearStr), Number(monthStr), 0).getDate();
        const monthEnd = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

        try {
            switch (selectedRegister) {
                case "overtime": {
                    // Read from payroll_details for the selected month
                    const { data: run } = await supabase.from("payroll_runs").select("id")
                        .eq("company_id", companyId).eq("month", month).maybeSingle();
                    if (run) {
                        const { data: details } = await supabase.from("payroll_details")
                            .select("*, employees(name, emp_code, gender, employment_type)")
                            .eq("payroll_run_id", run.id)
                            .limit(200);
                        setRegisterData({
                            name: "Form XIX - Register of Overtime",
                            description: `Overtime records for ${month} (showing first 200)`,
                            columns: ["S.No.", "Emp Code", "Name", "Designation", "Days Present", "OT Hours", "Normal Rate (₹)", "OT Rate (₹)", "OT Earnings (₹)", "Gross (₹)"],
                            data: (details || []).map((d: any, i: number) => ({
                                sNo: i + 1,
                                empCode: d.employees?.emp_code || "-",
                                name: d.employees?.name || "—",
                                designation: d.employees?.employment_type || "-",
                                daysPresent: d.days_present,
                                otHours: d.overtime_hours || 0,
                                normalRate: Math.round(Number(d.basic_paid || 0) / (d.days_present || 1)),
                                otRate: Math.round((Number(d.basic_paid || 0) / (d.days_present || 1)) * 2),
                                otEarnings: Number(d.overtime_pay || 0),
                                gross: Number(d.gross_earnings || 0),
                            })),
                        });
                    } else {
                        setRegisterData({
                            name: "Form XIX - Register of Overtime",
                            description: `No payroll processed for ${month}. Process payroll first.`,
                            columns: [], data: [],
                        });
                    }
                    break;
                }
                case "hra": {
                    const { data: run } = await supabase.from("payroll_runs").select("id")
                        .eq("company_id", companyId).eq("month", month).maybeSingle();
                    if (run) {
                        const { data: details } = await supabase.from("payroll_details")
                            .select("*, employees(name, emp_code)")
                            .eq("payroll_run_id", run.id)
                            .limit(200);
                        setRegisterData({
                            name: "Form A - Register of House-rent Allowance",
                            description: `HRA records for ${month} (showing first 200)`,
                            columns: ["S.No.", "Emp Code", "Name", "Gross Salary (₹)", "Basic Paid (₹)", "HRA Paid (₹)", "Net Pay (₹)"],
                            data: (details || []).map((d: any, i: number) => ({
                                sNo: i + 1,
                                empCode: d.employees?.emp_code || "-",
                                name: d.employees?.name || "—",
                                gross: Number(d.gross_earnings || 0),
                                basic: Number(d.basic_paid || 0),
                                hra: Number(d.hra_paid || 0),
                                net: Number(d.net_pay || 0),
                            })),
                        });
                    } else {
                        setRegisterData({ name: "Form A - Register of House-rent Allowance", description: `No payroll for ${month}.`, columns: [], data: [] });
                    }
                    break;
                }
                case "lwf": {
                    const { data: run } = await supabase.from("payroll_runs").select("id")
                        .eq("company_id", companyId).eq("month", month).maybeSingle();
                    if (run) {
                        const { data: details } = await supabase.from("payroll_details")
                            .select("*, employees(name, emp_code)")
                            .eq("payroll_run_id", run.id)
                            .limit(200);
                        setRegisterData({
                            name: "LWF Register",
                            description: `Labour Welfare Fund deductions for ${month} (showing first 200)`,
                            columns: ["S.No.", "Emp Code", "Name", "Gross (₹)", "Employee LWF (₹)", "Employer LWF (₹)", "Total (₹)"],
                            data: (details || []).filter((d: any) => Number(d.lwf_employee || 0) > 0 || Number(d.lwf_employer || 0) > 0).map((d: any, i: number) => ({
                                sNo: i + 1,
                                empCode: d.employees?.emp_code || "-",
                                name: d.employees?.name || "—",
                                gross: Number(d.gross_earnings || 0),
                                lwfEmp: Number(d.lwf_employee || 0),
                                lwfEmpr: Number(d.lwf_employer || 0),
                                total: Number(d.lwf_employee || 0) + Number(d.lwf_employer || 0),
                            })),
                        });
                    } else {
                        setRegisterData({ name: "LWF Register", description: `No payroll for ${month}.`, columns: [], data: [] });
                    }
                    break;
                }
                case "bonus": {
                    const { data: bonusRows } = await supabase.from("bonus_calculations")
                        .select("*, employees(name, emp_code)")
                        .eq("company_id", companyId)
                        .eq("financial_year", fy)
                        .limit(200);
                    setRegisterData({
                        name: "Form A, B, C - Bonus Register",
                        description: `Bonus computation for FY ${fy}. Note: Verify allocable surplus and minimum wage thresholds manually before filing.`,
                        columns: ["S.No.", "Emp Code", "Name", "Eligible Months", "Bonus %", "Bonus Wages (₹)", "Bonus Amount (₹)", "Payment Status"],
                        data: (bonusRows || []).map((b: any, i: number) => ({
                            sNo: i + 1,
                            empCode: b.employees?.emp_code || "-",
                            name: b.employees?.name || "—",
                            months: b.eligible_months,
                            pct: `${b.bonus_percent}%`,
                            wages: Number(b.bonus_wages || 0),
                            amount: Number(b.bonus_amount || 0),
                            status: b.payment_status,
                        })),
                    });
                    break;
                }
                case "accident": {
                    const { data: accidents } = await supabase.from("accidents")
                        .select("*, employees(name, emp_code)")
                        .eq("company_id", companyId)
                        .order("accident_date", { ascending: false });
                    setRegisterData({
                        name: "Form 11 - ESIC Accident Register",
                        description: "Accident records from the Accidents module",
                        columns: ["S.No.", "Emp Code", "Name", "Date", "Injury Type", "Body Part", "Description", "Medical Costs (₹)", "Compensation (₹)", "Status"],
                        data: (accidents || []).map((a: any, i: number) => ({
                            sNo: i + 1,
                            empCode: a.employees?.emp_code || "-",
                            name: a.employees?.name || "—",
                            date: a.accident_date,
                            injuryType: a.injury_type,
                            bodyPart: a.body_part || "-",
                            desc: (a.description || "").slice(0, 50),
                            medicalCosts: Number(a.medical_costs || 0),
                            compensation: Number(a.compensation_paid || 0),
                            status: a.status,
                        })),
                    });
                    break;
                }
                case "maternity": {
                    const { data: cases } = await supabase.from("maternity_cases")
                        .select("*, employees(name, emp_code, date_of_joining), maternity_payments(*)")
                        .eq("company_id", companyId)
                        .order("expected_delivery_date", { ascending: false }) as any;
                    setRegisterData({
                        name: "Maternity Benefit Register - Form 10",
                        description: "Rule 12(1) Maternity Benefit Act, 1961",
                        columns: ["S.No.", "Emp Code", "Name", "DOJ", "Type", "Expected Date", "Actual Date", "Weeks Taken", "Total Paid (₹)", "Status"],
                        data: (cases || []).map((c: any, i: number) => {
                            const totalPaid = (c.maternity_payments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
                            return {
                                sNo: i + 1,
                                empCode: c.employees?.emp_code || "-",
                                name: c.employees?.name || "—",
                                doj: c.employees?.date_of_joining || "-",
                                type: c.type,
                                expected: c.expected_delivery_date,
                                actual: c.actual_delivery_date || "-",
                                weeks: `${c.weeks_taken}/${c.weeks_allowed}`,
                                totalPaid,
                                status: c.status,
                            };
                        }),
                    });
                    break;
                }
                case "deductions": {
                    const { data: run } = await supabase.from("payroll_runs").select("id")
                        .eq("company_id", companyId).eq("month", month).maybeSingle();
                    if (run) {
                        const { data: details } = await supabase.from("payroll_details")
                            .select("*, employees(name, emp_code)")
                            .eq("payroll_run_id", run.id);
                        setRegisterData({
                            name: "Form XX - Register of Deductions",
                            description: `All payroll deductions for ${month}`,
                            columns: ["S.No.", "Emp Code", "Name", "EPF (₹)", "ESIC (₹)", "PT (₹)", "TDS (₹)", "LWF (₹)", "Total Deductions (₹)"],
                            data: (details || []).map((d: any, i: number) => ({
                                sNo: i + 1,
                                empCode: d.employees?.emp_code || "-",
                                name: d.employees?.name || "—",
                                epf: Number(d.epf_employee || 0),
                                esic: Number(d.esic_employee || 0),
                                pt: Number(d.pt || 0),
                                tds: Number(d.tds || 0),
                                lwf: Number(d.lwf_employee || 0),
                                total: Number(d.total_deductions || 0),
                            })),
                        });
                    } else {
                        setRegisterData({ name: "Form XX - Register of Deductions", description: `No payroll for ${month}.`, columns: [], data: [] });
                    }
                    break;
                }
                case "fines": {
                    // No dedicated fines table — show empty register for manual use
                    setRegisterData({
                        name: "Form XXI - Register of Fines",
                        description: "No fines recorded. This register will populate when a fines module is added.",
                        columns: ["S.No", "Name", "Designation", "Offence", "Date", "Fine Amount", "Date Realized"],
                        data: [],
                    });
                    break;
                }
                case "advances": {
                    const { data: advances } = await supabase.from("employee_advances")
                        .select("*, employees(name)")
                        .eq("company_id", companyId)
                        .order("date", { ascending: false });
                    setRegisterData({
                        name: "Form XVIII - Register of Advances",
                        description: "Record of all advances granted to employees.",
                        columns: ["S.No.", "Name", "Date", "Purpose", "Amount (₹)", "Instalments", "Repaid (₹)", "Status"],
                        data: (advances || []).map((a: any, i: number) => ({
                            sNo: i + 1,
                            name: a.employees?.name || "—",
                            date: a.date,
                            purpose: a.purpose || "—",
                            amount: Number(a.amount || 0),
                            instalments: a.instalment_count,
                            repaid: Number(a.repaid_amount || 0),
                            status: a.status,
                        })),
                    });
                    break;
                }
                case "muster_roll": {
                    // Form B — Muster Roll (from timesheets)
                    const [yearStr2, monthStr2] = month.split("-");
                    const monthStart2 = `${yearStr2}-${monthStr2}-01`;
                    const lastDay2 = new Date(Number(yearStr2), Number(monthStr2), 0).getDate();
                    const monthEnd2 = `${yearStr2}-${monthStr2}-${String(lastDay2).padStart(2, "0")}`;

                    const { data: sheets } = await supabase.from("timesheets")
                        .select("*, employees(name, emp_code, employment_type)")
                        .eq("company_id", companyId)
                        .gte("date", monthStart2).lte("date", monthEnd2);

                    // Aggregate per employee
                    const empAgg: Record<string, any> = {};
                    (sheets || []).forEach((s: any) => {
                        const eid = s.employee_id;
                        if (!empAgg[eid]) {
                            empAgg[eid] = {
                                empCode: s.employees?.emp_code || "-",
                                name: s.employees?.name || "—",
                                designation: s.employees?.employment_type || "-",
                                daysPresent: 0, otHours: 0, totalHours: 0,
                            };
                        }
                        empAgg[eid].daysPresent += 1;
                        empAgg[eid].otHours += Number(s.overtime_hours || 0);
                        empAgg[eid].totalHours += Number(s.normal_hours || 0) + Number(s.overtime_hours || 0);
                    });

                    const aggData = Object.values(empAgg).map((e: any, i: number) => ({
                        sNo: i + 1,
                        empCode: e.empCode,
                        name: e.name,
                        designation: e.designation,
                        daysPresent: e.daysPresent,
                        daysAbsent: Math.max(0, lastDay2 - e.daysPresent),
                        otHours: e.otHours,
                        totalHours: Number(e.totalHours.toFixed(1)),
                    }));

                    setRegisterData({
                        name: "Form B — Muster Roll",
                        description: `Attendance register for ${month} — pulled from imported timesheets.`,
                        columns: ["S.No.", "Emp Code", "Name", "Designation", "Days Present", "Days Absent", "OT Hours", "Total Hours"],
                        data: aggData,
                    });
                    break;
                }
                case "wages_register": {
                    // Form C — Wages Register with skill category + MW check
                    const { data: run } = await supabase.from("payroll_runs").select("id")
                        .eq("company_id", companyId).eq("month", month).maybeSingle();
                    if (run) {
                        const { data: details } = await (supabase as any).from("payroll_details")
                            .select("*, employees(name, emp_code, skill_category)")
                            .eq("payroll_run_id", run.id);

                        const MW: Record<string, number> = {
                            "Unskilled": 12816, "Semi-Skilled": 13996, "Skilled": 15296, "Highly Skilled": 17056
                        };
                        setRegisterData({
                            name: "Form C — Wages Register (Minimum Wages Act)",
                            description: `Wage breakdown for ${month}. ⚠ = Below minimum wage.`,
                            columns: ["S.No.", "Emp Code", "Name", "Skill Category", "Basic (₹)", "HRA (₹)", "Other Allow. (₹)", "Gross (₹)", "EPF (₹)", "ESIC (₹)", "PT (₹)", "Net Pay (₹)", "MW Status"],
                            data: (details || []).map((d: any, i: number) => {
                                const skill = d.employees?.skill_category || "—";
                                const mw = MW[skill] || 0;
                                const gross = Number(d.gross_earnings || 0);
                                const mwStatus = mw ? (gross >= mw ? "✓ Compliant" : `⚠ Short ₹${(mw - gross).toLocaleString("en-IN")}`) : "—";
                                return {
                                    sNo: i + 1,
                                    empCode: d.employees?.emp_code || "-",
                                    name: d.employees?.name || "—",
                                    skill,
                                    basic: Number(d.basic_paid || 0),
                                    hra: Number(d.hra_paid || 0),
                                    otherAllow: Number(d.other_allowances || 0),
                                    gross,
                                    epf: Number(d.epf_employee || 0),
                                    esic: Number(d.esic_employee || 0),
                                    pt: Number(d.pt || 0),
                                    net: Number(d.net_pay || 0),
                                    mwStatus,
                                };
                            }),
                        });
                    } else {
                        setRegisterData({ name: "Form C — Wages Register", description: `No payroll for ${month}.`, columns: [], data: [] });
                    }
                    break;
                }
                default:
                    setRegisterData({ name: "", description: "", columns: [], data: [] });
            }
        } catch (err: any) {
            toast({ title: "Error loading register", description: err.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [companyId, selectedRegister, month, fy, toast]);

    useEffect(() => {
        loadRegister();
    }, [loadRegister]);

    const registerKeys = [
        { id: "muster_roll", name: "Form B — Muster Roll" },
        { id: "wages_register", name: "Form C — Wages Register" },
        { id: "overtime", name: "Form XIX — Overtime Register" },
        { id: "hra", name: "Form A — House-rent Allowance" },
        { id: "deductions", name: "Form XX — Deductions Register" },
        { id: "fines", name: "Form XXI — Fines Register" },
        { id: "lwf", name: "LWF Register" },
        { id: "maternity", name: "Form 10 — Maternity Benefit" },
        { id: "advances", name: "Form XVIII — Advances" },
        { id: "bonus", name: "Form A,B,C — Bonus Register" },
        { id: "accident", name: "Form 11 — ESIC Accident Register" },
    ];

    const needsMonth = ["overtime", "hra", "deductions", "lwf", "muster_roll", "wages_register"].includes(selectedRegister);
    const needsFY = selectedRegister === "bonus";

    const handleExport = () => {
        if (!registerData.data || registerData.data.length === 0) return;
        const header = registerData.columns.join(",");
        const rows = registerData.data.map(obj => Object.values(obj).join(","));
        const csvContent = "data:text/csv;charset=utf-8," + [header, ...rows].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${registerData.name.replace(/\s+/g, "_")}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const handleExportPDF = async () => {
        if (!registerData.data || registerData.data.length === 0) return;
        const { default: jsPDF } = await import("jspdf");
        const doc = new jsPDF({ unit: "mm", format: "a4", orientation: registerData.columns.length > 8 ? "landscape" : "portrait" });
        const pageW = doc.internal.pageSize.getWidth();
        const margin = 15;
        let y = 12;

        // Blue top bar
        doc.setFillColor(30, 58, 138); doc.rect(0, 0, pageW, 9, "F");

        // Title
        doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(20, 20, 80);
        doc.text(registerData.name.toUpperCase(), pageW / 2, y + 3, { align: "center" }); y += 8;
        doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(80, 80, 80);
        doc.text(registerData.description, pageW / 2, y + 2, { align: "center", maxWidth: pageW - margin * 2 }); y += 7;
        doc.setDrawColor(200, 200, 220); doc.line(margin, y, pageW - margin, y); y += 4;

        // Column widths
        const cols = registerData.columns;
        const data = registerData.data;
        const usableW = pageW - margin * 2;
        const colW = usableW / cols.length;

        // Header row
        doc.setFillColor(30, 58, 138); doc.rect(margin, y - 4, usableW, 7, "F");
        doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(255, 255, 255);
        let x = margin;
        cols.forEach((col) => { doc.text(col.replace(" (₹)", ""), x + 1, y); x += colW; });
        y += 6;

        // Data rows
        doc.setTextColor(30, 30, 30);
        data.forEach((row: any, ri: number) => {
            if (y > (doc.internal.pageSize.getHeight() - 20)) {
                doc.addPage();
                y = 20;
            }
            if (ri % 2 === 0) { doc.setFillColor(245, 247, 255); doc.rect(margin, y - 4, usableW, 6, "F"); }
            doc.setFont("helvetica", "normal"); doc.setFontSize(7);
            x = margin;
            Object.values(row).forEach((val: any) => {
                const displayVal = typeof val === "number" ? val.toLocaleString("en-IN") : String(val ?? "");
                doc.text(displayVal.substring(0, 16), x + 1, y);
                x += colW;
            });
            y += 6;
            doc.setDrawColor(220, 225, 240); doc.line(margin, y - 1, pageW - margin, y - 1);
        });

        // Footer
        y += 8;
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(40, 40, 40);
        doc.text("Authorised Signatory: ______________________________  Designation: ______________________________  Date: ____________", margin, y);
        const pageH = doc.internal.pageSize.getHeight();
        doc.setFontSize(7); doc.setTextColor(150, 150, 150);
        doc.text(`Kept open for inspection as required by law — Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`, pageW / 2, pageH - 6, { align: "center" });
        doc.setDrawColor(200, 200, 220); doc.line(margin, pageH - 9, pageW - margin, pageH - 9);

        await addOpticompBharatFooter(doc);
        doc.save(`${registerData.name.replace(/[\s/—]+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`);
        toast({ title: "Register PDF Downloaded", description: `${registerData.name} — A4 format, ready to print.` });
    };


    const filteredData = useMemo(() => {
        if (!searchQuery.trim()) return registerData.data;
        const lowerQuery = searchQuery.toLowerCase();
        return registerData.data.filter(row =>
            Object.values(row).some(val =>
                String(val || "").toLowerCase().includes(lowerQuery)
            )
        );
    }, [registerData.data, searchQuery]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Statutory Registers</h1>
                    <p className="mt-1 text-muted-foreground">Maintained under various labour laws</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="space-y-1">
                        <Label className="text-xs">Select Register</Label>
                        <Select value={selectedRegister} onValueChange={setSelectedRegister}>
                            <SelectTrigger className="w-[200px] sm:w-[280px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {registerKeys.map((r) => (
                                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {needsMonth && (
                        <div className="space-y-1">
                            <Label className="text-xs">Select Month</Label>
                            <Input
                                type="month"
                                value={month}
                                onChange={(e) => setMonth(e.target.value)}
                                className="w-40"
                            />
                        </div>
                    )}

                    {needsFY && (
                        <div className="space-y-1">
                            <Label className="text-xs">Financial Year</Label>
                            <Select value={fy} onValueChange={setFy}>
                                <SelectTrigger className="w-32">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="2024-25">2024-25</SelectItem>
                                    <SelectItem value="2025-26">2025-26</SelectItem>
                                    <SelectItem value="2026-27">2026-27</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <Button onClick={handleExport} variant="outline" className="gap-2" disabled={loading || registerData.data.length === 0}>
                        <Download className="h-4 w-4" />
                        <span className="hidden sm:inline">CSV</span>
                    </Button>
                    <Button onClick={handleExportPDF} className="gap-2" disabled={loading || registerData.data.length === 0}>
                        <FileText className="h-4 w-4" />
                        <span className="hidden sm:inline">Export PDF</span>
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <CardTitle>{registerData.name}</CardTitle>
                            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                        </div>
                        <CardDescription>{registerData.description}</CardDescription>
                    </div>
                    <div className="w-full sm:w-64">
                        <Input
                            placeholder="Search in register..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 text-muted-foreground border-b">
                                <tr>
                                    {registerData.columns.map((col, idx) => (
                                        <th key={idx} className="px-4 py-3 font-medium whitespace-nowrap">
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={registerData.columns.length || 1} className="px-4 py-8 text-center text-muted-foreground">
                                            Loading register data...
                                        </td>
                                    </tr>
                                ) : registerData.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={registerData.columns.length || 1} className="px-4 py-8 text-center text-muted-foreground">
                                            No records found. {needsMonth ? "Process payroll for this month first." : ""}
                                        </td>
                                    </tr>
                                ) : filteredData.length === 0 && !loading && registerData.data.length > 0 ? (
                                    <tr>
                                        <td colSpan={registerData.columns.length || 1} className="px-4 py-8 text-center text-muted-foreground">
                                            No matches found for "{searchQuery}".
                                        </td>
                                    </tr>
                                ) : (
                                    filteredData.map((row, idx) => (
                                        <tr key={idx} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                                            {Object.values(row).map((val: any, vIdx) => (
                                                <td key={vIdx} className="px-4 py-3 whitespace-nowrap">
                                                    {typeof val === "number" ? val.toLocaleString("en-IN") : val}
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default Registers;
