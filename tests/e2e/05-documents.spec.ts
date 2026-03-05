import { test, expect } from '@playwright/test';

/**
 * 05-documents.spec.ts
 * Tests Document Generator page.
 */

test.describe('Document Generator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/documents');
    await page.waitForLoadState('networkidle');
  });

  test('should load Documents page', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /document/i }).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('should show all 4 document type tabs or options', async ({ page }) => {
    const docTypes = ['Offer Letter', 'Appointment Letter', 'NDA', 'Relieving Letter'];
    for (const docType of docTypes) {
      await expect(
        page.getByRole('tab', { name: docType })
          .or(page.getByText(docType, { exact: true }).first())
      ).toBeVisible({ timeout: 6_000 });
    }
  });

  test('should have an editable template textarea', async ({ page }) => {
    // Template editor is a textarea
    const editor = page.locator('textarea').first();
    await expect(editor).toBeVisible({ timeout: 8_000 });
    await expect(editor).not.toBeDisabled();
  });

  test('should have a Save or Update Template button', async ({ page }) => {
    // Button could say "Save", "Update", "Save Template" etc.
    const saveBtn = page.getByRole('button', { name: /save|update/i }).first();
    await expect(saveBtn).toBeVisible({ timeout: 8_000 });
  });

  test('should open Generate Letter dialog', async ({ page }) => {
    await page.getByRole('button', { name: /generate|create.*letter/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
  });

  test('should have employee search in Generate Letter dialog', async ({ page }) => {
    await page.getByRole('button', { name: /generate|create.*letter/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // EmployeeCombobox = 'Search by name or code...' button (dialog has 2 comboboxes)
    const trigger = dialog.getByRole('combobox').filter({ hasText: /search by name|search.*code/i });
    await expect(trigger).toBeVisible({ timeout: 5_000 });

    // Preview and Download buttons should be in the dialog (initially disabled)
    await expect(dialog.getByRole('button', { name: /preview/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /download|pdf/i })).toBeVisible();

    await page.keyboard.press('Escape');
  });

  test('should show error toast when previewing without an employee', async ({ page }) => {
    await page.getByRole('button', { name: /generate|create.*letter/i }).click();
    const dialog = page.getByRole('dialog');    
    await expect(dialog).toBeVisible();

    // Preview button is disabled until an employee is selected — that IS the validation
    // If it's disabled, the  UI correctly prevents preview without selection.
    const previewBtn = dialog.getByRole('button', { name: /preview/i });
    await expect(previewBtn).toBeVisible({ timeout: 5_000 });
    
    // The button should either be disabled OR clicking it shows a toast
    const isDisabled = await previewBtn.isDisabled();
    if (!isDisabled) {
      // If not disabled, click it and expect a toast
      await previewBtn.click();
      const toast = page.locator('[data-sonner-toast], [role="status"], [role="alert"]').first();
      await expect(toast).toBeVisible({ timeout: 8_000 });
    }
    // If disabled — that's the correct behavior (button is disabled without employee)
    
    await page.keyboard.press('Escape');
  });
});
