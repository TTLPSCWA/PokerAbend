// Raum-Logik ohne Netzwerk: Aufstehen während der Hand, Aussetzen, alte Spielstände laden.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room } from '../games/poker/room.js';

// Tisch ohne Zug-Timer und ohne automatische nächste Hand – die Tests steuern alles selbst
function room(names = ['Anna', 'Ben', 'Carla']) {
  const r = new Room('TESTX', { autoNext: false, turnTime: 0 }, () => {});
  const ids = names.map((n, i) => { const p = r.addPlayer(n, null); r.sit(p.id, i); return p.id; });
  return { r, ids };
}
const toAct = (r) => r.playerAt(r.table.hand.toAct).id;
// Alle anderen folden, bis die Hand vorbei ist
function finishHand(r) {
  while (r.handRunning) { r.act(toAct(r), { type: 'fold' }); r.afterChange(); }
}
const stop = (r) => { clearTimeout(r.turnTimer); clearTimeout(r.nextTimer); };

test('Aufstehen mitten in der Hand: spielt zu Ende, steht erst danach auf', () => {
  const { r, ids } = room();
  r.start(ids[0]);
  const ben = r.players.get(ids[1]);
  r.stand(ben.id);
  assert.equal(ben.seat, 1, 'sitzt noch');
  assert.equal(ben.leaveAfterHand, true);
  assert.equal(r.table.hand.players[1].folded, false, 'nicht automatisch gefoldet');
  assert.equal(r.view(ben.id).you.leaving, true);
  // Nochmal drücken = doch sitzen bleiben
  r.stand(ben.id);
  assert.equal(ben.leaveAfterHand, false);
  r.stand(ben.id);
  finishHand(r);
  r.nextHand(ids[0]);
  assert.equal(ben.seat, null, 'nach der Hand aufgestanden');
  assert.ok(!r.table.hand.players[1], 'bekommt in der nächsten Hand keine Karten');
  stop(r);
});

test('Wiedereinstieg zu früh abgelehnt, nach einer ausgesetzten Hand erlaubt', () => {
  const { r, ids } = room();
  r.start(ids[0]);
  finishHand(r); // Hand 1 vorbei
  const ben = r.players.get(ids[1]);
  r.stand(ben.id); // zwischen den Händen: sofort
  assert.equal(ben.seat, null);
  assert.equal(r.view(ben.id).you.sitLocked, true);
  assert.throws(() => r.sit(ben.id, 1), /setzt noch eine Hand aus/);
  assert.throws(() => r.sit(ben.id, 5), /setzt noch eine Hand aus/, 'auch auf einem anderen Platz');
  // Hand 2 läuft ohne ihn – jetzt darf er sich setzen, Karten gibt es ab Hand 3
  r.nextHand(ids[0]);
  assert.equal(r.table.hand.no, 2);
  assert.ok(!r.table.hand.players[1]);
  assert.equal(r.view(ben.id).you.sitLocked, false);
  r.sit(ben.id, 1);
  assert.ok(!r.table.hand.players[1], 'mitten in Hand 2 keine Karten');
  finishHand(r);
  r.nextHand(ids[0]);
  assert.ok(r.table.hand.players[1], 'ab Hand 3 wieder dabei');
  stop(r);
});

test('Aufstehen während der Hand → genau die nächste Hand aussetzen', () => {
  const { r, ids } = room();
  r.start(ids[0]);
  const ben = r.players.get(ids[1]);
  r.stand(ben.id);
  finishHand(r);
  r.nextHand(ids[0]); // Hand 2 beginnt, Ben steht dabei auf
  assert.equal(ben.seat, null);
  assert.equal(r.view(ben.id).you.sitLocked, false, 'Hand 2 läuft bereits ohne ihn');
  r.sit(ben.id, 1);
  assert.ok(!r.table.hand.players[1]);
  stop(r);
});

test('Pause und Verbindungsabbruch lösen keine Sperre aus', () => {
  const { r, ids } = room();
  r.start(ids[0]);
  const ben = r.players.get(ids[1]);
  r.setSittingOut(ben.id, true);
  ben.connected = false; ben.offlineSince = Date.now();
  finishHand(r);
  r.setSittingOut(ben.id, false);
  r.nextHand(ids[0]);
  assert.equal(ben.seat, 1);
  assert.ok(r.table.hand.players[1], 'nach der Pause direkt wieder Karten');
  assert.ok(!ben.sitLock);
  stop(r);
});

test('Zu zweit gibt es keine Hand ohne ihn – dann gilt keine Sperre', () => {
  const { r, ids } = room(['Anna', 'Ben']);
  r.start(ids[0]);
  finishHand(r);
  r.stand(ids[1]);
  assert.equal(r.view(ids[1]).you.sitLocked, false);
  r.sit(ids[1], 1);
  stop(r);
});

test('Sperre übersteht das Speichern und Laden', () => {
  const { r, ids } = room();
  r.start(ids[0]);
  finishHand(r);
  r.stand(ids[1]);
  const copy = Room.restore(JSON.parse(JSON.stringify(r.snapshot())), () => {});
  assert.throws(() => copy.sit(ids[1], 1), /setzt noch eine Hand aus/);
  assert.equal(copy.view(ids[1]).you.lastSeat, 1);
  stop(r);
});

test('Alte Spielstände mit Feldern früherer Versionen laden weiter', () => {
  const old = {
    code: 'ALTE1', settings: { smallBlind: 50, bigBlind: 100 }, hostId: 'a1', button: 0, handNo: 7, log: [],
    players: [
      { id: 'a1', token: 't1', name: 'Anna', avatar: '🦊', seat: 0, chips: 9000, buyIn: 10000, rebuys: 0, sittingOut: false },
      // früher: Profilbild statt Emoji und eine externe Konto-ID
      { id: 'b2', token: 't2', name: 'Ben', avatar: null, avatarUrl: 'https://example.invalid/b.png', externalId: '123', seat: 1, chips: 11000, buyIn: 10000, rebuys: 0, sittingOut: false },
    ],
  };
  const r = Room.restore(old, () => {});
  const ben = r.players.get('b2');
  assert.equal(r.code, 'ALTE1');
  assert.equal(r.table.seats[1].stack, 11000);
  assert.ok(ben.avatar, 'bekommt ein Emoji');
  assert.equal('avatarUrl' in ben, false);
  assert.equal('avatarUrl' in r.view('b2').seats[1], false);
  assert.equal('avatarUrl' in r.snapshot().players[1], false);
  assert.equal(r.byToken('t2'), ben, 'Wiedererkennung über das Token');
});
