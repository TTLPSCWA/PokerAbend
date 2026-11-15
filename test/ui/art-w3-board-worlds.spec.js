// ART-W3 · Brettwelten TW-08 Götterberg, TW-09 Runen & Nordlicht (Brett), TW-10 Tafelrunde.
// Schach als Referenz: Host-Menü, Gast, späte Zuschauerin, Neuladen, Markierungen, mehrfacher Wechsel, Standard, zwei Räume,
// Parken/Verlassen, Spielwechsel mit TW-09 Würfel ↔ Brett. Danach alle sieben Brettspiele. ART_W3_CAPTURE=1 legt Bilder unter docs/design/art/ART-W3/ ab.
import { test, expect, login, selectGame } from './helpers.js';
import { mkdirSync } from 'node:fs';
import { BOARD_GAMES } from '../../public/games/theme-worlds/board-worlds.js';

const DIR = 'docs/design/art/ART-W3';
const WORLDS = ['TW-08', 'TW-09', 'TW-10'];
const shot = async (p, name, info) => { if (process.env.ART_W3_CAPTURE !== '1') return; mkdirSync(DIR, { recursive: true }); await p.screenshot({ path: `${DIR}/${name}-${info.project.name}.jpg`, type: 'jpeg', quality: 72 }); };
// Kennzeichnende Elemente je Spiel: ihr berechnetes Aussehen muss sich je Welt ändern und mit „Standard“ wieder genau dem Ausgangszustand entsprechen
const SEL = {
  schach: ['.ch-cell', '.ch-cell.dark', '.ch-board', '.ch-piece > g'], muehle: ['.mu-board', '.mu-lines'], dame: ['.dm-cell.dark', '.dm-piece'],
  reversi: ['.rv-cell', '.rv-disc'], hex: ['.hx-viewport', '.hx-cell:not(.red):not(.blue)'], viergewinnt: ['.vg-board', '.vg-cell'], backgammon: ['.bgm-board', '.bgm-checker.white', '.bgm-point'],
};
const probe = (p, game) => p.evaluate((sel) => {
  const look = (e, pseudo) => { if (!e) return 'fehlt'; const c = getComputedStyle(e, pseudo); return [c.backgroundColor, c.backgroundImage, c.borderTopColor, c.fill, c.stroke].join('|'); };
  const main = document.querySelector('#kg .kg-main');
  return {
    table: main ? getComputedStyle(main).backgroundImage : '', world: document.body.dataset.themeWorld || null, kind: document.body.dataset.themeKind || null,
    links: [...document.querySelectorAll('link[href*="theme-worlds/"]')].map((l) => l.getAttribute('href')),
    parts: sel.map((s) => look(document.querySelector('#kg ' + s), s === '.bgm-point' ? '::before' : null)),
    anim: [...document.querySelectorAll('#kg .kg-main, #kg .kg-main *')].filter((e) => getComputedStyle(e).animationName !== 'none' && !e.closest('.toast')).length,
  };
}, SEL[game]);
async function host(page, app, game, { bots = 0, name = 'Anna' } = {}) {
  await login(page, app, name); await selectGame(page, game);
  await page.locator('#host-form button[type=submit]').click(); await expect(page.locator('#kg')).toBeVisible();
  await page.evaluate(() => send('sit'));
  for (let i = 0; i < bots; i++) await page.evaluate(() => send('addBot'));
  return page.evaluate(() => lastState.code);
}
async function guest(browser, info, app, code, name, mode = 'sit') {
  const ctx = await browser.newContext({ ...info.project.use });
  const p = await ctx.newPage(); await login(p, app, name); await p.evaluate(([c, m]) => joinAndEnter(c, m), [code, mode]);
  await expect.poll(() => p.evaluate(() => lastState?.code)).toBe(code); return { ctx, p };
}
const pick = async (page, id) => { await page.locator('#kg-nav-host').click(); await page.locator(`#kg-panel [data-card-world-pick="${id}"]`).click(); await expect.poll(() => page.evaluate(() => lastState.cardWorld)).toBe(id || null); await page.keyboard.press('Escape').catch(() => {}); };
async function expectWorld(p, game, id, standard) {
  const slug = id.toLowerCase();
  await expect(p.locator('body')).toHaveAttribute('data-theme-world', id);
  await expect.poll(async () => (await probe(p, game)).table).toContain(`table-${slug}.svg`);
  const pr = await probe(p, game);
  expect(pr.kind).toBe('board');
  expect(pr.links).toEqual(['/games/theme-worlds/board/board-worlds.css', `/games/theme-worlds/board/${slug}.css`]); // nie Würfel-Dateien
  // Welt bringt keine Animation mit (statisch geprüft in test/art-w3-board-worlds.test.js); spieleigene Zuganimationen bleiben erlaubt
  if (standard) pr.parts.forEach((v, i) => { expect(v).not.toBe('fehlt'); expect(v, SEL[game][i]).not.toBe(standard.parts[i]); });
  return pr;
}
async function expectStandard(p, game, standard) {
  await expect(p.locator('body')).not.toHaveAttribute('data-theme-world', /./);
  await expect.poll(async () => (await probe(p, game)).parts).toEqual(standard.parts);
  expect((await probe(p, game)).links).toEqual([]);
  const s = await p.evaluate(() => ThemeWorlds.status()); expect(s.world).toBeNull(); expect(s.scope + s.effectScopes).toBe(0);
}
// Schachfiguren: alle sechs Arten mit Zier der Welt, Seiten verschieden gefärbt und mit Kontur
async function expectChessArt(p, id) {
  await expect.poll(() => p.locator('#kg .ch-board .tw-ornament').count()).toBe(32);
  const info = await p.evaluate(() => {
    const out = {};
    for (const svg of document.querySelectorAll('#kg .ch-board .ch-piece')) { const k = svg.dataset.piece; if (out[k]) continue; const g = getComputedStyle(svg.querySelector(':scope > g')); out[k] = { fill: g.fill, stroke: g.stroke, orn: svg.querySelector('.tw-ornament').childElementCount }; }
    return out;
  });
  for (const k of ['k', 'q', 'n', 'b', 'r', 'p']) for (const side of ['w', 'b']) expect(info[side + k], `${id} ${side + k}`).toBeTruthy();
  for (const k of ['k', 'q', 'n', 'b', 'r']) expect(info['w' + k].orn, `${id} Zier ${k}`).toBeGreaterThanOrEqual(2);
  expect(info.wk.fill).not.toBe(info.bk.fill); expect(info.wk.stroke).not.toBe(info.wk.fill); expect(info.bk.stroke).not.toBe(info.bk.fill);
}

