// Päckchen 4: Mogeln, Präsident, Durak – Regeln mit festen Händen, Geheimhaltung der verdeckten Karten.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES } from '../games/index.js';

function table(id, n, settings = {}) {
  const room = GAMES[id].create('P4', settings, () => {});
  const ids = Array.from({ length: n }, (_, k) => { const p = room.addPlayer('S' + k, null); room.sit(p.id); return p.id; });
  room.start(ids[0]);
  return { room, ids };
}

// ---------- Mogeln ----------
test('Mogeln: 52 Karten verteilt, Ansage Ass → 2 → 3, legen und weitergeben', () => {
  const { room, ids } = table('mogeln', 3);
  assert.equal(Object.values(room.hands).flat().length, 52);
  assert.equal(room.need, 'A');
  const c = room.hands[ids[0]][0];
  room.play(ids[0], [c]);
  assert.equal(room.need, '2');
  assert.equal(room.currentId, ids[1]);
  assert.equal(room.pile.length, 1);
  assert.throws(() => room.play(ids[0], [room.hands[ids[0]][0]]), /nicht dran/);
  assert.throws(() => room.play(ids[1], []), /1 bis 4/);
  assert.throws(() => room.play(ids[1], room.hands[ids[1]].slice(0, 5)), /Höchstens/);
  assert.throws(() => room.play(ids[1], [c]), /nicht/); // Karte liegt schon im Stapel
});

test('Mogeln: Zweifeln – gelogen: Lügner nimmt den Stapel; stimmte es: der Zweifler; Stapelnehmer fängt an', () => {
  const { room, ids } = table('mogeln', 3);
  const [a, b, c] = ids;
  room.hands[a] = ['Kh', '5c', '9d']; room.hands[b] = ['2h', '3h']; room.hands[c] = ['4s'];
  room.pile = []; room.hands[b].push(...[]);
  // Lüge: a sagt „Asse“ und legt einen König
  room.play(a, ['Kh']);
  assert.throws(() => room.call(a), /eigene/);
  room.call(b);
  assert.deepEqual(room.reveal.cards, ['Kh']);
  assert.equal(room.reveal.truth, false);
  assert.equal(room.hands[a].length, 3, 'Lügner nahm den Stapel (1 Karte) zurück');
  assert.equal(room.pile.length, 0);
  assert.equal(room.currentId, a, 'wer den Stapel nimmt, fängt an');
  assert.equal(room.need, '2', 'die Folge geht weiter');
  // Wahrheit: a sagt „2er“ und legt eine 2 → der Zweifler nimmt den Stapel
  room.hands[a].push('2s');
  room.play(a, ['2s']);
  room.call(c);
  assert.equal(room.reveal.truth, true);
  assert.ok(room.hands[c].includes('2s'));
  assert.equal(room.currentId, c);
});

test('Mogeln: Wer als Erster keine Karten mehr hat, gewinnt – nur, wenn niemand erfolgreich zweifelt', () => {
  const { room, ids } = table('mogeln', 3);
  const [a, b, c] = ids;
  room.hands[a] = ['Ah']; room.hands[b] = ['2h', '9d']; room.hands[c] = ['4s'];
  room.play(a, ['Ah']); // wahr und letzte Karte
  assert.equal(room.phase, 'playing', 'noch nicht gewonnen: jetzt darf gezweifelt werden');
  room.call(b); // falscher Zweifel
  assert.equal(room.phase, 'over');
  assert.deepEqual(room.result.winners, [a]);
  // Neues Spiel: Lüge mit der letzten Karte, der Zweifler hat recht
  const t = table('mogeln', 3);
  const [x, y] = t.ids;
  t.room.hands[x] = ['Kh']; t.room.hands[y] = ['2h', '9d'];
  t.room.play(x, ['Kh']); // gelogen (sollte Ass sein)
  t.room.call(y);
  assert.equal(t.room.phase, 'playing');
  assert.equal(t.room.hands[x].length, 1, 'Lügner nahm die Karte zurück');
  // Und: niemand zweifelt – der Nächste legt einfach ab → der Letzte gewinnt
  const u = table('mogeln', 3);
  const [p, q] = u.ids;
  u.room.hands[p] = ['Ah']; u.room.hands[q] = ['2h', '9d'];
  u.room.play(p, ['Ah']);
  u.room.play(q, ['2h']);
  assert.equal(u.room.phase, 'over');
  assert.deepEqual(u.room.result.winners, [p]);
});

