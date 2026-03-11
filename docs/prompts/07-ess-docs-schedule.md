# 07 — ESS: Documents, Notices, Schedule, Comp-Off & Regularization

> Phases M–N of the ESS track.
> Depends on: Phase H (ESSFeatureGate). Every page MUST be gated.

---

## Phase M — Documents & Notice Board

### Documents (`/ess/documents`)

1. Wrap in `<ESSFeatureGate feature="documents">`.

2. **Page layout — three sections**:
   - **My Documents**: query `documents` table for employee's records (offer letter, appointment letter, salary revision, etc.). Each row: document name, type, date, "Download" button. Generate PDF on-the-fly using jsPDF where applicable, or serve stored file URL.
   - **Tax Documents**: link to Form 16 download (generated from TDS data for the FY), Form 12BB draft (summary of investment declarations — pull from `investment_declarations` table for current FY). Generate as PDF.
   - **Payslip Archive**: shortcut link to `/ess/payslips`.

3. RLS: employees can SELECT documents linked to their employee record.

### Notice Board (`/ess/notices`)

1. Wrap in `<ESSFeatureGate feature="notices">`.

2. **Migration — `notice_reads` table**:
   ```sql
   CREATE TABLE notice_reads (
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
   ```

3. **`/ess/notices` page**:
   - List of notices from `notices` table for employee's company. Show: title, date posted, priority badge (high=red, normal=blue, low=gray), body preview.
   - Click to expand: full body. On expand, auto-insert `notice_reads` row if not exists (mark as read).
   - Unread notices styled differently (bold title, dot indicator).
   - Unread count badge on the ESS nav item.

4. **ESS Dashboard widget**: latest 3 unread notices as a compact card list.

---

## Phase N — Shift Schedule, Comp-Off & Regularization

### Shift Schedule (`/ess/schedule`)

1. Wrap in `<ESSFeatureGate feature="shift_schedule">`.

2. **`/ess/schedule` page**:
   - **My shift card**: employee's assigned shift from `shift_policies` (via `shift_policy_id`). Show: shift name, start time, end time, night shift badge if applicable, per-day allowance.
   - **Monthly calendar view**: simple grid showing day types — working day (white), weekly off (gray), holiday (blue, from `compliance_calendar`), approved leave (green, from `leave_requests`). Current day highlighted.
   - Read-only. Footer note: "Contact HR for shift changes."

### Attendance Regularization (`/ess/regularization`)

1. Wrap in `<ESSFeatureGate feature="regularization">`.

2. **Migration — `regularization_requests` table**:
   ```sql
   CREATE TABLE regularization_requests (
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
   CREATE POLICY "Employee own regularization" ON regularization_requests FOR ALL
     USING (employee_id = get_employee_id_for_user(auth.uid()))
     WITH CHECK (employee_id = get_employee_id_for_user(auth.uid()));
   CREATE POLICY "Admin manage regularization" ON regularization_requests FOR ALL
     USING (company_id IN (SELECT company_id FROM user_roles WHERE user_id = auth.uid() AND role IN ('owner','admin','hr_manager')))
     WITH CHECK (company_id IN (SELECT company_id FROM user_roles WHERE user_id = auth.uid() AND role IN ('owner','admin','hr_manager')));
   ```

3. **`/ess/regularization` page**:
   - **Submit form**: date picker (only past dates), original status (auto-fill from timesheet if exists, or "absent"), requested status dropdown, reason textarea. Submit → insert.
   - **My requests list**: date, requested status, reason, review status badge.

### Comp-Off Requests (`/ess/comp-off`)

1. Wrap in `<ESSFeatureGate feature="comp_off">`.

2. **Migration — `comp_off_requests` table**:
   ```sql
   CREATE TABLE comp_off_requests (
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
   -- Same RLS pattern as regularization_requests
   ```

3. **`/ess/comp-off` page**:
   - **Request form**: date worked (must be a holiday or weekly off — validate against `compliance_calendar` / shift), preferred avail date, reason. Submit → insert.
   - **My requests**: worked date, avail date, status badge, review comment.

4. **Admin approvals for both**: add "Regularization" and "Comp-Off" tabs on `/dashboard/timesheets` or `/dashboard/leaves` — pending approval queues with approve/reject + comment.
