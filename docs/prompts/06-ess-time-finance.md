# 06 — ESS: Timesheets, Expenses, Advances & Assets

> Phases I–J–K–L of the ESS track.
> Depends on: Phase H (ess_feature_config + useESSFeatures + ESSFeatureGate).
> Every page below MUST be wrapped in `<ESSFeatureGate feature="...">`.

---

## Phase I — Timesheet Self-Entry (`/ess/timesheets`)

1. **RLS on `timesheets`**: add policies:
   - Employees can SELECT own rows: `employee_id = get_employee_id_for_user(auth.uid())`.
   - Employees can INSERT with `status='pending'`.
   - Employees can UPDATE only rows where `status = 'pending'` (no editing approved timesheets).
   - Existing admin policies remain unchanged.

2. **`/ess/timesheets` page** (wrap in `<ESSFeatureGate feature="timesheets">`):
   - Week picker (Mon–Sun) at top.
   - Grid/card for each day: date, normal hours input (default from shift policy if assigned), overtime hours input, notes input, status badge.
   - Pre-fill expected hours from employee's `shift_policy_id` → `shift_policies` (start/end time → calculate expected hours). Show as placeholder/hint.
   - "Submit Week" button: inserts 5–7 rows (configurable working days) with `status='pending'`.
   - Below: history of past weeks — collapsed cards showing week range, total hours, status.
   - OSH compliance warning: if weekly OT exceeds applicable state limit, show orange banner. Import and use `checkWorkingHours()` from `src/lib/oshCompliance.ts` client-side to validate before submit.

3. **Admin approval**: on existing `/dashboard/timesheets` page, add a "Pending Approvals" tab:
   - Grouped by employee → week.
   - Show daily breakdown.
   - Bulk approve/reject per employee-week with optional comment.

---

## Phase J — Expense Claims (`/ess/expenses`)

1. **RLS on `expenses`**: add policies:
   - Employees SELECT own rows.
   - Employees INSERT with `status='pending'`.
   - Employees cannot UPDATE/DELETE once `status != 'pending'`.
   - Existing admin policies remain.

2. **`/ess/expenses` page** (wrap in `<ESSFeatureGate feature="expenses">`):
   - **Summary cards** at top: total pending (₹), total approved this month (₹), total reimbursed (₹).
   - **"New Claim" form** (dialog or inline):
     - Category dropdown: Travel, Meals, Office Supplies, Medical, Communication, Other.
     - Amount (₹), date, description textarea.
     - Receipt upload: file picker → upload to Supabase Storage `expense-receipts/{company_id}/{employee_id}/{uuid}.{ext}`. Store the path in the expense row.
     - Submit → insert with `status='pending'`.
   - **Claims list**: date, category, amount, status badge, receipt thumbnail (if image). Click to expand details. "Cancel" button on pending claims.

3. **Admin approval**: on existing `/dashboard/expenses` page, add "Pending Approvals" tab. List pending claims with employee name, category, amount, receipt preview, date. Approve/reject with comment.

---

## Phase K — Advance Requests (`/ess/advances`)

1. **RLS on `advances`**: add policies:
   - Employees SELECT own rows.
   - Employees INSERT with `status='pending'`.
   - Existing admin policies remain.

2. **`/ess/advances` page** (wrap in `<ESSFeatureGate feature="advances">`):
   - **Active advances section**: for each outstanding advance, show: original amount, monthly EMI, EMIs remaining, outstanding balance, repayment schedule table (month, deduction amount, remaining balance).
   - **"Request Advance" form**: amount (₹), reason textarea, preferred repayment tenure dropdown (3/6/12 months, shows estimated monthly deduction). Submit → insert with `status='pending'`.
   - **Past requests**: list with status badges.

3. **Admin approval**: on existing `/dashboard/advances` page, add "Pending" tab. On approval, admin sets actual repayment terms (amount per month, start month). Verify the approved advance feeds into `calculate-payroll` deduction logic (it should — check existing Edge Function).

---

## Phase L — Asset Acknowledgment (`/ess/assets`)

1. **Migration — update `assets` table**:
   ```sql
   ALTER TABLE assets ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES employees(id) ON DELETE SET NULL;
   ALTER TABLE assets ADD COLUMN IF NOT EXISTS acknowledged boolean DEFAULT false;
   ALTER TABLE assets ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz;
   ALTER TABLE assets ADD COLUMN IF NOT EXISTS return_requested_at timestamptz;
   ```

2. **RLS on `assets`**: add policy — employees can SELECT where `assigned_to = get_employee_id_for_user(auth.uid())`. Employees can UPDATE only `acknowledged` and `acknowledged_at` on their own assigned assets.

3. **`/ess/assets` page** (wrap in `<ESSFeatureGate feature="assets">`):
   - **Pending acknowledgments** section (highlighted): list of assets assigned to employee where `acknowledged = false`. Each has an "Acknowledge Receipt" button → sets `acknowledged = true, acknowledged_at = now()`.
   - **My assets** section: all assigned assets — name, type/category, serial number, assigned date, acknowledged status. Read-only.
   - No request/return functionality from ESS (admin manages assignments).
