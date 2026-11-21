import assert from 'node:assert/strict';
import test from 'node:test';
import {
  automationEnabled, buyUpgrade, createIdleEngine, formatQuantity, geometricCost, produceBatches, quantity, transact,
} from '../public/idle/engine.js';
import { IDLE_GAME_IDS, phasesFor } from '../public/idle/progression.js';
import { SINGLEPLAYER_GAMES } from '../games/singleplayer/index.js';
import { GAMES } from '../games/index.js';

const reject = (fn, code) => assert.throws(fn, { name: 'IdleError', code });
const day = 86_400_000;
const year = 365 * day;
const zero = 1_790_000_000_000;

function makeEngine(id, { currency, initial, interval, output, cap, maxSegments } = {}) {
  const batch = output || '1';
  return createIdleEngine({
    id, stateVersion: 1, rulesVersion: 1,
    create: () => ({ balances: { [currency]: initial }, carry: 0, automation: false, facts: {} }),
    validate: (data) => Boolean(data && Number.isInteger(data.carry) && data.carry >= 0 && data.carry < interval &&
      typeof data.automation === 'boolean' && data.facts && quantity(data.balances[currency]) >= 0n),
    facts: (data) => data.facts,
    advance(data, { from, to }) {
      if (!data.automation) return { until: to, data };
      const production = produceBatches(data.balances, { elapsed: to - from, interval, carry: data.carry,
        earn: { [currency]: batch }, caps: cap ? { [currency]: cap } : {} });
      return { until: to, data: { ...data, carry: production.carry, balances: production.balances } };
    },
    command(data, action) {
      if (action.type === 'set-facts') return { ...data, facts: { ...data.facts, ...action.facts } };
      if (action.type === 'activate') return { ...data, automation: true };
      return { ...data, balances: transact(data.balances, action.transfer) };
    },
  }, phasesFor(id), { maxSegments });
}

test('Ressourcen sind exakt, atomar, nicht negativ und nicht durch die eigene Ausgabe finanzierbar', () => {
  const state = { coins: '900719925474099312345', ore: '2', parts: '0' };
  const next = transact(state, { spend: { ore: '2' }, earn: { parts: '1', coins: '19' } });
  assert.deepEqual(next, { coins: '900719925474099312364', ore: '0', parts: '1' });
  reject(() => transact(state, { spend: { ore: '3' }, earn: { ore: '10' } }), 'insufficient-funds');
  reject(() => transact(state, { earn: { parts: '2' }, caps: { parts: '1' } }), 'capacity-exceeded');
  reject(() => transact(state, { earn: { alien: '1' } }), 'invalid-resource');
  assert.equal(state.ore, '2');
  for (const invalid of ['-1', '01', '1e3', '1.0', 20, '9'.repeat(81)]) reject(() => quantity(invalid), 'invalid-quantity');
});

test('Preise werden exakt aufgerundet und Upgrades nur freigegeben und finanzierbar gekauft', () => {
  const definition = { id: 'drill', currency: 'credits', base: '101', numerator: '3', denominator: '2', maxLevel: 2 };
  assert.equal(geometricCost('101', { ...definition, level: 2 }), '228');
  const balances = { credits: '253' }, levels = { drill: 0 };
  reject(() => buyUpgrade(balances, levels, definition, []), 'locked-upgrade');
  const first = buyUpgrade(balances, levels, definition, ['drill']);
  assert.deepEqual(first, { balances: { credits: '152' }, levels: { drill: 1 }, cost: '101' });
  const second = buyUpgrade(first.balances, first.levels, definition, ['drill']);
  assert.deepEqual(second, { balances: { credits: '0' }, levels: { drill: 2 }, cost: '152' });
  reject(() => buyUpgrade(second.balances, second.levels, definition, ['drill']), 'upgrade-limit');
  assert.equal(formatQuantity('9007199254740993123456', { scale: 2 }), '90.071.992.547.409.931.234,56');
  assert.equal(formatQuantity('1201', { scale: 3, locale: 'en-US' }), '1.201');
});

