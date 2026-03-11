# 04 — Employee Self-Service Portal: Core

> Phases A–G of the ESS track.
> This creates the ESS portal foundation. Completely separate from admin dashboard.

---

## Phase A — ESS Auth & Employee Linking

1. **Migration — add columns to `employees`**:
   ```sql
   ALTER TABLE employees ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users ON DELETE SET NULL;
   ALTER TABLE employees ADD COLUMN IF NOT EXISTS email text;
   ALTER TABLE employees ADD COLUMN IF NOT EXISTS ess_invited_at timestamptz;
   ALTER TABLE employees ADD COLUMN IF NOT EXISTS ess_activated_at timestamptz;
   ```

2. **Edge Function — `invite-ess`** (`supabase/functions/invite-ess/index.ts`):
   - Accepts `{ employeeId }`. Requires admin/owner auth (verify via `user_roles`).
   - Looks up employee row → gets `email`. If no email, return 400.
   - Calls `supabase.auth.admin.inviteUserByEmail(email, { data: { role: 'employee', employee_id: employeeId } })`.
   - Updates `employees.ess_invited_at = now()`.
   - Uses service role client for admin auth operations.

3. **Edge Function — `link-ess-account`** (`supabase/functions/link-ess-account/index.ts`):
   - Called on first ESS login.
   - Reads `employee_id` from `user_metadata`.
   - Sets `employees.auth_user_id = auth.uid()` and `ess_activated_at = now()`.
   - Returns success.

4. **RLS addition on `employees`**: add policy so `auth.uid() = auth_user_id` allows SELECT on own row (for ESS users). Existing admin policies remain unchanged.

---

## Phase B — ESS Layout & Shell

1. **`ESSLayout.tsx`** (`src/components/ESSLayout.tsx`):
   - Mobile-first layout, completely separate from DashboardLayout.
   - Top navbar: OpticompBharat logo + "Employee Portal" subtitle, employee name, company name, sign-out button.
   - Navigation: horizontal tabs on desktop, bottom tab bar on mobile. Items: Dashboard, Payslips, Tax, Leaves, Profile, Documents.
   - Auth check: verify `user_metadata.role === 'employee'`. If not, redirect to `/dashboard`.
   - On mount: if `auth_user_id` not yet linked on the employee row, call `link-ess-account` Edge Function.

2. **ESS routes in `App.tsx`**:
   ```
   /ess/login    → ESSLogin
   /ess          → ESSLayout wrapper
     /ess/       → ESSDashboard (index)
     /ess/payslips → ESSPayslips
     /ess/tax    → ESSTaxDeclarations
     /ess/leaves → ESSLeaves
     /ess/profile → ESSProfile
     /ess/documents → ESSDocuments
   ```
   All lazy-loaded with ErrorBoundary + Suspense.

3. **`/ess/login` page** (`src/pages/ess/ESSLogin.tsx`):
   - Employee-facing sign-in. Branded: "Employee Portal" subtitle.
   - Default mode: magic link — email input → `supabase.auth.signInWithOtp({ email })`. Show "Check your email" message.
   - Optional: "Sign in with password" toggle (for employees who have set a password).
   - On success: redirect to `/ess`.
   - If logged-in user has `role != 'employee'`, redirect to `/dashboard`.

---

## Phase C — Payslip Viewing

1. **Postgres helper function**:
   ```sql
   CREATE OR REPLACE FUNCTION get_employee_id_for_user(uid uuid)
   RETURNS uuid AS $$
     SELECT id FROM employees WHERE auth_user_id = uid LIMIT 1;
   $$ LANGUAGE sql SECURITY DEFINER STABLE;
   ```

2. **RLS on `payroll_details`**: add policy — employees can SELECT rows where `employee_id = get_employee_id_for_user(auth.uid())`.

3. **`/ess/payslips` page**:
   - Query `payroll_details` joined with `payroll_runs` for logged-in employee's `employee_id`.
   - List view: month/year, gross, total deductions, net pay. Sorted newest first.
   - Click to expand: full breakdown — basic, HRA, DA, allowances, EPF employee, ESIC employee, PT, TDS, LWF, other deductions, net pay.
   - "Download PDF" button per payslip — generate using jsPDF (adapt existing admin payslip PDF logic for single-employee view).

4. **ESS Dashboard widget**: show latest payslip summary card (month, gross, net).

---

## Phase D — Investment Declarations for TDS

1. **Migration — `investment_declarations` table**:
   ```sql
   CREATE TABLE investment_declarations (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
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
   ```
   RLS: employees SELECT/INSERT/UPDATE own. Admins SELECT/UPDATE all for their company.

