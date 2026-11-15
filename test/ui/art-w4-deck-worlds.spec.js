// ART-W4 · Kartenwelten (Art „deck“) für die Poker-Familie, Blackjack und die klassischen Kartenspiele.
// Referenzen: Poker (eigener Tisch) und Skat (Spiel-Kit) mit Host/Gast, später Zuschauerin, Neuladen, mehrfachem Wechsel, Standard,
// zwei Räumen, fehlender Datei, Geheimhaltung verdeckter Karten und TW-09 Würfel → Brett → Karten. Danach alle übrigen 14 Spiele.
// ART_W4_CAPTURE=1 legt die Vergleichsbilder unter docs/design/art/ART-W4/ ab.
import { test, expect, login, selectGame, expectNoLeak, observeServerView } from './helpers.js';
import { mkdirSync } from 'node:fs';
import { POKER_GAMES, CLASSIC_GAMES, DECK_WORLD_IDS } from '../../public/games/theme-worlds/deck-worlds.js';

const DIR = 'docs/design/art/ART-W4';
const shot = async (p, name, info) => { if (process.env.ART_W4_CAPTURE !== '1') return; mkdirSync(DIR, { recursive: true }); await p.screenshot({ path: `${DIR}/${name}-${info.project.name}.jpg`, type: 'jpeg', quality: 66 }); };
const worldsOf = (game) => (POKER_GAMES.includes(game) ? DECK_WORLD_IDS.poker : DECK_WORLD_IDS.classic);
const MIN = { skat: 3, doppelkopf: 4, hearts: 3, stichmeister: 3, praesident: 3, mogeln: 3 };

// Aussehen der kennzeichnenden Teile: Tisch, offene Karte, Rückseite, Filz; dazu Weltzustand und geladene Stylesheets
const probe = (p) => p.evaluate(() => {
  const kit = document.querySelector('#kg'), root = kit || document.querySelector('#game');
  const look = (sel, pseudo) => { const e = root?.querySelector(sel); if (!e) return null; const c = getComputedStyle(e, pseudo); return [c.backgroundImage, c.backgroundColor, c.color, c.borderTopColor].join('|'); };
  const art = !kit && root?.hasAttribute('data-art-poker');
  return {
    world: document.body.dataset.themeWorld || null, kind: document.body.dataset.themeKind || null,
    links: [...document.querySelectorAll('link[href*="theme-worlds/"]')].map((l) => l.getAttribute('href')),
    table: look(kit ? '.kg-main' : '.table-wrap'),
    face: look(kit ? '.kc:not(.kc-back):not(.kc-empty)' : '.card:not(.back)'),
    back: look(kit ? '.kc-back, .fan i' : '.card.back'),
    felt: kit ? look('.sk-felt, .dk-felt, .hr-felt, .pw-table, .sm-trick, .bj-dealer') : art ? look('.rail', '::before') : look('.felt'),
  };
});
// Verdeckte Karten verraten nichts: keine Rückseite trägt Bildkarten-Kennung, Wert oder Kartenname; jede Bildkarten-Kennung sitzt auf einer offenen Karte mit Wert
const expectSecret = (p) => p.evaluate(() => {
  const backs = [...document.querySelectorAll('.kc-back, .card.back, .fan i')];
  const leakyBack = backs.filter((b) => b.hasAttribute('data-face') || /[2-9TJQKAUOBD]\s*[♣♠♥♦]|Ober|Unter|König|Ass\b/.test(b.getAttribute('aria-label') || ''));
  const faces = [...document.querySelectorAll('[data-face]')];
  const badFace = faces.filter((f) => f.matches('.kc-back, .back') || !/^(J|Q|K|B|D|U|O)$/.test(f.querySelector('.r')?.textContent.trim() || ''));
  return { backs: backs.length, faces: faces.length, leakyBack: leakyBack.length, badFace: badFace.length };
}).then((r) => { expect(r.leakyBack).toBe(0); expect(r.badFace).toBe(0); return r; });

