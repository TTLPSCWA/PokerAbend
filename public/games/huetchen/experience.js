// EXP-007 Mensch ärgere Dich nicht: Gartentisch im Sommer. Figuren hüpfen Feld für Feld, geschlagene fliegen im Bogen
// zurück ins Haus, der Würfel kippt in seine Augenzahl, drei Sechsen in Folge feiern am eigenen Haus.
const STEP = 150;
const t = (de, en) => (globalThis.I18n?.language === 'en' ? en : de);
// Zählt Sechsen in Folge je Spieler aus den bestätigten Würfel-Aktionen (reine Darstellung, kein Spielzustand).
export function streak(state, rolls) {
  let { id = null, count = 0 } = state || {}, triple = null;
  for (const roll of rolls) {
    if (roll.value === 6) { count = roll.id === id ? count + 1 : 1; id = roll.id; if (count === 3) { triple = roll.id; count = 0; } }
    else { id = null; count = 0; }
  }
  return { id, count, triple };
}
// Welche Figuren sind gezogen, welche wurden geschlagen?
export function diff(before, after) {
  const walked = [], hit = [];
  for (const [id, list] of Object.entries(after || {})) list.forEach((p, i) => {
    const q = before?.[id]?.[i];
    if (q === undefined || q === p) return;
    if (p === -1) hit.push({ id, i, from: q }); else if (p > q) walked.push({ id, i, from: q, to: p });
  });
  return { walked, hit };
}
let sixes = null;

export default {
  palette: 'huetchen',
  winner: { colors: ['#dc443c', '#3879df', '#3da866', '#e0b728'], shape: 'leaf', palette: 'huetchen', winEvent: 'win' },
  select: '.hb-piece.can',
  key: (view) => [view.phase, view.roundNo, view.turnId, view.g?.rolled, JSON.stringify(view.g?.pieces), Math.max(0, ...Object.values(view.acts || {}).map((a) => a.n)), !!view.gamePaused].join(':'),
  change(view, prev, x) {
    const g = view.g, pg = prev.g; if (!g?.pieces || !pg?.pieces) return;
    if (view.roundNo !== prev.roundNo) { sixes = null; x.play('piece'); return; }
    const group = [];
    // Würfeln: bestätigte Augenzahl aus der Aktion des Spielers.
    const rolls = x.acts.map((a) => ({ id: a.id, value: Number(a.text.match(/^würfelt (\d)$/)?.[1]) })).filter((r) => r.value);
    if (rolls.length) {
      x.play('dice');
      const die = x.$('.hb-dice .die, .hb-hex-die .die');
      if (die) group.push(x.plans.tumble(die));
      if (rolls.at(-1).value === 6) x.play('six', { after: 380 });
      sixes = streak(sixes, rolls);
    }
    const { walked, hit } = diff(pg.pieces, g.pieces), where = globalThis.HuetchenBoard?.where, board = x.$('.hb-board');
    const piece = (m) => x.$(`[data-pc="${m.id}:${m.i}"]`);
    let landing = 0;
    if (board && where && g.track !== 60) {
      // Klassisches Brett: Mittelpunkte der Felder aus dem Raster des Bretts.
      const b = board.getBoundingClientRect(), cs = getComputedStyle(board), pad = parseFloat(cs.paddingLeft) || 0, gap = parseFloat(cs.columnGap) || 0, w = (b.width - 2 * pad - 10 * gap) / 11;
      const point = ([cx, cy]) => ({ x: b.left + pad + cx * (w + gap) + w / 2, y: b.top + pad + cy * (w + gap) + w / 2 });
      for (const m of walked) {
        const el = piece(m), c = g.color[m.id]; if (!el) continue;
        const path = []; for (let s = m.from; s <= m.to; s++) path.push(point(where(c, s, m.i)));
        group.push(x.plans.hop(el, path, { step: STEP }));
        const steps = path.length - 1; landing = Math.max(landing, steps * STEP);
        if (x.animated) for (let k = 1; k <= Math.min(steps, 6); k++) x.play('piece', { after: k * STEP - 20 }); else x.play('piece');
      }
      for (const m of hit) {
        const el = piece(m), c = g.color[m.id]; if (!el) continue;
        // Geschlagen: im hohen Bogen zurück ins Haus, sobald die schlagende Figur gelandet ist.
        group.push(x.plans.glide(el, point(where(c, m.from, m.i)), { duration: 460, delay: landing, lift: 70 }));
      }
    } else if (walked.length) x.play('piece'); // Sechser-Brett: Figuren setzen hörbar auf, ohne Hüpfweg
    if (hit.length) { x.play('plop', { after: landing }); x.play('grumble', { after: landing + 240 }); }
    if (x.acts.some((a) => a.text === 'ins Ziel')) x.play('home', { after: landing + 60 });
    if (group.length) x.run(group);
    // Highlight: drei Sechsen in Folge – Konfetti am eigenen Haus und die „Glückspilz“-Plakette.
    if (sixes?.triple) {
      const id = sixes.triple, c = g.color[id]; sixes = { id: null, count: 0, triple: null };
      const house = x.$$(`.hb-cell.house.hc-bg-${c}`), anchor = house[0] && house.at(-1) ? { x: (house[0].getBoundingClientRect().left + house.at(-1).getBoundingClientRect().right) / 2, y: (house[0].getBoundingClientRect().top + house.at(-1).getBoundingClientRect().bottom) / 2 } : x.$('.hb-hex-die') || x.root;
      x.play('highlight', { after: 420 });
      x.later(() => { x.confetti(anchor, { colors: ['#e0b728', '#f7ead5', '#3da866', '#dc443c'] }); x.plaque(t('Glückspilz', 'Lucky streak'), { anchor, ms: 2400 }); }, 420);
      x.highlight('glueckspilz', 2800, x.$('.hb-board') || x.root);
    }
  },
};
