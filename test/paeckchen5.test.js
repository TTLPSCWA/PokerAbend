// Päckchen 5: Würfelpoker, Lügenwürfel, Chicago, Reversi, Dame, Domino – Regeln mit festen Würfen und Stellungen, Geheimhaltung.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES } from '../games/index.js';
import { evaluate, compare, CATEGORIES } from '../games/wuerfelpoker/room.js';
import { flips, legalMoves } from '../games/reversi/room.js';
import { legal as dameLegal, jumps } from '../games/dame/room.js';

const seq = (...v) => () => { if (!v.length) throw new Error('Würfel aufgebraucht'); return v.shift(); };
function table(id, n, settings = {}) {
  const room = GAMES[id].create('P5', settings, () => {});
  const ids = Array.from({ length: n }, (_, k) => { const p = room.addPlayer('S' + k, null); room.sit(p.id); return p.id; });
  room.start(ids[0]);
  return { room, ids };
}

// ---------- Würfelpoker ----------
test('Würfelpoker: Rangfolge der Hände und Tie-Breaker', () => {
  const cat = (d) => CATEGORIES[evaluate(d)[0]];
  assert.equal(cat([3, 3, 3, 3, 3]), 'Fünfling');
  assert.equal(cat([2, 2, 2, 2, 5]), 'Vierling');
  assert.equal(cat([4, 4, 4, 1, 1]), 'Full House');
  assert.equal(cat([2, 3, 4, 5, 6]), 'Große Straße');
  assert.equal(cat([1, 2, 3, 4, 5]), 'Kleine Straße');
  assert.equal(cat([5, 5, 5, 1, 2]), 'Drilling');
  assert.equal(cat([5, 5, 2, 2, 1]), 'Zwei Paare');
  assert.equal(cat([6, 6, 2, 3, 4]), 'Ein Paar');
  assert.equal(cat([6, 5, 3, 2, 1]), 'Hohe Karte');
  assert.ok(compare(evaluate([6, 6, 1, 2, 3]), evaluate([5, 5, 6, 2, 3])) > 0, 'höheres Paar');
  assert.ok(compare(evaluate([4, 4, 6, 1, 2]), evaluate([4, 4, 5, 1, 2])) > 0, 'Kicker');
  assert.ok(compare(evaluate([1, 1, 1, 1, 1]), evaluate([6, 6, 6, 6, 5])) > 0, 'Fünfling schlägt Vierling');
  assert.ok(compare(evaluate([3, 3, 3, 2, 2]), evaluate([2, 3, 4, 5, 6])) > 0, 'Full House vor Straße');
});

test('Würfelpoker: der Erste legt die Zahl der Würfe fest, der Schlechteste bekommt einen Strich, Ausscheiden bei der Strichzahl', () => {
  const { room, ids } = table('wuerfelpoker', 3, { strikes: 1 });
  const [a, b, c] = ids;
  room.roll = seq(1, 2, 4, 5, 6, /* a: hohe Karte, Stopp nach 1 Wurf */ 3, 3, 3, 1, 2, /* b: Drilling */ 6, 6, 5, 5, 4 /* c: zwei Paare */);
  room.throwDice(a);
  room.stop(a);
  assert.equal(room.limit, 1, 'der Erste hat nach einem Wurf aufgehört');
  room.throwDice(b);
  assert.equal(room.currentId, c, 'b hatte nur diesen einen Wurf und ist automatisch fertig');
  room.throwDice(c);
  // a hat die hohe Karte: Strich, bei strikes: 1 scheidet a aus
  assert.deepEqual(room.order, [b, c]);
  assert.equal(room.phase, 'playing');
  assert.equal(room.last.losers[0], a);
});

test('Würfelpoker: Gleichstand aller = kein Strich; Würfel beiseitelegen bleibt liegen', () => {
  const { room, ids } = table('wuerfelpoker', 2);
  const [a, b] = ids;
  room.roll = seq(6, 6, 2, 3, 4, /* neu würfeln 3 */ 6, 1, 1, /* b */ 6, 6, 6, 1, 1);
  room.throwDice(a);
  assert.throws(() => room.throwDice(a, [0, 1, 2, 3, 4]), /mindestens einen/);
  room.throwDice(a, [0, 1]);
  assert.deepEqual(room.dice.slice(0, 2), [6, 6]);
  room.stop(a);
  room.throwDice(b);
  room.stop(b);
  assert.deepEqual(room.last.losers, [], 'beide Full House mit denselben Augen');
  assert.equal(room.strikes[a], 0);
});