test('Automatisierung braucht Freischaltung, Zustimmung und ein ausreichendes exaktes Budget', () => {
  const state = { available: ['A1'], enabled: [], remainingBudget: '9007199254740993', cost: '9007199254740993' };
  assert.equal(automationEnabled('A1', state), false);
  assert.equal(automationEnabled('A1', { ...state, enabled: ['A1'] }), true);
  assert.equal(automationEnabled('A1', { ...state, enabled: ['A1'], cost: '9007199254740994' }), false);
  assert.equal(automationEnabled('A4', { ...state, enabled: ['A4'] }), false);
  const studio = makeEngine('studio', { currency: 'budget', interval: 100, initial: '0' });
  let snapshot = studio.command(studio.create(zero), zero, {
    type: 'set-facts', facts: { releases: '2', fans: '30' },
  });
  assert.deepEqual(studio.view(snapshot).automations, ['G-A1']);
  snapshot = studio.command(snapshot, zero, {
    type: 'set-facts', facts: { buildPipelineResearched: true, releaseRulesResearched: true },
  });
  assert.deepEqual(studio.view(snapshot).automations, ['G-A1', 'G-A2', 'G-A4']);
});

test('Feste Produktionsrezepte begrenzen Erz, Lager und endlichen Absatz ohne Rückstand', () => {
  const mine = { ore: '250000', ingot: '0' };
  const recipe = { interval: 400, spend: { ore: '2' }, earn: { ingot: '1' } };
  assert.deepEqual(produceBatches(mine, { ...recipe, elapsed: 10 * year }), {
    balances: { ore: '0', ingot: '125000' }, batches: '125000', carry: 0,
  });
  const filled = produceBatches(mine, { ...recipe, elapsed: day, caps: { ingot: '500' } });
  assert.equal(filled.balances.ingot, '500');
  const emptied = transact(filled.balances, { spend: { ingot: '500' } });
  assert.equal(produceBatches(emptied, { ...recipe, elapsed: 399, carry: filled.carry }).batches, '0');
  assert.equal(produceBatches({ sales: '0' }, { interval: 1800, elapsed: 10 * year, earn: { sales: '1' }, remaining: '200' }).batches, '200');
  reject(() => produceBatches(mine, { ...recipe, elapsed: 400, earn: { ore: '1' } }), 'cyclic-recipe');
});

test('Simulation über 1 Tag, 1 Jahr und 10 Jahre ist je Konfiguration exakt und teilbar', () => {
  const fixtures = [
    ['spielhalle', { currency: 'coins', initial: '0', interval: 1000, output: '7' }, '2207520000'],
    ['studio', { currency: 'sales', initial: '0', interval: 1800, cap: '200' }, '200'],
    ['factory', { currency: 'ironIngot', initial: '0', interval: 400, cap: '500' }, '500'],
  ];
  for (const [id, config, expected] of fixtures) {
    const engine = makeEngine(id, config);
    const initial = engine.create(zero);
    assert.equal(engine.advance(initial, zero + year).snapshot.data.balances[config.currency], '0');
    const activated = engine.command(initial, zero, { type: 'activate' });
    for (const length of [day, year, 10 * year]) {
      const direct = engine.advance(activated, zero + length);
      assert.equal(direct.segments, 1);
      let split = activated;
      for (const at of [zero + 17, zero + 691, zero + day / 2, zero + length]) split = engine.advance(split, at).snapshot;
      assert.deepEqual(split, direct.snapshot, id);
      if (length === 10 * year) assert.equal(direct.snapshot.data.balances[config.currency], expected);
      assert.deepEqual(engine.advance(direct.snapshot, zero + length).snapshot, direct.snapshot);
    }
  }
});

