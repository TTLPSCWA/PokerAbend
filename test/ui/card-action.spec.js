// CARD-ACTION-01/02: Skip-Bo im Browser mit zwei Fenstern desselben Kontos.
// Die Plattform hält je Konto genau eine aktive Verbindung: Ein neues Fenster löst das alte ab („replaced“).
// Kehrt das alte Fenster zurück und sendet noch eine Aktion aus seinem alten Stand, lehnt der Server sie ab,
// statt eine andere Karte zu spielen. Das abgelöste Fenster erzeugt dabei keine JavaScript-Fehler mehr.
import { test, expect, openTable, configure } from './card-ux-helpers.js';

const hand = (p) => p.evaluate(() => JSON.stringify([lastState.g.hand, lastState.g.handIds]));
const ready = (p) => expect.poll(() => p.evaluate(() => lastState?.phase === 'playing' && Array.isArray(lastState?.g?.hand))).toBe(true);

test('CARD-ACTION-01 Skip-Bo: zweites Fenster desselben Kontos – alte Aktion spielt nicht die falsche Karte', async ({ page, browser, app }, info) => {
  test.setTimeout(80000);
  const room = await openTable(page, browser, app, info, 'stapelrennen');
  const errors = [];
  try {
    // Hand 1, 2, 8, Joker, 12 – Baureihen erwarten 1, 2, 8, 12
    await configure(page, app, room.code, {});
    const stale = await page.evaluate(() => structuredClone(lastState));
    expect(new Set(stale.g.handIds).size).toBe(stale.g.hand.length);
    // Zweites Fenster desselben Kontos übernimmt; das erste zeigt den Hinweis und bleibt fehlerfrei
    const second = await page.context().newPage();
    second.on('pageerror', (e) => errors.push(e.message));
    await second.goto(app.url);
    await second.evaluate((code) => joinAndEnter(code), room.code);
    await ready(second);
    await expect(page.getByText('Du spielst gerade in einem anderen Tab weiter')).toBeVisible();
    await page.waitForTimeout(2500); // der Verbindungswächter läuft im Sekundentakt
    // Fenster 2 legt die 1 auf Reihe 0 – danach liegt die 2 auf Index 0 und Reihe 1 erwartet eine 2
    const before = await hand(second);
    await second.locator('.kg-hand [data-i="0"]').click();
    await second.locator('.st-build[data-i="0"]').click();
    await expect.poll(() => hand(second)).not.toBe(before);
    const after = await hand(second);
    // Fenster 1 kehrt zurück (Neuladen übernimmt wieder) und sendet die Aktion aus seinem alten Stand:
    // Index 0 auf Reihe 1 – ohne Prüfung würde jetzt die 2 statt der gemeinten 1 gespielt.
    await page.reload();
    await ready(page);
    const reply = await page.evaluate((S) => send('play', { rev: S.g.revision, round: S.roundNo, from: { kind: 'hand', index: 0, card: S.g.handIds[0], value: S.g.hand[0] }, to: 1, need: S.g.build[1].next }), stale);
    expect(reply.ok).toBe(false);
    expect(reply.error).toMatch(/nicht mehr aktuell|outdated/);
    expect(await hand(page)).toBe(after);
    expect(await page.evaluate(() => lastState.g.build[1].next)).toBe(2);
    // Mit dem aktuellen Stand handelt Fenster 1 normal über die Oberfläche
    await page.locator('.kg-hand [data-i="0"]').click();
    await page.locator('.st-build[data-i="1"]').click();
    await expect.poll(() => page.evaluate(() => lastState.g.build[1].next)).toBe(3);
    await expect(second.getByText('Du spielst gerade in einem anderen Tab weiter')).toBeVisible();
    await second.close();
    expect(errors).toEqual([]);
  } finally { await room.close(); }
});

// CARD-ACTION-02: Ein Doppelklick auf „Karte“ zieht genau eine Karte (Browser ignoriert den zweiten Klick,
// der Server lehnt eine Aktion mit veralteter Kartenzahl ab).
test('CARD-ACTION-02 Blackjack: Doppelklick auf „Karte“ zieht genau eine Karte', async ({ page, app }) => {
  test.setTimeout(60000);
  const { login, selectGame } = await import('./helpers.js');
  await login(page, app, 'Anna');
  await selectGame(page, 'blackjack');
  await page.locator('#host-form button[type=submit]').click();
  await expect(page.locator('#kg')).toBeVisible();
  const emit = async (event, data = {}) => { const r = await page.evaluate(({ event, data }) => send(event, data), { event, data }); expect(r.ok, `${event}: ${r.error}`).toBe(true); };
  await emit('sit'); await emit('settings', { turnTime: 0 }); await emit('start');
  let cards = 0;
  for (let round = 0; round < 6 && !cards; round++) {
    if (round) { await emit('start'); }
    await expect.poll(() => page.evaluate(() => lastState.phase)).toBe('playing');
    await page.locator('[data-g=bet]').click();
    await expect.poll(() => page.evaluate(() => lastState.g.step)).not.toBe('bet');
    if (await page.locator('[data-g=hit]').count()) cards = await page.evaluate(() => lastState.g.hands[lastState.you.id][lastState.g.handIdx].cards.length);
    else await expect.poll(() => page.evaluate(() => lastState.phase)).toBe('over'); // Blackjack oder Dealer-Blackjack: nächste Runde
  }
  expect(cards, 'kein Zug mit „Karte“ zustande gekommen').toBe(2);
  const sent = await page.evaluate(() => { window.bjEmits = []; const original = socket.emit; socket.emit = function (event, data, ...rest) { if (event === 'hit') window.bjEmits.push(data); return original.call(this, event, data, ...rest); }; return true; });
  expect(sent).toBe(true);
  await page.locator('[data-g=hit]').dblclick();
  await expect.poll(() => page.evaluate(() => lastState.g.hands[lastState.you.id][0].cards.length)).toBe(3);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => lastState.g.hands[lastState.you.id][0].cards.length)).toBe(3);
  expect(await page.evaluate(() => window.bjEmits.length)).toBe(1);
  expect(await page.evaluate(() => window.bjEmits[0])).toEqual({ hand: 0, cards: 2 });
});
