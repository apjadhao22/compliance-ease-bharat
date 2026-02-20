import { z } from "zod";

export const employeeSchema = z.object({
  emp_code: z.string().trim().min(1, "Employee code is required").max(20, "Code too long"),
  name: z.string().trim().min(1, "Name is required").max(100, "Name too long"),
  basic: z.number().min(0, "Basic cannot be negative").max(10000000, "Basic exceeds limit"),
  hra: z.number().min(0, "HRA cannot be negative").max(10000000),
  allowances: z.number().min(0, "Allowances cannot be negative").max(10000000),
  da: z.number().min(0).max(10000000),
  retaining_allowance: z.number().min(0).max(10000000),
  employment_type: z.enum(["permanent", "fixed_term", "contractor"]),
  epf_applicable: z.boolean(),
  esic_applicable: z.boolean(),
  pt_applicable: z.boolean(),
});

export const companySchema = z.object({
  name: z.string().trim().min(1, "Company name is required").max(200, "Name too long"),
  pan: z.string().max(10).regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Invalid PAN format").or(z.literal("")),
  tan: z.string().max(10).regex(/^[A-Z]{4}[0-9]{5}[A-Z]$/, "Invalid TAN format").or(z.literal("")),
  state: z.string().max(50),
  city: z.string().max(50),
  epf_code: z.string().max(30).or(z.literal("")),
  esic_code: z.string().max(30).or(z.literal("")),
  pt_rc_number: z.string().max(30).or(z.literal("")),
  lwf_number: z.string().max(30).or(z.literal("")),
  compliance_regime: z.enum(["legacy_acts", "labour_codes"]),
  wc_policy_number: z.string().max(30).or(z.literal("")),
  wc_renewal_date: z.string(),
  occupation_risk: z.enum(["office_workers", "light_manual", "heavy_manual", "construction"]),
});

export const accidentSchema = z.object({
  employee_id: z.string().uuid("Invalid employee"),
  accident_date: z.string().min(1, "Date is required"),
  injury_type: z.enum(["minor", "temporary_disability", "permanent_disability", "death"]),
  description: z.string().max(1000, "Description too long"),
  medical_costs: z.number().min(0, "Costs cannot be negative").max(100000000),
});

export const getValidationError = (error: z.ZodError): string => {
  return error.errors.map((e) => e.message).join(", ");
};

// ─── Maternity Case Schema ───

export const maternityCaseSchema = z.object({
  employee_id: z.string().uuid("Invalid employee"),
  type: z.enum(["birth", "adoption", "surrogacy"]),
  expected_delivery_date: z.string().min(1, "Expected delivery date is required"),
  actual_delivery_date: z.string().optional().or(z.literal("")),
  eligible_from: z.string().min(1, "Eligible-from date is required"),
  eligible_to: z.string().min(1, "Eligible-to date is required"),
  weeks_allowed: z.number().int().min(1, "Weeks allowed must be at least 1").max(52, "Weeks allowed exceeds limit"),
  weeks_taken: z.number().int().min(0).max(52).default(0),
  status: z.enum(["planned", "ongoing", "closed"]).default("planned"),
});

// ─── Maternity Payment Schema ───

export const maternityPaymentSchema = z.object({
  maternity_case_id: z.string().uuid("Invalid maternity case"),
  period_from: z.string().min(1, "Period-from date is required"),
  period_to: z.string().min(1, "Period-to date is required"),
  days_paid: z.number().int().min(1, "Days paid must be at least 1"),
  average_daily_wage: z.number().min(0.01, "Average daily wage must be positive"),
  amount: z.number().min(0.01, "Amount must be positive"),
  paid_on: z.string().min(1, "Paid-on date is required"),
  mode: z.string().max(50).optional().or(z.literal("")),
  reference_no: z.string().max(100).optional().or(z.literal("")),
}).refine(
  (d) => !d.period_from || !d.period_to || d.period_to >= d.period_from,
  { message: "Period-to must be on or after period-from", path: ["period_to"] }
);

// ─── WC Policy Schema ───

export const wcPolicySchema = z.object({
  policy_no: z.string().trim().min(1, "Policy number is required").max(50),
  insurer: z.string().trim().min(1, "Insurer name is required").max(200),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"),
  premium_amount: z.number().min(0.01, "Premium must be positive"),
  total_covered_employees: z.number().int().min(0, "Covered employees cannot be negative"),
  status: z.enum(["active", "expired"]).default("active"),
}).refine(
  (d) => !d.start_date || !d.end_date || d.end_date >= d.start_date,
  { message: "End date must be on or after start date", path: ["end_date"] }
);

// ─── Pay Equity Filter Schema ───

export const payEquityFilterSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be YYYY-MM format"),
  department: z.string().optional(),
  grade: z.string().optional(),
  thresholdPercent: z.number().min(0).max(100).default(10),
});
