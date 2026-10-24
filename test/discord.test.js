// Anmeldung mit Discord – gegen einen nachgebauten Discord-Server (kein echtes Discord nötig).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { io } from 'socket.io-client';

const PORT = 4200 + Math.floor(Math.random() * 50);
const URL = `http://localhost:${PORT}`;
const GUILD = '900000000000000001';
const ROLE = '700000000000000001';
let MOCK;
let server;
let mock;

// ---------- Nachgebautes Discord ----------
// Code beim Login = Schlüssel des Testkontos
const USERS = {
  anna: { user: { id: '111111111111111111', username: 'anna_x', global_name: 'Anna Global', avatar: 'aaa111' }, member: { nick: 'Anna', avatar: 'bbb222', roles: [ROLE] } },
  anna2: { user: { id: '222222222222222222', username: 'anna_y', global_name: 'Anna', avatar: null }, member: { nick: null, avatar: null, roles: [ROLE] } },
  max: { user: { id: '333333333333333333', username: 'max', global_name: 'Max', avatar: null }, member: null },
  norole: { user: { id: '444444444444444444', username: 'nora', global_name: 'Nora', avatar: null }, member: { nick: null, roles: [] } },
  ben: { user: { id: '555555555555555555', username: 'ben', global_name: 'Ben', avatar: null }, member: { nick: 'Ben', roles: [ROLE] } },
};
const tokens = new Map(); // access_token → Konto
const left = new Set();   // Konten, die den Server verlassen haben
let tokenCount = 0;

function startMock() {
  return new Promise((res) => {
    mock = createServer(async (req, r) => {
      const u = new globalThis.URL(req.url, 'http://x');
      const json = (status, body) => { r.writeHead(status, { 'content-type': 'application/json' }); r.end(JSON.stringify(body)); };
      if (u.pathname === '/oauth2/authorize') {
        // „Zustimmen“ – mit dem Konto aus ?as=…
        const to = new globalThis.URL(u.searchParams.get('redirect_uri'));
        to.searchParams.set('code', u.searchParams.get('as') || 'anna');
        to.searchParams.set('state', u.searchParams.get('state'));
        r.writeHead(302, { location: to.toString() }); return r.end();
      }
      if (u.pathname === '/api/oauth2/token' && req.method === 'POST') {
        let body = ''; for await (const c of req) body += c;
        const f = new URLSearchParams(body);
        if (f.get('client_id') !== 'test-client' || f.get('client_secret') !== 'test-secret') return json(401, { error: 'invalid_client' });
        let key;
        if (f.get('grant_type') === 'authorization_code') {
          if (f.get('redirect_uri') !== `${URL}/auth/discord/callback`) return json(400, { error: 'invalid_grant' });
          key = f.get('code');
        } else if (f.get('grant_type') === 'refresh_token') key = (f.get('refresh_token') || '').replace(/^rt-/, '');
        if (!USERS[key]) return json(400, { error: 'invalid_grant' });
        const at = `at-${key}-${++tokenCount}`;
        tokens.set(at, key);
        return json(200, { access_token: at, refresh_token: `rt-${key}`, expires_in: 604800, token_type: 'Bearer' });
      }
      const key = tokens.get(String(req.headers.authorization || '').replace(/^Bearer /, ''));
      if (!key) return json(401, { message: '401: Unauthorized' });
      const acc = USERS[key];
      if (u.pathname === '/api/users/@me') return json(200, acc.user);
      if (u.pathname === `/api/users/@me/guilds/${GUILD}/member`) {
        if (!acc.member || left.has(key)) return json(404, { message: 'Unknown Guild', code: 10004 });
        return json(200, { ...acc.member, user: acc.user });
      }
      json(404, {});
    });
    mock.listen(0, () => { MOCK = `http://localhost:${mock.address().port}`; res(); });
  });
}

