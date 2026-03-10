# OpticompBharat – Indian Labour Law Compliance & Payroll

OpticompBharat is a full‑stack SaaS that turns Indian labour law compliance into a programmable rules engine with an integrated payroll workflow. It is built for Indian SMEs, CAs, payroll providers, and compliance teams who need to stay on top of PF, ESIC, PT, TDS, LWF, bonus, gratuity, POSH, maternity, OSH, SE, IR and more without living in spreadsheets.[file:78][file:79]

The repo is a Vite + React + TypeScript frontend with a Supabase/Postgres + Edge Functions backend, plus a fairly serious automated test suite (Vitest + Playwright) wired to run against a live deployment.[file:78][file:79]

---

## What this app does

At a high level, OpticompBharat gives you:

- A **compliance‑first dashboard** that keeps track of statutory risk, deadlines, and key labour law domains (PF/ESIC/PT/TDS, LWF, bonus, gratuity, POSH, maternity, equal remuneration, OSH, SE, IR).[file:78]  
- A payroll and HR layer (employees, payroll runs, timesheets, leaves, F&F, documents, shifts, notices) that feeds the compliance engine.[file:78]  
- A set of opinionated calculators and reports (Risk Calculator, ROI Calculator, gig‑cess estimator, minimum wage checks, S&E registers, EPF/ESIC ECRs, etc.).[file:78][file:79]  
- An AI‑augmented “copilot” to audit payroll and explain anomalies, wrapped in Supabase Edge Functions.[file:78][file:79]  

The guiding idea is simple: you should be “inspection‑ready” for most labour law checks with a few clicks, not a weekend of Excel marathons.

---

## Key features

### Payroll & HR

- Employees master, with expanded fields for wage structure, worker type, and compliance attributes.[file:78]  
- Payroll runs with PF/ESIC/PT/TDS and minimum‑wage status baked into the calculations.[file:78][file:79]  
- Leaves and full‑and‑final settlement, including gratuity, leave encashment, notice‑period recovery, and deduction‑limit checks based on Code on Wages / Code on Social Security.[file:78][file:79]  
- Timesheets, shifts and overtime tracking that feed into OSH/SE working‑hours rules.[file:78]  

### Compliance engines

- Social security engine for PF, ESIC, gratuity, gig‑cess and maternity benefits, encoded in TypeScript with tests.[file:78][file:79]  
- Wage validation and compliance logic for minimum wages (state + floor), the 50% wage rule, and payment deadlines.[file:78][file:79]  
- OSH, SE and IR frameworks with state‑specific working‑hours rules, standing orders, grievance committees, and violation tracking.[file:78][file:79]  
- POSH, maternity, equal remuneration and compliance calendar pages to keep non‑payroll obligations visible.[file:78]  

### Reports & registers

- S&E registers for multiple states (Maharashtra, Karnataka, Tamil Nadu, Delhi, Telangana) generated as CSVs, with tests for headers and syntax.[file:78][file:79]  
- EPF/ESIC ECR helpers and other statutory exports aligned with the underlying database schema.[file:78][file:79]  

### AI & automation

- `audit-payroll` Edge Function that takes payroll data, calls an LLM, and returns structured findings about potential compliance issues.[file:78][file:79]  
- `copilot-chat` Edge Function to answer ad‑hoc questions about payroll and compliance context.[file:78][file:79]  
- A dashboard “Compliance Web” and risk/ROI calculators to make the impact of automation visible to business users.[file:78]  

### Security, tenancy & testing

- Supabase Row Level Security (RLS) across core tables with explicit policies and data‑isolation tests.[file:78][file:79]  
- Night‑shift consent, working‑hours violations, and quarterly OT accumulation stored in dedicated tables and kept in sync via triggers.[file:78][file:79]  
- 140+ unit/integration tests (Vitest) and 100+ Playwright E2E tests as of March 2026, including OSH/SE/IR, registers, and cross‑module flows.[file:79]  

---

## Tech stack

- Frontend: Vite, React 18, TypeScript, React Router, shadcn‑ui, Tailwind CSS.[file:78]  
- State/data: TanStack Query, Supabase client.[file:78]  
- Backend: Supabase Postgres with SQL migrations and Edge Functions (Deno).[file:78]  
- Testing: Vitest (unit/integration), Playwright (E2E, remote against deployed URL), plus small Node scripts for schema and edge‑function checks.[file:78][file:79]  

---

