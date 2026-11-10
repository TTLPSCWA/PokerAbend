// EXP-079 Schubsarena: Sumo-Ring auf einer schrumpfenden Eisscholle. Avatare tragen einen Sumo-Gürtel, vom Rand bricht Eis ab,
// wer rausfällt, landet mit einem Platsch im Wasser. Highlight: zwei Rauswürfe mit einem Stoß – „Doppelschubser!“.
// Alles stammt aus den Frames, die der Server allen schickt (Positionen, Stöße, Scholle) – es gibt hier keine Geheimnisse.
const t = (de, en) => (globalThis.I18n?.language === 'en' ? en : de);
const WINDOW = 1500; // so lange zählt ein Rauswurf noch zum letzten Stoß (Spielzeit in ms)
let splashes = [], chunks = [], lastPush = null, last = null, slideAt = -1e9, crackAt = -1e9, burst = 0;

/** Wer hat in diesem Frame neu gestoßen, wer ist neu ins Wasser gefallen? */
export function happenings(next, prev) {
  const shoves = [], out = [];
  for (const b of next?.bodies || []) {
    const old = prev?.bodies?.find((p) => p.id === b.id); if (!old) continue;
    if (b.pushAt > old.pushAt) shoves.push(b.id);
    if (old.alive && !b.alive) out.push({ id: b.id, x: old.x, y: old.y });
  }
  return { shoves, out };
}
/** Trifft ein Stoß jemanden (gleiche Regel wie die Anzeige: nah und vor der Blickrichtung)? Nur zur Zuordnung des Doppelschubsers. */
export function inFront(pusher, other) {
  const dx = other.x - pusher.x, dy = other.y - pusher.y, d = Math.hypot(dx, dy);
  return d <= 84 && dx * pusher.facing.x + dy * pusher.facing.y >= d * 0.25;
}
/** Zählt Rauswürfe, die zu einem Stoß gehören. Liefert die Zahl der Rauswürfe dieses Stoßes. */
export function credit(push, fall, elapsed) { return push && push.victims.includes(fall.id) && elapsed - push.at <= WINDOW ? (push.count = (push.count || 0) + 1) : 0; }

const sprites = new Map();
function sprite(key, width, height, draw) { let c = sprites.get(key); if (!c) { c = document.createElement('canvas'); c.width = width; c.height = height; draw(c.getContext('2d')); sprites.set(key, c); } return c; }
// Wasser mit ruhigen Wellenlinien (einmal gemalt).
const water = (a) => sprite(`water:${a.width}x${a.height}`, a.width, a.height, (c) => {
  c.fillStyle = '#12384f'; c.fillRect(0, 0, a.width, a.height);
  c.strokeStyle = '#7fc4e02b'; c.lineWidth = 3; c.lineCap = 'round';
  for (let y = 26; y < a.height; y += 46) for (let x = (y / 46) % 2 ? 20 : 70; x < a.width; x += 120) { c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 18, y - 9, x + 36, y); c.quadraticCurveTo(x + 54, y + 9, x + 72, y); c.stroke(); }
});
// Eisscholle in voller Größe (einmal gemalt, pro Bild auf den aktuellen Radius skaliert).
const floe = () => sprite('floe', 560, 560, (c) => {
  c.translate(280, 280);
  c.fillStyle = '#0a2433'; c.beginPath(); c.arc(4, 10, 270, 0, Math.PI * 2); c.fill(); // Schatten im Wasser
  c.fillStyle = '#dff1f7'; c.strokeStyle = '#8fc6da'; c.lineWidth = 6; c.beginPath();
  for (let i = 0; i <= 36; i++) { const ang = i / 36 * Math.PI * 2, r = 264 + (i % 2 ? 6 : -3) + (i % 5 === 0 ? 5 : 0); c[i ? 'lineTo' : 'moveTo'](Math.cos(ang) * r, Math.sin(ang) * r); }
  c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = '#b9dcea'; c.lineWidth = 3; // Sumo-Ring (Dohyo-Kreis) und feine Risse
  c.beginPath(); c.arc(0, 0, 200, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = '#9fcfe1aa'; c.lineWidth = 2;
  for (const [x1, y1, x2, y2, x3, y3] of [[-180, -60, -120, -30, -90, -70], [60, 150, 110, 120, 150, 160], [90, -170, 60, -120, 110, -90], [-70, 190, -30, 150, -80, 120]]) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineTo(x3, y3); c.stroke(); }
  c.fillStyle = '#c0392b'; c.fillRect(-38, -46, 12, 92); c.fillRect(26, -46, 12, 92); // Startlinien
});

