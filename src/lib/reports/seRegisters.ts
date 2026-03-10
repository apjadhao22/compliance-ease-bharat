import { format } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmployeeRow {
  id: string;
  emp_code?: string | null;
  name: string;
  designation?: string | null;
  department?: string | null;
  date_of_joining?: string | null;
  basic?: number | null;
}

export interface PayrollRow {
  employee_id: string;
  // ── Wage components ──────────────────────────────────────────────────────
  basic_paid?: number | null;
  da?: number | null;              // Dearness Allowance
  hra?: number | null;             // House Rent Allowance
  other_allowances?: number | null;
  ot_wages?: number | null;        // Overtime wages at 2× rate
  gross_earnings?: number | null;
  net_pay?: number | null;
  // ── Deductions ───────────────────────────────────────────────────────────
  epf_employee?: number | null;
  esic_employee?: number | null;
  pt?: number | null;
  lwf_employee?: number | null;
  advance_deduction?: number | null;
  other_deductions?: number | null;
  // ── Attendance ───────────────────────────────────────────────────────────
  days_in_month?: number | null;   // Total calendar working days
  days_worked?: number | null;     // Actual days present
  ot_hours?: number | null;        // Overtime hours worked
  weekly_offs?: number | null;
  paid_holidays?: number | null;
  leave_el?: number | null;        // Earned Leave taken
  leave_sl?: number | null;        // Sick Leave taken
  leave_cl?: number | null;        // Casual Leave taken
  // ── Payment ──────────────────────────────────────────────────────────────
  date_of_payment?: string | null;
  mode_of_payment?: string | null; // "Bank Transfer" | "Cash"
}

export interface LeaveRow {
  employee_id: string;
  leave_type: string;
  days_count: number;
}

export interface RegisterInput {
  employees: EmployeeRow[];
  payrollByEmp?: Record<string, PayrollRow>;
  leavesByEmp?: Record<string, LeaveRow[]>;
  month?: string;       // "YYYY-MM" for filename
  companyName?: string;
}

interface RegisterDefinition {
  formName: string;
  actName: string;
  actYear: string;
  citation: string;
  disclaimer: string;
  /** Returns [headers, ...rows] */
  buildRows: (input: RegisterInput) => string[][];
}

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function escapeCell(val: unknown): string {
  return `"${String(val ?? "").replace(/"/g, '""')}"`;
}

function toCSV(rows: string[][]): string {
  return rows.map(r => r.map(escapeCell).join(",")).join("\n");
}

function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try { return format(new Date(dateStr), "dd/MM/yyyy"); } catch { return "-"; }
}

function fmtMonth(monthStr: string | undefined): string {
  if (!monthStr) return format(new Date(), "MMM_yyyy");
  try { return format(new Date(`${monthStr}-01`), "MMM_yyyy"); } catch { return format(new Date(), "MMM_yyyy"); }
}

// ─── Register Definitions ─────────────────────────────────────────────────────

