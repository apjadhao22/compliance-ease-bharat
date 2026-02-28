-- ============================================================
-- Phase 7: Audit Readiness
-- ============================================================

-- 1. Add skill_category to employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS skill_category text 
  CHECK (skill_category IN ('Unskilled', 'Semi-Skilled', 'Skilled', 'Highly Skilled'));

-- 2. PT Payments table (to store challan numbers per month)
CREATE TABLE IF NOT EXISTS pt_payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  month text NOT NULL,                  -- 'YYYY-MM'
  total_pt_amount numeric(10,2) NOT NULL DEFAULT 0,
  challan_number text,
  payment_date date,
  created_at timestamptz DEFAULT now(),
  UNIQUE (company_id, month)
);

ALTER TABLE pt_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own pt_payments"
  ON pt_payments FOR ALL
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

-- 3. Audit Log table (immutable change history)
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  actor_email text NOT NULL,
  action text NOT NULL,      -- e.g. 'salary_change', 'status_change', 'payroll_run', 'posh_status_change'
  entity_type text NOT NULL, -- e.g. 'employee', 'payroll_run', 'posh_case'
  entity_id uuid,
  entity_label text,         -- human-readable label e.g. employee name
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own audit_log"
  ON audit_log FOR SELECT
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

CREATE POLICY "Users insert own audit_log"
  ON audit_log FOR INSERT
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_audit_log_company_created ON audit_log(company_id, created_at DESC);
