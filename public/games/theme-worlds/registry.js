// ART-W0: zentrale Registry der Themenwelten. Server (Prüfung der Host-Auswahl) und Browser (Lebenszyklus) teilen diese Datei.
// Eine Welt ist reine Darstellung: Sie ändert nie Regeln, Zufall, Zeitlimits, Bots, Wertung oder Spiel-IDs.
// Die vorhandenen Kartenwelten (ART-T, public/games/card-worlds/worlds.js) sind unverändert als Welten der Art „card“ eingebunden;
// ihre IDs, das Raumfeld `cardWorld` und das Ereignis `setCardWorld` bleiben die eine Weltauswahl des Raums.
// Neue Welten (Brett, Würfel, Party …) kommen als weitere Einträge dazu und erscheinen erst mit `released: true`.
import { WORLDS as CARD_WORLDS, FONTS, CARD_WORLD_GAMES } from '../card-worlds/worlds.js';
import { TW01 } from './tw-01.js';
import { DICE_WORLDS } from './dice-worlds.js';
import { TW08, TW10, TW09_BOARD_FACET } from './board-worlds.js';

export const KINDS = ['card', 'board', 'dice', 'party', 'generic'];
export const EFFECTS = ['snow', 'music']; // bekannte Effekttypen; der Browser registriert ihre Umsetzung (ThemeWorlds.effect)
const ID = /^[A-Za-z][A-Za-z0-9-]{0,23}$/, GAME = /^[a-z][a-z0-9-]{1,40}$/, URL_ = /^\/(?!\/)[A-Za-z0-9/_.-]+\.(svg|webp|png|css|woff2|mp3)$/ /* nur eigene Pfade, kein //fremder-host */, HEX = /^#[0-9a-fA-F]{6}$/;
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const text = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !/[<>\u0000-\u001f]/.test(v);
const FORBIDDEN = /^(rules?|price|prices|rent|rents|score|scores|timer|turnTime|bots?|seed|random|deck|cards|variantRules)$/;

