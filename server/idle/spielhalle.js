import { createIdleEngine, quantity, requireIdle, sameFields } from '../../public/idle/engine.js';
import { phasesFor } from '../../public/idle/progression.js';
import {
  COMFORT_COST, EVENTS, LOCATION_COST, MARKETING_RATE, PROFILES, REPUTATION, RESEARCH, RESEARCH_COST,
  ROLES, ROOM_AREA, ROOM_COST, ROOM_PHASE, STATIONS,
} from './spielhalle-config.js';
import { integer, locationRates, min, rate, sum, tierOf, UNIT, worldRates } from './spielhalle-rates.js';

const phases = phasesFor('spielhalle');
const types = Object.keys(STATIONS), profiles = Object.keys(PROFILES), roles = Object.keys(ROLES);
const research = Object.keys(RESEARCH);
const phaseNumber = (id) => phases.findIndex((phase) => phase.id === id) + 1;
const repeat = (keys, create) => Object.fromEntries(keys.map((key) => [key, create()]));
const add = (amount, delta) => (BigInt(amount) + delta).toString();
const whole = (amount) => (BigInt(amount) / UNIT).toString();
const counters = ['coins', 'guests', 'revenue', 'casino', 'knowledge'];
const locationCounters = ['guests', 'reputation'];
const limited = (value, first, last) => Number.isInteger(value) && value >= first && value <= last;
const has = (record, key) => typeof key === 'string' && Object.hasOwn(record, key);
const good = (condition, code = 'invalid-action') => requireIdle(condition, code);
const cost = (data, coins) => {
  good(BigInt(data.coins) >= integer(coins), 'not-enough-coins');
  data.coins = add(data.coins, -integer(coins));
};
const boundedList = (list, max) => Array.isArray(list) && list.length <= max && list.every((id) => has(STATIONS, id));
const strategies = ['guests', 'margin', 'service'];
const maximumStaff = 100;
const manualInterval = 20_000;
const marketingSpend = rate(MARKETING_RATE);
const validClaim = /^(?:guests-(?:[4-9]|[1-5][0-9]|6[0-7])|casino-(?:[6-9]|[1-5][0-9]|6[0-7])|locations-[2-5]|reputation-[45])$/;

function newLocation(profile) {
  return {
    profile, guests: '0', reputation: '0', rooms: [true, false, false, false, false],
    stations: Object.fromEntries(types.map((id) => [id, { owned: Number(id === 'cards'), paused: 0, price: 3 }])),
    staff: repeat(roles, () => 0), comfort: false, event: null, cooldown: {}, marketing: '0',
    priority: [], pauseLosses: false, manager: null, controller: null,
  };
}

function newWorld({ claims = [], stars = 0 } = {}) {
  return { coins: integer(25).toString(), guests: '0', revenue: '0', casino: '0', knowledge: '0', spentKnowledge: 0,
    auto: false, manualAt: 0, foundBottleneck: false, diagnosis: null,
    research: repeat(research, () => 0), locations: [newLocation('altstadt')], claims, stars };
}

function roomOpen(loc, index, phase, stars) {
  return loc.rooms[index] || (loc.profile === 'altstadt' &&
    ((index === 1 && (phase >= 2 || stars >= 15)) || (index === 2 && phase >= 3)));
}
const area = (loc, phase, stars) => ROOM_AREA.reduce((total, size, index) =>
  total + (roomOpen(loc, index, phase, stars) ? size : 0), 0);
const usedArea = (loc) => types.reduce((total, id) => total + loc.stations[id].owned * STATIONS[id].area, 0);
const availableKnowledge = (data) => (BigInt(data.knowledge) / integer(200)) - BigInt(data.spentKnowledge);
const active = (entry) => entry.owned - entry.paused;
const protectedCount = (loc, id) => Number(loc.profile === 'altstadt' && id === 'cards');
const unlockPhase = (id, data) => id === 'dice' && data.stars >= 5 ? 1 : STATIONS[id].phase;

