// Skip-Bo im Browser (Regeln: games/stapelrennen/room.js).
// Erst eine Karte wählen (Hand, eigener Stapel oder oberste Karte einer Ablage), dann eine Baureihe antippen.
// Mit einer Handkarte gewählt: eigene Ablage antippen = abwerfen und Zug beenden.
'use strict';
{
  let sel = null; // { kind: 'hand' | 'stock' | 'pile', index }
  // Karte: 1–4 blau, 5–8 grün, 9–12 rot (mit Form je Gruppe), große Zahl und kleine in den Ecken. Joker: dunkel mit Goldstern – deutlich anders.
  const num = (n, { cls = '', attrs = '', tag = 'button' } = {}) => {
    const corner = n === 0 ? '★' : n;
    return `<${tag} ${tag === 'button' ? 'type="button"' : 'role="img"'} class="kc kc-st ${n === 0 ? 'joker' : `st-${Math.ceil(n / 4)}`} ${cls}" ${attrs} aria-label="${n === 0 ? 'Joker' : n}">${n ? colorMark('bgr'[Math.ceil(n / 4) - 1]) : ''}
      <span class="cr tl">${corner}</span><span class="v">${n === 0 ? '★<small>Joker</small>' : n}</span><span class="cr br">${corner}</span></${tag}>`;
  };
  const same = (a, b) => a && b && a.kind === b.kind && (a.index ?? 0) === (b.index ?? 0);

  const kit = kitGame({
    id: 'stapelrennen',
    name: 'Skip-Bo',
    // Erste Schritte beim ersten Spiel (3 Schritte, abschaltbar unter „Ich“)
    intro: [
      ["Ziel", "Werde deinen Spielstapel (rechts von deinen Ablagen) als Erster los."],
      ["Legen", "Karte wählen – aus der Hand, vom Spielstapel oder oben von einer Ablage – und einen Bau-Stapel in der Mitte antippen. Jeder braucht die nächste Zahl."],
      ["Zug beenden", "Zum Schluss eine Handkarte auf eine deiner vier Ablagen. Die leuchten, sobald das geht."],
    ],
    short: [
      "Ziel: deinen eigenen Stapel als Erster loswerden.",
      "In der Mitte: vier Reihen von 1 bis 12, volle Reihen kommen weg.",
      "Lege aus der Hand, vom Stapel oder von deinen Ablagen – ★ Joker zählt als jede Zahl.",
      "Hand leer? Du bekommst 5 neue.",
      "Zug beenden: eine Handkarte auf eine deiner 4 Ablagen.",
      "Punkte: 25 plus 5 je Restkarte im Stapel der anderen.",
    ],
    house: () => ['Ohne Hand- und Nachziehkarten darfst du weitergeben. Kann niemand mehr legen, endet die Runde unentschieden.'],
    playerInfo: (p) => `Stapel ${p.stock}${p.stockTop !== null && p.stockTop !== undefined ? ` (oben ${p.stockTop === 0 ? '★' : p.stockTop})` : ''} · ${p.cards} Handkarten`,
    onState(S, prev) { if (S.turnId !== prev?.turnId) sel = null; },
    // Am Platz: oberste Karte des Spielstapels mit Restanzahl, darunter die vier Ablagen klein
    seat: (p) => `<div class="st-seat"><span class="st-seat-stock">${p.stock ? num(p.stockTop, { tag: 'span' }) : '<span class="kc kc-empty"></span>'}<small>Stapel ${p.stock}</small></span>
      <span class="st-seat-piles">${(p.piles || []).map((pile) => (pile.length ? num(pile[pile.length - 1], { tag: 'span' }) : '<span class="kc kc-empty"></span>')).join('')}</span></div>
      <span>${p.cards} Handkarten</span>`,
    hint(S, myTurn) {
      if (!myTurn) return '';
      if (!sel) return 'Karte wählen: Hand, dein Stapel oder oberste Karte einer Ablage';
      return sel.kind === 'hand' ? 'Jetzt eine Baureihe antippen – oder eine deiner Ablagen (= Zug beenden)' : 'Jetzt eine Baureihe antippen';
    },
    // Ziehen (Maus): auf eine Baureihe = legen, Handkarte auf eine eigene Ablage = abwerfen
    onDrop(src, z) {
      const from = { kind: src.dataset.kind, index: Number(src.dataset.i || 0) };
      sel = null;
      if (z.dataset.drop === 'build') send('play', { from, to: Number(z.dataset.i) });
      else if (z.dataset.drop === 'pile' && from.kind === 'hand') send('discard', { index: from.index, pile: Number(z.dataset.i) });
      kit.render();
    },
    main(S, ui = {}) {
      const g = S.g;
      const mine = S.turnId === S.you?.id;
      const me = S.players.find((p) => p.id === S.you?.id);
      const build = g.build.map((b, i) => `<button type="button" class="st-build ${mine && sel ? 'can' : ''}" data-g="build" data-i="${i}" ${mine ? 'data-drop="build"' : ''} ${mine && sel ? '' : 'disabled'} aria-label="Baureihe ${i + 1}, braucht ${b.next}">
        ${b.count ? num(b.count, { tag: 'span' }) : '<span class="kc kc-empty"></span>'}<small>braucht <b class="st-need">${b.next}</b></small></button>`).join('');
      const piles = (p, own) => (p.piles || []).map((pile, i) => {
        const top = pile[pile.length - 1];
        const click = own && mine;
        const canDrop = click && sel?.kind === 'hand';
        return `<div class="st-pile" ${click ? `data-drop="pile" data-i="${i}"` : ''}>${top !== undefined
          ? num(top, { cls: `${same(sel, { kind: 'pile', index: i }) ? 'sel' : ''} ${canDrop ? 'drop' : ''}`, attrs: click ? `data-g="${canDrop ? 'drop' : 'pick'}" data-kind="pile" data-i="${i}" data-drag="pile${i}"` : 'disabled' })
          : `<button type="button" class="kc kc-empty ${canDrop ? 'drop' : ''}" ${canDrop ? `data-g="drop" data-i="${i}"` : 'disabled'} aria-label="leere Ablage ${i + 1}"></button>`}
          <small>${pile.length > 1 ? `${pile.length} Karten` : ''}</small></div>`;
      }).join('');
      const others = S.players.filter((p) => p.inRound && p.id !== S.you?.id).map((p) => `<div class="st-other"><b>${esc(p.name)}</b>
        <div class="st-row"><div class="st-stock">${p.stock ? num(p.stockTop, { attrs: 'disabled' }) : '<span class="kc kc-empty"></span>'}<small>Stapel ${p.stock}</small></div>${piles(p, false)}</div></div>`).join('');
      // Wie am echten Tisch: deine vier Ablagen vorne, dein Spielstapel rechts daneben
      const ending = mine && sel?.kind === 'hand';
      const mineHTML = me?.inRound ? `<div class="st-mine"><div class="st-row">
        <div class="st-piles ${ending ? 'ending' : ''}"><div class="st-row">${piles(me, true)}</div><small>${ending ? '<b>Handkarte auf eine Ablage = Zug beenden</b>' : 'Deine Ablagen'}</small></div>
        <div class="st-stock">${me.stock ? num(me.stockTop, { cls: `big ${same(sel, { kind: 'stock' }) ? 'sel' : ''}`, attrs: mine ? 'data-g="pick" data-kind="stock" data-drag="stock"' : 'disabled' }) : '<span class="kc kc-empty big"></span>'}<small>Dein Stapel: <b>${me.stock}</b></small></div>
        </div></div>` : '';
      // Am großen Tisch sitzen die Gegner mit Stapel und Ablagen an ihren Plätzen
      return `<div class="kg-table"><div class="st-builds">${build}</div>${mineHTML}${ui.ring ? '' : `<div class="st-others">${others}</div>`}</div>`;
    },
    dock(S, myTurn) {
      const hand = (S.g.hand || []).map((n, i) => num(n, { cls: same(sel, { kind: 'hand', index: i }) ? 'sel' : '', attrs: myTurn ? `data-g="pick" data-kind="hand" data-i="${i}" data-drag="hand${i}"` : 'disabled' })).join('');
      const pass = myTurn && S.g.canPass ? '<button class="btn" data-g="pass">Ohne Handkarte weiter</button>' : '';
      return `<div class="kg-hand" role="group" aria-label="Deine Karten">${hand}</div><div class="kg-acts">${pass}</div>`;
    },
    onClick(t) {
      const g = t.dataset.g;
      if (g === 'pick') {
        const next = { kind: t.dataset.kind, index: Number(t.dataset.i || 0) };
        sel = same(sel, next) ? null : next;
        kit.render();
      } else if (g === 'build' && sel) { send('play', { from: sel, to: Number(t.dataset.i) }); sel = null; }
      else if (g === 'drop' && sel?.kind === 'hand') { send('discard', { index: sel.index, pile: Number(t.dataset.i) }); sel = null; }
      else if (g === 'pass') { send('pass'); sel = null; }
    },
    rules: `<p>Wer zuerst seinen eigenen <b>Stapel</b> los ist, gewinnt.</p>
      <ul>
        <li>In der Mitte liegen vier <b>Baureihen</b>: jede beginnt mit 1 und geht bis 12. Volle Reihen kommen weg.</li>
        <li>Zu Beginn deines Zuges hast du 5 Handkarten. Lege beliebig viele Karten aus der Hand, von deinem Stapel oder oben von deinen Ablagen auf die Reihen.</li>
        <li><b>★ Joker</b> zählen als die Zahl, die gerade gebraucht wird.</li>
        <li>Ist deine Hand leer, bekommst du 5 neue.</li>
        <li>Zum Schluss legst du eine Handkarte auf eine deiner vier <b>Ablagen</b> – dann ist der Nächste dran.</li>
        <li>Ohne Hand- und Nachziehkarten darfst du ohne Abwerfen weitergeben. Kann niemand mehr legen, endet die Runde unentschieden.</li>
      </ul>
      <p><b>Wertung:</b> Der Gewinner bekommt 25 Punkte plus 5 für jede Karte, die die anderen noch im Stapel haben.</p>`,
  });
}