export default {
  palette: 'schubsarena',
  winner: { colors: ['#dff1f7', '#8fc6da', '#c0392b'], shape: 'paper', palette: 'schubsarena', winEvent: 'win' },
  key: (view) => [view.phase, view.roundNo, view.g?.runId, !!view.gamePaused].join(':'),
  still(view) { if (view.phase === 'lobby') { splashes = []; chunks = []; lastPush = null; burst = 0; } },
  backdrop(ctx, frame) {
    const a = frame.arena, p = frame.platform; if (!p) return false;
    ctx.drawImage(water(a), 0, 0);
    const size = p.radius / 264 * 560;
    ctx.drawImage(floe(), p.x - size / 2, p.y - size / 2, size, size);
    // Stoß-Anzeige wie bisher (wer stößt, in welche Richtung).
    for (const b of frame.bodies) if (b.alive && frame.elapsed - b.pushAt < 250) { ctx.strokeStyle = '#fff3cf'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + b.facing.x * 80, b.y + b.facing.y * 80); ctx.stroke(); }
    return true;
  },
  // Der letzte Rauswurf beendet die Runde: Der Server schickt dann kein Frame mehr, sondern den Endstand. Der Platsch gehört trotzdem dazu.
  finale: (view, prev) => (view.phase === 'over' && prev.phase === 'playing' ? 900 : 0),
  change(view, prev, x) { if (view.phase === 'over' && prev.phase === 'playing' && last && view.g?.runId === last.runId && view.g.bodies) this.frame(view.g, last, x, null); },
  frame(next, prev, x, cue) {
    last = next;
    if (cue === 'countdown') x.play('count');
    const now = performance.now(), { shoves, out } = happenings(next, prev);
    for (const id of shoves) {
      const pusher = next.bodies.find((b) => b.id === id);
      lastPush = { id, at: next.elapsed, count: 0, victims: next.bodies.filter((b) => b.id !== id && b.alive && inFront(pusher, b)).map((b) => b.id) };
      x.play('shove');
      if (lastPush.victims.length && next.elapsed - slideAt > 500) { slideAt = next.elapsed; x.play('slide', { after: 90 }); }
    }
    // Eis bricht vom Rand: je 12 Punkte Radiusverlust ein Knacken und ein paar Schollenstücke.
    if (next.platform && prev.platform && Math.floor(next.platform.radius / 12) < Math.floor(prev.platform.radius / 12)) {
      if (next.elapsed - crackAt > 1800) { crackAt = next.elapsed; x.play('crack'); }
      if (x.animated) for (let i = 0; i < 3; i++) { const ang = Math.random() * Math.PI * 2; chunks.push({ x: next.platform.x + Math.cos(ang) * prev.platform.radius, y: next.platform.y + Math.sin(ang) * prev.platform.radius, dx: Math.cos(ang), dy: Math.sin(ang), at: now, size: 7 + Math.random() * 8 }); }
      if (chunks.length > 24) chunks = chunks.slice(-24);
    }
    for (const fall of out) {
      x.play('splash'); splashes.push({ ...fall, at: now }); if (splashes.length > 8) splashes.shift();
      // Highlight: zwei Rauswürfe mit einem Stoß.
      if (credit(lastPush, fall, next.elapsed) === 2) {
        const name = x.view.players.find((p) => p.id === lastPush.id)?.name || '';
        burst = now; x.play('highlight', { after: 160 }); x.highlight('doppelschubser', 2400);
        x.plaque(`${t('Doppelschubser!', 'Double shove!')} ${name}`.trim(), { ms: 2400, material: null, cls: 'xp-sa-double' });
      }
    }
  },
  paint(ctx, { bodies, now }, { animated }) {
    // Sumo-Gürtel: breites Band mit Knoten über jeder Figur.
    for (const b of bodies) {
      if (!b.alive) continue;
      ctx.save(); ctx.strokeStyle = '#f6efe0'; ctx.lineWidth = 6; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.arc(b.x, b.y, 19, Math.PI * 0.12, Math.PI * 0.88); ctx.stroke();
      ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(b.x, b.y + 19, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // Abgebrochene Eisstücke treiben nach außen und versinken.
    chunks = chunks.filter((c) => now - c.at < 1100);
    for (const c of chunks) { const k = (now - c.at) / 1100; ctx.save(); ctx.globalAlpha = 1 - k; ctx.fillStyle = '#dff1f7'; ctx.translate(c.x + c.dx * k * 46, c.y + c.dy * k * 46); ctx.rotate(k * 2); ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size * 0.7); ctx.restore(); }
    // Platsch: Ringe und Tropfen an der Stelle, an der jemand ins Wasser fiel.
    splashes = splashes.filter((s) => now - s.at < 900);
    for (const s of splashes) {
      const k = animated ? (now - s.at) / 900 : 0.5;
      ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#cdeaf5'; ctx.lineWidth = 4;
      for (const scale of [1, 0.6]) { ctx.beginPath(); ctx.ellipse(s.x, s.y, 16 + k * 46 * scale, 8 + k * 22 * scale, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = '#cdeaf5'; for (let i = 0; i < 6; i++) { const ang = i / 6 * Math.PI * 2; ctx.beginPath(); ctx.arc(s.x + Math.cos(ang) * k * 40, s.y - Math.sin(k * Math.PI) * 34 + Math.sin(ang) * k * 12, 3.2, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    // Doppelschubser: kurzer Sternenkranz in der Mitte.
    if (burst && now - burst < 900 && animated) { const k = (now - burst) / 900; ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#ffd98a'; ctx.lineWidth = 5; ctx.lineCap = 'round'; for (let i = 0; i < 12; i++) { const ang = i / 12 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(450 + Math.cos(ang) * (40 + k * 90), 300 + Math.sin(ang) * (40 + k * 90)); ctx.lineTo(450 + Math.cos(ang) * (70 + k * 130), 300 + Math.sin(ang) * (70 + k * 130)); ctx.stroke(); } ctx.restore(); } else if (burst && now - burst >= 900) burst = 0;
  },
  // Für Messungen: Platsch, Eisstücke und Sternenkranz noch einmal starten (nur Darstellung).
  replay() { const now = performance.now(); burst = now; splashes = [{ x: 300, y: 300, at: now }, { x: 600, y: 300, at: now }]; chunks = Array.from({ length: 12 }, (_, i) => ({ x: 450 + Math.cos(i) * 200, y: 300 + Math.sin(i) * 200, dx: Math.cos(i), dy: Math.sin(i), at: now, size: 10 })); },
};
