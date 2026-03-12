# OpticompBharat – End-to-End Testing Plan (Remote Mode)

This document describes how to test the OpticompBharat app end to end using Vitest + Playwright + direct Supabase/Edge‑function checks, against the **deployed** app and database (no localhost browser).

Repo structure (relevant for tests):

- Logic & compliance engines: `src/lib/**` (OSH, SE, IR, socialSecurity, wageCompliance, wageValidation, seRegisters, etc.).
- Dashboards: `src/pages/dashboard/*.tsx` (OSHCompliance, SECompliance, IRCompliance, GigCess, LWF, POSH, etc.).
- Edge functions: `functions/calculate-payroll`, `calculate-fnf`, `audit-payroll`, `compute-violations`, `copilot-chat`.
- Tests:
  - Unit/integration: `src/lib/*.test.ts`, `src/lib/**/socialSecurity.test.ts`, `src/lib/**/wage*.test.ts`, `src/lib/*Compliance.test.ts`.
  - E2E: `tests/e2e/01-employees.spec.ts` … `07-data-isolation.spec.ts`.
  - Additional spec: `tests/irCompliance.spec.ts`.

## 0. Remote Testing Setup

All automated testing should run against the **deployed Vercel URL** and live Supabase project.

Required environment variables (kept secret, not committed):

- `PLAYWRIGHTBASEURL` – deployed app URL (e.g. `https://opticomp-bharat.com`).
- `TESTEMAIL`, `TESTPASSWORD` – credentials of a test user in Supabase Auth.
- Supabase keys (service/admin or anon, depending on what you allow from CI) for schema and Edge Function checks.

Core commands:

- Unit / integration tests (Vitest):  
  `npm run test`
- E2E tests (Playwright, remote):  
  `PLAYWRIGHTBASEURL=$PLAYWRIGHTBASEURL npm run teste2e`
- Typecheck and build:  
  `npx tsc --noEmit`  
  `npm run build`

Playwright is already configured to use `PLAYWRIGHTBASEURL` in `playwright.config.ts` and to reuse auth via `tests/e2e/auth.setup.ts`.

---

## Phase A – Unit & Integration Tests (Compliance Engines + Reports)

**Goal:** High coverage for all new compliance engines (OSH, SE, IR, social security, wage) and report generators, with no network calls.

### A.1 Extend existing compliance tests

Update and extend these existing files:

- `src/lib/oshCompliance.test.ts`
  - Add scenarios for:
    - OSH Code applicability by worker count / industry.
    - Committee formation & medical‑check frequencies for hazardous vs non‑hazardous work.
    - Violation objects with correct fields (`violation_type`, `rule_source`, `limit_value`, `actual_value`, severity) as expected by `OSHCompliance.tsx`.

- `src/lib/seCompliance.test.ts`
  - Focus on Telangana Shops & Establishments rules:
    - Daily hours, weekly hours, spread‑over, max continuous work, rest intervals.
  - Include both compliant and violating timesheet patterns and check the reason text.

- `src/lib/irCompliance.test.ts`
  - Use `config/ir/standingOrderRules.ts` and related config to test:
    - Applicability of standing orders by headcount / category.
    - Union recognition thresholds.
    - Dispute / grievance timelines and mandatory committees.

- `src/lib/socialSecurity.test.ts`
  - Use `socialSecurity/pfEsicConfig.ts`, `gratuityRules.ts`, `gigCess.ts`:
    - PF/ESIC thresholds, caps, and split.
    - Gratuity for <5 years vs >5 years service, fixed‑term exception, ₹20L cap.
    - Gig cess: min of 1% turnover vs 5% gig payouts.

- `src/lib/wageCompliance.test.ts` and `src/lib/wageValidation.test.ts`
  - Use `wage/minimumWages.ts` and `wage/floorWage.ts`:
    - Distinguish floor‑wage vs state‑minimum violations vs compliant pay.
    - Code on Wages 50% wage rule.
    - Wage payment deadlines (e.g. 7th/10th of next month).

