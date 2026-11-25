// Doppelkopf nach den Turnierspielregeln des Deutschen Doppelkopf-Verbands (Stand 21.02.2026): reine Regelfunktionen.
// Karten sind "Rang+Farbe+Kopie", z. B. "Qc0" (erste Kreuz-Dame) – jede Karte gibt es doppelt. Farben: c Kreuz, s Pik, h Herz, d Karo.
export const SUITS = 'cshd';
export const POINTS = { A: 11, T: 10, K: 4, Q: 3, J: 2, 9: 0 };
export const base = (c) => c.slice(0, 2);
export const cardName = (c) => `${{ c: 'Kreuz', s: 'Pik', h: 'Herz', d: 'Karo' }[c[1]]} ${{ 7: 'Sieben', 8: 'Acht', 9: 'Neun', T: 'Zehn', J: 'Bube', Q: 'Dame', K: 'König', A: 'Ass' }[c[0]]}`;
export const cardPoints = (c) => POINTS[c[0]];
export const sumPoints = (cards) => cards.reduce((n, c) => n + cardPoints(c), 0);

export function dkDeck(nines = true) {
  const ranks = nines ? '9TJQKA' : 'TJQKA';
  return [...ranks].flatMap((r) => [...SUITS].flatMap((s) => [r + s + '0', r + s + '1']));
}
export const handSize = (nines) => (nines ? 12 : 10);

// ---------- Spielarten ----------
export const SOLOS = ['queens', 'jacks', 'plain', 'c', 's', 'h', 'd'];
// contract: { kind: 'normal' | 'hochzeit' | 'solo', solo?, schweine?: boolean }
export function normalizeContract(input) {
  const kind = input?.kind;
  if (kind === 'normal' || kind === 'hochzeit') return { kind };
  if (kind === 'solo' && SOLOS.includes(input.solo)) return { kind, solo: input.solo };
  throw new Error('Wähle gesund, Hochzeit oder ein Solo');
}
const QUEENS = ['Qc', 'Qs', 'Qh', 'Qd'], JACKS = ['Jc', 'Js', 'Jh', 'Jd'];
// Trumpfliste von hoch nach niedrig (Kartenarten ohne Kopie)
export function trumpList(k) {
  const solo = k.kind === 'solo' ? k.solo : null;
  if (solo === 'queens') return [...QUEENS];
  if (solo === 'jacks') return [...JACKS];
  if (solo === 'plain') return [];
  const suit = SOLOS.includes(solo) && solo.length === 1 ? solo : 'd';
  const list = ['Th', ...QUEENS, ...JACKS, ...[...'ATK9'].map((r) => r + suit).filter((c) => c !== 'Th')];
  return k.schweine ? ['Ad', ...list.filter((c) => c !== 'Ad')] : list;
}
const SUIT_ORDER = (k) => (k.kind === 'solo' && k.solo === 'queens' ? 'ATKJ9' : k.kind === 'solo' && k.solo === 'jacks' ? 'ATKQ9' : k.kind === 'solo' && k.solo === 'plain' ? 'ATKQJ9' : 'ATK9');
const cache = new WeakMap();
function tables(k) {
  if (cache.has(k)) return cache.get(k);
  const list = trumpList(k), t = { trump: new Map(list.map((c, i) => [c, 100 - i])), order: SUIT_ORDER(k), dulle: list.includes('Th') };
  cache.set(k, t);
  return t;
}
export const isTrump = (c, k) => tables(k).trump.has(base(c));
export const effSuit = (c, k) => (isTrump(c, k) ? 't' : c[1]);
export const strength = (c, k) => { const t = tables(k); return t.trump.get(base(c)) ?? t.order.length - t.order.indexOf(c[0]); };
export function legalCards(hand, trick, k) {
  if (!trick.length) return [...hand];
  const lead = effSuit(trick[0].card, k), follow = hand.filter((c) => effSuit(c, k) === lead);
  return follow.length ? follow : [...hand];
}
// Gleiche Karten: die zuerst gespielte gewinnt – außer die zweite Herz-Zehn (Dulle) sticht die erste
export function beats(a, b, k) {
  const x = effSuit(a, k), y = effSuit(b, k);
  if (x !== y) return x === 't';
  const sa = strength(a, k), sb = strength(b, k);
  return sa > sb || (sa === sb && tables(k).dulle && base(a) === 'Th');
}
export function trickWinner(trick, k) {
  let best = trick[0];
  for (const p of trick.slice(1)) if (beats(p.card, best.card, k)) best = p;
  return best.id;
}

