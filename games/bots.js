// Einfache Computer-Züge für die Rundenspiele: regelkonform, mit etwas Zufall.
// Jede Funktion macht genau eine Aktion für den Spieler id, der gerade dran ist.
// Gebraucht im Massentest (test/simulation.test.js) und später für Bot-Mitspieler.
import { PHASES, partition, validGroup } from './zehnetappen/room.js';
import { JOKER } from './stapelrennen/room.js';
import { valueOf } from './maexchen/room.js';
import { handValue } from './schwimmen/room.js';
import { randomFleet, around, SIZE } from './schiffe/room.js';

const one = (list, rng) => list[Math.floor(rng() * list.length)];

// Mau-Mau und UNO: passende Karte spielen, sonst ziehen, sonst weiter
function shedding(room, id, rng) {
  if (room.forgot && rng() < 0.5) {
    const who = room.order.filter((p) => p !== room.forgot);
    if (rng() < 0.3) room.lateCall(room.forgot); else room.catchForgot(one(who, rng));
  }
  const v = room.gameView(id);
  if (v.playable.length) {
    const c = one(v.playable, rng);
    const wishes = ['c', 's', 'h', 'd', 'r', 'y', 'g', 'b'].filter((w) => room.validWish(w));
    // Bei der vorletzten Karte meistens an „Mau“/„UNO“ denken – manchmal nicht
    return room.play(id, c, room.needsWish(c) ? one(wishes, rng) : undefined, rng() < 0.75);
  }
  return v.drawn ? room.pass(id) : room.draw(id);
}

function maexchen(room, id, rng) {
  const v = room.gameView(id);
  if (v.cup) {
    const from = v.last ? v.values.indexOf(v.last.value) + 1 : 0;
    const allowed = v.values.slice(from);
    const real = valueOf(v.cup);
    // Ehrlich, wenn es reicht – sonst meistens knapp drüber bluffen
    const value = allowed.includes(real) && rng() < 0.8 ? real : rng() < 0.7 ? allowed[0] : one(allowed, rng);
    return room.announce(id, value);
  }
  if (v.last?.value === 21) return rng() < 0.5 ? room.doubt(id) : room.accept(id);
  // Ungesehen weitergeben (wenn erlaubt), knapp über der letzten Ansage
  if (v.last && room.settings.blindPass && rng() < 0.2) {
    const next = v.values[v.values.indexOf(v.last.value) + 1];
    if (next) return room.passBlind(id, next);
  }
  if (v.last && rng() < 0.35) return room.doubt(id);
  return room.throwDice(id);
}

function schocken(room, id, rng) {
  const n = room.throws[id] || 0;
  if (!n) return room.throwDice(id);
  const d = room.dice[id];
  if (room.settings.sixToOne && n < room.maxThrows && room.forced[id] === undefined && d.filter((x) => x === 6).length >= 2 && rng() < 0.6) return room.turnSixes(id);
  if (room.reroll[id] !== undefined) return room.throwDice(id, []); // nach dem Drehen weiterwürfeln
  if (n < room.maxThrows && rng() < 0.5) {
    const keep = [0, 1, 2].filter((i) => i !== room.forced[id] && rng() < 0.4).slice(0, room.forced[id] === undefined ? 2 : 1);
    return room.throwDice(id, keep);
  }
  return room.stop(id);
}

function huetchen(room, id, rng) {
  if (room.rolled === null) return room.throwDice(id);
  return room.move(id, one(room.options, rng));
}

