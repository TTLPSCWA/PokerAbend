// V2-02 Discord-Anmeldung gegen einen nachgebauten Discord-Server (kein echtes Discord, keine echten Secrets).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { freePort } from './free-port.js';
import { discordConfig } from '../server/auth-discord.js';
import { fakeDiscord, GUILD, CLIENT, SECRET } from './discord-fake.js';

const PASSWORD = 'gruppe-passwort';

// ---------- Server und „Browser“ ----------
async function startApp(extra = {}, dataDir = mkdtempSync(join(tmpdir(), 'discord-app-'))) {
  const port = await freePort(), url = `http://localhost:${port}`;
  const proc = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, POKER_NO_DOTENV: '1', SITE_PASSWORD: PASSWORD, ADMIN_PASSWORD: 'adminpw', CREATE_LIMIT: '500', SESSION_SECRET: 'test-session-secret', PUBLIC_URL: url, ...extra }, stdio: 'pipe' });
  let log = '';
  proc.stderr.on('data', (d) => { log += d; });
  await new Promise((res, rej) => { proc.stdout.on('data', (d) => { log += d; if (String(d).includes('läuft')) res(); }); proc.on('exit', (c) => rej(new Error('Server beendet: ' + c + log))); });
  proc.removeAllListeners('exit');
  return { url, proc, dataDir, log: () => log, stop: () => new Promise((r) => { proc.once('exit', r); proc.kill(); }) };
}
function browser(app) {
  const jar = {};
  const take = (res) => { for (const c of res.headers.getSetCookie()) { const [kv, ...attrs] = c.split(';'); const i = kv.indexOf('='), name = kv.slice(0, i), value = decodeURIComponent(kv.slice(i + 1)); if (/Max-Age=0/i.test(attrs.join(';')) || value === '') delete jar[name]; else jar[name] = value; } };
  const header = () => Object.entries(jar).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ');
  const b = {
    jar, header,
    async get(path, abs = false, method = 'GET') { const res = await fetch(abs ? path : app.url + path, { method, headers: { cookie: header() }, redirect: 'manual' }); take(res); return res; },
    async post(path, body = {}, extra = {}, method = 'POST') { const res = await fetch(app.url + path, { method, headers: { cookie: header(), 'content-type': 'application/json', 'x-requested-with': 'spieleabend', ...extra }, body: JSON.stringify(body), redirect: 'manual' }); take(res); return res; },
    async password() { const res = await fetch(app.url + '/login', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: header() }, body: new URLSearchParams({ password: PASSWORD }) }); take(res); assert.equal(res.status, 303); await b.get('/'); return b; },
    inside: async () => (await b.get('/')).status === 200,
    // Kompletter Discord-Weg: Start → bei Discord bestätigen → Rücksprung; liefert die letzte Antwort
    async discord(fake, { user, path = '/auth/discord/login?next=%2Fspiel', approve = true } = {}) {
      const start = await b.get(path);
      assert.equal(start.status, 303, 'Weiterleitung zu Discord');
      const back = fake.authorize(start.headers.get('location'), { user, approve });
      return b.get(back.pathname + back.search + (back.hash || ''), false);
    },
  };
  return b;
}
const identityOf = async (b) => (await b.get('/api/identity')).json();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 6000) { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return; await wait(100); } throw new Error('Zeitüberschreitung'); }

let fake, app;
before(async () => {
  fake = await fakeDiscord();
  fake.user('100000000000000001', 'Mitglied Eins'); fake.user('100000000000000002', 'Mitglied Zwei'); fake.user('100000000000000003', 'Fremder'); fake.user('100000000000000004', 'Nummer Vier');
  fake.members.add('100000000000000001'); fake.members.add('100000000000000002'); fake.members.add('100000000000000004');
  const dir = mkdtempSync(join(tmpdir(), 'discord-data-'));
  writeFileSync(join(dir, 'leaderboard.json'), JSON.stringify({ players: { oma: { name: 'Oma', games: { maumau: { played: 6, wins: 5, points: 0, months: {} } } } } }));
  app = await startApp({ DISCORD_CLIENT_ID: CLIENT, DISCORD_CLIENT_SECRET: SECRET, DISCORD_GUILD_ID: GUILD, DISCORD_API_BASE: fake.base + '/api', DISCORD_AUTHORIZE_URL: fake.base + '/oauth2/authorize', DISCORD_RECHECK_MIN: '0.02', DISCORD_RATE_MAX: '1000' }, dir);
});
after(async () => { await app?.stop(); fake?.server.close(); });

