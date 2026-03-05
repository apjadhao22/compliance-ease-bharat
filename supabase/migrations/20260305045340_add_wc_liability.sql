ALTER TABLE public.payroll_details ADD COLUMN IF NOT EXISTS wc_liability numeric DEFAULT 0;
COMMENT ON COLUMN public.payroll_details.wc_liability IS 'Workmen''s Compensation / Employees'' Compensation Employer Liability';
