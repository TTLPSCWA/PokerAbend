// IDLE-FREEZE-01: Zugumlauf (rulesVersion 2), offene Testkennungen und Worst-Case-Rechenbudget.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { phasesFor } from '../public/idle/progression.js';
import { createIdleExportCodec } from '../server/idle/exports.js';
import { factoryEngine as factory } from '../server/idle/factory.js';
import { createIdleFileStore, createIdleSaveService } from '../server/idle/savepoints.js';
import { spielhalleEngine as hall } from '../server/idle/spielhalle.js';
import { PROFILES } from '../server/idle/spielhalle-config.js';
import { studioEngine as studio } from '../server/idle/studio.js';
import { operations, playFactory } from './factory-playthrough.js';
import { playHall } from './spielhalle-playthrough.js';
import { playStudio } from './studio-playthrough.js';

const epoch = 1_790_000_000_000;
const second = 1000, minute = 60 * second, hour = 60 * minute, day = 24 * hour;
const cell = (type, x, y, rotation = 0, extra = {}) => ({ type, x, y, rotation, ...extra });

function game(engine, start = engine.create(epoch)) {
  let snapshot = start;
  return {
    get snapshot() { return snapshot; },
    view: () => engine.view(snapshot),
    command(action) { snapshot = engine.command(snapshot, snapshot.at, action); },
    wait(ms) { const result = engine.advance(snapshot, snapshot.at + ms); snapshot = result.snapshot; return result.segments; },
  };
}
const at = (engine, base, offset) => engine.advance(base, base.at + offset).snapshot;
function splitEqual(engine, base, offsets) {
  let state = base;
  for (const offset of offsets) state = at(engine, state, base.at + offset - state.at);
  assert.deepEqual(state, at(engine, base, offsets.at(-1)));
  return state;
}

// ---------- Factory: Zugumlauf ----------

let trainBase;
// Stand des regulären Spielwegs direkt vor dem F4-03-Versand: Auftrag angenommen,
// 60 Motoren im Ausgangsbahnhof, Strecke mit einem Wagen im Autobetrieb, kein Manifest.
async function beforeF403() {
  if (trainBase) return structuredClone(trainBase);
  const g = game(factory), stop = new Error('F4-03');
  try {
    await playFactory({ ...g, milestone() {}, wait(ms) {
      if (ms === 239 * second) throw stop;
      g.wait(ms);
    } });
  } catch (error) { if (error !== stop) throw error; }
  trainBase = g.snapshot;
  assert.deepEqual(trainBase.data.activeOrders, ['F4-03']);
  assert.equal(trainBase.data.tracks[0].manifest, null);
  return structuredClone(trainBase);
}
const rail = (state) => state.data.tracks[0];
// Motorlager des Spielwegs in Region 1 (Quelle für Nachladungen).
const depot = (state) => state.data.buildings.find((row) => row.region === 1 && row.type === 'warehouse' && row.good === 'motor').id;
function shift(state, from, to, amount) {
  const take = (id, delta) => { state.data.amounts['stock:' + id] = String(BigInt(state.data.amounts['stock:' + id] ?? '0') + delta); };
  take(from, -amount); take(to, amount);
  return state;
}
const received = (state) => BigInt(state.data.amounts['order:F4-03'] ?? '0');
const stockOf = (state, id) => BigInt(state.data.amounts['stock:' + id] ?? '0');
const credits = (state) => Object.entries(state.data.amounts).filter(([key]) => key.startsWith('cash:'))
  .reduce((sum, [, value]) => sum + BigInt(value), 0n);
// Gesamter Motorbestand in Lagern, Bahnhöfen, Hof, Fracht und Auftrag: darf sich durch Transport nicht ändern.
function motors(state) {
  const goods = new Set(state.data.buildings.filter(({ good }) => good === 'motor').map(({ id }) => 'stock:' + id));
  let total = received(state);
  for (const [key, value] of Object.entries(state.data.amounts)) {
    if (goods.has(key) || /^yard:\d+:\w+:motor$/.test(key)) total += BigInt(value);
  }
  for (const { manifest: m } of state.data.tracks) if (m?.good === 'motor') total += BigInt(m.amount) - BigInt(m.unloaded);
  return total;
}

