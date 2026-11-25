// CARD-ACTION-01: Skip-Bo-Aktionen tragen Kartenkennung, erwarteten Wert, Revision, Runde und Ziel.
// Veraltete oder widersprüchliche Aktionen – aus einem zweiten Fenster, von einem zweiten Gerät, doppelt oder
// nach einem Zug- oder Rundenwechsel – werden abgelehnt, ohne die Nutzlast irgendeines Empfängers zu ändern.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GAMES } from '../games/index.js';
import { JOKER } from '../games/stapelrennen/room.js';

const ev = GAMES.stapelrennen.events;
function table(t, players = 2) {
  const r = GAMES.stapelrennen.create('ACTION', { stockSize: 5 }, () => {});
  t.after(() => r.dispose?.());
  const ids = ['Anna', 'Ben', 'Cem'].slice(0, players).map((name) => { const p = r.addPlayer(name, null); r.sit(p.id); return p.id; });
  const watcher = r.addPlayer('Zoe', null).id;
  r.start(ids[0]);
  return { r, ids, watcher, a: ids[0], b: ids[1] };
}
// Die Ansicht, die ein Browserfenster gerade anzeigt (wie per Socket empfangen).
const screen = (r, id) => structuredClone(r.view(id));
const payload = (r, id) => { const v = r.view(id); delete v.deadline; delete v.now; return JSON.stringify(v); };
const everyone = (r, ids, watcher) => [...ids, watcher].map((id) => payload(r, id));
function rejectsUnchanged(r, ids, watcher, action, message = /nicht mehr aktuell/) {
  const before = everyone(r, ids, watcher);
  assert.throws(action, message);
  assert.deepEqual(everyone(r, ids, watcher), before, 'abgelehnte Aktion darf nichts verändern');
}
// Aktion so, wie der Browser sie aus seiner angezeigten Ansicht baut.
const fromHand = (S, index) => ({ kind: 'hand', index, card: S.g.handIds[index], value: S.g.hand[index] });
const play = (r, id, S, from, to) => ev.play(r, r.players.get(id), { rev: S.g.revision, round: S.roundNo, from, to, need: S.g.build[to].next });
const discard = (r, id, S, index, pile) => ev.discard(r, r.players.get(id), { rev: S.g.revision, round: S.roundNo, index, card: S.g.handIds[index], value: S.g.hand[index], pile });

test('CARD-ACTION-01: Handkarten haben eindeutige Kennungen, auch bei gleichen Werten; nur der Besitzer sieht sie', (t) => {
  const { r, ids, watcher, a, b } = table(t);
  r.hand[a] = [5, 5, 5, 5, 5];
  const S = screen(r, a);
  assert.equal(new Set(S.g.handIds).size, 5);
  assert.ok(Number.isInteger(S.g.revision) && S.g.revision > 0);
  assert.equal(screen(r, watcher).g.handIds, null);
  const others = JSON.stringify(screen(r, b));
  for (const id of S.g.handIds) assert.ok(!others.includes(`"${id}"`), 'fremde Kartenkennung sichtbar');
  // Erneute Ansicht (Wiederverbindung) liefert dieselben Kennungen und dieselbe Revision.
  assert.deepEqual(screen(r, a).g.handIds, S.g.handIds); assert.equal(screen(r, a).g.revision, S.g.revision);
  assert.ok(ids.length === 2);
});

test('CARD-ACTION-01: identische Kartenwerte – die gemeinte Karte wird gespielt, eine vertauschte Kennung abgelehnt', (t) => {
  const { r, ids, watcher, a } = table(t);
  r.hand[a] = [1, 1, 7, 8, 9]; r.build = [[], [], [], []];
  const S = screen(r, a), [first, second] = S.g.handIds;
  // Index 0 mit der Kennung von Index 1: widersprüchlich
  rejectsUnchanged(r, ids, watcher, () => play(r, a, S, { kind: 'hand', index: 0, card: second, value: 1 }, 0));
  play(r, a, S, fromHand(S, 1), 0);
  assert.deepEqual(r.hand[a], [1, 7, 8, 9]);
  assert.equal(screen(r, a).g.handIds[0], first, 'die nicht gespielte Karte behält ihre Kennung');
});

