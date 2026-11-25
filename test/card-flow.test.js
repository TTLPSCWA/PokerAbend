// QA-CARD-FLOW-01: Multiplayer- und Zustandsregressionen für UNO (farbenchaos), Skip-Bo (stapelrennen),
// Phase 10 (zehnetappen) und Doppelkopf an den echten Raumklassen. Ohne Wartezeiten, rein ereignisgesteuert.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Room as Uno } from '../games/farbenchaos/room.js';
import { Room as SkipBo } from '../games/stapelrennen/room.js';
import { Room as Phase10 } from '../games/zehnetappen/room.js';
import '../games/doppelkopf/index.js';
import { Room as Doko } from '../games/doppelkopf/room.js';

function table(t, Room, settings, players = 2) {
  const r = new Room('FLOW', settings, () => {});
  t.after(() => r.dispose?.());
  const ids = ['Anna', 'Ben', 'Cem', 'Dana'].slice(0, players).map((name) => { const p = r.addPlayer(name, null); r.sit(p.id); return p.id; });
  const watcher = r.addPlayer('Zoe', null).id;
  r.start(ids[0]);
  return { r, ids, watcher };
}
// Vollständige Nutzlast je Empfänger, wie sie der Server sendet. Ohne flüchtige Zeitstempel.
const payload = (r, id) => { const v = r.view(id); delete v.deadline; delete v.now; return JSON.stringify(v); };
const everyone = (r, ids, watcher) => [...ids, watcher].map((id) => payload(r, id));
function rejectsUnchanged(r, ids, watcher, action, message) {
  const before = everyone(r, ids, watcher);
  assert.throws(action, message);
  assert.deepEqual(everyone(r, ids, watcher), before, 'abgelehnte Aktion darf nichts verändern');
}
// Sucht in einer Ansicht nach einer fremden Hand (als vollständiges Array). Kartenwerte in öffentlichen
// Stapeln sind erlaubt, eine komplette Hand eines anderen Spielers nicht.
function containsHand(value, hand) {
  if (Array.isArray(value) && value.length === hand.length && value.length > 1 && JSON.stringify(value) === JSON.stringify(hand)) return true;
  if (value && typeof value === 'object') return Object.values(value).some((v) => containsHand(v, hand));
  return false;
}
function assertConfidential(r, ids, watcher, handOf) {
  for (const viewer of [...ids, watcher]) {
    const view = r.view(viewer);
    if (viewer === watcher) assert.equal(view.g.hand, null, 'Zuschauer sieht keine Hand');
    else assert.deepEqual(view.g.hand.map((c) => String(c?.id ?? c)).sort(), handOf(viewer).map(String).sort());
    for (const other of ids) {
      if (other === viewer) continue;
      const sorted = [...handOf(other)].sort((a, b) => String(a).localeCompare(String(b)));
      const asView = viewer === watcher ? null : view.g.hand;
      assert.equal(containsHand({ ...view, g: { ...view.g, hand: asView } }, handOf(other)) || containsHand(view, sorted), false,
        `${viewer} erhält die Hand von ${other}`);
    }
    for (const p of view.players.filter((p) => ids.includes(p.id))) {
      assert.equal(p.cards ?? p.handCount ?? handOf(p.id).length, handOf(p.id).length, 'öffentliche Kartenzahl stimmt');
    }
  }
}