test('IDLE-FREEZE-01 Zug: fortlaufender Umlauf lädt nach, ohne erneuten Anlauf und ohne Doppelbuchung', async () => {
  const base = await beforeF403();
  const source = rail(base).source;
  // Nur 50 Motoren am Bahnhof: der Versand startet mit einer Wagenladung, der Rest kommt später aus dem Lager.
  const partial = shift(structuredClone(base), source, depot(base), 10_000n);
  const g = game(factory, partial);
  g.wait(100 * second);
  assert.deepEqual(rail(g.snapshot).manifest, { good: 'motor', scope: 'rail', amount: '50000', unloaded: '0', elapsed: 100, skipped: '0' });
  const total = motors(g.snapshot);
  g.command({ type: 'move', region: 1, scope: 'rail', good: 'motor', from: depot(base), to: source });
  const loaded = g.snapshot;
  assert.equal(stockOf(loaded, source), 10_000n);
  // Bei der Abfahrt nach 240 s übernimmt der laufende Umlauf genau die offenen 10 Motoren.
  const first = at(factory, loaded, 140 * second);
  assert.equal(received(first), 50_000n);
  assert.deepEqual(rail(first).manifest, { good: 'motor', scope: 'rail', amount: '60000', unloaded: '50000', elapsed: 240, skipped: '0' });
  assert.equal(stockOf(first, source), 0n);
  const before = at(factory, loaded, 259_999);
  const done = at(factory, loaded, 260 * second);
  assert.equal(received(before), 50_000n);
  assert.equal(received(done), 60_000n);
  assert.equal(rail(done).manifest, null);
  assert.equal(done.data.completeOrders.filter((id) => id === 'F4-03').length, 1);
  assert.equal(credits(done) - credits(before), 2_200_000n);
  assert.equal(motors(done), total);
  splitEqual(factory, loaded, [1 * second, 140 * second, 200 * second, 259_999, 260 * second]);
  // Ohne weiteren Auftrag bleibt die Strecke stehen: keine weiteren Abfahrten, keine weiteren Segmente.
  const year = factory.advance(done, done.at + 365 * day);
  assert.equal(received(year.snapshot), 60_000n);
  assert.equal(credits(year.snapshot), credits(done));
  assert.ok(year.segments <= 3, 'segments ' + year.segments);
});

test('IDLE-FREEZE-01 Zug: Materialmangel, Strommangel, Abschalten und Wiederaktivierung', async () => {
  const base = await beforeF403();
  const { source, destination } = rail(base);
  // Fehlendes Material: 30 Motoren reichen nicht für eine Wagenladung. Der Zug wartet, nichts geht verloren.
  const short = shift(structuredClone(base), source, depot(base), 30_000n);
  const waiting = factory.advance(short, short.at + 30 * day);
  assert.equal(rail(waiting.snapshot).manifest, null);
  assert.equal(stockOf(waiting.snapshot, source), 30_000n);
  assert.equal(motors(waiting.snapshot), motors(short));
  assert.ok(waiting.segments <= 3);
  const supplied = game(factory, waiting.snapshot);
  supplied.command({ type: 'move', region: 1, scope: 'rail', good: 'motor', from: depot(base), to: source });
  supplied.wait(second);
  assert.equal(rail(supplied.snapshot).manifest.amount, '60000');

  // Strommangel am Ziel: der Umlauf hält mit eingefrorener Fahrzeit an und läuft ohne neuen Anlauf weiter.
  const g = game(factory, base);
  g.wait(200 * second);
  const generator = g.snapshot.data.buildings.find((row) => row.region === 2 && row.type === 'generator').id;
  g.command({ type: 'toggle', id: generator });
  assert.equal(g.view().data.buildings.find(({ id }) => id === destination).status, 'no-power');
  const dark = g.snapshot;
  const month = factory.advance(dark, dark.at + 30 * day);
  assert.equal(month.segments, 1);
  assert.deepEqual(rail(month.snapshot).manifest, rail(dark).manifest);
  assert.equal(received(month.snapshot), 0n);
  g.wait(30 * day);
  g.command({ type: 'toggle', id: generator });
  const lit = g.snapshot;
  assert.equal(received(at(factory, lit, 39_999)), 0n);
  assert.equal(received(at(factory, lit, 40 * second)), 50_000n);
  assert.equal(received(at(factory, lit, 160 * second)), 60_000n);

  // Abgeschalteter Ausgangsbahnhof (unterbrochene Verbindung) pausiert ebenso. Strecke und Bahnhof
  // lassen sich mit Fracht an Bord weder entfernen noch umkonfigurieren.
  const cut = game(factory, base);
  cut.wait(second);
  assert.throws(() => cut.command({ type: 'remove-track', id: rail(cut.snapshot).id }), { code: 'factory-rail' });
  assert.throws(() => cut.command({ type: 'configure', id: source, good: 'gear' }), { code: 'factory-stock' });
  assert.throws(() => cut.command({ type: 'dispatch', id: rail(cut.snapshot).id }), { code: 'factory-rail' });
  cut.command({ type: 'toggle', id: source });
  cut.wait(day);
  assert.equal(rail(cut.snapshot).manifest.elapsed, 1);
  cut.command({ type: 'toggle', id: source });
  assert.equal(received(at(factory, cut.snapshot, 238_999)), 0n);
  assert.equal(received(at(factory, cut.snapshot, 239 * second)), 50_000n);

  // Autobetrieb aus: Fracht an Bord wird zugestellt, aber nichts nachgeladen. Wieder an: neuer Umlauf mit Anlauf.
  const partial = shift(structuredClone(base), source, depot(base), 10_000n);
  const manual = game(factory, partial);
  manual.wait(second);
  manual.command({ type: 'auto-train', id: rail(manual.snapshot).id });
  manual.command({ type: 'move', region: 1, scope: 'rail', good: 'motor', from: depot(base), to: source });
  manual.wait(239 * second);
  assert.equal(received(manual.snapshot), 50_000n);
  assert.equal(rail(manual.snapshot).manifest, null);
  manual.wait(day);
  assert.equal(received(manual.snapshot), 50_000n);
  manual.command({ type: 'auto-train', id: rail(manual.snapshot).id });
  const resumed = manual.snapshot;
  assert.equal(received(at(factory, resumed, 239_999)), 50_000n);
  assert.equal(received(at(factory, resumed, 240 * second)), 60_000n);
});

