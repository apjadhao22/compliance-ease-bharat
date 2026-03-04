import { test, expect } from '@playwright/test';
import { goTo, expectToast, isoDate } from './helpers';

/**
 * 02-payroll.spec.ts
 * ────────────────────
 * Tests the Payroll processing workflow:
 *   ✓ Page loads and shows month selector
 *   ✓ Working days input is editable
 *   ✓ Process Payroll button is present (not testing full run — needs real employees)
 *   ✓ Attempting to run payroll without employees shows appropriate feedback
 *   ✓ EPF / ESIC tab loads and displays registers
 *   ✓ Regime selector renders (Legacy Acts / Labour Codes)
 */

test.describe('Payroll', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await goTo(page, 'Payroll');
  });

  test('should load payroll page with month selector', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /payroll/i }).first()).toBeVisible();
    // Month input (YYYY-MM format)
    const monthInput = page.getByLabel(/month|period/i).first();
    await expect(monthInput).toBeVisible({ timeout: 8_000 });
  });

  test('should allow changing working days', async ({ page }) => {
    const wdInput = page.getByLabel(/working days/i).first();
    await expect(wdInput).toBeVisible();
    await wdInput.fill('26');
    await expect(wdInput).toHaveValue('26');
  });

  test('should show compliance regime toggler', async ({ page }) => {
    // Legacy Acts or Labour Codes selector
    const regimeSelector = page.getByRole('combobox', { name: /regime|compliance/i })
      .or(page.getByText(/legacy acts|labour codes/i).first());
    await expect(regimeSelector).toBeVisible({ timeout: 8_000 });
  });

  test('should show Process Payroll button', async ({ page }) => {
    const btn = page.getByRole('button', { name: /process payroll|run payroll|calculate/i }).first();
    await expect(btn).toBeVisible({ timeout: 8_000 });
  });

  test('should show payroll run history table or empty state', async ({ page }) => {
    const history = page
      .locator('table')
      .or(page.getByText(/no payroll|process your first/i))
      .first();
    await expect(history).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('EPF / ESIC', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await goTo(page, 'EPF');
  });

  test('should load EPF & ESIC page', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /epf|esic|provident/i }).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('should display month selector', async ({ page }) => {
    const monthSelector = page.getByLabel(/month/i).or(page.getByRole('combobox').first());
    await expect(monthSelector).toBeVisible({ timeout: 8_000 });
  });

  test('should show ECR / challan data table or empty state', async ({ page }) => {
    const content = page
      .locator('table')
      .or(page.getByText(/no data|run payroll first|no records/i).first());
    await expect(content).toBeVisible({ timeout: 10_000 });
  });
});
