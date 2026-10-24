// Karten, Deck und Handauswertung für Texas Hold'em.
// Karten sind Strings wie "As" (Pik-Ass), "Td" (Karo-Zehn): Rang + Farbe.
import { randomInt } from 'node:crypto';

export const RANKS = '23456789TJQKA';
export const SUITS = 'shdc'; // spades, hearts, diamonds, clubs

export function newDeck() {
  const deck = [];
  for (const r of RANKS) for (const s of SUITS) deck.push(r + s);
  return deck;
}

// Fisher-Yates mit kryptografisch sicherem Zufall. rng(n) liefert 0..n-1.
export function shuffle(deck, rng = randomInt) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

const value = (card) => RANKS.indexOf(card[0]) + 2;

export const HAND_NAMES = [
  'Höchste Karte', 'Paar', 'Zwei Paare', 'Drilling', 'Straße',
  'Flush', 'Full House', 'Vierling', 'Straight Flush', 'Royal Flush',
];

const ONE = { 2: 'Zwei', 3: 'Drei', 4: 'Vier', 5: 'Fünf', 6: 'Sechs', 7: 'Sieben', 8: 'Acht', 9: 'Neun', 10: 'Zehn', 11: 'Bube', 12: 'Dame', 13: 'König', 14: 'Ass' };
const MANY = { 2: 'Zweien', 3: 'Dreien', 4: 'Vieren', 5: 'Fünfen', 6: 'Sechsen', 7: 'Siebenen', 8: 'Achten', 9: 'Neunen', 10: 'Zehnen', 11: 'Buben', 12: 'Damen', 13: 'Könige', 14: 'Asse' };

// Bewertet genau 5 Karten. Ergebnis: [Kategorie, Tiebreaker...] – lexikografisch vergleichbar.
export function eval5(cards) {
  const vals = cards.map(value).sort((a, b) => b - a);
  const flush = cards.every((c) => c[1] === cards[0][1]);
  const distinct = new Set(vals).size === 5;
  let straightHigh = 0;
  if (distinct) {
    if (vals[0] - vals[4] === 4) straightHigh = vals[0];
    else if (vals[0] === 14 && vals[1] === 5) straightHigh = 5; // A-2-3-4-5
  }
  const counts = new Map();
  for (const v of vals) counts.set(v, (counts.get(v) || 0) + 1);
  const groups = [...counts].map(([v, c]) => [c, v]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const gv = groups.map((g) => g[1]);

  if (straightHigh && flush) return [straightHigh === 14 ? 9 : 8, straightHigh];
  if (groups[0][0] === 4) return [7, ...gv];
  if (groups[0][0] === 3 && groups[1][0] === 2) return [6, ...gv];
  if (flush) return [5, ...vals];
  if (straightHigh) return [4, straightHigh];
  if (groups[0][0] === 3) return [3, ...gv];
  if (groups[0][0] === 2 && groups[1][0] === 2) return [2, ...gv];
  if (groups[0][0] === 2) return [1, ...gv];
  return [0, ...vals];
}

export function compareScores(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

function* combinations(arr, k, start = 0, picked = []) {
  if (picked.length === k) { yield picked.slice(); return; }
  for (let i = start; i <= arr.length - (k - picked.length); i++) {
    picked.push(arr[i]);
    yield* combinations(arr, k, i + 1, picked);
    picked.pop();
  }
}

export function describe(score) {
  const [cat, a, b] = score;
  switch (cat) {
    case 0: return `Höchste Karte ${ONE[a]}`;
    case 1: return `Paar ${MANY[a]}`;
    case 2: return `Zwei Paare, ${MANY[a]} und ${MANY[b]}`;
    case 3: return `Drilling ${MANY[a]}`;
    case 4: return `Straße bis ${ONE[a]}`;
    case 5: return `Flush, ${ONE[a]} hoch`;
    case 6: return `Full House, ${MANY[a]} über ${MANY[b]}`;
    case 7: return `Vierling ${MANY[a]}`;
    case 8: return `Straight Flush bis ${ONE[a]}`;
    default: return 'Royal Flush';
  }
}

// Beste 5-Karten-Hand aus 5–7 Karten. Bei weniger Karten (Pre-Flop) nur Paar/Höchste Karte.
export function bestHand(cards) {
  if (cards.length < 5) {
    const vals = cards.map(value).sort((x, y) => y - x);
    const score = vals.length === 2 && vals[0] === vals[1] ? [1, vals[0]] : [0, ...vals];
    return { score, cards: cards.slice(), name: describe(score), category: score[0] };
  }
  let best = null;
  let bestCards = null;
  for (const combo of combinations(cards, 5)) {
    const s = eval5(combo);
    if (!best || compareScores(s, best) > 0) { best = s; bestCards = combo; }
  }
  return { score: best, cards: bestCards, name: describe(best), category: best[0] };
}

// Nur die Kategorie einer 5–7-Karten-Hand – deutlich schneller als bestHand, für Wahrscheinlichkeiten
function straightTop(mask) {
  if ((mask & 0x403c) === 0x403c) mask |= 2; // Ass zählt auch als 1 (A-2-3-4-5)
  for (let v = 14; v >= 5; v--) if (((mask >> (v - 4)) & 31) === 31) return v;
  return 0;
}
export function category(cards) {
  const counts = new Array(15).fill(0);
  const suitMask = { s: 0, h: 0, d: 0, c: 0 };
  const suitCount = { s: 0, h: 0, d: 0, c: 0 };
  let mask = 0;
  for (const c of cards) {
    const v = value(c);
    counts[v]++; mask |= 1 << v;
    suitMask[c[1]] |= 1 << v; suitCount[c[1]]++;
  }
  const fs = SUITS.split('').find((x) => suitCount[x] >= 5);
  if (fs) {
    const top = straightTop(suitMask[fs]);
    if (top) return top === 14 ? 9 : 8;
  }
  let trips = 0, pairs = 0;
  for (let v = 2; v <= 14; v++) {
    if (counts[v] === 4) return 7;
    if (counts[v] === 3) trips++;
    else if (counts[v] === 2) pairs++;
  }
  if (trips && (pairs || trips > 1)) return 6;
  if (fs) return 5;
  if (straightTop(mask)) return 4;
  if (trips) return 3;
  if (pairs >= 2) return 2;
  return pairs ? 1 : 0;
}

// Welche Hand wird es bis zum River? Anteil je Kategorie (0 = Höchste Karte … 9 = Royal Flush).
// Gegner bleiben unbekannt. Flop/Turn: alle restlichen Karten durchrechnen, Pre-Flop: Stichprobe.
export function outlook(hole, board, { samples = 20000, rng = Math.random } = {}) {
  const known = new Set([...hole, ...board]);
  const rest = newDeck().filter((c) => !known.has(c));
  const need = 5 - board.length;
  const counts = Array(HAND_NAMES.length).fill(0);
  let n = 0;
  const add = (extra) => { counts[category([...hole, ...board, ...extra])]++; n++; };
  if (need === 0) add([]);
  else if (need <= 2) for (const combo of combinations(rest, need)) add(combo);
  else {
    for (let k = 0; k < samples; k++) {
      const pool = rest.slice();
      const extra = [];
      for (let j = 0; j < need; j++) extra.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
      add(extra);
    }
  }
  return counts.map((c) => c / n);
}
