// Webserver + Echtzeit-Verbindung – die gemeinsame Plattform für alle Spiele: Login, Lobby, Raumcodes,
// Spielerverwaltung, Reconnect, Speichern, Verlauf und Sicherheit. Die Spiele selbst liegen in games/.
import './env.js'; // .env zuerst einlesen – alles danach liest process.env
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAMES, DEFAULT_GAME, gameList, gameEvents } from '../games/index.js';
import {
  COOKIE, loadSecret, createAuth, parseCookies, cookieHeader, limiter, bucket,
  securityHeaders, sameOrigin, clientIp, safeNext,
} from './security.js';
import { createCodes, normalize } from './codes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || join(__dirname, '..', 'data');
const SAVE_FILE = join(DATA_DIR, 'rooms.json');
const MAX_ROOMS = Number(process.env.MAX_ROOMS || 50);
const ROOM_TTL_MIN = 30; // Notbremse: Tische ohne Verbindung werden spätestens nach 30 Minuten geschlossen
const AWAY_MIN = Number(process.env.PLAYER_TIMEOUT_MIN || 5); // wer so lange offline ist, fliegt raus

const PUBLIC_DIR = join(__dirname, '..', 'public');
const SITE_PASSWORD = process.env.SITE_PASSWORD || '';
const TRUST_PROXY = ['1', 'true', 'yes'].includes(String(process.env.TRUST_PROXY || '').toLowerCase());
const MAX_CONN_PER_IP = Number(process.env.MAX_CONN_PER_IP || 30);

// Anmeldung: Seitenpasswort (SITE_PASSWORD), ohne Passwort offen (nur lokal zum Testen)
const MODE = SITE_PASSWORD ? 'password' : 'open';
const SECRET = loadSecret(DATA_DIR);
const auth = createAuth({ password: SITE_PASSWORD, secret: SECRET });
if (MODE === 'password') console.log('Anmeldung: Seitenpasswort');
else console.warn('⚠ Kein SITE_PASSWORD eingerichtet – jeder mit dem Link kommt auf die Seite. Nur lokal zum Testen!');

// Grenzen gegen Raten und Spam (pro IP)
const limits = {
  login: limiter({ windowMs: 15 * 60e3, max: 8 }),     // falsche Passwörter
  create: limiter({ windowMs: 10 * 60e3, max: 6 }),    // neue Tische
  badCode: limiter({ windowMs: 10 * 60e3, max: 20 }),  // falsche Tisch-Codes
  newPlayer: limiter({ windowMs: 10 * 60e3, max: 15 }), // neue Namen
};
const connections = new Map(); // IP → offene Verbindungen

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', TRUST_PROXY);
app.use(securityHeaders);
app.get('/health', (_req, res) => res.json({ ok: true }));

const isSecure = (req) => req.secure || (TRUST_PROXY && req.headers['x-forwarded-proto'] === 'https');
const loggedIn = (req) => auth.valid(parseCookies(req.headers.cookie)[COOKIE]);
const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const loginTpl = readFileSync(join(__dirname, 'login.html'), 'utf8');
function renderLogin(res, status, error, next) {
  res.status(status).type('html').setHeader('Cache-Control', 'no-store');
  const n = safeNext(next);
  res.send(loginTpl.replace('{{ERROR}}', escHtml(error)).replace('{{NEXT}}', escHtml(n)));
}

// ---------- Anmelde-Routen ----------
app.get('/login', (req, res) => {
  if (MODE === 'open' || loggedIn(req)) return res.redirect(safeNext(req.query.next));
  renderLogin(res, 200, '', req.query.next);
});
app.post('/login', express.urlencoded({ extended: false, limit: '2kb' }), (req, res) => {
  if (MODE !== 'password') return res.redirect(303, '/');
  const ip = clientIp(req, TRUST_PROXY);
  const next = req.body?.next;
  if (limits.login.blocked(ip)) {
    const wait = limits.login.retryAfter(ip);
    res.setHeader('Retry-After', wait);
    return renderLogin(res, 429, `Zu viele Versuche. Probier es in ${Math.ceil(wait / 60)} Minuten nochmal.`, next);
  }
  if (!auth.checkPassword(req.body?.password)) {
    limits.login.hit(ip);
    return renderLogin(res, 401, 'Das Passwort stimmt nicht.', next);
  }
  limits.login.reset(ip);
  res.setHeader('Set-Cookie', cookieHeader(auth.issue(), { secure: isSecure(req) }));
  res.redirect(303, safeNext(next));
});

app.post('/logout', (req, res) => {
  res.setHeader('Set-Cookie', cookieHeader('', { secure: isSecure(req), maxAgeDays: 0 }));
  res.redirect(303, '/login');
});

