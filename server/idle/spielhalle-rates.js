import { EVENTS, MARKETING_RATE, PRICES, PROFILES, REPUTATION, REPUTATION_DEMAND, ROLES, STATIONS } from './spielhalle-config.js';

// One unit in a stored counter is 10^-12 of a coin or guest. Rates are stored
// here as subunits per millisecond so integrating an interval never rounds.
export const RATE = 1_000_000_000n;
export const UNIT = RATE * 1000n;
export function rate(value) {
  const [whole, decimal = ''] = String(value).split('.');
  return BigInt(whole) * RATE + BigInt(decimal.padEnd(9, '0'));
}
export const integer = (value) => BigInt(value) * UNIT;
export const multiply = (a, b) => a * b / RATE;
export const min = (...values) => values.reduce((a, b) => a < b ? a : b);
export const sum = (values) => values.reduce((a, b) => a + b, 0n);
export const tierOf = (loc) => REPUTATION.findLastIndex((value) => BigInt(loc.reputation) >= integer(value)) + 1;
const casino = new Set(['poker', 'arcade', 'blackjack']);
const roleNames = Object.keys(ROLES);
const types = Object.keys(STATIONS);
const baseline = (loc, id) => loc.profile === 'altstadt' && id === 'cards';
const activeCount = (station) => station.owned - station.paused;

// Quantize rational shares once per rate calculation, assigning remaining
// subunits by largest remainder, with the same stable priority for ties.
function distribute(demand, weights) {
  const total = sum(weights);
  if (!total) return weights.map(() => 0n);
  const parts = weights.map((weight, i) => ({ i, value: demand * weight / total, remainder: demand * weight % total }));
  const measured = demand - sum(parts.map(({ value }) => value));
  const order = [...parts].sort((a, b) => a.remainder === b.remainder ? a.i - b.i : a.remainder > b.remainder ? -1 : 1);
  for (let i = 0; i < Number(measured); i++) order[i].value++;
  return parts.map(({ value }) => value);
}

function reputationFactor(served, demand, comfort) {
  return demand > 0n ? multiply(served * (demand + served) / (2n * demand), comfort) : 0n;
}