// ---------- Ansagen (DDV-Turnierspielregeln, Stand 21.02.2026, Abschnitte 6.2–6.4) ----------
export const LEVELS = ['', 'Re/Kontra', 'keine 90', 'keine 60', 'keine 30', 'schwarz'];
export const levelName = (party, level) => (level === 1 ? (party === 're' ? 'Re' : 'Kontra') : LEVELS[level]);
// Wie viele Karten müssen mindestens noch auf der Hand sein, wenn die Ansage fällt (N = Startkarten).
// shift: angemeldete Hochzeit mit Klärungsstich 2 bzw. 3 verringert die Kartenzahl um 1 bzw. 2 (6.4.2).
export const announceDeadline = (N, level, shift = 0) => N - level - shift;
// Erlaubte Zielstufen einer Partei zum jetzigen Zeitpunkt.
//   own/opp: bisherige Stufe der eigenen bzw. gegnerischen Partei (0 = nichts, 1 = Re/Kontra … 5 = schwarz)
//   late: die eigene Erstansage kam nur noch als Erwiderung – danach keine Absagen mehr (6.4.4)
export function announceOptions({ N, cards, own, opp, shift = 0, late = false }) {
  if (own >= 5 || (own >= 1 && late)) return [];
  const range = (from) => [1, 2, 3, 4, 5].filter((l) => l >= from);
  // Rechtzeitig: alle übersprungenen Stufen müssen jetzt noch zulässig sein (6.4.3) – maßgeblich ist die nächste Stufe.
  if (cards >= announceDeadline(N, own + 1, shift)) return range(own + 1);
  // Erwiderung: nur „Re“ bzw. „Kontra“, eine Karte weniger als für die gegnerische An- bzw. Absage nötig war (6.4.4).
  if (own === 0 && opp >= 1 && cards >= announceDeadline(N, opp, shift) - 1) return [1];
  return [];
}
// Wurde die Erstansage nur noch als Erwiderung zugelassen?
export const isLateReply = ({ N, cards, own, shift = 0 }) => own === 0 && cards < announceDeadline(N, 1, shift);

// ---------- Auswertung (DDV 7.1 Gewinnkriterien, 7.2 Spielwerte) ----------
const NEED = { 2: 151, 3: 181, 4: 211 };   // eigene Absage „keine 90/60/30“
const AGAINST = { 2: 90, 3: 60, 4: 30 };   // Siegschwelle gegen eine gegnerische Absage, wenn man selbst nichts abgesagt hat
const other = (party) => (party === 're' ? 'kontra' : 're');
const PNAME = { re: 'Re', kontra: 'Kontra' };
// Hat die Partei ihr Gewinnkriterium nach 7.1.1 bzw. 7.1.2 erreicht?
export function reachesGoal(party, { points, tricks, levels }) {
  const own = levels[party], opp = levels[other(party)], pts = points[party];
  if (own >= 2) return own === 5 ? tricks[other(party)] === 0 : pts >= NEED[own];
  if (opp >= 2) return opp === 5 ? tricks[party] > 0 : pts >= AGAINST[opp];
  if (party === 're') return pts >= (own === 0 && opp === 1 ? 120 : 121);
  return pts >= (own === 1 && opp === 0 ? 121 : 120);
}
// 7.2.2 (a): unter 90/60/30 bzw. schwarz gespielt – Punkte für party, weil der Gegner darunter blieb
function lowPoints(party, points, tricks) {
  const o = other(party), out = [];
  for (const [t, name] of [[90, 'unter 90'], [60, 'unter 60'], [30, 'unter 30']]) if (points[o] < t) out.push(`${PNAME[o]} ${name} gespielt`);
  if (tricks[o] === 0) out.push(`${PNAME[o]} schwarz gespielt`);
  return out;
}
// 7.2.2 (e)/(f): Augen gegen eine gegnerische Absage erreicht
function againstPoints(party, points, levels) {
  const opp = levels[other(party)], out = [];
  for (const [l, need, name] of [[2, 120, 'keine 90'], [3, 90, 'keine 60'], [4, 60, 'keine 30'], [5, 30, 'schwarz']]) {
    if (opp >= l && points[party] >= need) out.push(`${PNAME[party]}: ${need} Augen gegen „${name}“`);
  }
  return out;
}
// Spielart der Abrechnung: Solo-Wertung für Solo, stille Hochzeit und angemeldete Hochzeit ohne Partner (4.4.3 b, 4.4.5, 7.2.4)
export function scoringKind(k, re) {
  if (k.kind === 'solo') return 'solo';
  if (re.length === 1) return k.kind === 'hochzeit' ? 'hochzeit-allein' : 'stille-hochzeit';
  return 'normal';
}