async function expectWorld(p, id, standard) {
  const slug = id.toLowerCase();
  await expect(p.locator('body')).toHaveAttribute('data-theme-world', id);
  await expect(p.locator('body')).toHaveAttribute('data-theme-kind', 'deck');
  await expect.poll(async () => (await probe(p)).table).toContain(`table-${slug}.svg`);
  const pr = await probe(p);
  expect(pr.links).toEqual(['/games/theme-worlds/deck/deck-worlds.css', `/games/theme-worlds/deck/${slug}.css`]); // nie Würfel- oder Brett-Dateien
  if (pr.face) expect(pr.face).toContain(`frame-${slug}.svg`);
  if (pr.back) expect(pr.back).toContain(`back-${slug}.svg`);
  if (pr.felt && standard?.felt) expect(pr.felt).not.toBe(standard.felt);
  const emblem = await p.evaluate(() => { const f = document.querySelector('[data-face]:not(.back):not(.kc-back)'); return f ? getComputedStyle(f).backgroundImage : null; });
  if (emblem) expect(emblem).toContain(`emblem-${slug}.svg`);
  await expectSecret(p);
  return pr;
}
async function expectStandard(p, standard) {
  await expect(p.locator('body')).not.toHaveAttribute('data-theme-world', /./);
  await expect.poll(async () => { const now = await probe(p); return [now.table, now.felt, now.links.length]; }).toEqual([standard.table, standard.felt, 0]);
  const now = await probe(p); if (now.face && standard.face) expect(now.face.split('|')[0]).toBe(standard.face.split('|')[0]);
  const s = await p.evaluate(() => ThemeWorlds.status()); expect(s.world).toBeNull(); expect(s.scope + s.effectScopes).toBe(0);
}

// ---------- Hilfen ----------
async function kitHost(page, app, game, { bots = 0, name = 'Anna' } = {}) {
  await login(page, app, name); await selectGame(page, game);
  await page.locator('#host-form button[type=submit]').click(); await expect(page.locator('#kg')).toBeVisible();
  await page.evaluate(() => send('sit'));
  for (let i = 0; i < bots; i++) await page.evaluate(() => send('addBot'));
  return page.evaluate(() => lastState.code);
}
async function pokerHost(page, app, game = 'poker', name = 'Anna') {
  await login(page, app, name); await selectGame(page, game);
  await page.locator('#host-form button[type=submit]').click(); await page.locator('[data-sit]').first().click();
  return page.evaluate(() => lastState.code);
}
async function guest(browser, info, app, code, name, { mode = 'watch', sit = true } = {}) {
  const ctx = await browser.newContext({ ...info.project.use });
  const p = await ctx.newPage(); observeServerView(p); await login(p, app, name); await p.evaluate(([c, m]) => joinAndEnter(c, m), [code, mode]);
  await expect.poll(() => p.evaluate(() => lastState?.code)).toBe(code);
  if (sit) await p.locator('[data-sit]').first().click();
  return { ctx, p };
}
const pickKit = async (page, id) => { await page.locator('#kg-nav-host').click(); await page.locator(`#kg-panel [data-card-world-pick="${id}"]`).click(); await expect.poll(() => page.evaluate(() => lastState.cardWorld)).toBe(id || null); await page.keyboard.press('Escape').catch(() => {}); };
const pickPoker = async (page, id) => {
  if (!(await page.locator('#panel-body [data-card-world-pick]').first().isVisible().catch(() => false))) await page.locator('#nav-host').click();
  await page.locator(`#panel-body [data-card-world-pick="${id}"]`).click();
  await expect.poll(() => page.evaluate(() => lastState.cardWorld)).toBe(id || null);
};
const toGame = async (page, g, id) => {
  await page.evaluate((x) => send('switchGame', { game: x }), g).catch(() => {}); // lädt die Seite neu
  await expect.poll(() => page.evaluate(([x, w]) => typeof lastState !== 'undefined' && lastState?.game === x && lastState.cardWorld === w && typeof ThemeWorlds !== 'undefined' && ThemeWorlds.status().world === w, [g, id]).catch(() => false), { timeout: 30000 }).toBe(true);
  await page.waitForLoadState('load');
};

