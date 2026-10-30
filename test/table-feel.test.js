// Spielgefühl am Tisch: Vorab-Aktionen, Anstupsen, eigene Karten nach dem Fold, Spruchlisten.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room, cleanLines, DEFAULT_SETTINGS, MAX_LINES, MAX_LINE_LEN } from '../games/poker/room.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// Drei Spieler, ohne Timer; events sammelt, was der Raum nach außen meldet (z. B. Anstupsen)
function room(names = ['Anna', 'Ben', 'Carla'], settings = {}) {
  const events = [];
  const r = new Room('TESTX', { autoNext: false, turnTime: 0, ...settings }, (kind, data) => events.push({ kind, data }));
  const ids = names.map((n, i) => { const p = r.addPlayer(n, null); p.connected = true; r.sit(p.id, i); return p.id; });
  r.start(ids[0]);
  return { r, ids, events };
}
const h = (r) => r.table.hand;
const at = (r, seat) => r.playerAt(seat);
const turn = (r) => at(r, h(r).toAct);
const notOnTurn = (r) => [...r.players.values()].find((p) => p.seat !== h(r).toAct);
const play = (r, p, action) => { r.act(p.id, action); };
const checkOrCall = (r) => { const L = r.table.legal(h(r).toAct); play(r, turn(r), { type: L.canCheck ? 'check' : 'call' }); };
// Hat X in dieser Hand schon so gehandelt? (lastAction wird pro Straße geleert, der Verlauf nicht)
const did = (r, x, verb) => r.log.some((l) => l.text === `${x.name} ${verb}`);
const stop = (r) => { r.clock.clearTimeout(r.turnTimer); r.clock.clearTimeout(r.nextTimer); r.clock.clearTimeout(r.nudgeTimer); };
// Bis zum Flop alle mitgehen lassen
function toFlop(r) { while (h(r).street === 'preflop') checkOrCall(r); }

// ---------- Vorab-Aktionen ----------
test('Call beliebig: callt jede Erhöhung und gilt über Flop, Turn und River', () => {
  const { r } = room();
  const x = notOnTurn(r);
  r.setPreAction(x.id, 'callany');
  assert.equal(r.view(x.id).you.pre, 'callany');
  // Wer zuerst dran ist, erhöht – X callt automatisch, ohne selbst dran zu sein
  play(r, turn(r), { type: 'raise', amount: 300 });
  while (h(r).street === 'preflop') {
    assert.notEqual(h(r).toAct, x.seat, 'X ist nie selbst am Zug');
    checkOrCall(r);
  }
  assert.equal(h(r).players[x.seat].folded, false);
  assert.equal(h(r).players[x.seat].total, 300);
  // Auf den späteren Straßen: setzen, X callt wieder automatisch
  while (r.handRunning) {
    assert.notEqual(h(r).toAct, x.seat);
    const L = r.table.legal(h(r).toAct);
    if (L.canCheck && L.canRaise && h(r).currentBet === 0) play(r, turn(r), { type: 'raise', amount: 200 });
    else checkOrCall(r);
  }
  assert.equal(h(r).result.showdown, true, 'X war bis zum Showdown dabei');
  stop(r);
});

test('Check: wird ausgeführt, solange keiner setzt – bei einem Einsatz aufgehoben mit Hinweis', () => {
  const { r } = room();
  toFlop(r);
  const x = notOnTurn(r);
  r.setPreAction(x.id, 'check');
  // Alle checken → X checkt automatisch, es geht zum Turn
  while (h(r).street === 'flop') checkOrCall(r);
  assert.equal(h(r).street, 'turn');
  assert.ok(did(r, x, 'checkt'));
  // Auf dem Turn: X will wieder checken, aber jemand setzt
  const y = notOnTurn(r);
  r.setPreAction(y.id, 'check');
  play(r, turn(r), { type: 'raise', amount: 200 });
  assert.equal(y.pre, null);
  assert.match(r.view(y.id).you.preNote, /aufgehoben/);
  assert.equal(r.view(y.id).you.pre, null);
  stop(r);
});

