import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createIdleEngine, produceBatches, quantity, transact } from '../public/idle/engine.js';
import { phasesFor } from '../public/idle/progression.js';
import { createIdleExportCodec } from '../server/idle/exports.js';
import { createIdleFileStore, createIdleSaveService } from '../server/idle/savepoints.js';

const account = 'a'.repeat(32), other = 'b'.repeat(32), game = 'spielhalle';
const base = 1_790_000_000_000;
const keys = { local: Buffer.alloc(32, 23), replacement: Buffer.alloc(32, 25) };
const failure = (fn, code) => assert.throws(fn, { name: 'IdleError', code });

function engine(id, stateVersion = 1, wallet = 'coins') {
  return createIdleEngine({
    id, stateVersion, rulesVersion: 1, facts: () => ({}),
    create: () => ({ balances: { [wallet]: '0' }, carry: 0 }),
    validate: (data) => Number.isInteger(data.carry) && data.carry >= 0 && data.carry < 1000 &&
      Object.keys(data.balances).length === 1 && quantity(data.balances[wallet]) >= 0n,
    command: (data, { cost }) => ({ ...data, balances: transact(data.balances, { spend: { [wallet]: cost } }) }),
    advance(data, { from, to }) {
      const result = produceBatches(data.balances, { interval: 1000, elapsed: to - from, carry: data.carry, earn: { [wallet]: '1' } });
      return { until: to, data: { balances: result.balances, carry: result.carry } };
    },
  }, phasesFor(id));
}

