// Spielbilder für die Startseite: kleine Motive aus Karten, Würfeln und Brettern als SVG (64 × 64), ohne Bilddateien und ohne Skripte.
// Jedes Spielmodul bringt sein Bild selbst mit (art: fan([...]) usw. in games/<spiel>/index.js); der Browser setzt das Markup ein.
const PAPER = '#F7F3E8';
const INK = '#1A1A1A';
const wrap = (inner) => `<svg class="game-art" viewBox="0 0 64 64" aria-hidden="true" focusable="false">${inner}</svg>`;

// ---------- Karten ----------
const mark = (kind, cx, cy, color) => {
  if (kind === 'dot') return `<circle cx="${cx}" cy="${cy}" r="4.2" fill="${color}"/>`;
  if (kind === 'diamond') return `<path d="M${cx} ${cy - 6}L${cx + 4.5} ${cy}L${cx} ${cy + 6}L${cx - 4.5} ${cy}Z" fill="${color}"/>`;
  if (kind === 'heart') return `<path d="M${cx} ${cy + 5}C${cx - 8} ${cy - 1} ${cx - 4} ${cy - 7} ${cx} ${cy - 3}C${cx + 4} ${cy - 7} ${cx + 8} ${cy - 1} ${cx} ${cy + 5}Z" fill="${color}"/>`;
  if (kind === 'bars') return [-7, -1.5, 4].map((d) => `<rect x="${cx - 5}" y="${cy + d}" width="10" height="3" rx="1.5" fill="${color}"/>`).join('');
  return '';
};
const card = ({ cx, cy, rot = 0, fill = PAPER, kind = '', color = '#B3261E' }) =>
  `<g transform="rotate(${rot} ${cx} ${cy})"><rect x="${cx - 10}" y="${cy - 14}" width="20" height="28" rx="3.2" fill="${fill}" stroke="rgba(0,0,0,.4)" stroke-width="1"/>${mark(kind, cx, cy, color)}</g>`;
// Fächer aus Karten: [{ fill, kind, color }]
export const fan = (cards) => wrap(cards.map((c, i, a) => {
  const m = i - (a.length - 1) / 2;
  return card({ cx: 32 + m * 13, cy: 34 + Math.abs(m) * 2.5, rot: m * 16, ...c });
}).join(''));
// Karten als Treppe (Skip-Bo)
export const stairs = (fills) => wrap(fills.map((fill, i) => card({ cx: 20 + i * 12, cy: 42 - i * 8, fill, kind: 'bars', color: 'rgba(0,0,0,.45)' })).join(''));
// Zwei Karten und ein Chip (Poker, Blackjack)
export const cardsChip = (a, b, chip) => wrap(`${card({ cx: 24, cy: 30, rot: -12, ...a })}${card({ cx: 36, cy: 31, rot: 8, ...b })}<circle cx="46" cy="47" r="9" fill="${chip}" stroke="rgba(0,0,0,.4)"/><circle cx="46" cy="47" r="5.5" fill="none" stroke="${PAPER}" stroke-width="1.6" stroke-dasharray="2.2 2"/>`);
// Drei Karten nebeneinander über einer Welle (Schwimmen)
export const swim = () => wrap(`${[0, 1, 2].map((i) => card({ cx: 17 + i * 15, cy: 28, rot: (i - 1) * 4, kind: i === 1 ? 'heart' : 'diamond' })).join('')}<path d="M4 50c6-5 10 5 16 0s10 5 16 0 10 5 16 0 6 2 8 0" fill="none" stroke="#7FB4E8" stroke-width="3" stroke-linecap="round"/>`);

// ---------- Würfel ----------
const PIPS = { 1: [[.5, .5]], 2: [[.27, .27], [.73, .73]], 3: [[.27, .27], [.5, .5], [.73, .73]], 4: [[.27, .27], [.73, .27], [.27, .73], [.73, .73]],
  5: [[.27, .27], [.73, .27], [.5, .5], [.27, .73], [.73, .73]], 6: [[.27, .25], [.73, .25], [.27, .5], [.73, .5], [.27, .75], [.73, .75]] };
const die = ({ x, y, n, s = 20, rot = 0, fill = PAPER, pip = INK }) => `<g transform="rotate(${rot} ${x + s / 2} ${y + s / 2})"><rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s * 0.2}" fill="${fill}" stroke="rgba(0,0,0,.4)" stroke-width="1"/>${PIPS[n].map(([px, py]) => `<circle cx="${(x + px * s).toFixed(1)}" cy="${(y + py * s).toFixed(1)}" r="${(s * 0.075 + 0.8).toFixed(1)}" fill="${pip}"/>`).join('')}</g>`;
// Würfel: [{ x, y, n, s, rot, fill }]
export const dice = (list) => wrap(list.map(die).join(''));

