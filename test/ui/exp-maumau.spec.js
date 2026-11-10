// EXP-003 Mau-Mau: Kartenschnippen, 7er-Kette zählt hoch, die 8 lässt einschlafen, Löffel klirrt bei „Mau“, Highlight „Mau-Mau!“.
import { test, expect, expectSound, expectNoLeak } from './helpers.js';
import { openTable, watch, ok, send, soundLog, sounds, evidence, recordAnimations, animations, expectOnlyTransformOpacity, smoothReplay, fpsEvidence } from './exp-helpers.js';

const start = async (page, app, browser, options = {}) => {
  const table = await openTable(page, app, browser, 'maumau', { guests: ['Ben', 'Cleo'], ...options });
  await soundLog(page); await recordAnimations(page);
  await ok(page, 'start'); await expect(page.locator('.kg-piles')).toBeVisible();
  return { ...table, pages: [page, ...table.others] };
};
// Wer am Zug ist, legt die erste spielbare Karte oder zieht. Liefert Seite und Art des Zugs.
async function turn(pages) {
  let p = null, over = false; await expect.poll(async () => { over = await pages[0].evaluate(() => lastState.phase !== 'playing'); for (const c of pages) if (await c.evaluate(() => lastState.phase === 'playing' && lastState.turnId === lastState.you.id)) p = c; return over || !!p; }).toBe(true);
  if (over) return { p: null, kind: 'over' };
  const g = await p.evaluate(() => lastState.g);
  if (g.playable.length && !g.pending) { const card = g.playable[0]; const r = await send(p, 'play', { card, wish: card[0] === 'J' ? 'h' : null, call: g.hand.length === 2, target: null }); if (r.ok) return { p, kind: 'play' }; }
  if (g.drawn) { await send(p, 'pass'); return { p, kind: 'pass' }; }
  const r = await send(p, 'draw'); return { p, kind: r.ok ? 'draw' : 'none' };
}
// Darstellung auf dem bestätigten Tisch: eine erfundene, öffentliche Änderung zeigen (nur Anzeige).
const scene = (page, kind) => page.evaluate((kind) => {
  const prev = JSON.parse(JSON.stringify(lastState)), view = JSON.parse(JSON.stringify(lastState)), actor = view.players.find((p) => p.id === view.turnId);
  const ids = view.players.filter((p) => p.inRound).map((p) => p.id), i = ids.indexOf(view.turnId), at = (k) => ids[(((i + view.dir * k) % ids.length) + ids.length) % ids.length];
  if (kind === 'seven') { actor.cards -= 1; view.g.top = '7h'; view.g.pending = 2; view.turnId = at(1); }
  if (kind === 'seven2') { prev.g.pending = 2; prev.g.top = '7h'; actor.cards -= 1; view.g.top = '7s'; view.g.pending = 4; view.turnId = at(1); }
  if (kind === 'eight') { actor.cards -= 1; view.g.top = '8h'; view.turnId = at(2); }
  if (kind === 'mau') { actor.cards = 1; actor.last = true; prev.players.find((p) => p.id === actor.id).cards = 2; view.g.top = '9h'; view.turnId = at(1); }
  if (kind === 'maumau') { actor.cards = 0; view.g.top = 'Kh'; view.phase = 'over'; view.result = { winners: [actor.id], points: {} }; }
  return __experiences.maumau.present(prev, view);
}, kind);

