// Zahlenzoo – Ablauf und Wertung (läuft auf dem Server zur Prüfung und im Browser zur Anzeige, aus demselben Seed).
import { rng } from '../solo/rng.js';

export const ANIMALS = [
  { id: 'katze', one: 'Katze', many: 'Katzen', icon: '🐱' },
  { id: 'hund', one: 'Hund', many: 'Hunde', icon: '🐶' },
  { id: 'hase', one: 'Hase', many: 'Hasen', icon: '🐰' },
  { id: 'frosch', one: 'Frosch', many: 'Frösche', icon: '🐸' },
  { id: 'maus', one: 'Maus', many: 'Mäuse', icon: '🐭' },
];

// Eine Frage: Tiere kommen ins Bild und gehen wieder (events), danach wird eine Zahl gefragt. level = Nummer der Frage (0, 1, …), die Schwierigkeit steigt.
export function makeRound(seed, level = 0, { countOnly = false, kinds = 0 } = {}) {
  const r = rng(seed);
  const pool = [...ANIMALS].sort(() => r() - 0.5);
  const nKinds = Math.min(5, kinds || 2 + (level >= 2 ? 1 : 0) + (level >= 4 ? 1 : 0));
  const types = pool.slice(0, nKinds);
  const n = Math.min(22, 5 + level * 2);
  const inn = {}, out = {}, alive = {};
  for (const a of types) { inn[a.id] = 0; out[a.id] = 0; alive[a.id] = 0; }
  const events = [];
  let t = 0;
  for (let i = 0; i < n; i++) {
    t += 450 + r.int(450);
    const a = r.pick(types);
    const leave = alive[a.id] > 0 && r.int(100) < 30;
    if (leave) { out[a.id]++; alive[a.id]--; } else { inn[a.id]++; alive[a.id]++; }
    events.push({ t, animal: a.id, dir: leave ? 'out' : 'in' });
  }
  const kind = countOnly || level === 0 ? 'count' : r.pick(['count', 'diff', 'sum']);
  let a = r.pick(types), b = r.pick(types.filter((x) => x.id !== a.id));
  let text, answer;
  if (kind === 'count') { text = `Wie viele ${a.many} sind am Ende noch im Bild?`; answer = alive[a.id]; }
  else if (kind === 'diff') {
    if (alive[a.id] < alive[b.id]) [a, b] = [b, a];
    text = `Wie viele ${a.many} mehr als ${b.many} sind am Ende im Bild?`; answer = alive[a.id] - alive[b.id];
  } else { text = `Wie viele ${a.many} und ${b.many} zusammen sind insgesamt hereingekommen?`; answer = inn[a.id] + inn[b.id]; }
  return { events, types: types.map((x) => x.id), question: { kind, a: a.id, b: kind === 'count' ? null : b.id, text }, answer, durationMs: t };
}

// Wer ist zur Zeit t (ms) im Bild? { tierId: Anzahl }
export function visibleAt(round, t) {
  const c = Object.fromEntries(round.types.map((id) => [id, 0]));
  for (const e of round.events) if (e.t <= t) c[e.animal] += e.dir === 'in' ? 1 : -1;
  return c;
}

// Wertung einer Antwort: richtig 100, dazu bis zu 50 für Tempo (1 Punkt weniger je Sekunde seit Beginn)
export function score(round, payload, { elapsedMs = 0, settings = {} } = {}) {
  const raw = Number(payload?.answer);
  if (!Number.isFinite(raw) || Math.abs(raw) > 1000) return { pts: 0, ok: false, detail: 'ungültig' };
  const ans = Math.round(raw);
  const ok = ans === round.answer;
  const bonus = settings.timeBonus === false ? 0 : Math.max(0, 50 - Math.floor(elapsedMs / 1000));
  return { pts: ok ? 100 + bonus : 0, ok, detail: String(ans) };
}
export function botPayload(round, r = Math.random) {
  const ok = r() < 0.7;
  return { answer: ok ? round.answer : Math.max(0, round.answer + (r() < 0.5 ? -1 : 1) * (1 + Math.floor(r() * 2))) };
}
export const solution = (round) => ({ answer: round.answer, question: round.question.text });