function validate(data) {
  good(sameFields(data, newWorld()), 'invalid-game-state');
  good(data && data.locations?.length >= 1 && data.locations.length <= 5, 'invalid-game-state');
  for (const field of counters) quantity(data[field]);
  good(typeof data.auto === 'boolean' && typeof data.foundBottleneck === 'boolean' && limited(data.manualAt, 0, Number.MAX_SAFE_INTEGER) &&
    limited(data.spentKnowledge, 0, 90) && availableKnowledge(data) >= 0n &&
    Array.isArray(data.claims) && data.claims.every((claim) => validClaim.test(claim)) &&
    new Set(data.claims).size === data.claims.length && data.stars === data.claims.length &&
    research.every((id) => limited(data.research[id], 0, 4)), 'invalid-game-state');
  good(data.locations[0].profile === 'altstadt' && new Set(data.locations.map((loc) => loc.profile)).size === data.locations.length,
    'invalid-game-state');
  for (const loc of data.locations) {
    good(has(PROFILES, loc.profile) && loc.rooms.length === ROOM_AREA.length && loc.rooms.every((room) => typeof room === 'boolean') &&
      loc.rooms[0] && typeof loc.comfort === 'boolean' && typeof loc.pauseLosses === 'boolean' &&
      roles.every((role) => limited(loc.staff[role], 0, maximumStaff)) &&
      boundedList(loc.priority, types.length) && new Set(loc.priority).size === loc.priority.length &&
      (!loc.event || (has(EVENTS, loc.event.id) && limited(loc.event.until, 0, Number.MAX_SAFE_INTEGER))) &&
      Object.entries(loc.cooldown).every(([id, until]) => has(EVENTS, id) && limited(until, 0, Number.MAX_SAFE_INTEGER)),
    'invalid-game-state');
    for (const field of [...locationCounters, 'marketing']) quantity(loc[field]);
    if (loc.manager) {
      good(strategies.includes(loc.manager.strategy), 'invalid-game-state');
      quantity(loc.manager.budget);
    }
    if (loc.controller) {
      good(typeof loc.controller.restart === 'boolean' && boundedList(loc.controller.queue, 8), 'invalid-game-state');
      quantity(loc.controller.budget);
    }
    for (const id of types) {
      const entry = loc.stations[id];
      good(limited(entry.owned, protectedCount(loc, id), 100) && limited(entry.price, 1, 5) &&
        limited(entry.paused, 0, entry.owned - protectedCount(loc, id)), 'invalid-game-state');
    }
    good(usedArea(loc) <= sumRoomArea(), 'invalid-game-state');
  }
  return true;
}
const sumRoomArea = () => ROOM_AREA.reduce((total, size) => total + size, 0);

function stationProblem(data, loc, id, phase, budget = data.coins) {
  if (phase < unlockPhase(id, data) || (id === 'blackjack' && data.research.personnel < 2) ||
    (['roulette', 'vipLounge'].includes(id) && data.research.personnel < 3)) return 'locked';
  if (usedArea(loc) + STATIONS[id].area > area(loc, phase, data.stars)) return 'no-space';
  return BigInt(budget) < integer(STATIONS[id].cost) ? 'not-enough-coins' : '';
}

function staffProblem(data, loc, role, phase, budget = data.coins) {
  if (phase < ROLES[role].phase || (role === 'security' && data.research.personnel < 3)) return 'locked';
  if (loc.staff[role] === maximumStaff) return 'staff-limit';
  return BigInt(budget) < integer(ROLES[role].cost) ? 'not-enough-coins' : '';
}

function roomProblem(data, loc, room, phase) {
  if (roomOpen(loc, room, phase, data.stars)) return 'already-open';
  if (phase < ROOM_PHASE[room] || !roomOpen(loc, room - 1, phase, data.stars) ||
    (room === 4 && data.research.personnel < 4)) return 'locked';
  return BigInt(data.coins) < integer(ROOM_COST[room]) ? 'not-enough-coins' : '';
}

