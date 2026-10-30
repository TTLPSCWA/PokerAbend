import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { io } from 'socket.io-client';

async function until(fn, ms = 6000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) { if (fn()) return; await wait(20); }
  throw new Error('Zeitüberschreitung');
}
async function start(dataDir, password = '') {
  const child = spawn(process.execPath, ['--input-type=module', '-e', `
    const { http } = await import('./server/index.js');
    const ready = () => console.log('PROGRAM_READY:' + http.address().port);
    if (http.listening) ready(); else http.once('listening', ready);
  `], { env: { ...process.env, PORT: '0', DATA_DIR: dataDir, POKER_NO_DOTENV: '1', SITE_PASSWORD: password }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(output)), 12000);
    child.stderr.on('data', (d) => { output += d; });
    child.once('error', (e) => { clearTimeout(timer); reject(e); });
    child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Server beendet (${code}): ${output}`)); });
    child.stdout.on('data', (d) => { output += d; const match = output.match(/PROGRAM_READY:(\d+)/); if (match) { clearTimeout(timer); resolve('http://localhost:' + match[1]); } });
  });
  return { url, stop: async () => { if (child.exitCode === null && child.signalCode === null) { const exited = new Promise((resolve) => child.once('exit', resolve)); child.kill(); await exited; } } };
}
async function client(url) {
  const socket = io(url, { transports: ['websocket'], forceNew: true, reconnection: false });
  socket.state = null;
  socket.achievementEvents = [];
  socket.on('achievements', (data) => socket.achievementEvents.push(data));
  socket.on('state', (S) => { socket.state = S; });
  socket.ask = (event, data = {}) => new Promise((resolve, reject) => socket.timeout(5000).emit(event, data, (err, reply) => err ? reject(err) : resolve(reply)));
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
  return socket;
}

test('Rückblick-API verlangt Gruppenanmeldung und stellt beschädigte Archive nicht als leere Liste dar', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'review-auth-')); let server = await start(dir, 'Review-Testpasswort');
  try {
    for (const path of ['/api/evenings', '/api/evenings/00000000-0000-0000-0000-000000000000', '/api/evenings/00000000-0000-0000-0000-000000000000/export', '/api/achievements?name=Anna', '/api/achievements/players']) {
      const r = await fetch(server.url + path, { redirect: 'manual' }); assert.equal(r.status, 302); assert.match(r.headers.get('location'), /^\/login/);
    }
    const signed = await fetch(server.url + '/login', { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ password: 'Review-Testpasswort' }) });
    const cookie = signed.headers.get('set-cookie').split(';')[0];
    const listing = await fetch(server.url + '/api/evenings', { headers: { Cookie: cookie } }); assert.equal(listing.status, 200); assert.equal(listing.headers.get('cache-control'), 'no-store');
    assert.equal((await listing.json()).total, 0);
    const badges = await fetch(server.url + '/api/achievements?name=Anna', { headers: { Cookie: cookie } }); assert.equal(badges.status, 200); assert.equal(badges.headers.get('cache-control'), 'no-store'); assert.equal((await badges.json()).unlocked, 0);
    assert.equal((await fetch(server.url + '/api/achievements?name=' + 'a'.repeat(17), { headers: { Cookie: cookie } })).status, 400);
    await server.stop(); writeFileSync(join(dir, 'evening-reviews.json'), '{broken'); server = await start(dir);
    assert.equal((await fetch(server.url + '/api/evenings')).status, 503);
    assert.equal(readFileSync(join(dir, 'evening-reviews.json'), 'utf8'), '{broken');
    assert.equal((await fetch(server.url + '/health')).status, 200);
  } finally { await server.stop(); }
});

test('Rückblick: abgebrochene Station zählt nicht; Tischschluss während nächster Partie archiviert den Zwischenstand', async () => {
  const server = await start(mkdtempSync(join(tmpdir(), 'review-partial-'))), clients = [];
  try {
    const a = await client(server.url), b = await client(server.url); clients.push(a, b);
    const created = await a.ask('create', { game: 'zahlenzoo', name: 'Anna' }); await b.ask('join', { code: created.code, name: 'Ben' });
    await a.ask('sit'); await b.ask('sit');
    await a.ask('programSave', { mode: 'abend', entries: [{ game: 'zahlenzoo', settings: { rounds: 1 } }, { game: 'viergewinnt' }] });
    await a.ask('programStart'); await a.ask('abortRound');
    const id = a.state.partyProgram.id;
    assert.equal((await fetch(server.url + '/api/evenings/' + id)).status, 404);
    assert.ok((await a.ask('programNext')).ok); await a.ask('next'); await a.ask('next');
    await until(() => a.state.partyProgram.status === 'between');
    assert.ok((await a.ask('programNext')).ok); assert.ok((await a.ask('closeTable')).ok);
    const r = await (await fetch(server.url + '/api/evenings/' + id)).json();
    assert.equal(r.status, 'stopped'); assert.equal(r.stations.length, 1); assert.equal(r.stations[0].game, 'zahlenzoo'); assert.equal(r.planned, 2); assert.ok(r.endedAt > 0); assert.deepEqual(r.winners, []);
    assert.equal((await (await fetch(server.url + '/api/evenings')).json()).total, 1);
  } finally { clients.forEach((s) => s.close()); await server.stop(); }
});

test('Programm über WebSocket: Rechte, Spielwechsel, Tokens, Speichern, Neustart, Wiederholung und Siegerehrung', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'party-program-'));
  let server = await start(dir);
  const clients = [];
  try {
    let a = await client(server.url), b = await client(server.url), z = await client(server.url); clients.push(a, b, z);
    const created = await a.ask('create', { game: 'schaetzmeister', name: 'Anna' });
    const joined = await b.ask('join', { code: created.code, name: 'Ben' });
    await z.ask('join', { code: created.code, name: 'Zoe' });
    await a.ask('sit'); await b.ask('sit');
    await a.ask('custom', { text: 'Wie lautet die Geheimzahl? | 987654321 | Punkte' });
    const config = { name: 'Test-Abend', mode: 'playlist', entries: [{ game: 'schaetzmeister', settings: { rounds: 1 } }, { game: 'zahlenzoo', settings: { rounds: 1 } }] };
    assert.equal((await b.ask('programSave', config)).ok, false);
    assert.ok((await a.ask('programSave', config)).ok);
    assert.ok((await a.ask('programStart')).ok);
    await until(() => a.state?.phase === 'playing' && a.state.partyProgram?.status === 'running');
    assert.equal((await z.ask('sit')).ok, false);
    assert.equal((await a.ask('programNext')).ok, false);
    assert.equal((await a.ask('switchGame', { game: 'zahlenzoo' })).ok, false);
    assert.ok(!JSON.stringify(b.state.partyProgram).includes('987654321'));
    await a.ask('guess', { text: '987654321' }); await b.ask('guess', { text: '1' });
    await until(() => a.state.g.stage === 'reveal');
    await a.ask('next');
    await until(() => a.state.partyProgram.status === 'between');
    assert.equal(a.state.partyProgram.standings[0].name, 'Anna');
    assert.equal(a.state.partyProgram.standings[0].points, 2);
    const badgeProfile = async (name) => (await fetch(server.url + '/api/achievements?' + new URLSearchParams({ name }))).json();
    assert.equal((await badgeProfile('Anna')).unlocked, 3); assert.equal((await badgeProfile('Zoe')).stats.played, 0, 'Zuschauer erhalten keine Spiel-Abzeichen');
    await until(() => a.achievementEvents.length && b.achievementEvents.length);
    assert.deepEqual(a.achievementEvents[0].names, ['Mit dabei', 'Erster Sieg', 'Party-Star']); assert.deepEqual(b.achievementEvents[0].names, ['Mit dabei']); assert.equal(z.achievementEvents.length, 0);
    const reviewId = a.state.partyProgram.id;
    const getReview = async () => (await fetch(server.url + '/api/evenings/' + reviewId)).json();
    const listReviews = async (suffix = '') => (await fetch(server.url + '/api/evenings' + suffix)).json();
    assert.equal((await listReviews()).total, 0, 'laufende Abende sind nur per Link erreichbar');
    assert.equal((await getReview()).stations.length, 1);
    await a.ask('unlisted', { value: true });
    assert.equal((await getReview()).private, true);
    await until(() => { try { return JSON.parse(readFileSync(join(dir, 'rooms.json'), 'utf8'))[0]?.partyProgram?.status === 'between'; } catch { return false; } });
    a.close(); b.close(); z.close(); await server.stop();
    server = await start(dir);
    a = await client(server.url); b = await client(server.url); clients.push(a, b);
    assert.ok((await a.ask('join', { code: created.code, token: created.token })).ok);
    assert.ok((await b.ask('join', { code: created.code, token: joined.token })).ok);
    assert.equal(a.state.partyProgram.results.length, 1);
    assert.ok((await a.ask('programNext')).ok);
    await until(() => a.state.game === 'zahlenzoo' && a.state.phase === 'playing');
    const id = a.state.you.id;
    assert.equal(a.state.code, created.code);
    assert.equal(a.state.partyProgram.index, 1);
    assert.ok((await a.ask('abortRound')).ok);
    assert.equal(a.state.partyProgram.results.length, 1);
    assert.ok((await a.ask('programNext')).ok, 'abgebrochene Station wiederholen');
    assert.equal(a.state.partyProgram.index, 1);
    assert.equal(a.state.you.id, id);
    await a.ask('next'); await a.ask('next');
    await until(() => a.state.partyProgram.status === 'done');
    assert.equal(a.state.partyProgram.results.length, 2);
    assert.equal(a.state.partyProgram.standings.find((p) => p.name === 'Anna').points, 2);
    assert.deepEqual(a.state.partyProgram.winners, ['Anna']);
    assert.equal((await badgeProfile('Anna')).stats.played, 2); assert.equal((await badgeProfile('Anna')).unlocked, 3); assert.equal(a.achievementEvents.length, 0, 'nach dem Neustart keine doppelte Meldung bereits erreichter Abzeichen');
    const review = await getReview();
    assert.equal(review.id, reviewId); assert.equal(review.status, 'done'); assert.equal(review.stations.length, 2); assert.deepEqual(review.winners, ['Anna']);
    for (const secret of ['987654321', created.token, joined.token, created.code, a.state.you.id]) assert.ok(!JSON.stringify(review).includes(secret));
    assert.equal((await listReviews()).total, 0, 'privater Abend bleibt aus der allgemeinen Liste');
    assert.equal((await listReviews('?known=' + reviewId)).total, 1);
    const exported = await fetch(server.url + '/api/evenings/' + reviewId + '/export');
    assert.equal(exported.status, 200); assert.match(exported.headers.get('content-disposition'), /attachment/); assert.match(await exported.text(), /Gesamtwertung/);
    assert.equal((await fetch(server.url + '/api/evenings/not-an-id')).status, 404);
    assert.ok((await a.ask('programStop')).ok);
    assert.ok((await a.ask('switchGame', { game: 'maumau' })).ok);
    assert.ok((await a.ask('closeTable')).ok);
    assert.equal((await getReview()).status, 'done', 'fertiger Abend bleibt auch beim Schließen abgeschlossen');
    a.close(); b.close(); await server.stop(); server = await start(dir);
    assert.deepEqual((await getReview()).winners, ['Anna']);
  } finally { clients.forEach((socket) => socket.close()); await server.stop(); }
});

test('Abend-Modus über WebSocket: Brett → Poker → Omaha → Karten, Neustart, feste Teilnehmer und Chip-Schutz', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'evening-program-')); let server = await start(dir); const clients = [];
  try {
    let a = await client(server.url), b = await client(server.url), z = await client(server.url); clients.push(a, b, z);
    const created = await a.ask('create', { game: 'poker', name: 'Anna' }), joined = await b.ask('join', { code: created.code, name: 'Ben' });
    await z.ask('join', { code: created.code, name: 'Zoe' }); await a.ask('sit', { seat: 0 }); await b.ask('sit', { seat: 1 });
    const ids = [a.state.you.id, b.state.you.id];
    assert.ok((await a.ask('programSave', { mode: 'abend', name: 'Bunter Abend', entries: [{ game: 'viergewinnt' }, { game: 'poker', settings: { startStack: 1000 } }, { game: 'omaha', settings: { startStack: 2000 } }, { game: 'maumau' }] })).ok);
    assert.ok((await a.ask('programStart')).ok); await until(() => a.state?.game === 'viergewinnt');
    assert.equal((await z.ask('sit')).ok, false);
    for (let i = 0; i < 7; i++) { const active = a.state.turnId === ids[0] ? a : b; assert.ok((await active.ask('drop', { col: active === a ? 0 : 1 })).ok); }
    await until(() => a.state.partyProgram.status === 'between');
    assert.equal(a.state.partyProgram.standings.find((p) => p.id === ids[0]).points, 2);
    await until(() => { try { return JSON.parse(readFileSync(join(dir, 'rooms.json'), 'utf8'))[0]?.partyProgram?.status === 'between'; } catch { return false; } });
    a.close(); b.close(); z.close(); await server.stop(); server = await start(dir);
    a = await client(server.url); b = await client(server.url); clients.push(a, b);
    await a.ask('join', { code: created.code, token: created.token }); await b.ask('join', { code: created.code, token: joined.token });
    for (const [game, stack] of [['poker', 1000], ['omaha', 2000]]) {
      assert.ok((await a.ask('programNext')).ok); await until(() => a.state.game === game && a.state.hand && !a.state.hand.done);
      assert.equal(a.state.settings.autoNext, false); assert.equal(a.state.settings.gifts, false); assert.equal(a.state.settings.rebuy, 'off');
      assert.equal(a.state.seats.filter(Boolean).reduce((sum, s) => sum + s.stack, 0) + a.state.hand.bets, stack * 2);
      assert.equal((await a.ask('adjust', { id: ids[0], amount: 10000 })).ok, false);
      assert.equal((await a.ask('settings', { autoNext: true })).ok, false);
      const otherCards = a.state.seats.find((s) => s?.id === ids[1]).cards;
      assert.ok(otherCards.every((c) => c === '??'));
      if (game === 'poker') {
        assert.ok((await a.ask('abortRound')).ok); assert.equal(a.state.partyProgram.results.length, 1);
        assert.ok((await a.ask('programNext')).ok); await until(() => a.state.game === 'poker' && a.state.hand && !a.state.hand.done);
        assert.equal(a.state.partyProgram.index, 1); assert.equal(a.state.partyProgram.results.length, 1);
        assert.equal(a.state.seats.filter(Boolean).reduce((sum, s) => sum + s.stack, 0) + a.state.hand.bets, stack * 2);
      }
      const active = a.state.seats[a.state.hand.toAct].id === ids[0] ? a : b;
      assert.ok((await active.ask('action', { type: 'fold' })).ok); await until(() => a.state.partyProgram.status === 'between');
      assert.equal((await a.ask('nextHand')).ok, false); assert.equal((await a.ask('rebuy')).ok, false);
      assert.ok(!JSON.stringify(a.state.partyProgram).includes('handIds'));
    }
    assert.ok((await a.ask('programNext')).ok); await until(() => a.state.game === 'maumau');
    assert.equal(a.state.you.id, ids[0]); assert.equal(a.state.code, created.code); assert.ok(Number.isInteger(a.state.roundNo));
    assert.ok((await a.ask('abortRound')).ok); assert.equal(a.state.partyProgram.results.length, 3);
    assert.ok((await a.ask('programNext')).ok); assert.equal(a.state.partyProgram.index, 3);
    assert.ok((await b.ask('stand')).ok); await until(() => a.state.partyProgram.status === 'done');
    assert.equal(a.state.partyProgram.results.length, 4); assert.equal(a.state.partyProgram.standings.length, 2);
  } finally { clients.forEach((s) => s.close()); await server.stop(); }
});
