// Webserver + Echtzeit-Verbindung. Der Server ist Geber und Schiedsrichter.
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { randomInt } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Room } from './room.js';
import {
  COOKIE, loadSecret, createAuth, parseCookies, cookieHeader, limiter, bucket,
  securityHeaders, sameOrigin, clientIp, safeNext,
} from './security.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || join(__dirname, '..', 'data');
const SAVE_FILE = join(DATA_DIR, 'rooms.json');
const MAX_ROOMS = Number(process.env.MAX_ROOMS || 50);
const ROOM_TTL_MIN = 30; // leere Tische werden nach 30 Minuten geschlossen

const PUBLIC_DIR = join(__dirname, '..', 'public');
const SITE_PASSWORD = process.env.SITE_PASSWORD || '';
const TRUST_PROXY = ['1', 'true', 'yes'].includes(String(process.env.TRUST_PROXY || '').toLowerCase());
const MAX_CONN_PER_IP = Number(process.env.MAX_CONN_PER_IP || 30);

const auth = createAuth({ password: SITE_PASSWORD, secret: loadSecret(DATA_DIR) });
if (!auth.enabled) console.warn('⚠ Kein SITE_PASSWORD gesetzt – jeder mit dem Link kommt auf die Seite. Für den Server unbedingt setzen!');

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
const loginTpl = readFileSync(join(__dirname, 'login.html'), 'utf8');
const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function renderLogin(res, status, error, next) {
  res.status(status).type('html').setHeader('Cache-Control', 'no-store');
  res.send(loginTpl.replace('{{ERROR}}', escHtml(error)).replace('{{NEXT}}', escHtml(safeNext(next))));
}

app.get('/login', (req, res) => {
  if (!auth.enabled || loggedIn(req)) return res.redirect(safeNext(req.query.next));
  renderLogin(res, 200, '', req.query.next);
});
app.post('/login', express.urlencoded({ extended: false, limit: '2kb' }), (req, res) => {
  if (!auth.enabled) return res.redirect(303, '/');
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

// Alles ab hier nur mit gültigem Cookie. Offen bleibt nur, was die Login-Seite braucht.
const OPEN = new Set(['/style.css', '/fonts/bricolage.woff2']);
app.use((req, res, next) => {
  if (!auth.enabled || OPEN.has(req.path)) return next();
  if (loggedIn(req)) {
    // Bei jedem Besuch verlängern – wer regelmäßig spielt, muss nie wieder ein Passwort eingeben
    if (req.method === 'GET' && (req.path === '/' || req.path === '/index.html')) {
      res.setHeader('Set-Cookie', cookieHeader(auth.issue(), { secure: isSecure(req) }));
    }
    return next();
  }
  if (req.method === 'GET' && !req.path.includes('.') && req.path !== '/me') {
    return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
  }
  res.status(401).json({ error: 'Nicht angemeldet' });
});
app.get('/me', (_req, res) => res.json({ ok: true }));
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));
app.use((_req, res) => res.status(404).send('Nicht gefunden'));

const http = createServer(app);
const io = new Server(http, {
  pingInterval: 10000,
  pingTimeout: 8000,
  maxHttpBufferSize: 16 * 1024, // keine großen Pakete
  allowRequest: (req, cb) => {
    if (!sameOrigin(req)) return cb('Fremde Herkunft', false);
    if (!auth.valid(parseCookies(req.headers.cookie)[COOKIE])) return cb('Nicht angemeldet', false);
    const ip = clientIp(req, TRUST_PROXY);
    if ((connections.get(ip) || 0) >= MAX_CONN_PER_IP) return cb('Zu viele Verbindungen', false);
    cb(null, true);
  },
});

/** @type {Map<string, Room>} */
const rooms = new Map();

// ---------- Speichern ----------
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      mkdirSync(DATA_DIR, { recursive: true });
      // Nur Tische ohne laufende Hand haben einen sauberen Chipstand – alle anderen bleiben beim letzten Stand
      for (const r of rooms.values()) if (!r.handRunning) r.lastSnapshot = r.snapshot();
      const data = [...rooms.values()].map((r) => r.lastSnapshot).filter(Boolean);
      writeFileSync(SAVE_FILE + '.tmp', JSON.stringify(data));
      renameSync(SAVE_FILE + '.tmp', SAVE_FILE);
    } catch (e) { console.error('Speichern fehlgeschlagen:', e.message); }
  }, 300);
}

function load() {
  if (!existsSync(SAVE_FILE)) return;
  try {
    for (const d of JSON.parse(readFileSync(SAVE_FILE, 'utf8'))) {
      const r = Room.restore(d, (kind) => onRoomChange(r, kind));
      r.lastSnapshot = d;
      rooms.set(r.code, r);
    }
    console.log(`${rooms.size} Tisch(e) wiederhergestellt`);
  } catch (e) { console.error('Laden fehlgeschlagen:', e.message); }
}

