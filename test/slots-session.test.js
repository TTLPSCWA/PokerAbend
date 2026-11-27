import assert from 'node:assert/strict';
import test from 'node:test';
import { canSpin, create, MACHINES, MAX_BALANCE, reset, settle, spin } from '../public/singleplayer/slots-logic.js';
import { HISTORY_LIMIT, ID, newArcade, readArcade, recordSpin, writeArcade } from '../public/singleplayer/slots-session.js';
import { key } from '../public/singleplayer/storage.js';

function fakeStorage() {
  const data = new Map();
  return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
}

test('saving before the animation preserves the settled balance and per-machine history', () => {
  const storage = fakeStorage();
  const arcade = newArcade(() => 1234);
  arcade.selected = 'neon-nights';
  arcade.quiet = true;
  arcade.volume = 40;
  const state = arcade.machines[arcade.selected];
  const result = spin(state);
  recordSpin(arcade, result);
  assert.equal(spin(state), null);
  assert.equal(writeArcade(storage, arcade), true);
  const loaded = readArcade(storage);
  assert.equal(loaded.status, 'saved');
  assert.equal(loaded.state.selected, 'neon-nights');
  assert.equal(loaded.state.volume, 40);
  assert.equal(loaded.state.quiet, true);
  assert.equal(loaded.state.machines[arcade.selected].balance, state.balance);
  assert.equal(loaded.state.machines[arcade.selected].busy, false);
  assert.equal(loaded.state.histories[arcade.selected][0].total, result.total);
  assert.deepEqual(loaded.state.histories['lucky-sevens'], []);
  const fresh = loaded.state.machines[arcade.selected];
  assert.equal(settle(fresh), false);
  assert.equal(fresh.stats.spins, 1);
  assert.equal(fresh.balance, 1000 - result.bet + result.total);
});

test('history is bounded, and invalid stops or duplicate spin identities fail the save validation', () => {
  const storage = fakeStorage();
  const arcade = newArcade(() => 4312);
  const state = arcade.machines[arcade.selected];
  for (let i = 0; i < 20; i++) {
    if (!canSpin(state)) assert.equal(reset(state), true);
    recordSpin(arcade, spin(state));
    settle(state);
  }
  assert.equal(writeArcade(storage, arcade), true);
  const loaded = readArcade(storage).state;
  assert.equal(loaded.histories[arcade.selected].length, HISTORY_LIMIT);
  const original = storage.getItem(key(ID));
  const data = JSON.parse(original);
  const history = data.state.histories[arcade.selected];
  history[0].stops[0] = MACHINES[arcade.selected].strips[0].length;
  storage.setItem(key(ID), JSON.stringify(data));
  assert.equal(readArcade(storage).status, 'corrupt');
  const duplicate = JSON.parse(original);
  duplicate.state.histories[arcade.selected][1].id = history[0].id;
  storage.setItem(key(ID), JSON.stringify(duplicate));
  assert.equal(readArcade(storage).status, 'corrupt');
});

test('the cap credits only the available headroom and a running spin prevents a refill', () => {
  let outcome;
  let previous;
  let state;
  for (let seed = 1; seed < 5000; seed++) {
    previous = MAX_BALANCE;
    state = create({ seed, balance: previous });
    outcome = spin(state);
    if (outcome.uncappedTotal > outcome.total) break;
  }
  assert.ok(outcome.uncappedTotal > outcome.total, 'the test exercises a capped win');
  assert.equal(state.balance, previous - outcome.bet + outcome.total);
  assert.equal(state.stats.won, outcome.total);
  const low = create({ balance: 0 });
  low.busy = true;
  assert.equal(reset(low), false);
  assert.equal(low.balance, 0);
  settle(low);
  assert.equal(reset(low), true);
});
