// ROADMAP-01: erzeugt und prüft den abgeleiteten Entwicklungsindex docs/roadmap/roadmap-index.json.
// Der Index ist keine zweite Wahrheit: Die Originalquellen bleiben maßgeblich und werden nie verändert (nur lesend).
//
//   node scripts/build-roadmap-index.mjs            erzeugen, prüfen, Zusammenfassung ausgeben (schreibt nichts)
//   node scripts/build-roadmap-index.mjs --check    wie oben und mit der committeten Datei vergleichen (Exit 1 bei Abweichung)
//   node scripts/build-roadmap-index.mjs --write    Index nach docs/roadmap/roadmap-index.json schreiben (nur diese Datei)
//   node scripts/build-roadmap-index.mjs --check-ci erfasste CI-Läufe per GitHub-Abfrage prüfen (Netzwerk, optional)
//
// Keine Vault-Inhalte: gelesen wird ausschließlich aus dem Repository.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const INDEX_FILE = 'docs/roadmap/roadmap-index.json';
export const INPUT_FILE = 'docs/roadmap/roadmap-index-input.json';
export const STATUSES = ['planned', 'active', 'in-progress', 'paused', 'partial', 'done', 'verified', 'historical'];
export const AREAS = { A: 'Aktive Entwicklung', B: 'Plattform und Funktionen', C: 'Spiele und Varianten', D: 'Design und Assets', E: 'Sicherheit, Betrieb und Tests', F: 'Ideen und Zukunft' };
const TIER = { planned: 0, active: 0, 'in-progress': 0, paused: 0, partial: 1, done: 2, verified: 3, historical: 4 };
export const tier = (status) => TIER[status];
const HASH = /^[0-9a-f]{7,40}$/;

// Abbildung der Originalwörter auf das Index-Vokabular. Die Originalwerte bleiben je Eintrag als source_status erhalten.
export const STATUS_MAP = {
  // V2 kennt laut task_status_values: planned, in_progress, blocked, review, done
  'v2': { done: 'done', planned: 'planned', in_progress: 'in-progress', review: 'in-progress', blocked: 'paused' },
  'backlog': { done: 'done', verified: 'verified' },
  'vis': { done: 'done', planned: 'planned' },
  'art': { done: 'done', planned: 'planned', partial: 'partial' },
  'exp': { done: 'done', planned: 'planned' },
  'cux': { done: 'done', planned: 'planned' },
  // Anzeige-Roadmap: nur „erledigt“ gilt als erledigt; „jetzt“ ist allein kein Beleg für aktive Arbeit.
  'stage': { erledigt: 'done', jetzt: 'planned', spaeter: 'planned', gross: 'planned' },
};

const readText = (root, file) => readFileSync(join(root, file), 'utf8').replaceAll('\r\n', '\n');
const readJson = (root, file) => JSON.parse(readText(root, file));

// ---------- Quellen laden (nur lesend) ----------
export async function loadSources(root = ROOT) {
  const imp = (file) => import(pathToFileURL(join(root, file)).href);
  const games = await imp('games/index.js');
  const roadmap = await imp('games/roadmap.js');
  const solo = await imp('games/singleplayer/index.js');
  const planned = (await imp('games/planned.js')).PLANNED || [];
  const brief = (g, kind) => ({ id: g.id, kind, category: g.category || (kind === 'singleplayer' ? 'einzelspieler' : 'karten'), variants: (g.variants || []).map((v) => v.id) });
  return {
    root,
    v2: readJson(root, 'docs/roadmap/plan.json'),
    backlog: readJson(root, 'docs/backlog/plan.json'),
    vis: readJson(root, 'docs/design/game-visual-roadmap.json'),
    exp: readJson(root, 'docs/design/game-experience-roadmap.json'),
    art: readJson(root, 'docs/design/game-art-roadmap.json'),
    cux: readJson(root, 'docs/design/card-interaction-roadmap.json'),
    hub: roadmap.ROADMAP.map((s) => ({ id: s.id, titel: s.titel, stufe: s.stufe, datum: s.datum, punkte: s.punkte.map((p) => ({ id: p.id, erledigt: !!p.erledigt })) })),
    registry: [
      ...Object.values(games.GAMES).map((g) => brief(g, 'multiplayer')),
      ...Object.values(solo.SINGLEPLAYER_GAMES || games.SINGLEPLAYER_GAMES).map((g) => brief(g, 'singleplayer')),
    ],
    planned: Object.values(planned).map((p) => ({ id: p.id, title: p.name || p.title || p.id })),
    manual: readJson(root, INPUT_FILE),
  };
}

