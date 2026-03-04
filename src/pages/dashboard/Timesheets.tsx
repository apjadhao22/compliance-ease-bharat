import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { Upload, Download, CheckCircle, Clock, Trash2, Loader2, AlertCircle, FileSpreadsheet, XCircle, ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getSafeErrorMessage } from "@/lib/safe-error";
import { read, utils } from "xlsx";
import { ScrollArea } from "@/components/ui/scroll-area";

type Timesheet = {
    id: string;
    employee_id: string;
    date: string;
    normal_hours: number;
    overtime_hours: number;
    status: 'Pending' | 'Approved' | 'Rejected';
    notes?: string;
    employees?: { name: string; emp_code: string };
};

type ValidationError = {
    rowNumber: number;
    employeeCode: string;
    date: string;
    issue: string;
};

export default function Timesheets() {
    const { toast } = useToast();
    const [companyId, setCompanyId] = useState<string | null>(null);
    const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Mapper State
    const [showMapper, setShowMapper] = useState(false);
    const [parsedData, setParsedData] = useState<any[]>([]);
    const [fileHeaders, setFileHeaders] = useState<string[]>([]);
    const [mapping, setMapping] = useState({
        emp_code: "",
        date: "",
        normal_hours: "",
        overtime_hours: "",
        clock_in: "",
        notes: ""
    });

    // Late Mark Report
    const [lateMarkReport, setLateMarkReport] = useState<{ empCode: string; name: string; lateCount: number; threshold: number; willDeduct: boolean }[]>([]);
    const [showLateMarkReport, setShowLateMarkReport] = useState(false);

    // Policy State
    const [overtimePolicy, setOvertimePolicy] = useState<'allow' | 'trim' | 'flag'>('allow');

    // Validation State
    const [showValidation, setShowValidation] = useState(false);
    const [validRecords, setValidRecords] = useState<any[]>([]);
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);


    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: company } = await supabase
                .from("companies")
                .select("id")
                .eq("user_id", user.id)
                .maybeSingle();

            if (company) {
                setCompanyId(company.id);
                const { data: sheets, error } = await supabase
                    .from("timesheets")
                    .select("*, employees(name, emp_code)")
                    .eq("company_id", company.id)
                    .order("date", { ascending: false })
                    .limit(100);

                if (error) throw error;
                if (sheets) setTimesheets(sheets as any);
            }
        } catch (error: any) {
            toast({ title: "Error loading timesheets", description: getSafeErrorMessage(error), variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !companyId) return;

        setUploading(true);
        try {
            const data = await file.arrayBuffer();
            const wb = read(data, { cellDates: true });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rawJson = utils.sheet_to_json(ws, { defval: "" }) as any[];

            if (rawJson.length === 0) throw new Error("File is empty.");

            const headers = Object.keys(rawJson[0]);
            setFileHeaders(headers);
            setParsedData(rawJson);

            const guessMapping = {
                emp_code: headers.find(h => h.toLowerCase().includes('emp') && h.toLowerCase().includes('code')) || headers.find(h => h.toLowerCase() === 'employee id') || headers.find(h => h.toLowerCase() === 'emp_code') || "",
                date: headers.find(h => h.toLowerCase().includes('date')) || "",
                normal_hours: headers.find(h => h.toLowerCase().includes('normal') || h.toLowerCase().includes('reg')) || "",
                overtime_hours: headers.find(h => h.toLowerCase().includes('overtime') || h.toLowerCase() === 'ot') || "",
                clock_in: headers.find(h => h.toLowerCase().includes('clock_in') || h.toLowerCase().includes('clock in') || h.toLowerCase().includes('login') || h.toLowerCase().includes('in time')) || "",
                notes: headers.find(h => h.toLowerCase().includes('note')) || ""
            };
            setMapping(guessMapping);
            setShowMapper(true);

        } catch (error: any) {
            toast({ title: "Read Failed", description: getSafeErrorMessage(error), variant: "destructive" });
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };


    const runValidation = async () => {
        if (!mapping.emp_code || !mapping.date) {
            toast({ title: "Incomplete Mapping", description: "Employee Code and Date must be mapped.", variant: "destructive" });
            return;
        }

        setUploading(true);
        try {
            // 1. Fetch map of known employees
            const { data: emps } = await supabase.from('employees').select('id, emp_code').eq('company_id', companyId);
            const empMap = new Map(emps?.map(e => [String(e.emp_code).toUpperCase().trim().replace(/\s+/g, ''), e.id]));

            // 2. Optimized conflict detection: Only fetch existing sheets for the date range in our file
            const dates = parsedData.map(row => {
                const d = row[mapping.date];
                if (d instanceof Date) return format(d, "yyyy-MM-dd");
                if (typeof d === "number") {
                    const dobj = new Date((d - 25569) * 86400 * 1000);
                    dobj.setMinutes(dobj.getMinutes() + dobj.getTimezoneOffset());
                    return format(dobj, "yyyy-MM-dd");
                }
                return String(d || "").trim().substring(0, 10);
            }).filter(d => d && d.length === 10);

            const minDate = dates.length > 0 ? dates.reduce((a, b) => a < b ? a : b) : null;
            const maxDate = dates.length > 0 ? dates.reduce((a, b) => a > b ? a : b) : null;

            let mappedExisting = new Set<string>();
            if (minDate && maxDate) {
                const { data: existingSheets } = await supabase
                    .from('timesheets')
                    .select('employee_id, date')
                    .eq('company_id', companyId)
                    .gte('date', minDate)
                    .lte('date', maxDate);
                existingSheets?.forEach(s => mappedExisting.add(`${s.employee_id}_${s.date}`));
            }

            const newValid = [];
            const newErrors: ValidationError[] = [];

            // 3. Dry-Run loop
            for (let i = 0; i < parsedData.length; i++) {
                const row = parsedData[i];
                const displayRow = i + 2; // Excel row numbering (assuming 1 header row)

                // EMp Code Checking
                const rawEmpCode = String(row[mapping.emp_code] || "").trim();
                if (!rawEmpCode) {
                    newErrors.push({ rowNumber: displayRow, employeeCode: "BLANK", date: "-", issue: "Employee code is missing" });
                    continue;
                }
                const cleanEmpCode = rawEmpCode.replace(/\s+/g, '').replace(/\./g, '').toUpperCase();
                let emp_id = empMap.get(cleanEmpCode) || empMap.get(rawEmpCode);

                if (!emp_id) {
                    for (const [key, val] of empMap.entries()) {
                        if (key.includes(cleanEmpCode) || cleanEmpCode.includes(key)) {
                            emp_id = val; break;
                        }
                    }
                }

                if (!emp_id) {
                    newErrors.push({ rowNumber: displayRow, employeeCode: rawEmpCode, date: "-", issue: "Employee not found in system" });
                    continue;
                }

                // Date Checking
                const dateVal = row[mapping.date];
                let formattedDate = "";

                if (dateVal instanceof Date) {
                    formattedDate = format(dateVal, "yyyy-MM-dd");
                } else if (typeof dateVal === "number") {
                    const dateObj = new Date((dateVal - (25569)) * 86400 * 1000);
                    dateObj.setMinutes(dateObj.getMinutes() + dateObj.getTimezoneOffset());
                    formattedDate = format(dateObj, "yyyy-MM-dd");
                } else if (typeof dateVal === "string") {
                    const cleanDateStr = dateVal.trim().replace(/\s+/g, '').replace(/\//g, '-');
                    try {
                        const d = new Date(cleanDateStr);
                        if (!isNaN(d.getTime())) {
                            formattedDate = format(d, "yyyy-MM-dd");
                        }
                    } catch (e) {
                        // Ignore date parsing errors and let validation catch it
                    }
                }

                if (!formattedDate || formattedDate.length !== 10) {
                    newErrors.push({ rowNumber: displayRow, employeeCode: rawEmpCode, date: String(dateVal), issue: "Unrecognizable date format" });
                    continue;
                }

                // Duplicate checking
                if (mappedExisting.has(`${emp_id}_${formattedDate}`)) {
                    newErrors.push({ rowNumber: displayRow, employeeCode: rawEmpCode, date: formattedDate, issue: "Timesheet already exists for this date. (Duplicate)" });
                    continue;
                }

                // Hours Checking
                const parseNumberRobust = (val: any, defaultVal: number) => {
                    if (val === undefined || val === null || val === "") return defaultVal;
                    if (typeof val === "number") return val;
                    const cleanStr = String(val).trim().replace(',', '.').replace(/[^0-9.-]/g, '');
                    const num = parseFloat(cleanStr);
                    return isNaN(num) ? defaultVal : num;
                };

                let normHrs = mapping.normal_hours ? parseNumberRobust(row[mapping.normal_hours], 8) : 8;
                let otHrs = mapping.overtime_hours ? parseNumberRobust(row[mapping.overtime_hours], 0) : 0;

                if (normHrs < 0 || otHrs < 0) {
                    newErrors.push({ rowNumber: displayRow, employeeCode: rawEmpCode, date: formattedDate, issue: "Hours cannot be negative" });
                    continue;
                }

                if ((normHrs + otHrs) > 24) {
                    newErrors.push({ rowNumber: displayRow, employeeCode: rawEmpCode, date: formattedDate, issue: "Total hours exceed 24 in a single day" });
                    continue;
                }

                // Apply Overtime Policy
                if (overtimePolicy === 'trim') {
                    if ((normHrs + otHrs) > 8) {
                        normHrs = 8;
                        otHrs = 0;
                    }
                } else if (overtimePolicy === 'flag') {
                    if ((normHrs + otHrs) > 8) {
                        newErrors.push({ rowNumber: displayRow, employeeCode: rawEmpCode, date: formattedDate, issue: `Overtime Flagged: Worked ${normHrs + otHrs} hours (Strict 8h policy)` });
                        continue;
                    }
                }

                // Passed all validation
                newValid.push({
                    company_id: companyId,
                    employee_id: emp_id,
                    date: formattedDate,
                    normal_hours: normHrs,
                    overtime_hours: otHrs,
                    notes: mapping.notes ? String(row[mapping.notes]).trim() : null,
                    status: 'Approved' // Auto-approve valid bulk uploads
                });
            }

            setValidRecords(newValid);
            setValidationErrors(newErrors);

            // ── Late-Mark Detection ──────────────────────────────────────
            if (mapping.clock_in) {
                // Fetch shift policies for employees in this batch
                const batchEmpIds = [...new Set(newValid.map((r: any) => r.employee_id))];
                const { data: empShifts } = await (supabase as any)
                    .from("employees")
                    .select("id, emp_code, name, shift_policy_id, shift_policies(shift_start, late_mark_grace_minutes, max_late_marks_per_month)")
                    .in("id", batchEmpIds);

                if (empShifts && empShifts.length > 0) {
                    // Count late marks per employee
                    const lateCountMap: Record<string, number> = {};
                    for (const row of parsedData) {
                        const rawEmpCode = String(row[mapping.emp_code] || "").trim().replace(/\s+/g, '').replace(/\./g, '').toUpperCase();
                        const emp = empShifts.find((e: any) => String(e.emp_code).toUpperCase() === rawEmpCode);
                        if (!emp || !emp.shift_policies || !row[mapping.clock_in]) continue;

                        const clockInStr = String(row[mapping.clock_in]).trim();
                        const [hrs, mins] = clockInStr.split(":").map(Number);
                        if (isNaN(hrs) || isNaN(mins)) continue;

                        const [shiftHrs, shiftMins] = emp.shift_policies.shift_start.split(":").map(Number);
                        const grace = emp.shift_policies.late_mark_grace_minutes || 15;

                        const clockInMins = hrs * 60 + mins;
                        const allowedMins = shiftHrs * 60 + shiftMins + grace;

                        if (clockInMins > allowedMins) {
                            lateCountMap[emp.id] = (lateCountMap[emp.id] || 0) + 1;
                        }
                    }

                    const report = empShifts
                        .filter((e: any) => lateCountMap[e.id] && lateCountMap[e.id] > 0)
                        .map((e: any) => ({
                            empCode: e.emp_code,
                            name: e.name,
                            lateCount: lateCountMap[e.id] || 0,
                            threshold: e.shift_policies?.max_late_marks_per_month || 3,
                            willDeduct: (lateCountMap[e.id] || 0) > (e.shift_policies?.max_late_marks_per_month || 3)
                        }));

                    if (report.length > 0) {
                        setLateMarkReport(report);
                        setShowLateMarkReport(true);
                    }
                }
            }
            // ── End Late-Mark Detection ──────────────────────────────────

            setShowMapper(false);
            setShowValidation(true);

        } catch (error: any) {
            toast({ title: "Validation Error", description: getSafeErrorMessage(error), variant: "destructive" });
        } finally {
            setUploading(false);
        }
    };


    const handleFinalIngest = async () => {
        if (validRecords.length === 0) {
            toast({ title: "Nothing to insert", description: "No valid records were found to ingest.", variant: "destructive" });
            setShowValidation(false);
            return;
        }

        setUploading(true);
        try {
            const BATCH_SIZE = 500;
            let successCount = 0;

            for (let i = 0; i < validRecords.length; i += BATCH_SIZE) {
                const chunk = validRecords.slice(i, i + BATCH_SIZE);
                const { error } = await supabase.from('timesheets').insert(chunk);
                if (error) throw error;
                successCount += chunk.length;
            }

            toast({ title: "Ingestion Successful", description: `Successfully safely ingested ${successCount} timesheet records in batches.` });
            setShowValidation(false);
            fetchData();
        } catch (error: any) {
            toast({ title: "Ingestion Failed", description: getSafeErrorMessage(error), variant: "destructive" });
        } finally {
            setUploading(false);
        }
    };


    const handleUpdateStatus = async (id: string, status: string) => {
        const { error } = await supabase.from('timesheets').update({ status }).eq('id', id);
        if (!error) {
            setTimesheets(timesheets.map(t => t.id === id ? { ...t, status: status as any } : t));
        }
    };

    const handleDelete = async (id: string) => {
        const { error } = await supabase.from('timesheets').delete().eq('id', id);
        if (!error) {
            setTimesheets(timesheets.filter(t => t.id !== id));
        }
    };

    const downloadTemplate = () => {
        const headers = ["emp_code", "date", "normal_hours", "overtime_hours", "notes"];
        const csv = headers.join(",") + "\nEMP001,2026-03-01,8,2,Stayed late for release";
        const blob = new Blob([csv], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "timesheet_template.csv";
        a.click();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Timesheet Ingestion</h1>
                    <p className="text-muted-foreground mt-1">Bulk upload attendance and overtime hours securely.</p>
                </div>
                <div className="flex gap-2 items-center">
                    <Select value={overtimePolicy} onValueChange={(v: any) => setOvertimePolicy(v)}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Overtime Policy" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="allow">Policy: Allow Overtime</SelectItem>
                            <SelectItem value="trim">Policy: Trim to 8 Hours</SelectItem>
                            <SelectItem value="flag">Policy: Flag Overtime (&gt;8h)</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={downloadTemplate}>
                        <Download className="mr-2 h-4 w-4" /> Download Template
                    </Button>
                    <input type="file" accept=".csv,.xlsx,.xls" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                    <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                        {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                        Upload Sheet
                    </Button>
                </div>
            </div>

            {/* ── Late Mark Report Card ─────────────────────────────────── */}
            {showLateMarkReport && lateMarkReport.length > 0 && (
                <Card className="border-amber-200">
                    <CardHeader className="flex flex-row items-center justify-between border-b px-6 py-4 bg-amber-50">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-amber-600" />
                            <div>
                                <CardTitle className="text-base text-amber-800">Late Mark Report</CardTitle>
                                <CardDescription className="text-amber-700 text-xs mt-0.5">
                                    Based on clock-in times vs assigned shift policies. Employees exceeding threshold get half-day deduction.
                                </CardDescription>
                            </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setShowLateMarkReport(false)} className="text-xs">Dismiss</Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Employee</TableHead>
                                    <TableHead>Emp Code</TableHead>
                                    <TableHead className="text-center">Late Marks</TableHead>
                                    <TableHead className="text-center">Threshold</TableHead>
                                    <TableHead className="text-right">Payroll Impact</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {lateMarkReport.map((r, i) => (
                                    <TableRow key={i} className={r.willDeduct ? "bg-red-50" : "bg-amber-50/50"}>
                                        <TableCell className="font-medium">{r.name}</TableCell>
                                        <TableCell className="font-mono text-xs">{r.empCode}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className={r.willDeduct ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"}>
                                                {r.lateCount}×
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center text-sm text-muted-foreground">{r.threshold}×</TableCell>
                                        <TableCell className="text-right">
                                            {r.willDeduct
                                                ? <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">⚠ Half-Day Deduction</Badge>
                                                : <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">✓ No Deduction</Badge>
                                            }
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Recent Timesheets</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                    ) : (

                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Employee</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Normal Hrs</TableHead>
                                    <TableHead className="text-right">OT Hrs</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {timesheets.length > 0 ? timesheets.map(t => (
                                    <TableRow key={t.id}>
                                        <TableCell className="font-medium">{t.employees?.name} ({t.employees?.emp_code})</TableCell>
                                        <TableCell>{format(new Date(t.date), "dd MMM yyyy")}</TableCell>
                                        <TableCell className="text-right">{t.normal_hours}</TableCell>
                                        <TableCell className="text-right">{t.overtime_hours}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant={t.status === 'Approved' ? "default" : t.status === 'Rejected' ? "destructive" : "secondary"}>
                                                {t.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                {t.status === 'Pending' && (
                                                    <>
                                                        <Button size="sm" variant="ghost" className="text-green-600" onClick={() => handleUpdateStatus(t.id, 'Approved')}><CheckCircle className="h-4 w-4" /></Button>
                                                        <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleUpdateStatus(t.id, 'Rejected')}><AlertCircle className="h-4 w-4" /></Button>
                                                    </>
                                                )}
                                                <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => handleDelete(t.id)}><Trash2 className="h-4 w-4" /></Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No timesheets found. Upload a sheet to get started.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>


            {/* 1. MAPPING DIALOG */}
            <Dialog open={showMapper} onOpenChange={setShowMapper}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Map Columns</DialogTitle>
                        <DialogDescription>
                            Match your spreadsheet's columns to the system's required fields.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        {[
                            { id: "emp_code", label: "Employee Code*", key: "emp_code" },
                            { id: "date", label: "Date*", key: "date" },
                            { id: "normal_hours", label: "Normal Hours (Default 8)", key: "normal_hours" },
                            { id: "overtime_hours", label: "Overtime Hours (Default 0)", key: "overtime_hours" },
                            { id: "notes", label: "Notes", key: "notes" },
                        ].map((field) => (
                            <div key={field.id} className="grid grid-cols-2 items-center gap-4">
                                <Label className="text-right">{field.label}</Label>
                                <Select
                                    value={(mapping as any)[field.key]}
                                    onValueChange={(val) => setMapping({ ...mapping, [field.key]: val === "NONE" ? "" : val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select column..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NONE">-- Ignore --</SelectItem>
                                        {fileHeaders.map(h => (
                                            <SelectItem key={h} value={h}>{h}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowMapper(false)} disabled={uploading}>Cancel</Button>
                        <Button onClick={runValidation} disabled={uploading}>
                            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ChevronRight className="mr-2 h-4 w-4" />}
                            Proceed to Validation
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 2. VALIDATION REPORT DIALOG */}
            <Dialog open={showValidation} onOpenChange={setShowValidation}>
                <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Validation Report</DialogTitle>
                        <DialogDescription>
                            Review the data before final ingestion.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
                        <div className="flex gap-4">
                            <Card className="flex-1 bg-green-50/50 border-green-200">
                                <CardHeader className="py-3">
                                    <CardTitle className="text-green-700 text-lg flex items-center gap-2"><CheckCircle className="h-5 w-5" /> Valid Records</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-3xl font-bold text-green-700">{validRecords.length}</p>
                                    <p className="text-xs text-green-600">Ready to ingest</p>
                                </CardContent>
                            </Card>
                            <Card className="flex-1 bg-red-50/50 border-red-200">
                                <CardHeader className="py-3">
                                    <CardTitle className="text-red-700 text-lg flex items-center gap-2"><XCircle className="h-5 w-5" /> Failed Rows</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-3xl font-bold text-red-700">{validationErrors.length}</p>
                                    <p className="text-xs text-red-600">Will be skipped</p>
                                </CardContent>
                            </Card>
                        </div>

                        {validationErrors.length > 0 && (
                            <div className="flex-1 min-h-[250px] border rounded-md">
                                <ScrollArea className="h-[250px]">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-secondary">
                                            <TableRow>
                                                <TableHead className="w-16">Row</TableHead>
                                                <TableHead>Emp Code</TableHead>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Error Reason</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {validationErrors.map((err, i) => (
                                                <TableRow key={i}>
                                                    <TableCell className="font-medium text-muted-foreground">{err.rowNumber}</TableCell>
                                                    <TableCell>{err.employeeCode}</TableCell>
                                                    <TableCell>{err.date}</TableCell>
                                                    <TableCell className="text-red-600 font-medium">{err.issue}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            </div>
                        )}
                        {validationErrors.length === 0 && validRecords.length > 0 && (
                            <div className="p-8 text-center text-muted-foreground border rounded-md border-dashed">
                                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-3 opacity-50" />
                                <p>All data looks perfect! No errors found.</p>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="mt-auto pt-4 border-t">
                        <Button variant="outline" onClick={() => setShowValidation(false)} disabled={uploading}>Cancel</Button>
                        <Button onClick={handleFinalIngest} disabled={validRecords.length === 0 || uploading} className="bg-green-600 hover:bg-green-700 text-white">
                            {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Ingest {validRecords.length} Valid Records
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