function startServer(extraEnv = {}) {
  const dataDir = mkdtempSync(join(tmpdir(), 'poker-discord-'));
  return spawn(process.execPath, ['server/index.js'], {
    env: {
      ...process.env, POKER_NO_DOTENV: '1', PORT: String(PORT), DATA_DIR: dataDir, SITE_PASSWORD: '',
      DISCORD_CLIENT_ID: 'test-client', DISCORD_CLIENT_SECRET: 'test-secret', DISCORD_GUILD_ID: GUILD, DISCORD_ROLE_ID: ROLE,
      PUBLIC_URL: URL, DISCORD_API_BASE: `${MOCK}/api`, DISCORD_AUTHORIZE_URL: `${MOCK}/oauth2/authorize`,
      DISCORD_RECHECK_HOURS: '0.0005', // ≈ 2 Sekunden statt 24 Stunden
      ...extraEnv,
    },
    stdio: 'pipe',
  });
}

before(async () => {
  await startMock();
  server = startServer();
  await new Promise((res, rej) => {
    let out = '';
    server.stdout.on('data', (d) => { out += d; if (out.includes('läuft')) res(); });
    server.on('exit', (c) => rej(new Error('Server beendet: ' + c)));
  });
});
after(() => { server.kill(); mock.close(); });

// ---------- Hilfen ----------
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 4000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return; await wait(25); }
  throw new Error('Zeitüberschreitung');
}
const cookieOf = (res, name) => res.headers.getSetCookie().find((c) => c.startsWith(name + '='));
const get = (path, cookie) => fetch(URL + path, { redirect: 'manual', headers: cookie ? { cookie } : {} });

// Kompletter Ablauf: /auth/discord → (Discord) → /auth/discord/callback
async function login(as, next = '/?t=ABCDE') {
  const start = await get('/auth/discord?next=' + encodeURIComponent(next));
  const oauth = cookieOf(start, 'pa_oauth').split(';')[0];
  const authorize = new globalThis.URL(start.headers.get('location'));
  authorize.searchParams.set('as', as);
  const consent = await fetch(authorize, { redirect: 'manual' });
  const res = await fetch(consent.headers.get('location'), { redirect: 'manual', headers: { cookie: oauth } });
  const set = cookieOf(res, 'pa_session');
  const cookie = set && !/Max-Age=0/.test(set) ? set.split(';')[0] : null;
  return { start, res, cookie, location: res.headers.get('location') };
}

function connect(cookie) {
  return new Promise((res) => {
    const s = io(URL, { transports: ['websocket'], forceNew: true, reconnection: false, extraHeaders: cookie ? { cookie } : {} });
    s.state = null; s.events = [];
    s.on('state', (st) => { s.state = st; });
    s.onAny((ev) => s.events.push(ev));
    s.ask = (ev, d = {}) => new Promise((r) => s.emit(ev, d, r));
    s.on('connect', () => res({ ok: true, s }));
    s.on('connect_error', (e) => res({ ok: false, error: e.message, s }));
  });
}

// ---------- Tests ----------
test('Ohne Anmeldung: nur die Login-Seite mit „Mit Discord anmelden“, keine Socket-Verbindung', async () => {
  const r = await get('/?t=ABCDE');
  assert.equal(r.status, 302);
  assert.match(r.headers.get('location'), /^\/login\?next=/);
  assert.equal((await get('/app.js')).status, 401);
  assert.equal((await get('/me')).status, 401);
  const page = await get('/login');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Mit Discord anmelden/);
  assert.equal((await get('/style.css')).status, 200);
  assert.match(page.headers.get('content-security-policy'), /img-src 'self' data: https:\/\/cdn\.discordapp\.com/);
  const c = await connect();
  assert.equal(c.ok, false);
  c.s.close();
  // Passwort-Login ist im Discord-Modus aus
  const pw = await fetch(URL + '/login', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'password=x' });
  assert.equal(pw.headers.get('location'), '/login');
});

