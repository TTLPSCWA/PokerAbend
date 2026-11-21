// ROADMAP-01: Prüfung des abgeleiteten Entwicklungsindex (docs/roadmap/roadmap-index.json).
// ROAD-T01 Vollständigkeit · T02 Zähler · T03 Nachweise · T04 Rückschritt · T05 Reproduktion · T06 Verweise · T07 Quellen unverändert · T08 kein Vault.
// Zusätzlich Mutationen in Kopien von Index und Quellen: jede Verletzung muss genau gemeldet werden.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, INDEX_FILE, STATUSES, STATUS_MAP, buildIndex, loadSources, serialize, tier, validateIndex } from '../scripts/build-roadmap-index.mjs';

const read = (file) => readFileSync(join(ROOT, file), 'utf8').replaceAll('\r\n', '\n');
const committed = JSON.parse(read(INDEX_FILE));
const baseline = JSON.parse(read('test/fixtures/roadmap-index-baseline.json'));
const src = await loadSources();
const fresh = buildIndex(src);
const clone = (o) => structuredClone(o);
const entry = (index, key) => index.entries.find((e) => e.key === key);
const has = (problems, fragment) => problems.some((p) => p.includes(fragment));
const keysOf = (index, ns) => index.entries.filter((e) => e.namespace === ns).map((e) => e.id);
const by = (list, f) => list.reduce((o, x) => { const k = f(x); o[k] = (o[k] || 0) + 1; return o; }, {});
const groupCounts = (index, group) => { const list = index.entries.filter((e) => `${e.namespace}/${e.group}` === group); return { total: list.length, ...by(list, (e) => e.status) }; };

test('ROAD-T01: der Index enthält jede ID aller Quellen genau einmal und keine ohne Quelle', () => {
  assert.deepEqual(validateIndex(committed, src), []);
  const ids = committed.entries.map((e) => e.key);
  assert.equal(new Set(ids).size, ids.length, 'Schlüssel eindeutig');
  const pkg = new Set(keysOf(committed, 'package'));
  for (const id of [
    ...src.v2.tasks.map((t) => t.id), ...src.backlog.packages.map((p) => p.id), ...src.backlog.feature_packages.map((p) => p.id),
    ...src.vis.packages.map((p) => p.id), ...src.vis.feature_packages.map((p) => p.id), ...src.exp.foundation.map((p) => p.id), ...src.exp.packages.map((p) => p.id),
    ...src.art.packages.map((p) => p.id), ...src.art.world_packages.map((p) => p.id), ...src.art.theme_packages.map((p) => p.id), ...src.cux.packages.map((p) => p.id),
    'QA-CI-01', 'NAV-01', 'AUTH-01', 'ROADMAP-01', 'ROADMAP-02',
  ]) assert.ok(pkg.has(id), `Paket fehlt: ${id}`);
  assert.deepEqual(new Set(keysOf(committed, 'game')), new Set([...src.registry.map((g) => g.id), ...src.planned.map((p) => p.id)]));
  assert.equal(committed.entries.filter((e) => e.namespace === 'package' && e.id !== e.id.trim()).length, 0);
});

