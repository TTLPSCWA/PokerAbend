// EXP-088 Schach: Schachcafé. Figuren gleiten, Rochade bewegt König und Turm gemeinsam,
// Schach läutet leise, die Uhr tickt in den letzten 10 Sekunden, beim Matt kippt der König um.
const square = (i) => 'abcdefgh'[i % 8] + (8 - Math.floor(i / 8));
const TIPPED = 'translate(10%, 8%) rotate(82deg)';
const mate = (view) => view.phase === 'over' && view.g?.reason === 'checkmate';
const matedKing = (g) => { const i = g.board.indexOf(g.position.fen.split(' ')[1] + 'k'); return i < 0 ? null : square(i); };
// Die Live-Stellung ist zu sehen (nicht ein früherer Zug aus dem Protokoll).
const live = (x) => !x.$('.ch-history button') || !!x.$('.ch-history button:last-child.on');

// Welche Figuren haben sich zwischen zwei bestätigten Stellungen bewegt? (auch Rochade, en passant, Umwandlung, Chess960)
export function moves(before, after) {
  const gone = [], came = [];
  for (let i = 0; i < 64; i++) if (before[i] !== after[i]) { if (before[i]) gone.push({ i, p: before[i] }); if (after[i]) came.push({ i, p: after[i] }); }
  return came.map((c) => {
    const from = gone.find((g) => !g.used && g.p === c.p) || gone.find((g) => !g.used && g.p === c.p[0] + 'p');
    if (!from) return null;
    from.used = true;
    return { from: square(from.i), to: square(c.i) };
  }).filter(Boolean);
}
let lastTick = null;

export default {
  palette: 'schach',
  winner: { colors: ['#d9b875', '#f7edcf', '#795536'], shape: 'paper', palette: 'schach', winEvent: 'win' },
  select: '.ch-cell[data-drag]',
  key: (view) => [view.phase, view.roundNo, view.g?.key, view.g?.revision, view.g?.reason, view.g?.check, !!view.gamePaused].join(':'),
  finale: (view, prev) => (mate(view) && prev.phase === 'playing' ? 1900 : 0),
  still(view, x) {
    const board = x.$('.ch-board'); if (!board || !view.g) return;
    const over = mate(view) && live(x), king = over ? matedKing(view.g) : null;
    board.classList.toggle('xp-matt', !!king);
    if (king) for (const sq of [king, view.g.last?.to]) x.$(`.ch-cell[data-square="${sq}"]`)?.classList.add(sq === king ? 'xp-mated' : 'xp-mating');
    else if (view.g.check && view.phase === 'playing' && live(x)) {
      const i = view.g.board.indexOf(view.g.position.fen.split(' ')[1] + 'k');
      if (i >= 0) x.$(`.ch-cell[data-square="${square(i)}"]`)?.classList.add('xp-check');
    }
  },
  change(view, prev, x) {
    const g = view.g, pg = prev.g; if (!g || !pg) return;
    if (g.key !== pg.key) {
      // Neue Partie: Figuren werden reihenweise aufgestellt.
      x.play('piece'); x.play('piece', { after: 140 });
      x.run(x.$$('.ch-piece').slice(0, 32).map((el, n) => x.plans.frames(el, [{ transform: 'translateY(-14px) scale(.9)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 240, delay: (n % 16) * 18 })));
      return;
    }
    if (g.history.length !== pg.history.length + 1 || !live(x)) return;
    const san = g.history.at(-1).san || '', moved = moves(pg.board, g.board);
    if (san.includes('x')) { x.play('capture'); x.play('piece', { after: 90 }); }
    else { x.play('piece'); if (moved.length > 1) x.play('piece', { after: 110 }); }
    if (san.includes('=')) x.play('promote', { after: 160 });
    // Rochade: König und Turm in einer gemeinsamen Bewegung.
    x.run(moved.map(({ from, to }) => {
      const el = x.$(`.ch-cell[data-square="${to}"] .ch-piece`), origin = x.$(`.ch-cell[data-square="${from}"]`);
      return el && origin ? x.plans.glide(el, origin, { duration: 260 }) : null;
    }));
    if (mate(view)) {
      x.highlight('matt', 1900, x.$('.ch-board'));
      x.play('highlight', { after: 260 });
      const king = x.$('.ch-cell.xp-mated .ch-piece');
      // Der König kippt langsam um; der Endzustand (liegend) steht bereits als Klasse fest.
      if (king) x.run((m) => ({ el: king, final: m.base(king).inline, duration: 1100, frames: [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-9deg)', offset: 0.3 }, { transform: TIPPED }] }));
    } else if (g.check) { x.play('check', { after: 200 }); x.highlight('schach', 900, x.$('.ch-board')); }
  },
  // Uhr: tickt in den letzten 10 Sekunden einmal pro Sekunde, die laufende Uhr wird markiert.
  interval: { ms: 250, run(view, x) {
    const g = view.g; if (!g || g.clockMode === 'none' || !g.running) return;
    const ms = g.clocks[g.running] - Math.max(0, gameNow(view) - g.clockStamp), seconds = Math.ceil(ms / 1000);
    const low = seconds > 0 && seconds <= 10;
    x.$(`[data-ch-clock="${g.running}"]`)?.classList.toggle('xp-low', low);
    if (!low) { lastTick = null; return; }
    const key = g.key + ':' + g.revision + ':' + seconds;
    if (key !== lastTick) { lastTick = key; x.play('tick'); }
  } },
};