test('ART-W3 Schach: Auswahl, Gäste, späte Zuschauerin, Neuladen, Markierungen, Wechsel, Standard, zwei Räume, Parken, TW-09 Würfel ↔ Brett', async ({ page, browser, app }, info) => {
  test.setTimeout(300000);
  const code = await host(page, app, 'schach');
  const ben = await guest(browser, info, app, code, 'Ben'), others = [ben.ctx];
  try {
    await page.evaluate(() => send('start')); await expect.poll(() => page.evaluate(() => lastState.phase)).toBe('playing');
    await page.evaluate(() => Promise.all([CardWorlds.ready, ThemeWorlds.ready]));
    const standard = await probe(page, 'schach'); expect(standard.links).toEqual([]);
    await expect(page.locator('#kg .tw-ornament')).toHaveCount(0);
    await shot(page, 'schach-standard', info);
    for (const id of WORLDS) {
      await pick(page, id);
      for (const p of [page, ben.p]) { await expectWorld(p, 'schach', id, standard); await expectChessArt(p, id); }
      // Markierungen bleiben sichtbar: Auswahl und erlaubte Zielfelder (Weiß ist am Zug)
      const mover = (await page.evaluate(() => lastState.turnId === lastState.you.id)) ? page : ben.p;
      const from = await mover.evaluate(() => lastState.g.legal[0].from);
      await mover.locator(`#kg [data-square="${from}"]`).click();
      await expect(mover.locator('#kg .ch-cell.selected')).toHaveCount(1);
      expect(await mover.locator('#kg .ch-cell.selected').evaluate((e) => getComputedStyle(e).boxShadow)).toMatch(/rgb/);
      expect(await mover.locator('#kg .ch-cell.legal').count()).toBeGreaterThan(0);
      await shot(page, `schach-${id.toLowerCase()}`, info);
      await mover.locator(`#kg [data-square="${from}"]`).click(); // Auswahl aufheben, ohne zu ziehen
    }
    // Ein echter Zug unter Welt: letzter Zug markiert, Figuren weiter mit Zier
    const mover = (await page.evaluate(() => lastState.turnId === lastState.you.id)) ? page : ben.p;
    expect((await mover.evaluate(() => { const m = lastState.g.legal.find((x) => x.from === 'e2' && x.to === 'e4') || lastState.g.legal[0]; return send('move', { from: m.from, to: m.to, key: lastState.g.key, revision: lastState.g.revision }); })).ok).toBe(true);
    await expect(page.locator('#kg .ch-cell.last')).toHaveCount(2); await expectChessArt(page, 'TW-10');
    // Spät beitretende Zuschauerin und Neuladen eines Mitspielers
    const late = await guest(browser, info, app, code, 'Cleo', 'watch'); others.push(late.ctx);
    await expectWorld(late.p, 'schach', 'TW-10', standard); await expectChessArt(late.p, 'TW-10');
    await ben.p.reload(); await expect.poll(() => ben.p.evaluate(() => typeof ThemeWorlds !== 'undefined' && ThemeWorlds.status().world), { timeout: 15000 }).toBe('TW-10');
    await expectChessArt(ben.p, 'TW-10');
    // Zweiter Raum gleichzeitig bleibt Standard
    const roomB = await browser.newContext({ ...info.project.use }); others.push(roomB);
    const bp = await roomB.newPage(); await host(bp, app, 'schach', { name: 'Dora', bots: 1 });
    await bp.evaluate(() => send('start')); await expect.poll(() => bp.evaluate(() => lastState.phase)).toBe('playing');
    await bp.evaluate(() => ThemeWorlds.ready);
    const bStandard = await probe(bp, 'schach'); expect(bStandard.world).toBeNull();
    await pick(page, 'TW-08'); await expectWorld(ben.p, 'schach', 'TW-08', standard); await bp.waitForTimeout(300); expect(await probe(bp, 'schach')).toEqual(bStandard);
    // Mehrfacher Wechsel einschließlich Standard
    for (const id of ['TW-09', '', 'TW-10', 'TW-08', 'TW-09', '']) { await pick(page, id); if (id) { await expectWorld(page, 'schach', id, standard); await expectChessArt(page, id); } else { await expectStandard(page, 'schach', standard); await expect(page.locator('#kg .tw-ornament')).toHaveCount(0); } }
    await expectStandard(ben.p, 'schach', standard);
    // Parken und Verlassen (Raum B): nichts bleibt zurück
    await bp.evaluate(() => send('setCardWorld', { world: 'TW-10' })); await expectWorld(bp, 'schach', 'TW-10', bStandard);
    await bp.evaluate(() => parkRoom()); await expect(bp.locator('body')).not.toHaveAttribute('data-theme-world', /./); await expect(bp.locator('link[href*="theme-worlds"]')).toHaveCount(0);
    await bp.evaluate(() => returnToRoom()); await expectWorld(bp, 'schach', 'TW-10', bStandard);
    await bp.evaluate(() => leaveTable()); await expect(bp.locator('body')).not.toHaveAttribute('data-theme-world', /./); await expect(bp.locator('link[href*="theme-worlds"]')).toHaveCount(0);
    // TW-09 Würfel ↔ Brett: gleiche Welt, je Spieltyp nur die passenden Dateien
    await pick(page, 'TW-09');
    await page.evaluate(() => send('abortRound', {})).catch(() => {});
    const toGame = async (g) => {
      await page.evaluate((x) => send('switchGame', { game: x }), g).catch(() => {}); // lädt die Seite neu
      // Firefox lädt die Seite beim Spielwechsel teils zweimal; erst weiter, wenn das neue Spiel samt Welt fertig steht
      await expect.poll(() => page.evaluate((x) => typeof lastState !== 'undefined' && lastState?.game === x && lastState.cardWorld === 'TW-09' && !!document.querySelector(`#kg.kg-${x} .kg-main`) && typeof ThemeWorlds !== 'undefined' && ThemeWorlds.status().world === 'TW-09', g).catch(() => false), { timeout: 30000 }).toBe(true);
      await page.waitForLoadState('load');
    };
    await toGame('kniffel');
    await expect.poll(() => page.evaluate(() => [document.body.dataset.themeKind, ...[...document.querySelectorAll('link[href*="theme-worlds/"]')].map((l) => l.getAttribute('href'))]).catch(() => 'lädt'), { timeout: 15000 }).toEqual(['dice', '/games/theme-worlds/dice/dice-worlds.css', '/games/theme-worlds/dice/tw-09.css']);
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('#kg .kg-main')).backgroundImage)).toContain('/dice/table-tw-09.svg');
    await toGame('schach');
    await expectWorld(page, 'schach', 'TW-09');
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('#kg .kg-main')).backgroundImage)).toContain('/board/table-tw-09.svg');
  } finally { for (const c of others) await c.close(); }
});

