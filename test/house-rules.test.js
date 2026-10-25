// Regel-Optionen pro Spiel: jede Einstellung einzeln, Standard = bisheriges Verhalten.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room as MauMau } from '../games/maumau/room.js';
import { Room as UNO } from '../games/farbenchaos/room.js';
import { Room as Maexchen, MAEXCHEN } from '../games/maexchen/room.js';
import { Room as Schocken } from '../games/schocken/room.js';
import { Room as Maedn } from '../games/huetchen/room.js';
import { Room as Phase10 } from '../games/zehnetappen/room.js';
import { GAMES } from '../games/index.js';

function setup(Room, names = ['Anna', 'Ben', 'Carla'], settings = {}) {
  const r = new Room('TESTX', settings, () => {});
  const ids = names.map((n) => { const p = r.addPlayer(n, null); r.sit(p.id); return p.id; });
  r.start(ids[0]);
  return { r, ids };
}
const seq = (...vals) => () => { if (!vals.length) throw new Error('Würfel aufgebraucht'); return vals.shift(); };

test('Optionen: jedes Spiel beschreibt sie, Host ändert sie nur zwischen den Runden, Unsinn wird ignoriert', () => {
  for (const g of Object.values(GAMES)) {
    if (g.id === 'poker') continue;
    const r = g.create('X', {}, () => {});
    for (const o of g.options) {
      assert.ok(o.label && ['bool', 'number'].includes(o.type), `${g.id}.${o.key}`);
      assert.ok(o.key in r.settings, `${g.id}.${o.key} hat einen Standardwert`);
    }
    r.dispose();
  }
  const { r, ids: [a, b] } = setup(MauMau, ['Anna', 'Ben']);
  assert.throws(() => r.updateSettings(a, { ace: true }), /zwischen den Runden/);
  r.phase = 'over';
  assert.throws(() => r.updateSettings(b, { ace: true }), /Nur der Host/);
  r.updateSettings(a, { ace: 'ja', handSize: 99, unbekannt: 1 });
  assert.equal(r.settings.ace, true);
  assert.equal(r.settings.handSize, 5, 'außerhalb der Grenzen bleibt der alte Wert');
  assert.ok(!('unbekannt' in r.settings));
});

// ---------- Mau-Mau ----------
test('Mau-Mau: 7, 8 und Bube abschaltbar, Bube auf Bube, Ass nochmal', () => {
  const { r, ids: [a, b] } = setup(MauMau, ['Anna', 'Ben', 'Carla'], { seven: false, eight: false, jackWish: false, ace: true });
  r.discard = ['9h'];
  r.hands[a] = ['7h', '8h', 'Ah', 'Jc', 'Kd'];
  r.play(a, '7h');
  assert.equal(r.pending, 0, '7 ohne Wirkung');
  r.turn = 0; r.play(a, '8h');
  assert.equal(r.currentId, b, '8 ohne Aussetzen');
  r.turn = 0;
  assert.throws(() => r.play(a, 'Jc'), /passt nicht/, 'Bube ist eine normale Karte');
  r.play(a, 'Ah');
  assert.equal(r.currentId, a, 'Ass: nochmal dran');
  const j = setup(MauMau, ['Anna', 'Ben'], { jackOnJack: true });
  j.r.discard = ['Jh']; j.r.hands[j.ids[0]] = ['Js', '2c'];
  j.r.play(j.ids[0], 'Js', 'c');
  assert.equal(j.r.wish, 'c');
});

test('Mau-Mau: ohne Stapeln muss man die 2 ziehen', () => {
  const { r, ids: [a, b] } = setup(MauMau, ['Anna', 'Ben'], { sevenStack: false });
  r.discard = ['9h']; r.hands[a] = ['7h', 'Kc']; r.hands[b] = ['7c', 'Qd'];
  r.play(a, '7h');
  assert.deepEqual(r.view(b).g.playable, [], 'die 7 hilft nicht');
  r.draw(b);
  assert.equal(r.hands[b].length, 4);
});

test('Mau-Mau: „Mau“ vergessen = 1 Strafkarte, gesagt = keine', () => {
  const { r, ids: [a, b] } = setup(MauMau, ['Anna', 'Ben'], { mauCall: true });
  r.discard = ['9h']; r.hands[a] = ['Kh', 'Qh', '2c']; r.hands[b] = ['Th', 'Ts', '3c'];
  r.play(a, 'Kh');           // noch 2 Karten – nichts passiert
  r.play(b, 'Th', null, true); // sagt Mau
  assert.equal(r.hands[b].length, 2);
  r.hands[a] = ['Qh', '2c'];
  r.play(a, 'Qh');           // vergisst Mau
  assert.equal(r.hands[a].length, 2, '1 Strafkarte');
  assert.ok(r.log.some((l) => l.text === 'Anna hat „Mau“ vergessen – eine Strafkarte'));
  assert.ok(r.view(a).g.callNeeded);
});

