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

// ---------- Weitere Bretter und Symbole (für geplante Spiele) ----------
const disc = (x, y, f, r = 4.6) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" stroke="rgba(0,0,0,.45)" stroke-width="1"/>`;
export const reversi = () => wrap(`<rect x="8" y="8" width="48" height="48" rx="5" fill="#1C7A43"/><g stroke="rgba(0,0,0,.3)">${[20, 32, 44].map((p) => `<path d="M8 ${p}H56M${p} 8V56"/>`).join('')}</g>${disc(26, 26, INK)}${disc(38, 26, PAPER)}${disc(26, 38, PAPER)}${disc(38, 38, INK)}${disc(14, 14, INK)}`);
export const checkers = () => wrap(`<rect x="8" y="8" width="48" height="48" rx="4" fill="#E3C08A"/>${[0, 1, 2, 3].flatMap((r) => [0, 1, 2, 3].map((c) => ((r + c) % 2 ? `<rect x="${8 + c * 12}" y="${8 + r * 12}" width="12" height="12" fill="#7A5238"/>` : ''))).join('')}${disc(20, 20, '#D33B35')}${disc(44, 20, '#D33B35')}${disc(20, 44, PAPER)}${disc(44, 44, PAPER)}`);
export const dominoes = () => wrap(`<g transform="rotate(-14 24 34)"><rect x="12" y="18" width="24" height="32" rx="4" fill="${PAPER}" stroke="rgba(0,0,0,.4)"/><path d="M12 34h24" stroke="rgba(0,0,0,.4)"/>${disc(24, 26, INK, 2.2)}${disc(19, 42, INK, 2.2)}${disc(29, 42, INK, 2.2)}</g><g transform="rotate(12 42 32)"><rect x="32" y="14" width="22" height="30" rx="4" fill="${PAPER}" stroke="rgba(0,0,0,.4)"/><path d="M32 29h22" stroke="rgba(0,0,0,.4)"/>${disc(43, 21, INK, 2.2)}${disc(43, 37, INK, 2.2)}</g>`);
const hex = (cx, cy, r, f) => `<path d="${[0, 1, 2, 3, 4, 5].map((k) => `${k ? 'L' : 'M'}${(cx + r * Math.cos(Math.PI / 6 + (k * Math.PI) / 3)).toFixed(1)} ${(cy + r * Math.sin(Math.PI / 6 + (k * Math.PI) / 3)).toFixed(1)}`).join('')}Z" fill="${f}" stroke="rgba(0,0,0,.4)"/>`;
export const hexBoard = (colors = ['#1F57C3', '#D33B35', '#F7F3E8', '#7FD39A', '#C99A45', '#9DB7E8', '#E3C08A']) => wrap([[32, 32], [32, 14], [47, 23], [47, 41], [32, 50], [17, 41], [17, 23]].map(([x, y], k) => hex(x, y, 9, colors[k % colors.length])).join(''));
export const chess = () => wrap(`<rect x="8" y="8" width="48" height="48" rx="3" fill="#E3C08A"/>${[0, 1, 2, 3].flatMap((r) => [0, 1, 2, 3].map((c) => ((r + c) % 2 ? `<rect x="${8 + c * 12}" y="${8 + r * 12}" width="12" height="12" fill="#7A5238"/>` : ''))).join('')}<path d="M26 46h14l-2-6c4-3 6-8 2-13l3-5-6 2c-6-4-14 2-13 8l-4 4 4 2z" fill="${INK}" stroke="${PAPER}" stroke-width="1.5" stroke-linejoin="round"/>`);
export const territory = () => wrap(`<path d="M8 20l14-10 14 4 12-6 8 14-6 14 4 12-16 6-12-6-14 2z" fill="#7FB4E8" stroke="rgba(0,0,0,.4)"/><path d="M22 10l4 20-14 6M36 14l-6 22 16 8M48 8l-4 22" fill="none" stroke="rgba(0,0,0,.4)" stroke-width="1.5"/>${disc(20, 24, '#D33B35')}${disc(38, 28, '#1F57C3')}${disc(44, 46, '#F2C230')}`);
// Rundes Symbol für Partyspiele (Name aus GLYPHS)
const GLYPHS = {
  pen: '<path d="m19 40 3 6 6-3 18-18-9-9zM33 20l10 10M20 46l8-3"/>',
  story: '<path d="M19 19h20v28H19zM25 26h8M25 32h8M25 38h12M39 23h6v24h-6"/>',
  monster: '<path d="m22 25-3-9 10 7h6l10-7-3 9v15l-10 8-10-8zM27 30v3M37 30v3M27 39h10"/>',
  shield: '<path d="m32 17 15 6-3 17-12 9-12-9-3-17zM25 33l5 5 10-12"/>',
  gift: '<rect x="21" y="31" width="22" height="14"/><rect x="19" y="26" width="26" height="6"/><path d="M32 26v19M32 26c-5-7-10-3-6 0M32 26c5-7 10-3 6 0"/>',
  note: '<path d="M26 40V22l14-4v18"/><circle cx="23" cy="41" r="4" fill="#F7F3E8"/><circle cx="37" cy="37" r="4" fill="#F7F3E8"/>',
  puzzle: '<path d="M20 22h10v-3a3 3 0 0 1 6 0v3h8v8h-3a3 3 0 0 0 0 6h3v8H20z"/>',
  letters: '<rect x="19" y="19" width="12" height="12"/><rect x="33" y="19" width="12" height="12"/><rect x="19" y="33" width="12" height="12"/><rect x="33" y="33" width="12" height="12"/>',
  mines: '<circle cx="32" cy="34" r="8" fill="#F7F3E8"/><path d="M32 20v6M32 42v6M18 34h6M40 34h6M22 24l4 4M42 24l-4 4M22 44l4-4M42 44l-4-4"/>',
  maze: '<path d="M20 20h24v24H20zM28 20v14h8M28 44V38"/>',
  push: '<ellipse cx="32" cy="42" rx="16" ry="5"/><path d="M22 30h14M32 24l6 6-6 6"/>',
  spotlight: '<path d="M32 18l12 24H20z"/><circle cx="32" cy="47" r="3" fill="#F7F3E8"/>',
  agent: '<path d="M18 28h28M24 28v-6h16v6"/><circle cx="26" cy="38" r="5"/><circle cx="38" cy="38" r="5"/><path d="M31 38h2"/>',
  mask: '<path d="M20 26h24v8c0 8-6 12-12 12s-12-4-12-12z"/><circle cx="27" cy="32" r="2" fill="#F7F3E8"/><circle cx="37" cy="32" r="2" fill="#F7F3E8"/>',
  bridge: '<path d="M16 38h32M20 38v-8M44 38v-8M16 30c8-8 24-8 32 0M24 38v6M32 38v6M40 38v6"/>',
  rope: '<path d="M16 36c6-14 26-14 32 0"/><circle cx="16" cy="36" r="3" fill="#F7F3E8"/><circle cx="48" cy="36" r="3" fill="#F7F3E8"/>',
  figure: '<circle cx="32" cy="22" r="5"/><path d="M32 27v12M24 32h16M32 39l-6 9M32 39l6 9"/>',
  shovel: '<path d="M38 18l8 8M20 44l16-16M16 48l6-2-4-4z"/>',
  crown: '<path d="M18 42V26l8 8 6-12 6 12 8-8v16z" fill="#C99A45"/>',
  bomb: '<circle cx="30" cy="38" r="10" fill="#1A1A1A"/><path d="M36 30l6-8M42 22l4-2M44 24l3 1"/>',
  arrows: '<path d="M32 16v10M26 22l6-6 6 6M32 48V38M26 42l6 6 6-6M16 32h10M20 26l-6 6 6 6M48 32H38M44 26l6 6-6 6"/>',
  paw: '<circle cx="32" cy="38" r="8"/><circle cx="22" cy="28" r="3.5"/><circle cx="29" cy="22" r="3.5"/><circle cx="37" cy="22" r="3.5"/><circle cx="43" cy="28" r="3.5"/>',
  pot: '<path d="M20 30h24v8a10 10 0 0 1-10 10h-4a10 10 0 0 1-10-10z"/><path d="M16 32h4M44 32h4M26 22c0-4 4-4 4-8M34 22c0-4 4-4 4-8"/>',
  bars: '<rect x="20" y="36" width="6" height="10"/><rect x="29" y="28" width="6" height="18"/><rect x="38" y="20" width="6" height="26"/>',
  laser: '<path d="M16 24h32M16 40h32" stroke-dasharray="4 4"/><circle cx="32" cy="32" r="5" fill="#F7F3E8"/>',
  floor: '<path d="M18 40l7-4 7 4 7-4 7 4-7 4-7-4-7 4z"/><path d="M26 44l4 6M38 44l-3 7"/>',
};
export const glyph = (name, bg = '#5A468F') => wrap(`<circle cx="32" cy="32" r="26" fill="${bg}" stroke="rgba(0,0,0,.35)" stroke-width="1.5"/><g fill="none" stroke="${PAPER}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[name] || GLYPHS.crown}</g>`);
export const GLYPH_NAMES = Object.keys(GLYPHS);

// Wer bin ich?: Personen-Silhouette mit gelber Haftnotiz „?“ auf der Stirn
export const silhouette = () => wrap(`<rect x="2" y="2" width="60" height="60" rx="12" fill="#3E5C7A"/><circle cx="32" cy="26" r="12" fill="#1B2733"/><path d="M10 62c0-14 10-20 22-20s22 6 22 20z" fill="#1B2733"/><g transform="rotate(-8 32 16)"><rect x="23" y="9" width="18" height="14" rx="1.5" fill="#F6D84B" stroke="rgba(0,0,0,.35)" stroke-width="1"/><text x="32" y="20.5" text-anchor="middle" font-size="12" font-weight="800" font-family="sans-serif" fill="#3B2F00">?</text></g>`);
