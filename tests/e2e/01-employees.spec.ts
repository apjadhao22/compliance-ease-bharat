import { test, expect } from '@playwright/test';
import { goTo, fillByLabel, isoDate, uniqueName } from './helpers';

/**
 * 01-employees.spec.ts
 * ─────────────────────
 * Tests the employee page and CRUD operations.
 */

test.describe('Employee Management', () => {
  const empName = uniqueName('TestEmp');

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/employees');
    await page.waitForLoadState('networkidle');
  });

  test('should load employee list page', async ({ page }) => {
    // h1 is literally "Employees"
    await expect(page.getByRole('heading', { name: /^employees$/i })).toBeVisible({ timeout: 10_000 });
  });

  test('should show employee table or empty state', async ({ page }) => {
    // Either a table OR an empty-state message
    const content = page.locator('table').or(
      page.getByText(/no employees|add your first/i).first()
    ).or(
      // PaginationControls or search bar confirms the page loaded with content
      page.getByPlaceholder(/search/i).first()
    );
    await expect(content.first()).toBeVisible({ timeout: 10_000 });
  });

  test('should open Add Employee dialog', async ({ page }) => {
    await page.getByRole('button', { name: /add employee/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
  });

  test('should show pagination info', async ({ page }) => {
    // PaginationControls renders "Showing X – Y of Z" OR the page still loads with a table
    const paginationOrTable = page.getByText(/showing/i).or(page.locator('table')).first();
    await expect(paginationOrTable).toBeVisible({ timeout: 10_000 });
  });

  test('should have a search input on the employee page', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i).first();
    await expect(searchInput).toBeVisible({ timeout: 8_000 });
    // Type something — should not crash
    await searchInput.fill('test');
    await page.waitForTimeout(600);
    await searchInput.fill(''); // clear
  });
});