test('CARD-ACTION-01: zwei Fenster bzw. zwei Geräte desselben Kontos – nur die erste Aktion gilt', (t) => {
  const { r, ids, watcher, a } = table(t);
  r.hand[a] = [1, 2, 3, 9, 9]; r.build = [[], [], [], []];
  const windowA = screen(r, a), windowB = screen(r, a); // beide zeigen denselben Stand
  play(r, a, windowA, fromHand(windowA, 0), 0); // Fenster A legt die 1
  // Fenster B will dieselbe 1 legen: Index 0 ist jetzt die 2 – abgelehnt, nicht die falsche Karte gespielt
  rejectsUnchanged(r, ids, watcher, () => play(r, a, windowB, fromHand(windowB, 0), 1));
  // Ein „zweites Gerät“ mit altem Stand will auf Reihe 0 eine 2 legen, die dort jetzt passen würde: trotzdem veraltet
  rejectsUnchanged(r, ids, watcher, () => play(r, a, windowB, fromHand(windowB, 1), 0));
  // Nach Aktualisierung klappt es
  const fresh = screen(r, a);
  play(r, a, fresh, fromHand(fresh, 0), 0);
  assert.deepEqual(r.build[0], [1, 2]);
});

test('CARD-ACTION-01: gleichzeitig abgesendete und wiederholte Aktionen – genau eine wird ausgeführt', (t) => {
  const { r, ids, watcher, a } = table(t);
  r.hand[a] = [1, 1, 4, 9, 9]; r.build = [[], [], [], []];
  const S = screen(r, a);
  const results = [() => play(r, a, S, fromHand(S, 0), 0), () => play(r, a, S, fromHand(S, 1), 1), () => play(r, a, S, fromHand(S, 0), 0)]
    .map((fn) => { try { fn(); return 'ok'; } catch (e) { return e.message; } });
  assert.equal(results.filter((x) => x === 'ok').length, 1, JSON.stringify(results));
  assert.deepEqual(r.build.map((b) => b.length), [1, 0, 0, 0]);
  // Doppelklick auf Abwerfen
  const T = screen(r, a), before = r.piles[a].map((p) => p.length);
  discard(r, a, T, 0, 0);
  assert.equal(r.currentId, ids[1]);
  rejectsUnchanged(r, ids, watcher, () => discard(r, a, T, 0, 0), /nicht dran|nicht mehr aktuell/);
  assert.deepEqual(r.piles[a].map((p) => p.length), [before[0] + 1, ...before.slice(1)]);
});

test('CARD-ACTION-01: veränderter Handindex, alte Revision, Zugwechsel und Ziel werden serverseitig geprüft', (t) => {
  const { r, ids, watcher, a, b } = table(t);
  r.hand[a] = [3, 1, 2, 9, 9]; r.build = [[], [], [], []];
  const old = screen(r, a);
  play(r, a, screen(r, a), fromHand(screen(r, a), 1), 0); // die 1 aus der Mitte: Indizes verschieben sich
  // Alte Ansicht: Index 2 war die 2, ist jetzt die 9
  rejectsUnchanged(r, ids, watcher, () => play(r, a, old, fromHand(old, 2), 0));
  // Aktuelle Revision, aber falscher erwarteter Wert
  const S = screen(r, a);
  rejectsUnchanged(r, ids, watcher, () => play(r, a, S, { ...fromHand(S, 0), value: 2 }, 0));
  // Ziel hat sich geändert: Baureihe erwartet nicht mehr die genannte Zahl
  rejectsUnchanged(r, ids, watcher, () => ev.play(r, r.players.get(a), { rev: S.g.revision, round: S.roundNo, from: fromHand(S, 1), to: 0, need: 1 }));
  rejectsUnchanged(r, ids, watcher, () => ev.play(r, r.players.get(a), { rev: S.g.revision, round: S.roundNo, from: fromHand(S, 1), to: 7 }), /Baureihe/);
  // Ohne Revision oder Runde
  rejectsUnchanged(r, ids, watcher, () => ev.play(r, r.players.get(a), { from: fromHand(S, 1), to: 0 }));
  rejectsUnchanged(r, ids, watcher, () => ev.play(r, r.players.get(a), { rev: S.g.revision, from: fromHand(S, 1), to: 0 }));
  // Zugwechsel während der Aktion: A wirft ab, eine verspätete Aktion von A und eine vorzeitige von B scheitern
  discard(r, a, S, 0, 0);
  rejectsUnchanged(r, ids, watcher, () => play(r, a, S, fromHand(S, 1), 0), /nicht dran/);
  const B = screen(r, b);
  assert.equal(r.currentId, b); assert.ok(B.g.revision > S.g.revision);
  // Stapel- und Ablagekarten: erwarteter Wert ist Pflicht
  rejectsUnchanged(r, ids, watcher, () => ev.play(r, r.players.get(b), { rev: B.g.revision, round: B.roundNo, from: { kind: 'stock' }, to: 1 }));
});

