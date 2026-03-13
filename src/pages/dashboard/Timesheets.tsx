import { useState, useEffect, useRef, useCallback } from "react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import {
    Upload, Download, CheckCircle, Trash2, Loader2, AlertCircle,
    FileSpreadsheet, XCircle, ChevronRight, RefreshCw, UserPlus, Clock,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

// ── Types ─────────────────────────────────────────────────────────────────────

type Timesheet = {
    id: string;
    employee_id: string;
    date: string;
    normal_hours: number;
    overtime_hours: number;
    status: 'Pending' | 'Approved' | 'Rejected';
    notes?: string;
    employees?: { name: string; emp_code: string };
    oshWarnings?: string[];
};

type ValidationError = {
    rowNumber: number;
    employeeCode: string;
    date: string;
    issue: string;
};

/** One pending new employee row — in-memory until user confirms creation. */
export type PendingNewEmployee = {
    employeeCode: string;          // readonly — from file
    name: string;                  // editable in dialog
    employmentType: 'permanent' | 'fixed_term' | 'contract' | 'trainee';
    workerType: 'employee' | 'fixed_term' | 'contract' | 'gig' | 'platform' | 'unorganised';
    empStatus: 'active' | 'pending_onboarding';
    selected: boolean;
    /** Parsed timesheet rows for this employee from the uploaded file */
    timesheetRows: Array<{
        date: string;
        normal_hours: number;
        overtime_hours: number;
        notes: string | null;
    }>;
    sourceMonth: string;           // "YYYY-MM" — first date found for this employee
};

// ── Module-level pure helpers (exported so tests can import them) ─────────────

