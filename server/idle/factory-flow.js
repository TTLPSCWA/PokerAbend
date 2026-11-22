import { cap, dockRate, fields, fundingTargets, gateScope, goods, machines, orders, prices, recipes, research, scopes, units } from './factory-config.js';
import { materialGraph, powerGrid, rate } from './factory-graph.js';

export const min = (a, b) => a < b ? a : b;
export const max = (a, b) => a > b ? a : b;
export const money = (scope) => 'cash:' + scope;
export const deposit = (field, scope) => 'field:' + field + ':' + scope;
export const stored = (id) => 'stock:' + id;
export const delivered = (id) => 'order:' + id;
export const counter = (id) => 'count:' + id;
export const made = (scope, good) => 'made:' + scope + ':' + good;
export const read = (data, key) => BigInt(data.amounts[key] ?? '0');
export function add(data, key, amount) {
  const next = read(data, key) + amount;
  if (next < 0n) throw new Error('Negative factory amount: ' + key);
  if (next) data.amounts[key] = String(next);
  else delete data.amounts[key];
}
export function effective(data, scope) {
  return data.closed.includes(scope) ? 'free' : scope;
}
export const isStore = (node) => ['warehouse', 'station', 'lab'].includes(node.type);
export const hasPower = (node, power) => !machines[node.type].power || power.served.has(node.id);
export const maximum = (data, node) => node.type === 'warehouse' && data.research.warehouse ? cap * 2n : cap;

const limits = {
  line: { ironIngot: 100, gear: 50 },
  pilot: { ironIngot: 140, gear: 140, copperIngot: 100, wire: 200, motor: 100 },
  rail: { ironIngot: 335, gear: 235, copperIngot: 115, wire: 230, motor: 115 },
};
const known = (map, key) => Object.hasOwn(map, key);
const intake = units(90);
const state = (data) => ({ data, delta: new Map(), used: new Map(), edges: new Map(), bounds: new Map() });
function value(c, key) { return read(c.data, key) + (c.delta.get(key) ?? 0n); }
function change(c, key, delta) { if (delta) c.delta.set(key, (c.delta.get(key) ?? 0n) + delta); }
function range(c, key, lo, hi) {
  const baseline = c.delta.get(key) ?? 0n;
  const previous = c.bounds.get(key) ?? {};
  c.bounds.set(key, {
    lo: lo === null ? previous.lo : previous.lo === undefined ? lo - baseline : max(previous.lo, lo - baseline),
    hi: hi === null ? previous.hi : previous.hi === undefined ? hi - baseline : min(previous.hi, hi - baseline),
  });
}
function available(c, key, want) {
  const have = value(c, key), take = min(want, have);
  if (take === want) range(c, key, want, null);
  else range(c, key, have, have);
  return take;
}
function room(c, key, capacity, want) {
  const have = value(c, key);
  const actual = min(want, max(0n, capacity - have));
  if (actual === want) range(c, key, null, capacity - want);
  else if (!actual) range(c, key, capacity, null);
  else range(c, key, have, have);
  return actual;
}
function checkpoint(c) { return { delta: new Map(c.delta), used: new Map(c.used), edges: new Map(c.edges) }; }
function restore(c, point) { Object.assign(c, point); }
function remainder(c, key, limit) { return max(0n, limit - (c.used.get(key) ?? 0n)); }
function use(c, key, amount) { if (amount) c.used.set(key, (c.used.get(key) ?? 0n) + amount); }

export function spread(amount, requested, priority = false) {
  const out = Array(requested.length).fill(0n);
  if (!priority) {
    const open = requested.filter((want) => want > 0n).length;
    const share = open ? amount / BigInt(open) : 0n;
    for (let i = 0; i < out.length; i++) { out[i] = min(share, requested[i]); amount -= out[i]; }
  }
  for (let i = 0; i < out.length; i++) {
    const extra = min(amount, requested[i] - out[i]);
    out[i] += extra;
    amount -= extra;
  }
  return out;
}

function earmark(c, scope, total, target) {
  const ledger = 'funded:' + scope;
  const kept = room(c, ledger, units(target), total);
  change(c, ledger, kept);
  change(c, money(scope), kept);
  change(c, money('free'), total - kept);
}

function sell(c, phase, scope, good, amount) {
  if (!known(prices, good) || !amount) return;
  const sale = amount * BigInt(prices[good]);
  change(c, counter('revenue'), sale);
  if (good === 'ironOre') {
    change(c, counter('ironSold'), amount);
    if (phase === 1 && !c.data.closed.includes('line')) { earmark(c, 'line', sale, fundingTargets.line); return; }
  }
  if (scope === 'line' && !c.data.closed.includes('pilot')) {
    earmark(c, 'pilot', sale, fundingTargets.pilot);
    return;
  }
  const current = gateScope[phase];
  if (current && !c.data.closed.includes(current)) earmark(c, current, sale, fundingTargets[current]);
  else change(c, money('free'), sale);
}

