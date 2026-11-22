import { createIdleEngine, quantity, requireIdle } from '../../public/idle/engine.js';
import { phasesFor } from '../../public/idle/progression.js';
import {
  beltTypes, cap, dockRate, fields, fundingTargets, gateScope, goods, machines, orders, prices, regions, research, scopes,
  tripSeconds, trophyLadders, units,
} from './factory-config.js';
import { fieldAt, footprint, materialGraph, occupancy, powerGrid, rate } from './factory-graph.js';
import {
  accelerateRemainders, add, apply, counter, delivered, deposit, duration, effective, hasPower, isStore, maximum, min, money,
  orderReceipt, planTick, read, stored,
} from './factory-flow.js';

const whole = (value) => value / 1000n;
const phaseNo = (phase) => Number(phase.slice(-1));
const integer = (n, lo, hi) => Number.isSafeInteger(n) && n >= lo && n <= hi;
const key = (object, value) => typeof value === 'string' && Object.hasOwn(object, value);
const label = (value) => typeof value === 'string' && value.trim().length > 0 && value.length <= 36 && !/[\p{C}<>]/u.test(value);
const load = (data, id) => data.buildings.find((node) => node.id === id);
const account = (data, id) => data.tracks.find((track) => track.id === id);
const warehouseKey = (region, scope, good) => 'yard:' + region + ':' + scope + ':' + good;
const seekDock = (r) => ({ id: r.id, type: 'dock', region: r.id, x: r.dock[0], y: r.dock[1],
  rotation: 0, enabled: true, good: '', scope: 'free', paidScope: 'free', critical: false, paid: '0', level: 1, mode: '', field: '', target: '' });

function create(preserved = { prestige: { points: 0, claimed: [] }, blueprints: [] }) {
  const data = {
    amounts: {}, buildings: [seekDock(regions[0])], tracks: [], regions: [1], activeOrders: [],
    completeOrders: [], research: {}, closed: [], nextId: 5, nextTrack: 1, lastBuild: 0,
    lastMine: null, freeAuto: '', manual: [], blueprints: preserved.blueprints, prestige: preserved.prestige,
  };
  add(data, money('free'), units(40)); add(data, money('line'), units(60)); add(data, 'funded:line', units(60));
  for (const field of Object.values(fields)) {
    let total = 0;
    for (const [scope, qty] of Object.entries(field.reserved)) {
      add(data, deposit(field.id, scope), units(qty)); total += qty;
    }
    add(data, deposit(field.id, 'free'), units(field.amount - total));
  }
  return data;
}

function validate(data) {
  if (!data || !data.amounts || !Object.entries(data.amounts).every(([id, value]) =>
    /^[a-z0-9:-]+$/i.test(id) && quantity(value) >= 0n)) return false;
  const arrays = ['buildings', 'tracks', 'regions', 'closed', 'activeOrders', 'completeOrders', 'blueprints', 'manual'];
  if (!arrays.every((id) => Array.isArray(data[id])) || !Array.isArray(data.prestige?.claimed)) return false;
  const unique = (items, fn = (id) => id) => new Set(items.map(fn)).size === items.length;
  return data.regions.length >= 1 && data.regions.length <= 4 && data.regions.every((id, i) => id === i + 1) &&
    data.buildings.length <= 640 && unique(data.buildings, (n) => n.id) &&
    data.buildings.every((n) => key(machines, n.type) && data.regions.includes(n.region) && integer(n.id, 1, Number.MAX_SAFE_INTEGER) &&
      integer(n.x, 0, 23) && integer(n.y, 0, 23) && integer(n.rotation, 0, 3) && typeof n.enabled === 'boolean' &&
      typeof n.critical === 'boolean' && scopes.includes(n.scope) && integer(n.level, 1, 3) &&
      scopes.includes(n.paidScope) && (n.good === '' || goods.includes(n.good)) && quantity(n.paid) >= 0n &&
      (!machines[n.type].field || fieldAt(n)?.id === n.field) &&
      (!machines[n.type].recipes || machines[n.type].recipes.includes(n.good)) &&
      (!isStore(n) || read(data, stored(n.id)) <= maximum(data, n))) &&
    Boolean(occupancy(data.buildings)) &&
    data.tracks.length <= 12 && unique(data.tracks, (n) => n.id) &&
    data.tracks.every((t) => load(data, t.source)?.type === 'station' && load(data, t.destination)?.type === 'station' &&
      integer(t.wagons, 1, 3) && typeof t.auto === 'boolean' &&
      (!t.manifest || goods.includes(t.manifest.good) && scopes.includes(t.manifest.scope) &&
        integer(t.manifest.elapsed, 0, 100000) && quantity(t.manifest.amount) <= cap &&
        quantity(t.manifest.unloaded) <= quantity(t.manifest.amount))) &&
    data.activeOrders.length <= 3 && unique(data.activeOrders) && unique(data.completeOrders) &&
    unique(data.manual, (item) => item.region) && data.manual.every((item) => data.regions.includes(item.region) &&
      goods.includes(item.good) && quantity(item.amount) > 0n && quantity(item.amount) <= dockRate &&
      (item.kind === 'deliver' ? key(orders, item.order) : ['rescue', 'sell'].includes(item.kind))) &&
    [...data.activeOrders, ...data.completeOrders].every((id) => key(orders, id)) &&
    Object.entries(data.research).every(([id, done]) => key(research, id) && done === true) &&
    data.closed.every((scope) => scopes.slice(1).includes(scope)) && unique(data.closed) &&
    integer(data.prestige.points, 0, 100) && data.prestige.points === data.prestige.claimed.length &&
    unique(data.prestige.claimed) && data.prestige.claimed.every((claim) => Object.entries(trophyLadders).some(([id, list]) =>
      list.some((n) => claim === id + '-' + n))) &&
    data.blueprints.length <= 6 && data.blueprints.every((item) => label(item.name) && Array.isArray(item.build) && item.build.length <= 80);
}

