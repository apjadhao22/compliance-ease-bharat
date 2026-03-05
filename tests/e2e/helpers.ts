import { test, expect, Page } from '@playwright/test';

/**
 * helpers.ts
 * Shared utilities for all E2E tests.
 */

/** Navigate to a dashboard section by sidebar link text */
export async function goTo(page: Page, section: string) {
  const link = page.getByRole('link', { name: new RegExp(section, 'i') }).first();
  await link.click();
  await page.waitForLoadState('networkidle');
}

/** Wait for a toast notification matching text */
export async function expectToast(page: Page, text: string | RegExp) {
  const toast = page.locator('[role="status"], [data-sonner-toast], [data-state="open"]')
    .filter({ hasText: text })
    .first();
  await expect(toast).toBeVisible({ timeout: 8000 });
}

/** Fill a form field by its label text */
export async function fillByLabel(page: Page, label: string | RegExp, value: string) {
  const input = page.getByLabel(label, { exact: false }).first();
  await input.clear();
  await input.fill(value);
}

/** Unique name helper for test isolation — avoids conflicts between runs */
export function uniqueName(prefix: string) {
  return `${prefix}_test_${Date.now()}`;
}

/** ISO date string for today/offset days */
export function isoDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}
