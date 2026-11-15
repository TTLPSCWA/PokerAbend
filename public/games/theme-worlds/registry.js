// ART-W0: zentrale Registry der Themenwelten. Server (Prüfung der Host-Auswahl) und Browser (Lebenszyklus) teilen diese Datei.
// Eine Welt ist reine Darstellung: Sie ändert nie Regeln, Zufall, Zeitlimits, Bots, Wertung oder Spiel-IDs.
// Die vorhandenen Kartenwelten (ART-T, public/games/card-worlds/worlds.js) sind unverändert als Welten der Art „card“ eingebunden;
// ihre IDs, das Raumfeld `cardWorld` und das Ereignis `setCardWorld` bleiben die eine Weltauswahl des Raums.
// Neue Welten (Brett, Würfel, Party …) kommen als weitere Einträge dazu und erscheinen erst mit `released: true`.
import { WORLDS as CARD_WORLDS, FONTS, CARD_WORLD_GAMES } from '../card-worlds/worlds.js';

export const KINDS = ['card', 'board', 'dice', 'party', 'generic'];
export const EFFECTS = ['snow', 'music']; // bekannte Effekttypen; der Browser registriert ihre Umsetzung (ThemeWorlds.effect)
const ID = /^[A-Za-z][A-Za-z0-9-]{0,23}$/, GAME = /^[a-z][a-z0-9-]{1,40}$/, URL_ = /^\/(?!\/)[A-Za-z0-9/_.-]+\.(svg|webp|png|css|woff2|mp3)$/ /* nur eigene Pfade, kein //fremder-host */, HEX = /^#[0-9a-fA-F]{6}$/;
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const text = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !/[<>\u0000-\u001f]/.test(v);
const FORBIDDEN = /^(rules?|price|prices|rent|rents|score|scores|timer|turnTime|bots?|seed|random|deck|cards|variantRules)$/;

// Prüft eine Weltdefinition. Rückgabe: Liste von Fehlertexten (leer = gültig).
export function validateWorld(w, { gameIds = null } = {}) {
  const errors = [], err = (t) => errors.push(`${w?.id ?? '?'}: ${t}`);
  if (!isObj(w)) return ['Welt ist kein Objekt'];
  const allowed = ['id', 'kind', 'name', 'description', 'games', 'variants', 'assets', 'palette', 'fonts', 'effects', 'fallback', 'released', 'source', 'card'];
  for (const k of Object.keys(w)) { if (FORBIDDEN.test(k)) err(`"${k}" ist Spielmechanik und gehört nicht in eine Welt`); else if (!allowed.includes(k)) err(`unbekannter Schlüssel "${k}"`); }
  if (typeof w.id !== 'string' || !ID.test(w.id)) err('ID ungültig');
  if (!KINDS.includes(w.kind)) err(`Art ${w.kind} unbekannt`);
  for (const k of ['name', 'description']) if (!isObj(w[k]) || !text(w[k].de, k === 'name' ? 40 : 160) || !text(w[k].en, k === 'name' ? 40 : 160)) err(`${k} braucht de und en`);
  if (!Array.isArray(w.games) || !w.games.length || w.games.some((g) => typeof g !== 'string' || !GAME.test(g)) || new Set(w.games).size !== w.games.length) err('games braucht eindeutige Spiel-IDs');
  else if (gameIds) for (const g of w.games) if (!gameIds.includes(g)) err(`Spiel ${g} gibt es nicht`);
  if (w.variants !== null && w.variants !== undefined) {
    if (!isObj(w.variants)) err('variants muss ein Objekt sein');
    else for (const [g, list] of Object.entries(w.variants)) { if (!w.games?.includes(g)) err(`variants nennt ${g}, das nicht in games steht`); if (!Array.isArray(list) || !list.length || list.some((v) => typeof v !== 'string' || !GAME.test(v))) err(`variants.${g} braucht Varianten-IDs`); }
  }
  const a = w.assets;
  if (!isObj(a)) err('assets fehlt');
  else {
    for (const k of Object.keys(a)) if (!['preview', 'css', 'preload'].includes(k)) err(`assets: unbekannter Schlüssel "${k}"`);
    if (a.preview !== null && (typeof a.preview !== 'string' || !URL_.test(a.preview))) err('assets.preview muss ein Pfad oder null sein');
    for (const k of ['css', 'preload']) if (!Array.isArray(a[k]) || a[k].some((u) => typeof u !== 'string' || !URL_.test(u) || u.includes('..'))) err(`assets.${k} braucht lokale Pfade`);
    if (Array.isArray(a.css) && a.css.some((u) => !u.endsWith('.css'))) err('assets.css nimmt nur .css');
  }
  const p = w.palette;
  if (!isObj(p) || !Array.isArray(p.colors) || !p.colors.length || p.colors.some((c) => !HEX.test(c))) err('palette.colors braucht Farben #rrggbb');
  else for (const k of Object.keys(p)) if (!['colors', 'background', 'text'].includes(k) || (k !== 'colors' && !HEX.test(p[k]))) err(`palette.${k} ungültig`);
  if (!Array.isArray(w.fonts) || w.fonts.some((f) => !isObj(f) || !text(f.family, 40) || typeof f.url !== 'string' || !URL_.test(f.url) || !f.url.endsWith('.woff2'))) err('fonts braucht { family, url: …woff2 }');
  if (!Array.isArray(w.effects)) err('effects muss eine Liste sein');
  else { const types = w.effects.map((e) => e?.type); if (types.some((t) => !EFFECTS.includes(t))) err(`Effekt unbekannt: ${types.filter((t) => !EFFECTS.includes(t)).join(', ')}`); if (new Set(types).size !== types.length) err('Effekt doppelt'); for (const e of w.effects) if (isObj(e)) for (const k of Object.keys(e)) if (!['type', 'motion', 'sound'].includes(k)) err(`Effekt ${e.type}: unbekannter Schlüssel "${k}"`); }
  if (w.fallback !== 'standard') err('fallback muss "standard" sein (bei fehlenden Assets gilt das Standarddesign)');
  if (typeof w.released !== 'boolean') err('released muss wahr oder falsch sein');
  if (typeof w.source !== 'string' || !w.source) err('source (Paket-ID) fehlt');
  if (w.kind === 'card') { if (!isObj(w.card) || typeof w.card.frame !== 'string') err('card.frame fehlt'); } else if (w.card !== undefined) err('card nur für Kartenwelten');
  return errors;
}

