-- Add employee work location state (PT/LWF are based on work location, not company state)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS work_state text;

-- Backfill existing employees with company state
UPDATE employees e SET work_state = c.state FROM companies c WHERE e.company_id = c.id AND e.work_state IS NULL;

COMMENT ON COLUMN employees.work_state IS 'State where employee physically works. PT and LWF calculated based on this.';

-- Add migrant worker fields
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_migrant_worker boolean DEFAULT false;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS home_state text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS consent_night_shift boolean DEFAULT false;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS consent_night_shift_date date;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_type text DEFAULT 'permanent';  -- 'permanent', 'fixed_term', 'casual', 'apprentice'

-- Retrenchment cases table
CREATE TABLE IF NOT EXISTS retrenchment_cases (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  notice_date date NOT NULL,
  notice_reference text,
  permission_status text DEFAULT 'pending',  -- pending, approved, rejected
  affected_employee_ids jsonb DEFAULT '[]',
  compensation_total numeric DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Welfare compliance tracking
CREATE TABLE IF NOT EXISTS welfare_compliance (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  facility_type text NOT NULL,  -- canteen, creche, welfare_officer, safety_committee
  is_compliant boolean DEFAULT false,
  compliance_date date,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- RLS policies
ALTER TABLE retrenchment_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE welfare_compliance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own company retrenchment cases" ON retrenchment_cases
  FOR ALL USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage own company welfare compliance" ON welfare_compliance
  FOR ALL USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));
