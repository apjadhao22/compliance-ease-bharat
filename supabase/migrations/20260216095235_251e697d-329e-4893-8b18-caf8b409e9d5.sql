
-- WC/EC insurance tracking columns on companies
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS wc_policy_number TEXT,
ADD COLUMN IF NOT EXISTS wc_renewal_date DATE,
ADD COLUMN IF NOT EXISTS wc_annual_premium DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS occupation_risk TEXT DEFAULT 'office_workers';

-- Accident register for Form EE reporting
CREATE TABLE IF NOT EXISTS public.accidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id),
  accident_date DATE NOT NULL,
  injury_type TEXT NOT NULL,
  description TEXT,
  medical_costs DECIMAL(10,2) DEFAULT 0,
  compensation_paid DECIMAL(10,2) DEFAULT 0,
  insurer_notified BOOLEAN DEFAULT false,
  form_ee_filed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.accidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own accidents" ON public.accidents
  FOR ALL USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));