function eventProblem(data, loc, id, phase, at) {
  if (phase < EVENTS[id].phase || (id === 'theme' && data.research.visitors < 3) ||
    (id === 'group' && data.research.visitors < 4) ||
    (id === 'tournament' && (!loc.staff.croupier || !active(loc.stations.poker)))) return 'locked';
  if (loc.event?.until > at) return 'event-active';
  if (loc.cooldown[id] > at) return 'cooldown';
  return BigInt(data.coins) < integer(EVENTS[id].cost) ? 'not-enough-coins' : '';
}

function pairs(data, rates) {
  return rates.locations.flatMap((site, idx) => site.rows.filter((row) =>
    row.count > protectedCount(data.locations[idx], row.id) && !row.manual).map((row) =>
    ({ row, loc: data.locations[idx], idx })));
}

function lowFirst(a, b) {
  const diff = a.row.net * BigInt(b.row.count) - b.row.net * BigInt(a.row.count);
  if (diff) return diff < 0n ? -1 : 1;
  return Number(b.row.spec.upkeep) - Number(a.row.spec.upkeep) || b.row.order - a.row.order || b.idx - a.idx;
}

function safeguard(data, phase, at) {
  let total = worldRates(data, phase, at);
  if (!BigInt(data.coins) && total.net < 0n) {
    for (const loc of data.locations) { loc.event = null; loc.marketing = '0'; }
    total = worldRates(data, phase, at);
    while (total.net < 0n) {
      const first = pairs(data, total).sort(lowFirst)[0];
      good(first, 'work-budget');
      first.loc.stations[first.row.id].paused++;
      total = worldRates(data, phase, at);
    }
  }
  if (data.research.automation) {
    for (;;) {
      const next = pairs(data, total).sort(lowFirst).find(({ loc, row }) => loc.pauseLosses && row.net < 0n);
      if (!next) break;
      next.loc.stations[next.row.id].paused++;
      total = worldRates(data, phase, at);
    }
  }
  return total;
}

function restartTerms(data, loc, id, phase, at, baseNet) {
  if (!loc.stations[id].paused) return null;
  const old = locationRates(data, loc, phase, at);
  loc.stations[id].paused--;
  let next;
  try { next = locationRates(data, loc, phase, at); }
  finally { loc.stations[id].paused++; }
  const row = next.rows.find((entry) => entry.id === id);
  const reserve = (rate(row.spec.upkeep) + sum(row.spec.roles.map((role) => rate(ROLES[role].wage)))) * 600_000n;
  return { net: baseNet - old.net + next.net, row, reserve };
}

function controllers(data, phase, at, rates) {
  if (phase < 5 || data.research.automation < 4) return [];
  return data.locations.flatMap((loc, idx) => {
    if (!loc.controller) return [];
    const terms = loc.controller.restart ? types.flatMap((id) => {
      const candidate = restartTerms(data, loc, id, phase, at, rates.net);
      return candidate?.net >= 0n && (!loc.pauseLosses || candidate.row.net >= 0n)
        ? [{ ...candidate, loc, idx, id }] : [];
    }) : [];
    return terms;
  }).sort((a, b) => lowFirst(b, a));
}

