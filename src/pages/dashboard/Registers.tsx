import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Employee {
    id: string;
    name: string;
    gross: number;
    basic: number;
    hra: number;
    employment_type: string;
}

const Registers = () => {
    const [selectedRegister, setSelectedRegister] = useState<string>("overtime");
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        const fetchEmployees = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { data: company } = await supabase
                    .from("companies")
                    .select("id")
                    .eq("user_id", user.id)
                    .maybeSingle();

                if (company) {
                    const { data, error } = await supabase
                        .from("employees")
                        .select("id, name, gross, basic, hra, employment_type")
                        .eq("company_id", company.id);

                    if (error) throw error;

                    if (data) {
                        setEmployees(data as Employee[]);
                    }
                }
            } catch (error: any) {
                toast({
                    title: "Error fetching employees",
                    description: error.message,
                    variant: "destructive",
                });
            } finally {
                setLoading(false);
            }
        };

        fetchEmployees();
    }, [toast]);

    const currentMonthYear = format(new Date(), "MMMM, yyyy");

    // Dynamic Register Data Generation based on Real Employees
    const generateRegisterData = (registerKey: string) => {
        switch (registerKey) {
            case "overtime":
                return {
                    name: "Form XIX - Register of Overtime",
                    description: "Statutory register for maintaining employee overtime records and earnings.",
                    columns: ["S.No.", "Name of Workman", "Sex", "Designation", "Date of Overtime", "Normal Hours", "Normal Rate", "Overtime Rate", "Overtime Earnings", "Total Earnings"],
                    data: employees.map((emp, i) => ({
                        sNo: i + 1, name: emp.name, sex: "-", designation: emp.employment_type || "-", date: "-", normalHours: 0, normalRate: 0, overtimeRate: 0, overtimeEarnings: 0, totalEarnings: Number(emp.gross)
                    }))
                };
            case "hra":
                return {
                    name: "Form A - Register of House-rent Allowance",
                    description: "Maintain records of HRA paid to workmen under Minimum House-Rent Allowance Rules.",
                    columns: ["Serial No.", "Names of Workmen", "Month & Year", "Gross Salary", "Basic", "HRA Paid", "Net Salary", "Bank Account Number"],
                    data: employees.map((emp, i) => ({
                        sNo: i + 1, name: emp.name, monthYear: currentMonthYear, gross: Number(emp.gross), basic: Number(emp.basic), hraPaid: Number(emp.hra), net: Number(emp.gross), bankAccount: "-"
                    }))
                };
            case "deductions":
                return {
                    name: "Form XX - Register of Deductions",
                    description: "Register of deductions for damage or loss.",
                    columns: ["S.No", "Name of Workmen", "Designation", "Particulars of damage/loss", "Amount of deduction", "No. of instalments", "Date of Recovery"],
                    data: employees.map((emp, i) => ({
                        sNo: i + 1, name: emp.name, designation: emp.employment_type || "-", lossDetails: "-", deductionAmount: 0, instalments: 0, recoveryDate: "-"
                    }))
                };
            case "fines":
                return {
                    name: "Form XXI - Register of Fines",
                    description: "Statutory register for fines imposed on employees.",
                    columns: ["S.No", "Name of Workmen", "Designation", "Act/Omission for which fine imposed", "Date of offence", "Amount of fine imposed", "Date fine realized"],
                    data: employees.map((emp, i) => ({
                        sNo: i + 1, name: emp.name, designation: emp.employment_type || "-", offence: "-", offenceDate: "-", fineAmount: 0, realizedDate: "-"
                    }))
                };
            case "lwf":
                return {
                    name: "LWF Registers",
                    description: "Unpaid Accumulations Account vide SECTION 3(1) OF THE ACT",
                    columns: ["S.No.", "Date", "Particulars", "Name of persons", "Amount"],
                    data: employees.map((emp, i) => ({
                        sNo: i + 1, date: currentMonthYear, particulars: "Labor Welfare Fund Contribution", name: emp.name, amount: 0
                    }))
                };
            case "maternity":
                return {
                    name: "Maternity Benefit Register - Form 10",
                    description: "Rule 12(1) Maternity Benefit Act, 1961",
                    columns: ["S.No.", "Name of the Woman Employee", "Date of Appointment", "Nature of Work", "Dates on which she is laid off", "Date of Birth of Child", "Maternity Benefit Paid"],
                    data: employees.map((emp, i) => ({
                        sNo: i + 1, name: emp.name, appointment: "-", workNature: emp.employment_type || "-", laidOffDates: "-", childBirthDate: "-", benefitPaid: "-"
                    }))
                };
            case "advances":
                return {
                    name: "Form XVIII - Register of Advances",
                    description: "Register to track advances made to employees and their recoveries.",
                    columns: ["S.No.", "Name of Workmen", "Date", "Purpose(s) for which advance made", "Number of instalments", "Date and amount of each instalment repaid"],
                    data: employees.map((emp, i) => ({
                        sNo: i + 1, name: emp.name, date: "-", purpose: "-", instalments: 0, repaidDetails: "-"
                    }))
                };
            case "bonus":
                return {
                    name: "Bonus Form-A,B,C Register",
                    description: "Computation of allocable surplus and payment of bonus.",
                    columns: ["S.No.", "Name of Workmen", "Gross Salary", "Number of days worked in the year", "Bonus amount payable"],
                    data: employees.map((emp, i) => ({
                        sNo: i + 1, name: emp.name, gross: Number(emp.gross), daysWorked: 365, bonusPayable: 0
                    }))
                };
            case "accident":
                return {
                    name: "Form 11 - ESIC Accident Register",
                    description: "Employee State Insurance (General) Regulations Regulation 66 Accident Book.",
                    columns: ["S.No.", "Date of Notice", "Time of Notice", "Name of injured person", "Age", "Insurance No.", "Dept/Occupation", "Date & Time of Injury", "Place of Injury", "Cause", "Nature of Injury", "What person was doing"],
                    data: employees.map((emp, i) => ({
                        sNo: i + 1, dateofNotice: "-", timeOfNotice: "-", name: emp.name, age: "-", insuranceNo: "-", dept: emp.employment_type || "-", injuryDate: "-", place: "-", cause: "-", nature: "-", doingWhat: "-"
                    }))
                };
            default:
                return { name: "", description: "", columns: [], data: [] };
        }
    };

    const registerKeys = [
        { id: "overtime", name: "Form XIX - Overtime" },
        { id: "hra", name: "Form A - House-rent Allowance" },
        { id: "deductions", name: "Form XX - Deductions" },
        { id: "fines", name: "Form XXI - Fines" },
        { id: "lwf", name: "LWF Registers" },
        { id: "maternity", name: "Form 10 - Maternity Benefit" },
        { id: "advances", name: "Form XVIII - Advances" },
        { id: "bonus", name: "Form A,B,C - Bonus Register" },
        { id: "accident", name: "Form 11 - ESIC Accident Register" },
    ];

    const register = generateRegisterData(selectedRegister);

    const handleExport = () => {
        if (!register.data || register.data.length === 0) return;

        // Basic CSV export logic
        const header = register.columns.join(",");
        const rows = register.data.map(obj => Object.values(obj).join(","));
        const csvContent = "data:text/csv;charset=utf-8," + [header, ...rows].join("\\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${register.name.replace(/\\s+/g, "_")}.csv`);
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

                <div className="flex items-center gap-2">
                    <Select
                        value={selectedRegister}
                        onValueChange={setSelectedRegister}
                    >
                        <SelectTrigger className="w-[280px]">
                            <SelectValue placeholder="Select a register format..." />
                        </SelectTrigger>
                        <SelectContent>
                            {registerKeys.map((item) => (
                                <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button onClick={handleExport} className="gap-2" disabled={loading || register.data.length === 0}>
                        <Download className="h-4 w-4" />
                        <span className="hidden sm:inline">Export CSV</span>
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <CardTitle>{register.name}</CardTitle>
                        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>
                    <CardDescription>{register.description}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 text-muted-foreground border-b">
                                <tr>
                                    {register.columns.map((col, idx) => (
                                        <th key={idx} className="px-4 py-3 font-medium whitespace-nowrap">
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={register.columns.length} className="px-4 py-8 text-center text-muted-foreground">
                                            Loading employee data...
                                        </td>
                                    </tr>
                                ) : register.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={register.columns.length} className="px-4 py-8 text-center text-muted-foreground">
                                            No matching employee records found for this company.
                                        </td>
                                    </tr>
                                ) : (
                                    register.data.map((row, idx) => (
                                        <tr key={idx} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                                            {Object.values(row).map((val: any, vIdx) => (
                                                <td key={vIdx} className="px-4 py-3 whitespace-nowrap">
                                                    {val}
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
