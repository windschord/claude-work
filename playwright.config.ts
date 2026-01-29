import { defineConfig, devices } from '@playwright/test';

// CLIテストのみの場合はWebサーバー不要
const skipWebServer = process.env.SKIP_WEBSERVER === 'true';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    actionTimeout: 10000,
  },
  projects: [
    {
      name: 'cli',
      testMatch: /npx-cli\.spec\.ts/,
      // CLIテストはWebサーバー不要
    },
    {
      name: 'chromium',
      testIgnore: /npx-cli\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: skipWebServer
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3001',
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
        env: {
          CLAUDE_WORK_TOKEN: process.env.CLAUDE_WORK_TOKEN || 'test-token',
          SESSION_SECRET:
            process.env.SESSION_SECRET ||
            'test-session-secret-key-for-e2e-testing-purposes-only',
          PORT: '3001',
        },
      },
});
