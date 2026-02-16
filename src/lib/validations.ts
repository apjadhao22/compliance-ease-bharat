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
