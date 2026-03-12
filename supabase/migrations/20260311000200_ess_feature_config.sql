-- ============================================================
-- ESS Feature Config: Phase H
-- Gating system controlling which ESS features are available
-- ============================================================

-- ─── ess_feature_config table ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ess_feature_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  -- Core (default ON)
  payslips_enabled boolean DEFAULT true,
  tax_declarations_enabled boolean DEFAULT true,
  leave_requests_enabled boolean DEFAULT true,
  profile_edit_enabled boolean DEFAULT true,
  -- Time & Attendance (default OFF)
  timesheets_enabled boolean DEFAULT false,
  shift_schedule_enabled boolean DEFAULT false,
  comp_off_enabled boolean DEFAULT false,
  regularization_enabled boolean DEFAULT false,
  -- Finance (default OFF)
  expenses_enabled boolean DEFAULT false,
  advances_enabled boolean DEFAULT false,
  annual_statement_enabled boolean DEFAULT false,
  -- Documents & Communication (default OFF)
  documents_enabled boolean DEFAULT false,
  assets_enabled boolean DEFAULT false,
  notices_enabled boolean DEFAULT false,
  -- Compliance & Grievance (default OFF)
  grievance_enabled boolean DEFAULT false,
  posh_complaint_enabled boolean DEFAULT false,
  maternity_tracking_enabled boolean DEFAULT false,
  -- Lifecycle (default OFF)
  exit_request_enabled boolean DEFAULT false,
  --
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.ess_feature_config ENABLE ROW LEVEL SECURITY;

-- Admins/owners can read + write
CREATE POLICY "Admins manage ess_feature_config"
  ON public.ess_feature_config FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'hr')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'hr')
    )
  );

-- ESS employees can read (to know which features are on)
CREATE POLICY "Employees read ess_feature_config"
  ON public.ess_feature_config FOR SELECT
  USING (
    company_id = (
      SELECT company_id FROM public.employees
      WHERE auth_user_id = auth.uid()
      LIMIT 1
    )
  );

-- ─── Auto-create default config on new company ───────────────

CREATE OR REPLACE FUNCTION public.create_default_ess_feature_config()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.ess_feature_config (company_id)
  VALUES (NEW.id)
  ON CONFLICT (company_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_create_ess_feature_config ON public.companies;

CREATE TRIGGER trg_create_ess_feature_config
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_ess_feature_config();

-- Backfill: create default config for all existing companies
INSERT INTO public.ess_feature_config (company_id)
SELECT id FROM public.companies
ON CONFLICT (company_id) DO NOTHING;