test('EXP-003: Küchentisch, Kartenschnippen, Ziehen mit Fächer, 7er-Kette, Einschlafen, Mau – nur transform/opacity, Bewegungsbudget', async ({ page, app, browser }, info) => {
  test.setTimeout(150000);
  const { pages, close } = await start(page, app, browser);
  try {
    await expect(page.locator('#kg')).toHaveAttribute('data-xp-kit', 'maumau');
    await expectSound(page, { event: 'deal', palette: 'maumau', game: 'maumau' });
    await expect(page.locator('.xp-mm-cup svg')).toBeVisible();
    const seen = new Set(); let drew = false;
    for (let i = 0; i < 40 && !(seen.has('play') && drew) && !seen.has('over'); i++) { const move = await turn(pages); seen.add(move.kind); if (move.kind === 'draw' && move.p === page) drew = true; }
    expect(seen.has('play')).toBe(true); await expectSound(page, 'card');
    if (drew) await expectSound(page, 'draw');
    if (seen.has('over')) { await ok(page, 'start'); await expect.poll(() => page.evaluate(() => lastState.phase)).toBe('playing'); }
    await soundLog(page); await recordAnimations(page);
    expect(await scene(page, 'seven')).toBe(true);
    await expectSound(page, 'seven'); await expect(page.locator('.xp-mm-count')).toContainText('+2');
    expect(await scene(page, 'seven2')).toBe(true);
    await expect(page.locator('.xp-mm-count.is-stacked')).toContainText('+4'); await expect(page.locator('.xp-mm-count')).toHaveCount(1);
    await page.waitForTimeout(250); await evidence(page, info, 'EXP-003', 'siebenerkette');
    expect(await scene(page, 'eight')).toBe(true);
    await expectSound(page, 'sleep'); await expect(page.locator('[data-xp="schlaf"]')).toHaveCount(1); await expect(page.locator('.xp-mm-sleep')).toContainText('z z z');
    expect(await scene(page, 'mau')).toBe(true);
    await expectSound(page, 'mau');
    await expect.poll(async () => (await animations(page)).some((a) => /xp-mm-cup/.test(a.target))).toBe(true);
    expectOnlyTransformOpacity(await animations(page));
    expect(await sounds(page)).not.toContain('beep');
    await expectNoLeak(page, { requireSecrets: false });
    await close(); // Messung ohne weitere Browser
    await scene(page, 'mau');
    await fpsEvidence(info, 'EXP-003', await smoothReplay(page, 'maumau', { gap: 900 }));
  } finally { await close(); }
});

test('EXP-003: „Mau-Mau!“ – Doppelklirr, Tasse hüpft, Herz-Stempel', async ({ page, app, browser }, info) => {
  const { close } = await start(page, app, browser);
  try {
    await soundLog(page); await recordAnimations(page);
    expect(await scene(page, 'maumau')).toBe(true);
    await expectSound(page, 'maumau'); await expectSound(page, 'highlight');
    await expect(page.locator('#kg')).toHaveAttribute('data-xp', 'maumau');
    await expect(page.locator('.xp-mm-stamp')).toContainText('♥ Mau-Mau!');
    await expect.poll(async () => (await animations(page)).filter((a) => /xp-mm-(cup|drop)/.test(a.target)).length).toBe(2);
    expectOnlyTransformOpacity(await animations(page));
    await page.waitForTimeout(150); await evidence(page, info, 'EXP-003', 'maumau');
    await ok(page, 'gamePause', { paused: true });
    await expect(page.locator('.xp-plaque')).toHaveCount(0);
    await ok(page, 'gamePause', { paused: false });
  } finally { await close(); }
});

test('EXP-003: „Animationen reduzieren“, Neuladen und Zuschauen ohne Rückstau; fremde Karten bleiben Kartenrücken', async ({ page, app, browser }) => {
  test.setTimeout(120000);
  const { pages, close } = await start(page, app, browser, { reduced: true });
  try {
    await recordAnimations(page);
    for (let i = 0; i < 4; i++) await turn(pages);
    expect(await scene(page, 'seven2')).toBe(true); expect(await scene(page, 'maumau')).toBe(true);
    await expect(page.locator('.xp-mm-stamp')).toHaveCount(1);
    for (const a of await animations(page)) expect(a.duration, JSON.stringify(a)).toBeLessThanOrEqual(150);
    await page.reload(); await expect(page.locator('.kg-piles')).toBeVisible();
    await soundLog(page); await recordAnimations(page); await page.waitForTimeout(400);
    expect((await sounds(page)).filter((e) => e !== 'turn')).toEqual([]); expect(await animations(page)).toEqual([]);
    await expect(page.locator('.xp-mm-cup')).toBeVisible();
    const { watcher, close: leave } = await watch(page, app, browser);
    try { await expect(watcher.locator('.kg-piles')).toBeVisible(); await expect(watcher.locator('.xp-plaque')).toHaveCount(0); expect(await watcher.evaluate(() => lastState.g.hand)).toBeNull(); } finally { await leave(); }
  } finally { await close(); }
});
