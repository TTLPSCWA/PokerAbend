// Monopoly: Asset-Manifest für Themes (ART-046, Paket F). Reine Funktionen ohne Dateizugriff: Server, Build-Skript, Tests und später der Browser teilen sie.
// Das Manifest beschreibt ausschließlich Bilder: Abmessungen, Dateien, Prüfsummen, Fokus, Fallbacks, Herkunft und Lizenzstatus.
// Spielregeln, Preise, Mieten und andere Spieldaten gehören nie hinein (strenges Schema: unbekannte Schlüssel werden abgelehnt);
// die Zuordnung zu den 40 Feldern läuft allein über `fieldIds` (Feld-ID 0–39 wie in data.js).
// Dateien prüft scripts/lib/monopoly-theme-verify.mjs (Prüfsumme, Größe, Abmessungen, Transparenz); gebaut wird mit scripts/build-monopoly-theme.mjs.
export const MANIFEST_VERSION = 1;
export const FIELD_COUNT = 40;
export const ROLES = ['board', 'location', 'deed', 'figure', 'building', 'preview', 'ui'];
export const VARIANTS = ['desktop', 'mobile', 'thumb'];
export const LOADS = ['lobby', 'initial', 'lazy', 'onDemand']; // lobby: Designauswahl · initial: beim Spielstart · lazy: bei Sichtbarkeit · onDemand: nur wenn gebraucht (z. B. Figur eines Mitspielers)
export const MIME = ['image/webp'];
export const LICENSE_STATUS = ['cleared', 'open', 'blocked']; // cleared: Herkunft und Lizenz belegt – nur diese Dateien dürfen in ein veröffentlichbares Bundle
export const BUDGET_CAPS = Object.freeze({ lobby: 300 * 1024, mobileStart: 1.5 * 1024 * 1024, desktopStart: 2.5 * 1024 * 1024 }); // Zielwerte des Projekts
export const FALLBACK_MAX_BYTES = 16 * 1024;
export const MAX_PLAYERS = 8;
// Größte erlaubte Abmessung je Rolle und Variante (nie hochskalieren) und WebP-Qualität (q: 1 = verlustfrei, für kleine Gebäudesymbole mit feinen Linien). Mobile Varianten sind bewusst kleiner:
// 22 ungeschrumpfte 1672×941-Bilder bräuchten entpackt rund 130 MiB Bildspeicher.
export const PROFILES = Object.freeze({
  board: { desktop: { w: 1920, h: 1080, q: 0.8 }, mobile: { w: 1170, h: 1320, q: 0.78 } },
  location: { thumb: { w: 384, h: 216, q: 0.78 }, mobile: { w: 480, h: 270, q: 0.78 }, desktop: { w: 768, h: 432, q: 0.8 } },
  deed: { mobile: { w: 640, h: 360, q: 0.78 }, desktop: { w: 960, h: 540, q: 0.8 } },
  figure: { mobile: { w: 160, h: 272, q: 0.9 }, desktop: { w: 256, h: 436, q: 0.9 } },
  building: { mobile: { w: 64, h: 64, q: 1 }, desktop: { w: 96, h: 96, q: 1 } },
  preview: { desktop: { w: 288, h: 180, q: 0.8 } },
  ui: { mobile: { w: 512, h: 512, q: 0.8 }, desktop: { w: 1024, h: 1024, q: 0.8 } },
});
const MOBILE_REQUIRED = ['board', 'location', 'deed', 'figure'];
export const FILE_NAME = /^([a-z][a-z0-9-]{0,40})\.(desktop|mobile|thumb)\.([0-9a-f]{12})\.webp$/; // <asset>.<variante>.<sha256-Anfang>.webp: der Name ändert sich mit dem Inhalt (unveränderlich cachebar)
const ID = /^[a-z][a-z0-9-]{0,40}$/, THEME_ID = /^[a-z][a-z0-9-]{1,23}$/, HEX64 = /^[0-9a-f]{64}$/;
const FORBIDDEN = /^(price|prices|rent|rents|build|tax|cost|costs|money|rule|rules|owner|stock|dice|jail|mortgage|auction|trade)$/i;

export const assetBase = (themeId) => `/games/monopoly/themes/${themeId}/assets/`;
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const int = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

