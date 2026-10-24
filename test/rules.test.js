// Regeln und Spielablauf: steigende Blinds, neues Spiel, Chancen-Modus, Chips verschenken.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room } from '../games/poker/room.js';
import { blindLevels, levelIndex, untilNext, parseBlindList, nice, BLIND_PRESETS } from '../games/poker/blinds.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function room(names = ['Anna', 'Ben', 'Carla'], settings = {}) {
  const r = new Room('TESTX', { autoNext: false, turnTime: 0, ...settings }, () => {});
  const ids = names.map((n, i) => { const p = r.addPlayer(n, null); p.connected = true; r.sit(p.id, i); return p.id; });
  return { r, ids, host: ids[0] };
}
const turn = (r) => r.playerAt(r.table.hand.toAct);
function finishHand(r) { while (r.handRunning) r.act(turn(r).id, { type: 'fold' }); }
const stop = (r) => { clearTimeout(r.turnTimer); clearTimeout(r.nextTimer); clearTimeout(r.nudgeTimer); for (const g of r.gifts.values()) clearTimeout(g.timer); };
const total = (r) => [...r.players.values()].reduce((a, p) => a + r.chipsOf(p), 0);

// ---------- Steigende Blinds: Rechnung ----------
test('Blind-Level: Vorlagen starten bei den eingestellten Blinds und steigen glatt', () => {
  for (const preset of Object.keys(BLIND_PRESETS)) {
    const lv = blindLevels({ smallBlind: 50, bigBlind: 100, blindPreset: preset });
    assert.deepEqual(lv[0], { sb: 50, bb: 100 });
    for (let i = 1; i < lv.length; i++) {
      assert.ok(lv[i].bb > lv[i - 1].bb, `${preset}: Level ${i + 1} steigt`);
      assert.ok(lv[i].sb <= lv[i].bb && lv[i].sb >= 1);
    }
  }
  assert.deepEqual(blindLevels({ smallBlind: 50, bigBlind: 100, blindPreset: 'normal' }).slice(0, 4).map((l) => l.bb), [100, 150, 200, 300]);
  assert.equal(nice(1234), 1200);
  assert.equal(nice(7), 7);
});

test('Blind-Level: eigene Liste', () => {
  assert.deepEqual(parseBlindList('25/50\n50 100\nquatsch\n100-200\n300/200\n'), [{ sb: 25, bb: 50 }, { sb: 50, bb: 100 }, { sb: 100, bb: 200 }]);
  const lv = blindLevels({ smallBlind: 50, bigBlind: 100, blindPreset: 'custom', blindList: ['10/20', '20/40', '15/30'] });
  assert.deepEqual(lv, [{ sb: 10, bb: 20 }, { sb: 20, bb: 40 }], 'Level werden nie kleiner');
  // Leere eigene Liste: Vorlage „Normal“
  assert.equal(blindLevels({ smallBlind: 50, bigBlind: 100, blindPreset: 'custom', blindList: [] })[1].bb, 150);
});

test('Blind-Level: welches Level gilt und wie lange noch', () => {
  const base = { every: 10, count: 5 };
  assert.equal(levelIndex({ ...base, mode: 'off', elapsedMs: 1e9 }), 0);
  assert.equal(levelIndex({ ...base, mode: 'minutes', elapsedMs: 9.99 * 60000 }), 0);
  assert.equal(levelIndex({ ...base, mode: 'minutes', elapsedMs: 10 * 60000 }), 1);
  assert.equal(levelIndex({ ...base, mode: 'minutes', elapsedMs: 999 * 60000 }), 4, 'höchstens das letzte Level');
  assert.equal(levelIndex({ ...base, mode: 'hands', hands: 25 }), 2);
  assert.deepEqual(untilNext({ ...base, mode: 'minutes', elapsedMs: 15 * 60000 + 28000 }), { index: 2, msLeft: 4 * 60000 + 32000 });
  assert.deepEqual(untilNext({ ...base, mode: 'hands', hands: 23 }), { index: 3, handsLeft: 7 });
  assert.equal(untilNext({ ...base, mode: 'hands', hands: 400 }), null);
  assert.equal(untilNext({ ...base, mode: 'off' }), null);
});

// ---------- Steigende Blinds am Tisch ----------
test('Blinds alle 2 Hände: Erhöhung greift erst mit der nächsten Hand, Eintrag im Verlauf', () => {
  const { r, host } = room();
  r.updateSettings(host, { blindMode: 'hands', blindEvery: 2, blindPreset: 'normal' });
  r.start(host);
  assert.equal(r.table.hand.players[r.table.hand.bb].bet, 100);
  finishHand(r); r.nextHand(host);
  finishHand(r);
  // Zwei Hände gespielt: Level 2 ist fällig, die laufende Ansicht zeigt es als „nächste Hand“
  assert.deepEqual(r.view(host).blinds.pending, { sb: 75, bb: 150 });
  assert.equal(r.view(host).blinds.bb, 100, 'noch die alten Blinds');
  r.nextHand(host);
  assert.equal(r.table.bigBlind, 150);
  assert.equal(r.table.hand.players[r.table.hand.bb].bet, 150);
  assert.ok(r.log.some((l) => l.text === 'Blinds steigen: Level 2 – 75/150'));
  const v = r.view(host).blinds;
  assert.equal(v.level, 2);
  assert.deepEqual([v.next.bb, v.next.handsLeft], [200, 2]);
  stop(r);
});

