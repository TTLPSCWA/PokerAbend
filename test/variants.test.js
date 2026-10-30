import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES } from '../games/index.js';
import { BOTS } from '../games/bots.js';
import { seeded } from './sim-helpers.js';
import { CARDS, DECK } from '../games/monopoly-deal/room.js';

function setup(game, variant, count = 2, settings = {}) {
  const r = GAMES[game].create('VAR', { variant, turnTime: 0, ...settings }, () => {});
  const ids = Array.from({ length: count }, (_, i) => { const p = r.addPlayer(`Spieler ${i}`, null); r.sit(p.id); return p.id; });
  r.start(ids[0]); return { r, ids };
}

test('Varianten: Metadaten, Einstellungen und Neustart behalten die gewählte Variante', () => {
  for (const [game, variant] of [['kniffel', 'triple'], ['stapelrennen', 'short'], ['schiffe', 'salvo']]) {
    const r = GAMES[game].create('VAR', { variant }, () => {});
    const restored = GAMES[game].restore(r.snapshot(), () => {});
    assert.equal(restored.variant, variant); assert.equal(restored.view(null).variant, variant);
    assert.ok(GAMES[game].variants.some((v) => v.id === variant));
    if (variant === 'short') assert.equal(restored.settings.stockSize, 10);
    restored.dispose(); r.dispose();
  }
  assert.throws(() => GAMES.kniffel.create('VAR', { variant: 'unbekannt' }, () => {}));
});

test('Fünfer-Reihe braucht fünf, Pop Out verschiebt die eigene unterste Spalte', () => {
  const { r, ids: [a, b] } = setup('viergewinnt', 'five');
  for (const col of [0, 8, 1, 8, 2, 8, 3, 7]) r.drop(r.currentId, col);
  assert.equal(r.phase, 'playing'); r.drop(a, 4); assert.deepEqual(r.result.winners, [a]); assert.equal(r.win.length, 5); r.dispose();
  const p = setup('viergewinnt', 'pop-out'); const [x, y] = p.ids;
  p.r.drop(x, 0); p.r.drop(y, 0);
  assert.throws(() => p.r.pop(x, 1)); p.r.pop(x, 0);
  assert.equal(p.r.board[35], y); assert.equal(p.r.board[28], null); p.r.dispose();
});

test('Salvo: verdeckte Zielwahl, volle Salve, Auflösung erst nach beiden Abgaben', () => {
  const { r, ids: [a, b] } = setup('schiffe', 'salvo');
  BOTS.schiffe(r, a, seeded(1)); BOTS.schiffe(r, b, seeded(2));
  const cells = Array.from({ length: r.salvoQuota(a) }, (_, i) => i);
  assert.throws(() => r.salvo(a, [0])); r.salvo(a, cells);
  assert.equal(Object.keys(r.shots[a]).length, 0);
  assert.deepEqual(r.gameView(b).mySalvo, []); assert.equal(r.gameView(b).salvoReady[a], true);
  r.salvo(b, cells); assert.equal(Object.keys(r.shots[a]).length, cells.length); assert.equal(r.salvoRound, 2); r.dispose();
});

test('Dreifach-Kniffel gewichtet Spalten einzeln und beendet nicht nach 13 Einträgen', () => {
  const { r, ids: [a] } = setup('kniffel', 'triple'); r.dice = [6, 6, 6, 6, 6]; r.rolls = 1;
  r.score(a, 'kniffel', 2); assert.equal(r.total(a), 150); assert.equal(r.phase, 'playing'); r.dispose();
});

test('Mensch: 60 Felder und Partnerkontrolle erst nach vier eigenen Zielfiguren', () => {
  const hex = setup('huetchen', 'six', 6); assert.equal(hex.r.track, 60); assert.equal(hex.r.abs(hex.ids[5], 11), 1); hex.r.dispose();
  const { r, ids: [a, b, c] } = setup('huetchen', 'team', 4);
  assert.equal(r.partner(a), c); assert.equal(r.controlled(a), a);
  r.pieces[a] = [40, 41, 42, 43]; r.pieces[c] = [0, -1, -1, -1]; r.roll = () => 3;
  r.throwDice(a); r.move(a, 0); assert.equal(r.pieces[c][0], 3); assert.equal(r.currentId, b); r.dispose();
});

