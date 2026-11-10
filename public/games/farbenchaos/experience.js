// EXP-004 UNO (alle fünf Welten): Gezogene Karten fächern in die Hand, Strafkarten fliegen einzeln zum Opfer,
// beim Richtungswechsel dreht sich der Pfeilring, die Wunschfarbe erscheint als Drehscheibe.
// Highlight „Stapel-Schlacht“: Wird +2 auf +2 gestapelt, wächst der Zähler über der Ablage („+6!“), der Verlierer bekommt den ganzen Schwall.
// Geheimnisse: Fremde Karten fliegen nur als Kartenrücken; die Werte kennt diese Ansicht gar nicht.
import { shedEvents, skipped, seatOf, flyBacks, fanIn, handKeys } from '/games/shedding-events.js';
const t = (de, en) => (globalThis.I18n?.language === 'en' ? en : de);
const HUE = { r: '#d9423a', y: '#e9b320', g: '#2f9a55', b: '#2f6fd0', p: '#d94f9a', t: '#22a5a0', o: '#e27a2c', v: '#8455c8' };
const RING = '<svg viewBox="0 0 100 100" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"><path d="M50 12a38 38 0 0 1 36 26M50 88a38 38 0 0 1-36-26"/><path d="M78 20l9 18-19 2M22 80l-9-18 19-2" stroke-linejoin="round"/></svg>';
let known = new Set(), battle = 0;

function overlay(x, cls, html = '') {
  const layer = x.layer, anchor = x.$('.kg-discard') || x.$('.kg-piles'); if (!layer || !anchor) return null;
  const r = anchor.getBoundingClientRect(), box = layer.getBoundingClientRect(), el = document.createElement('div');
  el.className = cls; el.setAttribute('aria-hidden', 'true'); el.innerHTML = html;
  el.style.left = `${r.left + r.width / 2 - box.left}px`; el.style.top = `${r.top + r.height / 2 - box.top}px`;
  layer.append(el); return el;
}

export default {
  palette: 'uno',
  winner: { colors: Object.values(HUE).slice(0, 4), shape: 'paper', palette: 'uno', winEvent: 'win' },
  key: (view) => [view.phase, view.roundNo, view.turnId, view.dir, view.g?.top, view.g?.wish, view.g?.pending, view.g?.side, (view.players || []).map((p) => p.cards).join(','), !!view.gamePaused].join(':'),
  still(view, x) { known = handKeys(x); if (!view.g?.pending) battle = 0; },
  change(view, prev, x) {
    const before = known, events = shedEvents(prev, view), group = [], deck = x.$('.kg-piles .kg-pile');
    for (const el of x.root.querySelectorAll('.xp-uno-count')) el.remove(); // immer nur ein Zähler
    known = handKeys(x);
    if (view.roundNo !== prev.roundNo || prev.phase !== 'playing') { if (view.phase === 'playing') { x.play('deal'); group.push(...fanIn(x, new Set(), deck)); } if (group.length) x.run(group); return; }
    const play = events.find((e) => e.type === 'play'), chain = events.find((e) => e.type === 'chain');
    if (play) {
      x.play('card');
      const top = x.$('.kg-discard .kc'); if (top) group.push(x.plans.frames(top, [{ transform: 'scale(1.16) rotate(-4deg)' }, { transform: 'none' }], { duration: 220 }));
      if (!chain && !events.some((e) => e.type === 'reverse')) { const out = skipped(prev, view); if (out) { x.play('skip', { after: 120 }); const seat = seatOf(x, out); if (seat) x.highlight('aussetzen', 900, seat); } }
    }
    for (const e of events) {
      if (e.type === 'draw') {
        // Zieh-Rascheln mit Stapeleffekt; viele Karten nach einer Kette sind der „Schwall“.
        const swell = battle > 1 && e.n >= 4;
        for (let k = 0; k < Math.min(e.n, 4); k++) x.play('draw', { after: k * 120 });
        if (e.id === view.you?.id) group.push(...fanIn(x, before, deck));
        else group.push(...flyBacks(x, deck, seatOf(x, e.id), e.n, { step: swell ? 90 : 130 }));
        if (swell) { x.play('highlight', { after: 200 }); x.highlight('schwall', 1500, seatOf(x, e.id) || x.root); x.plaque(`+${e.n}`, { anchor: seatOf(x, e.id), ms: 1500, material: null, cls: 'xp-uno-count is-seat' }); }
        battle = 0;
      } else if (e.type === 'reverse') {
        // Richtungswechsel: Der Pfeilring dreht sich einmal sichtbar in die neue Richtung.
        x.play('reverse');
        const ring = overlay(x, 'xp-uno-ring', RING);
        if (ring) { const turn = e.dir < 0 ? -1 : 1; group.push(x.plans.frames(ring, [{ transform: 'translate(-50%, -50%) rotate(0deg) scale(.7)', opacity: 0 }, { transform: `translate(-50%, -50%) rotate(${turn * 120}deg) scale(1)`, opacity: 0.95, offset: 0.3 }, { transform: `translate(-50%, -50%) rotate(${turn * 360}deg) scale(1.08)`, opacity: 0 }], { duration: 820 })); x.later(() => ring.remove(), 900); }
      } else if (e.type === 'wish') {
        // Wunschfarbe: Drehscheibe in der gewählten Farbe.
        x.play('wish', { after: 140 });
        const disc = overlay(x, 'xp-uno-disc');
        if (disc) { disc.style.setProperty('--hue', HUE[e.wish] || '#fff'); group.push(x.plans.frames(disc, [{ transform: 'translate(-50%, -50%) rotate(0deg) scale(.5)', opacity: 0 }, { transform: 'translate(-50%, -50%) rotate(200deg) scale(1)', opacity: 0.9, offset: 0.4 }, { transform: 'translate(-50%, -50%) rotate(360deg) scale(1.15)', opacity: 0 }], { duration: 760 })); x.later(() => disc.remove(), 840); }
      } else if (e.type === 'chain') {
        // Stapel-Schlacht: Der Zähler über der Ablage wächst mit jeder gestapelten Ziehkarte.
        battle = e.stacked ? battle + 1 : 1;
        if (e.stacked) { x.play('stack', { after: 80 }); x.highlight('stapel', 1300, x.$('.kg-piles')); x.plaque(`+${e.total}!`, { anchor: x.$('.kg-discard'), ms: 1300, material: null, cls: 'xp-uno-count' }); }
      } else if (e.type === 'last') x.play('call', { after: 260 });
    }
    if (group.length) x.run(group);
  },
};
