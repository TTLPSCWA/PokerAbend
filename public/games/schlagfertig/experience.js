// EXP-019 Schlagfertig: Comedy-Club mit Backsteinwand und Mikrofon. Antworten sind Karteikarten, Stimmen sind Lach-Symbole.
// In der Auflösung strahlt der Spot die bessere Antwort an, die andere wird abgedunkelt; das Publikum lacht je nach Stimmenzahl.
// Highlight: Alle Stimmen für eine Antwort – Standing Ovation mit Applaus und Rosen.
// Geheimnisse: Autoren und Stimmen erscheinen erst mit der Auflösung des Servers.
const t = (de, en) => (globalThis.I18n?.language === 'en' ? en : de);
const HA = '<svg class="xp-sl-ha" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#ffd98a" stroke="#3a2a12" stroke-width="1.800"/><path d="M7 9.500l3 1.500-3 1M17 9.500l-3 1.500 3 1" fill="none" stroke="#3a2a12" stroke-width="1.700" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 14.500h10a5 5 0 0 1-10 0z" fill="#3a2a12"/></svg>';
const MIC = '<svg viewBox="0 0 40 120" aria-hidden="true"><rect x="13" y="4" width="14" height="26" rx="7" fill="#c9ccd1" stroke="#22252b" stroke-width="2"/><path d="M13 13h14M13 19h14" stroke="#22252b" stroke-width="1.500"/><path d="M9 24a11 11 0 0 0 22 0M20 35v70M8 114h24" fill="none" stroke="#22252b" stroke-width="3" stroke-linecap="round"/><path d="M20 104l-12 10M20 104l12 10" stroke="#22252b" stroke-width="3" stroke-linecap="round"/></svg>';
/** Wie ging ein Duell aus? `winner` ist der Index der Antwort mit den meisten Stimmen, `tie` bei Gleichstand, `ovation` beim Volltreffer. */
export function verdict(result) {
  const votes = (result?.answers || []).map((a) => a.votes || 0), top = Math.max(0, ...votes);
  const leaders = votes.filter((v) => v === top).length;
  return { top, tie: top > 0 && leaders > 1, winner: top > 0 && leaders === 1 ? votes.indexOf(top) : -1, ovation: (result?.answers || []).some((a) => a.fullHit) };
}
/** Lachstärke nach Stimmenzahl. */
export const laughter = (votes) => (votes >= 4 ? 'laugh3' : votes >= 2 ? 'laugh2' : votes >= 1 ? 'laugh1' : null);
const done = (view) => (view.players || []).filter((p) => p.inRound && p.ready).length;
// Die Karten stehen nach Stimmen sortiert in der Seite; hier dieselbe Reihenfolge.
const sorted = (result) => [...(result?.answers || [])].sort((a, b) => b.votes - a.votes);

function dress(view, x) {
  const g = view.g; if (g?.stage !== 'reveal') return;
  x.$$('.sl-result').forEach((section, n) => {
    const result = g.results?.[n], v = verdict(result), cards = Array.from(section.querySelectorAll('.sl-card')), answers = sorted(result);
    cards.forEach((card, i) => {
      const votes = answers[i]?.votes || 0, lit = !g.final && !v.tie && v.top > 0 && votes === v.top;
      card.classList.toggle('xp-spot', lit); card.classList.toggle('xp-dim', !g.final && !v.tie && v.top > 0 && votes < v.top);
      const line = card.querySelector('.sl-votes');
      if (line && votes && !line.querySelector('.xp-sl-ha')) line.insertAdjacentHTML('beforeend', `<span class="xp-sl-laughs" aria-hidden="true">${HA.repeat(Math.min(votes, 8))}</span>`);
    });
  });
}

export default {
  palette: 'schlagfertig',
  winner: { colors: ['#ffd98a', '#c0392b', '#f6efe0'], shape: 'paper', palette: 'schlagfertig', winEvent: 'win' },
  select: '.sl-task',
  key: (view) => [view.phase, view.roundNo, view.g?.stage, view.g?.step, done(view), (view.g?.myVote || []).join(','), !!view.gamePaused].join(':'),
  still(view, x) {
    // Mikrofonständer am Bühnenrand (eigene Zeichnung).
    const main = x.$('.kg-main');
    if (main && view.phase === 'playing' && !main.querySelector(':scope > .xp-sl-mic')) main.insertAdjacentHTML('beforeend', `<span class="xp-sl-mic" aria-hidden="true">${MIC}</span>`);
    dress(view, x);
  },
  change(view, prev, x) {
    const g = view.g, pg = prev.g || {}; if (!g) return;
    const group = [];
    if (g.stage === 'write' && pg.stage !== 'write') x.play('index');
    else if (g.stage === 'write' && done(view) > done(prev)) x.play('index');
    if (g.stage === 'vote' && (pg.stage !== 'vote' || g.step !== pg.step)) {
      // Neue Abstimmung: Mikrofon-Klopfen, die Karteikarten kommen von beiden Seiten.
      x.play('mic');
      x.$$('.sl-ans').slice(0, 8).forEach((el, n) => group.push(x.plans.frames(el, [{ transform: `translateX(${n % 2 ? 40 : -40}px) rotate(${n % 2 ? 3 : -3}deg)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, delay: n * 60 })));
    }
    if (g.stage === 'reveal' && pg.stage !== 'reveal') {
      // Auflösung: Duell für Duell – Spot auf die bessere Antwort, Lachen nach Stimmen, Rimshot bei Gleichstand.
      let ovation = null;
      x.$$('.sl-result').slice(0, 6).forEach((section, n) => {
        const v = verdict(g.results?.[n]), wait = 250 + n * 700, lit = section.querySelector('.sl-card.xp-spot');
        const sound = v.tie ? 'rimshot' : laughter(v.top);
        if (sound) x.play(sound, { after: x.animated ? wait : n * 40 });
        if (lit) {
          const cone = document.createElement('i'); cone.className = 'xp-sl-cone'; cone.setAttribute('aria-hidden', 'true'); lit.prepend(cone);
          group.push(x.plans.frames(cone, [{ transform: 'scaleY(.2)', opacity: 0 }, { transform: 'scaleY(1)', opacity: 1, offset: 0.4 }, { transform: 'scaleY(1)', opacity: 0.55 }], { duration: 700, delay: wait }));
          group.push(x.plans.frames(lit, [{ transform: 'scale(1)' }, { transform: 'scale(1.03)', offset: 0.5 }, { transform: 'none' }], { duration: 420, delay: wait + 80 }));
        }
        if (v.ovation && !ovation) ovation = { el: section.querySelector('.sl-card.hit') || section, wait };
      });
      if (ovation) {
        // Highlight: Standing Ovation – Applaus und Rosen.
        const at = x.animated ? ovation.wait + 450 : 0;
        x.play('applause', { after: at }); x.play('applause', { after: at + 520 }); x.play('highlight', { after: at + 150 });
        x.later(() => { x.confetti(ovation.el, { colors: ['#c0392b', '#e86a6a', '#3d8a5a'], count: 14, spread: 90 }); x.plaque(t('Standing Ovation!', 'Standing ovation!'), { anchor: ovation.el, ms: 2400, material: null, cls: 'xp-sl-ovation' }); }, at);
        x.highlight('ovation', at + 2600);
      }
    }
    if (group.length) x.run(group);
  },
};
