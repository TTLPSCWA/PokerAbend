// EXP-081 Doppelagent: Geheimdienst-Lounge. Die eigene Ortsakte ist ein Umschlag mit Siegel, Orte sind Postkarten.
// Bei einer Anklage drehen sich die Akten um, bei der Enthüllung schiebt der Agent die Sonnenbrille hoch,
// und errät er den Ort, fliegt die Postkarte ins Bild: „Mission erfüllt“.
// Geheimnisse: Alles hängt an öffentlichen Ereignissen (Protokoll, Anklage, Enthüllung). Wer der Agent ist, zeigt erst die Auflösung des Servers.
const t = (de, en) => (globalThis.I18n?.language === 'en' ? en : de);
const SHADES = '<svg class="xp-da-shades" viewBox="0 0 48 18" aria-hidden="true"><path d="M2 4h44M5 4c0 8 3 11 8 11s8-3 8-9c2-1.500 4-1.500 6 0 0 6 3 9 8 9s8-3 8-11" fill="#11181c" stroke="#d5af72" stroke-width="1.6" stroke-linejoin="round"/></svg>';
/** Was ist zwischen zwei bestätigten Zuständen öffentlich passiert? */
export function events(before, after) {
  const g = after || {}, pg = before || {}, list = [];
  if (g.key !== pg.key) return g.key ? ['case'] : [];
  if ((g.transcript?.length || 0) > (pg.transcript?.length || 0)) list.push('typed');
  if (g.vote && g.vote.id !== pg.vote?.id) list.push('accused');
  else if (g.vote && pg.vote && g.vote.count > pg.vote.count) list.push('voted');
  if (g.stage === 'reveal' && pg.stage !== 'reveal') list.push(g.summary?.reason === 'guess' ? 'mission' : 'revealed');
  return list;
}
const initial = (view, id) => Array.from(view.players.find((p) => p.id === id)?.name || '?')[0];

export default {
  palette: 'doppelagent',
  winner: { colors: ['#d5af72', '#203d40', '#ece8da'], shape: 'paper', palette: 'doppelagent', winEvent: 'win' },
  select: '.da-controls .btn',
  key: (view) => [view.phase, view.roundNo, view.g?.key, view.g?.revision, view.g?.stage, view.g?.vote?.id, view.g?.vote?.count, !!view.gamePaused].join(':'),
  still(view, x) {
    const g = view.g, box = x.$('.da-reveal');
    // Enthüllung: Der Agent ohne Tarnung – die Sonnenbrille ist hochgeschoben.
    if (g?.summary && box && !box.querySelector('.xp-da-agent')) box.insertAdjacentHTML('afterbegin', `<div class="xp-da-agent" aria-hidden="true"><b>${initial(view, g.summary.spy).replace(/[<&>"]/g, '')}</b>${SHADES}</div>`);
  },
  change(view, prev, x) {
    const g = view.g, group = [];
    for (const event of events(prev.g, g)) {
      if (event === 'case') {
        // Neue Akte: Der Umschlag mit der eigenen Karte wird zugestellt.
        x.play('file');
        const card = x.$('.da-secret'); if (card) group.push(x.plans.frames(card, [{ transform: 'translateY(-18px) rotate(-2deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420 }));
      } else if (event === 'typed') {
        x.play('type');
        const line = x.$$('.da-transcript > p').at(-1); if (line) group.push(x.plans.frames(line, [{ transform: 'translateX(-10px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260 }));
      } else if (event === 'accused') {
        // Anklage: Alle Akten drehen sich um (Kante – Rückseite), die Abstimmung liegt obenauf.
        x.play('accuse'); x.play('file', { after: 180 });
        for (const [n, el] of [x.$('.da-secret'), ...x.$$('.da-location-grid button')].filter(Boolean).slice(0, 24).entries()) group.push(x.plans.frames(el, [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)', offset: 0.5 }, { transform: 'scaleX(1)' }], { duration: 420, delay: Math.min(n, 8) * 35 }));
        const vote = x.$('.da-vote'); if (vote) group.push(x.plans.frames(vote, [{ transform: 'scale(.92)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, delay: 220 }));
        x.highlight('anklage', 1200, x.$('.da-file'));
      } else if (event === 'voted') x.play('vote');
      else {
        // Enthüllung: Akte auf, Spionage-Akkord, der Agent schiebt die Sonnenbrille hoch.
        x.play('file'); x.play('reveal', { after: 160 });
        const shades = x.$('.xp-da-agent .xp-da-shades'), agent = x.$('.xp-da-agent');
        if (agent) group.push(x.plans.frames(agent, [{ transform: 'scale(.6)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 320 }));
        if (shades) group.push(x.plans.frames(shades, [{ transform: 'rotate(14deg) translateY(17px)' }, { transform: 'rotate(14deg) translateY(17px)', offset: 0.5 }, { transform: 'none' }], { duration: 1100 }));
        if (event === 'mission') {
          // Highlight: Der Agent hat den Ort erraten – die Postkarte fliegt ins Bild.
          const layer = x.layer, place = g.summary?.location;
          x.play('highlight', { after: 520 });
          if (layer && place) {
            const card = document.createElement('div'); card.className = 'xp-da-postcard';
            const title = document.createElement('b'); title.textContent = t(place.de, place.en);
            const stamp = document.createElement('span'); stamp.textContent = t('Mission erfüllt', 'Mission accomplished');
            card.append(title, stamp); layer.append(card);
            group.push(x.plans.frames(card, [{ transform: 'translate(70vw, -40vh) rotate(38deg) scale(.5)', opacity: 0 }, { transform: 'rotate(-7deg) scale(1.06)', opacity: 1, offset: 0.22 }, { transform: 'none', opacity: 1, offset: 0.3 }, { transform: 'none', opacity: 1, offset: 0.88 }, { transform: 'translateY(-16px)', opacity: 0 }], { duration: 3000, delay: 380 }));
            x.later(() => card.remove(), x.animated ? 3450 : 2400);
          }
          x.highlight('mission', 3200);
        }
      }
    }
    if (group.length) x.run(group);
  },
};
