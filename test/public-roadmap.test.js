// ROADMAP-02: öffentliche Besucher-Roadmap (docs/roadmap/public-roadmap.json, games/public-roadmap.js, /api/roadmap).
// PUB-T01 sechs Abschnitte · T02 interne Zuordnung · T03 Whitelist · T04 Produktivbeleg (P1) · T05 Historie · T06 DE/EN · T07 HTTP und Kompatibilität · T08 Zusammenspiel mit Index/Betrieb · T09 Regression (Suite).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AREAS, FORBIDDEN, SECTIONS, compareVersions, isPublished, loadPublicRoadmap, publicRoadmap, validatePublicRoadmap } from '../games/public-roadmap.js';
import { ROADMAP, resolvedRoadmap, whatsNew } from '../games/roadmap.js';
import { buildProofFor, production as PROD, productionProof } from './fixtures/roadmap-build-proof.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (f) => readFileSync(join(root, f), 'utf8');
const data = loadPublicRoadmap();
const index = JSON.parse(read('docs/roadmap/roadmap-index.json'));
const clone = (o) => structuredClone(o);
const has = (problems, fragment) => problems.some((p) => p.includes(fragment));
const approved = (d = data) => ({ ...clone(d), approved: true });

test('PUB-T01: genau sechs Abschnitte, jeder Eintrag in einem Abschnitt, Leerzustände sind möglich', () => {
  assert.deepEqual(SECTIONS, ['neu', 'entwicklung', 'naechstes', 'geplant', 'ideen', 'pausiert']);
  assert.deepEqual(data.sections, SECTIONS);
  const out = publicRoadmap(approved(), PROD, productionProof);
  assert.equal(out.approved, true);
  assert.deepEqual(out.sections.map((s) => s.id), SECTIONS);
  const listed = out.sections.flatMap((s) => s.entries.map((e) => e.id));
  assert.equal(new Set(listed).size, listed.length, 'jeder Eintrag genau einmal');
  for (const s of out.sections) for (const e of s.entries) assert.equal(e.status, s.id);
  // ohne belegte, bestätigte oder pausierte Vorhaben bleiben diese Abschnitte leer
  for (const id of ['entwicklung', 'pausiert']) assert.equal(out.sections.find((s) => s.id === id).entries.length, 0, id);
  // Als Nächstes: genau die bestätigte Discord-Phase, ohne Dopplung in Geplant
  const next = out.sections.find((s) => s.id === 'naechstes').entries;
  assert.deepEqual(next.map((e) => e.id), ['discord-anmeldung']);
  assert.ok(!out.sections.find((s) => s.id === 'geplant').entries.some((e) => /discord/i.test(e.id + e.title.de)), 'Discord nicht doppelt unter Geplant');
  assert.equal(out.sections.find((s) => s.id === 'pausiert').empty.de, 'Derzeit ist nichts pausiert.');
  assert.ok(out.sections.find((s) => s.id === 'ideen').entries.length > 0);
  assert.deepEqual(validatePublicRoadmap(data, { index }), []);
});

test('PUB-T02: jeder Eintrag hat eine gültige interne Zuordnung mit passendem Status', () => {
  const keys = new Map(index.entries.map((e) => [e.key, e]));
  for (const e of data.entries) {
    assert.ok(e.internal.sources.length, e.id);
    for (const s of e.internal.sources) {
      const ref = keys.get(s); assert.ok(ref, `${e.id}: ${s}`);
      if (e.status === 'neu') assert.ok(['done', 'verified'].includes(ref.status), `${e.id}`);
      else assert.ok(!['done', 'verified'].includes(ref.status), `${e.id}: Erledigtes als Vorhaben`);
    }
  }
  // keine Idle-Spiele ohne Freigabe, keine internen Pakete als öffentliche ID
  assert.equal(data.entries.filter((e) => /idle/i.test(JSON.stringify([e.id, e.title, e.text]))).length, 0);
  for (const e of data.entries) assert.doesNotMatch(e.id, /^(v2|vis|exp|art|cux|auth|nav|roadmap|qa)-/i);
});

