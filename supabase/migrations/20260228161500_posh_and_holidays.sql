-- ============================================================
-- POSH: Internal Complaints Committee Members
-- ============================================================
CREATE TABLE IF NOT EXISTS posh_icc_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  name text NOT NULL,
  designation text,
  role text NOT NULL CHECK (role IN ('Presiding Officer', 'Member', 'External Member')),
  appointed_on date NOT NULL DEFAULT CURRENT_DATE,
  contact_email text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE posh_icc_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own posh_icc_members"
  ON posh_icc_members FOR ALL
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

-- ============================================================
-- POSH: Complaint Cases Register
-- ============================================================
CREATE TABLE IF NOT EXISTS posh_cases (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  case_number text NOT NULL,
  complainant_name text NOT NULL,
  respondent_name text NOT NULL,
  incident_date date NOT NULL,
  complaint_date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'Received' CHECK (status IN ('Received', 'Under Inquiry', 'Inquiry Complete', 'Closed')),
  inquiry_findings text,
  action_taken text,
  closure_date date,
  is_confidential boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE posh_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own posh_cases"
  ON posh_cases FOR ALL
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

-- ============================================================
-- Company Holidays
-- ============================================================
CREATE TABLE IF NOT EXISTS company_holidays (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  date date NOT NULL,
  type text NOT NULL CHECK (type IN ('National', 'State', 'Local', 'Company')),
  is_optional boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE company_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own company_holidays"
  ON company_holidays FOR ALL
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

-- ============================================================
-- SEED: Maharashtra 2025 Public Holidays
-- Inserted via Function so each company gets seeded on first login
-- ============================================================
-- We'll insert per-company via application logic. No global seed here.
-- The frontend will upsert these on first load if none exist for the company.
