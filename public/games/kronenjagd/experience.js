// EXP-042 Kronenjagd: Burghof mit Teppich und Thron. Die Krone ist ein goldenes Objekt, das im Bogen von Kopf zu Kopf springt;
// daneben läuft der Krönchen-Zähler hoch. Highlight: 30 Sekunden durchgehend gekrönt – die Thronsaal-Banner wehen.
// Alles wird aus den Frames gezeichnet, die der Server allen schickt (Positionen, Träger, Punkte) – es gibt hier keine Geheimnisse.
const t = (de, en) => (globalThis.I18n?.language === 'en' ? en : de);
const ARC = 420, REIGN = 30000, BANNERS = 3200;
let arc = null, streak = null, banners = 0, pop = { points: -1, at: 0 }, hailed = null;

/** Wer hat die Krone übernommen, und was heißt das für diese Ansicht? */
export function transfer(next, prev, me) {
  const now = next?.crown?.holder || null, before = prev?.crown?.holder || null;
  if (!now || now === before) return null;
  return { to: now, from: before, kind: now === me ? 'crown' : before === me ? 'lost' : 'steal' };
}
/** Durchgehende Herrschaft in Millisekunden. `since` ist der Zeitpunkt der Übernahme (Spielzeit). */
export const reign = (frame, since) => (frame?.crown?.holder && since ? Math.max(0, frame.elapsed - since.at) : 0);