function creditRescue(c, phase, amount) {
  const starter = min(amount, max(0n, units(30) - value(c, money('free'))));
  change(c, money('free'), starter);
  change(c, counter('revenue'), starter);
  change(c, counter('ironSold'), starter);
  sell(c, phase, 'free', 'ironOre', amount - starter);
}

export function orderReceipt(data, id, amount) {
  add(data, delivered(id), amount);
}

function sinkNeed(c, graph, node, good, scope, phase, railAtDock = false) {
  if (node.type === 'dock') {
    const orderId = c.data.activeOrders.find((id) => {
      const spec = orders[id];
      return spec.good === good && spec.scope === scope && spec.region === node.region && (!spec.rail || railAtDock);
    });
    const obligated = orderId ? room(c, delivered(orderId), units(orders[orderId].amount), dockRate) : 0n;
    if (scope === 'line' && ['ironIngot', 'gear'].includes(good)) {
      return room(c, counter(good === 'gear' ? 'beltGear' : 'beltIron'), units(50), dockRate);
    }
    if (scope === 'free' && known(prices, good)) return dockRate;
    return obligated;
  }
  if (effective(c.data, node.scope) !== scope || node.good !== good) return 0n;
  if (node.type === 'warehouse' || node.type === 'station' && node.mode === 'out') {
    return room(c, stored(node.id), maximum(c.data, node), intake);
  }
  if (node.type === 'lab') {
    const tech = research[node.target];
    if (!tech || c.data.research[node.target] || (tech.scope && tech.scope !== scope) || phase < tech.phase) return 0n;
    return room(c, stored(node.id), units(tech.amount), cap);
  }
  return 0n;
}

function takeDeposit(c, node, good, scope, want) {
  const field = fields[node.field];
  if (field.good !== good) return 0n;
  let taken = want;
  if (node.type !== 'renewable') {
    taken = 0n;
    const lanes = scope === 'free' ? scopes.filter((key) => effective(c.data, key) === 'free') : [scope];
    for (const lane of lanes) {
      const key = deposit(field.id, lane), quantity = available(c, key, want - taken);
      change(c, key, -quantity);
      taken += quantity;
      if (taken === want) break;
    }
  }
  change(c, counter(node.type === 'renewable' ? 'renewable' : 'finite'), taken);
  return taken;
}

function beltPath(graph, edge) {
  graph.beltPaths ??= new Map();
  if (graph.beltPaths.has(edge.key)) return graph.beltPaths.get(edge.key);
  const src = graph.nodes.get(edge.src);
  const path = src.type === 'belt' || ['splitter', 'merger'].includes(src.type) && graph.input.get(src.id).some((link) => beltPath(graph, link));
  graph.beltPaths.set(edge.key, path);
  return path;
}