test('Blinds nach Minuten: Uhr läuft nur im Spiel, nicht bei „Sofort anhalten“', async () => {
  const { r, host } = room();
  r.updateSettings(host, { blindMode: 'minutes', blindEvery: 1 });
  await wait(30);
  assert.equal(r.blindInfo().args.elapsedMs, 0, 'vor dem Start steht die Uhr');
  r.start(host);
  await wait(60);
  const a = r.blindInfo().args.elapsedMs;
  assert.ok(a >= 50, 'läuft: ' + a);
  r.toggleFreeze(host);
  const frozenAt = r.blindInfo().args.elapsedMs;
  await wait(60);
  assert.ok(r.blindInfo().args.elapsedMs - frozenAt < 5, 'angehalten');
  assert.equal(r.view(host).blinds.running, false);
  r.toggleFreeze(host);
  // Eine Minute „vorspulen“: fällig zur nächsten Hand, nicht sofort
  r.blind.elapsed += 60000;
  assert.equal(r.table.bigBlind, 100);
  finishHand(r); r.nextHand(host);
  assert.equal(r.table.bigBlind, 150);
  stop(r);
});

test('Blind-Modus ändern setzt die Uhr zurück, Stand übersteht Speichern', () => {
  const { r, host } = room();
  r.updateSettings(host, { blindMode: 'hands', blindEvery: 1 });
  r.start(host); finishHand(r); r.nextHand(host); finishHand(r); r.nextHand(host);
  assert.equal(r.blind.level, 2);
  const copy = Room.restore(JSON.parse(JSON.stringify(r.snapshot())), () => {});
  assert.equal(copy.blind.level, 2);
  assert.equal(copy.table.bigBlind, r.table.bigBlind);
  finishHand(r);
  r.updateSettings(host, { blindMode: 'minutes' });
  assert.equal(r.blind.level, 0);
  assert.equal(r.table.bigBlind, 100);
  stop(r);
});

// ---------- Neues Spiel ----------
test('Neues Spiel: Startchips, Level 1, Nachkäufe 0, Plätze bleiben, Abendstand im Verlauf', () => {
  const { r, ids, host } = room(['Anna', 'Ben', 'Carla'], { startStack: 1000 });
  r.updateSettings(host, { blindMode: 'hands', blindEvery: 1 });
  r.start(host);
  finishHand(r);
  const ben = r.players.get(ids[1]);
  r.adjustStack(host, ben.id, 0);
  r.rebuy(ben.id);
  r.nextHand(host);
  assert.throws(() => r.newGame(host), /zwischen zwei Händen/);
  finishHand(r);
  assert.throws(() => r.newGame(ids[1]), /Nur der Host/);
  r.newGame(host);
  for (const p of r.players.values()) {
    assert.equal(r.chipsOf(p), 1000);
    assert.equal(p.rebuys, 0);
    assert.equal(p.buyIn, 1000);
  }
  assert.deepEqual([...r.players.values()].map((p) => p.seat), [0, 1, 2], 'Plätze bleiben');
  assert.equal(r.blind.level, 0);
  assert.equal(r.table.bigBlind, 100);
  assert.equal(r.stats.hands, 0);
  assert.equal(r.started, false);
  assert.equal(r.table.hand, null);
  const summary = r.log.find((l) => l.kind === 'summary');
  assert.match(summary.text, /^Abendstand vor dem neuen Spiel nach 2 Händen: /);
  assert.match(summary.text, /Ben .*1× nachgekauft/);
  stop(r);
});

// ---------- Chancen-Modus ----------
test('Chancen: aus / nur eigene / nach der Hand – nie fremde Karten', () => {
  const { r, ids, host } = room(['Anna', 'Ben']);
  r.start(host);
  const me = ids[1];
  const mine = r.table.hand.players[r.players.get(me).seat].cards;
  assert.ok(r.view(me).odds, 'Standard: eigene Chancen');
  r.updateSettings(host, { oddsMode: 'off' });
  assert.equal(r.view(me).odds, null);
  r.updateSettings(host, { oddsMode: 'after' });
  assert.equal(r.view(me).odds, null, 'während der Hand nichts');
  assert.equal(r.view(me).hand.afterOdds, null);
  // Bis zum Showdown durchchecken
  while (r.handRunning) { const L = r.table.legal(r.table.hand.toAct); r.act(turn(r).id, { type: L.canCheck ? 'check' : 'call' }); }
  const h = r.table.hand;
  assert.equal(h.result.showdown, true);
  const rows = r.view(me).hand.afterOdds;
  assert.deepEqual(rows.map((x) => x.street), ['preflop', 'flop', 'turn']);
  assert.deepEqual(Object.keys(rows[0].odds).map(Number).sort(), [...h.shown].sort(), 'nur gezeigte Hände');
  for (const row of rows) assert.ok(Math.abs(Object.values(row.odds).reduce((a, b) => a + b, 0) - 100) < 0.5);
  assert.ok(r.log.some((l) => l.text.startsWith('Chancen – Pre-Flop: ')));
  assert.ok(mine.length === 2);
  stop(r);
});

