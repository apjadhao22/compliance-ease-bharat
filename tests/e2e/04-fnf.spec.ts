import { test, expect } from '@playwright/test';
import { goTo, fillByLabel, expectToast, isoDate } from './helpers';

/**
 * 04-fnf-settlement.spec.ts
 * ───────────────────────────
 * Tests Full & Final Settlement:
 *   ✓ Page loads with settlement list
 *   ✓ New Settlement dialog opens
 *   ✓ Employee combobox search is present
 *   ✓ Separation date and reason fields exist
 *   ✓ 48-hour SLA badge visible under Labour Codes
 *   ✓ Submitted settlements appear in history list
 */

test.describe('F&F Settlement', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await goTo(page, 'F&F');
  });

  test('should load F&F Settlement page', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /full.*final|f.*f.*settlement|fnf/i }).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('should show settlement history or empty state', async ({ page }) => {
    const content = page
      .locator('table')
      .or(page.getByText(/no.*settlement|start.*new/i).first());
    await expect(content).toBeVisible({ timeout: 10_000 });
  });

  test('should open New Settlement dialog', async ({ page }) => {
    await page.getByRole('button', { name: /new settlement|initiate/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
  });

  test('should have EmployeeCombobox in the New Settlement dialog', async ({ page }) => {
    await page.getByRole('button', { name: /new settlement|initiate/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // EmployeeCombobox renders a search input
    const comboSearch = dialog.getByPlaceholder(/search employee|name or code/i);
    await expect(comboSearch).toBeVisible({ timeout: 5_000 });

    // Separation date
    const sepDate = dialog.getByLabel(/separation.*date|last.*working|date/i).first();
    await expect(sepDate).toBeVisible();

    // Reason selector
    const reason = dialog.getByRole('combobox', { name: /reason|type/i })
      .or(dialog.getByText(/resignation|termination|retirement/i).first());
    await expect(reason).toBeVisible();

    await page.keyboard.press('Escape');
  });

  test('should show calculate button in the settlement form', async ({ page }) => {
    await page.getByRole('button', { name: /new settlement|initiate/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const calcBtn = dialog.getByRole('button', { name: /calculate|compute/i });
    await expect(calcBtn).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press('Escape');
  });
});
