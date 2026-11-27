// Zentrale A–Z-Sortierung für Spielelisten (deutsche Sortierung, Zahlen numerisch). Gilt innerhalb einer Kategorie.
export const gameCollator = new Intl.Collator('de', { sensitivity: 'base', numeric: true });
export const CATEGORY_ORDER = ['karten', 'wuerfel', 'brett', 'party', 'einzelspieler', 'idle'];
export const CATEGORY_LABELS = { karten: 'Karten', wuerfel: 'Würfel', brett: 'Brett', party: 'Party', einzelspieler: 'Einzelspieler', idle: 'Idle' };
export const byName = (a, b) => gameCollator.compare(a.name || a.id, b.name || b.id) || gameCollator.compare(a.id, b.id);
const rank = (c) => { const i = CATEGORY_ORDER.indexOf(c || 'karten'); return i < 0 ? CATEGORY_ORDER.length : i; };
/** Kategorie in fester Reihenfolge, darin A–Z */
export const sortGames = (list) => [...list].sort((a, b) => rank(a.category) - rank(b.category) || byName(a, b));