// Alles ab hier nur angemeldet. Offen bleibt nur, was die Login-Seite braucht.
const OPEN = new Set(['/style.css', '/fonts/bricolage.woff2']);
const isPage = (req) => req.method === 'GET' && (req.path === '/' || req.path === '/index.html');
app.use((req, res, next) => {
  if (MODE === 'open' || OPEN.has(req.path)) return next();
  if (loggedIn(req)) {
    // Bei jedem Seitenaufruf verlängern – wer regelmäßig spielt, muss nie neu eingeben
    if (isPage(req)) res.setHeader('Set-Cookie', cookieHeader(auth.issue(), { secure: isSecure(req) }));
    return next();
  }
  if (req.method === 'GET' && !req.path.includes('.') && req.path !== '/me') {
    return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
  }
  res.status(401).json({ error: 'Nicht angemeldet' });
});
app.get('/me', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ mode: MODE, games: gameList() });
});
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));
app.use((_req, res) => res.status(404).send('Nicht gefunden'));

const http = createServer(app);
const io = new Server(http, {
  pingInterval: 10000,
  pingTimeout: 8000,
  maxHttpBufferSize: 16 * 1024, // keine großen Pakete
  allowRequest: (req, cb) => {
    if (!sameOrigin(req)) return cb('Fremde Herkunft', false);
    const ip = clientIp(req, TRUST_PROXY);
    if ((connections.get(ip) || 0) >= MAX_CONN_PER_IP) return cb('Zu viele Verbindungen', false);
    if (!auth.valid(parseCookies(req.headers.cookie)[COOKIE])) return cb('Nicht angemeldet', false);
    cb(null, true);
  },
});

/** @type {Map<string, import('./base-room.js').BaseRoom>} */
const rooms = new Map();
const codes = createCodes(); // gemeinsam für alle Spiele

// ---------- Speichern ----------
// Verlauf pro Tisch in eigener Datei – der Spielstand bleibt klein, der Verlauf wird nur bei Änderungen geschrieben
const historyFile = (code) => join(DATA_DIR, `history-${code}.json`); // Codes bestehen nur aus A–Z und 2–9
function saveHistory(r) {
  if (!r.historyDirty) return;
  writeFileSync(historyFile(r.code) + '.tmp', JSON.stringify(r.log));
  renameSync(historyFile(r.code) + '.tmp', historyFile(r.code));
  r.historyDirty = false;
}
function dropHistory(code) { try { unlinkSync(historyFile(code)); } catch { /* gab keine */ } }
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      mkdirSync(DATA_DIR, { recursive: true });
      // Nur Räume ohne laufende Runde haben einen sauberen Stand – alle anderen bleiben beim letzten Stand
      for (const r of rooms.values()) if (!r.busy) r.lastSnapshot = snapshotOf(r);
      const data = [...rooms.values()].map((r) => r.lastSnapshot).filter(Boolean);
      writeFileSync(SAVE_FILE + '.tmp', JSON.stringify(data));
      renameSync(SAVE_FILE + '.tmp', SAVE_FILE);
      for (const r of rooms.values()) saveHistory(r);
    } catch (e) { console.error('Speichern fehlgeschlagen:', e.message); }
  }, 300);
}

function load() {
  if (!existsSync(SAVE_FILE)) return;
  try {
    for (const d of JSON.parse(readFileSync(SAVE_FILE, 'utf8'))) {
      const game = GAMES[d.game || DEFAULT_GAME];
      if (!game) { console.error(`Raum ${d.code}: unbekanntes Spiel ${d.game}`); continue; }
      if (!codes.claim(d.code, game.id)) continue; // doppelter Code in der Datei: zweiten Raum nicht laden
      const r = game.restore(d, (kind, data) => onRoomChange(r, kind, data));
      r.game = game.id;
      r.lastSnapshot = d;
      if (existsSync(historyFile(r.code))) {
        try { r.loadHistory(JSON.parse(readFileSync(historyFile(r.code), 'utf8'))); r.say('Server neu gestartet – Host startet weiter'); }
        catch (e) { console.error(`Verlauf ${r.code} nicht lesbar:`, e.message); }
      }
      rooms.set(r.code, r);
    }
    console.log(`${rooms.size} Tisch(e) wiederhergestellt`);
  } catch (e) { console.error('Laden fehlgeschlagen:', e.message); }
}

// Meldungen eines Raums: mit data.to nur an diesen Spieler (z. B. Anstupsen), sonst alle neu zeichnen
function onRoomChange(room, kind, data) {
  if (data?.to) {
    const p = room.players.get(data.to);
    const { to, ...rest } = data;
    if (p?.socketId) io.to(p.socketId).emit(kind, rest);
    return;
  }
  if (kind === 'handDone') save();
  broadcast(room);
}
const snapshotOf = (r) => ({ ...r.snapshot(), game: r.game, code: r.code });