// Prüft ein Manifest (nur Struktur und Regeln, keine Dateien). Gibt eine Liste von Fehlertexten zurück; leer = gültig.
export function validateManifest(m, { requirePublishable = false } = {}) {
  const errors = [], err = (t) => errors.push(t);
  if (!isObj(m)) return ['Manifest ist kein Objekt'];
  const known = (obj, keys, where) => { for (const k of Object.keys(obj)) { if (FORBIDDEN.test(k)) err(`${where}: "${k}" ist Spielregel-/Spieldaten und gehört nicht ins Manifest`); else if (!keys.includes(k)) err(`${where}: unbekannter Schlüssel "${k}"`); } };
  known(m, ['manifestVersion', 'themeId', 'release', 'assetBase', 'generator', 'budgets', 'assets'], 'Manifest');
  if (m.manifestVersion !== MANIFEST_VERSION) err(`manifestVersion muss ${MANIFEST_VERSION} sein`);
  if (typeof m.themeId !== 'string' || !THEME_ID.test(m.themeId)) err('themeId ungültig');
  if (!['draft', 'publishable'].includes(m.release)) err('release muss draft oder publishable sein');
  if (m.assetBase !== assetBase(m.themeId)) err(`assetBase muss ${assetBase(m.themeId)} lauten`);
  if (!isObj(m.generator)) err('generator fehlt'); else { known(m.generator, ['tool', 'encoder', 'encoderVersion', 'sourceSetHash'], 'generator'); if (!HEX64.test(m.generator.sourceSetHash || '')) err('generator.sourceSetHash ungültig'); for (const k of ['tool', 'encoder', 'encoderVersion']) if (typeof m.generator[k] !== 'string' || !m.generator[k]) err(`generator.${k} fehlt`); }
  if (!isObj(m.budgets)) err('budgets fehlt'); else {
    known(m.budgets, ['lobby', 'mobileStart', 'desktopStart'], 'budgets');
    for (const k of Object.keys(BUDGET_CAPS)) if (!Number.isInteger(m.budgets[k]) || m.budgets[k] <= 0 || m.budgets[k] > BUDGET_CAPS[k]) err(`budgets.${k} muss eine Zahl bis ${BUDGET_CAPS[k]} Bytes sein`);
  }
  if (!Array.isArray(m.assets) || !m.assets.length) { err('assets fehlt oder ist leer'); return errors; }
  const byId = new Map(), files = new Set(), perRoleField = new Map();
  for (const a of m.assets) {
    if (!isObj(a)) { err('Asset ist kein Objekt'); continue; }
    const w = `Asset ${a.id}`;
    known(a, ['id', 'role', 'load', 'fieldIds', 'slot', 'alt', 'focus', 'fallback', 'source', 'origin', 'variants'], w);
    if (typeof a.id !== 'string' || !ID.test(a.id)) { err(`Asset-ID ungültig: ${a.id}`); continue; }
    if (byId.has(a.id)) { err(`Doppelte Asset-ID ${a.id}`); continue; }
    byId.set(a.id, a);
    if (!ROLES.includes(a.role)) { err(`${w}: Rolle ${a.role} unbekannt`); continue; }
    if (!LOADS.includes(a.load)) err(`${w}: load ${a.load} unbekannt`);
    if (a.role === 'preview' && a.load !== 'lobby') err(`${w}: Vorschaubilder laden als lobby`);
    if (['location', 'deed'].includes(a.role)) {
      if (!Array.isArray(a.fieldIds) || !a.fieldIds.length || a.fieldIds.some((f) => !int(f, 0, FIELD_COUNT - 1)) || new Set(a.fieldIds).size !== a.fieldIds.length) err(`${w}: fieldIds braucht eindeutige Feld-IDs 0–${FIELD_COUNT - 1}`);
      else for (const f of a.fieldIds) { const key = `${a.role}:${f}`; if (perRoleField.has(key)) err(`${w}: Feld ${f} ist für ${a.role} schon durch ${perRoleField.get(key)} belegt`); else perRoleField.set(key, a.id); }
    } else if (a.fieldIds !== undefined) err(`${w}: fieldIds nur für location und deed`);
    if (a.role === 'figure') { if (typeof a.slot !== 'string' || !THEME_ID.test(a.slot)) err(`${w}: Figur braucht slot (Token-ID)`); } else if (a.role === 'building') { if (!int(a.slot, 1, 5)) err(`${w}: Gebäude braucht slot 1–5 (Ausbaustufe)`); } else if (a.slot !== undefined) err(`${w}: slot nur für figure und building`);
    if (a.alt !== undefined && (typeof a.alt !== 'string' || a.alt.length > 120)) err(`${w}: alt zu lang`);
    if (a.focus !== undefined) { if (!isObj(a.focus)) err(`${w}: focus muss ein Objekt sein`); else { known(a.focus, ['board', 'deed', 'mobile', 'event'], `${w}.focus`); for (const [k, p] of Object.entries(a.focus)) if (!isObj(p) || !(p.x >= 0 && p.x <= 100) || !(p.y >= 0 && p.y <= 100)) err(`${w}: focus.${k} braucht x und y von 0 bis 100`); } }
    if (!isObj(a.source) || !int(a.source.width, 1, 20000) || !int(a.source.height, 1, 20000) || !HEX64.test(a.source.sha256 || '')) err(`${w}: source braucht width, height und sha256`);
    else known(a.source, ['width', 'height', 'sha256'], `${w}.source`);
    const o = a.origin;
    if (!isObj(o)) err(`${w}: origin fehlt`); else {
      known(o, ['creator', 'source', 'license', 'licenseStatus', 'evidence', 'publication'], `${w}.origin`);
      for (const k of ['creator', 'source', 'license', 'evidence']) if (typeof o[k] !== 'string' || !o[k].trim()) err(`${w}: origin.${k} fehlt`);
      if (!LICENSE_STATUS.includes(o.licenseStatus)) err(`${w}: origin.licenseStatus muss ${LICENSE_STATUS.join('/')} sein`);
      if (!['public-ok', 'private-only'].includes(o.publication)) err(`${w}: origin.publication muss public-ok oder private-only sein`);
      if (o.publication === 'public-ok' && o.licenseStatus !== 'cleared') err(`${w}: public-ok setzt licenseStatus cleared voraus`);
      if (requirePublishable || m.release === 'publishable') if (o.licenseStatus !== 'cleared' || o.publication !== 'public-ok') err(`${w}: nicht veröffentlichbar (licenseStatus ${o.licenseStatus}, publication ${o.publication}) – ungeklärte Dateien gehören nicht in ein veröffentlichbares Bundle`);
    }
    const prof = PROFILES[a.role], seen = new Set();
    if (!Array.isArray(a.variants) || !a.variants.length) { err(`${w}: variants fehlt`); continue; }
    for (const v of a.variants) {
      if (!isObj(v)) { err(`${w}: Variante ist kein Objekt`); continue; }
      known(v, ['name', 'file', 'mime', 'width', 'height', 'bytes', 'sha256', 'alpha', 'quality'], `${w}.variants`);
      const vw = `${w}/${v.name}`;
      if (!prof[v.name]) { err(`${vw}: Variante für Rolle ${a.role} nicht vorgesehen`); continue; }
      if (seen.has(v.name)) err(`${vw}: doppelt`); seen.add(v.name);
      const fm = FILE_NAME.exec(v.file || '');
      if (!fm) err(`${vw}: Dateiname ${v.file} entspricht nicht <asset>.<variante>.<hash12>.webp`);
      else { if (fm[1] !== a.id || fm[2] !== v.name) err(`${vw}: Dateiname passt nicht zu Asset und Variante`); if (!HEX64.test(v.sha256 || '') || !v.sha256.startsWith(fm[3])) err(`${vw}: Hash im Dateinamen passt nicht zur sha256`); if (files.has(v.file)) err(`${vw}: Datei ${v.file} doppelt belegt`); files.add(v.file); }
      if (!MIME.includes(v.mime)) err(`${vw}: MIME ${v.mime} nicht unterstützt (erlaubt: ${MIME.join(', ')})`);
      if (!int(v.width, 1, 20000) || !int(v.height, 1, 20000)) err(`${vw}: Abmessungen ungültig`);
      else if (v.width > prof[v.name].w || v.height > prof[v.name].h) err(`${vw}: ${v.width}×${v.height} überschreitet das Profil ${prof[v.name].w}×${prof[v.name].h}`);
      if (!int(v.bytes, 1, 64 * 1024 * 1024)) err(`${vw}: bytes ungültig`);
      if (typeof v.alpha !== 'boolean') err(`${vw}: alpha muss wahr oder falsch sein`);
      if (v.quality !== undefined) { if (!isObj(v.quality) || !(v.quality.meanError >= 0) || !(v.quality.maxAlphaError >= 0) || !(v.quality.q > 0 && v.quality.q <= 1)) err(`${vw}: quality braucht meanError, maxAlphaError und q (0–1)`); else known(v.quality, ['meanError', 'maxAlphaError', 'q'], `${vw}.quality`); }
    }
    if (!seen.has('desktop')) err(`${w}: Variante desktop fehlt`);
    if (MOBILE_REQUIRED.includes(a.role) && !seen.has('mobile')) err(`${w}: Variante mobile fehlt (Rolle ${a.role})`);
    if (a.role === 'figure' || a.role === 'building') for (const v of a.variants) if (v.alpha === false) err(`${w}: ${a.role} braucht Transparenz`);
  }
  // Fallbacks: müssen existieren, dürfen keine Kette bilden, sofort verfügbar und winzig sein
  for (const a of byId.values()) {
    if (a.fallback === undefined) continue;
    const f = byId.get(a.fallback);
    if (!f) { err(`Asset ${a.id}: Fallback ${a.fallback} gibt es nicht`); continue; }
    if (f.fallback !== undefined) err(`Asset ${a.id}: Fallback ${f.id} darf selbst keinen Fallback haben`);
    if (!['initial', 'lobby'].includes(f.load)) err(`Asset ${a.id}: Fallback ${f.id} muss initial oder lobby laden`);
    const big = (f.variants || []).find((v) => v.bytes > FALLBACK_MAX_BYTES); if (big) err(`Asset ${a.id}: Fallback ${f.id}/${big.name} ist größer als ${FALLBACK_MAX_BYTES} Bytes`);
  }
  // Budgets (nur wenn sonst alles stimmt): die Zielwerte gelten auch für das Manifest selbst
  if (!errors.length) {
    const b = m.budgets, got = { lobby: lobbyBytes(m), mobileStart: startBytes(m, 'mobile'), desktopStart: startBytes(m, 'desktop') };
    for (const k of Object.keys(got)) if (got[k] > b[k]) err(`Budget ${k} überschritten: ${got[k]} > ${b[k]} Bytes`);
  }
  return errors;
}