test('Skip-Bo Team: Partnerstapel erlaubt, fremde Hand gesperrt, beide Stapel müssen leer sein', () => {
  const { r, ids: [a, b, c] } = setup('stapelrennen', 'team', 4, { stockSize: 5 });
  assert.equal(r.gameView(null).partner, null);
  r.stock[c] = [1]; r.stock[a] = [2];
  assert.throws(() => r.play(a, { kind: 'hand', owner: c, index: 0 }, 0));
  assert.throws(() => r.play(a, { kind: 'stock', owner: b }, 0));
  r.play(a, { kind: 'stock', owner: c }, 0); assert.equal(r.phase, 'playing');
  r.play(a, { kind: 'stock' }, 0); assert.deepEqual(r.result.winners, [a, c]); r.dispose();
});

test('Phase 10 kurz endet nach fünf Phasen; Teamfortschritt verlangt beide Auslagen', () => {
  const short = setup('zehnetappen', 'short'); const a = short.ids[0]; short.r.progress[a] = 5; short.r.done.add(a); short.r.endRound(a); assert.deepEqual(short.r.result.winners, [a]); assert.equal(short.r.gameView(a).phaseText, 'alle geschafft'); short.r.dispose();
  const { r, ids: [x, , y] } = setup('zehnetappen', 'team', 4); r.done.add(x); r.endRound(x); assert.equal(r.phaseOf(x), 1);
  r.start(x); r.done.add(x); r.done.add(y); r.endRound(x); assert.equal(r.phaseOf(x), 2); assert.equal(r.phaseOf(y), 2); r.dispose();
});

test('Monopoly Deal kurz gewinnt mit genau zwei vollständigen Farben', () => {
  const { r, ids: [a] } = setup('monopoly-deal', 'quick');
  for (const color of ['brown', 'blue']) { const cards = DECK.filter((id) => CARDS[id].kind === 'property' && CARDS[id].colors.length === 1 && CARDS[id].colors[0] === color); cards.forEach((id) => r.put(a, id, color)); }
  assert.equal(r.checkWin(a), true); assert.deepEqual(r.result.winners, [a]); r.dispose();
});

test('Phase-10-Teams: acht komplette Spiele mit gemeinsamem Fortschritt bis Phase zehn', () => {
  for (let k = 0; k < 8; k++) {
    const { r, ids } = setup('zehnetappen', 'team', 4), rng = seeded(k + 282); let rounds = 0;
    while (!r.gameOver && rounds++ < 500) {
      let actions = 0; while (r.phase === 'playing' && actions++ < 10000) BOTS.zehnetappen(r, r.currentId, rng);
      assert.equal(r.phase, 'over'); for (const id of ids) assert.equal(r.phaseOf(id), r.phaseOf(r.partner(id)));
      if (!r.gameOver) r.start(ids[0]);
    }
    assert.ok(r.gameOver); assert.equal(r.result.winners.length, 2); r.dispose();
  }
});

for (const [game, variant, count, limit] of [['viergewinnt', 'five', 2, 100], ['viergewinnt', 'pop-out', 2, 2000], ['schiffe', 'salvo', 2, 250], ['kniffel', 'triple', 2, 650], ['huetchen', 'six', 6, 20000], ['huetchen', 'team', 4, 15000], ['stapelrennen', 'short', 3, 3000], ['stapelrennen', 'team', 4, 7000]]) {
  test(`Varianten-Bots ${game}/${variant}: 12 vollständige Partien`, () => {
    const rng = seeded(812);
    for (let k = 0; k < 12; k++) {
      const { r } = setup(game, variant, count); if (r.roll) r.roll = () => 1 + Math.floor(rng() * 6);
      let steps = 0; while (r.phase === 'playing' && steps++ < limit) BOTS[game](r, r.currentId, rng);
      assert.equal(r.phase, 'over', `${variant} hängt nach ${steps} Zügen`); r.dispose();
    }
  });
}