test('Mogeln: verdeckte Karten stehen in keiner fremden Ansicht – auch nicht im Stapel', () => {
  const { room, ids } = table('mogeln', 3);
  const z = room.addPlayer('Zoe', null).id;
  const [a, b] = ids;
  const laid = room.hands[a].slice(0, 2);
  room.play(a, laid);
  for (const viewer of [b, z]) {
    const json = JSON.stringify(room.view(viewer));
    for (const c of laid) assert.ok(!json.includes(`"${c}"`), `${c} sichtbar`);
    for (const c of room.hands[a]) assert.ok(!json.includes(`"${c}"`), `Handkarte ${c} von a sichtbar`);
  }
  assert.equal(room.view(b).g.pile, 2);
  assert.deepEqual(room.view(b).g.last, { by: a, count: 2, rank: 'A' });
  room.call(b);
  assert.ok(JSON.stringify(room.view(z)).includes(`"${laid[0]}"`), 'nach dem Zweifeln liegen die Karten offen');
});

// ---------- Präsident ----------
test('Präsident: genau so viele, höher überbieten; passen; Tisch frei; Rangfolge 2 am höchsten', () => {
  const { room, ids } = table('praesident', 3);
  const [a, b, c] = ids;
  room.hands[a] = ['3c', '3d', 'Kh', '9h']; room.hands[b] = ['4c', '5c', 'Ks', 'Kd', '2c']; room.hands[c] = ['7c', 'Ah'];
  room.play(a, ['3c', '3d']);
  assert.throws(() => room.play(b, ['4c']), /genau 2/);
  assert.throws(() => room.play(b, ['4c', '5c']), /gleichen Werts/);
  room.play(b, ['Ks', 'Kd']);
  assert.throws(() => room.play(c, ['Ah']), /genau 2/);
  assert.throws(() => room.pass(a), /nicht dran/);
  room.pass(c);
  room.pass(a);
  assert.equal(room.pile, null, 'alle haben gepasst: Tisch frei');
  assert.equal(room.currentId, b, 'der letzte Spieler spielt aus');
  assert.throws(() => room.pass(b), /ausspielen/);
  room.play(b, ['2c']);
  assert.equal(room.pile.rank, '2');
  assert.throws(() => room.play(c, ['Ah']), /höher/, 'Ass schlägt die Zwei nicht');
});

test('Präsident: Plätze, Punkte, Kartentausch und Präsident fängt an', () => {
  const { room, ids } = table('praesident', 3);
  const [a, b, c] = ids;
  room.hands[a] = ['3c']; room.hands[b] = ['4c']; room.hands[c] = ['6c', '7c'];
  const first = room.currentId;
  assert.equal(first, a);
  room.play(a, ['3c']);
  assert.deepEqual(room.places, [a]);
  room.play(b, ['4c']);
  assert.equal(room.phase, 'over', 'nur noch einer hat Karten');
  assert.deepEqual(room.result.points, { [a]: 2, [b]: 1, [c]: 0 });
  assert.deepEqual(room.result.winners, [a]);
  assert.equal(room.scores[a], 2);
  // Nächste Runde: Schlusslicht gibt die beste Karte, der Präsident die schlechteste; der Präsident fängt an
  room.start(a);
  const x = room.exchange;
  assert.equal(x.from, c);
  assert.equal(x.to, a);
  assert.equal(room.currentId, a);
  assert.ok(room.hands[a].includes(x.gave) && room.hands[c].includes(x.got));
  assert.equal(Object.values(room.hands).flat().length, 52);
  room.dispose();
});

test('Präsident: verdeckte Hände anderer stehen nicht in der Ansicht', () => {
  const { room, ids } = table('praesident', 3);
  const z = room.addPlayer('Zoe', null).id;
  const json = JSON.stringify(room.view(z));
  for (const id of ids) for (const c of room.hands[id]) assert.ok(!json.includes(`"${c}"`), `${c} sichtbar`);
  assert.equal(room.view(z).g.hand, null);
});

// ---------- Durak ----------
function durak(n = 2) {
  const t = table('durak', n);
  const r = t.room;
  r.trump = 'h';
  return { ...t };
}

test('Durak: 36 Karten, 6 pro Hand, Trumpf = unterste Karte bleibt sichtbar; 6 Spieler: letzte Karte bestimmt Trumpf', () => {
  const { room } = table('durak', 3);
  assert.equal(room.deck.length, 36 - 18);
  assert.equal(room.trumpCard, room.deck[0]);
  assert.equal(room.trump, room.trumpCard[1]);
  assert.equal(room.view(room.order[0]).g.trumpCard, room.trumpCard);
  const six = table('durak', 6);
  assert.equal(six.room.deck.length, 0);
  assert.equal(six.room.trumpCard, null);
  assert.ok('cdhs'.includes(six.room.trump));
});

