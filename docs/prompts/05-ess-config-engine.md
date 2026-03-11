# 05 — ESS Feature Configuration Engine

> Phase H — the gating system that controls which ESS features are available.
> BUILD THIS BEFORE any extended ESS modules (06–09). Everything depends on it.

---

## Phase H — ESS Feature Config

1. **Migration — `ess_feature_config` table**:
   ```sql
   CREATE TABLE ess_feature_config (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     company_id uuid NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
     -- Core (default ON)
     payslips_enabled boolean DEFAULT true,
     tax_declarations_enabled boolean DEFAULT true,
     leave_requests_enabled boolean DEFAULT true,
     profile_edit_enabled boolean DEFAULT true,
     -- Time & Attendance (default OFF)
     timesheets_enabled boolean DEFAULT false,
     shift_schedule_enabled boolean DEFAULT false,
     comp_off_enabled boolean DEFAULT false,
     regularization_enabled boolean DEFAULT false,
     -- Finance (default OFF)
     expenses_enabled boolean DEFAULT false,
     advances_enabled boolean DEFAULT false,
     annual_statement_enabled boolean DEFAULT false,
     -- Documents & Communication (default OFF)
     documents_enabled boolean DEFAULT false,
     assets_enabled boolean DEFAULT false,
     notices_enabled boolean DEFAULT false,
     -- Compliance & Grievance (default OFF)
     grievance_enabled boolean DEFAULT false,
     posh_complaint_enabled boolean DEFAULT false,
     maternity_tracking_enabled boolean DEFAULT false,
     -- Lifecycle (default OFF)
     exit_request_enabled boolean DEFAULT false,
     --
     created_at timestamptz DEFAULT now(),
     updated_at timestamptz DEFAULT now()
   );

   ALTER TABLE ess_feature_config ENABLE ROW LEVEL SECURITY;

   -- Admins/owners can read + write
   CREATE POLICY "Admins manage ess_feature_config"
     ON ess_feature_config FOR ALL
     USING (company_id IN (SELECT company_id FROM user_roles WHERE user_id = auth.uid() AND role IN ('owner','admin')))
     WITH CHECK (company_id IN (SELECT company_id FROM user_roles WHERE user_id = auth.uid() AND role IN ('owner','admin')));

   -- ESS employees can read (to know which features are on)
   CREATE POLICY "Employees read ess_feature_config"
     ON ess_feature_config FOR SELECT
     USING (company_id = (SELECT company_id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1));
   ```

2. **Auto-create default config**: when a company is created, also insert a default `ess_feature_config` row with all defaults. Do this alongside the existing company creation logic.

3. **`useESSFeatures()` hook** (`src/hooks/useESSFeatures.ts`):
   - Queries `ess_feature_config` for current user's company.
   - For admin users: look up company via `user_roles`.
   - For ESS employees: look up company via `employees.auth_user_id`.
   - Returns `{ features: Record<string, boolean>, loading, error }`.
   - Features keys match column names without `_enabled` suffix (e.g., `payslips`, `tax_declarations`, `timesheets`).
   - TanStack Query, stale time 5 minutes.

4. **`<ESSFeatureGate>` wrapper component** (`src/components/ess/ESSFeatureGate.tsx`):
   - Props: `feature: string` (feature key), `children: ReactNode`.
   - Consumes `useESSFeatures()`.
   - If feature is enabled: render children.
   - If disabled: render a friendly card — "This feature is not enabled by your organization. Contact your HR administrator." with a back button.
   - If loading: render skeleton.
   - Use this to wrap every ESS page's content.

5. **Update `ESSLayout.tsx`**: consume `useESSFeatures()` to dynamically show/hide nav items. Only render nav links for enabled features. Group them:
   - Always visible: Dashboard
   - Conditional: Payslips, Tax, Leaves, Profile, Timesheets, Expenses, Advances, Assets, Documents, Notices, Schedule, Comp-Off, Regularization, Maternity, Annual Statement, Grievance, POSH, Exit

6. **Admin ESS settings page** (`/dashboard/settings/ess`):
   - Header: "Employee Self-Service Configuration"
   - Master toggle at top: "Enable Employee Self-Service Portal" (reads/writes `companies.ess_enabled`). When OFF, all individual toggles are greyed out/disabled.
   - Grouped toggle cards:
     - **Core**: Payslips, Tax Declarations, Leave Requests, Profile Edit
     - **Time & Attendance**: Timesheets, Shift Schedule, Comp-Off Requests, Attendance Regularization
     - **Finance**: Expense Claims, Advance Requests, Annual Salary Statement
     - **Documents & Communication**: Document Downloads, Asset Acknowledgment, Notice Board
     - **Compliance & Grievance**: Grievance Submission, POSH Complaints, Maternity Tracking
     - **Lifecycle**: Exit / Resignation
   - Each card: feature name, 1-line description, toggle switch.
   - "Save Changes" button → upserts `ess_feature_config`. Toast on success.

7. **Add route and sidebar item**: `/dashboard/settings/ess` in App.tsx. Add "ESS Settings" to the Settings sidebar group in DashboardLayout.
