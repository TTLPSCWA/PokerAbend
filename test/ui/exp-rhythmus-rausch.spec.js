// EXP-072 Rhythmus-Rausch: Konzertbühne, eigener Beat im Takt, Melodietöne bei Treffern, leuchtende Spur, 50er-Serie mit Lichtshow.
import { test, expect, expectSound, expectNoLeak } from './helpers.js';
import { openTable, watch, ok, soundLog, sounds, evidence, canvasBudget, fpsEvidence } from './exp-helpers.js';

const start = async (page, app, browser, options = {}) => {
  const table = await openTable(page, app, browser, 'rhythmus-rausch', { guests: ['Ben'], settings: { playSecs: 60 }, ...options });
  for (const p of [page, ...table.others]) await p.evaluate(() => socket.on('arena', (frame) => { window.testFrame = frame; }));
  await soundLog(page);
  await ok(page, 'start'); await expect(page.locator('#rt-canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.testFrame?.elapsed ?? -1), { timeout: 15000 }).toBeGreaterThan(0);
  return table;
};
// Tippt die nächsten Noten im Takt (Tasten D F J K), bis der Server einen Treffer gewertet hat.
const playAlong = (page, count = 6) => page.evaluate((count) => new Promise((done) => {
  const keys = ['d', 'f', 'j', 'k'], f = window.testFrame, now = f.elapsed + (performance.now() - (window.__rxAt || performance.now()));
  const upcoming = f.notes.filter((n) => !n.j && n.t > now + 250).slice(0, count);
  let left = upcoming.length; if (!left) done(0);
  for (const n of upcoming) setTimeout(() => { const key = keys[n.lane]; document.dispatchEvent(new KeyboardEvent('keydown', { key, code: 'Key' + key.toUpperCase(), bubbles: true })); document.dispatchEvent(new KeyboardEvent('keyup', { key, code: 'Key' + key.toUpperCase(), bubbles: true })); if (!--left) setTimeout(() => done(upcoming.length), 300); }, n.t - now);
}), count);
const pixel = (page, x, y) => page.evaluate(([x, y]) => [...document.querySelector('#rt-canvas').getContext('2d').getImageData(x, y, 1, 1).data], [x, y]);
// Zeigt auf dem echten Tisch eine 50er-Serie mit perfektem Treffer (nur Darstellung).
const comboScene = (page) => page.evaluate(() => {
  const f = window.testFrame, id = lastState.you.id, body = (c) => f.bodies.map((b) => (b.id === id ? { ...b, combo: c } : b));
  const a = { ...f, bodies: body(49), last: { grade: 'good', lane: 0, at: f.elapsed - 10 } }, b = { ...f, elapsed: f.elapsed + 1, bodies: body(50), last: { grade: 'perfect', lane: 1, at: f.elapsed + 1 } };
  __experiences['rhythmus-rausch'].frame(b, a, lastState, null); return true;
});

test('EXP-072: Bühne und Lautsprecher, Beat im Takt, Melodietöne bei echten Treffern, Lichtshow zur 50er-Serie, Canvas-Budget', async ({ page, app, browser }, info) => {
  test.setTimeout(150000);
  const { close } = await start(page, app, browser);
  try {
    await expect(page.locator('#kg')).toHaveAttribute('data-xp-kit', 'rhythmus-rausch');
    // Kulisse: Lautsprecherwand links (dunkles Gehäuse statt der alten Kreise).
    await expect.poll(async () => { const [r, g, b] = await pixel(page, 20, 70); return r < 40 && g < 35 && b < 50; }).toBe(true);
    // Der Beat läuft: Kick, Snare und Hi-Hat.
    await expectSound(page, { event: 'kick', palette: 'rhythmus-rausch', game: 'rhythmus-rausch' });
    await expectSound(page, 'snare'); await expectSound(page, 'hat');
    // Echte Tipps im Takt: Der Server wertet sie, Treffer klingen als Melodieton.
    await soundLog(page);
    await expect.poll(async () => { await playAlong(page); return (await sounds(page)).some((e) => /^lane[0-3]$/.test(e)); }, { timeout: 30000, intervals: [100] }).toBe(true);
    await evidence(page, info, 'EXP-072', 'buehne');
    await soundLog(page);
    expect(await comboScene(page)).toBe(true);
    await expectSound(page, 'cheer'); await expectSound(page, 'highlight'); await expectSound(page, 'lane1'); await expectSound(page, 'perfect');
    await expect(page.locator('#kg')).toHaveAttribute('data-xp', 'lichtshow');
    await expect(page.locator('.xp-plaque.xp-rr-combo')).toContainText('50er-Serie!');
    await page.waitForTimeout(700); await evidence(page, info, 'EXP-072', 'lichtshow');
    // Dieselbe Serie wird nur einmal gefeiert.
    await soundLog(page); await comboScene(page); await page.waitForTimeout(250);
    expect(await sounds(page)).not.toContain('cheer');
    expect(await sounds(page)).not.toContain('beep');
    await expectNoLeak(page, { requireSecrets: false });
    await fpsEvidence(info, 'EXP-072', await canvasBudget(page, 'rhythmus-rausch'));
  } finally { await close(); }
});

test('EXP-072: „Animationen reduzieren“, Pause ohne Beat, Neuladen und Zuschauen ohne Rückstau', async ({ page, app, browser }) => {
  test.setTimeout(120000);
  const { close } = await start(page, app, browser, { reduced: true });
  try {
    await expectSound(page, 'kick');
    await comboScene(page);
    await expect(page.locator('.xp-plaque.xp-rr-combo')).toHaveCount(1);
    expect(await page.evaluate(() => document.getAnimations().filter((a) => a.effect?.getTiming().duration > 150).length)).toBe(0);
    // In der Pause schweigt der Beat.
    await ok(page, 'gamePause', { paused: true }); await page.waitForTimeout(400); await soundLog(page); await page.waitForTimeout(1200);
    expect((await sounds(page)).filter((e) => ['kick', 'snare', 'hat'].includes(e))).toEqual([]);
    await ok(page, 'gamePause', { paused: false });
    await page.reload(); await expect(page.locator('#rt-canvas')).toBeVisible();
    await expect(page.locator('.xp-plaque')).toHaveCount(0);
    const { watcher, close: leave } = await watch(page, app, browser);
    try { await expect(watcher.locator('#rt-canvas')).toBeVisible(); await expect(watcher.locator('.xp-plaque')).toHaveCount(0); } finally { await leave(); }
  } finally { await close(); }
});
