-- ============================================================
-- Document Templates
-- ============================================================
CREATE TABLE IF NOT EXISTS document_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_type text NOT NULL CHECK (template_type IN ('Offer Letter', 'Appointment Letter', 'NDA', 'Relieving Letter')),
  body_html text NOT NULL,
  letterhead_line text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (company_id, template_type)
);

ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own document_templates"
  ON document_templates FOR ALL
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

-- ============================================================
-- Shift Policies
-- ============================================================
CREATE TABLE IF NOT EXISTS shift_policies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  shift_start time NOT NULL DEFAULT '09:00',
  shift_end time NOT NULL DEFAULT '18:00',
  is_night_shift boolean NOT NULL DEFAULT false,
  allowance_per_day numeric(10,2) NOT NULL DEFAULT 0,
  late_mark_grace_minutes integer NOT NULL DEFAULT 15,
  max_late_marks_per_month integer NOT NULL DEFAULT 3,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE shift_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own shift_policies"
  ON shift_policies FOR ALL
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

-- ============================================================
-- Add shift_policy_id to employees
-- ============================================================
ALTER TABLE employees ADD COLUMN IF NOT EXISTS shift_policy_id uuid REFERENCES shift_policies(id) ON DELETE SET NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS designation text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS joining_date date;
