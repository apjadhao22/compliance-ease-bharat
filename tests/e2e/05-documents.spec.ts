import { test, expect } from '@playwright/test';
import { goTo } from './helpers';

/**
 * 05-documents.spec.ts
 * ──────────────────────
 * Tests Document Generator:
 *   ✓ Page loads with template editor
 *   ✓ All 4 document types are selectable
 *   ✓ Template body editor is visible and editable
 *   ✓ Generate Letter dialog opens with EmployeeCombobox
 *   ✓ Preview button is present
 *   ✓ PDF Download button is present
 */

test.describe('Document Generator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await goTo(page, 'Documents');
  });

  test('should load Documents page', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /document/i }).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('should show template editor with 4 document types', async ({ page }) => {
    const docTypes = ['Offer Letter', 'Appointment Letter', 'NDA', 'Relieving Letter'];
    for (const docType of docTypes) {
      await expect(
        page.getByRole('tab', { name: docType })
          .or(page.getByText(docType).first())
      ).toBeVisible({ timeout: 6_000 });
    }
  });

  test('should allow editing a template body', async ({ page }) => {
    const editor = page.getByRole('textbox').filter({ hasText: /Dear|{{/i }).first()
      .or(page.locator('textarea').first());
    await expect(editor).toBeVisible({ timeout: 8_000 });
    // Should be editable
    await expect(editor).not.toBeDisabled();
  });

  test('should have a Save Template button', async ({ page }) => {
    const saveBtn = page.getByRole('button', { name: /save.*template|update.*template/i });
    await expect(saveBtn).toBeVisible({ timeout: 6_000 });
  });

  test('should open Generate Letter dialog', async ({ page }) => {
    await page.getByRole('button', { name: /generate.*letter|create.*letter|generate/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
  });

  test('should have EmployeeCombobox in Generate Letter dialog', async ({ page }) => {
    await page.getByRole('button', { name: /generate.*letter|create.*letter|generate/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // EmployeeCombobox search input
    const empSearch = dialog.getByPlaceholder(/search employee|name or code/i);
    await expect(empSearch).toBeVisible({ timeout: 5_000 });

    // Document type selector
    const docTypeSelect = dialog.getByRole('combobox', { name: /document type|type/i });
    await expect(docTypeSelect).toBeVisible();

    // Preview and Download buttons
    await expect(dialog.getByRole('button', { name: /preview/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /download|pdf/i })).toBeVisible();

    await page.keyboard.press('Escape');
  });

  test('should not allow preview without selecting an employee', async ({ page }) => {
    await page.getByRole('button', { name: /generate.*letter|create.*letter|generate/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Click Preview without selecting employee
    await dialog.getByRole('button', { name: /preview/i }).click();

    // Should show a validation error toast
    await expect(
      page.locator('[role="status"], [data-sonner-toast], [data-state="open"]')
        .filter({ hasText: /select.*employee|employee.*required|first/i })
        .first()
    ).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press('Escape');
  });
});
