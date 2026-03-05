import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 * ------------------------------------
 * Before running:
 *   1. Copy .env.local.example → .env.local and fill in TEST_EMAIL, TEST_PASSWORD
 *   2. npx playwright install chromium
 *   3. npm run dev   (in a separate terminal)
 *   4. npx playwright test
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Serial — tests share one Supabase project
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://compliance-ease-bharat.vercel.app',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    /* Re-use logged-in session — auth test runs first and saves state */
    storageState: 'tests/e2e/.auth/user.json',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    /* ── Step 1: Log in and save auth state ──────────────────────────── */
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { storageState: undefined }, // no pre-existing state for login
    },

    /* ── Step 2: All other tests, using the saved auth state ──────────── */
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts/,
    },
  ],

  // No webServer needed — testing against deployed Vercel app
});
