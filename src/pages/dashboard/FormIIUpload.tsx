import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type ImportMode = "all" | "attendance" | "wages";

interface ParsedEmployee {
  empCode?: string;
  name: string;
  designation?: string;
  dateOfJoining?: string;
  normalWages: number;
  hraPayable: number;
  grossWages: number;
  deductions: {
    advances: number;
    fines: number;
    damages: number;
    total: number;
  };
  netWagesPaid: number;
  attendance: {
    daysWorked: number;
    dailyMarks: string[];
  };
  errors?: string[];
}

interface ColumnMapping {
  empCode?: number;
  name?: number;
  designation?: number;
  dateOfJoining?: number;
  attendanceStart?: number;
  attendanceEnd?: number;
  totalDaysWorked?: number;
  normalWages?: number;
  hraPayable?: number;
  grossWages?: number;
  advances?: number;
  fines?: number;
  damages?: number;
  netWages?: number;
}

interface MappingProfile {
  name: string;
  mapping: Partial<ColumnMapping>;
  timestamp: number;
}

const FIELD_LABELS: Record<string, string> = {
  empCode: "Employee Code / Sl No",
  name: "Name",
  designation: "Designation",
  dateOfJoining: "Date of Joining",
  totalDaysWorked: "Total Days Worked",
  normalWages: "Normal Wages",
  hraPayable: "HRA Payable",
  grossWages: "Gross Wages",
  advances: "Advances",
  fines: "Fines",
  damages: "Damages",
  netWages: "Net Wages",
};

const COLUMN_PATTERNS: Record<string, string[]> = {
  empCode: ["sl no", "serial", "emp code", "employee code", "emp. code", "employee no", "emp id"],
  name: ["name", "employee name", "emp name", "full name", "worker name"],
  designation: ["designation", "nature of work", "position", "role"],
  dateOfJoining: ["date of joining", "doj", "date of entry", "joining date"],
  totalDaysWorked: ["total days", "days worked", "total", "present days"],
  normalWages: ["normal wages", "basic wages", "basic pay", "basic salary", "wages"],
  hraPayable: ["hra payable", "hra", "house rent", "hra amount"],
  grossWages: ["gross wages", "gross pay", "gross salary", "total earnings", "gross"],
  advances: ["advances", "advance", "advance taken"],
  fines: ["fines", "fine", "penalty"],
  damages: ["damages", "damage", "loss"],
  netWages: ["net wages", "net pay", "net salary", "take home", "net amount"],
};

