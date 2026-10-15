import { defineConfig, devices } from '@playwright/test';

// The app runs with the mock server on (VITE_ENABLE_MOCKS=true): every request below goes through
// the same MSW handlers as the demo build. Port and command can be overridden for other setups.
const PORT = Number(process.env.E2E_PORT ?? 5173);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  // each test gets a fresh browser context: empty storage, so the mock database starts from its seed
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 45_000,
  expect: {
    timeout: 8_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled', caret: 'hide' },
  },
  // one folder of baselines per project, committed with the code
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL,
    trace: 'retain-on-failure', // opened with: npx playwright show-trace
    screenshot: 'only-on-failure',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    // only the layout checks run at tablet width
    { name: 'tablet', testMatch: /visual\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } } },
  ],
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: process.env.E2E_COMMAND ?? `npm run dev -- --port ${PORT} --strictPort`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: { VITE_ENABLE_MOCKS: 'true' },
      },
});