test('QA-CARD-FLOW-01 UNO: Doppelklick, Zug des Gegners, Zuschauer und Wiederverbindung', (t) => {
  const { r, ids: [a, b], watcher } = table(t, Uno, { startAction: false });
  assert.equal(r.currentId, a);
  // Eine sicher spielbare Zahlkarte aus dem Stapel tauschen, damit der Zug deterministisch ist.
  const top = r.discard.at(-1), color = r.wish || top[1] === 'w' ? r.wish || 'r' : top[1];
  if (top[1] === 'w') { r.wish = color; }
  const pick = r.deck.findIndex((c) => c[1] === color && /\d/.test(c[0]));
  [r.deck[pick], r.hands[a][0]] = [r.hands[a][0], r.deck[pick]];
  const card = r.hands[a][0];
  assertConfidential(r, [a, b], watcher, (id) => r.hands[id]);
  rejectsUnchanged(r, [a, b], watcher, () => r.play(b, r.hands[b][0]), /nicht dran/);
  rejectsUnchanged(r, [a, b], watcher, () => r.play(watcher, card), /nicht dran/);
  r.play(a, card);
  assert.equal(r.currentId, b);
  const after = everyone(r, [a, b], watcher);
  // Zweiter Klick derselben Aktion (Doppelklick oder verspätete Wiederholung) wird abgelehnt.
  rejectsUnchanged(r, [a, b], watcher, () => r.play(a, card), /nicht dran|hast du nicht/);
  assert.deepEqual(everyone(r, [a, b], watcher), after);
  // Wiederverbindung: Dieselbe ID erhält denselben Stand, unabhängig vom Verbindungsstatus.
  r.players.get(a).connected = false;
  const offline = JSON.parse(payload(r, a));
  r.players.get(a).connected = true;
  const online = JSON.parse(payload(r, a));
  assert.deepEqual(offline.g, online.g);
  assert.equal(offline.turnId, online.turnId);
  assertConfidential(r, [a, b], watcher, (id) => r.hands[id]);
});

test('QA-CARD-FLOW-01 Skip-Bo: Ablegen beendet den Zug genau einmal, fremde Aktionen ändern nichts', (t) => {
  const { r, ids: [a, b], watcher } = table(t, SkipBo, { stockSize: 5 });
  assert.equal(r.currentId, a);
  assertConfidential(r, [a, b], watcher, (id) => r.hand[id]);
  rejectsUnchanged(r, [a, b], watcher, () => r.throwAway(b, 0, 0), /nicht dran/);
  rejectsUnchanged(r, [a, b], watcher, () => r.play(watcher, { kind: 'hand', index: 0 }, 0), /nicht dran/);
  const handBefore = r.hand[a].length;
  r.throwAway(a, 0, 0);
  assert.equal(r.currentId, b);
  assert.equal(r.hand[a].length, handBefore - 1);
  const after = everyone(r, [a, b], watcher);
  rejectsUnchanged(r, [a, b], watcher, () => r.throwAway(a, 0, 0), /nicht dran/);
  assert.deepEqual(everyone(r, [a, b], watcher), after);
  // Der Spielstapel bleibt verdeckt: Gegner und Zuschauer sehen nur die oberste Karte und die Anzahl.
  for (const viewer of [b, watcher]) {
    const view = r.view(viewer);
    assert.equal(containsHand(view, r.stock[a]), false, 'verdeckter Spielstapel bleibt verborgen');
  }
  assertConfidential(r, [a, b], watcher, (id) => r.hand[id]);
});

test('QA-CARD-FLOW-01 Phase 10: Ziehen nur einmal, Abwerfen beendet den Zug, verdeckte Karten bleiben privat', (t) => {
  const { r, ids: [a, b], watcher } = table(t, Phase10, {});
  assert.equal(r.currentId, a);
  const ids = (id) => r.hands[id].map((c) => c.id);
  assertConfidential(r, [a, b], watcher, ids);
  // Die Ansicht sendet Kartenobjekte. Kein Kartenobjekt einer fremden Hand darf in einer Ansicht vorkommen.
  const leak = (viewer, owner) => { const own = new Set(r.hands[owner].map((c) => c.id)); const seen = JSON.stringify(r.view(viewer).g.hand || []); return [...own].some((id) => seen.includes(`"id":${id},`) || seen.includes(`"id":${id}}`)); };
  assert.equal(leak(b, a), false); assert.equal(leak(watcher, a), false); assert.equal(leak(a, b), false);
  rejectsUnchanged(r, [a, b], watcher, () => r.drawCard(b, 'deck'), /nicht dran/);
  r.drawCard(a, 'deck');
  const drawn = everyone(r, [a, b], watcher);
  rejectsUnchanged(r, [a, b], watcher, () => r.drawCard(a, 'deck'));
  assert.deepEqual(everyone(r, [a, b], watcher), drawn);
  const card = r.hands[a][0].id;
  r.throwAway(a, card);
  assert.equal(r.currentId, b);
  rejectsUnchanged(r, [a, b], watcher, () => r.throwAway(a, r.hands[a][0].id), /nicht dran/);
  assert.equal(leak(b, a), false); assert.equal(leak(watcher, a), false);
});

