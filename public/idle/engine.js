// Pure, DOM-independent engine shared by the server and optional browser previews.
const amountPattern = /^(?:0|[1-9][0-9]{0,79})$/;
const keyPattern = /^[a-z][a-zA-Z0-9-]{0,63}$/;
const reservedKeys = new Set(['constructor', 'prototype', '__proto__']);

export class IdleError extends Error {
  constructor(code) {
    super(code);
    this.name = 'IdleError';
    this.code = code;
  }
}

export function requireIdle(condition, code) {
  if (!condition) throw new IdleError(code);
}

export function quantity(value) {
  const text = typeof value === 'bigint' ? value.toString() : value;
  requireIdle(typeof text === 'string' && amountPattern.test(text), 'invalid-quantity');
  return BigInt(text);
}

export function timestamp(value) {
  requireIdle(Number.isSafeInteger(value) && value >= 0 && value <= 8_640_000_000_000_000, 'invalid-time');
  return value;
}

export function plainData(value, depth = 0, budget = { nodes: 0 }) {
  requireIdle(++budget.nodes <= 50_000 && depth <= 24, 'invalid-data');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'string') {
    requireIdle(value.length <= 65_536, 'invalid-data');
    return;
  }
  if (typeof value === 'number') {
    requireIdle(Number.isSafeInteger(value), 'invalid-data');
    return;
  }
  requireIdle(typeof value === 'object' && (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype), 'invalid-data');
  const entries = Object.entries(value);
  if (Array.isArray(value)) requireIdle(entries.length === value.length &&
    entries.every(([key], index) => key === String(index)), 'invalid-data');
  for (const [key, item] of entries) {
    requireIdle(!reservedKeys.has(key) && key.length <= 128, 'invalid-data');
    plainData(item, depth + 1, budget);
  }
}

function resourceEntries(resources) {
  requireIdle(resources && Object.getPrototypeOf(resources) === Object.prototype, 'invalid-resources');
  return Object.entries(resources).map(([key, value]) => {
    requireIdle(keyPattern.test(key) && !reservedKeys.has(key), 'invalid-resource');
    return [key, quantity(value)];
  });
}

export function transact(balances, { spend = {}, earn = {}, caps = {} } = {}) {
  const next = new Map(resourceEntries(balances));
  const limits = new Map(resourceEntries(caps));
  for (const [key, cost] of resourceEntries(spend)) {
    requireIdle(next.has(key) && next.get(key) >= cost, 'insufficient-funds');
    next.set(key, next.get(key) - cost);
  }
  for (const [key, gain] of resourceEntries(earn)) {
    requireIdle(next.has(key), 'invalid-resource');
    next.set(key, next.get(key) + gain);
  }
  for (const [key, value] of next) {
    requireIdle(!limits.has(key) || value <= limits.get(key), 'capacity-exceeded');
    quantity(value);
  }
  return Object.fromEntries([...next].map(([key, value]) => [key, value.toString()]));
}

// Whole, independent production cycles for one fixed recipe/segment.
// Blocked opportunities expire. Fractional time towards the next cycle is retained.
export function produceBatches(balances, { elapsed, interval, carry = 0, spend = {}, earn = {}, caps = {}, remaining }) {
  timestamp(elapsed);
  timestamp(interval);
  requireIdle(interval > 0 && Number.isSafeInteger(carry) && carry >= 0 && carry < interval, 'invalid-cycle');
  const time = BigInt(elapsed) + BigInt(carry);
  let count = time / BigInt(interval);
  const remainder = Number(time % BigInt(interval));
  if (remaining !== undefined && quantity(remaining) < count) count = quantity(remaining);
  const input = new Map(resourceEntries(spend));
  const output = new Map(resourceEntries(earn));
  const current = new Map(resourceEntries(balances));
  const limits = new Map(resourceEntries(caps));
  for (const key of new Set([...input.keys(), ...output.keys()])) {
    const value = current.get(key);
    requireIdle(value !== undefined, 'invalid-resource');
    const cost = input.get(key) ?? 0n;
    const gain = output.get(key) ?? 0n;
    // A fixed recipe must not recycle the same input in this primitive.
    requireIdle(cost === 0n || gain === 0n, 'cyclic-recipe');
    if (cost > 0n && value / cost < count) count = value / cost;
    if (gain > 0n && limits.has(key)) {
      requireIdle(limits.get(key) >= value, 'capacity-exceeded');
      const capacity = (limits.get(key) - value) / gain;
      if (capacity < count) count = capacity;
    }
  }
  const scale = (entries) => Object.fromEntries([...entries].map(([key, amount]) => [key, amount * count]));
  return {
    balances: transact(balances, { spend: scale(input), earn: scale(output), caps }),
    batches: count.toString(),
    carry: remainder,
  };
}

export function geometricCost(base, { numerator, denominator, level }) {
  const top = quantity(numerator), bottom = quantity(denominator);
  requireIdle(bottom > 0n && top >= bottom && top <= 1_000_000n &&
    Number.isInteger(level) && level >= 0 && level <= 4096, 'invalid-price');
  const divisor = bottom ** BigInt(level);
  return quantity((quantity(base) * top ** BigInt(level) + divisor - 1n) / divisor).toString();
}

export function buyUpgrade(balances, levels, { id, currency, base, numerator, denominator, maxLevel }, unlocked) {
  requireIdle(unlocked.includes(id), 'locked-upgrade');
  requireIdle(Object.hasOwn(levels, id) && Number.isInteger(levels[id]) &&
    Number.isInteger(maxLevel) && levels[id] >= 0 && levels[id] < maxLevel, 'upgrade-limit');
  const level = levels[id];
  const cost = geometricCost(base, { numerator, denominator, level });
  return { balances: transact(balances, { spend: { [currency]: cost } }), levels: { ...levels, [id]: level + 1 }, cost };
}