function tempStore(t) {
  const directory = mkdtempSync(join(tmpdir(), 'pokerabend-idle-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return { directory, store: createIdleFileStore(directory) };
}

function fixture(t) {
  const { directory, store } = tempStore(t);
  const codec = createIdleExportCodec({ keys, current: 'local' });
  let wall = base, monotonic = 0;
  const service = (extra = {}) => createIdleSaveService({
    engines: [engine(game), engine('studio'), engine('factory')], store, codec,
    now: () => wall, leaseClock: () => monotonic, leaseMs: 1000, ...extra,
  });
  return { service, directory, store, codec, time: (ms) => { wall = base + ms; }, lease: (ms) => { monotonic = ms; } };
}

const request = (session, id) => ({ token: session.token, sessionVersion: session.sessionVersion, revision: session.revision, id });

test('Importbestätigung bindet den Inhalt auch bei gleicher Revision an die geprüfte Vorschau', (t) => {
  const f = fixture(t);
  const service = f.service();
  const opened = service.open(account, game);
  const saved = service.saveAndExport(account, game, request(opened, 'save'));
  const { previewId } = service.previewImport(account, game, { token: opened.token, file: saved.file });
  const [file] = readdirSync(f.directory);
  const path = join(f.directory, file);
  const record = JSON.parse(readFileSync(path, 'utf8'));
  record.snapshot.data.balances.coins = '100';
  writeFileSync(path, JSON.stringify(record));
  failure(() => service.confirmImport(account, game, { token: opened.token, previewId }), 'revision-conflict');
  assert.equal(service.view(account, game, opened.token).view.data.balances.coins, '0');
});

test('Auch ohne Download bleibt ein bestätigter Save als Datei exportierbar', (t) => {
  const f = fixture(t);
  const expanded = createIdleEngine({
    id: game, stateVersion: 1, rulesVersion: 1, facts: () => ({}), create: () => ({ payload: [] }),
    validate: (data) => Array.isArray(data.payload),
    command: () => ({ payload: Array(5).fill('x'.repeat(55_000)) }),
    advance: (data, { to }) => ({ until: to, data }),
  }, phasesFor(game));
  const service = f.service({ engines: [expanded] });
  const opened = service.open(account, game);
  const saved = service.save(account, game, request(opened, 'small'));
  const command = service.command(account, game, {
    token: opened.token, revision: saved.revision, sessionVersion: opened.sessionVersion, id: 'expand', action: {},
  });
  failure(() => service.save(account, game, {
    ...request({ ...opened, ...saved, ...command }, 'oversized'),
  }), 'payload-too-large');
  assert.equal(f.codec.decode(account, game, service.exportConfirmed(account, game).file).revision, 1);
});

test('Manueller Save ist die einzige dauerhafte Gutschrift und Wiederaufnahme beginnt beim bestätigten Zeitanker', (t) => {
  const f = fixture(t), service = f.service(), start = service.open(account, game);
  const tenYears = 10 * 365 * 86_400_000;
  f.time(2500);
  assert.equal(service.view(account, game, start.token).view.data.balances.coins, '2');
  service.heartbeat(account, game, start.token);
  assert.deepEqual(readdirSync(f.directory), []);
  assert.equal(service.command(account, game, { ...request(start, 'cost'), action: { cost: '1' } }).sessionVersion, 1);
  const dirty = service.view(account, game, start.token);
  assert.equal(dirty.view.data.balances.coins, '1');
  assert.equal(dirty.dirty, true);
  const saved = service.save(account, game, request(dirty, 'save-one'));
  assert.deepEqual(saved, { revision: 1, savedAt: base + 2500 });
  assert.equal(f.store.read(account, game).snapshot.data.balances.coins, '1');
  f.time(5000);
  service.command(account, game, { token: start.token, sessionVersion: 1, revision: 1, id: 'unsaved', action: { cost: '4' } });
  assert.equal(service.view(account, game, start.token).view.data.balances.coins, '0');
  f.time(tenYears);
  const restarted = f.service();
  const resumed = restarted.open(account, game);
  assert.equal(resumed.view.data.balances.coins, '315359999');
  assert.deepEqual(resumed.settlement, { from: base + 2500, to: base + tenYears, segments: 1 });
  assert.equal(restarted.open(account, game).view.data.balances.coins, resumed.view.data.balances.coins);
  assert.equal(f.store.read(account, game).revision, 1);
  assert.equal(restarted.save(account, game, request(resumed, 'save-two')).revision, 2);
  assert.equal(f.service().open(account, game).view.data.balances.coins, resumed.view.data.balances.coins);
});

test('Zweiter Tab liest ohne Schreibschlüssel. Übernahme entwertet alte Aktionen und Saves', (t) => {
  const f = fixture(t), service = f.service(), first = service.open(account, game);
  const reader = service.open(account, game);
  assert.equal(reader.readOnly, true);
  assert.equal(Object.hasOwn(reader, 'token'), false);
  failure(() => service.save(account, game, request({ ...reader, token: reader.sessionId }, 'not-a-writer')), 'lease-conflict');
  const second = service.takeover(account, game, reader.sessionId);
  failure(() => service.takeover(account, game, reader.sessionId), 'lease-conflict');
  failure(() => service.command(account, game, { ...request(first, 'obsolete'), action: { cost: '0' } }), 'lease-conflict');
  failure(() => service.save(account, game, request(first, 'obsolete-save')), 'lease-conflict');
  failure(() => service.view(other, game, second.token), 'lease-conflict');
  f.lease(1001);
  failure(() => service.heartbeat(account, game, second.token), 'lease-conflict');
  assert.notEqual(service.open(account, game).sessionId, second.sessionId);
});

test('Aktionen und Saves sind idempotent. Ein alter Revisionsstand kann keinen erfolgreichen Save wiederholen', (t) => {
  const f = fixture(t), service = f.service(), start = service.open(account, game);
  const action = { ...request(start, 'action-1'), action: { cost: '0' } };
  assert.deepEqual(service.command(account, game, action), service.command(account, game, action));
  failure(() => service.command(account, game, { ...action, action: { cost: '1' } }), 'operation-conflict');
  const saveInput = { ...request(start, 'manual-save'), sessionVersion: 1 };
  const saved = service.save(account, game, saveInput);
  assert.deepEqual(f.service().save(account, game, saveInput), saved);
  failure(() => service.save(account, game, { ...saveInput, sessionVersion: 0 }), 'operation-conflict');
  failure(() => service.command(account, game, { ...action, id: 'old-revision', sessionVersion: 1 }), 'session-conflict');
  failure(() => service.save(account, game, { ...saveInput, id: 'old-save' }), 'revision-conflict');
  assert.equal(f.store.read(account, game).revision, 1);
});

test('Signierter Export ist konto- und spielgebunden. Vorschau und Wiederholung zahlen nie erneut aus', (t) => {
  const f = fixture(t), service = f.service(), opened = service.open(account, game);
  f.time(3500);
  const saved = service.saveAndExport(account, game, request(opened, 'manual-export'));
  const body = JSON.parse(Buffer.from(saved.file.split('.')[1], 'base64url').toString('utf8'));
  assert.equal(body.snapshot.data.balances.coins, '3');
  assert.equal(body.savedAt, base + 3500);
  assert.ok(!JSON.stringify(body).includes(account) && !JSON.stringify(body).includes(opened.token));
  assert.equal(service.exportConfirmed(account, game).file, saved.file);
  failure(() => f.codec.decode(other, game, saved.file), 'wrong-account');
  failure(() => f.codec.decode(account, 'studio', saved.file), 'wrong-game');
  const [id, payload, signature] = saved.file.split('.');
  const corrupted = [id, (payload[0] === 'a' ? 'b' : 'a') + payload.slice(1), signature].join('.');
  failure(() => f.codec.decode(account, game, corrupted), 'invalid-signature');
  failure(() => f.codec.decode(account, game, 'x'.repeat(400_000)), 'payload-too-large');
  assert.equal(createIdleExportCodec({ keys, current: 'replacement' }).decode(account, game, saved.file).revision, 1);
  failure(() => createIdleExportCodec({ keys: { replacement: keys.replacement }, current: 'replacement' }).decode(account, game, saved.file), 'unknown-key');
  const newStore = tempStore(t).store;
  const noLedger = f.service({ store: newStore });
  const newSession = noLedger.open(account, game);
  failure(() => noLedger.previewImport(account, game, { token: newSession.token, file: saved.file }), 'no-ledger');

  f.time(6500);
  const preview = service.previewImport(account, game, { token: opened.token, file: saved.file });
  assert.equal(f.store.read(account, game).snapshot.at, base + 3500);
  const confirmation = { token: opened.token, previewId: preview.previewId };
  const imported = service.confirmImport(account, game, confirmation);
  assert.deepEqual(service.confirmImport(account, game, confirmation), imported);
  assert.equal(service.view(account, game, opened.token).view.data.balances.coins, '6');
  assert.equal(f.store.read(account, game).revision, 1);
  const pending = service.previewImport(account, game, { token: opened.token, file: saved.file });
  const latest = service.view(account, game, opened.token);
  service.save(account, game, request(latest, 'newer-save'));
  failure(() => service.confirmImport(account, game, { token: opened.token, previewId: pending.previewId }), 'revision-conflict');
  failure(() => service.previewImport(account, game, { token: opened.token, file: saved.file }), 'revision-conflict');
});

test('SAVE-006: 20 Wiederholungen eines alten Exports ändern weder Vorschau noch bestätigten Stand', (t) => {
  const f = fixture(t), service = f.service(), session = service.open(account, game);
  f.time(2500);
  const old = service.saveAndExport(account, game, request(session, 'old'));
  f.time(7200);
  const latest = service.saveAndExport(account, game, request({ ...session, ...old }, 'latest'));
  const path = join(f.directory, readdirSync(f.directory)[0]);
  const committed = readFileSync(path);

  f.time(10_500);
  const before = service.view(account, game, session.token);
  assert.equal(before.view.data.balances.coins, '10');
  for (let attempt = 0; attempt < 20; attempt++) {
    failure(() => service.previewImport(account, game, { token: session.token, file: old.file }), 'revision-conflict');
    assert.deepEqual(service.view(account, game, session.token), before);
    assert.deepEqual(readFileSync(path), committed);
  }
  assert.deepEqual(service.exportConfirmed(account, game), latest);
  const resumed = f.service().open(account, game);
  assert.equal(resumed.revision, 2);
  assert.equal(resumed.savedAt, base + 7200);
  assert.equal(resumed.view.data.balances.coins, '10');
});

test('CORE-012: erschöpftes Segmentbudget lässt Save und Zeitanker unverändert', (t) => {
  const f = fixture(t);
  const bounded = createIdleEngine({
    id: game, stateVersion: 1, rulesVersion: 1, facts: () => ({}),
    create: () => ({ coins: '0' }),
    validate: (data) => quantity(data.coins) >= 0n,
    command: (data) => data,
    advance(data, { from, to }) {
      const until = Math.min(from + 1000, to);
      return { until, data: { coins: String(quantity(data.coins) + BigInt(until - from)) } };
    },
  }, phasesFor(game), { maxSegments: 2 });
  const service = f.service({ engines: [bounded] });
  const session = service.open(account, game);
  f.time(1000);
  const saved = service.saveAndExport(account, game, request(session, 'before-budget'));
  const path = join(f.directory, readdirSync(f.directory)[0]);
  const committed = readFileSync(path);

  f.time(4000);
  failure(() => service.saveAndExport(account, game, request({ ...session, ...saved }, 'retry')), 'work-budget');
  failure(() => f.service({ engines: [bounded] }).open(account, game), 'work-budget');
  assert.deepEqual(readFileSync(path), committed);
  assert.deepEqual(service.exportConfirmed(account, game), saved);

  f.time(3000);
  const resumed = f.service({ engines: [bounded] }).open(account, game);
  assert.equal(resumed.revision, 1);
  assert.equal(resumed.view.data.coins, '3000');
  assert.deepEqual(resumed.settlement, { from: base + 1000, to: base + 3000, segments: 2 });
});

test('Defekte Datei, Rückwärtsuhr und Speicherfehler ändern weder bestätigte Revision noch Zeitanker', (t) => {
  const f = fixture(t), service = f.service(), start = service.open(account, game);
  f.time(3000);
  const saved = service.saveAndExport(account, game, request(start, 'initial'));
  f.time(2000);
  failure(() => service.previewImport(account, game, { token: start.token, file: saved.file }), 'clock-regressed');
  failure(() => f.service().open(account, game), 'clock-regressed');
  assert.equal(f.store.read(account, game).snapshot.at, base + 3000);
  f.time(4000);
  const broken = f.service({ store: { read: f.store.read, compareAndSet() { throw new Error('simulated I/O failure'); } } });
  const session = broken.open(account, game);
  assert.throws(() => broken.save(account, game, request(session, 'fail-write')), /simulated I\/O failure/);
  assert.equal(broken.view(account, game, session.token).revision, 1);
  assert.equal(f.store.read(account, game).revision, 1);
  const file = join(f.directory, readdirSync(f.directory)[0]);
  writeFileSync(file, '{"format":');
  failure(() => f.service().open(account, game), 'corrupt-save');
  assert.equal(readFileSync(file, 'utf8'), '{"format":');
});

test('Altes signiertes Schema wird explizit auf einer Kopie migriert und erst mit manuellem Save übernommen', (t) => {
  const f = fixture(t), old = f.service({ engines: [engine(game, 1, 'oldCoins')] });
  const first = old.open(account, game);
  f.time(1000);
  const saved = old.saveAndExport(account, game, request(first, 'legacy'));
  assert.equal(f.store.read(account, game).snapshot.stateVersion, 1);
  const engines = [engine(game, 2)];
  failure(() => f.service({ engines }).open(account, game), 'unsupported-version');
  const migration = {
    validate: (old) => engine(game, 1, 'oldCoins').validate(old) === old,
    upgrade: (old) => ({ ...old, stateVersion: 2, data: { ...old.data, balances: { coins: old.data.balances.oldCoins } } }),
  };
  const future = f.service({ engines, migrations: { [game]: { '1/1': migration } } });
  const resumed = future.open(account, game);
  assert.equal(resumed.view.data.balances.coins, '1');
  const preview = future.previewImport(account, game, { token: resumed.token, file: saved.file });
  const restored = future.confirmImport(account, game, { token: resumed.token, previewId: preview.previewId });
  assert.equal(f.store.read(account, game).snapshot.stateVersion, 1);
  assert.equal(future.save(account, game, { ...request(resumed, 'migrated'), sessionVersion: restored.sessionVersion }).revision, 2);
  assert.equal(f.store.read(account, game).snapshot.stateVersion, 2);
  assert.equal(f.store.read(account, game).snapshot.at, base + 1000);
});
