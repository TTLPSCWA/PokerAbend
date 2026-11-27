// B24 Responsive-Audit: misst jede Oberfläche in allen Ziel-Viewports und beim
// Größenwechsel während einer laufenden Partie. Lang laufend, daher nur mit
// B24_AUDIT=1. Ergebnis: artifacts/b24/<lauf>/audit.json plus Screenshots.
// Die schnelle, dauerhaft laufende Regression steht in responsive.spec.js.
import { test, expect, login, selectGame } from './release-helpers.js';
import { test as idleTest } from './helpers.js';
import { GAMES, SINGLEPLAYER_GAMES } from '../../games/index.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { VIEWPORTS, measureLayout } from './responsive-measure.js';

test.skip(process.env.B24_AUDIT !== '1', 'Langer Responsive-Audit; mit B24_AUDIT=1 aktivieren.');
idleTest.skip(process.env.B24_AUDIT !== '1', 'Langer Responsive-Audit; mit B24_AUDIT=1 aktivieren.');
test.describe.configure({ mode: 'parallel' });

const run = process.env.B24_RUN || 'nachher';
const dir = `artifacts/b24/${run}`;
const shotSizes = new Set((process.env.B24_SHOTS || '320x568,390x844,1280x720,3440x1440').split(','));
const selected = process.env.B24_GAMES?.split(',');
const only = (id) => !selected || selected.includes(id);

function record(name, entry) {
  mkdirSync(dir, { recursive: true });
  const file = `${dir}/${name.replace(/[^a-z0-9-]/gi, '_')}.json`;
  writeFileSync(file, JSON.stringify(entry, null, 2));
}

async function sweep(page, name, { shots = true, settle = 250 } = {}) {
  const results = [];
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(settle);
    const m = await page.evaluate(measureLayout);
    results.push({ viewport: vp.key, ...m });
    if (shots && shotSizes.has(vp.key)) {
      mkdirSync(`${dir}/shots`, { recursive: true });
      await page.screenshot({ path: `${dir}/shots/${name}-${vp.key}.png` });
    }
  }
  return results;
}

const emit = async (p, event, data = {}) => p.evaluate(([e, d]) => send(e, d), [event, data]);
const humanOnly = new Set(['wer-bin-ich', 'kritzelpost', 'bildunterschrift', 'malen-raten', 'meme-duell']);
// Layoutwechsel darf weder neu laden noch den Raum oder die eigene Identität verlieren.
const mark = (p) => p.evaluate(() => { window.__b24Mark = Math.random(); return { mark: window.__b24Mark, code: lastState?.code, you: lastState?.you?.id, game: lastState?.game }; });
const kept = (p, before) => p.evaluate((b) => window.__b24Mark === b.mark && lastState?.code === b.code && lastState?.you?.id === b.you && lastState?.game === b.game, before);