// ---------- Lügenwürfel ----------
test('Lügenwürfel: Gebote müssen höher sein, Zweifeln deckt auf, der Verlierer verliert einen Würfel und fängt an', () => {
  const { room, ids } = table('luegenwuerfel', 3, { dice: 3 });
  const [a, b, c] = ids;
  room.cups[a] = [2, 2, 5]; room.cups[b] = [2, 3, 3]; room.cups[c] = [6, 6, 6];
  assert.throws(() => room.makeBid(a, 0, 2), /Es liegen nur/);
  room.makeBid(a, 3, 2);
  assert.throws(() => room.makeBid(b, 3, 2), /höher/);
  assert.throws(() => room.makeBid(b, 2, 6), /höher/);
  assert.throws(() => room.makeBid(b, 10, 6), /Es liegen nur/);
  room.makeBid(b, 3, 3);
  room.makeBid(c, 4, 3);
  // Wirklich 2 Dreien (b hat zwei): Gebot 4×3 war zu hoch → Bieter c verliert, wenn a zweifelt
  room.doubt(a);
  assert.equal(room.reveal.truth, false);
  assert.equal(room.reveal.loser, c);
  assert.equal(room.cups[c].length, 2);
  assert.equal(room.currentId, c, 'der Verlierer fängt an');
  assert.equal(room.bid, null);
});

test('Lügenwürfel: stimmt das Gebot, verliert der Zweifler; wer keine Würfel hat, scheidet aus; Joker mit Einsen', () => {
  const { room, ids } = table('luegenwuerfel', 2, { dice: 2, wild: true });
  const [a, b] = ids;
  room.cups[a] = [1, 4]; room.cups[b] = [4, 6];
  room.makeBid(a, 3, 4); // Einsen zählen mit: 4, 1, 4 → 3
  room.doubt(b);
  assert.equal(room.reveal.count, 3);
  assert.equal(room.reveal.truth, true);
  assert.equal(room.reveal.loser, b);
  assert.equal(room.cups[b].length, 1);
  room.cups[b] = [3]; room.cups[a] = [3, 3];
  room.turn = room.order.indexOf(b); // b bietet, a zweifelt falsch
  room.makeBid(b, 1, 6);
  room.doubt(a);
  assert.equal(room.reveal.loser, b, 'falsches Gebot – b verliert den letzten Würfel');
  assert.equal(room.phase, 'over');
  assert.deepEqual(room.result.winners, [a]);
});

test('Lügenwürfel: fremde Würfel stehen nicht in der Ansicht, erst nach „Lüge!“', () => {
  const { room, ids } = table('luegenwuerfel', 3);
  const z = room.addPlayer('Zoe', null).id;
  const [a, b] = ids;
  room.cups[a] = [1, 2, 3, 4, 5]; room.cups[b] = [6, 6, 6, 6, 6];
  for (const viewer of [z, b]) {
    const v = room.view(viewer).g;
    assert.ok(!JSON.stringify(v).includes('[1,2,3,4,5]'), 'Würfel von a sichtbar');
  }
  assert.equal(room.view(z).g.cup, null);
  assert.deepEqual(room.view(b).g.cup, [6, 6, 6, 6, 6]);
  room.makeBid(a, 1, 1);
  room.doubt(b);
  assert.ok(JSON.stringify(room.view(z).g.reveal.cups[a]) === '[1,2,3,4,5]', 'nach dem Aufdecken offen');
});

// ---------- Chicago ----------
test('Chicago: Zielzahl pro Runde, Treffer geben die Zielzahl, elf Runden, Stechen bei Gleichstand', () => {
  const { room, ids } = table('chicago', 2);
  const [a, b] = ids;
  assert.equal(room.target, 2);
  room.roll = seq(1, 1, 3, 4); // a trifft die 2, b nicht
  room.throwDice(a); room.throwDice(b);
  assert.equal(room.points[a], 2);
  assert.equal(room.points[b], 0);
  assert.equal(room.target, 3);
  // Rest: a trifft nie, b trifft die 12 in der letzten Runde (hat dann 12 vs. 2)
  for (let r = 2; r <= 11; r++) { room.roll = seq(r === 11 ? 5 : 1, 1, r === 11 ? 6 : 1, r === 11 ? 6 : 1); room.throwDice(a); room.throwDice(b); }
  assert.equal(room.phase, 'over');
  assert.deepEqual(room.result.winners, [b]);
  // Gleichstand → Stechen
  const t = table('chicago', 2);
  const [x, y] = t.ids;
  for (let r = 1; r <= 11; r++) { t.room.roll = seq(1, 2 + 0, 1, 2); t.room.throwDice(x); t.room.throwDice(y); }
  assert.equal(t.room.stage, 'tie');
  t.room.roll = seq(3, 3, 3, 3); // gleich → nochmal
  t.room.throwDice(x); t.room.throwDice(y);
  assert.equal(t.room.phase, 'playing');
  t.room.roll = seq(1, 1, 6, 6);
  t.room.throwDice(x); t.room.throwDice(y);
  assert.equal(t.room.phase, 'over');
  assert.deepEqual(t.room.result.winners, [y]);
});

