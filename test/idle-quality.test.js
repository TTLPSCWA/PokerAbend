import assert from 'node:assert/strict';
import test from 'node:test';
import { spielhalleEngine as hall } from '../server/idle/spielhalle.js';
import { studioEngine as studio } from '../server/idle/studio.js';
import { factoryEngine as factory } from '../server/idle/factory.js';
import { playHall } from './spielhalle-playthrough.js';
import { playFactory } from './factory-playthrough.js';

const epoch = 1_790_000_000_000;
const second = 1000, minute = 60 * second, hour = 60 * minute, day = 24 * hour;
const cell = (type, x, y, rotation = 0, settings = {}) => ({ type, x, y, rotation, ...settings });

function game(engine, start = engine.create(epoch)) {
  let snapshot = start;
  return {
    get snapshot() { return snapshot; },
    seconds: () => (snapshot.at - epoch) / second,
    view: () => engine.view(snapshot),
    command(action) { snapshot = engine.command(snapshot, snapshot.at, action); },
    wait(ms) {
      const result = engine.advance(snapshot, snapshot.at + ms);
      snapshot = result.snapshot;
      return result.segments;
    },
    fork: () => game(engine, snapshot),
  };
}

function change(g, type, fields = {}) {
  g.command({ type, ...fields });
}

function split(engine, base, elapsed) {
  const target = base.at + elapsed;
  const through = engine.advance(base, target);
  let intervals = base;
  for (const fraction of [0.14, 0.31, 0.73, 1]) {
    intervals = engine.advance(intervals, base.at + Math.floor(fraction * elapsed)).snapshot;
  }
  assert.deepEqual(intervals, through.snapshot);
  return through;
}

async function checkpoint(engine, play, stop) {
  const g = game(engine), reached = new Error('QA checkpoint');
  try {
    await play({ ...g, milestone(phase, complete) { if (stop(phase, complete, g)) throw reached; } });
  } catch (error) {
    if (error === reached) return g;
    throw error;
  }
  assert.fail('Expected phase checkpoint');
}

test('QA Spielhalle: langsam, defizitär ohne Personal und mit eigener Preisstrategie', (t) => {
  const cautious = game(hall);
  for (let i = 0; i < 3; i++) {
    change(cautious, 'manual');
    cautious.wait(day);
  }
  assert.equal(cautious.view().phase.id, 'SH-P1');
  assert.equal(cautious.view().progress.find(({ key }) => key === 'servedGuests').current, '3');
  assert.equal(cautious.snapshot.data.coins, '40000000000000');
  change(cautious, 'auto');
  cautious.wait(4 * hour);
  assert.equal(cautious.view().phase.id, 'SH-P2');

  const strategies = {
    cards: [{ type: 'price', station: 'cards', level: 1 }, { type: 'buy', station: 'cards' }],
    unstaffed: [{ type: 'buy', station: 'dice' }, { type: 'price', station: 'dice', level: 5 }],
    mixed: [{ type: 'research', branch: 'visitors' }, { type: 'buy', station: 'chess' },
      { type: 'buy', station: 'dice' }, { type: 'diagnose', station: 'dice' },
      { type: 'hire', role: 'service' }, { type: 'price', station: 'cards', level: 4 }],
  };
  cautious.wait(hour);
  const out = {};
  for (const [id, actions] of Object.entries(strategies)) {
    const branch = cautious.fork();
    for (const action of actions) branch.command(action);
    const data = branch.view().data;
    if (id === 'unstaffed') {
      const dice = data.locations[0].stations.find((row) => row.id === 'dice');
      assert.equal(dice.served, '0');
      assert.equal(dice.limit, 'service');
      assert.ok(BigInt(dice.net) < 0n);
      branch.wait(day);
      change(branch, 'pause', { station: 'dice' });
      assert.ok(BigInt(branch.view().data.rates.net) > BigInt(data.rates.net));
    }
    out[id] = { netPerSecond: Number(data.rates.net) / 1e9, servedPerSecond: Number(data.rates.served) / 1e9 };
    const { snapshot } = split(hall, branch.snapshot, 5 * day);
    assert.ok(BigInt(snapshot.data.coins) >= 0n);
    out[id].phaseAfterFiveDays = snapshot.phase;
  }
  assert.ok(out.mixed.netPerSecond > out.unstaffed.netPerSecond);
  const strained = cautious.fork();
  assert.throws(() => change(strained, 'room', { room: 1 }), { code: 'already-open' });
  change(strained, 'price', { station: 'cards', level: 1 });
  for (let i = 0; i < 7; i++) change(strained, 'buy', { station: 'dice' });
  assert.ok(BigInt(strained.view().data.rates.net) < 0n);
  strained.wait(60 * day);
  const recovered = strained.view().data;
  assert.ok(BigInt(recovered.coins) >= 0n);
  assert.ok(BigInt(recovered.rates.net) > 0n);
  assert.ok(recovered.locations[0].stations.find(({ id }) => id === 'dice').paused > 0);
  t.diagnostic(JSON.stringify({ cautiousStart: '3 Gäste nach 3 Tagen, S2 eine Stunde nach Autogeber', ...out }));
});

