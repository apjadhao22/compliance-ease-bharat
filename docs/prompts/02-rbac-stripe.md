# 02 — RBAC, Stripe Subscriptions & Billing Page

> Phases 3–4–5 of the Auth & Subscription track.
> Do NOT break existing auth or dashboard functionality.

---

## Phase 3 — RBAC & Team Management

1. **Migration — new tables**:
   ```sql
   CREATE TABLE user_roles (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
     company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
     role text NOT NULL CHECK (role IN ('owner','admin','hr_manager','viewer')),
     created_at timestamptz DEFAULT now(),
     UNIQUE(user_id, company_id)
   );

   CREATE TABLE invitations (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
     email text NOT NULL,
     role text NOT NULL CHECK (role IN ('admin','hr_manager','viewer')),
     token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
     expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
     accepted boolean DEFAULT false,
     created_at timestamptz DEFAULT now()
   );
   ```

2. **RLS policies**:
   - `user_roles`: SELECT own rows. Owners/admins can INSERT/UPDATE/DELETE for their company.
   - `invitations`: Owners/admins can full CRUD for their company.

3. **Auto-create owner role**: on sign-up, after the existing company creation logic, insert a `user_roles` row with `role='owner'` for the new user + company.

4. **`useUserRole()` hook** (`src/hooks/useUserRole.ts`):
   - Queries `user_roles` for current `auth.uid()` + current company.
   - Returns `{ role, isOwner, isAdmin, canEdit: role in ['owner','admin','hr_manager'], canView: true, loading }`.
   - Cached with TanStack Query.

5. **Team management page** (`/dashboard/settings/team`):
   - List team members: query `user_roles` joined with user email from auth. Show name/email, role badge, joined date.
   - Owners/admins see "Invite Member" form: email input + role dropdown (admin, hr_manager, viewer). Creates `invitations` row and displays the invite link (`/accept-invite/{token}`).
   - Owners can change other members' roles or remove them.

6. **Accept invite page** (`/accept-invite/:token`):
   - Validates token (not expired, not accepted).
   - If user is logged in: creates `user_roles` entry, marks invitation accepted, redirects to `/dashboard`.
   - If not logged in: redirects to `/sign-up` with token in query params; after sign-up, auto-accepts.

7. **Sidebar update**: add "Settings" group to `DashboardLayout.tsx` sidebar with items: Team (`/dashboard/settings/team`), Billing (`/dashboard/settings/billing`), Security (`/dashboard/settings/security`).

---

## Phase 4 — Stripe Subscription Integration

1. **Migration — subscriptions table**:
   ```sql
   CREATE TABLE subscriptions (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     company_id uuid NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
     stripe_customer_id text,
     stripe_subscription_id text,
     plan text NOT NULL CHECK (plan IN ('starter','professional','enterprise')) DEFAULT 'professional',
     status text NOT NULL CHECK (status IN ('trialing','active','past_due','canceled','incomplete')) DEFAULT 'trialing',
     current_period_start timestamptz,
     current_period_end timestamptz,
     employee_limit int DEFAULT 25,
     created_at timestamptz DEFAULT now(),
     updated_at timestamptz DEFAULT now()
   );
   ```
   RLS: users can SELECT for their own company (via `user_roles`).

2. **Edge Function — `create-checkout-session`** (`supabase/functions/create-checkout-session/index.ts`):
   - Accepts `{ priceId, companyId }` in POST body.
   - Auth required (verify JWT).
   - Creates Stripe customer if `stripe_customer_id` is null on the subscription row.
   - Creates Stripe Checkout Session: `mode: 'subscription'`, `metadata: { company_id }`, `success_url`, `cancel_url`.
   - Returns `{ url: session.url }`.
   - Import Stripe: `import Stripe from 'https://esm.sh/stripe@14?target=deno'`. Read `STRIPE_SECRET_KEY` from `Deno.env.get()`.

3. **Edge Function — `stripe-webhook`** (`supabase/functions/stripe-webhook/index.ts`):
   - Verifies Stripe signature using `STRIPE_WEBHOOK_SECRET`.
   - Handles events:
     - `checkout.session.completed`: upsert `subscriptions` row (set `stripe_subscription_id`, `status='active'`, plan based on price, period dates, employee_limit based on plan).
     - `customer.subscription.updated`: update `status`, `current_period_start`, `current_period_end`.
     - `customer.subscription.deleted`: set `status='canceled'`.
   - Use Supabase service role client for DB writes.

4. **Edge Function — `create-portal-session`** (`supabase/functions/create-portal-session/index.ts`):
   - Accepts `{ customerId }`.
   - Auth required.
   - Returns `{ url: portalSession.url }`.

5. **`useSubscription()` hook** (`src/hooks/useSubscription.ts`):
   - Queries `subscriptions` for current company.
   - Returns `{ plan, status, employeeLimit, periodEnd, isTrialing, isActive, isPastDue, loading }`.
   - TanStack Query, stale time 5 min.

---

## Phase 5 — Billing Dashboard Page

1. **Billing page** (`/dashboard/settings/billing`):
   - **Has subscription**: current plan card with plan name, status badge (trialing=blue, active=green, past_due=red, canceled=gray), employee usage bar ("X of Y employees"), renewal date. Two buttons: "Upgrade Plan" → calls `create-checkout-session`, "Manage Subscription" → calls `create-portal-session` and redirects.
   - **No subscription**: pricing grid with 3 plan cards:
     - Starter ₹999/mo — 25 employees, basic compliance
     - Professional ₹2,499/mo — 100 employees, full suite + form generation
     - Enterprise ₹4,999/mo — Unlimited, API, dedicated support
     - Each card has a "Subscribe" button → `create-checkout-session` with the right `priceId`.

2. **Feature gating**: in `/dashboard/employees` (Employees page), disable "Add Employee" button when current employee count >= `employeeLimit` from `useSubscription()`. Show an upgrade banner: "Employee limit reached. Upgrade your plan to add more." with link to billing page.
