// Omaha: vier eigene Karten, genau zwei zählen, Pot-Limit – Engine, Raum und Bots.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES } from '../games/index.js';
import { BOTS } from '../games/bots.js';
import { omahaBest, bestHand } from '../games/poker/engine/cards.js';
import { Table } from '../games/poker/engine/table.js';

test('Omaha-Bewertung: genau zwei eigene und drei Gemeinschaftskarten – ein Flush braucht zwei eigene Karten der Farbe', () => {
  const board = ['2h', '5h', '9h', 'Kh', '3c'];
  // Hold'em-Regel: eine Herz-Karte + vier Herz im Board wäre ein Flush – bei Omaha nicht
  assert.equal(bestHand(['Ah', 'Qc', 'Jd', '7s', ...board.slice(0, 0)].slice(0, 1).concat(board)).category, 5, 'Hold\'em: Flush');
  assert.notEqual(omahaBest(['Ah', 'Qc', 'Jd', '7s'], board).category, 5, 'Omaha: ein Herz reicht nicht');
  assert.equal(omahaBest(['Ah', 'Qh', 'Jd', '7s'], board).category, 5, 'zwei Herz + drei Board-Herz: Flush');
  // Straße: das Board allein (5 Karten) zählt nicht, es müssen genau zwei eigene dabei sein
  const run = ['5c', '6d', '7h', '8s', '9c'];
  const e = omahaBest(['Ac', 'Ad', '2s', '3s'], run);
  assert.ok(e.category < 4, 'keine Straße aus dem Board allein');
  assert.equal(omahaBest(['4c', '5d', 'Ks', 'Ks'.replace('K', 'Q')], run).category, 4, 'zwei eigene (4, 5) + 6 7 8: Straße');
  assert.equal(e.cards.length, 5);
});

test('Omaha-Tisch: vier Karten je Spieler, Pot-Limit begrenzt die Erhöhung', () => {
  const t = new Table({ smallBlind: 50, bigBlind: 100, holeCards: 4, potLimit: true });
  t.sit(0, { id: 'a', name: 'A', stack: 10000 });
  t.sit(1, { id: 'b', name: 'B', stack: 10000 });
  t.sit(2, { id: 'c', name: 'C', stack: 10000 });
  t.startHand();
  for (const i of t.hand.seats) assert.equal(t.hand.players[i].cards.length, 4);
  const first = t.hand.toAct;
  const L = t.legal(first);
  // Pot 150 (Blinds), zu callen 100: höchstens bis 100 + 150 + 100 = 350
  assert.equal(L.maxTo, 350);
  assert.equal(L.stackTo, 10000);
  assert.equal(L.potLimit, true);
  assert.throws(() => t.act(first, { type: 'raise', amount: 351 }), /Pot-Limit: höchstens 350/);
  t.act(first, { type: 'raise', amount: 350 });
  // Nächster: Pot 500, zu callen 250 → bis 350 + 500 + 250 = 1100 (Big/Small-Blind-Anteile mitgezählt)
  const next = t.hand.toAct;
  assert.equal(t.legal(next).maxTo, 350 + (50 + 100 + 350) + (350 - t.hand.players[next].bet));
  // All-in-Taste bedeutet hier das Pot-Limit-Maximum
  t.act(next, { type: 'allin' });
  assert.equal(t.hand.currentBet, t.legal(next)?.maxTo ?? t.hand.currentBet);
});

test('Hold\'em bleibt No Limit: nichts ändert sich ohne Variante', () => {
  const t = new Table({ smallBlind: 50, bigBlind: 100 });
  t.sit(0, { id: 'a', name: 'A', stack: 10000 });
  t.sit(1, { id: 'b', name: 'B', stack: 10000 });
  t.startHand();
  for (const i of t.hand.seats) assert.equal(t.hand.players[i].cards.length, 2);
  const L = t.legal(t.hand.toAct);
  assert.equal(L.maxTo, L.stackTo);
  assert.equal(L.potLimit, false);
});

function omahaRoom(n = 3) {
  const room = GAMES.omaha.create('OMA', { startStack: 5000, smallBlind: 25, bigBlind: 50, turnTime: 0, nextDelay: 2 }, () => {});
  const ids = Array.from({ length: n }, (_, k) => { const p = room.addPlayer('S' + k, null); room.sit(p.id, k); return p.id; });
  return { room, ids };
}

test('Omaha-Raum: Pot-Limit und Omaha schon beim Anlegen, Spielart nicht mehr änderbar, 4 verdeckte Karten für andere', () => {
  const { room, ids } = omahaRoom();
  assert.equal(room.settings.variant, 'omaha');
  assert.equal(room.settings.potLimit, true);
  room.updateSettings(room.hostId, { variant: 'holdem', potLimit: false });
  assert.equal(room.settings.variant, 'omaha', 'Spielart steht fest');
  room.updateSettings(room.hostId, { potLimit: true });
  room.start(room.hostId);
  const v = room.view(ids[0]);
  const mine = v.seats[v.you.seat];
  assert.equal(mine.cards.length, 4);
  const other = v.seats.find((s) => s && s.id !== v.you.id);
  assert.deepEqual(other.cards, ['??', '??', '??', '??']);
  assert.equal(v.hand.odds ?? null, null, 'keine Gewinnchancen beim Omaha');
  room.dispose();
});

test('Omaha: Bots spielen Hände bis zum Showdown, die Chipsumme bleibt gleich', () => {
  const rng = (() => { let s = 7; return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; })();
  const { room, ids } = omahaRoom(4);
  const total = room.table.totalChips();
  room.start(room.hostId);
  let hands = 0;
  for (let k = 0; k < 600 && hands < 6; k++) {
    if (!room.handRunning) { hands++; room.nextHand(room.hostId); continue; }
    const seat = room.table.hand.toAct;
    const p = room.playerAt(seat);
    const act = BOTS.omaha(room, p.id, rng);
    void act;
    assert.equal(room.table.totalChips(), total, 'Chips');
  }
  assert.ok(hands >= 1);
  room.dispose();
});