test('QA Spielhalle: zwei Standortprofile, separater 200-Gäste-Pilot und Leerlauf-Endgame', async (t) => {
  const base = await checkpoint(hall, playHall, (phase) => phase === 4);
  const comparison = {};
  for (const profile of ['kurort', 'bahnhof']) {
    const branch = base.fork();
    for (let i = 0; i < 3; i++) change(branch, 'research', { branch: 'automation' });
    change(branch, 'location', { profile });
    assert.equal(branch.view().phase.id, 'SH-P4');
    const first = branch.snapshot;
    const reach = (snapshot, target) => BigInt(hall.view(snapshot).data.locations[1].guests) >= BigInt(target);
    let low = 0, high = hour;
    assert.ok(reach(hall.advance(first, first.at + high).snapshot, 200));
    for (const guests of [1, 200]) {
      let from = low, to = high;
      while (to - from > 1) {
        const middle = Math.floor((from + to) / 2);
        if (reach(hall.advance(first, first.at + middle).snapshot, guests)) to = middle;
        else from = middle;
      }
      low = to;
      branch.wait(to - (branch.snapshot.at - first.at));
      assert.equal(branch.view().phase.id, 'SH-P5');
      const site = branch.view().data.locations[1];
      assert.ok(BigInt(site.rates.net) > 0n);
      (comparison[profile] ??= {})['secondsTo' + guests] = to / second;
    }
    change(branch, 'comfort', { site: profile });
    change(branch, 'buy', { site: profile, station: 'poker' });
    const stopped = branch.view().data.locations[1].stations.find((row) => row.id === 'poker');
    assert.equal(stopped.served, '0');
    change(branch, 'hire', { site: profile, role: 'croupier' });
    assert.ok(BigInt(branch.view().data.locations[1].stations.find((row) => row.id === 'poker').served) > 0n);
    for (let level = 1; level <= 3; level++) change(branch, 'research', { branch: 'personnel' });
    change(branch, 'pause', { site: profile, station: 'poker' });
    for (const room of [1, 2, 3]) change(branch, 'room', { site: profile, room });
    change(branch, 'buy', { site: profile, station: 'vipLounge' });
    const vip = () => branch.view().data.locations[1].stations.find(({ id }) => id === 'vipLounge');
    assert.equal(vip().limit, 'security');
    change(branch, 'hire', { site: profile, role: 'security' });
    assert.equal(vip().limit, 'service');
    change(branch, 'hire', { site: profile, role: 'service' });
    assert.ok(BigInt(vip().served) > 0n);
    comparison[profile].vipPerSecond = Number(vip().served) / 1e9;
    comparison[profile].vipNetPerSecond = Number(vip().net) / 1e9;
    const { snapshot } = split(hall, branch.snapshot, 365 * day);
    assert.equal(hall.view(snapshot).data.complete, false);
    comparison[profile].remaining = hall.view(snapshot).progress.filter(({ met }) => !met).map(({ key }) => key);
  }
  t.diagnostic(JSON.stringify(comparison));
});

function plan(name, options = {}) {
  return { type: 'start', name, size: 'mini', depth: 'normal', genre: 'puzzle', topic: 'animals',
    audience: 'casual', platform: 'pc', team: 1, ...options };
}

