import test from 'node:test';
import assert from 'node:assert/strict';
import { bindPresentation, installRoomViewAudit, isLivePeer, samePokerSituation, samePokerViewer, ServerViewLedger, viewKey } from './ui/server-view-audit.js';

function snapshot(revision, connection = 'player-a', player = 'a', hand = 4) {
  return {
    code: 'ROOM', game: 'poker', phase: 'playing', you: { id: player, seat: player === 'a' ? 0 : 1 },
    seats: [{ id: 'a' }, { id: 'b' }],
    hand: { no: hand, street: 'flop', done: false, toAct: 'a', currentBet: 10, board: ['4c', '5d', '7s'] },
    __roomViewAudit: { revision, connection, room: 1, hand: hand + 10, round: 10, viewer: player, role: 'player' },
  };
}

const stamp = view => view.__roomViewAudit;
const packet = view => '42' + JSON.stringify(['state', view]);
const sample = view => ({ kind: 'dom', stamp: stamp(view) });

test('DOM samples reject a different revision or connection even if a resolver returns it', () => {
  const view = snapshot(10);
  for (const wrong of [snapshot(11), snapshot(10, 'new-connection')]) {
    assert.throws(() => bindPresentation([sample(view)], () => wrong), /DOM revision/);
  }
});

test('later server frames never authorize earlier samples, and conflicting revisions fail closed', () => {
  const ledger = new ServerViewLedger();
  const early = snapshot(10);
  const late = snapshot(11);
  const bind = () => bindPresentation([sample(early)], key => ledger.find(key));
  assert.throws(bind, /DOM revision/);
  ledger.capture(packet(late), 0, {});
  assert.throws(bind, /DOM revision/);
  ledger.capture(packet(early), 0, {});
  assert.deepEqual(bind()[0].view, early);
  ledger.capture(packet({ ...early, phase: 'done' }), 0, {});
  assert.throws(bind, /DOM revision/);
});

test('a closed WebSocket invalidates its revisions and a reconnect requires a fresh connection', () => {
  const ledger = new ServerViewLedger();
  const oldSocket = {};
  const first = snapshot(10);
  ledger.capture(packet(first), 0, oldSocket);
  assert.deepEqual(ledger.find(stamp(first)), first);
  ledger.close(oldSocket);
  ledger.capture(packet(snapshot(11)), 0, oldSocket);
  assert.equal(ledger.find(stamp(first)), undefined);
  assert.equal(ledger.find(stamp(snapshot(11))), undefined);
  const reconnected = snapshot(12, 'player-a-reconnected');
  ledger.capture(packet(reconnected), 0, {});
  assert.equal(ledger.find(stamp(first)), undefined);
  assert.deepEqual(ledger.find(stamp(reconnected)), reconnected);
  assert.equal(samePokerViewer(first, reconnected), true);
});

test('overlapping polling and WebSocket frames match by revision, and polling from an old document is discarded', () => {
  const ledger = new ServerViewLedger();
  const first = snapshot(10);
  const second = snapshot(11);
  const third = snapshot(12);
  ledger.capture(packet(third), 0, {});
  ledger.capture('6\x1e' + packet(first) + '\x1e' + packet(second), 0);
  assert.deepEqual(bindPresentation([sample(third), sample(first), sample(second)], key => ledger.find(key))
    .map(batch => batch.view), [third, first, second]);
  ledger.navigate();
  ledger.capture(packet(second), 0);
  assert.equal(ledger.find(stamp(second)), undefined);
  assert.equal(ledger.find(stamp(third)), undefined);
});

test('Poker comparison distinguishes hand, table, variant, game situation, player and spectator', () => {
  const first = snapshot(10);
  const peer = snapshot(10, 'player-b', 'b');
  assert.equal(isLivePeer(first, peer), true);
  assert.equal(isLivePeer(first, snapshot(10, 'player-b', 'b', 5)), false);
  assert.equal(isLivePeer(first, snapshot(11, 'player-b', 'b')), false);
  assert.equal(isLivePeer(first, snapshot(10, 'other-a', 'a')), false);
  assert.equal(samePokerViewer(first, snapshot(11, 'other-a', 'a')), true);
  assert.equal(samePokerViewer(first, { ...first, seats: [{ id: 'b' }], you: { ...first.you, seat: null },
    __roomViewAudit: { ...stamp(first), role: 'spectator' } }), false);
  assert.equal(samePokerViewer(first, peer), false);
  assert.equal(samePokerViewer(first, { ...first, you: { ...first.you, seat: 1 } }), false);
  for (const other of [
    snapshot(11, 'other-a', 'a', 5),
    { ...first, code: 'ELSE' },
    { ...first, __roomViewAudit: { ...stamp(first), room: 2 } },
    { ...first, __roomViewAudit: { ...stamp(first), hand: stamp(first).hand + 1 } },
    { ...first, game: 'omaha' },
    { ...first, hand: { ...first.hand, street: 'turn' } },
    { ...first, hand: { ...first.hand, toAct: 'b' } },
    { ...first, hand: { ...first.hand, board: ['4c', '5d', '8s'] } },
  ]) assert.equal(samePokerSituation(first, other), false);
});