test('PUB-T03: die Besucherantwort enthält nur Whitelist-Felder und nichts Internes', () => {
  const out = publicRoadmap(approved(), PROD, productionProof);
  const text = JSON.stringify(out);
  for (const re of FORBIDDEN) assert.doesNotMatch(text, re, `verbotenes Muster ${re}`);
  assert.doesNotMatch(text, /internal|sources|deployment|implementation_commit|confirmed_by|review|production_basis|approval_note|review_points/);
  assert.deepEqual(Object.keys(out).sort(), ['approved', 'areas', 'sections']);
  for (const s of out.sections) {
    assert.deepEqual(Object.keys(s).sort(), s.id === 'pausiert' ? ['empty', 'entries', 'hint', 'id', 'title'] : ['entries', 'hint', 'id', 'title']);
    for (const e of s.entries) {
      const allowed = ['area', 'id', 'period', 'reason', 'status', 'text', 'title', 'version'];
      for (const k of Object.keys(e)) assert.ok(allowed.includes(k), `Feld ${k} nicht freigegeben`);
      assert.deepEqual(Object.keys(e.title).sort(), ['de', 'en']);
      assert.ok(AREAS.includes(e.area));
      if (e.status !== 'neu') assert.equal(e.version, undefined);
    }
  }
  // ohne Freigabe: keine Einträge, auch keine Struktur
  assert.deepEqual(publicRoadmap(data, PROD, productionProof), { approved: false });
  assert.deepEqual(publicRoadmap(null, PROD), { approved: false });
  assert.equal(data.approved, false, 'ohne ausdrückliche Abschlussfreigabe nicht veröffentlichen');
});

test('PUB-T04: „Neu veröffentlicht“ nur mit Produktivbeleg des laufenden Builds (P1)', () => {
  const neu = (running, proof) => publicRoadmap(approved(), running, proof).sections
    .find((s) => s.id === 'neu').entries.map((e) => e.version).sort();
  const release = { version: '3.19.0', commit: 'c992ba953782b94e4302ce770d7b83b3c58b9056' };
  const releaseProof = buildProofFor(release);
  assert.deepEqual(neu(PROD, productionProof), ['3.16.0', '3.17.0'], 'genau der bestätigte Produktivbuild');
  assert.deepEqual(neu(release, releaseProof), ['3.16.0', '3.17.0'], 'späterer Build mit geprüfter Abstammung');
  assert.deepEqual(neu(release), [], 'ohne Manifest');
  const foreign = { version: '88.0.0', commit: 'f'.repeat(40) };
  assert.deepEqual(neu(foreign, releaseProof), [], 'höhere Version ohne passendes Manifest');
  assert.deepEqual(neu(foreign, { ...buildProofFor(foreign), deployments: [] }), [], 'höhere Version ohne belegte Abstammung');
  const sameVersion = { ...PROD, commit: PROD.commit.slice(0, 7) + 'f'.repeat(33) };
  assert.deepEqual(neu(sameVersion, buildProofFor(sameVersion)), [], 'gleiche Version mit gleichem Präfix, aber anderem Commit');
  const rollback = { version: '3.16.0', commit: 'a'.repeat(40) };
  assert.deepEqual(neu(rollback, buildProofFor(rollback)), [], 'Rollback unter den Produktivbeleg');
  assert.deepEqual(neu({ ...release, version: '3.19.1' }, releaseProof), [], 'Manifest einer anderen Version');
  for (const running of [null, undefined, {}, { ...PROD, commit: 'cb2c167' }, { ...PROD, commit: 'unknown' }, { ...PROD, version: 'dev' }]) {
    assert.deepEqual(neu(running, productionProof), [], `unbekannt: ${JSON.stringify(running)}`);
  }
  // Datenebene: kein Veröffentlichungseintrag ohne vollständigen Beleg
  const noProof = clone(data); delete noProof.entries.find((e) => e.status === 'neu').internal.deployment;
  assert.ok(has(validatePublicRoadmap(noProof, { index }), 'Produktivnachweis unvollständig'));
  const wrongCommit = clone(data); wrongCommit.entries.find((e) => e.status === 'neu').internal.deployment.implementation_commit = '0'.repeat(40);
  assert.ok(has(validatePublicRoadmap(wrongCommit, { index }), 'Implementierungscommit passt zu keiner internen Zuordnung'));
  const future = clone(data); future.entries.find((e) => e.status === 'neu').version = '3.99.0';
  assert.ok(has(validatePublicRoadmap(future, { index }), 'Version nach dem Produktivbuild'));
  // Ein grüner Push oder ein Image-Build ist kein Beleg: nicht erledigte interne Einträge dürfen nicht „neu“ sein
  const planned = clone(data); const e = planned.entries.find((x) => x.status === 'neu'); e.internal.sources = ['package:AUTH-01'];
  assert.ok(has(validatePublicRoadmap(planned, { index }), 'Neu veröffentlicht, aber intern planned'));
  assert.equal(compareVersions('3.18.0', '3.17.0'), 1);
  assert.equal(compareVersions('3.17.0', '3.17.0'), 0);
  assert.equal(compareVersions('3.9.0', '3.10.0'), -1, 'numerischer Vergleich');
  assert.equal(compareVersions('x', '3.1.0'), null);
  assert.equal(isPublished(data.entries.find((x) => x.status === 'neu'), PROD, productionProof), true);
  // unvollständiger Beleg gilt nie als Veröffentlichung, auch bei passendem Build
  for (const field of ['implementation_commit', 'production_commit', 'production_version', 'verified_on']) {
    const partial = clone(data.entries.find((x) => x.status === 'neu')); delete partial.internal.deployment[field];
    assert.equal(isPublished(partial, PROD, productionProof), false, `ohne ${field}`);
  }
  const noVersion = clone(data.entries.find((x) => x.status === 'neu')); delete noVersion.version;
  assert.equal(isPublished(noVersion, PROD, productionProof), false, 'ohne Version');
});

