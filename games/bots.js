// Einfache Computer-Züge für die Rundenspiele: regelkonform, mit etwas Zufall.
// Jede Funktion macht genau eine Aktion für den Spieler id, der gerade dran ist.
// Gebraucht im Massentest (test/simulation.test.js) und später für Bot-Mitspieler.
import { PHASES, partition, validGroup } from './zehnetappen/room.js';
import { JOKER } from './stapelrennen/room.js';
import { valueOf } from './maexchen/room.js';
import { handValue } from './schwimmen/room.js';
import { randomFleet, around, SIZE } from './schiffe/room.js';
import { total as bjTotal } from './blackjack/room.js';
import { botColumn } from './viergewinnt/room.js';
import { combos as stbCombos } from './shutthebox/room.js';

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

// Blackjack: zufälliger Einsatz, einfache Strategie (bis 16 ziehen, bei 10/11 meist verdoppeln, manchmal teilen)
function blackjack(room, id, rng) {
  const min = room.settings.minBet;
  if (room.step === 'bet') {
    if (room.stacks[id] < min && room.canRebuy(id)) room.rebuy(id);
    if (room.stacks[id] < min || rng() < 0.08) return room.sitOut(id);
    const max = Math.min(room.settings.maxBet, room.stacks[id]);
    return room.bet(id, min + Math.floor(rng() * (max - min + 1)));
  }
  if (room.step === 'insure') { const half = Math.floor(room.bets[id] / 2); return room.insure(id, half >= 1 && room.stacks[id] >= half && rng() < 0.3); }
  const t = bjTotal(room.hands[id][room.handIdx].cards).total;
  if (room.canSplit(id) && rng() < 0.5) return room.split(id);
  if (room.canDouble(id) && (t === 10 || t === 11 || rng() < 0.05)) return room.double(id);
  if (t < 17 && rng() < 0.9) return room.hit(id);
  return room.stay(id);
}

// Kniffel: die häufigste Augenzahl liegen lassen, bis zu 3 Würfe; dann das Feld mit den meisten Punkten (sonst das unwichtigste streichen)
function kniffel(room, id, rng) {
  if (!room.rolls || (room.rolls < 3 && rng() < 0.75)) {
    const c = [0, 0, 0, 0, 0, 0, 0]; room.dice.forEach((x) => c[x]++);
    const best = c.indexOf(Math.max(...c.slice(1)));
    const keep = room.rolls ? room.dice.map((x, i) => (x === best ? i : -1)).filter((i) => i >= 0) : [];
    if (keep.length < 5) return room.throwDice(id, keep);
  }
  const opts = Object.entries(room.options(id));
  opts.sort((a, b) => b[1] - a[1] || (rng() < 0.5 ? -1 : 1));
  const [field, v] = opts[0];
  if (v > 0) return room.score(id, field);
  const order = ['ones', 'kniffel', 'twos', 'largeStraight', 'threes', 'fourKind', 'smallStraight', 'fullHouse', 'fours', 'threeKind', 'fives', 'sixes', 'chance'];
  return room.score(id, order.find((f) => opts.some(([k]) => k === f)) || field);
}

// Vier gewinnt: eigener Sieg, Gegner blocken, Mitte – manchmal zufällig (sonst wären die Partien immer gleich)
function viergewinnt(room, id, rng) {
  const foe = room.order.find((p) => p !== id);
  const free = [...Array(7).keys()].filter((c) => room.board[c] === null);
  return room.drop(id, rng() < 0.25 ? free[Math.floor(rng() * free.length)] : botColumn(room.board, id, foe, rng));
}

// Shut the Box: meist die Kombination mit den höchsten Klappen, manchmal zufällig; ein Würfel, wenn wenig offen ist
function shutthebox(room, id, rng) {
  if (!room.pending) return room.throwDice(id, room.canOneDie(id) && (room.boxes[id].reduce((a, b) => a + b, 0) <= 6 || rng() < 0.3) ? 1 : 2);
  const all = stbCombos(room.boxes[id], room.dice.reduce((a, b) => a + b, 0));
  all.sort((a, b) => Math.max(...b) - Math.max(...a));
  return room.close(id, rng() < 0.2 ? all[Math.floor(rng() * all.length)] : all[0]);
}

export const BOTS = { maumau: shedding, farbenchaos: shedding, maexchen, schocken, huetchen, zehnetappen, stapelrennen, schwimmen, schiffe, blackjack, kniffel, viergewinnt, shutthebox };