test('ROAD-T02: Zähler je Quelle und Status stimmen mit den Quellen überein', () => {
  const stat = (list, f) => by(list, f);
  assert.deepEqual(groupCounts(committed, 'package/v2'), { total: src.v2.tasks.length, ...stat(src.v2.tasks, (t) => t.status) });
  assert.deepEqual(groupCounts(committed, 'package/backlog'), { total: src.backlog.packages.length, ...stat(src.backlog.packages, (p) => p.status) });
  assert.equal(groupCounts(committed, 'package/backlog-feature').total, src.backlog.feature_packages.length);
  assert.equal(src.backlog.games.length, src.backlog.total_count, 'Backlog: Spieleinträge');
  assert.equal(committed.entries.filter((e) => e.namespace === 'game' && e.links?.backlog).length, src.backlog.games.length);
  for (const g of src.backlog.games) assert.ok(src.backlog.packages.some((p) => p.id === g.package_id), `Backlog-Spiel ${g.id} ohne Paket`);
  assert.equal(src.backlog.extra_games.length >= 1, true);
  assert.deepEqual(groupCounts(committed, 'package/vis'), { total: src.vis.packages.length, ...stat(src.vis.packages, (p) => p.visual_status) });
  assert.deepEqual(groupCounts(committed, 'package/exp'), { total: src.exp.packages.length, ...stat(src.exp.packages, (p) => p.status) });
  assert.deepEqual(groupCounts(committed, 'package/exp-foundation'), { total: src.exp.foundation.length, ...stat(src.exp.foundation, (p) => p.status) });
  assert.deepEqual(groupCounts(committed, 'package/art'), { total: src.art.packages.length, ...stat(src.art.packages, (p) => p.status) });
  assert.deepEqual(groupCounts(committed, 'package/art-world'), { total: src.art.world_packages.length, ...stat(src.art.world_packages, (p) => p.status) });
  assert.deepEqual(groupCounts(committed, 'package/art-theme'), { total: src.art.theme_packages.length, ...stat(src.art.theme_packages, (p) => p.status) });
  assert.deepEqual(groupCounts(committed, 'package/cux'), { total: src.cux.packages.length, ...stat(src.cux.packages, (p) => p.status) });
  assert.equal(groupCounts(committed, 'stage/hub-roadmap').total, src.hub.length);
  assert.equal(committed.entries.filter((e) => e.namespace === 'stage' && e.status === 'done').length, src.hub.filter((s) => s.stufe === 'erledigt').length);
  assert.equal(committed.entries.filter((e) => e.namespace === 'game' && e.group !== 'planned').length, src.registry.length);
  assert.equal(committed.entries.filter((e) => e.namespace === 'variant').length, src.registry.reduce((n, g) => n + g.variants.length, 0));
  assert.equal(committed.counts['package/v3'].total, 5);
});

test('ROAD-T03: kein done oder verified ohne Commit und Nachweis; fehlende Nachweise sind sichtbar', () => {
  for (const e of committed.entries.filter((x) => x.namespace === 'package' && ['done', 'verified'].includes(x.status))) {
    const proven = /^[0-9a-f]{7,40}$/.test(e.evidence.commit || '') && (e.evidence.tests > 0 || e.evidence.refs > 0);
    assert.ok(proven || e.diagnostics.length, `${e.key}: Nachweis fehlt und keine Diagnose`);
  }
  for (const code of ['missing-commit', 'missing-evidence', 'invalid-commit', 'unknown-source-status']) assert.equal(committed.diagnostic_counts[code] || 0, 0, `Diagnose ${code} steht an`);
  // Die Hub-Anzeige hat keinen Commit: das ist als Diagnose gekennzeichnet, nicht verschwiegen.
  assert.equal(committed.diagnostic_counts['display-only-no-commit'], src.hub.filter((s) => s.stufe === 'erledigt').length);
  assert.equal(committed.diagnostic_counts['unverified-active-label'], src.hub.filter((s) => s.stufe === 'jetzt').length);
  // V3: abgenommen nur mit grünem Volllauf auf dem Implementierungscommit; nichts gilt als produktiv ohne Beleg
  for (const e of committed.entries.filter((x) => x.group === 'v3')) {
    assert.notEqual(e.stages.deployed, true, `${e.key}: deployed ohne Produktivbeleg`);
    if (e.status === 'verified') assert.ok(e.evidence.ci_runs.some((n) => committed.ci_runs.some((r) => r.number === n && r.kind === 'full' && r.conclusion === 'success' && e.evidence.commit.startsWith(r.sha))), `${e.key}: kein grüner Volllauf`);
  }
  assert.equal(entry(committed, 'package:QA-CI-01').status, 'verified');
  assert.equal(entry(committed, 'package:NAV-01').status, 'verified');
  assert.equal(entry(committed, 'package:AUTH-01').status, 'planned');
  assert.equal(entry(committed, 'package:ROADMAP-02').status, 'in-progress'); // ROADMAP-02 freigegeben und in Bearbeitung, nicht committet
  // ROADMAP-01: implementiert (Commit 0bae015, Push #232), Volllauf auf Entscheidung des Projektinhabers nicht durchgeführt: done, nicht verified
  assert.equal(entry(committed, 'package:ROADMAP-01').status, 'done');
  assert.equal(entry(committed, 'package:ROADMAP-01').stages.ci_accepted, false);
  assert.deepEqual(committed.aliases.filter((a) => a.alias === 'CI-STABIL-01').map((a) => a.target), ['package:QA-CI-01']);
});

