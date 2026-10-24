// Zentrale Vergabe der Raumcodes – für alle Spiele gemeinsam, damit ein Code nie doppelt existiert.
import { randomInt } from 'node:crypto';

export const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne 0/O und 1/I
export const CODE_LENGTH = 5;

// random(n) liefert 0 … n-1 – nur für Tests austauschbar
export function createCodes({ random = randomInt } = {}) {
  const used = new Map(); // Code → Spielart

  return {
    // Neuer, freier Code. Wer ihn nicht mehr braucht, gibt ihn mit release() zurück.
    take(game = 'poker') {
      for (let tries = 0; tries < 10000; tries++) {
        const code = Array.from({ length: CODE_LENGTH }, () => CODE_CHARS[random(CODE_CHARS.length)]).join('');
        if (!used.has(code)) { used.set(code, game); return code; }
      }
      throw new Error('Gerade ist kein Code frei');
    },
    // Bekannten Code belegen (z. B. beim Laden gespeicherter Tische). false, wenn er schon vergeben ist.
    claim(code, game = 'poker') {
      code = normalize(code);
      if (!code || used.has(code)) return false;
      used.set(code, game);
      return true;
    },
    release(code) { used.delete(normalize(code)); },
    has(code) { return used.has(normalize(code)); },
    gameOf(code) { return used.get(normalize(code)) ?? null; },
    get size() { return used.size; },
  };
}

export const normalize = (code) => String(code || '').toUpperCase().trim();
