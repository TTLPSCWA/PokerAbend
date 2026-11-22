import assert from 'node:assert/strict';
import test from 'node:test';
import { spielhalleEngine as engine } from '../server/idle/spielhalle.js';
import { createIdleFileStore, createIdleSaveService } from '../server/idle/savepoints.js';
import { createIdleExportCodec } from '../server/idle/exports.js';
import { day, hour, minute, playHall } from './spielhalle-playthrough.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const start = 1_790_000_000_000;
const coins = (view) => BigInt(view.data.coins);
const UNIT = 1_000_000_000_000n;

function game() {
  let state = engine.create(start);
  return {
    get state() { return state; },
    get view() { return engine.view(state); },
    command(action) { state = engine.command(state, state.at, action); },
    wait(time) {
      const result = engine.advance(state, state.at + time);
      state = result.snapshot;
      return result.segments;
    },
  };
}

test('Spielhalle: manueller Start bedient einen Gast und kann den Autogeber kaufen. Ein wartender Gast zahlt einmal', () => {
  const player = game();
  assert.equal(coins(player.view), 25n * UNIT);
  assert.equal(player.wait(minute), 1);
  assert.equal(coins(player.view), 25n * UNIT);
  assert.throws(() => player.command({ type: 'auto' }), { code: 'not-enough-coins' });
  player.command({ type: 'manual' });
  assert.equal(coins(player.view), 30n * UNIT);
  assert.throws(() => player.command({ type: 'manual' }), { code: 'guest-wait' });
  player.wait(20_000);
  player.command({ type: 'manual' });
  assert.equal(coins(player.view), 35n * UNIT);
  player.command({ type: 'auto' });
  assert.throws(() => player.command({ type: 'manual' }), { code: 'locked' });
  assert.throws(() => player.command({ type: 'buy', station: 'poker' }), { code: 'locked' });
  assert.throws(() => player.command({ type: 'pause', station: 'cards' }), { code: 'locked' });
});

test('Spielhalle: frühe Automation und alle sechs Offline-Horizonte sind exakt teilbar', () => {
  const player = game();
  player.command({ type: 'manual' });
  player.command({ type: 'auto' });
  for (const [elapsed, segments] of [[minute, 1], [hour, 2], [day, 4], [30 * day, 6], [365 * day, 7], [3650 * day, 7]]) {
    const direct = engine.advance(player.state, start + elapsed);
    const first = engine.advance(player.state, start + 17);
    const repeat = engine.advance(first.snapshot, start + elapsed);
    assert.deepEqual(repeat.snapshot, direct.snapshot);
    assert.equal(direct.segments, segments);
    assert.ok(coins(engine.view(direct.snapshot)) >= 0n);
  }
  const next = engine.advance(player.state, start + 1_980_000);
  assert.equal(next.snapshot.phase, 'SH-P2');
  assert.equal(engine.advance(player.state, start + 1_979_999).snapshot.phase, 'SH-P1');
  assert.throws(() => engine.advance(player.state, start - 1), { code: 'clock-regressed' });
});

test('Spielhalle: nachgewiesener Personalengpass, belegte Auflösung und kein negativer Kassenstand', () => {
  const player = game();
  player.command({ type: 'manual' });
  player.command({ type: 'auto' });
  player.wait(hour);
  player.command({ type: 'buy', station: 'dice' });
  const dice = () => player.view.data.locations[0].stations.find((row) => row.id === 'dice');
  assert.equal(dice().limit, 'service');
  assert.equal(dice().served, '0');
  player.command({ type: 'diagnose', station: 'dice' });
  assert.equal(player.view.data.diagnosis.limit, 'service');
  const costWithoutStaff = BigInt(dice().costs);
  player.command({ type: 'hire', role: 'service' });
  assert.equal(dice().limit, 'demand');
  assert.ok(BigInt(dice().costs) > costWithoutStaff);
  assert.equal(player.view.progress.find((item) => item.key === 'firstBottleneckResolved').met, true);
  player.command({ type: 'release-staff', role: 'service' });
  const empty = player.view.data.locations[0].staff.find((row) => row.role === 'service');
  assert.equal(empty.count, 0);
  assert.throws(() => player.command({ type: 'release-staff', role: 'service' }), { code: 'locked' });
  player.wait(3 * hour);
  for (let count = 0; count < 8; count++) player.command({ type: 'buy', station: 'dice' });
  assert.throws(() => player.command({ type: 'buy', station: 'dice' }), { code: 'no-space' });
  assert.ok(coins(player.view) >= 0n);
  player.wait(30 * day);
  assert.ok(coins(player.view) >= 0n);
  assert.ok(dice().paused > 0);
  assert.ok(player.view.data.locations[0].stations.find((row) => row.id === 'cards').paused === 0);
});

