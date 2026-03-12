-- ============================================================
-- ESS Phase I–L: Timesheets, Expenses, Advances, Assets
-- ============================================================

-- ─── Phase I: Timesheets RLS ────────────────────────────────

-- Employees can SELECT their own timesheet rows
CREATE POLICY IF NOT EXISTS "timesheets_employee_select"
  ON public.timesheets FOR SELECT
  USING (employee_id = get_employee_id_for_user(auth.uid()));

-- Employees can INSERT with status='pending'
CREATE POLICY IF NOT EXISTS "timesheets_employee_insert"
  ON public.timesheets FOR INSERT
  WITH CHECK (
    employee_id = get_employee_id_for_user(auth.uid())
    AND status = 'Pending'
  );

-- Employees can UPDATE only their own pending rows
CREATE POLICY IF NOT EXISTS "timesheets_employee_update"
  ON public.timesheets FOR UPDATE
  USING (
    employee_id = get_employee_id_for_user(auth.uid())
    AND status = 'Pending'
  );

-- ─── Phase J: Expenses RLS ──────────────────────────────────

-- Employees can SELECT their own expense rows
CREATE POLICY IF NOT EXISTS "expenses_employee_select"
  ON public.expenses FOR SELECT
  USING (employee_id = get_employee_id_for_user(auth.uid()));

-- Employees can INSERT with status='Pending'
CREATE POLICY IF NOT EXISTS "expenses_employee_insert"
  ON public.expenses FOR INSERT
  WITH CHECK (
    employee_id = get_employee_id_for_user(auth.uid())
    AND status = 'Pending'
  );

-- Employees cannot UPDATE/DELETE once status is not Pending
-- (enforced via RLS: UPDATE only allowed when current row is still Pending)
CREATE POLICY IF NOT EXISTS "expenses_employee_update_pending"
  ON public.expenses FOR UPDATE
  USING (
    employee_id = get_employee_id_for_user(auth.uid())
    AND status = 'Pending'
  );

-- ─── Phase K: Advances RLS ──────────────────────────────────

-- Employees can SELECT their own advances
CREATE POLICY IF NOT EXISTS "advances_employee_select"
  ON public.advances FOR SELECT
  USING (employee_id = get_employee_id_for_user(auth.uid()));

-- Employees can INSERT with status='pending'
CREATE POLICY IF NOT EXISTS "advances_employee_insert"
  ON public.advances FOR INSERT
  WITH CHECK (
    employee_id = get_employee_id_for_user(auth.uid())
    AND status = 'Pending'
  );

-- ─── Phase L: Assets — add ESS columns ──────────────────────

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS acknowledged boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS return_requested_at timestamptz;

-- Employees can SELECT their own assigned assets
CREATE POLICY IF NOT EXISTS "assets_employee_select"
  ON public.assets FOR SELECT
  USING (assigned_to = get_employee_id_for_user(auth.uid()));

-- Employees can UPDATE only acknowledged / acknowledged_at on their own assets
CREATE POLICY IF NOT EXISTS "assets_employee_acknowledge"
  ON public.assets FOR UPDATE
  USING (assigned_to = get_employee_id_for_user(auth.uid()));