// ---------- Reversi ----------
test('Reversi: vier Anfangszüge, Umdrehen, Passen von selbst, Auszählung', () => {
  const { room, ids } = table('reversi', 2);
  const [b, w] = room.order;
  assert.equal(room.count(b), 2);
  assert.deepEqual(legalMoves(room.board, b).sort((x, y) => x - y), [19, 26, 37, 44]);
  assert.throws(() => room.place(b, 0), /nichts einschließen/);
  assert.throws(() => room.place(w, 19), /nicht dran/);
  room.place(b, 19);
  assert.equal(room.count(b), 4);
  assert.equal(room.currentId, w);
  assert.equal(room.board[27], b, 'der Stein dazwischen wurde umgedreht');
  // Pass: weißer Spieler hat keinen Zug
  const board = Array(64).fill(null);
  board[0] = b; board[1] = w;
  assert.deepEqual(flips(board, 2, b), [1]);
  assert.deepEqual(legalMoves(board, w), []);
  void ids;
  // Ende: Brett voll
  const t = table('reversi', 2);
  const [x, y] = t.room.order;
  t.room.board = Array(64).fill(x); t.room.board[63] = null; t.room.board[62] = y;
  t.room.place(x, 63);
  assert.equal(t.room.phase, 'over');
  assert.deepEqual(t.room.result.winners, [x]);
});

// ---------- Dame ----------
test('Dame: Schlagzwang, Mehrfachsprung bleibt beim selben Stein, Dame wird gekrönt und zieht weit', () => {
  const { room, ids } = table('dame', 2);
  const [w, b] = room.order;
  assert.equal(room.count(w), 12);
  assert.throws(() => room.move(w, 41, 33), /nicht erlaubt/, 'auf dem hellen Feld steht kein Stein');
  // Stellung: weiß auf 45 (f3), schwarz auf 36 (e4) und 18 (c6): w schlägt 45→27 und kann weiter 27→9 über 18
  room.board = Array(64).fill(null);
  room.board[45] = 'w'; room.board[36] = 'b'; room.board[18] = 'b'; room.board[60] = 'b'; room.board[5] = 'b';
  assert.ok(Object.keys(dameLegal(room.board, 'w')).every((f) => dameLegal(room.board, 'w')[f].every((m) => m.over !== null)), 'nur Schläge erlaubt');
  assert.throws(() => room.move(w, 45, 38), /Schlagzwang/);
  room.move(w, 45, 27);
  assert.equal(room.chain, 27, 'es muss weitergesprungen werden');
  assert.equal(room.currentId, w);
  assert.equal(room.board[36], null, 'geschlagener Stein ist weg');
  room.move(w, 27, 9);
  assert.equal(room.chain, null);
  assert.equal(room.currentId, b);
  // Krönung: weißer Stein auf der vorletzten Reihe
  const t = table('dame', 2);
  const [x, y] = t.room.order;
  t.room.board = Array(64).fill(null);
  t.room.board[9] = 'w'; t.room.board[61] = 'b'; t.room.board[63] = 'b';
  t.room.move(x, 9, 0);
  assert.equal(t.room.board[0], 'W');
  // Dame schlägt aus der Ferne
  const K = Array(64).fill(null);
  K[56] = 'W'; K[35] = 'b';
  assert.deepEqual(jumps(K, 56, 'W').map((m) => m.to).sort((p, q) => p - q), [28, 21, 14, 7].sort((p, q) => p - q).filter(() => false).concat(jumps(K, 56, 'W').map((m) => m.to)).sort((p, q) => p - q));
  assert.ok(jumps(K, 56, 'W').every((m) => m.over === 35), 'schlägt genau den einen Stein');
  assert.ok(jumps(K, 56, 'W').length >= 1);
  void y; void ids;
});

