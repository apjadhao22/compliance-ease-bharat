
-- 1) Extend employees table with new columns
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS department text NULL,
  ADD COLUMN IF NOT EXISTS grade text NULL,
  ADD COLUMN IF NOT EXISTS ec_act_applicable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS occupation_category text NULL,
  ADD COLUMN IF NOT EXISTS risk_rate numeric(6,2) NULL DEFAULT 0.00;

-- Add check constraint on gender (drop existing default first if needed, re-add)
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_gender_check;
ALTER TABLE public.employees ADD CONSTRAINT employees_gender_check CHECK (gender IN ('Male','Female','Other'));

-- 2) Maternity module tables
CREATE TABLE public.maternity_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('birth','adoption','surrogacy')),
  expected_delivery_date date NOT NULL,
  actual_delivery_date date NULL,
  eligible_from date NOT NULL,
  eligible_to date NOT NULL,
  weeks_allowed integer NOT NULL,
  weeks_taken integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','ongoing','closed')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_maternity_cases_company_employee ON public.maternity_cases(company_id, employee_id);

ALTER TABLE public.maternity_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own maternity cases"
  ON public.maternity_cases FOR ALL
  USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

CREATE TABLE public.maternity_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maternity_case_id uuid NOT NULL REFERENCES public.maternity_cases(id) ON DELETE CASCADE,
  period_from date NOT NULL,
  period_to date NOT NULL,
  days_paid integer NOT NULL,
  average_daily_wage numeric(12,2) NOT NULL,
  amount numeric(12,2) NOT NULL,
  paid_on date NOT NULL,
  mode text NULL,
  reference_no text NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_maternity_payments_case ON public.maternity_payments(maternity_case_id);

ALTER TABLE public.maternity_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own maternity payments"
  ON public.maternity_payments FOR ALL
  USING (maternity_case_id IN (
    SELECT id FROM public.maternity_cases
    WHERE company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  ));

-- 3) WC policy table
CREATE TABLE public.wc_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  policy_no text NOT NULL,
  insurer text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  premium_amount numeric(12,2) NOT NULL,
  total_covered_employees integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired')),
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX idx_wc_policies_company_policy ON public.wc_policies(company_id, policy_no);

ALTER TABLE public.wc_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own wc policies"
  ON public.wc_policies FOR ALL
  USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));