function canUseScope(phase, scope) { return scope === 'free' || gateScope[phase] === scope; }
function spend(data, scope, credits, part = false) {
  const amount = units(credits);
  const balance = money(scope);
  if (part && scope !== 'free' && read(data, balance) < amount) {
    const reserved = read(data, balance);
    requireIdle(read(data, money('free')) + reserved >= amount, 'factory-budget');
    add(data, balance, -reserved);
    add(data, money('free'), reserved - amount);
    return;
  }
  requireIdle(read(data, balance) >= amount, 'factory-budget');
  add(data, balance, -amount);
}

function collectCredits(data, phase, amount) {
  const goal = gateScope[phase];
  const missing = goal ? units(fundingTargets[goal]) - read(data, 'funded:' + goal) : 0n;
  const kept = missing > 0n ? min(missing, amount) : 0n;
  if (kept) { add(data, 'funded:' + goal, kept); add(data, money(goal), kept); }
  add(data, money('free'), amount - kept);
}
function enterPhase(data, phase) {
  for (let i = 2; i < phase; i++) {
    const scope = gateScope[i];
    if (data.closed.includes(scope)) continue;
    data.closed.push(scope);
    const left = read(data, money(scope));
    add(data, money(scope), -left);
    const next = gateScope[phase];
    if (next) {
      const missing = units(fundingTargets[next]) - read(data, 'funded:' + next);
      const carried = missing > 0n ? min(missing, left) : 0n;
      add(data, money(next), carried);
      add(data, 'funded:' + next, carried);
      add(data, money('free'), left - carried);
    } else add(data, money('free'), left);
  }
}

function assertTopology(data) {
  requireIdle(occupancy(data.buildings), 'factory-placement');
  requireIdle(!materialGraph(data.buildings, true).cyclic, 'factory-cycle');
}
function placement(data, raw, phase, region, scope) {
  requireIdle(raw && key(machines, raw.type) && raw.type !== 'dock', 'invalid-request');
  const def = machines[raw.type];
  const level = raw.level ?? 1;
  const rotation = raw.rotation ?? 0;
  requireIdle(integer(raw.x, 0, 23) && integer(raw.y, 0, 23) && integer(rotation, 0, 3) &&
    integer(level, 1, 3) && data.regions.includes(region) && canUseScope(phase, scope), 'factory-placement');
  const earlyTool = raw.type === 'generator' && data.prestige.points >= 15 ||
    raw.type === 'belt' && level === 2 && data.prestige.points >= 5;
  const band = raw.type === 'belt' ? beltTypes[level] : null;
  requireIdle(earlyTool || phase >= (band?.phase ?? def.phase) &&
    (!(band?.research ?? def.research) || data.research[band?.research ?? def.research]), 'locked');
  const good = raw.good ?? def.recipes?.[0] ?? '';
  if (def.recipes) requireIdle(def.recipes.includes(good) && (good !== 'copperIngot' || data.research.copper), 'locked');
  if (['lab', 'station', 'warehouse'].includes(raw.type)) requireIdle(goods.includes(good), 'invalid-request');
  else if (!def.recipes) requireIdle(good === '', 'invalid-request');
  const mode = raw.mode ?? (raw.type === 'station' ? 'out' : raw.type === 'splitter' ? 'equal' : '');
  requireIdle(raw.type === 'station' ? ['out', 'in'].includes(mode) : raw.type === 'splitter' ?
    ['equal', 'priority'].includes(mode) : mode === '', 'invalid-request');
  const node = { id: data.nextId++, type: raw.type, region, scope, x: raw.x, y: raw.y, rotation, level, good, mode,
    critical: false, enabled: true, field: '', target: '', paidScope: scope, paid: String(units(band?.cost ?? def.cost)) };
  if (def.field) {
    const field = fieldAt(node);
    requireIdle(field && field.phase <= phase && (!field.research || data.research[field.research]), 'factory-field');
    node.field = field.id;
  }
  spend(data, scope, band?.cost ?? def.cost, true);
  data.buildings.push(node);
  data.lastBuild = node.id;
}

