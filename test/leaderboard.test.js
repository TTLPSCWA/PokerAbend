// C4 Bestenliste: pro Name (Groß/Klein egal) und Spiel, gesamt und je Monat, übersteht einen Neustart.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLeaderboard } from '../server/leaderboard.js';
import { Room as MauMau } from '../games/maumau/room.js';
import { Room as Poker } from '../games/poker/room.js';

test('Bestenliste: zählt Partien, Siege, Punkte – Name ohne Groß/Klein, je Monat', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lb-'));
  let date = new Date(2026, 9, 25); // Oktober
  const lb = createLeaderboard(dir, { now: () => date });
  lb.record('maumau', [{ name: 'Anna', win: true, points: 0 }, { name: 'Ben', win: false, points: 17 }]);
  lb.record('maumau', [{ name: 'anna ', win: false, points: 9 }, { name: 'BEN', win: true, points: 0 }]);
  date = new Date(2026, 10, 2); // November
  lb.record('maumau', [{ name: 'Anna', win: true, points: 0 }, { name: 'Ben', win: false, points: 4 }]);
  lb.record('poker', [{ name: 'Anna', win: false, points: -300 }]);
  const all = Object.fromEntries(lb.table('maumau').map((r) => [r.name, r]));
  assert.deepEqual(all.Anna, { name: 'Anna', played: 3, wins: 2, points: 9 });
  assert.deepEqual(all.Ben, { name: 'Ben', played: 3, wins: 1, points: 21 }, 'gleicher Spieler trotz anderer Schreibweise');
  assert.deepEqual(lb.table('maumau', '2026-10').map((r) => r.played), [2, 2]);
  assert.deepEqual(lb.table('maumau', '2026-11').map((r) => [r.name, r.wins]), [['Anna', 1], ['Ben', 0]]);
  assert.deepEqual(lb.months(), ['2026-11', '2026-10']);
  assert.equal(lb.currentMonth(), '2026-11');
  assert.deepEqual(lb.table('poker').map((r) => r.points), [-300]);
  assert.deepEqual(lb.table('schocken'), []);
  // Speichern und wieder laden
  lb.save();
  assert.ok(existsSync(join(dir, 'leaderboard.json')));
  const again = createLeaderboard(dir);
  assert.equal(again.table('maumau').length, 2);
  assert.equal(again.table('maumau', '2026-10').find((r) => r.name === 'Ben').points, 17);
});

test('Spiele melden ihre Ergebnisse: Rundenspiel nach jeder Runde, Poker nach jeder Hand', () => {
  const events = [];
  const r = new MauMau('X', {}, (kind, data) => events.push({ kind, data }));
  const [a, b] = ['Anna', 'Ben'].map((n) => { const p = r.addPlayer(n, null); r.sit(p.id); return p.id; });
  r.start(a);
  r.discard = ['9h']; r.hands[a] = ['Kh']; r.hands[b] = ['Ac', '7d'];
  r.play(a, 'Kh');
  const res = events.find((e) => e.kind === 'result');
  assert.deepEqual(res.data.entries, [{ name: 'Anna', win: true, points: 0 }, { name: 'Ben', win: false, points: 18 }]);

  const pe = [];
  const p = new Poker('Y', { autoNext: false, turnTime: 0 }, (kind, data) => pe.push({ kind, data }));
  const ids = ['Anna', 'Ben'].map((n, i) => { const x = p.addPlayer(n, null); p.sit(x.id, i); return x.id; });
  p.start(ids[0]);
  const actor = p.playerAt(p.table.hand.toAct);
  p.act(actor.id, { type: 'fold' });
  const pr = pe.find((e) => e.kind === 'result').data.entries;
  assert.equal(pr.length, 2);
  assert.equal(pr.reduce((s, e) => s + e.points, 0), 0, 'Chips wandern nur, Summe bleibt 0');
  assert.equal(pr.find((e) => e.name === actor.name).win, false);
  assert.ok(pr.find((e) => e.win).points > 0);
  clearTimeout(p.turnTimer); clearTimeout(p.nextTimer); clearTimeout(p.nudgeTimer);
});