function finish(g, name, options) {
  g.command(plan(name, options));
  const start = g.snapshot.at;
  for (let steps = 0; steps < 6; steps++) {
    const p = g.view().data.projects.find(({ plan: item }) => item.name === name);
    if (p.stage === 'gate') {
      change(g, 'release', { id: p.id });
      const title = g.view().data.releases.find(({ id }) => id === p.id);
      return { rating: title.rating, seconds: (g.snapshot.at - start) / second, units: title.markets[0].cap };
    }
    assert.ok(p.slot, 'missing funds or staff for ' + name + ' at ' + p.stage);
    g.wait(p.slot.end - g.snapshot.at);
  }
  assert.fail('Project did not reach release gate');
}

test('QA Studio: begrenztes Budget, Projektabbruch, Qualität gegen Tempo und endliche Märkte', (t) => {
  const stalled = game(studio);
  stalled.command(plan('Zu knapp', { size: 'small', limit: 1 }));
  assert.equal(stalled.view().data.projections[0].locked, true);
  stalled.wait(30 * day);
  assert.equal(stalled.view().data.projects[0].stage, 'concept');
  assert.equal(stalled.view().data.budget, '80000');
  assert.throws(() => change(stalled, 'cancel', { id: 1 }), { code: 'studio-stage' });
  change(stalled, 'cancel', { id: 1, confirm: true });
  change(stalled, 'side-job');
  assert.throws(() => change(stalled, 'side-job'), { code: 'studio-stage' });
  stalled.wait(minute);
  assert.equal(stalled.view().data.budget, '95000');
  stalled.command(plan('Abgebrochen'));
  stalled.wait(10 * second);
  change(stalled, 'cancel', { id: 2, confirm: true });
  assert.equal(stalled.view().data.budget, '90880', 'spent tools and ten seconds of work remain booked');
  const out = {};
  for (const depth of ['rush', 'normal', 'thorough']) {
    const branch = game(studio);
    out[depth] = finish(branch, 'Budgetprobe', { depth });
    const { snapshot } = split(studio, branch.snapshot, 3650 * day);
    assert.equal(Number(snapshot.data.runSales), out[depth].units);
    assert.equal(snapshot.data.releases[0].markets[0].sold, out[depth].units);
  }
  const larger = finish(game(studio), 'Größeres Erstprojekt', { size: 'small', depth: 'thorough' });
  assert.ok(out.rush.seconds < out.thorough.seconds);
  assert.ok(out.rush.rating < out.thorough.rating);
  assert.ok(larger.units > out.thorough.units);
  assert.ok(larger.seconds > 10 * out.thorough.seconds);
  t.diagnostic(JSON.stringify({ ...out, larger }));
});