2. **`/ess/tax` page**:
   - FY selector dropdown (2024-25, 2025-26, 2026-27).
   - Regime toggle: Old vs New. If New regime selected, grey out most fields (only standard deduction + 80CCD NPS apply).
   - Form fields for each section with labels and statutory max limits as helper text:
     - 80C (max ₹1.5L): PPF, ELSS, LIC, tuition fees, etc.
     - 80D (max ₹25K/₹50K): health insurance self
     - 80D Parents (max ₹25K/₹50K): health insurance parents
     - HRA exemption: actual HRA claim amount
     - 24(b) (max ₹2L): home loan interest
     - 80CCD NPS (max ₹50K): additional NPS
     - 80E: education loan interest (no limit)
     - 80TTA (max ₹10K): savings account interest
     - Other deductions
   - "Save Declaration" button: upserts `investment_declarations`.
   - Show computed: estimated annual taxable income, estimated annual tax, estimated monthly TDS.
   - Proof upload section: file upload per section → Supabase Storage `tax-proofs/{employee_id}/{fy}/`. Update `proof_status` to 'submitted'.

3. **Admin-side verification**: on existing `/dashboard/tds` page, add a "Verify Declarations" tab. List all declarations with status filter. Admin clicks "Verify" → sets `proof_status='verified'`, `verified_at`, `verified_by`.

4. **Payroll integration**: modify `calculate-payroll` Edge Function — when computing TDS for an employee, check if `investment_declarations` row exists for current FY. If `proof_status` is 'verified' (or 'declared' if provisional allowed), subtract declared amounts from taxable income before applying slab rates.

---

## Phase E — Leave Requests

1. **Migration — `leave_requests` table** (if not already existing):
   ```sql
   CREATE TABLE IF NOT EXISTS leave_requests (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
     company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
     leave_type text NOT NULL CHECK (leave_type IN ('casual','sick','earned','maternity','paternity','comp_off','lwp')),
     start_date date NOT NULL,
     end_date date NOT NULL,
     days numeric NOT NULL,
     reason text,
     status text NOT NULL CHECK (status IN ('pending','approved','rejected','cancelled')) DEFAULT 'pending',
     reviewed_by uuid REFERENCES auth.users,
     reviewed_at timestamptz,
     review_comment text,
     created_at timestamptz DEFAULT now()
   );
   ```
   RLS: employees SELECT own + INSERT new. Admins/HR SELECT all for company + UPDATE status.

2. **`/ess/leaves` page**:
   - **Leave balance summary** at top: cards for each leave type showing available/used/total.
   - **"Apply Leave" form**: type dropdown, start date, end date, auto-calculate business days (exclude Sat/Sun), reason textarea. Submit creates row with `status='pending'`.
   - **My requests list**: table/cards of past requests — date range, type, days, status badge (pending=yellow, approved=green, rejected=red, cancelled=gray). "Cancel" button on pending requests.

3. **Admin approval**: on existing `/dashboard/leaves` page, add a "Pending Approvals" tab. Queue of pending leave requests: employee name, type, dates, days, reason. Approve/Reject buttons with optional comment field.

---

## Phase F — Employee Profile

1. **Migration — add columns to `employees` if missing**:
   ```sql
   ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone text;
   ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact text;
   ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_phone text;
   ALTER TABLE employees ADD COLUMN IF NOT EXISTS address text;
   ```

2. **`/ess/profile` page**:
   - **Read-only section**: name, emp_code, department, designation, date of joining, UAN, ESIC number, PAN (masked: show last 4 only), bank account (masked: last 4 only), basic salary structure (basic, HRA, DA, gross).
   - **Editable section**: phone, emergency contact name, emergency phone, address. Save button → updates `employees` row.
   - Optional: "Set password" section for employees who logged in via magic link and want to set a password → `supabase.auth.updateUser({ password })`.

3. **RLS**: employees can UPDATE only `phone, emergency_contact, emergency_phone, address` on their own row. Use a column-level check or a restrictive policy.

---

## Phase G — HR-Side ESS Management

1. On `/dashboard/employees` page:
   - Add "ESS" column in the employee table: status badge — "Not Invited" (gray) / "Invited" (yellow, show date) / "Active" (green, show date). Derive from `ess_invited_at` and `ess_activated_at`.
   - Add "Invite to ESS" action button per employee (or bulk invite checkbox + button). Calls `invite-ess` Edge Function. Disabled if employee has no `email`.

2. Ensure `email` is a visible/editable field on the employee add/edit form if not already.

3. On company settings or new `/dashboard/settings/ess` page: toggle "Enable Employee Self-Service" → stored as `companies.ess_enabled boolean DEFAULT false`. When disabled, all `/ess/*` routes show "Employee portal is not available for your organization."
