// Durak im Browser (Regeln: games/durak/room.js). Angreifen: Karte wählen, „Angreifen“. Verteidigen: Karte wählen, dann die Angriffskarte antippen.
'use strict';
{
  let sel = null; // gewählte Handkarte
  const RANKS = '6789TJQKA';
  const SIGN = { c: '♣', d: '♦', h: '♥', s: '♠' };
  const SUIT_NAME = { c: 'Kreuz', d: 'Karo', h: 'Herz', s: 'Pik' };
  const nameOf = (S, id) => esc(S.players.find((p) => p.id === id)?.name ?? '?');
  const idx = (c) => RANKS.indexOf(c[0]);
  const beats = (g, def, atk) => (def[1] === atk[1] ? idx(def) > idx(atk) : def[1] === g.trump && atk[1] !== g.trump);
  const sortHand = (g, h) => [...h].sort((a, b) => (a[1] === g.trump) - (b[1] === g.trump) || 'cdhs'.indexOf(a[1]) - 'cdhs'.indexOf(b[1]) || idx(a) - idx(b));

  const kit = kitGame({
    id: 'durak',
    name: 'Durak',
    intro: [
      ['Ziel', 'Werde alle Karten los. Wer am Ende noch Karten hat, ist der Durak.'],
      ['Verteidigen', 'Schlag jede Angriffskarte mit einer höheren der gleichen Farbe oder mit Trumpf: erst deine Karte, dann die Angriffskarte antippen.'],
      ['Angreifen', 'Leg eine Karte aus; danach darfst du Karten mit schon liegenden Werten nachlegen. „Genug“, wenn du fertig bist.'],
    ],
    short: [
      '36 Karten (6 bis Ass), 6 pro Spieler. Die unterste Karte des Stapels bestimmt den Trumpf.',
      'Der Angreifer legt aus, der Verteidiger schlägt: höhere Karte derselben Farbe oder Trumpf.',
      'Alle anderen dürfen Karten mit liegenden Werten nachlegen (höchstens 6, nicht mehr, als der Verteidiger auf der Hand hat).',
      'Nimmt der Verteidiger auf, setzt er aus. Danach wird auf 6 aufgefüllt.',
      'Wer als Letzter Karten hat, ist der Durak.',
    ],
    house: () => [],
    playerInfo: (p) => `${p.out ? 'fertig' : I18n.html`${p.cards} Karte${p.cards === 1 ? '' : 'n'}`}${p.role === 'attack' ? ' · greift an' : p.role === 'defend' ? ' · verteidigt' : ''}`,
    seat: (p) => `${p.out ? I18n.html('<span>fertig</span>') : I18n.html`${fanHTML(p.cards)}<span>${p.cards} Karte${p.cards === 1 ? '' : 'n'}</span>`}${p.role === 'attack' ? I18n.html('<b class="kg-call">Angriff</b>') : p.role === 'defend' ? I18n.html('<b class="kg-call">Abwehr</b>') : ''}`,
    onState(S) {
      if (S.turnId !== S.you?.id || !(S.g?.hand || []).includes(sel)) sel = null;
    },
    hint(S, myTurn) {
      const g = S.g;
      const me = S.you?.id;
      if (!myTurn) return I18n.html`${nameOf(S, S.turnId)} ist dran`;
      if (me === g.defender) return sel ? 'Jetzt die Angriffskarte antippen, die du schlagen willst' : 'Wähl eine Karte zum Schlagen – oder nimm die Karten auf';
      if (!g.table.length) return 'Du greifst an: Karte wählen, „Angreifen“';
      return g.taking ? I18n.html`${nameOf(S, g.defender)} nimmt auf – du darfst noch Karten dazulegen` : 'Nachlegen (liegende Werte) oder „Genug“';
    },
    main(S) {
      const g = S.g;
      const me = S.you?.id;
      const myDef = me === g.defender && S.turnId === me && !g.taking;
      const pairs = g.table.map((p, i) => {
        const canHit = myDef && !p.d && sel && beats(g, sel, p.a);
        return I18n.html`<div class="du-pair">
          <button type="button" class="du-atk" ${myDef && !p.d && sel ? `data-g="hit" data-i="${i}"` : 'disabled'} aria-label="Angriffskarte ${i + 1}">${frenchCard(p.a, { cls: canHit ? 'can' : '', attrs: 'tabindex="-1" disabled' })}</button>
          ${p.d ? `<span class="du-def">${frenchCard(p.d, { attrs: 'disabled tabindex="-1"' })}</span>` : ''}</div>`;
      }).join('');
      const trump = I18n.html`<div class="du-deck"><span class="du-trump-card">${g.trumpCard ? frenchCard(g.trumpCard, { cls: 'sideways', attrs: 'disabled tabindex="-1"' }) : ''}</span><span class="du-stack">${g.deck ? fanHTML(2) : ''}</span>
        <small>Trumpf <b class="du-trump">${SIGN[g.trump]} ${SUIT_NAME[g.trump]}</b> · Stapel ${g.deck} · abgelegt ${g.discard}</small></div>`;
      const roles = I18n.html`<div class="kg-chips"><div class="kg-chip">${nameOf(S, g.attacker)} greift ${nameOf(S, g.defender)} an${g.taking ? ' – wird aufgenommen' : ''}</div></div>`;
      return I18n.html`<div class="kg-table du-wrap">${trump}<div class="du-table" role="group" aria-label="Tisch">${pairs || I18n.html('<p class="hint">Noch keine Angriffskarte</p>')}</div>${roles}</div>`;
    },
    dock(S, myTurn) {
      const g = S.g;
      const me = S.you?.id;
      const hand = sortHand(g, g.hand || []).map((c) => frenchCard(c, { cls: `${c === sel ? 'sel' : ''} ${c[1] === g.trump ? 'trump' : ''}`, attrs: myTurn ? `data-g="pick" data-c="${c}"` : 'disabled' })).join('');
      let acts = '';
      if (myTurn && me === g.defender && !g.taking) acts = I18n.html('<button class="btn btn-outline-red" data-g="take">Aufnehmen</button>');
      else if (myTurn) acts = I18n.html`<button class="btn btn-brass" data-g="attack" ${sel ? '' : 'disabled'}>Angreifen</button>${g.table.length ? I18n.html('<button class="btn" data-g="pass">Genug</button>') : ''}`;
      return I18n.html`<div class="kg-hand" role="group" aria-label="Deine Karten">${hand}</div><div class="kg-acts">${acts}</div>`;
    },
    onClick(t, S) {
      const g = t.dataset.g;
      const G = S.g;
      if (g === 'pick') {
        const c = t.dataset.c;
        // Verteidigen mit nur einer offenen Angriffskarte: zweiter Tipp auf die gewählte Karte schlägt direkt
        const open = G.table.map((p, i) => [p, i]).filter(([p]) => !p.d);
        if (S.you?.id === G.defender && !G.taking && open.length === 1 && beats(G, c, open[0][0].a) && sel === c) { sel = null; send('defend', { card: c, index: open[0][1] }); return; }
        sel = sel === c ? null : c;
        kit.render();
      } else if (g === 'hit' && sel) { const card = sel; sel = null; send('defend', { card, index: Number(t.dataset.i) }); }
      else if (g === 'attack' && sel) { const card = sel; sel = null; send('attack', { card }); }
      else if (g === 'take') { sel = null; send('take'); }
      else if (g === 'pass') { sel = null; send('pass'); }
    },
    rules: I18n.html`<p>36 Karten (6 bis Ass), jeder bekommt 6. Die unterste Karte des Stapels bleibt sichtbar liegen und bestimmt die <b>Trumpffarbe</b>.</p>
      <ul>
        <li>Der <b>Angreifer</b> legt eine Karte aus. Der <b>Verteidiger</b> schlägt sie mit einer höheren Karte <b>derselben Farbe</b> oder mit <b>Trumpf</b> (Trumpf nur mit höherem Trumpf).</li>
        <li>Der Angreifer und alle anderen Mitspieler (außer dem Verteidiger) dürfen Karten nachlegen, deren Wert schon auf dem Tisch liegt – höchstens 6 und nicht mehr, als der Verteidiger auf der Hand hat. Wer nichts mehr legen will, sagt „Genug“.</li>
        <li>Ist alles geschlagen, kommen die Karten ab, und der Verteidiger greift als Nächster an.</li>
        <li>Kann oder will der Verteidiger nicht schlagen, <b>nimmt er alle Karten auf</b> (die anderen dürfen vorher noch dazulegen) und setzt aus. Der Nächste greift an.</li>
        <li>Danach wird auf 6 Karten aufgefüllt: zuerst die Angreifer, der Verteidiger zuletzt.</li>
        <li>Ist der Stapel leer, scheidet aus, wer keine Karten mehr hat. Wer zuletzt Karten hat, ist der <b>Durak</b>. Alle anderen bekommen einen Punkt.</li>
      </ul>`,
  });
}