// ---------- Hilfen ----------
function broadcast(room) {
  for (const p of room.players.values()) {
    if (p.socketId) io.to(p.socketId).emit('state', room.view(p.id));
  }
}

function getRoom(code) {
  const r = rooms.get(normalize(code));
  if (!r) throw new Error('Diesen Tisch gibt es nicht (mehr). Prüf den Code.');
  return r;
}

function attach(socket, room, player) {
  if (player.socketId && player.socketId !== socket.id) {
    // Zweiter Tab: nur die neueste Verbindung darf spielen
    io.to(player.socketId).emit('replaced');
    io.sockets.sockets.get(player.socketId)?.disconnect(true);
  }
  player.socketId = socket.id;
  player.connected = true;
  socket.data.code = room.code;
  socket.data.playerId = player.id;
  socket.join(room.code);
}

// ---------- Socket-Ereignisse ----------
io.on('connection', (socket) => {
  const ip = clientIp(socket.request, TRUST_PROXY);
  connections.set(ip, (connections.get(ip) || 0) + 1);
  socket.on('disconnect', () => {
    const n = (connections.get(ip) || 1) - 1;
    if (n <= 0) connections.delete(ip); else connections.set(ip, n);
  });

  // Event-Flut bremsen: kurz 40 Nachrichten, dauerhaft 8 pro Sekunde
  const allow = bucket({ capacity: 40, perSecond: 8 });
  let strikes = 0;
  socket.use((packet, next) => {
    if (allow()) return next();
    const cb = packet[packet.length - 1];
    if (typeof cb === 'function') cb({ ok: false, error: 'Langsam – zu viele Anfragen' });
    if (++strikes > 100) socket.disconnect(true);
    next(new Error('rate'));
  });
  socket.on('error', () => { /* abgelehnte Pakete – nichts zu tun */ });

  // Jeder Handler: Fehler gehen als Antwort an den Spieler, danach bekommen alle den neuen Stand
  const on = (event, fn, { needRoom = true } = {}) => {
    socket.on(event, (payload = {}, cb = () => {}) => {
      if (typeof cb !== 'function') cb = () => {};
      try {
        let room = null; let player = null;
        if (needRoom) {
          room = rooms.get(socket.data.code);
          player = room?.players.get(socket.data.playerId);
          if (!room || !player) throw new Error('Du bist an keinem Tisch');
        }
        const res = fn(payload || {}, room, player);
        const r = res?.room || room;
        if (r) { r.afterChange(); broadcast(r); if (!r.busy) save(); }
        cb({ ok: true, ...(res?.reply || {}) });
      } catch (e) {
        cb({ ok: false, error: e.message });
      }
    });
  };

  on('create', ({ game: gameId = DEFAULT_GAME, name, avatar, settings }) => {
    const game = GAMES[gameId];
    if (!game) throw new Error('Dieses Spiel gibt es nicht');
    if (rooms.size >= MAX_ROOMS) throw new Error('Gerade sind zu viele Tische offen');
    if (!limits.create.hit(ip)) throw new Error('Du hast gerade sehr viele Tische erstellt. Warte ein paar Minuten.');
    const code = codes.take(game.id);
    let room, p;
    try {
      room = game.create(code, settings, (kind, data) => onRoomChange(room, kind, data));
      room.game = game.id;
      p = room.addPlayer(name, avatar);
    } catch (e) { codes.release(code); throw e; }
    rooms.set(code, room);
    attach(socket, room, p);
    return { room, reply: { code, token: p.token, game: game.id } };
  }, { needRoom: false });

  on('join', ({ code, name, avatar, token }) => {
    if (limits.badCode.blocked(ip)) throw new Error('Zu viele falsche Codes. Warte ein paar Minuten.');
    let room;
    try { room = getRoom(code); } catch (e) { limits.badCode.hit(ip); throw e; }
    // Wiedererkennung über das Token aus dem Browser (localStorage)
    let p = typeof token === 'string' && token ? room.byToken(token) : null;
    if (p) {
      if (!p.connected) room.say(`${p.name} ist wieder online`);
    } else {
      if (limits.newPlayer.blocked(ip)) throw new Error('Zu viele neue Namen von deinem Anschluss. Warte ein paar Minuten.');
      p = room.addPlayer(name, avatar);
      limits.newPlayer.hit(ip);
    }
    attach(socket, room, p);
    return { room, reply: { code: room.code, token: p.token, game: room.game } };
  }, { needRoom: false });

  // Ereignisse der Spiele: jedes Spiel bekommt nur seine eigenen
  for (const event of gameEvents()) {
    on(event, (d, room, p) => {
      const fn = GAMES[room.game]?.events[event];
      if (!fn) throw new Error('Das gibt es in diesem Spiel nicht');
      return fn(room, p, d && typeof d === 'object' ? d : {});
    });
  }

  // Für alle Spiele gleich: Host-Rechte
  on('kick', ({ id }, room, p) => { room.requireHost(p.id); if (id === p.id) throw new Error('Du kannst dich nicht selbst entfernen'); const target = room.players.get(id); room.remove(id); if (target?.socketId && !room.players.has(id)) io.to(target.socketId).emit('kicked'); });
  on('makeHost', ({ id }, room, p) => { room.requireHost(p.id); const t = room.players.get(id); if (!t) throw new Error('Spieler nicht gefunden'); room.hostId = id; room.say(`${t.name} ist jetzt Host`); });

  // Ganzer Verlauf auf Anfrage (nicht in jedem Update – der kann lang werden). Ohne Neuzeichnen für alle.
  socket.on('history', (data, cb) => {
    if (typeof cb !== 'function') return;
    const room = rooms.get(socket.data.code);
    if (!room?.players.get(socket.data.playerId)) return cb({ ok: false, error: 'Du bist an keinem Tisch' });
    cb({ ok: true, entries: room.historyAfter(data?.after), seq: room.logSeq });
  });

  // Kleine Reaktionen am Tisch
  const REACTIONS = ['👍', '😂', '😮', '😬', '🔥', '🙈', 'GG', 'Nice Hand', 'Glück gehabt', 'Respekt'];
  let lastReaction = 0;
  socket.on('react', (data) => {
    const text = data?.text;
    const room = rooms.get(socket.data.code);
    const p = room?.players.get(socket.data.playerId);
    if (!p || !REACTIONS.includes(text) || Date.now() - lastReaction < 1500) return;
    lastReaction = Date.now();
    io.to(room.code).emit('reaction', { id: p.id, seat: p.seat, text });
    room.react(p.id, text);
    broadcast(room);
  });

  socket.on('disconnect', () => {
    const room = rooms.get(socket.data.code);
    const p = room?.players.get(socket.data.playerId);
    if (!p || p.socketId !== socket.id) return;
    p.connected = false;
    p.socketId = null;
    p.offlineSince = Date.now();
    room.say(`${p.name} ist offline`);
    room.afterChange(); // kürzerer Timer, falls er gerade dran ist
    broadcast(room);
    if (room.hostId === p.id) {
      setTimeout(() => {
        if (room.hostId === p.id && !p.connected) { room.transferHost(); broadcast(room); }
      }, 30000);
    }
  });
});

