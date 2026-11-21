// ROADMAP-02: öffentliche Roadmap-Seite mit sechs Abschnitten. Die Freigabe (approved) ist in der Datei aus; deshalb liefert der Test die echte Projektion
// der kuratierten Datei per Route-Abfang aus, als wäre sie freigegeben. Ohne Freigabe bleibt die bisherige Roadmap die Ansicht.
import { test, expect, login } from './helpers.js';
import { loadPublicRoadmap, publicRoadmap } from '../../games/public-roadmap.js';

test.use({ createLimit: '100' });
const data = loadPublicRoadmap();
const payload = publicRoadmap({ ...data, approved: true }, { version: '3.17.0', commit: 'cb2c167' });
const go = (page, h) => page.evaluate((x) => { location.hash = x; }, h);
const withApproval = (page, body = payload) => page.route('**/api/roadmap', (route) => route.fulfill({ json: body }));
const SECTION_DE = ['Neu veröffentlicht', 'In Entwicklung', 'Als Nächstes', 'Geplant', 'Ideen', 'Pausiert'];
const SECTION_EN = ['Newly released', 'In development', 'Up next', 'Planned', 'Ideas', 'Paused'];
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

test('ohne Freigabe bleibt die bisherige Roadmap die Ansicht, die API liefert keine Einträge', async ({ page, app }) => {
  await login(page, app);
  const api = await page.evaluate(async () => (await fetch('/api/roadmap', { credentials: 'same-origin' })).json());
  expect(api).toEqual({ approved: false });
  await go(page, '#roadmap');
  await expect(page.locator('.roadmap-stage').first()).toBeVisible();
  await expect(page.locator('.pubroad-section')).toHaveCount(0);
  await expect(page.locator('a[href="#roadmap/verlauf"]')).toHaveCount(0);
  await go(page, '#roadmap/verlauf');
  await expect(page.locator('.roadmap-stage').first()).toBeVisible();   // Historie ist auch ohne Freigabe erreichbar
});