test('Chancen nach der Hand: wer gefoldet hat, taucht nicht auf', () => {
  const { r, host } = room();
  r.updateSettings(host, { oddsMode: 'after' });
  r.start(host);
  const folder = turn(r);
  r.act(folder.id, { type: 'fold' });
  while (r.handRunning) { const L = r.table.legal(r.table.hand.toAct); r.act(turn(r).id, { type: L.canCheck ? 'check' : 'call' }); }
  const rows = r.view(host).hand.afterOdds;
  assert.ok(!(folder.seat in rows[0].odds));
  assert.equal(Object.keys(rows[0].odds).length, 2);
  stop(r);
});

// ---------- Chips verschenken ----------
test('Geschenk annehmen: Chips wandern, Summe bleibt, Abendstand ändert sich nicht', () => {
  const { r, ids } = room();
  const [a, b] = ids.map((id) => r.players.get(id));
  const before = total(r);
  const netBefore = r.standingsList().map((p) => [p.name, p.net]);
  const g = r.offerGift(a.id, b.id, 1500, 'Für die nächste Runde 🍀');
  assert.deepEqual(r.view(b.id).you.giftsIn.map((x) => [x.from, x.amount, x.message]), [['Anna', 1500, 'Für die nächste Runde 🍀']]);
  assert.equal(r.view(a.id).you.giftOut.to, 'Ben');
  assert.equal(r.view(ids[2]).you.giftsIn.length, 0, 'Dritte sehen nichts');
  assert.throws(() => r.answerGift(ids[2], g.id, true), /gibt es nicht/, 'nur der Empfänger');
  r.answerGift(b.id, g.id, true);
  assert.equal(r.chipsOf(a), 8500);
  assert.equal(r.chipsOf(b), 11500);
  assert.equal(total(r), before);
  assert.deepEqual(r.standingsList().map((p) => [p.name, p.net]).sort(), netBefore.sort());
  assert.ok(r.log.some((l) => l.text === 'Anna schenkt Ben 1.500 Chips: „Für die nächste Runde 🍀“'));
  assert.throws(() => r.answerGift(b.id, g.id, true), /gibt es nicht/, 'nur einmal');
  stop(r);
});

test('Geschenk ablehnen, ablaufen lassen, zu wenig Chips, während der Hand, abgeschaltet', async () => {
  const { r, ids, host } = room();
  const [a, b, c] = ids.map((id) => r.players.get(id));
  const before = total(r);
  // Ablehnen
  const g1 = r.offerGift(a.id, b.id, 100);
  assert.throws(() => r.offerGift(a.id, c.id, 100), /schon ein offenes Angebot/);
  r.answerGift(b.id, g1.id, false);
  assert.ok(r.log.some((l) => l.text === 'Ben lehnt das Geschenk von Anna ab'));
  // Ablaufen
  r.giftTtl = 30;
  const g2 = r.offerGift(a.id, b.id, 100);
  await wait(60);
  assert.throws(() => r.answerGift(b.id, g2.id, true), /gibt es nicht mehr/);
  assert.ok(r.log.some((l) => l.text === 'Das Geschenk von Anna an Ben ist abgelaufen'));
  r.giftTtl = 60000;
  // Zu wenig Chips – beim Angebot und wenn sie in der Zwischenzeit weg sind
  assert.throws(() => r.offerGift(a.id, b.id, 10001), /So viele Chips/);
  assert.throws(() => r.offerGift(a.id, b.id, 0), /über 0/);
  assert.throws(() => r.offerGift(a.id, a.id, 10), /gibt es nicht/);
  const g3 = r.offerGift(a.id, b.id, 5000);
  r.adjustStack(host, a.id, 1000);
  assert.throws(() => r.answerGift(b.id, g3.id, true), /nicht mehr genug Chips/);
  r.adjustStack(host, a.id, 10000);
  // Während der Hand
  r.start(host);
  assert.throws(() => r.offerGift(a.id, b.id, 100), /zwischen zwei Händen/);
  finishHand(r);
  const g4 = r.offerGift(b.id, c.id, 100);
  r.nextHand(host);
  assert.throws(() => r.answerGift(c.id, g4.id, true), /wenn die Hand vorbei ist/);
  finishHand(r);
  r.answerGift(c.id, g4.id, true);
  // Host schaltet ab
  r.updateSettings(host, { gifts: false });
  assert.throws(() => r.offerGift(a.id, b.id, 100), /aus/);
  assert.equal(total(r), before, 'Chipsumme bleibt gleich');
  stop(r);
});
