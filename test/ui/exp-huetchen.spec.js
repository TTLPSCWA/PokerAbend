// EXP-007 Mensch ärgere Dich nicht: Würfel, hüpfende Figuren, Rauswurf im Bogen, drei Sechsen als Highlight.
import { test, expect, expectSound, expectNoLeak } from './helpers.js';
import { openTable, watch, ok, send, soundLog, sounds, evidence, recordAnimations, animations, expectOnlyTransformOpacity, smoothReplay, fpsEvidence } from './exp-helpers.js';

const turnPage = async (pages) => { for (const p of pages) if (await p.evaluate(() => lastState.turnId === lastState.you.id)) return p; return null; };
// Würfelt reihum, bis jemand eine Figur ziehen darf, und zieht sie. Liefert die Seite, die gezogen hat.
async function playUntilMove(pages, onRoll) {
  for (let i = 0; i < 80; i++) {
    let p; await expect.poll(async () => !!(p = await turnPage(pages))).toBe(true);
    const g = await p.evaluate(() => lastState.g);
    if (g.rolled && g.options.length) { await ok(p, 'move', { piece: g.options[0] }); return p; }
    await ok(p, 'roll'); await onRoll?.(p);
    await p.waitForTimeout(60);
  }
  throw Error('Keine Sechs in 80 Würfen');
}
const start = async (page, app, browser, options = {}) => {
  const table = await openTable(page, app, browser, 'huetchen', { guests: ['Ben'], ...options });
  await ok(page, 'start'); await expect(page.locator('.hb-board')).toBeVisible();
  return table;
};
// Aktueller Tisch, als käme er von einem früheren Stand (nur Darstellung): Figur zieht drei Felder und schlägt.
const captureScene = (page) => page.evaluate(() => {
  const view = lastState, prev = JSON.parse(JSON.stringify(view)), ids = Object.keys(view.g.pieces), me = ids.find((id) => view.g.pieces[id].some((p) => p >= 0));
  if (!me) return false;
  const other = ids.find((id) => id !== me), i = view.g.pieces[me].findIndex((p) => p >= 0), k = view.g.pieces[other].findIndex((p) => p === -1);
  if (i < 0 || k < 0) return false;
  prev.g.pieces[me][i] = Math.max(-1, view.g.pieces[me][i] - 3); prev.g.pieces[other][k] = 12;
  return __experiences.huetchen.present(prev);
});
const sixScene = (page, times) => page.evaluate(async (times) => {
  const view = JSON.parse(JSON.stringify(lastState)), me = view.you.id; let n = Math.max(0, ...Object.values(view.acts).map((a) => a.n));
  for (let i = 0; i < times; i++) { const prev = JSON.parse(JSON.stringify(view)); view.acts[me] = { text: 'würfelt 6', n: ++n }; __experiences.huetchen.present(prev, view); await new Promise((r) => setTimeout(r, 30)); }
}, times);

test('EXP-007: Würfel- und Figurenklang, Hüpfen nur mit transform, Rauswurf im Bogen, Bewegungsbudget', async ({ page, app, browser }, info) => {
  test.setTimeout(120000);
  const { others, close } = await start(page, app, browser);
  try {
    await expect(page.locator('#kg')).toHaveAttribute('data-xp-kit', 'huetchen');
    await soundLog(page); await recordAnimations(page);
    let rolled = false;
    await playUntilMove([page, others[0]], async () => { if (!rolled) { rolled = true; await expectSound(page, { event: 'dice', palette: 'huetchen', game: 'huetchen' }); } });
    await expectSound(page, 'piece');
    await expect.poll(async () => (await animations(page)).some((a) => /hb-piece/.test(a.target))).toBe(true);
    expect((await animations(page)).some((a) => /die/.test(a.target))).toBe(true);
    expect(await sounds(page)).not.toContain('beep');
    const real = await animations(page);
    // Rauswurf (Darstellung auf dem bestätigten Tisch): schlagende Figur hüpft, geschlagene fliegt zurück, Plopp und Grummeln.
    await page.waitForTimeout(700); await soundLog(page); await recordAnimations(page);
    expect(await captureScene(page)).toBe(true);
    await expectSound(page, 'plop'); await expectSound(page, 'grumble');
    const seen = await animations(page);
    expect(seen.filter((a) => /hb-piece/.test(a.target)).length).toBe(2);
    expect(Math.max(...seen.map((a) => a.delay))).toBeGreaterThan(0); // der Bogen startet erst nach der Landung
    expectOnlyTransformOpacity([...seen, ...real]);
    await expectNoLeak(page, { requireSecrets: false });
    await close(); // Messung ohne zweiten Browser
    await fpsEvidence(info, 'EXP-007', await smoothReplay(page, 'huetchen', { gap: 1000 }));
  } finally { await close(); }
});

test('EXP-007: drei Sechsen – Konfetti am eigenen Haus und „Glückspilz“-Plakette; reduziert ohne Konfetti', async ({ page, app, browser }, info) => {
  const { close } = await start(page, app, browser);
  try {
    await soundLog(page);
    await sixScene(page, 2);
    await expect(page.locator('.xp-plaque')).toHaveCount(0);
    await sixScene(page, 1);
    await expect(page.locator('.xp-plaque')).toContainText('Glückspilz');
    await expect(page.locator('.xp-confetti').first()).toBeAttached();
    await expectSound(page, 'highlight'); await expectSound(page, 'six');
    await expect(page.locator('.hb-board')).toHaveAttribute('data-xp', 'glueckspilz');
    await expect(page.locator('.xp-plaque svg')).toBeVisible();
    await page.waitForTimeout(450);
    await evidence(page, info, 'EXP-007', 'glueckspilz');
    // Der nächste bestätigte Zustand räumt alles weg (kein Rückstau).
    await ok(page, 'gamePause', { paused: true });
    await expect(page.locator('.xp-plaque')).toHaveCount(0); await expect(page.locator('.xp-confetti')).toHaveCount(0);
    await ok(page, 'gamePause', { paused: false });
  } finally { await close(); }
});

test('EXP-007: „Animationen reduzieren“, Neuladen und Zuschauen ohne Rückstau', async ({ page, app, browser }) => {
  test.setTimeout(120000);
  const { others, close } = await start(page, app, browser, { reduced: true });
  try {
    await soundLog(page); await recordAnimations(page);
    await playUntilMove([page, others[0]]);
    await expectSound(page, 'piece');
    for (const a of await animations(page)) expect(a.duration, JSON.stringify(a)).toBeLessThanOrEqual(150);
    await sixScene(page, 3);
    await expect(page.locator('.xp-plaque')).toHaveCount(1);
    await expect(page.locator('.xp-confetti')).toHaveCount(0);
    await page.reload(); await expect(page.locator('.hb-board')).toBeVisible();
    await soundLog(page); await recordAnimations(page); await page.waitForTimeout(400);
    expect(await sounds(page)).toEqual([]); expect(await animations(page)).toEqual([]);
    const { watcher, close: leave } = await watch(page, app, browser);
    try { await expect(watcher.locator('.hb-board')).toBeVisible(); await expect(watcher.locator('.xp-plaque')).toHaveCount(0); } finally { await leave(); }
  } finally { await close(); }
});