test('QA Studio: eigener G1-G3-Weg und unterschiedlich skalierte G3-Projekte', (t) => {
  const g = game(studio);
  finish(g, 'Eilstart', { depth: 'rush' });
  finish(g, 'Zweites Debüt', { genre: 'adventure', topic: 'fantasy' });
  g.wait(4 * hour);
  assert.equal(g.view().phase.id, 'GS-P2');
  const results = { hoursToG2: g.seconds() / 3600 };
  finish(g, 'Qualitätsnachweis', { depth: 'thorough', genre: 'adventure', topic: 'pirates' });
  change(g, 'research', { id: 'marketing1' });
  assert.equal(g.view().phase.id, 'GS-P3');
  results.hoursToG3 = g.seconds() / 3600;
  for (const role of ['qa', 'code', 'research', 'marketing', 'art', 'code']) change(g, 'hire', { role, team: 1 });
  for (const [genre, topic] of [['building', 'pirates'], ['action', 'space'], ['sport', 'cooking']]) {
    finish(g, 'Eigenfinanziert ' + genre, { size: 'small', genre, topic });
    g.wait(2 * day);
  }
  for (const [id, size, depth, marketing] of [
    ['miniRush', 'mini', 'rush', 0], ['smallQa', 'small', 'thorough', 0],
    ['largeOrganic', 'large', 'thorough', 0], ['largeCampaign', 'large', 'thorough', 10],
  ]) {
    const branch = g.fork();
    const before = BigInt(branch.view().data.salesRevenue);
    results[id] = finish(branch, id, { size, depth, marketing, genre: 'strategy', topic: 'fantasy' });
    const { snapshot: complete } = split(studio, branch.snapshot, 50 * day);
    assert.ok(BigInt(complete.data.salesRevenue) >= before);
    results[id].phaseAfter50Days = complete.phase;
    results[id].gameRevenueWithExistingCatalogue = String((BigInt(complete.data.salesRevenue) - before) / 100n);
  }
  assert.ok(results.largeCampaign.units > results.largeOrganic.units);
  assert.equal(results.largeCampaign.rating, results.largeOrganic.rating);
  const later = g.fork();
  finish(later, 'Organischer Großtitel', { size: 'large', genre: 'strategy', topic: 'fantasy' });
  later.wait(10 * day);
  finish(later, 'Variierter Großtitel', { size: 'large', genre: 'adventure', topic: 'pirates' });
  later.wait(10 * day);
  assert.equal(later.view().phase.id, 'GS-P4');
  results.daysToG4 = later.seconds() / 86_400;
  for (const [id, points] of [['editor', 2], ['engine1', 20], ['engine2', 30], ['engine3', 45]]) {
    while (later.view().data.researchPoints < points) {
      change(later, 'lab', { team: 1 });
      later.wait(30 * minute);
    }
    change(later, 'research', { id });
  }
  change(later, 'studio');
  change(later, 'team', { studio: 2 });
  change(later, 'hire', { role: 'qa', team: 2 });
  finish(later, 'Kleiner Titel vom zweiten Standort', { team: 2, size: 'small', genre: 'action', topic: 'space' });
  assert.equal(later.view().phase.id, 'GS-P5');
  results.daysToG5 = later.seconds() / 86_400;
  change(later, 'studio');
  change(later, 'studio');
  for (const id of later.view().data.licensees) change(later, 'license', { id });
  const passive = split(studio, later.snapshot, 5 * 365 * day);
  const completed = studio.view(passive.snapshot).progress.filter(({ met }) => met).map(({ key }) => key);
  assert.deepEqual(completed, ['studios', 'engineLicenses']);
  results.goalsAfterFiveYearsWithoutNewReleases = completed;
  t.diagnostic(JSON.stringify(results));
});

test('QA Factory: manueller Start, Fehlkauf, Engpass und Lagergrenze mit zwei Layouts', (t) => {
  const hand = game(factory);
  for (let count = 0; count < 9; count++) {
    change(hand, 'mine', { field: 'startA' });
    change(hand, 'sell', { region: 1, good: 'ironOre' });
    hand.wait(3 * second);
  }
  change(hand, 'mine', { field: 'startA' });
  change(hand, 'sell', { region: 1, good: 'ironOre' });
  hand.wait(second);
  assert.equal(hand.view().phase.id, 'FE-P2');
  const direct = game(factory);
  change(direct, 'layout', { region: 1, build: [cell('drill', 9, 5, 2)] });
  direct.wait(day);
  assert.equal(direct.view().data.record.ironOreSold, '0');
  const drill = () => direct.view().data.buildings.find(({ type }) => type === 'drill');
  assert.equal(drill().disconnectedOutput, true);
  for (let i = 0; i < 2; i++) change(direct, 'rotate', { id: 5 });
  assert.equal(drill().disconnectedOutput, false);
  direct.wait(10 * second);
  assert.equal(direct.view().phase.id, 'FE-P2');

  const money = BigInt(direct.view().data.free);
  assert.throws(() => change(direct, 'layout', { region: 1, build: [cell('belt', 2, 6), cell('belt', 2, 6)] }),
    { code: 'factory-placement' });
  assert.equal(BigInt(direct.view().data.free), money);
  const reserves = direct.view().data.fields.find((row) => row.id === 'startA').stocks;
  assert.equal(reserves.line, '200000');
  const free = direct.view().data.free;
  change(direct, 'remove', { id: 5 });
  assert.equal(BigInt(direct.view().data.free) - BigInt(free), 15_000n);
  const layout = [
    cell('drill', 0, 0), cell('belt', 2, 0), cell('furnace', 3, 0),
    cell('belt', 5, 0), cell('warehouse', 6, 0, 0, { good: 'ironIngot' }),
  ];
  const bound = direct.fork();
  assert.throws(() => change(bound, 'layout', { region: 1, build: layout }), { code: 'factory-budget' });
  change(bound, 'layout', { region: 1, scope: 'line', build: layout });
  const band = bound.view().data.buildings.find(({ type }) => type === 'belt');
  assert.equal(band.band.limited, true);
  change(bound, 'inspect', { id: band.id });
  assert.equal(bound.view().data.record.beltBottleneckShown, true);
  const { snapshot: stopped, segments } = split(factory, bound.snapshot, 3650 * day);
  assert.ok(segments < 50);
  assert.equal(factory.view(stopped).data.record.ironIngotsDeliveredByBelt, '0');
  assert.equal(factory.view(stopped).data.buildings.find(({ type }) => type === 'warehouse').inventory, '100000');
  t.diagnostic(JSON.stringify({ handSeconds: hand.seconds(), directProductionSeconds: 10, wrongDrillAfterOneDay: 0,
    storedFromBoundOre: 100, beltRate: 5, offeredRate: 10, tenYearSegments: segments }));
});

