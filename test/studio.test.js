import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createIdleExportCodec } from '../server/idle/exports.js';
import { createIdleFileStore, createIdleSaveService } from '../server/idle/savepoints.js';
import { studioEngine as engine } from '../server/idle/studio.js';
import { cumulative } from '../server/idle/studio-economy.js';
import { day, playStudio } from './studio-playthrough.js';

const epoch = 1790000000000;
const blueprint = (name, input = {}) => ({
  type: 'start', name, genre: 'adventure', topic: 'fantasy', audience: 'casual',
  size: 'mini', platform: 'pc', team: 1, depth: 'normal', ...input,
});

function game(initial = engine.create(epoch)) {
  let snapshot = initial;
  return {
    get snapshot() { return snapshot; },
    get at() { return snapshot.at; },
    view: () => engine.view(snapshot),
    command(action) { snapshot = engine.command(snapshot, snapshot.at, action); },
    wait(ms) { snapshot = engine.advance(snapshot, snapshot.at + ms).snapshot; },
  };
}

function publish(g, plan) {
  g.command(plan); g.wait(day);
  const p = g.view().data.projects.find(({ plan: row }) => row.name === plan.name);
  assert.equal(p.stage, 'gate');
  g.command({ type: 'release', id: p.id });
  return g.view().data.releases.find(({ id }) => p.id === id);
}

async function checkpoints() {
  const points = {};
  const g = game();
  await playStudio({ ...g, milestone(phase, complete) { points[complete ? 'endgame' : phase] = g.snapshot; } });
  return points;
}

test('Studio: genehmigtes Konzept, QA-Gate und begrenzter D04.1-Absatz nach sechs Offline-Zeiträumen', () => {
  const g = game();
  assert.throws(() => g.command(blueprint('Locked', { genre: 'strategy' })), { code: 'locked' });
  assert.throws(() => g.command(blueprint('No team', { team: 2 })), { code: 'studio-team' });
  g.command(blueprint('First demo'));
  const long = engine.advance(g.snapshot, epoch + 3650 * day);
  assert.equal(long.snapshot.data.projects[0].stage, 'gate');
  assert.equal(long.snapshot.data.numReleases, 0);
  assert.equal(long.segments, 4);
  g.wait(113_000);
  g.command({ type: 'release', id: 1 });
  assert.throws(() => g.command({ type: 'release', id: 1 }), { code: 'studio-stage' });
  const horizons = [60_000, 3_600_000, day, 30 * day, 365 * day, 3650 * day];
  const market = { at: epoch, cap: 200, half: 1_800_000, sold: 0 };
  assert.deepEqual(horizons.map((ms) => cumulative(market, epoch + ms)), [4, 150, 200, 200, 200, 200]);
  for (const ms of horizons) {
    const half = g.at + Math.floor(ms / 2);
    const whole = engine.advance(g.snapshot, g.at + ms);
    const split = engine.advance(engine.advance(g.snapshot, half).snapshot, g.at + ms);
    assert.deepEqual(whole.snapshot, split.snapshot);
    assert.ok(whole.snapshot.data.releases[0].markets[0].sold <= whole.snapshot.data.releases[0].markets[0].cap);
    assert.ok(whole.segments <= 2);
  }
  assert.equal(engine.advance(g.snapshot, g.at + 3650 * day).snapshot.data.releases[0].markets[0].sold,
    g.snapshot.data.releases[0].markets[0].cap);
});

test('Studio: Kosten werden vor jeder Phase reserviert, Nebenauftrag beseitigt den Budgetstopp', () => {
  const g = game();
  for (let i = 0; i < 3; i++) {
    g.command(blueprint('Cancelled ' + i, { size: 'small' }));
    g.command({ type: 'cancel', id: i + 1, confirm: true });
  }
  g.command(blueprint('Tight budget', { size: 'small' }));
  g.wait(330_000);
  assert.equal(g.snapshot.data.budget, '40');
  assert.equal(g.snapshot.data.projects[0].stage, 'development');
  assert.equal(g.snapshot.data.projects[0].slot, null);
  g.wait(30 * day);
  assert.equal(g.snapshot.data.budget, '40');
  g.command({ type: 'side-job' });
  assert.throws(() => g.command({ type: 'side-job' }), { code: 'studio-stage' });
  g.wait(59_999);
  assert.equal(g.snapshot.data.budget, '40');
  g.wait(1);
  assert.equal(g.snapshot.data.budget, '3160');
  assert.equal(g.view().data.reserve, '11880');
  g.command({ type: 'side-job' });
  const active = g.snapshot.data.projects[0].slot;
  g.wait(60_000);
  assert.equal(g.snapshot.data.projects[0].slot.end, active.end);
  assert.equal(g.view().data.reserve, '11880');
  g.wait(990_000);
  assert.equal(g.snapshot.data.order, null);
});

