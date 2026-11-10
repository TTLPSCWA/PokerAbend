// EXP-087 Doppelkopf: Vereinsheim-Tisch für vier mit Rundenzettel und Re-/Kontra-Aufstellern an jedem Platz.
// Ansagen klingen als Messington (Re) oder tieferer Gegenton (Kontra). Wird eine Partei bekannt, dreht sich der Aufsteller um.
// Gefangene Füchse springen als Fuchs-Plakette zum Stich-Gewinner (Jagdhorn). Highlight: Doppelkopf (40 Augen im Stich) – „Doko!“.
// Geheimnisse: Aufsteller zeigen nur Parteien, die der Server öffentlich nennt (`known`); sonst steht ein Fragezeichen.
const t = (de, en) => (globalThis.I18n?.language === 'en' ? en : de);
const seatOf = (x, id) => x.$(`.ks[data-pid="${CSS.escape(id)}"]`) || x.$(`.kp[data-pid="${CSS.escape(id)}"]`);
const FOX = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M6 6l9 8h10l9-8-2 15-12 15L8 21z" fill="#d9772e" stroke="#5a2a0c" stroke-width="2" stroke-linejoin="round"/><path d="M14 22l6 8 6-8-6 3z" fill="#fff3e0"/><circle cx="15" cy="19" r="1.800" fill="#2a1406"/><circle cx="25" cy="19" r="1.800" fill="#2a1406"/><path d="M19 29h2" stroke="#2a1406" stroke-width="2.500" stroke-linecap="round"/></svg>';
const base = (c) => String(c).slice(0, 2);
/** Was ist zwischen zwei bestätigten Zuständen öffentlich passiert? */
export function events(a, b) {
  const g = b?.g, p = a?.g, out = [];
  if (!g || !p || g.dealKey !== p.dealKey) return out;
  for (const party of ['re', 'kontra']) if ((g.levels?.[party] || 0) > (p.levels?.[party] || 0)) out.push({ type: 'call', party });
  for (const [id, party] of Object.entries(g.known || {})) if (!p.known?.[id]) out.push({ type: 'party', id, party });
  if (g.trick.length > p.trick.length) out.push({ type: 'card' });
  if (g.lastTrick && JSON.stringify(g.lastTrick) !== JSON.stringify(p.lastTrick) && g.trick.length === 0) {
    out.push({ type: 'sweep', winner: g.lastTrick.winner, points: g.lastTrick.points });
    // Füchse (Karo-Asse), die ein anderer Spieler als der Gewinner gelegt hat, springen zum Gewinner.
    for (const play of g.lastTrick.cards) if (base(play.card) === 'Ad' && play.id !== g.lastTrick.winner) {
      const caught = !!g.known?.[play.id] && !!g.known?.[g.lastTrick.winner] && g.known[play.id] !== g.known[g.lastTrick.winner];
      out.push({ type: 'fox', from: play.id, to: g.lastTrick.winner, caught });
    }
  }
  return out;
}
export const doko = (points) => (points || 0) >= 40;

function plates(view, x) {
  for (const p of view.players || []) {
    if (!p.inRound && !p.seated) continue;
    const seat = seatOf(x, p.id); if (!seat) continue;
    let plate = seat.querySelector(':scope .xp-dk-plate');
    if (!plate) { plate = document.createElement('span'); plate.className = 'xp-dk-plate'; plate.setAttribute('aria-hidden', 'true'); (seat.querySelector('.kp-txt') || seat).append(plate); }
    const party = view.g?.known?.[p.id] || null;
    plate.dataset.party = party || 'offen'; plate.textContent = party === 're' ? 'Re' : party === 'kontra' ? 'Kontra' : '?';
  }
}

