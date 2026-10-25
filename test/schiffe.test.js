// Schiffe versenken: Aufstellung, Schießen, Versenken, Sieg, Zug-Timer – und vor allem: gegnerische Schiffe bleiben geheim.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Room, buildFleet, randomFleet, FLEETS, cellName } from '../games/schiffe/room.js';

const H = (cell) => ({ cell, horizontal: true });
const V = (cell) => ({ cell, horizontal: false });
// Standardflotte 5, 4, 3, 3, 2 – waagerecht in den Zeilen 1, 3, 5, 7, 9 (Zeile = Index / 10)
const FLEET_A = [H(0), H(20), H(40), H(60), H(80)];
const FLEET_B = [H(5), H(25), H(45), H(65), H(85)];

function setup(settings = {}) {
  const r = new Room('SV', { turnTime: 0, ...settings }, () => {});
  const ids = ['Anna', 'Ben', 'Zoe'].map((n) => r.addPlayer(n, null).id);
  r.sit(ids[0]); r.sit(ids[1]); // Zoe schaut zu
  r.start(ids[0]);
  return { r, a: ids[0], b: ids[1], z: ids[2] };
}
const ready = (r, a, b) => { r.place(a, FLEET_A); r.place(b, FLEET_B); };

test('Aufstellung: nicht überlappen, nicht berühren (auch über Eck), Berühren als Hausregel, aufs Brett', () => {
  const f = FLEETS.standard;
  assert.equal(buildFleet(FLEET_A, f, false).length, 5);
  assert.throws(() => buildFleet([H(0), H(2), H(40), H(60), H(80)], f, false), /überlappen/);
  assert.throws(() => buildFleet([H(0), H(10), H(40), H(60), H(80)], f, false), /berühren/, 'direkt darunter');
  assert.throws(() => buildFleet([H(0), H(15), H(40), H(60), H(80)], f, false), /berühren/, 'über Eck: 5er endet bei E1, 4er beginnt bei F2');
  assert.equal(buildFleet([H(0), H(10), H(40), H(60), H(80)], f, true).length, 5, 'mit Hausregel erlaubt');
  assert.throws(() => buildFleet([H(7), H(20), H(40), H(60), H(80)], f, false), /passt nicht/, '5er ragt rechts hinaus');
  assert.throws(() => buildFleet([V(70), H(20), H(40), H(62), H(85)], f, false), /passt nicht/, '5er ragt unten hinaus');
  assert.throws(() => buildFleet(FLEET_A.slice(0, 4), f, false), /alle 5 Schiffe/);
  // Zufällige Aufstellungen sind immer gültig – auch die klassische Flotte ohne Berühren
  for (let k = 0; k < 50; k++) {
    assert.equal(buildFleet(randomFleet(FLEETS.classic, false), FLEETS.classic, false).length, 10);
    assert.equal(buildFleet(randomFleet(f, false), f, false).length, 5);
  }
  assert.equal(cellName(0), 'A1'); assert.equal(cellName(99), 'J10'); assert.equal(cellName(14), 'E2');
});

test('Setzen: genau zwei, erst schießen, wenn beide fertig sind; umstellen, solange der andere setzt', () => {
  const { r, a, b } = setup();
  assert.equal(r.step, 'place');
  assert.throws(() => r.shoot(a, 5), /Erst müssen alle|nicht dran/);
  r.place(a, FLEET_A);
  assert.throws(() => r.place(a, FLEET_A), /steht schon/);
  r.unplace(a);
  r.place(a, FLEET_A);
  assert.equal(r.currentId, b, 'Ben setzt noch');
  r.place(b, FLEET_B);
  assert.equal(r.step, 'shoot');
  assert.equal(r.currentId, a);
  assert.throws(() => r.unplace(a), /nicht möglich/);
  const three = new Room('X', {}, () => {});
  ['A', 'B', 'C'].forEach((n) => three.addPlayer(n, null));
  const [x, y, w] = [...three.players.keys()];
  three.sit(x); three.sit(y);
  assert.throws(() => three.sit(w), /Mehr als 2/);
});