### A.2 Registers & reports

Create or extend tests for `src/lib/reports/seRegisters.ts`:

- For each supported state/form (e.g. MH Form II/V, KA Form T, TN and Delhi registers, TS Form A):
  - CSV includes all required header columns.
  - Fields requiring signatures are clearly marked (e.g. `[MANUAL]`).
  - CSV is syntactically valid (no broken quoting, not empty).

### A.3 Framework “integration” tests (pure TS)

Add tests that build in‑memory company+employee+timesheet+leave samples and run them through:

- `src/lib/oshCompliance.ts`
- `src/lib/seCompliance.ts`
- `src/lib/irCompliance.ts`

Assertions:

- Correct number of violations.
- Correct state, rule source, limit, and actual values.
- Objects are shaped as the dashboard pages expect.

### A.4 Run & fix

- Run `npm run test` until all tests pass.
- (Optional) Capture coverage and ensure all core rule branches are exercised.

---

## Phase B – Schema & RLS Verification (Remote Supabase)

**Goal:** Confirm latest migrations and RLS are applied correctly on the remote project.

Using Supabase SQL or REST:

1. Verify existence of framework and support tables:
   - OSH, IR, SE framework tables created in recent `20260308...` migrations.
   - `night_shift_consents`, `working_hour_violations`, `quarterly_ot_accumulation`.
   - `min_wage_*` columns on `payroll_details`.

2. Verify constraints and triggers:
   - Sync triggers for night‑shift consents between `employees` and `night_shift_consents`.
   - Unique constraints on OT accumulation per company / employee / quarter.

3. Verify RLS:
   - `rowsecurity` enabled on: `employees`, `payroll_details`, `timesheets`,
     OSH/SE/IR tables, `working_hour_violations`, `night_shift_consents`,
     `quarterly_ot_accumulation`.
   - Policies restrict access by tenant/company.

---

## Phase C – Edge Function Tests (Remote HTTP)

**Goal:** Prove that core Edge Functions behave correctly when hit remotely and that they write to/ read from Supabase as expected.

For each function in `functions/**/index.ts`, use Node or curl scripts with a real JWT for a test user:

1. `calculate-payroll`
   - POST for a known test company and month.
   - Assert each record has:
     - PF/ESIC/PT/TDS fields.
     - `min_wage_status` and other social‑security details.
   - Check that PT and minimum‑wage decisions match the rules in Phase A.

2. `calculate-fnf`
   - POST scenarios for:
     - <5 vs >5 years service.
     - Notice period given vs required (0 vs full).
   - Assert gratuity, leave encashment, notice‑pay shortfall, and net payout are correct.

3. `audit-payroll`
   - POST a small synthetic payroll sample.
   - Assert HTTP 200 and a structured `findings` array (even if empty); no 500s.

4. `compute-violations`
   - POST a test period for a test company.
   - After call, query `working_hour_violations` to confirm new rows with correct state, rule source, and values.

5. `copilot-chat`
   - Smoke test: POST a simple prompt with minimal context, assert 200 + valid JSON.

---

## Phase D – Strengthen Existing E2E Specs (Remote Playwright)

**Goal:** Upgrade 01–07 specs to validate full flows against the deployed app.

Command:

