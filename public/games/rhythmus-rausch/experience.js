// EXP-072 Rhythmus-Rausch: Konzertbühne mit Lautsprecherwand. Ein eigener Beat läuft im Takt des Lieds (drei Tempi),
// Treffer spielen Töne der Melodie, perfekte Treffer lassen die Spur aufleuchten, der Serien-Zähler wächst.
// Highlight: 50er-Serie – sanfte Lichtshow (kein Stroboskop) und Publikumsjubel.
// Jeder hört und sieht nur die eigenen Treffer; alles stammt aus den Frames des Servers.
const t = (de, en) => (globalThis.I18n?.language === 'en' ? en : de);
const LINE = 500, SHOW = 4200;
/** Grundschlag des Lieds aus den Notenabständen: 560 ms (ruhig) oder 420 ms (schnell). */
export function beatOf(notes) {
  let slow = 0, fast = 0;
  const ts = [...new Set((notes || []).map((n) => n.t))].sort((a, b) => a - b);
  for (let i = 1; i < ts.length; i++) { const d = ts[i] - ts[i - 1]; if (d % 280 <= 2 && d % 210 > 2) slow++; else if (d % 210 <= 2 && d % 280 > 2) fast++; }
  return fast > slow ? 420 : 560;
}
/** Drei Tempi: ruhig, schnell – und „Rausch“, sobald die eigene Serie 20 erreicht (dann doppelte Hi-Hats). */
export const tempo = (beat, combo) => (combo >= 20 ? 'rausch' : beat === 420 ? 'schnell' : 'ruhig');
/** Welche Schläge liegen zwischen zwei Zeitpunkten? Schlag k liegt bei k · beat/2 (Achtel). */
export function beats(from, to, beat) {
  const half = beat / 2, out = [];
  for (let k = Math.max(0, Math.floor(from / half) + 1); k * half <= to && out.length < 8; k++) out.push(k);
  return out;
}
/** Neue eigene Wertung im Frame (Treffer oder Fehltipp)? */
export const judged = (next, prev) => (next?.last && next.last.at !== prev?.last?.at ? next.last : null);
const geometry = (lanes) => { const lw = lanes === 1 ? 240 : 124; return { lw, x0: 450 - lanes * lw / 2 - 40 }; };