// ---------- Hilfen ----------
const commitOf = (p) => p.implementation_commit || (Array.isArray(p.commits) && p.commits[0]) || null;
function evidenceOf(p) {
  const tests = Array.isArray(p.test_results) ? p.test_results.length : 0;
  const refs = (Array.isArray(p.evidence) ? p.evidence.length : p.evidence && typeof p.evidence === 'object' ? Object.keys(p.evidence).length : 0)
    + (Array.isArray(p.screenshots) ? p.screenshots.length : 0);
  return { commit: commitOf(p), completed_at: p.completed_at || null, tests, refs };
}
function diagnose(entry, { requireEvidence }) {
  const d = [];
  if (requireEvidence && (entry.status === 'done' || entry.status === 'verified')) {
    if (!entry.evidence.commit) d.push('missing-commit');
    else if (!HASH.test(entry.evidence.commit)) d.push('invalid-commit');
    if (!entry.evidence.tests && !entry.evidence.refs) d.push('missing-evidence');
  }
  return d;
}
const stagesOf = (status, extra = {}) => ({ planned: true, implemented: status === 'done' || status === 'verified' ? true : status === 'partial' ? 'partial' : false, ci_accepted: null, deployed: null, ...extra });
const naturalKey = (id) => String(id).replace(/\d+/g, (n) => n.padStart(6, '0'));
const NS_ORDER = ['package', 'game', 'variant', 'stage', 'open-item'];