test('Check/Fold: checkt ohne Einsatz, foldet bei einem Einsatz', () => {
  const { r } = room();
  toFlop(r);
  const x = notOnTurn(r);
  r.setPreAction(x.id, 'checkfold');
  while (h(r).street === 'flop') checkOrCall(r);
  assert.ok(did(r, x, 'checkt'), 'ohne Einsatz: Check');
  // Turn: jemand setzt → X foldet automatisch
  if (h(r).toAct === x.seat) checkOrCall(r); // X selbst zuerst dran: einmal checken
  r.setPreAction(x.id, 'checkfold');
  play(r, turn(r), { type: 'raise', amount: 200 });
  while (r.handRunning && !h(r).players[x.seat].folded && h(r).toAct !== x.seat) checkOrCall(r);
  assert.equal(h(r).players[x.seat].folded, true);
  stop(r);
});

test('Fold: foldet, sobald man dran ist', () => {
  const { r } = room();
  const x = notOnTurn(r);
  r.setPreAction(x.id, 'fold');
  while (r.handRunning && !h(r).players[x.seat].folded) {
    assert.notEqual(h(r).toAct, x.seat);
    checkOrCall(r);
  }
  assert.equal(h(r).players[x.seat].folded, true);
  stop(r);
});

test('Vorab-Aktion gilt nur für die aktuelle Hand', () => {
  const { r, ids } = room();
  const x = notOnTurn(r);
  r.setPreAction(x.id, 'callany');
  // Alle anderen folden → Hand vorbei
  while (r.handRunning) play(r, turn(r), { type: 'fold' });
  r.nextHand(ids[0]);
  assert.equal(x.pre, null, 'mit der neuen Hand zurückgesetzt');
  assert.equal(r.view(x.id).you.pre, null);
  // In der neuen Hand muss X selbst handeln
  while (h(r).toAct !== x.seat) checkOrCall(r);
  assert.equal(h(r).toAct, x.seat);
  stop(r);
});

test('Vorab-Aktion abwählen und ungültige Wünsche', () => {
  const { r } = room();
  const x = notOnTurn(r);
  r.setPreAction(x.id, 'fold');
  r.setPreAction(x.id, null);
  assert.equal(x.pre, null);
  assert.throws(() => r.setPreAction(x.id, 'allin'), /Unbekannte/);
  // Pre-Flop liegt der Big Blind – „Check“ geht nur für den, der schon so viel drin hat
  const bb = at(r, h(r).bb);
  const other = [...r.players.values()].find((p) => p.seat !== h(r).bb && h(r).players[p.seat].bet < h(r).currentBet);
  assert.throws(() => r.setPreAction(other.id, 'check'), /es wurde gesetzt/);
  r.setPreAction(bb.id, 'check');
  // Wer gefoldet hat, kann nichts mehr vorwählen
  const f = turn(r); play(r, f, { type: 'fold' });
  assert.throws(() => r.setPreAction(f.id, 'callany'), /in der Hand/);
  stop(r);
});

// ---------- Eigene Karten nach dem Fold ----------
test('Gefoldete Karten bekommt nur der Besitzer', () => {
  const { r } = room();
  const f = turn(r);
  const cards = h(r).players[f.seat].cards;
  play(r, f, { type: 'fold' });
  assert.deepEqual(r.view(f.id).seats[f.seat].cards, cards, 'Besitzer sieht sie weiter');
  assert.equal(r.view(f.id).seats[f.seat].folded, true);
  for (const p of r.players.values()) {
    if (p.id === f.id) continue;
    assert.equal(r.view(p.id).seats[f.seat].cards, null, 'andere sehen nichts');
  }
  assert.equal(r.view(null).seats[f.seat].cards, null, 'Zuschauer auch nicht');
  stop(r);
});

