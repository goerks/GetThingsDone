import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run the web build with its demo data in a real Chromium (see e2e/).
// PLAYWRIGHT_CHROMIUM_PATH points to a preinstalled browser where `playwright install` is not wanted.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['list'], ['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    locale: 'en-US',
    timezoneId: 'Europe/Zurich',
    trace: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 1000 }, ...(executablePath ? { launchOptions: { executablePath } } : {}) }
    }
  ],
  webServer: {
    command: 'npx vite build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
