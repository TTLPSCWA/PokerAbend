// Stapelrennen im Browser (Regeln: games/stapelrennen/room.js).
// Erst eine Karte wählen (Hand, eigener Stapel oder oberste Karte einer Ablage), dann eine Baureihe antippen.
// Mit einer Handkarte gewählt: eigene Ablage antippen = abwerfen und Zug beenden.
'use strict';
{
  let sel = null; // { kind: 'hand' | 'stock' | 'pile', index }
  const num = (n, { cls = '', attrs = '', tag = 'button' } = {}) => `<${tag} ${tag === 'button' ? 'type="button"' : 'role="img"'} class="kc kc-st ${n === 0 ? 'joker' : `st-${Math.ceil(n / 4)}`} ${cls}" ${attrs} aria-label="${n === 0 ? 'Joker' : n}"><span class="v">${n === 0 ? '★' : n}</span></${tag}>`;
  const same = (a, b) => a && b && a.kind === b.kind && (a.index ?? 0) === (b.index ?? 0);

  const kit = kitGame({
    id: 'stapelrennen',
    name: 'Stapelrennen',
    settings: [{ key: 'stockSize', label: 'Karten im eigenen Stapel', min: 5, max: 30 }],
    playerInfo: (p) => `Stapel ${p.stock}${p.stockTop !== null && p.stockTop !== undefined ? ` (oben ${p.stockTop === 0 ? '★' : p.stockTop})` : ''} · ${p.cards} Handkarten`,
    onState(S, prev) { if (S.turnId !== prev?.turnId) sel = null; },
    main(S) {
      const g = S.g;
      const mine = S.turnId === S.you?.id;
      const me = S.players.find((p) => p.id === S.you?.id);
      const build = g.build.map((b, i) => `<button type="button" class="st-build ${mine && sel ? 'can' : ''}" data-g="build" data-i="${i}" ${mine && sel ? '' : 'disabled'} aria-label="Baureihe ${i + 1}, braucht ${b.next}">
        ${b.count ? num(b.count, { tag: 'span' }) : '<span class="kc kc-empty"></span>'}<small>braucht <b>${b.next}</b></small></button>`).join('');
      const piles = (p, own) => (p.piles || []).map((pile, i) => {
        const top = pile[pile.length - 1];
        const click = own && mine;
        const canDrop = click && sel?.kind === 'hand';
        return `<div class="st-pile">${top !== undefined
          ? num(top, { cls: `${same(sel, { kind: 'pile', index: i }) ? 'sel' : ''} ${canDrop ? 'drop' : ''}`, attrs: click ? `data-g="${canDrop ? 'drop' : 'pick'}" data-kind="pile" data-i="${i}"` : 'disabled' })
          : `<button type="button" class="kc kc-empty ${canDrop ? 'drop' : ''}" ${canDrop ? `data-g="drop" data-i="${i}"` : 'disabled'} aria-label="leere Ablage ${i + 1}"></button>`}
          <small>${pile.length > 1 ? `${pile.length} Karten` : ''}</small></div>`;
      }).join('');
      const others = S.players.filter((p) => p.inRound && p.id !== S.you?.id).map((p) => `<div class="st-other"><b>${esc(p.name)}</b>
        <div class="st-row"><div class="st-stock">${p.stock ? num(p.stockTop, { attrs: 'disabled' }) : '<span class="kc kc-empty"></span>'}<small>Stapel ${p.stock}</small></div>${piles(p, false)}</div></div>`).join('');
      const mineHTML = me?.inRound ? `<div class="st-mine"><b>Du</b><div class="st-row">
        <div class="st-stock">${me.stock ? num(me.stockTop, { cls: `big ${same(sel, { kind: 'stock' }) ? 'sel' : ''}`, attrs: mine ? 'data-g="pick" data-kind="stock"' : 'disabled' }) : ''}<small>Dein Stapel: ${me.stock}</small></div>
        ${piles(me, true)}</div></div>` : '';
      return `<div class="kg-table"><div class="st-builds">${build}</div>${mineHTML}<div class="st-others">${others}</div></div>`;
    },
    dock(S, myTurn) {
      const hand = (S.g.hand || []).map((n, i) => num(n, { cls: same(sel, { kind: 'hand', index: i }) ? 'sel' : '', attrs: myTurn ? `data-g="pick" data-kind="hand" data-i="${i}"` : 'disabled' })).join('');
      const hint = !myTurn ? 'Warte, bis du dran bist'
        : !sel ? 'Karte wählen: Hand, dein Stapel oder oberste Karte einer Ablage'
          : sel.kind === 'hand' ? 'Jetzt eine Baureihe antippen – oder eine deiner Ablagen (= Zug beenden)' : 'Jetzt eine Baureihe antippen';
      return `<div class="kg-hand" role="group" aria-label="Deine Karten">${hand}</div><div class="kg-acts"><span class="waiting">${hint}</span></div>`;
    },
    onClick(t) {
      const g = t.dataset.g;
      if (g === 'pick') {
        const next = { kind: t.dataset.kind, index: Number(t.dataset.i || 0) };
        sel = same(sel, next) ? null : next;
        kit.render();
      } else if (g === 'build' && sel) { send('play', { from: sel, to: Number(t.dataset.i) }); sel = null; }
      else if (g === 'drop' && sel?.kind === 'hand') { send('discard', { index: sel.index, pile: Number(t.dataset.i) }); sel = null; }
    },
    rules: `<p>Wer zuerst seinen eigenen <b>Stapel</b> los ist, gewinnt.</p>
      <ul>
        <li>In der Mitte liegen vier <b>Baureihen</b>: jede beginnt mit 1 und geht bis 12. Volle Reihen kommen weg.</li>
        <li>Zu Beginn deines Zuges hast du 5 Handkarten. Lege beliebig viele Karten aus der Hand, von deinem Stapel oder oben von deinen Ablagen auf die Reihen.</li>
        <li><b>★ Joker</b> zählen als die Zahl, die gerade gebraucht wird.</li>
        <li>Ist deine Hand leer, bekommst du 5 neue.</li>
        <li>Zum Schluss legst du eine Handkarte auf eine deiner vier <b>Ablagen</b> – dann ist der Nächste dran.</li>
      </ul>
      <p><b>Wertung:</b> Der Gewinner bekommt 25 Punkte plus 5 für jede Karte, die die anderen noch im Stapel haben.</p>`,
  });
}
