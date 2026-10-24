// Hütchenrennen im Browser (Regeln: games/huetchen/room.js). Spielbrett als 11 × 11-Raster.
'use strict';
{
  // Strecke: 40 Felder im Uhrzeigersinn, Feld 0 ist das Startfeld von Rot (Farbe 0)
  const PATH = [[0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [4, 3], [4, 2], [4, 1], [4, 0], [5, 0], [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [10, 5],
    [10, 6], [9, 6], [8, 6], [7, 6], [6, 6], [6, 7], [6, 8], [6, 9], [6, 10], [5, 10], [4, 10], [4, 9], [4, 8], [4, 7], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 5]];
  const GOALS = [[[1, 5], [2, 5], [3, 5], [4, 5]], [[5, 1], [5, 2], [5, 3], [5, 4]], [[9, 5], [8, 5], [7, 5], [6, 5]], [[5, 9], [5, 8], [5, 7], [5, 6]]];
  const HOUSES = [[[0, 0], [1, 0], [0, 1], [1, 1]], [[9, 0], [10, 0], [9, 1], [10, 1]], [[9, 9], [10, 9], [9, 10], [10, 10]], [[0, 9], [1, 9], [0, 10], [1, 10]]];
  const NAMES = ['Rot', 'Blau', 'Grün', 'Gelb'];
  let lastRoll = null;

  const where = (color, progress, i) => (progress < 0 ? HOUSES[color][i] : progress >= 40 ? GOALS[color][progress - 40] : PATH[(color * 10 + progress) % 40]);

  const kit = kitGame({
    id: 'huetchen',
    name: 'Hütchenrennen',
    playerInfo: (p) => (p.color !== null && p.color !== undefined ? `<span class="hc-dot hc-${p.color}"></span>${NAMES[p.color]} · ${p.home}/4 im Ziel` : ''),
    onState(S) { if (S.g?.rolled) lastRoll = S.g.rolled; },
    main(S) {
      const g = S.g;
      const cells = new Map(); // "x,y" → HTML
      const key = (x, y) => `${x},${y}`;
      PATH.forEach(([x, y], i) => cells.set(key(x, y), `<div class="hb-cell path ${i % 10 === 0 ? `start hc-bg-${i / 10}` : ''}" style="grid-area:${y + 1}/${x + 1}"></div>`));
      GOALS.forEach((gs, c) => gs.forEach(([x, y]) => cells.set(key(x, y), `<div class="hb-cell goal hc-bg-${c}" style="grid-area:${y + 1}/${x + 1}"></div>`)));
      HOUSES.forEach((hs, c) => hs.forEach(([x, y]) => cells.set(key(x, y), `<div class="hb-cell house hc-bg-${c}" style="grid-area:${y + 1}/${x + 1}"></div>`)));
      const mine = S.turnId === S.you?.id;
      const pieces = Object.entries(g.pieces).map(([id, list]) => {
        const c = g.color[id];
        return list.map((p, i) => {
          const [x, y] = where(c, p, i);
          const can = mine && id === S.you.id && g.options.includes(i);
          const who = esc(S.players.find((q) => q.id === id)?.name ?? '?');
          return can
            ? `<button type="button" class="hb-piece hc-${c} can" style="grid-area:${y + 1}/${x + 1}" data-g="move" data-piece="${i}" aria-label="Hütchen ${i + 1} von ${who} ziehen"></button>`
            : `<span class="hb-piece hc-${c}" style="grid-area:${y + 1}/${x + 1}" role="img" aria-label="Hütchen von ${who}"></span>`;
        }).join('');
      }).join('');
      const dice = g.rolled || lastRoll;
      return `<div class="kg-table"><div class="hb-wrap"><div class="hb-board" role="img" aria-label="Spielbrett">${[...cells.values()].join('')}${pieces}
        <div class="hb-dice">${dice ? dieHTML(dice, { cls: `big ${g.rolled ? '' : 'old'}` }) : ''}</div></div></div></div>`;
    },
    dock(S, myTurn) {
      if (!myTurn) return '<span class="waiting">Warte, bis du dran bist</span>';
      const g = S.g;
      if (g.rolled) return `<span class="waiting">Du hast eine <b>${g.rolled}</b> – tipp ein leuchtendes Hütchen an</span>`;
      const tries = g.stuck ? ` (Versuch ${g.tries + 1} von 3)` : '';
      return `<button class="btn btn-brass" data-g="roll">Würfeln${tries}</button>`;
    },
    onClick(t) {
      if (t.dataset.g === 'roll') send('roll');
      else if (t.dataset.g === 'move') send('move', { piece: Number(t.dataset.piece) });
    },
    rules: `<p>Jeder hat vier Hütchen im Haus. Wer zuerst alle vier ins Ziel bringt, gewinnt.</p>
      <ul>
        <li>Raus kommt man nur mit einer <b>6</b>. Wer kein Hütchen auf der Strecke hat, darf bis zu dreimal würfeln.</li>
        <li>Nach einer 6 darf man nochmal würfeln.</li>
        <li>Mit einer 6 muss man rauskommen, wenn das eigene Startfeld frei ist. Steht dort ein eigenes Hütchen, muss es weiter.</li>
        <li>Landest du auf einem fremden Hütchen, muss es zurück ins Haus.</li>
        <li>Ins Ziel nur mit passender Zahl, eigene Hütchen im Ziel kann man nicht überspringen.</li>
      </ul>`,
  });
}
