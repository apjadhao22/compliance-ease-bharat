import { test, expect } from '@playwright/test';

/**
 * 06-dashboard-smoke.spec.ts
 * ────────────────────────────
 * Smoke tests: verify every major page loads without
 * crashing (no blank white screens, no unhandled errors).
 *
 * Enhanced (Phase D): All compliance framework pages added.
 *  - Overview   → "Command Center"
 *  - FnF        → "Full & Final Settlement" (route: /dashboard/fnf)
 *  - Calendar   → "Compliance Calendar"
 *  - OSH        → /dashboard/osh
 *  - IR         → /dashboard/ir
 *  - S&E        → /dashboard/se
 *  - GigCess    → /dashboard/gig-cess
 */

const PAGES = [
  // ── Core HR ──────────────────────────────────────────────────────────────
  { name: 'Overview',           path: '/dashboard',                 heading: /command center|welcome to opticompbharat/i },
  { name: 'Employees',          path: '/dashboard/employees',       heading: /employee/i },
  { name: 'Payroll',            path: '/dashboard/payroll',         heading: /payroll/i },
  { name: 'EPF / ESIC',         path: '/dashboard/epf-esic',        heading: /epf|esic|provident/i },
  { name: 'Professional Tax',   path: '/dashboard/pt',              heading: /professional tax|pt/i },
  { name: 'LWF',                path: '/dashboard/lwf',             heading: /lwf|labour welfare/i },
  { name: 'TDS',                path: '/dashboard/tds',             heading: /tds|income tax|tax deduct/i },
  { name: 'Bonus / Gratuity',   path: '/dashboard/bonus-gratuity',  heading: /bonus|gratuity/i },
  { name: 'Leaves',             path: '/dashboard/leaves',          heading: /leave/i },
  { name: 'Timesheets',         path: '/dashboard/timesheets',      heading: /timesheet/i },
  { name: 'Expenses',           path: '/dashboard/expenses',        heading: /expense/i },
  { name: 'Assets',             path: '/dashboard/assets',          heading: /asset/i },
  { name: 'Advances',           path: '/dashboard/advances',        heading: /advance/i },
  { name: 'Documents',          path: '/dashboard/documents',       heading: /document/i },
  { name: 'FnF Settlement',     path: '/dashboard/fnf',             heading: /full.*final|f.*f.*settlement/i },
  { name: 'Compliance Calendar',path: '/dashboard/calendar',        heading: /compliance.*calendar|calendar/i },
  { name: 'Registers',          path: '/dashboard/registers',       heading: /register/i },
  { name: 'Reports',            path: '/dashboard/reports',         heading: /report/i },
  // ── Compliance Frameworks (NEW — Phase D) ─────────────────────────────────
  { name: 'OSH Compliance',     path: '/dashboard/osh',             heading: /osh|occupational|safety|health/i },
  { name: 'IR Compliance',      path: '/dashboard/ir',              heading: /ir|industrial relations|standing order|grievance/i },
  { name: 'S&E Compliance',     path: '/dashboard/se',              heading: /s.*e|shops|establishment/i },
  { name: 'Gig / Platform Cess',path: '/dashboard/gig-cess',        heading: /gig|platform|cess|aggregator/i },
  { name: 'POSH',               path: '/dashboard/posh',            heading: /posh|prevention.*sexual|harassment/i },
  { name: 'Maternity',          path: '/dashboard/maternity',       heading: /maternity/i },
  { name: 'Equal Remuneration', path: '/dashboard/equal-remuneration', heading: /equal|remuneration/i },
  { name: 'Accidents',          path: '/dashboard/accidents',       heading: /accident/i },
  { name: 'Shifts',             path: '/dashboard/shifts',          heading: /shift/i },
  { name: 'Audit Log',          path: '/dashboard/audit-log',       heading: /audit/i },
  // Notice Board excluded — requires company setup to show content
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
  test('should show KPI metric cards or onboarding', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Overview page heading is either "Command Center" or "Welcome to OpticompBharat!"
    await expect(page.locator('h1, h2').filter({ hasText: /command center|welcome to opticompbharat/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('should not show Loading spinner forever', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForTimeout(3_000);
    // Any heading should be visible after a few seconds
    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });
});
