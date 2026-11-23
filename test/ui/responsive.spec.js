// B24 Adaptive Responsive UI – dauerhafte Regression (läuft in jedem Build).
// Prüft Pilotoberflächen in allen Ziel-Viewports inklusive 200 % Zoom und den
// Größenwechsel während einer laufenden Partie. Der lange Gesamtlauf über alle
// Spiele steht in b24-responsive-audit.spec.js (B24_AUDIT=1).
import { test, expect, login, selectGame } from './helpers.js';
import { VIEWPORTS, measureLayout } from './responsive-measure.js';

const emit = (page, event, data = {}) => page.evaluate(([e, d]) => send(e, d), [event, data]);
const problems = (m) => ({ overflow: m.overflow, clipped: m.clipped, covered: m.covered, unreachable: m.unreachable, empty: m.empty });
const clean = { overflow: false, clipped: [], covered: [], unreachable: [], empty: [] };

// Zieht die Seite durch alle Viewports und misst nach jedem Wechsel.
async function sweep(page, label, check) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(150);
    const m = await page.evaluate(measureLayout);
    expect(problems(m), `${label} @ ${vp.key}`).toEqual(clean);
    if (check) await check(vp);
  }
}

// Die Viewport-Matrix gilt unabhängig vom Projekt; Touch prüft der Mobil-Lauf.
const desktopOnly = (info) => test.skip(info.project.name !== 'desktop', 'Viewports werden explizit gesetzt; einmal reicht.');

test('B24 Hub: Start, Bibliothek und Tische ohne Überbreite, Abschneiden oder Verdecken', async ({ page, app }, info) => {
  desktopOnly(info);
  test.setTimeout(120000);
  await login(page, app);
  for (const hash of ['#start', '#spiele', '#tische']) {
    await page.evaluate((h) => { location.hash = h; }, hash);
    await sweep(page, 'Hub ' + hash);
  }
});

test('B24 Navigation: auf 320 px ausgeblendete Tabs bleiben über das Menü erreichbar', async ({ page, app }, info) => {
  desktopOnly(info);
  await page.setViewportSize({ width: 320, height: 568 });
  await login(page, app);
  const visibleTabs = await page.locator('#hub-tabbar .tab-item').evaluateAll((els) => els.filter((e) => e.getClientRects().length).map((e) => e.getAttribute('href')));
  expect(visibleTabs).not.toContain('#einstellungen');
  // Schriftzug (mit Versionsnummer) und Sprachauswahl überlappen nicht.
  const brand = await page.locator('.hub-top .wordmark').boundingBox();
  const language = await page.locator('#hub-language select').boundingBox();
  expect(brand.x + brand.width).toBeLessThanOrEqual(language.x);
  // Jede Beschriftung bleibt ein ganzes Wort (kein Umbruch mitten im Wort).
  const broken = await page.locator('#hub-tabbar .tab-item span').evaluateAll((els) => els.filter((e) => e.getClientRects().length && e.getClientRects().length > 1 && !e.textContent.includes(' ')).map((e) => e.textContent));
  expect(broken).toEqual([]);
  await page.locator('#hub-more').click();
  await expect(page.locator('#hub-menu')).toBeVisible();
  await page.locator('#hub-menu-nav a[href="#einstellungen"]').click();
  await expect(page).toHaveURL(/#einstellungen$/);
  // Der aktive Bereich bleibt in der Leiste sichtbar.
  await expect(page.locator('#hub-tabbar .tab-item[href="#einstellungen"]')).toBeVisible();
});

test('B24 Dialoge: geöffnete Dialoge bleiben nach Größenwechsel vollständig erreichbar', async ({ page, app }, info) => {
  desktopOnly(info);
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await login(page, app);
  await page.locator('#profile-avatar, #profile-chip').filter({ visible: true }).first().click();
  const dlg = page.locator('#profile-dlg');
  await expect(dlg).toBeVisible();
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(120);
    const box = await dlg.boundingBox();
    expect(box.x, vp.key).toBeGreaterThanOrEqual(0);
    expect(box.y, vp.key).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, vp.key).toBeLessThanOrEqual(vp.width + 1);
    expect(box.y + box.height, vp.key).toBeLessThanOrEqual(vp.height + 1);
    // Die Hauptaktion lässt sich in jeder Größe erreichen und bedienen.
    const save = dlg.locator('button[type=submit]');
    await save.scrollIntoViewIfNeeded();
    await expect(save).toBeInViewport();
  }
  await dlg.locator('#p-cancel').click();
  await expect(dlg).toBeHidden();
  // Host-Menü: Seitenpanel am Desktop, Leiste von unten am Handy – beides nach Wechsel bedienbar.
  await page.setViewportSize({ width: 1280, height: 720 });
  await selectGame(page, 'maumau');
  const host = page.locator('#host-dlg');
  await expect(host).toBeVisible();
  for (const size of [{ width: 390, height: 844 }, { width: 640, height: 360 }, { width: 3440, height: 1440 }]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(120);
    const submit = page.locator('#host-form button[type=submit]');
    await submit.scrollIntoViewIfNeeded();
    await expect(submit).toBeInViewport();
  }
});

