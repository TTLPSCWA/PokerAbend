// EXP-038 Kritzelpost: Stempel beim Abgeben, Umschlag je Schritt, Postsirene, abspulende Ketten, „Zugestellt!“ als Highlight.
import { test, expect, expectSound, expectNoLeak } from './helpers.js';
import { openTable, watch, ok, soundLog, sounds, evidence, recordAnimations, animations, expectOnlyTransformOpacity, smoothReplay, fpsEvidence } from './exp-helpers.js';

const start = async (page, app, browser, options = {}) => {
  const table = await openTable(page, app, browser, 'kritzelpost', { guests: ['Ben', 'Cleo'], ...options });
  await soundLog(page); await recordAnimations(page);
  await ok(page, 'start'); await expect(page.locator('.pk-q')).toBeVisible();
  return { ...table, pages: [page, ...table.others] };
};
const key = (p) => p.evaluate(() => lastState.g.key);
const write = async (p, text) => ok(p, 'answer', { key: await key(p), text });
const sketch = async (p) => ok(p, 'drawing', { key: await key(p), strokes: [{ color: '#df493d', size: 18, points: [[200, 200], [500, 520], [800, 240]] }], done: true });
const step = (p, n) => expect.poll(() => p.evaluate(() => lastState.g.step ?? lastState.g.stage)).toBe(n);
// Spielt eine ganze Kette: Begriff, Zeichnung, Beschreibung. `last` ist die Beschreibung je Seite.
async function chain(pages, last, afterFirst) {
  for (const p of pages) { await write(p, 'Katze'); await afterFirst?.(p); }
  for (const p of pages) await step(p, 2);
  for (const p of pages) await sketch(p);
  for (const p of pages) await step(p, 3);
  for (const [i, p] of pages.entries()) await write(p, last[i]);
}

test('EXP-038: Stempel, Umschlag, Sirene, Kette spult ab, „Zugestellt!“ mit Konfetti, Bewegungsbudget', async ({ page, app, browser }, info) => {
  test.setTimeout(120000);
  const { pages, close } = await start(page, app, browser);
  try {
    await expect(page.locator('#kg')).toHaveAttribute('data-xp-kit', 'kritzelpost');
    await expectSound(page, { event: 'envelope', palette: 'kritzelpost', game: 'kritzelpost' });
    await expect(page.locator('.pk-q')).toHaveAttribute('data-xp-mark', 'Nr. 1');
    let stamped = false;
    await chain(pages, ['Katze', 'Hund', 'Katze'], async (p) => { if (p === page && !stamped) { stamped = true; await expectSound(page, 'stamp'); await soundLog(page); await recordAnimations(page); } });
    // Auflösung: Sirene, Seiten erscheinen nacheinander, zwei Ketten sind zugestellt.
    await expect(page.locator('.draw-chains')).toBeVisible();
    await expectSound(page, 'siren');
    await expect(page.locator('.draw-chains details.xp-delivered')).toHaveCount(2);
    await expect(page.locator('.xp-kp-delivered').first()).toContainText('Zugestellt!');
    await expectSound(page, 'page');
    await expect(page.locator('.xp-plaque.xp-kp-stamp')).toContainText('Zugestellt!', { timeout: 8000 });
    await expectSound(page, 'highlight');
    await expect(page.locator('.xp-confetti').first()).toBeAttached();
    const seen = await animations(page);
    expect(Math.max(...seen.map((a) => a.delay))).toBeGreaterThan(1000); // die Kette spult nacheinander ab
    expectOnlyTransformOpacity(seen);
    expect(await sounds(page)).toContain('envelope'); // Schritt 2 und 3 kamen als Umschlag an
    expect(await sounds(page)).not.toContain('beep');
    await page.waitForTimeout(500); await evidence(page, info, 'EXP-038', 'zugestellt');
    await expectNoLeak(page, { requireSecrets: false });
    await close(); // Messung ohne weitere Browser
    await fpsEvidence(info, 'EXP-038', await smoothReplay(page, 'kritzelpost', { gap: 1800 }));
  } finally { await close(); }
});

test('EXP-038: „Animationen reduzieren“, Neuladen und Zuschauen ohne Rückstau; fremde Beiträge bleiben verdeckt', async ({ page, app, browser }) => {
  test.setTimeout(120000);
  const { pages, others, close } = await start(page, app, browser, { reduced: true });
  try {
    await write(page, 'Katze');
    // Solange geschrieben wird, sieht niemand fremde Beiträge – auch kein Zuschauer.
    const { watcher, close: leave } = await watch(page, app, browser);
    try { await expect(watcher.locator('.pk-q')).toBeVisible(); expect(await watcher.evaluate(() => JSON.stringify(lastState.g))).not.toContain('Katze'); await expect(watcher.locator('.xp-plaque')).toHaveCount(0); } finally { await leave(); }
    expect(await others[0].evaluate(() => JSON.stringify(lastState.g))).not.toContain('Katze');
    await write(others[0], 'Katze'); await write(others[1], 'Katze');
    for (const p of pages) await step(p, 2);
    for (const p of pages) await sketch(p);
    for (const p of pages) await step(p, 3);
    await recordAnimations(page);
    for (const p of pages) await write(p, 'Hund');
    await expect(page.locator('.draw-chains')).toBeVisible();
    await expectSound(page, 'siren');
    await expect(page.locator('.draw-chains details.xp-delivered')).toHaveCount(0);
    await expect(page.locator('.xp-plaque')).toHaveCount(0);
    for (const a of await animations(page)) expect(a.duration, JSON.stringify(a)).toBeLessThanOrEqual(150);
    await page.reload(); await expect(page.locator('.draw-chains')).toBeVisible();
    await soundLog(page); await recordAnimations(page); await page.waitForTimeout(400);
    expect(await sounds(page)).toEqual([]); expect(await animations(page)).toEqual([]);
  } finally { await close(); }
});
