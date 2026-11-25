// EXP-087 Doppelkopf: Vereinsheim, Re-/Kontra-Aufsteller, Ansagen als Messington, Stich zum Gewinner, Fuchs-Plakette, „Doko!“.
import { test, expect, expectSound, expectNoLeak } from './helpers.js';
import { openTable, watch, ok, soundLog, sounds, evidence, recordAnimations, animations, expectOnlyTransformOpacity, smoothReplay, fpsEvidence } from './exp-helpers.js';

const startBots = async (page, app, browser) => {
  const table = await openTable(page, app, browser, 'doppelkopf', { reduced: true });
  for (const d of ['easy', 'medium', 'hard']) await ok(page, 'addBot', { difficulty: d });
  await soundLog(page); await recordAnimations(page);
  await ok(page, 'start'); await expect(page.locator('.dk-world')).toBeVisible();
  return table;
};
async function reachBotPlay(page) {
  await expect.poll(async () => {
    const S = await page.evaluate(() => ({ mine: lastState.turnId === lastState.you.id, g: lastState.g }));
    if (S.g.stage === 'play') return true;
    if (S.mine && S.g.stage === 'reserve') {
      await ok(page, 'reserve', { key: S.g.key, revision: S.g.revision, choice: 'healthy' });
    }
    return false;
  }, { timeout: 60000, intervals: [300] }).toBe(true);
}

async function firstLiveCallAndTrick(observer, pages) {
  const byId = new Map();
  for (const actor of pages) {
    await expect(actor.locator('.dk-world')).toBeVisible();
    byId.set(await actor.evaluate(() => lastState.you.id), actor);
  }
  const view = (page) => page.evaluate(() => ({
    turn: lastState.turnId, key: lastState.g.key, revision: lastState.g.revision,
    stage: lastState.g.stage, legal: lastState.g.legal, canAnnounce: lastState.g.canAnnounce,
    levels: lastState.g.levels, annBy: lastState.g.annBy,
  }));
  async function act(stage, type, data) {
    const before = await view(observer);
    expect(before.stage).toBe(stage);
    const actor = byId.get(before.turn);
    expect(actor).toBeDefined();
    await expect.poll(async () => {
      const current = await view(actor);
      return [current.key, current.revision, current.turn];
    }).toEqual([before.key, before.revision, before.turn]);
    await ok(actor, type, { key: before.key, revision: before.revision, ...data(await view(actor)) });
    await expect.poll(async () => (await view(observer)).revision).toBe(before.revision + 1);
    return { before, after: await view(observer) };
  }

  for (let i = 0; i < 4; i++) await act('reserve', 'reserve', () => ({ choice: 'healthy' }));
  await expect.poll(() => observer.evaluate(() => soundEngine?.palette)).toBe('doppelkopf');
  const { before, after } = await act('play', 'announce', ({ canAnnounce }) => {
    expect(canAnnounce).toBe(1);
    return { level: canAnnounce };
  });
  const changed = ['re', 'kontra'].filter((party) => after.levels[party] === before.levels[party] + 1);
  expect(changed).toHaveLength(1);
  const [party] = changed;
  expect(after.annBy[party]).toEqual([before.turn]);
  await expectSound(observer, { event: party, palette: 'doppelkopf', game: 'doppelkopf' });

  for (let i = 0; i < 4; i++) await act('play', 'play', ({ legal }) => ({ card: legal[0] }));
  await expectSound(observer, 'sweep');
  expect((await sounds(observer)).filter((event) => event === 're' || event === 'kontra')).toEqual([party]);
}
const scene = (page) => page.evaluate(() => {
  const prev = JSON.parse(JSON.stringify(lastState)), view = JSON.parse(JSON.stringify(lastState)), ids = view.players.filter((p) => p.inRound).map((p) => p.id);
  prev.g.trick = [{}, {}, {}]; view.g.trick = [];
  view.g.lastTrick = { winner: ids[1], points: 42, cards: [{ id: ids[0], card: 'Ad1' }, { id: ids[1], card: 'Tc1' }, { id: ids[2], card: 'Ac1' }, { id: ids[3], card: 'Ah2' }] };
  view.g.known = { ...view.g.known, [ids[0]]: 're', [ids[1]]: 'kontra' }; prev.g.known = { ...view.g.known }; delete prev.g.known[ids[0]];
  view.g.levels = { re: 1, kontra: 0 }; prev.g.levels = { re: 0, kontra: 0 };
  const presented = __experiences.doppelkopf.present(prev, view);
  // These elements are deliberately short-lived. Sample the rendered scene in the same turn.
  return {
    presented, foxes: document.querySelectorAll('.xp-dk-fox').length,
    plaques: [...document.querySelectorAll('.xp-plaque.xp-dk-doko')].map(el => el.textContent),
    highlighted: document.querySelectorAll('.dk-trick article.xp-dk-glow').length,
    cards: document.querySelectorAll('.dk-trick article').length,
    effect: document.querySelector('#kg').dataset.xp,
  };
});