test('Mau-Mau: erste Karte wirkt (7 und 8)', () => {
  const seven = new MauMau('X', { firstCardEffect: true }, () => {});
  const ids = ['Anna', 'Ben'].map((n) => { const p = seven.addPlayer(n, null); seven.sit(p.id); return p.id; });
  seven.firstCard = () => '7h';
  seven.start(ids[0]);
  assert.equal(seven.pending, 2);
  const eight = new MauMau('Y', { firstCardEffect: true }, () => {});
  const ids2 = ['Anna', 'Ben'].map((n) => { const p = eight.addPlayer(n, null); eight.sit(p.id); return p.id; });
  eight.firstCard = () => '8h';
  eight.start(ids2[0]);
  assert.equal(eight.currentId, ids2[1], 'der Erste setzt aus');
});

// ---------- UNO ----------
test('UNO: +2/+4 stapeln – wer nicht drauflegt, zieht alles', () => {
  const { r, ids: [a, b, c] } = setup(UNO, ['Anna', 'Ben', 'Carla'], { stacking: true });
  r.discard = ['5r']; r.hands[a] = ['Dr', '1g']; r.hands[b] = ['Dg', '9y']; r.hands[c] = ['Fw', '3b'];
  r.play(a, 'Dr');
  assert.equal(r.pending, 2);
  assert.deepEqual(r.view(b).g.playable, ['Dg']);
  r.play(b, 'Dg');
  r.play(c, 'Fw', 'y');
  assert.equal(r.pending, 8);
  const before = r.hands[a].length;
  r.draw(a);
  assert.equal(r.hands[a].length, before + 8);
  assert.equal(r.currentId, b, 'und setzt aus');
});

test('UNO: ziehen bis es passt, +4 nur ohne Farbe, „UNO“ vergessen = 2 Strafkarten', () => {
  const { r, ids: [a, b] } = setup(UNO, ['Anna', 'Ben'], { drawUntil: true, strictPlus4: true, unoCall: true });
  r.discard = ['5r']; r.hands[a] = ['1g', '2g']; r.deck.push('9r', '3b', '7y');
  r.draw(a);
  assert.equal(r.drawn, '9r', 'gezogen bis zur roten 9');
  assert.equal(r.hands[a].length, 5);
  r.pass(a);
  r.hands[b] = ['Fw', '4r', '6g'];
  assert.throws(() => r.play(b, 'Fw', 'g'), /passt nicht/, 'Ben hat Rot');
  r.play(b, '4r');         // noch 2 Karten
  r.hands[a] = ['3r', '8g'];
  r.play(a, '3r');         // auf 1 Karte, ohne UNO
  assert.equal(r.hands[a].length, 3);
});

test('UNO: Startkarte wirkt', () => {
  const make = (card) => {
    const r = new UNO('X', { startAction: true }, () => {});
    const ids = ['Anna', 'Ben', 'Carla'].map((n) => { const p = r.addPlayer(n, null); r.sit(p.id); return p.id; });
    r.firstCard = () => card;
    r.start(ids[0]);
    return { r, ids };
  };
  const s = make('Sr');
  assert.equal(s.r.currentId, s.ids[1], 'Aussetzen');
  const rev = make('Rg');
  assert.equal(rev.r.dir, -1);
  const d = make('Db');
  assert.equal(d.r.hands[d.ids[0]].length, 9, '+2: der Erste zieht 2');
  assert.equal(d.r.currentId, d.ids[1]);
  const w = make('Ww');
  w.r.hands[w.ids[0]] = ['3g', '4y'];
  w.r.play(w.ids[0], '3g');
  assert.equal(w.r.discard.at(-1), '3g', 'Farbwahl am Anfang: jede Karte passt');
});

// ---------- Mäxchen ----------
test('Mäxchen: Mäxchen nur 1 Leben, ungesehen weitergeben', () => {
  const { r, ids: [a, b, c] } = setup(Maexchen, ['Anna', 'Ben', 'Carla'], { maexchenDouble: false, blindPass: true });
  r.roll = seq(4, 1);
  r.throwDice(a); r.announce(a, 41);
  r.passBlind(b, 42);
  assert.equal(r.currentId, c);
  assert.equal(r.last.actual, 41, 'derselbe Wurf');
  r.doubt(c);
  assert.equal(r.lives[b], 2, 'Ben hat höher angesagt als der Wurf');
  r.roll = seq(1, 2);
  r.throwDice(b); r.announce(b, MAEXCHEN);
  assert.throws(() => r.passBlind(c, 21), /nicht überbieten/);
  r.doubt(c);
  assert.equal(r.lives[c], 2, 'ohne Option kostet Mäxchen nur 1');
  const off = setup(Maexchen, ['Anna', 'Ben']);
  off.r.roll = seq(4, 1); off.r.throwDice(off.ids[0]); off.r.announce(off.ids[0], 41);
  assert.throws(() => off.r.passBlind(off.ids[1], 42), /aus/);
});

