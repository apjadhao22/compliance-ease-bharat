-- ============================================================
-- ESS Core: Phase A–G migrations
-- Employee Self-Service portal foundation
-- ============================================================

-- ─── Phase A: ESS Auth & Employee Linking ───────────────────

-- Add ESS columns to employees
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS ess_invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS ess_activated_at timestamptz;

-- RLS: employees can SELECT their own row via auth_user_id
CREATE POLICY "employees_ess_select_own"
  ON public.employees
  FOR SELECT
  USING (auth.uid() = auth_user_id);

-- ─── Phase C: Payslip helper function ───────────────────────

-- Helper: get employee id for a given auth user
CREATE OR REPLACE FUNCTION get_employee_id_for_user(uid uuid)
RETURNS uuid AS $$
  SELECT id FROM public.employees WHERE auth_user_id = uid LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- RLS: employees can SELECT their own payroll_details
CREATE POLICY "payroll_details_ess_select_own"
  ON public.payroll_details
  FOR SELECT
  USING (employee_id = get_employee_id_for_user(auth.uid()));

-- ─── Phase D: Investment Declarations ───────────────────────

CREATE TABLE IF NOT EXISTS public.investment_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  financial_year text NOT NULL,
  regime text NOT NULL CHECK (regime IN ('old','new')) DEFAULT 'new',
  section_80c numeric DEFAULT 0,
  section_80d numeric DEFAULT 0,
  section_80d_parents numeric DEFAULT 0,
  hra_exemption numeric DEFAULT 0,
  section_24b numeric DEFAULT 0,
  section_80ccd_nps numeric DEFAULT 0,
  section_80e numeric DEFAULT 0,
  section_80tta numeric DEFAULT 0,
  other_deductions numeric DEFAULT 0,
  proof_status text CHECK (proof_status IN ('declared','submitted','verified')) DEFAULT 'declared',
  submitted_at timestamptz,
  verified_at timestamptz,
  verified_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, financial_year)
);

ALTER TABLE public.investment_declarations ENABLE ROW LEVEL SECURITY;

-- Employee: SELECT/INSERT/UPDATE own declarations
CREATE POLICY "investment_declarations_employee_select"
  ON public.investment_declarations FOR SELECT
  USING (employee_id = get_employee_id_for_user(auth.uid()));

CREATE POLICY "investment_declarations_employee_insert"
  ON public.investment_declarations FOR INSERT
  WITH CHECK (employee_id = get_employee_id_for_user(auth.uid()));

CREATE POLICY "investment_declarations_employee_update"
  ON public.investment_declarations FOR UPDATE
  USING (employee_id = get_employee_id_for_user(auth.uid()));

-- Admin: SELECT/UPDATE all declarations for their company
CREATE POLICY "investment_declarations_admin_select"
  ON public.investment_declarations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      JOIN public.company_members cm ON cm.company_id = e.company_id
      WHERE e.id = investment_declarations.employee_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner','admin','hr')
    )
  );

CREATE POLICY "investment_declarations_admin_update"
  ON public.investment_declarations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      JOIN public.company_members cm ON cm.company_id = e.company_id
      WHERE e.id = investment_declarations.employee_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner','admin','hr')
    )
  );

-- ─── Phase E: Leave Requests ────────────────────────────────
-- leave_requests table already exists — add ESS-specific columns

ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS days numeric,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_comment text;

-- ESS RLS: employees can SELECT / INSERT their own leave requests
-- (table RLS and admin policy already exist from earlier migration)
CREATE POLICY IF NOT EXISTS "leave_requests_employee_select"
  ON public.leave_requests FOR SELECT
  USING (employee_id = get_employee_id_for_user(auth.uid()));

CREATE POLICY IF NOT EXISTS "leave_requests_employee_insert"
  ON public.leave_requests FOR INSERT
  WITH CHECK (employee_id = get_employee_id_for_user(auth.uid()));

CREATE POLICY IF NOT EXISTS "leave_requests_employee_update"
  ON public.leave_requests FOR UPDATE
  USING (employee_id = get_employee_id_for_user(auth.uid()));

-- ─── Phase F: Employee Profile fields ───────────────────────

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS emergency_contact text,
  ADD COLUMN IF NOT EXISTS emergency_phone text,
  ADD COLUMN IF NOT EXISTS address text;

-- ─── Phase G: ESS company toggle ────────────────────────────

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS ess_enabled boolean DEFAULT false;
