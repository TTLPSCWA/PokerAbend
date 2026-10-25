// Block B: Sprechblasen (letzte Aktion je Spieler) und Ergebnisfenster (wer die Runde mitgespielt hat)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room as MauMau } from '../games/maumau/room.js';
import { Room as Uno } from '../games/farbenchaos/room.js';
import { Room as Maexchen } from '../games/maexchen/room.js';
import { Room as Huetchen } from '../games/huetchen/room.js';

const seat = (r, names) => names.map((n) => { const p = r.addPlayer(n, null); r.sit(p.id); return p.id; });

test('Sprechblasen: letzte Aktion je Spieler, neueste erkennbar, neue Runde leert', () => {
  const r = new MauMau('X', {}, () => {});
  const [a, b, c] = seat(r, ['Anna', 'Ben', 'Cem']);
  r.start(a);
  assert.deepEqual(r.view(a).acts, {});
  r.discard = ['9h']; r.hands[a] = ['Kh', '8c', '7d']; r.hands[b] = ['Ac', '7s', '9s'];
  r.play(a, 'Kh');
  assert.equal(r.view(b).acts[a].text, 'legt Herz König');
  r.draw(b);
  const v = r.view(c);
  assert.equal(v.acts[b].text, 'zieht');
  assert.ok(v.acts[b].n > v.acts[a].n, 'die neueste Aktion hat die höchste Nummer');
  // 8: der Nächste setzt aus – die Blase steht am Platz dessen, der aussetzt
  r.pass(b);
  r.hands[c] = ['8h', 'Qd'];
  r.play(c, '8h');
  assert.equal(r.view(a).acts[a].text, 'setzt aus');
  // neue Runde: keine alten Blasen
  r.finishRound([c], 'Ende');
  r.start(a);
  assert.deepEqual(r.view(a).acts, {});
});

test('Sprechblasen: „UNO!“, gezogene Strafkarten, Ansage bei Mäxchen, Würfel bei MÄDN', () => {
  const u = new Uno('U', {}, () => {});
  const [a, b] = seat(u, ['Anna', 'Ben']);
  u.start(a);
  u.discard = ['5r']; u.hands[a] = ['Dr', '7r', '9g']; u.hands[b] = ['1b', '2b'];
  u.play(a, 'Dr');
  assert.equal(u.view(a).acts[b].text, 'zieht 2');
  u.play(a, '7r');
  assert.equal(u.view(b).acts[a].text, 'UNO!');

  const m = new Maexchen('M', {}, () => {});
  const [x, y] = seat(m, ['Xa', 'Yo']);
  m.start(x);
  m.throwDice(x);
  assert.equal(m.view(y).acts[x].text, 'würfelt');
  m.announce(x, 32);
  assert.equal(m.view(y).acts[x].text, 'sagt 32');

  const h = new Huetchen('H', {}, () => {});
  const [p] = seat(h, ['Pia', 'Quentin']);
  h.start(p);
  h.throwDice(p);
  assert.match(h.view(p).acts[p].text, /^würfelt [1-6]$/);
});

test('Ergebnis nennt alle, die die Runde mitgespielt haben – auch wer unterwegs ausgestiegen ist', () => {
  const r = new MauMau('X', {}, () => {});
  const [a, b, c] = seat(r, ['Anna', 'Ben', 'Cem']);
  r.start(a);
  r.stand(c); // Cem steigt aus
  r.discard = ['9h']; r.hands[a] = ['Kh']; r.hands[b] = ['Ac', '7d'];
  r.play(a, 'Kh');
  const res = r.view(a).result;
  assert.deepEqual(res.winners, [a]);
  assert.deepEqual([...res.players].sort(), [a, b, c].sort());
  assert.equal(res.points[b], 18);
});
