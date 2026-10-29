import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as wait } from 'node:timers/promises';
import { GAMES } from '../games/index.js';
import { ARENA, STEP_MS } from '../games/realtime-room.js';
import { normalizeProgram } from '../server/party-program.js';

const games = ['broeckelboden', 'kronenjagd', 'laser-huepfer'];
function setup(game, n = 2, settings = {}, onChange = () => {}) {
  const r = GAMES[game].create('ARENA', { playSecs: 10, ...settings }, onChange); r.game = game;
  const ids = Array.from({ length: n }, (_, i) => { const p = r.addPlayer(`Mensch ${i + 1}`, null); p.connected = true; r.sit(p.id); return p.id; });
  const spectator = r.addPlayer('Zuschauer', null); spectator.connected = true;
  r.start(ids[0]); return { r, ids, spectator: spectator.id };
}
function advance(r, ms) { for (let t = 0; t < ms && r.phase === 'playing'; t += STEP_MS) r.step(); }
function input(r, id, patch = {}) { const d = { runId: r.runId, round: r.roundNo, seq: (r.inputs.get(id)?.seq || 0) + 1, x: 0, y: 0, jump: false, ...patch }; r.input(id, d); return d; }

test('Echtzeit-Eingaben: nur Teilnehmer, ganze Richtungen, passende Runde und steigende Sequenz', () => {
  for (const game of games) {
    const { r, ids: [a], spectator } = setup(game); r.elapsed = 0;
    const before = { ...r.bodies[0] };
    for (const patch of [{ runId: 'alt' }, { round: 0 }, { seq: 0 }, { seq: Infinity }, { x: 10 }, { y: .1 }, { x: null }, { jump: 'ja' }]) assert.throws(() => input(r, a, patch));
    assert.throws(() => input(r, spectator), /zuschauen|schaust/);
    const sent = input(r, a, { x: -1, y: 1, position: { x: 0, y: 0 }, dt: 1e9, points: 99999 });
    assert.throws(() => r.input(a, sent), /veraltet/);
    r.step(); assert.ok(Math.abs(Math.hypot(r.bodies[0].x - before.x, r.bodies[0].y - before.y) - 190 * .05) < .001);
    assert.equal(r.points[a], 0);
    r.eliminate([a]); assert.throws(() => input(r, a), /schaust/); r.dispose();
  }
});

test('Countdown, normalisierte Diagonale, Eingabeverfall, Rand und Verbindungsabbruch', () => {
  const { r, ids: [a] } = setup('kronenjagd');
  const p = r.bodies[0], origin = { ...p };
  input(r, a, { x: -1 }); advance(r, 2950); assert.equal(p.x, origin.x);
  r.elapsed = 0; input(r, a, { x: -1 }); advance(r, 1000);
  assert.ok(Math.abs(origin.x - p.x - 66.5) < .001, 'alte Richtung endet nach 350 ms');
  const stopped = p.x; r.players.get(a).connected = false; input(r, a, { x: -1 }); advance(r, 100); assert.equal(p.x, stopped);
  r.players.get(a).connected = true; p.x = ARENA.radius; input(r, a, { x: -1 }); advance(r, 100); assert.equal(p.x, ARENA.radius);
  r.dispose();
});

test('Bröckelboden: Löcher, gleichzeitiges Fallen, schrumpfender Rand und Platzierungspunkte', () => {
  let { r, ids: [a, b] } = setup('broeckelboden'); r.elapsed = 0;
  r.step(); const tile = r.tileOf(r.bodies[0]); assert.equal(r.tiles[tile], 950);
  r.tiles[tile] = -1; r.step(); assert.equal(r.phase, 'over'); assert.deepEqual(r.result.winners, [b]); assert.equal(r.result.points[b], 100); r.dispose();
  ({ r } = setup('broeckelboden')); r.elapsed = 0;
  for (const p of r.bodies) r.tiles[r.tileOf(p)] = -1;
  r.step(); assert.equal(r.phase, 'over'); assert.deepEqual(r.result.winners, []); assert.ok(Object.values(r.result.points).every((n) => n === 0)); r.dispose();
  ({ r } = setup('broeckelboden')); r.elapsed = 17950; r.settings.playSecs = 60; r.bodies[0].x = 20;
  r.step(); assert.equal(r.tiles[0], -1); assert.equal(r.bodies[0].alive, false); r.dispose();
});

test('Bröckelboden: Startlöcher bleiben von Startplätzen weg; erlaubter Sprung überbrückt ein Loch', () => {
  const { r, ids: [a] } = setup('broeckelboden', 3, { holes: true, jump: true });
  for (const p of r.bodies) assert.notEqual(r.tiles[r.tileOf(p)], -1);
  r.elapsed = 0; r.tiles[r.tileOf(r.bodies[0])] = -1;
  input(r, a, { jump: true }); advance(r, 400); assert.equal(r.bodies[0].alive, true);
  const until = r.bodies[0].jumpUntil; input(r, a, { jump: true }); assert.equal(r.bodies[0].jumpUntil, until, 'kein Dauerflug durch wiederholte Eingaben');
  advance(r, 200); assert.equal(r.bodies[0].alive, false); r.dispose();
});

