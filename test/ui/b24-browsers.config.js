// B24/B07: Responsive-Regression browserübergreifend (Firefox, WebKit, WebKit mit Touch).
// Aufruf: npx playwright test -c test/ui/b24-browsers.config.js
// Ersetzt keinen Test auf echten Geräten (iPhone Safari, Android Chrome).
import base from '../../playwright.config.js';
import { fileURLToPath } from 'node:url';
const { channel, ...use } = base.use;
export default {
  ...base, use, testDir: fileURLToPath(new URL('./', import.meta.url)), testMatch: ['responsive.spec.js', 'b24-a11y.spec.js'],
  projects: [
    // Vergrößerte Standardschrift des Browsers (24 statt 16 px) über eine echte Firefox-Einstellung.
    { name: 'firefox-grossschrift', testMatch: 'b24-a11y.spec.js', use: { browserName: 'firefox', viewport: { width: 1280, height: 720 },
      launchOptions: { firefoxUserPrefs: { 'font.size.variable.x-western': 24, 'font.size.monospace.x-western': 20 } } } },
    { name: 'firefox', use: { browserName: 'firefox', viewport: { width: 1440, height: 900 } } },
    { name: 'webkit', use: { browserName: 'webkit', viewport: { width: 1440, height: 900 } } },
    // Touch-Emulation in WebKit (iPhone-Viewport); prüft Tippen, nicht Safari auf echter Hardware.
    { name: 'webkit-touch', use: { browserName: 'webkit', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
};
