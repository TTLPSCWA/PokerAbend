// Gemeinsame Darstellungshilfen für Ablegespiele (UNO, Mau-Mau …): Ereignisse aus zwei bestätigten Zuständen ablesen
// und Kartenrücken vom Stapel zu einem Platz fliegen lassen. Reine Darstellung – keine Regeln, keine fremden Karten.
const round = (view) => (view?.players || []).filter((p) => p.inRound);
const cardsOf = (view, id) => view?.players?.find((p) => p.id === id)?.cards ?? 0;

/** Was ist zwischen zwei bestätigten Zuständen derselben Runde öffentlich passiert? */
export function shedEvents(prev, view) {
  const g = view?.g, pg = prev?.g, out = [];
  if (!g || !pg || view.roundNo !== prev.roundNo || prev.phase !== 'playing') return out;
  for (const p of view.players || []) {
    const before = prev.players?.find((q) => q.id === p.id); if (!before) continue;
    const diff = (p.cards ?? 0) - (before.cards ?? 0);
    if (diff > 0) out.push({ type: 'draw', id: p.id, n: diff });
    else if (diff < 0 && g.top && (g.top !== pg.top || p.id === prev.turnId)) out.push({ type: 'play', id: p.id, card: g.top });
    if (p.last && !before.last && view.phase === 'playing') out.push({ type: 'last', id: p.id });
  }
  if (view.dir !== prev.dir) out.push({ type: 'reverse', dir: view.dir });
  if ((g.pending || 0) > (pg.pending || 0)) out.push({ type: 'chain', total: g.pending, stacked: (pg.pending || 0) > 0 });
  if (g.wish && g.wish !== pg.wish) out.push({ type: 'wish', wish: g.wish });
  return out;
}
/** Wer wurde übersprungen? Der Platz nach dem Ausspielenden in Spielrichtung – nur wenn der Zug wirklich über ihn hinwegging. */
export function skipped(prev, view) {
  const ids = round(view).map((p) => p.id), n = ids.length, i = ids.indexOf(prev?.turnId);
  if (n < 2 || i < 0 || view.phase !== 'playing') return null;
  const dir = view.dir < 0 ? -1 : 1, at = (k) => ids[(((i + dir * k) % n) + n) % n];
  return view.turnId === at(2) && cardsOf(view, at(1)) === cardsOf(prev, at(1)) ? at(1) : null;
}

const middle = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
/** Platz eines Spielers (Tischring oder Spielerleiste). */
export const seatOf = (x, id) => x.$(`.ks[data-pid="${CSS.escape(id)}"]`) || x.$(`.kp[data-pid="${CSS.escape(id)}"]`);
/** `n` Kartenrücken fliegen nacheinander von `from` nach `to`. Liefert Bewegungspläne für x.run(). */
export function flyBacks(x, from, to, n, { step = 130, cls = '', delay = 0 } = {}) {
  const layer = x.layer; if (!layer || !from || !to || n <= 0) return [];
  const a = middle(from), b = middle(to), box = layer.getBoundingClientRect(), count = Math.min(n, 8), plans = [];
  for (let k = 0; k < count; k++) {
    const el = document.createElement('i'); el.className = `xp-fly ${cls}`.trim(); el.setAttribute('aria-hidden', 'true');
    el.style.left = `${a.x - box.left}px`; el.style.top = `${a.y - box.top}px`; layer.append(el);
    const wait = delay + k * step;
    plans.push(x.plans.frames(el, [{ transform: 'translate(-50%, -50%) scale(1)', opacity: 0 }, { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.12 }, { transform: `translate(calc(-50% + ${b.x - a.x}px), calc(-50% + ${b.y - a.y}px)) scale(.55) rotate(${(k % 2 ? 1 : -1) * 14}deg)`, opacity: 1, offset: 0.88 }, { transform: `translate(calc(-50% + ${b.x - a.x}px), calc(-50% + ${b.y - a.y}px)) scale(.4)`, opacity: 0 }], { duration: 460, delay: wait }));
    x.later(() => el.remove(), x.animated ? wait + 520 : 0);
  }
  return plans;
}
/** Neu gezogene eigene Karten fächern vom Stapel in die Hand. `known` sind die Kartenschlüssel vor dem Zug. */
export function fanIn(x, known, from) {
  const a = from ? middle(from) : null;
  return x.$$('.kg-hand [data-card-key]').filter((el) => !known.has(el.dataset.cardKey)).slice(0, 10).map((el, k) => {
    const b = middle(el), dx = a ? a.x - b.x : 0, dy = a ? a.y - b.y : -40;
    return x.plans.frames(el, [{ transform: `translate(${dx}px, ${dy}px) rotate(-12deg) scale(.7)`, opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: 'none', opacity: 1 }], { duration: 360, delay: k * 80 });
  });
}
export const handKeys = (x) => new Set(x.$$('.kg-hand [data-card-key]').map((el) => el.dataset.cardKey));
