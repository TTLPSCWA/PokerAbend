import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { Room } from '../games/scotland-yard/room.js';
import { CITY } from '../games/scotland-yard/map.js';

function renderer(language = 'de') {
  let definition;
  const context = vm.createContext({
    I18n: { language }, document: { addEventListener() {}, querySelector() { return null; } },
    esc: (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    kitGame: (def) => { definition = def; return { render() {} }; },
  });
  vm.runInContext(readFileSync(new URL('../public/games/scotland-yard/scotland-yard.js', import.meta.url), 'utf8'), context);
  return definition;
}
function table(t) {
  const r = new Room('STADT', { turnTime: 0 }, () => {});
  t.after(() => r.dispose());
  const ids = ['Morgan', 'Ada', 'Noah'].map((name) => { const p = r.addPlayer(name, null); r.sit(p.id); return p.id; });
  r.chooseX(ids[0], ids[0]); r.start(ids[0]);
  r.positions = { [ids[0]]: 9, [ids[1]]: 1, [ids[2]]: 49 };
  return { r, ids };
}
const markerCount = (html, kind) => (html.match(new RegExp(`class="sy-stop [^"]*\\b${kind}\\b`, 'g')) || []).length;

test('Scotland visual: every real station and connection is represented once', (t) => {
  const { r, ids: [x] } = table(t), def = renderer(), html = def.main(r.view(x));
  const stations = [...html.matchAll(/class="sy-stop [^"]*"[^>]*data-to="(\d+)"/g)].map((m) => Number(m[1]));
  assert.deepEqual(stations, CITY.nodes.map((n) => n.id));
  assert.equal((html.match(/class="sy-road /g) || []).length, CITY.edges.length);
  assert.equal(markerCount(html, 'mister'), 1); assert.equal(markerCount(html, 'detective'), 2);
  assert.match(html, /data-agent="1"/); assert.match(html, /data-agent="2"/);
  const dock = def.dock(r.view(x), true);
  for (const match of dock.matchAll(/data-g="sy-stop" data-to="(\d+)"/g)) assert.ok(r.legal(x).some((m) => m.to === Number(match[1]) && m.ticket === 'taxi'));
});

test('Scotland visual: other hidden positions/ticket supplies produce identical detective and spectator HTML', (t) => {
  const { r, ids: [x, detective] } = table(t), watcher = r.addPlayer('Robin', null).id;
  for (const viewer of [detective, watcher]) {
    const def = renderer(), before = def.main(r.view(viewer));
    r.positions[x] = 10; r.tickets[x].taxi = 999; r.tickets[x].black = 0;
    assert.equal(def.main(r.view(viewer)), before);
    assert.equal(markerCount(before, 'mister'), 0); assert.ok(!before.includes('class="sy-private"'));
    assert.ok(!before.includes('sy-wallet-ticket sy-black'));
    r.positions[x] = 9; r.tickets[x].taxi = 4; r.tickets[x].black = 5;
  }
});

test('Scotland visual: last sighting and final reveal use only public server state', (t) => {
  const { r, ids: [x, detective] } = table(t), def = renderer();
  r.lastSeen = { move: 3, station: 17 }; r.travel = [{ move: 3, ticket: 'bus', station: 17 }, { move: 4, ticket: 'taxi' }];
  let html = def.main(r.view(detective));
  assert.equal(markerCount(html, 'ghost'), 1); assert.equal(markerCount(html, 'mister'), 0);
  assert.match(html, /class="sy-clue">Zuletzt gesehen: 17/);
  r.win('x', 'Ende'); html = def.main(r.view(detective));
  assert.equal(markerCount(html, 'mister'), 1);
  assert.match(def.resultExtra(r.view(x)), /Mission erfolgreich/);
  assert.match(def.resultExtra(r.view(detective)), /Gegenseite/);
});

test('Scotland visual: names stay escaped in roster, marker labels and lobby', (t) => {
  const { r, ids: [x, detective] } = table(t), def = renderer();
  const s = r.view(x); s.players.find((p) => p.id === detective).name = '"><img src=x onerror=alert(1)>';
  for (const html of [def.main(s), def.lobby(s)]) {
    assert.ok(!html.includes('<img src=x')); assert.ok(html.includes('&lt;img'));
  }
});

test('Scotland visual: English briefing, transport controls and public-clue descriptions are authored', (t) => {
  const { r, ids: [x] } = table(t), def = renderer('en'), s = r.view(x);
  assert.match(def.lobby(s), /One city.<br>One secret/);
  assert.match(def.main(s), /You are Mr. X/); assert.match(def.main(s), /LAST PUBLIC CLUE/);
  assert.match(def.dock(s, true), /Choose transport/); assert.match(def.dock(s, true), /Black ticket/);
  assert.match(def.dock(s, false), /Stay hidden/);
});
