// EXP-079 Schubsarena: Eisscholle im Wasser, Sumo-Gürtel, Stoß-Wumms, Rutschen, Platsch, Highlight „Doppelschubser!“.
import { test, expect, expectSound, expectNoLeak } from './helpers.js';
import { openTable, watch, ok, soundLog, sounds, evidence, canvasBudget, fpsEvidence } from './exp-helpers.js';

const start = async (page, app, browser, options = {}) => {
  const table = await openTable(page, app, browser, 'schubsarena', { guests: ['Ben'], settings: { playSecs: 120 }, ...options });
  for (const p of [page, ...table.others]) await p.evaluate(() => socket.on('arena', (frame) => { window.testFrame = frame; }));
  await soundLog(page);
  await ok(page, 'start'); await expect(page.locator('#rt-canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.testFrame?.elapsed ?? -1), { timeout: 15000 }).toBeGreaterThan(0);
  return table;
};
const pixel = (page, x, y) => page.evaluate(([x, y]) => [...document.querySelector('#rt-canvas').getContext('2d').getImageData(x, y, 1, 1).data], [x, y]);
const bodies = (page) => page.evaluate(() => { const f = window.testFrame, id = lastState.you.id; return { me: f.bodies.find((b) => b.id === id), other: f.bodies.find((b) => b.id !== id), platform: f.platform }; });
// Läuft auf den Gegner zu und stößt, sobald er in Reichweite ist. Liefert true, wenn ein Stoß abgegeben wurde.
async function shove(page) {
  const keys = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' }; let down = new Set(), pushed = false;
  await expect.poll(async () => {
    const { me, other } = await bodies(page);
    if (!other.alive || !me.alive) { pushed = true; } else {
      const want = new Set([other.x < me.x - 6 ? 'left' : other.x > me.x + 6 ? 'right' : null, other.y < me.y - 6 ? 'up' : other.y > me.y + 6 ? 'down' : null].filter(Boolean));
      for (const k of down) if (!want.has(k)) await page.keyboard.up(keys[k]);
      for (const k of want) if (!down.has(k)) await page.keyboard.down(keys[k]);
      down = want;
      if (Math.hypot(other.x - me.x, other.y - me.y) < 70) { const before = me.pushAt; await page.keyboard.press('Space'); await page.waitForTimeout(150); pushed = (await bodies(page)).me.pushAt > before; }
    }
    return pushed;
  }, { timeout: 20000, intervals: [100] }).toBe(true);
  for (const k of down) await page.keyboard.up(keys[k]);
}
// Zeigt auf dem echten Tisch einen Doppelschubser (nur Darstellung): Ein Stoß trifft zwei, beide fallen.
const doubleScene = (page) => page.evaluate(() => {
  const f = window.testFrame, id = lastState.you.id, B = (bid, x, extra) => ({ id: bid, x, y: 300, alive: true, readyAt: 0, pushAt: -10000, facing: { x: 1, y: 0 }, points: 0, ...extra });
  const a = { ...f, bodies: [B(id, 400), B('x1', 450), B('x2', 460, { y: 320 })] };
  const b = { ...a, elapsed: a.elapsed + 50, bodies: [B(id, 400, { pushAt: a.elapsed + 50 }), B('x1', 470), B('x2', 480, { y: 320 })] };
  const c = { ...b, elapsed: b.elapsed + 400, bodies: [B(id, 400, { pushAt: a.elapsed + 50 }), B('x1', 720, { alive: false }), B('x2', 730, { y: 320, alive: false })] };
  const X = __experiences.schubsarena; X.frame(b, a, lastState, null); X.frame(c, b, lastState, null); return true;
});

test('EXP-079: Eisscholle und Wasser im Canvas, Stoß-Wumms und Rutschen, Doppelschubser, Platsch, Canvas-Budget', async ({ page, app, browser }, info) => {
  test.setTimeout(150000);
  const { others, close } = await start(page, app, browser);
  try {
    await expect(page.locator('#kg')).toHaveAttribute('data-xp-kit', 'schubsarena');
    await expectSound(page, { event: 'count', palette: 'schubsarena', game: 'schubsarena' });
    // Kulisse: Wasser in der Ecke, Eis auf der Scholle.
    await expect.poll(async () => { const [r, , b] = await pixel(page, 20, 20); return b > r + 30; }).toBe(true);
    await expect.poll(async () => { const [r, g, b] = await pixel(page, 450, 150); return r > 190 && g > 215 && b > 225; }).toBe(true);
    await shove(page);
    await expectSound(page, 'shove'); await expectSound(page, 'slide');
    await evidence(page, info, 'EXP-079', 'scholle');
    await soundLog(page);
    expect(await doubleScene(page)).toBe(true);
    await expectSound(page, 'splash'); await expectSound(page, 'highlight');
    await expect(page.locator('#kg')).toHaveAttribute('data-xp', 'doppelschubser');
    await expect(page.locator('.xp-plaque.xp-sa-double')).toContainText('Doppelschubser!');
    await page.waitForTimeout(250); await evidence(page, info, 'EXP-079', 'doppelschubser');
    expect(await sounds(page)).not.toContain('beep');
    await expectNoLeak(page, { requireSecrets: false });
    await fpsEvidence(info, 'EXP-079', await canvasBudget(page, 'schubsarena'));
    // Echter Rauswurf: Ben läuft über den Rand (oder die schrumpfende Scholle holt ihn vorher ein) – der Platsch gehört zum Rundenende.
    const ben = others[0], { other } = await bodies(page);
    await ben.evaluate((x) => { let seq = 100000; window.testWalk = setInterval(() => { const f = window.testFrame; socket.emit('steer', { runId: f.runId, round: f.round, seq: ++seq, x, y: 0, jump: false }, () => {}); }, 80); }, other.x < 450 ? -1 : 1);
    await expect.poll(() => page.evaluate(() => lastState.phase), { timeout: 30000 }).toBe('over');
    await expect.poll(async () => (await sounds(page)).filter((e) => e === 'splash').length).toBeGreaterThanOrEqual(3); // zwei aus der Szene, einer echt
  } finally { await close(); }
});

test('EXP-079: „Animationen reduzieren“, Neuladen und Zuschauen ohne Rückstau', async ({ page, app, browser }) => {
  test.setTimeout(120000);
  const { close } = await start(page, app, browser, { reduced: true });
  try {
    await shove(page); await expectSound(page, 'shove');
    await doubleScene(page);
    await expect(page.locator('.xp-plaque.xp-sa-double')).toHaveCount(1);
    expect(await page.evaluate(() => document.getAnimations().filter((a) => a.effect?.getTiming().duration > 150).length)).toBe(0);
    await page.reload(); await expect(page.locator('#rt-canvas')).toBeVisible();
    await soundLog(page); await page.waitForTimeout(600);
    expect((await sounds(page)).filter((e) => !['count', 'shove', 'slide', 'crack'].includes(e))).toEqual([]);
    await expect(page.locator('.xp-plaque')).toHaveCount(0);
    const { watcher, close: leave } = await watch(page, app, browser);
    try { await expect(watcher.locator('#rt-canvas')).toBeVisible(); await expect(watcher.locator('.xp-plaque')).toHaveCount(0); } finally { await leave(); }
  } finally { await close(); }
});