// ---------- Bretter ----------
export const connect4 = () => {
  const colors = ['', '', '#D33B35', '', '', '', '#F2C230', '#D33B35', '', '', '#D33B35', '#F2C230', '#F2C230', '#D33B35', '', '#F2C230', '#D33B35', '#D33B35', '#F2C230', '#F2C230'];
  const cells = colors.map((c, k) => `<circle cx="${(14 + (k % 5) * 9).toFixed(1)}" cy="${(19 + Math.floor(k / 5) * 9).toFixed(1)}" r="3.6" fill="${c || '#0B1513'}"/>`).join('');
  return wrap(`<rect x="7" y="9" width="50" height="46" rx="6" fill="#1F57C3"/>${cells}`);
};
export const mill = () => wrap(`<g fill="none" stroke="${PAPER}" stroke-width="2"><rect x="8" y="8" width="48" height="48"/><rect x="18" y="18" width="28" height="28"/><rect x="26" y="26" width="12" height="12" stroke-width="0"/><path d="M32 8v10M32 46v10M8 32h10M46 32h10"/></g>
  ${[[8, 8, PAPER], [32, 8, PAPER], [56, 8, INK], [18, 18, INK], [46, 46, PAPER], [32, 56, INK], [8, 56, PAPER], [18, 46, INK]].map(([x, y, f]) => `<circle cx="${x}" cy="${y}" r="4.4" fill="${f}" stroke="rgba(120,120,120,.8)" stroke-width="1"/>`).join('')}`);
export const battle = () => wrap(`<rect x="6" y="8" width="52" height="48" rx="6" fill="#1F57C3"/><g stroke="rgba(255,255,255,.35)" stroke-width="1">${[16, 26, 36, 46].map((p) => `<path d="M6 ${p}H58M${p + 6} 8V56"/>`).join('')}</g>
  <rect x="12" y="22" width="30" height="8" rx="4" fill="#C9D8D1" stroke="rgba(0,0,0,.4)"/><rect x="42" y="36" width="8" height="16" rx="4" fill="#C9D8D1" stroke="rgba(0,0,0,.4)"/><circle cx="34" cy="26" r="3.6" fill="#E53935"/><circle cx="22" cy="44" r="2.6" fill="#fff"/>`);
export const pawns = () => wrap(`<path d="M24 6h16v18h18v16H40v18H24V40H6V24h18z" fill="#E3C08A" stroke="rgba(0,0,0,.4)"/>${[[12, 12, '#D33B35'], [52, 12, '#1F57C3'], [12, 52, '#1C7A43'], [52, 52, '#F2C230']].map(([x, y, f]) => `<circle cx="${x}" cy="${y}" r="7" fill="${f}" stroke="rgba(0,0,0,.45)" stroke-width="1.4"/>`).join('')}${die({ x: 26, y: 26, n: 5, s: 12 })}`);
export const flapBox = () => wrap(`<rect x="5" y="10" width="54" height="44" rx="5" fill="#7A5238" stroke="rgba(0,0,0,.4)"/>${[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => { const closed = (r * 3 + c) % 3 === 1; return `<rect x="${11 + c * 16}" y="${16 + r * 12}" width="12" height="9" rx="2" fill="${closed ? '#4E3322' : '#E3C08A'}" stroke="rgba(0,0,0,.35)"/>`; })).join('')}`);

// ---------- Party ----------
// Zahlenstrahl mit Schätzungen und Flagge bei der richtigen Antwort
export const numberLine = () => wrap(`<rect x="6" y="36" width="52" height="4" rx="2" fill="rgba(255,255,255,.55)"/><path d="M38 10v26" stroke="#C99A45" stroke-width="3"/><path d="M38 10h12l-4 5 4 5H38z" fill="#C99A45"/>
  ${[[14, '#F7F3E8'], [27, '#9DB7E8'], [49, '#7FD39A']].map(([x, f]) => `<circle cx="${x}" cy="48" r="5" fill="${f}" stroke="rgba(0,0,0,.4)"/>`).join('')}`);
// Sprechblasen (für kommende Partyspiele)
export const bubbles = () => wrap(`<path d="M8 12h30a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H22l-8 7v-7H8a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4z" fill="${PAPER}" stroke="rgba(0,0,0,.4)"/><path d="M26 30h30a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4h-2v7l-8-7H26a4 4 0 0 1-4-4V34a4 4 0 0 1 4-4z" fill="#C99A45" stroke="rgba(0,0,0,.4)"/>`);
