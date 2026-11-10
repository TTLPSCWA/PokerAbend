// EXP-002 Texas Hold'em: Chips, Check, Fold, All-in, Karten vom Dealer-Button, gestaffeltes Board, All-in-Showdown.
import { test, expect, login, selectGame, expectSound, expectNoLeak, observeServerView } from './helpers.js';
import { soundLog, sounds, evidence, recordAnimations, animations, expectOnlyTransformOpacity, smoothReplay, fpsEvidence, calm } from './exp-helpers.js';

// Zwei Menschen am Tisch (Heads-up); liefert beide Seiten.
async function table(page, app, browser, info, { reduced = false, game = 'poker' } = {}) {
  observeServerView(page); // expectNoLeak vergleicht mit der zuletzt vom Server gesendeten Sicht
  await login(page, app); if (reduced) await calm(page); await selectGame(page, game);
  await page.locator('#host-form button[type=submit]').click(); await page.locator('[data-sit]').first().click();
  const code = await page.evaluate(() => lastState.code), context = await browser.newContext({ ...info.project.use, viewport: page.viewportSize() }), other = await context.newPage();
  await login(other, app, 'Ben'); await other.evaluate((code) => joinAndEnter(code, 'watch'), code); await other.locator('[data-sit]').first().click();
  await expect.poll(() => page.evaluate(() => lastState.seats.filter(Boolean).length)).toBe(2);
  return { other, pages: [page, other], close: () => context.close() };
}
const begin = async (page) => { expect((await page.evaluate(() => send('settings', { autoNext: false }))).ok).toBe(true); expect((await page.evaluate(() => send('start'))).ok).toBe(true); await expect.poll(() => page.evaluate(() => !!lastState.hand && !lastState.hand.done)).toBe(true); };
// Wer am Zug ist, handelt. `pick(legal)` liefert die Aktion.
async function act(pages, pick) {
  let p = null; await expect.poll(async () => { for (const c of pages) if (await c.evaluate(() => !!lastState.legal && lastState.hand?.toAct === lastState.you.seat)) p = c; return !!p; }).toBe(true);
  const legal = await p.evaluate(() => lastState.legal), action = pick(legal);
  const reply = await p.evaluate((action) => send('action', { ...action, id: 'xp' + Math.random().toString(36).slice(2) }), action);
  expect(reply.ok, JSON.stringify(reply)).toBe(true);
  return p;
}
const passive = (L) => ({ type: L.canCheck ? 'check' : 'call' });