test('IDLE-FREEZE-01 Zug: konkurrierende Strecken teilen den offenen Auftrag, volles Ziellager hält den Versand', async () => {
  const base = await beforeF403();
  const g = game(factory, base);
  const ops = operations({ command: (a) => g.command(a), view: () => g.view(), wait: (ms) => g.wait(ms) });
  // Zweite Strecke: das Labor macht Platz und 1 MW frei für einen weiteren Ausgangsbahnhof.
  const lab = await ops.id(1, 2, 5);
  await ops.remove(1, [[2, 5]]);
  assert.equal(g.snapshot.data.buildings.some(({ id }) => id === lab), false);
  await ops.layout(1, 'rail', [cell('station', 2, 5, 0, { good: 'motor', mode: 'out' })]);
  await ops.layout(2, 'rail', [cell('station', 18, 11, 0, { good: 'motor', mode: 'in' })]);
  const from = await ops.id(1, 2, 5), to = await ops.id(2, 18, 11);
  assert.equal(g.view().data.buildings.find(({ id }) => id === from).status !== 'no-power', true);
  await ops.run('track', { source: from, destination: to, wagons: 1, auto: true });
  // Strecke B erhält 55 Motoren, Strecke A behält 5. Zusammen genau der offene Auftrag.
  const split = shift(structuredClone(g.snapshot), rail(base).source, from, 55_000n);
  const other = split.data.tracks.find(({ source }) => source === from).id;
  const total = motors(split);
  const train = (s, id) => s.data.tracks.find((row) => row.id === id).manifest;
  const started = at(factory, split, second);
  // A wartet (5 < eine Wagenladung), B lädt alle 55. Danach ist nur noch 5 offen, das lädt A.
  assert.equal(train(started, rail(base).id)?.amount, '5000');
  assert.equal(train(started, other).amount, '55000');
  assert.equal(stockOf(started, from), 0n);
  const done = at(factory, split, 361 * second);
  assert.equal(received(done), 60_000n);
  assert.equal(done.data.completeOrders.filter((id) => id === 'F4-03').length, 1);
  assert.equal(stockOf(done, to), 0n);
  assert.equal(stockOf(done, rail(base).destination), 0n);
  assert.equal(motors(done), total);
  splitEqual(factory, split, [second, 2 * second, 240 * second, 241 * second, 361 * second]);

  // Volles Ziellager: ohne Platz für die erste Ladung bleibt die Fracht am Ausgangsbahnhof.
  const full = structuredClone(base);
  full.data.amounts['stock:' + rail(full).destination] = String(500_000n - 49_999n);
  const blocked = factory.advance(full, full.at + 30 * day);
  assert.equal(rail(blocked.snapshot).manifest, null);
  assert.equal(stockOf(blocked.snapshot, rail(full).source), 60_000n);
  assert.equal(received(blocked.snapshot), 0n);
  assert.ok(blocked.segments <= 3);
});

