-- Gap 1: Add minimum wage check result columns to payroll_details
ALTER TABLE public.payroll_details
ADD COLUMN IF NOT EXISTS min_wage_status text DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS min_wage_applicable numeric(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS min_wage_shortfall numeric(10,2) DEFAULT 0;