// Phase 10: Phase suchen und auslegen, dann anlegen, sonst abwerfen
function findPhase(hand, groups, limit = 4000) {
  const need = groups.reduce((a, [, k]) => a + k, 0);
  if (hand.length < need) return null;
  const pick = [];
  let tries = 0;
  const go = (start) => {
    if (pick.length === need) { tries++; return partition(pick.map((i) => hand[i]), groups) ? pick.slice() : null; }
    for (let i = start; i <= hand.length - (need - pick.length) && tries < limit; i++) {
      pick.push(i);
      const r = go(i + 1);
      pick.pop();
      if (r) return r;
    }
    return null;
  };
  const idx = go(0);
  return idx && idx.map((i) => hand[i]);
}
function zehnetappen(room, id, rng) {
  if (room.step === 'draw') {
    const top = room.discard[room.discard.length - 1];
    return room.drawCard(id, top && top.c !== 's' && rng() < 0.3 ? 'discard' : 'deck');
  }
  const hand = room.hands[id];
  if (!room.done.has(id)) {
    const cards = findPhase(hand.filter((c) => c.c !== 's'), PHASES[room.phaseOf(id)]);
    if (cards) return room.layPhase(id, cards.map((c) => c.id));
  } else {
    for (const c of hand) {
      for (const owner of Object.keys(room.laid)) {
        const g = room.laid[owner].findIndex((gr) => validGroup(gr.type, [...gr.cards, c]));
        if (g >= 0) return room.hit(id, c.id, owner, g);
      }
    }
  }
  const skip = hand.find((c) => c.c === 's');
  const c = skip && rng() < 0.7 ? skip : one(hand, rng);
  const others = room.order.filter((p) => p !== id);
  return room.throwAway(id, c.id, c.c === 's' ? one(others, rng) : undefined);
}
// Skip-Bo: was passt, auf die Baureihen (Stapel zuerst), sonst abwerfen
function stapelrennen(room, id, rng) {
  const sources = [];
  const stock = room.stock[id];
  if (stock.length) sources.push([{ kind: 'stock' }, stock[stock.length - 1]]);
  room.hand[id].forEach((n, i) => sources.push([{ kind: 'hand', index: i }, n]));
  room.piles[id].forEach((p, i) => { if (p.length) sources.push([{ kind: 'pile', index: i }, p[p.length - 1]]); });
  for (const [from, n] of sources) {
    // Joker nicht verschwenden, wenn es auch anders geht – außer vom Stapel
    if (n === JOKER && from.kind !== 'stock' && rng() < 0.5) continue;
    const to = room.build.findIndex((b) => n === JOKER || b.length + 1 === n);
    if (to >= 0) return room.play(id, from, to);
  }
  if (!room.hand[id].length) return room.pass(id); // kein Nachziehen möglich: ohne Abwerfen weiter
  return room.throwAway(id, Math.floor(rng() * room.hand[id].length), Math.floor(rng() * 4));
}

// Schwimmen: meist der Tausch, der am meisten bringt; manchmal zufällig, alle drei oder schieben; klopft mit guter Hand
function schwimmen(room, id, rng) {
  const fire = room.settings.fire;
  const hand = room.hands[id];
  const cur = handValue(hand, fire);
  // Je länger der Durchgang dauert, desto eher wird geklopft (sonst tauschen zwei Bots ewig hin und her)
  const rounds = room.turnsTaken / room.order.length;
  if (room.canKnock() && (cur >= 31 - rounds + rng() * 3 || rounds > 12) && rng() < 0.7) return room.knock(id);
  if (room.settings.passing && rng() < 0.12) return room.pass(id);
  if (rng() < 0.08 || handValue(room.middle, fire) > cur + 3) return room.swapAll(id);
  let best = null;
  for (let h = 0; h < 3; h++) for (let m = 0; m < 3; m++) {
    const t = [...hand]; t[h] = room.middle[m];
    const v = handValue(t, fire);
    if (!best || v > best.v) best = { v, h, m };
  }
  if (rng() < 0.2) return room.swap(id, Math.floor(rng() * 3), Math.floor(rng() * 3));
  if (best.v <= cur && room.settings.passing && rng() < 0.5) return room.pass(id);
  return room.swap(id, best.h, best.m);
}

// Schiffe versenken: zufällig setzen; schießen neben Treffer, die noch nicht versenkt sind – sonst zufällig
function schiffe(room, id, rng) {
  if (room.step === 'place') return room.place(id, randomFleet(room.fleet(), room.settings.touch, rng));
  const mine = room.shots[id];
  const sunkCells = new Set((room.sunk[id] || []).flatMap((k) => room.ships[room.other(id)][k].cells)); // versenkt wurde angesagt
  const open = Object.keys(mine).map(Number).filter((c) => mine[c] === 'hit' && !sunkCells.has(c));
  const free = (c) => !mine[c];
  const near = open.flatMap((c) => around(c).filter((n) => free(n) && (Math.floor(n / SIZE) === Math.floor(c / SIZE) || n % SIZE === c % SIZE)));
  const pool = near.length && rng() < 0.9 ? near : [...Array(SIZE * SIZE).keys()].filter(free);
  return room.shoot(id, pool[Math.floor(rng() * pool.length)]);
}

export const BOTS = { maumau: shedding, farbenchaos: shedding, maexchen, schocken, huetchen, zehnetappen, stapelrennen, schwimmen, schiffe };