// ART-W3: Zierformen für Spielfiguren (z. B. Ornamente auf Schachfiguren) als kleine SVG-Bruchstücke. Nur einfache Formen und
// harmlose Attribute; keine Skripte, Verweise, Ereignisse oder Text. Die Silhouette der Figur bleibt immer die des Spiels.
const ART_TAGS = ['path', 'circle', 'ellipse', 'rect', 'g'], ART_ATTRS = ['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'transform', 'opacity', 'fill', 'stroke-width', 'class'];
export function validArtFragment(s) {
  if (typeof s !== 'string' || s.length > 2000) return false;
  if (s.trim() === '') return true;
  const rest = s.replace(/<\/?([a-z]+)((?:\s+[a-z-]+="[^"<>]*")*)\s*\/?>/g, (m, tag, attrs) => {
    if (!ART_TAGS.includes(tag)) return '#';
    for (const [, k, v] of attrs.matchAll(/\s([a-z-]+)="([^"]*)"/g)) if (!ART_ATTRS.includes(k) || /url|javascript|[&;]/i.test(v) || (k === 'fill' && v !== 'none')) return '#';
    return '';
  });
  return rest.trim() === '';
}
function validateAssets(a, err, where = 'assets') {
  if (!isObj(a)) { err(`${where} fehlt`); return; }
  for (const k of Object.keys(a)) if (!['preview', 'css', 'preload'].includes(k)) err(`${where}: unbekannter Schlüssel "${k}"`);
  if (a.preview !== null && (typeof a.preview !== 'string' || !URL_.test(a.preview))) err(`${where}.preview muss ein Pfad oder null sein`);
  for (const k of ['css', 'preload']) if (!Array.isArray(a[k]) || a[k].some((u) => typeof u !== 'string' || !URL_.test(u) || u.includes('..'))) err(`${where}.${k} braucht lokale Pfade`);
  if (Array.isArray(a.css) && a.css.some((u) => !u.endsWith('.css'))) err(`${where}.css nimmt nur .css`);
}
function validateArt(art, err, where = 'art') {
  if (art === undefined) return;
  if (!isObj(art)) { err(`${where} muss ein Objekt sein`); return; }
  for (const [set, parts] of Object.entries(art)) {
    if (!/^[a-z]{1,20}$/.test(set) || !isObj(parts)) { err(`${where}.${set} ungültig`); continue; }
    for (const [k, v] of Object.entries(parts)) if (!/^[a-z]{1,8}$/.test(k) || !validArtFragment(v)) err(`${where}.${set}.${k} ist kein erlaubtes SVG-Bruchstück`);
  }
}

// Prüft eine Weltdefinition. Rückgabe: Liste von Fehlertexten (leer = gültig).
export function validateWorld(w, { gameIds = null } = {}) {
  const errors = [], err = (t) => errors.push(`${w?.id ?? '?'}: ${t}`);
  if (!isObj(w)) return ['Welt ist kein Objekt'];
  const allowed = ['id', 'kind', 'name', 'description', 'games', 'variants', 'assets', 'palette', 'fonts', 'effects', 'fallback', 'released', 'source', 'card', 'texts', 'art', 'facets'];
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
  validateAssets(w.assets, err);
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
  // Darstellungstexte (z. B. Feld-, Karten- und Figurennamen): nur Text, nie Wirkung; das Spiel prüft Anzahl und Bezug selbst
  if (w.texts !== undefined) {
    const tx = w.texts;
    if (!isObj(tx)) err('texts muss ein Objekt sein');
    else {
      for (const k of Object.keys(tx)) if (!['fields', 'cards', 'tokens'].includes(k)) err(`texts: unbekannter Schlüssel "${k}"`);
      if (tx.fields !== undefined) { if (!isObj(tx.fields)) err('texts.fields muss ein Objekt sein'); else for (const [k, v] of Object.entries(tx.fields)) if (!/^\d{1,2}$/.test(k) || !text(v, 40)) err(`texts.fields.${k} ungültig`); }
      if (tx.cards !== undefined) { if (!isObj(tx.cards)) err('texts.cards muss ein Objekt sein'); else for (const [k, list] of Object.entries(tx.cards)) if (!/^[a-z]{1,20}$/.test(k) || !Array.isArray(list) || !list.length || list.some((t) => !text(t, 200))) err(`texts.cards.${k} ungültig`); }
      if (tx.tokens !== undefined) { if (!isObj(tx.tokens)) err('texts.tokens muss ein Objekt sein'); else for (const [k, v] of Object.entries(tx.tokens)) if (!/^[a-z]{1,20}$/.test(k) || !text(v, 30)) err(`texts.tokens.${k} ungültig`); }
    }
  }
  validateArt(w.art, err);
  // ART-W3: Facetten – dieselbe Welt (gleiche ID, gleicher Name) in einer zweiten Ausprägung für eine andere Spielgruppe,
  // z. B. TW-09 für Würfel- und Brettspiele. Jede Facette hat eigene Art, Spiele und Dateien; geladen wird nur die passende.
  if (w.facets !== undefined) {
    if (!Array.isArray(w.facets) || !w.facets.length) err('facets muss eine nicht leere Liste sein');
    else {
      const seen = new Set(Array.isArray(w.games) ? w.games : []);
      w.facets.forEach((f, i) => {
        const where = `facets[${i}]`;
        if (!isObj(f)) { err(`${where} ist kein Objekt`); return; }
        for (const k of Object.keys(f)) if (!['kind', 'games', 'variants', 'assets', 'palette', 'fonts', 'art', 'source'].includes(k)) err(`${where}: unbekannter Schlüssel "${k}"`);
        if (!KINDS.includes(f.kind) || f.kind === 'card') err(`${where}: Art ${f.kind} nicht möglich`);
        if (!Array.isArray(f.games) || !f.games.length || f.games.some((g) => typeof g !== 'string' || !GAME.test(g))) err(`${where}: games braucht Spiel-IDs`);
        else for (const g of f.games) { if (seen.has(g)) err(`${where}: Spiel ${g} ist schon einer anderen Ausprägung zugeordnet`); seen.add(g); if (gameIds && !gameIds.includes(g)) err(`${where}: Spiel ${g} gibt es nicht`); }
        if (f.variants !== null && f.variants !== undefined) { if (!isObj(f.variants)) err(`${where}.variants muss ein Objekt sein`); else for (const g of Object.keys(f.variants)) if (!f.games?.includes(g)) err(`${where}.variants nennt ${g}`); }
        validateAssets(f.assets, err, `${where}.assets`);
        if (f.palette !== undefined && (!isObj(f.palette) || !Array.isArray(f.palette.colors) || f.palette.colors.some((c) => !HEX.test(c)))) err(`${where}.palette ungültig`);
        if (f.fonts !== undefined && (!Array.isArray(f.fonts) || f.fonts.some((x) => !isObj(x) || !text(x.family, 40) || !URL_.test(x.url || '') || !x.url.endsWith('.woff2')))) err(`${where}.fonts ungültig`);
        validateArt(f.art, err, `${where}.art`);
      });
    }
  }
  return errors;
}

// Baut eine Registry. Ungültige Definitionen brechen sofort ab (beim Serverstart bzw. im Test), nicht erst am Tisch.
export function createRegistry(defs, { gameIds = null } = {}) {
  const errors = defs.flatMap((w) => validateWorld(w, { gameIds }));
  const ids = defs.map((w) => w.id); if (new Set(ids).size !== ids.length) errors.push('doppelte Welt-ID');
  if (errors.length) throw new Error('Themenwelten ungültig:\n  ' + errors.join('\n  '));
  const list = defs.map((w) => Object.freeze(structuredClone(w)));
  const byId = new Map(list.map((w) => [w.id, w]));
  // Ausprägung einer Welt für ein Spiel: die Hauptdefinition oder eine Facette (gleiche ID, Name, Beschreibung; eigene Art, Spiele, Dateien).
  // Ergebnis ist stabil (einmal erzeugt), damit der Lebenszyklus gleiche Ausprägungen erkennt.
  const views = new Map();
  const viewOf = (w, game) => {
    if (w.games.includes(game)) return w;
    const i = (w.facets || []).findIndex((f) => f.games.includes(game)); if (i < 0) return null;
    const key = `${w.id}#${i}`;
    if (!views.has(key)) { const f = w.facets[i]; const { facets, ...base } = w; views.set(key, Object.freeze({ ...base, kind: f.kind, games: f.games, variants: f.variants ?? null, assets: f.assets, palette: f.palette || w.palette, fonts: f.fonts || w.fonts, effects: [], art: f.art, source: f.source || w.source, facet: i })); }
    return views.get(key);
  };
  const allGames = (w) => [...w.games, ...(w.facets || []).flatMap((f) => f.games)];
  return Object.freeze({
    list: () => list,
    // Hauptdefinitionen (ohne Facetten) – unverändert seit ART-W0, z. B. für die Würfelwelten-Prüfung
    worldsFor: (game) => list.filter((w) => w.released && w.games.includes(game)),
    worldFor: (game, id) => { const w = typeof id === 'string' ? byId.get(id) : null; return w && w.released && w.games.includes(game) ? w : null; },
    // ART-W3: Auswahl und Darstellung je Spiel inklusive Facetten. Server (setCardWorld, Neustart, Spielwechsel), Host-Menü und Lebenszyklus nutzen diese Abfragen.
    worldsForGame: (game) => list.filter((w) => w.released).map((w) => viewOf(w, game)).filter(Boolean),
    worldForGame: (game, id) => { const w = typeof id === 'string' ? byId.get(id) : null; return w && w.released ? viewOf(w, game) : null; },
    // Darstellung: gilt die Welt (bzw. Ausprägung) auch für diese Variante? (z. B. UNO-Varianten mit eigener Gestaltung behalten ihr Aussehen)
    appliesTo: (w, game, variant) => !!w && w.games.includes(game) && (!w.variants?.[game] || w.variants[game].includes(variant || 'classic')),
    assertGames: (gameIds) => { const bad = list.flatMap((w) => allGames(w).filter((g) => !gameIds.includes(g)).map((g) => `${w.id}: ${g}`)); if (bad.length) throw new Error('Themenwelten nennen unbekannte Spiele: ' + bad.join(', ')); return true; },
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
// ART-W1: TW-01 „Schatten über Neuengland“ für Monopoly (eigener Entwurf, siehe docs/design/THEME_WORLDS.md)
// ART-W2: Würfelwelten TW-14, TW-11, TW-09, TW-13 für alle Würfelspiele
// ART-W3: Brettwelten TW-08, TW-10 und TW-09 als Brett-Facette der Würfelwelt (gleiche ID, eigene Dateien)
export const BUILTIN = [...CARD_WORLDS.map(cardWorldDefinition), TW01, ...DICE_WORLDS.map((w) => (w.id === 'TW-09' ? { ...w, facets: [TW09_BOARD_FACET] } : w)), TW08, TW10];

let active = createRegistry(BUILTIN);
export const themeRegistry = () => active;
// Nur für Tests: Registry tauschen, Rückgabe stellt die vorherige wieder her
export function useThemeRegistry(r) { const prev = active; active = r; return () => { active = prev; }; }