test('ART-W4 Poker: Auswahl, Gast, Geheimhaltung, späte Zuschauerin, Neuladen, Wechsel, Standard, zwei Räume', async ({ page, browser, app }, info) => {
  test.setTimeout(300000);
  const code = await pokerHost(page, app);
  const ben = await guest(browser, info, app, code, 'Ben'), others = [ben.ctx];
  try {
    await expect.poll(() => page.evaluate(() => lastState.seats.filter(Boolean).length)).toBe(2);
    expect((await page.evaluate(() => send('settings', { autoNext: false }))).ok).toBe(true);
    expect((await page.evaluate(() => send('start'))).ok).toBe(true);
    await expect.poll(() => page.evaluate(() => !!lastState.hand && !lastState.hand.done)).toBe(true);
    await page.evaluate(() => Promise.all([CardWorlds.ready, ThemeWorlds.ready]));
    await expect.poll(() => page.locator('#game .card.back').count()).toBeGreaterThan(0); // Karten des Gegners verdeckt (mobil im Platz ausgeblendet)
    const standard = await probe(page);
    await shot(page, 'poker-standard', info);
    // Weltwechsel ohne Datenleck: kein Stand anderer Spieler taucht in DOM, Attributen oder Animationen auf
    await expectNoLeak(page, { action: async () => { for (const id of DECK_WORLD_IDS.poker) { await pickPoker(page, id); await expectWorld(page, id, standard); } } });
    for (const id of DECK_WORLD_IDS.poker) {
      await pickPoker(page, id);
      for (const p of [page, ben.p]) await expectWorld(p, id, standard);
      expect(await page.locator('#game .seat:not(.me) .card:not(.back)').count()).toBe(0); // fremde Handkarten bleiben verdeckt
      await page.locator('#panel-close').click(); await expect(page.locator('#panel-body [data-card-world-pick]').first()).toBeHidden(); // Host-Menü zu, Tisch frei fürs Bild
      await shot(page, `poker-${id.toLowerCase()}`, info);
    }
    // Wer am Zug ist, bleibt sichtbar markiert (Farbe der Welt)
    expect(await page.locator('#game .seat.turn .plate').first().evaluate((e) => getComputedStyle(e).boxShadow)).toMatch(/rgb/);
    // Spät beitretende Zuschauerin und Neuladen
    const late = await guest(browser, info, app, code, 'Cleo', { sit: false }); others.push(late.ctx);
    await expectWorld(late.p, 'TW-01', standard);
    await ben.p.reload(); await expect.poll(() => ben.p.evaluate(() => typeof ThemeWorlds !== 'undefined' && ThemeWorlds.status().world), { timeout: 15000 }).toBe('TW-01');
    // Zweiter Raum bleibt Standard
    const roomB = await browser.newContext({ ...info.project.use }); others.push(roomB);
    const bp = await roomB.newPage(); await pokerHost(bp, app, 'poker', 'Dora'); await bp.evaluate(() => ThemeWorlds.ready);
    const bStandard = await probe(bp); expect(bStandard.world).toBeNull();
    await pickPoker(page, 'TW-13'); await expectWorld(ben.p, 'TW-13', standard); await bp.waitForTimeout(300); expect(await probe(bp)).toEqual(bStandard);
    // Mehrfacher Wechsel mit Standard
    for (const id of ['TW-03', '', 'TW-14', 'TW-01', '']) { await pickPoker(page, id); if (id) await expectWorld(page, id, standard); else await expectStandard(page, standard); }
    await expectStandard(ben.p, standard);
  } finally { for (const c of others) await c.close(); }
});

test('ART-W4 Skat: Auswahl, Bots, Geheimhaltung, Tastatur, Wechsel, Standard; TW-09 Würfel → Brett → Karten ohne Vermischung', async ({ page, app }, info) => {
  test.setTimeout(300000);
  await kitHost(page, app, 'skat', { bots: 2 });
  await page.evaluate(() => send('start')); await expect.poll(() => page.evaluate(() => lastState.phase)).toBe('playing');
  await page.evaluate(() => Promise.all([CardWorlds.ready, ThemeWorlds.ready]));
  await expect(page.locator('#kg .kc:not(.kc-back)').first()).toBeVisible();
  const standard = await probe(page);
  await shot(page, 'skat-standard', info);
  // Aufzeichnung nur über Tisch und Handkarten (das Host-Menü würde die Stichprobe sprengen); Wechsel direkt über das Ereignis
  await expectNoLeak(page, { scope: '#kg-main, #kg-dock', requireSecrets: false, action: async () => { for (const id of DECK_WORLD_IDS.classic) { expect((await page.evaluate((w) => send('setCardWorld', { world: w }), id)).ok).toBe(true); await expectWorld(page, id, standard); } } });
  for (const id of DECK_WORLD_IDS.classic) {
    await pickKit(page, id); await expectWorld(page, id, standard);
    // Tastatur: Handkarte erreichbar, Fokus sichtbar; Farben der Werte bleiben (Rot gegen Schwarz)
    const card = page.locator('#kg .kc:not(.kc-back):not(:disabled)').first();
    if (await card.count()) { await card.focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab'); }
    await shot(page, `skat-${id.toLowerCase()}`, info);
  }
  for (const id of ['TW-02', '', 'TW-10', 'TW-14', '']) { await pickKit(page, id); if (id) await expectWorld(page, id, standard); else await expectStandard(page, standard); }
  // TW-09 in drei Ausprägungen: Kniffel (Würfel) → Schach (Brett) → Skat (Karten); je Spiel nur die passenden Dateien
  await pickKit(page, 'TW-09');
  await page.evaluate(() => send('abortRound', {})).catch(() => {});
  const files = () => page.evaluate(() => [document.body.dataset.themeKind, ...[...document.querySelectorAll('link[href*="theme-worlds/"]')].map((l) => l.getAttribute('href'))]).catch(() => 'lädt');
  for (const [g, kind, dir] of [['kniffel', 'dice', 'dice/dice-worlds.css'], ['schach', 'board', 'board/board-worlds.css'], ['skat', 'deck', 'deck/deck-worlds.css']]) {
    await toGame(page, g, 'TW-09');
    await expect.poll(files, { timeout: 15000 }).toEqual([kind, `/games/theme-worlds/${dir}`, `/games/theme-worlds/${dir.split('/')[0]}/tw-09.css`]);
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector('#kg .kg-main')).backgroundImage).catch(() => 'lädt'), { timeout: 15000 }).toContain(`/${dir.split('/')[0]}/table-tw-09.svg`); // Seite lädt beim Spielwechsel neu
  }
});