test('ROAD-T04: kein Eintrag verschwindet, kein Status fällt gegenüber dem eingefrorenen Ausgangsindex zurück', () => {
  assert.ok(baseline.entries.length >= 488);
  for (const b of baseline.entries) {
    const e = entry(committed, b.key);
    assert.ok(e, `Eintrag fehlt: ${b.key}`);
    if (b.status === 'historical') continue;
    assert.ok(tier(e.status) >= tier(b.status), `Rückschritt: ${b.key} ${b.status} → ${e.status}`);
  }
  // verified bleibt verified, auch gegenüber der Quelle
  for (const e of committed.entries) if (e.source_status === 'verified') assert.equal(e.status, 'verified', e.key);
});

test('ROAD-T05: der Index ist reproduzierbar und der Generator gleicht EXP/ART-Quellen ab', () => {
  assert.equal(serialize(fresh), serialize(committed), 'roadmap-index.json weicht von den Quellen ab. Neu erzeugen: node scripts/build-roadmap-index.mjs --write');
  assert.equal(serialize(buildIndex(src)), serialize(fresh), 'Erzeugung ist deterministisch');
  for (const [label, json, mdFile] of [['EXP', src.exp, 'docs/design/GAME_EXPERIENCE_ROADMAP.md'], ['ART', src.art, 'docs/design/GAME_ART_ROADMAP.md']]) {
    assert.ok(existsSync(join(ROOT, mdFile)), `${label}: Markdown-Quelle fehlt`);
    assert.match(String(json.source), new RegExp(mdFile.split('/').pop().replace('.', '\\.')), `${label}: JSON nennt eine andere Quelle`);
    assert.ok(existsSync(join(ROOT, String(json.generator).replace(/^node\s+/, '').trim())), `${label}: Generator fehlt`);
  }
});

test('ROAD-T06: Quellverweise, Aliasse und Querverweise führen zu vorhandenen Zielen', () => {
  for (const s of committed.sources) assert.ok(existsSync(join(ROOT, s.file)), `Quelldatei fehlt: ${s.file}`);
  const keys = new Set(committed.entries.map((e) => e.key));
  for (const a of committed.aliases) assert.ok(keys.has(a.target), `Alias ${a.alias} → ${a.target}`);
  for (const e of committed.entries) {
    assert.ok(existsSync(join(ROOT, e.source.file)), `${e.key}: Quelle ${e.source.file}`);
    if (e.links?.doc) assert.ok(existsSync(join(ROOT, e.links.doc)), `${e.key}: ${e.links.doc}`);
    if (e.source.reference) assert.ok(existsSync(join(ROOT, e.source.reference)), `${e.key}: Verweis ${e.source.reference}`);
  }
  assert.ok(committed.aliases.filter((a) => a.kind.startsWith('public-roadmap')).length > 0);
});

