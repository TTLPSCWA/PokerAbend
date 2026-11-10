// EXP-002 Texas Hold'em: Privater Salon. Klang (EXP-F1) und Bewegung (EXP-F2) zu Zuständen, die der Server bestätigt hat.
// Karten kommen vom Dealer-Button, Flop/Turn/River drehen sich einzeln um, beim All-in-Showdown wird das Licht kurz dunkler
// und die Gewinnhand leuchtet in Messing. Chips zur Mitte und der Pot zum Gewinner bleiben wie bisher (poker-chips.js).
// Geheimnisse: Es wird nur gezeigt, was diese Ansicht bekommen hat; verdeckte Karten bleiben Kartenrücken.
import Motion from '/motion/motion.js';

const GAME = 'poker';
const seats = (S) => S?.seats || [];
const live = (h) => !!h && !h.done;
/** Was haben die Spieler zwischen zwei bestätigten Zuständen getan? Ein Eintrag je Platz. */
export function actions(a, b) {
  if (!a?.hand || !b?.hand || a.hand.no !== b.hand.no || a.hand.done) return [];
  const list = [];
  seats(b).forEach((s, i) => {
    const p = seats(a)[i]; if (!s || !p || p.id !== s.id) return;
    if (s.folded && !p.folded) list.push({ seat: i, type: 'fold' });
    else if (s.allIn && !p.allIn) list.push({ seat: i, type: 'allin' });
    // Einsatz am Stack ablesen: Schließt ein Call die Setzrunde, liegt der Einsatz im nächsten Zustand schon im Pot.
    else if ((s.bet || 0) > (p.bet || 0) || (s.stack ?? 0) < (p.stack ?? 0)) list.push({ seat: i, type: 'chips' });
    // Wer am Zug war und weder gesetzt noch gefoldet hat, hat gecheckt.
    else if (a.hand.toAct === i && (b.hand.toAct !== i || b.hand.street !== a.hand.street || b.hand.done)) list.push({ seat: i, type: 'check' });
  });
  return list;
}
/** Neue Gemeinschaftskarten in dieser Hand (Indizes). */
export function boardNew(a, b) {
  const before = a?.hand?.no === b?.hand?.no ? a.hand.board?.length || 0 : 0, now = b?.hand?.board?.length || 0;
  return Array.from({ length: Math.max(0, now - before) }, (_, k) => before + k);
}
const anyAllIn = (a, b) => seats(a).some((s) => s?.allIn) || seats(b).some((s) => s?.allIn);
/** Niemand kann mehr handeln, die restlichen Karten laufen aus (All-in vor dem River). Am Handende setzt der Server die All-in-Marken
 *  schon zurück; neue Gemeinschaftskarten im selben Zustand wie das Handende gibt es aber nur nach einem All-in. */
export const runout = (a, b) => boardNew(a, b).length > 0 && (!!b.hand.done || (anyAllIn(a, b) && !(b.hand.toAct >= 0)));
/** All-in-Showdown: Die Hand endet mit aufgedeckter Gewinnhand nach einem All-in. */
export const showdown = (a, b) => !!b?.hand?.done && !!a?.hand && !a.hand.done && a.hand.no === b.hand.no && (anyAllIn(a, b) || boardNew(a, b).length > 0) && !!b.hand.result?.pots?.some((p) => p.cards?.length);

const host = globalThis, $ = (q) => host.document.querySelector(q), $$ = (q) => Array.from(host.document.querySelectorAll(q));
const game = () => (typeof session === 'undefined' ? null : session?.game);
let code = null, motion = null, timers = new Set(), shown = null;
const table = () => { if (!motion || motion.disposed) motion = Motion.table('xp:poker:' + code, { root: $('#game') || host.document.body }); return motion; };
const play = (event, after = 0) => {
  if (!after) return host.Sound?.play(event);
  const token = code, timer = host.setTimeout(() => { timers.delete(timer); if (token === code && game() === GAME) host.Sound?.play(event); }, after);
  timers.add(timer);
};
const settle = () => { for (const timer of timers) host.clearTimeout(timer); timers.clear(); const g = $('#game'); if (g?.dataset.xp === 'showdown') delete g.dataset.xp; };
const centre = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };

const experience = {
  /** Gilt nur für Texas Hold'em; die übrigen Poker-Varianten behalten ihre bisherigen Töne. */
  active() {
    const on = game() === GAME, root = $('#game');
    if (root) root.toggleAttribute('data-xp-poker', on);
    if (!on && code !== null) { settle(); code = null; shown = null; } // anderer Tisch: beim nächsten Hold'em-Tisch Palette neu setzen
    return on;
  },
  enter(S) {
    if (!this.active()) return false;
    if (!host.document.querySelector('link[data-xp-css="poker"]')) { const link = host.document.createElement('link'); link.rel = 'stylesheet'; link.href = '/games/poker/experience.css'; link.dataset.xpCss = 'poker'; host.document.head.append(link); }
    if (S?.code && S.code !== code) { settle(); if (motion) Motion.release('xp:poker:' + code); motion = null; code = S.code; shown = null; host.Sound?.use(GAME); table().update(S, () => {}); /* der erste Zustand ist die Ausgangslage: keine Bewegung */ }
    return true;
  },
  turn() { return host.Sound?.play('turn'); },
  /** Töne zu einem frischen, bestätigten Zustandswechsel. `mine` ist der eigene Platz. */
  sounds(a, b, { mine, big } = {}) {
    if (!b?.hand || !a) return; // ohne vorigen Zustand (Neuladen, Beitritt) bleibt es still
    if (a.hand?.no !== b.hand.no) {
      settle(); // neue Hand: geplante Töne der alten verfallen
      if (!live(b.hand)) return; play('shuffle'); play('deal', 260); play('deal', 380); if (seats(b).some((s) => s?.bet > 0)) play('chips', 520); return;
    }
    const slow = runout(a, b);
    boardNew(a, b).forEach((_, k) => play('card', (slow ? 650 : 140) * k + (slow ? 200 : 0)));
    const acts = actions(a, b);
    // Ein Ton je Zustand: das Auffälligste gewinnt.
    const type = ['allin', 'chips', 'fold', 'check'].find((t) => acts.some((x) => x.type === t));
    if (type) play(type);
    if (live(a.hand) && live(b.hand) && a.hand.street !== b.hand.street) play('collect', 120);
    if (b.hand.done && !a.hand.done) {
      const won = b.hand.result?.pots?.some((p) => p.winners.includes(mine)), wait = slow ? 650 * boardNew(a, b).length + 300 : 420;
      play('collect', wait);
      if (showdown(a, b)) play('highlight', wait + 200); else if (won) play(big ? 'highlight' : 'win', wait + 200);
    }
  },
  /** Bewegungen nach dem Zeichnen des bestätigten Zustands. */
  motion(a, b) {
    if (!b?.hand || !a) return;
    const m = table();
    // Derselbe Darstellungsstand noch einmal (der Server schickt z. B. den Handbeginn doppelt): Der Tisch wurde neu gezeichnet,
    // deshalb läuft eine gerade begonnene Bewegung auf den neuen Elementen noch einmal an, statt abzubrechen.
    const news = a.hand?.no !== b.hand.no || boardNew(a, b).length > 0 || showdown(a, b);
    if (!news && shown && shown.b.hand?.no === b.hand.no && host.performance.now() - shown.at < 700) a = shown.a;
    else shown = { a, b, at: host.performance.now() };
    m.finish();
    m.update(b, () => this.animate(a, b, m), { spectator: false, paused: !!b.frozen });
  },
  animate(a, b, m) {
    const plans = [];
    // Neue Hand: Die Karten kommen vom Dealer-Button, reihum mit kleinem Abstand.
    if (a.hand?.no !== b.hand.no && live(b.hand)) {
      const dealer = $('#dealer'), from = dealer && !dealer.hidden ? centre(dealer) : null;
      if (from) [...$$('#seats .seat-cards .card'), ...$$('#dock .cards .card')].filter((el) => el.offsetParent).slice(0, 24).forEach((el, n) => {
        const to = centre(el);
        plans.push(() => { const base = m.base(el); return { el, final: base.inline, duration: 300, delay: 240 + n * 55, frames: [{ transform: `translate(${from.x - to.x}px, ${from.y - to.y}px) rotate(-14deg) scale(.6) ${base.transform}`.trim(), opacity: 0 }, { opacity: 1, offset: 0.25 }, { transform: base.transform || 'none', opacity: 1 }] }; });
      });
    }
    // Flop, Turn und River drehen sich einzeln um; läuft das Board nach einem All-in aus, deutlich langsamer.
    const fresh = boardNew(a, b), slow = runout(a, b), cards = $$('#board .card');
    fresh.forEach((index, k) => { const el = cards[index]; if (el) { el.style.animationDelay = `${(slow ? 650 : 140) * k + (slow ? 200 : 0)}ms`; if (slow) el.classList.add('xp-slow'); } });
    // Highlight: All-in-Showdown – das Licht wird kurz dunkler, die Gewinnhand leuchtet in Messing.
    if (showdown(a, b)) {
      const root = $('#game'), wrap = $('.table-wrap');
      if (root && wrap) {
        root.dataset.xp = 'showdown';
        let dim = wrap.querySelector(':scope > .xp-pk-dim');
        if (!dim) { dim = host.document.createElement('div'); dim.className = 'xp-pk-dim'; dim.setAttribute('aria-hidden', 'true'); wrap.append(dim); }
        plans.push(() => ({ el: dim, final: m.base(dim).inline, duration: 2600, frames: [{ opacity: 0 }, { opacity: 1, offset: 0.18 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }] }));
        const token = code, timer = host.setTimeout(() => { timers.delete(timer); if (token === code && root.dataset.xp === 'showdown') delete root.dataset.xp; }, 2700);
        timers.add(timer);
      }
    }
    if (plans.length) m.enqueue(() => plans.map((build) => build()).filter((plan) => plan.el?.isConnected));
  },
  /** Für Messungen und Tests: die zuletzt gezeigte Änderung ohne Ton noch einmal abspielen (nur Darstellung). */
  replay() { if (!shown) return false; const m = table(), b = typeof lastState === 'undefined' ? shown.b : lastState || shown.b; m.finish(); m.update(b, () => this.animate(shown.a, shown.b, m), { spectator: false, paused: false }); return true; },
  /** Für Tests: einen Wechsel a → b auf dem aktuellen Tisch zeigen (Ton und Bewegung, nur Darstellung). */
  present(a, b, context = {}) { this.sounds(a, b, context); this.motion(a, b); return true; },
  leave() { settle(); $('#game')?.removeAttribute('data-xp-poker'); },
};
(host.__experiences ||= {}).poker = experience; // gleiche Messschnittstelle wie die kit-Spiele (replay)
export default experience;