// ---------- Index erzeugen ----------
export function buildIndex(src) {
  const entries = [];
  const add = (e) => { e.diagnostics = [...(e.diagnostics || []), ...diagnose(e, { requireEvidence: e.namespace === 'package' })]; entries.push(e); };
  const pkg = ({ id, title, area, file, ptr, group, sourceStatus, mapKey, links = {}, p }) => {
    const status = STATUS_MAP[mapKey][sourceStatus];
    if (!status) { add({ namespace: 'package', id, title, area, group, source: { file, ptr }, source_status: sourceStatus, status: 'planned', stages: stagesOf('planned'), evidence: evidenceOf(p), links, diagnostics: ['unknown-source-status'] }); return; }
    add({ namespace: 'package', id, title, area, group, source: { file, ptr }, source_status: sourceStatus, status, stages: stagesOf(status), evidence: evidenceOf(p), links });
  };

  // V2: plan.json
  const v2Area = (id) => (id === 'V2-08' ? 'F' : ['V2-09', 'V2-10'].includes(id) ? 'E' : ['V2-11', 'V2-12', 'V2-16'].includes(id) ? 'C' : 'B');
  src.v2.tasks.forEach((t, i) => pkg({ id: t.id, title: t.title, area: v2Area(t.id), file: 'docs/roadmap/plan.json', ptr: `tasks[${i}]`, group: 'v2', sourceStatus: t.status, mapKey: 'v2', links: t.public_roadmap_ids?.length ? { stages: [...t.public_roadmap_ids] } : {}, p: t }));
  // Backlog: Pakete, Extra-Spiele sind Spieleinträge, Feature-Paket
  src.backlog.packages.forEach((p, i) => pkg({ id: p.id, title: `Weitere Spiele: ${p.games.join(', ')}`, area: 'C', file: 'docs/backlog/plan.json', ptr: `packages[${i}]`, group: 'backlog', sourceStatus: p.status, mapKey: 'backlog', links: { games: [...p.games] }, p }));
  src.backlog.feature_packages.forEach((p, i) => pkg({ id: p.id, title: `Feature-Paket: ${(p.features || []).join(', ')}`, area: 'C', file: 'docs/backlog/plan.json', ptr: `feature_packages[${i}]`, group: 'backlog-feature', sourceStatus: p.status, mapKey: 'backlog', links: { games: [...(p.features || [])] }, p }));
  // Design: VIS, EXP, ART, CUX
  src.vis.packages.forEach((p, i) => pkg({ id: p.id, title: p.game_name, area: 'D', file: 'docs/design/game-visual-roadmap.json', ptr: `packages[${i}]`, group: 'vis', sourceStatus: p.visual_status, mapKey: 'vis', links: { game: p.game_id }, p }));
  src.vis.feature_packages.forEach((p, i) => pkg({ id: p.id, title: p.name, area: 'D', file: 'docs/design/game-visual-roadmap.json', ptr: `feature_packages[${i}]`, group: 'vis-feature', sourceStatus: p.visual_status, mapKey: 'vis', links: { games: [...(p.feature_ids || [])] }, p }));
  src.exp.foundation.forEach((p, i) => pkg({ id: p.id, title: p.title, area: 'D', file: 'docs/design/game-experience-roadmap.json', ptr: `foundation[${i}]`, group: 'exp-foundation', sourceStatus: p.status, mapKey: 'exp', p }));
  src.exp.packages.forEach((p, i) => pkg({ id: p.id, title: p.game_name, area: 'D', file: 'docs/design/game-experience-roadmap.json', ptr: `packages[${i}]`, group: 'exp', sourceStatus: p.status, mapKey: 'exp', links: { game: p.game_id, vis: p.vis_id }, p }));
  for (const [key, group] of [['packages', 'art'], ['world_packages', 'art-world'], ['theme_packages', 'art-theme']]) {
    src.art[key].forEach((p, i) => pkg({ id: p.id, title: p.game_name || p.name, area: 'D', file: 'docs/design/game-art-roadmap.json', ptr: `${key}[${i}]`, group, sourceStatus: p.status, mapKey: 'art', links: p.game_id ? { game: p.game_id, vis: p.vis_id } : { games: [...(p.games || [])] }, p }));
  }
  src.cux.packages.forEach((p, i) => pkg({ id: p.id, title: p.game_name, area: 'D', file: 'docs/design/card-interaction-roadmap.json', ptr: `packages[${i}]`, group: 'cux', sourceStatus: p.status, mapKey: 'cux', links: { game: p.game_id, vis: p.related_visual_package }, p }));

  // V3 (handgepflegt, siehe roadmap-index-input.json)
  for (const [i, v] of src.manual.v3_packages.entries()) {
    const lc = v.lifecycle;
    const status = lc.ci_accepted ? 'verified' : lc.implemented ? 'done' : v.in_progress ? 'in-progress' : 'planned';
    add({ namespace: 'package', id: v.id, title: v.title, area: v.area, group: 'v3', source: { file: INPUT_FILE, ptr: `v3_packages[${i}]` }, source_status: v.in_progress ? 'in-progress' : lc.ci_accepted ? 'ci_accepted' : lc.implemented ? 'implemented' : 'planned', status,
      stages: { planned: !!lc.planned, implemented: !!lc.implemented, ci_accepted: !!lc.ci_accepted, deployed: lc.deployed === null ? null : !!lc.deployed },
      evidence: { commit: v.implementation_commit, completed_at: null, tests: 0, refs: v.ci_runs.length + (v.doc ? 1 : 0), version: v.version, ci_runs: [...v.ci_runs] },
      links: { doc: v.doc }, aliases: [...(v.aliases || [])] });
  }
  for (const [i, o] of src.manual.open_items.entries()) {
    const resolution = src.manual.v3_packages.find((v) => v.id === o.resolved_by && v.lifecycle.ci_accepted);
    const status = resolution ? 'done' : 'planned';
    add({ namespace: 'open-item', id: o.id, title: o.title, area: o.area, group: 'open-item',
      source: { file: INPUT_FILE, ptr: `open_items[${i}]`, reference: o.source }, source_status: resolution ? 'resolved' : 'open', status,
      stages: stagesOf(status, resolution ? { ci_accepted: true, deployed: resolution.lifecycle.deployed } : {}),
      evidence: { commit: resolution?.implementation_commit ?? null, completed_at: null, tests: 0, refs: resolution?.ci_runs.length ?? 0 },
      links: resolution ? { package: resolution.id } : {}, ...(o.note ? { note: o.note } : {}) });
  }

  // Spiele und Varianten (Registrierung ist maßgeblich für „spielbar“)
  const linkBy = (arr, key) => arr.reduce((m, p) => { if (p[key]) (m[p[key]] ||= []).push(p.id); return m; }, {});
  const visBy = linkBy(src.vis.packages, 'game_id'), expBy = linkBy(src.exp.packages, 'game_id'), artBy = linkBy(src.art.packages, 'game_id'), cuxBy = linkBy(src.cux.packages, 'game_id');
  const blBy = Object.fromEntries(src.backlog.games.map((g) => [g.id, g.package_id]));
  for (const g of src.registry) {
    const links = { vis: visBy[g.id] || [], exp: expBy[g.id] || [], art: artBy[g.id] || [], cux: cuxBy[g.id] || [], backlog: blBy[g.id] ? [blBy[g.id]] : [] };
    for (const k of Object.keys(links)) if (!links[k].length) delete links[k];
    add({ namespace: 'game', id: g.id, title: g.id, area: 'C', group: g.kind, category: g.category, source: { file: g.kind === 'singleplayer' ? 'games/singleplayer/index.js' : 'games/index.js', ptr: `registry.${g.id}` }, source_status: 'registered', status: 'done', stages: stagesOf('done'), evidence: { commit: null, completed_at: null, tests: 0, refs: Object.values(links).flat().length }, links, variants: g.variants.length });
    for (const v of g.variants) add({ namespace: 'variant', id: `${g.id}/${v}`, title: `${g.id}: ${v}`, area: 'C', group: 'variant', source: { file: 'games/index.js', ptr: `registry.${g.id}.variants` }, source_status: 'registered', status: 'done', stages: stagesOf('done'), evidence: { commit: null, completed_at: null, tests: 0, refs: 0 }, links: { game: g.id } });
  }
  for (const p of src.planned) add({ namespace: 'game', id: p.id, title: p.title, area: 'C', group: 'planned', source: { file: 'games/planned.js', ptr: `planned.${p.id}` }, source_status: 'planned', status: 'planned', stages: stagesOf('planned'), evidence: { commit: null, completed_at: null, tests: 0, refs: 0 }, links: {} });

  // Öffentliche Roadmap im Hub: Anzeige, kein Arbeitsnachweis
  for (const [i, s] of src.hub.entries()) {
    const status = STATUS_MAP.stage[s.stufe];
    const diagnostics = [];
    if (s.stufe === 'erledigt') diagnostics.push('display-only-no-commit');
    if (s.stufe === 'jetzt') diagnostics.push('unverified-active-label');
    add({ namespace: 'stage', id: s.id, title: s.titel, area: s.stufe === 'spaeter' || s.stufe === 'gross' ? 'F' : 'B', group: 'hub-roadmap', source: { file: 'games/roadmap.js', ptr: `ROADMAP[${i}]` }, source_status: s.stufe, status: status || 'planned', stages: stagesOf(status || 'planned'),
      evidence: { commit: null, completed_at: s.datum || null, tests: 0, refs: 0, points: s.punkte.length, points_done: s.punkte.filter((p) => p.erledigt).length }, links: {}, diagnostics });
  }

  entries.sort((a, b) => NS_ORDER.indexOf(a.namespace) - NS_ORDER.indexOf(b.namespace) || naturalKey(a.id).localeCompare(naturalKey(b.id)));
  const key = (e) => `${e.namespace}:${e.id}`;
  const count = (list, f) => list.reduce((o, e) => { const k = f(e); o[k] = (o[k] || 0) + 1; return o; }, {});
  const byGroup = {};
  for (const e of entries) (byGroup[`${e.namespace}/${e.group}`] ||= []).push(e);
  const counts = Object.fromEntries(Object.entries(byGroup).sort(([a], [b]) => a.localeCompare(b)).map(([g, list]) => [g, { total: list.length, ...Object.fromEntries(Object.entries(count(list, (e) => e.status)).sort()) }]));
  const diagCounts = {};
  for (const e of entries) for (const d of e.diagnostics) diagCounts[d] = (diagCounts[d] || 0) + 1;

  const aliases = [];
  const stageIds = new Set(src.hub.map((x) => x.id));
  const pointStage = new Map(src.hub.flatMap((x) => x.punkte.map((p) => [p.id, x.id])));
  for (const e of entries) {
    for (const a of e.aliases || []) aliases.push({ alias: a, target: key(e), kind: 'renamed-package' });
    if (e.group === 'v2') for (const ref of e.links.stages || []) {
      const stageId = stageIds.has(ref) ? ref : pointStage.get(ref);
      aliases.push({ alias: ref, target: stageId ? `stage:${stageId}` : `unresolved:${ref}`, kind: stageIds.has(ref) ? 'public-roadmap-stage' : 'public-roadmap-point', from: key(e) });
    }
  }
  aliases.sort((a, b) => a.alias.localeCompare(b.alias) || a.target.localeCompare(b.target));

  return {
    schema_version: 1,
    purpose: 'Abgeleiteter Index aller Planungs- und Entwicklungseinträge. Keine zweite Wahrheit: maßgeblich sind die Originalquellen (siehe sources). Erzeugt mit scripts/build-roadmap-index.mjs; nicht von Hand ändern.',
    areas: AREAS,
    statuses: STATUSES,
    status_map: STATUS_MAP,
    stage_vocabulary: { planned: 'Geplant, nicht freigegeben oder nicht begonnen', implemented: 'Umgesetzt (committet)', ci_accepted: 'Vollständiger CI-Volllauf auf dem Implementierungscommit grün', deployed: 'Produktivstand per Healthcheck mit passendem Build belegt; null = nicht belegt' },
    production_observation: src.manual.production_observation,
    sources: sourceList(),
    counts,
    diagnostic_counts: Object.fromEntries(Object.entries(diagCounts).sort()),
    views: {
      active: entries.filter((e) => ['active', 'in-progress'].includes(e.status)).map(key),
      completed: entries.filter((e) => e.namespace === 'package' && ['done', 'verified'].includes(e.status)).map(key),
    },
    aliases,
    ci_runs: [...src.manual.ci_runs].sort((a, b) => a.number - b.number),
    entries: entries.map((e) => ({ key: key(e), ...e })),
  };
}