export function automationEnabled(id, { available, enabled, remainingBudget, cost = '0' }) {
  return available.includes(id) && enabled.includes(id) && quantity(remainingBudget) >= quantity(cost);
}

export function formatQuantity(value, { scale = 0, locale = 'de-DE' } = {}) {
  requireIdle(Number.isInteger(scale) && scale >= 0 && scale <= 18, 'invalid-scale');
  const units = quantity(value);
  const factor = 10n ** BigInt(scale);
  const whole = new Intl.NumberFormat(locale).format(units / factor);
  if (!scale) return whole;
  const separator = new Intl.NumberFormat(locale).formatToParts(1.1).find((piece) => piece.type === 'decimal').value;
  const fraction = new Intl.NumberFormat(locale, { useGrouping: false, minimumIntegerDigits: scale }).format(units % factor);
  return whole + separator + fraction;
}

const gateMet = (rule, facts) => rule[1] === true
  ? facts[rule[0]] === true
  : Object.hasOwn(facts, rule[0]) && quantity(facts[rule[0]]) >= quantity(rule[1]);

export function createIdleEngine(module, phases, { maxSegments = 10_000 } = {}) {
  const { id: gameId, stateVersion, rulesVersion } = module;
  requireIdle(keyPattern.test(gameId) && Number.isSafeInteger(stateVersion) && stateVersion > 0 &&
    Number.isSafeInteger(rulesVersion) && rulesVersion > 0 && Number.isSafeInteger(maxSegments) && maxSegments > 0 &&
    ['create', 'validate', 'facts', 'advance', 'command'].every((method) => typeof module[method] === 'function'), 'invalid-module');
  const progression = structuredClone(phases);
  requireIdle(progression.length > 0 && new Set(progression.map((phase) => phase.id)).size === progression.length &&
    progression[0].enter.length === 0 && progression.every((phase, i) => i === 0 || phase.enter.length > 0), 'invalid-progression');

  function validate(snapshot) {
    plainData(snapshot);
    requireIdle(snapshot && !Array.isArray(snapshot), 'invalid-snapshot');
    requireIdle(snapshot.gameId === gameId, 'wrong-game');
    requireIdle(snapshot.stateVersion === stateVersion && snapshot.rulesVersion === rulesVersion, 'unsupported-version');
    requireIdle(Object.keys(snapshot).length === 6 && progression.some((p) => p.id === snapshot.phase) &&
      Object.hasOwn(snapshot, 'data'), 'invalid-snapshot');
    timestamp(snapshot.at);
    let valid;
    try { valid = module.validate(snapshot.data); }
    catch (error) {
      if (error instanceof IdleError) throw error;
      throw new IdleError('invalid-game-state');
    }
    requireIdle(valid === true, 'invalid-game-state');
    return snapshot;
  }

  function phaseView(snapshot) {
    const index = progression.findIndex((phase) => phase.id === snapshot.phase);
    const phase = progression[index];
    const facts = module.facts(snapshot.data);
    const reached = progression.slice(0, index + 1);
    const goals = progression[index + 1]?.enter ?? phase.complete ?? [];
    return { phase: structuredClone(phase), next: progression[index + 1]?.id ?? null,
      unlocked: [...new Set(reached.flatMap((p) => p.unlocks))],
      automations: [...new Set(reached.flatMap((p) => p.automations
        .filter((id) => (p.automationGates?.[id] ?? []).every((rule) => gateMet(rule, facts)))))],
      progress: goals.map((rule) => ({ key: rule[0], target: rule[1], current: facts[rule[0]] ?? null, met: gateMet(rule, facts) })) };
  }

  function promote(snapshot) {
    let index = progression.findIndex((phase) => phase.id === snapshot.phase);
    const facts = module.facts(snapshot.data);
    while (progression[index + 1]?.enter.every((rule) => gateMet(rule, facts))) index++;
    snapshot.phase = progression[index].id;
    return snapshot;
  }

  function advance(snapshot, at) {
    const state = structuredClone(validate(snapshot));
    timestamp(at);
    requireIdle(at >= state.at, 'clock-regressed');
    const from = state.at;
    let segments = 0;
    while (state.at < at) {
      requireIdle(++segments <= maxSegments, 'work-budget');
      const { until, data } = module.advance(structuredClone(state.data), {
        from: state.at, to: at, phase: phaseView(state),
      });
      requireIdle(Number.isSafeInteger(until) && until > state.at && until <= at, 'invalid-segment');
      state.at = until;
      state.data = data;
      validate(state);
      promote(state);
    }
    return { snapshot: state, from, to: at, segments };
  }

  return Object.freeze({
    gameId, validate, advance,
    create(at) {
      return validate({ gameId, stateVersion, rulesVersion, at: timestamp(at), phase: progression[0].id, data: module.create() });
    },
    view(snapshot) {
      const state = structuredClone(validate(snapshot));
      return { ...phaseView(state), at: state.at, data: module.deriveView?.(state.data) ?? state.data,
        blockers: module.explainBlockers?.(state.data) ?? [] };
    },
    command(snapshot, at, action) {
      plainData(action);
      const { snapshot: state } = advance(snapshot, at);
      state.data = module.command(state.data, structuredClone(action), phaseView(state));
      return promote(validate(state));
    },
    migrate(snapshot, migrate) {
      plainData(snapshot);
      requireIdle(snapshot?.gameId === gameId && typeof migrate === 'function', 'unsupported-version');
      const upgraded = validate(migrate(structuredClone(snapshot)));
      requireIdle(upgraded.at === snapshot.at, 'migration-changed-time');
      return upgraded;
    },
  });
}
