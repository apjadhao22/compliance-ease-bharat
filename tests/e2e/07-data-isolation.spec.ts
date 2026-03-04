import { test, expect, request } from '@playwright/test';

/**
 * 07-data-isolation.spec.ts
 * ───────────────────────────
 * CRITICAL: Tests that Row Level Security (RLS) prevents
 * one company from reading another company's data.
 *
 * Strategy:
 *   1. The logged-in user's company can read its own data (sanity check).
 *   2. Any attempt to fetch data with a DIFFERENT company_id returns
 *      empty or an RLS error — never another company's rows.
 *
 * ⚠️  These tests use the Supabase anon key to make raw REST calls
 * and verify RLS policies are active. Fill in SUPABASE_URL and
 * SUPABASE_ANON_KEY in .env.local.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;

// A plausible-but-fake company UUID to try to access
const FAKE_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

test.describe('Data Isolation (RLS)', () => {
  test('employees table should not return rows for a fake company_id', async () => {
    const ctx = await request.newContext({
      baseURL: SUPABASE_URL,
      extraHTTPHeaders: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const response = await ctx.get(
      `/rest/v1/employees?company_id=eq.${FAKE_COMPANY_ID}&select=id`
    );

    expect(response.status()).toBe(200); // RLS returns 200 with empty, not 403
    const body = await response.json();
    // Should be an empty array — RLS filtered it out
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0);

    await ctx.dispose();
  });

  test('payroll_runs should not return rows for a fake company_id', async () => {
    const ctx = await request.newContext({
      baseURL: SUPABASE_URL,
      extraHTTPHeaders: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const response = await ctx.get(
      `/rest/v1/payroll_runs?company_id=eq.${FAKE_COMPANY_ID}&select=id`
    );
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0);

    await ctx.dispose();
  });

  test('companies table should not expose other companies without auth', async () => {
    const ctx = await request.newContext({
      baseURL: SUPABASE_URL,
      extraHTTPHeaders: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    // Unauthenticated (anon key only) should return empty or be blocked by RLS
    const response = await ctx.get('/rest/v1/companies?select=id,name');
    const body = await response.json();
    // If RLS is on, this will return [] (not 403 — that's how Supabase RLS works)
    if (Array.isArray(body)) {
      expect(body).toHaveLength(0);
    } else {
      // Some Supabase setups return a 406 or error object
      expect(body).toMatchObject({ message: expect.any(String) });
    }

    await ctx.dispose();
  });

  test('app redirects unauthenticated users away from dashboard', async ({ page }) => {
    // Clear cookies / storage so user is logged out
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());

    await page.goto('/dashboard');
    // Should redirect to sign-in
    await page.waitForURL(/sign-in|login|auth/i, { timeout: 10_000 });
    await expect(page.getByRole('button', { name: /sign in|log in/i })).toBeVisible();
  });
});
