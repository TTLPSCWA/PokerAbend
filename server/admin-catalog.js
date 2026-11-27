// ADMIN-GAMES-01/02: Übersicht aller Seiten und Endpunkte für die Adminseite. Nur Pfade, Methoden und Schutzstufen – keine Werte,
// keine Geheimnisse, keine Antwortdaten. Die Routen werden zur Laufzeit aus dem Express-4-Router gelesen (app._router.stack),
// einschließlich verschachtelter Router. Router, die nur über eine Weiterleitung eingebunden sind, werden über `mounts` übergeben.
//
// Zugriffsschutz wird nicht aus dem Pfad geraten, sondern aus der tatsächlichen Middleware-Kette abgeleitet:
//   siteAccessGate        – Seitenzugang (Gruppenpasswort oder Discord), liegt vor der Route im selben Stapel
//   requireDiscordModules – aktive Discord-Sitzung bei eingeschalteter Exklusivität
//   adminGuarded          – Handler der Admin-API (Admin-Anmeldung)
// Wo keines davon nachweisbar ist, lautet die Aussage „Schutzprüfung erforderlich“.
import { readdirSync } from 'node:fs';

const HUB_PAGES = [['start', 'Start'], ['spiele', 'Spielebibliothek'], ['favoriten', 'Favoriten'], ['tische', 'Offene Tische'], ['bestenliste', 'Bestenliste'], ['roadmap', 'Roadmap'], ['tickets', 'Tickets'], ['rueckblick', 'Abend-Rückblick'], ['planung', 'Abend planen'], ['erfolge', 'Erfolge'], ['solo', 'Einzelspieler'], ['idle', 'Idle'], ['einstellungen', 'Einstellungen']];
const DISCORD_PAGES = new Set(['bestenliste', 'tickets', 'rueckblick', 'planung']);
const HIDDEN_CHAIN = new Set(['query', 'expressInit', 'jsonParser', 'urlencodedParser', 'corsMiddleware', 'serveStatic', 'bound dispatch']);