test('Weiterleitung zu Discord mit den richtigen Parametern und State-Cookie', async () => {
  const r = await get('/auth/discord?next=%2F%3Ft%3DABCDE');
  assert.equal(r.status, 302);
  const to = new globalThis.URL(r.headers.get('location'));
  assert.equal(to.origin + to.pathname, `${MOCK}/oauth2/authorize`);
  assert.equal(to.searchParams.get('client_id'), 'test-client');
  assert.equal(to.searchParams.get('response_type'), 'code');
  assert.equal(to.searchParams.get('redirect_uri'), `${URL}/auth/discord/callback`);
  assert.equal(to.searchParams.get('scope'), 'identify guilds.members.read');
  assert.ok(to.searchParams.get('state').length >= 20);
  const c = cookieOf(r, 'pa_oauth');
  assert.match(c, /Path=\/auth/);
  assert.match(c, /HttpOnly/);
  assert.match(c, /SameSite=Lax/);
  assert.match(c, /Max-Age=600/);
});

test('Mitglied kommt rein: Sitzungs-Cookie, Name und Bild von Discord, zurück zum Einladungslink', async () => {
  const { res, cookie, location } = await login('anna');
  assert.equal(res.status, 302);
  assert.equal(location, '/?t=ABCDE');
  const set = cookieOf(res, 'pa_session');
  assert.match(set, /HttpOnly/);
  assert.match(set, /SameSite=Lax/);
  assert.match(set, /Max-Age=15552000/);
  const me = await (await get('/me', cookie)).json();
  assert.equal(me.mode, 'discord');
  assert.equal(me.user.name, 'Anna', 'Server-Nickname vor global_name');
  assert.equal(me.user.avatar, `https://cdn.discordapp.com/guilds/${GUILD}/users/111111111111111111/avatars/bbb222.png?size=128`);
  const page = await get('/', cookie);
  assert.equal(page.status, 200);
  assert.ok(cookieOf(page, 'pa_session'), 'Cookie wird beim Seitenaufruf verlängert');
  assert.equal((await get('/app.js', cookie)).status, 200);
});

test('Nicht-Mitglied und fehlende Rolle werden mit deutscher Meldung abgelehnt', async () => {
  const max = await login('max');
  assert.equal(max.cookie, null);
  assert.match(max.location, /^\/login\?error=not_member/);
  assert.match(await (await get(max.location)).text(), /nicht auf unserem Discord-Server/);
  const nora = await login('norole');
  assert.equal(nora.cookie, null);
  assert.match(nora.location, /^\/login\?error=role_missing/);
  assert.match(await (await get(nora.location)).text(), /fehlt auf unserem Discord-Server die Rolle/);
});