function sendYard(data, node, store, scope) {
  for (const lane of scopes.filter((item) => effective(data, item) === scope)) {
    const key = warehouseKey(node.region, lane, node.good);
    if (read(data, key) && key !== store) return key;
  }
  return warehouseKey(node.region, scope, node.good);
}
function retire(data, node) {
  requireIdle(node && node.type !== 'dock' && !data.tracks.some((t) => t.source === node.id || t.destination === node.id), 'factory-placement');
  const scope = effective(data, node.scope), stock = read(data, stored(node.id));
  if (stock) {
    const yard = sendYard(data, node, stored(node.id), scope);
    requireIdle(read(data, yard) + stock <= cap * 4n, 'factory-stock');
    add(data, yard, stock); add(data, stored(node.id), -stock);
  }
  const treasury = effective(data, node.paidScope);
  const refund = quantity(node.paid) / (treasury === 'free' ? 2n : 1n);
  add(data, money(treasury), refund);
  data.buildings = data.buildings.filter((row) => row !== node);
  if (data.lastBuild === node.id) data.lastBuild = 0;
}

function mine(data, phase, action, at) {
  requireIdle(data.lastMine === null || at - data.lastMine >= 3000, 'factory-wait');
  const f = fields[action.field];
  const scope = action.scope ?? 'free';
  requireIdle(canUseScope(phase, scope), 'locked');
  let good = 'ironOre', amount = units(10);
  if (action.field === 'rescue') {
    requireIdle(scope === 'free' && rescueAvailable(data, phase), 'factory-field');
    amount = units(1);
  } else {
    requireIdle(f && data.regions.includes(f.region) && f.phase <= phase &&
      (!f.research || data.research[f.research]), 'factory-field');
    good = f.good;
    const lanes = scope === 'free' ? scopes.filter((key) => effective(data, key) === 'free') : [scope];
    const yard = warehouseKey(f.region, scope, good);
    amount = min(amount, cap * 4n - read(data, yard));
    let taken = 0n;
    for (const lane of lanes) {
      const ledger = deposit(f.id, lane), qty = min(read(data, ledger), amount - taken);
      add(data, ledger, -qty); taken += qty;
    }
    amount = taken;
  }
  const key = action.field === 'rescue' ? 'rescueOre' : warehouseKey(f.region, scope, good);
  requireIdle(amount > 0n && read(data, key) + amount <= cap * 4n, 'factory-stock');
  add(data, key, amount);
  add(data, counter('finite'), amount);
  data.lastMine = at;
}

function rescueAvailable(data, phase) {
  const target = gateScope[phase];
  const funds = read(data, money('free')) + (target ? read(data, money(target)) : 0n);
  if (funds >= units(30)) return false;
  let sale = read(data, 'rescueOre') + data.manual.filter(({ kind }) => kind === 'rescue')
    .reduce((sum, { amount }) => sum + quantity(amount), 0n), salvage = 0n;
  for (const [key, count] of Object.entries(data.amounts)) {
    const [, region, scope, good] = key.split(':');
    if (key.startsWith('yard:') && data.regions.includes(Number(region)) &&
        effective(data, scope) === 'free' && prices[good]) sale += quantity(count) * BigInt(prices[good]);
  }
  for (const node of data.buildings) {
    if (effective(data, node.scope) !== 'free') continue;
    salvage += quantity(node.paid) / 2n;
    if (prices[node.good]) sale += read(data, stored(node.id)) * BigInt(prices[node.good]);
    if (machines[node.type].field && node.enabled && scopes.some((lane) => effective(data, lane) === 'free' && read(data, deposit(node.field, lane)))) return false;
  }
  return funds + sale + salvage < units(30);
}

function yardTake(data, region, scope, good, want) {
  let taken = 0n;
  for (const lane of scopes.filter((item) => effective(data, item) === scope)) {
    const ledger = warehouseKey(region, lane, good);
    const qty = min(want - taken, read(data, ledger));
    add(data, ledger, -qty); taken += qty;
  }
  return taken;
}

function inventoryAction(data, action, phase) {
  const from = load(data, action.from), to = load(data, action.to);
  const region = action.region;
  const scope = action.scope ?? 'free', good = action.good;
  requireIdle(goods.includes(good) && data.regions.includes(region) && canUseScope(phase, scope), 'invalid-request');
  requireIdle((!action.from || from) && (!action.to || to), 'factory-stock');
  requireIdle(!from || isStore(from) && from.region === region && from.good === good && effective(data, from.scope) === scope, 'factory-stock');
  if (action.type === 'sell') {
    requireIdle(scope === 'free' && prices[good], 'locked');
    requireIdle(!data.manual.some((item) => item.region === region), 'factory-dock');
    const qty = from ? min(dockRate, read(data, stored(from.id))) : yardTake(data, region, scope, good, dockRate);
    requireIdle(qty > 0n, 'factory-stock');
    if (from) add(data, stored(from.id), -qty);
    data.manual.push({ region, good, amount: String(qty), kind: 'sell' });
    return;
  }
  if (action.type === 'deliver') {
    const spec = orders[action.order];
    requireIdle(data.activeOrders.includes(action.order) && !spec.rail && spec.scope === scope &&
      spec.region === region && spec.good === good, 'factory-order');
    requireIdle(!data.manual.some((item) => item.region === region), 'factory-dock');
    const need = min(dockRate, units(spec.amount) - read(data, delivered(action.order)));
    const qty = from ? min(need, read(data, stored(from.id))) : yardTake(data, region, scope, good, need);
    requireIdle(qty > 0n, 'factory-stock');
    if (from) add(data, stored(from.id), -qty);
    data.manual.push({ region, good, amount: String(qty), kind: 'deliver', order: action.order });
    return;
  }
  requireIdle((!to || to !== from && isStore(to) && to.region === region && to.good === good &&
    effective(data, to.scope) === scope) && (from || to), 'factory-stock');
  requireIdle(!to || to.type !== 'station' || to.mode === 'out', 'factory-stock');
  const limit = to ? (to.type === 'lab' ? units(research[to.target]?.amount ?? 0) : maximum(data, to)) : cap * 4n;
  const dest = to ? stored(to.id) : warehouseKey(region, scope, good);
  const want = min(cap, limit - read(data, dest));
  const qty = from ? min(want, read(data, stored(from.id))) : yardTake(data, region, scope, good, want);
  requireIdle(qty > 0n, 'factory-stock');
  if (from) add(data, stored(from.id), -qty);
  add(data, dest, qty);
}

