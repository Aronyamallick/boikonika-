import { defineConfig, devices } from '@playwright/test';

/**
 * Runs against a running stack (API + website) with the demo catalogue seeded:
 *   pnpm db:seed && pnpm db:seed:demo, then the API in development mode (codes go to the dev outbox).
 * E2E_BASE_URL / E2E_API_URL point at it (defaults: the local dev servers).
 */
export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: BASE_URL, trace: 'retain-on-failure', screenshot: 'only-on-failure', locale: 'bn-BD', timezoneId: 'Asia/Dhaka' },
  projects: [
    { name: 'desktop', testMatch: 'e2e/**/*.spec.ts', testIgnore: '**/*.mobile.spec.ts', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', testMatch: 'e2e/**/*.mobile.spec.ts', use: { ...devices['Pixel 7'] } },
    { name: 'a11y', testMatch: 'a11y/**/*.spec.ts', use: { ...devices['Desktop Chrome'] } },
  ],
});
