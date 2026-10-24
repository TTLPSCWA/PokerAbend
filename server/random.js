// Zufall für alle Spiele – kryptografisch sicher, damit niemand Karten oder Würfel vorhersagen kann.
import { randomInt } from 'node:crypto';

// Fisher-Yates; rng(n) liefert 0 … n-1 (Tests geben einen eigenen Zufall mit)
export function shuffle(list, rng = randomInt) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export const die = (rng = randomInt) => rng(6) + 1;