test('EXP-002: Mischen und Austeilen vom Dealer-Button, Chips, Check, All-in-Showdown mit Messing-Leuchten, Bewegungsbudget', async ({ page, app, browser }, info) => {
  test.setTimeout(120000);
  const { pages, close } = await table(page, app, browser, info);
  try {
    await soundLog(page); await recordAnimations(page);
    await begin(page);
    await expect(page.locator('#game')).toHaveAttribute('data-xp-poker', '');
    await expectSound(page, { event: 'shuffle', palette: 'poker', game: 'poker' });
    await expectSound(page, 'deal'); await expectSound(page, 'chips'); // Blinds
    await expect.poll(async () => (await animations(page)).filter((a) => /card/.test(a.target)).length).toBeGreaterThanOrEqual(2);
    const dealt = await animations(page);
    expect(dealt.some((a) => a.delay > 240)).toBe(true); // reihum, nicht alle gleichzeitig
    expectOnlyTransformOpacity(dealt);
    // Small Blind callt, Big Blind checkt: Flop.
    await soundLog(page);
    await act(pages, () => ({ type: 'call' })); await expectSound(page, 'chips');
    await act(pages, () => ({ type: 'check' })); await expectSound(page, 'check');
    await expect(page.locator('#board .card')).toHaveCount(3);
    await expectSound(page, 'card'); await expectSound(page, 'collect');
    expect(await page.locator('#board .card').nth(2).evaluate((el) => el.style.animationDelay)).toBe('280ms'); // Flop dreht sich einzeln um
    // All-in und Call: Das Board läuft langsam aus, Showdown.
    await soundLog(page); await recordAnimations(page);
    await act(pages, (L) => ({ type: 'raise', amount: L.maxTo })); await expectSound(page, 'allin');
    await act(pages, () => ({ type: 'call' }));
    await expect(page.locator('#game')).toHaveAttribute('data-xp', 'showdown');
    await expect(page.locator('.xp-pk-dim')).toBeAttached();
    await expect(page.locator('#board .card.xp-slow')).toHaveCount(2);
    await expect(page.locator('.card.win').first()).toBeVisible();
    await expectSound(page, 'highlight', { timeout: 5000 });
    expectOnlyTransformOpacity(await animations(page));
    expect(await sounds(page)).not.toContain('beep');
    await page.waitForTimeout(900); await evidence(page, info, 'EXP-002', 'showdown');
    await expect(page.locator('#game')).not.toHaveAttribute('data-xp', 'showdown', { timeout: 5000 }); // das Licht kommt von selbst zurück
    await expectNoLeak(page, { requireSecrets: false });
    // Messung am stehenden Showdown (die nächste Hand startet in diesem Test nicht von selbst).
    await recordAnimations(page); expect(await page.evaluate(() => __experiences.poker.replay())).toBe(true);
    await expect.poll(async () => (await animations(page)).length).toBeGreaterThan(0);
    await fpsEvidence(info, 'EXP-002', await smoothReplay(page, 'poker', { gap: 1500 }));
  } finally { await close(); }
});

test('EXP-002: „Animationen reduzieren“, Fold, Neuladen ohne Rückstau; andere Poker-Varianten bleiben unverändert', async ({ page, app, browser }, info) => {
  test.setTimeout(120000);
  const { pages, other, close } = await table(page, app, browser, info, { reduced: true });
  try {
    await recordAnimations(page); await soundLog(page);
    await begin(page);
    await expectSound(page, 'shuffle');
    await page.waitForTimeout(500);
    for (const a of await animations(page)) expect(a.duration, JSON.stringify(a)).toBeLessThanOrEqual(150);
    // Der Gegner sieht nie fremde Karten: nur Kartenrücken am anderen Platz.
    expect(await other.evaluate(() => lastState.seats.filter((s) => s && s.id !== lastState.you.id).every((s) => !s.cards || s.cards.every((c) => c === '??')))).toBe(true);
    await soundLog(page);
    await act(pages, () => ({ type: 'fold' }));
    await expectSound(page, 'fold'); await expectSound(page, 'collect');
    await expect(page.locator('#game')).not.toHaveAttribute('data-xp', 'showdown');
    await page.reload(); await expect(page.locator('#dock')).toBeVisible(); await expect.poll(() => page.evaluate(() => typeof lastState !== 'undefined' && !!lastState?.hand)).toBe(true);
    const hand = await page.evaluate(() => lastState.hand.no);
    await soundLog(page); await recordAnimations(page); await page.waitForTimeout(500);
    // Solange keine neue Hand begonnen hat, bleibt es nach dem Neuladen still.
    if (await page.evaluate(() => lastState.hand.no) === hand) { expect((await sounds(page)).filter((e) => e !== 'turn')).toEqual([]); expect(await animations(page)).toEqual([]); }
  } finally { await close(); }
  // Omaha nutzt dieselbe Oberfläche, bekommt aber kein Hold'em-Erlebnis.
  const omaha = await browser.newContext({ ...info.project.use, viewport: page.viewportSize() }), tab = await omaha.newPage();
  try {
    await login(tab, app, 'Dora'); await selectGame(tab, 'omaha'); await tab.locator('#host-form button[type=submit]').click();
    await expect(tab.locator('[data-sit]').first()).toBeVisible();
    await expect(tab.locator('#game')).not.toHaveAttribute('data-xp-poker', '');
  } finally { await omaha.close(); }
});
