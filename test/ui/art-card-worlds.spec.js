// ART-T1 Kartenwelten: Der Host wählt für UNO (Classic), Skip-Bo und Phase 10 eine Welt; alle am Tisch sehen sie.
// Geprüft für jede Welt jedes Spiels: Weltbild auf den Karten, Wert als lesbares Medaillon, keine Fehler.
// Dazu: Gäste sehen dieselbe Welt, „Standard“ stellt das bisherige Aussehen wieder her, nur der Host darf wählen,
// UNO-Varianten mit eigener Gestaltung bleiben unverändert, und die Bildrate bleibt im Rahmen.
// ART_CAPTURE=1 legt Bildschirmfotos aller Welten unter test-results/art-t1/ ab (Übersichtsbilder für die Doku:
// docs/design/art/ART-T1/README.md) und die Messung unter docs/design/art/ART-T1/fps-desktop.json.
import { test, expect, openTable, emit } from './card-ux-helpers.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { worldsFor } from '../../public/games/card-worlds/worlds.js';

const DIR = 'docs/design/art/ART-T1', SHOTS = 'test-results/art-t1';
const capture = async (page, info, name) => {
  let path = info.outputPath(`${name}.png`);
  if (process.env.ART_CAPTURE === '1') { mkdirSync(SHOTS, { recursive: true }); path = `${SHOTS}/${name}-${info.project.name}.png`; }
  await page.screenshot({ path });
};
const CARD = { farbenchaos: '.kc-fc', stapelrennen: '.kc-st', zehnetappen: '.kc-ze' };
// Auf dem Handy reichen die Pilotwelten und eine Winterwelt (sonst 60 Läufe je Gerät)
const MOBILE = ['U-04', 'U-01', 'U-02', 'SB-09', 'SB-01', 'SB-04', 'P-03', 'P-06', 'P-10', 'X-07'];

const check = async (page, game) => {
  const card = page.locator(`.kg-hand ${CARD[game]}`).first();
  await expect(card).toBeVisible();
  const face = await card.evaluate((el) => {
    const s = getComputedStyle(el), v = el.querySelector('.v'), r = v.getBoundingClientRect(), c = el.getBoundingClientRect();
    return { bg: s.backgroundImage, vh: r.height, vw: r.width, inside: r.bottom <= c.bottom + 2 && r.top >= c.top, vo: getComputedStyle(v).opacity };
  });
  expect(face.bg).toMatch(/\/games\/card-worlds\/art\/[A-Z0-9-]+\/(\d|w)\.svg/);
  expect(face.vh).toBeGreaterThan(9);
  expect(face.inside).toBe(true);
  expect(Number(face.vo)).toBe(1);
};

for (const game of ['farbenchaos', 'stapelrennen', 'zehnetappen']) {
  test(`ART-T1 ${game}: alle Kartenwelten`, async ({ page, browser, app }, info) => {
    test.setTimeout(400000);
    const room = await openTable(page, browser, app, info, game, 'classic', 3);
    try {
      await expect(page.locator(`.kg-hand ${CARD[game]}`).first()).toBeVisible();
      const worlds = worldsFor(game).filter((w) => info.project.name !== 'mobil' || MOBILE.includes(w.id));
      expect(worlds.length).toBeGreaterThanOrEqual(info.project.name === 'mobil' ? 4 : 20);
      // Auswahl steht im Host-Menü
      await page.evaluate(() => CardWorlds.ready);
      for (const w of worlds) {
        await emit(page, 'setCardWorld', { world: w.id });
        await expect(page.locator('body')).toHaveAttribute('data-card-world', w.id);
        await expect(page.locator('body')).toHaveAttribute('data-cw-frame', w.frame);
        await check(page, game);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(150);
        await capture(page, info, `${game}-${w.id}`);
      }
      // Gäste sehen dieselbe Welt
      const last = worlds.at(-1).id;
      await expect(room.guests[0].locator('body')).toHaveAttribute('data-card-world', last);
      // Nur der Host darf wählen
      const guest = await room.guests[0].evaluate((id) => send('setCardWorld', { world: id }), worlds[0].id);
      expect(guest.ok).toBe(false);
      // Unbekannte Welt oder Welt eines anderen Spiels wird abgelehnt
      const other = { farbenchaos: 'SB-01', stapelrennen: 'U-01', zehnetappen: 'U-01' }[game];
      expect((await page.evaluate((id) => send('setCardWorld', { world: id }), other)).ok).toBe(false);
      // Standard: bisheriges Aussehen
      await emit(page, 'setCardWorld', { world: '' });
      await expect(page.locator('body')).not.toHaveAttribute('data-card-world', /./);
      expect(await page.locator(`.kg-hand ${CARD[game]}`).first().evaluate((el) => getComputedStyle(el).backgroundImage)).not.toMatch(/card-worlds/);
      // Host-Menü zeigt die Auswahl (Standard + Welten + Winter)
      await page.locator('[data-kit-panel="host"]').first().click();
      await expect(page.locator('.cwp-pick')).toHaveCount(worldsFor(game).length + 1);
      await page.locator(`.cwp-pick[data-card-world-pick="${worlds[0].id}"]`).click();
      await expect(page.locator('body')).toHaveAttribute('data-card-world', worlds[0].id);
      await expect(page.locator(`.cwp-pick[data-card-world-pick="${worlds[0].id}"]`)).toHaveAttribute('aria-pressed', 'true');
      if (game === 'farbenchaos') { await expect(page.locator('#toast')).not.toHaveClass(/show/, { timeout: 6000 }); await capture(page, info, 'host-menu'); }
    } finally { await room.close(); }
  });
}