test('IDLE-FREEZE-01 Zug: Speichern während der Fahrt, Serverneustart und Offline-Fortschritt', async (t) => {
  const base = await beforeF403();
  const folder = mkdtempSync(join(tmpdir(), 'idle-freeze-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const disk = createIdleFileStore(folder);
  const user = 'b'.repeat(32), id = 'factory';
  const running = at(factory, base, 300 * second);
  assert.deepEqual(rail(running).manifest, { good: 'motor', scope: 'rail', amount: '60000', unloaded: '50000', elapsed: 300, skipped: '0' });
  disk.compareAndSet(user, id, 0, { format: 1, revision: 1, runId: '00000000-0000-4000-8000-000000000001', snapshot: running,
    operation: { id: 'seed-train', digest: '0'.repeat(64) } });
  let now = running.at + 30 * second;
  const codec = createIdleExportCodec({ keys: { test: Buffer.alloc(32, 7) }, current: 'test' });
  const boot = () => createIdleSaveService({ engines: [factory], store: disk, codec, now: () => now });
  let service = boot();
  let session = service.open(user, id);
  const saved = service.save(user, id, { id: 'mid-run', token: session.token, sessionVersion: session.sessionVersion, revision: session.revision });
  assert.equal(disk.read(user, id).snapshot.data.tracks[0].manifest.elapsed, 330);
  // Neustart: flüchtige Sitzung weg, Rechnung ab dem bestätigten Stand.
  now = running.at + day;
  service = boot();
  session = service.open(user, id);
  assert.equal(saved.revision, 2);
  const view = session.view.data;
  assert.equal(view.orders.find(({ id: order }) => order === 'F4-03').received, '60000');
  assert.equal(view.tracks[0].manifest, null);
  assert.deepEqual(service.view(user, id, session.token).view.data.amounts, at(factory, running, day - 300 * second + 300 * second).data.amounts);
  // Offline: ganzer Zeitraum und Teilintervalle über alle Abfahrts- und Ankunftsgrenzen sind identisch.
  splitEqual(factory, base, [1, 120 * second, 239_999, 240 * second, 300 * second, 359_999, 360 * second, 7 * day]);
});

test('IDLE-FREEZE-01: ältere Factory-Stände (Regelversion 1) werden kontrolliert und unverändert abgelehnt', async (t) => {
  const old = structuredClone(await beforeF403());
  old.stateVersion = 1; old.rulesVersion = 1;
  delete old.data.tracks[0].skipped;
  assert.throws(() => factory.validate(old), { code: 'unsupported-version' });
  const folder = mkdtempSync(join(tmpdir(), 'idle-freeze-v1-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const disk = createIdleFileStore(folder), user = 'c'.repeat(32);
  disk.compareAndSet(user, 'factory', 0, { format: 1, revision: 1, runId: '00000000-0000-4000-8000-000000000002', snapshot: old,
    operation: { id: 'legacy', digest: '1'.repeat(64) } });
  const file = join(folder, readdirSync(folder)[0]);
  const bytes = readFileSync(file);
  const codec = createIdleExportCodec({ keys: { test: Buffer.alloc(32, 8) }, current: 'test' });
  const service = createIdleSaveService({ engines: [factory], store: disk, codec, now: () => old.at + day });
  assert.throws(() => service.open(user, 'factory'), { code: 'unsupported-version' });
  assert.throws(() => service.preview(user, 'factory'), { code: 'unsupported-version' });
  assert.deepEqual(readFileSync(file), bytes);
});

// ---------- FE-015 ----------

test('FE-015: volles Ausgangslager und Stromausfall stoppen ohne Duplikat oder Materialverlust, Erholung bedienbar', async () => {
  const g = game(factory);
  await playFactory({ ...g, milestone() {} });
  const ops = operations({ command: (a) => g.command(a), view: () => g.view(), wait: (ms) => g.wait(ms) });
  await ops.layout(4, 'free', [cell('electricDrill', 0, 0), cell('belt', 2, 0, 0, { level: 3 }), cell('electricFurnace', 3, 0),
    cell('belt', 5, 0, 0, { level: 3 }), cell('warehouse', 6, 0, 0, { good: 'ironIngot' })]);
  const [drill, furnace, store] = [[0, 0], [3, 0], [6, 0]].map(([x, y]) => g.view().data.buildings
    .find((row) => row.region === 4 && row.x === x && row.y === y).id);
  const generator = g.view().data.buildings.find((row) => row.region === 4 && row.type === 'generator').id;
  await ops.connectPower(4, 'free', [drill, furnace], [generator]);
  const ore = (s) => BigInt(s.data.amounts['field:ridge:free'] ?? '0');
  const ingots = (s) => BigInt(s.data.amounts['stock:' + store] ?? '0');
  const status = (s, id) => factory.view(s).data.buildings.find((row) => row.id === id).status;
  const start = g.snapshot;
  assert.equal(status(start, furnace), 'working');
  // Bis zum vollen Lager: jeder Barren verbraucht genau zwei Erz aus dem Feld.
  const filled = factory.advance(start, start.at + day);
  const capacity = BigInt(factory.view(filled.snapshot).data.buildings.find((row) => row.id === store).capacity);
  assert.equal(ingots(filled.snapshot), capacity);
  assert.equal(ore(start) - ore(filled.snapshot), 2n * capacity);
  assert.equal(status(filled.snapshot, store), 'full');
  assert.equal(status(filled.snapshot, furnace), 'waiting');
  const decade = factory.advance(filled.snapshot, filled.snapshot.at + 3650 * day);
  assert.equal(ingots(decade.snapshot), capacity);
  assert.equal(ore(decade.snapshot), ore(filled.snapshot));
  assert.ok(decade.segments <= 2);
  splitEqual(factory, start, [second, minute, hour, day]);
  // Erholung: Lager leeren lässt die Produktion mit derselben Bilanz weiterlaufen.
  const recover = game(factory, filled.snapshot);
  recover.command({ type: 'move', region: 4, scope: 'free', good: 'ironIngot', from: store });
  assert.equal(status(recover.snapshot, furnace), 'working');
  const moved = capacity - ingots(recover.snapshot);
  recover.wait(day);
  assert.equal(ore(filled.snapshot) - ore(recover.snapshot), 2n * moved);
  // Stromausfall: Bohrer und Ofen melden fehlenden Strom, Feld und Lager bleiben unverändert.
  const dark = game(factory, start);
  dark.wait(10 * second);
  dark.command({ type: 'toggle', id: generator });
  assert.equal(status(dark.snapshot, drill), 'no-power');
  assert.equal(status(dark.snapshot, furnace), 'no-power');
  const paused = dark.snapshot;
  dark.wait(30 * day);
  assert.equal(ore(dark.snapshot), ore(paused));
  assert.equal(ingots(dark.snapshot), ingots(paused));
  dark.command({ type: 'toggle', id: generator });
  dark.wait(day);
  assert.equal(ingots(dark.snapshot), capacity);
  assert.equal(ore(start) - ore(dark.snapshot), 2n * capacity);
});

// ---------- SH-009 / SH-010 ----------

function withDemand(value, run) {
  const original = PROFILES.altstadt;
  PROFILES.altstadt = [value, original[1]];
  try { return run(); } finally { PROFILES.altstadt = original; }
}
function hallWithCosts() {
  const g = game(hall);
  g.command({ type: 'manual' });
  g.command({ type: 'auto' });
  g.wait(hour);
  g.command({ type: 'buy', station: 'dice' });
  g.command({ type: 'hire', role: 'service' });
  return g;
}
const coinsOf = (s) => BigInt(s.data.coins);
const pausedOf = (s, id) => s.data.locations[0].stations[id].paused;

test('SH-009: negative Nettorate wird bis zur Reserveschwelle integriert, ohne Überziehung und segmentunabhängig', () => {
  const setup = hallWithCosts();
  withDemand('0', () => {
    const base = setup.snapshot;
    const net = BigInt(hall.view(base).data.rates.net);
    assert.ok(net < 0n && coinsOf(base) > 0n);
    // Erster Zeitpunkt, an dem die Kasse leer ist. Davor läuft alles, danach greift Standby.
    const zero = base.at + Number((coinsOf(base) + -net - 1n) / -net);
    const before = hall.advance(base, zero - 1).snapshot, exact = hall.advance(base, zero).snapshot;
    assert.ok(coinsOf(before) > 0n);
    assert.equal(pausedOf(before, 'dice'), 0);
    assert.equal(coinsOf(exact), 0n);
    assert.equal(pausedOf(exact, 'dice'), 1);
    assert.ok(BigInt(hall.view(exact).data.rates.net) >= 0n);
    assert.deepEqual(hall.advance(before, zero).snapshot, exact);
    const long = hall.advance(base, base.at + 3650 * day);
    assert.equal(coinsOf(long.snapshot), 0n);
    assert.ok(long.segments <= 2);
    splitEqual(hall, base, [second, zero - 1 - base.at, zero - base.at, day, 30 * day]);
  });
  // Gleichzeitig mit der Schwelle endet ein Ereignis: feste Reihenfolge, gleiches Ergebnis bei Teilung.
  const player = game(hall);
  return playHall({ command: player.command.bind(player), wait: player.wait.bind(player), milestone() {} }).then(() => {
    player.command({ type: 'event', event: 'theme' });
    const base = player.snapshot;
    const end = base.data.locations[0].event.until;
    const fused = hall.advance(base, end);
    assert.equal(fused.snapshot.data.locations[0].event, null);
    assert.ok(coinsOf(fused.snapshot) >= 0n);
    assert.deepEqual(hall.advance(hall.advance(base, end - 1).snapshot, end).snapshot, fused.snapshot);
  });
});

test('SH-010: Standby und Wiederanlauf zweimal, ohne erneute Startkosten durch Ansicht oder wiederholte Prüfung', () => {
  let g = hallWithCosts();
  withDemand('0', () => {
    for (let round = 1; round <= 2; round++) {
      g.wait(30 * day);
      const stopped = g.snapshot;
      assert.equal(pausedOf(stopped, 'dice'), 1);
      assert.equal(coinsOf(stopped), 0n);
      // Wiederholte Ansichten und leere Zeitschritte ändern nichts und lösen nichts aus.
      for (let i = 0; i < 5; i++) hall.view(stopped);
      assert.deepEqual(hall.advance(stopped, stopped.at).snapshot, stopped);
      let stepped = stopped;
      for (let i = 1; i <= 10; i++) stepped = hall.advance(stepped, stopped.at + i * minute).snapshot;
      assert.deepEqual(stepped, hall.advance(stopped, stopped.at + 10 * minute).snapshot);
      assert.equal(pausedOf(stepped, 'dice'), 1);
      assert.equal(coinsOf(stepped), 0n);
      // Wiederanlauf: ohne Kasse nur mit Warnung, und ohne Kosten.
      assert.throws(() => g.command({ type: 'reopen', station: 'dice' }), { code: 'loss-warning' });
      g = game(hall, { ...stepped, data: { ...structuredClone(stepped.data), coins: String(50_000_000n * BigInt(round)) } });
      const funded = g.snapshot;
      g.command({ type: 'reopen', station: 'dice', confirm: true });
      assert.equal(pausedOf(g.snapshot, 'dice'), 0);
      assert.equal(coinsOf(g.snapshot), coinsOf(funded));
      assert.throws(() => g.command({ type: 'reopen', station: 'dice', confirm: true }), { code: 'locked' });
      assert.equal(g.snapshot.data.locations[0].stations.dice.owned, funded.data.locations[0].stations.dice.owned);
    }
    // Basispfad bleibt erreichbar: der manuelle Kartentisch ist nie im Standby.
    assert.equal(pausedOf(g.snapshot, 'cards'), 0);
  });
});

// ---------- GS-010 ----------

test('GS-010: Finanzierungsgutschrift und Buchung zur selben Serverzeit in fester Reihenfolge, kein negativer Bestand', () => {
  const g = game(studio);
  const plan = (name) => ({ type: 'start', name, genre: 'adventure', topic: 'fantasy', audience: 'casual',
    size: 'small', platform: 'pc', team: 1, depth: 'normal' });
  for (let i = 0; i < 3; i++) {
    g.command(plan('Abgebrochen ' + i));
    g.command({ type: 'cancel', id: i + 1, confirm: true });
  }
  g.command(plan('Knapp'));
  g.wait(330 * second);
  const project = () => g.snapshot.data.projects[0];
  assert.equal(project().stage, 'development');
  assert.equal(project().slot, null);
  // Nebenaufträge, bis die Gutschrift die Entwicklungsbuchung genau zur Endzeit des Auftrags ermöglicht.
  let jobs = 0, end;
  while (!project().slot) {
    g.command({ type: 'side-job' });
    end = g.snapshot.data.order.end;
    const before = studio.advance(g.snapshot, end - 1).snapshot;
    const exact = studio.advance(g.snapshot, end).snapshot;
    assert.equal(before.data.order.end, end);
    assert.equal(before.data.projects[0].slot, null);
    assert.equal(exact.data.order, null);
    assert.ok(BigInt(exact.data.budget) >= 0n);
    assert.deepEqual(studio.advance(before, end).snapshot, exact);
    g.wait(end - g.snapshot.at);
    jobs++;
    assert.ok(jobs < 10);
  }
  // Die Buchung startet in derselben Millisekunde wie die Gutschrift.
  assert.equal(project().slot.start, end);
  assert.ok(BigInt(g.snapshot.data.budget) >= 0n);
  assert.ok(jobs >= 1, 'jobs ' + jobs);
  // Abbruch zur selben Serverzeit erstattet nur den ungenutzten Teil und bleibt nichtnegativ.
  const cancelled = studio.command(g.snapshot, end, { type: 'cancel', id: project().id, confirm: true });
  assert.equal(BigInt(cancelled.data.budget) - BigInt(g.snapshot.data.budget), BigInt(project().slot.total) - BigInt(project().slot.tools));
  // Ohne Auto-Release wird nichts spontan veröffentlicht: das Projekt wartet vor oder am QA-Gate, auch über zehn Jahre.
  const gated = studio.advance(g.snapshot, g.snapshot.at + 3650 * day).snapshot;
  assert.ok(['qa', 'gate'].includes(gated.data.projects[0].stage), gated.data.projects[0].stage);
  assert.equal(gated.data.numReleases, g.snapshot.data.numReleases);
  assert.ok(BigInt(gated.data.budget) >= 0n);
});

// ---------- CORE-014 / CORE-015 ----------

const namespaces = {
  phase: /^(SH|GS|FE)-P[1-5]$/,
  test: /^(CORE|SAVE|SH|GS|FE)-\d{3}$/,
  package: /^IDLE-(\d{2}[AB]?|D0[0-5](\.\d)?|FREEZE-\d{2})$/,
  screen: /^(SH|GS|FE)-SCR-[A-Z0-9-]+$/,
  trigger: /^(SH|GS|FE)-TRG-P[1-5]$/,
};
function resolve(id, context) {
  const types = Object.entries(namespaces).filter(([, pattern]) => pattern.test(id)).map(([type]) => type);
  if (types.length === 1) return types[0];
  // Altlabels wie „SH-03“ waren Phase oder Screen. Ohne ausdrücklichen Kontext keine Auflösung.
  if (/^(SH|GS|FE)-\d{2}$/.test(id) && ['phase', 'screen'].includes(context)) return context;
  return null;
}

test('CORE-014: Phasen-, Bild-, Paket- und Test-ID lösen nur ihren eigenen Zieltyp auf', () => {
  for (const game of ['spielhalle', 'studio', 'factory']) {
    for (const { id } of phasesFor(game)) assert.equal(resolve(id), 'phase', id);
  }
  for (const [id, type] of [['SH-009', 'test'], ['CORE-015', 'test'], ['SAVE-016', 'test'], ['IDLE-02B', 'package'],
    ['IDLE-D04.1', 'package'], ['IDLE-FREEZE-01', 'package'], ['FE-SCR-RAIL', 'screen'], ['GS-TRG-P3', 'trigger']]) {
    assert.equal(resolve(id), type, id);
  }
  assert.equal(resolve('SH-03'), null);
  assert.equal(resolve('SH-03', 'phase'), 'phase');
  assert.equal(resolve('SH-03', 'screen'), 'screen');
  assert.equal(resolve('SH-03', 'test'), null);
  assert.equal(resolve('SH-P3', 'screen'), 'phase');
  // Idle-Kennungen in Testtiteln gehören zum Namensraum der Testfälle. Kennungen anderer
  // Planungen (EXP-, VIS-) liegen außerhalb dieses Wörterbuchs und lösen nichts auf.
  const titles = readdirSync(new URL('.', import.meta.url)).filter((file) => file.endsWith('.test.js'))
    .flatMap((file) => [...readFileSync(new URL(file, import.meta.url), 'utf8').matchAll(/test\('([A-Z]+-\d{3})/g)].map((m) => m[1]));
  const idle = titles.filter((id) => /^(CORE|SAVE|SH|GS|FE)-/.test(id));
  assert.ok(idle.length >= 15);
  for (const id of idle) assert.equal(resolve(id), 'test', id);
  for (const id of titles.filter((item) => !idle.includes(item))) assert.equal(resolve(id), null, id);
});

test('CORE-015: Altfelder neben aktuellen Feldern und fremde Versionen werden abgelehnt, nicht geraten', () => {
  const aliases = { spielhalle: [['credits', 'coins'], ['servedGuests', 'guests']], studio: [['coins', 'budget'], ['cash', 'budget']],
    factory: [['credits', 'amounts'], ['coins', 'amounts']] };
  for (const engine of [hall, studio, factory]) {
    const current = engine.create(epoch);
    for (const [alias, field] of aliases[engine.gameId]) {
      const both = structuredClone(current);
      both.data[alias] = structuredClone(both.data[field]);
      assert.throws(() => engine.validate(both), { code: 'invalid-game-state' }, engine.gameId + ':' + alias);
      const renamed = structuredClone(current);
      renamed.data[alias] = renamed.data[field];
      delete renamed.data[field];
      assert.throws(() => engine.validate(renamed), { code: 'invalid-game-state' }, engine.gameId + ':' + field);
    }
    for (const version of [[current.stateVersion + 1, current.rulesVersion], [current.stateVersion, current.rulesVersion + 1], [0, 0]]) {
      const foreign = { ...structuredClone(current), stateVersion: version[0], rulesVersion: version[1] };
      assert.throws(() => engine.validate(foreign), { code: version[0] ? 'unsupported-version' : 'unsupported-version' });
    }
  }
  // Lebenszeit- und verfügbare Beträge bleiben getrennt: Ausgaben senken nur den verfügbaren Bestand.
  const g = game(hall);
  g.command({ type: 'manual' });
  g.command({ type: 'auto' });
  g.wait(hour);
  const { revenue, guests, coins } = g.snapshot.data;
  g.command({ type: 'buy', station: 'dice' });
  assert.equal(g.snapshot.data.revenue, revenue);
  assert.equal(g.snapshot.data.guests, guests);
  assert.ok(BigInt(g.snapshot.data.coins) < BigInt(coins));
});

// ---------- Worst Case / Rechenbudget ----------

test('IDLE-FREEZE-01 Worst Case: echte Spielstände von 1 Stunde bis 10 Jahre innerhalb des Rechenbudgets', async (t) => {
  const spans = [hour, day, 7 * day, 14 * day, 30 * day, 90 * day, 365 * day, 3650 * day];
  const report = {};
  async function sample(engine, play) {
    const g = game(engine), states = [];
    await play({ ...g, milestone() { states.push(g.snapshot); }, wait(ms) {
      g.wait(ms);
      if (g.snapshot.data.tracks?.some(({ manifest }) => manifest)) states.push(g.snapshot);
    } });
    states.push(g.snapshot);
    return states;
  }
  for (const [engine, play] of [[factory, playFactory], [hall, playHall], [studio, playStudio]]) {
    let most = 0, slowest = 0;
    for (const state of await sample(engine, play)) {
      for (const span of spans) {
        const begun = performance.now();
        const { segments, snapshot } = engine.advance(state, state.at + span);
        slowest = Math.max(slowest, performance.now() - begun);
        most = Math.max(most, segments);
        assert.ok(segments <= 100, engine.gameId + ' ' + span + ' ms: ' + segments + ' segments');
        if (span === 30 * day) {
          const half = engine.advance(state, state.at + 13 * day + 4321).snapshot;
          assert.deepEqual(engine.advance(half, state.at + span).snapshot, snapshot);
        }
      }
    }
    report[engine.gameId] = { maxSegments: most, slowestMs: Math.round(slowest) };
  }
  t.diagnostic(JSON.stringify(report));
});