function automationEvent(data, phase, at) {
  let rates = safeguard(data, phase, at);
  if (phase < 5) return rates;
  for (const loc of data.locations) {
    const manager = loc.manager;
    if (!manager) continue;
    if (manager.strategy !== 'service') {
      for (const id of types) {
        const entry = loc.stations[id];
        if (!active(entry)) continue;
        if (manager.strategy === 'guests' && entry.price > 2) entry.price--;
        if (manager.strategy === 'margin' && entry.price < 4) entry.price++;
      }
    }
    if (manager.strategy !== 'margin') {
      for (const role of roles) {
        const affordable = () => !staffProblem(data, loc, role, phase, min(BigInt(manager.budget), BigInt(data.coins)));
        const limitedByRole = () => locationRates(data, loc, phase, at).rows.some((row) => row.limit === role && row.served < row.wanted);
        while (affordable() && limitedByRole()) {
          cost(data, ROLES[role].cost);
          manager.budget = add(manager.budget, -integer(ROLES[role].cost));
          loc.staff[role]++;
        }
      }
    }
  }
  rates = safeguard(data, phase, at);
  const restart = controllers(data, phase, at, rates).find((candidate) => BigInt(data.coins) >= candidate.reserve);
  if (restart) restart.loc.stations[restart.id].paused--;
  for (const loc of data.locations) {
    const c = loc.controller, id = c?.queue[0];
    if (!id || stationProblem(data, loc, id, phase, min(BigInt(c.budget), BigInt(data.coins)))) continue;
    cost(data, STATIONS[id].cost);
    c.budget = add(c.budget, -integer(STATIONS[id].cost));
    loc.stations[id].owned++;
    c.queue.shift();
  }
  return safeguard(data, phase, at);
}

function operating(data, rates) {
  return rates.locations.filter((loc, i) => BigInt(data.locations[i].guests) >= UNIT && loc.served > 0n && loc.net >= 0n).length;
}

function milestones(data, rates) {
  const eligible = [];
  for (const [key, first] of [['guests', 4], ['casino', 6]]) {
    for (let exponent = first, threshold = 10n ** BigInt(first) * UNIT; BigInt(data[key]) >= threshold; exponent++, threshold *= 10n) {
      eligible.push(key + '-' + exponent);
    }
  }
  for (let count = 2; count <= 5; count++) if (operating(data, rates) >= count) eligible.push('locations-' + count);
  const tier = Math.max(...data.locations.map(tierOf));
  for (let rank = 4; rank <= 5; rank++) if (tier >= rank) eligible.push('reputation-' + rank);
  return eligible.filter((id) => !data.claims.includes(id));
}

function facts(data, id, at) {
  const phase = phaseNumber(id), main = data.locations[0];
  const rates = phase >= 2 ? worldRates(data, phase, at) : null;
  return { autoDealerOwned: data.auto, servedGuests: whole(data.guests), runRevenue: whole(data.revenue),
    activeStationTypes: String(rates ? rates.locations[0].rows.filter((row) => row.served > 0n).length : Number(data.auto)),
    firstBottleneckResolved: data.foundBottleneck, casinoRevenue: whole(data.casino), reputationTier: String(tierOf(main)),
    operatingLocations: phase >= 4 ? String(operating(data, rates)) : '0',
    staffSchedulingResearched: data.research.automation >= 1, marketingPlanningResearched: data.research.automation >= 2,
    branchManagementResearched: data.research.automation >= 3, controlCenterResearched: data.research.automation >= 4,
    locations: String(data.locations.length), stationTypesAtOneLocation: String(Math.max(...data.locations.map((loc) =>
      types.filter((type) => loc.stations[type].owned > 0).length))),
    allLocationsReputation5: data.locations.every((loc) => tierOf(loc) === 5),
    floor3Complete: main.rooms[3] && main.rooms[4], allResearch: research.every((key) => data.research[key] === 4) };
}

