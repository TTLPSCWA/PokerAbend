// EXP-004 UNO: Kartenklatschen, Zieh-Rascheln mit Fächer, fliegende Strafkarten, Pfeilring, Wunsch-Drehscheibe, Stapel-Schlacht.
import { test, expect, expectSound, expectNoLeak } from './helpers.js';
import { openTable, watch, ok, send, soundLog, sounds, evidence, recordAnimations, animations, expectOnlyTransformOpacity, smoothReplay, fpsEvidence } from './exp-helpers.js';

const start = async (page, app, browser, options = {}) => {
  const table = await openTable(page, app, browser, 'farbenchaos', { guests: ['Ben', 'Cleo'], ...options });
  await soundLog(page); await recordAnimations(page);
  await ok(page, 'start'); await expect(page.locator('.kg-piles')).toBeVisible();
  return { ...table, pages: [page, ...table.others] };
};
// Wer am Zug ist, legt die erste spielbare Karte oder zieht. Liefert Seite und Art des Zugs.
async function turn(pages) {
  let p = null, over = false; await expect.poll(async () => { over = await pages[0].evaluate(() => lastState.phase !== 'playing'); for (const c of pages) if (await c.evaluate(() => lastState.phase === 'playing' && lastState.turnId === lastState.you.id)) p = c; return over || !!p; }).toBe(true);
  if (over) return { p: null, kind: 'over' };
  const g = await p.evaluate(() => lastState.g);
  if (g.colorChoice) { await send(p, 'chooseColor', { color: 'r' }); return { p, kind: 'colour' }; }
  if (g.challenge) { await send(p, 'challenge', { challenge: false }); return { p, kind: 'draw' }; }
  if (g.playable.length && !g.pending) { const card = g.playable[0]; const r = await send(p, 'play', { card, wish: card[1] === 'w' ? 'r' : null, call: g.hand.length === 2, target: null }); if (r.ok) return { p, kind: 'play' }; }
  if (g.drawn) { await send(p, 'pass'); return { p, kind: 'pass' }; }
  const r = await send(p, 'draw'); return { p, kind: r.ok ? 'draw' : 'none' };
}
// Darstellung auf dem bestätigten Tisch: eine erfundene, öffentliche Änderung zeigen (nur Anzeige).
const scene = (page, kind) => page.evaluate((kind) => {
  const prev = JSON.parse(JSON.stringify(lastState)), view = JSON.parse(JSON.stringify(lastState)), other = view.players.find((p) => p.inRound && p.id !== view.you.id), actor = view.players.find((p) => p.id === view.turnId);
  const ids = view.players.filter((p) => p.inRound).map((p) => p.id), i = ids.indexOf(view.turnId), at = (k) => ids[(((i + view.dir * k) % ids.length) + ids.length) % ids.length];
  if (kind === 'reverse') { actor.cards -= 1; view.g.top = 'Rr'; view.dir = -view.dir; view.turnId = at(-1); }
  if (kind === 'skip') { actor.cards -= 1; view.g.top = 'Sr'; view.turnId = at(2); }
  if (kind === 'wish') { actor.cards -= 1; view.g.top = 'Ww'; view.g.wish = 'b'; view.turnId = at(1); }
  if (kind === 'chain1') { actor.cards -= 1; view.g.top = 'Dr'; view.g.pending = 2; view.turnId = at(1); }
  if (kind === 'chain2') { prev.g.pending = 2; prev.g.top = 'Dr'; actor.cards -= 1; view.g.top = 'Dg'; view.g.pending = 4; view.turnId = at(1); }
  if (kind === 'chain3') { prev.g.pending = 4; prev.g.top = 'Dg'; actor.cards -= 1; view.g.top = 'Db'; view.g.pending = 6; view.turnId = at(1); }
  if (kind === 'swell') { prev.g.pending = 6; view.g.pending = 0; view.players.find((p) => p.id === other.id).cards += 6; }
  return __experiences.farbenchaos.present(prev, view);
}, kind);