test('P1-Mutationen: beschädigte Manifeste und falsche Commit-Paare werden verworfen', () => {
  const entry = data.entries.find((e) => e.id === 'karten-themenwelten');
  const mutations = [
    ['fremder Build', (build) => { build.commit = 'f'.repeat(40); }],
    ['unbekanntes Schema', (build) => { build.schemaVersion = 2; }],
    ['ungültige Belegliste', (build) => { build.deployments = {}; }],
    ['fremder Implementierungscommit', (build) => { build.deployments[0].implementationCommit = 'f'.repeat(40); }],
    ['fremder Produktivcommit', (build) => { build.deployments[0].productionCommit = 'f'.repeat(40); }],
    ['unpassender Produktivbeleg', (build) => { build.deployments[0].productionRef = 'deadbee'; }],
    ['unpassende Produktivversion', (build) => { build.deployments[0].productionVersion = '3.16.0'; }],
    ['ungültiger Produktivcommit-Typ', (build) => { build.deployments[0].productionCommit = [PROD.commit]; }],
  ];
  for (const [name, mutate] of mutations) {
    const build = clone(productionProof);
    mutate(build);
    assert.equal(isPublished(entry, PROD, build), false, name);
  }
  assert.equal(isPublished(entry, PROD, productionProof), true);
});

