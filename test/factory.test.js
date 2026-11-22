import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createIdleExportCodec } from '../server/idle/exports.js';
import { createIdleFileStore, createIdleSaveService } from '../server/idle/savepoints.js';
import { factoryEngine as engine } from '../server/idle/factory.js';
import { spread } from '../server/idle/factory-flow.js';
import { powerGrid } from '../server/idle/factory-graph.js';
import { playFactory } from './factory-playthrough.js';

const start = 1790000000000;
const day = 86400000;
const tile = (type, x, y, rotation = 0, extra = {}) => ({ type, x, y, rotation, ...extra });
function game(base = engine.create(start)) {
  let snapshot = base;
  return {
    get snapshot() { return snapshot; },
    command(action) { snapshot = engine.command(snapshot, snapshot.at, action); },
    view: () => engine.view(snapshot),
    wait(ms) { const result = engine.advance(snapshot, snapshot.at + ms); snapshot = result.snapshot; return result; },
  };
}
const layout = (g, build, scope = 'free') => g.command({ type: 'layout', region: 1, scope, build });

test('Factory: manuelles Erz, physischer Anschluss, falsche Ausrichtung und endlicher Abbau', () => {
  const g = game();
  g.command({ type: 'mine', field: 'startA' });
  assert.throws(() => g.command({ type: 'mine', field: 'startA' }), { code: 'factory-wait' });
  assert.equal(g.snapshot.data.amounts['yard:1:free:ironOre'], '10000');
  assert.throws(() => g.command({ type: 'sell', region: 1, scope: 'line', good: 'ironOre' }), { code: 'invalid-request' });
  g.command({ type: 'sell', region: 1, good: 'ironOre' });
  assert.equal(g.view().data.record.ironOreSold, '0');
  assert.throws(() => g.command({ type: 'sell', region: 1, good: 'ironOre' }), { code: 'factory-dock' });
  layout(g, [tile('drill', 9, 5, 2)]);
  g.wait(30000);
  assert.equal(g.view().data.record.ironOreSold, '10');
  g.command({ type: 'rotate', id: 5 });
  g.command({ type: 'rotate', id: 5 });
  const after = g.wait(9_000);
  assert.equal(after.snapshot.phase, 'FE-P2');
  assert.equal(g.view().data.record.ironOreSold, '100');
  const done = engine.advance(g.snapshot, start + 3650 * day);
  assert.equal(done.snapshot.data.amounts['field:startA:free'], undefined);
  assert.equal(done.snapshot.data.amounts['field:startA:line'], '200000');
  assert.equal(done.snapshot.data.amounts['field:startA:pilot'], '280000');
  assert.ok(done.segments < 12);
});

test('Factory: manuelle und automatische Verkäufe teilen dieselbe Dock-Kapazität', () => {
  const g = game();
  g.command({ type: 'mine', field: 'startA' });
  g.wait(3000);
  g.command({ type: 'mine', field: 'startA' });
  layout(g, [tile('drill', 9, 5)]);
  g.command({ type: 'sell', region: 1, good: 'ironOre' });
  g.wait(1000);
  assert.equal(g.view().data.record.ironOreSold, '20');
  g.wait(1000);
  assert.equal(g.view().data.record.ironOreSold, '30');
});