const SE_REGISTER_REGISTRY: Record<string, RegisterDefinition> = {

  // ── Maharashtra Form II — Combined Muster Roll-cum-Wage Register ──────────
  // Maharashtra Shops and Establishments (Regulation of Employment and
  // Conditions of Service) Act, 2017 | Rules 2018 | Rule 20(1) — Form II
  //
  // Official column groups (reproduced as flat CSV headers):
  //   A. Employee Identity (Sr No … Date of Employment)
  //   B. Attendance (Days in Month … Total Days for Wages)
  //   C. Wages (Rate … Gross Wages)
  //   D. Deductions (EPF … Total Deductions)
  //   E. Payment (Net Wages … Employee Signature)
  "Maharashtra:Form II": {
    formName: "Form II",
    actName: "Maharashtra Shops and Establishments (Regulation of Employment and Conditions of Service) Act, 2017",
    actYear: "2017",
    citation: "Rule 20(1) — Combined Muster Roll-cum-Wage Register",
    disclaimer: "[DISCLAIMER] This CSV is a compliance aid generated under Rule 20 of the Maharashtra S&E Rules, 2018. " +
      "Columns marked [MANUAL] must be completed and attested by the employer/manager before submission to the Inspector. " +
      "Attendance columns reflect system data; verify against physical attendance records.",
    buildRows: ({ employees, payrollByEmp = {}, month }) => {
      // Derive days in month from the month string (default 26 working days)
      let daysInMonth = 26;
      if (month) {
        try {
          const d = new Date(`${month}-01`);
          // Actual calendar days in month
          daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        } catch { /* use default */ }
      }

      const headers = [
        // ── A. Employee Identity ────────────────────────────────────────────
        "Sr. No.",
        "Employee Code",
        "Name of Employee",
        "[MANUAL] Father's / Husband's Name",
        "[MANUAL] Date of Birth",
        "Designation / Nature of Work",
        "Department",
        "Date of Employment",
        // ── B. Attendance ───────────────────────────────────────────────────
        "Days in Month",
        "Days Worked",
        "OT Hours Worked",
        "Weekly Off Days",
        "Paid Holidays / National Holidays",
        "Earned Leave (EL) Taken",
        "Sick Leave (SL) Taken",
        "Casual Leave (CL) Taken",
        "Total Days for which Wages Payable",
        // ── C. Wages ────────────────────────────────────────────────────────
        "Rate of Wages (Monthly ₹)",
        "Basic Wages (₹)",
        "Dearness Allowance / DA (₹)",
        "House Rent Allowance / HRA (₹)",
        "Other Allowances (₹)",
        "Overtime Wages (₹)",
        "Gross Wages (₹)",
        // ── D. Deductions ───────────────────────────────────────────────────
        "EPF — Employee Contribution (₹)",
        "ESIC — Employee Contribution (₹)",
        "Professional Tax / PT (₹)",
        "Labour Welfare Fund / LWF (₹)",
        "Advance / Loan Recovery (₹)",
        "Other Deductions (₹)",
        "Total Deductions (₹)",
        // ── E. Payment ──────────────────────────────────────────────────────
        "Net Wages Paid (₹)",
        "Date of Payment",
        "Mode of Payment",
        "[MANUAL] Employee Signature / Thumb Impression",
        "[MANUAL] Employer / Manager Signature",
      ];

      const rows = employees.map((emp, i) => {
        const p = payrollByEmp[emp.id] || {} as PayrollRow;

        const basic       = Number(p.basic_paid      ?? emp.basic ?? 0);
        const da          = Number(p.da              ?? 0);
        const hra         = Number(p.hra             ?? 0);
        const otherAllow  = Number(p.other_allowances ?? 0);
        const otWages     = Number(p.ot_wages         ?? 0);
        const gross       = Number(p.gross_earnings  ?? (basic + da + hra + otherAllow + otWages));

        const epf         = Number(p.epf_employee    ?? 0);
        const esic        = Number(p.esic_employee   ?? 0);
        const pt          = Number(p.pt              ?? 0);
        const lwf         = Number(p.lwf_employee    ?? 0);
        const advance     = Number(p.advance_deduction ?? 0);
        const otherDeds   = Number(p.other_deductions ?? 0);
        const totalDeds   = epf + esic + pt + lwf + advance + otherDeds;
        const net         = Number(p.net_pay         ?? (gross - totalDeds));

        const daysWorked    = Number(p.days_worked    ?? daysInMonth);
        const otHours       = Number(p.ot_hours       ?? 0);
        const weeklyOffs    = Number(p.weekly_offs    ?? Math.floor(daysInMonth / 7));
        const paidHolidays  = Number(p.paid_holidays  ?? 0);
        const el            = Number(p.leave_el       ?? 0);
        const sl            = Number(p.leave_sl       ?? 0);
        const cl            = Number(p.leave_cl       ?? 0);
        const totalDaysPaid = daysWorked + weeklyOffs + paidHolidays + el + sl + cl;

        const dateOfPayment = p.date_of_payment
          ? fmtDate(p.date_of_payment)
          : format(new Date(), "dd/MM/yyyy");
        const mode = p.mode_of_payment ?? "Bank Transfer";

        return [
          // A. Identity
          String(i + 1),
          emp.emp_code || "",
          emp.name,
          "[MANUAL]",
          "[MANUAL]",
          emp.designation || "Staff",
          emp.department  || "General",
          fmtDate(emp.date_of_joining),
          // B. Attendance
          String(daysInMonth),
          String(daysWorked),
          String(otHours),
          String(weeklyOffs),
          String(paidHolidays),
          String(el),
          String(sl),
          String(cl),
          String(totalDaysPaid),
          // C. Wages
          String(basic),   // Rate of Wages = Basic (monthly)
          String(basic),
          String(da),
          String(hra),
          String(otherAllow),
          String(otWages),
          String(gross),
          // D. Deductions
          String(epf),
          String(esic),
          String(pt),
          String(lwf),
          String(advance),
          String(otherDeds),
          String(totalDeds),
          // E. Payment
          String(net),
          dateOfPayment,
          mode,
          "[MANUAL]",
          "[MANUAL]",
        ];
      });

      return [headers, ...rows];
    },
  },

  // ── Maharashtra Form V — Leave Register (S&E Act 2017, Rule 26) ──────────
  "Maharashtra:Form V": {
    formName: "Form V",
    actName: "Maharashtra Shops and Establishments (Regulation of Employment and Conditions of Service) Act, 2017",
    actYear: "2017",
    citation: "Rule 26 read with Section 18",
    disclaimer: "[DISCLAIMER] Earned Leave entitlement computed at 1 day per 20 days worked (default). Adjust per actual attendance records.",
    buildRows: ({ employees, leavesByEmp = {} }) => {
      const headers = [
        "Sr No", "Name", "EL Entitlement", "EL Taken", "SL Taken", "CL Taken",
        "EL Balance", "Maternity Days", "[MANUAL] Remarks"
      ];
      const rows = employees.map((emp, i) => {
        const leaves = leavesByEmp[emp.id] || [];
        const el = leaves.filter(l => l.leave_type === "Earned").reduce((s, l) => s + Number(l.days_count), 0);
        const sl = leaves.filter(l => l.leave_type === "Sick").reduce((s, l) => s + Number(l.days_count), 0);
        const cl = leaves.filter(l => l.leave_type === "Casual").reduce((s, l) => s + Number(l.days_count), 0);
        const mat = leaves.filter(l => l.leave_type === "Maternity").reduce((s, l) => s + Number(l.days_count), 0);
        return [
          String(i + 1), emp.name, "15", String(el), String(sl), String(cl),
          String(Math.max(0, 15 - el)), String(mat), "[MANUAL]",
        ];
      });
      return [headers, ...rows];
    },
  },

  // ── Karnataka Form T — Combined Register (S&E Act 1961, Rule 24) ─────────
  "Karnataka:Form T": {
    formName: "Form T",
    actName: "Karnataka Shops and Commercial Establishments Act, 1961",
    actYear: "1961",
    citation: "Rule 24",
    disclaimer: "[DISCLAIMER] Verify deduction figures against actual payroll registers before filing.",
    buildRows: ({ employees, payrollByEmp = {} }) => {
      const headers = [
        "Token No", "Name", "Designation", "Date of Joining",
        "Gross Wages (₹)", "EPF EE (₹)", "ESIC EE (₹)", "PT (₹)",
        "LWF (₹)", "Net Pay (₹)", "[MANUAL] Signature"
      ];
      const rows = employees.map((emp, i) => {
        const p = payrollByEmp[emp.id] || {};
        return [
          emp.emp_code || String(i + 1),
          emp.name,
          emp.designation || "Staff",
          fmtDate(emp.date_of_joining),
          String(p.gross_earnings ?? emp.basic ?? 0),
          String(p.epf_employee ?? 0),
          String(p.esic_employee ?? 0),
          String(p.pt ?? 0),
          String(p.lwf_employee ?? 0),
          String(p.net_pay ?? 0),
          "[MANUAL]",
        ];
      });
      return [headers, ...rows];
    },
  },

  // ── Tamil Nadu Form XIV — Register of Wages (TN S&E Act 1947, Rule 22) ───
  "Tamil Nadu:Form XIV": {
    formName: "Form XIV",
    actName: "Tamil Nadu Shops and Establishments Act, 1947",
    actYear: "1947",
    citation: "Rule 22",
    disclaimer: "[DISCLAIMER] Father/Husband Name column is [MANUAL] — must be filled from HR records.",
    buildRows: ({ employees, payrollByEmp = {} }) => {
      const headers = [
        "Sl No", "Employee Name", "[MANUAL] Father/Husband Name", "Designation",
        "Date of Appointment", "Basic Pay (₹)", "Gross Wages (₹)",
        "Total Deductions (₹)", "Net Amount Paid (₹)", "Date of Payment", "[MANUAL] Signature"
      ];
      const rows = employees.map((emp, i) => {
        const p = payrollByEmp[emp.id] || {};
        const deds = (Number(p.epf_employee) || 0) + (Number(p.esic_employee) || 0) + (Number(p.pt) || 0);
        return [
          String(i + 1),
          emp.name,
          "[MANUAL]",
          emp.designation || "Staff",
          fmtDate(emp.date_of_joining),
          String(p.basic_paid ?? emp.basic ?? 0),
          String(p.gross_earnings ?? emp.basic ?? 0),
          String(deds),
          String(p.net_pay ?? 0),
          format(new Date(), "dd/MM/yyyy"),
          "[MANUAL]",
        ];
      });
      return [headers, ...rows];
    },
  },

  // ── Delhi Form G — Register of Employment (Delhi S&E Act 1954, Rule 22) ──
  "Delhi:Form G": {
    formName: "Form G",
    actName: "Delhi Shops and Establishments Act, 1954",
    actYear: "1954",
    citation: "Rule 22",
    disclaimer: "[DISCLAIMER] Date of leaving and remarks columns must be filled [MANUAL] from HR records.",
    buildRows: ({ employees, payrollByEmp = {} }) => {
      const headers = [
        "Sl No", "Name of Employee", "Emp Code", "Designation",
        "Date of Joining", "Monthly Wages (₹)", "[MANUAL] Date of Leaving", "[MANUAL] Remarks"
      ];
      const rows = employees.map((emp, i) => [
        String(i + 1),
        emp.name,
        emp.emp_code || "",
        emp.designation || "Staff",
        fmtDate(emp.date_of_joining),
        String(payrollByEmp[emp.id]?.gross_earnings ?? emp.basic ?? 0),
        "[MANUAL]",
        "[MANUAL]",
      ]);
      return [headers, ...rows];
    },
  },

  // ── Telangana Form A — Combined Register (TS S&E Act 1988, Rules) ─────────
  "Telangana:Form A": {
    formName: "Form A",
    actName: "Telangana Shops and Establishments Act, 1988",
    actYear: "1988",
    citation: "Section 3 read with TS S&E Rules",
    disclaimer: "[DISCLAIMER] Father/Husband Name and Remarks columns are [MANUAL] — must be filled from HR records before submission to the Inspector.",
    buildRows: ({ employees, payrollByEmp = {} }) => {
      const headers = [
        "S.No", "Name of Employee", "[MANUAL] Father/Husband Name",
        "Designation", "Date of Joining", "Department",
        "Gross Wages (₹)", "Total Deductions (₹)", "Net Pay (₹)",
        "[MANUAL] Attendance", "[MANUAL] Leave", "[MANUAL] Remarks"
      ];
      const rows = employees.map((emp, i) => {
        const p = payrollByEmp[emp.id] || {};
        const deds = (Number(p.epf_employee) || 0) + (Number(p.esic_employee) || 0) + (Number(p.pt) || 0);
        return [
          String(i + 1),
          emp.name,
          "[MANUAL]",
          emp.designation || "Staff",
          fmtDate(emp.date_of_joining),
          emp.department || "General",
          String(p.gross_earnings ?? emp.basic ?? 0),
          String(deds),
          String(p.net_pay ?? 0),
          "[MANUAL]",
          "[MANUAL]",
          "[MANUAL]",
        ];
      });
      return [headers, ...rows];
    },
  },

};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a state S&E statutory register as a CSV string.
 * @param state   State name (e.g. "Maharashtra", "Telangana")
 * @param form    Form name (e.g. "Form II", "Form A")
 * @param input   Employee, payroll and leave data
 * @returns       { csv: string, filename: string }
 */
