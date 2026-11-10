// EXP-040 Malen & Raten: Pinselstrich nur beim Zeichner, Treffer-Glocke, goldener Rahmen, Galerie des Abends.
import { test, expect, expectSound, expectNoLeak } from './helpers.js';
import { openTable, watch, ok, soundLog, sounds, evidence, recordAnimations, animations, expectOnlyTransformOpacity, smoothReplay, fpsEvidence } from './exp-helpers.js';

const start = async (page, app, browser, options = {}) => {
  const table = await openTable(page, app, browser, 'malen-raten', { guests: ['Ben', 'Cleo'], ...options });
  await soundLog(page); await recordAnimations(page);
  await ok(page, 'start');
  const pages = [page, ...table.others];
  let artist = null; await expect.poll(async () => { for (const p of pages) if (await p.evaluate(() => !!lastState.g?.draw)) artist = p; return !!artist; }).toBe(true);
  return { ...table, pages, artist, guessers: pages.filter((p) => p !== artist) };
};
const key = (p) => p.evaluate(() => lastState.g.key);
const draw = async (artist) => ok(artist, 'drawing', { key: await key(artist), strokes: [{ color: '#df493d', size: 18, points: [[200, 200], [500, 520], [800, 240]] }, { color: '#368ad4', size: 8, points: [[300, 700], [700, 700]] }], done: false });
const guess = async (p, text) => { await p.waitForTimeout(750); return ok(p, 'answer', { key: await key(p), text }); };

test('EXP-040: Pinselstrich beim Zeichner, Treffer-Glocke, goldener Rahmen, Galerie des Abends', async ({ page, app, browser }, info) => {
  test.setTimeout(120000);
  const { artist, guessers, close } = await start(page, app, browser);
  try {
    expect(artist).toBe(page); // der Host zeichnet zuerst
    await expect(page.locator('#kg')).toHaveAttribute('data-xp-kit', 'malen-raten');
    await expectSound(page, { event: 'frame', palette: 'malen-raten', game: 'malen-raten' });
    // Pinselstrich: nur der Zeichner hört ihn, beim Aufsetzen auf der Leinwand.
    await soundLog(guessers[0]);
    await page.locator('.draw-editor canvas').click({ position: { x: 60, y: 60 } });
    await expectSound(page, 'brush');
    await page.waitForTimeout(700); // der eigene Punkt ist gespeichert, danach kommt die Testzeichnung
    await draw(page);
    await expect(guessers[0].locator('.draw-picture')).toBeVisible();
    expect(await sounds(guessers[0])).not.toContain('brush');
    const word = await page.evaluate(() => lastState.g.prompt);
    await guess(guessers[0], 'ganz sicher falsch');
    await expect(page.locator('.draw-editor canvas')).not.toHaveClass(/xp-gold/);
    await soundLog(page); await recordAnimations(page);
    await guess(guessers[0], word);
    await expectSound(page, 'hit');
    await expect(page.locator('.draw-editor canvas')).toHaveClass(/xp-gold/);
    await expect(guessers[1].locator('.draw-picture')).toHaveClass(/xp-gold/);
    await page.waitForTimeout(300); await evidence(page, info, 'EXP-040', 'goldrahmen');
    // Alle erraten es: Auflösung mit der Galerie des Abends.
    await guess(guessers[1], word);
    await expect(page.locator('.xp-mr-wall')).toContainText('Galerie des Abends');
    await expect(page.locator('.xp-mr-frame svg :is(polyline, circle)').first()).toBeAttached();
    await expectSound(page, 'highlight');
    await expect(page.locator('#kg')).toHaveAttribute('data-xp', 'galerie');
    expectOnlyTransformOpacity(await animations(page));
    expect(await sounds(page)).not.toContain('beep');
    await page.waitForTimeout(1300); await evidence(page, info, 'EXP-040', 'galerie');
    await expect(page.locator('.xp-mr-wall')).toHaveCount(0, { timeout: 5000 }); // verschwindet von selbst
    await expect(page.locator('.draw-picture')).toHaveClass(/xp-gallery/);
    await expectNoLeak(page, { requireSecrets: false });
    await close(); // Messung ohne weitere Browser
    await fpsEvidence(info, 'EXP-040', await smoothReplay(page, 'malen-raten', { gap: 1500 }));
  } finally { await close(); }
});

test('EXP-040: „Animationen reduzieren“, Neuladen und Zuschauen ohne Rückstau; Ratende sehen den Begriff nicht', async ({ page, app, browser }) => {
  test.setTimeout(120000);
  const { guessers, close } = await start(page, app, browser, { reduced: true });
  try {
    await draw(page);
    const word = await page.evaluate(() => lastState.g.prompt);
    expect(await guessers[0].evaluate(() => lastState.g.prompt)).toBeNull();
    await recordAnimations(page);
    await guess(guessers[0], word);
    await expectSound(page, 'hit');
    for (const a of await animations(page)) expect(a.duration, JSON.stringify(a)).toBeLessThanOrEqual(150);
    const { watcher, close: leave } = await watch(page, app, browser);
    try {
      await expect(watcher.locator('.draw-picture')).toHaveClass(/xp-gold/);
      await expect(watcher.locator('.xp-mr-wall')).toHaveCount(0);
      expect(await watcher.evaluate(() => lastState.g.prompt)).toBeNull();
    } finally { await leave(); }
    await guess(guessers[1], word);
    await expect(page.locator('.xp-mr-wall')).toHaveCount(1);
    for (const a of await animations(page)) expect(a.duration, JSON.stringify(a)).toBeLessThanOrEqual(150);
    // Neuladen in der Auflösung: Endzustand steht sofort, kein Ton, keine Bewegung, keine Galeriewand.
    await page.reload(); await expect(page.locator('.draw-picture')).toHaveClass(/xp-gallery/);
    await soundLog(page); await recordAnimations(page); await page.waitForTimeout(400);
    expect(await sounds(page)).toEqual([]); expect(await animations(page)).toEqual([]);
    await expect(page.locator('.xp-mr-wall')).toHaveCount(0);
  } finally { await close(); }
});