// ---- Auswahl, Ladeplan und Budgets (auch im Browser nutzbar) ----
// Variante für eine Anzeige: mobile → mobile (sonst desktop); thumb → thumb (sonst mobile/desktop)
export function selectVariant(asset, { mobile = false, thumb = false } = {}) {
  const by = (n) => asset.variants.find((v) => v.name === n);
  const order = thumb ? ['thumb', mobile ? 'mobile' : 'desktop', 'desktop'] : mobile ? ['mobile', 'desktop'] : ['desktop'];
  for (const n of order) { const v = by(n); if (v) return v; }
  return asset.variants[0];
}
export const assetUrl = (m, variant) => m.assetBase + variant.file;
export const lobbyBytes = (m, target = 'desktop') => m.assets.filter((a) => a.load === 'lobby').reduce((s, a) => s + selectVariant(a, { mobile: target === 'mobile' }).bytes, 0);
// Bytes, die zum Spielstart nötig sind: alles mit load initial, dazu die Figuren der Mitspieler (schlimmster Fall: die `figures` größten)
export function startBytes(m, target = 'desktop', { figures = MAX_PLAYERS } = {}) {
  const pick = (a) => selectVariant(a, { mobile: target === 'mobile' }).bytes;
  const initial = m.assets.filter((a) => a.load === 'initial').reduce((s, a) => s + pick(a), 0);
  const figs = m.assets.filter((a) => a.role === 'figure' && a.load === 'onDemand').map(pick).sort((x, y) => y - x).slice(0, figures).reduce((s, n) => s + n, 0);
  return initial + figs;
}
// Ladeplan für das Spiel: was sofort, was später kommt (Dateien mit URL und Bytes)
export function loadPlan(m, target = 'desktop') {
  const mobile = target === 'mobile', plan = { lobby: [], initial: [], lazy: [], onDemand: [] };
  for (const a of m.assets) plan[a.load].push({ id: a.id, role: a.role, url: assetUrl(m, selectVariant(a, { mobile })), bytes: selectVariant(a, { mobile }).bytes });
  return plan;
}
// Welche Felder hat ein Theme für diese Rolle noch nicht abgedeckt? (expected: Liste der Feld-IDs, Standard alle 40)
export function fieldCoverage(m, role, expected = Array.from({ length: FIELD_COUNT }, (_, i) => i)) {
  const have = new Set(m.assets.filter((a) => a.role === role).flatMap((a) => a.fieldIds || []));
  return { have: [...have].sort((a, b) => a - b), missing: expected.filter((f) => !have.has(f)) };
}
export const assetForField = (m, role, fieldId) => m.assets.find((a) => a.role === role && a.fieldIds?.includes(fieldId)) || null;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// <img>-Markup: Abmessungen immer gesetzt (kein Springen), Detailbilder faul, bei einem Ladefehler tauscht der Browser auf die Fallback-Datei
export function imgHTML(m, asset, { mobile = false, thumb = false, eager = false } = {}) {
  const v = selectVariant(asset, { mobile, thumb }), fb = asset.fallback ? m.assets.find((a) => a.id === asset.fallback) : null;
  const fbUrl = fb ? assetUrl(m, selectVariant(fb, { mobile: true })) : '';
  const lazy = !eager && asset.load !== 'initial' && asset.load !== 'lobby';
  return `<img src="${esc(assetUrl(m, v))}" width="${v.width}" height="${v.height}" alt="${esc(asset.alt || '')}" decoding="async" draggable="false"${lazy ? ' loading="lazy"' : ''}${fbUrl ? ` data-fallback="${esc(fbUrl)}"` : ''}>`;
}