// Maßgebliche, abgeleitete, Anzeige- und historische Quellen. Rolle bestimmt, wer eine Datei ändern darf.
export function sourceList() {
  const s = (file, role, covers, note) => ({ file, role, covers, ...(note ? { note } : {}) });
  return [
    s('docs/roadmap/plan.json', 'authoritative', 'V2-Pakete'),
    s('docs/backlog/plan.json', 'authoritative', 'Weitere Spiele (Backlog), Feature-Paket', 'Selbst als Fortschrittsschnappschuss bezeichnet'),
    s('docs/design/game-visual-roadmap.json', 'authoritative', 'VIS-Pakete'),
    s('docs/design/GAME_EXPERIENCE_ROADMAP.md', 'authoritative', 'EXP-Pakete (Markdown ist die Quelle)'),
    s('docs/design/game-experience-roadmap.json', 'derived', 'EXP-Pakete (erzeugt mit scripts/build-experience-roadmap.mjs)'),
    s('docs/design/GAME_ART_ROADMAP.md', 'authoritative', 'ART-Pakete (Markdown ist die Quelle)'),
    s('docs/design/game-art-roadmap.json', 'derived', 'ART-Pakete (erzeugt mit scripts/build-art-roadmap.mjs)'),
    s('docs/design/card-interaction-roadmap.json', 'authoritative', 'CUX-Pakete'),
    s('games/index.js', 'authoritative', 'Spielbarkeit: Mehrspieler-Registrierung und Varianten'),
    s('games/singleplayer/index.js', 'authoritative', 'Spielbarkeit: Einzelspieler-Registrierung'),
    s('games/planned.js', 'authoritative', 'kuratierte künftige Spiele (derzeit leer)'),
    s('docs/roadmap/public-roadmap.json', 'authoritative', 'kuratierte Besucher-Roadmap (ROADMAP-02); der Index validiert und ordnet sie zu, ersetzt sie nicht'),
    s('games/roadmap.js', 'display', 'öffentliche Hub-Roadmap (handgepflegt, kuratiert; nicht Arbeitsnachweis)'),
    s(INPUT_FILE, 'authoritative', 'V3-Pakete, CI-Nachweise, Produktivbeobachtung, offene Punkte (kein maschinenlesbarer Ursprung vorhanden)'),
    s('docs/roadmap/consolidation.json', 'historical', 'Konsolidierung 30.10.2026'),
    s('docs/roadmap/CONSOLIDATION_2026-10-30.md', 'historical', 'Konsolidierung 30.10.2026 (Text)'),
    s('docs/roadmap/MASTERPROMPT_V2_SOURCE.md', 'historical', 'V2-Ausgangsspezifikation, kein Auftrag'),
    s('PROMPT.md', 'historical', 'Ausgangsprompt, kein Auftrag'),
    s('CHANGELOG.md', 'evidence', 'Versionsnachweis'),
    s('docs/v3-entwurf/README.md', 'evidence', 'V3-Plan und Nachträge'),
  ];
}

