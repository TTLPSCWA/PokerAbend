// EXP-036 Werwolf: Dorfplatz. Himmel und Gestirn wechseln mit Tag und Nacht, Rollen stehen auf Holztafeln mit eigenen Zeichen,
// beim Ausscheiden dreht sich die Tafel um, am Ende geht der Vollmond auf oder die Sonne siegt.
// Geheimnisse: Zu hören und zu sehen ist nur Öffentliches (Phase, Tote, Stimmenzahl). Nachtaktionen bleiben stumm.
const t = (de, en) => (globalThis.I18n?.language === 'en' ? en : de);
const svg = (d) => `<svg class="xp-ww-glyph" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
// Eigene Zeichen je Rolle.
export const GLYPHS = {
  dorf: '<path d="M3 11 12 4l9 7M5 10v10h14V10M10 20v-6h4v6"/>',
  wolf: '<path d="M4 3l4 5h8l4-5 0 9-8 9-8-9zM9 13h.5M14.5 13h.5M10.5 17l1.5 1 1.5-1"/>',
  seher: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  hexe: '<path d="M9 3h6M10 3v5l-5 9a3 3 0 0 0 3 4h8a3 3 0 0 0 3-4l-5-9V3M7.5 14h9"/>',
  amor: '<path d="M12 20s-7-4.4-7-9.5A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 7 2.500C19 15.600 12 20 12 20zM3 3l7 7M3 3h4M3 3v4"/>',
  jaeger: '<path d="M5 3c9 2 14 7 16 16M5 3l16 16M5 3v6M5 3h6"/>',
};
const ROLE_NAMES = { dorf: ['Dorfbewohner', 'Villager'], wolf: ['Werwolf', 'Werewolf'], seher: ['Seherin', 'Seer'], hexe: ['Hexe', 'Witch'], amor: ['Amor', 'Cupid'], jaeger: ['Jäger', 'Hunter'] };
export const sky = (stage) => (stage === 'night' ? 'nacht' : stage === 'day' || stage === 'vote' || stage === 'hunter' ? 'tag' : null);
/** Neu Gestorbene zwischen zwei bestätigten Zuständen. */
export const fallen = (before, after) => (after || []).filter((d) => !(before || []).some((o) => o.id === d.id));
/** Wer hat gewonnen? `dorf`, `wolf` oder `liebende` – nur am bestätigten Spielende. */
export const victor = (view) => (view?.phase === 'over' && view.g?.winner ? view.g.winner : null);
const name = (view, id) => view.players.find((p) => p.id === id)?.name || '?';

function scenery(x, stage) {
  const village = x.$('.ww-village'); if (!village) return null;
  village.dataset.xpSky = sky(stage) || 'nacht';
  let box = village.querySelector(':scope > .xp-ww-sky');
  if (!box) { box = document.createElement('div'); box.className = 'xp-ww-sky'; box.setAttribute('aria-hidden', 'true'); box.innerHTML = '<i class="xp-ww-veil"></i><i class="xp-ww-orb"></i>'; village.prepend(box); }
  return box;
}

export default {
  palette: 'werwolf',
  winner: { colors: ['#ffd98a', '#b3c4e8', '#8a2f2b'], shape: 'leaf', palette: 'werwolf', winEvent: 'win' },
  select: '.ww-target',
  key: (view) => [view.phase, view.roundNo, view.g?.stage, view.g?.day, view.g?.deaths?.length, view.g?.voted, view.g?.todo?.type, view.g?.winner, !!view.gamePaused].join(':'),
  finale: (view, prev) => (victor(view) && prev.phase === 'playing' ? 2300 : 0),
  still(view, x) {
    const g = view.g; if (!g?.stage) return;
    scenery(x, g.stage);
    // Rollenkarte als Holztafel mit eigenem Zeichen.
    const card = x.$('.ww-role');
    if (card && g.role && GLYPHS[g.role] && !card.querySelector('.xp-ww-glyph')) card.insertAdjacentHTML('afterbegin', svg(GLYPHS[g.role]));
  },
  change(view, prev, x) {
    const g = view.g, pg = prev.g || {}; if (!g) return;
    const group = [];
    // Dämmerung: Der alte Himmel blendet aus, Mond oder Sonne steigt auf.
    const now = sky(g.stage), before = sky(pg.stage);
    if (now && now !== before) {
      x.play(now === 'nacht' ? 'night' : 'rooster', { after: before ? 200 : 0 });
      const box = scenery(x, g.stage), veil = box?.querySelector('.xp-ww-veil'), orb = box?.querySelector('.xp-ww-orb');
      if (veil && before) { veil.dataset.from = before; group.push(x.plans.frames(veil, [{ opacity: 1 }, { opacity: 0 }], { duration: 1100 })); }
      if (orb) group.push(x.plans.frames(orb, [{ transform: 'translateY(90px) scale(.7)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 1100 }));
    }
    if (g.stage === 'vote' && pg.stage !== 'vote') x.play('murmur', { after: 120 });
    else if (g.stage === 'vote' && g.voted > (pg.voted || 0)) x.play('vote');
    // Ausscheiden: Die Holztafel des Spielers dreht sich um und zeigt die Rolle (nur wenn der Server sie nennt).
    const dead = prev.g ? fallen(pg.deaths, g.deaths) : [];
    if (dead.length) {
      const executed = g.lastVote && g.lastVote.day !== pg.lastVote?.day && dead.some((d) => d.id === g.lastVote.executed);
      x.play(executed ? 'gong' : 'death', { after: 120 });
      const box = x.layer, shown = dead.slice(0, 3);
      shown.forEach((d, n) => {
        if (!box) return;
        const el = document.createElement('div'); el.className = 'xp-ww-card';
        el.style.setProperty('--n', String(n - (shown.length - 1) / 2));
        const role = d.role && ROLE_NAMES[d.role] ? t(...ROLE_NAMES[d.role]) : t('ausgeschieden', 'eliminated');
        const label = document.createElement('b'); label.textContent = name(view, d.id); el.append(label);
        box.append(el);
        const delay = 350 + n * 160;
        // Halbe Drehung bis zur Kante, Beschriftung wechseln, zurückdrehen.
        group.push(x.plans.frames(el, [{ transform: 'translateY(24px) scaleX(1)', opacity: 0 }, { transform: 'scaleX(1)', opacity: 1, offset: 0.18 }, { transform: 'scaleX(1)', opacity: 1, offset: 0.4 }, { transform: 'scaleX(0)', opacity: 1, offset: 0.5 }, { transform: 'scaleX(1)', opacity: 1, offset: 0.6 }, { transform: 'scaleX(1)', opacity: 1, offset: 0.9 }, { transform: 'translateY(-12px)', opacity: 0 }], { duration: 2600, delay }));
        const turn = () => { el.classList.add('is-turned'); label.textContent = role; if (d.role && GLYPHS[d.role]) el.insertAdjacentHTML('afterbegin', svg(GLYPHS[d.role])); const who = document.createElement('small'); who.textContent = name(view, d.id); el.append(who); };
        if (x.animated) { x.later(turn, delay + 1300); x.play('flip', { after: delay + 1250 }); } else { turn(); x.play('flip'); }
        x.later(() => el.remove(), x.animated ? delay + 2650 : 2200);
      });
    }
    // Spielende: Vollmond geht auf (Werwölfe) oder die Sonne siegt (Dorf, Verliebte) – mit eigenem Schluss-Akkord.
    const won = victor(view);
    if (won && prev.phase === 'playing') {
      const wolves = won === 'wolf';
      x.highlight(wolves ? 'vollmond' : 'sonne', 2500);
      x.play(wolves ? 'end' : 'highlight');
      const el = x.plaque(wolves ? t('Die Werwölfe gewinnen', 'The werewolves win') : won === 'liebende' ? t('Die Verliebten gewinnen', 'The lovers win') : t('Das Dorf gewinnt', 'The village wins'), { ms: 2500, material: null, cls: `xp-ww-finale ${wolves ? 'is-moon' : 'is-sun'}` });
      if (el) { const orb = document.createElement('i'); orb.className = 'xp-ww-big'; el.prepend(orb); group.push(x.plans.frames(orb, [{ transform: 'translateY(160px) scale(.5)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 1500 })); }
    }
    if (group.length) x.run(group);
  },
};