export function generateSERegister(
  state: string,
  form: string,
  input: RegisterInput
): { csv: string; filename: string } {
  const key = `${state}:${form}`;
  const def = SE_REGISTER_REGISTRY[key];

  if (!def) {
    // Generic fallback for unlisted states / forms
    const headers = ["Sr No", "Name", "Emp Code", "Designation", "Date of Joining", "Department", "Basic (₹)"];
    const rows = (input.employees || []).map((emp, i) => [
      String(i + 1), emp.name, emp.emp_code || "",
      emp.designation || "-", fmtDate(emp.date_of_joining),
      emp.department || "-", String(emp.basic || 0),
    ]);
    const disclaimerRow = ["[DISCLAIMER] No specific register template found for this state/form combination."];
    const csv = toCSV([disclaimerRow, headers, ...rows]);
    const filename = `${form.replace(/[\s/()]/g, "_")}_${state}_${fmtMonth(input.month)}.csv`;
    return { csv, filename };
  }

  const disclaimerRow = [def.disclaimer];
  const citationRow = [`Act: ${def.actName} | Form: ${def.formName} | Citation: ${def.citation}`];
  const dataRows = def.buildRows(input);

  const csv = toCSV([disclaimerRow, citationRow, ...dataRows]);
  const filename = `${def.formName.replace(/\s+/g, "_")}_${state.replace(/\s+/g, "_")}_${fmtMonth(input.month)}.csv`;

  return { csv, filename };
}

/**
 * Trigger a browser CSV download.
 */
export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Convenience: backward-compatible named exports
export const generateFormII_MH  = (input: RegisterInput) => generateSERegister("Maharashtra", "Form II",  input);
export const generateFormV_MH   = (input: RegisterInput) => generateSERegister("Maharashtra", "Form V",   input);
export const generateFormT_KA   = (input: RegisterInput) => generateSERegister("Karnataka",   "Form T",   input);
export const generateFormXIV_TN = (input: RegisterInput) => generateSERegister("Tamil Nadu",  "Form XIV", input);
export const generateFormG_DL   = (input: RegisterInput) => generateSERegister("Delhi",       "Form G",   input);
export const generateFormA_TS   = (input: RegisterInput) => generateSERegister("Telangana",   "Form A",   input);