// input: { contract, re: [ids], kontra: [ids], points: {re, kontra}, tricks: {re, kontra}, levels: {re, kontra}, specials: { re: n, kontra: n } }
// Ergebnis: value = Spielwert aus Sicht von Re (positiv: Re erhält ihn); breakdown listet jede Position mit Partei und Punkt.
export function scoreDeal(input) {
  const { contract: k, re, kontra, points, tricks, levels } = input;
  const kind = scoringKind(k, re), soloLike = kind !== 'normal';
  const reMet = reachesGoal('re', input), kMet = reachesGoal('kontra', input);
  const winner = reMet ? 're' : kMet ? 'kontra' : null;
  const breakdown = [];
  const add = (party, text, n = 1, special = false) => breakdown.push({ party, text, points: n, special });
  if (winner) {
    add(winner, 'Gewonnen');
    for (const t of lowPoints(winner, points, tricks)) add(winner, t);
    for (const party of ['re', 'kontra']) {
      if (levels[party] >= 1) add(winner, `„${levelName(party, 1)}“ angesagt`, 2);
      for (let l = 2; l <= levels[party]; l++) add(winner, `${PNAME[party]}: „${levelName(party, l)}“ abgesagt`);
    }
    for (const t of againstPoints(winner, points, levels)) add(winner, t);
  } else {
    // 7.1.3: Beide verfehlen ihr abgesagtes Ziel – nur (a) ohne Grundwert, (e), (f) und Sonderpunkte.
    for (const party of ['re', 'kontra']) {
      for (const t of lowPoints(party, points, tricks)) add(party, t);
      for (const t of againstPoints(party, points, levels)) add(party, t);
    }
  }
  const gameOf = (party) => breakdown.filter((b) => b.party === party && !b.special).reduce((n, b) => n + b.points, 0);
  const gamePoints = winner ? gameOf(winner) : 0;
  // 7.2.3: Sonderpunkte nur im Normalspiel (auch Hochzeit mit Partner); „gegen die Kreuz-Damen gewonnen“ ist einer davon.
  let specialNet = soloLike ? 0 : (input.specials?.re || 0) - (input.specials?.kontra || 0);
  if (!soloLike && winner === 'kontra') { specialNet--; add('kontra', 'gegen die Kreuz-Damen gewonnen (Sonderpunkt)', 1, true); }
  const value = gameOf('re') - gameOf('kontra') + specialNet;
  const detail = breakdown.map((b) => `${b.text}${b.points > 1 ? ` (${b.points})` : ''}`);
  if (kind === 'stille-hochzeit') detail.push('stille Hochzeit: Abrechnung wie ein Solo, dreifach für den Alleinspieler');
  else if (kind === 'hochzeit-allein') detail.push('Hochzeit ohne Partner: Abrechnung wie ein Karo-Solo, dreifach für den Alleinspieler');
  else if (kind === 'solo') detail.push('Solo: dreifach für den Solisten');
  const per = {};
  for (const id of re) per[id] = (value * (soloLike ? 3 : 1)) || 0;
  for (const id of kontra) per[id] = -value || 0;
  return { winner, gamePoints, value, per, detail, breakdown, kind, solo: soloLike, specialsCounted: !soloLike, reMet, kMet };
}

// Sonderpunkte aus den gespielten Stichen: tricks = [{ plays:[{id,card}], winner, points }]
export function specialPoints(tricks, partyOf, k) {
  const out = { re: 0, kontra: 0, list: [] };
  const give = (party, text) => { out[party]++; out.list.push({ party, text }); };
  tricks.forEach((t, i) => {
    const party = partyOf(t.winner);
    if (t.points >= 40) give(party, 'Doppelkopf');
    if (!k.schweine) for (const p of t.plays) if (base(p.card) === 'Ad' && partyOf(p.id) !== party) give(party, 'Fuchs gefangen');
    if (i === tricks.length - 1 && isTrump('Jc0', k) && base(t.plays.find((p) => p.id === t.winner).card) === 'Jc') give(party, 'Karlchen');
  });
  return out;
}
