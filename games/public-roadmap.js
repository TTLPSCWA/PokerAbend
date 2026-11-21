// ROADMAP-02: öffentliche Besucher-Roadmap. Quelle ist die kuratierte Datei docs/roadmap/public-roadmap.json (von Menschen geprüft).
// Ausgeliefert wird ausschließlich eine Whitelist-Projektion; der Block "internal" (Quellzuordnung, Produktivbeleg, Prüfhinweise) verlässt den Server nie.
// P1: Ein Eintrag steht nur unter „Neu veröffentlicht“, wenn der laufende Build ihn belegt (siehe isPublished). GitHub-Push oder GHCR-Image genügen nicht.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const PUBLIC_ROADMAP_FILE = 'docs/roadmap/public-roadmap.json';
export const ROADMAP_BUILD_PROOF_FILE = 'server/roadmap-build-proof.json';
export const SECTIONS = ['neu', 'entwicklung', 'naechstes', 'geplant', 'ideen', 'pausiert'];
export const AREAS = ['spiele', 'funktionen', 'aussehen', 'betrieb'];
const COPY = {
  neu: { de: 'Neu veröffentlicht', en: 'Newly released', hint: { de: 'Auf dem Server bereitgestellt.', en: 'Live on the server.' } },
  entwicklung: { de: 'In Entwicklung', en: 'In development', hint: { de: 'Daran wird gerade gearbeitet.', en: 'Being worked on right now.' } },
  naechstes: { de: 'Als Nächstes', en: 'Up next', hint: { de: 'Der nächste bestätigte Schritt.', en: 'The next confirmed step.' } },
  geplant: { de: 'Geplant', en: 'Planned', hint: { de: 'Vorgesehen, ohne Terminversprechen.', en: 'Intended, with no date promised.' } },
  ideen: { de: 'Ideen', en: 'Ideas', hint: { de: 'Wunschliste ohne Zusage.', en: 'Wish list, no commitment.' } },
  pausiert: { de: 'Pausiert', en: 'Paused', hint: { de: 'Bewusst zurückgestellt.', en: 'Deliberately set aside.' }, empty: { de: 'Derzeit ist nichts pausiert.', en: 'Nothing is paused at the moment.' } },
};
// Verbotene Muster in öffentlichen Texten und Antworten: Pfade, Hashes, interne IDs, Agenten, Zeitversprechen
export const FORBIDDEN = [/\b(docs|server|public|games|scripts|test)\//i, /\b[0-9a-f]{7,40}\b/, /\b(V2|VIS|EXP|ART|CUX|AUTH|NAV|ROADMAP|QA)-[0-9A-Za-z]+/, /\b(AGENTS|CLAUDE|Codex|Claude|Vault)\b/i, /\.(md|json|mjs)\b/i];
export const TIME_WORDS = [/\bbald\b/i, /nächste Woche/i, /next week/i, /\bsoon\b/i, /\bwird (am|im) \d/i];

export const loadPublicRoadmap = (file = fileURLToPath(new URL('../' + PUBLIC_ROADMAP_FILE, import.meta.url))) => {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
};
export const loadRoadmapBuildProof = (file = fileURLToPath(new URL('../' + ROADMAP_BUILD_PROOF_FILE, import.meta.url))) => {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
};

// ---------- Versionen und Produktivbeleg (P1) ----------
const parseVersion = (v) => (/^\d+\.\d+\.\d+$/.test(String(v || '')) ? String(v).split('.').map(Number) : null);
export function compareVersions(a, b) {
  const x = parseVersion(a), y = parseVersion(b);
  if (!x || !y) return null;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
}
// Das beim Image-Build erzeugte Manifest bindet belegte Commit-Paare an genau dieses Image.
export function isPublished(entry, running, build) {
  const d = entry?.internal?.deployment;
  if (!d?.verified_on || !/^[0-9a-f]{40}$/.test(d.implementation_commit) || !/^[0-9a-f]{7,40}$/.test(d.production_commit)) return false;
  if (build?.schemaVersion !== 1 || !/^[0-9a-f]{40}$/.test(running?.commit) ||
      build.commit !== running.commit || build.version !== running.version || !Array.isArray(build.deployments)) return false;
  const own = compareVersions(d.production_version, entry.version);
  const proof = compareVersions(running.version, d.production_version);
  if (own === null || own < 0 || proof === null || proof < 0) return false;

  return build.deployments.some((check) => check?.implementationCommit === d.implementation_commit &&
    check.productionRef === d.production_commit && check.productionVersion === d.production_version &&
    typeof check.productionCommit === 'string' && /^[0-9a-f]{40}$/.test(check.productionCommit) &&
    check.productionCommit.startsWith(check.productionRef) &&
    (proof > 0 || check.productionCommit === running.commit));
}

// ---------- Validierung gegen den ROADMAP-01-Index ----------
export function validatePublicRoadmap(data, { index, readFile = () => '' } = {}) {
  const problems = [];
  if (!data || !Array.isArray(data.entries)) return ['Datei unlesbar oder ohne entries'];
  if (JSON.stringify(data.sections) !== JSON.stringify(SECTIONS)) problems.push('genau sechs Abschnitte in fester Reihenfolge erforderlich');
  if (typeof data.approved !== 'boolean') problems.push('approved muss boolean sein');
  const keys = new Map((index?.entries || []).map((e) => [e.key, e]));
  const ids = new Set();
  const text = (o) => o && typeof o.de === 'string' && o.de.trim() && typeof o.en === 'string' && o.en.trim();
  for (const e of data.entries) {
    const id = e.id;
    if (!/^[a-z0-9-]{3,40}$/.test(id || '')) problems.push(`ungültige öffentliche ID: ${id}`);
    if (ids.has(id)) problems.push(`doppelte öffentliche ID: ${id}`); ids.add(id);
    if (!SECTIONS.includes(e.status)) problems.push(`ungültiger Status ${e.status}: ${id}`);
    if (!AREAS.includes(e.area)) problems.push(`ungültiger Bereich ${e.area}: ${id}`);
    if (!text(e.title)) problems.push(`Titel in DE und EN erforderlich: ${id}`);
    if (!text(e.text)) problems.push(`Beschreibung in DE und EN erforderlich: ${id}`);
    for (const lang of ['de', 'en']) for (const field of ['title', 'text', 'reason']) {
      const v = e[field]?.[lang]; if (!v) continue;
      for (const re of FORBIDDEN) if (re.test(v)) problems.push(`interner Begriff in ${field}.${lang}: ${id} (${re})`);
      for (const re of TIME_WORDS) if (re.test(v)) problems.push(`Zeitversprechen in ${field}.${lang}: ${id}`);
    }
    if (e.status === 'pausiert' && !text(e.reason)) problems.push(`Pausiert braucht eine Begründung in DE und EN: ${id}`);
    if (e.status !== 'pausiert' && e.reason) problems.push(`Begründung nur bei Pausiert: ${id}`);
    if (e.status === 'neu' && !parseVersion(e.version)) problems.push(`Neu veröffentlicht braucht eine Version: ${id}`);
    if (e.status !== 'neu' && e.version) problems.push(`Version nur bei Neu veröffentlicht: ${id}`);
    if (e.status === 'naechstes' && !e.internal?.confirmed_by) problems.push(`Als Nächstes braucht eine bestätigte Reihenfolge (internal.confirmed_by): ${id}`);
    const sources = e.internal?.sources;
    if (!Array.isArray(sources) || !sources.length) { problems.push(`interne Zuordnung fehlt: ${id}`); continue; }
    for (const s of sources) {
      const ref = keys.get(s);
      if (!ref) { problems.push(`interne Zuordnung ${s} fehlt im Index: ${id}`); continue; }
      const st = ref.status;
      if (e.status === 'neu' && !['done', 'verified'].includes(st)) problems.push(`Neu veröffentlicht, aber intern ${st}: ${id}`);
      if (['geplant', 'ideen', 'naechstes'].includes(e.status) && !(st === 'planned' || (e.status === 'naechstes' && ['active', 'in-progress'].includes(st)))) problems.push(`${e.status}, aber intern ${st}: ${id}`);
      if (e.status === 'entwicklung' && !['active', 'in-progress'].includes(st)) problems.push(`In Entwicklung ohne aktiven internen Eintrag (${st}): ${id}`);
      if (e.status === 'pausiert' && st !== 'paused') problems.push(`Pausiert, aber intern ${st}: ${id}`);
      if (['done', 'verified'].includes(st) && e.status !== 'neu') problems.push(`Erledigtes erscheint als Vorhaben: ${id} (${s})`);
    }
    if (e.status === 'neu') {
      const d = e.internal?.deployment;
      if (!d || !/^[0-9a-f]{40}$/.test(d.implementation_commit || '') || !/^[0-9a-f]{7,40}$/.test(d.production_commit || '') || !parseVersion(d.production_version) || !d.verified_on) problems.push(`Produktivnachweis unvollständig: ${id}`);
      else {
        if (compareVersions(e.version, d.production_version) === 1) problems.push(`Version nach dem Produktivbuild: ${id}`);
        const src = sources.map((s) => keys.get(s)).filter(Boolean);
        if (src.length && !src.some((r) => r.evidence?.commit === d.implementation_commit)) problems.push(`Implementierungscommit passt zu keiner internen Zuordnung: ${id}`);
      }
    } else if (e.internal?.deployment) problems.push(`Produktivbeleg nur bei Neu veröffentlicht: ${id}`);
  }
  // Dieselbe interne Quelle darf nicht in zwei Abschnitten stehen (Dopplung oder Widerspruch, etwa Als Nächstes und Geplant)
  const bySource = new Map();
  for (const e of data.entries) for (const k of e.internal?.sources || []) { const set = bySource.get(k) || new Set(); set.add(e.status); bySource.set(k, set); }
  for (const [k, set] of bySource) if (set.size > 1) problems.push(`dieselbe interne Quelle in mehreren Abschnitten: ${k} (${[...set].join(', ')})`);
  if (data.production_basis && (!parseVersion(data.production_basis.version) || !data.production_basis.commit)) problems.push('production_basis unvollständig');
  return problems;
}

// ---------- Projektion für Besucher ----------
// approved=false: keine Einträge. Unbelegte „Neu veröffentlicht“-Einträge werden zurückgehalten.
export function publicRoadmap(data, running, build) {
  if (!data || data.approved !== true) return { approved: false };
  const shown = data.entries.filter((e) => e.status !== 'neu' || isPublished(e, running, build));
  const entry = (e) => ({
    id: e.id, area: e.area, status: e.status, title: { de: e.title.de, en: e.title.en }, text: { de: e.text.de, en: e.text.en },
    ...(e.status === 'neu' ? { version: e.version } : {}), ...(e.period ? { period: e.period } : {}), ...(e.status === 'pausiert' ? { reason: { de: e.reason.de, en: e.reason.en } } : {}),
  });
  return {
    approved: true,
    areas: AREAS,
    sections: SECTIONS.map((id) => ({ id, title: { de: COPY[id].de, en: COPY[id].en }, hint: COPY[id].hint, ...(COPY[id].empty ? { empty: COPY[id].empty } : {}), entries: shown.filter((e) => e.status === id).map(entry) })),
  };
}
