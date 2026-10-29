import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES } from '../games/index.js';
import { cleanDrawing, COLORS, WORDS } from '../games/drawing.js';
import { normalizeProgram } from '../server/party-program.js';

const image = () => [{ color: COLORS[0], size: 8, points: [[100, 100], [500, 500], [900, 200]] }];
function setup(game, count = 3, settings = {}) {
  const r = GAMES[game].create('DRAW', { rounds: 1, ...settings }, () => {}); r.game = game;
  const ids = Array.from({ length: count }, (_, i) => { const p = r.addPlayer(`Mensch ${i + 1}`, null); p.connected = true; r.sit(p.id); return p.id; });
  const watcher = r.addPlayer('Zuschauer', null); watcher.connected = true;
  r.start(ids[0]);
  return { r, ids, watcher: watcher.id };
}

test('Zeichnungen: nur begrenzte, kopierte Vektoren; größtes Paket passt in das Socket-Limit', () => {
  const source = image(), result = cleanDrawing(source); source[0].points[0][0] = 999;
  assert.equal(result[0].points[0][0], 100);
  for (const bad of [null, {}, Array(61).fill(image()[0]), [{ ...image()[0], color: '<script>' }], [{ ...image()[0], size: 999 }], [{ ...image()[0], points: [[-1, 0]] }], [{ ...image()[0], points: [[0, Infinity]] }], [{ ...image()[0], points: [[.1, 0]] }], [{ ...image()[0], points: [[0, 1, 2]] }], Array(9).fill({ ...image()[0], points: Array(100).fill([1000, 1000]) })]) assert.throws(() => cleanDrawing(bad));
  const largest = Array.from({ length: 60 }, (_, i) => ({ color: COLORS[0], size: 36, points: Array(i < 20 ? 14 : 13).fill([1000, 1000]) }));
  cleanDrawing(largest);
  assert.ok(Buffer.byteLength(JSON.stringify(['drawing', { key: '999:29:write:11', strokes: largest, done: true }])) < 16 * 1024);
  assert.ok(WORDS.length >= 40 && new Set(WORDS).size === WORDS.length);
});

test('Kritzelpost: nur der vorherige Beitrag, keine fremden Entwürfe, alle Ketten vollständig', () => {
  const { r, ids, watcher } = setup('kritzelpost');
  const key = r.stateKey;
  r.answer(ids[0], key, 'GEHEIMER DRACHE');
  assert.ok(!JSON.stringify(r.view(ids[1])).includes('GEHEIMER DRACHE'));
  assert.ok(!JSON.stringify(r.view(watcher)).includes('GEHEIMER DRACHE'));
  assert.throws(() => r.answer(watcher, key, 'Nö'), /Aufgabe/);
  r.answer(ids[1], key, 'Vulkan'); r.answer(ids[2], key, 'Pinguin');
  assert.equal(r.sub, 1);
  assert.throws(() => r.drawing(ids[0], key, image(), true), /Aufgabe/);
  for (const id of ids) { const v = r.view(id).g; assert.ok(v.draw && v.previous.text); assert.equal(v.previous.author, undefined); }
  r.drawing(ids[0], r.stateKey, image());
  assert.deepEqual(r.view(ids[1]).g.image, []);
  for (const id of ids) r.drawing(id, r.stateKey, image(), true);
  assert.equal(r.sub, 2);
  for (const id of ids) r.answer(id, r.stateKey, `Beschreibung ${id}`);
  assert.equal(r.stage, 'reveal');
  assert.equal(r.view(watcher).g.chains.length, 3);
  for (const chain of r.chains) { assert.equal(chain.pages.length, 3); assert.equal(new Set(chain.pages.map((p) => p.author)).size, 3); }
  r.next(ids[0]); assert.equal(r.phase, 'over');
  assert.deepEqual(Object.values(r.result.points), [300, 300, 300]); r.dispose();
});

test('Bildunterschrift: Zeichenplatz, anonyme Texte, keine Eigenstimme und korrekte Punkte', () => {
  const { r, ids: [a, b, c], watcher } = setup('bildunterschrift', 3, { spectators: true });
  assert.equal(r.artist, a);
  assert.equal(r.view(b).g.prompt, null);
  assert.throws(() => r.drawing(b, r.stateKey, image()), /zeichnen/);
  r.drawing(a, r.stateKey, image(), true);
  assert.equal(r.sub, 1);
  r.answer(b, r.stateKey, 'GEHEIM B');
  assert.ok(!JSON.stringify(r.view(c)).includes('GEHEIM B'));
  r.answer(c, r.stateKey, 'GEHEIM C');
  assert.equal(r.stage, 'vote');
  assert.equal(r.view(a).g.answers[0].id, undefined);
  const index = (id) => r.display.indexOf(id);
  assert.throws(() => r.vote(b, r.stateKey, index(b)), /fremde/);
  assert.throws(() => r.vote(a, r.stateKey, '0'), /fremde/);
  r.vote(watcher, r.stateKey, index(b));
  r.vote(a, r.stateKey, index(b)); r.vote(b, r.stateKey, index(c)); r.vote(c, r.stateKey, index(b));
  assert.equal(r.stage, 'reveal');
  assert.equal(r.gamePts[a], 100); assert.equal(r.gamePts[b], 300); assert.equal(r.gamePts[c], 100);
  r.next(a); assert.deepEqual(r.result.winners, [b]); r.dispose();
});

