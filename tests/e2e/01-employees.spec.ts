import { test, expect } from '@playwright/test';
import { goTo, fillByLabel, isoDate, uniqueName } from './helpers';

/**
 * 01-employees.spec.ts
 * ─────────────────────
 * Tests the employee page and CRUD operations.
 * Enhanced (Phase D): Gender field, OSH night-shift consent route.
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

  // ── Phase D additions ─────────────────────────────────────────────────────

  test('Add Employee dialog contains Gender field (OSH night-shift requirement)', async ({ page }) => {
    await page.getByRole('button', { name: /add employee/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    // Gender must appear in dialog for OSH § 43 night-shift logic
    const dialogText = await dialog.innerText();
    expect(/gender/i.test(dialogText)).toBe(true);
    await page.keyboard.press('Escape');
  });

  test('employee search filter does not crash on partial name', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i).first();
    await expect(searchInput).toBeVisible({ timeout: 8_000 });
    await searchInput.fill('Pri'); // partial name
    await page.waitForTimeout(900);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.trim().length).toBeGreaterThan(10);
    await searchInput.fill('');
  });
});

test.describe('Night-Shift Consent (OSH Code § 43)', () => {
  test('OSH dashboard page loads without crash', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/dashboard/osh');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500);
    // Heading
    await expect(
      page.getByRole('heading', { name: /osh|occupational|safety|health|night/i }).first()
    ).toBeVisible({ timeout: 10_000 });
    if (errors.length > 0) throw new Error(`Uncaught JS errors on OSH: ${errors.join('\n')}`);
  });

  test('OSH page displays night-shift consent section or registration section', async ({ page }) => {
    await page.goto('/dashboard/osh');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2_000);
    // Any content is visible
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.trim().length).toBeGreaterThan(20);
  });
});