/** Parse a raw cell value into a "yyyy-MM-dd" string, or "" on failure. */
export function parseTimesheetDate(dateVal: unknown): string {
    if (dateVal instanceof Date) return format(dateVal, "yyyy-MM-dd");
    if (typeof dateVal === "number") {
        const d = new Date((dateVal - 25569) * 86400 * 1000);
        d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
        return format(d, "yyyy-MM-dd");
    }
    if (typeof dateVal === "string") {
        const clean = dateVal.trim().replace(/\s+/g, "").replace(/\//g, "-");
        try {
            const d = new Date(clean);
            if (!isNaN(d.getTime())) return format(d, "yyyy-MM-dd");
        } catch { /* ignore */ }
    }
    return "";
}

/** Robustly parse a number cell; returns defaultVal for blank / NaN. */
export function parseNumberRobust(val: unknown, defaultVal: number): number {
    if (val === undefined || val === null || val === "") return defaultVal;
    if (typeof val === "number") return val;
    const clean = String(val).trim().replace(",", ".").replace(/[^0-9.-]/g, "");
    const n = parseFloat(clean);
    return isNaN(n) ? defaultVal : n;
}

/**
 * Pure classification — splits raw rows into:
 *   knownRows    → rows whose emp code resolves to an existing employee ID
 *   unknownGroups → rows whose emp code is not in empMap, grouped by clean code
 *   blankCodeIndices → 0-based indices of rows with a blank/missing emp code
 *
 * Exported for unit testing.
 */
export function classifyByEmpCode(
    rawRows: any[],
    empCodeColumn: string,
    empMap: Map<string, string>,          // cleanCode → employee_id
): {
    knownRows: Array<{ row: any; empId: string; rawCode: string; rowIndex: number }>;
    unknownGroups: Map<string, { rawCode: string; rows: Array<{ row: any; rowIndex: number }> }>;
    blankCodeIndices: number[];
} {
    const knownRows: Array<{ row: any; empId: string; rawCode: string; rowIndex: number }> = [];
    const unknownGroups = new Map<string, { rawCode: string; rows: Array<{ row: any; rowIndex: number }> }>();
    const blankCodeIndices: number[] = [];

    for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i];
        const rawCode = String(row[empCodeColumn] ?? "").trim();
        if (!rawCode) { blankCodeIndices.push(i); continue; }

        const cleanCode = rawCode.replace(/\s+/g, "").replace(/\./g, "").toUpperCase();
        let empId = empMap.get(cleanCode) ?? empMap.get(rawCode);

        // Fuzzy fallback — substring containment
        if (!empId) {
            for (const [key, val] of empMap.entries()) {
                if (key.includes(cleanCode) || cleanCode.includes(key)) { empId = val; break; }
            }
        }

        if (empId) {
            knownRows.push({ row, empId, rawCode, rowIndex: i });
        } else {
            if (!unknownGroups.has(cleanCode)) {
                unknownGroups.set(cleanCode, { rawCode, rows: [] });
            }
            unknownGroups.get(cleanCode)!.rows.push({ row, rowIndex: i });
        }
    }

    return { knownRows, unknownGroups, blankCodeIndices };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Timesheets() {
    const { toast } = useToast();
    const [companyId, setCompanyId] = useState<string | null>(null);
    const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Column mapper ────────────────────────────────────────────────────────
    const [showMapper, setShowMapper] = useState(false);
    const [parsedData, setParsedData] = useState<any[]>([]);
    const [fileHeaders, setFileHeaders] = useState<string[]>([]);
    const [mapping, setMapping] = useState({
        emp_code: "",
        date: "",
        normal_hours: "",
        overtime_hours: "",
        clock_in: "",
        name: "",      // optional — used to pre-fill name for new employees
        notes: "",
    });

    // ── Late-mark report ─────────────────────────────────────────────────────
    const [lateMarkReport, setLateMarkReport] = useState<{
        empCode: string; name: string; lateCount: number; threshold: number; willDeduct: boolean;
    }[]>([]);
    const [showLateMarkReport, setShowLateMarkReport] = useState(false);

    // ── Overtime policy ──────────────────────────────────────────────────────
    const [overtimePolicy, setOvertimePolicy] = useState<'allow' | 'trim' | 'flag'>('allow');

    // ── Compliance check ─────────────────────────────────────────────────────
    const [runningCompliance, setRunningCompliance] = useState(false);

    // ── Validation report dialog ─────────────────────────────────────────────
    const [showValidation, setShowValidation] = useState(false);
    const [validRecords, setValidRecords] = useState<any[]>([]);
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

    // ── Pending new employees ────────────────────────────────────────────────
    const [pendingNewEmployees, setPendingNewEmployees] = useState<PendingNewEmployee[]>([]);
    const [showNewEmpBanner, setShowNewEmpBanner] = useState(false);
    const [showNewEmpDialog, setShowNewEmpDialog] = useState(false);
    const [creatingNewEmps, setCreatingNewEmps] = useState(false);
    // Bulk-action selectors inside the dialog (reset after applying)
    const [bulkEmpType, setBulkEmpType] = useState("");
    const [bulkEmpStatus, setBulkEmpStatus] = useState("");

    // ── ESS Pending Approvals ────────────────────────────────────────────────
    type ESSPendingGroup = {
        employeeId: string;
        employeeName: string;
        empCode: string;
        weekLabel: string;
        rows: Array<{ id: string; date: string; normal_hours: number; overtime_hours: number; notes: string | null }>;
    };
    const [essPendingGroups, setEssPendingGroups] = useState<ESSPendingGroup[]>([]);
    const [essPendingLoading, setEssPendingLoading] = useState(false);
    const [essRejectComment, setEssRejectComment] = useState<Record<string, string>>({});
    const [essActioning, setEssActioning] = useState<string | null>(null);

    const fetchESSPending = useCallback(async () => {
        if (!companyId) return;
        setEssPendingLoading(true);
        try {
            const { data } = await supabase
                .from("timesheets")
                .select("id, employee_id, date, normal_hours, overtime_hours, notes, employees(name, emp_code)")
                .eq("status", "Pending")
                .order("date", { ascending: false });

            if (!data) { setEssPendingGroups([]); return; }

            // Group by employee + week
            const map = new Map<string, ESSPendingGroup>();
            for (const row of data) {
                const emp = row.employees as any;
                if (!emp) continue;
                const ws = format(startOfWeek(new Date(row.date), { weekStartsOn: 1 }), "d MMM");
                const we = format(endOfWeek(new Date(row.date), { weekStartsOn: 1 }), "d MMM yyyy");
                const key = `${row.employee_id}__${ws}`;
                if (!map.has(key)) {
                    map.set(key, {
                        employeeId: row.employee_id,
                        employeeName: emp.name ?? "Unknown",
                        empCode: emp.emp_code ?? "",
                        weekLabel: `${ws} – ${we}`,
                        rows: [],
                    });
                }
                map.get(key)!.rows.push({
                    id: row.id,
                    date: row.date,
                    normal_hours: row.normal_hours,
                    overtime_hours: row.overtime_hours,
                    notes: row.notes,
                });
            }
            setEssPendingGroups(Array.from(map.values()));
        } finally {
            setEssPendingLoading(false);
        }
    }, [companyId]);

    useEffect(() => { if (companyId) fetchESSPending(); }, [companyId, fetchESSPending]);

    const handleESSBulkAction = async (group: ESSPendingGroup, action: "Approved" | "Rejected") => {
        setEssActioning(`${group.employeeId}__${group.weekLabel}`);
        try {
            const ids = group.rows.map(r => r.id);
            const { error } = await supabase
                .from("timesheets")
                .update({ status: action })
                .in("id", ids);
            if (error) throw error;
            toast({
                title: action === "Approved" ? "Week approved" : "Week rejected",
                description: `${ids.length} row(s) for ${group.employeeName} (${group.weekLabel}) ${action.toLowerCase()}.`,
            });
            fetchESSPending();
            fetchData();
        } catch (err) {
            toast({ title: "Error", description: getSafeErrorMessage(err), variant: "destructive" });
        } finally {
            setEssActioning(null);
        }
    };

    // ── Regularization Pending Approvals ────────────────────────────────────
    type RegularizationRow = {
        id: string;
        request_date: string;
        original_status: string | null;
        requested_status: string;
        reason: string;
        status: string;
        review_comment: string | null;
        employees?: { name: string; emp_code: string };
    };
    const [regPending, setRegPending] = useState<RegularizationRow[]>([]);
    const [regLoading, setRegLoading] = useState(false);
    const [regComments, setRegComments] = useState<Record<string, string>>({});
    const [regActioning, setRegActioning] = useState<string | null>(null);

    const fetchRegPending = useCallback(async () => {
        if (!companyId) return;
        setRegLoading(true);
        try {
            const { data } = await supabase
                .from("regularization_requests")
                .select("id, request_date, original_status, requested_status, reason, status, review_comment, employees(name, emp_code)")
                .eq("company_id", companyId)
                .eq("status", "pending")
                .order("created_at", { ascending: false });
            setRegPending((data ?? []) as RegularizationRow[]);
        } finally {
            setRegLoading(false);
        }
    }, [companyId]);

    useEffect(() => { if (companyId) fetchRegPending(); }, [companyId, fetchRegPending]);

    const handleRegAction = async (id: string, action: "approved" | "rejected") => {
        setRegActioning(id);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { error } = await supabase
                .from("regularization_requests")
                .update({
                    status: action,
                    reviewed_by: user?.id,
                    reviewed_at: new Date().toISOString(),
                    review_comment: regComments[id] ?? null,
                })
                .eq("id", id);
            if (error) throw error;
            toast({ title: `Regularization ${action}` });
            fetchRegPending();
        } catch (err) {
            toast({ title: "Error", description: getSafeErrorMessage(err), variant: "destructive" });
        } finally {
            setRegActioning(null);
        }
    };

    // ── Comp-Off Pending Approvals ────────────────────────────────────────────
    type CompOffRow = {
        id: string;
        worked_date: string;
        avail_date: string | null;
        reason: string;
        status: string;
        review_comment: string | null;
        employees?: { name: string; emp_code: string };
    };
    const [compOffPending, setCompOffPending] = useState<CompOffRow[]>([]);
    const [compOffLoading, setCompOffLoading] = useState(false);
    const [compOffComments, setCompOffComments] = useState<Record<string, string>>({});
    const [compOffActioning, setCompOffActioning] = useState<string | null>(null);

    const fetchCompOffPending = useCallback(async () => {
        if (!companyId) return;
        setCompOffLoading(true);
        try {
            const { data } = await supabase
                .from("comp_off_requests")
                .select("id, worked_date, avail_date, reason, status, review_comment, employees(name, emp_code)")
                .eq("company_id", companyId)
                .eq("status", "pending")
                .order("created_at", { ascending: false });
            setCompOffPending((data ?? []) as CompOffRow[]);
        } finally {
            setCompOffLoading(false);
        }
    }, [companyId]);

    useEffect(() => { if (companyId) fetchCompOffPending(); }, [companyId, fetchCompOffPending]);

    const handleCompOffAction = async (id: string, action: "approved" | "rejected") => {
        setCompOffActioning(id);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { error } = await supabase
                .from("comp_off_requests")
                .update({
                    status: action,
                    reviewed_by: user?.id,
                    reviewed_at: new Date().toISOString(),
                    review_comment: compOffComments[id] ?? null,
                })
                .eq("id", id);
            if (error) throw error;
            toast({ title: `Comp-off ${action}` });
            fetchCompOffPending();
        } catch (err) {
            toast({ title: "Error", description: getSafeErrorMessage(err), variant: "destructive" });
        } finally {
            setCompOffActioning(null);
        }
    };

    // ── Derived counts (dialog button label + bulk bar) ──────────────────────
    const selectedNewEmpCount = pendingNewEmployees.filter(e => e.selected).length;
    const selectedTsRowCount  = pendingNewEmployees.filter(e => e.selected)
        .reduce((s, e) => s + e.timesheetRows.length, 0);
    const allNewEmpsSelected  = pendingNewEmployees.length > 0 &&
        pendingNewEmployees.every(e => e.selected);

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // Data fetching
    // ─────────────────────────────────────────────────────────────────────────
    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: company } = await supabase
                .from("companies")
                .select("id, state")
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
                if (sheets) {
                    setTimesheets(sheets.map(s => ({ ...s, oshWarnings: [] })) as any);
                }
            }
        } catch (error: any) {
            toast({ title: "Error loading timesheets", description: getSafeErrorMessage(error), variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // File parse → mapper
    // ─────────────────────────────────────────────────────────────────────────
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

            const h = (test: (s: string) => boolean) => headers.find(h => test(h.toLowerCase())) ?? "";
            const guessMapping = {
                emp_code:       h(s => (s.includes("emp") && s.includes("code")) || s === "employee id" || s === "emp_code"),
                date:           h(s => s.includes("date")),
                normal_hours:   h(s => s.includes("normal") || s.includes("reg")),
                overtime_hours: h(s => s.includes("overtime") || s === "ot"),
                clock_in:       h(s => s.includes("clock_in") || s.includes("clock in") || s.includes("login") || s.includes("in time")),
                name:           h(s => s === "name" || s === "employee name" || s === "emp_name" || s === "employee_name"),
                notes:          h(s => s.includes("note")),
            };
            setMapping(guessMapping);
            setShowMapper(true);
        } catch (error: any) {
            toast({ title: "Read Failed", description: getSafeErrorMessage(error), variant: "destructive" });
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Validation (dry-run) — splits known vs unknown employees
    // ─────────────────────────────────────────────────────────────────────────
    const runValidation = async () => {
        if (!mapping.emp_code || !mapping.date) {
            toast({ title: "Incomplete Mapping", description: "Employee Code and Date must be mapped.", variant: "destructive" });
            return;
        }
        setUploading(true);
        try {
            // 1. Build emp code → id map from DB
            const { data: emps } = await supabase
                .from("employees")
                .select("id, emp_code")
                .eq("company_id", companyId);
            const empMap = new Map(
                emps?.map(e => [String(e.emp_code).toUpperCase().trim().replace(/\s+/g, ""), e.id])
            );

            // 2. Classify rows: known / unknown / blank
            const { knownRows, unknownGroups, blankCodeIndices } =
                classifyByEmpCode(parsedData, mapping.emp_code, empMap);

            // 3. Date-range for optimised duplicate detection
            const allDates = parsedData
                .map(row => parseTimesheetDate(row[mapping.date]))
                .filter(d => d.length === 10);
            const minDate = allDates.length > 0 ? allDates.reduce((a, b) => a < b ? a : b) : null;
            const maxDate = allDates.length > 0 ? allDates.reduce((a, b) => a > b ? a : b) : null;

            const mappedExisting = new Set<string>();
            if (minDate && maxDate) {
                const { data: existing } = await supabase
                    .from("timesheets")
                    .select("employee_id, date")
                    .eq("company_id", companyId)
                    .gte("date", minDate)
                    .lte("date", maxDate);
                existing?.forEach(s => mappedExisting.add(`${s.employee_id}_${s.date}`));
            }

            const newValid: any[] = [];
            const newErrors: ValidationError[] = [];

            // 4. Blank codes → errors
            for (const idx of blankCodeIndices) {
                newErrors.push({ rowNumber: idx + 2, employeeCode: "BLANK", date: "-", issue: "Employee code is missing" });
            }

            // 5. Known employees — full date / hours / duplicate validation
            for (const { row, empId, rawCode, rowIndex } of knownRows) {
                const displayRow = rowIndex + 2;
                const dateVal = row[mapping.date];
                const formattedDate = parseTimesheetDate(dateVal);

                if (!formattedDate || formattedDate.length !== 10) {
                    newErrors.push({ rowNumber: displayRow, employeeCode: rawCode, date: String(dateVal), issue: "Unrecognizable date format" });
                    continue;
                }
                if (mappedExisting.has(`${empId}_${formattedDate}`)) {
                    newErrors.push({ rowNumber: displayRow, employeeCode: rawCode, date: formattedDate, issue: "Timesheet already exists for this date (duplicate)" });
                    continue;
                }

                let normHrs = mapping.normal_hours ? parseNumberRobust(row[mapping.normal_hours], 8) : 8;
                let otHrs   = mapping.overtime_hours ? parseNumberRobust(row[mapping.overtime_hours], 0) : 0;

                if (normHrs < 0 || otHrs < 0) {
                    newErrors.push({ rowNumber: displayRow, employeeCode: rawCode, date: formattedDate, issue: "Hours cannot be negative" });
                    continue;
                }
                if ((normHrs + otHrs) > 24) {
                    newErrors.push({ rowNumber: displayRow, employeeCode: rawCode, date: formattedDate, issue: "Total hours exceed 24 in a single day" });
                    continue;
                }
                if (overtimePolicy === "trim" && (normHrs + otHrs) > 8) { normHrs = 8; otHrs = 0; }
                if (overtimePolicy === "flag" && (normHrs + otHrs) > 8) {
                    newErrors.push({ rowNumber: displayRow, employeeCode: rawCode, date: formattedDate, issue: `Overtime Flagged: Worked ${normHrs + otHrs} hours (Strict 8h policy)` });
                    continue;
                }

                newValid.push({
                    company_id: companyId,
                    employee_id: empId,
                    date: formattedDate,
                    normal_hours: normHrs,
                    overtime_hours: otHrs,
                    notes: mapping.notes ? String(row[mapping.notes]).trim() || null : null,
                    status: "Approved",
                });
            }

            // 6. Unknown employees — collect timesheet rows into PendingNewEmployee
            const newPending: PendingNewEmployee[] = [];
            for (const [, { rawCode, rows }] of unknownGroups.entries()) {
                const tsRows: PendingNewEmployee["timesheetRows"] = [];

                for (const { row, rowIndex } of rows) {
                    const displayRow = rowIndex + 2;
                    const dateVal = row[mapping.date];
                    const formattedDate = parseTimesheetDate(dateVal);

                    if (!formattedDate || formattedDate.length !== 10) {
                        // Bad date even for a new employee — record as error
                        newErrors.push({
                            rowNumber: displayRow, employeeCode: rawCode,
                            date: String(dateVal), issue: "Unrecognizable date (row held for new employee)",
                        });
                        continue;
                    }

                    let normHrs = mapping.normal_hours ? parseNumberRobust(row[mapping.normal_hours], 8) : 8;
                    let otHrs   = mapping.overtime_hours ? parseNumberRobust(row[mapping.overtime_hours], 0) : 0;
                    if (normHrs < 0 || otHrs < 0 || (normHrs + otHrs) > 24) continue; // silently skip bad hours
                    if (overtimePolicy === "trim" && (normHrs + otHrs) > 8) { normHrs = 8; otHrs = 0; }
                    // "flag" policy: still collect the row — the new employee hasn't been confirmed yet

                    tsRows.push({
                        date: formattedDate,
                        normal_hours: normHrs,
                        overtime_hours: otHrs,
                        notes: mapping.notes ? String(row[mapping.notes]).trim() || null : null,
                    });
                }

                const nameFromFile = (mapping.name && rows.length > 0)
                    ? String(rows[0].row[mapping.name] ?? "").trim()
                    : "";
                const sourceMonth = tsRows.length > 0
                    ? tsRows[0].date.substring(0, 7)
                    : format(new Date(), "yyyy-MM");

                newPending.push({
                    employeeCode: rawCode,
                    name: nameFromFile,
                    employmentType: "permanent",
                    workerType: "employee",
                    empStatus: "active",
                    selected: true,
                    timesheetRows: tsRows,
                    sourceMonth,
                });
            }

            setValidRecords(newValid);
            setValidationErrors(newErrors);
            setPendingNewEmployees(newPending);

            // ── Late-mark detection (unchanged from original) ─────────────────
            if (mapping.clock_in) {
                const batchEmpIds = [...new Set(newValid.map((r: any) => r.employee_id))];
                const { data: empShifts } = await (supabase as any)
                    .from("employees")
                    .select("id, emp_code, name, shift_policy_id, shift_policies(shift_start, late_mark_grace_minutes, max_late_marks_per_month)")
                    .in("id", batchEmpIds);

                if (empShifts && empShifts.length > 0) {
                    const lateCountMap: Record<string, number> = {};
                    for (const row of parsedData) {
                        const rawEmpCode = String(row[mapping.emp_code] || "").trim().replace(/\s+/g, "").replace(/\./g, "").toUpperCase();
                        const emp = empShifts.find((e: any) => String(e.emp_code).toUpperCase() === rawEmpCode);
                        if (!emp || !emp.shift_policies || !row[mapping.clock_in]) continue;
                        const [hrs, mins] = String(row[mapping.clock_in]).trim().split(":").map(Number);
                        if (isNaN(hrs) || isNaN(mins)) continue;
                        const [shiftHrs, shiftMins] = emp.shift_policies.shift_start.split(":").map(Number);
                        const grace = emp.shift_policies.late_mark_grace_minutes || 15;
                        if ((hrs * 60 + mins) > (shiftHrs * 60 + shiftMins + grace)) {
                            lateCountMap[emp.id] = (lateCountMap[emp.id] || 0) + 1;
                        }
                    }
                    const report = empShifts
                        .filter((e: any) => lateCountMap[e.id] > 0)
                        .map((e: any) => ({
                            empCode: e.emp_code, name: e.name,
                            lateCount: lateCountMap[e.id] || 0,
                            threshold: e.shift_policies?.max_late_marks_per_month || 3,
                            willDeduct: (lateCountMap[e.id] || 0) > (e.shift_policies?.max_late_marks_per_month || 3),
                        }));
                    if (report.length > 0) { setLateMarkReport(report); setShowLateMarkReport(true); }
                }
            }

            setShowMapper(false);
            setShowValidation(true);
        } catch (error: any) {
            toast({ title: "Validation Error", description: getSafeErrorMessage(error), variant: "destructive" });
        } finally {
            setUploading(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Final ingest — known employees only; banner fires if pending exist
    // ─────────────────────────────────────────────────────────────────────────
    const handleFinalIngest = async () => {
        const hasPending = pendingNewEmployees.length > 0;

        // Edge-case: nothing to ingest at all
        if (validRecords.length === 0 && !hasPending) {
            toast({ title: "Nothing to insert", description: "No valid records were found to ingest.", variant: "destructive" });
            setShowValidation(false);
            return;
        }

        // Edge-case: only new (unknown) employees — skip DB write, go straight to review banner
        if (validRecords.length === 0 && hasPending) {
            setShowValidation(false);
            setShowNewEmpBanner(true);
            return;
        }

        setUploading(true);
        try {
            const BATCH_SIZE = 500;
            let successCount = 0;
            for (let i = 0; i < validRecords.length; i += BATCH_SIZE) {
                const chunk = validRecords.slice(i, i + BATCH_SIZE);
                const { error } = await supabase.from("timesheets").insert(chunk);
                if (error) throw error;
                successCount += chunk.length;
            }

            const pendingTsCount = pendingNewEmployees.reduce((s, e) => s + e.timesheetRows.length, 0);
            toast({
                title: "Upload Successful",
                description: hasPending
                    ? `Ingested ${successCount} timesheet rows. ${pendingNewEmployees.length} new employee code${pendingNewEmployees.length !== 1 ? "s" : ""} (${pendingTsCount} rows) need review.`
                    : `Successfully ingested ${successCount} timesheet records.`,
            });

            setShowValidation(false);
            if (hasPending) setShowNewEmpBanner(true);
            fetchData();
        } catch (error: any) {
            toast({ title: "Ingestion Failed", description: getSafeErrorMessage(error), variant: "destructive" });
        } finally {
            setUploading(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Create new employees + backfill their timesheet rows
    // ─────────────────────────────────────────────────────────────────────────
    const handleCreateNewEmployees = async () => {
        const selected = pendingNewEmployees.filter(e => e.selected);
        if (selected.length === 0) {
            toast({ title: "No employees selected", description: "Select at least one row to create.", variant: "destructive" });
            return;
        }

        const missingNames = selected.filter(e => !e.name.trim());
        if (missingNames.length > 0) {
            const sample = missingNames.slice(0, 3).map(e => e.employeeCode).join(", ");
            const extra  = missingNames.length > 3 ? ` and ${missingNames.length - 3} more` : "";
            toast({ title: "Name required", description: `Fill in the name for: ${sample}${extra}`, variant: "destructive" });
            return;
        }

        setCreatingNewEmps(true);
        try {
            // 1. Insert employees (minimal fields; payroll details can be filled later)
            const empRows = selected.map(e => ({
                company_id: companyId,
                emp_code: e.employeeCode,
                name: e.name.trim(),
                employment_type: e.employmentType,
                worker_type: e.workerType,
                status: e.empStatus === "active" ? "active" : "inactive",
                basic: 0,
                hra: 0,
                allowances: 0,
                da: 0,
                retaining_allowance: 0,
                gross: 0,
                epf_applicable: ["employee", "fixed_term"].includes(e.workerType),
                esic_applicable: false,
                pt_applicable: ["employee", "fixed_term"].includes(e.workerType),
                ec_act_applicable: true,
                wc_risk_category: "office_workers",
                risk_rate: 0.5,
            }));

            const { data: newEmps, error: empError } = await supabase
                .from("employees")
                .insert(empRows)
                .select("id, emp_code");
            if (empError) throw empError;

            // 2. Code → new ID map
            const newEmpMap = new Map(
                (newEmps ?? []).map(e => [
                    String(e.emp_code).toUpperCase().trim().replace(/\s+/g, ""),
                    e.id,
                ])
            );

            // 3. Build timesheet rows for every selected employee
            const tsRows: any[] = [];
            let skippedRows = 0;
            for (const emp of selected) {
                const cleanCode = emp.employeeCode.toUpperCase().trim().replace(/\s+/g, "");
                const empId = newEmpMap.get(cleanCode);
                if (!empId) { skippedRows += emp.timesheetRows.length; continue; }
                for (const ts of emp.timesheetRows) {
                    tsRows.push({
                        company_id: companyId,
                        employee_id: empId,
                        date: ts.date,
                        normal_hours: ts.normal_hours,
                        overtime_hours: ts.overtime_hours,
                        notes: ts.notes,
                        status: "Approved",
                    });
                }
            }

            // 4. Insert timesheets in batches
            const BATCH_SIZE = 500;
            let tsCount = 0;
            for (let i = 0; i < tsRows.length; i += BATCH_SIZE) {
                const chunk = tsRows.slice(i, i + BATCH_SIZE);
                const { error } = await supabase.from("timesheets").insert(chunk);
                if (error) throw error;
                tsCount += chunk.length;
            }

            // 5. Remove created employees from the pending list
            const createdCodes = new Set(
                selected.map(e => e.employeeCode.toUpperCase().trim().replace(/\s+/g, ""))
            );
            const remaining = pendingNewEmployees.filter(
                e => !createdCodes.has(e.employeeCode.toUpperCase().trim().replace(/\s+/g, ""))
            );
            setPendingNewEmployees(remaining);
            setShowNewEmpDialog(false);
            if (remaining.length === 0) setShowNewEmpBanner(false);

            toast({
                title: "Employees created",
                description:
                    `Created ${selected.length} employee${selected.length !== 1 ? "s" : ""}, ` +
                    `attached ${tsCount} timesheet row${tsCount !== 1 ? "s" : ""}.` +
                    (skippedRows > 0 ? ` ${skippedRows} rows skipped (ID mismatch).` : ""),
            });
            fetchData();
        } catch (error: any) {
            toast({ title: "Creation failed", description: getSafeErrorMessage(error), variant: "destructive" });
        } finally {
            setCreatingNewEmps(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Existing record handlers (unchanged)
    // ─────────────────────────────────────────────────────────────────────────
    const handleUpdateStatus = async (id: string, status: string) => {
        const { error } = await supabase.from("timesheets").update({ status }).eq("id", id);
        if (!error) setTimesheets(timesheets.map(t => t.id === id ? { ...t, status: status as any } : t));
    };

    const handleDelete = async (id: string) => {
        const { error } = await supabase.from("timesheets").delete().eq("id", id);
        if (!error) setTimesheets(timesheets.filter(t => t.id !== id));
    };

    const handleRunComplianceCheck = async () => {
        if (!companyId) return;
        setRunningCompliance(true);
        try {
            const now = new Date();
            const { error } = await supabase.functions.invoke("compute-violations", {
                body: { companyId, month: now.getMonth() + 1, year: now.getFullYear() },
            });
            if (error) throw error;
            toast({ title: "Compliance check complete", description: "Violations updated. View results in OSH/SE Compliance dashboards." });
        } catch (e: any) {
            toast({ title: "Compliance check failed", description: e.message, variant: "destructive" });
        } finally {
            setRunningCompliance(false);
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

    // ─────────────────────────────────────────────────────────────────────────
    // Bulk-action helpers for the new-employees dialog
    // ─────────────────────────────────────────────────────────────────────────
    const applyBulkEmpType = (type: string) => {
        if (!type) return;
        setPendingNewEmployees(prev => prev.map(e => e.selected ? { ...e, employmentType: type as any } : e));
        setBulkEmpType("");
    };
    const applyBulkStatus = (status: string) => {
        if (!status) return;
        setPendingNewEmployees(prev => prev.map(e => e.selected ? { ...e, empStatus: status as any } : e));
        setBulkEmpStatus("");
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">

            {/* ── Page header + toolbar ─────────────────────────────────────── */}
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
                    <Button variant="outline" onClick={handleRunComplianceCheck} disabled={runningCompliance}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${runningCompliance ? "animate-spin" : ""}`} />
                        {runningCompliance ? "Checking…" : "Run Compliance Check"}
                    </Button>
                    <Button variant="outline" onClick={downloadTemplate}>
                        <Download className="mr-2 h-4 w-4" /> Download Template
                    </Button>
                    <input type="file" accept=".csv,.xlsx,.xls" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                    <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                        {uploading
                            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                        Upload Sheet
                    </Button>
                </div>
            </div>

            {/* ── NEW: New-employees banner ─────────────────────────────────── */}
            {showNewEmpBanner && pendingNewEmployees.length > 0 && (
                <Card className="border-blue-200 bg-blue-50/40">
                    <CardContent className="flex items-center justify-between px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100">
                                <UserPlus className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="font-semibold text-blue-900">
                                    {pendingNewEmployees.length} new employee{pendingNewEmployees.length !== 1 ? "s" : ""} detected in this file
                                </p>
                                <p className="text-xs text-blue-700 mt-0.5">
                                    {pendingNewEmployees.reduce((s, e) => s + e.timesheetRows.length, 0)} timesheet rows are waiting to be attached once you add them to your master.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <Button
                                variant="outline"
                                size="sm"
                                className="border-blue-300 text-blue-700 hover:bg-blue-100"
                                onClick={() => setShowNewEmpBanner(false)}
                            >
                                Dismiss
                            </Button>
                            <Button
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={() => setShowNewEmpDialog(true)}
                            >
                                Review new employees →
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Late-mark report card ─────────────────────────────────────── */}
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
                                                : <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">✓ No Deduction</Badge>}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* ── Timesheets tabs: All + ESS Pending Approvals ─────────────── */}
            <Tabs defaultValue="all">
                <TabsList>
                    <TabsTrigger value="all">All Timesheets</TabsTrigger>
                    <TabsTrigger value="ess-pending" className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        Pending Approvals
                        {essPendingGroups.length > 0 && (
                            <span className="ml-1 rounded-full bg-amber-500 text-white text-xs px-1.5 py-0.5">
                                {essPendingGroups.length}
                            </span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="regularization" className="flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        Regularization
                        {regPending.length > 0 && (
                            <span className="ml-1 rounded-full bg-amber-500 text-white text-xs px-1.5 py-0.5">
                                {regPending.length}
                            </span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="comp-off" className="flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" />
                        Comp-Off
                        {compOffPending.length > 0 && (
                            <span className="ml-1 rounded-full bg-amber-500 text-white text-xs px-1.5 py-0.5">
                                {compOffPending.length}
                            </span>
                        )}
                    </TabsTrigger>
                </TabsList>

                {/* ESS Pending Approvals tab */}
                <TabsContent value="ess-pending">
                    {essPendingLoading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : essPendingGroups.length === 0 ? (
                        <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
                            No ESS timesheet submissions pending approval.
                        </div>
                    ) : (
                        <div className="space-y-4 mt-4">
                            {essPendingGroups.map((group) => {
                                const groupKey = `${group.employeeId}__${group.weekLabel}`;
                                const isActioning = essActioning === groupKey;
                                const totalNormal = group.rows.reduce((s, r) => s + r.normal_hours, 0);
                                const totalOT = group.rows.reduce((s, r) => s + r.overtime_hours, 0);
                                return (
                                    <Card key={groupKey} className="border-amber-100">
                                        <CardHeader className="pb-3">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <CardTitle className="text-base">
                                                        {group.employeeName}
                                                        <span className="ml-2 text-sm font-normal text-muted-foreground">({group.empCode})</span>
                                                    </CardTitle>
                                                    <CardDescription>
                                                        Week: {group.weekLabel} · {totalNormal}h normal + {totalOT}h OT
                                                    </CardDescription>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Textarea
                                                        placeholder="Optional comment..."
                                                        value={essRejectComment[groupKey] ?? ""}
                                                        onChange={(e) => setEssRejectComment(prev => ({ ...prev, [groupKey]: e.target.value }))}
                                                        className="h-9 min-h-0 w-48 resize-none text-xs py-1.5"
                                                        rows={1}
                                                    />
                                                    <Button
                                                        size="sm"
                                                        className="bg-green-600 hover:bg-green-700 text-white"
                                                        disabled={isActioning}
                                                        onClick={() => handleESSBulkAction(group, "Approved")}
                                                    >
                                                        {isActioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                                        <span className="ml-1">Approve</span>
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        disabled={isActioning}
                                                        onClick={() => handleESSBulkAction(group, "Rejected")}
                                                    >
                                                        {isActioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                                                        <span className="ml-1">Reject</span>
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Date</TableHead>
                                                        <TableHead className="text-right">Normal Hrs</TableHead>
                                                        <TableHead className="text-right">OT Hrs</TableHead>
                                                        <TableHead>Notes</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {group.rows.map((r) => (
                                                        <TableRow key={r.id}>
                                                            <TableCell>{format(new Date(r.date), "EEE, d MMM")}</TableCell>
                                                            <TableCell className="text-right">{r.normal_hours}</TableCell>
                                                            <TableCell className="text-right">{r.overtime_hours}</TableCell>
                                                            <TableCell className="text-muted-foreground text-sm">{r.notes || "—"}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>

                {/* Regularization Pending tab */}
                <TabsContent value="regularization">
                    {regLoading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : regPending.length === 0 ? (
                        <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
                            No regularization requests pending approval.
                        </div>
                    ) : (
                        <div className="mt-4 space-y-3">
                            {regPending.map((row) => {
                                const emp = row.employees as any;
                                return (
                                    <Card key={row.id} className="border-amber-100">
                                        <CardHeader className="pb-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <CardTitle className="text-base">
                                                        {emp?.name ?? "Unknown"}
                                                        <span className="ml-2 text-sm font-normal text-muted-foreground">({emp?.emp_code})</span>
                                                    </CardTitle>
                                                    <CardDescription>
                                                        {format(new Date(row.request_date), "dd MMM yyyy")} · {row.original_status ?? "Absent"} → {row.requested_status}
                                                    </CardDescription>
                                                    <p className="mt-1 text-xs text-muted-foreground">{row.reason}</p>
                                                </div>
                                                <div className="flex shrink-0 items-center gap-2">
                                                    <Textarea
                                                        placeholder="Comment..."
                                                        value={regComments[row.id] ?? ""}
                                                        onChange={(e) => setRegComments((p) => ({ ...p, [row.id]: e.target.value }))}
                                                        className="h-9 min-h-0 w-40 resize-none py-1.5 text-xs"
                                                        rows={1}
                                                    />
                                                    <Button
                                                        size="sm"
                                                        className="bg-green-600 text-white hover:bg-green-700"
                                                        disabled={regActioning === row.id}
                                                        onClick={() => handleRegAction(row.id, "approved")}
                                                    >
                                                        {regActioning === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                                        <span className="ml-1">Approve</span>
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        disabled={regActioning === row.id}
                                                        onClick={() => handleRegAction(row.id, "rejected")}
                                                    >
                                                        {regActioning === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                                                        <span className="ml-1">Reject</span>
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardHeader>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>

                {/* Comp-Off Pending tab */}
                <TabsContent value="comp-off">
                    {compOffLoading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : compOffPending.length === 0 ? (
                        <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
                            No comp-off requests pending approval.
                        </div>
                    ) : (
                        <div className="mt-4 space-y-3">
                            {compOffPending.map((row) => {
                                const emp = row.employees as any;
                                return (
                                    <Card key={row.id} className="border-amber-100">
                                        <CardHeader className="pb-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <CardTitle className="text-base">
                                                        {emp?.name ?? "Unknown"}
                                                        <span className="ml-2 text-sm font-normal text-muted-foreground">({emp?.emp_code})</span>
                                                    </CardTitle>
                                                    <CardDescription>
                                                        Worked: {format(new Date(row.worked_date), "dd MMM yyyy")}
                                                        {row.avail_date && ` · Avail: ${format(new Date(row.avail_date), "dd MMM yyyy")}`}
                                                    </CardDescription>
                                                    <p className="mt-1 text-xs text-muted-foreground">{row.reason}</p>
                                                </div>
                                                <div className="flex shrink-0 items-center gap-2">
                                                    <Textarea
                                                        placeholder="Comment..."
                                                        value={compOffComments[row.id] ?? ""}
                                                        onChange={(e) => setCompOffComments((p) => ({ ...p, [row.id]: e.target.value }))}
                                                        className="h-9 min-h-0 w-40 resize-none py-1.5 text-xs"
                                                        rows={1}
                                                    />
                                                    <Button
                                                        size="sm"
                                                        className="bg-green-600 text-white hover:bg-green-700"
                                                        disabled={compOffActioning === row.id}
                                                        onClick={() => handleCompOffAction(row.id, "approved")}
                                                    >
                                                        {compOffActioning === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                                        <span className="ml-1">Approve</span>
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        disabled={compOffActioning === row.id}
                                                        onClick={() => handleCompOffAction(row.id, "rejected")}
                                                    >
                                                        {compOffActioning === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                                                        <span className="ml-1">Reject</span>
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardHeader>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>

                {/* All Timesheets tab */}
                <TabsContent value="all">
                <Card>
                <CardHeader>
                    <CardTitle>Recent Timesheets</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
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
                                        <TableCell className="text-right">
                                            {t.normal_hours}
                                            {t.oshWarnings && t.oshWarnings.length > 0 && (
                                                <div className="text-[10px] text-destructive mt-0.5 leading-tight text-right flex justify-end">
                                                    <AlertCircle className="h-3 w-3 mr-1 shrink-0" />{t.oshWarnings[0]}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">{t.overtime_hours}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant={t.status === "Approved" ? "default" : t.status === "Rejected" ? "destructive" : "secondary"}>
                                                {t.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                {t.status === "Pending" && (
                                                    <>
                                                        <Button size="sm" variant="ghost" className="text-green-600" onClick={() => handleUpdateStatus(t.id, "Approved")}>
                                                            <CheckCircle className="h-4 w-4" />
                                                        </Button>
                                                        <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleUpdateStatus(t.id, "Rejected")}>
                                                            <AlertCircle className="h-4 w-4" />
                                                        </Button>
                                                    </>
                                                )}
                                                <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => handleDelete(t.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                            No timesheets found. Upload a sheet to get started.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
                </TabsContent>
            </Tabs>

            {/* ── DIALOG 1: Column mapper ───────────────────────────────────── */}
            <Dialog open={showMapper} onOpenChange={setShowMapper}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Map Columns</DialogTitle>
                        <DialogDescription>
                            Match your spreadsheet's columns to the system's required fields.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        {([
                            { id: "emp_code",       label: "Employee Code *",            key: "emp_code" },
                            { id: "date",           label: "Date *",                     key: "date" },
                            { id: "normal_hours",   label: "Normal Hours (default 8)",   key: "normal_hours" },
                            { id: "overtime_hours", label: "Overtime Hours (default 0)", key: "overtime_hours" },
                            { id: "name",           label: "Employee Name (optional)",   key: "name" },
                            { id: "notes",          label: "Notes",                      key: "notes" },
                        ] as const).map((field) => (
                            <div key={field.id} className="grid grid-cols-2 items-center gap-4">
                                <Label className="text-right">{field.label}</Label>
                                <Select
                                    value={(mapping as any)[field.key]}
                                    onValueChange={(val) => setMapping({ ...mapping, [field.key]: val === "NONE" ? "" : val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select column…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NONE">— Ignore —</SelectItem>
                                        {fileHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowMapper(false)} disabled={uploading}>Cancel</Button>
                        <Button onClick={runValidation} disabled={uploading}>
                            {uploading
                                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                : <ChevronRight className="mr-2 h-4 w-4" />}
                            Proceed to Validation
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── DIALOG 2: Validation report ──────────────────────────────── */}
            <Dialog open={showValidation} onOpenChange={setShowValidation}>
                <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Validation Report</DialogTitle>
                        <DialogDescription>Review the data before final ingestion.</DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
                        {/* Summary cards */}
                        <div className="flex gap-3">
                            <Card className="flex-1 bg-green-50/50 border-green-200">
                                <CardHeader className="py-3">
                                    <CardTitle className="text-green-700 text-base flex items-center gap-2">
                                        <CheckCircle className="h-4 w-4" /> Valid Records
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-3xl font-bold text-green-700">{validRecords.length}</p>
                                    <p className="text-xs text-green-600">Ready to ingest</p>
                                </CardContent>
                            </Card>
                            {pendingNewEmployees.length > 0 && (
                                <Card className="flex-1 bg-blue-50/50 border-blue-200">
                                    <CardHeader className="py-3">
                                        <CardTitle className="text-blue-700 text-base flex items-center gap-2">
                                            <UserPlus className="h-4 w-4" /> New Employees
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-3xl font-bold text-blue-700">{pendingNewEmployees.length}</p>
                                        <p className="text-xs text-blue-600">
                                            {pendingNewEmployees.reduce((s, e) => s + e.timesheetRows.length, 0)} rows held for review
                                        </p>
                                    </CardContent>
                                </Card>
                            )}
                            <Card className="flex-1 bg-red-50/50 border-red-200">
                                <CardHeader className="py-3">
                                    <CardTitle className="text-red-700 text-base flex items-center gap-2">
                                        <XCircle className="h-4 w-4" /> Failed Rows
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-3xl font-bold text-red-700">{validationErrors.length}</p>
                                    <p className="text-xs text-red-600">Will be skipped</p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Error list */}
                        {validationErrors.length > 0 && (
                            <div className="flex-1 min-h-[200px] border rounded-md">
                                <ScrollArea className="h-[200px]">
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
                        {validationErrors.length === 0 && validRecords.length > 0 && pendingNewEmployees.length === 0 && (
                            <div className="p-8 text-center text-muted-foreground border rounded-md border-dashed">
                                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-3 opacity-50" />
                                <p>All data looks perfect! No errors found.</p>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="mt-auto pt-4 border-t">
                        <Button variant="outline" onClick={() => setShowValidation(false)} disabled={uploading}>Cancel</Button>
                        <Button
                            onClick={handleFinalIngest}
                            disabled={(validRecords.length === 0 && pendingNewEmployees.length === 0) || uploading}
                            className="bg-green-600 hover:bg-green-700 text-white"
                        >
                            {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {validRecords.length > 0
                                ? `Ingest ${validRecords.length} Record${validRecords.length !== 1 ? "s" : ""}`
                                : "Continue"}
                            {pendingNewEmployees.length > 0 &&
                                ` + Review ${pendingNewEmployees.length} New`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── DIALOG 3: Bulk new-employee review ───────────────────────── */}
            <Dialog open={showNewEmpDialog} onOpenChange={setShowNewEmpDialog}>
                <DialogContent className="max-w-5xl p-0 gap-0 overflow-hidden">
                    <DialogHeader className="px-6 pt-5 pb-4 border-b">
                        <DialogTitle className="flex items-center gap-2 text-lg">
                            <UserPlus className="h-5 w-5 text-blue-600" />
                            New Employees from Timesheet
                        </DialogTitle>
                        <DialogDescription>
                            {pendingNewEmployees.length} employee code{pendingNewEmployees.length !== 1 ? "s" : ""} from the uploaded
                            file {pendingNewEmployees.length !== 1 ? "are" : "is"} not in your master.
                            Edit details below, then create them with their timesheet data attached.
                        </DialogDescription>
                    </DialogHeader>

                    {/* > 100 warning */}
                    {pendingNewEmployees.length > 100 && (
                        <div className="mx-6 mt-4 flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-yellow-600" />
                            <span>
                                Unusual number of new employees detected ({pendingNewEmployees.length}).
                                Please double-check you uploaded the correct file.
                            </span>
                        </div>
                    )}

                    {/* Bulk-action bar */}
                    <div className="flex flex-wrap items-center gap-3 border-b bg-muted/20 px-6 py-2.5">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="select-all-new"
                                checked={allNewEmpsSelected}
                                onCheckedChange={(checked) =>
                                    setPendingNewEmployees(prev => prev.map(e => ({ ...e, selected: !!checked })))
                                }
                            />
                            <label htmlFor="select-all-new" className="text-sm text-muted-foreground cursor-pointer select-none">
                                Select all ({pendingNewEmployees.length})
                            </label>
                        </div>
                        <div className="h-4 w-px bg-border" />
                        <span className="text-xs text-muted-foreground">Bulk set for selected:</span>
                        <Select value={bulkEmpType} onValueChange={applyBulkEmpType}>
                            <SelectTrigger className="h-8 w-44 text-xs">
                                <SelectValue placeholder="Employment type…" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="permanent">Permanent</SelectItem>
                                <SelectItem value="fixed_term">Fixed Term</SelectItem>
                                <SelectItem value="contract">Contractor</SelectItem>
                                <SelectItem value="trainee">Trainee</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={bulkEmpStatus} onValueChange={applyBulkStatus}>
                            <SelectTrigger className="h-8 w-44 text-xs">
                                <SelectValue placeholder="Status…" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="pending_onboarding">Pending Onboarding</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="ml-auto text-xs text-muted-foreground">
                            {selectedNewEmpCount} selected · {selectedTsRowCount} timesheet rows
                        </div>
                    </div>

                    {/* Scrollable table */}
                    <ScrollArea className="h-[44vh]">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                                <TableRow>
                                    <TableHead className="w-10 px-4"></TableHead>
                                    <TableHead className="w-32">Emp Code</TableHead>
                                    <TableHead className="min-w-[190px]">Name *</TableHead>
                                    <TableHead className="w-40">Employment Type</TableHead>
                                    <TableHead className="w-44">Worker Type</TableHead>
                                    <TableHead className="w-44">Status</TableHead>
                                    <TableHead className="text-right w-24 pr-4">TS Rows</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pendingNewEmployees.map((emp, idx) => (
                                    <TableRow
                                        key={emp.employeeCode}
                                        className={emp.selected ? "" : "opacity-40"}
                                    >
                                        <TableCell className="px-4">
                                            <Checkbox
                                                checked={emp.selected}
                                                onCheckedChange={(checked) =>
                                                    setPendingNewEmployees(prev =>
                                                        prev.map((e, i) => i === idx ? { ...e, selected: !!checked } : e)
                                                    )
                                                }
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                                                {emp.employeeCode}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                className="h-8 text-sm"
                                                placeholder="Full name…"
                                                value={emp.name}
                                                disabled={!emp.selected}
                                                onChange={(e) =>
                                                    setPendingNewEmployees(prev =>
                                                        prev.map((pe, i) => i === idx ? { ...pe, name: e.target.value } : pe)
                                                    )
                                                }
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={emp.employmentType}
                                                disabled={!emp.selected}
                                                onValueChange={(v) =>
                                                    setPendingNewEmployees(prev =>
                                                        prev.map((pe, i) => i === idx ? { ...pe, employmentType: v as any } : pe)
                                                    )
                                                }
                                            >
                                                <SelectTrigger className="h-8 text-sm">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="permanent">Permanent</SelectItem>
                                                    <SelectItem value="fixed_term">Fixed Term</SelectItem>
                                                    <SelectItem value="contract">Contractor</SelectItem>
                                                    <SelectItem value="trainee">Trainee</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={emp.workerType}
                                                disabled={!emp.selected}
                                                onValueChange={(v) =>
                                                    setPendingNewEmployees(prev =>
                                                        prev.map((pe, i) => i === idx ? { ...pe, workerType: v as any } : pe)
                                                    )
                                                }
                                            >
                                                <SelectTrigger className="h-8 text-sm">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="employee">Regular Employee</SelectItem>
                                                    <SelectItem value="fixed_term">Fixed Term</SelectItem>
                                                    <SelectItem value="contract">Contractor</SelectItem>
                                                    <SelectItem value="gig">Gig Worker</SelectItem>
                                                    <SelectItem value="platform">Platform Worker</SelectItem>
                                                    <SelectItem value="unorganised">Unorganised</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={emp.empStatus}
                                                disabled={!emp.selected}
                                                onValueChange={(v) =>
                                                    setPendingNewEmployees(prev =>
                                                        prev.map((pe, i) => i === idx ? { ...pe, empStatus: v as any } : pe)
                                                    )
                                                }
                                            >
                                                <SelectTrigger className="h-8 text-sm">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="active">Active</SelectItem>
                                                    <SelectItem value="pending_onboarding">Pending Onboarding</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell className="text-right pr-4">
                                            <Badge variant="secondary" className="font-mono tabular-nums">
                                                {emp.timesheetRows.length}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>

                    <DialogFooter className="flex items-center justify-between px-6 py-4 border-t bg-muted/10">
                        <p className="text-xs text-muted-foreground">
                            Wage details (basic, EPF, etc.) can be filled in from the Employees page after creation.
                        </p>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setShowNewEmpDialog(false)}
                                disabled={creatingNewEmps}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleCreateNewEmployees}
                                disabled={creatingNewEmps || selectedNewEmpCount === 0}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                {creatingNewEmps && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create {selectedNewEmpCount} employee{selectedNewEmpCount !== 1 ? "s" : ""}
                                {selectedTsRowCount > 0 && ` · attach ${selectedTsRowCount} rows`}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