// ---------- Konfiguration ----------
test('Konfiguration: ohne Client-ID, Secret oder PUBLIC_URL ist Discord aus; Zugang nur mit Server-ID', () => {
  assert.equal(discordConfig({}), null);
  assert.equal(discordConfig({ DISCORD_CLIENT_ID: '1', DISCORD_CLIENT_SECRET: 's' }), null, 'ohne PUBLIC_URL');
  assert.equal(discordConfig({ DISCORD_CLIENT_ID: '1', DISCORD_CLIENT_SECRET: 's', PUBLIC_URL: 'javascript:alert(1)' }), null);
  const c = discordConfig({ DISCORD_CLIENT_ID: '1', DISCORD_CLIENT_SECRET: 's', PUBLIC_URL: 'https://spiele.example/' });
  assert.equal(c.redirectUri, 'https://spiele.example/auth/discord/callback'); assert.equal(c.guildId, '');
  assert.equal(discordConfig({ DISCORD_CLIENT_ID: '1', DISCORD_CLIENT_SECRET: 's', PUBLIC_URL: 'https://x.de', DISCORD_GUILD_ID: 'abc' }).policyValid, false);
});

test('Ohne Einrichtung: kein Knopf, alle Discord-Routen 404, Passwort-Login unverändert', async () => {
  const plain = await startApp();
  try {
    const b = browser(plain);
    const page = await (await b.get('/login')).text();
    assert.ok(!/Mit Discord|auth[/]discord/i.test(page), 'kein Discord-Knopf');
    for (const path of ['/auth/discord/login', '/auth/discord/link', '/auth/discord/callback?code=x&state=y', '/auth/discord/status']) assert.equal((await b.get(path)).status, 404, path);
    assert.equal((await b.post('/auth/discord/logout')).status, 404);
    assert.equal((await b.get('/')).status, 302, 'ohne Passwort kein Zugang (Weiterleitung zur Login-Seite)');
    await b.password();
    assert.ok(await b.inside());
    assert.equal((await b.get('/auth/discord/status')).status, 404, 'auch angemeldet: 404');
    assert.equal((await b.get('/me')).status, 200);
    assert.equal((await (await b.get('/me')).json()).discord.enabled, false);
  } finally { await plain.stop(); }
});

test('A02/A03: Verknüpfung und Identity-only-OAuth setzen den bestehenden Seitenzugang voraus', async () => {
  const linkOnly = await startApp({ DISCORD_CLIENT_ID: CLIENT, DISCORD_CLIENT_SECRET: SECRET, DISCORD_API_BASE: fake.base + '/api', DISCORD_AUTHORIZE_URL: fake.base + '/oauth2/authorize' });
  try {
    const b = browser(linkOnly);
    assert.ok(!/Mit Discord anmelden/.test(await (await b.get('/login')).text()));
    const beforeLogin = await b.get('/auth/discord/login');
    assert.equal(beforeLogin.status, 303);
    assert.match(beforeLogin.headers.get('location'), /^\/login/);
    assert.equal((await b.get('/auth/discord/link')).status, 303); assert.match((await b.get('/auth/discord/link')).headers.get('location'), /^\/login/);
    await b.password();
    const done = await b.discord(fake, { user: '100000000000000003', path: '/auth/discord/link' });   // auch ein Nicht-Mitglied darf nur verknüpfen
    assert.match(done.headers.get('location'), /discord=linked/);
    assert.equal((await (await b.get('/auth/discord/status')).json()).linked, true);
    const status = await (await b.get('/auth/discord/status')).json();
    assert.equal(status.active, false);
    const next = '/#planung/test-plan';
    const signedIn = await b.discord(fake, { user: '100000000000000003', path: '/auth/discord/login?next=' + encodeURIComponent(next) });
    assert.equal(signedIn.headers.get('location'), next);
    assert.equal((await (await b.get('/auth/discord/status')).json()).active, true);
    delete b.jar.pa_auth;
    assert.equal(await b.inside(), false);
    const stranger = browser(linkOnly);
    assert.match((await stranger.get('/auth/discord/login')).headers.get('location'), /^\/login/);
    assert.ok(!(await stranger.inside()));
  } finally { await linkOnly.stop(); }
});