// Pull through fixed ports. Each sink reserves downstream capacity before upstream
// production. A two-input recipe first proves the feasible output, then draws
// exactly that amount of both ingredients, without leaving a half-made product.
export function planTick(data, phase, structures = data.buildings) {
  const graph = materialGraph(structures), power = powerGrid(structures), c = state(data);
  if (graph.cyclic) throw new Error('Factory material cycle');
  const ready = (node) => node.enabled && hasPower(node, power);
  const sink = (node) => node.type === 'dock' || isStore(node) && !(node.type === 'station' && node.mode === 'in');
  let redistributing = false;
  const demand = new Map();
  function wanted(edge, good, scope) {
    const key = edge.key + ':' + good + ':' + scope;
    if (demand.has(key)) return demand.get(key);
    const node = graph.nodes.get(edge.to);
    let result = 0n;
    if (ready(node)) {
      if (sink(node) && node.type !== 'warehouse') result = sinkNeed(c, graph, node, good, scope, phase);
      else if (effective(data, node.scope) === scope) {
        const downstream = (item) => graph.output.get(node.id).reduce((n, link) => n + wanted(link, item, scope), 0n);
        const formula = machines[node.type].recipes && recipes[node.good];
        if (formula && known(formula.input, good)) result = min(rate(node, data), downstream(formula.output)) * BigInt(formula.input[good]) / BigInt(formula.batch);
        else if (node.type === 'warehouse' && node.good === good) {
          result = sinkNeed(c, graph, node, good, scope, phase) + (phase >= 3 ? downstream(good) : 0n);
        }
        else if (['splitter', 'merger', 'belt'].includes(node.type)) result = min(rate(node, data), downstream(good));
      }
    }
    demand.set(key, result);
    return result;
  }

  function takeIncoming(node, good, scope, want, distribute = false, mustBelt = false) {
    const input = graph.input.get(node.id).filter((edge) => !mustBelt || beltPath(graph, edge));
    let got = 0n;
    if (distribute && input.length > 1 && !redistributing) {
      const bounds = spread(want, input.map(() => want));
      for (let i = 0; i < input.length; i++) got += take(input[i], good, scope, bounds[i]);
    }
    for (const edge of input) {
      if (got === want) break;
      if (node.type === 'belt' && input.some((other) => other.key !== edge.key && c.edges.has(other.key))) continue;
      got += take(edge, good, scope, want - got);
    }
    return got;
  }

  function recipeOutput(node, good, scope, want) {
    if (node.good !== good) return 0n;
    const recipe = recipes[good];
    const batch = BigInt(recipe.batch);
    let wantedBatches = want / batch;
    if (scope !== 'free') {
      const ceiling = units(limits[scope]?.[good] ?? 0);
      wantedBatches = room(c, made(scope, good), ceiling, wantedBatches * batch) / batch;
    }
    if (!wantedBatches) return 0n;
    const ingredients = Object.entries(recipe.input);
    if (ingredients.length > 1) {
      const before = checkpoint(c);
      for (const [input, needed] of ingredients) {
        const qty = takeIncoming(node, input, scope, wantedBatches * BigInt(needed));
        wantedBatches = min(wantedBatches, qty / BigInt(needed));
      }
      restore(c, before);
    }
    const [primary, ratio] = ingredients[0];
    if (ingredients.length === 1 && ratio > 1) {
      const before = checkpoint(c);
      const qty = takeIncoming(node, primary, scope, wantedBatches * BigInt(ratio));
      restore(c, before);
      wantedBatches = min(wantedBatches, qty / BigInt(ratio));
    }
    if (!wantedBatches) return 0n;
    for (const [input, ratio] of ingredients) {
      const request = wantedBatches * BigInt(ratio);
      const qty = takeIncoming(node, input, scope, request);
      if (ingredients.length === 1 && ratio === 1) wantedBatches = qty;
      else if (qty !== request) throw new Error('Factory recipe reservation changed');
    }
    const result = wantedBatches * batch;
    if (scope !== 'free') change(c, made(scope, good), result);
    if (good === 'controlModule') change(c, counter('modules'), result);
    if (good === 'motor') change(c, counter('motors'), result);
    return result;
  }

  function take(edge, good, scope, want) {
    const node = graph.nodes.get(edge.src);
    if (want <= 0n || !ready(node) || effective(data, node.scope) !== scope) return 0n;
    const key = 'rate:' + node.id;
    const model = machines[node.type];
    if (model.rate || model.recipes || node.type === 'belt') want = min(want, remainder(c, key, rate(node, data)));
    if (!want) return 0n;
    let result = 0n;
    if (model.field) result = takeDeposit(c, node, good, scope, want);
    else if (model.recipes) result = recipeOutput(node, good, scope, want);
    else if (node.type === 'belt' || node.type === 'merger') result = takeIncoming(node, good, scope, want, node.type === 'merger');
    else if (node.type === 'splitter') {
      if (!redistributing) {
        const links = graph.output.get(node.id);
        const budget = remainder(c, key, rate(node, data));
        const requested = links.map((out) => max(0n, wanted(out, good, scope) - (c.edges.get(out.key) ?? 0n)));
        const estimate = checkpoint(c);
        const supply = takeIncoming(node, good, scope, budget);
        restore(c, estimate);
        want = min(want, spread(supply, requested, node.mode === 'priority')[links.indexOf(edge)]);
      }
      result = takeIncoming(node, good, scope, want);
    } else if (node.good === good && (node.type === 'warehouse' && phase >= 3 || node.type === 'station' && node.mode === 'in')) {
      const taken = available(c, stored(node.id), want);
      change(c, stored(node.id), -taken);
      result = taken + (node.type === 'warehouse' ? takeIncoming(node, good, scope, want - taken) : 0n);
    }
    use(c, key, result);
    if (result) c.edges.set(edge.key, (c.edges.get(edge.key) ?? 0n) + result);
    return result;
  }

  function supplyDocks() {
    for (const node of structures) {
      if (node.type !== 'dock') continue;
      const key = 'dock:' + node.id;
      // Bound deliveries first, then open-market sales on the remaining dock rate.
      for (const scope of [...scopes.slice(1), 'free']) {
        if (effective(data, scope) !== scope) continue;
        for (const [good, orderId] of goods.map((item) => [item, data.activeOrders.find((id) => {
          const order = orders[id]; return !order.rail && order.good === item && order.region === node.region && order.scope === scope;
        })])) {
          const demand = min(sinkNeed(c, graph, node, good, scope, phase), remainder(c, key, dockRate));
          if (demand <= 0n) continue;
          const goal = good === 'ironIngot' ? 'beltIron' : good === 'gear' ? 'beltGear' : null;
          const onBelt = goal ? takeIncoming(node, good, scope, demand, false, true) : 0n;
          if (goal) change(c, counter(goal), onBelt);
          const moved = onBelt + (scope === 'line' ? 0n : takeIncoming(node, good, scope, demand - onBelt));
          if (!moved) continue;
          use(c, key, moved);
          const bound = orderId ? room(c, delivered(orderId), units(orders[orderId].amount), moved) : 0n;
          if (bound) change(c, delivered(orderId), bound);
          if (scope === 'line' || scope === 'free') sell(c, phase, scope, good, moved - bound);
        }
      }
    }
  }

  function supplyStores() {
    for (const node of structures) {
      if (node.type === 'dock' || !sink(node) || !ready(node)) continue;
      const scope = effective(data, node.scope), good = node.good;
      const want = sinkNeed(c, graph, node, good, scope, phase);
      if (want) change(c, stored(node.id), takeIncoming(node, good, scope, want));
    }
  }

  for (const item of data.manual) {
    const amount = BigInt(item.amount);
    use(c, 'dock:' + item.region, amount); // Fixed dock IDs are the region IDs.
    if (item.kind === 'deliver') change(c, delivered(item.order), amount);
    else if (item.kind === 'rescue') creditRescue(c, phase, amount);
    else sell(c, phase, 'free', item.good, amount);
  }
  supplyDocks();
  supplyStores();
  if (structures.some(({ type }) => type === 'splitter')) {
    redistributing = true;
    supplyDocks();
    supplyStores();
  }
  return { c, graph, power };
}

