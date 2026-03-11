# OpticompBharat — Build Instructions

## Active Build Plan

All implementation prompts are in `docs/prompts/`. Execute them **in order** (01 → 09).
Each file contains 2–3 phases. Complete ALL phases in a file before moving to the next.
Track progress in `docs/prompts/PROGRESS.md` — mark each file done when complete.

## After EVERY phase

1. `npx tsc --noEmit` — fix all type errors before proceeding
2. `npx vitest run` — no regressions allowed
3. If migrations were added: `npx supabase gen types typescript --local > src/integrations/supabase/types.ts`
4. Verify the app still loads in browser (no white screens)

## Codebase Conventions (apply everywhere — do NOT duplicate in prompt files)

### Components & Styling
- Use shadcn/ui components (`Button`, `Card`, `Input`, `Dialog`, `Tabs`, `Badge`, `Switch`, etc.)
- Use `useToast()` from `@/hooks/use-toast` for success/error feedback
- Use `getSafeErrorMessage()` from `@/lib/safe-error` for error messages
- TailwindCSS for all styling — no CSS files
- Mobile-first responsive design

### Supabase
- Client: `import { supabase } from "@/integrations/supabase/client"`
- ALL new tables MUST have Row Level Security enabled
- RLS scoped via company chain: `auth.uid()` → `user_roles.company_id` → table
- Edge Functions: Deno runtime, import from `esm.sh`, secrets via `Deno.env.get()`
- Migrations go in `supabase/migrations/` with sequential timestamps (format: `YYYYMMDDHHMMSS`)
- After migrations: regenerate types

### Routing & Pages
- All pages lazy-loaded in `src/App.tsx` via `React.lazy()` + `Suspense` + `ErrorBoundary`
- Admin pages: `src/pages/dashboard/` → routes under `/dashboard/*`
- ESS pages: `src/pages/ess/` → routes under `/ess/*`
- Auth pages: `src/pages/` (SignIn, SignUp, ForgotPassword, etc.)

### Data Fetching
- TanStack Query v5 for all server state
- Supabase `.from().select()` for queries
- Supabase Edge Functions via `supabase.functions.invoke()` for complex operations

### Testing
- Vitest for unit/integration tests
- Playwright for E2E (against deployed URL)
- Existing test patterns in `tests/` and `src/lib/*.test.ts`

## Key Existing Files

- `src/App.tsx` — all routes
- `src/components/DashboardLayout.tsx` — admin sidebar + auth check
- `src/integrations/supabase/client.ts` — Supabase client
- `src/lib/calculations.ts` — all statutory calculation engines
- `supabase/functions/` — Edge Functions (calculate-payroll, calculate-fnf, audit-payroll, copilot-chat)

## Architecture Notes

- Data model: `auth.users` → `companies` (1:1) → `employees` → `payroll_runs` → `payroll_details`
- Compliance regime toggle: `legacy_acts` vs `labour_codes` in `companies` table
- ESS users are also `auth.users` but with `user_metadata.role = 'employee'` and linked via `employees.auth_user_id`
- Admin vs ESS routing is determined by `user_metadata.role`
