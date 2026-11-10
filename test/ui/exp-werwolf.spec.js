// EXP-036 Werwolf: Nacht- und Morgenklang, Dämmerung, Holztafeln, umdrehende Tafel beim Ausscheiden, Vollmond oder Sonne am Ende.
import { test, expect, expectSound, expectNoLeak } from './helpers.js';
import { openTable, watch, ok, send, soundLog, sounds, evidence, recordAnimations, animations, expectOnlyTransformOpacity, smoothReplay, fpsEvidence } from './exp-helpers.js';

const start = async (page, app, browser, options = {}) => {
  const table = await openTable(page, app, browser, 'werwolf', { settings: { turnTime: 0 }, ...options });
  for (let i = 0; i < 5; i++) await ok(page, 'addBot');
  await soundLog(page); await recordAnimations(page);
  await ok(page, 'start'); await expect(page.locator('.ww-village')).toBeVisible();
  return table;
};
// Erledigt die eigene Nachtaufgabe, bis der Tag anbricht.
async function untilDay(page) {
  await expect.poll(async () => {
    const g = await page.evaluate(() => lastState.g), todo = g.todo;
    if (g.stage !== 'night') return g.stage;
    if (todo?.type === 'amor') await send(page, 'amor', { a: todo.targets[0], b: todo.targets[1] });
    else if (todo?.type === 'wolf' && !todo.voted) await send(page, 'wolfVote', { target: todo.targets[0] });
    else if (todo?.type === 'seer') await send(page, 'seer', { target: todo.targets[0] });
    else if (todo?.type === 'witch') await send(page, 'witch', { action: 'none' });
    return g.stage;
  }, { timeout: 30000, intervals: [300] }).not.toBe('night');
}
// Darstellung auf dem bestätigten Tisch: zwei Spieler scheiden aus, einer davon durch Abstimmung.
const deathScene = (page) => page.evaluate(() => {
  const prev = JSON.parse(JSON.stringify(lastState)), view = JSON.parse(JSON.stringify(lastState)), ids = view.g.alive.filter((id) => id !== view.you.id).slice(0, 2);
  view.g.deaths.push({ id: ids[0], day: view.g.day, role: 'wolf' }, { id: ids[1], day: view.g.day, role: null });
  view.g.lastVote = { day: (prev.g.lastVote?.day || 0) + 1, executed: ids[0], votes: {} };
  return __experiences.werwolf.present(prev, view);
});
const endScene = (page, winner) => page.evaluate((winner) => {
  const prev = JSON.parse(JSON.stringify(lastState)), view = JSON.parse(JSON.stringify(lastState));
  view.phase = 'over'; view.g.winner = winner; view.g.stage = 'over';
  return __experiences.werwolf.present(prev, view);
}, winner);

test('EXP-036: Nachtklang, Holztafel mit Zeichen, Dämmerung nur mit transform/opacity, Bewegungsbudget', async ({ page, app, browser }, info) => {
  test.setTimeout(120000);
  const { close } = await start(page, app, browser);
  try {
    await expect(page.locator('#kg')).toHaveAttribute('data-xp-kit', 'werwolf');
    await expectSound(page, { event: 'night', palette: 'werwolf', game: 'werwolf' });
    await expect(page.locator('.ww-village')).toHaveAttribute('data-xp-sky', 'nacht');
    await expect(page.locator('.ww-role .xp-ww-glyph')).toBeVisible();
    await expect(page.locator('.xp-ww-orb')).toBeAttached();
    await untilDay(page);
    await expectSound(page, 'rooster');
    await expect(page.locator('.ww-village')).toHaveAttribute('data-xp-sky', 'tag');
    await expect.poll(async () => (await animations(page)).some((a) => /xp-ww-orb/.test(a.target))).toBe(true);
    expectOnlyTransformOpacity(await animations(page));
    expect(await sounds(page)).not.toContain('beep');
    await expectNoLeak(page, { requireSecrets: false });
    await fpsEvidence(info, 'EXP-036', await smoothReplay(page, 'werwolf', { gap: 1200 }));
    await evidence(page, info, 'EXP-036', 'tag');
  } finally { await close(); }
});

