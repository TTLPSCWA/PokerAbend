// Pfeilfieber im Browser (Regeln, Prüfung und Wertung: public/games/pfeilfieber/logic.js). Pfeilfolgen nachtippen – Tasten, Knöpfe oder Wischen.
'use strict';
{
  const kit = soloGame({
    id: 'pfeilfieber',
    name: 'Pfeilfieber',
    terms: { waitWrite: 'tippt …' },
    intro: [
      ['Ziel', 'Tipp die Pfeilfolgen so schnell und fehlerfrei nach, wie du kannst – so viele wie möglich in der Zeit.'],
      ['Steuern', 'Pfeiltasten am Computer, am Handy die vier Pfeil-Knöpfe.'],
      ['Fehler', 'Ein Fehler setzt die Folge zurück und sperrt dich kurz.'],
    ],
    short: [
      'Eine Folge von Pfeilen erscheint – für alle gleich.',
      'Tipp die Pfeile in derselben Reihenfolge nach (Pfeiltasten oder Knöpfe).',
      'Ein Fehler setzt die Folge zurück und kostet Zeit.',
      'Wer in der Zeit die meisten Folgen schafft, gewinnt. Der Server prüft alle Eingaben.',
    ],
    rules: `<p>Eine Folge von Pfeilen (hoch, runter, links, rechts) erscheint – bei allen dieselbe, in derselben Reihenfolge.</p>
      <ul>
        <li>Tipp die Pfeile in der gleichen Reihenfolge nach: <b>Pfeiltasten</b> oder die Knöpfe auf dem Bildschirm.</li>
        <li>Eine geschaffte Folge gibt <b>10 Punkte</b>. Ein <b>Fehler</b> setzt die Folge zurück, sperrt dich eine halbe Sekunde und kostet 2 Punkte.</li>
        <li>Die Folgen werden länger, je mehr du schaffst (bis 8 Pfeile).</li>
        <li>Die Zeit läuft für alle gleich; danach schickt dein Gerät alle Eingaben mit Zeitstempeln, und der Server spielt sie nach. Unmöglich schnelle Eingaben zählen nicht.</li>
        <li>Hausregeln: Rückwärts-Modus (es zählt der entgegengesetzte Pfeil), mehr Pfeile pro Folge je Runde.</li>
      </ul>`,
    timed: true,
    sig(c) { return `${Math.floor(c.t / 100)}|${(c.local.inputs || []).length}`; },
    state(c) {
      const o = c.G.options || {};
      return c.L.replay(c.round.seed, c.local.inputs || [], { playMs: c.round.playMs, level: c.round.level, reverse: !!c.S.settings.reverse, grow: !!c.S.settings.grow });
    },
    render(c) {
      const st = this.state(c);
      const left = Math.max(0, Math.ceil((c.round.playMs - c.t) / 1000));
      const locked = c.t < st.lockUntil;
      const rev = !!c.S.settings.reverse;
      const seq = st.seq.map((a, k) => `<i class="${k < st.pos ? 'done' : ''} ${k === st.pos ? 'now' : ''}" aria-hidden="true">${c.L.ARROWS[rev ? a ^ 1 : a]}</i>`).join('');
      const btns = c.L.ARROWS.map((a, k) => `<button type="button" class="pf-btn" data-pf="${k}" ${locked ? 'disabled' : ''} aria-label="${['Hoch', 'Runter', 'Links', 'Rechts'][k]}">${a}</button>`).join('');
      return `<div class="pf-wrap"><div class="so-bar" role="progressbar" aria-label="Zeit" aria-valuemin="0" aria-valuemax="${Math.round(c.round.playMs / 1000)}" aria-valuenow="${left}"><i style="width:${Math.max(0, 100 - (c.t / c.round.playMs) * 100)}%"></i></div>
        <div class="pf-info"><b class="so-score">${st.completed} Folge${st.completed === 1 ? '' : 'n'}</b><span>${st.errors} Fehler</span><span>${left} s</span></div>
        <div class="pf-seq ${locked ? 'locked' : ''}" role="status" aria-label="Folge ${rev ? '(Pfeile umkehren)' : ''}">${seq}</div>
        <div class="so-btns pf-pad">${btns}</div>${rev ? '<small>Rückwärts-Modus: tipp jeweils den entgegengesetzten Pfeil</small>' : ''}</div>`;
    },
    hint: () => 'Tipp die Pfeile nach – Pfeiltasten oder Knöpfe',
    press(c, tok) {
      const inputs = c.local.inputs ||= [];
      if (c.t >= c.round.playMs) return;
      inputs.push([tok, Math.round(c.t)]);
      c.refresh();
    },
    onKey(e, c) {
      const k = { ArrowUp: 0, ArrowDown: 1, ArrowLeft: 2, ArrowRight: 3 }[e.key];
      if (k === undefined) return;
      e.preventDefault();
      this.press(c, k);
    },
    payload: (c) => ({ inputs: c.local.inputs || [] }),
    solution: (sol) => `<div class="sm-answer" role="status"><small>Die erste Folge war</small><b class="pf-first">${sol.first.map((a) => ['↑', '↓', '←', '→'][a]).join(' ')}</b></div>`,
  });
  // Knöpfe reagieren sofort beim Drücken (nicht erst beim Loslassen)
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest?.('.pf-btn');
    if (!b || session?.game !== 'pfeilfieber') return;
    const c = kit.ctx();
    if (!c.round || !c.canPlay) return;
    e.preventDefault();
    const inputs = c.local.inputs ||= [];
    if (c.t < c.round.playMs) { inputs.push([Number(b.dataset.pf), Math.round(c.t)]); c.refresh(); }
  });
}
