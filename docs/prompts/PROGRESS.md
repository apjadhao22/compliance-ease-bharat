# Build Progress

> Start each Claude Code session with:
> `Read docs/prompts/PROGRESS.md, then implement the next unchecked file. Mark it done when complete.`

---

## Auth & Subscription

- [x] `01-auth-hardening.md` — Phase 1 (harden auth) + Phase 2 (social login, magic link)
- [x] `02-rbac-stripe.md` — Phase 3 (RBAC, team mgmt) + Phase 4 (Stripe integration) + Phase 5 (billing page)
- [x] `03-trial-security.md` — Phase 6 (trial management) + Phase 7 (security hardening, MFA)

## ESS Portal

- [x] `04-ess-core.md` — Phase A (auth linking) + B (layout) + C (payslips) + D (tax) + E (leaves) + F (profile) + G (HR mgmt)
- [x] `05-ess-config-engine.md` — Phase H (feature config table, useESSFeatures hook, admin settings page)
- [x] `06-ess-time-finance.md` — Phase I (timesheets) + J (expenses) + K (advances) + L (assets)
- [ ] `07-ess-docs-schedule.md` — Phase M (documents, notices) + N (schedule, regularization, comp-off)
- [ ] `08-ess-compliance.md` — Phase O (maternity) + P (annual statement) + Q (grievance) + R (POSH)
- [ ] `09-ess-exit-dashboard.md` — Phase S (exit flow) + T (ESS dashboard) + U (admin approval hub)

---

## Completion Notes

_After each file, note any issues, skipped items, or decisions made:_

| File | Date | Notes |
|------|------|-------|
| `01-auth-hardening.md` | 2026-03-11 | All phases done. Google OAuth + magic link on sign-in/sign-up. Password validation with inline errors. Forgot/reset/verify-email pages. DashboardLayout gates on email_confirmed_at. |
| `02-rbac-stripe.md` | 2026-03-11 | Migration: company_members + subscriptions + trigger (backfills existing). useRole + useSubscription hooks. RoleGuard component. Team page (/dashboard/team): invite by email, change roles, remove. Stripe edge functions: create-checkout + stripe-webhook (handles checkout.completed, subscription.updated/deleted, payment events). Billing page (/dashboard/billing): current plan card, trial countdown, pricing table, upgrade flow. Sidebar: Team + Billing under Account group. |
| `03-trial-security.md` | 2026-03-11 | Migration: subscriptions table (plan/status/employee_limit/current_period_end) + audit_logs table with RLS. useSubscription hook (isTrialing/isActive/isExpired/daysRemaining). useIdleTimer hook (30 min → auto sign-out). useAuthAudit hook (SIGNED_IN/OUT/TOKEN_REFRESHED → audit_logs). TrialBanner component (blue >30d dismissible, orange ≤30d non-dismissible, links to billing). Trial expiry blocking modal in DashboardLayout (non-closable, subscribe or sign out). Auto-create trial in CompanySetup on first company save. Security settings page (/dashboard/settings/security): change password + active session info + sign-out-everywhere + MFA TOTP enroll/verify/disable (QR + secret + 6-digit verify). MFA challenge gate in DashboardLayout (aal1→/mfa-challenge if aal2 enrolled). /mfa-challenge page. Billing page (/dashboard/settings/billing): plan card + pricing table. Sidebar Account group: Security + Billing + Team. Routes added in App.tsx. |
| `04-ess-core.md` | 2026-03-11 | Migration (20260311000100): employees.{auth_user_id, email, ess_invited_at, ess_activated_at, phone, emergency_contact, emergency_phone, address} + companies.ess_enabled + investment_declarations table (full RLS) + leave_requests ESS columns + get_employee_id_for_user() helper fn. Edge functions: invite-ess (admin invites employee via supabase auth) + link-ess-account (links auth.uid to employee row on first login). ESSLayout (mobile-first, horizontal tabs desktop + bottom tab bar mobile, ess_enabled guard). ESSLogin (magic link default + password toggle). ESSDashboard (latest payslip card + recent leaves). ESSPayslips (list + expand + PDF download via jsPDF). ESSTaxDeclarations (FY selector, old/new regime toggle, all 80C/D/NPS/HRA etc. fields, TDS estimate, proof upload to Supabase Storage). ESSLeaves (balance cards, apply dialog with business-day calc, cancel pending). ESSProfile (read-only employment + editable contact/emergency + set password). ESSDocuments (placeholder). Admin: TDS page → Verify Declarations tab. Leaves page → ESS Pending Approvals section. Employees page → ESS status column + Invite button (calls invite-ess). ESSSettings page (/dashboard/settings/ess): toggle ess_enabled + adoption stats. Sidebar: Settings group → ESS Portal. |
| `05-ess-config-engine.md` | 2026-03-13 | Migration (20260311000200): ess_feature_config table with 18 feature toggles (core ON by default, all others OFF) + RLS (admins write, employees read) + auto-create trigger on companies INSERT + backfill. useESSFeatures() hook (TanStack Query, 5min stale, works for both admin and ESS employee paths). ESSFeatureGate component (feature prop, skeleton loading, friendly locked card with back button). ESSLayout updated with dynamic navItems filtered by features (19 nav items total: Dashboard always visible + 18 conditional). Full ESSSettings admin page rebuilt: master portal toggle + 6 grouped feature cards (Core/Time/Finance/Docs/Compliance/Lifecycle) each with toggle + description + Save Changes button (upserts ess_feature_config, invalidates query cache). App.tsx + DashboardLayout already correct from 04 carry-over. |
| `06-ess-time-finance.md` | 2026-03-13 | Migration (20260313000100): RLS policies for timesheets (employee select/insert-pending/update-pending), expenses (employee select/insert-pending/update-pending), advances (employee select/insert-pending), assets (employee select own assigned + update acknowledged). Assets table: added acknowledged, acknowledged_at, return_requested_at columns. ESS pages: ESSTimesheets (week picker, daily grid, OSH OT warning >12h, submit week, 8-week history), ESSExpenses (summary cards, new claim dialog with Supabase Storage receipt upload, claims list), ESSAdvances (active advances with EMI schedule + progress bar, request dialog with tenure dropdown), ESSAssets (pending acknowledgment section with Acknowledge Receipt button, read-only my assets table). Admin pages updated: Timesheets gets "Pending Approvals" tab (grouped by employee+week, bulk approve/reject), Expenses gets "Pending Approvals" tab (per-claim approve/reject cards), Advances gets "Pending Approvals" tab (per-advance approve/reject cards). App.tsx: 4 new ESS routes (/ess/timesheets, /ess/expenses, /ess/advances, /ess/assets). ESSLayout already had all nav items from 05. |