test('Hub, Navigation und Dialoge', async ({ page, app }) => {
  test.setTimeout(240000);
  await login(page, app);
  const out = {};
  for (const hash of ['#start', '#spiele', '#spiele/karten', '#spiele/einzelspieler', '#spiele/idle', '#tische', '#bestenliste']) {
    await page.evaluate((h) => { location.hash = h; }, hash);
    await page.waitForTimeout(300);
    out[hash] = await sweep(page, 'hub' + hash.replace(/[#/]/g, '-'));
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await selectGame(page, 'poker');
  out['host-dlg'] = await sweep(page, 'host-dlg');
  record('hub', out);
});

for (const id of Object.keys(GAMES).filter(only)) {
  test(`Spiel ${id}: Lobby und laufende Partie in allen Viewports`, async ({ page, app, browser }, info) => {
    test.setTimeout(240000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const entry = { id, errors };
    try {
      await page.setViewportSize({ width: 1280, height: 720 });
      await login(page, app);
      await selectGame(page, id);
      await page.locator('#host-form button[type=submit]').click();
      await expect.poll(() => page.evaluate(() => lastState?.game)).toBe(id);
      const game = GAMES[id];
      await emit(page, 'sit', ['poker', 'omaha'].includes(id) ? { seat: 0 } : {});
      entry.lobby = await sweep(page, id + '-lobby', { shots: false });
      await page.setViewportSize({ width: 1280, height: 720 });
      const bots = Math.max(game.minPlayers, Math.min(4, game.maxPlayers || 4)) - 1;
      const code = await page.evaluate(() => lastState.code);
      for (let i = 0; i < bots; i++) {
        if (!humanOnly.has(id)) { await emit(page, 'addBot'); continue; }
        const context = await browser.newContext({ ...info.project.use });
        const other = await context.newPage();
        await login(other, app, 'Mitspieler ' + (i + 1));
        await other.evaluate((c) => joinAndEnter(c, 'sit'), code);
        await expect.poll(() => other.evaluate(() => lastState?.code)).toBe(code);
      }
      const started = await emit(page, 'start');
      entry.started = !!started?.ok;
      entry.startError = started?.error || null;
      await page.waitForTimeout(600);
      const before = await mark(page);
      entry.playing = await sweep(page, id);
      entry.stateKept = await kept(page, before);
    } catch (e) { entry.failure = e.message; }
    record('game-' + id, entry);
    expect(entry.failure, `${id}: audit reached the game`).toBeUndefined();
    expect(entry.started, entry.startError || `${id}: actually started`).toBe(true);
    expect(entry.stateKept, `${id}: resize kept room and player identity`).toBe(true);
    expect(entry.errors, `${id}: browser errors`).toEqual([]);
  });
}

for (const id of Object.keys(SINGLEPLAYER_GAMES).filter(only)) {
  test(`Solo ${id} in allen Viewports`, async ({ page, app }) => {
    test.setTimeout(180000);
    const entry = { id, errors: [] };
    page.on('pageerror', (e) => entry.errors.push(e.message));
    try {
      await page.setViewportSize({ width: 1280, height: 720 });
      await login(page, app);
      await page.evaluate((g) => { location.hash = '#solo/' + g; }, id);
      await expect(page.locator(`[data-solo="${id}"]`)).toBeVisible();
      entry.setup = await sweep(page, 'solo-' + id + '-setup', { shots: false });
      await page.setViewportSize({ width: 1280, height: 720 });
      const startBtn = page.locator('[data-setup] button[type=submit]');
      if (await startBtn.count()) await startBtn.click();
      await page.waitForTimeout(500);
      entry.playing = await sweep(page, 'solo-' + id);
    } catch (e) { entry.failure = e.message; }
    record('solo-' + id, entry);
    expect(entry.failure, `${id}: audit reached the game`).toBeUndefined();
    expect(entry.errors, `${id}: browser errors`).toEqual([]);
  });
}

for (const [id, flag, start] of [['spielhalle', 'idleHall', 'Spiel starten'], ['studio', 'idleStudio', 'Studio starten'], ['factory', 'idleFactory', 'Fabrik starten']]) {
  if (!only(id)) continue;
  idleTest.describe(() => {
    idleTest.use({ [flag]: true });
    idleTest(`Idle ${id} in allen Viewports`, async ({ page, app }) => {
      idleTest.setTimeout(180000);
      const entry = { id, errors: [] };
      page.on('pageerror', error => entry.errors.push(error.message));
      try {
        await page.setViewportSize({ width: 1280, height: 720 });
        await login(page, app);
        await page.evaluate(() => { location.hash = '#spiele/idle'; });
        await page.locator(`li[data-id="${id}"] a`).first().click();
        await page.getByRole('button', { name: start, exact: true }).click({ timeout: 15000 });
        await page.waitForTimeout(1200);
        entry.playing = await sweep(page, 'idle-' + id);
      } catch (e) { entry.failure = e.message; }
      record('idle-' + id, entry);
      expect(entry.failure, `${id}: audit reached the idle game`).toBeUndefined();
      expect(entry.errors, `${id}: browser errors`).toEqual([]);
    });
  });
}

// Performance: Kosten eines schnellen Größenwechsels (Fensterrand ziehen) am Pokertisch.
// 40 resize-Ereignisse in Folge; gemessen werden Rechenzeit bis zum Ruhezustand und
// DOM-Änderungen an Tisch und Aktionsleiste.
test('Performance: Größenwechsel am Pokertisch', async ({ page, app }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await login(page, app);
  await selectGame(page, 'poker');
  await page.locator('#host-form button[type=submit]').click();
  await expect.poll(() => page.evaluate(() => lastState?.game)).toBe('poker');
  await emit(page, 'sit', { seat: 0 });
  for (let i = 0; i < 3; i++) await emit(page, 'addBot');
  await emit(page, 'start');
  await page.waitForTimeout(800);
  await emit(page, 'gamePause', { paused: true }); // ruhiger Tisch, keine Bot-Züge während der Messung
  await page.waitForTimeout(400);
  const runs = [];
  for (let k = 0; k < 5; k++) {
    runs.push(await page.evaluate(() => new Promise((resolve) => {
      let mutations = 0;
      const mo = new MutationObserver((list) => { mutations += list.length; });
      mo.observe(document.querySelector('#game'), { childList: true, subtree: true, attributes: true, characterData: true });
      const t0 = performance.now();
      for (let i = 0; i < 40; i++) window.dispatchEvent(new Event('resize'));
      const sync = performance.now() - t0;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        mo.disconnect();
        resolve({ syncMs: +sync.toFixed(2), totalMs: +(performance.now() - t0).toFixed(2), mutations });
      }));
    })));
  }
  const median = (list, k) => list.map((r) => r[k]).sort((a, b) => a - b)[Math.floor(list.length / 2)];
  // Echte Größenwechsel: zehn Fenstergrößen direkt nacheinander (wie Ziehen am Rand).
  const real = [];
  for (let k = 0; k < 5; k++) {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(300);
    await page.evaluate(() => { window.__b24m = 0; window.__b24mo = new MutationObserver((l) => { window.__b24m += l.length; }); window.__b24mo.observe(document.querySelector('#game'), { childList: true, subtree: true, attributes: true, characterData: true }); });
    const t0 = Date.now();
    for (let i = 0; i < 10; i++) await page.setViewportSize({ width: 1180 + i * 20, height: 700 + i * 4 });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const wall = Date.now() - t0;
    real.push({ wallMs: wall, mutations: await page.evaluate(() => { window.__b24mo.disconnect(); return window.__b24m; }) });
  }
  record('perf-poker', { synthetic: runs, real, median: { syntheticSyncMs: median(runs, 'syncMs'), syntheticTotalMs: median(runs, 'totalMs'), syntheticMutations: median(runs, 'mutations'), realWallMs: median(real, 'wallMs'), realMutations: median(real, 'mutations') } });
});