test('Malen & Raten: Begriff und Versuche bleiben geheim, Umlaute zählen, Mehrfachpunkte ausgeschlossen', () => {
  const { r, ids: [a, b, c], watcher } = setup('malen-raten');
  r.cur = { id: 'test', q: 'Zahnbürste' };
  assert.equal(r.view(a).g.prompt, 'Zahnbürste');
  for (const id of [b, c, watcher]) assert.ok(!JSON.stringify(r.view(id)).includes('Zahnbürste'));
  assert.throws(() => r.answer(a, r.stateKey, 'Zahnbürste'), /zeichnest/);
  assert.throws(() => r.answer(watcher, r.stateKey, 'Zahnbürste'), /Aufgabe/);
  r.drawing(a, r.stateKey, image()); assert.equal(r.view(b).g.image.length, 1);
  r.answer(b, r.stateKey, 'FALSCHE GEHEIME VERMUTUNG');
  assert.ok(!JSON.stringify(r.view(c)).includes('FALSCHE GEHEIME VERMUTUNG'));
  assert.throws(() => r.answer(b, r.stateKey, 'Zahnbürste'), /Warte/);
  r.lastGuess[b] = 0; r.answer(b, r.stateKey, 'ZAHNBUERSTE!');
  assert.equal(r.gamePts[b], 300);
  assert.throws(() => r.answer(b, r.stateKey, 'Zahnbürste'), /erraten/);
  r.answer(c, r.stateKey, 'Zahnbürste'); assert.equal(r.stage, 'reveal');
  assert.equal(r.gamePts[c], 275); assert.equal(r.gamePts[a], 200);
  assert.equal(r.view(watcher).g.prompt, 'Zahnbürste');
  r.next(a); assert.equal(r.phase, 'over'); r.dispose();
});

test('Zeichenspiele: 3–12 Spieler, Zeitablauf und leere Beiträge blockieren keine Partie', () => {
  for (const game of ['kritzelpost', 'bildunterschrift', 'malen-raten']) for (let n = 3; n <= 12; n++) {
    const { r, ids } = setup(game, n, { rounds: 2 });
    let steps = 0;
    while (r.phase === 'playing') { r.next(ids[0]); assert.ok(++steps < 40, `${game} blockiert`); }
    assert.ok(Object.values(r.result.points).every((p) => p === 0)); assert.equal(r.result.winners.length, 0);
    r.dispose();
  }
});

test('Zeichenplatz rotiert, jede Runde zählt einmal und alte Beiträge werden abgewiesen', () => {
  for (const game of ['bildunterschrift', 'malen-raten']) {
    const { r, ids } = setup(game, 3, { rounds: 3 });
    for (let round = 0; round < 3; round++) {
      assert.equal(r.artist, ids[round]);
      const key = r.stateKey;
      r.drawing(r.artist, key, image(), game === 'bildunterschrift');
      for (const id of ids.filter((id) => id !== r.artist)) r.answer(id, r.stateKey, game === 'bildunterschrift' ? `Text ${id}` : r.cur.q);
      if (game === 'bildunterschrift') for (const id of ids) r.vote(id, r.stateKey, r.display.findIndex((author) => author !== id));
      assert.equal(r.stage, 'reveal');
      assert.throws(() => r.drawing(ids[round], key, image()), /Aufgabe/);
      const points = { ...r.gamePts };
      r.next(ids[0]);
      assert.deepEqual(r.gamePts, points);
    }
    assert.equal(r.phase, 'over'); assert.equal(r.result.players.length, 3); r.dispose();
  }
});

test('Zeichenspiele: Abbruch, Ausstieg, Wiederherstellung und Abendprogramm', () => {
  for (const game of ['kritzelpost', 'bildunterschrift', 'malen-raten']) {
    const { r, ids } = setup(game, 4);
    r.stand(ids[3]); assert.equal(r.phase, 'playing');
    r.afterChange(); assert.ok(r.deadline > Date.now());
    r.abortRound(ids[0]); r.afterChange(); assert.equal(r.deadline, null); assert.equal(r.result, null);
    const snapshot = JSON.parse(JSON.stringify(r.snapshot()));
    const restored = GAMES[game].restore(snapshot, () => {});
    assert.equal(restored.byToken(r.players.get(ids[0]).token).id, ids[0]);
    restored.start(ids[0]); assert.equal(restored.phase, 'playing');
    const config = normalizeProgram({ mode: 'playlist', entries: [{ game, settings: { rounds: 1 } }] });
    assert.equal(config.entries[0].game, game);
    restored.dispose(); r.dispose();
  }
});