// Beschreibungen nach Pfad (erste Übereinstimmung). Reine Anzeige – ändert nichts am Schutz.
const DESCRIPTIONS = [
  [/^\/me$/, 'Konto, Spielliste und Einstellungen des angemeldeten Geräts'],
  [/^\/api\/me(\/|$)/, 'Eigenes Konto: Daten, Export, Löschen'],
  [/^\/api\/profile(\/|$)/, 'Profil und Sichtbarkeit'],
  [/^\/api\/identity(\/|$)/, 'Identität, Game-ID, Altnamen'],
  [/^\/api\/idle(\/|$)/, 'Idle-Spiele: Spielstand und Aktionen'],
  [/^\/api\/plans(\/|$)/, 'Abendplanung'],
  [/^\/api\/tickets(\/|$)/, 'Tickets (Wünsche und Fehler)'],
  [/^\/api\/evenings(\/|$)/, 'Abend-Rückblicke'],
  [/^\/api\/leaderboard(\/|$)/, 'Bestenliste'],
  [/^\/api\/ranked(\/|$)/, 'Ranked-Wertung'],
  [/^\/api\/achievements(\/|$)/, 'Erfolge'],
  [/^\/api\/roadmap$|^\/roadmap$/, 'Öffentliche Roadmap'],
  [/^\/api\/whats-new$/, 'Was ist neu'],
  [/^\/api\/discord-access$/, 'Status des Discord-Zugangs'],
  [/^\/auth\/discord(\/|$)/, 'Discord-Anmeldung'],
  [/^\/admin\/api\/features(\/|$)/, 'Admin: Funktionen und Spiele'],
  [/^\/admin\/api\/(leaderboard|rounds)(\/|$)/, 'Admin: Bestenliste und Runden'],
  [/^\/admin\/api\/players(\/|$)/, 'Admin: Spielerverwaltung'],
  [/^\/admin\/api\/tickets(\/|$)/, 'Admin: Tickets'],
  [/^\/admin\/api\/reviews(\/|$)/, 'Admin: Rückblicke'],
  [/^\/admin\/api\/meme-packs(\/|$)/, 'Admin: Meme-Pakete'],
  [/^\/admin(\/|$)/, 'Adminbereich'],
  [/^\/(health|healthz)$/, 'Gesundheitsprüfung'],
  [/^\/(login|logout)$/, 'Anmeldung mit Gruppenpasswort'],
];
const describePath = (path) => DESCRIPTIONS.find(([re]) => re.test(path))?.[1] || '';
const mountOf = (layer) => {
  if (layer.regexp?.fast_slash) return '';
  return (layer.regexp?.source || '').replace('^', '').replace('\\/?(?=\\/|$)', '').replace(/\\\//g, '/').replace(/\(\?:\(\[\^\/\]\+\?\)\)/g, ':param');
};
const nameOf = (fn) => (typeof fn === 'function' ? fn.name || '' : '');

function walk(stack, prefix, gates, ctx, out) {
  const local = [...gates];
  for (const layer of stack || []) {
    if (layer.route) {
      const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
      const handlers = layer.route.stack.map((l) => nameOf(l.handle));
      for (const p of paths) {
        if (typeof p !== 'string') continue;
        const path = (prefix + p).replace(/\/+/g, '/').replace(/(.)\/$/, '$1');
        for (const m of Object.keys(layer.route.methods)) if (m !== '_all') out.push({ method: m.toUpperCase(), path, chain: [...local.filter((g) => g.mount === '' || path === g.mount || path.startsWith(g.mount + '/')).map((g) => g.name), ...handlers] });
      }
    } else if (layer.name === 'router' && layer.handle?.stack) {
      walk(layer.handle.stack, prefix + mountOf(layer), local, ctx, out);
    } else {
      const mount = prefix + mountOf(layer), name = nameOf(layer.handle);
      const extra = ctx.mounts.find(([path]) => path === mount);
      if (extra?.[1]?.stack && !ctx.seen.has(extra[1])) { ctx.seen.add(extra[1]); walk(extra[1].stack, mount, local, ctx, out); continue; }
      if (name === 'serveStatic') { ctx.static.push({ mount: mount || '/', gates: local.map((g) => g.name) }); continue; }
      if (name && !HIDDEN_CHAIN.has(name)) local.push({ mount, name });
    }
  }
}

export function protectionOf(path, chain, openPaths = []) {
  if (openPaths.includes(path) && !chain.includes('adminGuarded')) return { level: 'open', text: 'öffentlich (die Login-Seite braucht sie)' };
  if (path.startsWith('/admin/api/') && !chain.includes('adminGuarded') && !/^\/admin\/api\/(login|logout)$/.test(path)) return { level: 'unknown', text: 'Seitenzugang; die Admin-Prüfung dieses Handlers ist nicht automatisch nachweisbar – Schutzprüfung erforderlich' };
  const parts = [];
  if (chain.includes('adminGuarded')) parts.push('Admin-Anmeldung (im Handler geprüft)');
  if (chain.includes('siteAccessGate')) parts.push('Seitenzugang (Gruppenpasswort oder Discord)');
  if (chain.includes('requireDiscordModules')) parts.push('Discord-Sitzung bei Exklusivität');
  if (parts.length) return { level: 'checked', text: parts.join(' + ') };
  return { level: 'unknown', text: 'Schutzprüfung erforderlich (keine bekannte Prüfung in der Middleware-Kette)' };
}

const groupOf = (path) => path.startsWith('/admin') ? 'Administration' : path.startsWith('/auth') ? 'Anmeldung' : path.startsWith('/api/idle') ? 'Idle-Spiele' : /^\/api\/(ranked|leaderboard|achievements)/.test(path) ? 'Spiele & Wertung' : /^\/api\/(plans|tickets|evenings|roadmap|whats-new)/.test(path) || path === '/roadmap' ? 'Gemeinschaft' : /^\/(api\/)?(me|profile|identity)/.test(path) || path.startsWith('/api/identity') || path.startsWith('/api/profile') ? 'Konto & Profil' : path.startsWith('/api') ? 'APIs' : 'System';
const GROUP_ORDER = ['Konto & Profil', 'Spiele & Wertung', 'Idle-Spiele', 'Gemeinschaft', 'APIs', 'Anmeldung', 'Administration', 'System'];

/** Idempotente, nebenwirkungsfreie GET-Seiten, die sich ohne Gefahr öffnen lassen */
const SAFE_LINKS = new Set(['/roadmap', '/health']);

export function buildCatalog({ app, publicDir, categories = [], mounts = [], openPaths = [], extraRoutes = [] }) {
  const pages = [{ group: 'Seiten', title: 'Startseite', path: '/', link: true, protection: 'Seitenzugang (Gruppenpasswort oder Discord)' }];
  for (const [id, title] of HUB_PAGES) pages.push({ group: 'Seiten', title, path: `/#${id}`, link: true, protection: DISCORD_PAGES.has(id) ? 'Seitenzugang + Discord-Sitzung bei Exklusivität (Client und Server)' : 'Seitenzugang (Gruppenpasswort oder Discord)' });
  for (const [id, title] of categories) pages.push({ group: 'Spiele', title: `Kategorie ${title}`, path: `/#spiele/${id}`, link: true, protection: 'Seitenzugang (Gruppenpasswort oder Discord)' });
  try { for (const f of readdirSync(publicDir).filter((n) => n.endsWith('.html') && n !== 'index.html').sort()) pages.push({ group: 'Seiten', title: f, path: '/' + f.replace(/\.html$/, ''), link: true, protection: 'siehe Endpunktliste' }); } catch { /* optional */ }
  pages.push({ group: 'Administration', title: 'Adminseite', path: '/admin', link: true, protection: 'Admin-Anmeldung (Login auf der Seite)' });

  const ctx = { mounts, static: [], seen: new Set() }, found = [];
  walk(app?._router?.stack, '', [], ctx, found);
  const seen = new Set(), endpoints = [];
  for (const e of found) {
    const key = `${e.method} ${e.path}`;
    if (seen.has(key) || !e.path.startsWith('/') || e.path === '/*') continue;
    seen.add(key);
    const changes = !['GET', 'HEAD'].includes(e.method);
    const prot = protectionOf(e.path, e.chain, openPaths);
    endpoints.push({ group: groupOf(e.path), title: describePath(e.path) || e.path, method: e.method, path: e.path, protection: prot.text, level: prot.level, changes, link: !changes && SAFE_LINKS.has(e.path) && !e.path.includes(':') });
  }
  for (const r of extraRoutes) if (!seen.has(`${r.method} ${r.path}`)) endpoints.push({ group: groupOf(r.path), title: r.title || r.path, method: r.method, path: r.path, protection: r.protection || 'Schutzprüfung erforderlich', level: 'unknown', changes: r.method !== 'GET', link: false });
  for (const s of ctx.static) endpoints.push({ group: 'System', title: 'Statische Dateien (public/)', method: 'GET', path: s.mount === '/' ? '/*' : s.mount + '/*', protection: s.gates.includes('siteAccessGate') ? 'Seitenzugang; nur die Login-Dateien sind offen' : 'Schutzprüfung erforderlich', level: s.gates.includes('siteAccessGate') ? 'checked' : 'unknown', changes: false, link: false });
  endpoints.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || a.path.localeCompare(b.path, 'de') || a.method.localeCompare(b.method));
  return { pages, endpoints, note: 'Nur Seiten (und wenige geprüfte lesende Aufrufe) sind anklickbar. API-Routen werden hier nie ausgeführt. Der Schutz stammt aus der Middleware-Kette; fehlt ein Nachweis, steht „Schutzprüfung erforderlich“.' };
}
