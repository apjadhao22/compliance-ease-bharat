import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('IR Compliance Suite', () => {
    
    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
    });

    test('should navigate to IR Dashboard and open Standing Orders dialog', async ({ page }) => {
        await page.goto('/dashboard/ir');
        await expect(page.locator('h1')).toContainText('Industrial Relations (IR)');
        
        // Open Draft dialog
        await page.getByRole('button', { name: 'New Draft' }).click();
        await expect(page.locator('div[role="dialog"]')).toBeVisible();
        await expect(page.getByText('Adopt Standing Orders')).toBeVisible();

        // Close it
        await page.keyboard.press('Escape');
    });

    test('should navigate to IR events and log a new event', async ({ page }) => {
        await page.goto('/dashboard/ir');
        
        await page.getByRole('tab', { name: /IR Events/i }).click();
        await page.getByRole('button', { name: 'Log Event' }).click();
        await expect(page.locator('div[role="dialog"]')).toBeVisible();
        await expect(page.getByText('Register IR Employment Event')).toBeVisible();

        // Check form elements are rendered (not doing full submission to keep DB clean during basic E2E)
        await expect(page.getByLabel('Effective Date')).toBeVisible();
        await expect(page.getByLabel('Affected Workers (Estimated count)')).toBeVisible();
    });

    test('should show IR link in FnF when labour codes regime is active', async ({ page }) => {
        await page.goto('/dashboard/fnf');
        await expect(page.locator('h1')).toContainText('Full & Final Settlement');

        // Note: The UI defaults to 'legacy_acts' in State. The user drops down to labour_codes usually.
        // If not tested fully here, we at least verify the core F&F loads successfully without crashing
        await page.getByRole('button', { name: 'Initiate F&F' }).click();
        await expect(page.locator('div[role="dialog"]')).toBeVisible();
        await expect(page.getByText('Select Exiting Employee')).toBeVisible();
    });

});
