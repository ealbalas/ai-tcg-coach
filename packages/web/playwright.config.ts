import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  webServer: {
    command: 'node_modules/.bin/next dev -p 3090',
    url: 'http://localhost:3090',
    reuseExistingServer: true,
    timeout: 120000,
  },
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3090',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
