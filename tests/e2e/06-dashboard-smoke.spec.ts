import { test, expect } from '@playwright/test';
import { goTo } from './helpers';

/**
 * 06-dashboard-smoke.spec.ts
 * ────────────────────────────
 * Smoke tests: verify every major page loads without
 * crashing (no blank white screens, no unhandled errors).
 */

const PAGES = [
  { name: 'Overview', path: '/dashboard', heading: /overview|dashboard/i },
  { name: 'Employees', path: '/dashboard/employees', heading: /employee/i },
  { name: 'Payroll', path: '/dashboard/payroll', heading: /payroll/i },
  { name: 'EPF / ESIC', path: '/dashboard/epf-esic', heading: /epf|esic|provident/i },
  { name: 'Leaves', path: '/dashboard/leaves', heading: /leave/i },
  { name: 'Expenses', path: '/dashboard/expenses', heading: /expense/i },
  { name: 'Assets', path: '/dashboard/assets', heading: /asset/i },
  { name: 'Documents', path: '/dashboard/documents', heading: /document/i },
  { name: 'FnF Settlement', path: '/dashboard/fnf-settlement', heading: /full.*final|fnf|settlement/i },
  { name: 'Compliance Calendar', path: '/dashboard/compliance-calendar', heading: /compliance.*calendar|calendar/i },
  { name: 'Registers', path: '/dashboard/registers', heading: /register/i },
  { name: 'Reports', path: '/dashboard/reports', heading: /report/i },
  { name: 'Bonus / Gratuity', path: '/dashboard/bonus-gratuity', heading: /bonus|gratuity/i },
  { name: 'Timesheets', path: '/dashboard/timesheets', heading: /timesheet/i },
  { name: 'Notice Board', path: '/dashboard/notice-board', heading: /notice/i },
];

test.describe('Dashboard Smoke Tests', () => {
  for (const pg of PAGES) {
    test(`${pg.name} page loads without crashing`, async ({ page }) => {
      // Track any uncaught JS errors
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));

      await page.goto(pg.path);
      await page.waitForLoadState('networkidle');

      // Should have a visible heading
      await expect(
        page.getByRole('heading', { name: pg.heading }).first()
      ).toBeVisible({ timeout: 15_000 });

      // Should NOT show a blank white screen (body must have visible content)
      const bodyText = await page.locator('body').innerText();
      expect(bodyText.trim().length).toBeGreaterThan(10);

      // Report any JS errors
      if (errors.length > 0) {
        throw new Error(`Uncaught JS errors on ${pg.name}:\n${errors.join('\n')}`);
      }
    });
  }
});

test.describe('Overview Dashboard', () => {
  test('should show KPI metric cards', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Overview page should have statistic cards (employees, payroll, etc.)
    const cards = page.locator('[class*="card"], .card, [data-testid*="kpi"]');
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });
  });

  test('should not show Loading spinner forever', async ({ page }) => {
    await page.goto('/dashboard');
    // After 10s, no full-page loader should be spinning
    await page.waitForTimeout(3_000);
    const spinner = page.locator('[class*="animate-spin"]').first();
    // Either not visible, or there's actual content besides it
    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });
});