function ordersAndCredit(data, phase) {
  for (const id of data.activeOrders.slice()) {
    const spec = orders[id];
    if (read(data, delivered(id)) < units(spec.amount)) continue;
    data.activeOrders = data.activeOrders.filter((current) => current !== id);
    data.completeOrders.push(id);
    if (id === 'pilot') {
      add(data, money('rail'), units(spec.reward));
      add(data, 'funded:rail', units(spec.reward));
    } else collectCredits(data, phase, units(spec.reward));
  }
  if (phase >= 4 && data.freeAuto && data.activeOrders.length < 3) {
    const next = Object.entries(orders).find(([id, spec]) => spec.phase <= phase && spec.good === data.freeAuto &&
      !data.completeOrders.includes(id) && !data.activeOrders.includes(id));
    if (next) data.activeOrders.push(next[0]);
  }
}

function activeRoute(data, track, power) {
  const src = load(data, track.source), dest = load(data, track.destination);
  if (!src?.enabled || !dest?.enabled || !hasPower(src, power) || !hasPower(dest, power)) return null;
  return { src, dest };
}
function routeGood(data, track, power) {
  const connected = activeRoute(data, track, power);
  if (!connected) return null;
  const { src, dest } = connected;
  return src.mode === 'out' && dest.mode === 'in' && src.good && src.good === dest.good &&
    effective(data, src.scope) === effective(data, dest.scope) ? connected : null;
}
const carLoad = (track) => units(track.wagons * 50);
function sendTrack(data, track, power, maximum = cap) {
  const route = track && !track.manifest && routeGood(data, track, power);
  requireIdle(route, 'factory-rail');
  const { src, dest } = route;
  const amount = min(maximum, min(read(data, stored(src.id)), cap - read(data, stored(dest.id))));
  requireIdle(amount > 0n, 'factory-stock');
  add(data, stored(src.id), -amount);
  track.manifest = { good: src.good, scope: effective(data, src.scope), amount: String(amount), unloaded: '0', elapsed: 0 };
}
function routeOrders(data, route) {
  return data.activeOrders.filter((id) => {
    const spec = orders[id];
    return spec.rail && spec.region === route.dest.region && spec.good === route.src.good &&
      spec.scope === effective(data, route.src.scope);
  });
}
function autoTracks(data, power, threshold = false) {
  const limits = [];
  for (const track of data.tracks) {
    if (!track.auto || track.manifest) continue;
    const route = routeGood(data, track, power);
    if (!route) continue;
    const id = routeOrders(data, route)[0];
    if (!id) continue;
    const waiting = units(orders[id].amount) - read(data, delivered(id));
    const qty = min(carLoad(track), waiting);
    if (qty <= 0n || cap - read(data, stored(route.dest.id)) < qty) continue;
    if (threshold) limits.push([stored(route.src.id), qty]);
    else if (read(data, stored(route.src.id)) >= qty) sendTrack(data, track, power, qty);
  }
  return limits;
}

function arrival(track, seconds) {
  const m = track.manifest;
  const loads = Math.max(0, Math.floor((m.elapsed + seconds) / tripSeconds) - 1);
  return min(quantity(m.amount), BigInt(loads) * carLoad(track));
}
function nextTrain(track) {
  const m = track.manifest;
  if (!m) return Infinity;
  const marker = Math.max(2 * tripSeconds, (Math.floor(m.elapsed / tripSeconds) + 1) * tripSeconds);
  return marker - m.elapsed;
}
function travel(data, powers, ticks, phase) {
  for (const track of data.tracks) {
    if (!track.manifest || !activeRoute(data, track, powers)) continue;
    const m = track.manifest, until = arrival(track, ticks);
    let remaining = until - quantity(m.unloaded);
    const dest = load(data, track.destination);
    for (const id of data.activeOrders) {
      const order = orders[id];
      if (!order.rail || order.region !== dest.region || order.good !== m.good || order.scope !== m.scope) continue;
      const piece = min(remaining, units(order.amount) - read(data, delivered(id)));
      orderReceipt(data, id, piece);
      remaining -= piece;
    }
    add(data, stored(dest.id), remaining);
    m.elapsed += ticks; m.unloaded = String(until);
    if (m.unloaded === m.amount) track.manifest = null;
  }
  ordersAndCredit(data, phase);
}

