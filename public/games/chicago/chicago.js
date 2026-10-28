// Chicago im Browser (Regeln: games/chicago/room.js). Einfach würfeln: Trifft die Summe die Zielzahl der Runde, gibt es diese Punkte.
'use strict';
{
  const nameOf = (S, id) => esc(S.players.find((p) => p.id === id)?.name ?? '?');
  const pair = (d, cls = '') => `<span class="ch-pair">${d.map((x) => dieHTML(x, { cls })).join('')}</span>`;

  const kit = kitGame({
    id: 'chicago',
    name: 'Chicago',
    direction: false,
    intro: [
      ['Ziel', 'Sammle die meisten Punkte in elf Runden.'],
      ['Würfeln', 'Jeder würfelt pro Runde einmal mit zwei Würfeln. Zielzahl in Runde 1 ist 2, dann 3 … bis 12.'],
      ['Treffer', 'Ergibt die Augensumme genau die Zielzahl, bekommst du diese Zahl als Punkte.'],
    ],
    short: [
      'Elf Runden mit den Zielzahlen 2 bis 12 (in dieser Reihenfolge).',
      'Reihum würfelt jeder einmal mit zwei Würfeln.',
      'Summe = Zielzahl: Du bekommst die Zielzahl als Punkte.',
      'Nach Runde 11 gewinnt, wer die meisten Punkte hat. Bei Gleichstand gibt es ein Stechen.',
    ],
    house: () => [],
    playerInfo: (p) => (p.chicago === undefined ? '' : `${p.chicago} Punkte`),
    seat: (p, S) => `<span>${p.chicago ?? 0} Punkte</span>${S.g?.rolled?.[p.id] ? pair(S.g.rolled[p.id], 'small') : ''}`,
    sounds(S, prev) { return S.g && prev.g && JSON.stringify(S.g.rolled) !== JSON.stringify(prev.g.rolled) && Object.keys(S.g.rolled).length ? 'dice' : null; },
    hint(S, myTurn) {
      const g = S.g;
      if (g.stage === 'tie') return myTurn ? 'Stechen: würfle – die höhere Summe gewinnt' : `Stechen – ${nameOf(S, S.turnId)} würfelt`;
      return myTurn ? `Würfle: Ziel ist die ${g.target}` : `${nameOf(S, S.turnId)} ist dran`;
    },
    main(S) {
      const g = S.g;
      const head = g.stage === 'tie'
        ? `<div class="ch-target"><small>Stechen</small><b>Höhere Summe gewinnt</b></div>`
        : `<div class="ch-target"><small>Runde ${g.round} von ${g.rounds}</small><b>Zielzahl ${g.target}</b></div>`;
      const rows = S.players.filter((p) => p.inRound).map((p) => {
        const d = g.rolled[p.id];
        const hit = d && g.stage === 'main' && d[0] + d[1] === g.target;
        return `<li class="${hit ? 'hit' : ''}"><b>${esc(p.name)}</b><span>${d ? pair(d, 'small') : '<i>–</i>'}</span><span>${d ? d[0] + d[1] : ''}</span><b>${g.points[p.id] ?? 0}</b></li>`;
      }).join('');
      const hist = g.history.length ? `<details class="ch-hist"><summary>Frühere Runden</summary><ol>${g.history.slice().reverse().map((h) => `<li><b>Ziel ${h.target}</b> ${Object.entries(h.rolls).map(([id, d]) => `${nameOf(S, id)} ${d[0] + d[1]}${d[0] + d[1] === h.target ? ' ✓' : ''}`).join(' · ')}</li>`).join('')}</ol></details>` : '';
      return `<div class="kg-table ch-wrap">${head}<ul class="ch-list" aria-label="Würfe dieser Runde"><li class="head"><span>Spieler</span><span>Wurf</span><span>Summe</span><span>Punkte</span></li>${rows}</ul>${hist}</div>`;
    },
    dock(S, myTurn) { return myTurn ? '<div class="kg-acts"><button class="btn btn-brass" data-g="throw">Würfeln</button></div>' : ''; },
    onClick(t) { if (t.dataset.g === 'throw') send('throw'); },
    rules: `<p>Elf Runden mit zwei Würfeln.</p>
      <ul>
        <li>Die Zielzahlen sind <b>2 bis 12</b>, in dieser Reihenfolge.</li>
        <li>Reihum würfelt jeder <b>einmal</b> mit beiden Würfeln.</li>
        <li>Ergibt die Augensumme genau die Zielzahl, bekommst du <b>diese Zahl als Punkte</b>.</li>
        <li>Nach Runde 11 gewinnt, wer die meisten Punkte hat. Bei Gleichstand würfeln die Besten im <b>Stechen</b>: die höhere Summe gewinnt, sonst nochmal.</li>
      </ul>`,
  });
}
