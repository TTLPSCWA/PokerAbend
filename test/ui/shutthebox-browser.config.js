import { defineConfig } from '@playwright/test';

// Use already installed browser engines; SB_ENGINE=firefox or webkit.
const engine = process.env.SB_ENGINE || 'webkit';
if (!['firefox', 'webkit'].includes(engine)) throw new Error('SB_ENGINE must be firefox or webkit');
export default defineConfig({
  testDir: '.',
  testMatch: 'shutthebox-texture.spec.js',
  workers: 1,
  timeout: 90000,
  expect: { timeout: 8000 },
  reporter: 'list',
  use: {
    browserName: engine,
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    ...(engine === 'firefox' ? { launchOptions: { firefoxUserPrefs: { 'gfx.webrender.software': true, 'layers.acceleration.disabled': true } } } : {}),
  },
  projects: [
    { name: `${engine}-desktop`, use: { viewport: { width: 1440, height: 900 } } },
    { name: `${engine}-narrow`, use: { viewport: { width: 390, height: 844 }, ...(engine === 'webkit' ? { isMobile: true, hasTouch: true } : {}) } },
  ],
});