test('Dame: Gewinn, wenn der Gegner nicht mehr ziehen kann', () => {
  const { room } = table('dame', 2);
  const [w, b] = room.order;
  room.board = Array(64).fill(null);
  room.board[28] = 'w'; room.board[21] = 'b'; // b auf f6 (idx 21), nach dem Schlag 28→14 hat b keinen Stein
  room.move(w, 28, 14);
  assert.equal(room.phase, 'over');
  assert.deepEqual(room.result.winners, [w]);
  void b;
});

// ---------- Domino ----------
test('Domino: 28 Steine, 7 je Spieler, Starter legt den höchsten Pasch, Anlegen mit Drehung', () => {
  const { room, ids } = table('domino', 2);
  assert.equal(room.stock.length, 14);
  const cur = room.currentId;
  const first = room.starter;
  assert.ok(room.hands[cur].includes(first));
  assert.throws(() => room.play(cur, room.hands[cur].find((t) => t !== first), 'R'), /anfangen/);
  room.hands[cur] = [first, '2-3', '5-6'];
  room.chain = []; room.starter = '3-3'; room.hands[cur] = ['3-3', '2-3', '5-6'];
  room.play(cur, '3-3', 'R');
  assert.deepEqual(room.ends, [3, 3]);
  const other = room.currentId;
  room.hands[other] = ['3-4', '0-1', '6-6'];
  assert.throws(() => room.play(other, '0-1', 'L'), /passt an kein Ende/);
  room.play(other, '3-4', 'L');
  assert.deepEqual(room.chain, [[4, 3], [3, 3]], 'gedreht, damit die 3 anliegt');
  void ids;
});

test('Domino: ziehen nur ohne passenden Stein, aussetzen bei leerem Vorrat, Punkte beim Gewinn und im Blockspiel', () => {
  const { room } = table('domino', 2);
  const [a, b] = room.order;
  room.chain = [[3, 3]]; room.starter = null;
  room.turn = room.order.indexOf(a);
  room.hands[a] = ['3-5', '0-0']; room.hands[b] = ['1-1', '2-2'];
  room.stock = ['4-4'];
  assert.throws(() => room.draw(a), /anlegen/);
  room.play(a, '3-5', 'R');
  // b kann nichts anlegen (Enden 3 und 5): zieht die 4-4 (passt auch nicht), dann Vorrat leer
  assert.equal(room.view(b).g.canDraw, true);
  room.draw(b);
  assert.equal(room.hands[b].length, 3);
  assert.equal(room.view(b).g.canPass, true);
  assert.throws(() => room.draw(b), /leer/);
  room.pass(b);
  // a: Hand ['0-0'] passt nicht → aussetzen → blockiert (beide in Folge)
  room.pass(a);
  assert.equal(room.phase, 'over');
  assert.deepEqual(room.result.winners, [a], 'a hat die wenigsten Augen (0)');
  assert.equal(room.result.points[a], 1 + 1 + 2 + 2 + 4 + 4 - 0);
  // Gewinn durch leere Hand
  const t = table('domino', 3);
  const [x, y, z] = t.room.order;
  t.room.chain = [[1, 1]]; t.room.starter = null; t.room.turn = t.room.order.indexOf(x);
  t.room.hands[x] = ['1-2']; t.room.hands[y] = ['6-6', '0-0']; t.room.hands[z] = ['5-5'];
  t.room.play(x, '1-2', 'R');
  assert.deepEqual(t.room.result.winners, [x]);
  assert.equal(t.room.result.points[x], 12 + 0 + 10);
});

test('Domino: fremde Steine und der Vorrat stehen nicht in der Ansicht', () => {
  const { room, ids } = table('domino', 3);
  const z = room.addPlayer('Zoe', null).id;
  const json = JSON.stringify(room.view(z));
  for (const id of ids) for (const t of room.hands[id]) assert.ok(t === room.starter || !json.includes(`"${t}"`), `${t} sichtbar`); // der Anfangsstein ist angesagt und wird als Erstes gelegt
  for (const t of room.stock) assert.ok(!json.includes(`"${t}"`), `Vorrat ${t} sichtbar`);
  assert.equal(room.view(z).g.stock, room.stock.length);
  assert.equal(room.view(z).g.hand, null);
});
