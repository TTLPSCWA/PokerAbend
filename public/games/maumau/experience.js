// EXP-003 Mau-Mau: Küchentisch mit Wachstuch, Kaffeetasse und Brotkorb. Die 7er-Kette zählt sichtbar hoch,
// die 8 lässt den nächsten Platz kurz „einschlafen“, bei „Mau“ klirrt der Löffel an der Tasse.
// Highlight „Mau-Mau!“: Die Tasse hüpft, Kaffee schwappt, der Gewinner bekommt einen Herz-Stempel.
// Geheimnisse: Fremde Karten fliegen nur als Kartenrücken; die Werte kennt diese Ansicht gar nicht.
import { shedEvents, skipped, seatOf, flyBacks, fanIn, handKeys } from '/games/shedding-events.js';
const t = (de, en) => (globalThis.I18n?.language === 'en' ? en : de);
// Eigene Zeichnungen: Tasse mit Löffel und Brotkorb.
const CUP = '<svg viewBox="0 0 64 56" aria-hidden="true"><ellipse cx="28" cy="50" rx="24" ry="5" fill="#00000030"/><path d="M8 18h40v12c0 11-9 18-20 18S8 41 8 30z" fill="#f6efe0" stroke="#3a2a1a" stroke-width="2.500"/><path d="M48 22h5a7 7 0 0 1 0 14h-6" fill="none" stroke="#3a2a1a" stroke-width="2.500"/><ellipse class="xp-mm-coffee" cx="28" cy="19" rx="18" ry="4.500" fill="#5a3418"/><path d="M38 17 56 4" stroke="#c9ccd1" stroke-width="3" stroke-linecap="round"/><path class="xp-mm-drop" d="M14 9c3 4 3 6 0 8-3-2-3-4 0-8zM30 4c3 4 3 6 0 8-3-2-3-4 0-8z" fill="#5a3418"/></svg>';
const BASKET = '<svg viewBox="0 0 80 52" aria-hidden="true"><ellipse cx="40" cy="47" rx="34" ry="4" fill="#00000030"/><ellipse cx="30" cy="20" rx="17" ry="11" fill="#d9a55b" stroke="#6b4320" stroke-width="2"/><ellipse cx="52" cy="22" rx="15" ry="10" fill="#c98f45" stroke="#6b4320" stroke-width="2"/><path d="M24 16l5 4M33 14l5 4M48 18l5 4" stroke="#6b4320" stroke-width="1.800" stroke-linecap="round"/><path d="M8 24h64l-7 22H15z" fill="#a8733a" stroke="#6b4320" stroke-width="2.500" stroke-linejoin="round"/><path d="M12 32h56M14 39h52M24 24l3 22M40 24v22M56 24l-3 22" stroke="#6b432088" stroke-width="1.800"/></svg>';
let known = new Set();
const winnerOf = (view) => (view?.phase === 'over' ? view.result?.winners?.[0] ?? null : null);
export const mauMau = (view, prev) => !!winnerOf(view) && prev?.phase === 'playing';

function props(x) {
  const table = x.$('.kg-table'); if (!table || table.querySelector(':scope > .xp-mm-props')) return;
  table.insertAdjacentHTML('beforeend', `<div class="xp-mm-props" aria-hidden="true"><span class="xp-mm-basket">${BASKET}</span><span class="xp-mm-cup">${CUP}</span></div>`);
}

