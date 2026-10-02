import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,

  // Every spec shares one test account, and setup helpers clear its
  // bookings. `fullyParallel: false` only serializes tests *within* a file —
  // without this, separate spec files would still run concurrently and destroy
  // each other's preconditions (see docs/test-strategy.md §9).
  workers: 1,

  retries: 0,
  reporter: 'html',

  use: {
    // Defaults to the local frontend; set BASE_URL to target another deployment.
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Locally, start (or reuse) the dev servers. In CI the workflow starts the
  // production build itself, so no webServer is configured there.
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