test('CARD-ACTION-01: veraltete Aktion nach Rundenwechsel und nach Wiederverbindung', (t) => {
  const { r, ids, watcher, a } = table(t);
  r.hand[a] = [1, 1, 1, 1, 1]; r.build = [[], [], [], []]; r.stock[a] = [JOKER];
  const S = screen(r, a);
  ev.play(r, r.players.get(a), { rev: S.g.revision, round: S.roundNo, from: { kind: 'stock', value: JOKER }, to: 0, need: 1 });
  assert.equal(r.phase, 'over');
  r.start(a); // nächste Runde
  assert.equal(r.roundNo, S.roundNo + 1);
  rejectsUnchanged(r, ids, watcher, () => play(r, a, S, fromHand(S, 0), 0), /nicht mehr aktuell|nicht dran/);
  // Eine Revision aus der alten Runde mit neuer Rundennummer passt ebenfalls nicht
  const N = screen(r, r.currentId);
  rejectsUnchanged(r, ids, watcher, () => ev.play(r, r.players.get(r.currentId), { rev: S.g.revision, round: N.roundNo, from: fromHand(N, 0), to: 0 }));
  // Wiederverbindung: frische Ansicht genügt, nichts muss neu verhandelt werden
  const again = screen(r, r.currentId);
  assert.deepEqual(again.g.handIds, N.g.handIds);
  const idx = again.g.hand.findIndex((c) => c === JOKER || c === 1);
  if (idx >= 0) { play(r, r.currentId, again, fromHand(again, idx), 0); assert.equal(r.build[0].length, 1); }
});

test('CARD-ACTION-01: Bots und interne Aufrufe spielen weiter ohne Browserangaben, Kennungen bleiben konsistent', async (t) => {
  const { r } = table(t, 3);
  const { BOTS } = await import('../games/bots.js');
  for (let step = 0; step < 400 && r.phase === 'playing'; step++) {
    BOTS.stapelrennen(r, r.currentId, Math.random);
    for (const id of r.order) assert.equal(r.cardIds(id).length, r.hand[id].length);
  }
  for (const id of r.order) assert.equal(new Set(r.cardIds(id)).size, r.hand[id].length);
});

// ---------- CARD-ACTION-02: Blackjack (Doppelklick, geteilte Hände, Zeitablauf) ----------
const FILL = Array.from({ length: 150 }, (_, i) => `${'23456789'[i % 8]}c`);
const stackShoe = (r, cards) => { r.shoe = [...FILL, ...[...cards].reverse()]; };
function blackjack(t) {
  const r = GAMES.blackjack.create('BJ-ACTION', { turnTime: 0 }, () => {});
  t.after(() => r.dispose?.());
  const a = r.addPlayer('Anna', null).id; r.sit(a);
  const watcher = r.addPlayer('Zoe', null).id;
  r.start(a);
  return { r, a, watcher };
}
const bj = (r, id, event, S) => GAMES.blackjack.events[event](r, r.players.get(id), { hand: S.g.handIdx, cards: S.g.hands[id][S.g.handIdx].cards.length });