test('EXP-036: Tafel dreht sich beim Ausscheiden, Gong bei der Hinrichtung, Vollmond und Sonne am Ende', async ({ page, app, browser }, info) => {
  const { close } = await start(page, app, browser);
  try {
    await untilDay(page); await page.waitForTimeout(1300); // am Tag bleibt der Tisch ruhig, bis jemand abstimmen lässt
    await soundLog(page); await recordAnimations(page);
    expect(await deathScene(page)).toBe(true);
    await expect(page.locator('.xp-ww-card')).toHaveCount(2);
    await expectSound(page, 'gong');
    await expect(page.locator('.xp-ww-card.is-turned').first()).toContainText('Werwolf', { timeout: 4000 });
    await expectSound(page, 'flip');
    // Ohne aufgedeckte Rolle zeigt die Tafel nur das Ausscheiden.
    await expect(page.locator('.xp-ww-card.is-turned').nth(1)).toContainText('ausgeschieden');
    expectOnlyTransformOpacity(await animations(page));
    await evidence(page, info, 'EXP-036', 'ausscheiden');
    await soundLog(page);
    expect(await endScene(page, 'wolf')).toBe(true);
    await expect(page.locator('#kg')).toHaveAttribute('data-xp', 'vollmond');
    await expect(page.locator('.xp-ww-finale.is-moon')).toContainText('Die Werwölfe gewinnen');
    await expectSound(page, 'end');
    await page.waitForTimeout(1600); await evidence(page, info, 'EXP-036', 'vollmond');
    expect(await endScene(page, 'dorf')).toBe(true);
    await expect(page.locator('.xp-ww-finale.is-sun')).toContainText('Das Dorf gewinnt');
    await expectSound(page, 'highlight');
    await page.waitForTimeout(1600); await evidence(page, info, 'EXP-036', 'sonne');
    // Der nächste bestätigte Zustand räumt alles weg (kein Rückstau).
    await ok(page, 'gamePause', { paused: true });
    await expect(page.locator('.xp-plaque')).toHaveCount(0); await expect(page.locator('.xp-ww-card')).toHaveCount(0);
    await ok(page, 'gamePause', { paused: false });
  } finally { await close(); }
});

test('EXP-036: „Animationen reduzieren“, Neuladen und Zuschauen ohne Rückstau und ohne fremde Rollen', async ({ page, app, browser }) => {
  test.setTimeout(120000);
  const { close } = await start(page, app, browser, { reduced: true });
  try {
    await expectSound(page, 'night');
    await untilDay(page); await page.waitForTimeout(400);
    await recordAnimations(page);
    expect(await deathScene(page)).toBe(true);
    await expect(page.locator('.xp-ww-card.is-turned')).toHaveCount(2);
    expect(await endScene(page, 'dorf')).toBe(true);
    await expect(page.locator('.xp-ww-finale')).toHaveCount(1);
    for (const a of await animations(page)) expect(a.duration, JSON.stringify(a)).toBeLessThanOrEqual(150);
    await page.reload(); await expect(page.locator('.ww-village')).toBeVisible();
    await soundLog(page); await recordAnimations(page); await page.waitForTimeout(400);
    expect(await sounds(page)).toEqual([]); expect(await animations(page)).toEqual([]);
    await expect(page.locator('.ww-village')).toHaveAttribute('data-xp-sky', /nacht|tag/);
    const { watcher, close: leave } = await watch(page, app, browser);
    try {
      await expect(watcher.locator('.ww-village')).toBeVisible();
      await expect(watcher.locator('.ww-role')).toHaveCount(0); await expect(watcher.locator('.xp-ww-glyph')).toHaveCount(0);
    } finally { await leave(); }
  } finally { await close(); }
});
