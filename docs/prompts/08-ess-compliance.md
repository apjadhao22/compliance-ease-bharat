# 08 — ESS: Maternity, Annual Statement, Grievance & POSH

> Phases O–P–Q–R of the ESS track.
> Depends on: Phase H (ESSFeatureGate). Every page MUST be gated.

---

## Phase O — Maternity / Paternity Tracking (`/ess/maternity`)

1. Wrap in `<ESSFeatureGate feature="maternity_tracking">`.

2. **RLS on `maternity_cases`**: add policy — employees can SELECT rows where their `employee_id` matches (via `get_employee_id_for_user(auth.uid())`). Employees can INSERT (to apply). Existing admin policies remain.

3. **`/ess/maternity` page**:
   - **If active maternity case exists**: show status timeline with steps — Applied → Approved → On Leave → Returned. Show: expected due date, leave start/end dates, weeks entitled (26 for first two children, 12 for third+), weeks used, weeks remaining.
   - **If no active case**: show eligibility info card:
     - Women: "26 weeks paid maternity leave (first 2 children), 12 weeks for third+. Must have worked 80 days in preceding 12 months."
     - For companies under Labour Codes: also mention adoption/commissioning mother entitlements (12 weeks).
   - **"Apply for Maternity Leave" button**: opens form — expected due date, type (maternity/adoption), notes. Creates `maternity_cases` row with `status='applied'` AND a corresponding `leave_requests` entry with `leave_type='maternity'`.
   - **For male employees**: show paternity leave info based on company policy (not statutory, but common). Simple leave request link to `/ess/leaves` with paternity pre-selected if available.

4. Admin side: existing `/dashboard/maternity` page should display new applications for approval. No changes needed unless `maternity_cases` lacks a status workflow — verify and add if missing.

---

## Phase P — Annual Salary Statement (`/ess/annual-statement`)

1. Wrap in `<ESSFeatureGate feature="annual_statement">`.

2. **`/ess/annual-statement` page** — purely computed, no new tables:
   - **FY selector**: dropdown (2024-25, 2025-26, 2026-27). Default to current FY.
   - **Fetch**: all `payroll_details` rows for the employee for April–March of selected FY. Join with `payroll_runs` for month info.
   - **Summary cards at top**:
     - Total Gross Earned
     - Total Deductions (EPF + ESIC + PT + TDS + LWF + other)
     - Total Net Paid
     - Total Employer PF Contribution
     - Total Employer ESIC Contribution
   - **Monthly breakdown table**: columns — Month, Basic, HRA, DA, Allowances, Gross, EPF (EE), ESIC (EE), PT, TDS, LWF, Other Ded., Net Pay. One row per month. Totals row at bottom.
   - **"Download PDF" button**: generate via jsPDF —
     - Header: company name, company PAN/TAN, employee name, emp code, PAN, UAN, FY.
     - Monthly breakdown table (same as on screen).
     - Totals row.
     - Footer: "This is a system-generated document from OpticompBharat."
   - Handle missing months gracefully (show "—" or ₹0).

---

## Phase Q — Grievance Submission (`/ess/grievance`)

1. Wrap in `<ESSFeatureGate feature="grievance">`.

2. **Migration — update `grievances` table** (add columns if missing):
   ```sql
   ALTER TABLE grievances ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users;
   ALTER TABLE grievances ADD COLUMN IF NOT EXISTS submitted_by_employee_id uuid REFERENCES employees(id);
   ALTER TABLE grievances ADD COLUMN IF NOT EXISTS is_anonymous boolean DEFAULT false;
   ALTER TABLE grievances ADD COLUMN IF NOT EXISTS employee_visible_status text
     CHECK (employee_visible_status IN ('submitted','under_review','resolved','closed')) DEFAULT 'submitted';
   ALTER TABLE grievances ADD COLUMN IF NOT EXISTS resolution_notes text;
   ALTER TABLE grievances ADD COLUMN IF NOT EXISTS category text
     CHECK (category IN ('workplace_safety','harassment','wage_dispute','discrimination','working_conditions','other'));
   ```

3. **RLS on `grievances`**:
   - Employees can INSERT for their company.
   - Employees can SELECT only their own rows (where `submitted_by_employee_id = get_employee_id_for_user(auth.uid())`).
   - Admins can SELECT/UPDATE all for company.

4. **`/ess/grievance` page**:
   - **Info banner**: "Grievances are reviewed by the Grievance Redressal Committee. For companies with 20+ employees, this committee is mandatory under the Industrial Relations Code, 2020."
   - **"File Grievance" form**:
     - Subject (text input)
     - Category dropdown: Workplace Safety, Harassment, Wage Dispute, Discrimination, Working Conditions, Other
     - Description (textarea, min 50 chars)
     - Anonymous toggle: if ON, `is_anonymous = true`. Explain: "Your identity will be recorded for tracking but hidden from the review committee."
     - File attachment (optional): upload to Supabase Storage `grievances/{company_id}/{uuid}`.
     - Submit → insert row.
   - **"My Grievances" list**: date, subject, category badge, status badge. Click to view — shows description, resolution notes (if any), status timeline.

---

## Phase R — POSH Complaint Filing (`/ess/posh`)

1. Wrap in `<ESSFeatureGate feature="posh_complaint">`.

2. **Migration — update `posh_cases` table** (add columns if missing):
   ```sql
   ALTER TABLE posh_cases ADD COLUMN IF NOT EXISTS complainant_employee_id uuid REFERENCES employees(id);
   ALTER TABLE posh_cases ADD COLUMN IF NOT EXISTS complaint_nature text
     CHECK (complaint_nature IN ('verbal','physical','visual','quid_pro_quo','hostile_environment','cyber_online','other'));
   ALTER TABLE posh_cases ADD COLUMN IF NOT EXISTS incident_date date;
   ALTER TABLE posh_cases ADD COLUMN IF NOT EXISTS description text;
   ALTER TABLE posh_cases ADD COLUMN IF NOT EXISTS witness_names text;
   ALTER TABLE posh_cases ADD COLUMN IF NOT EXISTS evidence_path text;
   ALTER TABLE posh_cases ADD COLUMN IF NOT EXISTS next_hearing_date date;
   ```

3. **RLS on `posh_cases`**:
   - Employees can INSERT.
   - Employees can SELECT only where `complainant_employee_id = get_employee_id_for_user(auth.uid())`.
   - Admins (IC members) can SELECT/UPDATE all for company.

4. **`/ess/posh` page**:
   - **Info section** (always visible):
     - What POSH covers (Sexual Harassment of Women at Workplace Act, 2013).
     - IC committee details (pull from company config if stored, otherwise generic text).
     - Confidentiality assurance: "All complaints are treated with strict confidentiality."
     - External recourse: "You may also file a complaint with the Local Complaints Committee through the District Officer."
   - **"File Complaint" form**:
     - Nature of complaint: dropdown (Verbal, Physical, Visual, Quid Pro Quo, Hostile Environment, Cyber/Online, Other).
     - Date of incident.
     - Description (textarea, required).
     - Witness names (optional text).
     - Evidence upload → Supabase Storage `posh-complaints/{company_id}/{uuid}`. Store path in `evidence_path`.
     - Submit → insert row with `complainant_employee_id`.
   - **"My Complaints" list** (minimal for confidentiality):
     - Date filed, status badge, next hearing date (if set).
     - Do NOT show respondent details.
     - Do NOT show detailed case notes — only: status and resolution outcome when closed.

5. Admin side: existing `/dashboard/posh` page should surface new complaints for the IC. Verify it works with the new columns.