function advance(data, { from, to, phase: view }) {
  const phase = phaseNumber(view.phase.id);
  const rates = safeguard(data, phase, from);
  const span = BigInt(to - from);
  let event = null;
  const stop = (time) => {
    if (time > 0n && time <= span && (event === null || time < event)) event = time;
  };
  const boundary = (current, target, amount) => {
    const gap = target - BigInt(current);
    if (amount > 0n && gap > 0n) stop((gap + amount - 1n) / amount);
  };
  if (rates.net < 0n) boundary(0, BigInt(data.coins), -rates.net);
  if (phase === 1 && data.auto) boundary(data.guests, integer(100), rates.served);
  if (phase === 2) boundary(data.revenue, integer(25000), rates.gross);
  if (phase === 3) boundary(data.casino, integer(250000), rates.casino);
  for (const [i, loc] of data.locations.entries()) {
    const local = rates.locations[i], tier = tierOf(loc);
    if (tier < 5) boundary(loc.reputation, integer(REPUTATION[tier]), local.reputation);
    if (phase === 4) boundary(loc.guests, UNIT, local.served);
    if (loc.event?.until > from) stop(BigInt(loc.event.until - from));
    boundary(0, BigInt(loc.marketing), marketingSpend);
    if (phase === 5 && loc.controller?.queue.length) {
      const price = integer(STATIONS[loc.controller.queue[0]].cost);
      if (BigInt(loc.controller.budget) >= price) boundary(data.coins, price, rates.net);
    }
  }
  for (const { reserve } of controllers(data, phase, from, rates)) boundary(data.coins, reserve, rates.net);
  const step = event ?? span, until = from + Number(step);
  const unusedMarketing = sum(data.locations.map((loc) => {
    const budget = BigInt(loc.marketing);
    return budget > 0n ? marketingSpend * step - min(budget, marketingSpend * step) : 0n;
  }));
  const net = BigInt(data.coins) + rates.net * step + unusedMarketing;
  data.coins = (net < 0n ? 0n : net).toString();
  for (const [key, earned] of Object.entries({ guests: rates.served, revenue: rates.gross, casino: rates.casino, knowledge: rates.knowledge })) {
    data[key] = add(data[key], earned * step);
  }
  for (const [i, loc] of data.locations.entries()) {
    const local = rates.locations[i];
    loc.reputation = add(loc.reputation, local.reputation * step);
    loc.guests = add(loc.guests, local.served * step);
    loc.marketing = add(loc.marketing, -min(BigInt(loc.marketing), marketingSpend * step));
    if (loc.event?.until <= until) loc.event = null;
  }
  if (event !== null) automationEvent(data, phase, until);
  return { until, data };
}