function materialCost(data, region, scope, good, qty) {
  let paid = yardTake(data, region, scope, good, qty);
  for (const node of data.buildings) {
    if (paid >= qty) break;
    if (!isStore(node) || node.region !== region || node.good !== good || effective(data, node.scope) !== scope) continue;
    const part = min(read(data, stored(node.id)), qty - paid);
    add(data, stored(node.id), -part); paid += part;
  }
  requireIdle(paid === qty, 'factory-stock');
}

function doResearch(data, phase, action) {
  const tech = research[action.tech];
  const lab = load(data, action.id);
  requireIdle(key(research, action.tech) && tech.phase <= phase && !data.research[action.tech] &&
    (!tech.prior || data.research[tech.prior]) && lab?.type === 'lab' && lab.target === action.tech &&
    lab.enabled && hasPower(lab, powerGrid(data.buildings)), 'factory-research');
  const scope = tech.scope ?? 'free';
  requireIdle(lab.good === tech.good && effective(data, lab.scope) === scope &&
    read(data, stored(lab.id)) >= units(tech.amount), 'factory-stock');
  spend(data, scope, tech.cost, true);
  add(data, stored(lab.id), -units(tech.amount));
  data.research[action.tech] = true;
}

function configure(data, phase, action, node) {
  requireIdle(node && node.type !== 'dock', 'factory-placement');
  if (action.type === 'rotate') {
    node.rotation = (node.rotation + 1) % 4;
    if (machines[node.type].field) requireIdle(fieldAt(node)?.id === node.field, 'factory-field');
    assertTopology(data);
    return;
  }
  if (action.type === 'toggle' || action.type === 'critical') {
    const prop = action.type === 'toggle' ? 'enabled' : 'critical';
    requireIdle(prop !== 'critical' || machines[node.type].power, 'locked');
    node[prop] = !node[prop]; return;
  }
  requireIdle(!read(data, stored(node.id)) && !data.tracks.some((t) => t.manifest &&
    (t.source === node.id || t.destination === node.id)), 'factory-stock');
  if (action.scope !== undefined) {
    requireIdle(canUseScope(phase, action.scope), 'locked'); node.scope = action.scope;
  }
  if (action.good !== undefined) {
    requireIdle(goods.includes(action.good) && (isStore(node) || machines[node.type].recipes?.includes(action.good)), 'invalid-request');
    requireIdle(action.good !== 'copperIngot' || data.research.copper, 'locked');
    node.good = action.good;
  }
  if (action.target !== undefined) {
    requireIdle(node.type === 'lab' && key(research, action.target) && research[action.target].phase <= phase, 'locked');
    const target = research[action.target];
    requireIdle(effective(data, node.scope) === (target.scope ?? 'free'), 'locked');
    node.target = action.target; node.good = target.good;
  }
  if (action.mode !== undefined) {
    requireIdle(node.type === 'splitter' && ['equal', 'priority'].includes(action.mode), 'invalid-request');
    node.mode = action.mode;
  }
}

function networkCount(data, power = powerGrid(data.buildings)) {
  const connected = new Set([1]);
  for (let i = 0; i < 4; i++) for (const t of data.tracks) {
    const route = routeGood(data, t, power);
    if (!route) continue;
    const { src, dest } = route;
    if (connected.has(src.region) || connected.has(dest.region)) {
      connected.add(src.region); connected.add(dest.region);
    }
  }
  return connected.size;
}
const largestGrid = (power) => Math.max(0, ...power.grids.map(({ supply }) => supply));
function milestones(data) {
  return { motor: whole(read(data, counter('shippedMotors'))), modules: whole(read(data, counter('modules'))),
    regions: BigInt(networkCount(data)), grid: read(data, counter('gridPeak')), orders: BigInt(data.completeOrders.length) };
}
function claims(data, phase) {
  if (phase < 5) return [];
  const context = milestones(data);
  return Object.entries(trophyLadders).flatMap(([type, rows]) => rows.filter((n) => BigInt(n) <= context[type]).map((n) => type + '-' + n))
    .filter((id) => !data.prestige.claimed.includes(id));
}
function facts(data) {
  const finite = read(data, counter('finite')), green = read(data, counter('renewable'));
  const power = powerGrid(data.buildings);
  return {
    ironOreSold: String(whole(read(data, counter('ironSold')))),
    ironIngotsDeliveredByBelt: String(whole(read(data, counter('beltIron')))),
    gearsDeliveredByBelt: String(whole(read(data, counter('beltGear')))),
    beltBottleneckShown: read(data, counter('diagnosed')) === 1n,
    motorPilotOrderComplete: data.completeOrders.includes('pilot'), powerGridIResearched: Boolean(data.research.grid),
    interregionalOrders: String(data.completeOrders.filter((id) => id.startsWith('F4-')).length),
    industrialPlanningIIIResearched: Boolean(data.research.industry3),
    connectedRegions: String(networkCount(data, power)), runControlModules: String(whole(read(data, counter('modules')))),
    largestPowerGridMW: String(largestGrid(power)),
    allOrders: Object.keys(orders).every((id) => data.completeOrders.includes(id)),
    renewableHalfOfOre: green > 0n && green >= finite,
    allResearch: Object.keys(research).every((code) => data.research[code]),
  };
}

