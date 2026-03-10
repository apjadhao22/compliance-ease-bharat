# OpticompBharat — Codebase Memory

## What It Is
Indian statutory HR compliance SaaS. React + Vite + Supabase + OpenAI.
App name in UI: **OpticompBharat**. Brand name in code/files: `compliance-ease-bharat`.

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, shadcn/ui (Radix), React Router v6, TanStack Query v5, Recharts, jsPDF
- **Backend**: Supabase (Postgres + Auth + Edge Functions in Deno/TypeScript)
- **AI**: OpenAI gpt-4o-mini via Edge Functions (payroll audit + copilot chat)
- **Testing**: Vitest (unit), Playwright (e2e)

## Key Architecture
- All pages lazy-loaded via React.lazy + Suspense + ErrorBoundary per route
- Auth: Supabase Auth, checked in DashboardLayout (redirects to /sign-in if no session)
- Data model: user → company (1:1) → employees → payroll_runs → payroll_details
- Row Level Security on ALL tables (user_id → company_id chain)
- Compliance regime toggle: `legacy_acts` vs `labour_codes` (stored in companies table)

## Route Map (`/dashboard/*`)
- `/` → Overview (health score, trends)
- `/company` → CompanySetup
- `/employees` → Employees (with bulk upload)
- `/payroll` → Payroll (calculate-payroll Edge Fn)
- `/epf-esic` → EPF & ESIC
- `/pt` → Professional Tax
- `/bonus-gratuity` → Bonus & Gratuity
- `/tds` → TDS
- `/lwf` → Labour Welfare Fund
- `/fnf` → F&F Settlement (calculate-fnf Edge Fn)
- `/leaves` → Leaves
- `/timesheets` → Timesheets
- `/accidents` → WC & Accidents
- `/maternity` → Maternity
- `/equal-remuneration` → Equal Remuneration
- `/osh` → OSH Compliance (working hours/OT validator)
- `/ir` → IR Compliance (standing orders, grievances, IR events)
- `/se` → Shops & Establishments Compliance
- `/posh` → POSH
- `/registers` → Statutory Registers
- `/calendar` → Compliance Calendar
- `/reports` → Reports (EPF ECR, ESIC ECR, PDF payslips, Form 16)
- `/audit-log` → Audit Trail
- `/notice-board` → Notice Board
- `/documents` → Documents
- `/shifts` → Shift Policies
- `/advances` → Advances
- `/assets` → Assets
- `/expenses` → Expenses
- `/form-ii-upload` → Form II Upload

## Core Calculation Engine (`src/lib/calculations.ts`)
All Indian statutory computations:
- `defineWages()` — 50% wage rule (Code on Wages 2019)
- `calculateEPF()` — 12% employee, 3.67% employer PF + 8.33% EPS
- `calculateESIC()` — 0.75% employee, 3.25% employer; ceiling ₹21,000; CEIL rounding
- `calculatePT()` — Multi-state slabs (MH, KA, TN, KL, GJ); Feb adjustment for MH
- `calculateBonus()` — 8.33%–20%, ceiling ₹7000 or min wage, eligibility ₹21,000
- `calculateGratuity()` — 15/26 formula, 5yr min, ₹20L cap; fixed-term 1yr min
- `calculateTDS()` — New Tax Regime FY 2025-26; ₹75K std deduction; 87A rebate ≤7L
- `calculateLWF()` — June + Dec only; employee ₹25, employer ₹75 (Maharashtra)
- `calculateWC()` — Workmen's Compensation; risk-rate based premium
- `buildPayEquityBands()` / `flagPayGaps()` — Equal Remuneration analytics

## Other Compliance Libs
- `src/lib/wageCompliance.ts` — Validates payment deadlines & deduction % limits
- `src/lib/oshCompliance.ts` — Working hours validator (daily/weekly/quarterly OT; women night shift)
- `src/lib/seCompliance.ts` — State S&E rules validator
- `src/lib/wageValidation.ts` — Minimum wage checks
- `src/lib/config/ir/standingOrderRules.ts` — IR Code: Standing Orders (≥300), Grievance (≥20)
- `src/lib/socialSecurity/gigCess.ts` — Aggregator cess placeholder

## Supabase Edge Functions
- `calculate-payroll` — Full batch payroll engine (500/batch); handles leaves, expenses, WC
- `calculate-fnf` — Full & Final Settlement calculator
- `audit-payroll` — AI (GPT-4o-mini) payroll anomaly detector
- `copilot-chat` — AI HR compliance assistant (state + regime aware)

## Database Tables (Key)
`companies`, `employees`, `payroll_runs`, `payroll_details`, `bonus_calculations`,
`gratuity_calculations`, `leave_requests`, `maternity_cases`, `fnf_settlements`,
`accidents`, `posh_cases`, `timesheets`, `assets`, `expenses`, `advances`,
`documents`, `shift_policies`, `audit_logs`, `notices`, `statutory_registers`,
`standing_orders`, `grievance_committees`, `grievances`, `ir_events`,
`osh_safety_measures`, `se_registrations`, `social_security_worker_types`

## Config Files (`src/lib/config/`)
- `wage/`: bonusRules, floorWage, minimumWages, paymentRules, types
- `socialSecurity/`: pfEsicConfig, gratuityRules, maternityRules
- `osh/`: workingHours, welfareRules
- `se/`: workingHours (state-wise S&E rules)
- `ir/`: standingOrderRules
- `leave/`: encashmentRules

## Compliance Regime
Companies choose `legacy_acts` or `labour_codes`. The regime affects:
- 50% wage rule enforcement (labour_codes only)
- Standing Orders threshold (300 employees)
- EPF/ESIC wage base calculation
- Copilot/Audit AI context