// ---------- Anstupsen ----------
test('Anstupsen: nur den, der dran ist, höchstens alle 10 s', () => {
  const { r, events } = room();
  const target = turn(r);
  const [a, b] = [...r.players.values()].filter((p) => p.id !== target.id);
  r.nudge(a.id, target.id);
  const n = events.filter((e) => e.kind === 'nudge');
  assert.equal(n.length, 1);
  assert.equal(n[0].data.to, target.id);
  assert.equal(n[0].data.from, a.name);
  assert.ok(DEFAULT_SETTINGS.nudgeLines.includes(n[0].data.text));
  assert.throws(() => r.nudge(a.id, target.id), /höchstens alle 10 Sekunden/);
  assert.throws(() => r.nudge(b.id, target.id), /gerade erst angestupst/);
  assert.throws(() => r.nudge(b.id, a.id), /nicht dran/);
  assert.throws(() => r.nudge(target.id, target.id), /geht nicht/);
  assert.ok(r.log.some((l) => l.text === `${a.name} stupst ${target.name} an`));
  stop(r);
});

test('Anstupsen: Host-Schalter und Zuschauer', () => {
  const { r, ids } = room();
  const target = turn(r);
  const other = notOnTurn(r);
  const watcher = r.addPlayer('Zoe', null);
  assert.throws(() => r.nudge(watcher.id, target.id), /am Tisch sitzt/);
  r.updateSettings(ids[0], { nudge: false });
  assert.throws(() => r.nudge(other.id, target.id), /aus/);
  stop(r);
});

test('Automatisch angestupst, wenn jemand trödelt – einmal pro Zug, nicht wenn angehalten', async () => {
  const { r, ids, events } = room();
  r.nudgeAfter = 40;
  r.clock.clearTimeout(r.nudgeTimer); r.nudgeKey = null; r.afterChange(); // mit kurzer Frist neu planen
  const target = turn(r);
  await wait(90);
  const auto = events.filter((e) => e.kind === 'nudge');
  assert.equal(auto.length, 1);
  assert.equal(auto[0].data.to, target.id);
  assert.equal(auto[0].data.from, null, 'automatisch, nicht von einem Spieler');
  r.afterChange(); await wait(90);
  assert.equal(events.filter((e) => e.kind === 'nudge').length, 1, 'kein zweites Mal im selben Zug');
  // Nächster Spieler, aber der Host hält an → kein Anstupsen
  checkOrCall(r);
  r.toggleFreeze(ids[0]);
  await wait(90);
  assert.equal(events.filter((e) => e.kind === 'nudge').length, 1);
  r.toggleFreeze(ids[0]);
  stop(r);
});

// ---------- Spruchlisten ----------
test('Spruchlisten: ein Spruch pro Zeile, Grenzen, leer = Standard', () => {
  const many = Array.from({ length: 50 }, (_, i) => 'Spruch ' + i).join('\n');
  assert.equal(cleanLines(many, ['x']).length, MAX_LINES);
  assert.equal(cleanLines('a'.repeat(200), ['x'])[0].length, MAX_LINE_LEN);
  assert.deepEqual(cleanLines('  \n\n ', ['Standard']), ['Standard']);
  assert.deepEqual(cleanLines('Eins\r\n\u0007Zwei​\n', ['x']), ['Eins', 'Zwei']);
  const { r, ids } = room();
  r.updateSettings(ids[0], { foldLines: 'Nur einer' });
  assert.deepEqual(r.settings.foldLines, ['Nur einer']);
  assert.equal(r.settings.nudgeLines.length, DEFAULT_SETTINGS.nudgeLines.length, 'andere Liste bleibt');
  assert.throws(() => r.updateSettings(ids[1], { foldLines: 'x' }), /Nur der Host/);
  stop(r);
});

test('Standard-Pause zwischen den Händen ist 10 s', () => {
  assert.equal(DEFAULT_SETTINGS.nextDelay, 10);
});