test('ROAD-T07: der Generator verändert keine Quelle (nur lesen, eine Zieldatei) und das Vokabular ist geschlossen', () => {
  const code = read('scripts/build-roadmap-index.mjs');
  const writes = code.match(/writeFileSync\(/g) || [];
  assert.equal(writes.length, 1, 'genau eine Schreibstelle im Generator');
  assert.match(code, /writeFileSync\(target, out\)/);
  assert.match(code, /const target = join\(ROOT, INDEX_FILE\)/);
  assert.equal(INDEX_FILE, 'docs/roadmap/roadmap-index.json');
  assert.deepEqual([...STATUSES].sort(), ['active', 'done', 'historical', 'in-progress', 'partial', 'paused', 'planned', 'verified']);
  for (const e of committed.entries) assert.ok(STATUSES.includes(e.status), e.key);
  for (const map of Object.values(STATUS_MAP)) for (const v of Object.values(map)) assert.ok(STATUSES.includes(v));
  // jeder in plan.json dokumentierte V2-Status ist abgebildet; Fortgeschrittenes wird nie zu erledigt
  for (const v of src.v2.task_status_values) assert.ok(STATUS_MAP.v2[v], `V2-Status ohne Abbildung: ${v}`);
  assert.deepEqual([STATUS_MAP.v2.in_progress, STATUS_MAP.v2.review, STATUS_MAP.v2.blocked], ['in-progress', 'in-progress', 'paused']);
  // done und verified bleiben getrennte Stufen
  assert.ok(tier('verified') > tier('done') && tier('done') > tier('partial') && tier('partial') > tier('planned'));
});

test('ROAD-T08: keine Vault-Inhalte und keine Idle-Spiele ohne Registrierung im Index', () => {
  const text = serialize(committed) + read('scripts/build-roadmap-index.mjs') + read('docs/roadmap/roadmap-index-input.json');
  assert.doesNotMatch(text, /SpieleAbendVault|SpieleAbendCodeVault|Vault-Backups|[\\/]Vault1/i);
  assert.equal(committed.entries.filter((e) => /idle/i.test(e.id) && e.namespace !== 'open-item').length, 0, 'kein Idle-Eintrag ohne Registrierung');
  assert.equal(committed.entries.filter((e) => e.namespace === 'game' && e.category === 'idle').length, src.registry.filter((g) => g.category === 'idle').length);
  for (const s of committed.sources) assert.doesNotMatch(s.file, /vault/i);
  assert.equal(committed.production_observation.commit, 'cb2c167');
  assert.ok(committed.entries.every((e) => e.stages.deployed !== true), 'Produktivstand nur mit Beleg');
});

// ---------- Mutationen: jede Verletzung muss erkannt werden ----------
test('Mutation: fehlende ID im Index wird gemeldet', () => {
  const m = clone(committed); m.entries = m.entries.filter((e) => e.key !== 'package:V2-05');
  assert.ok(has(validateIndex(m, src), 'fehlt im Index: package:V2-05'));
  const g = clone(committed); g.entries = g.entries.filter((e) => e.key !== 'game:poker');
  assert.ok(has(validateIndex(g, src), 'fehlt im Index: game:poker'));
  const v = clone(committed); v.entries = v.entries.filter((e) => e.namespace !== 'variant');
  assert.ok(has(validateIndex(v, src), 'Variantenanzahl'));
});

test('Mutation: doppelte ID und vermischte Namensräume werden gemeldet', () => {
  const m = clone(committed); m.entries.push(clone(entry(committed, 'package:V2-01')));
  assert.ok(has(validateIndex(m, src), 'doppelte ID: package:V2-01'));
  const n = clone(committed); n.entries.push({ ...clone(entry(committed, 'package:V2-01')), key: 'package:poker', id: 'poker' });
  assert.ok(has(validateIndex(n, src), 'Spiel-ID als Paket geführt: poker'));
  const s = clone(committed); s.entries.push({ ...clone(entry(committed, 'package:V2-01')), key: 'package:ERFUNDEN-01', id: 'ERFUNDEN-01' });
  assert.ok(has(validateIndex(s, src), 'Eintrag ohne Quelle: package:ERFUNDEN-01'));
});

test('Mutation: falsche Status werden gemeldet (Erledigtes offen, Geplantes erledigt, verified abgewertet)', () => {
  const a = clone(committed); entry(a, 'package:V2-05').status = 'planned';
  const pa = validateIndex(a, src); assert.ok(has(pa, 'Erledigtes erscheint offen: package:V2-05')); assert.ok(has(pa, 'Status weicht von der Quelle ab: package:V2-05'));
  const b = clone(committed); entry(b, 'package:V2-08').status = 'done';
  assert.ok(has(validateIndex(b, src), 'Geplantes erscheint als umgesetzt: package:V2-08'));
  const c = clone(committed); entry(c, `package:${src.backlog.packages.find((p) => p.status === 'verified').id}`).status = 'done';
  assert.ok(has(validateIndex(c, src), 'verified wurde zu done abgewertet'));
  const d = clone(committed); entry(d, 'package:ART-W1').status = 'done';
  assert.ok(has(validateIndex(d, src), 'Status weicht von der Quelle ab: package:ART-W1'));
  const e = clone(committed); entry(e, 'package:V2-05').status = 'erfunden';
  assert.ok(has(validateIndex(e, src), 'unbekannter Status erfunden'));
});

test('Mutation: verlorene Nachweise werden gemeldet, ein Nachweis wird nicht erfunden', () => {
  const m = clone(committed); const e = entry(m, 'package:V2-05'); e.evidence.commit = null; e.evidence.tests = 0; e.evidence.refs = 0;
  assert.ok(has(validateIndex(m, src), 'done ohne Nachweis und ohne Diagnose: package:V2-05'));
  const withDiag = clone(committed); const w = entry(withDiag, 'package:V2-05'); w.evidence.commit = null; w.evidence.tests = 0; w.evidence.refs = 0; w.diagnostics = ['missing-commit'];
  assert.ok(!has(validateIndex(withDiag, src), 'ohne Nachweis und ohne Diagnose'), 'sichtbar gemachte Lücke ist zulässig');
  // Quelle ohne Commit: der Generator meldet die Lücke, statt sie zu füllen
  const s = clone(src); s.v2.tasks.find((t) => t.id === 'V2-05').implementation_commit = null; s.v2.tasks.find((t) => t.id === 'V2-05').commits = [];
  const rebuilt = buildIndex(s);
  assert.ok(entry(rebuilt, 'package:V2-05').diagnostics.includes('missing-commit'));
  assert.equal(entry(rebuilt, 'package:V2-05').evidence.commit, null);
  assert.notEqual(serialize(rebuilt), serialize(committed));
});

test('Mutation: geänderte Quellen werden erkannt (Index veraltet, Quellstatus unbekannt, Paket verschwunden)', () => {
  const s = clone(src); s.v2.tasks.find((t) => t.id === 'V2-08').status = 'done';
  assert.ok(has(validateIndex(committed, s), 'Index veraltet: package:V2-08'));
  assert.notEqual(serialize(buildIndex(s)), serialize(committed), 'Reproduktionsprüfung schlägt an');
  const u = clone(src); u.exp.packages[0].status = 'wip';
  const built = buildIndex(u); assert.ok(entry(built, `package:${u.exp.packages[0].id}`).diagnostics.includes('unknown-source-status'));
  assert.ok(has(validateIndex(built, u), 'unbekannter Quellstatus wip'));
  const r = clone(src); r.v2.tasks = r.v2.tasks.filter((t) => t.id !== 'V2-03');
  assert.ok(has(validateIndex(committed, r), 'Eintrag ohne Quelle: package:V2-03'));
  const d = clone(src); d.v2.tasks.push(clone(d.v2.tasks[0]));
  assert.ok(has(validateIndex(committed, d), 'doppelte IDs'));
  const n = clone(src); n.registry.push({ id: 'neu-spiel', kind: 'multiplayer', category: 'karten', variants: [] });
  assert.ok(has(validateIndex(committed, n), 'fehlt im Index: game:neu-spiel'));
});

test('Mutation: V3-Lebenszyklus verlangt Belege (CI-Volllauf, Commit, kein erfundenes Deployment)', () => {
  const a = clone(src); a.manual.v3_packages.find((p) => p.id === 'NAV-01').ci_runs = [229];
  assert.ok(has(validateIndex(committed, a), 'NAV-01: ci_accepted ohne grünen Volllauf'));
  const b = clone(src); b.manual.v3_packages.find((p) => p.id === 'AUTH-01').lifecycle.implemented = true;
  assert.ok(has(validateIndex(committed, b), 'AUTH-01: implemented ohne Commit'));
  const c = clone(src); c.manual.v3_packages.find((p) => p.id === 'QA-CI-01').lifecycle.deployed = true;
  assert.ok(has(validateIndex(committed, c), 'QA-CI-01: deployed ist ohne Produktivbeleg nicht zulässig'));
  const d = clone(src); d.manual.v3_packages.find((p) => p.id === 'NAV-01').ci_runs = [229, 999];
  assert.ok(has(validateIndex(committed, d), 'NAV-01: unbekannter CI-Lauf #999'));
  const e = clone(committed); e.aliases.push({ alias: 'X', target: 'package:GIBT-ES-NICHT', kind: 'renamed-package' });
  assert.ok(has(validateIndex(e, src), 'Alias X zeigt ins Leere'));
});

test('Mutation: Vault-Quellen und fehlende Quelldateien werden gemeldet', () => {
  const m = clone(committed); m.sources.push({ file: 'SpieleAbendVault/10-Projekte/Plan.md', role: 'authoritative', covers: 'x' });
  const p = validateIndex(m, src); assert.ok(has(p, 'Vault-Quelle im Index')); assert.ok(has(p, 'Quelldatei fehlt'));
  const n = clone(committed); entry(n, 'package:V2-01').links = { game: 'gibt-es-nicht' };
  assert.ok(has(validateIndex(n, src), 'Verweis auf unbekanntes Spiel gibt-es-nicht'));
});

test('Kommandozeile: --check ist reiner Prüfmodus und lässt Index und Quellen unverändert', async () => {
  const { spawnSync } = await import('node:child_process');
  const before = readFileSync(join(ROOT, INDEX_FILE), 'utf8');
  const run = spawnSync(process.execPath, ['scripts/build-roadmap-index.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /Index entspricht den Quellen\./);
  assert.match(run.stdout, /Probleme: 0/);
  assert.equal(readFileSync(join(ROOT, INDEX_FILE), 'utf8'), before, 'Prüfmodus schreibt nicht');
  const plain = spawnSync(process.execPath, ['scripts/build-roadmap-index.mjs'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(plain.status, 0);
  assert.equal(readFileSync(join(ROOT, INDEX_FILE), 'utf8'), before, 'ohne --write wird nichts geschrieben');
});
