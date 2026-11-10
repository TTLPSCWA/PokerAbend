// EXP-086 Skat: Gute Stube, Stammtisch-Schild, Reizblock mit Bleistift, Klopfen bei Trumpf, Stich zum Gewinner, Grand Hand.
import { test, expect, expectSound, expectNoLeak } from './helpers.js';
import { openTable, watch, ok, send, soundLog, sounds, evidence, recordAnimations, animations, expectOnlyTransformOpacity, smoothReplay, fpsEvidence } from './exp-helpers.js';

const start = async (page, app, browser, options = {}) => {
  const table = await openTable(page, app, browser, 'skat', options);
  for (const d of ['easy', 'hard']) await ok(page, 'addBot', { difficulty: d });
  await soundLog(page); await recordAnimations(page);
  await ok(page, 'start'); await expect(page.locator('.sk-world')).toBeVisible();
  return table;
};
// Die Hauptseite passt beim Reizen und spielt im Spiel die erste erlaubte Karte, bis `done()` stimmt.
async function playUntil(page, done, timeout = 60000) {
  await expect.poll(async () => {
    if (await done()) return true;
    const S = await page.evaluate(() => ({ mine: lastState.turnId === lastState.you.id, g: lastState.g }));
    if (S.mine) {
      const key = { key: S.g.key, revision: S.g.revision };
      if (S.g.stage === 'bid') await send(page, 'bid', { ...key, action: 'pass' });
      else if (S.g.stage === 'play' && S.g.legal?.length) await send(page, 'play', { ...key, card: S.g.legal[0] });
      else if (S.g.stage === 'pickup') await send(page, 'pickup', { ...key, take: false });
    }
    return false;
  }, { timeout, intervals: [300] }).toBe(true);
}
const scene = (page, kind) => page.evaluate((kind) => {
  const prev = JSON.parse(JSON.stringify(lastState)), view = JSON.parse(JSON.stringify(lastState));
  if (kind === 'grandhand') { prev.g.stage = 'declare'; view.g.stage = 'play'; view.g.game = { type: 'grand', hand: true }; view.g.trick = []; prev.g.trick = []; }
  if (kind === 'trump') { prev.g.trick = []; view.g.game = view.g.game || { type: 'grand' }; view.g.trick = [{ id: view.turnId, card: 'Jc' }]; }
  return __experiences.skat.present(prev, view);
}, kind);

test('EXP-086: Stube und Schild, Bleistift beim Reizen, Stiche wandern zum Gewinner, Trumpf-Klopfen, Grand Hand, Bewegungsbudget', async ({ page, app, browser }, info) => {
  test.setTimeout(150000);
  const { close } = await start(page, app, browser);
  try {
    await expect(page.locator('#kg')).toHaveAttribute('data-xp-kit', 'skat');
    await expect(page.locator('.xp-sk-sign')).toBeVisible();
    // Echtes Reizen der Bots: Bleistift auf dem Reizblock.
    await playUntil(page, async () => (await sounds(page)).includes('pencil'));
    await expect(page.locator('.sk-bid .xp-sk-pencil')).toBeAttached();
    await evidence(page, info, 'EXP-086', 'reizblock');
    // Echtes Spiel bis zum ersten fertigen Stich: Er gleitet zum Gewinnerplatz.
    await recordAnimations(page);
    await playUntil(page, async () => (await sounds(page)).includes('sweep'));
    await expect.poll(async () => (await animations(page)).filter((a) => /xp-sk-sweep/.test(a.target)).length).toBeGreaterThanOrEqual(3);
    expectOnlyTransformOpacity(await animations(page));
    // Die Szenen laufen bei angehaltenem Spiel, damit der nächste Bot-Zug sie nicht sofort ablöst.
    await ok(page, 'gamePause', { paused: true }); await soundLog(page);
    expect(await scene(page, 'trump')).toBe(true); await expectSound(page, 'knock');
    expect(await scene(page, 'grandhand')).toBe(true);
    await expectSound(page, 'stammtisch'); await expectSound(page, 'highlight');
    await expect(page.locator('#kg')).toHaveAttribute('data-xp', 'grandhand');
    await expect(page.locator('.xp-plaque.xp-sk-grand')).toContainText('Grand Hand');
    await expect(page.locator('.xp-sk-note')).toHaveText('Grand Hand');
    await page.waitForTimeout(500); await evidence(page, info, 'EXP-086', 'grandhand');
    await ok(page, 'gamePause', { paused: false });
    expect(await sounds(page)).not.toContain('beep');
    await expectNoLeak(page, { requireSecrets: false });
    await expectSound(page, { event: 'stammtisch', palette: 'skat', game: 'skat' });
    await fpsEvidence(info, 'EXP-086', await smoothReplay(page, 'skat', { gap: 900 }));
  } finally { await close(); }
});

test('EXP-086: Skat bleibt verdeckt, „Animationen reduzieren“, Neuladen und Zuschauen ohne Rückstau', async ({ page, app, browser }) => {
  test.setTimeout(120000);
  const { close } = await start(page, app, browser, { reduced: true });
  try {
    await recordAnimations(page);
    await playUntil(page, async () => (await sounds(page)).includes('pencil'));
    await ok(page, 'gamePause', { paused: true });
    expect(await scene(page, 'grandhand')).toBe(true);
    await expect(page.locator('.xp-plaque.xp-sk-grand')).toHaveCount(1);
    await ok(page, 'gamePause', { paused: false });
    for (const a of await animations(page)) expect(a.duration, JSON.stringify(a)).toBeLessThanOrEqual(150);
    expect(await page.evaluate(() => JSON.stringify(lastState.g))).not.toMatch(/"skat":\[/);
    await page.reload(); await expect(page.locator('.sk-world')).toBeVisible();
    await soundLog(page); await recordAnimations(page); await page.waitForTimeout(400);
    expect((await sounds(page)).filter((e) => !['turn', 'beep'].includes(e))).toEqual([]); // „Du bist dran“ darf nach dem Neuladen klingen
    await expect(page.locator('.xp-sk-sign')).toBeVisible();
    const { watcher, close: leave } = await watch(page, app, browser);
    try { await expect(watcher.locator('.sk-world')).toBeVisible(); await expect(watcher.locator('.xp-plaque')).toHaveCount(0); expect(await watcher.evaluate(() => lastState.g.hand)).toBeNull(); } finally { await leave(); }
  } finally { await close(); }
});
