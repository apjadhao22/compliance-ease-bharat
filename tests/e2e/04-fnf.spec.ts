import { test, expect } from '@playwright/test';

/**
 * 04-fnf.spec.ts
 * Tests Full & Final Settlement page.
 * Route confirmed: /dashboard/fnf
 */

test.describe('F&F Settlement', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/fnf');
    await page.waitForLoadState('networkidle');
  });

  test('should load F&F Settlement page', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /full.*final|f.*f.*settlement/i }).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('should show settlement history or empty state', async ({ page }) => {
    await page.waitForTimeout(2_000);
    const content = page.locator('table')
      .or(page.locator('[class*="card"]').first())
      .or(page.getByText(/no.*settlement|initiate/i).first());
    await expect(content.first()).toBeVisible({ timeout: 10_000 });
  });

  test('should open New Settlement dialog', async ({ page }) => {
    await page.getByRole('button', { name: /new settlement|initiate|new f/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
  });

  test('should have employee search input in New Settlement dialog', async ({ page }) => {
    await page.getByRole('button', { name: /new settlement|initiate|new f/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Any input — EmployeeCombobox or a regular input
    const anyInput = dialog.locator('input').first();
    await expect(anyInput).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press('Escape');
  });

  test('should show calculate button in the settlement form', async ({ page }) => {
    await page.getByRole('button', { name: /new settlement|initiate|new f/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const calcBtn = dialog.getByRole('button', { name: /calculate|compute/i });
    await expect(calcBtn).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press('Escape');
  });
});