test('Factory: Bandrate, volle Lager, Kollisionsgrenzen und zyklischer Grundriss werden geprüft', () => {
  const g = game();
  layout(g, [tile('drill', 9, 5)]);
  g.wait(120_000);
  g.command({ type: 'remove', id: 5 });
  const before = g.snapshot;
  assert.throws(() => layout(g, [tile('belt', 0, 6), tile('belt', 1, 6, 1), tile('belt', 1, 7, 2), tile('belt', 0, 7, 3)]),
    { code: 'factory-cycle' });
  assert.throws(() => layout(g, [tile('warehouse', 11, 0, 0, { good: 'ironIngot' })]), { code: 'factory-placement' });
  assert.deepEqual(g.snapshot, before);
  layout(g, [tile('drill', 0, 0), tile('belt', 2, 0), tile('furnace', 3, 0), tile('belt', 5, 0),
    tile('warehouse', 6, 0, 0, { good: 'ironIngot' })]);
  const shortage = g.view().data.buildings.find((n) => n.type === 'belt' && n.x === 2).band;
  assert.deepEqual(shortage, { limited: true, current: '5000', max: '5000', offered: '10000' });
  const base = g.snapshot, warehouse = g.view().data.buildings.find((n) => n.type === 'warehouse').id;
  for (const elapsed of [60_000, 3600000, day, 30 * day, 365 * day, 3650 * day]) {
    const whole = engine.advance(base, base.at + elapsed);
    const first = engine.advance(base, base.at + Math.floor(elapsed / 3)).snapshot;
    assert.deepEqual(engine.advance(first, base.at + elapsed).snapshot, whole.snapshot);
    assert.equal(whole.snapshot.data.amounts['stock:' + warehouse], elapsed === 60_000 ? '150000' : '500000');
    assert.ok(whole.segments < 14);
  }
  assert.deepEqual(spread(5n, [1n, 4n, 3n], true), [1n, 4n, 0n]);
  assert.deepEqual(spread(5n, [1n, 1n, 0n]), [1n, 1n, 0n]);
  assert.deepEqual(spread(12n, [2n, 8n, 10n]), [2n, 6n, 4n]);
});

test('Factory: vor Phase 3 gibt ein Lager seine Vorräte nur manuell ab', () => {
  const g = game();
  layout(g, [tile('drill', 9, 5)]);
  g.wait(120_000);
  g.command({ type: 'remove', id: 5 });
  layout(g, [tile('warehouse', 9, 5, 0, { good: 'ironOre' })]);
  const id = g.view().data.buildings.find(({ type }) => type === 'warehouse').id;
  g.command({ type: 'mine', field: 'startA' });
  g.command({ type: 'move', region: 1, good: 'ironOre', to: id });
  g.wait(60_000);
  assert.equal(g.view().phase.id, 'FE-P2');
  assert.equal(g.view().data.buildings.find((node) => node.id === id).inventory, '10000');
  assert.equal(g.view().data.record.ironOreSold, '1200');
  g.command({ type: 'sell', region: 1, good: 'ironOre', from: id });
  g.wait(1000);
  assert.equal(g.view().data.record.ironOreSold, '1210');
});

test('Factory: First Fit versorgt vollständige Verbraucher und wendet Kritisch-Priorität an', () => {
  const at = (id, type, x, y) => ({ id, type, x, y, region: 1, rotation: 0, enabled: true, critical: false });
  const nodes = [at(10, 'generator', 3, 3), at(20, 'assembly', 6, 3), at(30, 'electricFurnace', 3, 1),
    at(40, 'electricDrill', 0, 2), at(50, 'cable', 2, 3), at(51, 'belt', 2, 3)];
  let grid = powerGrid(nodes);
  assert.deepEqual([...grid.served], [20, 30]);
  assert.equal(grid.grids[0].used, 7);
  nodes[3].critical = true;
  grid = powerGrid(nodes);
  assert.deepEqual([...grid.served], [40, 20]);
  assert.equal(grid.grids[0].used, 5);
  nodes[0].enabled = false;
  assert.equal(powerGrid(nodes).served.size, 0);
});

test('Factory: Noterz wird nur bei echter Blockade und bis zum Neustart gefördert', () => {
  const initial = engine.create(start);
  // An isolated exhausted economy, never used to satisfy any phase goal.
  const blocked = { ...initial, data: { ...initial.data, amounts: { 'cash:free': '26000' } } };
  const g = game(blocked);
  for (let i = 0; i < 4; i++) { g.command({ type: 'mine', field: 'rescue' }); g.wait(3000); }
  assert.throws(() => g.command({ type: 'mine', field: 'rescue' }), { code: 'factory-field' });
  g.command({ type: 'sell-rescue' });
  g.wait(1000);
  assert.equal(g.view().data.free, '30000');
  assert.throws(() => g.command({ type: 'sell-rescue' }), { code: 'factory-stock' });
  layout(g, [tile('drill', 9, 5)]);
  assert.equal(g.view().data.free, '0');
});

