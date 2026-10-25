// Phase 10 im Browser (Regeln: games/zehnetappen/room.js).
// Karten antippen = auswählen. Mit Auswahl: „Phase auslegen“, „Abwerfen“ (eine Karte) oder eine ausgelegte Gruppe antippen = anlegen.
'use strict';
{
  const COLOR = { r: 'Rot', g: 'Grün', b: 'Blau', y: 'Gelb' };
  let picked = new Set();
  const card = (c, { cls = '', attrs = '', tag = 'button' } = {}) => {
    const label = c.c === 'j' ? 'Joker' : c.c === 's' ? 'Aussetzen' : `${COLOR[c.c]} ${c.n}`;
    const face = c.c === 'j' ? '★' : c.c === 's' ? '⊘' : c.n;
    return `<${tag} ${tag === 'button' ? 'type="button"' : 'role="img"'} class="kc kc-ze ze-${c.c} ${cls}" ${attrs} aria-label="${label}">${colorMark(c.c)}<span class="v">${face}</span></${tag}>`;
  };
  const TYPE = { set: 'gleiche Zahl', run: 'Folge', color: 'eine Farbe' };

  const kit = kitGame({
    id: 'zehnetappen',
    name: 'Phase 10',
    short: [
      "Jede Runde versuchst du, deine aktuelle Phase auszulegen (Liste unter „Alle Regeln“).",
      "Zug: eine Karte ziehen (Stapel oder Ablage), evtl. auslegen und anlegen, eine Karte abwerfen.",
      "★ Joker ersetzen jede Karte, ⊘ Aussetzen lässt jemanden einmal aussetzen.",
      "Wer seine Phase ausgelegt hat, darf überall anlegen.",
      "Die Runde ist vorbei, wenn jemand keine Karten mehr hat – wer ausgelegt hat, kommt eine Phase weiter.",
      "Wer zuerst Phase 10 schafft, gewinnt (Gleichstand: weniger Strafpunkte).",
    ],
    house: () => [],
    playerInfo: (p) => `Phase ${p.phase}${p.laidDone ? ' ✓' : ''} · ${p.cards} Karten · ${p.penalty} Strafp.${p.skipped ? ' · <b>setzt aus</b>' : ''}`,
    seat: (p) => `${fanHTML(p.cards)}<span>${p.cards} Karten</span><span>Phase ${p.phase}${p.laidDone ? ' <b>✓ ausgelegt</b>' : ''}</span>${p.skipped ? '<b class="kg-call">setzt aus</b>' : ''}`,
    hint(S, myTurn) {
      const g = S.g;
      if (!myTurn) return `${esc(S.players.find((p) => p.id === S.turnId)?.name ?? '?')} ist dran – du kannst schon Karten auswählen`;
      if (g.step === 'draw') return 'Zieh eine Karte – vom Stapel oder die oberste der Ablage';
      if (S.players.find((p) => p.id === S.you.id)?.laidDone) return 'Leg Karten an (Karte wählen, Gruppe antippen) – zum Schluss eine Karte abwerfen';
      return `Leg Phase ${g.myPhase} aus (${esc(g.phaseText)}) – oder wirf eine Karte ab`;
    },
    // Farbe: Rot, Grün, Blau, Gelb, dann Aussetzen und Joker; Zahl: 1–12, dann Aussetzen und Joker
    sort: {
      color: (c) => ('rgbysj'.indexOf(c.c)) * 100 + (c.n || 0),
      number: (c) => (c.c === 's' ? 1300 : c.c === 'j' ? 1400 : (c.n || 0) * 10 + 'rgby'.indexOf(c.c)),
    },
    // Ziehen (Maus): Karte auf die Ablage = abwerfen, auf eine Gruppe = anlegen
    onDrop(src, z) {
      picked = new Set([Number(src.dataset.id)]);
      kit.render();
      if (z.dataset.drop === 'discard') $('#kg-dock [data-g="discard"]')?.click(); // gleicher Weg wie der Knopf (fragt bei Aussetzen nach)
      else if (z.dataset.drop === 'group') send('hit', { card: [...picked][0], owner: z.dataset.owner, group: Number(z.dataset.group) });
    },
    onState(S) {
      const ids = new Set((S.g?.hand || []).map((c) => c.id));
      picked = new Set([...picked].filter((id) => ids.has(id)));
    },
    main(S) {
      const g = S.g;
      const name = (id) => esc(S.players.find((p) => p.id === id)?.name ?? '?');
      const playing = S.turnId === S.you?.id && g.step === 'play';
      const canHit = playing && picked.size === 1 && S.players.find((p) => p.id === S.you.id)?.laidDone;
      const dropHit = playing && S.players.find((p) => p.id === S.you.id)?.laidDone;
      const laid = Object.entries(g.laid).filter(([, gs]) => gs.length).map(([id, gs]) => `<div class="ze-laid"><b>${name(id)}</b>${gs.map((gr, i) => `
        <button type="button" class="ze-group ${canHit ? 'can' : ''}" data-g="hit" data-owner="${id}" data-group="${i}" ${dropHit ? 'data-drop="group"' : ''} ${canHit ? '' : 'disabled'} aria-label="Gruppe ${TYPE[gr.type]} von ${name(id)}${canHit ? ' – anlegen' : ''}">
          <small>${TYPE[gr.type]}</small><span class="ze-cards">${gr.cards.map((c) => card(c, { tag: 'span' })).join('')}</span></button>`).join('')}</div>`).join('');
      const top = g.top ? card(g.top, { cls: 'big', attrs: 'disabled' }) : '<div class="kc kc-empty"></div>';
      return `<div class="kg-table">
        <div class="kg-chips"><div class="kg-chip">Deine Phase ${g.myPhase}: <b>${esc(g.phaseText)}</b></div></div>
        <div class="kg-piles"><div class="kg-pile">${backCard(g.deck)}<small>Stapel</small></div><div class="kg-pile" ${playing ? 'data-drop="discard"' : ''}>${top}<small>Ablage</small></div></div>
        <div class="ze-table">${laid || '<p class="hint">Noch hat niemand eine Phase ausgelegt.</p>'}</div>
      </div>`;
    },
    dock(S, myTurn) {
      const g = S.g;
      const hand = (g.hand || []).map((c) => card(c, { cls: picked.has(c.id) ? 'sel' : '', attrs: `data-g="pick" data-id="${c.id}" aria-pressed="${picked.has(c.id)}" ${myTurn && g.step === 'play' ? `data-drag="${c.id}"` : ''}` })).join('');
      let acts = '';
      if (myTurn && g.step === 'draw') {
        acts = `<button class="btn btn-brass" data-g="draw-deck">Vom Stapel ziehen</button>
          <button class="btn" data-g="draw-discard" ${!g.top || g.top.c === 's' ? 'disabled title="Aussetzen darf man nicht aufnehmen"' : ''}>Ablage nehmen</button>`;
      } else if (myTurn) {
        const done = S.players.find((p) => p.id === S.you.id)?.laidDone;
        acts = `${done ? '' : `<button class="btn btn-brass" data-g="lay" ${picked.size ? '' : 'disabled'}>Phase auslegen (${picked.size})</button>`}
          <button class="btn" data-g="discard" ${picked.size === 1 ? '' : 'disabled title="Genau eine Karte auswählen"'}>Abwerfen</button>`;
      }
      return `<div class="kg-hand" role="group" aria-label="Deine Karten">${hand}</div><div class="kg-acts">${acts}</div>`;
    },
    async onClick(t, S) {
      const g = t.dataset.g;
      if (g === 'pick') { const id = Number(t.dataset.id); if (picked.has(id)) picked.delete(id); else picked.add(id); kit.render(); }
      else if (g === 'draw-deck') send('draw', { from: 'deck' });
      else if (g === 'draw-discard') send('draw', { from: 'discard' });
      else if (g === 'lay') send('lay', { cards: [...picked] }).then((r) => { if (r?.ok) picked.clear(); });
      else if (g === 'hit') send('hit', { card: [...picked][0], owner: t.dataset.owner, group: Number(t.dataset.group) });
      else if (g === 'discard') {
        const id = [...picked][0];
        const c = S.g.hand.find((x) => x.id === id);
        let target = '';
        if (c?.c === 's') {
          // Wer soll aussetzen? Kurzer Dialog mit Namen
          const others = S.players.filter((p) => p.inRound && p.id !== S.you.id);
          const v = await ask({ title: 'Wer soll aussetzen?', text: `Namen eintippen: ${others.map((p) => p.name).join(', ')}`, ok: 'Aussetzen lassen', input: { value: others[0]?.name || '', label: 'Name' } });
          if (v === false) return;
          target = others.find((p) => p.name.toLowerCase() === String(v).trim().toLowerCase())?.id;
          if (!target) { toast('Diesen Namen gibt es nicht', true); return; }
        }
        send('discard', { card: id, target }).then((r) => { if (r?.ok) picked.clear(); });
      }
    },
    rules: `<p>Zehn Phasen nacheinander. Jede Runde versuchst du, deine aktuelle Phase auszulegen:</p>
      <ol class="ze-list"><li>2 Drillinge</li><li>Drilling + 4er-Folge</li><li>Vierling + 4er-Folge</li><li>7er-Folge</li><li>8er-Folge</li>
        <li>9er-Folge</li><li>2 Vierlinge</li><li>7 Karten einer Farbe</li><li>Fünfling + Zwilling</li><li>Fünfling + Drilling</li></ol>
      <ul>
        <li><b>Zug:</b> eine Karte ziehen (Stapel oder Ablage), dann evtl. auslegen, dann eine Karte abwerfen.</li>
        <li>Wer ausgelegt hat, darf in späteren Zügen Karten an alle ausgelegten Gruppen <b>anlegen</b>.</li>
        <li><b>★ Joker</b> ersetzen jede Karte. <b>⊘ Aussetzen</b> abwerfen: jemand deiner Wahl setzt einmal aus.</li>
        <li>Die Runde endet, wenn jemand keine Karten mehr hat. Wer seine Phase ausgelegt hat, ist eine weiter.</li>
        <li>Strafpunkte für Restkarten: 1–9 = 5, 10–12 = 10, Aussetzen 15, Joker 25.</li>
        <li>Wer zuerst Phase 10 schafft, gewinnt das Spiel (bei Gleichstand weniger Strafpunkte).</li>
      </ul>`,
  });
}