// Baut eine Registry. Ungültige Definitionen brechen sofort ab (beim Serverstart bzw. im Test), nicht erst am Tisch.
export function createRegistry(defs, { gameIds = null } = {}) {
  const errors = defs.flatMap((w) => validateWorld(w, { gameIds }));
  const ids = defs.map((w) => w.id); if (new Set(ids).size !== ids.length) errors.push('doppelte Welt-ID');
  if (errors.length) throw new Error('Themenwelten ungültig:\n  ' + errors.join('\n  '));
  const list = defs.map((w) => Object.freeze(structuredClone(w)));
  const byId = new Map(list.map((w) => [w.id, w]));
  return Object.freeze({
    list: () => list,
    // Welten, die der Host für dieses Spiel wählen kann (nur freigegebene)
    worldsFor: (game) => list.filter((w) => w.released && w.games.includes(game)),
    // Spiel-Ebene (wie bisher worldOf): Welt existiert, ist freigegeben und für das Spiel vorgesehen – sonst null (sicherer Rückfall)
    worldFor: (game, id) => { const w = typeof id === 'string' ? byId.get(id) : null; return w && w.released && w.games.includes(game) ? w : null; },
    // Darstellung: gilt die Welt auch für diese Variante? (z. B. UNO-Varianten mit eigener Gestaltung behalten ihr Aussehen)
    appliesTo: (w, game, variant) => !!w && w.games.includes(game) && (!w.variants?.[game] || w.variants[game].includes(variant || 'classic')),
    assertGames: (gameIds) => { const bad = list.flatMap((w) => w.games.filter((g) => !gameIds.includes(g)).map((g) => `${w.id}: ${g}`)); if (bad.length) throw new Error('Themenwelten nennen unbekannte Spiele: ' + bad.join(', ')); return true; },
  });
}

// ART-T: die 40 Kartenwelten als Welten der Art „card“. Daten bleiben in card-worlds/worlds.js (Quelle der Kartengestaltung).
export const cardWorldDefinition = (w) => ({
  id: w.id, kind: 'card', name: { de: w.name, en: w.name }, description: { de: w.world, en: w.world },
  games: w.game === 'all' ? [...CARD_WORLD_GAMES] : [w.game], variants: (w.game === 'all' || w.game === 'farbenchaos') ? { farbenchaos: ['classic'] } : null,
  assets: { preview: `/games/card-worlds/art/${w.id}/0.svg`, css: [], preload: [`/games/card-worlds/art/${w.id}/0.svg`] },
  palette: { colors: w.cols.map((c) => c[1]) },
  fonts: FONTS[w.font] ? [{ family: w.font, url: `/fonts/worlds/${FONTS[w.font]}.woff2` }] : [],
  effects: w.game === 'all' ? [{ type: 'snow', motion: true }, { type: 'music', sound: true }] : [],
  fallback: 'standard', released: true, source: w.game === 'all' ? 'ART-T5' : 'ART-T1', card: { frame: w.frame },
});
export const BUILTIN = CARD_WORLDS.map(cardWorldDefinition);

let active = createRegistry(BUILTIN);
export const themeRegistry = () => active;
// Nur für Tests: Registry tauschen, Rückgabe stellt die vorherige wieder her
export function useThemeRegistry(r) { const prev = active; active = r; return () => { active = prev; }; }
