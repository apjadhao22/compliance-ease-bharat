
-- Companies table (one per user)
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  pan TEXT,
  tan TEXT,
  state TEXT DEFAULT 'Maharashtra',
  city TEXT DEFAULT 'Pune',
  epf_code TEXT,
  esic_code TEXT,
  pt_rc_number TEXT,
  lwf_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own company" ON public.companies
  FOR ALL USING (auth.uid() = user_id);

-- Employees table
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  emp_code TEXT NOT NULL,
  name TEXT NOT NULL,
  pan TEXT,
  uan TEXT,
  esic_number TEXT,
  dob DATE,
  date_of_joining DATE NOT NULL DEFAULT CURRENT_DATE,
  date_of_leaving DATE,
  gender TEXT DEFAULT 'Male',
  basic DECIMAL(10,2) NOT NULL,
  hra DECIMAL(10,2) DEFAULT 0,
  allowances DECIMAL(10,2) DEFAULT 0,
  gross DECIMAL(10,2) NOT NULL,
  epf_applicable BOOLEAN DEFAULT true,
  esic_applicable BOOLEAN DEFAULT false,
  pt_applicable BOOLEAN DEFAULT true,
  bonus_applicable BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, emp_code)
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own company employees" ON public.employees
  FOR ALL USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

-- Payroll runs table
CREATE TABLE public.payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  working_days INTEGER DEFAULT 26,
  status TEXT DEFAULT 'draft',
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, month)
);

ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own payroll runs" ON public.payroll_runs
  FOR ALL USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

-- Payroll details table
CREATE TABLE public.payroll_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id UUID NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  days_present INTEGER DEFAULT 26,
  paid_leaves INTEGER DEFAULT 0,
  unpaid_leaves INTEGER DEFAULT 0,
  overtime_hours DECIMAL(5,2) DEFAULT 0,
  basic_paid DECIMAL(10,2),
  hra_paid DECIMAL(10,2),
  allowances_paid DECIMAL(10,2),
  overtime_pay DECIMAL(10,2) DEFAULT 0,
  gross_earnings DECIMAL(10,2),
  epf_employee DECIMAL(10,2) DEFAULT 0,
  epf_employer DECIMAL(10,2) DEFAULT 0,
  eps_employer DECIMAL(10,2) DEFAULT 0,
  esic_employee DECIMAL(10,2) DEFAULT 0,
  esic_employer DECIMAL(10,2) DEFAULT 0,
  pt DECIMAL(10,2) DEFAULT 0,
  tds DECIMAL(10,2) DEFAULT 0,
  lwf_employee DECIMAL(10,2) DEFAULT 0,
  lwf_employer DECIMAL(10,2) DEFAULT 0,
  total_deductions DECIMAL(10,2),
  net_pay DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(payroll_run_id, employee_id)
);

ALTER TABLE public.payroll_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own payroll details" ON public.payroll_details
  FOR ALL USING (
    payroll_run_id IN (
      SELECT id FROM public.payroll_runs 
      WHERE company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    )
  );

-- Bonus calculations table
CREATE TABLE public.bonus_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  financial_year TEXT NOT NULL,
  eligible_months INTEGER,
  bonus_percent DECIMAL(5,2),
  bonus_wages DECIMAL(10,2),
  bonus_amount DECIMAL(10,2),
  payment_status TEXT DEFAULT 'pending',
  payment_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, employee_id, financial_year)
);

ALTER TABLE public.bonus_calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own bonus data" ON public.bonus_calculations
  FOR ALL USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

-- Gratuity calculations table
CREATE TABLE public.gratuity_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date_of_leaving DATE NOT NULL,
  years_of_service INTEGER,
  last_drawn_basic DECIMAL(10,2),
  gratuity_amount DECIMAL(10,2),
  payment_status TEXT DEFAULT 'pending',
  payment_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.gratuity_calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own gratuity data" ON public.gratuity_calculations
  FOR ALL USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER employees_updated_at BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
