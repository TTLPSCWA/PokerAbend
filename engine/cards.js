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
