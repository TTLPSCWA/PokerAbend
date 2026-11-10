// EXP-086 Skat: Gute Stube mit Eckbank-Holz, Stammtisch-Schild und Zigarrenkiste als Skat-Ablage. Der Reizblock ist Papier mit Bleistift.
// Trumpf-Ausspielen klopft, Reizen kratzt, der Skat raschelt beim Aufnehmen, Stiche werden zum Gewinnerplatz geschoben.
// Highlight: Grand Hand – der Reizblock schreibt sich groß „Grand Hand“, der Stammtisch klopft dreimal.
// Geheimnisse: Der Skat bleibt verdeckt (nur Rücken), fremde Hände kennt die Ansicht nicht.
const seatOf = (x, id) => x.$(`.ks[data-pid="${CSS.escape(id)}"]`) || x.$(`.kp[data-pid="${CSS.escape(id)}"]`);
const t = (de, en) => (globalThis.I18n?.language === 'en' ? en : de);
const SIGN = '<svg class="xp-sk-sign" viewBox="0 0 180 64" aria-hidden="true"><path d="M30 4v10M150 4v10" stroke="#3a2614" stroke-width="3"/><rect x="6" y="14" width="168" height="46" rx="6" fill="#6b4320" stroke="#3a2614" stroke-width="3"/><rect x="12" y="20" width="156" height="34" rx="4" fill="none" stroke="#d9b87588" stroke-width="1.500"/><text x="90" y="44" text-anchor="middle" font-family="Georgia,serif" font-size="20" font-weight="700" fill="#f3dfae">Stammtisch</text></svg>';
const PENCIL = '<svg class="xp-sk-pencil" viewBox="0 0 120 16" aria-hidden="true"><path d="M2 8 18 2h86v12H18z" fill="#e9b949" stroke="#5a3d10" stroke-width="1.500"/><path d="M2 8 18 2v12z" fill="#f2d9a8"/><path d="M2 8l6-2.200v4.400z" fill="#333"/><rect x="104" y="2" width="14" height="12" rx="2" fill="#d98c8c" stroke="#5a3d10" stroke-width="1.500"/></svg>';
const JACKS = ['Jc', 'Js', 'Jh', 'Jd'];
/** Trumpf nach Skatregeln (wie games/skat/rules.js): Buben immer, bei Farbspiel auch die Trumpffarbe. */
export const isTrump = (c, g) => !!g && (g.type === 'suit' ? c[0] === 'J' || c[1] === g.suit : g.type === 'grand' || g.type === 'ramsch' ? c[0] === 'J' : false);
/** Was ist zwischen zwei bestätigten Zuständen öffentlich passiert? */
export function events(a, b) {
  const g = b?.g, p = a?.g, out = [];
  if (!g || !p || g.dealKey !== p.dealKey) return out;
  if (g.stage === 'bid' && p.stage === 'bid' && (g.bd?.value !== p.bd?.value || g.passed.length > p.passed.length)) out.push('bid');
  if (p.stage === 'pickup' && g.stage === 'discard') out.push('pickup');
  if (p.stage === 'discard' && g.stage === 'declare') out.push('press');
  if (g.stage === 'play' && p.stage !== 'play' && g.game?.type === 'grand' && g.game.hand) out.push('grandhand');
  if (g.trick.length === 1 && p.trick.length !== 1 && isTrump(g.trick[0].card, g.game)) out.push('trump');
  else if (g.trick.length > p.trick.length) out.push('card');
  if (g.lastTrick && JSON.stringify(g.lastTrick) !== JSON.stringify(p.lastTrick) && g.trick.length === 0) out.push('sweep');
  return out;
}