const progression = phasesFor('factory');
function closeCompletedScope(data, phase) {
  const next = progression[phase];
  if (!next || phase < 2) return;
  const measurements = facts(data);
  if (next.enter.every(([id, target]) => typeof target === 'boolean' ? measurements[id] === target :
    BigInt(measurements[id]) >= BigInt(target))) enterPhase(data, phase + 1);
}

function graphOperation(data, phase, action, built) {
  switch (action.type) {
    case 'layout': {
      const { region, scope = 'free', build } = action;
      requireIdle(Array.isArray(build) && build.length > 0 && build.length <= 128 && data.buildings.length + build.length <= 640, 'factory-placement');
      for (const raw of build) placement(data, raw, phase, region, raw.scope ?? scope);
      assertTopology(data);
      return;
    }
    case 'remove': case 'undo': {
      const ids = action.type === 'undo' ? [data.lastBuild] : action.ids ?? [action.id];
      requireIdle(Array.isArray(ids) && ids.length > 0 && ids.length <= 128 && new Set(ids).size === ids.length, 'factory-placement');
      for (const id of ids) retire(data, load(data, id));
      return;
    }
    case 'rotate': case 'configure': case 'critical': case 'toggle': configure(data, phase, action, built); return;
    case 'scope-line': {
      requireIdle(Array.isArray(action.ids) && action.ids.length > 0 && action.ids.length <= 128 &&
        new Set(action.ids).size === action.ids.length, 'invalid-request');
      for (const id of action.ids) configure(data, phase, { type: 'configure', scope: action.scope }, load(data, id));
      return;
    }
    case 'blueprint': {
      requireIdle(phase === 5 && data.research.blueprint && label(action.name) && data.blueprints.length < 6 &&
        Array.isArray(action.ids) && action.ids.length > 0 && action.ids.length <= 80 && new Set(action.ids).size === action.ids.length, 'locked');
      const nodes = action.ids.map((id) => load(data, id));
      requireIdle(nodes.every((n) => n && n.type !== 'dock' && n.region === nodes[0].region), 'factory-placement');
      const x = Math.min(...nodes.map((n) => n.x)), y = Math.min(...nodes.map((n) => n.y));
      const build = nodes.map((n) => ({ type: n.type, x: n.x - x, y: n.y - y, rotation: n.rotation, good: n.good, level: n.level, mode: n.mode }));
      data.blueprints.push({ name: action.name.trim(), build });
      return;
    }
    case 'build-blueprint': {
      const plan = data.blueprints[action.index];
      requireIdle(phase === 5 && data.research.blueprint && plan && integer(action.x, 0, 23) &&
        integer(action.y, 0, 23), 'locked');
      graphOperation(data, phase, { type: 'layout', region: action.region,
        build: plan.build.map((p) => ({ ...p, x: p.x + action.x, y: p.y + action.y })) });
      return;
    }
    case 'forget-blueprint':
      requireIdle(integer(action.index, 0, data.blueprints.length - 1), 'invalid-request');
      data.blueprints.splice(action.index, 1); return;
    default: requireIdle(false, 'invalid-request');
  }
}

function regionAction(data, phase, action) {
  if (action.type === 'region') {
    const region = regions[data.regions.length], scope = phase === 4 ? 'rail' : 'free';
    requireIdle(region && phase >= region.phase, 'locked');
    spend(data, scope, region.credits, true);
    for (const [item, count] of Object.entries(region.parts)) materialCost(data, action.from ?? 1, scope, item, units(count));
    data.regions.push(region.id); data.buildings.unshift(seekDock(region)); return;
  }
  if (action.type === 'track') {
    const src = load(data, action.source), dest = load(data, action.destination);
    requireIdle(phase >= 4 && src?.type === 'station' && dest?.type === 'station' && src.mode === 'out' &&
      dest.mode === 'in' && src.region !== dest.region && data.tracks.length < 12 &&
      !data.tracks.some((track) => track.source === src.id || track.destination === dest.id) &&
      integer(action.wagons, 1, 3) && typeof action.auto === 'boolean', 'factory-rail');
    spend(data, effective(data, src.scope), 460 + (action.wagons - 1) * 150, true);
    data.tracks.push({ id: data.nextTrack++, source: src.id, destination: dest.id, wagons: action.wagons, auto: action.auto, manifest: null });
    return;
  }
  const track = account(data, action.id);
  requireIdle(track, 'factory-rail');
  if (action.type === 'dispatch') sendTrack(data, track, powerGrid(data.buildings));
  else if (action.type === 'auto-train') track.auto = !track.auto;
  else {
    requireIdle(!track.manifest, 'factory-rail');
    data.tracks = data.tracks.filter((other) => other !== track);
  }
}

