# 09 — ESS: Exit Flow, Dashboard Enhancement & Admin Approval Hub

> Phases S–T–U of the ESS track.
> Depends on: Phase H (ESSFeatureGate), and all prior ESS phases for the dashboard to aggregate.

---

## Phase S — Exit / Resignation Flow (`/ess/exit`)

1. Wrap in `<ESSFeatureGate feature="exit_request">`.

2. **Migration — `exit_requests` table**:
   ```sql
   CREATE TABLE exit_requests (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
     company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
     resignation_date date NOT NULL,
     last_working_date date NOT NULL,
     reason text,
     notice_period_days int DEFAULT 30,
     status text NOT NULL CHECK (status IN ('submitted','acknowledged','processing','completed','withdrawn')) DEFAULT 'submitted',
     acknowledged_by uuid REFERENCES auth.users,
     acknowledged_at timestamptz,
     fnf_settlement_id uuid REFERENCES fnf_settlements(id),
     asset_return_completed boolean DEFAULT false,
     created_at timestamptz DEFAULT now(),
     updated_at timestamptz DEFAULT now(),
     UNIQUE(employee_id)
   );
   ALTER TABLE exit_requests ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "Employee own exit_request" ON exit_requests FOR ALL
     USING (employee_id = get_employee_id_for_user(auth.uid()))
     WITH CHECK (employee_id = get_employee_id_for_user(auth.uid()));
   CREATE POLICY "Admin manage exit_requests" ON exit_requests FOR ALL
     USING (company_id IN (SELECT company_id FROM user_roles WHERE user_id = auth.uid() AND role IN ('owner','admin','hr_manager')))
     WITH CHECK (company_id IN (SELECT company_id FROM user_roles WHERE user_id = auth.uid() AND role IN ('owner','admin','hr_manager')));
   ```

3. **`/ess/exit` page**:
   - **No active exit request → "Initiate Resignation" form**:
     - Resignation date (default: today).
     - Proposed last working date (auto-calculate: resignation date + 30 days notice period). Show the calculation.
     - Reason (optional textarea).
     - Confirmation dialog before submit: "This will formally notify HR of your resignation. You can withdraw while the request is in 'submitted' status."
     - Submit → insert `exit_requests` row.
   - **Active exit request → Status view**:
     - Status timeline: Submitted → Acknowledged → Processing FnF → Completed.
     - **Exit checklist** (read-only, updated by admin):
       - ☐/☑ Manager acknowledged (from `acknowledged_at`)
       - ☐/☑ Assets returned (from `assets` table — list assigned assets with `acknowledged` status; show "Return pending" for each unacknowledged one)
       - ☐/☑ Advance balance cleared (query `advances` — show outstanding balance if any)
       - ☐/☑ FnF computed (from `fnf_settlement_id`)
       - ☐/☑ Relieving letter generated
     - **"Withdraw Resignation" button**: only visible while `status = 'submitted'`. Sets `status = 'withdrawn'`. Confirmation dialog first.
     - **Completed state**: show FnF breakdown (read-only, from linked `fnf_settlements` row), "Download Relieving Letter" button (generate PDF).

4. **Admin side — Exit management**: add to `/dashboard/employees` or create `/dashboard/exits`:
   - List of active exit requests: employee name, resignation date, last working date, status.
   - Actions per request:
     - "Acknowledge" → sets `status = 'acknowledged'`, `acknowledged_by`, `acknowledged_at`.
     - "Process FnF" → triggers existing `calculate-fnf` Edge Function, links resulting `fnf_settlements.id` to exit request, sets `status = 'processing'`.
     - "Mark Assets Returned" → sets `asset_return_completed = true`.
     - "Complete Exit" → sets exit request `status = 'completed'`, sets `employees.status = 'inactive'`.
   - Add this as a new tab or section — don't create a separate page if it fits naturally in employees.

---

## Phase T — ESS Dashboard Enhancement

1. **Update `/ess` (ESS Dashboard)** to be fully dynamic based on `useESSFeatures()`:

2. **Widget rendering rules** — only show widgets for enabled features, in this priority order:
   - **Latest Payslip** (if `payslips` enabled): card showing last month's gross, deductions, net pay. "View All" link to `/ess/payslips`.
   - **Leave Balance** (if `leave_requests` enabled): compact cards per leave type — available / total. "Apply Leave" button.
   - **Pending Actions** (aggregate):
     - Unacknowledged assets count (if `assets` enabled)
     - Pending timesheet submissions this week (if `timesheets` enabled)
     - Unread notices count (if `notices` enabled)
   - **Active Exit Request** (if `exit_request` enabled and employee has one): status badge + next action needed.
   - **Announcements** (if `notices` enabled): latest 3 unread notices as a compact list.
   - **Quick Actions row**: contextual buttons based on enabled features — "Apply Leave", "Submit Timesheet", "Claim Expense", "View Payslip", "File Grievance". Only show for enabled features. Max 4–5 buttons.

3. **Notification badges on ESS nav items**:
   - Notices: unread count badge.
   - Assets: unacknowledged count badge.
   - Leaves: pending approval count (for items the employee submitted).

---

## Phase U — Admin Unified Approval Hub

1. **Create `/dashboard/approvals` page**:
   - **Tabs**: All | Leaves | Timesheets | Expenses | Advances | Comp-Off | Regularization | Exit
   - Only show tabs for features enabled in `ess_feature_config`. Use `useESSFeatures()`.
   - **"All" tab**: merged feed of all pending requests sorted by date, newest first. Each row: employee name + avatar initial, request type badge, date, amount/details summary, approve/reject buttons.
   - **Per-type tabs**: filtered view of the same data. Type-specific columns:
     - Leaves: employee, type, dates, days, reason
     - Timesheets: employee, week, total hours, OT hours
     - Expenses: employee, category, amount, receipt link
     - Advances: employee, amount, tenure, reason
     - Comp-Off: employee, worked date, avail date, reason
     - Regularization: employee, date, original→requested status, reason
     - Exit: employee, resignation date, last working date, status
   - **Approve/Reject flow**: click opens a mini-dialog with optional comment field. Approve → updates respective table's `status`, `reviewed_by`, `reviewed_at`, `review_comment`. Reject → same with `status='rejected'`.
   - **Count badges** on each tab showing pending count.

2. **Migration — `approval_comments` table** (polymorphic comments):
   ```sql
   CREATE TABLE approval_comments (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     request_type text NOT NULL CHECK (request_type IN ('leave','timesheet','expense','advance','comp_off','regularization','exit')),
     request_id uuid NOT NULL,
     comment text NOT NULL,
     commented_by uuid NOT NULL REFERENCES auth.users,
     created_at timestamptz DEFAULT now()
   );
   ALTER TABLE approval_comments ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "Company scoped approval_comments" ON approval_comments FOR ALL
     USING (commented_by IN (SELECT user_id FROM user_roles WHERE company_id IN (
       SELECT company_id FROM user_roles WHERE user_id = auth.uid()
     )))
     WITH CHECK (commented_by = auth.uid());
   ```

3. **Audit logging**: every approve/reject action inserts a row into `audit_logs`: `event_type = 'approval'`, `details = { request_type, request_id, action: 'approved'|'rejected', comment }`.

4. **Sidebar**: add "Approvals" item to admin sidebar under the Organization group. Show a count badge of total pending approvals (sum across all types). Use a `usePendingApprovals()` hook that queries counts from each relevant table where `status = 'pending'`.

5. **Route**: add `/dashboard/approvals` to `App.tsx` with lazy loading + ErrorBoundary.