test('Abbrechen und gefälschter oder fehlender state', async () => {
  const start = await get('/auth/discord');
  const oauth = cookieOf(start, 'pa_oauth').split(';')[0];
  const state = new globalThis.URL(start.headers.get('location')).searchParams.get('state');
  const cancel = await get(`/auth/discord/callback?error=access_denied&state=${state}`, oauth);
  assert.match(cancel.headers.get('location'), /^\/login\?error=cancelled/);
  assert.match(await (await get(cancel.headers.get('location'))).text(), /abgebrochen/);
  const fake = await get('/auth/discord/callback?code=anna&state=gefaelscht', oauth);
  assert.match(fake.headers.get('location'), /^\/login\?error=state/);
  assert.equal(cookieOf(fake, 'pa_session'), undefined);
  const noCookie = await get(`/auth/discord/callback?code=anna&state=${state}`);
  assert.match(noCookie.headers.get('location'), /^\/login\?error=state/);
  const forged = await get(`/auth/discord/callback?code=anna&state=${state}`, oauth.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')));
  assert.match(forged.headers.get('location'), /^\/login\?error=state/);
  assert.match(await (await get('/login?error=state')).text(), /abgelaufen/);
});

test('Am Tisch: Name und Bild von Discord, doppelte Namen nummeriert, zweites Gerät = derselbe Spieler', async () => {
  const anna = await login('anna');
  const anna2 = await login('anna2');
  const a = (await connect(anna.cookie)).s;
  const created = await a.ask('create', { name: 'Hacker', avatar: '🦊' });
  assert.ok(created.ok, created.error);
  const code = created.code;
  await until(() => a.state);
  const me = a.state.standings.find((p) => p.id === a.state.you.id);
  assert.equal(me.name, 'Anna', 'Eingegebener Name wird ignoriert');
  assert.match(me.avatarUrl, /^https:\/\/cdn\.discordapp\.com\//);

  // Zweites Konto mit gleichem Anzeigenamen → „Anna 2“, Standardbild von Discord
  const b = (await connect(anna2.cookie)).s;
  const jb = await b.ask('join', { code, name: 'Anna' });
  assert.ok(jb.ok, jb.error);
  await until(() => b.state);
  assert.equal(b.state.you.name, 'Anna 2');
  assert.match(b.state.standings.find((p) => p.name === 'Anna 2').avatarUrl, /^https:\/\/cdn\.discordapp\.com\/embed\/avatars\/\d\.png$/);

  // Fremdes Token übernimmt im Discord-Modus niemanden
  const c = (await connect(anna2.cookie)).s;
  const stolen = await c.ask('join', { code, token: created.token });
  assert.ok(stolen.ok);
  await until(() => c.state);
  assert.equal(c.state.you.name, 'Anna 2', 'Token von Anna hilft Anna 2 nicht');
  await until(() => b.events.includes('replaced'));

  // Anna sitzt, dann gleiches Konto auf einem anderen Gerät
  assert.ok((await a.ask('sit', { seat: 2 })).ok);
  const phone = await login('anna');
  const d = (await connect(phone.cookie)).s;
  const jd = await d.ask('join', { code });
  assert.ok(jd.ok, jd.error);
  await until(() => d.state);
  assert.equal(d.state.you.id, a.state.you.id, 'Derselbe Spieler');
  assert.equal(d.state.you.seat, 2, 'Gleicher Platz');
  await until(() => a.events.includes('replaced'), 2000);
  assert.equal(d.state.standings.filter((p) => p.name.startsWith('Anna')).length, 2);
  for (const s of [a, b, c, d]) s.close();
});

test('Wer den Discord-Server verlässt, fliegt beim nächsten Recheck raus', async () => {
  const ben = await login('ben');
  const s = (await connect(ben.cookie)).s;
  assert.equal((await get('/me', ben.cookie)).status, 200);
  left.add('ben');
  await until(() => s.events.includes('loggedOut'), 8000);
  assert.equal((await get('/me', ben.cookie)).status, 401);
  const again = await connect(ben.cookie);
  assert.equal(again.ok, false);
  again.s.close(); s.close();
  // Wieder beitreten → Anmeldung klappt wieder
  left.delete('ben');
  assert.ok((await login('ben')).cookie);
});

test('Abmelden löscht die Sitzung und trennt offene Verbindungen', async () => {
  const anna = await login('anna');
  const s = (await connect(anna.cookie)).s;
  const out = await fetch(URL + '/logout', { method: 'POST', redirect: 'manual', headers: { cookie: anna.cookie } });
  assert.equal(out.status, 303);
  assert.equal(out.headers.get('location'), '/login');
  assert.match(cookieOf(out, 'pa_session'), /Max-Age=0/);
  assert.equal((await get('/me', anna.cookie)).status, 401);
  await until(() => s.events.includes('loggedOut'), 2000);
  s.close();
});

test('Halb eingerichtet: Server startet nicht und nennt den fehlenden Wert (ohne Inhalte)', async () => {
  const p = startServer({ PORT: String(PORT + 60), DISCORD_CLIENT_SECRET: '', DISCORD_GUILD_ID: '' });
  let err = '';
  p.stderr.on('data', (d) => { err += d; });
  const code = await new Promise((res) => p.on('exit', res));
  assert.equal(code, 1);
  assert.match(err, /DISCORD_CLIENT_SECRET und DISCORD_GUILD_ID fehlt/);
  assert.ok(!err.includes('test-client'), 'Keine Werte in der Ausgabe');
});