test('Durak: schlagen mit höherer Karte derselben Farbe oder Trumpf; Trumpf nur mit höherem Trumpf', () => {
  const { room, ids } = durak();
  const [a, d] = ids;
  room.hands[a] = ['7c', '8c', '9d', 'Tc']; room.hands[d] = ['6c', '9c', '6h', '7h', 'Ah', 'Kd'];
  room.deck = ['6d', '7d'].concat(room.deck.slice(2)); // egal
  room.attack(a, '7c');
  assert.equal(room.currentId, d);
  assert.throws(() => room.defend(d, '6c', 0), /schlägst/);
  assert.throws(() => room.defend(d, 'Kd', 0), /schlägst/, 'andere Farbe, kein Trumpf');
  room.defend(d, '9c', 0);
  // Trumpfkarte angreifen: nur höherer Trumpf schlägt
  room.attack(a, '9d'); // Wert 9 liegt (9c)
  assert.throws(() => room.defend(d, '6c', 1), /schlägst/);
  room.defend(d, '6h', 1); // Trumpf schlägt Nicht-Trumpf
  // der Angreifer kann nichts mehr zulegen: alles geschlagen, die vier Karten sind ab
  assert.deepEqual([...room.discard].sort(), ['6h', '7c', '9c', '9d']);
  assert.equal(room.attacker, d, 'der Verteidiger greift als Nächster an');
});

test('Durak: nur liegende Werte nachlegen, höchstens so viele, wie der Verteidiger Karten hat; Genug beendet', () => {
  const { room, ids } = durak();
  const [a, d] = ids;
  room.hands[a] = ['7c', '7d', '8s', '9c']; room.hands[d] = ['Ah', 'Kh']; // nur 2 Karten
  room.attack(a, '7c');
  assert.throws(() => room.attack(a, '8s'), /nicht dran|Wert/);
  room.defend(d, 'Ah', 0);
  assert.equal(room.currentId, a);
  assert.throws(() => room.attack(a, '8s'), /Wert/);
  room.attack(a, '7d'); // zweite Karte (Verteidiger hat noch 1 Karte)
  room.defend(d, 'Kh', 1);
  // Verteidiger hat keine Karten mehr: kein Nachlegen, alles ab, Verteidiger greift an
  assert.equal(room.board.length, 0);
  assert.equal(room.discard.length, 4);
});

test('Durak: Aufnehmen – andere dürfen noch zulegen, dann nimmt er alles, setzt aus; Auffüllen: Angreifer zuerst', () => {
  const { room, ids } = table('durak', 3);
  const [a, d, o] = ids;
  room.trump = 'h';
  room.hands[a] = ['7c', '8c']; room.hands[d] = ['6d', '9s', 'Ts', 'Js', 'Qs', 'Ks']; room.hands[o] = ['7s', 'Ac'];
  const deck = room.deck.length;
  room.attack(a, '7c');
  room.take(d);
  assert.equal(room.taking, true);
  assert.equal(room.currentId, o, 'a hat nichts zum Zulegen und wird automatisch übersprungen');
  assert.throws(() => room.attack(o, 'Ac'), /Wert/);
  room.attack(o, '7s'); // gleicher Wert 7 darf dazu – danach kann niemand mehr zulegen, es geht von selbst weiter
  assert.equal(room.board.length, 0);
  assert.equal(room.hands[d].length, 6 + 2, 'Verteidiger hat beide Karten aufgenommen');
  assert.equal(room.attacker, o, 'der Nächste nach dem Verteidiger greift an');
  assert.equal(room.defender, a);
  assert.equal(room.hands[a].length, 6, 'Angreifer aufgefüllt');
  assert.equal(room.hands[o].length, 6);
  assert.equal(room.deck.length, deck - 10);
});

test('Durak: der Verlierer mit Karten bleibt als Durak übrig, andere bekommen einen Punkt', () => {
  const { room, ids } = durak();
  const [a, d] = ids;
  room.deck = []; room.trumpCard = null;
  room.hands[a] = ['7c']; room.hands[d] = ['Ah', '6d'];
  room.attack(a, '7c');
  room.defend(d, 'Ah', 0);
  assert.equal(room.phase, 'over');
  assert.equal(room.durak, d);
  assert.deepEqual(room.result.winners, [a]);
  assert.equal(room.scores[a], 1);
});

test('Durak: Handkarten anderer sind verdeckt, offen sind Tisch, Trumpf und Anzahlen', () => {
  const { room, ids } = table('durak', 3);
  const z = room.addPlayer('Zoe', null).id;
  const json = JSON.stringify(room.view(z));
  for (const id of ids) for (const c of room.hands[id]) assert.ok(!json.includes(`"${c}"`) || c === room.trumpCard, `${c} sichtbar`);
  const v = room.view(ids[1]);
  assert.equal(v.g.hand.length, 6);
  assert.ok(v.players.every((p) => typeof p.cards === 'number'));
  assert.equal(v.g.deck, room.deck.length, 'nur die Zahl des Stapels');
});
