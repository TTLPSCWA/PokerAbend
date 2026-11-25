// QA-CROSSBROWSER-01: gezielte Firefox- und WebKit-Prüfungen für den nächtlichen Volllauf.
// Die volle Browsermatrix läuft weiter nur in Chromium (playwright.config.js, Desktop und Mobil).
// Hier laufen repräsentative Fälle: Responsive-Regressionen aus B24, Kartenbedienung aus CARD-UX-01,
// Tastatur, Touch und vergrößerte Schrift sowie Startseite, Navigation und Dialoge.
// Aufruf: npx playwright test -c playwright.crossbrowser.config.js --project="firefox*"   (bzw. "webkit*")
// Abdeckungslücken und Begründung: docs/crossbrowser-qa.md
import { devices } from '@playwright/test';
import base from './playwright.config.js';

const { channel, ...use } = base.use;
const B24 = ['responsive.spec.js', 'b24-a11y.spec.js'];
const CARDS = ['card-ux-audit.spec.js', 'card-ux-actions.spec.js', 'card-action.spec.js'];
const DIALOGS = 'b24-responsive-audit.spec.js';
// Aus der B24-Gesamtprüfung nur „Hub, Navigation und Dialoge“; die Spiel- und Solo-Matrix bleibt in Chromium.
const SKIP_GAME_MATRIX = /: Lobby und laufende Partie in allen Viewports| in allen Viewports$|Performance: Größenwechsel/;
// Aus UNO Ultimate nur Flip (Materialatlas mit Kontrastprüfung); die übrigen Varianten bleiben in Chromium.
const ONLY_FLIP = /UNO Ultimate (classic|no-mercy|all-wild|halloween-ghosthunt):/;

export default {
  ...base,
  use,
  testMatch: [...B24, ...CARDS, DIALOGS, 'uno-ultimate.spec.js'], // CARDS enthält auch CARD-ACTION-01 (zweites Fenster)
  projects: [
    // Firefox: Desktop, schmales Fenster und vergrößerte Standardschrift (24 statt 16 px, echte Browsereinstellung).
    { name: 'firefox', testMatch: [...B24, ...CARDS, DIALOGS], grepInvert: SKIP_GAME_MATRIX, use: { browserName: 'firefox', viewport: { width: 1440, height: 900 } } },
    { name: 'firefox-schmal', testMatch: ['card-ux-audit.spec.js'], use: { browserName: 'firefox', viewport: { width: 390, height: 844 } } },
    { name: 'firefox-grossschrift', testMatch: ['b24-a11y.spec.js'], use: { browserName: 'firefox', viewport: { width: 1280, height: 720 },
      launchOptions: { firefoxUserPrefs: { 'font.size.variable.x-western': 24, 'font.size.monospace.x-western': 20 } } } },
    // WebKit: Desktop und iPhone-Emulation mit Touch. Ersetzt keinen Test auf echtem iOS-Safari.
    { name: 'webkit', testMatch: [...B24, 'card-ux-audit.spec.js', DIALOGS], grepInvert: SKIP_GAME_MATRIX, use: { browserName: 'webkit', viewport: { width: 1440, height: 900 } } },
    { name: 'webkit-touch', testMatch: [...B24, ...CARDS, 'uno-ultimate.spec.js'], grepInvert: ONLY_FLIP,
      use: { ...devices['iPhone 13'], browserName: 'webkit', viewport: { width: 390, height: 844 } } },
  ],
};