function bandBottleneck(data, selected, plan) {
  if (!selected || selected.type !== 'belt') return null;
  const max = rate(selected, data);
  const current = plan.graph.output.get(selected.id).reduce((sum, edge) => sum + (plan.c.edges.get(edge.key) ?? 0n), 0n);
  plan.sourceRates ??= new Map();
  const source = (id) => {
    if (plan.sourceRates.has(id)) return plan.sourceRates.get(id);
    const node = plan.graph.nodes.get(id);
    const offered = ['belt', 'splitter', 'merger'].includes(node.type) ?
      plan.graph.input.get(id).reduce((sum, edge) => sum + source(edge.src), 0n) : rate(node, data);
    plan.sourceRates.set(id, offered);
    return offered;
  };
  const offered = plan.graph.input.get(selected.id).reduce((sum, edge) => sum + source(edge.src), 0n);
  return { limited: current >= max && offered > max, current: String(current), offered: String(offered), max: String(max) };
}

function command(data, action, phaseView, at) {
  const phase = phaseNo(phaseView.phase.id);
  enterPhase(data, phase);
  const node = load(data, action.id);
  switch (action.type) {
    case 'mine': mine(data, phase, action, at); break;
    case 'sell': case 'move': case 'deliver': inventoryAction(data, action, phase); break;
    case 'sell-rescue': {
      requireIdle(!data.manual.some((item) => item.region === 1), 'factory-dock');
      const amount = min(dockRate, read(data, 'rescueOre'));
      requireIdle(amount > 0n, 'factory-stock');
      add(data, 'rescueOre', -amount);
      data.manual.push({ region: 1, good: 'ironOre', amount: String(amount), kind: 'rescue' });
      break;
    }
    case 'fund': {
      const scope = gateScope[phase];
      requireIdle(scope, 'locked');
      const transfer = min(read(data, money('free')), units(500));
      requireIdle(transfer > 0n, 'factory-budget');
      add(data, money('free'), -transfer); add(data, money(scope), transfer); break;
    }
    case 'inspect': {
      requireIdle(phase >= 2 && bandBottleneck(data, node, planTick(data, phase))?.limited, 'factory-band');
      if (!read(data, counter('diagnosed'))) add(data, counter('diagnosed'), 1n);
      break;
    }
    case 'research': doResearch(data, phase, action); break;
    case 'accept': {
      requireIdle(key(orders, action.id) && phase >= orders[action.id].phase && data.activeOrders.length < 3 &&
        !data.activeOrders.includes(action.id) && !data.completeOrders.includes(action.id), 'factory-order');
      data.activeOrders.push(action.id); break;
    }
    case 'return':
      requireIdle(data.activeOrders.includes(action.id), 'factory-order');
      data.activeOrders = data.activeOrders.filter((item) => item !== action.id); break;
    case 'auto-order':
      requireIdle(phase >= 4 && (action.good === '' || goods.includes(action.good)), 'locked');
      data.freeAuto = action.good; break;
    case 'region': case 'track': case 'dispatch': case 'auto-train': case 'remove-track':
      regionAction(data, phase, action); break;
    default: graphOperation(data, phase, action, node);
  }
  const peak = largestGrid(powerGrid(data.buildings)), before = read(data, counter('gridPeak'));
  if (BigInt(peak) > before) add(data, counter('gridPeak'), BigInt(peak) - before);
  ordersAndCredit(data, phase);
  closeCompletedScope(data, phase);
  return data;
}

function advance(data, { from, to, phase: view }) {
  const phase = phaseNo(view.phase.id);
  enterPhase(data, phase);
  const tick = Math.floor(from / 1000), latest = Math.floor(to / 1000);
  if (latest === tick) return { until: to, data };
  const plan = planTick(data, phase);
  autoTracks(data, plan.power);
  // Dispatch changes station buffers. Re-plan only when the dispatch modifies the starting state.
  const effectivePlan = data.tracks.some((track) => track.manifest?.elapsed === 0) ? planTick(data, phase) : plan;
  const trains = data.tracks.filter((track) => activeRoute(data, track, effectivePlan.power));
  const time = Math.min(latest - tick, data.manual.length ? 1 : Infinity, ...trains.map(nextTrain));
  const counters = phase === 1 ? [[counter('ironSold'), units(100)]] : phase === 2 ?
    [[counter('beltIron'), units(50)], [counter('beltGear'), units(50)]] : [];
  const ordersDue = data.activeOrders.map((id) => [delivered(id), units(orders[id].amount)]);
  const thresholds = [...counters, ...ordersDue, ...autoTracks(data, effectivePlan.power, true)]
    .filter(([key, target]) => read(data, key) < target);
  let next = duration(effectivePlan, time, thresholds);
  if (next === 1 && time > 1) {
    next = accelerateRemainders(data, phase, time, effectivePlan, thresholds);
  } else apply(effectivePlan.c, next);
  data.manual = [];
  travel(data, effectivePlan.power, next, phase);
  const shipped = Object.keys(orders).filter((id) => orders[id].good === 'motor')
    .reduce((sum, id) => sum + read(data, delivered(id)), 0n);
  const recorded = read(data, counter('shippedMotors'));
  if (shipped > recorded) add(data, counter('shippedMotors'), shipped - recorded);
  closeCompletedScope(data, phase);
  const until = tick + next === latest ? to : (tick + next) * 1000;
  return { until, data };
}