test('the browser renderer rejects a stale replay after a newer revision', () => {
  installRoomViewAudit();
  const audit = globalThis.__pokerRoomViewAudit;
  try {
    const socket = { id: 'player-a', connected: true };
    const early = snapshot(10);
    const latest = snapshot(11);
    for (const view of [early, latest]) {
      audit.received(view, socket);
      audit.beforeRender(view, socket);
      audit.afterRender(true);
      assert.deepEqual(audit.current(), stamp(view));
    }
    audit.beforeRender(early, socket);
    audit.afterRender(true);
    assert.equal(audit.current(), null);
  } finally {
    delete globalThis.__pokerRoomViewAudit;
  }
});


test('each sample must match all dimensions, including later samples in an existing batch', () => {
  const ledger = new ServerViewLedger();
  const view = snapshot(10);
  ledger.capture(packet(view), 0, {});
  const lookup = value => ledger.find(value);
  const matches = { kind: 'dom', stamp: { ...stamp(view) } };
  assert.equal(bindPresentation([sample(view), matches], lookup)[0].samples.length, 2);

  for (const [field, different] of Object.entries({
    revision: 11, connection: 'elsewhere', room: 3, hand: 99, round: 99, viewer: 'another', role: 'spectator',
  })) {
    for (const value of [different, undefined]) {
      const contradictory = { stamp: { ...stamp(view), [field]: value } };
      assert.equal(ledger.find(contradictory.stamp), undefined, field);
      assert.throws(() => bindPresentation([sample(view), contradictory], lookup), /DOM revision/, field);
    }
  }
});

test('contradictory wire metadata cannot be resolved with the same revision and connection', () => {
  for (const contradictory of [{ viewer: 'other' }, { role: 'spectator' }, { round: undefined }, { hand: 99 }]) {
    const ledger = new ServerViewLedger();
    const view = snapshot(10);
    ledger.capture(packet(view), 0, {});
    ledger.capture(packet({ ...view, __roomViewAudit: { ...stamp(view), ...contradictory } }), 0, {});
    assert.equal(ledger.find(stamp(view)), undefined);
  }
});

test('separate connections may share a revision, while a real spectator keeps its own identity', () => {
  const ledger = new ServerViewLedger();
  const player = snapshot(10);
  const other = snapshot(10, 'observer', 'b');
  other.you.seat = null;
  other.__roomViewAudit.role = 'spectator';
  ledger.capture(packet(player), 0, {});
  ledger.capture(packet(other), 0, {});
  assert.deepEqual(ledger.find(stamp(player)), player);
  assert.deepEqual(ledger.find(stamp(other)), other);
  assert.deepEqual(ledger.peers(player, isLivePeer), [other]);
  assert.equal(samePokerViewer(player, other), false);
  assert.equal(isLivePeer(player, { ...other, __roomViewAudit: { ...stamp(other), round: 99 } }), false);
});

test('viewKey requires explicit hand and round identity and distinguishes changed instances', () => {
  const identity = stamp(snapshot(10));
  assert.equal(typeof viewKey(identity), 'string');
  for (const field of ['hand', 'round']) {
    const inactive = { ...identity, [field]: null };
    assert.equal(typeof viewKey(inactive), 'string', field);
    assert.notEqual(viewKey(inactive), viewKey(identity), field);
    assert.notEqual(viewKey({ ...identity, [field]: 99 }), viewKey(identity), field);
    const incomplete = { ...inactive };
    delete incomplete[field];
    assert.equal(viewKey(incomplete), undefined, field);
    assert.equal(viewKey({ ...identity, [field]: 0 }), undefined, field);
  }
});

test('a single server frame must agree with its stamped viewer before entering the ledger', () => {
  const view = snapshot(10);
  const accepted = new ServerViewLedger();
  accepted.capture(packet(view), accepted.generation, {});
  assert.deepEqual(accepted.find(stamp(view)), view);

  const rejected = new ServerViewLedger();
  const wrongViewer = { ...view, you: { ...view.you, id: 'b' } };
  rejected.capture(packet(wrongViewer), rejected.generation, {});
  assert.equal(rejected.find(stamp(view)), undefined);
});

test('live-peer matching checks hand instances for poker variants with a nested hand view', () => {
  const view = { ...snapshot(10), game: 'five-card-draw', hand: null };
  const peer = { ...snapshot(10, 'player-b', 'b'), game: view.game, hand: null };
  assert.equal(isLivePeer(view, peer), true);
  const otherHand = { ...peer, __roomViewAudit: { ...stamp(peer), hand: stamp(view).hand + 1 } };
  assert.equal(isLivePeer(view, otherHand), false);
});
