import { test, expect, request } from '@playwright/test';

/**
 * 07-data-isolation.spec.ts
 * ───────────────────────────
 * CRITICAL: Tests that Row Level Security (RLS) prevents
 * one company from reading another company's data.
 *
 * Supabase URL and key are injected from environment variables.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';
const FAKE_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

test.describe('Data Isolation (RLS)', () => {
  test.skip(!SUPABASE_URL, 'VITE_SUPABASE_URL not set — skipping RLS tests');

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

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0); // RLS should return empty, not foreign rows

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

    const response = await ctx.get('/rest/v1/companies?select=id,name');
    const body = await response.json();
    if (Array.isArray(body)) {
      expect(body).toHaveLength(0);
    } else {
      expect(body).toMatchObject({ message: expect.any(String) });
    }

    await ctx.dispose();
  });

  test('app redirects unauthenticated users away from dashboard', async ({ browser }) => {
    // Create a brand new context with no cookies or storage (truly logged-out)
    const freshCtx = await browser.newContext({ storageState: undefined });
    const freshPage = await freshCtx.newPage();
    
    await freshPage.goto('https://compliance-ease-bharat.vercel.app/dashboard');
    // Should redirect to sign-in
    await freshPage.waitForURL(/sign-in|login|auth/i, { timeout: 15_000 });
    await expect(
      freshPage.getByRole('heading', { name: /welcome|sign in|log in/i }).first()
    ).toBeVisible({ timeout: 5_000 });
    
    await freshCtx.close();
  });
});