test('Kronenjagd: Aufnehmen, Haltezeit, langsamerer Träger, Stehlen und Schutzfrist', () => {
  const { r, ids: [a, b] } = setup('kronenjagd'); r.elapsed = 0;
  const p = r.bodies[0], q = r.bodies[1]; p.x = 450; p.y = 300;
  r.step(); assert.equal(r.crown.holder, a); advance(r, 1000); assert.equal(r.points[a], 1);
  input(r, a, { x: 1 }); const x = p.x; r.step(); assert.equal(p.x - x, 145 * .05);
  input(r, a); q.x = p.x; q.y = p.y; r.step(); assert.equal(r.crown.holder, b);
  r.step(); assert.equal(r.crown.holder, b, 'Krone springt nicht sofort zurück');
  advance(r, 1100); assert.ok(r.points[b] >= 1); r.dispose();
});

test('Laser: Vorwarnung, wechselnde Richtungen, steigendes Tempo und zwei Strahlen', () => {
  const { r } = setup('laser-huepfer', 2, { doubleLaser: true }); r.elapsed = 0;
  r.step(); assert.equal(r.hazards.length, 2); assert.ok(r.hazards.every((h) => h.warning));
  advance(r, 1200); assert.ok(r.hazards.every((h) => !h.warning));
  const speed = r.hazards[0].speed; r.wave = 4; r.waveAt = r.elapsed;
  r.step(); assert.ok(r.hazards.every((h) => h.speed > speed)); r.dispose();
});

test('Laser: überstrichene Figur trifft, Sprung schützt, Leben und Trefferpause gelten', () => {
  const { r, ids: [a] } = setup('laser-huepfer', 3, { lives: 2 }); r.elapsed = 0;
  const p = r.bodies[0]; p.x = 500;
  r.hazards = [{ id: 'test', axis: 'x', pos: 200, warning: false }];
  r.makeHazards = () => [{ id: 'test', axis: 'x', pos: 800, warning: false }];
  r.step(); assert.equal(p.lives, 1, 'auch ein komplett zwischen Frames vorbeigezogener Strahl trifft');
  r.makeHazards = () => [{ id: 'test', axis: 'x', pos: p.x, warning: false }];
  advance(r, 200); assert.equal(p.lives, 1, 'ein Kontakt zieht nicht sofort alle Leben ab');
  p.immuneUntil = 0; input(r, a, { jump: true }); advance(r, 400); assert.equal(p.alive, true);
  advance(r, 200); assert.equal(p.alive, false); r.dispose();
});

test('Rundenende, Abbruch, Ausstieg und Wiederherstellung vergeben keine doppelten Punkte', () => {
  for (const game of games) {
    const { r, ids: [a, b] } = setup(game);
    const key = r.runId; r.abortRound(a); r.start(a); assert.notEqual(r.runId, key);
    assert.throws(() => input(r, a, { runId: key }), /Runde/);
    r.elapsed = 0; r.stand(b); assert.equal(r.phase, 'over');
    const scores = { ...r.scores }; r.step(); r.finishArena(); assert.deepEqual(r.scores, scores);
    const restored = GAMES[game].restore(JSON.parse(JSON.stringify(r.snapshot())), () => {});
    assert.equal(restored.phase, 'lobby'); assert.equal(restored.byToken(r.players.get(a).token).id, a); assert.equal(restored.loop, null);
    assert.ok(!JSON.stringify(r.frame()).includes(r.players.get(a).token));
    assert.equal(normalizeProgram({ mode: 'playlist', entries: [{ game, settings: { playSecs: 10 } }] }).entries[0].game, game);
    restored.dispose(); r.dispose();
  }
});

test('Echtzeit-Bots: 2–8 Teilnehmer, regelkonforme Bewegung und jede Partie endet', () => {
  for (const game of games) for (let n = 2; n <= 8; n++) {
    const { r } = setup(game, n, { jump: true, lives: 3, doubleLaser: true });
    for (const p of r.bodies) r.players.get(p.id).bot = true;
    let moves = 0;
    while (r.phase === 'playing') {
      const before = r.bodies.map((p) => ({ ...p })); r.step();
      r.bodies.forEach((p, i) => {
        assert.ok(p.x >= ARENA.radius && p.x <= ARENA.width - ARENA.radius && p.y >= ARENA.radius && p.y <= ARENA.height - ARENA.radius);
        assert.ok(Math.hypot(p.x - before[i].x, p.y - before[i].y) <= 190 * .05 + .001);
      });
      assert.ok(++moves <= 262, `${game}: Timer muss die Partie beenden`);
    }
    assert.equal(r.phase, 'over'); assert.ok(r.result); assert.equal(r.loop, null); r.dispose();
  }
});

test('Echtzeit-Timer startet nur einmal, sendet Frames und stoppt nach Abbruch', async () => {
  let frames = 0;
  const { r, ids: [a] } = setup('kronenjagd', 2, {}, (kind) => { if (kind === 'frame') frames++; });
  r.afterChange(); const timer = r.loop; r.afterChange(); assert.equal(r.loop, timer);
  try {
    for (let i = 0; !frames && i < 30; i++) await wait(20);
    assert.ok(frames > 0); r.abortRound(a); assert.equal(r.loop, null);
    const count = frames; await wait(150); assert.equal(frames, count);
  } finally { r.dispose(); }
});
