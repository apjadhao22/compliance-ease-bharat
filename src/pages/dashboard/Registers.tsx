import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const Registers = () => {
    const [selectedRegister, setSelectedRegister] = useState<string>("overtime");
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
                            .eq("payroll_run_id", run.id);
                        setRegisterData({
                            name: "Form XIX - Register of Overtime",
                            description: `Overtime records for ${month}`,
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
                            .eq("payroll_run_id", run.id);
                        setRegisterData({
                            name: "Form A - Register of House-rent Allowance",
                            description: `HRA records for ${month}`,
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
                            .eq("payroll_run_id", run.id);
                        setRegisterData({
                            name: "LWF Register",
                            description: `Labour Welfare Fund deductions for ${month}`,
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
                        .eq("financial_year", fy);
                    setRegisterData({
                        name: "Bonus Form-A,B,C Register",
                        description: `Bonus computation for FY ${fy}`,
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
                    // No dedicated advances table — show empty register
                    setRegisterData({
                        name: "Form XVIII - Register of Advances",
                        description: "No advances recorded. This register will populate when an advances module is added.",
                        columns: ["S.No.", "Name", "Date", "Purpose", "Instalments", "Repaid Details"],
                        data: [],
                    });
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
        { id: "overtime", name: "Form XIX - Overtime" },
        { id: "hra", name: "Form A - House-rent Allowance" },
        { id: "deductions", name: "Form XX - Deductions" },
        { id: "fines", name: "Form XXI - Fines" },
        { id: "lwf", name: "LWF Register" },
        { id: "maternity", name: "Form 10 - Maternity Benefit" },
        { id: "advances", name: "Form XVIII - Advances" },
        { id: "bonus", name: "Form A,B,C - Bonus Register" },
        { id: "accident", name: "Form 11 - ESIC Accident Register" },
    ];

    const needsMonth = ["overtime", "hra", "deductions", "lwf"].includes(selectedRegister);
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

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Statutory Registers</h1>
                    <p className="text-muted-foreground">View and export electronically maintained audit registers.</p>
                </div>

                <div className="flex flex-wrap items-end gap-2">
                    <Select value={selectedRegister} onValueChange={setSelectedRegister}>
                        <SelectTrigger className="w-[280px]">
                            <SelectValue placeholder="Select a register format..." />
                        </SelectTrigger>
                        <SelectContent>
                            {registerKeys.map((item) => (
                                <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {needsMonth && (
                        <div className="space-y-1">
                            <Label className="text-xs">Month</Label>
                            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
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

                    <Button onClick={handleExport} className="gap-2" disabled={loading || registerData.data.length === 0}>
                        <Download className="h-4 w-4" />
                        <span className="hidden sm:inline">Export CSV</span>
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <CardTitle>{registerData.name}</CardTitle>
                        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>
                    <CardDescription>{registerData.description}</CardDescription>
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
                                ) : (
                                    registerData.data.map((row, idx) => (
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