export default {
  palette: 'skat',
  winner: { colors: ['#e3c27a', '#6b4320', '#2f6a48'], shape: 'paper', palette: 'skat', winEvent: 'win' },
  select: '[data-g=sk-card]',
  key: (view) => [view.phase, view.roundNo, view.g?.dealKey, view.g?.revision, view.g?.stage, view.g?.trick?.length, !!view.gamePaused].join(':'),
  still(view, x) {
    const world = x.$('.sk-world'); if (!world) return;
    if (!world.querySelector(':scope > .xp-sk-sign')) world.insertAdjacentHTML('afterbegin', SIGN);
    const bid = x.$('.sk-bid'); if (bid && !bid.querySelector('.xp-sk-pencil')) bid.insertAdjacentHTML('beforeend', PENCIL);
    const box = x.$('.sk-skat'); if (box) box.classList.add('xp-sk-box');
    // Grand Hand bleibt die ganze Runde als Zettel vom Reizblock am Tisch stehen.
    const g = view.g, head = x.$('.sk-head');
    if (head && g?.game?.type === 'grand' && g.game.hand && g.stage === 'play' && !head.querySelector('.xp-sk-note')) head.insertAdjacentHTML('beforeend', `<div class="xp-sk-note">${t('Grand Hand', 'Grand Hand')}</div>`);
  },
  change(view, prev, x) {
    const list = events(prev, view), group = [];
    for (const e of list) {
      if (e === 'bid') {
        x.play('pencil');
        const value = x.$('.sk-bid b'); if (value) group.push(x.plans.frames(value, [{ transform: 'translateX(-8px)', opacity: 0.2 }, { transform: 'none', opacity: 1 }], { duration: 260 }));
      } else if (e === 'pickup') {
        // Skat wird umgedreht und aufgenommen: Die beiden Rücken kippen um und gleiten zur Hand.
        x.play('rustle');
        x.$$('.sk-skat-cards i').forEach((el, n) => group.push(x.plans.frames(el, [{ transform: 'rotateY(0deg)', opacity: 1 }, { transform: 'scaleX(0)', opacity: 1, offset: 0.4 }, { transform: 'scaleX(1) translateY(30px)', opacity: 0.6, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: 520, delay: n * 90 })));
      } else if (e === 'press') {
        // Zwei Karten zurück in die Kiste.
        x.play('press'); x.play('press', { after: 140 });
        x.$$('.sk-skat-cards i').forEach((el, n) => group.push(x.plans.frames(el, [{ transform: 'translateY(70px) rotate(8deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, delay: n * 120 })));
      } else if (e === 'trump') {
        x.play('knock');
        const card = x.$('.sk-trick article .kc'); if (card) group.push(x.plans.frames(card, [{ transform: 'translateY(-10px) scale(1.06)' }, { transform: 'none' }], { duration: 200 }));
      } else if (e === 'card') x.play('card');
      else if (e === 'sweep') {
        // Der fertige Stich wird zum Gewinnerplatz geschoben.
        x.play('card'); x.play('sweep', { after: 420 });
        const target = seatOf(x, view.g.lastTrick.winner);
        if (target) {
          const to = target.getBoundingClientRect();
          x.$$('.sk-trick article').forEach((el, n) => {
            el.classList.add('xp-sk-sweep');
            const r = el.getBoundingClientRect(), dx = to.left + to.width / 2 - (r.left + r.width / 2), dy = to.top + to.height / 2 - (r.top + r.height / 2);
            group.push(x.plans.frames(el, [{ transform: 'none', opacity: 1 }, { transform: 'none', opacity: 1, offset: 0.45 }, { transform: `translate(${dx}px, ${dy}px) scale(.45)`, opacity: 0 }], { duration: 900, delay: n * 40 }));
          });
        }
      } else if (e === 'grandhand') {
        // Highlight: Grand Hand.
        x.play('stammtisch'); x.play('highlight');
        x.highlight('grandhand', 2400);
        const head = x.$('.sk-head'); if (head && !head.querySelector('.xp-sk-note')) head.insertAdjacentHTML('beforeend', `<div class="xp-sk-note">${t('Grand Hand', 'Grand Hand')}</div>`);
        const note = x.$('.xp-sk-note'); if (note) group.push(x.plans.frames(note, [{ transform: 'scaleX(0)', opacity: 0 }, { transform: 'scaleX(1)', opacity: 1 }], { duration: 700, delay: 250 }));
        x.plaque(t('Grand Hand', 'Grand Hand'), { anchor: x.$('.sk-felt'), ms: 2400, material: null, cls: 'xp-sk-grand' });
      }
    }
    if (group.length) x.run(group);
  },
};
