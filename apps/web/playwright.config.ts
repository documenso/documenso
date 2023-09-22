import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

export const STORAGE_STATE = 'playwright/.auth/user.json';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './src/tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    { name: 'setup', testMatch: '**/*.setup.ts' },
    {
      name: 'Authenticated User Tests',
      testMatch: '*.authenticated.spec.ts',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE,
      },
    },
    {
      name: 'Unauthenticated User Tests',
      use: {
        ...devices['Desktop Chrome'],
      },
      testMatch: '*.unauthenticated.spec.ts',
      testIgnore: ['*.setup.ts', '*.authenticated.spec.ts'],
    },
    {
      name: 'cleanup db',
      testMatch: /global.teardown\.ts/,
    },
  ],

  globalTeardown: './global.teardown.ts',
});
