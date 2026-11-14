// ART-013 · Design „Taktik-Konsole“ (skin `space`): erzeugt die Grafiken unter public/games/schiffe/art/space/.
//   node scripts/build-schiffe-space-art.mjs
//
// Die Formen sind Koordinate für Koordinate aus dem Entwurf übertragen (private Vault-Notiz „Schiffe versenken · Taktik-Konsole“, Mockup „Elemente“):
// fünf Raumschiffklassen in Draufsicht (Länge 5, 4, 3, 3, 2 Felder), Zellzustände, Sternenhimmel. Alles eigene Zeichnungen, keine Vorlagen aus
// einem fremden Spiel. Entwurfs-Maß: 56 Einheiten je Feld, das Schiff beginnt bei x = 60 und liegt auf der Mittellinie der Zeile; hier relativ dazu.
//
// Dateien: ship-<N>-<h|v>.svg (waagerecht: Bug rechts; senkrecht: Bug unten) und ship-<N>-<h|v>-wreck.svg (rotes Wrack) für N = 5, 4, 3, 2,
// stars.svg (Kachel 220 × 220), mark-hit.svg, mark-miss.svg, mark-aim.svg.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const out = process.argv[2] ? resolve(process.argv[2]) : join(import.meta.dirname, '..', 'public', 'games', 'schiffe', 'art', 'space');
mkdirSync(out, { recursive: true });
const CELL = 56, PAD = 0.15; // Rand oben und unten je 15 % einer Zeile, damit die Flügel nicht abgeschnitten werden
const SHIPS = {
  5: { hull: '5.6,0 25.2,-14.6 154,-17.4 260.4,-10.4 275.5,0 260.4,10.4 154,17.4 25.2,14.6', wings: ['84,-17.4 117.6,-33 140,-33 134.4,-17.4', '84,17.4 117.6,33 140,33 134.4,17.4'], ribs: [56, 112, 168, 224], bridge: '173.6,-4.2 218.4,-2.8 218.4,2.8 173.6,4.2' },
  4: { hull: '5.6,0 25.2,-14.6 123.2,-17.4 204.4,-10.4 219.5,0 204.4,10.4 123.2,17.4 25.2,14.6', wings: ['67.2,-17.4 94.1,-33 112,-33 107.5,-17.4', '67.2,17.4 94.1,33 112,33 107.5,17.4'], ribs: [56, 112, 168], bridge: '138.9,-4.2 174.7,-2.8 174.7,2.8 138.9,4.2' },
  3: { hull: '5.6,0 25.2,-14.6 92.4,-17.4 148.4,-10.4 163.5,0 148.4,10.4 92.4,17.4 25.2,14.6', wings: ['50.4,-17.4 70.6,-33 84,-33 80.6,-17.4', '50.4,17.4 70.6,33 84,33 80.6,17.4'], ribs: [56, 112], bridge: '104.2,-4.2 131,-2.8 131,2.8 104.2,4.2' },
  2: { hull: '5.6,0 25.2,-14.6 61.6,-17.4 92.4,-10.4 107.5,0 92.4,10.4 61.6,17.4 25.2,14.6', wings: [], ribs: [56], bridge: '69.4,-4.2 87.4,-2.8 87.4,2.8 69.4,4.2' },
};
const LOOK = {
  ok: { fill: '#2b4157', line: '#39d0ff', glow: '#7fe3ff', bridge: '#9be8ff' },
  wreck: { fill: '#3a1a22', line: '#ff5a5a', glow: '#ff8a8a', bridge: '#7a2a2a' },
};
const f1 = (n) => +n.toFixed(1);
function ship(n, vertical, wreck) {
  const s = SHIPS[n], L = n * CELL, H = f1(CELL * (1 + 2 * PAD)), cy = H / 2, c = wreck ? LOOK.wreck : LOOK.ok;
  const P = (str) => str.split(' ').map((p) => { const [x, y] = p.split(',').map(Number); return `${f1(x)},${f1(cy + y)}`; }).join(' ');
  const body = [
    `<polygon points="${P(s.hull)}" fill="${c.fill}" stroke="${c.line}" stroke-width="1.4" filter="url(#g)"/>`,
    ...s.wings.map((w) => `<polygon points="${P(w)}" fill="${c.fill}" stroke="${c.line}" stroke-width="1"/>`),
    ...s.ribs.map((x) => `<path d="M${x},${f1(cy - 8.7)}L${x},${f1(cy + 8.7)}" stroke="${c.line}" stroke-opacity=".35"/>`),
    `<polygon points="${P(s.bridge)}" fill="${c.bridge}" opacity="${wreck ? '.6' : '.85'}"/>`,
    `<circle cx="6.7" cy="${f1(cy - 6.2)}" r="5" fill="${c.glow}"${wreck ? ' opacity=".55"' : ''} filter="url(#g)"/>`,
    `<circle cx="6.7" cy="${f1(cy + 6.2)}" r="5" fill="${c.glow}"${wreck ? ' opacity=".55"' : ''} filter="url(#g)"/>`,
    ...(wreck ? [`<path d="M${f1(L * 0.3)},${f1(cy - 11)}L${f1(L * 0.34)},${f1(cy + 2)}L${f1(L * 0.31)},${f1(cy + 12)}M${f1(L * 0.62)},${f1(cy - 12)}L${f1(L * 0.58)},${f1(cy - 1)}" stroke="#ff8a8a" stroke-width="1.2" stroke-opacity=".8" fill="none"/>`] : []),
  ].join('');
  const defs = '<defs><filter id="g" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
  return vertical
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${H} ${L}" width="${H}" height="${L}">${defs}<g transform="translate(${H} 0) rotate(90)">${body}</g></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L} ${H}" width="${L}" height="${H}">${defs}${body}</svg>`;
}
for (const n of [5, 4, 3, 2]) for (const v of [false, true]) for (const w of [false, true]) writeFileSync(join(out, `ship-${n}-${v ? 'v' : 'h'}${w ? '-wreck' : ''}.svg`), ship(n, v, w));

// Sternenhimmel: Kachel aus dem Entwurf (x, y, Radius, Deckkraft), ohne Hintergrundfläche
const STARS = [[0, 13, 1.1, 0.2], [83, 60, 0.6, 0.35], [166, 107, 0.6, 0.5], [29, 154, 0.6, 0.65], [112, 201, 0.6, 0.2], [195, 28, 1.1, 0.35], [58, 75, 0.6, 0.5], [141, 122, 0.6, 0.65], [4, 169, 0.6, 0.2], [87, 216, 0.6, 0.35], [170, 43, 1.1, 0.5], [33, 90, 0.6, 0.65], [116, 137, 0.6, 0.2], [199, 184, 0.6, 0.35], [62, 11, 0.6, 0.5], [145, 58, 1.1, 0.65], [8, 105, 0.6, 0.2], [91, 152, 0.6, 0.35], [174, 199, 0.6, 0.5], [37, 26, 0.6, 0.65], [120, 73, 1.1, 0.2], [203, 120, 0.6, 0.35], [66, 167, 0.6, 0.5], [149, 214, 0.6, 0.65], [12, 41, 0.6, 0.2], [95, 88, 1.1, 0.35]];
writeFileSync(join(out, 'stars.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220">${STARS.map(([x, y, r, o]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#cfe8ff" opacity="${o}"/>`).join('')}</svg>\n`);

// Zellzustände (Entwurf „Elemente“): Treffer = Stern in Bernstein mit Glut, Fehlschuss = Ring mit Punkt in Cyan, Ziel erfasst = Klammern und Ring in Bernstein
writeFileSync(join(out, 'mark-hit.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-35 -35 70 70"><defs><filter id="b" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="6"/></filter></defs><circle r="22.4" fill="#ffb347" opacity=".35" filter="url(#b)"/><path d="M0 -21l4.9 14l15.4 2.1l-12.6 8.4l5.6 14l-13.3 -8.4l-13.3 8.4l5.6 -14l-12.6 -8.4l15.4 -2.1z" fill="#ffb347" stroke="#fff3d6" stroke-width=".8"/></svg>\n');
writeFileSync(join(out, 'mark-miss.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="14.7" fill="none" stroke="#39d0ff" stroke-opacity=".7" stroke-width="1.5"/><circle cx="20" cy="20" r="4.2" fill="#39d0ff" opacity=".7"/></svg>\n');
writeFileSync(join(out, 'mark-aim.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none" stroke="#ffb347" stroke-linecap="round"><path d="M5 14V5h9M26 5h9v9M35 26v9h-9M14 35H5v-9" stroke-width="2.4"/><circle cx="20" cy="20" r="13.5" stroke-width="1.2" stroke-dasharray="2 3"/><path d="M20 0v4M20 36v4M0 20h4M36 20h4" stroke-width="1.8"/></svg>\n');
console.log('geschrieben:', out);