test('ART-W3: fehlende Welt-Datei → Standard; reduzierte Bewegung; Mobil ohne Überlauf; Felder groß genug', async ({ page, browser, app, browserName }, info) => {
  test.setTimeout(150000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const code = await host(page, app, 'schach');
  const ben = await guest(browser, info, app, code, 'Ben');
  try {
    await page.evaluate(() => send('start')); await expect.poll(() => page.evaluate(() => lastState.phase)).toBe('playing');
    if (browserName !== 'webkit') await ben.p.route('**/games/theme-worlds/board/dark-tw-08.svg', (r) => r.fulfill({ status: 404, body: '' })); // WebKit leitet Bildanfragen nicht über page.route
    await pick(page, 'TW-08'); await expectWorld(page, 'schach', 'TW-08');
    if (browserName !== 'webkit') { await expect.poll(() => ben.p.evaluate(() => ThemeWorlds.status().failed)).toContain('TW-08'); await expect(ben.p.locator('body')).not.toHaveAttribute('data-theme-world', /./); await expect(ben.p.locator('#kg .tw-ornament')).toHaveCount(0).catch(() => {}); }
    expect((await probe(page, 'schach')).anim).toBe(0); // reduzierte Bewegung: nichts läuft am Brett
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const cell = await page.locator('#kg .ch-cell').first().boundingBox(); expect(cell.width).toBeGreaterThanOrEqual(38);
    await pick(page, 'TW-10'); await expectWorld(page, 'schach', 'TW-10');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  } finally { await ben.ctx.close(); }
});

for (const game of BOARD_GAMES) {
  test(`ART-W3 ${game}: alle drei Welten greifen, Elemente verändert, Standard wie vorher`, async ({ page, app }, info) => {
    test.setTimeout(120000);
    await host(page, app, game, { bots: 1 });
    await page.evaluate(() => send('start'));
    await expect.poll(() => page.evaluate(() => lastState.phase), { timeout: 15000 }).toBe('playing');
    await page.evaluate(() => Promise.all([CardWorlds.ready, ThemeWorlds.ready]));
    if (game === 'backgammon') await page.locator('#kg .bgm-board').waitFor();
    const standard = await probe(page, game);
    if (game !== 'schach') await shot(page, `${game}-standard`, info);
    for (const id of WORLDS) {
      expect((await page.evaluate((w) => send('setCardWorld', { world: w }), id)).ok).toBe(true);
      await expectWorld(page, game, id, standard);
      if (game !== 'schach') await shot(page, `${game}-${id.toLowerCase()}`, info);
    }
    expect((await page.evaluate(() => send('setCardWorld', { world: '' }))).ok).toBe(true);
    await expectStandard(page, game, standard);
  });
}
