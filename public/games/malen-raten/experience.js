// EXP-040 Malen & Raten: Atelier. Die Farbauswahl ist eine Holzpalette, das Bild steht im Holzrahmen.
// Die erste richtige Lösung rahmt das Bild golden ein; erraten es alle, hängt es an der „Galerie des Abends“.
// Geheimnisse: Der Begriff erscheint nirgends vor der Auflösung des Servers; wer erraten hat, ist ohnehin öffentlich.
const t = (de, en) => (globalThis.I18n?.language === 'en' ? en : de);
/** Alle Ratenden haben den Begriff erraten (bei der Auflösung). */
export const everyone = (view) => {
  const g = view?.g; if (!g || g.stage !== 'reveal') return false;
  const guessers = (view.players || []).filter((p) => p.inRound && p.id !== g.artist).length;
  return guessers > 0 && (g.guessed || []).length >= guessers;
};
/** Sekunden bis zum Ende der Zeichenrunde; null, wenn keine Uhr läuft. */
export const secondsLeft = (view, now) => (view?.phase === 'playing' && view.g?.stage === 'write' && view.deadline ? Math.ceil((view.deadline - now) / 1000) : null);
let rung = null, listening = false;

// Pinselstrich: eigene Bedienung des Zeichners (kein Spielereignis), deshalb leise und nur lokal.
function listen() {
  if (listening) return; listening = true;
  document.addEventListener('pointerdown', (event) => {
    if (event.target?.closest?.('#kg[data-xp-kit="malen-raten"] .draw-editor canvas')) globalThis.Sound?.play('brush');
  }, { passive: true });
}

export default {
  palette: 'malen-raten',
  winner: { colors: ['#df493d', '#e8aa32', '#358856', '#368ad4', '#8954ba'], shape: 'paper', palette: 'malen-raten', winEvent: 'win' },
  select: '.draw-color',
  key: (view) => [view.phase, view.roundNo, view.g?.q, view.g?.stage, view.g?.guessed?.length, !!view.gamePaused].join(':'),
  still(view, x) {
    listen();
    const g = view.g; if (!g) return;
    const picture = x.$('.draw-editor canvas') || x.$('.draw-picture');
    if (picture) { picture.classList.toggle('xp-gold', (g.guessed || []).length > 0); picture.classList.toggle('xp-gallery', everyone(view)); }
  },
  change(view, prev, x) {
    const g = view.g, pg = prev.g || {}; if (!g) return;
    const group = [], picture = x.$('.draw-editor canvas') || x.$('.draw-picture');
    if (g.q !== pg.q && g.stage === 'write') { rung = null; x.play('frame'); if (picture) group.push(x.plans.frames(picture, [{ transform: 'translateY(-14px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 320 })); }
    const hits = (g.guessed || []).length - (pg.guessed || []).length;
    if (hits > 0 && g.q === pg.q) {
      x.play('hit');
      // Erste richtige Lösung: Der Rahmen wird golden.
      if (!(pg.guessed || []).length && picture) { x.play('frame', { after: 140 }); group.push(x.plans.frames(picture, [{ transform: 'scale(1)' }, { transform: 'scale(1.025)', offset: 0.4 }, { transform: 'none' }], { duration: 520 })); }
    }
    if (g.stage === 'reveal' && pg.stage !== 'reveal' && everyone(view)) {
      // Highlight: Das Bild hängt sich an die „Galerie des Abends“.
      const layer = x.layer, source = x.$('.draw-picture');
      x.play('highlight', { after: 300 });
      if (layer && source) {
        const wall = document.createElement('div'); wall.className = 'xp-mr-wall';
        const frame = document.createElement('div'); frame.className = 'xp-mr-frame';
        const copy = source.cloneNode(true); copy.removeAttribute('class'); copy.setAttribute('aria-hidden', 'true');
        const plate = document.createElement('b'); plate.textContent = t('Galerie des Abends', 'Gallery of the night');
        frame.append(copy, plate); wall.append(frame); layer.append(wall);
        group.push(x.plans.frames(wall, [{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.88 }, { opacity: 0 }], { duration: 3200 }));
        // Das Bild schwingt am Nagel aus.
        group.push(x.plans.frames(frame, [{ transform: 'translateY(-60vh) rotate(-9deg)' }, { transform: 'rotate(7deg)', offset: 0.25 }, { transform: 'rotate(-4deg)', offset: 0.42 }, { transform: 'rotate(2deg)', offset: 0.58 }, { transform: 'none', offset: 0.72 }, { transform: 'none' }], { duration: 3200 }));
        x.later(() => wall.remove(), x.animated ? 3250 : 2400);
      }
      x.highlight('galerie', 3200);
    }
    if (group.length) x.run(group);
  },
  // Eieruhr: klingelt einmal, wenn noch zehn Sekunden bleiben.
  interval: { ms: 250, run(view, x) {
    const left = secondsLeft(view, gameNow(view)), key = view.roundNo + ':' + view.g?.q;
    if (left === null || left > 10 || left <= 0 || rung === key) return;
    rung = key; x.play('ring');
    x.highlight('eieruhr', 1200, x.$('#kg-clock') || x.root);
  } },
};
