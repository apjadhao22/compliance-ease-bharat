# 01 — Auth Hardening & Social Login

> Phases 1–2 of the Auth & Subscription track.
> Do NOT break existing sign-in/sign-up functionality.

---

## Phase 1 — Harden Auth

1. **Password validation on `/sign-up`**: min 8 chars, 1 uppercase, 1 number, 1 special char. Show inline validation errors below the password field (not just toast). Use a `validatePassword()` utility in `src/lib/validations.ts`.

2. **Forgot password flow**:
   - Create `/forgot-password` page: email input → calls `supabase.auth.resetPasswordForEmail({ email, options: { redirectTo: origin + '/reset-password' } })`. Show success message after submission.
   - Create `/reset-password` page: listens for `PASSWORD_RECOVERY` event on `onAuthStateChange`, shows new password form, calls `supabase.auth.updateUser({ password })`.
   - Add "Forgot password?" link on `/sign-in` page below the password field.

3. **Email verification gate**:
   - Create `/verify-email` holding page: "Check your email to verify your account" message with a "Resend verification email" button.
   - In `DashboardLayout.tsx`: after auth check, if `user.email_confirmed_at` is null/undefined, redirect to `/verify-email` instead of rendering dashboard.

4. **Add all new routes** to `App.tsx`:
   - `/forgot-password`, `/reset-password`, `/verify-email`
   - Use lazy loading + ErrorBoundary pattern matching existing routes.

---

## Phase 2 — Social Login & Magic Link

1. **Google OAuth** on both `/sign-in` and `/sign-up`:
   - Add "Sign in with Google" button using `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: origin + '/dashboard' } })`.
   - Style: shadcn `Button variant="outline"` with a Google "G" SVG icon. Full width, placed above the email form with an "or" divider.
   - Note: Google provider must be enabled manually in Supabase Dashboard → Auth → Providers. The UI should work regardless.

2. **Magic link (passwordless)** on `/sign-in`:
   - Add a toggle or tab: "Password" vs "Email link" modes.
   - Email link mode: single email input → `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: origin + '/dashboard' } })`.
   - Show "Check your email for the login link" message after submission.
   - Keep password mode as the default.

3. **Auth redirect logic**: after any successful auth (password, OAuth, magic link), redirect to `/dashboard`. Handle the OAuth callback URL properly (Supabase handles this via the redirect URL, but ensure the app doesn't show a blank page during the callback).