export default {
  palette: 'maumau',
  winner: { colors: ['#e9d6a1', '#c0392b', '#f6efe0'], shape: 'paper', palette: 'maumau', winEvent: 'win' },
  key: (view) => [view.phase, view.roundNo, view.turnId, view.dir, view.g?.top, view.g?.wish, view.g?.pending, (view.players || []).map((p) => p.cards).join(','), !!view.gamePaused].join(':'),
  finale: (view, prev) => (mauMau(view, prev) ? 1900 : 0),
  still(view, x) { known = handKeys(x); props(x); },
  change(view, prev, x) {
    const before = known, group = [], deck = x.$('.kg-piles .kg-pile'), cup = x.$('.xp-mm-cup');
    known = handKeys(x);
    for (const el of x.root.querySelectorAll('.xp-mm-count')) el.remove();
    if (mauMau(view, prev)) {
      // Highlight: Doppelklirr, die Tasse hüpft, Kaffee schwappt, Herz-Stempel für den Gewinner.
      const id = winnerOf(view), name = view.players.find((p) => p.id === id)?.name || '';
      x.play('maumau'); x.play('highlight', { after: 420 });
      x.highlight('maumau', 2100);
      if (cup) { group.push(x.plans.frames(cup, [{ transform: 'none' }, { transform: 'translateY(-26px) rotate(-10deg)', offset: 0.25 }, { transform: 'translateY(0) rotate(4deg)', offset: 0.5 }, { transform: 'translateY(-10px) rotate(-3deg)', offset: 0.68 }, { transform: 'none' }], { duration: 900 })); const drop = cup.querySelector('.xp-mm-drop'); if (drop) group.push(x.plans.frames(drop, [{ transform: 'translateY(8px)', opacity: 0 }, { transform: 'translateY(-10px)', opacity: 1, offset: 0.4 }, { transform: 'translateY(6px)', opacity: 0 }], { duration: 800, delay: 160 })); }
      x.later(() => x.plaque(`♥ ${t('Mau-Mau!', 'Mau-Mau!')} ${name}`.trim(), { ms: 1900, material: null, cls: 'xp-mm-stamp' }), x.animated ? 380 : 0);
      if (group.length) x.run(group);
      return;
    }
    if (view.roundNo !== prev.roundNo || prev.phase !== 'playing') { if (view.phase === 'playing') { x.play('deal'); group.push(...fanIn(x, new Set(), deck)); } if (group.length) x.run(group); return; }
    const events = shedEvents(prev, view), play = events.find((e) => e.type === 'play');
    if (play) {
      x.play('card');
      const top = x.$('.kg-discard .kc'); if (top) group.push(x.plans.frames(top, [{ transform: 'translateY(-10px) rotate(-5deg)' }, { transform: 'none' }], { duration: 200 }));
      // Die 8: Der nächste Platz „schläft“ kurz ein.
      if (play.card[0] === '8') { const out = skipped(prev, view); if (out) { x.play('sleep', { after: 120 }); const seat = seatOf(x, out); if (seat) { x.highlight('schlaf', 1500, seat); x.plaque('z z z', { anchor: seat, ms: 1400, material: null, cls: 'xp-mm-sleep' }); } } }
    }
    for (const e of events) {
      if (e.type === 'draw') {
        for (let k = 0; k < Math.min(e.n, 4); k++) x.play('draw', { after: k * 120 });
        if (e.id === view.you?.id) group.push(...fanIn(x, before, deck)); else group.push(...flyBacks(x, deck, seatOf(x, e.id), e.n, { cls: 'xp-mm-back' }));
      } else if (e.type === 'chain') {
        // 7er-Kette: Der Zähler über der Ablage zählt mit jeder 7 hoch.
        x.play('seven', { after: 90 }); if (e.stacked) x.play('seven', { after: 210 });
        x.highlight('kette', 1200, x.$('.kg-piles'));
        x.plaque(`+${e.total}`, { anchor: x.$('.kg-discard'), ms: 1300, material: null, cls: `xp-mm-count${e.stacked ? ' is-stacked' : ''}` });
      } else if (e.type === 'wish') x.play('wish', { after: 140 });
      else if (e.type === 'last') {
        // „Mau“: Der Löffel klirrt an der Tasse.
        x.play('mau', { after: 220 });
        if (cup) group.push(x.plans.frames(cup, [{ transform: 'none' }, { transform: 'rotate(-7deg)', offset: 0.3 }, { transform: 'rotate(5deg)', offset: 0.6 }, { transform: 'none' }], { duration: 380, delay: 200 }));
      }
    }
    if (group.length) x.run(group);
  },
};