let beat = 560, glow = [0, 0, 0, 0], pop = 0, show = 0, cheered = '', combo = 0;
const sprites = new Map();
function sprite(key, width, height, draw) { let c = sprites.get(key); if (!c) { c = document.createElement('canvas'); c.width = width; c.height = height; draw(c.getContext('2d')); sprites.set(key, c); } return c; }
// Lautsprecher: Gehäuse, zwei Membranen.
function speaker(c, x, y, w, h) {
  c.fillStyle = '#17121f'; c.strokeStyle = '#3b3352'; c.lineWidth = 3; c.beginPath(); c.roundRect(x, y, w, h, 6); c.fill(); c.stroke();
  for (const [cy, r] of [[y + h * 0.32, w * 0.34], [y + h * 0.74, w * 0.22]]) { const g = c.createRadialGradient(x + w / 2, cy, 2, x + w / 2, cy, r); g.addColorStop(0, '#4a4366'); g.addColorStop(0.55, '#221c30'); g.addColorStop(1, '#0d0a14'); c.fillStyle = g; c.beginPath(); c.arc(x + w / 2, cy, r, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#5b5280'; c.lineWidth = 2; c.stroke(); }
}

export default {
  palette: 'rhythmus-rausch',
  winner: { colors: ['#f1d78a', '#7ad7c1', '#ef8196', '#9ab4ff'], shape: 'paper', palette: 'rhythmus-rausch', winEvent: 'win' },
  key: (view) => [view.phase, view.roundNo, view.g?.runId, !!view.gamePaused].join(':'),
  still(view) { if (view.phase === 'lobby') { glow = [0, 0, 0, 0]; pop = 0; show = 0; cheered = ''; combo = 0; } },
  // Konzertbühne: Lautsprecherwände links und rechts, Bühnenboden, Traversen mit Scheinwerfern.
  backdrop(c, frame) {
    const a = frame.arena, g = c.createLinearGradient(0, 0, 0, a.height); g.addColorStop(0, '#0d0a1c'); g.addColorStop(1, '#241a44'); c.fillStyle = g; c.fillRect(0, 0, a.width, a.height);
    c.fillStyle = '#1a1430'; c.fillRect(0, a.height - 54, a.width, 54); c.strokeStyle = '#3b3352'; c.lineWidth = 2;
    for (let x = 0; x < a.width; x += 60) { c.beginPath(); c.moveTo(x, a.height - 54); c.lineTo(x - 30, a.height); c.stroke(); }
    c.strokeStyle = '#4a4366'; c.lineWidth = 6; c.beginPath(); c.moveTo(0, 14); c.lineTo(a.width, 14); c.stroke(); c.lineWidth = 2;
    for (let x = 10; x < a.width; x += 24) { c.beginPath(); c.moveTo(x, 8); c.lineTo(x + 12, 20); c.stroke(); }
    for (const x of [150, 330, 570, 750]) { c.fillStyle = '#2c2440'; c.fillRect(x - 10, 14, 20, 18); c.fillStyle = '#5b5280'; c.beginPath(); c.arc(x, 36, 9, 0, Math.PI * 2); c.fill(); }
    // Lautsprecherwand: links 2 × 4, rechts Rangliste frei lassen (dort stehen nur zwei Boxen unten).
    for (let r = 0; r < 4; r++) for (let k = 0; k < 2; k++) speaker(c, 8 + k * 64, 60 + r * 118, 58, 110);
    for (let k = 0; k < 2; k++) speaker(c, a.width - 132 + k * 64, 384, 58, 110);
    return true;
  },
  frame(next, prev, x, cue) {
    if (cue === 'countdown') x.play('select');
    if (next.kind !== 'rhythm') return;
    if (next.notes?.length > 2) beat = beatOf(next.notes);
    const me = next.bodies.find((b) => b.id === x.view?.you?.id);
    combo = me?.combo || 0;
    // Der Beat: Kick auf 1 und 3, Snare auf 2 und 4, Hi-Hat auf den Achteln (im Rausch auch dazwischen).
    if (prev && next.elapsed > 0 && next.elapsed > prev.elapsed && !x.view.gamePaused) {
      const style = tempo(beat, combo);
      for (const k of beats(Math.max(0, prev.elapsed), next.elapsed, beat)) {
        const wait = Math.max(0, k * beat / 2 - next.elapsed + 60);
        x.play(k % 4 === 0 ? 'kick' : k % 4 === 2 ? 'snare' : 'hat', { after: wait });
        if (style === 'rausch' && k % 2) x.play('hat', { after: wait + beat / 4 });
      }
    }
    const hit = judged(next, prev);
    if (hit) {
      if (hit.grade === 'perfect' || hit.grade === 'good' || hit.grade === 'ok') {
        x.play('lane' + Math.min(3, hit.lane));
        if (hit.grade === 'perfect') { x.play('perfect', { after: 40 }); glow[hit.lane] = performance.now(); }
        pop = performance.now();
      } else if (hit.grade === 'stray') x.play('stray');
    }
    // Highlight: 50er-Serie (einmal je Serie).
    const key = `${next.runId}:${Math.floor(combo / 50)}`;
    if (combo >= 50 && cheered !== key) {
      cheered = key; show = performance.now();
      x.play('cheer'); x.play('cheer', { after: 700 }); x.play('highlight', { after: 200 });
      x.highlight('lichtshow', SHOW);
      x.plaque(t(`${combo}er-Serie!`, `${combo} combo!`), { ms: 2400, material: null, cls: 'xp-rr-combo' });
    }
  },
  paint(c, { frame, now }, { animated }) {
    if (frame.kind !== 'rhythm') return;
    const lanes = frame.lanes, { lw, x0 } = geometry(lanes);
    // Perfekte Treffer: Die Spur leuchtet von der Trefferlinie nach oben auf.
    for (let i = 0; i < lanes; i++) {
      const k = (now - glow[i]) / 420; if (k < 0 || k >= 1) continue;
      const lit = sprite(`lane:${lw}`, lw, 600, (s) => { const g = s.createLinearGradient(0, LINE, 0, 0); g.addColorStop(0, '#fff3c8cc'); g.addColorStop(1, '#fff3c800'); s.fillStyle = g; s.fillRect(6, 0, lw - 12, LINE); });
      c.save(); c.globalAlpha = animated ? 1 - k : 0.5; c.drawImage(lit, x0 + i * lw, 0); c.restore();
    }
    // Serien-Zähler wächst mit der Serie und hüpft bei jedem Treffer.
    if (combo > 1) {
      const size = Math.min(1.6, 1 + combo / 60), bump = animated ? 1 + Math.max(0, 1 - (now - pop) / 180) * 0.25 : 1;
      c.save(); c.translate(450 - 40, LINE + 58); c.scale(size * bump, size * bump); c.textAlign = 'center'; c.font = 'bold 30px system-ui'; c.lineWidth = 6; c.strokeStyle = '#120c2b'; const label = `×${combo}`; c.strokeText(label, 0, 0); c.fillStyle = combo >= 50 ? '#ffe27a' : '#fff'; c.fillText(label, 0, 0); c.restore();
    }
    // Lichtshow: vier weiche Lichtkegel schwenken langsam (kein Flackern), dann verblassen sie.
    const k = (now - show) / SHOW;
    if (show && k >= 0 && k < 1) {
      const fade = Math.min(1, k * 5, (1 - k) * 4), colours = ['#f1d78a', '#7ad7c1', '#ef8196', '#9ab4ff'];
      [150, 330, 570, 750].forEach((x, i) => {
        const swing = animated ? Math.sin(now / 900 + i * 1.7) * 0.35 : 0;
        const cone = sprite('cone' + i, 260, 600, (s) => { const g = s.createLinearGradient(0, 0, 0, 600); g.addColorStop(0, colours[i] + '66'); g.addColorStop(1, colours[i] + '00'); s.fillStyle = g; s.beginPath(); s.moveTo(118, 0); s.lineTo(142, 0); s.lineTo(260, 600); s.lineTo(0, 600); s.closePath(); s.fill(); });
        c.save(); c.globalAlpha = fade * 0.8; c.translate(x, 36); c.rotate(swing); c.drawImage(cone, -130, 0); c.restore();
      });
    } else if (show && k >= 1) show = 0;
  },
  // Für Messungen: Lichtshow, Spuren und Zähler noch einmal starten (nur Darstellung).
  replay() { const now = performance.now(); show = now; glow = [now, now, now, now]; pop = now; combo = Math.max(combo, 50); },
};