test('EXP-004: Kartenklatschen, Ziehen mit Fächer, Pfeilring, Drehscheibe, Aussetzen – nur transform/opacity, Bewegungsbudget', async ({ page, app, browser }, info) => {
  test.setTimeout(150000);
  const { pages, close } = await start(page, app, browser);
  try {
    await expect(page.locator('#kg')).toHaveAttribute('data-xp-kit', 'farbenchaos');
    await expectSound(page, { event: 'deal', palette: 'uno', game: 'farbenchaos' });
    // Echte Züge, bis die Hauptseite selbst gezogen und jemand abgelegt hat.
    const seen = new Set(); let drew = false;
    for (let i = 0; i < 60 && !(seen.has('play') && drew) && !seen.has('over'); i++) { const move = await turn(pages); seen.add(move.kind); if (move.kind === 'draw' && move.p === page) drew = true; }
    expect(seen.has('play')).toBe(true); await expectSound(page, 'card');
    if (drew) { await expectSound(page, 'draw'); await expect.poll(async () => (await animations(page)).some((a) => /kc/.test(a.target))).toBe(true); }
    if (seen.has('over')) { await ok(page, 'start'); await expect.poll(() => page.evaluate(() => lastState.phase)).toBe('playing'); }
    // Öffentliche Sonderfälle, gezeigt auf dem echten Tisch.
    await soundLog(page); await recordAnimations(page);
    expect(await scene(page, 'reverse')).toBe(true);
    await expectSound(page, 'reverse'); await expect(page.locator('.xp-uno-ring')).toBeAttached();
    await page.waitForTimeout(300); await evidence(page, info, 'EXP-004', 'richtungswechsel');
    expect(await scene(page, 'wish')).toBe(true);
    await expectSound(page, 'wish'); await expect(page.locator('.xp-uno-disc')).toBeAttached();
    expect(await scene(page, 'skip')).toBe(true);
    await expectSound(page, 'skip'); await expect(page.locator('[data-xp="aussetzen"]')).toHaveCount(1);
    const mine = (await animations(page)).filter((a) => !/kg-piles|kg-over-card/.test(a.target)); // der ältere Kartenschein der Farbwelt (VIS) zählt nicht zum Paket
    expect(mine.length).toBeGreaterThan(2); expectOnlyTransformOpacity(mine);
    expect(await sounds(page)).not.toContain('beep');
    await expectNoLeak(page, { requireSecrets: false });
    await close(); // Messung ohne weitere Browser
    await scene(page, 'reverse');
    await fpsEvidence(info, 'EXP-004', await smoothReplay(page, 'farbenchaos', { gap: 1100 }));
  } finally { await close(); }
});

test('EXP-004: Stapel-Schlacht – Zähler wächst, der Schwall fliegt Karte für Karte zum Verlierer', async ({ page, app, browser }, info) => {
  const { close } = await start(page, app, browser);
  try {
    await soundLog(page); await recordAnimations(page);
    expect(await scene(page, 'chain1')).toBe(true);
    await expect(page.locator('.xp-uno-count')).toHaveCount(0); // eine einzelne +2 ist noch keine Schlacht
    expect(await scene(page, 'chain2')).toBe(true);
    await expectSound(page, 'stack'); await expect(page.locator('.xp-uno-count')).toContainText('+4!');
    expect(await scene(page, 'chain3')).toBe(true);
    await expect(page.locator('.xp-uno-count')).toContainText('+6!');
    await expect(page.locator('.kg-piles')).toHaveAttribute('data-xp', 'stapel');
    await page.waitForTimeout(250); await evidence(page, info, 'EXP-004', 'stapel');
    expect(await scene(page, 'swell')).toBe(true);
    await expect(page.locator('.xp-fly')).toHaveCount(6);
    await expectSound(page, 'draw'); await expectSound(page, 'highlight');
    await expect(page.locator('.xp-uno-count')).toContainText('+6');
    await expect.poll(async () => (await animations(page)).filter((a) => /xp-fly/.test(a.target)).length).toBe(6);
    const fly = (await animations(page)).filter((a) => /xp-fly/.test(a.target));
    expect(new Set(fly.map((a) => a.delay)).size).toBe(6); // nacheinander, nicht als Block
    expectOnlyTransformOpacity(fly);
    await page.waitForTimeout(350); await evidence(page, info, 'EXP-004', 'schwall');
    // Der nächste bestätigte Zustand räumt alles weg (kein Rückstau).
    await ok(page, 'gamePause', { paused: true });
    await expect(page.locator('.xp-plaque')).toHaveCount(0); await expect(page.locator('.xp-fly')).toHaveCount(0);
    await ok(page, 'gamePause', { paused: false });
  } finally { await close(); }
});

test('EXP-004: „Animationen reduzieren“, Neuladen und Zuschauen ohne Rückstau; fremde Karten bleiben Kartenrücken', async ({ page, app, browser }) => {
  test.setTimeout(120000);
  const { pages, close } = await start(page, app, browser, { reduced: true });
  try {
    await recordAnimations(page);
    for (let i = 0; i < 4; i++) await turn(pages);
    expect(await scene(page, 'chain2')).toBe(true); expect(await scene(page, 'swell')).toBe(true);
    for (const a of (await animations(page)).filter((a) => !/kg-piles/.test(a.target))) expect(a.duration, JSON.stringify(a)).toBeLessThanOrEqual(150);
    expect(await page.evaluate(() => JSON.stringify(lastState.players.map((p) => Object.keys(p))))).not.toContain('hand');
    await page.reload(); await expect(page.locator('.kg-piles')).toBeVisible();
    await soundLog(page); await recordAnimations(page); await page.waitForTimeout(400);
    expect((await sounds(page)).filter((e) => e !== 'turn')).toEqual([]); expect(await animations(page)).toEqual([]);
    const { watcher, close: leave } = await watch(page, app, browser);
    try { await expect(watcher.locator('.kg-piles')).toBeVisible(); await expect(watcher.locator('.xp-plaque')).toHaveCount(0); expect(await watcher.evaluate(() => lastState.g.hand)).toBeNull(); } finally { await leave(); }
  } finally { await close(); }
});
