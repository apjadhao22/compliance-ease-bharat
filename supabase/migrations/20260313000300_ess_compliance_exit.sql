-- ================================================================
-- ESS Phase O–R: Maternity RLS + Grievances + POSH ESS columns
-- ESS Phase S: exit_requests table
-- ESS Phase U: approval_comments table
-- ================================================================

-- ─────────────────────────────────────────────────────────────
-- Phase O: Maternity cases — employee RLS
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'maternity_cases' AND policyname = 'Employee own maternity_cases'
  ) THEN
    CREATE POLICY "Employee own maternity_cases"
      ON public.maternity_cases FOR SELECT
      USING (employee_id = get_employee_id_for_user(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'maternity_cases' AND policyname = 'Employee insert maternity_cases'
  ) THEN
    CREATE POLICY "Employee insert maternity_cases"
      ON public.maternity_cases FOR INSERT
      WITH CHECK (employee_id = get_employee_id_for_user(auth.uid()));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- Phase Q: Grievances — add ESS columns
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.grievances
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users,
  ADD COLUMN IF NOT EXISTS submitted_by_employee_id uuid REFERENCES public.employees(id),
  ADD COLUMN IF NOT EXISTS is_anonymous boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS employee_visible_status text
    CHECK (employee_visible_status IN ('submitted','under_review','resolved','closed')) DEFAULT 'submitted',
  ADD COLUMN IF NOT EXISTS resolution_notes text,
  ADD COLUMN IF NOT EXISTS category text
    CHECK (category IN ('workplace_safety','harassment','wage_dispute','discrimination','working_conditions','other'));

-- Employee RLS on grievances
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'grievances' AND policyname = 'Employee select own grievances'
  ) THEN
    CREATE POLICY "Employee select own grievances"
      ON public.grievances FOR SELECT
      USING (submitted_by_employee_id = get_employee_id_for_user(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'grievances' AND policyname = 'Employee insert grievance'
  ) THEN
    CREATE POLICY "Employee insert grievance"
      ON public.grievances FOR INSERT
      WITH CHECK (submitted_by = auth.uid());
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- Phase R: POSH cases — add ESS columns
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.posh_cases
  ADD COLUMN IF NOT EXISTS complainant_employee_id uuid REFERENCES public.employees(id),
  ADD COLUMN IF NOT EXISTS complaint_nature text
    CHECK (complaint_nature IN ('verbal','physical','visual','quid_pro_quo','hostile_environment','cyber_online','other')),
  ADD COLUMN IF NOT EXISTS incident_date date,
  ADD COLUMN IF NOT EXISTS description_ess text,
  ADD COLUMN IF NOT EXISTS witness_names text,
  ADD COLUMN IF NOT EXISTS evidence_path text,
  ADD COLUMN IF NOT EXISTS next_hearing_date date;

-- Employee RLS on posh_cases
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'posh_cases' AND policyname = 'Employee select own posh_cases'
  ) THEN
    CREATE POLICY "Employee select own posh_cases"
      ON public.posh_cases FOR SELECT
      USING (complainant_employee_id = get_employee_id_for_user(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'posh_cases' AND policyname = 'Employee insert posh_case'
  ) THEN
    CREATE POLICY "Employee insert posh_case"
      ON public.posh_cases FOR INSERT
      WITH CHECK (complainant_employee_id = get_employee_id_for_user(auth.uid()));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- Phase S: Exit requests
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  resignation_date date NOT NULL,
  last_working_date date NOT NULL,
  reason text,
  notice_period_days int DEFAULT 30,
  status text NOT NULL CHECK (status IN ('submitted','acknowledged','processing','completed','withdrawn')) DEFAULT 'submitted',
  acknowledged_by uuid REFERENCES auth.users,
  acknowledged_at timestamptz,
  fnf_settlement_id uuid REFERENCES public.fnf_settlements(id),
  asset_return_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(employee_id)
);

ALTER TABLE public.exit_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'exit_requests' AND policyname = 'Employee own exit_request'
  ) THEN
    CREATE POLICY "Employee own exit_request" ON public.exit_requests FOR ALL
      USING (employee_id = get_employee_id_for_user(auth.uid()))
      WITH CHECK (employee_id = get_employee_id_for_user(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'exit_requests' AND policyname = 'Admin manage exit_requests'
  ) THEN
    CREATE POLICY "Admin manage exit_requests" ON public.exit_requests FOR ALL
      USING (company_id IN (
        SELECT company_id FROM public.company_members
        WHERE user_id = auth.uid() AND role IN ('owner','admin','hr')
      ))
      WITH CHECK (company_id IN (
        SELECT company_id FROM public.company_members
        WHERE user_id = auth.uid() AND role IN ('owner','admin','hr')
      ));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- Phase U: Approval comments (polymorphic)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.approval_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type text NOT NULL CHECK (request_type IN ('leave','timesheet','expense','advance','comp_off','regularization','exit')),
  request_id uuid NOT NULL,
  comment text NOT NULL,
  commented_by uuid NOT NULL REFERENCES auth.users,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.approval_comments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'approval_comments' AND policyname = 'Company scoped approval_comments'
  ) THEN
    CREATE POLICY "Company scoped approval_comments" ON public.approval_comments FOR ALL
      USING (commented_by IN (
        SELECT user_id FROM public.company_members
        WHERE company_id IN (
          SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
        )
      ))
      WITH CHECK (commented_by = auth.uid());
  END IF;
END $$;