export function duration(plan, maximumTicks, thresholds = []) {
  const { c } = plan;
  let ticks = BigInt(maximumTicks);
  for (const [key, change] of c.delta) {
    const { lo, hi } = c.bounds.get(key) ?? {};
    if (change > 0n && hi !== undefined) ticks = min(ticks, (hi - read(c.data, key)) / change + 1n);
    if (change < 0n && lo !== undefined) ticks = min(ticks, (read(c.data, key) - lo) / -change + 1n);
  }
  for (const [key, target] of thresholds) {
    const change = c.delta.get(key) ?? 0n, missing = target - read(c.data, key);
    if (change > 0n && missing > 0n) ticks = min(ticks, (missing + change - 1n) / change);
  }
  return Number(max(1n, ticks));
}

export function apply(c, ticks) {
  for (const [key, delta] of c.delta) if (delta) add(c.data, key, delta * BigInt(ticks));
}

// Integer division at a junction can alternate a small warehouse remainder.
// Recognize the repeated sequence and prove repeats against every range
// recorded by the original planner. Never assume that a repeat implies stock,
// draw, or storage room are unlimited.
export function accelerateRemainders(data, phase, horizon, first, thresholds) {
  const budget = Math.min(horizon, 24);
  const working = { ...data, amounts: { ...data.amounts } };
  const seen = new Map(), history = [];
  for (let tick = 0; tick < budget; tick++) {
    const plan = tick === 0 ? first : planTick(working, phase);
    const changes = [...plan.c.delta].filter(([, amount]) => amount !== 0n);
    const signature = changes.slice().sort(([a], [b]) => a.localeCompare(b))
      .map(([id, amount]) => id + '=' + amount).join(';');
    const previous = seen.get(signature);
    if (previous !== undefined) {
      const cycle = history.slice(previous);
      const net = new Map();
      for (const step of cycle) for (const [key, amount] of step.changes) net.set(key, (net.get(key) ?? 0n) + amount);
      let repeats = BigInt(Math.floor((horizon - tick) / cycle.length));
      // A repeated signature alone does not identify the same state. Check the
      // intermediate bounds with the observed net change for each repetition.
      for (const step of cycle) for (const [key, lo, hi, base] of step.ranges) {
        const change = net.get(key) ?? 0n;
        if (change > 0n && hi !== undefined) repeats = min(repeats, (hi - base) / change);
        if (change < 0n && lo !== undefined) repeats = min(repeats, (base - lo) / -change);
      }
      for (const [key, target] of thresholds) {
        const change = net.get(key) ?? 0n;
        if (change > 0n) repeats = min(repeats, (target - 1n - read(working, key)) / change);
      }
      if (repeats > 0n) {
        for (const [key, change] of net) if (change) add(working, key, change * repeats);
        data.amounts = working.amounts;
        return tick + Number(repeats) * cycle.length;
      }
    }
    const ranges = [...plan.c.bounds].map(([key, { lo, hi }]) => [key, lo, hi, read(working, key)]);
    history.push({ ranges, changes });
    seen.set(signature, tick);
    apply({ ...plan.c, data: working }, 1);
    if (thresholds.some(([key, target]) => read(working, key) >= target)) {
      data.amounts = working.amounts;
      return tick + 1;
    }
  }
  data.amounts = working.amounts;
  return budget;
}
