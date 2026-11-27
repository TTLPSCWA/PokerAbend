// ADMIN-GAMES-01: Übersicht aller Seiten und Endpunkte für die Adminseite. Nur Pfade, Methoden und Schutzstufen – keine Werte,
// keine Geheimnisse. Die Routen werden zur Laufzeit aus dem Express-Router gelesen; anklickbar sind nur Seiten.
import { readdirSync } from 'node:fs';

const HUB_PAGES = [['start', 'Start'], ['spiele', 'Spielebibliothek'], ['favoriten', 'Favoriten'], ['tische', 'Offene Tische'], ['bestenliste', 'Bestenliste'], ['roadmap', 'Roadmap'], ['tickets', 'Tickets'], ['rueckblick', 'Abend-Rückblick'], ['planung', 'Abend planen'], ['erfolge', 'Erfolge'], ['solo', 'Einzelspieler'], ['idle', 'Idle'], ['einstellungen', 'Einstellungen']];
const DISCORD_PAGES = new Set(['bestenliste', 'tickets', 'rueckblick', 'planung']);
const DISCORD_MODULES = [/^\/api\/(tickets|plans|evenings|leaderboard|ranked)(\/|$)/, /^\/api\/identity\/(legacy|claim)(\/|$)/];
const PUBLIC_PATHS = [/^\/login$/, /^\/logout$/, /^\/auth\//, /^\/healthz?$/, /^\/admin\/api\/(login|logout|status)$/];
const DISCORD_LABEL = 'Seitenzugang + Discord-Sitzung (bei Exklusivität)';

export function protectionOf(path) {
  if (PUBLIC_PATHS.some((re) => re.test(path))) return path.startsWith('/auth/') ? 'öffentlich (Discord-Anmeldung)' : 'öffentlich';
  if (path.startsWith('/admin')) return 'Admin-Anmeldung';
  if (DISCORD_MODULES.some((re) => re.test(path))) return DISCORD_LABEL;
  return 'Seitenzugang';
}
const mountOf = (layer) => {
  if (layer.regexp?.fast_slash) return '';
  return (layer.regexp?.source || '').replace('^', '').replace('\\/?(?=\\/|$)', '').replace(/\\\//g, '/').replace(/\(\?:\(\[\^\/\]\+\?\)\)/g, ':param');
};
function walk(stack, prefix, out) {
  for (const layer of stack || []) {
    if (layer.route) {
      const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
      for (const p of paths) if (typeof p === 'string') for (const m of Object.keys(layer.route.methods)) if (m !== '_all') out.push({ method: m.toUpperCase(), path: (prefix + p).replace(/\/+/g, '/').replace(/(.)\/$/, '$1') });
    } else if (layer.name === 'router' && layer.handle?.stack) walk(layer.handle.stack, prefix + mountOf(layer), out);
  }
}
const groupOf = (path) => path.startsWith('/admin') ? 'Administration' : path.startsWith('/auth') ? 'Anmeldung' : /^\/api\/(idle|ranked|leaderboard)/.test(path) ? 'Spiele' : path.startsWith('/api') ? 'APIs' : 'System';

export function buildCatalog({ app, publicDir, categories = [] }) {
  const pages = [{ group: 'Seiten', title: 'Startseite', path: '/', link: true, protection: 'Seitenzugang' }];
  for (const [id, title] of HUB_PAGES) pages.push({ group: 'Seiten', title, path: `/#${id}`, link: true, protection: DISCORD_PAGES.has(id) ? DISCORD_LABEL : 'Seitenzugang' });
  for (const [id, title] of categories) pages.push({ group: 'Spiele', title: `Kategorie ${title}`, path: `/#spiele/${id}`, link: true, protection: 'Seitenzugang' });
  try { for (const f of readdirSync(publicDir).filter((n) => n.endsWith('.html') && n !== 'index.html').sort()) pages.push({ group: 'Seiten', title: f, path: '/' + f.replace(/\.html$/, ''), link: true, protection: 'öffentlich' }); } catch { /* optional */ }
  pages.push({ group: 'Administration', title: 'Adminseite', path: '/admin', link: true, protection: 'Admin-Anmeldung' });
  const found = [];
  walk(app?._router?.stack, '', found);
  const seen = new Set(), endpoints = [];
  for (const e of found) {
    const key = `${e.method} ${e.path}`;
    if (seen.has(key) || !e.path.startsWith('/') || e.path === '/*') continue;
    seen.add(key);
    endpoints.push({ group: groupOf(e.path), method: e.method, path: e.path, protection: protectionOf(e.path), changes: !['GET', 'HEAD'].includes(e.method), link: false });
  }
  const order = ['Spiele', 'Administration', 'APIs', 'Anmeldung', 'System'];
  endpoints.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || a.path.localeCompare(b.path, 'de') || a.method.localeCompare(b.method));
  return { pages, endpoints, note: 'Nur Seiten sind anklickbar. API-Routen werden nicht aufgerufen; die Schutzstufe ist nach dem Pfad eingeordnet.' };
}