test('Factory: Spielweg, geschützte Pflichtmengen, Lieferzeit, Endgame, Export und atomarer Prestige-Reset', async (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'factory-ledger-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const disk = createIdleFileStore(folder);
  const codec = createIdleExportCodec({ keys: { test: Buffer.alloc(32, 19) }, current: 'test' });
  let now = start, seq = 0;
  const boot = () => createIdleSaveService({ engines: [engine], store: disk, codec, now: () => now });
  const id = 'factory', user = 'a'.repeat(32);
  let service = boot(), session = service.open(user, id);
  const view = () => service.view(user, id, session.token).view;
  const fields = () => ({ id: 'factory-test-' + ++seq, token: session.token,
    sessionVersion: session.sessionVersion, revision: session.revision });
  let early, checkedTrain = false;
  await playFactory({
    view,
    command(action) {
      const req = { ...fields(), action };
      const answer = service.command(user, id, req);
      assert.deepEqual(service.command(user, id, req), answer);
      Object.assign(session, answer);
    },
    wait(ms) {
      if (ms === 239_000 && !checkedTrain) {
        const before = now;
        const save = service.save(user, id, fields());
        Object.assign(session, save);
        const active = disk.read(user, id).snapshot;
        const target = before + 241_000;
        const whole = engine.advance(active, target).snapshot;
        const justBeforeArrival = engine.advance(active, before + 239_999).snapshot;
        assert.equal(engine.view(justBeforeArrival).data.orders.find(({ id }) => id === 'F4-03').received, '0');
        const split = engine.advance(justBeforeArrival, target).snapshot;
        assert.deepEqual(whole, split);
        assert.equal(engine.view(whole).data.orders.find(({ id }) => id === 'F4-03').received, '50000');
        checkedTrain = true;
      }
      now += ms;
    },
    milestone(phase, complete) {
      const current = view();
      assert.equal(current.phase.id, 'FE-P' + phase);
      if (phase === 3) {
        const bound = current.data.amounts;
        assert.equal(bound['field:startCopper:pilot'], '200000');
        assert.equal(bound['field:startA:pilot'], '280000');
        Object.assign(session, service.saveAndExport(user, id, fields()));
        early = session.file;
        service = boot(); session = service.open(user, id);
        assert.deepEqual(view().data, current.data);
      }
      if (complete) assert.ok(current.progress.every(({ met }) => met));
    },
  });
  assert.equal(checkedTrain, true);
  const claims = view().data.eligible;
  assert.ok(claims.length > 0);
  Object.assign(session, service.saveAndExport(user, id, fields()));
  const original = disk.read(user, id);
  assert.throws(() => service.previewImport(user, id, { token: session.token, file: early }), { code: 'revision-conflict' });
  const ending = original.snapshot;
  const target = ending.at + 3650 * day;
  const before = engine.advance(ending, ending.at + 12_345_678).snapshot;
  const full = engine.advance(ending, target);
  assert.deepEqual(engine.advance(before, target).snapshot, full.snapshot);
  assert.ok(full.segments < 60, 'continuous renewable network must accelerate');
  const req = { ...fields(), claims };
  const result = service.prestige(user, id, req);
  assert.deepEqual(service.prestige(user, id, req), result);
  const reset = disk.read(user, id);
  assert.notEqual(reset.runId, original.runId);
  assert.equal(reset.revision, original.revision + 1);
  assert.equal(reset.snapshot.phase, 'FE-P1');
  assert.equal(reset.snapshot.data.prestige.points, claims.length);
  assert.equal(reset.snapshot.data.blueprints.length, 1);
  assert.throws(() => service.previewImport(user, id, { token: session.token, file: session.file }), { code: 'revision-conflict' });
});
