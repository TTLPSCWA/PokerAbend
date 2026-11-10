// EXP-087 Doppelkopf: Vereinsheim, Re-/Kontra-Aufsteller, Ansagen als Messington, Stich zum Gewinner, Fuchs-Plakette, „Doko!“.
import { test, expect, expectSound, expectNoLeak } from './helpers.js';
import { openTable, watch, ok, send, soundLog, sounds, evidence, recordAnimations, animations, expectOnlyTransformOpacity, smoothReplay, fpsEvidence } from './exp-helpers.js';

const start = async (page, app, browser, options = {}) => {
  const table = await openTable(page, app, browser, 'doppelkopf', options);
  for (const d of ['easy', 'medium', 'hard']) await ok(page, 'addBot', { difficulty: d });
  await soundLog(page); await recordAnimations(page);
  await ok(page, 'start'); await expect(page.locator('.dk-world')).toBeVisible();
  return table;
};
// Die Hauptseite meldet „gesund“, sagt einmal Re/Kontra an und spielt danach die erste erlaubte Karte, bis `done()` stimmt.
async function playUntil(page, done, { announce = false } = {}) {
  await expect.poll(async () => {
    if (await done()) return true;
    const S = await page.evaluate(() => ({ mine: lastState.turnId === lastState.you.id, g: lastState.g }));
    if (S.mine) {
      const key = { key: S.g.key, revision: S.g.revision };
      if (S.g.stage === 'reserve') await send(page, 'reserve', { ...key, choice: 'healthy' });
      else if (S.g.stage === 'play') { if (announce && S.g.canAnnounce === 1) { await send(page, 'announce', { ...key, level: 1 }); announce = false; } else if (S.g.legal?.length) await send(page, 'play', { ...key, card: S.g.legal[0] }); }
    }
    return false;
  }, { timeout: 60000, intervals: [300] }).toBe(true);
}
const scene = (page, kind) => page.evaluate((kind) => {
  const prev = JSON.parse(JSON.stringify(lastState)), view = JSON.parse(JSON.stringify(lastState)), ids = view.players.filter((p) => p.inRound).map((p) => p.id);
  prev.g.trick = [{}, {}, {}]; view.g.trick = [];
  view.g.lastTrick = { winner: ids[1], points: 42, cards: [{ id: ids[0], card: 'Ad1' }, { id: ids[1], card: 'Tc1' }, { id: ids[2], card: 'Ac1' }, { id: ids[3], card: 'Ah2' }] };
  view.g.known = { ...view.g.known, [ids[0]]: 're', [ids[1]]: 'kontra' }; prev.g.known = { ...view.g.known }; delete prev.g.known[ids[0]];
  view.g.levels = { re: 1, kontra: 0 }; prev.g.levels = { re: 0, kontra: 0 };
  return __experiences.doppelkopf.present(prev, view);
}, kind);

test('EXP-087: Aufsteller und Rundenzettel, Ansage als Messington, Stich zum Gewinner, Fuchs mit Jagdhorn, Doko!, Bewegungsbudget', async ({ page, app, browser }, info) => {
  test.setTimeout(150000);
  const { close } = await start(page, app, browser);
  try {
    await expect(page.locator('#kg')).toHaveAttribute('data-xp-kit', 'doppelkopf');
    // Echtes Spiel: gesund melden, Re/Kontra ansagen, bis der erste Stich fertig ist.
    await playUntil(page, async () => (await sounds(page)).includes('sweep'), { announce: true });
    await expect.poll(async () => (await sounds(page)).some((e) => e === 're' || e === 'kontra')).toBe(true);
    await expect(page.locator('.xp-dk-plate')).toHaveCount(4);
    await expect(page.locator('.xp-dk-sheet')).toContainText('Stich');
    await expect.poll(async () => (await animations(page)).filter((a) => /xp-dk-sweep/.test(a.target)).length).toBeGreaterThanOrEqual(4);
    expectOnlyTransformOpacity(await animations(page));
    await evidence(page, info, 'EXP-087', 'vereinsheim');
    // Fuchs und Doko bei angehaltenem Spiel, damit der nächste Bot-Zug die Szene nicht sofort ablöst.
    await ok(page, 'gamePause', { paused: true }); await soundLog(page); await recordAnimations(page);
    expect(await scene(page, 'doko')).toBe(true);
    await expectSound(page, 're'); await expectSound(page, 'flip'); await expectSound(page, 'horn'); await expectSound(page, 'highlight');
    await expect(page.locator('#kg')).toHaveAttribute('data-xp', 'doko');
    await expect(page.locator('.xp-plaque.xp-dk-doko')).toContainText('Doko!');
    await expect(page.locator('.xp-dk-fox')).toHaveCount(1);
    expect(await page.locator('.dk-trick article.xp-dk-glow').count()).toBe(await page.locator('.dk-trick article').count()); // der gezeigte Stich leuchtet ganz
    expectOnlyTransformOpacity(await animations(page));
    await page.waitForTimeout(600); await evidence(page, info, 'EXP-087', 'doko');
    await ok(page, 'gamePause', { paused: false });
    expect(await sounds(page)).not.toContain('beep');
    await expectNoLeak(page, { requireSecrets: false });
    await expectSound(page, { event: 'horn', palette: 'doppelkopf', game: 'doppelkopf' });
    await fpsEvidence(info, 'EXP-087', await smoothReplay(page, 'doppelkopf', { gap: 1000 }));
  } finally { await close(); }
});

test('EXP-087: Aufsteller verraten keine Partei, „Animationen reduzieren“, Neuladen und Zuschauen ohne Rückstau', async ({ page, app, browser }) => {
  test.setTimeout(120000);
  const { close } = await start(page, app, browser, { reduced: true });
  try {
    await recordAnimations(page);
    await playUntil(page, async () => (await page.evaluate(() => lastState.g.stage)) === 'play');
    // Nur öffentlich bekannte Parteien stehen auf den Aufstellern.
    const shown = await page.evaluate(() => [...document.querySelectorAll('.xp-dk-plate')].filter((el) => el.dataset.party !== 'offen').map((el) => el.closest('[data-pid]').dataset.pid).sort());
    expect(shown).toEqual(Object.keys(await page.evaluate(() => lastState.g.known)).sort());
    await ok(page, 'gamePause', { paused: true });
    expect(await scene(page, 'doko')).toBe(true);
    await expect(page.locator('.xp-plaque.xp-dk-doko')).toHaveCount(1);
    for (const a of await animations(page)) expect(a.duration, JSON.stringify(a)).toBeLessThanOrEqual(150);
    await ok(page, 'gamePause', { paused: false });
    await page.reload(); await expect(page.locator('.dk-world')).toBeVisible();
    await soundLog(page); await recordAnimations(page); await page.waitForTimeout(400);
    expect((await sounds(page)).filter((e) => !['turn', 'beep', 'card', 'sweep', 'flip', 're', 'kontra'].includes(e))).toEqual([]); // Bots spielen weiter
    await expect(page.locator('.xp-plaque')).toHaveCount(0);
    const { watcher, close: leave } = await watch(page, app, browser);
    try { await expect(watcher.locator('.dk-world')).toBeVisible(); await expect(watcher.locator('.xp-plaque')).toHaveCount(0); expect(await watcher.evaluate(() => lastState.g.hand)).toBeNull(); } finally { await leave(); }
  } finally { await close(); }
});