test('ART-W4: fehlende Welt-Datei → Standard; reduzierte Bewegung; Mobil ohne Überlauf; Auswahl per Tippen bleibt', async ({ page, app, browser, browserName }, info) => {
  test.setTimeout(150000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const code = await kitHost(page, app, 'mogeln', { bots: 2 });
  const cleo = await guest(browser, info, app, code, 'Cleo', { sit: false });
  try {
  await page.evaluate(() => send('start')); await expect.poll(() => page.evaluate(() => lastState.phase)).toBe('playing');
  await page.evaluate(() => ThemeWorlds.ready);
  await pickKit(page, 'TW-10'); await expectWorld(page, 'TW-10');
  const anim = await page.evaluate(() => [...document.querySelectorAll('#kg .kc, #kg .kg-main, #kg .fan i')].filter((e) => getComputedStyle(e).animationName !== 'none').length);
  expect(anim).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  // Auswahl einer Karte (Tippen/Klicken) funktioniert unter der Welt wie vorher, die Markierung bleibt sichtbar
  if (await page.evaluate(() => lastState.turnId === lastState.you.id)) {
    const c = page.locator('#kg .kg-hand .kc:not(:disabled)').last(); // überlappende Hand: die oberste Karte ist ganz frei
    if (await c.count()) { await c.click(); await expect(page.locator('#kg .kg-hand .kc.sel')).toHaveCount(1); expect(await page.locator('#kg .kc.sel').evaluate((e) => getComputedStyle(e).boxShadow)).toMatch(/rgb/); }
  }
  // Fehlende Datei bei einer Zuschauerin: dort Standard, beim Host weiter die Welt
  if (browserName !== 'webkit') { // WebKit leitet Bildanfragen nicht über page.route
    await cleo.p.route('**/games/theme-worlds/deck/back-tw-02.svg', (r) => r.fulfill({ status: 404, body: '' }));
    await pickKit(page, 'TW-02'); await expectWorld(page, 'TW-02');
    await expect.poll(() => cleo.p.evaluate(() => ThemeWorlds.status().failed)).toContain('TW-02');
    await expect(cleo.p.locator('body')).not.toHaveAttribute('data-theme-world', /./);
    await expect(cleo.p.locator('link[href*="theme-worlds/deck"]')).toHaveCount(0);
  }
  } finally { await cleo.ctx.close(); }
});

for (const game of [...POKER_GAMES, ...CLASSIC_GAMES].filter((g) => !['poker', 'skat'].includes(g))) {
  test(`ART-W4 ${game}: alle vier Welten greifen, Karten geheim, Standard wie vorher`, async ({ page, app, browser }, info) => {
    test.setTimeout(150000);
    const others = [];
    try {
      if (game === 'omaha') {
        const code = await pokerHost(page, app, 'omaha'); const ben = await guest(browser, info, app, code, 'Ben'); others.push(ben.ctx);
        await expect.poll(() => page.evaluate(() => lastState.seats.filter(Boolean).length)).toBe(2);
        await page.evaluate(() => send('settings', { autoNext: false })); expect((await page.evaluate(() => send('start'))).ok).toBe(true);
        await expect.poll(() => page.evaluate(() => !!lastState.hand)).toBe(true);
      } else {
        await kitHost(page, app, game, { bots: Math.max(1, (MIN[game] || 2) - 1) });
        expect((await page.evaluate(() => send('start'))).ok).toBe(true);
        await expect.poll(() => page.evaluate(() => lastState.phase), { timeout: 15000 }).toBe('playing');
      }
      await page.evaluate(() => Promise.all([CardWorlds.ready, ThemeWorlds.ready]));
      await page.waitForTimeout(400);
      const standard = await probe(page);
      for (const id of worldsOf(game)) {
        expect((await page.evaluate((w) => send('setCardWorld', { world: w }), id)).ok).toBe(true);
        await expectWorld(page, id, standard);
        await shot(page, `${game}-${id.toLowerCase()}`, info);
      }
      expect((await page.evaluate(() => send('setCardWorld', { world: 'TW-08' }))).ok).toBe(false); // Brettwelt gibt es hier nicht
      expect((await page.evaluate(() => send('setCardWorld', { world: '' }))).ok).toBe(true);
      await expectStandard(page, standard);
    } finally { for (const c of others) await c.close(); }
  });
}
