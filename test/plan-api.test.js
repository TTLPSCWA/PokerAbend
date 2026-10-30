import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeProgram } from '../server/party-program.js';

const password = 'Planung-Testpasswort';
async function start(dir) {
  const child = spawn(process.execPath, ['--input-type=module', '-e', `
    const { http } = await import('./server/index.js');
    const ready = () => console.log('PLAN_READY:' + http.address().port);
    if (http.listening) ready(); else http.once('listening', ready);
  `], { env: { ...process.env, PORT: '0', DATA_DIR: dir, POKER_NO_DOTENV: '1', SITE_PASSWORD: password, TRUST_PROXY: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Testserver: ' + output)), 12000);
    child.stderr.on('data', (d) => { output += d; }); child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Server beendet (${code}): ${output}`)); });
    child.stdout.on('data', (d) => { output += d; const match = output.match(/PLAN_READY:(\d+)/); if (match) { clearTimeout(timer); resolve('http://localhost:' + match[1]); } });
  });
  return { url, stop: async () => { if (child.exitCode === null && child.signalCode === null) { const done = new Promise((resolve) => child.once('exit', resolve)); child.kill(); await done; } } };
}
function client(url, name = 'Anna') {
  const jar = new Map();
  async function raw(path, method = 'GET', data = {}, headers = {}) {
    const options = { method, redirect: 'manual', headers: { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), ...headers } };
    if (!['GET', 'HEAD'].includes(method)) { options.headers['Content-Type'] ||= 'application/json'; options.headers['X-Requested-With'] ??= 'spieleabend'; options.body = typeof data === 'string' ? data : JSON.stringify({ name, avatar: '🦉', ...data }); }
    const res = await fetch(url + path, options);
    for (const cookie of res.headers.getSetCookie()) { const part = cookie.split(';')[0], i = part.indexOf('='); jar.set(part.slice(0, i), part.slice(i + 1)); }
    return res;
  }
  return { jar, raw, json: async (...args) => { const res = await raw(...args); return { status: res.status, data: await res.json() }; },
    login: async () => assert.equal((await raw('/login', 'POST', new URLSearchParams({ password }).toString(), { 'Content-Type': 'application/x-www-form-urlencoded' })).status, 303) };
}
const payload = () => ({ title: 'Planungs-Testabend', description: 'Zusammen spielen', slots: [Date.now() + 3 * 86400000], games: ['maumau', 'poker'], private: true });

test('Planungs-API: Gruppenanmeldung, Herkunftsschutz, signierte Kennung, Rechte, Abstimmung und gültiger Programm-Export', async () => {
  const server = await start(mkdtempSync(join(tmpdir(), 'plan-api-')));
  try {
    const a = client(server.url), b = client(server.url, 'Anna');
    assert.equal((await a.raw('/api/plans')).status, 302); assert.equal((await a.raw('/api/plans', 'POST', payload())).status, 401);
    await a.login(); await b.login();
    const initial = await a.raw('/api/plans'); assert.equal(initial.status, 200); assert.equal(initial.headers.get('cache-control'), 'no-store');
    assert.match(initial.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/); assert.match(initial.headers.get('set-cookie'), /Path=\/api\/plans/);
    assert.equal((await a.raw('/api/plans', 'POST', payload(), { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await a.raw('/api/plans', 'POST', payload(), { 'X-Requested-With': '' })).status, 403);
    assert.equal((await a.raw('/api/plans', 'POST', '{}', { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await a.raw('/api/plans', 'POST', '{broken')).status, 400);
    assert.equal((await a.raw('/api/plans', 'POST', '[]')).status, 400);
    assert.equal((await a.raw('/api/plans', 'POST', { ...payload(), description: 'x'.repeat(18000) })).status, 413);
    const created = await a.json('/api/plans', 'POST', { ...payload(), owner: { id: 'f'.repeat(32) }, status: 'fixed' });
    assert.equal(created.status, 201); let p = created.data.plan; assert.equal(p.status, 'open'); assert.equal(p.canManage, true);
    const id = p.id;
    assert.equal((await b.json('/api/plans')).data.total, 0);
    assert.equal((await b.json('/api/plans?known=' + id)).data.total, 1);
    assert.equal((await b.json('/api/plans/' + id)).data.plan.canManage, false, 'gleicher Name gibt keine Host-Rechte');
    assert.equal((await b.raw('/api/plans/' + id, 'PATCH', { action: 'fix', revision: p.revision, slot: p.slots[0].id, games: ['poker'] })).status, 403);
    assert.equal((await b.raw('/api/plans/' + id, 'DELETE', { revision: p.revision })).status, 403);
    assert.equal((await a.raw('/api/plans/' + id + '/program')).status, 409);
    p = (await b.json('/api/plans/' + id + '/vote', 'PUT', { answers: { [p.slots[0].id]: 'maybe' }, games: ['poker'], voteRevision: 0 })).data.plan;
    assert.equal(p.participants, 1); assert.equal(p.slots[0].maybe, 1);
    assert.equal((await b.raw('/api/plans/' + id + '/vote', 'PUT', { answers: {}, games: [], voteRevision: 0 })).status, 409);
    const proposed = await b.json('/api/plans/' + id + '/games', 'POST', { game: 'viergewinnt' }); assert.equal(proposed.status, 200);
    p = (await a.json('/api/plans/' + id)).data.plan;
    const fixed = await a.json('/api/plans/' + id, 'PATCH', { action: 'fix', revision: p.revision, slot: p.slots[0].id, games: ['poker', 'maumau'] });
    assert.equal(fixed.status, 200); p = fixed.data.plan; assert.equal(p.status, 'fixed');
    const exported = await b.json('/api/plans/' + id + '/program'); assert.equal(exported.status, 200); assert.equal(exported.data.private, true);
    assert.deepEqual(exported.data.config.entries.map((e) => e.game), ['poker', 'maumau']);
    assert.deepEqual(normalizeProgram(exported.data.config), exported.data.config);
    assert.equal((await b.raw('/api/plans/' + id + '/vote', 'PUT', { answers: {}, games: [], voteRevision: 1 })).status, 409);
    const tampered = client(server.url); for (const [k, v] of a.jar) tampered.jar.set(k, v);
    tampered.jar.set('pa_plan_visitor', a.jar.get('pa_plan_visitor') + 'x');
    assert.equal((await tampered.json('/api/plans/' + id)).data.plan.canManage, false);
    assert.equal((await tampered.raw('/api/plans/' + id, 'DELETE', { revision: p.revision })).status, 403);
    const json = JSON.stringify(p);
    for (const visitor of [a, b]) { const token = decodeURIComponent(visitor.jar.get('pa_plan_visitor')); assert.ok(!json.includes(token)); assert.ok(!json.includes(token.split('.')[0])); }
    assert.equal((await a.raw('/api/plans/not-an-id')).status, 404); assert.equal((await a.raw('/api/plans/' + id + '/unknown')).status, 404);
    assert.equal((await a.raw('/api/plans/' + id, 'DELETE', { revision: p.revision })).status, 200);
    assert.equal((await a.raw('/api/plans/' + id)).status, 404);
  } finally { await server.stop(); }
});

test('Planungs-API: Eigentum und Stimmen nach Serverneustart; defektes Archiv bleibt unangetastet', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'plan-restart-')); let server = await start(dir);
  try {
    const a = client(server.url); await a.login(); let p = (await a.json('/api/plans', 'POST', payload())).data.plan;
    p = (await a.json('/api/plans/' + p.id + '/vote', 'PUT', { answers: { [p.slots[0].id]: 'yes' }, games: ['maumau'], voteRevision: 0 })).data.plan;
    await server.stop(); server = await start(dir); const restored = client(server.url); for (const [k, v] of a.jar) restored.jar.set(k, v);
    const view = (await restored.json('/api/plans/' + p.id)).data.plan; assert.equal(view.canManage, true); assert.equal(view.mine.revision, 1); assert.equal(view.slots[0].yes, 1);
    await server.stop(); const file = join(dir, 'evening-plans.json'); writeFileSync(file, '{broken'); server = await start(dir); const c = client(server.url); await c.login();
    assert.equal((await c.raw('/api/plans')).status, 503); assert.equal((await c.raw('/api/plans', 'POST', payload())).status, 503); assert.equal(readFileSync(file, 'utf8'), '{broken');
    assert.equal((await c.raw('/health')).status, 200);
  } finally { await server.stop(); }
});

test('Planungs-API: Mengenbegrenzung für Änderungen und Erstellung; Secure-Cookie hinter HTTPS-Proxy', async () => {
  const server = await start(mkdtempSync(join(tmpdir(), 'plan-limits-')));
  try {
    const a = client(server.url); await a.login();
    const initial = await a.raw('/api/plans', 'GET', {}, { 'X-Forwarded-Proto': 'https' }); assert.match(initial.headers.get('set-cookie'), /; Secure/);
    let p = (await a.json('/api/plans', 'POST', payload())).data.plan;
    for (let i = 1; i < 12; i++) assert.equal((await a.raw('/api/plans', 'POST', payload())).status, 201);
    assert.equal((await a.raw('/api/plans', 'POST', payload())).status, 429);
    for (let i = 0; i < 120; i++) assert.equal((await a.raw('/api/plans/' + p.id + '/games', 'POST', { game: 'not-valid' })).status, 400);
    assert.equal((await a.raw('/api/plans/' + p.id + '/games', 'POST', { game: 'viergewinnt' })).status, 429);
    assert.equal((await a.raw('/api/plans')).status, 200);
  } finally { await server.stop(); }
});