test('freigegeben: sechs Abschnitte mit Karten, Leerzuständen und ohne interne Begriffe', async ({ page, app }) => {
  await withApproval(page);
  await login(page, app);
  await go(page, '#roadmap');
  const headings = page.locator('.pubroad-section > .hub-block-head h2');
  await expect(headings).toHaveText(SECTION_DE);
  await expect(page.locator('.pubroad-section')).toHaveCount(6);
  // belegte Veröffentlichungen mit Version
  const neu = page.locator('.pubroad-neu .pubroad-card');
  await expect(neu).toHaveCount(2);
  await expect(page.locator('.pubroad-neu')).toContainText('Version 3.17.0');
  await expect(page.locator('.pubroad-neu')).toContainText('Version 3.16.0');
  // leere Abschnitte haben einen Leerzustand
  await expect(page.locator('.pubroad-entwicklung .pubroad-empty')).toHaveText('Hier ist gerade nichts eingetragen.');
  await expect(page.locator('.pubroad-pausiert .pubroad-empty')).toHaveText('Derzeit ist nichts pausiert.');
  await expect(page.locator('.pubroad-naechstes .pubroad-card')).toHaveCount(1);
  await expect(page.locator('.pubroad-naechstes')).toContainText('Discord-Anmeldung und geschützte Bereiche');
  await expect(page.locator('.pubroad-naechstes')).toContainText('keine Pflicht');
  await expect(page.locator('.pubroad-geplant')).not.toContainText('Discord-Anmeldung');
  await expect(page.locator('.pubroad-geplant .pubroad-card')).not.toHaveCount(0);
  await expect(page.locator('.pubroad-ideen .pubroad-card')).not.toHaveCount(0);
  // keine Paketnummern, Pfade, Hashes oder Agenten
  const text = await page.locator('.hub-main, main, #hub').first().innerText();
  for (const re of [/\b(V2|VIS|EXP|ART|CUX|AUTH|NAV|ROADMAP|QA)-[0-9A-Za-z]+/, /\b(docs|server|scripts)\//, /\b[0-9a-f]{7,40}\b/, /Codex|Claude|AGENTS|Vault/]) expect(text).not.toMatch(re);
  expect(await overflow(page)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('roadmap-de.png'), fullPage: true });
});

test('Filter nach Bereich: Tastatur, Fokus, Zähler und Filter-Leerzustand', async ({ page, app }) => {
  await withApproval(page);
  await login(page, app);
  await go(page, '#roadmap');
  const chip = (id) => page.locator(`[data-pubroad-filter="${id}"]`);
  await expect(chip('alle')).toHaveAttribute('aria-pressed', 'true');
  const all = await page.locator('.pubroad-card').count();
  // per Tastatur bedienen: Fokus auf den Chip, Enter
  await chip('aussehen').focus();
  await page.keyboard.press('Enter');
  await expect(chip('aussehen')).toHaveAttribute('aria-pressed', 'true');
  await expect(chip('alle')).toHaveAttribute('aria-pressed', 'false');
  await expect(chip('aussehen')).toBeFocused();                          // Fokus bleibt nach dem Filtern
  const looks = await page.locator('.pubroad-card').count();
  expect(looks).toBeGreaterThan(0); expect(looks).toBeLessThan(all);
  for (const area of await page.locator('.pubroad-meta span:first-child').allInnerTexts()) expect(area).toBe('Aussehen');
  // Abschnitt ohne passenden Eintrag, aber mit Einträgen: Filter-Hinweis; Zähler stimmt
  await chip('betrieb').focus(); await page.keyboard.press('Space');
  await expect(page.locator('.pubroad-card')).toHaveCount(0);
  await expect(page.locator('.pubroad-geplant .pubroad-empty')).toHaveText('Für diesen Filter gibt es hier keine Einträge.');
  await expect(page.locator('.pubroad-count').first()).toHaveText('0');
  await chip('alle').click();
  await expect(page.locator('.pubroad-card')).toHaveCount(all);
  // sichtbarer Fokus
  await chip('alle').focus();
  await page.keyboard.press('Tab');
  await expect(chip('spiele')).toBeFocused();
  const outline = await chip('spiele').evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
});

test('Englisch und Sprachwechsel: Abschnitte, Texte und Bedienelemente', async ({ page, app }) => {
  await withApproval(page);
  await login(page, app);
  await go(page, '#einstellungen/anzeige');
  await page.locator('[data-set="display.language"]').selectOption('en');
  await go(page, '#roadmap');
  await expect(page.locator('.pubroad-section > .hub-block-head h2')).toHaveText(SECTION_EN);
  await expect(page.locator('.pubroad-neu')).toContainText('Theme worlds for card games');
  await expect(page.locator('.pubroad-neu')).toContainText('Version 3.17.0');
  await expect(page.locator('.pubroad-pausiert .pubroad-empty')).toHaveText('Nothing is paused at the moment.');
  await expect(page.locator('.pubroad-entwicklung .pubroad-empty')).toHaveText('Nothing is listed here right now.');
  await expect(page.locator('.pubroad-naechstes')).toContainText('not required');
  await expect(page.locator('[data-pubroad-filter="aussehen"]')).toHaveText('Look');
  await expect(page.locator('.pubroad-history a')).toHaveText('Change history and earlier roadmap');
  await expect(page.locator('.pubroad-filters')).toHaveAttribute('aria-label', 'Filter roadmap by area');
  expect(await page.locator('.pubroad-section').first().innerText()).not.toContain('Themenwelten');
  await page.reload();                                                   // Neuladen behält die Sprache
  await expect(page.locator('.pubroad-section > .hub-block-head h2').first()).toHaveText('Newly released');
  // zurück auf Deutsch ohne Neuladen
  await go(page, '#einstellungen/anzeige');
  await page.locator('[data-set="display.language"]').selectOption('de');
  await go(page, '#roadmap');
  await expect(page.locator('.pubroad-section > .hub-block-head h2').first()).toHaveText('Neu veröffentlicht');
});

test('Historie, alte Links, Browser-Verlauf und NAV-01-Schalter', async ({ page, app }) => {
  await withApproval(page);
  await login(page, app);
  await go(page, '#roadmap');
  await expect(page.locator('.pubroad-section')).toHaveCount(6);
  await page.locator('.pubroad-history a').click();                      // frühere Roadmap bleibt als Historie erreichbar
  await expect(page.locator('.roadmap-stage').first()).toBeVisible();
  await expect(page.locator('.pubroad-section')).toHaveCount(0);
  await page.goBack();
  await expect(page.locator('.pubroad-section')).toHaveCount(6);
  await page.goForward();
  await expect(page.locator('.roadmap-stage').first()).toBeVisible();
  await page.locator('a[href="#roadmap"]:visible').filter({ hasText: /Zurück zur Roadmap-Übersicht/ }).click();
  await expect(page.locator('.pubroad-section')).toHaveCount(6);
  await go(page, '#roadmap/unbekannt');                                  // unbekannte Unterseite fällt auf die Übersicht zurück
  await expect(page.locator('.pubroad-section')).toHaveCount(6);
  // NAV-01: Roadmap ausblenden entfernt nur die Einstiege, der Direktlink funktioniert
  await go(page, '#einstellungen/hub');
  await page.locator('[data-set-list="hub.hiddenBlocks"][data-value="roadmap"]').uncheck();
  expect(await page.evaluate(() => [...document.querySelectorAll('#side-nav a, #hub-tabbar a, #hub-menu-nav a')].map((a) => a.getAttribute('href')))).not.toContain('#roadmap');
  await go(page, '#roadmap');
  await expect(page.locator('.pubroad-section')).toHaveCount(6);
  await page.locator('[data-set-list="hub.hiddenBlocks"][data-value="roadmap"]').count();
});

test('Handyansicht: eine Spalte, kein seitliches Überlaufen, Karten lesbar', async ({ page, app }, info) => {
  await withApproval(page);
  await login(page, app);
  await go(page, '#roadmap');
  await expect(page.locator('.pubroad-section')).toHaveCount(6);
  expect(await overflow(page)).toBe(true);
  const columns = await page.locator('#pubroad-body').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  if (info.project.name === 'mobil') expect(columns).toBe(1); else expect(columns).toBe(2);
  const small = await page.locator('.pubroad-card').first().boundingBox();
  expect(small.width).toBeGreaterThan(200);
  await page.screenshot({ path: info.outputPath('roadmap-' + info.project.name + '.png'), fullPage: true });
});

test('Ausfall der Besucher-API: bisherige Roadmap bleibt nutzbar', async ({ page, app }) => {
  await page.route('**/api/roadmap', (route) => route.fulfill({ status: 200, contentType: 'text/plain', body: 'kein JSON' }));
  await login(page, app);
  await go(page, '#roadmap');
  await expect(page.locator('.roadmap-stage').first()).toBeVisible();
  await expect(page.locator('.pubroad-section')).toHaveCount(0);
});

test('unbelegte Veröffentlichung wird nicht angezeigt (Rollback- und Build-Fall)', async ({ page, app }) => {
  const rolledBack = publicRoadmap({ ...data, approved: true }, { version: '3.16.0', commit: 'cb2c167' });
  await withApproval(page, rolledBack);
  await login(page, app);
  await go(page, '#roadmap');
  await expect(page.locator('.pubroad-neu .pubroad-card')).toHaveCount(0);
  await expect(page.locator('.pubroad-neu .pubroad-empty')).toBeVisible();
});
