// Gedächtnisküche – Rezept (Zutatenfolge) aus dem Seed, Wertung der nachgetippten Folge.
import { rng } from '../solo/rng.js';

export const INGREDIENTS = [
  { name: 'Möhre', icon: '🥕' }, { name: 'Zwiebel', icon: '🧅' }, { name: 'Tomate', icon: '🍅' }, { name: 'Käse', icon: '🧀' },
  { name: 'Ei', icon: '🥚' }, { name: 'Pilz', icon: '🍄' }, { name: 'Chili', icon: '🌶️' }, { name: 'Kartoffel', icon: '🥔' },
];

// Jede Runde wird das Rezept eine Zutat länger (level = Nummer der Runde)
export function makeRound(seed, level = 0, { reverse = false } = {}) {
  const r = rng(seed);
  const len = Math.min(14, 3 + level);
  const seq = Array.from({ length: len }, () => r.int(INGREDIENTS.length));
  return { seq, reverse: !!reverse, expected: reverse ? [...seq].reverse() : seq, showMsPerItem: 750 };
}

// taps: gewählte Zutaten in Reihenfolge. Der erste Fehler beendet die Folge.
export function score(round, payload, { elapsedMs = 0 } = {}) {
  const taps = Array.isArray(payload?.taps) ? payload.taps.slice(0, round.expected.length).map(Number) : [];
  let k = 0;
  while (k < taps.length && taps[k] === round.expected[k]) k++;
  const full = k === round.expected.length;
  const bonus = full ? Math.max(0, 10 - Math.floor(elapsedMs / 3000)) : 0;
  return { pts: k * 10 + (full ? 20 : 0) + bonus, ok: full, detail: `${k} von ${round.expected.length}` };
}
export function botPayload(round, r = Math.random) {
  const full = r() < 0.65;
  const k = full ? round.expected.length : Math.floor(r() * round.expected.length);
  const taps = round.expected.slice(0, k);
  if (!full) taps.push((round.expected[k] + 1 + Math.floor(r() * 7)) % INGREDIENTS.length);
  return { taps };
}
export const solution = (round) => ({ recipe: round.expected, reverse: round.reverse });