// ---------- Anmelden ----------
test('Mitglied: Login klappt ohne Gruppenpasswort, landet am Zielort (next), Konto ist verknüpft, kein Passwort-Cookie', async () => {
  const b = browser(app);
  assert.match(await (await b.get('/login')).text(), /Mit Discord anmelden/);
  assert.ok(!(await b.inside()));
  const start = await b.get('/auth/discord/login?next=%2F%3Ftisch%3DABCD');
  const location = new URL(start.headers.get('location'));
  assert.equal(location.searchParams.get('scope'), 'identify guilds.members.read');
  assert.equal(location.searchParams.get('redirect_uri'), `${app.url}/auth/discord/callback`, 'feste Redirect-URI');
  assert.match(location.searchParams.get('state'), /^[\w-]{20,}$/);
  const oauthCookie = start.headers.getSetCookie().find((c) => c.startsWith('pa_oauth='));
  assert.match(oauthCookie, /HttpOnly/); assert.match(oauthCookie, /SameSite=Lax/); assert.match(oauthCookie, /Path=\/auth\/discord/);
  const back = fake.authorize(start.headers.get('location'), { user: '100000000000000001' });
  const done = await b.get(back.pathname + back.search);
  assert.equal(done.status, 303); assert.equal(done.headers.get('location'), '/?tisch=ABCD', 'Einladungslink bleibt erhalten');
  const session = done.headers.getSetCookie().find((c) => c.startsWith('pa_discord='));
  assert.match(session, /HttpOnly/); assert.match(session, /SameSite=Lax/);
  assert.ok(!b.jar.pa_auth, 'Discord stellt nie das Passwort-Cookie aus');
  assert.ok(await b.inside());
  assert.equal((await (await b.get('/me')).json()).discord.login, true);
  const status = await (await b.get('/auth/discord/status')).json();
  assert.equal(status.linked, true); assert.equal(status.name, 'Mitglied Eins'); assert.equal(status.adopt, 'Mitglied Eins', 'Name wird einmal vorgeschlagen');
  assert.equal((await b.post('/auth/discord/profile', { ack: true })).status, 200);
  assert.equal((await (await b.get('/auth/discord/status')).json()).adopt, '');
  assert.match((await identityOf(b)).gameId, /^#/);
});

test('Nicht-Mitglied, Abbruch, gefälschter und wiederverwendeter state, abgelaufener Code: kein Zugang', async () => {
  const outsider = browser(app);
  const r = await outsider.discord(fake, { user: '100000000000000003' });
  assert.match(r.headers.get('location'), /^\/login\?discord=nomember/);
  assert.ok(!outsider.jar.pa_discord && !(await outsider.inside()));
  assert.match(await (await outsider.get('/login?discord=nomember')).text(), /nicht Mitglied/);

  const cancel = await browser(app).discord(fake, { user: '100000000000000001', approve: false });
  assert.match(cancel.headers.get('location'), /discord=denied/);

  const b = browser(app);
  const forged = await b.get('/auth/discord/callback?code=CODE-x&state=erfunden');
  assert.match(forged.headers.get('location'), /discord=state/);
  // Replay: derselbe Rücksprung zweimal
  const start = await b.get('/auth/discord/login'), back = fake.authorize(start.headers.get('location'), { user: '100000000000000001' });
  const url = back.pathname + back.search, savedCookie = b.header();
  assert.equal((await b.get(url)).status, 303); assert.ok(await b.inside());
  const replay = browser(app); replay.jar.pa_oauth = savedCookie.match(/pa_oauth=([^;]*)/)?.[1] ? decodeURIComponent(savedCookie.match(/pa_oauth=([^;]*)/)[1]) : '';
  assert.match((await replay.get(url)).headers.get('location'), /discord=state/, 'wiederverwendeter state');
  assert.ok(!(await replay.inside()));
  // state aus einem anderen Browser (Angreifer schickt dem Opfer seinen Link): das Cookie fehlt
  const attacker = browser(app), victim = browser(app);
  const atkStart = await attacker.get('/auth/discord/login'), atkBack = fake.authorize(atkStart.headers.get('location'), { user: '100000000000000001' });
  assert.match((await victim.get(atkBack.pathname + atkBack.search)).headers.get('location'), /discord=state/);
  assert.ok(!(await victim.inside()));
  // abgelaufener Code
  fake.expireCodes = true;
  try { assert.match((await browser(app).discord(fake, { user: '100000000000000001' })).headers.get('location'), /discord=expired/); } finally { fake.expireCodes = false; }
  assert.ok(!app.log().includes(SECRET) && !/AT-[0-9a-f]{12}|RT-[0-9a-f]{12}/.test(app.log()), 'keine Secrets oder Tokens im Log');
});

test('Verknüpfen, Trennen und Cookie-Verlust: per Discord ist es wieder dasselbe Konto', async () => {
  const b = await browser(app).password();
  const before = await identityOf(b);
  assert.match((await b.discord(fake, { user: '100000000000000002', path: '/auth/discord/link' })).headers.get('location'), /discord=linked/);
  assert.equal((await (await b.get('/auth/discord/status')).json()).linked, true);
  // Cookies weg (Browser neu): Anmeldung mit Discord → dieselbe Game-ID
  const fresh = browser(app);
  assert.match((await fresh.discord(fake, { user: '100000000000000002' })).headers.get('location'), /spiel/);
  assert.equal((await identityOf(fresh)).gameId, before.gameId);
  // Trennen: Discord-Zugang endet, das Gruppenpasswort-Cookie des anderen Browsers bleibt
  assert.equal((await fresh.post('/auth/discord/unlink')).status, 200);
  assert.ok(!(await fresh.inside())); assert.ok(await b.inside());
  assert.equal((await b.get('/auth/discord/status').then((r) => r.json())).linked, false);
});

test('Discord-ID schon vergeben: Nachfrage, Zusammenführen mit Statistik; ohne Bestätigung passiert nichts', async () => {
  const main = await browser(app).password(), other = await browser(app).password();
  await main.discord(fake, { user: '100000000000000004', path: '/auth/discord/link' });
  assert.equal((await other.post('/api/identity/claim', { name: 'Oma' })).status, 200, 'alte Statistik am zweiten Konto');
  const mainId = (await identityOf(main)).gameId, otherId = (await identityOf(other)).gameId;
  assert.notEqual(mainId, otherId);
  const conflict = await other.discord(fake, { user: '100000000000000004', path: '/auth/discord/link' });
  assert.match(conflict.headers.get('location'), /discord=conflict/);
  assert.equal((await identityOf(other)).gameId, otherId, 'noch nichts verändert');
  assert.equal((await (await other.post('/auth/discord/merge', { confirm: false })).json()).merged, false);
  assert.equal((await other.post('/auth/discord/merge', { confirm: true })).status, 409, 'die Rückfrage ist verbraucht');
  await other.discord(fake, { user: '100000000000000004', path: '/auth/discord/link' });
  assert.equal((await other.post('/auth/discord/merge', { confirm: true }, { 'x-requested-with': 'fremd' })).status, 403, 'CSRF-Schutz');
  const merged = await (await other.post('/auth/discord/merge', { confirm: true })).json();
  assert.equal(merged.merged, true);
  const after = await identityOf(other);
  assert.equal(after.gameId, mainId, 'beide Geräte sind dieselbe Person'); assert.deepEqual(after.claimed, ['Oma'], 'die Statistik ist mitgewandert');
});

// ---------- Mitgliedschaft, Ausfall, Sitzungen ----------
test('Mitgliedschaft wird neu geprüft: Austritt nimmt den Discord-Zugang, Passwort-Cookie bleibt; Discord-Ausfall sperrt niemanden aus', async () => {
  fake.members.add('100000000000000002');
  const both = await browser(app).password();
  await both.discord(fake, { user: '100000000000000002' });
  const only = browser(app); await only.discord(fake, { user: '100000000000000002' });
  assert.ok(await only.inside());
  // Discord nicht erreichbar: nach Ablauf der Frist bleibt der Zugang
  fake.down = true;
  try { await wait(1500); for (let i = 0; i < 3; i++) { assert.ok(await only.inside(), 'Ausfall sperrt nicht aus'); await wait(300); } } finally { fake.down = false; }
  // Austritt aus dem Server
  fake.members.delete('100000000000000002');
  await until(async () => !(await only.inside()), 8000);
  assert.ok(await both.inside(), 'das Gruppenpasswort bleibt davon unberührt');
  assert.ok(!(await only.inside()));
  fake.members.add('100000000000000002');
});

test('Logout, überall abmelden, Rotation, Admin: Sitzungen werden widerrufen, Discord ist nie Admin', async () => {
  const one = browser(app), two = browser(app);
  await one.discord(fake, { user: '100000000000000001' }); await two.discord(fake, { user: '100000000000000001' });
  assert.notEqual(one.jar.pa_discord, two.jar.pa_discord);
  const first = one.jar.pa_discord;
  // Discord-Nutzer kommt nicht auf /admin und nicht in die Ticket-Verwaltung
  assert.equal((await one.get('/admin/api/status')).status, 401);
  assert.equal((await one.post('/api/tickets/admin/login', { password: 'egal' })).status === 200, false);
  // Rotation: neuer Login im selben Browser macht das alte Token ungültig
  await one.discord(fake, { user: '100000000000000001' });
  assert.notEqual(one.jar.pa_discord, first);
  const stale = browser(app); stale.jar.pa_discord = first;
  assert.ok(!(await stale.inside()), 'altes Sitzungs-Token nach der Rotation wertlos');
  // CSRF
  assert.equal((await one.post('/auth/discord/logout', {}, { 'x-requested-with': 'x' })).status, 403);
  assert.equal((await fetch(app.url + '/auth/discord/logout', { method: 'POST', headers: { cookie: one.header(), origin: 'https://boese.example', 'x-requested-with': 'spieleabend' } })).status, 403, 'fremde Herkunft');
  // Überall abmelden widerruft auch die Sitzung des anderen Geräts
  assert.ok(await two.inside());
  assert.equal((await one.post('/auth/discord/logout-all')).status, 200);
  assert.ok(!(await one.inside())); assert.ok(!(await two.inside()));
  // einfaches Abmelden
  const three = browser(app); await three.discord(fake, { user: '100000000000000001' }); const token = three.jar.pa_discord;
  assert.equal((await three.post('/auth/discord/logout')).status, 200);
  assert.ok(!(await three.inside()));
  const reuse = browser(app); reuse.jar.pa_discord = token;
  assert.ok(!(await reuse.inside()), 'widerrufenes Token bleibt ungültig');
  // /logout der Seite beendet ebenfalls die Discord-Sitzung
  const four = browser(app); await four.discord(fake, { user: '100000000000000001' }); const t4 = four.jar.pa_discord;
  await fetch(app.url + '/logout', { method: 'POST', headers: { cookie: four.header() }, redirect: 'manual' });
  const reuse4 = browser(app); reuse4.jar.pa_discord = t4;
  assert.ok(!(await reuse4.inside()));
});

test('Sitzungen: nur als Hash gespeichert, Refresh-Token verschlüsselt, Sockets verlangen eine gültige Anmeldung', async () => {
  const b = browser(app); await b.discord(fake, { user: '100000000000000001' });
  await wait(700);
  const file = readFileSync(join(app.dataDir, 'discord-sessions.json'), 'utf8');
  assert.ok(!file.includes(b.jar.pa_discord), 'das Cookie-Token steht nicht im Klartext');
  assert.ok(!/RT-[0-9a-f]{12}|AT-[0-9a-f]{12}/.test(file), 'Provider-Tokens stehen nicht im Klartext');
  assert.ok(!file.includes(SECRET));
  const { io } = await import('socket.io-client');
  const connect = (cookie) => new Promise((resolve) => { const s = io(app.url, { transports: ['websocket'], reconnection: false, forceNew: true, extraHeaders: cookie ? { cookie } : {} }); s.on('connect', () => { s.close(); resolve(true); }); s.on('connect_error', () => { s.close(); resolve(false); }); });
  assert.equal(await connect(''), false); assert.equal(await connect(b.header()), true);
});

test('K04 (SEC-SOCKET-01): Discord-Logout und „überall abmelden“ trennen offene Sockets ohne Gruppenpasswort sofort', async () => {
  const { io } = await import('socket.io-client');
  const open = (b) => new Promise((resolve, reject) => {
    const s = io(app.url, { transports: ['websocket'], reconnection: false, forceNew: true, extraHeaders: { cookie: b.header() } });
    s.expired = false; s.on('auth-expired', () => { s.expired = true; });
    s.on('connect', () => resolve(s)); s.on('connect_error', (e) => reject(e));
  });
  const ask = (s, event) => s.timeout(3000).emitWithAck(event, {});
  const one = browser(app), two = browser(app), three = browser(app), withPassword = await browser(app).password();
  await one.discord(fake, { user: '100000000000000002' });
  await two.discord(fake, { user: '100000000000000004' });
  await three.discord(fake, { user: '100000000000000004' });
  await withPassword.discord(fake, { user: '100000000000000002' });
  const s1 = await open(one), s2 = await open(two), s3 = await open(three), sp = await open(withPassword);
  try {
    assert.equal((await ask(s1, 'lobby')).ok, true);
    await one.post('/auth/discord/logout');
    await until(() => s1.expired && !s1.connected, 3000);
    assert.equal((await ask(sp, 'lobby')).ok, true, 'mit Gruppenpasswort bleibt der Zugang trotz Discord-Logout desselben Nutzers');
    assert.equal((await ask(s2, 'lobby')).ok, true, 'andere Discord-Nutzer unberührt');
    assert.equal((await two.post('/auth/discord/logout-all')).status, 200);
    await until(() => s2.expired && s3.expired && !s2.connected && !s3.connected, 3000);
    assert.equal(sp.connected, true);
  } finally { [s1, s2, s3, sp].forEach((s) => s.close()); }
});

test('Rate-Limit auf den /auth-Routen', async () => {
  const strict = await startApp({ DISCORD_CLIENT_ID: CLIENT, DISCORD_CLIENT_SECRET: SECRET, DISCORD_GUILD_ID: GUILD, DISCORD_API_BASE: fake.base + '/api', DISCORD_AUTHORIZE_URL: fake.base + '/oauth2/authorize' });
  try {
    const b = browser(strict); let limited = 0;
    for (let i = 0; i < 80; i++) if ((await b.get('/auth/discord/callback?state=x')).status === 429) limited++;
    assert.ok(limited > 0, 'zu viele Versuche werden gebremst');
  } finally { await strict.stop(); }
});

test('A01/A03/A05/A08–A11: Exklusive Module, Link, Export und Kontozugriff am echten Server', async () => {
  const exclusive = await startApp({
    DISCORD_EXCLUSIVE_MODULES: 'on', DISCORD_CLIENT_ID: CLIENT, DISCORD_CLIENT_SECRET: SECRET,
    DISCORD_API_BASE: fake.base + '/api', DISCORD_AUTHORIZE_URL: fake.base + '/oauth2/authorize',
  });
  try {
    const guest = await browser(exclusive).password();
    const member = await browser(exclusive).password();
    const who = '100000000000000001';
    assert.equal((await member.discord(fake, { user: who })).status, 303);
    const memberId = (await identityOf(member)).gameId;
    assert.equal((await (await member.get('/api/discord-access')).json()).active, true);
    assert.equal((await (await guest.get('/api/discord-access')).json()).active, false);

    const plan = await member.post('/api/plans', {
      name: 'Prüfer', title: 'Privater Prüfplan', description: 'Nur Testdaten',
      slots: [Date.now() + 86400000], games: ['maumau'], private: true,
    });
    const planBody = await plan.json();
    assert.equal(plan.status, 201, planBody.error);
    const planPath = '/api/plans/' + planBody.plan.id;
    const deniedPaths = ['/api/tickets', '/api/tickets/1', '/api/tickets/export.md', '/api/tickets/1/export.md',
      '/api/plans', planPath, planPath + '/program', '/api/leaderboard', '/api/ranked',
      '/api/evenings', '/api/evenings/synthetic', '/api/evenings/synthetic/export', '/api/identity/legacy'];
    for (const path of deniedPaths) {
      for (const method of ['GET', 'HEAD']) {
        const denied = await guest.get(path, false, method);
        assert.equal(denied.status, 403, `${method} ${path}`);
        assert.equal(denied.headers.get('content-disposition'), null);
        assert.equal(denied.headers.get('cache-control'), 'no-store');
        if (method === 'GET') assert.equal((await denied.json()).code, 'discord-required');
      }
    }
    for (const [method, path] of [['POST', '/api/tickets'], ['PUT', planPath + '/vote'], ['PATCH', planPath], ['DELETE', planPath], ['POST', '/api/identity/claim']]) {
      assert.equal((await guest.post(path, {}, {}, method)).status, 403, `${method} ${path}`);
    }
    for (const path of ['/api/tickets', '/api/plans', planPath, '/api/leaderboard', '/api/ranked', '/api/evenings', '/api/identity/legacy']) {
      assert.equal((await member.get(path)).status, 200, path);
    }
    assert.equal((await member.get('/api/plans/not-an-id')).status, 404);
    assert.equal((await (await member.get(planPath)).json()).plan.canManage, true);

    const profile = await (await guest.get('/api/profile/' + encodeURIComponent(memberId))).json();
    assert.equal(profile.gameId, memberId);
    for (const key of ['stats', 'favorites', 'recent', 'achievements']) assert.equal(profile[key], null, key);
    assert.equal((await (await guest.get('/api/profile/me')).json()).self, true);
    const achievements = await (await guest.get('/api/achievements?name=Mitglied')).json();
    assert.equal(achievements.restricted, true);
    assert.equal(achievements.unlocked, 0);
    assert.equal(achievements.stats.played, 0);
    assert.deepEqual((await (await guest.get('/api/achievements/players?q=Mitglied')).json()).names, []);
    assert.equal((await identityOf(guest)).legacyAvailable, null);
    assert.equal((await guest.get('/api/me/export')).status, 200);
    assert.equal((await guest.get('/api/me/settings')).status, 200);
    assert.equal((await guest.post('/api/identity/link/create')).status, 200);

    guest.jar.pa_discord = member.jar.pa_discord; // fremdes Cookie passt nicht zum eigenen signierten Konto
    assert.equal((await guest.get('/api/ranked')).status, 403);
    delete guest.jar.pa_discord;
    assert.equal((await member.get('/admin/api/tickets')).status, 401);
    assert.equal((await guest.post('/admin/api/login', { password: 'adminpw' })).status, 200);
    for (const path of ['/admin/api/status', '/admin/api/tickets', '/admin/api/tickets/export.md', '/admin/api/leaderboard', '/admin/api/rounds']) {
      assert.equal((await guest.get(path)).status, 200, path);
    }
    assert.equal((await guest.get('/api/tickets')).status, 403);

    const other = await browser(exclusive).password();
    await other.discord(fake, { user: who });
    assert.equal((await other.get('/api/ranked')).status, 200);
    assert.equal((await member.post('/auth/discord/logout')).status, 200);
    assert.equal((await member.get('/api/ranked')).status, 403);
    assert.equal((await other.get('/api/ranked')).status, 200);
    assert.equal((await (await member.get('/auth/discord/status')).json()).linked, true);
    await member.discord(fake, { user: who });
    assert.equal((await member.post('/auth/discord/logout-all')).status, 200);
    assert.equal((await other.get('/api/ranked')).status, 403);
    assert.equal(await other.inside(), true);
    assert.equal((await member.get('/api/me/export')).status, 200);
  } finally { await exclusive.stop(); }
});

test('A07: Standard aus, fehlende OAuth-Daten und fehlerhafte optionale Mitgliedsrichtlinie', async () => {
  const configs = [
    { SITE_PASSWORD: '', DISCORD_EXCLUSIVE_MODULES: 'off' },
    { SITE_PASSWORD: '', DISCORD_EXCLUSIVE_MODULES: 'on' },
    { SITE_PASSWORD: '', DISCORD_EXCLUSIVE_MODULES: 'on', DISCORD_CLIENT_ID: CLIENT, DISCORD_CLIENT_SECRET: SECRET, DISCORD_ROLE_ID: '100000000000000099' },
  ];
  for (const [i, config] of configs.entries()) {
    const server = await startApp(config);
    try {
      const guest = browser(server);
      assert.equal(await guest.inside(), true);
      const response = await guest.get('/api/ranked');
      assert.equal(response.status, i ? 503 : 200);
      if (i) {
        assert.equal((await response.json()).code, 'discord-configuration');
        assert.equal((await (await guest.get('/api/discord-access')).json()).login, false);
      }
      assert.equal((await guest.get('/api/profile/me')).status, 200);
    } finally { await server.stop(); }
  }
});

test('A03/A06/A17: optionale Rolle, Provider-Ausfall, bestätigter Entzug und Entknüpfung', async () => {
  const who = '100000000000000002', role = '100000000000000099';
  fake.roles.set(who, [role]);
  const server = await startApp({
    DISCORD_EXCLUSIVE_MODULES: 'on', DISCORD_CLIENT_ID: CLIENT, DISCORD_CLIENT_SECRET: SECRET,
    DISCORD_GUILD_ID: GUILD, DISCORD_ROLE_ID: role, DISCORD_RECHECK_MIN: '0.01',
    DISCORD_API_BASE: fake.base + '/api', DISCORD_AUTHORIZE_URL: fake.base + '/oauth2/authorize',
  });
  try {
    const b = await browser(server).password();
    const outsider = await browser(server).password();
    assert.match((await outsider.discord(fake, { user: '100000000000000001' })).headers.get('location'), /discord=nomember/);
    assert.equal((await outsider.get('/api/tickets')).status, 403);
    await b.discord(fake, { user: who });
    assert.equal((await b.get('/api/tickets')).status, 200);

    fake.down = true;
    try {
      const failed = await browser(server).password();
      assert.match((await failed.discord(fake, { user: who })).headers.get('location'), /discord=failed/);
      assert.equal((await failed.get('/api/tickets')).status, 403);
      assert.equal(failed.jar.pa_discord, undefined);
      await wait(650);
      assert.equal((await b.get('/api/tickets')).status, 200);
    } finally { fake.down = false; }

    fake.roles.delete(who);
    await until(async () => (await b.get('/api/tickets')).status === 403);
    assert.equal(await b.inside(), true);
    fake.roles.set(who, [role]);
    await b.discord(fake, { user: who });
    assert.equal((await b.get('/api/tickets')).status, 200);
    assert.equal((await b.post('/auth/discord/unlink')).status, 200);
    assert.equal((await b.get('/api/tickets')).status, 403);
    assert.equal((await (await b.get('/auth/discord/status')).json()).linked, false);
  } finally {
    fake.roles.delete(who);
    await server.stop();
  }
});

test('A12–A14: Socket-Spiel bleibt nach Logout spielbar, die neue Sitzung wertet die Runde nicht auf', async () => {
  const { io } = await import('socket.io-client');
  const server = await startApp({
    DISCORD_CLIENT_ID: CLIENT, DISCORD_CLIENT_SECRET: SECRET,
    DISCORD_API_BASE: fake.base + '/api', DISCORD_AUTHORIZE_URL: fake.base + '/oauth2/authorize',
  });
  const sockets = [];
  const connect = (b) => {
    const socket = io(server.url, { transports: ['websocket'], forceNew: true, reconnection: false, extraHeaders: { cookie: b.header() } });
    socket.on('state', (state) => { socket.state = state; });
    socket.ask = async (event, payload = {}) => {
      const answer = await socket.timeout(4000).emitWithAck(event, payload);
      assert.equal(answer.ok, true, `${event}: ${answer.error}`);
      return answer;
    };
    sockets.push(socket);
    return socket;
  };
  const finish = async (players) => {
    await until(() => players.every((p) => p.state?.phase === 'playing'));
    const first = players.findIndex((p) => p.state.you.id === p.state.turnId);
    assert.notEqual(first, -1);
    for (let i = 0; i < 7; i++) await players[(first + i) % 2].ask('drop', { col: i % 2 });
  };
  try {
    const a = await browser(server).password(), b = await browser(server).password(), watcher = await browser(server).password();
    const userA = '100000000000000001', userB = '100000000000000002';
    await a.discord(fake, { user: userA });
    await b.discord(fake, { user: userB });
    const host = connect(a), guest = connect(b), observer = connect(watcher);
    const table = await host.ask('create', { game: 'viergewinnt', name: 'Prüfer A' });
    const seat = await guest.ask('join', { code: table.code, name: 'Prüfer B' });
    await observer.ask('join', { code: table.code, name: 'Zuschauer' });
    await host.ask('sit');
    await guest.ask('sit');
    await host.ask('start');
    await until(() => guest.state?.ranked?.frozen);
    assert.equal(guest.state.ranked.ranked, true);
    guest.close();
    const reconnected = connect(b);
    await reconnected.ask('join', { code: table.code, token: seat.token });
    await until(() => reconnected.state?.ranked?.frozen);
    assert.equal(reconnected.state.ranked.ranked, true);
    await finish([host, reconnected]);

    const summary = async () => (await (await a.get('/api/ranked?game=viergewinnt')).json()).summary;
    assert.deepEqual(await summary(), { ranked: 1, notRanked: 0, reasons: {} });
    await host.ask('start');
    await until(() => reconnected.state?.ranked?.frozen);
    assert.equal(reconnected.state.ranked.ranked, true);
    await b.post('/auth/discord/logout');
    await b.discord(fake, { user: userB });
    await finish([host, reconnected]);
    assert.deepEqual(await summary(), { ranked: 1, notRanked: 1, reasons: { gast: 1 } });
  } finally {
    sockets.forEach((socket) => socket.close());
    await server.stop();
  }
});

test('A04: abgelaufene und inaktive Sitzungen im Altbestand sperren Module trotz Cookie', async () => {
  const config = {
    DISCORD_EXCLUSIVE_MODULES: 'on', DISCORD_CLIENT_ID: CLIENT, DISCORD_CLIENT_SECRET: SECRET,
    DISCORD_API_BASE: fake.base + '/api', DISCORD_AUTHORIZE_URL: fake.base + '/oauth2/authorize',
  };
  const server = await startApp(config);
  const users = await Promise.all([browser(server).password(), browser(server).password()]);
  const file = join(server.dataDir, 'discord-sessions.json');
  let saved;
  try {
    for (const [i, b] of users.entries()) {
      await b.discord(fake, { user: `10000000000000000${i + 1}` });
      assert.equal((await b.get('/api/ranked')).status, 200);
    }
    await until(() => {
      try { saved = JSON.parse(readFileSync(file, 'utf8')); return Object.keys(saved.sessions).length === 2; } catch { return false; }
    });
  } finally { await server.stop(); }
  const [expired, idle] = Object.values(saved.sessions);
  expired.expires = Date.now() - 1000;
  idle.lastSeen = Date.now() - 15 * 86400000;
  writeFileSync(file, JSON.stringify(saved));

  const restored = await startApp(config, server.dataDir);
  try {
    for (const previous of users) {
      const b = browser(restored);
      Object.assign(b.jar, previous.jar);
      assert.ok(b.jar.pa_discord);
      assert.equal(await b.inside(), true);
      assert.equal((await (await b.get('/auth/discord/status')).json()).linked, true);
      for (const path of ['/api/ranked', '/api/tickets/export.md']) {
        const response = await b.get(path);
        assert.equal(response.status, 403);
        assert.equal(response.headers.get('content-disposition'), null);
      }
    }
  } finally { await restored.stop(); }
});