function onRoomChange(room, kind) {
  if (kind === 'handDone') save();
  broadcast(room);
}

// ---------- Hilfen ----------
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() {
  let code;
  do { code = Array.from({ length: 5 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join(''); } while (rooms.has(code));
  return code;
}

function broadcast(room) {
  for (const p of room.players.values()) {
    if (p.socketId) io.to(p.socketId).emit('state', room.view(p.id));
  }
}

function getRoom(code) {
  const r = rooms.get(String(code || '').toUpperCase().trim());
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
        if (r) { r.afterChange(); broadcast(r); if (!r.handRunning) save(); }
        cb({ ok: true, ...(res?.reply || {}) });
      } catch (e) {
        cb({ ok: false, error: e.message });
      }
    });
  };

  on('create', ({ name, avatar, settings }) => {
    if (rooms.size >= MAX_ROOMS) throw new Error('Gerade sind zu viele Tische offen');
    if (!limits.create.hit(ip)) throw new Error('Du hast gerade sehr viele Tische erstellt. Warte ein paar Minuten.');
    const code = newCode();
    const room = new Room(code, settings, (kind) => onRoomChange(room, kind));
    const p = room.addPlayer(name, avatar);
    rooms.set(code, room);
    attach(socket, room, p);
    return { room, reply: { code, token: p.token } };
  }, { needRoom: false });

  on('join', ({ code, name, avatar, token }) => {
    if (limits.badCode.blocked(ip)) throw new Error('Zu viele falsche Codes. Warte ein paar Minuten.');
    let room;
    try { room = getRoom(code); } catch (e) { limits.badCode.hit(ip); throw e; }
    let p = typeof token === 'string' && token ? room.byToken(token) : null;
    if (p) room.say(`${p.name} ist wieder online`);
    else {
      if (limits.newPlayer.blocked(ip)) throw new Error('Zu viele neue Namen von deinem Anschluss. Warte ein paar Minuten.');
      p = room.addPlayer(name, avatar);
      limits.newPlayer.hit(ip);
    }
    attach(socket, room, p);
    return { room, reply: { code: room.code, token: p.token } };
  }, { needRoom: false });

  on('sit', ({ seat }, room, p) => room.sit(p.id, Number(seat)));
  on('stand', (_d, room, p) => room.stand(p.id));
  on('sitOut', ({ value }, room, p) => room.setSittingOut(p.id, !!value));
  on('rebuy', (_d, room, p) => room.rebuy(p.id));
  on('show', (_d, room, p) => room.show(p.id));
  on('action', (action, room, p) => {
    room.act(p.id, { type: String(action.type), amount: action.amount, id: String(action.id || '').slice(0, 40) || undefined });
  });

  // Host
  on('start', (_d, room, p) => room.start(p.id));
  on('pause', (_d, room, p) => room.togglePause(p.id));
  on('nextHand', (_d, room, p) => room.nextHand(p.id));
  on('settings', (s, room, p) => room.updateSettings(p.id, s));
  on('kick', ({ id }, room, p) => { room.requireHost(p.id); if (id === p.id) throw new Error('Du kannst dich nicht selbst entfernen'); const target = room.players.get(id); room.remove(id); if (target?.socketId && !room.players.has(id)) io.to(target.socketId).emit('kicked'); });
  on('adjust', ({ id, amount }, room, p) => room.adjustStack(p.id, id, amount));
  on('makeHost', ({ id }, room, p) => { room.requireHost(p.id); const t = room.players.get(id); if (!t) throw new Error('Spieler nicht gefunden'); room.hostId = id; room.say(`${t.name} ist jetzt Host`); });

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

// Leere Tische aufräumen
setInterval(() => {
  let changed = false;
  for (const [code, r] of rooms) {
    const anyone = [...r.players.values()].some((p) => p.connected);
    if (!anyone && Date.now() - r.lastActivity > ROOM_TTL_MIN * 60000) {
      clearTimeout(r.turnTimer); clearTimeout(r.nextTimer);
      rooms.delete(code); changed = true;
    }
  }
  if (changed) save();
}, 60000).unref();

// Ein Fehler in einem Handler soll nicht alle laufenden Tische mitreißen
process.on('uncaughtException', (e) => console.error('Unerwarteter Fehler:', e));
process.on('unhandledRejection', (e) => console.error('Unerwarteter Fehler:', e));

load();
http.listen(PORT, () => console.log(`Pokerabend läuft auf http://localhost:${PORT}`));

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    for (const r of rooms.values()) if (!r.handRunning) r.lastSnapshot = r.snapshot();
    try {
      mkdirSync(DATA_DIR, { recursive: true });
      writeFileSync(SAVE_FILE, JSON.stringify([...rooms.values()].map((r) => r.lastSnapshot).filter(Boolean)));
    } catch { /* egal */ }
    process.exit(0);
  });
}

export { app, http, rooms };