test('CARD-ACTION-02: Blackjack – Doppelklick auf „Karte“ zieht genau eine Karte', (t) => {
  const { r, a, watcher } = blackjack(t);
  stackShoe(r, ['5h', '7c', '4d', 'Tc', '2s', '3s']); // Anna 5, 4 · Dealer 7, T · danach 2, 3
  r.bet(a, 50);
  const S = screen(r, a);
  bj(r, a, 'hit', S);
  assert.equal(r.hands[a][0].cards.length, 3);
  rejectsUnchanged(r, [a], watcher, () => bj(r, a, 'hit', S));
  assert.equal(r.hands[a][0].cards.length, 3);
  // Ohne Angaben abgelehnt; mit aktuellem Stand geht es weiter
  rejectsUnchanged(r, [a], watcher, () => GAMES.blackjack.events.hit(r, r.players.get(a), {}));
  bj(r, a, 'hit', screen(r, a));
  assert.equal(r.hands[a][0].cards.length, 4);
});

test('CARD-ACTION-02: Blackjack – Doppelklick auf „Stehen“ beendet bei geteilter Hand nur die angezeigte Hand', (t) => {
  const { r, a, watcher } = blackjack(t);
  stackShoe(r, ['Kh', '7c', 'Qd', 'Tc', '5s', 'Kc']); // Anna K, D · Dealer 7, T · nach Teilen K+5, D+K
  r.bet(a, 50);
  bj(r, a, 'split', screen(r, a));
  const S = screen(r, a);
  assert.equal(S.g.handIdx, 0);
  bj(r, a, 'stay', S);
  assert.equal(r.handIdx, 1);
  rejectsUnchanged(r, [a], watcher, () => bj(r, a, 'stay', S)); // zweiter Klick: Hand 0 ist nicht mehr dran
  assert.equal(r.step, 'play'); assert.equal(r.handIdx, 1);
  bj(r, a, 'stay', screen(r, a));
  assert.equal(r.phase, 'over');
});

// ---------- CARD-ACTION-02: Mau-Mau (Ein-Klick-Bedienung, Ass = nochmal dran) ----------
test('CARD-ACTION-02: Mau-Mau – Kartenaktion braucht den aktuellen Zugzähler, auch nach „Ass – nochmal dran“', (t) => {
  const r = GAMES.maumau.create('MM-ACTION', { ace: true }, () => {}); // Hausregel „Ass: nochmal dran“
  t.after(() => r.dispose?.());
  const ids = ['Anna', 'Ben'].map((name) => { const p = r.addPlayer(name, null); r.sit(p.id); return p.id; });
  const watcher = r.addPlayer('Zoe', null).id;
  r.start(ids[0]);
  const a = r.currentId;
  r.discard = ['9h']; r.wish = null; r.pending = 0; r.drawn = null;
  r.hands[a] = ['Ah', 'Kh', '8s', '7c'];
  const S = screen(r, a);
  assert.equal(S.g.seq, r.moveNo);
  const mm = (card, seq) => GAMES.maumau.events.play(r, r.players.get(a), { card, seq });
  rejectsUnchanged(r, ids, watcher, () => GAMES.maumau.events.play(r, r.players.get(a), { card: 'Ah' }));
  mm('Ah', S.g.seq); // Ass: nochmal dran
  assert.equal(r.currentId, a);
  // Ein zweiter, mit dem alten Stand abgesendeter Klick spielt nicht den König
  rejectsUnchanged(r, ids, watcher, () => mm('Kh', S.g.seq));
  assert.deepEqual(r.hands[a], ['Kh', '8s', '7c']);
  mm('Kh', screen(r, a).g.seq);
  assert.deepEqual(r.hands[a], ['8s', '7c']);
});
