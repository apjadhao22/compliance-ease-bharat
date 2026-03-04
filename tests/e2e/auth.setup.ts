import { test as setup, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const authFile = path.join(__dirname, '.auth/user.json');

/**
 * auth.setup.ts
 * Runs ONCE before all tests. Logs in and saves the browser storage state
 * so every subsequent test file starts already authenticated.
 *
 * Credentials come from .env.local:
 *   TEST_EMAIL=your-email@example.com
 *   TEST_PASSWORD=your-password
 */
setup('authenticate', async ({ page }) => {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'TEST_EMAIL and TEST_PASSWORD must be set in .env.local\n' +
      'Copy .env.local.example → .env.local and fill in your credentials.'
    );
  }

  // Ensure .auth directory exists
  const authDir = path.dirname(authFile);
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  await page.goto('/sign-in');
  await expect(page).toHaveTitle(/ComplianceEase|Bharat|Sign/i);

  // Fill in credentials
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();

  // Wait until we land on the dashboard
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await expect(page.getByText(/overview|dashboard/i).first()).toBeVisible();

  // Save session
  await page.context().storageState({ path: authFile });
  console.log('✅  Auth state saved to', authFile);
});