test('EXP-087: Aufsteller und Rundenzettel, Ansage als Messington, Stich zum Gewinner, Fuchs mit Jagdhorn, Doko!, Bewegungsbudget', async ({ page, app, browser }, info) => {
  test.setTimeout(150000);
  const { close, others } = await openTable(page, app, browser, 'doppelkopf', {
    guests: ['Nord', 'West', 'Sued'], settings: { turnTime: 0 },
  });
  try {
    await page.bringToFront();
    await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe('visible');
    await soundLog(page); await recordAnimations(page);
    await ok(page, 'start');
    await expect(page.locator('.dk-world')).toBeVisible();
    await expect(page.locator('#kg')).toHaveAttribute('data-xp-kit', 'doppelkopf');
    await firstLiveCallAndTrick(page, [page, ...others]);
    await expect(page.locator('.xp-dk-plate')).toHaveCount(4);
    await expect(page.locator('.xp-dk-sheet')).toContainText('Stich');
    await expect.poll(async () => (await animations(page)).filter((a) => /xp-dk-sweep/.test(a.target)).length).toBeGreaterThanOrEqual(4);
    expectOnlyTransformOpacity(await animations(page));
    await evidence(page, info, 'EXP-087', 'vereinsheim');
    // Fuchs und Doko bei angehaltenem Spiel, damit der nächste Bot-Zug die Szene nicht sofort ablöst.
    await ok(page, 'gamePause', { paused: true });
    await expect.poll(() => page.evaluate(() => lastState.gamePaused)).toBe(true);
    await soundLog(page); await recordAnimations(page);
    const shown = await scene(page);
    expect(shown).toMatchObject({ presented: true, foxes: 1, plaques: ['Doko!'], effect: 'doko' });
    expect(shown.highlighted).toBe(shown.cards);
    await expectSound(page, 're'); await expectSound(page, 'flip'); await expectSound(page, 'horn'); await expectSound(page, 'highlight');
    expectOnlyTransformOpacity(await animations(page));
    await page.waitForTimeout(600); await evidence(page, info, 'EXP-087', 'doko');
    await ok(page, 'gamePause', { paused: false });
    expect(await sounds(page)).not.toContain('beep');
    await expectNoLeak(page, { requireSecrets: false });
    await expectSound(page, { event: 'horn', palette: 'doppelkopf', game: 'doppelkopf' });
    // Only Chromium exposes the CDP CPU throttling used by the FPS budget.
    if (browser.browserType().name() === 'chromium') {
      await fpsEvidence(info, 'EXP-087', await smoothReplay(page, 'doppelkopf', { gap: 1000 }));
    }
  } finally { await close(); }
});

test('EXP-087: Aufsteller verraten keine Partei, „Animationen reduzieren“, Neuladen und Zuschauen ohne Rückstau', async ({ page, app, browser }) => {
  test.setTimeout(120000);
  const { close } = await startBots(page, app, browser);
  try {
    await recordAnimations(page);
    await reachBotPlay(page);
    // Nur öffentlich bekannte Parteien stehen auf den Aufstellern.
    const shown = await page.evaluate(() => [...document.querySelectorAll('.xp-dk-plate')].filter((el) => el.dataset.party !== 'offen').map((el) => el.closest('[data-pid]').dataset.pid).sort());
    expect(shown).toEqual(Object.keys(await page.evaluate(() => lastState.g.known)).sort());
    await ok(page, 'gamePause', { paused: true });
    expect(await scene(page)).toMatchObject({ presented: true, plaques: ['Doko!'] });
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