test('Studio: G2-Qualitätszeuge, genehmigte Queue, QA-Limit und Auto-Release', async () => {
  const base = (await checkpoints())[2];
  const g = game(base);
  assert.deepEqual(new Set(g.view().data.availableTopics), new Set(['fantasy', 'animals', 'space', 'pirates']));
  for (const role of ['code', 'art', 'qa']) g.command({ type: 'hire', team: 1, role });
  const initial = g.snapshot;
  const strong = publish(g, blueprint('Careful', { size: 'small', depth: 'thorough' }));
  const hurry = publish(game(initial), blueprint('Rush', { size: 'small', depth: 'rush' }));
  assert.equal(strong.rating, 95);
  assert.equal(hurry.rating, 78);
  g.command({ type: 'research', id: 'templates' });
  while (g.view().data.researchPoints < 4) publish(g, blueprint('Research 1', { size: 'small' }));
  g.command({ type: 'research', id: 'releaseRules' });
  while (g.view().data.researchPoints < 5) publish(g, blueprint('Research 2', { size: 'small' }));
  g.command({ type: 'research', id: 'editor' });
  g.command({ type: 'research', id: 'pipeline' });
  g.command(blueprint('Limited QA', { size: 'small', depth: 'thorough', qaLimit: 1, autoScore: 80 }));
  g.command(blueprint('Approved next', { type: 'queue', autoScore: 100 }));
  assert.throws(() => g.command(blueprint('Queue overflow', { type: 'queue' })), { code: 'studio-team' });
  g.wait(day);
  assert.equal(g.snapshot.data.projects[0].stage, 'qa');
  assert.equal(g.snapshot.data.projects[0].slot, null);
  assert.equal(g.snapshot.data.queue.length, 1);
  const id = g.snapshot.data.projects[0].id;
  g.command({ type: 'raise-limit', id, limit: 1000000, qaLimit: 1000 });
  g.wait(3650 * day);
  assert.equal(g.snapshot.data.projects[0].stage, 'gate');
  assert.equal(g.snapshot.data.projects[0].plan.name, 'Approved next');
  assert.ok(g.snapshot.data.releases.some((r) => r.name === 'Limited QA'));
  assert.equal(g.snapshot.data.queue.length, 0);
});

