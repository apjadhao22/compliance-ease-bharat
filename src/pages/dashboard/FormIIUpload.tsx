import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useToast } from "@/hooks/use-toast";

type ImportMode = "all" | "attendance" | "wages";

interface ParsedEmployee {
  empCode?: string;
  name: string;
  designation?: string;
  dateOfJoining?: string | null;
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

const FIELD_LABELS: Record<keyof ColumnMapping, string> = {
  empCode: "Employee Code / Sl No",
  name: "Name",
  designation: "Designation",
  dateOfJoining: "Date of Joining",
  attendanceStart: "Attendance Start Col",
  attendanceEnd: "Attendance End Col",
  totalDaysWorked: "Total Days Worked",
  normalWages: "Normal Wages",
  hraPayable: "HRA Payable",
  grossWages: "Gross Wages",
  advances: "Advances",
  fines: "Fines",
  damages: "Damages",
  netWages: "Net Wages",
};

const COLUMN_PATTERNS: Record<keyof ColumnMapping, string[]> = {
  empCode: [
    "sl no",
    "serial",
    "emp code",
    "employee code",
    "emp. code",
    "employee no",
    "emp id",
    "s.no",
  ],
  name: [
    "full name",
    "employee name",
    "emp name",
    "name of the employee",
    "worker name",
    "name",
  ],
  designation: ["designation", "nature of work", "position", "role"],
  dateOfJoining: [
    "date of joining",
    "date of entry",
    "doj",
    "joining date",
    "entry into service",
  ],
  attendanceStart: [], // auto-detected numerically
  attendanceEnd: [], // auto-detected numerically
  totalDaysWorked: ["total days", "days worked", "present days", "total"],
  normalWages: ["normal wages", "basic wages", "basic pay", "basic salary", "wages"],
  hraPayable: ["hra payable", "hra", "house rent", "hra amount"],
  grossWages: ["gross wages", "gross pay", "gross salary", "total earnings", "gross"],
  advances: ["advances", "advance", "advance taken"],
  fines: ["fines", "fine", "penalty"],
  damages: ["damages", "damage", "loss"],
  netWages: ["net wages", "net pay", "net salary", "take home", "net amount"],
};

// ---------- SMART HELPERS ----------

// Robust numeric parsing with currency symbols, commas, blanks
const parseNum = (val: any): number => {
  if (val === null || val === undefined || val === "") return 0;
  const num =
    typeof val === "string"
      ? parseFloat(val.replace(/,/g, "").trim())
      : Number(val);
  return isNaN(num) ? 0 : Math.abs(num);
};

// Normalise Excel-style DOJ to YYYY-MM-DD and collect errors if unparseable
const normalizeDOJ = (raw: any, errorBucket: string[]): string | null => {
  if (!raw) return null;

  const cleaned = String(raw).trim().replace(/\.+$/, ""); // drop trailing dots

  // 23.05.2016 / 23/05/2016 / 23-05-2016
  const m = cleaned.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    const [, d, mth, y] = m;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${mth.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Any other parseable date (e.g. Excel already gave ISO)
  if (!isNaN(Date.parse(cleaned))) {
    return new Date(cleaned).toISOString().slice(0, 10);
  }

  errorBucket.push(
    `Invalid Date of Joining "${cleaned}". Use formats like 03.04.2017 or 03/04/2017.`
  );
  return null;
};

// Build a human readable import summary for toasts
const buildImportSummary = (args: {
  totalParsed: number;
  validCount: number;
  parseErrorCount: number;
  importedCount: number;
  dbFailed: { name: string; reason: string }[];
}) => {
  const { totalParsed, validCount, parseErrorCount, importedCount, dbFailed } =
    args;

  const parts: string[] = [];

  parts.push(
    `${totalParsed} rows parsed, ${validCount} valid, ${parseErrorCount} with data issues.`
  );
  parts.push(`${importedCount} employees imported into the database.`);

  if (dbFailed.length) {
    parts.push(
      `${dbFailed.length} employees could not be saved: ` +
        dbFailed.map((e) => `${e.name} (${e.reason})`).join("; ")
    );
  }

  return parts.join(" ");
};

// ---------- HEADER / ROW DETECTION & MAPPING ----------

// Scan up to 30 rows and find header + first data row
const detectRows = (data: any[]): [number, number] => {
  const keywords = [
    "name",
    "emp",
    "code",
    "wages",
    "gross",
    "days",
    "designation",
    "sl no",
    "s.no",
  ];

  for (let i = 0; i < Math.min(data.length, 30); i++) {
    const row = data[i];
    if (!row || row.length < 5) continue;

    const rowText = row
      .slice(0, 10)
      .map((cell: any) => String(cell || "").toLowerCase())
      .join(" ");

    if (keywords.some((kw) => rowText.includes(kw))) {
      const nextRow = data[i + 1];
      if (nextRow && nextRow.length >= 5) {
        const firstCell = String(nextRow[0] ?? "").trim();
        const secondCell = String(nextRow[1] ?? "").trim();

        if (firstCell.match(/^\d+$/) || secondCell.length > 2) {
          return [i, i + 1];
        }
      }
    }
  }

  return data?.length > 5 ? [1, 2] : [0, 1];
};

const autoDetectColumns = (
  hdrs: string[]
): Partial<ColumnMapping> => {
  const mapping: Partial<ColumnMapping> = {};

  // Detect numbered attendance columns 1-31
  let attendanceStart = -1;
  let attendanceEnd = -1;

  for (let i = 0; i < hdrs.length; i++) {
    const h = hdrs[i].trim();
    const num = parseInt(h, 10);

    if (!isNaN(num) && num >= 1 && num <= 31) {
      if (attendanceStart === -1 && num === 1) attendanceStart = i;
      if (num === 31) attendanceEnd = i;
    }
  }

  if (attendanceStart !== -1 && attendanceEnd !== -1) {
    mapping.attendanceStart = attendanceStart;
    mapping.attendanceEnd = attendanceEnd;
  }

  // Match other columns with specificity scoring
  hdrs.forEach((header, index) => {
    const h = header.toLowerCase().trim();

    (Object.entries(COLUMN_PATTERNS) as [keyof ColumnMapping, string[]][]).forEach(
      ([key, patterns]) => {
        if ((mapping as any)[key] !== undefined || patterns.length === 0) return;

        let bestScore = 0;
        let matched = false;

        for (const pattern of patterns) {
          if (h.includes(pattern)) {
            const score = pattern.length;
            if (score > bestScore) {
              bestScore = score;
              matched = true;
            }
          }
        }

        if (matched) {
          (mapping as any)[key] = index;
        }
      }
    );
  });

  return mapping;
};

const calculateMappingConfidence = (
  mapping: Partial<ColumnMapping>
): number => {
  const important: (keyof ColumnMapping)[] = [
    "name",
    "totalDaysWorked",
    "grossWages",
    "netWages",
  ];
  const matched = important.filter((f) => (mapping as any)[f] !== undefined)
    .length;
  return (matched / important.length) * 100;
};

// ---------- PARSER WITH SMART VALIDATION ----------

const parseWithMapping = (
  data: any[],
  startRow: number,
  mapping: Partial<ColumnMapping>,
  onDone: (rows: ParsedEmployee[]) => void,
  toast: ReturnType<typeof useToast>["toast"]
) => {
  const results: ParsedEmployee[] = [];
  let processedCount = 0;
  let skippedCount = 0;

  // Basic safety: make sure mapped indices exist
  const maxColIndex = Math.max(
    mapping.name ?? -1,
    mapping.grossWages ?? -1,
    mapping.totalDaysWorked ?? -1,
    mapping.attendanceEnd ?? -1,
    mapping.netWages ?? -1
  );
  const firstRowLength = data[startRow]?.length ?? 0;

  if (maxColIndex >= firstRowLength) {
    toast({
      title: "Invalid Column Mapping",
      description: `Mapped column index ${
        maxColIndex + 1
      } exceeds available columns (${firstRowLength}). Please remap headers in the Column Mapper.`,
      variant: "destructive",
    });
    return onDone([]);
  }

  console.log(
    "Starting parse at row",
    startRow + 1,
    "of",
    data.length,
    "rows"
  );

  for (let i = startRow; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    // ----- NAME & HEADER / FOOTER FILTERS -----
    const rawName =
      mapping.name !== undefined ? row[mapping.name] : undefined;
    const name = String(rawName ?? "").trim();

    // Skip blank / very short name rows
    if (!name || name.length < 2) {
      skippedCount++;
      continue;
    }

    // Detect header / footer rows and stop there
    const lower = name.toLowerCase();
    if (
      lower.includes("name of establishment") ||
      lower.includes("full name of the employee") ||
      lower.includes("muster roll") ||
      lower.includes("signature") ||
      lower.includes("total") ||
      lower.includes("manager") ||
      lower.includes("employer")
    ) {
      console.log(
        `Row ${i + 1}: Header/footer detected ("${name}"), stopping parse.`
      );
      break;
    }

    // ----- DOJ NORMALISATION -----
    const dojErrors: string[] = [];
    const rawDOJ =
      mapping.dateOfJoining !== undefined
        ? row[mapping.dateOfJoining]
        : undefined;
    const dateOfJoining = normalizeDOJ(rawDOJ, dojErrors);

    // ----- NUMERIC FIELDS -----
    const normalWages =
      mapping.normalWages !== undefined
        ? parseNum(row[mapping.normalWages])
        : 0;
    const hraPayable =
      mapping.hraPayable !== undefined
        ? parseNum(row[mapping.hraPayable])
        : 0;
    const grossWages =
      mapping.grossWages !== undefined
        ? parseNum(row[mapping.grossWages])
        : 0;
    const advances =
      mapping.advances !== undefined ? parseNum(row[mapping.advances]) : 0;
    const fines =
      mapping.fines !== undefined ? parseNum(row[mapping.fines]) : 0;
    const damages =
      mapping.damages !== undefined ? parseNum(row[mapping.damages]) : 0;
    const netWages =
      mapping.netWages !== undefined ? parseNum(row[mapping.netWages]) : 0;

    // ----- ATTENDANCE / DAYS WORKED -----
    let daysWorked = 0;
    const dailyMarks: string[] = [];

    if (mapping.totalDaysWorked !== undefined) {
      daysWorked = parseNum(row[mapping.totalDaysWorked]);
    } else if (
      mapping.attendanceStart !== undefined &&
      mapping.attendanceEnd !== undefined
    ) {
      for (
        let c = mapping.attendanceStart;
        c <= mapping.attendanceEnd;
        c++
      ) {
        const mark = String(row[c] ?? "").trim().toUpperCase();
        if (mark) dailyMarks.push(mark);
        if (
          mark === "P" ||
          mark === "W" ||
          mark === "PD" ||
          mark.startsWith("P")
        ) {
          daysWorked++;
        }
      }
    }

    // ----- VALIDATION & SMART ERRORS -----
    const errors: string[] = [];

    if (!grossWages || !netWages) {
      errors.push(
        "Missing Gross or Net Wages. Map 'Gross Wages Payable' and 'Net Wages Paid' correctly in Column Mapper."
      );
    }
    if (!daysWorked) {
      errors.push(
        "Missing days worked. Either map 'Total Days Worked' or attendance columns 1–31."
      );
    }
    if (grossWages < 0 || netWages < 0) {
      errors.push("Negative wages detected. Check Gross and Net Wage columns.");
    }

    const deductionsTotal = advances + fines + damages;
    if (netWages <= 0 && deductionsTotal > 0) {
      errors.push(
        "Deductions exceed net wages. Check Advances/Fines/Damages and Net Wages."
      );
    }

    if (!dateOfJoining) {
      errors.push(
        "Date of Joining missing or invalid. Correct DOJ so gratuity/bonus calculations remain accurate."
      );
    }

    if (dojErrors.length) errors.push(...dojErrors);

    // ----- BUILD RESULT ROW -----
    const empCode =
      mapping.empCode !== undefined
        ? String(row[mapping.empCode] ?? "").trim()
        : undefined;
    const designation =
      mapping.designation !== undefined
        ? String(row[mapping.designation] ?? "").trim()
        : undefined;

    const employee: ParsedEmployee = {
      empCode,
      name,
      designation,
      dateOfJoining: dateOfJoining || null,
      normalWages,
      hraPayable,
      grossWages,
      deductions: {
        advances,
        fines,
        damages,
        total: deductionsTotal,
      },
      netWagesPaid: netWages,
      attendance: {
        daysWorked,
        dailyMarks,
      },
      errors: errors.length ? errors : undefined,
    };

    results.push(employee);
    processedCount++;
  }

  console.log(
    "Parse complete:",
    processedCount,
    "employees,",
    skippedCount,
    "rows skipped"
  );

  onDone(results);
};

// ---------- COMPONENT ----------

const FormIIUploadPage: React.FC = () => {
  const { toast } = useToast();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [dbEmployees, setDbEmployees] = useState<any[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsedData, setParsedData] = useState<ParsedEmployee[]>([]);
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [workingDays, setWorkingDays] = useState<number>(26);

  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showMapper, setShowMapper] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>("all");

  const [dataStartRow, setDataStartRow] = useState(0);
  const [headerRow, setHeaderRow] = useState(0);
  const [columnMapping, setColumnMapping] = useState<Partial<ColumnMapping>>(
    {}
  );

  const [savedProfiles, setSavedProfiles] = useState<MappingProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [newProfileName, setNewProfileName] = useState("");
  const [importing, setImporting] = useState(false);

  // Load mapping profiles from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("formIIMappingProfiles");
      if (saved) {
        setSavedProfiles(JSON.parse(saved));
      }
    } catch (err) {
      console.warn("localStorage unavailable", err);
    }
  }, []);

  // Load company + employees
  useEffect(() => {
    const init = async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data: company } = await supabase
        .from("companies")
        .select("id")
        .eq("user_id", user.user.id)
        .maybeSingle();

      if (company) {
        setCompanyId(company.id);

        const { data: emps } = await supabase
          .from("employees")
          .select("id, emp_code, name, gender")
          .eq("company_id", company.id);

        if (emps) setDbEmployees(emps);
      }
    };

    init();
  }, []);

  // ---------- FILE LOAD ----------

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      loadFileData(uploadedFile);
    }
  };

  const loadFileData = async (file: File) => {
    setIsProcessing(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];

      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: "",
        blankrows: true,
        raw: false,
      });

      console.log("Total rows loaded:", jsonData.length);
      setRawData(jsonData);

      const [headerRowIndex, dataStartRowIndex] = detectRows(jsonData);
      console.log(
        "Detected - Header row:",
        headerRowIndex + 1,
        "Data starts:",
        dataStartRowIndex + 1
      );
      setHeaderRow(headerRowIndex);
      setDataStartRow(dataStartRowIndex);

      const headerRowData = jsonData[headerRowIndex] || [];
      const detectedHeaders = headerRowData.map((h: any, idx: number) =>
        String(h || "").trim() ? String(h || "").trim() : `Col ${idx + 1}`
      );
      console.log("Headers:", detectedHeaders.slice(0, 15));
      setHeaders(detectedHeaders);

      const autoMapping = autoDetectColumns(detectedHeaders);
      console.log("Auto-detected mapping:", autoMapping);
      setColumnMapping(autoMapping);

      const confidence = calculateMappingConfidence(autoMapping);
      toast({
        title: "File Loaded",
        description: `${
          jsonData.length - dataStartRowIndex
        } data rows, ${detectedHeaders.length} columns. Mapping confidence ${confidence.toFixed(
          0
        )}%.`,
      });

      setShowMapper(true);
      setShowPreview(false);
    } catch (error: any) {
      console.error("File load error", error);
      toast({
        title: "Excel Error",
        description: "Use a .xlsx Form II file. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // ---------- MAPPING PROFILES ----------

  const applyMapping = () => {
    if (!rawData.length) return;

    if (columnMapping.name === undefined) {
      toast({
        title: "Name Column Required",
        description: "Please map the employee name column.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    parseWithMapping(
      rawData,
      dataStartRow,
      columnMapping,
      (rows) => {
        setParsedData(rows);
        setIsProcessing(false);
        setShowPreview(true);
        setShowMapper(false);
      },
      toast
    );
  };

  const saveMappingProfile = () => {
    if (!newProfileName.trim()) {
      toast({
        title: "Name required",
        description: "Enter a profile name.",
        variant: "destructive",
      });
      return;
    }

    const newProfile: MappingProfile = {
      name: newProfileName.trim(),
      mapping: columnMapping,
      timestamp: Date.now(),
    };

    const updated = [...savedProfiles, newProfile];
    setSavedProfiles(updated);

    try {
      localStorage.setItem("formIIMappingProfiles", JSON.stringify(updated));
      toast({
        title: "Profile saved",
        description: `Profile "${newProfileName}" saved.`,
      });
    } catch (err) {
      toast({
        title: "Profile saved (session only)",
        description:
          "localStorage unavailable. Profile will not persist after refresh.",
        variant: "destructive",
      });
    }
    setNewProfileName("");
  };

  const loadProfile = (profileName: string) => {
    const profile = savedProfiles.find((p) => p.name === profileName);
    if (profile) {
      setColumnMapping(profile.mapping);
      setSelectedProfile(profileName);
      toast({
        title: "Profile loaded",
        description: `Loaded "${profileName}".`,
      });
    }
  };

  const deleteProfile = (profileName: string) => {
    if (!window.confirm(`Delete profile "${profileName}"?`)) return;

    const updated = savedProfiles.filter((p) => p.name !== profileName);
    setSavedProfiles(updated);

    try {
      localStorage.setItem("formIIMappingProfiles", JSON.stringify(updated));
    } catch (err) {
      console.warn("localStorage error", err);
    }

    if (selectedProfile === profileName) setSelectedProfile(null);
  };

  // ---------- IMPORT LOGIC ----------

  const handleImport = async () => {
    if (!companyId) {
      toast({
        title: "Setup required",
        description: "Please set up your company first.",
        variant: "destructive",
      });
      return;
    }

    if (!/^\d{4}-\d{2}$/.test(month)) {
      toast({
        title: "Invalid month",
        description: "Month must be in YYYY-MM format.",
        variant: "destructive",
      });
      return;
    }

    if (!parsedData.length) {
      toast({
        title: "No data to import",
        description: "Upload and preview a Form II file before importing.",
        variant: "destructive",
      });
      return;
    }

    const validEmployees = parsedData.filter(
      (e) => !e.errors || e.errors.length === 0
    );
    const errorEmployees = parsedData.filter(
      (e) => e.errors && e.errors.length > 0
    );

    if (!validEmployees.length) {
      toast({
        title: "All rows have issues",
        description:
          "Every row has validation errors. Fix the red rows in the preview and try again.",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);

    const dbFailedEmployees: { name: string; reason: string }[] = [];
    let importedCount = 0;

    try {
      const employeeMap = new Map<string, { id: string; gender: string }>();

      // STEP 1 – Create/update employees (wages/all modes)
      if (importMode === "all" || importMode === "wages") {
        for (const emp of validEmployees) {
          const empCode =
            emp.empCode ||
            `IMP-${Date.now().toString(36)}-${Math.random()
              .toString(36)
              .slice(2, 6)}`;

          const empData = {
            company_id: companyId,
            emp_code: empCode,
            name: emp.name,
            basic: emp.normalWages || 0,
            hra: emp.hraPayable || 0,
            allowances: Math.max(
              0,
              (emp.grossWages || 0) -
                (emp.normalWages || 0) -
                (emp.hraPayable || 0)
            ),
            gross: emp.grossWages || 0,
            date_of_joining: emp.dateOfJoining || null,
            status: "Active",
            epf_applicable: (emp.normalWages || 0) > 0,
            esic_applicable: (emp.grossWages || 0) <= 21000,
            pt_applicable: true,
          };

          const { data: employee, error } = await supabase
            .from("employees")
            .upsert(empData as any, {
              onConflict: "company_id,emp_code",
              ignoreDuplicates: false,
            })
            .select("id, gender")
            .single();

          if (error || !employee) {
            console.error("Employee upsert error:", emp.name, error);
            dbFailedEmployees.push({
              name: emp.name,
              reason: error?.message?.includes("date/time field value")
                ? "Supabase rejected DOJ. Check date format (use dd.mm.yyyy in Form II)."
                : error?.message || "Database validation error.",
            });
            continue;
          }

          employeeMap.set(emp.name, {
            id: (employee as any).id,
            gender: (employee as any).gender || "Male",
          });
        }
      } else {
        // Attendance-only: fetch existing employees
        for (const emp of validEmployees) {
          const { data: existing, error } = await supabase
            .from("employees")
            .select("id, gender")
            .eq("company_id", companyId)
            .or(
              `emp_code.eq.${emp.empCode || ""},name.ilike.${emp.name.replace(
                /"/g,
                '""'
              )}`
            )
            .maybeSingle();

          if (error || !existing) {
            dbFailedEmployees.push({
              name: emp.name,
              reason:
                "Employee not found in master. Run 'Wages' or 'All' import first.",
            });
            continue;
          }

          employeeMap.set(emp.name, {
            id: (existing as any).id,
            gender: (existing as any).gender || "Male",
          });
        }
      }

      importedCount = employeeMap.size;

      // STEP 2 – Find or create payroll run
      let payrollRunId: string;

      const { data: existingRun } = await supabase
        .from("payroll_runs")
        .select("id")
        .eq("company_id", companyId)
        .eq("month", month)
        .maybeSingle();

      if (existingRun) {
        payrollRunId = (existingRun as any).id;
        await supabase
          .from("payroll_runs")
          .update({
            working_days: workingDays,
            status: "imported",
            processed_at: new Date().toISOString(),
          })
          .eq("id", payrollRunId);
      } else {
        const { data: newRun, error: runError } = await supabase
          .from("payroll_runs")
          .insert({
            company_id: companyId,
            month,
            working_days: workingDays,
            status: "imported",
            processed_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (runError || !newRun) throw runError;
        payrollRunId = (newRun as any).id;
      }

      // STEP 3 – Attendance (attendance/all modes)
      if (importMode === "all" || importMode === "attendance") {
        const attendanceRecords = validEmployees
          .filter((emp) => employeeMap.has(emp.name))
          .map((emp) => {
            const { id } = employeeMap.get(emp.name)!;
            const daysWorked = Math.round(
              emp.attendance?.daysWorked ?? workingDays
            );
            return {
              company_id: companyId,
              employee_id: id,
              payroll_run_id: payrollRunId,
              month,
              working_days: workingDays,
              days_present: daysWorked,
              paid_leaves: 0,
              unpaid_leaves: Math.max(0, workingDays - daysWorked),
              overtime_hours: 0,
              daily_marks:
                emp.attendance?.dailyMarks?.length ?? 0
                  ? emp.attendance!.dailyMarks
                  : null,
            };
          });

        const { error: deleteError } = await supabase
          .from("attendance")
          .delete()
          .eq("payroll_run_id", payrollRunId);
        if (deleteError)
          console.warn("Attendance delete warning:", deleteError);

        if (attendanceRecords.length) {
          const { error: attError } = await supabase
            .from("attendance")
            .insert(attendanceRecords);
          if (attError) throw attError;
        }
      }

      // STEP 4 – Payroll (all mode only)
      if (importMode === "all") {
        const payrollDetails = validEmployees
          .filter((emp) => employeeMap.has(emp.name))
          .map((emp) => {
            const { id: employeeId, gender } = employeeMap.get(emp.name)!;
            const daysWorked = Math.round(
              emp.attendance?.daysWorked ?? workingDays
            );

            const basicFull = emp.normalWages || 0;
            const hraFull = emp.hraPayable || 0;
            const grossFull = emp.grossWages || 0;

            const proratedBasic = Math.round(
              (basicFull * daysWorked) / workingDays
            );
            const proratedGross = Math.round(
              (grossFull * daysWorked) / workingDays
            );

            const epfEmployee =
              proratedBasic > 0
                ? Math.round(Math.min(proratedBasic, 15000) * 0.12)
                : 0;
            const epfEmployer =
              proratedBasic > 0
                ? Math.round(Math.min(proratedBasic, 15000) * 0.0367)
                : 0;
            const epsEmployer =
              proratedBasic > 0
                ? Math.round(Math.min(proratedBasic, 15000) * 0.0833)
                : 0;

            const esicEmployee =
              proratedGross <= 21000 ? Math.round(proratedGross * 0.0075) : 0;
            const esicEmployer =
              proratedGross <= 21000 ? Math.round(proratedGross * 0.0325) : 0;

            const isFebruary = month.endsWith("-02");
            let pt = 0;
            const gLower = gender.toLowerCase();
            if (gLower === "female" || gLower === "f") {
              if (proratedGross >= 25000) pt = isFebruary ? 300 : 200;
            } else {
              if (proratedGross >= 15000) pt = isFebruary ? 300 : 200;
              else if (proratedGross >= 10000) pt = 175;
            }

            const manualDeductions = emp.deductions?.total || 0;
            const totalDeductions =
              epfEmployee + esicEmployee + pt + manualDeductions;
            const netPay = Math.max(0, proratedGross - totalDeductions);

            const hraPaid = Math.round((hraFull * daysWorked) / workingDays);

            return {
              payroll_run_id: payrollRunId,
              employee_id: employeeId,
              days_present: daysWorked,
              basic_paid: proratedBasic,
              hra_paid: hraPaid,
              allowances_paid: Math.max(
                0,
                proratedGross - proratedBasic - hraPaid
              ),
              gross_earnings: proratedGross,
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

        const { error: deletePayError } = await supabase
          .from("payroll_details")
          .delete()
          .eq("payroll_run_id", payrollRunId);
        if (deletePayError)
          console.warn("Payroll delete warning:", deletePayError);

        if (payrollDetails.length) {
          const { error: payError } = await supabase
            .from("payroll_details")
            .insert(payrollDetails);
          if (payError) throw payError;
        }
      }

      const summary = buildImportSummary({
        totalParsed: parsedData.length,
        validCount: validEmployees.length,
        parseErrorCount: errorEmployees.length,
        importedCount,
        dbFailed: dbFailedEmployees,
      });

      toast({
        title: "Import complete",
        description: summary,
        variant: dbFailedEmployees.length ? "destructive" : "default",
      });

      if (importedCount > 0) {
        window.location.href = "/dashboard/payroll";
      }
    } catch (err: any) {
      console.error("Import error", err);
      toast({
        title: "Import failed",
        description:
          err?.message || "Unknown error during import. Check console.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const validCount = parsedData.filter(
    (e) => !e.errors || e.errors.length === 0
  ).length;

  // ---------- RENDER ----------

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Form II Upload
        </h1>
        <p className="mt-1 text-muted-foreground">
          Upload your Form II Excel and map columns for attendance and wages.
        </p>
      </div>

      {/* Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle>Upload File</CardTitle>
          <CardDescription>
            Supported format: Excel Form II monthly muster roll cum wages
            register.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Excel File (.xlsx)</Label>
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="mt-1.5"
            />
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label>Month</Label>
              <Input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-48"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Working Days</Label>
              <Input
                type="number"
                value={workingDays}
                onChange={(e) =>
                  setWorkingDays(parseInt(e.target.value || "26", 10))
                }
                min={1}
                max={31}
                className="w-24"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Import Mode</Label>
              <div className="flex gap-2">
                {(["all", "attendance", "wages"] as ImportMode[]).map(
                  (mode) => (
                    <Button
                      key={mode}
                      variant={importMode === mode ? "default" : "outline"}
                      size="sm"
                      onClick={() => setImportMode(mode)}
                    >
                      {mode === "all"
                        ? "Complete (All)"
                        : mode === "attendance"
                        ? "Attendance Only"
                        : "Wages Only"}
                    </Button>
                  )
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {importMode === "all" &&
                  "Creates/updates employees, attendance, and payroll"}
                {importMode === "attendance" &&
                  "Updates attendance only for existing employees"}
                {importMode === "wages" &&
                  "Creates/updates employee master data with wages"}
              </p>
            </div>
          </div>

          {isProcessing && (
            <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-700">
              Processing file... Please wait.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Column Mapper */}
      {showMapper && headers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Column Mapper</CardTitle>
            <CardDescription>
              Map Excel columns to Form II fields. Auto-detected mapping is
              pre-filled.{" "}
              {columnMapping.attendanceStart !== undefined && (
                <span className="text-green-600">
                  Attendance columns auto-detected:{" "}
                  {(columnMapping.attendanceStart ?? 0) + 1} to{" "}
                  {(columnMapping.attendanceEnd ?? 0) + 1}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(FIELD_LABELS).map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={
                      (columnMapping as any)[key] !== undefined
                        ? String((columnMapping as any)[key])
                        : ""
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      setColumnMapping((prev) => ({
                        ...prev,
                        [key]:
                          val === "" ? undefined : Number(val),
                      }));
                    }}
                  >
                    <option value="">-- Not Mapped --</option>
                    {headers.map((h, idx) => (
                      <option key={idx} value={idx}>
                        {idx + 1}.{" "}
                        {h.length > 40 ? `${h.substring(0, 40)}…` : h}
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
                      <div
                        key={profile.name}
                        className="flex items-center gap-1"
                      >
                        <Button
                          variant={
                            selectedProfile === profile.name
                              ? "default"
                              : "outline"
                          }
                          size="sm"
                          onClick={() => loadProfile(profile.name)}
                        >
                          {profile.name}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                          onClick={() => deleteProfile(profile.name)}
                        >
                          ✕
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Profile name (e.g., Whirlpool Format)"
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && saveMappingProfile()
                    }
                  />
                </div>
                <Button variant="secondary" size="sm" onClick={saveMappingProfile}>
                  Save Profile
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={applyMapping} disabled={isProcessing}>
                Apply Mapping &amp; Preview
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowMapper(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Import */}
      {showPreview && parsedData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview Parsed Data</CardTitle>
            <CardDescription>
              {parsedData.length} rows parsed, {validCount} valid.{" "}
              {parsedData.length !== validCount && (
                <span className="text-destructive">
                  {parsedData.length - validCount} rows have errors.
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Status</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Days</TableHead>
                    <TableHead className="text-right">
                      Normal Wages
                    </TableHead>
                    <TableHead className="text-right">HRA</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">
                      Deductions
                    </TableHead>
                    <TableHead className="text-right">Net Pay</TableHead>
                    <TableHead>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((emp, index) => {
                    const hasErrors = !!(emp.errors && emp.errors.length);
                    return (
                      <TableRow
                        key={index}
                        className={hasErrors ? "bg-destructive/10" : ""}
                      >
                        <TableCell className="text-center">
                          {hasErrors ? "⚠" : "✓"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {emp.empCode || "-"}
                        </TableCell>
                        <TableCell className="font-medium">
                          {emp.name}
                        </TableCell>
                        <TableCell className="text-right">
                          {emp.attendance.daysWorked}
                        </TableCell>
                        <TableCell className="text-right">
                          {emp.normalWages.toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="text-right">
                          {emp.hraPayable.toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {emp.grossWages.toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          {emp.deductions.total
                            ? emp.deductions.total.toLocaleString("en-IN")
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {emp.netWagesPaid.toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="text-xs text-destructive">
                          {emp.errors?.join(", ")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                onClick={handleImport}
                disabled={validCount === 0 || importing}
                size="lg"
              >
                {importing
                  ? "Importing..."
                  : `Import ${validCount} Valid Employees (${importMode})`}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowPreview(false);
                  setShowMapper(true);
                }}
              >
                Back to Mapper
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  window.location.href = "/dashboard/payroll";
                }}
              >
                View Payroll
              </Button>
            </div>

            {validCount === 0 && parsedData.length > 0 && (
              <div className="mt-4 rounded-md bg-destructive/10 p-4 text-sm text-destructive">
                <strong>All rows have errors.</strong> Please check your
                column mapping and fix the errors before importing.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FormIIUploadPage;
