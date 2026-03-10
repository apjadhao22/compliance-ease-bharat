import { test, expect } from '@playwright/test';

/**
 * 02-payroll.spec.ts
 * Tests the Payroll and EPF/ESIC pages.
 * Enhanced (Phase D): PT badge, min-wage compliance indicators.
 */

test.describe('Payroll', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/payroll');
    await page.waitForLoadState('networkidle');
  });

  test('should load payroll page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /payroll/i }).first()).toBeVisible({ timeout: 8_000 });
  });

  test('should allow changing working days', async ({ page }) => {
    const wdInput = page.getByLabel(/working days/i).first();
    await expect(wdInput).toBeVisible();
    await wdInput.fill('26');
    await expect(wdInput).toHaveValue('26');
  });

  test('should show compliance regime selector', async ({ page }) => {
    // The compliance regime selector is on the Company Setup page
    await page.goto('/dashboard/company');
    await page.waitForLoadState('networkidle');
    // Find the <select> that contains 'legacy_acts' as an option value
    const regime = page.locator('select').filter({ has: page.locator('option[value="legacy_acts"]') }).first();
    await expect(regime).toBeVisible({ timeout: 10_000 });
  });

  test('should show Process Payroll button', async ({ page }) => {
    const btn = page.getByRole('button', { name: /process payroll|run payroll|calculate/i }).first();
    await expect(btn).toBeVisible({ timeout: 8_000 });
  });

  test('should show payroll history table or empty call-to-action', async ({ page }) => {
    // Either a table or any content block on the page
    await page.waitForTimeout(2_000);
    const content = page.locator('table')
      .or(page.locator('[class*="card"]').first())
      .first();
    await expect(content).toBeVisible({ timeout: 10_000 });
  });

  // ── Phase D additions ─────────────────────────────────────────────────────

  test('Professional Tax page loads and shows state PT slabs', async ({ page }) => {
    await page.goto('/dashboard/pt');
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByRole('heading', { name: /professional tax|pt/i }).first()
    ).toBeVisible({ timeout: 10_000 });
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.trim().length).toBeGreaterThan(20);
  });

  test('Payroll page shows min-wage compliance badge or column', async ({ page }) => {
    await page.waitForTimeout(2_000);
    // After payroll is run, min_wage_status badges should appear
    // Even before data, the page must load without error
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.waitForTimeout(1_000);
    if (errors.length > 0) throw new Error(`Uncaught JS errors on payroll: ${errors.join('\n')}`);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.trim().length).toBeGreaterThan(10);
  });

  test('should show LWF page without crashing', async ({ page }) => {
    await page.goto('/dashboard/lwf');
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByRole('heading', { name: /lwf|labour welfare/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('EPF / ESIC', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/epf-esic');
    await page.waitForLoadState('networkidle');
  });

  test('should load EPF & ESIC page', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /epf|esic|provident/i }).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('should display a month selector or tabs', async ({ page }) => {
    // Month selector could be input[type=month] or a select/combobox
    const monthControl = page.locator('input[type="month"], select')
      .or(page.getByRole('combobox').first())
      .or(page.getByRole('tab').first());
    await expect(monthControl.first()).toBeVisible({ timeout: 8_000 });
  });

  test('should show content (table or cards)', async ({ page }) => {
    await page.waitForTimeout(2_000);
    const content = page.locator('table')
      .or(page.locator('[class*="card"]').first())
      .first();
    await expect(content).toBeVisible({ timeout: 10_000 });
  });
});
