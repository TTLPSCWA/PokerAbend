// EXP-001 Scotland Yard: Stadt Aure. Figuren fahren ihre Linie entlang, jedes Ticket hat seinen Klang, die Tageszeit
// wechselt alle sechs Züge, Mr. X taucht im Nebel auf, die Festnahme endet mit Handschellen und Stempel.
// Geheimnisse: Es wird nur gezeigt, was diese Ansicht vom Server bekommen hat. Das Fährhorn hört nur Mr. X selbst.
const t = (de, en) => (globalThis.I18n?.language === 'en' ? en : de);
const OFFSET = { taxi: 5, bus: -14, underground: 28, ferry: -42 };
const TIMES = ['tag', 'daemmerung', 'nacht', 'morgen'];
/** Tageszeit aus der Zahl der gespielten Mr.-X-Züge: alle sechs Züge eine Stufe weiter. */
export const daytime = (move) => TIMES[Math.floor(Math.max(0, move || 0) / 6) % TIMES.length];
/** Punkte entlang der gezeichneten Linie (quadratische Kurve wie im Stadtplan), von `from` nach `to`. */
export function curve(from, to, offset = 0, steps = 6) {
  const d = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const c = { x: (from.x + to.x) / 2 - (to.y - from.y) / d * offset, y: (from.y + to.y) / 2 + (to.x - from.x) / d * offset };
  return Array.from({ length: steps + 1 }, (_, k) => { const u = k / steps, v = 1 - u; return { x: v * v * from.x + 2 * v * u * c.x + u * u * to.x, y: v * v * from.y + 2 * v * u * c.y + u * u * to.y }; });
}
/** Welche Detektive sind gefahren und mit welchem Ticket? (aus zwei bestätigten Zuständen) */
export function trips(before, after) {
  return (after || []).map((d) => {
    const old = (before || []).find((p) => p.id === d.id);
    if (!old || old.station === d.station) return null;
    const ticket = Object.keys(d.tickets || {}).find((k) => (old.tickets?.[k] ?? 0) > d.tickets[k]) || 'taxi';
    return { id: d.id, from: old.station, to: d.station, ticket };
  }).filter(Boolean);
}
/** Linie zwischen zwei Haltestellen: bevorzugt die des Tickets; `ferryOnly`, wenn es nur die Fähre gibt. */
export function line(edges, a, b, ticket) {
  const all = (edges || []).filter((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
  const edge = all.find((e) => e.mode === ticket) || all[0] || null;
  return edge ? { ...edge, ferryOnly: all.every((e) => e.mode === 'ferry') } : null;
}
export const arrested = (view) => view?.phase === 'over' && !!view.g && view.g.xPosition != null && !view.result?.winners?.includes(view.g.xId) && view.g.detectives.some((d) => d.station === view.g.xPosition);

const stop = (x, id) => x.$(`.sy-stop[data-to="${id}"]`);
const middle = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
// Figur fährt die Linie von der alten zur bestätigten neuen Haltestelle entlang.
function ride(x, el, fromStop, toStop, edge, delay = 0) {
  if (!el || !fromStop || !toStop) return null;
  const a = middle(fromStop), b = middle(toStop), scale = (x.$('.sy-map')?.offsetWidth || 1200) / 1200;
  // Die Kurve ist in Kantenrichtung (a → b) gezeichnet; fährt die Figur rückwärts, wird die Punktfolge umgedreht.
  const forward = !edge || edge.a === Number(fromStop.dataset.to), offset = (OFFSET[edge?.mode] || 0) * scale;
  const points = forward ? curve(a, b, offset) : curve(b, a, offset).reverse();
  const duration = Math.round(Math.min(900, Math.max(360, 280 + Math.hypot(b.x - a.x, b.y - a.y) * 1.3)));
  return (m) => {
    const base = m.base(el);
    return { el, final: base.inline, duration, delay, frames: points.map((p, k) => ({ transform: `translate(${p.x - b.x}px, ${p.y - b.y}px) ${base.transform}`.trim(), offset: k / (points.length - 1) })) };
  };
}

export default {
  palette: 'scotland-yard',
  winner: { colors: ['#e7d6ac', '#2f6f73', '#b84d44', '#202b35'], shape: 'paper', palette: 'scotland-yard', winEvent: 'win' },
  select: '.sy-ticket:not([disabled])',
  key: (view) => [view.phase, view.roundNo, view.turnId, view.g?.move, view.g?.doublePending, view.g?.lastSeen?.move, view.g?.xPosition, (view.g?.detectives || []).map((d) => d.station).join(','), !!view.gamePaused].join(':'),
  finale: (view, prev) => (arrested(view) && prev.phase === 'playing' ? 2100 : 0),
  still(view, x) {
    const map = x.$('.sy-map'); if (!map || !view.g) return;
    map.dataset.xpTime = daytime(view.g.move);
    if (arrested(view)) stop(x, view.g.xPosition)?.classList.add('xp-caught');
  },
  change(view, prev, x) {
    const g = view.g, pg = prev.g; if (!g || !pg) return;
    if (view.roundNo !== prev.roundNo) { x.play('casefile'); return; }
    const group = [];
    // Mr. X ist gefahren: Das benutzte Ticket ist öffentlich, das Ziel nur, wenn der Server es dieser Ansicht zeigt.
    if (g.travel.length > pg.travel.length) {
      const entry = g.travel.at(-1), known = pg.xPosition != null && g.xPosition != null && pg.xPosition !== g.xPosition;
      const edge = known ? line(g.map.edges, pg.xPosition, g.xPosition, entry.ticket) : null;
      // Das Fährhorn würde die Fähre verraten: Es erklingt nur, wenn diese Ansicht die Fahrt ohnehin kennt.
      x.play(entry.ticket === 'black' ? (edge?.ferryOnly ? 'ferry' : 'black') : entry.ticket);
      if (known) group.push(ride(x, stop(x, g.xPosition)?.querySelector('.sy-piece'), stop(x, pg.xPosition), stop(x, g.xPosition), edge));
      if (g.lastSeen && g.lastSeen.move !== pg.lastSeen?.move) {
        // Auftauchen: Silhouette im Nebel (Verlauf statt Weichzeichner) und ein Spannungston.
        const at = stop(x, g.lastSeen.station);
        x.play('reveal', { after: 260 });
        if (at) {
          const fog = document.createElement('span'); fog.className = 'xp-sy-fog'; fog.setAttribute('aria-hidden', 'true'); at.append(fog);
          group.push(x.plans.frames(fog, [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1)', opacity: 0.95, offset: 0.35 }, { transform: 'scale(1.5)', opacity: 0 }], { duration: 1500 }));
          const piece = at.querySelector('.sy-piece');
          if (piece && !known) group.push(x.plans.frames(piece, [{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1.5)', opacity: 1, offset: 0.6 }, { transform: 'none', opacity: 1 }], { duration: 700, delay: 200 }));
          x.later(() => fog.remove(), 1700);
        }
        x.highlight('auftauchen', 1600, x.$('.sy-map'));
      }
    }
    // Detektive fahren ihre Linie entlang.
    for (const trip of trips(pg.detectives, g.detectives)) {
      const edge = line(g.map.edges, trip.from, trip.to, trip.ticket);
      x.play(trip.ticket);
      group.push(ride(x, stop(x, trip.to)?.querySelector('.sy-piece'), stop(x, trip.from), stop(x, trip.to), edge));
    }
    if (daytime(g.move) !== daytime(pg.move)) x.highlight('zeitwechsel', 1400, x.$('.sy-map'));
    // Festnahme: Alle Detektive springen auf das Feld von Mr. X, Handschellen klicken, die Akte wird gestempelt.
    if (arrested(view) && prev.phase === 'playing') {
      const target = stop(x, g.xPosition);
      if (target) {
        const goal = middle(target);
        for (const [n, d] of g.detectives.entries()) {
          const el = stop(x, d.station)?.querySelector('.sy-piece'); if (!el || d.station === g.xPosition) continue;
          const here = middle(el), dx = goal.x - here.x + (n - (g.detectives.length - 1) / 2) * 14, dy = goal.y - here.y - 6;
          group.push(x.plans.frames(el, [{ transform: 'none' }, { transform: `translate(${dx / 2}px, ${dy / 2 - 46}px) scale(1.15)`, offset: 0.2 }, { transform: `translate(${dx}px, ${dy}px)`, offset: 0.36 }, { transform: `translate(${dx}px, ${dy}px)`, offset: 0.88 }, { transform: 'none' }], { duration: 2000, delay: 500 + n * 70 }));
        }
        x.play('cuffs', { after: 1150 }); x.play('stamp', { after: 1500 }); x.play('highlight', { after: 1560 });
        x.later(() => x.plaque(t('GEFASST', 'CAUGHT'), { anchor: target, ms: 2600, material: null, cls: 'xp-sy-stamp' }), x.animated ? 1500 : 0);
        x.highlight('festnahme', 2400, x.$('.sy-map'));
      }
    }
    if (group.some(Boolean)) x.run(group);
  },
};
