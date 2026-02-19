import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for staging tests.
 * Assumes frontend is already running on port 8585 with VITE_BACKEND_URL
 * pointing to the staging backend. No web servers are auto-started.
 */
export default defineConfig({
  testDir: './specs',
  outputDir: './results',

  fullyParallel: true,
  retries: 0,
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
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--enable-webgl',
            '--use-gl=angle',
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
          ],
        },
      },
    },
  ],

  // No webServer — frontend must already be running
});
