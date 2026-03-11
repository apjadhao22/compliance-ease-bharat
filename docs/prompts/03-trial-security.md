# 03 — Trial Management & Security Hardening

> Phases 6–7 of the Auth & Subscription track.
> Depends on Phase 4–5 (subscriptions table + useSubscription hook must exist).

---

## Phase 6 — Trial Management

1. **Auto-create trial on company setup**: when a new company is created (in the existing company setup flow), if no `subscriptions` row exists for that company, auto-insert:
   ```
   plan = 'professional'
   status = 'trialing'
   employee_limit = 100
   current_period_end = now() + interval '365 days'
   ```
   Do this in application code (after company insert), not via a database trigger.

2. **`<TrialBanner />` component** (`src/components/TrialBanner.tsx`):
   - Consumes `useSubscription()`.
   - If `status = 'trialing'`: show a top banner inside `DashboardLayout` (above page content, below header).
     - \> 30 days remaining: blue/info style, dismissible. Text: "Free trial: X days remaining."
     - ≤ 30 days remaining: orange/warning style, not dismissible. Text: "Your trial expires in X days. Upgrade now to avoid interruption."
     - Both have an "Upgrade" button linking to `/dashboard/settings/billing`.
   - If `status != 'trialing'`: render nothing.
   - Calculate days remaining from `current_period_end`.

3. **Trial expiry handling**:
   - When `status = 'past_due'` (set by webhook when trial period ends, or detected client-side if `current_period_end < now()` and `status = 'trialing'`):
     - Show a blocking modal overlay on all `/dashboard/*` pages: "Your trial has expired. Subscribe to continue using OpticompBharat." with pricing cards and subscribe buttons.
     - Allow read-only access: users can view existing data but all create/edit/delete actions are disabled. Use `useSubscription()` to check `isActive || isTrialing` before mutations.
     - The modal should not be closable — only action is subscribe or sign out.

---

## Phase 7 — Security Hardening

1. **Session timeout**:
   - In `DashboardLayout.tsx`, track last user activity (mouse move, keypress, click) via a `useIdleTimer` custom hook.
   - After 30 minutes of inactivity: call `supabase.auth.signOut()`, redirect to `/sign-in`, show toast "Session expired due to inactivity."
   - Reset timer on any user interaction.
   - Store last activity timestamp in a ref (not state — avoid re-renders).

2. **Auth event audit logging**:
   - In `DashboardLayout.tsx` (or a dedicated `useAuthAudit` hook), listen to `supabase.auth.onAuthStateChange()`.
   - On `SIGNED_IN`, `SIGNED_OUT`, `PASSWORD_RECOVERY`, `TOKEN_REFRESHED` events: insert a row into `audit_logs` table (or create if missing) with: `event_type`, `user_id`, `details` (JSON with IP if available from headers, user agent from `navigator.userAgent`), `created_at`.
   - Also log: role changes (from team page), subscription changes (from billing actions).

3. **Security settings page** (`/dashboard/settings/security`):
   - **Change password** form: new password input + confirm password. Calls `supabase.auth.updateUser({ password })`. Validate with same rules as sign-up.
   - **Active sessions**: display current session info (browser, last active). Note: Supabase doesn't expose full session list to client, so show current session details from `navigator.userAgent` + login timestamp from auth state.
   - **Sign out everywhere**: button that calls `supabase.auth.signOut({ scope: 'global' })`. Show confirmation dialog first.

4. **MFA (TOTP) enrollment** on the security page:
   - "Enable Two-Factor Authentication" section.
   - If MFA not enrolled:
     - "Set up 2FA" button → calls `supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator App' })`.
     - Display the returned QR code (TOTP URI) as a scannable image. Show the secret key as text fallback.
     - Verification step: 6-digit code input → `supabase.auth.mfa.challenge()` then `supabase.auth.mfa.verify({ factorId, challengeId, code })`.
     - On success: show "2FA enabled" confirmation.
   - If MFA enrolled: show status "2FA is active" with a "Disable 2FA" button → `supabase.auth.mfa.unenroll({ factorId })`.
   - **MFA challenge gate**: in `DashboardLayout.tsx`, after auth check, if user has MFA enrolled but current session's `aal` (Authenticator Assurance Level) is `aal1` (not `aal2`), redirect to a `/mfa-challenge` page where they enter their TOTP code before accessing dashboard.
   - Create `/mfa-challenge` page: 6-digit code input, verify via `mfa.challenge()` + `mfa.verify()`, redirect to `/dashboard` on success.