// ---------- Prüfung ----------
// Rechnet die erwarteten IDs unabhängig vom Generator aus den Quellen nach und prüft den Index dagegen.
export function validateIndex(index, src, { root = ROOT, files = true } = {}) {
  const problems = [];
  const entries = index.entries || [];
  const seen = new Map();
  for (const e of entries) {
    const k = `${e.namespace}:${e.id}`;
    if (e.key !== k) problems.push(`Schlüssel passt nicht: ${e.key} ≠ ${k}`);
    if (seen.has(k)) problems.push(`doppelte ID: ${k}`); else seen.set(k, e);
    if (!STATUSES.includes(e.status)) problems.push(`unbekannter Status ${e.status}: ${k}`);
    if (!e.source?.file) problems.push(`Quellverweis fehlt: ${k}`);
    if (!Array.isArray(e.diagnostics)) problems.push(`diagnostics fehlt: ${k}`);
  }
  const expect = (ns, ids, label) => {
    const want = new Set(ids.map(String));
    if (want.size !== ids.length) problems.push(`Quelle ${label} enthält doppelte IDs`);
    for (const id of want) if (!seen.has(`${ns}:${id}`)) problems.push(`fehlt im Index: ${ns}:${id} (${label})`);
    return want;
  };
  const pkgIds = [
    ...src.v2.tasks.map((t) => t.id), ...src.backlog.packages.map((p) => p.id), ...src.backlog.feature_packages.map((p) => p.id),
    ...src.vis.packages.map((p) => p.id), ...src.vis.feature_packages.map((p) => p.id), ...src.exp.foundation.map((p) => p.id), ...src.exp.packages.map((p) => p.id),
    ...src.art.packages.map((p) => p.id), ...src.art.world_packages.map((p) => p.id), ...src.art.theme_packages.map((p) => p.id), ...src.cux.packages.map((p) => p.id),
    ...src.manual.v3_packages.map((p) => p.id),
  ];
  const wantPkg = expect('package', pkgIds, 'Pakete');
  expect('game', [...src.registry.map((g) => g.id), ...src.planned.map((p) => p.id)], 'Spiele');
  expect('variant', src.registry.flatMap((g) => g.variants.map((v) => `${g.id}/${v}`)), 'Varianten');
  expect('stage', src.hub.map((s) => s.id), 'Hub-Etappen');
  expect('open-item', src.manual.open_items.map((o) => o.id), 'offene Punkte');
  // Kein Eintrag ohne Quelle (nichts erfunden)
  const known = new Set([...wantPkg].map((id) => `package:${id}`));
  for (const g of [...src.registry, ...src.planned]) known.add(`game:${g.id}`);
  for (const g of src.registry) for (const v of g.variants) known.add(`variant:${g.id}/${v}`);
  for (const s of src.hub) known.add(`stage:${s.id}`);
  for (const o of src.manual.open_items) known.add(`open-item:${o.id}`);
  for (const k of seen.keys()) if (!known.has(k)) problems.push(`Eintrag ohne Quelle: ${k}`);

  // Status: nie rückwärts, nie vorwärts gegenüber der Quelle
  const planned = new Set(['planned', 'jetzt', 'spaeter', 'gross']);
  for (const e of entries) {
    const k = e.key;
    if (e.group !== 'v3' && STATUS_MAP[mapKeyOf(e)]) {
      const mapped = STATUS_MAP[mapKeyOf(e)][e.source_status];
      if (!mapped) problems.push(`unbekannter Quellstatus ${e.source_status}: ${k}`);
      else if (mapped !== e.status) problems.push(`Status weicht von der Quelle ab: ${k} (${e.source_status} → ${e.status}, erwartet ${mapped})`);
    }
    if (planned.has(e.source_status) && tier(e.status) > 0) problems.push(`Geplantes erscheint als umgesetzt: ${k}`);
    if (['done', 'verified'].includes(e.source_status) && tier(e.status) < 2) problems.push(`Erledigtes erscheint offen: ${k}`);
    if (e.namespace === 'package' && ['done', 'verified'].includes(e.status)) {
      const diag = e.diagnostics || [];
      const proven = e.evidence?.commit && HASH.test(e.evidence.commit) && (e.evidence.tests > 0 || e.evidence.refs > 0);
      if (!proven && !diag.some((d) => ['missing-commit', 'invalid-commit', 'missing-evidence'].includes(d))) problems.push(`${e.status} ohne Nachweis und ohne Diagnose: ${k}`);
    }
    if (e.status === 'verified' && e.group === 'backlog' && e.source_status !== 'verified') problems.push(`verified ohne Quellstatus verified: ${k}`);
    if (e.status === 'done' && e.source_status === 'verified') problems.push(`verified wurde zu done abgewertet: ${k}`);
  }
  // Index gegen die aktuellen Quellen: Status und Originalstatus müssen dem frisch gelesenen Stand entsprechen
  const rebuilt = new Map(buildIndex(src).entries.map((x) => [x.key, x]));
  for (const e of entries) { const r = rebuilt.get(e.key); if (r && (r.status !== e.status || r.source_status !== e.source_status)) problems.push(`Index veraltet: ${e.key} (${e.source_status}/${e.status} ≠ Quelle ${r.source_status}/${r.status})`); }
  // Spiele: Registrierung ist maßgeblich
  const regIds = new Set(src.registry.map((g) => g.id));
  for (const e of entries.filter((x) => x.namespace === 'game' && x.group !== 'planned')) if (!regIds.has(e.id)) problems.push(`Spiel nicht registriert: ${e.id}`);
  const regTotal = src.registry.length, regVariants = src.registry.reduce((n, g) => n + g.variants.length, 0);
  if (entries.filter((e) => e.namespace === 'game' && e.group !== 'planned').length !== regTotal) problems.push('Spielanzahl weicht von der Registrierung ab');
  if (entries.filter((e) => e.namespace === 'variant').length !== regVariants) problems.push('Variantenanzahl weicht von der Registrierung ab');
  // Namespaces dürfen sich nicht vermischen: Spiel-IDs stehen nicht als Paket
  for (const g of regIds) if (seen.has(`package:${g}`)) problems.push(`Spiel-ID als Paket geführt: ${g}`);
  // V3 und Lebenszyklus
  const runs = new Map((index.ci_runs || []).map((r) => [r.number, r]));
  for (const v of src.manual.v3_packages) {
    const lc = v.lifecycle;
    if (lc.deployed && !lc.ci_accepted) problems.push(`${v.id}: deployed ohne ci_accepted`);
    if (lc.ci_accepted && !lc.implemented) problems.push(`${v.id}: ci_accepted ohne implemented`);
    if (lc.implemented && !HASH.test(v.implementation_commit || '')) problems.push(`${v.id}: implemented ohne Commit`);
    if (lc.ci_accepted) {
      const okRun = v.ci_runs.some((n) => { const r = runs.get(n); return r && r.kind === 'full' && r.conclusion === 'success' && v.implementation_commit?.startsWith(r.sha); });
      if (!okRun) problems.push(`${v.id}: ci_accepted ohne grünen Volllauf auf dem Implementierungscommit`);
    }
    for (const n of v.ci_runs) if (!runs.has(n)) problems.push(`${v.id}: unbekannter CI-Lauf #${n}`);
    if (lc.deployed) problems.push(`${v.id}: deployed ist ohne Produktivbeleg nicht zulässig`);
  }
  for (const item of src.manual.open_items) {
    if (item.resolved_by && !src.manual.v3_packages.some((v) => v.id === item.resolved_by && v.lifecycle.ci_accepted)) {
      problems.push(`${item.id}: Abschluss verweist auf kein CI-abgenommenes V3-Paket`);
    }
  }
  // Verweise (Aliasse, Querverweise) müssen existieren
  for (const a of index.aliases || []) if (!seen.has(a.target)) problems.push(`Alias ${a.alias} zeigt ins Leere: ${a.target}`);
  const featureIds = new Set([...src.backlog.feature_packages.flatMap((p) => p.features || []), ...src.vis.feature_packages.flatMap((p) => p.feature_ids || [])]);
  for (const e of entries) {
    for (const g of [e.links?.game, ...(e.links?.games || [])].filter(Boolean)) if (!regIds.has(g) && !featureIds.has(g)) problems.push(`Verweis auf unbekanntes Spiel ${g}: ${e.key}`);
    if (e.links?.vis && !seen.has(`package:${e.links.vis}`)) problems.push(`Verweis auf unbekanntes VIS-Paket ${e.links.vis}: ${e.key}`);
  }
  // Quelldateien vorhanden, nichts aus dem Vault
  if (files) for (const s of index.sources || []) if (!existsSync(join(root, s.file))) problems.push(`Quelldatei fehlt: ${s.file}`);
  if (/vault/i.test(JSON.stringify(index.sources || [])) || /vault/i.test(JSON.stringify(entries.map((e) => e.source)))) problems.push('Vault-Quelle im Index');
  return problems;
}
function mapKeyOf(e) {
  return { v2: 'v2', backlog: 'backlog', 'backlog-feature': 'backlog', vis: 'vis', 'vis-feature': 'vis', 'exp-foundation': 'exp', exp: 'exp', art: 'art', 'art-world': 'art', 'art-theme': 'art', cux: 'cux', 'hub-roadmap': 'stage' }[e.group];
}

