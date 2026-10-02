import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,

  // Every spec shares one deployed test account, and setup helpers clear its
  // bookings. `fullyParallel: false` only serializes tests *within* a file —
  // without this, separate spec files would still run concurrently and destroy
  // each other's preconditions (see docs/test-strategy.md §9).
  workers: 1,

  retries: 0,
  reporter: 'html',

  use: {
    baseURL: 'https://eventhub.rahulshettyacademy.com',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