function dokoTable(t) {
  const r = new Doko('FLOW-DK', { turnTime: 30 }, () => {});
  t.after(() => r.dispose?.());
  const ids = ['Anna', 'Ben', 'Cem', 'Dana'].map((name) => { const p = r.addPlayer(name, null); r.sit(p.id); return p.id; });
  const watcher = r.addPlayer('Zoe', null).id;
  r.start(ids[0]);
  const key = () => ({ key: r.dealKey, revision: r.revision });
  for (const id of [...r.pos]) r.reserve(id, { ...key(), choice: 'healthy' });
  return { r, ids, watcher, key };
}

test('QA-CARD-FLOW-01 Doppelkopf: veraltete Revision, Doppelklick, Zeitablauf und verdeckte Hände', (t) => {
  const { r, ids, watcher, key } = dokoTable(t);
  assert.equal(r.stage, 'play');
  assertConfidential(r, ids, watcher, (id) => r.hands[id]);
  const first = r.currentId, stale = key(), card = r.allowed(first)[0];
  r.play(first, { ...stale, card });
  const after = everyone(r, ids, watcher);
  // Derselbe Klick mit der alten Revision: abgelehnt, keine Änderung.
  rejectsUnchanged(r, ids, watcher, () => r.play(first, { ...stale, card: r.hands[first][0] }), /nicht dran|nicht mehr aktuell/);
  assert.deepEqual(everyone(r, ids, watcher), after);
  // Aktion unmittelbar vor dem Zeitablauf: Der Zeitablauf spielt für den aktuellen Spieler genau einmal.
  const due = r.currentId, revision = r.revision, before = r.played.length;
  r.onTimeout(due);
  assert.equal(r.played.length, before + 1);
  assert.notEqual(r.currentId, due);
  assert.ok(r.revision > revision);
  // Die verspätete eigene Aktion des abgelaufenen Spielers mit dem alten Stand wird abgelehnt.
  rejectsUnchanged(r, ids, watcher, () => r.play(due, { key: r.dealKey, revision, card: r.hands[due][0] }), /nicht dran|nicht mehr aktuell/);
  // Fremdes Spiel (alter Spielschlüssel) wird abgelehnt.
  rejectsUnchanged(r, ids, watcher, () => r.play(r.currentId, { key: 'alt', revision: r.revision, card: r.allowed(r.currentId)[0] }), /nicht mehr aktuell/);
  assertConfidential(r, ids, watcher, (id) => r.hands[id]);
});

test('QA-CARD-FLOW-01 Doppelkopf: Spielende und neues Spiel verwerfen alte Aktionen, Summe bleibt null', (t) => {
  const { r, ids, watcher, key } = dokoTable(t);
  while (r.stage === 'play') { const id = r.currentId; r.play(id, { ...key(), card: r.allowed(id)[0] }); }
  assert.equal(r.stage, 'deal-over');
  assert.equal(Object.values(r.lastDeal.per).reduce((s, n) => s + n, 0), 0);
  const oldKey = key();
  r.nextDeal(r.hostId);
  assert.equal(r.stage, 'reserve');
  rejectsUnchanged(r, ids, watcher, () => r.reserve(r.currentId, { ...oldKey, choice: 'healthy' }), /nicht mehr aktuell/);
  assert.equal(Object.values(r.totals).reduce((s, n) => s + n, 0), 0);
  for (const id of ids) assert.equal(r.view(id).g.hand.length, r.N);
  assert.equal(r.view(watcher).g.hand, null);
});
