import { test, expect } from '@playwright/test';

/**
 * 03-leaves.spec.ts
 * Tests the Leave Management module.
 */

test.describe('Leave Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/leaves');
    await page.waitForLoadState('networkidle');
  });

  test('should load leave management page', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /leave/i }).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('should show leave request table, cards, or empty state', async ({ page }) => {
    await page.waitForTimeout(2_000);
    const content = page.locator('table')
      .or(page.locator('[class*="card"]').first())
      .or(page.getByText(/no leave|no requests/i).first());
    await expect(content.first()).toBeVisible({ timeout: 10_000 });
  });

  test('should open Log Leave dialog', async ({ page }) => {
    await page.getByRole('button', { name: /log leave|add leave|new leave/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
  });

  test('should show employee search in Log Leave dialog', async ({ page }) => {
    await page.getByRole('button', { name: /log leave|add leave|new leave/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // EmployeeCombobox — look for any input inside dialog (search or combobox)
    const anyInput = dialog.locator('input').first();
    await expect(anyInput).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press('Escape');
  });

  test('should show leave type and date fields in dialog', async ({ page }) => {
    await page.getByRole('button', { name: /log leave|add leave|new leave/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Any combobox or select for leave type
    const typeOrSelect = dialog.getByRole('combobox')
      .or(dialog.locator('select'))
      .first();
    await expect(typeOrSelect).toBeVisible({ timeout: 5_000 });

    // Any input for dates
    const datePicker = dialog.locator('input[type="date"], input[placeholder*="date" i], button[aria-haspopup="dialog"]')
      .first();
    await expect(datePicker).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press('Escape');
  });

  test('should show approve/reject actions or any interactive element', async ({ page }) => {
    // Look for any button, tab, or badge filter — the exact UI varies by state
    const interactive = page
      .getByRole('button').filter({ hasText: /approve|pending|reject|all|log|add/i })
      .or(page.getByRole('tab'))
      .first();
    await expect(interactive).toBeVisible({ timeout: 8_000 });
  });
});
