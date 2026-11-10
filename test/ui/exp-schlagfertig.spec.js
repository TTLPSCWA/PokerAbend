// EXP-019 Schlagfertig: Karteikarten, Spot auf der besseren Antwort, Lachen nach Stimmen, Rimshot, Standing Ovation.
import { test, expect, expectSound, expectNoLeak } from './helpers.js';
import { openTable, watch, ok, soundLog, sounds, evidence, recordAnimations, animations, expectOnlyTransformOpacity, smoothReplay, fpsEvidence } from './exp-helpers.js';

const start = async (page, app, browser, options = {}) => {
  const table = await openTable(page, app, browser, 'schlagfertig', { guests: ['Ben', 'Cleo', 'Dora'], ...options });
  await soundLog(page); await recordAnimations(page);
  await ok(page, 'start'); await expect(page.locator('.pk-q')).toBeVisible();
  return { ...table, pages: [page, ...table.others] };
};
const stage = (p) => p.evaluate(() => `${lastState.g.stage}:${lastState.g.step ?? ''}`);
// Alle schreiben ihre beiden Antworten.
async function writeAll(pages) { for (const p of pages) for (const task of await p.evaluate(() => lastState.g.tasks.map((t) => t.idx))) await ok(p, 'answer', { task, text: `Antwort ${task}` }); }
// Ein Duell: Die beiden Stimmberechtigten wählen `picks` (z. B. [0, 0] einstimmig, [0, 1] Gleichstand).
async function duel(pages, picks) {
  const before = await stage(pages[0]), voters = [];
  for (const p of pages) if (await p.evaluate(() => lastState.g.canVote)) voters.push(p);
  for (const [i, p] of voters.entries()) await ok(p, 'vote', { choice: picks[i % picks.length] });
  await expect.poll(() => stage(pages[0])).not.toBe(before);
}

test('EXP-019: Karteikarten, Spot und Lachen, Rimshot bei Gleichstand, Standing Ovation beim Volltreffer, Bewegungsbudget', async ({ page, app, browser }, info) => {
  test.setTimeout(150000);
  const { pages, close } = await start(page, app, browser);
  try {
    await expect(page.locator('#kg')).toHaveAttribute('data-xp-kit', 'schlagfertig');
    await expectSound(page, { event: 'index', palette: 'schlagfertig', game: 'schlagfertig' });
    await expect(page.locator('.xp-sl-mic svg')).toBeAttached();
    await writeAll(pages);
    await expect.poll(() => stage(page)).toBe('vote:1');
    await expectSound(page, 'mic');
    await expect.poll(async () => (await animations(page)).some((a) => /sl-ans/.test(a.target))).toBe(true);
    // Vier Duelle: einstimmig, Gleichstand, einstimmig, einstimmig.
    await soundLog(page); await recordAnimations(page);
    await duel(pages, [0, 0]); await duel(pages, [0, 1]); await duel(pages, [1, 1]); await duel(pages, [0, 0]);
    await expect(page.locator('.sl-result')).toHaveCount(4);
    await expectSound(page, 'laugh2'); await expectSound(page, 'rimshot', { timeout: 6000 });
    await expect(page.locator('.sl-card.xp-spot')).toHaveCount(3); await expect(page.locator('.sl-card.xp-dim')).toHaveCount(3);
    await expect(page.locator('.xp-sl-cone')).toHaveCount(3);
    await expect(page.locator('.sl-card.xp-spot .xp-sl-ha').first()).toBeAttached();
    await expect(page.locator('.sl-card.xp-spot').first().locator('.xp-sl-ha')).toHaveCount(2);
    await expect(page.locator('.xp-plaque.xp-sl-ovation')).toContainText('Standing Ovation!', { timeout: 6000 });
    await expectSound(page, 'applause'); await expectSound(page, 'highlight');
    await expect(page.locator('.xp-confetti').first()).toBeAttached();
    expectOnlyTransformOpacity(await animations(page));
    expect(await sounds(page)).not.toContain('beep');
    await page.waitForTimeout(400); await evidence(page, info, 'EXP-019', 'ovation');
    await expectNoLeak(page, { requireSecrets: false });
    await close(); // Messung ohne weitere Browser
    await fpsEvidence(info, 'EXP-019', await smoothReplay(page, 'schlagfertig', { gap: 2600 }));
  } finally { await close(); }
});

test('EXP-019: „Animationen reduzieren“, Neuladen und Zuschauen ohne Rückstau; Autoren bleiben bis zur Auflösung verdeckt', async ({ page, app, browser }) => {
  test.setTimeout(150000);
  const { pages, close } = await start(page, app, browser, { reduced: true });
  try {
    await writeAll(pages);
    await expect.poll(() => stage(page)).toBe('vote:1');
    // In der Abstimmung kennt niemand die Autoren – auch kein Zuschauer.
    const { watcher, close: leave } = await watch(page, app, browser);
    try { await expect(watcher.locator('.sl-ans').first()).toBeVisible(); expect(await watcher.evaluate(() => lastState.g.answers.every((a) => !('id' in a) && !('votes' in a)))).toBe(true); await expect(watcher.locator('.xp-plaque')).toHaveCount(0); } finally { await leave(); }
    await recordAnimations(page);
    for (let i = 0; i < 4; i++) await duel(pages, [0, 0]);
    await expect(page.locator('.sl-result')).toHaveCount(4);
    await expect(page.locator('.xp-plaque.xp-sl-ovation')).toHaveCount(1);
    for (const a of await animations(page)) expect(a.duration, JSON.stringify(a)).toBeLessThanOrEqual(150);
    await page.reload(); await expect(page.locator('.sl-result').first()).toBeVisible();
    await soundLog(page); await recordAnimations(page); await page.waitForTimeout(400);
    expect(await sounds(page)).toEqual([]); expect(await animations(page)).toEqual([]);
    await expect(page.locator('.sl-card.xp-spot')).toHaveCount(4); // Endzustand steht sofort
    await expect(page.locator('.xp-plaque')).toHaveCount(0);
  } finally { await close(); }
});