test('Studio: zwei Teams, endliche Verkäufe, Publisher-Vorschuss, Patch und Lizenzen buchen genau einmal', async () => {
  const states = await checkpoints();
  const g = game(states[4]);
  g.command({ type: 'studio' });
  g.command({ type: 'team', studio: 2 });
  for (const role of ['code', 'art', 'qa']) g.command({ type: 'hire', team: 2, role });
  const before = BigInt(g.view().data.budget);
  g.command({ type: 'sign', id: 'elm' });
  assert.equal(BigInt(g.view().data.budget) - before, 900000n);
  assert.throws(() => g.command({ type: 'sign', id: 'elm' }), { code: 'studio-contract' });
  // Isolate scarce cash using two teams reached through the normal G4 game path.
  const constrained = game({ ...g.snapshot, data: { ...g.snapshot.data, budget: '5000' } });
  constrained.command(blueprint('First reservation'));
  constrained.command(blueprint('Competing reservation', { team: 2 }));
  assert.ok(constrained.snapshot.data.projects[0].slot);
  assert.equal(constrained.snapshot.data.projects[1].slot, null);
  assert.equal(BigInt(constrained.snapshot.data.budget), 5000n - BigInt(constrained.snapshot.data.projects[0].slot.total));
  g.command(blueprint('Team one', { size: 'mini' }));
  g.command(blueprint('Partner epic', { size: 'epic', depth: 'thorough', team: 2, contract: 'elm' }));
  assert.equal(g.snapshot.data.projects.length, 2);
  assert.ok(g.snapshot.data.projects.every((p) => p.slot));
  g.wait(10 * day);
  g.command({ type: 'release', id: g.snapshot.data.projects[1].id });
  assert.deepEqual(g.snapshot.data.studiosWithReleases, [1, 2]);
  g.command({ type: 'sign', id: 'elm' });
  assert.equal(g.snapshot.data.advances, '1800000');
  const parent = g.snapshot.data.releases.find(({ name }) => name === 'Partner epic');
  g.command({ type: 'cancel', id: g.snapshot.data.projects[0].id, confirm: true });
  const patched = blueprint('Expansion', { kind: 'patch', ref: parent.id, team: 1 });
  g.command(patched);
  g.wait(300_000);
  g.command({ type: 'release', id: g.snapshot.data.projects[0].id });
  assert.equal(g.snapshot.data.releases.find(({ id }) => id === parent.id).markets.length, 2);
  assert.throws(() => g.command(patched), { code: 'studio-portfolio' });

  const late = game(states[5]);
  const sales = late.snapshot.data.runSales;
  for (const id of late.view().data.licensees) late.command({ type: 'license', id });
  assert.equal(late.snapshot.data.licenseRevenue, '600000');
  assert.equal(late.snapshot.data.runSales, sales);
  assert.throws(() => late.command({ type: 'license', id: 'quartz' }), { code: 'studio-contract' });
  late.wait(3650 * day);
  assert.equal(late.snapshot.data.licenseRevenue, '3600000');
  const settled = late.snapshot;
  late.wait(3650 * day);
  assert.deepEqual(late.snapshot.data, settled.data);
});

test('Studio: vollständiger regulärer Spielweg mit Savepoints, Prozesswechsel, Importgrenze und Prestige', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'studio-saves-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const store = createIdleFileStore(directory);
  const codec = createIdleExportCodec({ keys: { studioTest: Buffer.alloc(32, 19) }, current: 'studioTest' });
  let at = epoch, seq = 0;
  const create = () => createIdleSaveService({ engines: [engine], store, codec, now: () => at });
  let service = create();
  const account = 'a'.repeat(32), id = 'studio';
  let session = service.open(account, id);
  const view = () => service.view(account, id, session.token).view;
  const fields = () => ({ id: 'studio-test-' + ++seq, token: session.token,
    revision: session.revision, sessionVersion: session.sessionVersion });
  let earlier;
  await playStudio({
    view,
    command(action) {
      const req = { ...fields(), action };
      const once = service.command(account, id, req);
      assert.deepEqual(service.command(account, id, req), once);
      Object.assign(session, once);
    },
    wait(ms) { assert.ok(ms > 0); at += ms; },
    milestone(phase, complete = false) {
      const before = view();
      assert.equal(before.data.phase, phase);
      assert.equal(before.data.complete, complete);
      if (phase === 3) {
        Object.assign(session, service.saveAndExport(account, id, fields()));
        earlier = session.file;
        service = create();
        session = service.open(account, id);
        assert.deepEqual(view().data, before.data);
      }
      if (complete) assert.ok(before.progress.every(({ met }) => met));
    },
  });
  const claims = view().data.possibleClaims;
  assert.ok(claims.length > 0);
  Object.assign(session, service.saveAndExport(account, id, fields()));
  const latest = session.file, original = store.read(account, id);
  assert.throws(() => service.previewImport(account, id, { token: session.token, file: earlier }), { code: 'revision-conflict' });
  const preview = service.previewImport(account, id, { token: session.token, file: latest });
  Object.assign(session, service.confirmImport(account, id, { token: session.token, previewId: preview.previewId }));
  assert.equal(view().data.runSales, original.snapshot.data.runSales);
  const request = { ...fields(), claims };
  const reset = service.prestige(account, id, request);
  assert.deepEqual(service.prestige(account, id, request), reset);
  const final = store.read(account, id);
  assert.notEqual(final.runId, original.runId);
  assert.equal(final.revision, 3);
  assert.equal(final.snapshot.phase, 'GS-P1');
  assert.equal(final.snapshot.data.prestige.points, claims.length);
  assert.equal(final.snapshot.data.releases.length, 0);
  assert.throws(() => service.previewImport(account, id, { token: session.token, file: latest }), { code: 'revision-conflict' });
});