const FormIIUploadPage = () => {
  const { toast } = useToast();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [dbEmployees, setDbEmployees] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<any[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsedData, setParsedData] = useState<ParsedEmployee[]>([]);
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [workingDays, setWorkingDays] = useState(26);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showMapper, setShowMapper] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>("all");
  const [dataStartRow, setDataStartRow] = useState(0);
  const [headerRow, setHeaderRow] = useState(0);
  const [columnMapping, setColumnMapping] = useState<Partial<ColumnMapping>>({});
  const [savedProfiles, setSavedProfiles] = useState<MappingProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState("");
  const [newProfileName, setNewProfileName] = useState("");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("formIIMappingProfiles");
    if (saved) setSavedProfiles(JSON.parse(saved));

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: company } = await supabase
        .from("companies")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (company) {
        setCompanyId(company.id);
        const { data: emps } = await supabase
          .from("employees")
          .select("id, emp_code, name")
          .eq("company_id", company.id);
        if (emps) setDbEmployees(emps);
      }
    };
    init();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      loadFileData(uploadedFile);
    }
  };

  const detectRows = (data: any[][]): [number, number] => {
    // Scan up to row 15 for header keywords (handles Whirlpool format with headers at row 6+)
    for (let i = 0; i < Math.min(data.length, 15); i++) {
      const row = data[i];
      if (row && row.length > 5) {
        const rowText = row.slice(0, 10).map((cell: any) =>
          String(cell || "").toLowerCase()
        ).join(" ");

        const keywords = ["name", "emp", "code", "wages", "gross", "days", "designation", "sl no"];
        if (keywords.some(kw => rowText.includes(kw))) {
          return [i, i + 1];
        }
      }
    }
    // Fallback: assume row 1 header, row 2 data (or row 0/1 for tiny files)
    return data?.length > 5 ? [1, 2] : [0, 1];
  };

  const autoDetectColumns = (hdrs: string[]): Partial<ColumnMapping> => {
    const mapping: Partial<ColumnMapping> = {};
    hdrs.forEach((header, index) => {
      const h = header.toLowerCase();
      for (const [key, patterns] of Object.entries(COLUMN_PATTERNS)) {
        if (patterns.some((p) => h.includes(p))) {
          if ((mapping as any)[key] === undefined) (mapping as any)[key] = index;
        }
      }
    });
    return mapping;
  };

  const calculateMappingConfidence = (mapping: Partial<ColumnMapping>): number => {
    const important: (keyof ColumnMapping)[] = ["name", "totalDaysWorked", "grossWages", "netWages"];
    const matched = important.filter((f) => mapping[f] !== undefined).length;
    return (matched / important.length) * 100;
  };

  const parseWithMapping = (data: any[][], startRow: number, mapping: Partial<ColumnMapping>) => {
    const results: ParsedEmployee[] = [];

    for (let i = startRow; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      const name = mapping.name !== undefined ? String(row[mapping.name]).trim() : "";
      if (!name) continue;

      const empCode = mapping.empCode !== undefined ? String(row[mapping.empCode]).trim() : undefined;
      const designation = mapping.designation !== undefined ? String(row[mapping.designation]).trim() : undefined;
      const dateOfJoining = mapping.dateOfJoining !== undefined ? String(row[mapping.dateOfJoining]).trim() : undefined;

      const normalWages = mapping.normalWages !== undefined ? Number(row[mapping.normalWages] || 0) : 0;
      const hraPayable = mapping.hraPayable !== undefined ? Number(row[mapping.hraPayable] || 0) : 0;
      const grossWages = mapping.grossWages !== undefined ? Number(row[mapping.grossWages] || 0) : 0;
      const advances = mapping.advances !== undefined ? Number(row[mapping.advances] || 0) : 0;
      const fines = mapping.fines !== undefined ? Number(row[mapping.fines] || 0) : 0;
      const damages = mapping.damages !== undefined ? Number(row[mapping.damages] || 0) : 0;
      const netWages = mapping.netWages !== undefined ? Number(row[mapping.netWages] || 0) : 0;

      let daysWorked = 0;
      if (mapping.totalDaysWorked !== undefined) {
        daysWorked = Number(row[mapping.totalDaysWorked] || 0);
      } else if (mapping.attendanceStart !== undefined && mapping.attendanceEnd !== undefined) {
        for (let c = mapping.attendanceStart; c <= mapping.attendanceEnd; c++) {
          const mark = String(row[c] || "").trim().toUpperCase();
          if (mark === "P" || mark === "W" || mark === "PD") daysWorked++;
        }
      }

      const errors: string[] = [];
      if (!grossWages && !netWages) errors.push("Missing gross and net wages");
      if (!daysWorked) errors.push("Missing days worked");

      results.push({
        empCode,
        name,
        designation,
        dateOfJoining,
        normalWages,
        hraPayable,
        grossWages,
        deductions: { advances, fines, damages, total: advances + fines + damages },
        netWagesPaid: netWages,
        attendance: { daysWorked, dailyMarks: [] },
        errors: errors.length ? errors : undefined,
      });
    }

    setParsedData(results);
    setIsProcessing(false);
    setShowPreview(true);
    setShowMapper(false);
  };

  const loadFileData = async (file: File) => {
    setIsProcessing(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];

      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: "",
        blankrows: false,
        raw: false,
      }) as any[][];

      console.log("Rows:", jsonData.length);
      setRawData(jsonData);

      const [headerRowIndex, dataStartRowIndex] = detectRows(jsonData);
      console.log("Headers row:", headerRowIndex, "Data row:", dataStartRowIndex);

      setHeaderRow(headerRowIndex);
      setDataStartRow(dataStartRowIndex);

      const headerRowData = jsonData[headerRowIndex] || [];
      const detectedHeaders = headerRowData.map((h: any, idx: number) => {
        const header = String(h || "").trim();
        return header || `Col ${idx + 1}`;
      });

      console.log("Headers:", detectedHeaders.slice(0, 10));
      setHeaders(detectedHeaders);

      const autoMapping = autoDetectColumns(detectedHeaders);
      setColumnMapping(autoMapping);

      toast({
        title: "✅ Loaded",
        description: `${jsonData.length - dataStartRowIndex} rows, ${detectedHeaders.length} cols`,
      });

      setShowMapper(true);
    } catch (error: any) {
      console.error(error);
      toast({
        title: "❌ Excel error",
        description: "Use .xlsx. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const applyMapping = () => {
    if (!rawData.length) return;
    parseWithMapping(rawData, dataStartRow, columnMapping);
  };

  const saveMappingProfile = () => {
    if (!newProfileName.trim()) {
      toast({ title: "Name required", description: "Enter a profile name.", variant: "destructive" });
      return;
    }
    const newProfile: MappingProfile = { name: newProfileName.trim(), mapping: columnMapping, timestamp: Date.now() };
    const updated = [...savedProfiles, newProfile];
    setSavedProfiles(updated);
    localStorage.setItem("formIIMappingProfiles", JSON.stringify(updated));
    toast({ title: "Profile saved", description: `Profile "${newProfileName}" saved.` });
    setNewProfileName("");
  };

  const loadProfile = (profileName: string) => {
    const profile = savedProfiles.find((p) => p.name === profileName);
    if (profile) {
      setColumnMapping(profile.mapping);
      setSelectedProfile(profileName);
    }
  };

  const deleteProfile = (profileName: string) => {
    if (!confirm(`Delete profile "${profileName}"?`)) return;
    const updated = savedProfiles.filter((p) => p.name !== profileName);
    setSavedProfiles(updated);
    localStorage.setItem("formIIMappingProfiles", JSON.stringify(updated));
    if (selectedProfile === profileName) setSelectedProfile("");
  };

  const matchEmployee = (parsed: ParsedEmployee) => {
    // Match by emp_code first, then by name (case-insensitive)
    if (parsed.empCode) {
      const byCode = dbEmployees.find(
        (e) => e.emp_code.toLowerCase() === parsed.empCode!.toLowerCase()
      );
      if (byCode) return byCode;
    }
    return dbEmployees.find(
      (e) => e.name.toLowerCase() === parsed.name.toLowerCase()
    ) || null;
  };

  const handleImport = async () => {
    if (!companyId) {
      toast({ title: "Setup required", description: "Please set up your company first.", variant: "destructive" });
      return;
    }
    const validEmployees = parsedData.filter((e) => !e.errors || e.errors.length === 0);
    if (!validEmployees.length) {
      toast({ title: "No valid rows", description: "Fix errors before import.", variant: "destructive" });
      return;
    }

    setImporting(true);
    try {
      // STEP 1: Create/update employees from Form II data
      const employeeMap = new Map<string, string>();

      for (const emp of validEmployees) {
        const empCode = emp.empCode || `IMP${Date.now()}`;
        const empData = {
          company_id: companyId,
          emp_code: empCode,
          name: emp.name,
          basic: emp.normalWages || 0,
          hra: emp.hraPayable || 0,
          allowances: Math.max(0, (emp.grossWages || 0) - (emp.normalWages || 0) - (emp.hraPayable || 0)),
          gross: emp.grossWages || 0,
          date_of_joining: emp.dateOfJoining || format(new Date(), "yyyy-MM-dd"),
          status: "Active",
          epf_applicable: (emp.normalWages || 0) > 0,
          esic_applicable: (emp.grossWages || 0) <= 21000,
          pt_applicable: true,
        };

        // Try to find existing employee by emp_code
        const { data: existing } = await supabase
          .from("employees")
          .select("id")
          .eq("company_id", companyId)
          .eq("emp_code", empCode)
          .maybeSingle();

        let employeeId: string;
        if (existing) {
          // Update existing employee wages
          await supabase.from("employees").update({
            basic: empData.basic, hra: empData.hra, allowances: empData.allowances, gross: empData.gross,
          }).eq("id", existing.id);
          employeeId = existing.id;
        } else {
          const { data: created, error } = await supabase
            .from("employees")
            .insert(empData)
            .select("id")
            .single();
          if (error) {
            console.error("Employee create error:", emp.name, error);
            continue;
          }
          employeeId = created.id;
        }
        employeeMap.set(emp.name, employeeId);
      }

      // STEP 2: Find or create payroll run
      let payrollRunId: string;
      const { data: existingRun } = await supabase
        .from("payroll_runs")
        .select("id")
        .eq("company_id", companyId)
        .eq("month", month)
        .maybeSingle();

      if (existingRun) {
        payrollRunId = existingRun.id;
        await supabase.from("payroll_runs").update({
          working_days: workingDays, status: "imported", processed_at: new Date().toISOString(),
        }).eq("id", payrollRunId);
      } else {
        const { data: newRun, error: runError } = await supabase
          .from("payroll_runs")
          .insert({ company_id: companyId, month, working_days: workingDays, status: "imported", processed_at: new Date().toISOString() })
          .select("id")
          .single();
        if (runError) throw runError;
        payrollRunId = newRun.id;
      }

      // STEP 3: Create attendance records
      const attendanceRecords = validEmployees
        .filter((emp) => employeeMap.has(emp.name))
        .map((emp) => ({
          company_id: companyId,
          employee_id: employeeMap.get(emp.name)!,
          payroll_run_id: payrollRunId,
          month,
          working_days: workingDays,
          days_present: Math.round(emp.attendance?.daysWorked ?? workingDays),
          paid_leaves: 0,
          unpaid_leaves: Math.max(0, workingDays - Math.round(emp.attendance?.daysWorked ?? workingDays)),
          overtime_hours: 0,
          daily_marks: emp.attendance?.dailyMarks?.length > 0 ? emp.attendance.dailyMarks : null,
        }));

      await supabase.from("attendance").delete().eq("payroll_run_id", payrollRunId);
      if (attendanceRecords.length > 0) {
        const { error: attError } = await supabase.from("attendance").insert(attendanceRecords);
        if (attError) throw attError;
      }

      // STEP 4: Auto-process payroll using Form II wages
      const payrollDetails = validEmployees
        .filter((emp) => employeeMap.has(emp.name))
        .map((emp) => {
          const employeeId = employeeMap.get(emp.name)!;
          const daysWorked = Math.round(emp.attendance?.daysWorked ?? workingDays);
          const basicPaid = emp.normalWages || 0;
          const hraPaid = emp.hraPayable || 0;
          const grossEarnings = emp.grossWages || 0;

          const epfEmployee = basicPaid > 0 ? Math.round(Math.min(basicPaid, 15000) * 0.12) : 0;
          const epfEmployer = basicPaid > 0 ? Math.round(Math.min(basicPaid, 15000) * 0.0367) : 0;
          const epsEmployer = basicPaid > 0 ? Math.round(Math.min(basicPaid, 15000) * 0.0833) : 0;
          const esicEmployee = grossEarnings <= 21000 ? Math.round(grossEarnings * 0.0075) : 0;
          const esicEmployer = grossEarnings <= 21000 ? Math.round(grossEarnings * 0.0325) : 0;

          const isFebruary = month.endsWith("-02");
          const pt = grossEarnings > 15000 ? (isFebruary ? 300 : 200) : grossEarnings > 10000 ? 175 : 0;

          const totalDeductions = epfEmployee + esicEmployee + pt + (emp.deductions?.total || 0);
          const netPay = grossEarnings - totalDeductions;

          return {
            payroll_run_id: payrollRunId,
            employee_id: employeeId,
            days_present: daysWorked,
            basic_paid: basicPaid,
            hra_paid: hraPaid,
            allowances_paid: Math.max(0, grossEarnings - basicPaid - hraPaid),
            gross_earnings: grossEarnings,
            epf_employee: epfEmployee,
            epf_employer: epfEmployer,
            eps_employer: epsEmployer,
            esic_employee: esicEmployee,
            esic_employer: esicEmployer,
            pt,
            lwf_employee: 0,
            lwf_employer: 0,
            tds: 0,
            total_deductions: totalDeductions,
            net_pay: netPay,
          };
        });

      await supabase.from("payroll_details").delete().eq("payroll_run_id", payrollRunId);
      if (payrollDetails.length > 0) {
        const { error: payError } = await supabase.from("payroll_details").insert(payrollDetails);
        if (payError) throw payError;
      }

      toast({
        title: "🎉 Complete Import Success!",
        description: `${employeeMap.size} employees synced, attendance + payroll processed for ${month}.`,
      });

      window.location.href = "/dashboard/payroll";
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const validCount = parsedData.filter((e) => !e.errors || e.errors.length === 0).length;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Form II Upload</h1>
      <p className="mt-1 text-muted-foreground">Upload your Form II Excel and map columns for attendance and wages.</p>

      {/* Upload Card */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Upload File</CardTitle>
          <CardDescription>Supported format: Excel Form II (monthly)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
          />

          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label>Month</Label>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Working Days</Label>
              <Input
                type="number"
                value={workingDays}
                onChange={(e) => setWorkingDays(parseInt(e.target.value) || 26)}
                min={1}
                max={31}
                className="w-24"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Import Mode</Label>
            <div className="flex gap-2">
              {(["all", "attendance", "wages"] as ImportMode[]).map((mode) => (
                <Button
                  key={mode}
                  variant={importMode === mode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setImportMode(mode)}
                >
                  {mode === "all" ? "All" : mode === "attendance" ? "Attendance Only" : "Wages Only"}
                </Button>
              ))}
            </div>
          </div>

          {isProcessing && <p className="text-sm text-muted-foreground">Processing file...</p>}
        </CardContent>
      </Card>

      {/* Column Mapper */}
      {showMapper && headers.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Column Mapper</CardTitle>
            <CardDescription>Map Excel columns to Form II fields. Auto-detected mapping is pre-filled.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(FIELD_LABELS).map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={(columnMapping as any)[key] !== undefined ? String((columnMapping as any)[key]) : ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setColumnMapping((prev) => ({
                        ...prev,
                        [key]: val === "" ? undefined : Number(val),
                      }));
                    }}
                  >
                    <option value="">-- Not Mapped --</option>
                    {headers.map((h, idx) => (
                      <option key={idx} value={idx}>
                        {idx + 1}. {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Mapping Profiles */}
            <div className="space-y-2 border-t pt-4">
              <p className="text-sm font-medium">Mapping Profiles</p>
              {savedProfiles.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs">Load Saved Profile</Label>
                  <div className="flex flex-wrap gap-2">
                    {savedProfiles.map((profile) => (
                      <div key={profile.name} className="flex items-center gap-1">
                        <Button variant="outline" size="sm" onClick={() => loadProfile(profile.name)}>
                          {profile.name}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteProfile(profile.name)}>
                          ✕
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-end gap-2">
                <Input
                  placeholder="Profile name"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  className="w-56"
                />
                <Button variant="secondary" size="sm" onClick={saveMappingProfile}>
                  Save Profile
                </Button>
              </div>
            </div>

            <div>
              <Button onClick={applyMapping}>Apply Mapping &amp; Preview</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview & Import */}
      {showPreview && parsedData.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Preview Parsed Data</CardTitle>
            <CardDescription>{parsedData.length} rows parsed. Errors are highlighted.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Status</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Days</TableHead>
                    <TableHead className="text-right">Normal Wages</TableHead>
                    <TableHead className="text-right">HRA</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right">Net Pay</TableHead>
                    <TableHead>Errors</TableHead>
                    <TableHead>Employee Match</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((emp, index) => {
                    const hasErrors = emp.errors && emp.errors.length > 0;
                    return (
                      <TableRow key={index} className={hasErrors ? "bg-destructive/10" : ""}>
                        <TableCell>{hasErrors ? "⚠️" : "✓"}</TableCell>
                        <TableCell className="font-medium">{emp.name}</TableCell>
                        <TableCell className="text-right">{emp.attendance.daysWorked}</TableCell>
                        <TableCell className="text-right">₹{emp.normalWages.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right">₹{emp.hraPayable.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right">₹{emp.grossWages.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right">₹{emp.deductions.total.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right">₹{emp.netWagesPaid.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-xs text-destructive">{emp.errors?.join(", ")}</TableCell>
                        <TableCell className="text-xs">{matchEmployee(emp) ? "✓ Found" : "⚠ New"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="mt-6 flex gap-3">
              <Button onClick={handleImport} disabled={validCount === 0 || importing}>
                {importing ? "Importing..." : `Import ${validCount} Valid Employees`}
              </Button>
              <Button variant="outline" onClick={() => setShowPreview(false)}>
                Cancel
              </Button>
              <Button variant="secondary" onClick={() => window.location.href = "/dashboard/payroll"}>
                View Payroll
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FormIIUploadPage;
