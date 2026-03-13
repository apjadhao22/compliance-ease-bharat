-- ============================================================
-- ESS Phase M-N: Documents/Notices + Schedule/Regularization/Comp-Off
-- ============================================================

-- ============================================================
-- NOTICES table (HR-created company notices)
-- ============================================================
CREATE TABLE IF NOT EXISTS notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('high','normal','low')) DEFAULT 'normal',
  posted_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage notices"
  ON notices FOR ALL
  USING (company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role IN ('owner','admin','hr_manager')
  ))
  WITH CHECK (company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role IN ('owner','admin','hr_manager')
  ));

CREATE POLICY "Employee read own company notices"
  ON notices FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM employees WHERE auth_user_id = auth.uid()
  ));

-- ============================================================
-- NOTICE_READS table
-- ============================================================
CREATE TABLE IF NOT EXISTS notice_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id uuid NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  read_at timestamptz DEFAULT now(),
  UNIQUE(notice_id, employee_id)
);

ALTER TABLE notice_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees manage own notice_reads"
  ON notice_reads FOR ALL
  USING (employee_id = get_employee_id_for_user(auth.uid()))
  WITH CHECK (employee_id = get_employee_id_for_user(auth.uid()));

-- ============================================================
-- REGULARIZATION_REQUESTS table
-- ============================================================
CREATE TABLE IF NOT EXISTS regularization_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  request_date date NOT NULL,
  original_status text,
  requested_status text NOT NULL CHECK (requested_status IN ('present','half_day','on_duty','comp_off')),
  reason text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','approved','rejected')) DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users,
  reviewed_at timestamptz,
  review_comment text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE regularization_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employee own regularization"
  ON regularization_requests FOR ALL
  USING (employee_id = get_employee_id_for_user(auth.uid()))
  WITH CHECK (employee_id = get_employee_id_for_user(auth.uid()));

CREATE POLICY "Admin manage regularization"
  ON regularization_requests FOR ALL
  USING (company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role IN ('owner','admin','hr_manager')
  ))
  WITH CHECK (company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role IN ('owner','admin','hr_manager')
  ));

-- ============================================================
-- COMP_OFF_REQUESTS table
-- ============================================================
CREATE TABLE IF NOT EXISTS comp_off_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  worked_date date NOT NULL,
  avail_date date,
  reason text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','approved','rejected','availed')) DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users,
  reviewed_at timestamptz,
  review_comment text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE comp_off_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employee own comp_off"
  ON comp_off_requests FOR ALL
  USING (employee_id = get_employee_id_for_user(auth.uid()))
  WITH CHECK (employee_id = get_employee_id_for_user(auth.uid()));

CREATE POLICY "Admin manage comp_off"
  ON comp_off_requests FOR ALL
  USING (company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role IN ('owner','admin','hr_manager')
  ))
  WITH CHECK (company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role IN ('owner','admin','hr_manager')
  ));