test('Spielhalle: normaler Verlauf erfüllt alle neun Stationstypen, fünf Standorte und alle Endgame-Ziele', async () => {
  const player = game(), visited = [];
  let p5, p3Writers, p4;
  await playHall({
    command(action) {
      player.command(action);
      if (action.type === 'hire' && action.role === 'croupier') p3Writers = player.state;
    },
    wait: player.wait.bind(player),
    milestone(phase, complete = false) {
      const view = player.view;
      assert.equal(view.phase.id, 'SH-P' + phase);
      assert.equal(view.data.complete, complete);
      assert.ok(coins(view) >= 0n);
      visited.push(phase);
      if (phase === 4) p4 = player.state;
      if (phase === 5 && !complete) p5 = player.state;
    },
  });
  assert.deepEqual(visited, [1, 2, 3, 4, 5, 5]);
  assert.ok(player.view.progress.every((item) => item.met));
  assert.equal(player.view.data.locations.length, 5);
  assert.equal(player.view.data.locations[0].stations.filter((row) => row.owned).length, 9);
  assert.ok(player.view.data.locations.every((location) => location.tier === 5));
  assert.ok(player.view.data.prestige.length > 0);
  let left = p3Writers.at + 1, right = p4.at;
  while (left < right) {
    const middle = Math.floor((left + right) / 2);
    if (engine.advance(p3Writers, middle).snapshot.phase === 'SH-P3') left = middle + 1;
    else right = middle;
  }
  const earlier = engine.advance(p3Writers, left - 1).snapshot, transition = engine.advance(p3Writers, left).snapshot;
  assert.equal(earlier.phase, 'SH-P3');
  assert.equal(transition.phase, 'SH-P4');
  assert.ok(!engine.view(earlier).data.locations[0].segments.some((slot) => slot.id === 'vip'));
  assert.ok(engine.view(transition).data.locations[0].segments.some((slot) => slot.id === 'vip'));
  assert.deepEqual(engine.advance(transition, p4.at).snapshot, p4);
  const eligible = player.view.data.prestige;
  assert.throws(() => engine.reset(player.state, [...eligible, 'guests-50']), { code: 'prestige-conflict' });
  assert.throws(() => engine.reset(p5, []), { code: 'prestige-conflict' });
  const reset = engine.reset(player.state, eligible);
  assert.equal(reset.phase, 'SH-P1');
  assert.equal(reset.data.stars, eligible.length);
  assert.equal(new Set(reset.data.claims).size, reset.data.stars);
  assert.equal(reset.data.guests, '0');
});

test('Spielhalle: Ereignis endet offline, Kosten und variable Raten liefern gesplittet dasselbe Ergebnis', async () => {
  const player = game();
  await playHall({ command: player.command.bind(player), wait: player.wait.bind(player), milestone() {} });
  player.command({ type: 'event', event: 'theme' });
  assert.throws(() => player.command({ type: 'event', event: 'tournament' }), { code: 'event-active' });
  const saved = player.state;
  const direct = engine.advance(saved, saved.at + hour);
  assert.equal(direct.segments, 2);
  assert.equal(direct.snapshot.data.locations[0].event, null);
  assert.throws(() => engine.command(direct.snapshot, saved.at + hour, { type: 'event', event: 'theme' }), { code: 'cooldown' });
  const split = engine.advance(saved, saved.at + minute).snapshot;
  assert.deepEqual(engine.advance(split, saved.at + hour).snapshot, direct.snapshot);
  const net0 = BigInt(player.view.data.rates.net);
  player.command({ type: 'marketing', budget: '10' });
  assert.notEqual(BigInt(player.view.data.rates.net), net0);
  player.wait(minute);
  assert.equal(player.view.data.locations[0].marketing, '0');
});

test('Spielhalle: Filialstrategien, Baulistenbudget und sicherer Wiederanlauf ändern nur ausgewählte Standorte', async () => {
  const player = game();
  await playHall({ command: player.command.bind(player), wait: player.wait.bind(player), milestone() {} });
  const atSite = (site, station) => player.view.data.locations.find((loc) => loc.profile === site).stations.find((row) => row.id === station);
  player.command({ type: 'manager', site: 'hafen', strategy: 'margin', budget: '0' });
  assert.equal(atSite('hafen', 'cards').price, 4);
  assert.equal(atSite('altstadt', 'cards').price, 3);
  player.command({ type: 'pause', site: 'altstadt', station: 'dice' });
  assert.equal(atSite('altstadt', 'dice').paused, 1);
  player.command({ type: 'controller', site: 'altstadt', restart: true, queue: ['chess', 'poker'], budget: '120' });
  assert.equal(atSite('altstadt', 'dice').paused, 0);
  assert.equal(atSite('altstadt', 'chess').owned, 2);
  assert.equal(atSite('altstadt', 'poker').owned, 1);
  assert.deepEqual(player.view.data.locations[0].controller.queue, ['poker']);
  assert.equal(player.view.data.locations[0].controller.budget, '0');
});

test('Spielhalle: schreibender Dienst speichert Renommee atomar mit neuer Revision. Alte Datei bringt es nicht zurück', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'spielhalle-save-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const store = createIdleFileStore(directory);
  const codec = createIdleExportCodec({ keys: { test: Buffer.alloc(32, 13) }, current: 'test' });
  let now = start, seq = 0;
  const service = createIdleSaveService({ engines: [engine], store, codec, now: () => now });
  const account = 'a'.repeat(32), id = 'spielhalle';
  const session = service.open(account, id);
  const fields = () => ({
    id: 'operation-' + ++seq, token: session.token, revision: session.revision, sessionVersion: session.sessionVersion,
  });
  await playHall({
    command(action) { Object.assign(session, service.command(account, id, { ...fields(), action })); },
    wait(ms) { now += ms; },
    milestone(phase, complete) {
      const view = service.view(account, id, session.token).view;
      assert.equal(view.data.phase, phase);
      assert.equal(view.data.complete, Boolean(complete));
    },
  });
  const claims = service.view(account, id, session.token).view.data.prestige;
  const saved = service.saveAndExport(account, id, fields());
  Object.assign(session, saved);
  const before = store.read(account, id);
  const request = { ...fields(), claims };
  const result = service.prestige(account, id, request);
  assert.deepEqual(service.prestige(account, id, request), result);
  const record = store.read(account, id);
  assert.notEqual(record.runId, before.runId);
  assert.equal(record.revision, 2);
  assert.equal(record.snapshot.data.stars, claims.length);
  assert.throws(() => service.previewImport(account, id, { token: session.token, file: saved.file }), { code: 'revision-conflict' });
});