```bash
PLAYWRIGHTBASEURL=$PLAYWRIGHTBASEURL npm run teste2e 
### Enhancements (existing E2E specs)

- `tests/e2e/01-employees.spec.ts`
  - Create an employee with a unique name → verify in list → delete (if supported) for cleanup.
  - For a female employee, toggle night‑shift consent and later verify the OSH dashboard reflects it.

- `tests/e2e/02-payroll.spec.ts`
  - After running payroll:
    - Find the test employee from 01.
    - Validate PT and minimum‑wage badges against rules from Phase A.

- `tests/e2e/03-leaves.spec.ts`
  - Create and approve a leave request.
  - Verify leave balances update, and that EL encashment reflects in FnF.

- `tests/e2e/04-fnf.spec.ts`
  - Initiate FnF for a test employee.
  - Assert gratuity, encashment and deduction warnings behave as expected.

- `tests/e2e/05-documents.spec.ts`
  - Generate a document for a test employee.
  - Assert preview or download includes their name / code.

- `tests/e2e/06-dashboard-smoke.spec.ts`
  - Keep as “no crash across all routes”, including newer dashboards.

- `tests/e2e/07-data-isolation.spec.ts`
  - Keep as an RLS sentinel (fake `company_id` returns no data, direct table access is blocked).

---

### Phase E – New E2E Specs for OSH/SE/IR/Gig‑Cess

**Goal:** Cover each compliance framework dashboard and gig‑cess calculator end to end.

Create new Playwright specs under `tests/e2e`, for example: `08-compliance-frameworks.spec.ts`.

For each page:

#### E.1 OSHCompliance

- Visit `/dashboard/osh-compliance`.
- Assert heading and summary cards render (no JS errors).
- Click “refresh violations” / “run check” and wait:
  - Either a populated table or an explicit “no violations” message appears.
- Open dialogs:
  - Night shift consent, OSH registration, committee, checks.
- Verify required fields (employee, dates, check types).

#### E.2 SECompliance

- Visit `/dashboard/se-compliance`.
- Run SE compliance check and confirm summary/violations section updates.
- Trigger download for:
  - MH Form II or V.
  - KA Form T (or equivalents).
- Assert:
  - Files are CSV, non‑empty and have correct headers.

#### E.3 IRCompliance

- Visit `/dashboard/ir-compliance`.
- Verify standing orders / union / disputes widgets render.
- If UI supports adding an entry:
  - Add sample dispute or settlement.
  - Verify the row appears in the list with correct fields.

#### E.4 GigCess

- Visit `/dashboard/GigCess` (or the actual route).
- Fill turnover and gig‑payout fields.
- Assert calculated cess matches the logic in `socialSecurity/gigCess.ts`.
- Confirm explanatory notice about Code on Social Security / conservative assumption is visible.

#### E.5 Other compliance dashboards

For `LWF`, `BonusGratuity`, `Maternity`, `EqualRemuneration`, `POSH`, `Registers`, `ComplianceCalendar`, `Timesheets`:

- Visit each route from the sidebar.
- Assert main headings and cards/tables load.
- Open major dialogs (add registration, log case, run check, generate report).
- When a “Run check” or “Generate” action exists, click and verify either:
  - A non‑empty result table, or
  - A clear, correct empty state.

---

### Phase F – Cross‑Module End‑to‑End Flows

**Goal:** Simulate realistic multi‑page workflows.

Design dedicated specs for each flow:

#### Timesheet → OSH/SE

- Create a timesheet entry with obvious over‑work (e.g. 10+ hours, or >48 hours/week).
- Trigger timesheet/OSH check if a button exists.
- Verify OSH and SE dashboards show a corresponding violation for that employee/date.

#### Night‑shift consent sync

- From OSH page, record night‑shift consent for an employee.
- Check Employees page: consent flag/date updated.
- Optionally, update from Employees and confirm OSH page updates, exercising sync triggers.

#### Leave → FnF

- Create and approve EL for an employee.
- Start FnF settlement for that employee:
  - Verify EL encashment/balance reflects the newly approved leave.

#### Payroll → Registers → Calendar

- Run payroll for a given month.
- Download key registers (EPF/ESIC/SE) and confirm employees and wages align with payroll.
- Open Compliance Calendar and confirm due dates (PF/ESIC/PT/TDS, LWF, bonus, etc.) match that period.

---

### Phase G – Final Remote Regression & Acceptance

Run, in order:

```bash
npm run test
npx tsc --noEmit
npm run build
PLAYWRIGHTBASEURL=$PLAYWRIGHTBASEURL npm run teste2e