export const serialize = (index) => `${JSON.stringify(index, null, 2)}\n`;

// ---------- Kommandozeile ----------
async function checkCi(index) {
  let bad = 0;
  for (const r of index.ci_runs) {
    const res = await fetch(`https://api.github.com/repos/TTLPSCWA/PokerAbend/actions/runs/${r.id}`, { headers: { 'User-Agent': 'roadmap-index-check' } });
    if (!res.ok) { console.log(`#${r.number}: Abfrage fehlgeschlagen (${res.status})`); bad++; continue; }
    const j = await res.json();
    const ok = j.run_number === r.number && j.event === r.event && j.conclusion === r.conclusion && j.head_sha.startsWith(r.sha);
    console.log(`#${r.number} ${ok ? 'ok' : 'ABWEICHUNG'} (${j.event}, ${j.conclusion}, ${j.head_sha.slice(0, 7)})`);
    if (!ok) bad++;
  }
  return bad;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const src = await loadSources();
  const index = buildIndex(src);
  const problems = validateIndex(index, src);
  const out = serialize(index);
  const target = join(ROOT, INDEX_FILE);
  console.log(`Einträge: ${index.entries.length}, Quellen: ${index.sources.length}, Probleme: ${problems.length}`);
  for (const [group, c] of Object.entries(index.counts)) console.log(`  ${group}: ${JSON.stringify(c)}`);
  console.log(`  Diagnosen: ${JSON.stringify(index.diagnostic_counts)}`);
  for (const p of problems) console.log(`PROBLEM: ${p}`);
  let code = problems.length ? 1 : 0;
  if (args.has('--write')) {
    if (problems.length) { console.log('Nicht geschrieben: Probleme vorhanden.'); } else { writeFileSync(target, out); console.log(`Geschrieben: ${INDEX_FILE}`); }
  }
  if (args.has('--check')) {
    const committed = existsSync(target) ? readFileSync(target, 'utf8').replaceAll('\r\n', '\n') : null;
    if (committed !== out) { console.log(`ABWEICHUNG: ${INDEX_FILE} entspricht nicht den Quellen. Mit --write neu erzeugen.`); code = 1; } else console.log('Index entspricht den Quellen.');
  }
  if (args.has('--check-ci') && (await checkCi(index))) code = 1;
  process.exit(code);
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await main();
