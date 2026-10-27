// Schätzmeister – Partyspiel für 2–12. Pro Runde eine Schätzfrage mit einer Zahl als Antwort.
// Alle schätzen gleichzeitig; erst nach der Zeit (oder wenn alle fertig sind) werden alle Schätzungen und die richtige Antwort gezeigt.
// Punkte: am nächsten dran 3, Zweiter 2, Dritter 1 (gleich weit weg = gleiche Punkte, danach geht es mit dem nächsten Abstand weiter),
// exakt richtig +2 Bonus. Hausregel „Prozent“: höchstens 5 % daneben 3 Punkte, 15 % 2 Punkte, 30 % 1 Punkt.
// Die Fragen liegen in fragen.json (mit Quellenangabe); der Host kann eigene Fragen für den Abend ergänzen.
import { readFileSync } from 'node:fs';
import { PartyRoom, partyOptions } from '../party-room.js';

const CATALOG = JSON.parse(readFileSync(new URL('./fragen.json', import.meta.url), 'utf8'));
export const MAX_ABS = 1e15;

// Zahl aus Text: „1.234,5“, „3,5“, „-12“, „206“ – Punkt als Tausendertrenner, Komma als Dezimalzeichen. Sonst null.
export function parseNumber(input) {
  if (typeof input === 'number') return Number.isFinite(input) && Math.abs(input) <= MAX_ABS ? Math.round(input * 1000) / 1000 : null;
  let s = String(input ?? '').replace(/[\s '’]/g, '').replace(/^\+/, '').replace(/^−/, '-');
  if (!/^-?[\d.,]+$/.test(s) || s.length > 30 || !/\d/.test(s)) return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(',', '.');
  if ((s.match(/\./g) || []).length > 1) return null;
  const n = Number(s);
  return Number.isFinite(n) && Math.abs(n) <= MAX_ABS ? Math.round(n * 1000) / 1000 : null;
}

// Punkte pro Spieler: guesses = [{ id, value }] → { id: { pts, exact } }
export function scoreGuesses(guesses, answer, percent = false) {
  const out = {};
  const dist = (v) => Math.round(Math.abs(v - answer) * 1e6) / 1e6;
  const near = [...new Set(guesses.map((g) => dist(g.value)))].sort((a, b) => a - b);
  for (const { id, value } of guesses) {
    const d = dist(value);
    const exact = d === 0;
    const rel = d / (Math.abs(answer) || 1);
    const base = percent ? (rel <= 0.05 ? 3 : rel <= 0.15 ? 2 : rel <= 0.3 ? 1 : 0) : [3, 2, 1][near.indexOf(d)] || 0;
    out[id] = { pts: base + (exact ? 2 : 0), exact };
  }
  return out;
}

export const fmt = (n) => Number(n).toLocaleString('de-DE', { maximumFractionDigits: 3 });

export class Room extends PartyRoom {
  static OPTIONS = [...partyOptions({ voting: false }), { key: 'percent', label: 'Wertung nach Abweichung in Prozent (für sehr große Zahlen)', type: 'bool' }];
  defaultSettings() { return { rounds: 10, writeSecs: 30, target: 0, spectators: false, percent: false }; }

  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 2, maxPlayers: 12 });
    this.answers = {}; this.reveal = null;
  }
  get flow() { return ['write', 'reveal']; }
  catalog() { return CATALOG; }

  // Eigene Frage: „Frage | Zahl | Einheit“ (Einheit ist optional)
  parseCustom(line, i = 0) {
    const [q, num, unit = ''] = line.split('|').map((x) => x.trim());
    const a = parseNumber(num);
    if (!q || q.length < 5 || a === null) return null;
    return { id: `x${i + 1}`, q, a, unit: unit.slice(0, 30), src: 'Eigene Frage des Hosts' };
  }

  startQuestion() { this.answers = {}; this.reveal = null; }
  waiting() { return this.order.filter((id) => this.answers[id] === undefined); }
  isReady(id) { return this.answers[id] !== undefined; }

  // Schätzung abgeben (bis zum Ende der Zeit änderbar)
  guess(id, text) {
    if (this.phase !== 'playing' || this.stage !== 'write') throw new Error('Gerade wird nicht geschätzt');
    if (!this.canAnswer(id)) throw new Error('Du spielst in dieser Partie nicht mit');
    const n = parseNumber(text);
    if (n === null) throw new Error('Bitte eine Zahl eingeben, zum Beispiel 206 oder 3,5');
    this.answers[id] = n;
    if (this.order.includes(id)) this.act(id, '✓ fertig');
    this.checkDone();
  }

  enter(stage) {
    if (stage !== 'reveal') return;
    const a = this.cur.a;
    const all = Object.entries(this.answers).filter(([id]) => this.players.has(id)).map(([id, value]) => ({ id, value }));
    const scored = scoreGuesses(all.filter((g) => this.order.includes(g.id)), a, this.settings.percent);
    const guesses = all.map((g) => ({ id: g.id, value: g.value, pts: scored[g.id]?.pts ?? 0, exact: !!scored[g.id]?.exact, spectator: !this.order.includes(g.id) }))
      .sort((x, y) => Math.abs(x.value - a) - Math.abs(y.value - a));
    for (const g of guesses) if (!g.spectator) this.addPoints(g.id, g.pts);
    this.reveal = { answer: a, unit: this.cur.unit, src: this.cur.src, guesses, missing: this.order.filter((id) => this.answers[id] === undefined) };
    const best = guesses.find((g) => !g.spectator && g.pts > 0);
    this.say(`Richtig: ${fmt(a)} ${this.cur.unit}`.trim() + (best ? ` – ${this.name(best.id)} lag am nächsten (${fmt(best.value)})` : ' – niemand hat mitgeschätzt'), 'win');
  }

  // Zug eines Bots, wenn sein eigener Zug scheitert: eine ordentliche Schätzung
  fallback(id) { if (this.stage === 'write') this.guess(id, this.botGuess(Math.random)); }
  // Bots schätzen die richtige Antwort mal einem Zufallsfaktor zwischen 0,4 und 2,5 – sie wissen sie also nicht genau
  botGuess(rng) {
    const a = this.cur.a;
    if (a === 0) return Math.round((rng() - 0.5) * 10);
    const v = a * 0.4 * Math.pow(6.25, rng());
    return Math.abs(v) >= 20 ? Math.round(v) : Math.round(v * 10) / 10;
  }

  stageView(viewerId) {
    return {
      question: this.cur.q, unit: this.cur.unit,
      mine: this.answers[viewerId] ?? null,   // nur die eigene Schätzung – fremde erst in der Auflösung
      reveal: this.stage === 'reveal' ? this.reveal : null,
    };
  }
  static restore(data, onChange) { return PartyRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