test('Alle 15 Phasen sind getrennte Konfigurationen mit 12 überprüfbaren Übergängen', () => {
  const guests = { autoDealerOwned: true, servedGuests: '100' };
  const hall = [guests, { activeStationTypes: '3', runRevenue: '25000', firstBottleneckResolved: true },
    { casinoRevenue: '250000', reputationTier: '3' }, { operatingLocations: '2', branchManagementResearched: true }];
  const studio = [{ releases: '2', fans: '30' }, { bestReleaseRating: '80', marketingIResearched: true },
    { runSalesRevenue: '2000000', employees: '6' }, { engineIIIResearched: true, studiosWithReleases: '2' }];
  const factory = [{ ironOreSold: '100' }, { ironIngotsDeliveredByBelt: '50', gearsDeliveredByBelt: '50', beltBottleneckShown: true },
    { motorPilotOrderComplete: true, powerGridIResearched: true }, { interregionalOrders: '3', industrialPlanningIIIResearched: true }];
  for (const [id, facts] of [['spielhalle', hall], ['studio', studio], ['factory', factory]]) {
    const engine = makeEngine(id, { currency: 'coins', initial: '0', interval: 1000 });
    const phases = phasesFor(id);
    assert.equal(phases.length, 5);
    let state = engine.create(zero);
    assert.equal(engine.view(state).phase.id, phases[0].id);
    for (let i = 0; i < facts.length; i++) {
      const partial = Object.fromEntries(Object.entries(facts[i]).slice(0, -1));
      state = engine.command(state, zero, { type: 'set-facts', facts: partial });
      assert.equal(state.phase, phases[i].id);
      assert.equal(engine.view(state).progress.at(-1).met, false);
      state = engine.command(state, zero, { type: 'set-facts', facts: facts[i] });
      assert.equal(state.phase, phases[i + 1].id);
      assert.ok(phases[i + 1].unlocks.every((key) => engine.view(state).unlocked.includes(key)));
      assert.ok(phases[i + 1].resources.length && phases[i + 1].bottleneck);
    }
    assert.equal(engine.view(state).next, null);
    assert.ok(engine.view(state).progress.length > 0);
  }
  for (const id of IDLE_GAME_IDS) assert.ok(!SINGLEPLAYER_GAMES[id] && !GAMES[id]);
});

test('Fällige Produktion geht einer Aktion voraus, Zeitrücksprung und Rechenbudget ändern die Basis nicht', () => {
  const engine = makeEngine('spielhalle', { currency: 'coins', interval: 100, initial: '0' });
  const start = engine.command(engine.create(zero), zero, { type: 'activate' });
  const purchased = engine.command(start, zero + 100, { type: 'transfer', transfer: { spend: { coins: '1' } } });
  assert.equal(purchased.data.balances.coins, '0');
  reject(() => engine.advance(start, zero - 1), 'clock-regressed');
  const bounded = createIdleEngine({
    id: 'spielhalle', stateVersion: 1, rulesVersion: 1, create: () => ({}), validate: () => true, facts: () => ({}),
    command: (data) => data, advance: (data, { from }) => ({ until: from + 1, data }),
  }, phasesFor('spielhalle'), { maxSegments: 2 });
  const snapshot = bounded.create(zero);
  reject(() => bounded.advance(snapshot, zero + 3), 'work-budget');
  assert.equal(snapshot.at, zero);
  assert.equal(bounded.advance(snapshot, zero + 2).segments, 2);
});

test('Ein Phasenwechsel in der Offline-Zeit gilt ab der Ereignisgrenze', () => {
  const phases = [{ id: 'start', enter: [], unlocks: [], automations: [] },
    { id: 'expanded', enter: [['units', '2']], unlocks: ['rate-3'], automations: [] }];
  const engine = createIdleEngine({
    id: 'fixture', stateVersion: 1, rulesVersion: 1,
    create: () => ({ units: '0', carry: 0 }), validate: (data) => quantity(data.units) >= 0n,
    facts: (data) => ({ units: data.units }), command: (data) => data,
    advance(data, { from, to, phase }) {
      const building = phase.phase.id === 'start';
      const gateAt = from + (2 - Number(data.units)) * 1000 - data.carry;
      const until = building ? Math.min(to, gateAt) : to;
      const result = produceBatches({ units: data.units }, {
        elapsed: until - from, interval: 1000, carry: data.carry, earn: { units: building ? '1' : '3' },
      });
      return { until, data: { units: result.balances.units, carry: result.carry } };
    },
  }, phases);
  const before = Date.parse('2026-10-25T02:59:59+02:00');
  const after = Date.parse('2026-10-25T02:00:04+01:00');
  const start = engine.create(before);
  const direct = engine.advance(start, after);
  assert.equal(direct.segments, 2);
  assert.equal(direct.snapshot.phase, 'expanded');
  assert.equal(direct.snapshot.data.units, '11');
  const partial = engine.advance(start, before + 1750).snapshot;
  assert.deepEqual(engine.advance(partial, after).snapshot, direct.snapshot);
});
