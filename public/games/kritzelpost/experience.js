// EXP-038 Kritzelpost: Postamt. Jeder Schritt trägt einen Poststempel mit seiner Nummer, Beiträge eine Eulen-Briefmarke.
// Bei der Auflösung spult jede Kette wie beim Postboten ab; kommt der Anfangsbegriff wieder an, gibt es den Stempel „Zugestellt!“.
// Geheimnisse: Fremde Beiträge erscheinen erst mit der Auflösung des Servers; vorher zählt nur, wer abgegeben hat.
const t = (de, en) => (globalThis.I18n?.language === 'en' ? en : de);
const norm = (text) => String(text || '').toLocaleLowerCase('de').normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '');
/** Kette ist „zugestellt“, wenn die letzte Beschreibung wieder dem Anfangsbegriff entspricht. */
export function delivered(chain) {
  const pages = chain?.pages || [], first = norm(pages[0]?.text);
  const last = pages.slice(1).reverse().find((p) => !p.image && p.text !== undefined);
  return !!first && !!last && norm(last.text) === first;
}
const done = (view) => (view.players || []).filter((p) => p.inRound && p.ready).length;
const STEP = 360;

export default {
  palette: 'kritzelpost',
  winner: { colors: ['#c9a46a', '#8a2f3a', '#f3e7cc'], shape: 'paper', palette: 'kritzelpost', winEvent: 'win' },
  select: '.draw-color',
  key: (view) => [view.phase, view.roundNo, view.g?.q, view.g?.stage, view.g?.step, done(view), !!view.gamePaused].join(':'),
  still(view, x) {
    const g = view.g; if (!g) return;
    // Poststempel mit der Schrittnummer.
    const head = x.$('.pk-q'); if (head && g.stage === 'write' && g.step) head.dataset.xpMark = `${t('Nr.', 'No.')} ${g.step}`;
    if (g.stage === 'reveal') x.$$('.draw-chains details').forEach((el, i) => {
      if (!delivered(g.chains?.[i]) || el.querySelector('.xp-kp-delivered')) return;
      el.classList.add('xp-delivered');
      const mark = document.createElement('span'); mark.className = 'xp-kp-delivered'; mark.textContent = t('Zugestellt!', 'Delivered!');
      el.querySelector('summary')?.append(mark);
    });
  },
  change(view, prev, x) {
    const g = view.g, pg = prev.g || {}; if (!g) return;
    const group = [];
    if (g.stage === 'write' && (g.step !== pg.step || g.q !== pg.q || pg.stage !== 'write')) {
      // Neuer Schritt: Der Umschlag aus dem Nachbarfach kommt an.
      x.play('envelope');
      const head = x.$('.pk-q'); if (head) group.push(x.plans.frames(head, [{ transform: 'translateX(46px) rotate(2deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 340 }));
    } else if (g.stage === 'write' && done(view) > done(prev)) x.play('stamp');
    if (g.stage === 'reveal' && pg.stage !== 'reveal') {
      // Auflösung: Postsirene, dann spult jede Kette Seite für Seite ab.
      x.play('siren');
      const pages = x.$$('.draw-chains li');
      pages.forEach((el, n) => {
        const delay = 420 + Math.min(n, 11) * STEP;
        group.push(x.plans.frames(el, [{ transform: 'translateY(16px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, delay }));
        if (n < 8 && x.animated) x.play('page', { after: delay });
      });
      // Highlight: Die Kette erreicht wieder den Anfangsbegriff.
      const hits = x.$$('.draw-chains details.xp-delivered');
      if (hits.length) {
        const wait = x.animated ? 420 + Math.min(pages.length, 12) * STEP : 0;
        x.play('stamp', { after: wait }); x.play('highlight', { after: wait + 120 });
        x.later(() => {
          for (const el of hits.slice(0, 3)) x.confetti(el.querySelector('.xp-kp-delivered') || el, { colors: ['#c9a46a', '#8a2f3a', '#f3e7cc'], count: 10, spread: 56 });
          x.plaque(t('Zugestellt!', 'Delivered!'), { anchor: hits[0].querySelector('.xp-kp-delivered') || hits[0], ms: 2200, material: null, cls: 'xp-kp-stamp' });
        }, wait);
        x.highlight('zugestellt', wait + 2400);
      }
    }
    if (group.length) x.run(group);
  },
};