test('QA Factory: zweiter später Layoutfall mit unterbrochener Bahn und stillgelegter Produktion', async (t) => {
  const base = await checkpoint(factory, playFactory, (phase, done) => phase === 5 && done);
  const { data } = base.view();
  const track = data.tracks.find((row) => data.buildings.find(({ id }) => id === row.destination).region === 4);
  const disrupted = base.fork();
  const before = BigInt(disrupted.view().data.record.runControlModules);
  const generator = data.buildings.find((row) => row.region === 4 && row.type === 'generator');
  change(disrupted, 'toggle', { id: generator.id });
  assert.equal(disrupted.view().data.record.connectedRegions, '3');
  assert.throws(() => change(disrupted, 'dispatch', { id: track.id }), { code: 'factory-rail' });
  const ended = split(factory, disrupted.snapshot, 30 * day);
  assert.equal(factory.view(ended.snapshot).data.record.connectedRegions, '3');
  assert.ok(BigInt(factory.view(ended.snapshot).data.record.runControlModules) > before);
  const modulePlant = data.buildings.find(({ type }) => type === 'modulePlant');
  change(disrupted, 'toggle', { id: modulePlant.id });
  disrupted.wait(day);
  assert.equal(BigInt(disrupted.view().data.record.runControlModules), before);
  change(disrupted, 'toggle', { id: generator.id });
  change(disrupted, 'toggle', { id: modulePlant.id });
  assert.equal(disrupted.view().data.record.connectedRegions, '4');
  assert.ok(disrupted.view().progress.every(({ met }) => met));
  assert.throws(() => factory.reset(factory.reset(base.snapshot, data.eligible), data.eligible), { code: 'prestige-conflict' });
  const coast = data.tracks.find((row) => data.buildings.find(({ id }) => id === row.source).region === 2);
  const source = base.fork();
  for (let i = 0; i < 6; i++) {
    change(source, 'mine', { field: 'coast' });
    source.wait(3 * second);
  }
  change(source, 'move', { region: 2, good: 'copperOre', to: coast.source });
  const incoming = (g) => g.view().data.buildings.find(({ id }) => id === coast.destination).inventory;
  const one = source.fork();
  change(one, 'dispatch', { id: coast.id });
  one.wait(239 * second);
  assert.equal(incoming(one), '0');
  change(one, 'toggle', { id: coast.destination });
  one.wait(day);
  assert.equal(incoming(one), '0');
  change(one, 'toggle', { id: coast.destination });
  one.wait(second);
  assert.equal(incoming(one), '50000');
  one.wait(120 * second);
  assert.equal(incoming(one), '60000');
  change(source, 'remove-track', { id: coast.id });
  change(source, 'track', { source: coast.source, destination: coast.destination, wagons: 3, auto: false });
  change(source, 'dispatch', { id: source.view().data.tracks.find(({ source: id }) => id === coast.source).id });
  source.wait(240 * second);
  assert.equal(incoming(source), '60000');
  t.diagnostic(JSON.stringify({ connectedWithoutPower: 3, monthSegments: ended.segments,
    modulesWithoutRailPower: factory.view(ended.snapshot).data.record.runControlModules, pauseStopsModules: true,
    arrivalAtPlateau: { oneWagonAt240: 50, oneWagonAt360: 60, threeWagonsAt240: 60 } }));
});