test('ART-T1 UNO-Varianten mit eigener Gestaltung bleiben unverändert', async ({ page, browser, app }, info) => {
  test.skip(info.project.name === 'mobil', 'einmal genügt');
  test.setTimeout(120000);
  const room = await openTable(page, browser, app, info, 'farbenchaos', 'flip', 2);
  try {
    await emit(page, 'setCardWorld', { world: 'U-04' });
    await expect.poll(() => page.evaluate(() => lastState.cardWorld)).toBe('U-04');
    await expect(page.locator('body')).not.toHaveAttribute('data-card-world', /./);
  } finally { await room.close(); }
});

test('ART-T1 Kosten: Bildrate mit Kartenwelt', async ({ page, browser, app }, info) => {
  test.skip(info.project.name !== 'desktop', 'Messung nur am Desktop');
  test.setTimeout(150000);
  const room = await openTable(page, browser, app, info, 'farbenchaos', 'classic', 3);
  try {
    await expect(page.locator('.kg-hand .kc-fc').first()).toBeVisible();
    await emit(page, 'setCardWorld', { world: 'U-01' });
    await expect(page.locator('body')).toHaveAttribute('data-card-world', 'U-01');
    await page.evaluate(() => document.fonts.ready);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const metric = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
    const sample = async (on) => {
      await page.evaluate(async (on) => { const b = document.body; if (on) { b.dataset.cardWorld = 'U-01'; b.dataset.cwFrame = 'gilded'; } else { delete b.dataset.cardWorld; delete b.dataset.cwFrame; } await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); }, on);
      const before = await metric();
      const frames = await page.evaluate(() => {
        const runs = [...document.querySelectorAll('.kg-hand .kc-fc, .kg-discard .kc-fc')].map((c, i) => c.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-10px) rotate(2deg)' }], { duration: 420, delay: i * 60, iterations: Infinity, direction: 'alternate' }));
        return new Promise((done) => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(tick); else { runs.forEach((a) => a.cancel()); done(n / (performance.now() - t0) * 1000); } }; requestAnimationFrame(tick); });
      });
      const after = await metric();
      return { fps: frames, work: after.TaskDuration - before.TaskDuration };
    };
    const median = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
    const off = [], on = [];
    for (let i = 0; i < 5; i++) { if (i % 2) { on.push(await sample(true)); off.push(await sample(false)); } else { off.push(await sample(false)); on.push(await sample(true)); } }
    const round = (x) => Math.round(x * 1000) / 1000;
    const best = { fps: round(median(on.map((x) => x.fps))), baselineFps: round(median(off.map((x) => x.fps))), workSeconds: round(median(on.map((x) => x.work))), baselineWorkSeconds: round(median(off.map((x) => x.work))), cpuThrottle: 4, minRatio: 0.9, method: 'Hauptthread-Rechenzeit ohne/mit Kartenwelt U-01 (Median aus 5 Läufen, Reihenfolge wechselnd); ratio = Rechenzeit ohne / mit' };
    best.ratio = round(best.baselineWorkSeconds / best.workSeconds); best.fpsRatio = round(best.fps / best.baselineFps);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    if (process.env.ART_CAPTURE === '1') { mkdirSync(DIR, { recursive: true }); writeFileSync(`${DIR}/fps-desktop.json`, JSON.stringify(best, null, 2) + '\n'); }
    expect(best.ratio, JSON.stringify(best)).toBeGreaterThanOrEqual(0.9);
    expect(best.fpsRatio, JSON.stringify(best)).toBeGreaterThanOrEqual(0.85);
  } finally { await room.close(); }
});
