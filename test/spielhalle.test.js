import assert from 'node:assert/strict';
import test from 'node:test';
import { spielhalleEngine as engine } from '../server/idle/spielhalle.js';
import { PROFILES } from '../server/idle/spielhalle-config.js';
import { locationRates, rate, UNIT } from '../server/idle/spielhalle-rates.js';
import { createIdleFileStore, createIdleSaveService } from '../server/idle/savepoints.js';
import { createIdleExportCodec } from '../server/idle/exports.js';
import { day, hour, minute, playHall } from './spielhalle-playthrough.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const start = 1_790_000_000_000;
const coins = (view) => BigInt(view.data.coins);

function game(initial = engine.create(start)) {
  let state = initial;
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

function openGameHall() {
  const player = game();
  player.command({ type: 'manual' });
  player.command({ type: 'auto' });
  player.wait(hour);
  assert.equal(player.state.phase, 'SH-P2');
  return player;
}

function atSite(player, site = 'altstadt') {
  return player.view.data.locations.find((location) => location.profile === site);
}

function station(location, id) {
  return location.stations.find((row) => row.id === id);
}

function withRegularDemand(value, run) {
  // All normal sites have positive base demand. Override just this input
  // synchronously to exercise the same validated state through the real engine.
  const original = PROFILES.altstadt;
  PROFILES.altstadt = [value, original[1]];
  try { return run(); }
  finally { PROFILES.altstadt = original; }
}

test('SH-005: Ein einzelner Kartentisch bedient bei beiden Preisen dieselbe Standortnachfrage', () => {
  const base = openGameHall().state;
  const outlets = [1, 5].map((level) => {
    const player = game(base);
    player.command({ type: 'price', station: 'cards', level });
    assert.equal(player.state.at, base.at);
    assert.deepEqual(player.state.data.research, base.data.research);
    const location = atSite(player);
    assert.deepEqual(location.stations.filter(({ owned }) => owned).map(({ id }) => id), ['cards']);
    assert.deepEqual(location.staff.map(({ count }) => count), [0]);
    const cards = station(location, 'cards');
    assert.equal(cards.capacity, '80000000');
    assert.equal(cards.wanted, '50000000');
    assert.equal(cards.served, '50000000');
    assert.equal(cards.costs, '50000000');
    assert.deepEqual(location.segments, [{
      id: 'regular', demand: '50000000', wanted: '50000000', served: '50000000', refused: '0',
    }]);
    return cards;
  });
  assert.deepEqual(outlets.map(({ income, net }) => ({ income, net })), [
    { income: '240000000', net: '190000000' }, { income: '600000000', net: '550000000' },
  ]);
});

test('SH-005: Schach und Karten teilen dieselbe Nachfrage nach den relativen Preisgewichten', () => {
  const base = openGameHall();
  base.command({ type: 'buy', station: 'chess' });
  const compare = (level) => {
    const player = game(base.state);
    player.command({ type: 'price', station: 'cards', level });
    const location = atSite(player);
    const cards = station(location, 'cards'), chess = station(location, 'chess');
    assert.equal(chess.price, 3);
    assert.deepEqual(location.staff.map(({ count }) => count), [0]);
    assert.deepEqual([cards.capacity, chess.capacity], ['80000000', '150000000']);
    assert.equal(cards.limit, 'demand');
    assert.equal(chess.limit, 'demand');
    assert.equal(cards.served, cards.wanted);
    assert.equal(chess.served, chess.wanted);
    assert.equal(BigInt(cards.served) + BigInt(chess.served), rate('0.05'));
    assert.deepEqual(location.segments, [{
      id: 'regular', demand: '50000000', wanted: '50000000', served: '50000000', refused: '0',
    }]);
    assert.equal(BigInt(location.rates.gross), BigInt(cards.income) + BigInt(chess.income));
    return [cards.wanted, chess.wanted, location.rates.gross];
  };
  // Demand is split in proportions 1.30 : 0.85 and 0.60 : 0.85, respectively.
  assert.deepEqual(compare(1), ['30232558', '19767442', '184651162']);
  assert.deepEqual(compare(5), ['20689655', '29310345', '306896550']);
});

test('SH-001: Nullnachfrage erzeugt offline keine Gäste, aber laufende Betriebskosten', () => {
  const player = openGameHall();
  player.command({ type: 'buy', station: 'dice' });
  player.command({ type: 'hire', role: 'service' });
  const original = player.state;
  withRegularDemand('0', () => {
    assert.deepEqual(atSite(player).segments, [{ id: 'regular', demand: '0', wanted: '0', served: '0', refused: '0' }]);
    assert.deepEqual(atSite(player).rates, { gross: '0', costs: '50000000', net: '-50000000', served: '0' });
    const end = original.at + minute;
    const once = engine.advance(original, end).snapshot;
    const first = engine.advance(original, original.at + 17_000).snapshot;
    assert.deepEqual(engine.advance(first, end).snapshot, once);
    assert.equal(once.data.guests, original.data.guests);
    assert.equal(once.data.locations[0].guests, original.data.locations[0].guests);
    assert.equal(once.data.revenue, original.data.revenue);
    assert.equal(BigInt(once.data.coins), BigInt(original.data.coins) - rate('0.05') * BigInt(minute));
    assert.ok(BigInt(once.data.coins) >= 0n);
  });
});

test('SH-002: Platz und Service begrenzen die Bedienung, Restnachfrage wird einmal zugeteilt', () => {
  const player = openGameHall();
  player.command({ type: 'buy', station: 'dice' });
  player.command({ type: 'buy', station: 'chess' });
  player.command({ type: 'hire', role: 'service' });
  withRegularDemand('0.6', () => {
    const location = atSite(player);
    assert.deepEqual(['cards', 'dice', 'chess'].map((id) => {
      const { served, limit } = station(location, id);
      return [served, limit];
    }), [['80000000', 'space'], ['80000000', 'service'], ['150000000', 'space']]);
    assert.deepEqual(location.segments, [{
      id: 'regular', demand: '600000000', wanted: '600000000', served: '310000000', refused: '290000000',
    }]);
  });
  withRegularDemand('0.3', () => {
    const location = atSite(player);
    const cards = station(location, 'cards'), dice = station(location, 'dice'), chess = station(location, 'chess');
    assert.equal(cards.served, '80000000');
    assert.equal(dice.served, '80000000');
    const overflow = BigInt(cards.wanted) + BigInt(dice.wanted) - BigInt(cards.served) - BigInt(dice.served);
    assert.ok(overflow > 0n);
    assert.equal(BigInt(chess.served), BigInt(chess.wanted) + overflow / 2n);
    assert.equal(BigInt(location.segments[0].refused), overflow - overflow / 2n);
    assert.equal(BigInt(location.rates.served) + BigInt(location.segments[0].refused), rate('0.3'));
  });
});

test('SH-006: Zeit ohne Betrieb ersetzt keinen Meilenstein, S2 und S3 greifen an der Faktengrenze', () => {
  const inactive = game();
  inactive.wait(3650 * day);
  assert.equal(inactive.state.phase, 'SH-P1');
  assert.equal(inactive.state.data.guests, '0');
  assert.equal(atSite(inactive).reputation, '0');

  const player = game();
  player.command({ type: 'manual' });
  player.command({ type: 'auto' });
  const justBeforeS2 = engine.advance(player.state, start + 1_979_999).snapshot;
  const s2 = engine.advance(player.state, start + 1_980_000).snapshot;
  assert.equal(justBeforeS2.phase, 'SH-P1');
  assert.equal(BigInt(justBeforeS2.data.guests), 100n * UNIT - rate('0.05'));
  assert.equal(s2.phase, 'SH-P2');
  assert.equal(BigInt(s2.data.guests), 100n * UNIT);
  assert.deepEqual(engine.advance(justBeforeS2, s2.at).snapshot, s2);

  const hall = game(s2);
  hall.command({ type: 'buy', station: 'dice' });
  hall.command({ type: 'buy', station: 'chess' });
  hall.command({ type: 'diagnose', station: 'dice' });
  const unstaffed = engine.advance(hall.state, hall.state.at + 7 * day).snapshot;
  assert.ok(BigInt(unstaffed.data.revenue) >= 25_000n * UNIT);
  assert.equal(unstaffed.phase, 'SH-P2');
  hall.command({ type: 'hire', role: 'service' });
  const before = hall.state;
  let low = before.at, high = before.at + day;
  assert.equal(engine.advance(before, high).snapshot.phase, 'SH-P3');
  while (high - low > 1) {
    const mid = low + Math.floor((high - low) / 2);
    if (engine.advance(before, mid).snapshot.phase === 'SH-P2') low = mid;
    else high = mid;
  }
  const justBeforeS3 = engine.advance(before, low).snapshot;
  const s3 = engine.advance(before, high).snapshot;
  assert.equal(justBeforeS3.phase, 'SH-P2');
  assert.ok(BigInt(justBeforeS3.data.revenue) < 25_000n * UNIT);
  assert.ok(BigInt(s3.data.revenue) >= 25_000n * UNIT);
  assert.equal(s3.phase, 'SH-P3');
  assert.deepEqual(engine.advance(justBeforeS3, high).snapshot, s3);
});

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
  let p5, p3Writers, p4, newBranch;
  await playHall({
    command(action) {
      player.command(action);
      if (action.type === 'hire' && action.role === 'croupier') p3Writers = player.state;
      if (action.type === 'location' && action.profile === 'hafen') newBranch = player.state;
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
  assert.ok(BigInt(transition.data.casino) >= 250_000n * UNIT);
  assert.ok(BigInt(transition.data.locations[0].reputation) >= 10_000n * UNIT);
  assert.ok(BigInt(earlier.data.casino) < 250_000n * UNIT || BigInt(earlier.data.locations[0].reputation) < 10_000n * UNIT);
  assert.ok(!engine.view(earlier).data.locations[0].segments.some((slot) => slot.id === 'vip'));
  assert.ok(engine.view(transition).data.locations[0].segments.some((slot) => slot.id === 'vip'));
  assert.deepEqual(engine.advance(earlier, left).snapshot, transition);
  assert.deepEqual(engine.advance(transition, p4.at).snapshot, p4);

  // Filialverwaltung alone must not count the unopened service counter as a guest.
  assert.equal(newBranch.data.research.automation, 3);
  assert.equal(newBranch.phase, 'SH-P4');
  const beforeFirstGuest = engine.advance(newBranch, newBranch.at + 12_499).snapshot;
  const firstGuest = engine.advance(newBranch, newBranch.at + 12_500).snapshot;
  assert.equal(beforeFirstGuest.phase, 'SH-P4');
  assert.equal(BigInt(beforeFirstGuest.data.locations[1].guests), UNIT - rate('0.08'));
  assert.equal(firstGuest.phase, 'SH-P5');
  assert.equal(BigInt(firstGuest.data.locations[1].guests), UNIT);
  assert.deepEqual(engine.advance(beforeFirstGuest, firstGuest.at).snapshot, firstGuest);
  const eligible = player.view.data.prestige;
  assert.throws(() => engine.reset(player.state, [...eligible, 'guests-50']), { code: 'prestige-conflict' });
  assert.throws(() => engine.reset(p5, []), { code: 'prestige-conflict' });
  const reset = engine.reset(player.state, eligible);
  assert.equal(reset.phase, 'SH-P1');
  assert.equal(reset.data.stars, eligible.length);
  assert.equal(new Set(reset.data.claims).size, reset.data.stars);
  assert.equal(reset.data.guests, '0');
});

test('SH-008: VIP und reguläre Gäste teilen den vorhandenen Service, Croupiers und Sicherheit', async () => {
  const player = game();
  await playHall({ command: player.command.bind(player), wait: player.wait.bind(player), milestone() {} });
  const rates = () => locationRates(player.state.data, player.state.data.locations[0], player.view.data.phase, player.state.at);
  const row = (location, id) => location.rows.find((entry) => entry.id === id);
  const used = (location, role) => location.rows.reduce((sum, entry) => sum + (entry.hands[role] ?? 0n), 0n);

  const staffed = rates();
  assert.deepEqual(player.state.data.locations[0].staff, { service: 1, croupier: 1, security: 2 });
  assert.equal(player.state.data.research.personnel, 4);
  assert.equal(used(staffed, 'service'), rate('0.096'));
  assert.equal(used(staffed, 'croupier'), rate('0.456'));
  assert.equal(row(staffed, 'vipLounge').hands.service, rate('0.096'));
  assert.equal(row(staffed, 'dice').served, 0n);
  assert.equal(row(staffed, 'arcade').served, 0n);
  assert.ok(row(staffed, 'poker').served > 0n && row(staffed, 'blackjack').served > 0n && row(staffed, 'roulette').served > 0n);
  assert.ok(used(staffed, 'security') <= 2n * rate('0.72'));
  assert.notEqual(row(staffed, 'poker').capacity, row(staffed, 'blackjack').capacity);
  for (const entry of staffed.rows) assert.ok(entry.served <= entry.capacity, entry.id);
  for (const segment of staffed.segments) assert.equal(segment.served + segment.refused, segment.demand);

  player.command({ type: 'release-staff', role: 'security' });
  const oneGuard = rates();
  assert.equal(row(oneGuard, 'roulette').limit, 'security');
  assert.equal(row(oneGuard, 'roulette').served, 0n);
  assert.equal(row(oneGuard, 'vipLounge').served, rate('0.096'));
  assert.equal(used(oneGuard, 'croupier'), rate('0.456'));
  assert.equal(used(oneGuard, 'security'), rate('0.096'));

  player.command({ type: 'release-staff', role: 'security' });
  const noGuard = rates();
  assert.equal(row(noGuard, 'vipLounge').limit, 'security');
  assert.equal(row(noGuard, 'vipLounge').served, 0n);
  assert.equal(used(noGuard, 'security'), 0n);
  assert.ok(used(noGuard, 'service') <= rate('0.096'));
  assert.ok(row(noGuard, 'dice').served > 0n && row(noGuard, 'arcade').served > 0n);
  assert.ok(noGuard.segments[1].served > oneGuard.segments[1].served);
  assert.ok(noGuard.segments[0].served < oneGuard.segments[0].served);
});

test('SH-012: gleich ausgestattete Filialen rechnen ihre eigenen Gästeprofile und Erträge ab', async () => {
  const player = game();
  await playHall({ command: player.command.bind(player), wait: player.wait.bind(player), milestone() {} });
  for (const site of ['hafen', 'kurort']) {
    player.command({ type: 'buy', site, station: 'chess' });
    player.command({ type: 'buy', site, station: 'cards' });
  }
  const hafen = atSite(player, 'hafen'), kurort = atSite(player, 'kurort');
  assert.equal(hafen.tier, kurort.tier);
  assert.equal(hafen.comfort, kurort.comfort);
  assert.deepEqual(hafen.stations.map(({ owned, price }) => [owned, price]), kurort.stations.map(({ owned, price }) => [owned, price]));
  assert.deepEqual(hafen.staff, kurort.staff);
  assert.ok(BigInt(hafen.segments[1].demand) > BigInt(kurort.segments[1].demand));
  assert.ok(BigInt(hafen.rates.served) > BigInt(kurort.rates.served));
  assert.ok(BigInt(hafen.rates.gross) > BigInt(kurort.rates.gross));

  const before = player.state;
  const priorLocations = player.view.data.locations;
  const elapsed = 1000n;
  player.wait(Number(elapsed));
  let guestDelta = 0n, grossDelta = 0n;
  for (const [index, location] of priorLocations.entries()) {
    const produced = BigInt(player.state.data.locations[index].guests) - BigInt(before.data.locations[index].guests);
    assert.equal(produced, BigInt(location.rates.served) * elapsed, location.profile);
    guestDelta += produced;
    grossDelta += BigInt(location.rates.gross) * elapsed;
  }
  assert.equal(BigInt(player.state.data.guests) - BigInt(before.data.guests), guestDelta);
  assert.equal(BigInt(player.state.data.revenue) - BigInt(before.data.revenue), grossDelta);
  const other = atSite(player, 'kurort');
  player.command({ type: 'price', site: 'hafen', station: 'cards', level: 5 });
  assert.equal(station(atSite(player, 'hafen'), 'cards').price, 5);
  assert.deepEqual(atSite(player, 'kurort'), other);
  assert.equal(player.state.data.locations.length, before.data.locations.length);
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

test('SH-007 / CORE-016: Renommee übernimmt nur neue Ansprüche, setzt den Run zurück und speichert atomar', async (t) => {
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
  const play = () => playHall({
    command(action) { Object.assign(session, service.command(account, id, { ...fields(), action })); },
    wait(ms) { now += ms; },
    milestone(phase, complete) {
      const view = service.view(account, id, session.token).view;
      assert.equal(view.data.phase, phase);
      assert.equal(view.data.complete, Boolean(complete));
    },
  });
  await play();
  const currentView = () => service.view(account, id, session.token);
  const claims = currentView().view.data.prestige;
  assert.ok(claims.length > 0);
  assert.equal(new Set(claims).size, claims.length);
  const saved = service.saveAndExport(account, id, fields());
  Object.assign(session, saved);
  const before = store.read(account, id);
  const invalid = [...claims, 'guests-50'];
  for (const requested of [[], [claims[0], ...claims], invalid, claims.slice(1)]) {
    assert.throws(() => service.prestige(account, id, { ...fields(), claims: requested }), { code: 'prestige-conflict' });
    assert.deepEqual(store.read(account, id), before);
    assert.deepEqual(currentView().view.data.prestige, claims);
  }
  now += 1000;
  const request = { ...fields(), claims };
  const result = service.prestige(account, id, request);
  assert.deepEqual(service.prestige(account, id, request), result);
  const record = store.read(account, id);
  assert.deepEqual(result, { revision: before.revision + 1, savedAt: now });
  assert.notEqual(record.runId, before.runId);
  assert.equal(record.snapshot.at, now);
  assert.ok(record.snapshot.at > before.snapshot.at);
  assert.equal(record.snapshot.phase, 'SH-P1');
  // A new run has exactly the normal starting state, plus its retained record.
  const fresh = engine.create(now);
  assert.deepEqual(record.snapshot.data, { ...fresh.data, claims, stars: claims.length });
  assert.equal(currentView().dirty, false);
  assert.equal(currentView().revision, result.revision);
  assert.deepEqual(currentView().settlement, { from: now, to: now, segments: 0 });
  assert.throws(() => service.prestige(account, id, { ...request, claims: invalid }), { code: 'operation-conflict' });
  assert.throws(() => service.prestige(account, id, { ...request, id: 'different-request' }), { code: 'revision-conflict' });
  assert.deepEqual(store.read(account, id), record);
  assert.throws(() => service.previewImport(account, id, { token: session.token, file: saved.file }), { code: 'revision-conflict' });

  Object.assign(session, result);
  await play();
  now += 3650 * day;
  const newClaims = currentView().view.data.prestige;
  assert.ok(newClaims.length > 0);
  assert.ok(newClaims.every((claim) => !claims.includes(claim)));
  const secondRequest = { ...fields(), claims: newClaims };
  const second = service.prestige(account, id, secondRequest);
  assert.deepEqual(service.prestige(account, id, secondRequest), second);
  const secondRecord = store.read(account, id);
  assert.equal(second.revision, record.revision + 1);
  assert.notEqual(secondRecord.runId, record.runId);
  assert.equal(secondRecord.snapshot.at, now);
  assert.deepEqual(secondRecord.snapshot.data.claims, [...claims, ...newClaims]);
  assert.equal(secondRecord.snapshot.data.stars, claims.length + newClaims.length);
});