// Weggebliebene Spieler entfernen, verlassene Tische löschen
setInterval(() => {
  let changed = false;
  for (const [code, r] of rooms) {
    if (r.dropAway(AWAY_MIN * 60000)) { r.afterChange(); broadcast(r); changed = true; }
    const anyone = [...r.players.values()].some((p) => p.connected);
    if (!anyone && (r.abandoned || Date.now() - r.lastActivity > ROOM_TTL_MIN * 60000)) {
      r.dispose();
      rooms.delete(code); codes.release(code); dropHistory(code); changed = true;
    }
  }
  if (changed) save();
}, Math.max(500, Math.min(30000, (AWAY_MIN * 60000) / 4))).unref();

// Ein Fehler in einem Handler soll nicht alle laufenden Tische mitreißen
process.on('uncaughtException', (e) => console.error('Unerwarteter Fehler:', e));
process.on('unhandledRejection', (e) => console.error('Unerwarteter Fehler:', e));

// Ein Spiel darf keine Plattform-Ereignisse überschreiben
const RESERVED = ['create', 'join', 'kick', 'makeHost', 'history', 'react', 'disconnect'];
for (const g of Object.values(GAMES)) {
  const clash = Object.keys(g.events).filter((e) => RESERVED.includes(e));
  if (clash.length) throw new Error(`Spiel ${g.id}: Ereignisse ${clash.join(', ')} gehören der Plattform`);
}

load();
http.listen(PORT, () => console.log(`Pokerabend läuft auf http://localhost:${PORT}`));

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    for (const r of rooms.values()) if (!r.busy) r.lastSnapshot = snapshotOf(r);
    try {
      mkdirSync(DATA_DIR, { recursive: true });
      writeFileSync(SAVE_FILE, JSON.stringify([...rooms.values()].map((r) => r.lastSnapshot).filter(Boolean)));
      for (const r of rooms.values()) saveHistory(r);
    } catch { /* egal */ }
    process.exit(0);
  });
}

export { app, http, rooms, codes };
