// EXP-042 Kronenjagd: Burghof im Canvas, eigene Krone, Fanfare beim Kronengewinn, Highlight nach 30 Sekunden Herrschaft.
import { test, expect, expectSound, expectNoLeak } from './helpers.js';
import { openTable, watch, ok, soundLog, sounds, evidence, canvasBudget, fpsEvidence } from './exp-helpers.js';

const start = async (page, app, browser, options = {}) => {
  const table = await openTable(page, app, browser, 'kronenjagd', { guests: ['Ben'], settings: { playSecs: 90 }, ...options });
  for (const p of [page, ...table.others]) await p.evaluate(() => socket.on('arena', (frame) => { window.testFrame = frame; }));
  await soundLog(page); await soundLog(table.others[0]);
  await ok(page, 'start'); await expect(page.locator('#rt-canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.testFrame?.elapsed ?? -1), { timeout: 15000 }).toBeGreaterThan(0);
  return table;
};
// Läuft mit den Pfeiltasten zur Krone, bis die Hauptseite sie trägt.
async function grab(page) {
  const keys = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' }; let down = new Set();
  await expect.poll(async () => {
    const { me, crown, mine } = await page.evaluate(() => { const f = window.testFrame, id = lastState.you.id; return { me: f.bodies.find((b) => b.id === id), crown: f.crown, mine: f.crown.holder === id }; });
    const want = new Set(mine ? [] : [crown.x < me.x - 8 ? 'left' : crown.x > me.x + 8 ? 'right' : null, crown.y < me.y - 8 ? 'up' : crown.y > me.y + 8 ? 'down' : null].filter(Boolean));
    for (const k of down) if (!want.has(k)) await page.keyboard.up(keys[k]);
    for (const k of want) if (!down.has(k)) await page.keyboard.down(keys[k]);
    down = want; return mine;
  }, { timeout: 20000, intervals: [120] }).toBe(true);
}
// Farbe im Canvas an der Stelle über dem Kopf des Trägers (Reif der Krone).
const crownPixel = (page) => page.evaluate(() => { const f = window.testFrame, b = f.bodies.find((p) => p.id === f.crown.holder), c = document.querySelector('#rt-canvas'); return [...c.getContext('2d').getImageData(Math.round(b.x + 6), Math.round(b.y - 78 + 8), 1, 1).data]; });
// Zeigt auf dem echten Tisch, wie es nach 30 Sekunden Herrschaft aussieht (nur Darstellung).
const reignScene = (page) => page.evaluate(() => { const f = window.testFrame; __experiences.kronenjagd.frame({ ...f, elapsed: f.elapsed + 31000 }, f, lastState, null); return f.crown.holder; });

test('EXP-042: Burghof, Fanfare beim Kronengewinn, eigene Krone im Canvas, 30 Sekunden gekrönt, Bewegungsbudget', async ({ page, app, browser }, info) => {
  test.setTimeout(120000);
  const { others, close } = await start(page, app, browser);
  try {
    await expect(page.locator('#kg')).toHaveAttribute('data-xp-kit', 'kronenjagd');
    await expectSound(page, { event: 'count', palette: 'kronenjagd', game: 'kronenjagd' }); // Countdown aus der Palette
    await grab(page);
    await expectSound(page, 'crown');               // Fanfare für den Fänger
    await expectSound(others[0], 'steal');          // die anderen hören nur den Wechsel
    expect(await sounds(page)).not.toContain('lost');
    await page.waitForTimeout(700);                 // Sprungbogen ist gelandet
    await expect.poll(async () => { const [r, g, b] = await crownPixel(page); return r > 170 && g > 120 && b < 140; }).toBe(true);
    await evidence(page, info, 'EXP-042', 'krone');
    await soundLog(page);
    expect(await reignScene(page)).toBe(await page.evaluate(() => lastState.you.id));
    await expectSound(page, 'highlight');
    await expect(page.locator('#kg')).toHaveAttribute('data-xp', 'thronsaal');
    await expect(page.locator('.xp-plaque.xp-kj-reign')).toContainText('30 Sekunden gekrönt!');
    await page.waitForTimeout(500); await evidence(page, info, 'EXP-042', 'thronsaal');
    // Dieselbe Herrschaft wird nur einmal gefeiert.
    await soundLog(page); await reignScene(page); await page.waitForTimeout(300);
    expect(await sounds(page)).not.toContain('highlight');
    expect(await sounds(page)).not.toContain('beep');
    await expectNoLeak(page, { requireSecrets: false });
    await fpsEvidence(info, 'EXP-042', await canvasBudget(page, 'kronenjagd'));
  } finally { await close(); }
});

test('EXP-042: „Animationen reduzieren“, Neuladen und Zuschauen ohne Rückstau', async ({ page, app, browser }) => {
  test.setTimeout(120000);
  const { close } = await start(page, app, browser, { reduced: true });
  try {
    await grab(page);
    await expectSound(page, 'crown');
    await reignScene(page);
    await expect(page.locator('.xp-plaque.xp-kj-reign')).toHaveCount(1); // Schriftzug ja, Wehen nein
    expect(await page.evaluate(() => document.getAnimations().filter((a) => a.effect?.getTiming().duration > 150).length)).toBe(0);
    await page.reload(); await expect(page.locator('#rt-canvas')).toBeVisible();
    await soundLog(page); await page.waitForTimeout(600);
    expect((await sounds(page)).filter((e) => e !== 'count')).toEqual([]);
    await expect(page.locator('.xp-plaque')).toHaveCount(0);
    const { watcher, close: leave } = await watch(page, app, browser);
    try { await expect(watcher.locator('#rt-canvas')).toBeVisible(); await expect(watcher.locator('.xp-plaque')).toHaveCount(0); } finally { await leave(); }
  } finally { await close(); }
});