// Pilotspiele: Poker, ein Kartenspiel (4 Spieler), ein Brettspiel (2), ein Würfelspiel (3), ein Partyspiel.
const PILOTS = [
  { id: 'poker', players: 3, shape: { sel: '.table' } },
  { id: 'maumau', players: 4 },
  { id: 'viergewinnt', players: 2, shape: { sel: '.vg-disc', ratio: 1 } },
  { id: 'kniffel', players: 3 },
  { id: 'schaetzmeister', players: 2 },
];
for (const pilot of PILOTS) {
  test(`B24 Pilot ${pilot.id}: laufende Partie (${pilot.players} Spieler) übersteht jeden Größenwechsel`, async ({ page, app }, info) => {
    desktopOnly(info);
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await login(page, app);
    await selectGame(page, pilot.id);
    await page.locator('#host-form button[type=submit]').click();
    await expect.poll(() => page.evaluate(() => lastState?.game)).toBe(pilot.id);
    await emit(page, 'sit', pilot.id === 'poker' ? { seat: 0 } : {});
    for (let i = 1; i < pilot.players; i++) expect((await emit(page, 'addBot'))?.ok).toBe(true);
    expect((await emit(page, 'start'))?.ok).toBe(true);
    await expect.poll(() => page.evaluate(() => lastState?.phase)).not.toBe('lobby');
    const before = await page.evaluate(() => { window.__b24Mark = 1; return { code: lastState.code, you: lastState.you.id, players: (lastState.players || lastState.seats || []).filter(Boolean).length }; });
    let ratio = null;
    await sweep(page, pilot.id, async (vp) => {
      if (!pilot.shape) return;
      // Spielflächen behalten ihr Seitenverhältnis (Brett bleibt Brett, Tisch bleibt Tisch).
      const r = await page.locator(pilot.shape.sel).first().evaluate((e) => { const b = e.getBoundingClientRect(); return b.width / b.height; });
      if (pilot.shape.ratio) { expect(Math.abs(r - pilot.shape.ratio), `${pilot.id} Form @ ${vp.key}`).toBeLessThan(0.05); return; }
      if (vp.width < 641 || vp.height > vp.width) return; // Hochformat: hoher Tisch mit bewusst eigenem Verhältnis
      if (ratio === null) ratio = r;
      expect(Math.abs(r - ratio) / ratio, `${pilot.id} Seitenverhältnis @ ${vp.key}`).toBeLessThan(0.03);
    });
    // Kein Neuladen, gleicher Raum, gleiche Identität, alle Mitspieler noch da.
    const after = await page.evaluate(() => ({ mark: window.__b24Mark, code: lastState.code, you: lastState.you.id, players: (lastState.players || lastState.seats || []).filter(Boolean).length }));
    expect(after).toEqual({ mark: 1, ...before });
  });
}