// ---------- Schocken ----------
test('Schocken: zwei Sechsen zu einer Eins', () => {
  const { r, ids: [a] } = setup(Schocken, ['Anna', 'Ben'], { sixToOne: true });
  r.roll = seq(6, 6, 3, 1, 1);
  r.throwDice(a);
  r.turnSixes(a);
  assert.deepEqual(r.dice[a], [1, 6, 3]);
  r.throwDice(a, [2]); // Eins bleibt liegen, die zweite 6 wird neu geworfen, 3 bleibt
  assert.deepEqual(r.dice[a], [1, 1, 3]);
  assert.throws(() => r.turnSixes(a), /zwei Sechsen|kein Wurf/);
});

test('Schocken: ganzes Spiel – zwei Hälften, bei verschiedenen Verlierern Finale', () => {
  const { r, ids: [a, b, c] } = setup(Schocken, ['Anna', 'Ben', 'Carla'], { fullGame: true });
  r.loseHalf(a);
  assert.equal(r.phase, 'over');
  assert.deepEqual(r.scores, {}, '1. Hälfte zählt noch nicht');
  r.start(a); r.loseHalf(b);
  assert.deepEqual(r.finale, [a, b]);
  r.start(a);
  assert.deepEqual([...r.order].sort(), [a, b].sort(), 'nur die beiden im Finale');
  assert.ok(r.isFinale);
  r.loseHalf(b);
  assert.deepEqual(r.scores, { [b]: 1 });
  assert.match(r.result.text, /verliert das Finale/);
  r.start(a); r.loseHalf(c); r.start(a); r.loseHalf(c);
  assert.equal(r.scores[c], 1, 'beide Hälften verloren = Spiel verloren');
});

// ---------- Mensch ärgere Dich nicht ----------
test('Mensch ärgere Dich nicht: Schlagzwang, keine 6-Pflicht, ohne Nochmal, ohne drei Versuche', () => {
  const { r, ids: [a, b] } = setup(Maedn, ['Anna', 'Ben'], { forceCapture: true });
  // Anna: Figur auf 5 (schlägt mit 3 Ben auf Feld 8), Figur auf 20 (freier Zug)
  r.pieces[a] = [5, 20, -1, -1]; r.pieces[b] = [38, -1, -1, -1]; // Ben 38 → Feld (10+38)%40 = 8
  r.roll = seq(3);
  r.throwDice(a);
  assert.deepEqual(r.options, [0], 'nur der schlagende Zug');
  const free = setup(Maedn, ['Anna', 'Ben'], { mustExit: false, sixAgain: false, threeTries: false });
  free.r.pieces[free.ids[0]] = [10, -1, -1, -1];
  free.r.roll = seq(6);
  free.r.throwDice(free.ids[0]);
  assert.deepEqual(free.r.options.sort(), [0, 1], 'raus oder weiterziehen – freie Wahl');
  free.r.move(free.ids[0], 0);
  assert.equal(free.r.currentId, free.ids[1], 'ohne Nochmal nach der 6');
  free.r.roll = seq(2);
  free.r.throwDice(free.ids[1]);
  assert.equal(free.r.currentId, free.ids[0], 'nur ein Versuch');
});

// ---------- Phase 10 ----------
test('Phase 10: Aussetzen trifft den Nächsten, Phase größer auslegen, Aussetzen als erste Ablage', () => {
  const { r, ids: [a, b, c] } = setup(Phase10, ['Anna', 'Ben', 'Carla'], { skipChoose: false, exactSize: false });
  let k = 9000;
  const C = (col, n) => ({ id: k++, c: col, n });
  r.hands[a] = [C('r', 4), C('g', 4), C('b', 4), C('y', 4), C('r', 9), C('g', 9), C('b', 9), C('s', 0), C('y', 1)];
  r.deck.push(C('y', 2));
  r.drawCard(a, 'deck');
  r.layPhase(a, r.hands[a].filter((x) => x.n === 4 || x.n === 9).map((x) => x.id)); // Vierling + Drilling für „2 Drillinge“
  assert.equal(r.laid[a].reduce((s, g) => s + g.cards.length, 0), 7);
  r.throwAway(a, r.hands[a].find((x) => x.c === 's').id, c); // Ziel wird ignoriert
  assert.ok(r.log.some((l) => l.text === 'Anna lässt Ben aussetzen'));
  assert.equal(r.currentId, c);
  const first = new Phase10('X', { firstSkip: true }, () => {});
  const ids = ['Anna', 'Ben'].map((n) => { const p = first.addPlayer(n, null); first.sit(p.id); return p.id; });
  first.pickFirst = () => ({ id: 999, c: 's', n: 0 });
  first.start(ids[0]);
  assert.equal(first.discard[0].c, 's');
  assert.equal(first.currentId, ids[1], 'Anna setzt aus');
  assert.ok(b);
});
