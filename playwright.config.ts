import { defineConfig, devices } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

// ── Load .env.local so TEST_EMAIL / TEST_PASSWORD / PLAYWRIGHT_BASE_URL are available
// Uses process.cwd() (project root) because __dirname is not reliable in all TS configs.
try {
  const envPath = join(process.cwd(), '.env.local');
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
    }
  }
} catch { /* .env.local is optional in CI — rely on shell env */ }

/**
 * Playwright E2E Test Configuration
 * ------------------------------------
 * Before running:
 *   1. Copy .env.local.example → .env.local and fill in TEST_EMAIL, TEST_PASSWORD
 *   2. npx playwright install chromium
 *   3. PLAYWRIGHT_BASE_URL=https://opticomp-bharat.com npx playwright test
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
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080',
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