// Eigene Krone: fünf Zacken, Reif und Steine.
function crown(ctx, x, y, size = 1, tilt = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(size, size);
  ctx.fillStyle = '#f2c94c'; ctx.strokeStyle = '#7a5410'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-22, 10); ctx.lineTo(-26, -12); ctx.lineTo(-13, -1); ctx.lineTo(0, -20); ctx.lineTo(13, -1); ctx.lineTo(26, -12); ctx.lineTo(22, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#d9a520'; ctx.fillRect(-22, 5, 44, 7); ctx.strokeRect(-22, 5, 44, 7);
  for (const [dx, colour] of [[-13, '#c0392b'], [0, '#2f6fd0'], [13, '#2f9a55']]) { ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(dx, 8.5, 2.6, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#fff7d6'; for (const [dx, dy] of [[-26, -12], [0, -20], [26, -12]]) { ctx.beginPath(); ctx.arc(dx, dy, 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
function banner(ctx, x, wave) {
  ctx.save(); ctx.translate(x, 0);
  ctx.fillStyle = '#7a1f2b'; ctx.strokeStyle = '#f2c94c'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(34, 0); ctx.lineTo(34 + wave, 120); ctx.lineTo(wave, 96); ctx.lineTo(-34 + wave, 120); ctx.closePath(); ctx.fill(); ctx.stroke();
  crown(ctx, wave * 0.5, 48, 0.8);
  ctx.restore();
}

function courtyard(ctx, a) {
  const cx = a.width / 2, cy = a.height / 2;
    ctx.fillStyle = '#2b2540'; ctx.fillRect(0, 0, a.width, a.height);
  ctx.strokeStyle = '#ffffff12'; ctx.lineWidth = 1;
  for (let y = 0, row = 0; y <= a.height; y += 50, row++) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(a.width, y); ctx.stroke(); for (let x = row % 2 ? 50 : 0; x <= a.width; x += 100) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 50); ctx.stroke(); } }
  ctx.fillStyle = '#7a1f2b'; ctx.fillRect(cx - 46, 0, 92, a.height); ctx.fillRect(0, cy - 46, a.width, 92);
  ctx.strokeStyle = '#d9a52099'; ctx.lineWidth = 3;
  for (const d of [-40, 40]) { ctx.beginPath(); ctx.moveTo(cx + d, 0); ctx.lineTo(cx + d, a.height); ctx.moveTo(0, cy + d); ctx.lineTo(a.width, cy + d); ctx.stroke(); }
  // Thron
  ctx.fillStyle = '#3a2a52'; ctx.strokeStyle = '#d9a520'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(cx - 30, cy - 52, 60, 70, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#9b2b3a'; ctx.beginPath(); ctx.roundRect(cx - 22, cy - 4, 44, 24, 5); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#ffffff38'; ctx.lineWidth = 4; ctx.strokeRect(4, 4, a.width - 8, a.height - 8);
}
// Vorgezeichnete Bilder: Kulisse, Krone, Banner und Zählerstand werden einmal gemalt und danach nur noch kopiert.
// Das hält den Canvas pro Bild billiger als die bisherige Gitterkulisse.
const sprites = new Map();
function sprite(key, width, height, draw) {
  let c = sprites.get(key);
  if (!c) { c = document.createElement('canvas'); c.width = width; c.height = height; draw(c.getContext('2d')); if (sprites.size > 40) sprites.clear(); sprites.set(key, c); }
  return c;
}
const crownSprite = () => sprite('crown', 64, 48, (c) => crown(c, 32, 28, 1));
const bannerSprite = () => sprite('banner', 90, 130, (c) => banner(c, 45, 0));
const countSprite = (n) => sprite('n' + n, 84, 34, (c) => { c.textAlign = 'left'; c.font = 'bold 24px system-ui'; c.lineWidth = 6; c.strokeStyle = '#1d1630'; c.strokeText(String(n), 4, 25); c.fillStyle = '#ffe9a8'; c.fillText(String(n), 4, 25); });

export default {
  palette: 'kronenjagd',
  winner: { colors: ['#f2c94c', '#7a1f2b', '#5a468f'], shape: 'paper', palette: 'kronenjagd', winEvent: 'win' },
  paints: { crown: true },
  key: (view) => [view.phase, view.roundNo, view.g?.runId, !!view.gamePaused].join(':'),
  still(view) { if (view.phase !== 'playing') { arc = null; streak = null; banners = 0; hailed = null; } },
  // Burghof: Steinboden, roter Teppich im Kreuz, Thron in der Mitte.
  backdrop(ctx, frame) {
    const size = frame.arena;
    ctx.drawImage(sprite(`yard:${size.width}x${size.height}`, size.width, size.height, (c) => courtyard(c, size)), 0, 0);
    return true;
  },
  frame(next, prev, x, cue) {
    if (cue === 'countdown') x.play('count');
    const me = x.view?.you?.id, move = transfer(next, prev, me);
    if (move) {
      x.play(move.kind);
      const from = prev.bodies.find((b) => b.id === move.from) || prev.crown || next.crown;
      arc = { x: from.x, y: from.y - (move.from ? 78 : 0), to: move.to, at: performance.now() };
      streak = { id: move.to, at: next.elapsed }; hailed = null;
    } else if (!next.crown?.holder) streak = null;
    else if (!streak || streak.id !== next.crown.holder) streak = { id: next.crown.holder, at: next.elapsed };
    // Highlight: 30 Sekunden durchgehend gekrönt.
    if (streak && hailed !== streak.id + ':' + streak.at && reign(next, streak) >= REIGN) {
      hailed = streak.id + ':' + streak.at; banners = performance.now();
      const name = x.view.players.find((p) => p.id === streak.id)?.name || '';
      x.play('highlight'); x.highlight('thronsaal', BANNERS);
      x.plaque(`${name} · ${t('30 Sekunden gekrönt!', '30 seconds crowned!')}`, { ms: BANNERS, material: null, cls: 'xp-kj-reign' });
    }
  },
  paint(ctx, { frame, bodies, now }, { animated }) {
    const a = frame.arena;
    // Banner wehen von der oberen Mauer (mit „Animationen reduzieren“ hängen sie still).
    if (banners && now - banners < BANNERS) { const fade = Math.min(1, (BANNERS - (now - banners)) / 400, (now - banners) / 250); ctx.save(); ctx.globalAlpha = Math.max(0, fade); [0.14, 0.38, 0.62, 0.86].forEach((f, i) => { const sway = animated ? Math.sin(now / 260 + i * 1.3) * 0.07 : 0; ctx.save(); ctx.translate(a.width * f, 0); ctx.rotate(sway); ctx.drawImage(bannerSprite(), -45, 0); ctx.restore(); }); ctx.restore(); } else banners = 0;
    if (!frame.crown) return;
    const holder = bodies.find((b) => b.id === frame.crown.holder && b.alive);
    if (!holder) { ctx.drawImage(crownSprite(), frame.crown.x - 32, frame.crown.y - 50); return; }
    const head = { x: holder.x, y: holder.y - 78 };
    let x = head.x, y = head.y, tilt = 0;
    // Die Krone springt im Bogen zum Fänger.
    if (arc && arc.to === holder.id && animated) { const k = (now - arc.at) / ARC; if (k < 1) { const e = Math.max(0, k); x = arc.x + (head.x - arc.x) * e; y = arc.y + (head.y - arc.y) * e - Math.sin(e * Math.PI) * 90; tilt = (1 - e) * 2.4; } else arc = null; } else if (arc && arc.to !== holder.id) arc = null;
    if (tilt) { ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.drawImage(crownSprite(), -32, -28); ctx.restore(); } else ctx.drawImage(crownSprite(), x - 32, y - 28);
    // Krönchen-Zähler: Punkte des Trägers, mit kleinem Hüpfer bei jedem neuen Punkt.
    if (holder.points !== pop.points) pop = { points: holder.points, at: now };
    const grow = animated ? 1 + Math.max(0, 1 - (now - pop.at) / 220) * 0.35 : 1;
    const label = countSprite(holder.points); ctx.drawImage(label, head.x + 36, head.y - 18 - (grow - 1) * 30, label.width * grow, label.height * grow);
  },
  // Für Messungen: Sprung und Banner noch einmal starten (nur Darstellung).
  replay() { const now = performance.now(); banners = now; if (arc) arc.at = now; else if (streak) arc = { x: 450, y: 240, to: streak.id, at: now }; },
};
