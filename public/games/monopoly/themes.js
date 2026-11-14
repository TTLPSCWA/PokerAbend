// Monopoly: Designs (Themes). Paket A der Theme-Architektur (ART-046): Server und Browser teilen diese Datei, wie data.js.
// Trennung der drei Ebenen:
//   1. Spielregeln   – data.js und games/monopoly/room.js; ein Theme berührt sie nie (Preise, Mieten, Würfel, Handel, Auktion, Hypothek).
//   2. Anzeigenamen  – dieses Modul: Feldnamen je Feld-ID 0–39 und Kartentexte; der Server löst sie auf, damit Brett, Protokoll und Karten übereinstimmen.
//   3. Grafikressourcen – später ein Asset-Manifest je Theme (`manifest`, siehe MANIFEST_PATH); das Paket A lädt noch keines.
// Das Raumsetting heißt weiter `settings.theme`; `modern` und `classic` bleiben unverändert. Junior (24 Felder) kennt keine Themes.
// Ein neues Theme erscheint erst in der Auswahl und wird nur dann angenommen, wenn `released: true` gesetzt ist.
import { BOARD, PROPERTIES, EVENTS, CHEST } from './data.js';

export const DEFAULT_THEME = 'modern';
export const THEME_VARIANTS = ['classic', 'speed']; // Junior hat ein eigenes 24-Felder-Brett und bekommt nie ein Theme
export const MANIFEST_PATH = (id) => `/games/monopoly/themes/${id}/manifest.json`;
const ID = /^[a-z][a-z0-9-]{1,23}$/;
const clean = (value, max) => typeof value === 'string' && value.length >= 1 && value.length <= max && value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value);

// Prüft eine Theme-Definition und gibt eine eingefrorene Kopie zurück. Fehler sind sofort sichtbar, nicht erst im Spiel.
export function validateTheme(def) {
  if (!def || typeof def !== 'object') throw new Error('Theme-Definition fehlt');
  const { id, name, released = false, variants = THEME_VARIANTS, fields = {}, cards = null, manifest = null } = def;
  if (typeof id !== 'string' || !ID.test(id)) throw new Error('Ungültige Theme-ID: ' + id);
  if (!clean(name, 40)) throw new Error(`Theme ${id}: Name fehlt oder ist zu lang`);
  if (typeof released !== 'boolean') throw new Error(`Theme ${id}: released muss wahr oder falsch sein`);
  if (!Array.isArray(variants) || !variants.length || variants.some((v) => !THEME_VARIANTS.includes(v))) throw new Error(`Theme ${id}: nur die Varianten ${THEME_VARIANTS.join(', ')} sind erlaubt (Junior hat kein Theme)`);
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new Error(`Theme ${id}: fields muss ein Objekt sein`);
  for (const [key, value] of Object.entries(fields)) {
    if (!/^\d+$/.test(key) || Number(key) >= BOARD.length) throw new Error(`Theme ${id}: Feld-ID ${key} gibt es nicht (0–${BOARD.length - 1})`);
    if (!clean(value, 40)) throw new Error(`Theme ${id}: Feldname ${key} fehlt oder ist zu lang`);
  }
  if (cards !== null) {
    if (typeof cards !== 'object' || !Array.isArray(cards.event) || !Array.isArray(cards.chest)) throw new Error(`Theme ${id}: cards braucht event und chest`);
    for (const [deck, list] of [['event', EVENTS], ['chest', CHEST]]) if (cards[deck].length !== list.length || cards[deck].some((t) => !clean(t, 200))) throw new Error(`Theme ${id}: ${deck} braucht genau ${list.length} Kartentexte`);
  }
  if (manifest !== null && manifest !== MANIFEST_PATH(id)) throw new Error(`Theme ${id}: manifest muss ${MANIFEST_PATH(id)} lauten`);
  return Object.freeze({ id, name, released, variants: Object.freeze([...variants]), fields: Object.freeze({ ...fields }), cards: cards && Object.freeze({ event: Object.freeze([...cards.event]), chest: Object.freeze([...cards.chest]) }), manifest });
}

export function createThemeRegistry(defs) {
  const list = defs.map(validateTheme);
  if (new Set(list.map((t) => t.id)).size !== list.length) throw new Error('Doppelte Theme-ID');
  if (!list.some((t) => t.id === DEFAULT_THEME && t.released)) throw new Error('Das Standardtheme muss freigegeben sein');
  const get = (id) => list.find((t) => t.id === id) || null;
  return Object.freeze({
    list: () => list,
    released: () => list.filter((t) => t.released),
    get,
    // Auswählbar: freigegeben und für diese Variante vorgesehen. Entwürfe (released: false) werden nirgends angenommen.
    supports: (id, variant) => { const t = get(id); return !!t && t.released && t.variants.includes(variant); },
    safe: (id) => (get(id)?.released ? id : DEFAULT_THEME),
  });
}

// Eingebaut sind genau die beiden bisherigen Werte. Ein Fantasy-Design kommt später als weiterer Eintrag dazu (Paket B ff.).
const BUILTIN = [{ id: 'modern', name: 'Bisheriges Thema', released: true }, { id: 'classic', name: 'Klassik', released: true }];
let active = createThemeRegistry(BUILTIN);
export const themeRegistry = () => active;
// Nur für Tests: tauscht die Registry aus und gibt eine Funktion zum Zurücksetzen zurück.
export function useThemeRegistry(registry) { const previous = active; active = registry; return () => { active = previous; }; }

// Anzeigenamen aller 40 Felder, in dieser Rangfolge:
//   1. Name aus einem eigenen Brett (nur die 28 Grundstücke) – eigene Bretter werden nie überschrieben,
//   2. Name aus dem Theme (Feld-ID 0–39),
//   3. Name des gewählten Bretts bzw. der Grundstandard aus data.js.
export function fieldNames({ theme = DEFAULT_THEME, board = null, registry = active } = {}) {
  const own = registry.get(theme)?.fields || {};
  const names = board && Array.isArray(board.names) && board.names.length === PROPERTIES.length ? board.names : null; // ein unvollständiges Brett wird ignoriert
  const custom = board?.id !== 'default' ? names : null;
  return BOARD.map((f) => {
    const at = PROPERTIES.indexOf(f.index);
    if (custom && at >= 0) return custom[at];
    if (own[f.index]) return own[f.index];
    return (at >= 0 && names?.[at]) || f.name;
  });
}

// Kartentext: Theme-Text, sonst der Standardtext. Die Wirkung der Karte (Geld, Zielfeld …) steht allein in data.js.
export function cardText(deck, index, { theme = DEFAULT_THEME, registry = active } = {}) {
  return registry.get(theme)?.cards?.[deck]?.[index] ?? (deck === 'event' ? EVENTS : CHEST)[index].text;
}
