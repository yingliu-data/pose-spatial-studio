import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Pose Spatial Studio
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './specs',
  outputDir: './results',

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:8585',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  webServer: [
    {
      command: 'cd ../backend && ./run_server.sh',
      url: 'http://localhost:49101',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    {
      command: 'cd ../frontend && ./run_ui.sh',
      url: 'http://localhost:8585',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ],
});