test('GEHEIM: gegnerische Schiffe kommen nie in die Ansicht – nur Treffer, Wasser, versenkt; nach Spielende alles', () => {
  const { r, a, b, z } = setup();
  ready(r, a, b);
  const secret = (viewer, owner) => {
    const v = r.view(viewer);
    assert.equal(v.g.seas[owner].ships, null, 'Schiffsliste darf nicht mit');
    // Kein noch schwimmendes Schiff taucht irgendwo in der ganzen Ansicht auf (als Zellenliste)
    const json = JSON.stringify(v);
    const sunk = new Set((r.sunk[r.other(owner)] || []).map((k) => k));
    r.ships[owner].forEach((s, k) => { if (!sunk.has(k)) assert.ok(!json.includes(JSON.stringify(s.cells)), `Schiff ${s.cells} verraten`); });
    // Auf dem fremden Meer steht nur, was wirklich beschossen wurde
    const sea = v.g.seas[owner];
    assert.deepEqual(Object.keys(sea.shots).map(Number).sort(), Object.keys(r.shots[r.other(owner)]).map(Number).sort());
  };
  secret(a, b); secret(b, a); secret(z, a); secret(z, b);
  assert.deepEqual(r.view(a).g.seas[a].ships.map((s) => s.size), [5, 4, 3, 3, 2], 'eigene Schiffe sieht man');
  // Ben trifft und versenkt Annas Zerstörer (80, 81): danach ist genau dieses Schiff für alle sichtbar
  r.shoot(a, 99); // Wasser → Ben
  r.shoot(b, 80); r.shoot(a, 98); r.shoot(b, 81);
  const zv = r.view(z).g.seas[a];
  assert.deepEqual(zv.sunk.map((s) => s.cells), [[80, 81]]);
  assert.equal(zv.ships, null, 'Zuschauer sehen die übrigen Schiffe nicht');
  secret(z, a); secret(b, a);
  assert.equal(r.view(b).players.find((p) => p.id === a).afloat, 4, 'versenkt wird angesagt');
  // Spielende: alles aufgedeckt
  r.stand(b);
  assert.equal(r.phase, 'over');
  assert.ok(r.view(z).g.seas[a].ships, 'nach Spielende aufgedeckt');
});

test('Schießen: Wasser und Treffer wechseln, kein Feld zweimal, Hausregel „nochmal“, versenkt und Sieg', () => {
  const { r, a, b } = setup();
  ready(r, a, b);
  r.shoot(a, 99);
  assert.equal(r.currentId, b, 'Wasser → Wechsel');
  r.shoot(b, 0);
  assert.equal(r.currentId, a, 'Treffer → Wechsel (Standard)');
  assert.equal(r.shots[b][0], 'hit');
  assert.throws(() => r.shoot(a, 99), /schon hingeschossen/);
  assert.throws(() => r.shoot(b, 1), /nicht dran/);
  // Mit „nochmal“: Anna versenkt Bens ganze Flotte in einem Zug
  const g = setup({ again: true });
  ready(g.r, g.a, g.b);
  const cells = g.r.ships[g.b].flatMap((s) => s.cells);
  cells.forEach((c, i) => {
    assert.equal(g.r.currentId, g.a, `Treffer ${i} → nochmal`);
    g.r.shoot(g.a, c);
  });
  assert.equal(g.r.phase, 'over');
  assert.deepEqual(g.r.result.winners, [g.a]);
  assert.equal(g.r.scores[g.a], 1);
  assert.match(g.r.log.map((l) => l.text).join('\n'), /Zerstörer versenkt/);
});

test('Klassische Flotte: 10 Schiffe', () => {
  const { r, a } = setup({ classic: true });
  assert.deepEqual(r.view(a).g.fleet, [5, 4, 4, 3, 3, 3, 2, 2, 2, 2]);
  assert.throws(() => r.place(a, FLEET_A), /alle 10 Schiffe/);
  r.place(a, randomFleet(FLEETS.classic, false));
  assert.equal(r.ships[a].length, 10);
});

test('Zug-Timer: läuft beim Schießen, nicht beim Setzen; abgelaufen = zufälliger Schuss; 0 = aus', () => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  try {
    const { r, a, b } = setup({ turnTime: 30 });
    r.afterChange();
    assert.equal(r.view(a).deadline, null, 'beim Setzen keine Uhr');
    ready(r, a, b); r.afterChange();
    assert.ok(r.view(a).deadline > Date.now(), 'Uhr läuft');
    mock.timers.tick(29000);
    assert.equal(Object.keys(r.shots[a]).length, 0);
    mock.timers.tick(1500);
    assert.equal(Object.keys(r.shots[a]).length, 1, 'zufällig geschossen');
    assert.match(r.log.at(-2).text + r.log.at(-1).text, /zu langsam/);
    // Neuer Zug → neue Uhr
    const turnNow = r.currentId;
    r.afterChange();
    mock.timers.tick(31000);
    assert.ok(Object.keys(r.shots[turnNow]).length >= 1);
    r.dispose();
    const off = setup({ turnTime: 0 });
    ready(off.r, off.a, off.b); off.r.afterChange();
    assert.equal(off.r.view(off.a).deadline, null);
  } finally { mock.timers.reset(); }
});

test('Aussteigen: der andere gewinnt', () => {
  const { r, a, b } = setup();
  ready(r, a, b);
  r.stand(a);
  assert.equal(r.phase, 'over');
  assert.deepEqual(r.result.winners, [b]);
});
