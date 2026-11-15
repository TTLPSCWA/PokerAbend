// ART-W2 · Würfelwelten TW-14 Saloon, TW-11 Piratenbucht, TW-09 Runen & Nordlicht, TW-13 Neon-Arcade.
// Kniffel als Referenz: Host-Menü, Gäste, späte Spielerin, Neuladen, Halten eines Würfels, mehrfacher Wechsel, Standard, zwei Räume,
// Tisch verlassen, zurück zur Startseite, Spielwechsel, Dateifehler, reduzierte Bewegung, Mobil. Danach alle 13 Würfelspiele.
// ART_W2_CAPTURE=1 legt die Vergleichsbilder unter docs/design/art/ART-W2/ ab.
import { test, expect, login, selectGame } from './helpers.js';
import { mkdirSync } from 'node:fs';
import { DICE_GAMES, DICE_WORLDS } from '../../public/games/theme-worlds/dice-worlds.js';

const DIR = 'docs/design/art/ART-W2';
const WORLDS = DICE_WORLDS.map((w) => w.id);
const shot = async (p, name, info) => { if (process.env.ART_W2_CAPTURE !== '1') return; mkdirSync(DIR, { recursive: true }); await p.screenshot({ path: `${DIR}/${name}-${info.project.name}.jpg`, type: 'jpeg', quality: 72 }); };
const lum = (rgb) => { const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const rgbList = (s) => [...s.matchAll(/rgba?\((\d+), (\d+), (\d+)/g)].map((m) => [+m[1], +m[2], +m[3]]);

// Prüfwürfel im Spielbereich: gleicher Baustein wie im Spiel (dieHTML), damit jedes Spiel unabhängig vom Spielstand geprüft wird
const probe = (p) => p.evaluate(() => {
  const main = document.querySelector('#kg .kg-main'); main.insertAdjacentHTML('beforeend', dieHTML(5, { cls: 'big tw-probe', attrs: 'style="position:absolute;opacity:.001;pointer-events:none"' }));
  const d = main.querySelector('.tw-probe'), cs = getComputedStyle(d), pip = getComputedStyle(d.querySelector('i.on'));
  const out = { face: cs.backgroundImage + '|' + cs.backgroundColor, outline: cs.outlineColor + ' ' + cs.outlineStyle, pip: pip.backgroundColor, table: getComputedStyle(main).backgroundImage, kind: document.body.dataset.themeKind || null, world: document.body.dataset.themeWorld || null, links: [...document.querySelectorAll('link[href*="theme-worlds/dice"]')].map((l) => l.getAttribute('href')) };
  d.remove(); return out;
});
async function host(page, app, game, { bots = 0, name = 'Anna' } = {}) {
  await login(page, app, name); await selectGame(page, game);
  await page.locator('#host-form button[type=submit]').click(); await expect(page.locator('#kg')).toBeVisible();
  await page.evaluate(() => send('sit'));
  for (let i = 0; i < bots; i++) await page.evaluate(() => send('addBot'));
  return page.evaluate(() => lastState.code);
}
async function guest(browser, info, app, code, name) {
  const ctx = await browser.newContext({ ...info.project.use, viewport: info.project.use.viewport });
  const p = await ctx.newPage(); await login(p, app, name); await p.evaluate((c) => joinAndEnter(c, 'sit'), code);
  await expect.poll(() => p.evaluate(() => lastState?.code)).toBe(code); return { ctx, p };
}
const pick = async (page, id) => { await page.locator('#kg-nav-host').click(); await page.locator(`#kg-panel [data-card-world-pick="${id}"]`).click(); await expect.poll(() => page.evaluate(() => lastState.cardWorld)).toBe(id || null); await page.keyboard.press('Escape').catch(() => {}); };
async function expectWorld(p, id) {
  await expect(p.locator('body')).toHaveAttribute('data-theme-world', id);
  await expect.poll(async () => (await probe(p)).table).toContain(`table-${id.toLowerCase()}.svg`);
  const pr = await probe(p);
  expect(pr.kind).toBe('dice'); expect(pr.links).toEqual(['/games/theme-worlds/dice/dice-worlds.css', `/games/theme-worlds/dice/${id.toLowerCase()}.css`]);
  // Augen bleiben deutlich: Kontrast Auge zu jeder Farbe der Würfelfläche mindestens 3:1 (grafisches Element, WCAG 1.4.11)
  const pip = rgbList(pr.pip)[0]; for (const face of rgbList(pr.face.split('|')[0])) expect(contrast(pip, face)).toBeGreaterThanOrEqual(3);
  return pr;
}
async function expectStandard(p, before) {
  await expect(p.locator('body')).not.toHaveAttribute('data-theme-world', /./);
  const now = await probe(p); expect(now).toEqual(before);
  const s = await p.evaluate(() => ThemeWorlds.status()); expect(s.world).toBeNull(); expect(s.scope + s.effectScopes).toBe(0);
}

test('ART-W2 Kniffel: Auswahl, Synchronisierung, Halten, Wechsel, Standard, zwei Räume, Verlassen, Spielwechsel', async ({ page, browser, app }, info) => {
  test.setTimeout(300000);
  const code = await host(page, app, 'kniffel');
  const ben = await guest(browser, info, app, code, 'Ben'), others = [ben.ctx];
  try {
    await page.evaluate(() => send('start')); await expect.poll(() => page.evaluate(() => lastState.phase)).toBe('playing');
    await page.evaluate(() => Promise.all([CardWorlds.ready, ThemeWorlds.ready]));
    const standard = await probe(page);
    await shot(page, 'kniffel-standard', info);
    // Würfeln und einen Würfel halten, damit gehaltene Würfel geprüft werden
    if (await page.evaluate(() => lastState.turnId === lastState.you.id)) { await page.evaluate(() => send('roll', { keep: [] })); await page.locator('[data-g="keep"]').first().click(); }
    for (const id of WORLDS) {
      await pick(page, id);
      for (const p of [page, ben.p]) await expectWorld(p, id);
      const kept = page.locator('#kg .die.kept').first();
      if (await kept.count()) expect(await kept.evaluate((e) => getComputedStyle(e).boxShadow)).toMatch(/rgb/);
      await shot(page, `kniffel-${id.toLowerCase()}`, info);
    }
    // Spät beitretende Zuschauerin und Neuladen eines Mitspielers
    const late = await browser.newContext({ ...info.project.use }); others.push(late);
    const lp = await late.newPage(); await login(lp, app, 'Cleo'); await lp.evaluate((c) => joinAndEnter(c, 'watch'), code);
    await expectWorld(lp, 'TW-13');
    await ben.p.reload(); await expect.poll(() => ben.p.evaluate(() => typeof ThemeWorlds !== 'undefined' && ThemeWorlds.status().world), { timeout: 15000 }).toBe('TW-13');
    // Zweiter Raum gleichzeitig: bleibt im Standard, Wechsel in Raum A ändert ihn nicht
    const roomB = await browser.newContext({ ...info.project.use }); others.push(roomB);
    const bp = await roomB.newPage(); await host(bp, app, 'kniffel', { name: 'Dora' });
    await bp.evaluate(() => ThemeWorlds.ready);
    const bStandard = await probe(bp); expect(bStandard.world).toBeNull();
    await pick(page, 'TW-09'); await expectWorld(ben.p, 'TW-09'); await bp.waitForTimeout(300); expect(await probe(bp)).toEqual(bStandard);
    // Mehrfacher Wechsel, dann Standard: alles wie vorher
    for (const id of ['TW-14', '', 'TW-11', 'TW-13', '']) { await pick(page, id); if (id) await expectWorld(page, id); else await expectStandard(page, standard); }
    await expectStandard(ben.p, standard);
    // Spielwechsel: Welt bleibt in einem anderen Würfelspiel, verschwindet in einem Spiel ohne diese Welt
    await pick(page, 'TW-14');
    await page.evaluate(() => send('abortRound', {})).catch(() => {});
    await page.evaluate(() => send('switchGame', { game: 'maexchen' })).catch(() => {}); // lädt die Seite neu
    await expect.poll(() => page.evaluate(() => typeof lastState !== 'undefined' && lastState?.game).catch(() => null), { timeout: 20000 }).toBe('maexchen');
    await page.waitForLoadState('load'); await page.waitForFunction(() => typeof ThemeWorlds !== 'undefined' && document.querySelector('#kg .kg-main'));
    await expectWorld(page, 'TW-14');
    await page.evaluate(() => send('switchGame', { game: 'viergewinnt' })).catch(() => {}); // lädt die Seite neu
    await expect.poll(() => page.evaluate(() => typeof lastState !== 'undefined' && lastState?.game).catch(() => null), { timeout: 20000 }).toBe('viergewinnt');
    await expect.poll(() => page.evaluate(() => lastState.cardWorld).catch(() => 'lädt')).toBeNull();
    await expect(page.locator('body')).not.toHaveAttribute('data-theme-world', /./);
    await expect(page.locator('link[href*="theme-worlds/dice"]')).toHaveCount(0);
    // Tisch verlassen bzw. zurück zur Startseite beim Gast: nichts bleibt
    await bp.evaluate(() => send('setCardWorld', { world: 'TW-11' })); await expectWorld(bp, 'TW-11');
    await bp.evaluate(() => parkRoom()); await expect(bp.locator('body')).not.toHaveAttribute('data-theme-world', /./); await expect(bp.locator('link[href*="theme-worlds"]')).toHaveCount(0);
    await bp.evaluate(() => returnToRoom()); await expectWorld(bp, 'TW-11');
    await bp.evaluate(() => leaveTable()); await expect(bp.locator('body')).not.toHaveAttribute('data-theme-world', /./); await expect(bp.locator('link[href*="theme-worlds"]')).toHaveCount(0);
  } finally { for (const c of others) await c.close(); }
});

test('ART-W2: fehlende Welt-Datei → Standard; reduzierte Bewegung; Mobil ohne Überlauf; Bedienelemente groß genug', async ({ page, browser, app, browserName }, info) => {
  test.setTimeout(150000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const code = await host(page, app, 'kniffel');
  const ben = await guest(browser, info, app, code, 'Ben');
  try {
    await page.evaluate(() => send('start')); await expect.poll(() => page.evaluate(() => lastState.phase)).toBe('playing');
    if (browserName !== 'webkit') await ben.p.route('**/games/theme-worlds/dice/preview-tw-14.svg', (r) => r.fulfill({ status: 404, body: '' })); // WebKit leitet Bildanfragen nicht über page.route
    await pick(page, 'TW-14'); await expectWorld(page, 'TW-14');
    if (browserName !== 'webkit') { await expect.poll(() => ben.p.evaluate(() => ThemeWorlds.status().failed)).toContain('TW-14'); await expect(ben.p.locator('body')).not.toHaveAttribute('data-theme-world', /./); }
    // Keine Welt-Animation: nichts läuft auf Würfeln oder Tisch
    const anim = await page.evaluate(() => [...document.querySelectorAll('#kg .die, #kg .kg-main')].map((e) => getComputedStyle(e).animationName).filter((n) => n !== 'none'));
    expect(anim).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    for (const b of await page.locator('#kg-dock .btn').all()) { const box = await b.boundingBox(); if (box) expect(box.height).toBeGreaterThanOrEqual(43); }
    await pick(page, 'TW-13'); await expectWorld(page, 'TW-13');
  } finally { await ben.ctx.close(); }
});

for (const [i, game] of DICE_GAMES.entries()) {
  test(`ART-W2 ${game}: alle vier Welten greifen, Augen lesbar, Standard wie vorher`, async ({ page, app }, info) => {
    test.setTimeout(120000);
    const minPlayers = { 'wuerfel-auktion': 3, kniffel: 1, monsterwuerfel: 1, shutthebox: 1 }[game] ?? 2;
    await host(page, app, game, { bots: Math.max(1, minPlayers - 1) });
    await page.evaluate(() => send('start'));
    await expect.poll(() => page.evaluate(() => lastState.phase), { timeout: 15000 }).toBe('playing');
    await page.evaluate(() => Promise.all([CardWorlds.ready, ThemeWorlds.ready]));
    const standard = await probe(page);
    for (const id of WORLDS) {
      expect((await page.evaluate((w) => send('setCardWorld', { world: w }), id)).ok).toBe(true);
      await expectWorld(page, id);
      if (game === 'maexchen' && await page.locator('#kg .mx-cup').count()) expect(await page.locator('#kg .mx-cup').first().evaluate((e) => getComputedStyle(e).backgroundImage)).toContain(`cup-${id.toLowerCase()}.svg`);
      if (game === 'shutthebox') { const f = page.locator('#kg .sb-flap:not(.sel):not(.shut)').first(); if (await f.count()) expect(await f.evaluate((e) => getComputedStyle(e).backgroundImage)).toMatch(/gradient/); }
      if (id === WORLDS[i % 4]) await shot(page, `${game}-${id.toLowerCase()}`, info);
    }
    expect((await page.evaluate(() => send('setCardWorld', { world: '' }))).ok).toBe(true);
    await expectStandard(page, standard);
  });
}
