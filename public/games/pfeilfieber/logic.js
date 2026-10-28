// Pfeilfieber – Pfeilfolgen aus dem Seed, Nachspielen der Eingaben (Zeitstempel in ms seit Beginn) zur Prüfung und für die Live-Anzeige.
import { rng } from '../solo/rng.js';

export const ARROWS = ['↑', '↓', '←', '→']; // 0 hoch, 1 runter, 2 links, 3 rechts
export const MIN_GAP = 80;      // schneller kann kein Mensch tippen
export const LOCKOUT = 500;     // nach einem Fehler sind Eingaben so lange wirkungslos („kostet Zeit“)

// n-te Folge (ab 0): wird alle drei Folgen länger; level hebt den Start an
export function sequenceAt(seed, n, level = 0, { grow = false } = {}) {
  const r = rng((seed ^ Math.imul(n + 1, 2654435761)) >>> 0);
  const len = Math.min(8, 3 + level + Math.floor(n / 3) + (grow ? Math.floor(n / 2) : 0));
  return Array.from({ length: len }, () => r.int(4));
}

// inputs: [[Pfeil 0–3, t], …]. reverse: es zählt der jeweils entgegengesetzte Pfeil.
export function replay(seed, inputs, { playMs = 30000, level = 0, reverse = false, grow = false } = {}) {
  let n = 0, pos = 0, completed = 0, errors = 0, last = -Infinity, lock = -Infinity, ignored = 0;
  let seq = sequenceAt(seed, 0, level, { grow });
  for (const inp of (Array.isArray(inputs) ? inputs : []).slice(0, 600)) {
    const tok = Number(inp?.[0]), t = Number(inp?.[1]);
    if (!(tok >= 0 && tok <= 3) || !Number.isFinite(t) || t < 0 || t > playMs || t < last + MIN_GAP) { ignored++; continue; }
    last = t;
    if (t < lock) { ignored++; continue; }
    const want = reverse ? seq[pos] ^ 1 : seq[pos];
    if (tok === want) {
      pos++;
      if (pos === seq.length) { completed++; n++; pos = 0; seq = sequenceAt(seed, n, level, { grow }); }
    } else { errors++; pos = 0; lock = t + LOCKOUT; }
  }
  return { completed, errors, ignored, n, pos, seq, lockUntil: lock, pts: Math.max(0, completed * 10 - errors * 2) };
}
export function score(round, payload, { settings = {} } = {}) {
  const r = replay(round.seed, payload?.inputs, { playMs: round.playMs, level: round.level, reverse: !!settings.reverse, grow: !!settings.grow });
  return { pts: r.pts, ok: r.completed > 0, detail: `${r.completed} Folge${r.completed === 1 ? '' : 'n'}, ${r.errors} Fehler` };
}
// Bot: tippt die Folgen mit zufälligem Tempo und gelegentlichen Fehlern
export function botPayload(round, r = Math.random, settings = {}) {
  const inputs = [];
  let t = 600, n = 0, pos = 0, seq = sequenceAt(round.seed, 0, round.level, { grow: !!settings.grow });
  const pace = 260 + Math.floor(r() * 220);
  while (t < round.playMs - 400 && inputs.length < 500) {
    const want = settings.reverse ? seq[pos] ^ 1 : seq[pos];
    const tok = r() < 0.07 ? (want + 1 + Math.floor(r() * 3)) % 4 : want;
    inputs.push([tok, Math.round(t)]);
    t += pace + Math.floor(r() * 120);
    if (tok === want) { pos++; if (pos === seq.length) { n++; pos = 0; seq = sequenceAt(round.seed, n, round.level, { grow: !!settings.grow }); } }
    else { pos = 0; t += LOCKOUT; }
  }
  return { inputs };
}
export function makeRound(seed, level = 0, { playMs = 30000 } = {}) { return { seed, level, playMs }; }
export const solution = (round) => ({ first: sequenceAt(round.seed, 0, round.level) });
