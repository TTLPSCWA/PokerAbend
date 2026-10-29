import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'ticket-api-'));
const password = 'Ticket-Site-Test', adminPassword = 'Ticket-Admin-Test';
let server, base;
async function start(admin = adminPassword) {
  const child = spawn(process.execPath, ['--input-type=module', '-e', `
    const { http } = await import('./server/index.js');
    const ready = () => console.log('TICKET_READY:' + http.address().port);
    if (http.listening) ready(); else http.once('listening', ready);
  `], { env: { ...process.env, PORT: '0', DATA_DIR: dir, POKER_NO_DOTENV: '1', SITE_PASSWORD: password, TICKET_ADMIN_PASSWORD: admin, TRUST_PROXY: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Testserver startet nicht: ' + output)), 12000);
    child.stderr.on('data', (d) => { output += d; });
    child.once('error', (e) => { clearTimeout(timer); reject(e); });
    child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Testserver beendet: ${code}: ${output}`)); });
    child.stdout.on('data', (d) => { output += d; const m = output.match(/TICKET_READY:(\d+)/); if (m) { clearTimeout(timer); resolve('http://localhost:' + m[1]); } });
  });
  server = { stop: async () => { if (child.exitCode === null && child.signalCode === null) { const ended = new Promise((resolve) => child.once('exit', resolve)); child.kill(); await ended; } } };
}
before(() => start());
after(async () => server?.stop());
function client(name = 'Anna') {
  const jar = new Map();
  async function request(path, { method = 'GET', data, headers = {}, csrf = true, raw } = {}) {
    const opts = { method, redirect: 'manual', headers: { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), ...headers } };
    if (method !== 'GET' && method !== 'HEAD') {
      opts.headers['Content-Type'] ||= 'application/json';
      if (csrf) opts.headers['X-Requested-With'] = 'spieleabend';
      opts.body = raw ?? JSON.stringify({ name, avatar: '🦉', ...data });
    }
    const response = await fetch(base + path, opts);
    for (const cookie of response.headers.getSetCookie()) {
      const part = cookie.split(';')[0], i = part.indexOf('='), key = part.slice(0, i);
      if (/Max-Age=0(?:;|$)/.test(cookie)) jar.delete(key); else jar.set(key, part.slice(i + 1));
    }
    return response;
  }
  return { jar, request, json: async (...args) => { const r = await request(...args); return { status: r.status, data: await r.json() }; },
    login: async () => { const r = await request('/login', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, raw: new URLSearchParams({ password }).toString() }); assert.equal(r.status, 303); } };
}
const payload = { title: 'Ein neues Ticket', description: 'Eine verständliche Beschreibung für die Gruppe.', type: 'idea', game: '' };
let anna, ben, id;

test('Ticket-API liegt hinter dem Gruppenpasswort und vergibt private signierte Browser-Cookies', async () => {
  const anonymous = client();
  assert.equal((await anonymous.request('/api/tickets')).status, 302);
  assert.equal((await anonymous.request('/api/tickets', { method: 'POST', data: payload })).status, 401);
  anna = client('Anna'); ben = client('Ben'); await anna.login(); await ben.login();
  const r = await anna.request('/api/tickets', { headers: { 'X-Forwarded-Proto': 'https' } });
  assert.equal(r.status, 200); const cookies = r.headers.getSetCookie().join(';');
  assert.match(cookies, /HttpOnly/); assert.match(cookies, /Secure/); assert.match(cookies, /SameSite=Strict/); assert.match(cookies, /Path=\/api\/tickets/);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  const view = await r.json(); assert.equal(view.viewer.admin, false); assert.equal(view.viewer.adminEnabled, true);
  assert.ok(!JSON.stringify(view).includes(anna.jar.get('pa_ticket_visitor')));
});

test('CSRF, JSON-Grenzen und gefälschte Rollen werden vor Mutationen geprüft', async () => {
  assert.equal((await anna.request('/api/tickets', { method: 'POST', data: payload, csrf: false })).status, 403);
  assert.equal((await anna.request('/api/tickets', { method: 'POST', data: payload, headers: { Origin: 'https://fremd.example' } })).status, 403);
  assert.equal((await anna.request('/api/tickets', { method: 'POST', data: payload, headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await anna.request('/api/tickets', { method: 'POST', raw: '{' })).status, 400);
  assert.equal((await anna.request('/api/tickets', { method: 'POST', raw: '[]' })).status, 400);
  assert.equal((await anna.request('/api/tickets', { method: 'POST', raw: JSON.stringify({ body: 'x'.repeat(17000) }) })).status, 413);
  const made = await anna.json('/api/tickets', { method: 'POST', data: { ...payload, admin: true, status: 'done' } });
  assert.equal(made.status, 201); id = made.data.ticket.id; assert.equal(made.data.ticket.status, 'new');
  assert.equal((await anna.json(`/api/tickets/${id}`, { method: 'PATCH', data: { status: 'done', revision: 1, admin: true } })).status, 403);
  anna.jar.set('pa_ticket_admin', anna.jar.get('pa_ticket_visitor'));
  assert.equal((await anna.json(`/api/tickets/${id}`, { method: 'PATCH', data: { status: 'done', revision: 1 } })).status, 403);
  anna.jar.delete('pa_ticket_admin');
});

test('Reale Browser-Identitäten: Stimmen, Kommentar-Rechte und Namen bleiben getrennt', async () => {
  let r = await anna.json(`/api/tickets/${id}/vote`, { method: 'PUT', data: { active: true } }); assert.equal(r.data.ticket.votes, 1);
  r = await anna.json(`/api/tickets/${id}/vote`, { method: 'PUT', data: { active: true } }); assert.equal(r.data.ticket.votes, 1);
  r = await ben.json(`/api/tickets/${id}/vote`, { method: 'PUT', data: { active: true } }); assert.equal(r.data.ticket.votes, 2);
  r = await ben.json(`/api/tickets/${id}/comments`, { method: 'POST', data: { text: 'Ein Kommentar vom zweiten Browser' } }); assert.equal(r.status, 201);
  const comment = r.data.ticket.comments[0].id;
  assert.equal((await anna.request(`/api/tickets/${id}/comments/${comment}`, { method: 'DELETE' })).status, 403);
  assert.equal((await ben.request(`/api/tickets/${id}`, { method: 'PATCH', data: { name: 'Anna', title: 'Fremde Änderung', revision: r.data.ticket.revision } })).status, 403);
  assert.equal((await ben.request(`/api/tickets/${id}/comments/${comment}`, { method: 'DELETE' })).status, 200);
  assert.equal((await anna.json('/api/tickets?sort=votes')).data.tickets[0].votes, 2);
});

test('Admin-Anmeldung schützt Status, Bearbeiten, Export und Moderation; Konflikte überschreiben nichts', async () => {
  assert.equal((await ben.json('/api/tickets/admin/login', { method: 'POST', data: { password: 'falsch' } })).status, 401);
  assert.equal((await ben.json('/api/tickets/admin/login', { method: 'POST', data: { password: adminPassword } })).status, 200);
  let t = (await ben.json(`/api/tickets/${id}`)).data.ticket;
  const stale = t.revision;
  await anna.json(`/api/tickets/${id}/comments`, { method: 'POST', data: { text: 'Eine neue Ergänzung vor der Statusänderung' } });
  assert.equal((await ben.json(`/api/tickets/${id}`, { method: 'PATCH', data: { status: 'progress', revision: stale } })).status, 409);
  t = (await ben.json(`/api/tickets/${id}`)).data.ticket;
  const changed = await ben.json(`/api/tickets/${id}`, { method: 'PATCH', data: { status: 'progress', revision: t.revision } });
  assert.equal(changed.data.ticket.status, 'progress'); assert.equal(changed.data.ticket.history.length, 1);
  const exported = await anna.request(`/api/tickets/${id}/export.md`);
  assert.equal(exported.status, 200); assert.match(exported.headers.get('content-disposition'), /attachment.*\.md/);
  assert.match(exported.headers.get('content-type'), /text\/markdown/);
  const md = await exported.text(); assert.ok(md.includes('In Arbeit') && md.includes('Eine neue Ergänzung'));
  assert.ok(!md.includes(decodeURIComponent(anna.jar.get('pa_ticket_visitor'))));
  assert.equal((await anna.request('/api/tickets?status=progress')).status, 200);
});

test('Neustart erhält Daten und Stimmen, Passwortwechsel entzieht alte Admin-Rechte; Seiten-Logout meldet Admin ab', async () => {
  await server.stop(); await start('Anderes-Ticket-Admin-Passwort');
  let row = await ben.json(`/api/tickets/${id}`);
  assert.equal(row.data.ticket.status, 'progress'); assert.equal(row.data.ticket.voted, true); assert.equal(row.data.viewer.admin, false);
  assert.equal((await ben.request(`/api/tickets/${id}`, { method: 'DELETE' })).status, 403);
  await ben.json('/api/tickets/admin/login', { method: 'POST', data: { password: 'Anderes-Ticket-Admin-Passwort' } });
  assert.equal((await ben.json('/api/tickets')).data.viewer.admin, true);
  const logout = await ben.request('/logout', { method: 'POST' }); assert.equal(logout.status, 303);
  assert.ok(logout.headers.getSetCookie().some((c) => c.startsWith('pa_ticket_admin=') && c.includes('Max-Age=0')));
  await ben.login(); assert.equal((await ben.json('/api/tickets')).data.viewer.admin, false);
});

test('Rate-Limits gelten auch mit gültigem Gruppenpasswort', async () => {
  const headers = { 'X-Forwarded-For': '192.0.2.18' };
  for (let i = 0; i < 12; i++) assert.equal((await anna.request('/api/tickets', { method: 'POST', data: payload, headers })).status, 201);
  assert.equal((await anna.request('/api/tickets', { method: 'POST', data: payload, headers })).status, 429);
  for (let i = 0; i < 8; i++) assert.equal((await anna.request('/api/tickets/admin/login', { method: 'POST', data: { password: 'falsch' }, headers })).status, 401);
  assert.equal((await anna.request('/api/tickets/admin/login', { method: 'POST', data: { password: 'Anderes-Ticket-Admin-Passwort' }, headers })).status, 429);
});

test('Ohne Admin-Passwort bleiben normale Tickets nutzbar und Verwaltungsrechte gesperrt', async () => {
  await server.stop(); await start('');
  const row = await anna.json('/api/tickets'); assert.equal(row.status, 200); assert.equal(row.data.viewer.adminEnabled, false);
  assert.equal((await anna.request('/api/tickets/admin/login', { method: 'POST', data: { password: '' } })).status, 503);
});

test('Eine defekte Ticket-Datei wird nicht überschrieben und blockiert keine Spiele', async () => {
  await server.stop(); writeFileSync(join(dir, 'tickets.json'), 'kaputtes JSON'); await start();
  assert.equal((await anna.request('/health')).status, 200);
  assert.equal((await anna.request('/me')).status, 200);
  assert.equal((await anna.request('/api/tickets')).status, 503);
  assert.equal(readFileSync(join(dir, 'tickets.json'), 'utf8'), 'kaputtes JSON');
});