export default {
  palette: 'doppelkopf',
  winner: { colors: ['#e8b27c', '#2f6f73', '#c0392b'], shape: 'paper', palette: 'doppelkopf', winEvent: 'win' },
  select: '[data-g=dk-card]',
  key: (view) => [view.phase, view.roundNo, view.g?.dealKey, view.g?.revision, view.g?.stage, view.g?.trick?.length, !!view.gamePaused].join(':'),
  still(view, x) {
    if (view.g?.stage === 'play' || view.g?.stage === 'deal-over') plates(view, x);
    // Rundenzettel: Stich-Nummer und Ansagen auf Papier.
    const head = x.$('.dk-head');
    if (head && view.g?.stage === 'play' && !head.querySelector('.xp-dk-sheet')) head.insertAdjacentHTML('beforeend', `<div class="xp-dk-sheet" aria-hidden="true">${t('Stich', 'Trick')} ${(view.g.trickNo || 0) + 1}/${view.g.handSize || 12}</div>`);
  },
  change(view, prev, x) {
    const group = [];
    for (const e of events(prev, view)) {
      if (e.type === 'call') {
        x.play(e.party);
        const call = x.$(`.dk-call.${e.party}`); if (call) group.push(x.plans.frames(call, [{ transform: 'scale(1.5)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 320 }));
      } else if (e.type === 'party') {
        // Partei geklärt: Der Aufsteller dreht sich um.
        const plate = seatOf(x, e.id)?.querySelector('.xp-dk-plate');
        if (plate) { group.push(x.plans.frames(plate, [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)', offset: 0.5 }, { transform: 'scaleX(1)' }], { duration: 460 })); x.play('flip', { after: 120 }); }
      } else if (e.type === 'card') x.play('card');
      else if (e.type === 'sweep') {
        x.play('card'); x.play('sweep', { after: 420 });
        const target = seatOf(x, e.winner), cards = x.$$('.dk-trick article');
        if (doko(e.points)) {
          // Highlight: Doppelkopf – der Stich leuchtet und bekommt die Plakette „Doko!“, bevor er zum Gewinner wandert.
          x.play('highlight', { after: 150 }); x.highlight('doko', 2400);
          x.plaque(t('Doko!', 'Doko!'), { anchor: x.$('.dk-trick'), ms: 1900, material: null, cls: 'xp-dk-doko' });
          for (const el of cards) el.classList.add('xp-dk-glow');
        }
        if (target) {
          const to = target.getBoundingClientRect(), wait = doko(e.points) ? 1500 : 0;
          cards.forEach((el, n) => {
            el.classList.add('xp-dk-sweep');
            const r = el.getBoundingClientRect(), dx = to.left + to.width / 2 - (r.left + r.width / 2), dy = to.top + to.height / 2 - (r.top + r.height / 2);
            group.push(x.plans.frames(el, [{ transform: 'none', opacity: 1 }, { transform: 'none', opacity: 1, offset: 0.45 }, { transform: `translate(${dx}px, ${dy}px) scale(.45)`, opacity: 0 }], { duration: 900, delay: wait + n * 40 }));
          });
        }
      } else if (e.type === 'fox') {
        // Fuchs springt im Bogen vom Platz seines Spielers zum Stich-Gewinner; gefangen klingt das Jagdhorn.
        if (e.caught) x.play('horn', { after: 300 });
        const from = seatOf(x, e.from), to = seatOf(x, e.to), layer = x.layer;
        if (from && to && layer) {
          const a = from.getBoundingClientRect(), b = to.getBoundingClientRect(), box = layer.getBoundingClientRect(), fox = document.createElement('span');
          fox.className = 'xp-dk-fox'; fox.innerHTML = FOX;
          fox.style.left = `${a.left + a.width / 2 - box.left}px`; fox.style.top = `${a.top + a.height / 2 - box.top}px`; layer.append(fox);
          const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
          group.push(x.plans.frames(fox, [{ transform: 'translate(-50%, -50%) scale(.6)', opacity: 0 }, { transform: `translate(calc(-50% + ${dx / 2}px), calc(-50% + ${dy / 2 - 70}px)) scale(1.2) rotate(-12deg)`, opacity: 1, offset: 0.45 }, { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1)`, opacity: 1, offset: 0.8 }, { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1)`, opacity: 0 }], { duration: 1300, delay: 250 }));
          x.later(() => fox.remove(), x.animated ? 1650 : 900);
        }
      }
    }
    if (group.length) x.run(group);
  },
};