export function locationRates(world, loc, phase, at) {
  const campaign = BigInt(loc.marketing) > 0n;
  const comfort = loc.comfort ? rate('1.5') : RATE;
  const prestige = BigInt(Math.round((1 + 0.5 * (1 - 0.95 ** world.stars)) * Number(RATE)));
  const event = loc.event?.until > at ? loc.event.id : '';
  const cap = Object.fromEntries(roleNames.map((role) => [role,
    multiply(rate(ROLES[role].capacity), world.research.personnel ? rate('1.2') : RATE)]));
  const rest = Object.fromEntries(roleNames.map((role) => [role, cap[role] * BigInt(loc.staff[role])]));
  const rows = types.map((id, order) => {
    const spec = STATIONS[id], state = loc.stations[id], count = activeCount(state);
    const manual = baseline(loc, id) && !world.auto;
    return { id, order, spec, count, manual, price: BigInt(spec.value) * rate(PRICES.value[state.price - 1]),
      capacity: manual ? 0n : rate(spec.capacity) * BigInt(count), wanted: 0n, served: 0n,
      hands: {}, missingSecurity: false, limit: null };
  });
  const priority = rows.filter((row) => row.count && !row.manual).sort((a, b) => {
    if (world.research.automation >= 1 && loc.priority) {
      const first = loc.priority.indexOf(a.id), second = loc.priority.indexOf(b.id);
      if (first !== second) return (first < 0 ? types.length : first) - (second < 0 ? types.length : second);
    }
    return a.price === b.price ? a.order - b.order : a.price > b.price ? -1 : 1;
  });
  let guards = loc.staff.security;
  for (const row of priority) {
    if (!row.spec.roles.includes('security')) continue;
    const needed = Math.ceil(row.count / 2);
    if (guards < needed) row.missingSecurity = true;
    else guards -= needed;
  }
  const demandFactor = [rate(REPUTATION_DEMAND[tierOf(loc) - 1]), comfort, prestige,
    campaign ? rate('1.25') : RATE, world.research.visitors ? rate('1.15') : RATE];
  const segments = [];
  let reputation = 0n;
  for (const [segment, index] of [['vip', 1], ['regular', 0]]) {
    if (segment === 'vip' && phase < 4) continue;
    let demand = demandFactor.reduce(multiply, rate(PROFILES[loc.profile][index]));
    if (segment === 'regular' && event === 'theme') demand = multiply(demand, rate('1.3'));
    if (segment === 'regular' && event === 'group') demand += rate('0.2');
    const offer = priority.filter((row) => rate(row.spec[segment]) > 0n);
    const desired = distribute(demand, offer.map((row) => {
      const weight = multiply(rate(row.spec[segment]), rate(PRICES.weight[loc.stations[row.id].price - 1]));
      return weight * BigInt(row.count) * (event === 'tournament' && row.id === 'poker' ? 2n : 1n);
    }));
    const capacities = (row) => [row.capacity - row.served, ...row.spec.roles.map((role) => rest[role])];
    function admit(row, amount) {
      if (row.missingSecurity) return 0n;
      const served = min(amount, ...capacities(row));
      row.served += served;
      for (const role of row.spec.roles) {
        rest[role] -= served;
        row.hands[role] = (row.hands[role] ?? 0n) + served;
      }
      return served;
    }
    let served = 0n, overflow = 0n;
    offer.forEach((row, i) => {
      const want = desired[i];
      row.wanted += want;
      const [seats, ...staff] = capacities(row);
      const all = [want, seats, ...staff];
      const actual = admit(row, want);
      if (want && (row.limit === null || (row.limit === 'demand' && actual < want))) {
        if (row.missingSecurity) row.limit = 'security';
        else {
          const first = all.indexOf(min(...all));
          row.limit = first === 0 ? 'demand' : first === 1 ? 'space' : row.spec.roles[first - 2];
        }
      }
      served += actual;
      overflow += want - actual;
    });
    let alternate = multiply(overflow, world.research.visitors >= 2 ? rate('0.7') : rate('0.5'));
    for (const row of offer) {
      if (!alternate) break;
      const extra = admit(row, alternate);
      served += extra;
      alternate -= extra;
    }
    const potential = sum(desired);
    reputation += reputationFactor(served, potential, comfort);
    segments.push({ id: segment, demand, wanted: potential, served, refused: potential - served });
  }
  let gross = 0n, costs = campaign ? rate(MARKETING_RATE) : 0n, casinoGross = 0n, knowledge = 0n;
  for (const row of rows) {
    row.income = multiply(row.served, row.price);
    row.costs = row.manual ? 0n : rate(row.spec.upkeep) * BigInt(row.count) + multiply(row.served, rate(row.spec.variable));
    for (const [role, capacity] of Object.entries(row.hands)) row.costs += rate(ROLES[role].wage) * capacity / cap[role];
    row.net = row.income - row.costs;
    gross += row.income;
    costs += row.costs;
    if (casino.has(row.id)) casinoGross += row.income;
    knowledge += row.served * (row.id === 'chess' ? 3n : 1n);
  }
  return { rows, segments, gross, costs, net: gross - costs, casinoGross, knowledge, reputation,
    served: sum(segments.map((segment) => segment.served)), activeEvent: EVENTS[event] ? event : '' };
}

export function worldRates(data, phase, at) {
  const locations = data.locations.map((loc) => locationRates(data, loc, phase, at));
  const total = (key) => sum(locations.map((loc) => loc[key]));
  return { locations, net: total('net'), gross: total('gross'), costs: total('costs'),
    served: total('served'), knowledge: total('knowledge'), casino: total('casinoGross') };
}