function deriveView(data, id, at) {
  const phase = phaseNo(id);
  enterPhase(data, phase);
  const plan = planTick(data, phase);
  const flows = [...plan.graph.output.values()].flat().filter((edge) => plan.c.edges.has(edge.key))
    .map((edge) => ({ from: edge.src, to: edge.to, rate: String(plan.c.edges.get(edge.key)) }));
  const scope = gateScope[phase];
  return {
    phase, regions: data.regions.map((r) => ({ id: r, size: regions[r - 1].size })),
    fields: Object.values(fields).filter((f) => data.regions.includes(f.region) && phase >= f.phase && (!f.research || data.research[f.research]))
      .map(({ id, good, region, areas }) => ({ id, good, region, areas, stocks: Object.fromEntries(scopes
        .filter((scope) => effective(data, scope) === scope).map((scope) => [scope, String(scopes.filter((lane) =>
          effective(data, lane) === scope).reduce((sum, lane) => sum + read(data, deposit(id, lane)), 0n))])) })),
    buildings: data.buildings.map((node) => {
      const active = flows.some(({ from, to }) => from === node.id || to === node.id);
      const powered = hasPower(node, plan.power);
      const model = machines[node.type];
      const producesOrRoutes = model.field || model.recipes || ['belt', 'splitter', 'merger'].includes(node.type);
      return { ...node, scope: effective(data, node.scope), tiles: footprint(node), inventory: String(read(data, stored(node.id))),
        capacity: String(isStore(node) ? maximum(data, node) : 0n),
        status: !node.enabled ? 'paused' : !powered ? 'no-power' :
          active || node.type === 'generator' ? 'working' :
            isStore(node) && read(data, stored(node.id)) >= maximum(data, node) ? 'full' : 'waiting',
        disconnectedOutput: Boolean(node.enabled && powered && producesOrRoutes && !plan.graph.output.get(node.id).length),
        band: bandBottleneck(data, node, plan) };
    }),
    power: plan.power.grids, flows, tracks: data.tracks, free: String(read(data, money('free'))),
    reserve: String(read(data, money(scope ?? (phase === 1 ? 'line' : 'free')))), scope, amounts: data.amounts,
    tools: Object.entries(machines).filter(([type, def]) => type !== 'dock' &&
      (phase >= def.phase && (!def.research || data.research[def.research]) ||
        type === 'generator' && data.prestige.points >= 15 || type === 'belt' && data.prestige.points >= 5))
      .map(([type, { cost, power = 0, recipes: outputs }]) => ({ type, cost, power, outputs })),
    bands: Object.entries(beltTypes).filter(([level, row]) => phase >= row.phase && (!row.research || data.research[row.research]) ||
      level === '2' && data.prestige.points >= 5).map(([level, row]) => ({ level: Number(level), ...row })),
    orders: Object.entries(orders).filter(([, spec]) => phase >= spec.phase).map(([id, spec]) =>
      ({ id, ...spec, received: String(read(data, delivered(id))), active: data.activeOrders.includes(id), complete: data.completeOrders.includes(id) })),
    research: Object.entries(research).filter(([, spec]) => phase >= spec.phase).map(([id, spec]) =>
      ({ id, ...spec, complete: Boolean(data.research[id]) })),
    nextRegion: regions[data.regions.length]?.phase <= phase ? regions[data.regions.length] : null,
    goods, prices, manual: data.manual, lastBuild: data.lastBuild, blueprints: data.blueprints.map(({ name, build }) => ({ name, tiles: build.length })),
    prestige: data.prestige, eligible: claims(data, phase), autoOrder: data.freeAuto,
    rescue: rescueAvailable(data, phase), rescueOre: String(read(data, 'rescueOre')),
    mineWait: Math.max(0, (data.lastMine ?? at - 3000) + 3000 - at),
    record: facts(data), revenue: String(read(data, counter('revenue'))),
    salesRate: String(plan.c.delta.get(counter('revenue')) ?? 0n),
  };
}

export const factoryEngine = createIdleEngine({
  id: 'factory', stateVersion: 1, rulesVersion: 1, create, validate, facts, command, advance, deriveView,
  reset(data, phase, _at, requested) {
    const eligible = claims(data, phaseNo(phase));
    requireIdle(eligible.length > 0 && Array.isArray(requested) && eligible.length === requested.length &&
      eligible.every((item, i) => item === requested[i]), 'prestige-conflict');
    return create({ blueprints: data.blueprints, prestige: { points: data.prestige.points + eligible.length,
      claimed: [...data.prestige.claimed, ...eligible] } });
  },
}, progression);