function command(data, action, view, at) {
  const phase = phaseNumber(view.phase.id);
  good(action && typeof action.type === 'string');
  const loc = action.site === undefined ? data.locations[0] : data.locations.find(({ profile }) => profile === action.site);
  good(loc, 'unknown-location');
  const target = action.station, station = has(STATIONS, target) ? loc.stations[target] : null;
  const previous = data.diagnosis;
  const budget = (value) => {
    const units = quantity(value);
    good(units <= 1_000_000_000n, 'invalid-budget');
    return integer(units).toString();
  };
  switch (action.type) {
    case 'manual': {
      good(loc.profile === 'altstadt' && !data.auto, 'locked');
      good(at >= data.manualAt, 'guest-wait');
      data.manualAt = at + manualInterval;
      data.coins = add(data.coins, integer(5));
      data.guests = add(data.guests, UNIT);
      data.revenue = add(data.revenue, integer(5));
      data.knowledge = add(data.knowledge, UNIT);
      loc.guests = add(loc.guests, UNIT);
      loc.reputation = add(loc.reputation, UNIT);
      break;
    }
    case 'auto':
      good(!data.auto, 'locked');
      cost(data, 30); data.auto = true; break;
    case 'buy':
      good(station);
      { const problem = stationProblem(data, loc, target, phase); good(!problem, problem); }
      cost(data, STATIONS[target].cost); station.owned++; break;
    case 'pause':
      good(station && active(station) > protectedCount(loc, target), 'locked');
      station.paused++; break;
    case 'reopen': {
      good(station?.paused, 'locked');
      const rates = worldRates(data, phase, at);
      const terms = restartTerms(data, loc, target, phase, at, rates.net);
      good(terms.net >= 0n || (BigInt(data.coins) > 0n && action.confirm === true), 'loss-warning');
      station.paused--;
      break;
    }
    case 'price':
      good(station?.owned && phase >= 2 && limited(action.level, 1, 5), 'locked');
      station.price = action.level; break;
    case 'hire':
      good(has(ROLES, action.role));
      { const problem = staffProblem(data, loc, action.role, phase); good(!problem, problem); }
      cost(data, ROLES[action.role].cost); loc.staff[action.role]++; break;
    case 'release-staff':
      good(has(ROLES, action.role) && loc.staff[action.role] > 0, 'locked');
      loc.staff[action.role]--; break;
    case 'room':
      good(limited(action.room, 1, 4));
      { const problem = roomProblem(data, loc, action.room, phase); good(!problem, problem); }
      cost(data, ROOM_COST[action.room]); loc.rooms[action.room] = true; break;
    case 'comfort':
      good(phase >= 2 && !loc.comfort, 'locked');
      cost(data, COMFORT_COST); loc.comfort = true; break;
    case 'research': {
      good(has(RESEARCH, action.branch) && phase >= 2, 'locked');
      const level = data.research[action.branch];
      good(level < 4 && level + 2 <= phase, 'locked');
      good(availableKnowledge(data) >= BigInt(RESEARCH_COST[level]), 'not-enough-knowledge');
      data.spentKnowledge += RESEARCH_COST[level]; data.research[action.branch]++;
      break;
    }
    case 'diagnose': {
      good(phase >= 2 && station?.owned, 'locked');
      const row = locationRates(data, loc, phase, at).rows.find((item) => item.id === target);
      good(row.limit && row.served < row.wanted, 'no-bottleneck');
      data.diagnosis = { site: loc.profile, station: target, limit: row.limit };
      return data;
    }
    case 'priorities':
      good(data.research.automation >= 1 && boundedList(action.order, types.length) &&
        new Set(action.order).size === action.order.length && typeof action.pauseLosses === 'boolean', 'locked');
      loc.priority = action.order; loc.pauseLosses = action.pauseLosses; break;
    case 'marketing':
      good(data.research.automation >= 2, 'locked');
      loc.marketing = budget(action.budget); break;
    case 'event':
      good(has(EVENTS, action.event));
      { const problem = eventProblem(data, loc, action.event, phase, at); good(!problem, problem); }
      cost(data, EVENTS[action.event].cost);
      loc.event = { id: action.event, until: at + EVENTS[action.event].duration };
      loc.cooldown[action.event] = loc.event.until + EVENTS[action.event].cooldown;
      break;
    case 'location':
      good(phase >= 4 && data.locations.length < (phase === 4 ? 2 : 5) &&
        has(PROFILES, action.profile) && !data.locations.some(({ profile }) => profile === action.profile) &&
        tierOf(data.locations[0]) >= 3, 'locked');
      cost(data, LOCATION_COST); data.locations.push(newLocation(action.profile)); break;
    case 'manager':
      good(phase === 5 && data.research.automation >= 3 && (action.strategy === '' || strategies.includes(action.strategy)), 'locked');
      loc.manager = action.strategy ? { strategy: action.strategy, budget: budget(action.budget) } : null; break;
    case 'controller':
      good(phase === 5 && data.research.automation === 4 && typeof action.restart === 'boolean' && boundedList(action.queue, 8), 'locked');
      loc.controller = { restart: action.restart, queue: action.queue, budget: budget(action.budget) }; break;
    default: good(false);
  }
  const rates = automationEvent(data, phase, at);
  if (previous && previous.site === loc.profile && ['buy', 'hire', 'price', 'room', 'comfort', 'research', 'priorities'].includes(action.type)) {
    const after = rates.locations[data.locations.indexOf(loc)].rows.find((row) => row.id === previous.station);
    if (after?.limit && after.wanted > 0n && after.limit !== previous.limit) {
      data.foundBottleneck = true; data.diagnosis = null;
    }
  }
  return data;
}

