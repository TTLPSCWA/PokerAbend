import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/ui',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  reporter: 'list',
  use: {
    // Lokales Chrome; PLAYWRIGHT_CHANNEL=chromium nutzt alternativ Playwright-Chromium.
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobil', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