test('PUB-T05: bisherige Roadmap-Daten und „Was ist neu“ bleiben unverändert erhalten', () => {
  assert.equal(ROADMAP.length, 45);
  assert.equal(resolvedRoadmap().length, 45);
  const news = whatsNew(3);
  assert.equal(news.length, 3);
  assert.ok(news.every((n) => n.titel && n.datum));
  // die Besucheransicht ist von der Änderungshistorie unterscheidbar: eigene Quelle, eigene API
  assert.notEqual(read('docs/roadmap/public-roadmap.json'), read('docs/roadmap/roadmap-index.json'));
  assert.match(read('server/index.js'), /app\.get\('\/api\/whats-new'/);
  assert.match(read('server/index.js'), /app\.get\('\/roadmap'/);
});

test('PUB-T06: Deutsch und Englisch sind vollständig, Bereiche gültig', () => {
  for (const e of data.entries) {
    for (const f of ['title', 'text']) for (const lang of ['de', 'en']) assert.ok(String(e[f]?.[lang] || '').trim().length > 3, `${e.id}.${f}.${lang}`);
    assert.ok(AREAS.includes(e.area));
  }
  const out = publicRoadmap(approved(), PROD, productionProof);
  for (const s of out.sections) { assert.ok(s.title.de && s.title.en && s.hint.de && s.hint.en); }
  // Zeitversprechen und interne Begriffe werden von der Validierung gefunden
  const timey = clone(data); timey.entries[2].text.de = 'Kommt bald.';
  assert.ok(has(validatePublicRoadmap(timey, { index }), 'Zeitversprechen'));
  const leaky = clone(data); leaky.entries[2].text.en = 'See docs/roadmap/plan.json and commit 7aac77e5.';
  assert.ok(has(validatePublicRoadmap(leaky, { index }), 'interner Begriff'));
});

test('Discord-Eintrag: bestätigt, ohne Termin, ohne Pflicht-Server und ohne Dopplung', () => {
  const e = data.entries.find((x) => x.id === 'discord-anmeldung');
  assert.equal(e.status, 'naechstes');
  assert.equal(e.internal.confirmed_by.who, 'Projektinhaber');
  assert.match(e.text.de, /keine Pflicht/); assert.match(e.text.en, /not required/);
  assert.match(e.text.de, /ohne Discord möglich/); assert.match(e.text.de, /Einen Termin gibt es nicht/);
  assert.doesNotMatch(JSON.stringify([e.title, e.text]), /Guild|verpflichtend|Pflicht-?Mitglied/i);
  assert.equal(data.entries.filter((x) => x.internal.sources.includes('package:AUTH-01')).length, 1, 'AUTH-01 nur einmal');
  // dieselbe interne Quelle in zwei Abschnitten wird gemeldet
  const dup = clone(data); const g = clone(dup.entries.find((x) => x.id === 'tischkamera')); g.id = 'discord-geplant'; g.internal.sources = ['package:AUTH-01']; dup.entries.push(g);
  assert.ok(has(validatePublicRoadmap(dup, { index }), 'dieselbe interne Quelle in mehreren Abschnitten: package:AUTH-01'));
  // ohne bestätigte Reihenfolge kein „Als Nächstes“
  const unconfirmed = clone(data); delete unconfirmed.entries.find((x) => x.id === 'discord-anmeldung').internal.confirmed_by;
  assert.ok(has(validatePublicRoadmap(unconfirmed, { index }), 'Als Nächstes braucht eine bestätigte Reihenfolge'));
  // unverbindliche Ideen sind ausdrücklich so gekennzeichnet
  for (const id of ['drei-d-experiment', 'discord-activity']) { const i = data.entries.find((x) => x.id === id); assert.equal(i.status, 'ideen'); assert.match(i.text.de, /^Unverbindliche Idee/); assert.match(i.text.en, /^Non-binding idea/); }
});

test('Validierung: Abschnitte, Status, Pausiert und Als Nächstes verlangen Belege', () => {
  const seven = clone(data); seven.sections.push('extra');
  assert.ok(has(validatePublicRoadmap(seven, { index }), 'genau sechs Abschnitte'));
  const badStatus = clone(data); badStatus.entries[3].status = 'fertig';
  assert.ok(has(validatePublicRoadmap(badStatus, { index }), 'ungültiger Status fertig'));
  const nosrc = clone(data); delete nosrc.entries[3].internal.sources;
  assert.ok(has(validatePublicRoadmap(nosrc, { index }), 'interne Zuordnung fehlt'));
  const ghost = clone(data); ghost.entries[3].internal.sources = ['package:GIBT-ES-NICHT'];
  assert.ok(has(validatePublicRoadmap(ghost, { index }), 'fehlt im Index'));
  const paused = clone(data); Object.assign(paused.entries[3], { status: 'pausiert' });
  const pp = validatePublicRoadmap(paused, { index }); assert.ok(has(pp, 'Pausiert braucht eine Begründung')); assert.ok(has(pp, 'Pausiert, aber intern'));
  const next = clone(data); next.entries[3].status = 'naechstes';
  assert.ok(has(validatePublicRoadmap(next, { index }), 'Als Nächstes braucht eine bestätigte Reihenfolge'));
  const dev = clone(data); dev.entries[3].status = 'entwicklung';
  assert.ok(has(validatePublicRoadmap(dev, { index }), 'In Entwicklung ohne aktiven internen Eintrag'));
  const dup = clone(data); dup.entries.push(clone(dup.entries[0]));
  assert.ok(has(validatePublicRoadmap(dup, { index }), 'doppelte öffentliche ID'));
  const done = clone(data); done.entries[3].internal.sources = ['package:V2-05'];
  assert.ok(has(validatePublicRoadmap(done, { index }), 'Erledigtes erscheint als Vorhaben'));
});

// ---------- HTTP gegen einen echten Server ----------
async function startServer() {
  const child = spawn(process.execPath, ['--input-type=module', '-e', `
    const { http } = await import('./server/index.js');
    const ready = () => console.log('PUB_READY:' + http.address().port);
    if (http.listening) ready(); else http.once('listening', ready);`], {
    cwd: root, env: { ...process.env, PORT: '0', POKER_NO_DOTENV: '1', SITE_PASSWORD: '', ADMIN_PASSWORD: '', DATA_DIR: mkdtempSync(join(tmpdir(), 'pub-')) }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stderr.on('data', (d) => { output += d; });
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Testserver startet nicht: ' + output)), 15000);
    child.stdout.on('data', (d) => { const m = String(d).match(/PUB_READY:(\d+)/); if (m) { clearTimeout(timer); resolve('http://localhost:' + m[1]); } });
    child.once('exit', (code) => { clearTimeout(timer); reject(new Error('Testserver beendet: ' + code + ' ' + output)); });
  });
  return { url, stop: () => child.kill() };
}

test('PUB-T07: /api/roadmap liefert ohne Freigabe nichts, /roadmap und /api/whats-new bleiben unverändert erreichbar', async () => {
  const server = await startServer();
  try {
    const pub = await fetch(server.url + '/api/roadmap');
    assert.equal(pub.status, 200);
    assert.equal(pub.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await pub.json(), { approved: false });
    // bisherige Historie: unveränderter Antwortvertrag (Array der Etappen mit Punkten)
    const legacy = await (await fetch(server.url + '/roadmap')).json();
    assert.ok(Array.isArray(legacy)); assert.equal(legacy.length, 45);
    assert.ok(legacy.every((e) => e.id && e.titel && e.stufe && Array.isArray(e.punkte)));
    assert.deepEqual(legacy.map((e) => e.id), resolvedRoadmap().map((e) => e.id));
    const raw = JSON.stringify(legacy);
    assert.doesNotMatch(raw, /\b(docs|server|scripts|test)\//, 'keine Pfade in der bisherigen Roadmap');
    assert.doesNotMatch(raw, /AGENTS|CLAUDE|Codex|Vault/);
    const news = await (await fetch(server.url + '/api/whats-new')).json();
    assert.ok(Array.isArray(news.entries) && news.entries.length > 0);
    assert.ok(news.version && news.commit !== undefined);
  } finally { server.stop(); }
});

test('PUB-T08: der Container enthält die kuratierte Datei; der Index führt sie als Quelle', () => {
  const docker = read('Dockerfile');
  const workflow = read('.github/workflows/docker.yml').split('  build:')[1].split('  nightly-node:')[0];
  assert.match(docker, /COPY docs\/roadmap\/public-roadmap\.json \.\/docs\/roadmap\/public-roadmap\.json/);
  assert.match(docker, /COPY server \.\/server/);
  assert.match(read('.dockerignore'), /^\.git\r?$/m);
  assert.match(workflow, /fetch-depth: 0[\s\S]+node scripts\/build-roadmap-proof\.mjs "\$GITHUB_SHA"[\s\S]+docker\/build-push-action@/);
  assert.ok(workflow.includes('GIT_COMMIT=\${{ github.sha }}'));
  assert.ok(index.sources.some((s) => s.file === 'docs/roadmap/public-roadmap.json'), 'Index kennt die öffentliche Quelle');
  assert.equal(index.production_observation.version, data.production_basis.version);
  assert.equal(index.production_observation.commit, data.production_basis.commit);
});