const rateProjection = (results, keys) => Object.fromEntries(keys.map((key) => [key, results[key].toString()]));
function deriveView(data, id, at) {
  const phase = phaseNumber(id), rates = worldRates(data, phase, at);
  const goals = phase === 5 ? facts(data, id, at) : {};
  return { ...rateProjection(data, counters), at, phase, auto: data.auto, manualReady: at >= data.manualAt,
    manualWait: Math.max(0, data.manualAt - at), knowHow: availableKnowledge(data).toString(), research: data.research,
    rates: rateProjection(rates, ['net', 'gross', 'costs', 'served']), stars: data.stars, diagnosis: data.diagnosis,
    prestige: phase === 5 ? milestones(data, rates) : null, complete: phase === 5 && phases[4].complete.every(([key, target]) =>
      target === true ? goals[key] : BigInt(goals[key]) >= BigInt(target)),
    prices: { comfort: COMFORT_COST, location: LOCATION_COST }, researchOffer: research.map((key) => ({
      id: key, level: data.research[key], name: RESEARCH[key][data.research[key]] ?? null,
      cost: RESEARCH_COST[data.research[key]] ?? 0, available: data.research[key] < 4 && data.research[key] + 2 <= phase &&
        availableKnowledge(data) >= BigInt(RESEARCH_COST[data.research[key]] ?? 0),
    })),
    locations: data.locations.map((loc, i) => {
      const local = rates.locations[i];
      return { profile: loc.profile, guests: whole(loc.guests), reputation: whole(loc.reputation), tier: tierOf(loc),
        space: { used: usedArea(loc), available: area(loc, phase, data.stars) }, comfort: loc.comfort,
        marketing: loc.marketing, event: loc.event, cooldown: loc.cooldown,
        priority: loc.priority, pauseLosses: loc.pauseLosses, manager: loc.manager, controller: loc.controller,
        rates: rateProjection(local, ['net', 'gross', 'costs', 'served']),
        segments: local.segments.map((segment) => ({ id: segment.id, ...rateProjection(segment, ['demand', 'wanted', 'served', 'refused']) })),
        rooms: ROOM_AREA.map((size, index) => ({ index, size, cost: ROOM_COST[index],
          open: roomOpen(loc, index, phase, data.stars), reason: index ? roomProblem(data, loc, index, phase) : 'already-open' })),
        staff: roles.filter((role) => phase >= ROLES[role].phase).map((role) => ({
          role, count: loc.staff[role], cost: ROLES[role].cost, reason: staffProblem(data, loc, role, phase),
        })),
        events: Object.keys(EVENTS).filter((key) => phase >= EVENTS[key].phase).map((key) => ({
          id: key, cost: EVENTS[key].cost, reason: eventProblem(data, loc, key, phase, at),
        })),
        stations: local.rows.filter((row) => phase >= unlockPhase(row.id, data)).map((row) => {
          const spec = loc.stations[row.id], reopen = restartTerms(data, loc, row.id, phase, at, rates.net);
          return { id: row.id, ...spec, protected: protectedCount(loc, row.id), cost: row.spec.cost, manual: row.manual,
            reason: stationProblem(data, loc, row.id, phase), limit: row.limit,
            restartNet: reopen?.net.toString() ?? null, restartReserve: reopen?.reserve.toString() ?? null,
            ...rateProjection(row, ['wanted', 'capacity', 'income', 'costs', 'served', 'net']) };
        }),
      };
    }),
    locationOffer: profiles.filter((key) => !data.locations.some((loc) => loc.profile === key)),
  };
}

function reset(data, phase, at, expected) {
  good(phase === 'SH-P5', 'locked');
  const claims = milestones(data, worldRates(data, 5, at));
  good(claims.length && Array.isArray(expected) && expected.length === claims.length &&
    expected.every((id, index) => id === claims[index]), 'prestige-conflict');
  return newWorld({ claims: [...data.claims, ...claims], stars: data.stars + claims.length });
}

export const spielhalleEngine = createIdleEngine({
  id: 'spielhalle', stateVersion: 1, rulesVersion: 1, create: newWorld, validate, facts, command, advance, deriveView, reset,
}, phases);