test('B24 Lange Namen und Englisch: Kartenspiel bleibt auf schmalen Geräten ohne Überbreite', async ({ page, app }, info) => {
  desktopOnly(info);
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await login(page, app, 'WWWWWWWWWWWWWWWW');
  await page.evaluate(() => I18n.select('en'));
  await page.evaluate(() => { location.hash = '#spiele'; });
  await page.locator('[data-host="maumau"]').first().click();
  await page.locator('#host-form button[type=submit]').click();
  await expect.poll(() => page.evaluate(() => lastState?.game)).toBe('maumau');
  await emit(page, 'sit');
  for (let i = 0; i < 4; i++) await emit(page, 'addBot');
  await emit(page, 'start');
  for (const vp of VIEWPORTS.filter((v) => v.width <= 1024)) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(150);
    const m = await page.evaluate(measureLayout);
    expect(problems(m), `Englisch/lange Namen @ ${vp.key}`).toEqual(clean);
  }
});

test('B24 Solo 2048: Spielfeld bleibt quadratisch und der Spielstand bleibt erhalten', async ({ page, app }, info) => {
  desktopOnly(info);
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await login(page, app);
  await page.evaluate(() => { location.hash = '#solo/2048'; });
  await page.locator('[data-setup] button[type=submit]').click();
  await expect(page.locator('.number-tile.filled')).toHaveCount(2);
  const saved = () => page.evaluate(() => localStorage.getItem('poker:singleplayer:2048'));
  const before = await saved();
  await sweep(page, '2048', async (vp) => {
    const b = await page.locator('.number-grid').boundingBox();
    expect(Math.abs(b.width - b.height), `2048 quadratisch @ ${vp.key}`).toBeLessThan(2);
  });
  expect(await saved()).toBe(before);
});

test.describe('B24 Idle', () => {
  test.use({ idleHall: true });
  test('Spielhalle: kein Überlauf und der Spielstand überlebt jeden Größenwechsel', async ({ page, app }, info) => {
    desktopOnly(info);
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await login(page, app);
    await page.evaluate(() => { location.hash = '#spiele/idle'; });
    await page.locator('li[data-id="spielhalle"] a[href="#idle/spielhalle"]').click();
    await page.getByRole('button', { name: 'Spiel starten', exact: true }).click();
    await expect(page.locator('.hall-shell')).toHaveAttribute('data-phase', 'SH-P1');
    await page.getByRole('button', { name: /Kartenrunde spielen/ }).click();
    // Ohne Autogeber gibt es kein passives Einkommen: die Münzen bleiben während des Durchlaufs gleich.
    const resources = () => page.locator('.hall-resources').first().innerText();
    await expect.poll(resources).toMatch(/30/);
    const before = await resources();
    await page.evaluate(() => { window.__b24Mark = 1; });
    await sweep(page, 'Spielhalle');
    expect(await page.evaluate(() => window.__b24Mark)).toBe(1);
    expect(await resources()).toBe(before);
    await expect(page.locator('.hall-shell')).toHaveAttribute('data-phase', 'SH-P1');
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(button(page, 'Speichern')).toBeEnabled();
  });
});
const button = (page, label) => page.getByRole('button', { name: label, exact: true });

test('B24 Tastatur und Touch: Aktionsleiste ist in kleinen Viewports erreichbar und bedienbar', async ({ page, app }, info) => {
  test.setTimeout(90000);
  await login(page, app);
  await selectGame(page, 'viergewinnt');
  await page.locator('#host-form button[type=submit]').click();
  await expect.poll(() => page.evaluate(() => lastState?.game)).toBe('viergewinnt');
  await emit(page, 'sit');
  await emit(page, 'addBot');
  await emit(page, 'start');
  await expect.poll(() => page.evaluate(() => lastState?.phase)).toBe('playing');
  if (info.project.name === 'mobil') await page.setViewportSize({ width: 320, height: 568 });
  // Warten, bis man selbst dran ist, dann eine Spalte per Tippen (Touch) bzw. Tastatur setzen.
  await expect.poll(() => page.evaluate(() => lastState.turnId === lastState.you.id), { timeout: 15000 }).toBe(true);
  const col = page.locator('button.vg-col').nth(3);
  await col.scrollIntoViewIfNeeded();
  await expect(col).toBeInViewport();
  const moves = () => page.evaluate(() => (lastState.g?.board || lastState.board || []).flat().filter(Boolean).length);
  const n = await moves();
  if (info.project.name === 'mobil') await col.tap();
  else { await col.focus(); await page.keyboard.press('Enter'); }
  await expect.poll(moves).toBeGreaterThan(n);
});
