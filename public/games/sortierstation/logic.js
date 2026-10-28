// Sortierstation – Förderband aus dem Seed: Dinge mit Farbe und Form, zwei oder drei Kisten, Regel „nach Farbe“ oder „nach Form“.
import { rng } from '../solo/rng.js';

export const COLORS = [{ name: 'Rot', css: '#D9534F' }, { name: 'Blau', css: '#3C7DD9' }, { name: 'Gelb', css: '#E8B21C' }];
export const SHAPES = [{ name: 'Kreis' }, { name: 'Quadrat' }, { name: 'Dreieck' }];

// playMs: so lange läuft das Band. Das Band wird schneller (kürzere Abstände, kürzere Zeit pro Ding).
export function makeRound(seed, level = 0, { playMs = 30000, switchRule = false } = {}) {
  const r = rng(seed);
  const boxes = level >= 1 ? 3 : 2;
  const items = [];
  let t = 400;
  for (let i = 0; i < 80 && t < playMs; i++) {
    const gap = Math.max(650, 1700 - i * 30 - level * 100);
    const life = Math.max(1300, 3000 - i * 35 - level * 150);
    items.push({ i, t, life, color: r.int(boxes), shape: r.int(boxes) });
    t += gap;
  }
  return { seed, level, boxes, items, playMs, switchRule: !!switchRule };
}
// Nach welchem Merkmal wird zur Zeit t sortiert? Ungerade Runden nach Form, mit Regelwechsel in der Mitte der Zeit
export function ruleAt(round, t) {
  const base = round.level % 2 === 1 ? 1 : 0;
  return round.switchRule && t >= round.playMs / 2 ? 1 - base : base;
}
export const ruleName = (rule) => (rule === 0 ? 'Farbe' : 'Form');
export const expectedBox = (round, item) => (ruleAt(round, item.t) === 0 ? item.color : item.shape);

// decisions: [{ i, b, t }] – Ding i in Kiste b zur Zeit t (ms seit Beginn)
export function evaluate(round, decisions, { noPenalty = false } = {}) {
  let right = 0, wrong = 0;
  const done = new Set();
  for (const d of (Array.isArray(decisions) ? decisions : []).slice(0, 120)) {
    const i = Number(d?.i), b = Number(d?.b), t = Number(d?.t);
    const it = round.items[i];
    if (!it || done.has(i) || !(b >= 0 && b < round.boxes) || !Number.isFinite(t) || t < it.t || t > it.t + it.life || t > round.playMs + 500) continue;
    done.add(i);
    if (b === expectedBox(round, it)) right++; else wrong++;
  }
  const missed = round.items.length - done.size;
  return { right, wrong, missed, pts: Math.max(0, right * 10 - (noPenalty ? 0 : wrong * 5)) };
}
export function score(round, payload, { settings = {} } = {}) {
  const e = evaluate(round, payload?.decisions, { noPenalty: settings.noPenalty === true });
  return { pts: e.pts, ok: e.right > 0, detail: `${e.right} richtig, ${e.wrong} falsch, ${e.missed} verpasst` };
}
export function botPayload(round, r = Math.random) {
  const acc = 0.7 + r() * 0.25;
  const decisions = [];
  for (const it of round.items) {
    if (r() < 0.1) continue; // verpasst
    const ok = r() < acc;
    const b = ok ? expectedBox(round, it) : (expectedBox(round, it) + 1) % round.boxes;
    decisions.push({ i: it.i, b, t: Math.min(round.playMs, it.t + Math.min(it.life - 100, 400 + Math.floor(r() * 500))) });
  }
  return { decisions };
}
export const solution = (round) => ({ rule: ruleName(ruleAt(round, 0)) });
