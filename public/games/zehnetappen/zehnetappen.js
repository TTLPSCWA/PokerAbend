// Phase 10 im Browser (Regeln: games/zehnetappen/room.js).
// Karten antippen = auswählen. Ausgewählte Karten in ein Ausleg-Feld tippen (oder ziehen) – ✓, wenn die Gruppe passt.
// Mit Auswahl außerdem: „Abwerfen“ (eine Karte) oder eine ausgelegte Gruppe antippen = anlegen.
'use strict';
{
  const COLOR = { r: 'Rot', g: 'Grün', b: 'Blau', y: 'Gelb' };
  const SKIP = '<svg class="sym" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="3"/><path d="M6.5 17.5l11-11" stroke="currentColor" stroke-width="3"/></svg>';
  let picked = new Set();
  let slots = [];        // Ausleg-Felder: je Gruppe der Phase eine Liste von Karten-IDs
  let slotKey = '';      // Runde + Phase – wechselt sie, werden die Felder geleert
  let skipFor = null;    // Aussetzen-Karte, für die gerade jemand gewählt wird

  // Karte im bekannten Aufbau: Farbe, große Zahl in der Mitte, kleine in den Ecken; Joker mit „J“, Aussetzen mit eigenem Zeichen
  const card = (c, { cls = '', attrs = '', tag = 'button' } = {}) => {
    const label = c.c === 'j' ? 'Joker' : c.c === 's' ? 'Aussetzen' : `${COLOR[c.c]} ${c.n}`;
    const corner = c.c === 'j' ? 'J' : c.c === 's' ? SKIP : c.n;
    const face = c.c === 'j' ? '<b class="ze-j">J</b><small>Joker</small>' : c.c === 's' ? `${SKIP}<small>Aussetzen</small>` : `<b>${c.n}</b>`;
    return `<${tag} ${tag === 'button' ? 'type="button"' : 'role="img"'} class="kc kc-ze ze-${c.c} ${cls}" ${attrs} aria-label="${label}">${colorMark(c.c)}
      <span class="cr tl">${corner}</span><span class="v">${face}</span><span class="cr br">${corner}</span></${tag}>`;
  };
  const TYPE = { set: 'gleiche Zahl', run: 'Folge', color: 'eine Farbe' };
  const SET_WORD = { 2: 'Zwilling', 3: 'Drilling', 4: 'Vierling', 5: 'Fünfling' };
  const groupName = (gr) => (gr.type === 'set' ? SET_WORD[gr.size] : gr.type === 'run' ? `${gr.size}er-Folge` : `${gr.size} einer Farbe`);
  // Passen die Karten als Gruppe? (wie auf dem Server: Joker füllen Lücken, Aussetzen nie)
  function validGroup(type, cards) {
    if (cards.some((c) => c.c === 's')) return false;
    const nat = cards.filter((c) => c.c !== 'j');
    if (type === 'set') return new Set(nat.map((c) => c.n)).size <= 1;
    if (type === 'color') return new Set(nat.map((c) => c.c)).size <= 1;
    if (cards.length > 12) return false;
    const ns = nat.map((c) => c.n);
    if (new Set(ns).size !== ns.length) return false;
    return !ns.length || Math.max(...ns) - Math.min(...ns) + 1 <= cards.length;
  }
  const inSlots = () => new Set(slots.flat());
  const meOf = (S) => S.players.find((p) => p.id === S.you?.id);
  const slotOk = (S, i) => {
    const gr = S.g.myGroups[i];
    const cards = slots[i].map((id) => S.g.hand.find((c) => c.id === id)).filter(Boolean);
    const size = S.settings.exactSize ? cards.length === gr.size : cards.length >= gr.size;
    return size && validGroup(gr.type, cards);
  };

  const kit = kitGame({
    id: 'zehnetappen',
    name: 'Phase 10',
    // Erste Schritte beim ersten Spiel (3 Schritte, abschaltbar unter „Ich“)
    intro: [
      ["Ziel", "Schaff die zehn Phasen nacheinander. Deine aktuelle Phase steht oben groß."],
      ["Dein Zug", "Erst eine Karte ziehen (Stapel oder Ablage), zum Schluss eine Karte abwerfen."],
      ["Auslegen", "Karten antippen und in die Felder deiner Phase tippen. Steht überall ✓, tippst du „Phase auslegen“."],
    ],
    short: [
      "Jede Runde versuchst du, deine aktuelle Phase auszulegen (Liste unter „Alle Regeln“).",
      "Zug: eine Karte ziehen (Stapel oder Ablage), evtl. auslegen und anlegen, eine Karte abwerfen.",
      "<b>J</b> Joker ersetzen jede Karte, Aussetzen lässt jemanden einmal aussetzen.",
      "Wer seine Phase ausgelegt hat, darf überall anlegen.",
      "Die Runde ist vorbei, wenn jemand keine Karten mehr hat – wer ausgelegt hat, kommt eine Phase weiter.",
      "Wer zuerst Phase 10 schafft, gewinnt (Gleichstand: weniger Strafpunkte).",
    ],
    house: () => [],
    playerInfo: (p) => `Phase ${p.phase}${p.laidDone ? ' ✓' : ''} · ${p.cards} Karten · ${p.penalty} Strafp.${p.skipped ? ' · <b>setzt aus</b>' : ''}`,
    seat: (p) => `${fanHTML(p.cards)}<span>${p.cards} Karten</span><span>Phase ${p.phase}${p.laidDone ? ' <b>✓ ausgelegt</b>' : ''}</span>${p.skipped ? '<b class="kg-call">setzt aus</b>' : ''}`,
    // „Stand“: Phasen aller Spieler als Tabelle
    standExtra(S) {
      const list = S.players.filter((p) => p.seated || p.inRound);
      if (!list.length || S.phase === 'lobby') return '';
      return `<h3>Phasen</h3><table class="standings ze-phases"><thead><tr><th>Name</th><th>Phase</th><th class="num">Strafpunkte</th></tr></thead><tbody>
        ${list.map((p) => `<tr><td><span class="mini-av">${avatarHTML(p)}</span> ${esc(p.name)}</td>
          <td><b>${p.phase ?? '–'}</b>/10 ${p.laidDone ? '<span class="ze-ok">✓ liegt</span>' : ''}<small class="ze-ptext">${esc(S.g?.phases?.[p.id] || '')}</small></td>
          <td class="num">${p.penalty ?? 0}</td></tr>`).join('')}</tbody></table>`;
    },
    hint(S, myTurn) {
      const g = S.g;
      if (skipFor !== null) return 'Wer soll aussetzen?';
      if (!myTurn) return `${esc(S.players.find((p) => p.id === S.turnId)?.name ?? '?')} ist dran – du kannst schon Karten in die Felder legen`;
      if (g.step === 'draw') return 'Zieh eine Karte – vom Stapel oder die oberste der Ablage';
      if (meOf(S)?.laidDone) return 'Leg Karten an (Karte wählen, Gruppe antippen) – zum Schluss eine Karte abwerfen';
      return 'Karten wählen, in ein Feld tippen, dann „Phase auslegen“ – zum Schluss abwerfen';
    },
    // Farbe: Rot, Grün, Blau, Gelb, dann Aussetzen und Joker; Zahl: 1–12, dann Aussetzen und Joker
    sort: {
      color: (c) => ('rgbysj'.indexOf(c.c)) * 100 + (c.n || 0),
      number: (c) => (c.c === 's' ? 1300 : c.c === 'j' ? 1400 : (c.n || 0) * 10 + 'rgby'.indexOf(c.c)),
    },
    // Ziehen (Maus): Karte auf die Ablage = abwerfen, auf eine Gruppe = anlegen, in ein Ausleg-Feld = dort hinein
    onDrop(src, z, S) {
      const id = Number(src.dataset.id);
      if (z.dataset.drop === 'slot') { putInSlot(S, [id], Number(z.dataset.i)); return; }
      picked = new Set([id]);
      kit.render();
      if (z.dataset.drop === 'discard') $('#kg-dock [data-g="discard"]')?.click(); // gleicher Weg wie der Knopf
      else if (z.dataset.drop === 'group') send('hit', { card: id, owner: z.dataset.owner, group: Number(z.dataset.group) });
    },
    onState(S) {
      const ids = new Set((S.g?.hand || []).map((c) => c.id));
      picked = new Set([...picked].filter((id) => ids.has(id)));
      const key = `${S.roundNo}:${S.g?.myPhase}:${(S.g?.myGroups || []).length}`;
      if (key !== slotKey || meOf(S)?.laidDone) { slotKey = key; slots = (S.g?.myGroups || []).map(() => []); }
      slots = slots.map((l) => l.filter((id) => ids.has(id)));
      if (S.turnId !== S.you?.id) skipFor = null;
    },
    main(S) {
      const g = S.g;
      const me = meOf(S);
      const name = (id) => esc(S.players.find((p) => p.id === id)?.name ?? '?');
      const playing = S.turnId === S.you?.id && g.step === 'play';
      const canHit = playing && picked.size === 1 && me?.laidDone;
      const dropHit = playing && me?.laidDone;
      // Eigene Phase groß, mit Fortschritt
      const n = Math.min(g.myPhase, 10);
      const phase = me?.inRound ? `<div class="ze-phase"><div><small>Deine Phase</small><b>Phase ${n}: ${esc(g.phaseText)}</b></div>
        <div class="ze-progress" role="img" aria-label="Phase ${n} von 10">${[...Array(10)].map((_, i) => `<i class="${i < n - 1 ? 'done' : i === n - 1 ? 'now' : ''}"></i>`).join('')}<span>${n}/10</span></div></div>` : '';
      // Ausleg-Felder (solange die eigene Phase nicht liegt)
      const area = me?.inRound && !me.laidDone && g.myGroups.length ? `<div class="ze-slots" role="group" aria-label="Ausleg-Felder">${g.myGroups.map((gr, i) => {
        const cards = slots[i].map((id) => g.hand.find((c) => c.id === id)).filter(Boolean);
        const ok = slotOk(S, i);
        return `<div class="ze-slot ${ok ? 'ok' : ''}" data-drop="slot" data-i="${i}">
          <button type="button" class="ze-slot-head" data-g="slot" data-i="${i}" ${picked.size ? '' : 'disabled'} aria-label="${groupName(gr)}${picked.size ? ` – ${picked.size} gewählte Karten hineinlegen` : ''}">
            <b>${groupName(gr)}</b><small>${cards.length}/${gr.size}${S.settings.exactSize ? '' : '+'}</small>${ok ? '<span class="ze-ok">✓ passt</span>' : ''}</button>
          <div class="ze-slot-cards">${cards.length ? cards.map((c) => card(c, { attrs: `data-g="unslot" data-id="${c.id}" title="Zurück auf die Hand"` })).join('') : `<span class="ze-empty">${picked.size ? 'Hier antippen' : 'Karten wählen, dann hier antippen'}</span>`}</div>
        </div>`;
      }).join('')}</div>` : '';
      const laid = Object.entries(g.laid).filter(([, gs]) => gs.length).map(([id, gs]) => `<div class="ze-laid"><b>${name(id)}</b>${gs.map((gr, i) => `
        <button type="button" class="ze-group ${canHit ? 'can' : ''}" data-g="hit" data-owner="${id}" data-group="${i}" ${dropHit ? 'data-drop="group"' : ''} ${canHit ? '' : 'disabled'} aria-label="Gruppe ${TYPE[gr.type]} von ${name(id)}${canHit ? ' – anlegen' : ''}">
          <small>${TYPE[gr.type]}</small><span class="ze-cards">${gr.cards.map((c) => card(c, { tag: 'span' })).join('')}</span></button>`).join('')}</div>`).join('');
      const top = g.top ? card(g.top, { cls: 'big', attrs: 'disabled' }) : '<div class="kc kc-empty"></div>';
      return `<div class="kg-table">
        <div class="ze-top">${phase}
        <div class="kg-piles"><div class="kg-pile">${backCard(g.deck)}<small>Stapel</small></div><div class="kg-pile" ${playing ? 'data-drop="discard"' : ''}>${top}<small>Ablage</small></div></div></div>
        ${area}
        <div class="ze-table">${laid || '<p class="hint">Noch hat niemand eine Phase ausgelegt.</p>'}</div>
      </div>`;
    },
    dock(S, myTurn) {
      const g = S.g;
      const used = inSlots();
      const hand = (g.hand || []).filter((c) => !used.has(c.id)).map((c) => card(c, { cls: picked.has(c.id) ? 'sel' : '', attrs: `data-g="pick" data-id="${c.id}" aria-pressed="${picked.has(c.id)}" data-drag="${c.id}"` })).join('');
      let acts = '';
      if (skipFor !== null) {
        const others = S.players.filter((p) => p.inRound && p.id !== S.you.id);
        acts = `${others.map((p) => `<button class="btn" data-g="skipwho" data-who="${esc(p.id)}">${esc(p.name)} aussetzen lassen</button>`).join('')}<button class="btn btn-ghost" data-g="noskip">Abbrechen</button>`;
      } else if (myTurn && g.step === 'draw') {
        acts = `<button class="btn btn-brass" data-g="draw-deck">Vom Stapel ziehen</button>
          <button class="btn" data-g="draw-discard" ${!g.top || g.top.c === 's' ? 'disabled title="Aussetzen darf man nicht aufnehmen"' : ''}>Ablage nehmen</button>`;
      } else if (myTurn) {
        const done = meOf(S)?.laidDone;
        const ready = !done && slots.length && slots.every((_, i) => slotOk(S, i));
        acts = `${done ? '' : `<button class="btn ${ready ? 'btn-brass' : ''}" data-g="lay" ${ready ? '' : 'disabled title="Erst alle Felder passend füllen"'}>Phase auslegen</button>`}
          <button class="btn" data-g="discard" ${picked.size === 1 ? '' : 'disabled title="Genau eine Karte auswählen"'}>Abwerfen</button>`;
      }
      return `<div class="kg-hand" role="group" aria-label="Deine Karten">${hand || '<span class="hint">Alle Karten liegen in den Feldern</span>'}</div><div class="kg-acts">${acts}</div>`;
    },
    async onClick(t, S) {
      const g = t.dataset.g;
      if (g === 'pick') { const id = Number(t.dataset.id); if (picked.has(id)) picked.delete(id); else picked.add(id); kit.render(); }
      else if (g === 'slot') putInSlot(S, [...picked], Number(t.dataset.i));
      else if (g === 'unslot') { const id = Number(t.dataset.id); slots = slots.map((l) => l.filter((x) => x !== id)); kit.render(); }
      else if (g === 'draw-deck') send('draw', { from: 'deck' });
      else if (g === 'draw-discard') send('draw', { from: 'discard' });
      else if (g === 'lay') send('lay', { cards: slots.flat() }).then((r) => { if (r?.ok) { slots = slots.map(() => []); picked.clear(); } });
      else if (g === 'hit') send('hit', { card: [...picked][0], owner: t.dataset.owner, group: Number(t.dataset.group) });
      else if (g === 'discard') {
        const id = [...picked][0];
        const c = S.g.hand.find((x) => x.id === id);
        // Aussetzen mit freier Wahl: Knöpfe mit den Namen statt Eintippen
        if (c?.c === 's' && S.settings.skipChoose) { skipFor = id; kit.render(); return; }
        const target = c?.c === 's' ? S.players.find((p) => p.inRound && p.id !== S.you.id)?.id : '';
        send('discard', { card: id, target }).then((r) => { if (r?.ok) picked.clear(); });
      } else if (g === 'skipwho') { const id = skipFor; skipFor = null; send('discard', { card: id, target: t.dataset.who }).then((r) => { if (r?.ok) picked.clear(); }); }
      else if (g === 'noskip') { skipFor = null; kit.render(); }
    },
    rules: `<p>Zehn Phasen nacheinander. Jede Runde versuchst du, deine aktuelle Phase auszulegen:</p>
      <ol class="ze-list"><li>2 Drillinge</li><li>Drilling + 4er-Folge</li><li>Vierling + 4er-Folge</li><li>7er-Folge</li><li>8er-Folge</li>
        <li>9er-Folge</li><li>2 Vierlinge</li><li>7 Karten einer Farbe</li><li>Fünfling + Zwilling</li><li>Fünfling + Drilling</li></ol>
      <ul>
        <li><b>Zug:</b> eine Karte ziehen (Stapel oder Ablage), dann evtl. auslegen, dann eine Karte abwerfen.</li>
        <li><b>Auslegen:</b> Karten wählen und in die Felder deiner Phase tippen (am Computer auch hineinziehen). Passt ein Feld, steht dort ✓.</li>
        <li>Wer ausgelegt hat, darf in späteren Zügen Karten an alle ausgelegten Gruppen <b>anlegen</b>.</li>
        <li><b>Joker</b> (J) ersetzen jede Karte. <b>Aussetzen</b> abwerfen: jemand deiner Wahl setzt einmal aus.</li>
        <li>Die Runde endet, wenn jemand keine Karten mehr hat. Wer seine Phase ausgelegt hat, ist eine weiter.</li>
        <li>Strafpunkte für Restkarten: 1–9 = 5, 10–12 = 10, Aussetzen 15, Joker 25.</li>
        <li>Wer zuerst Phase 10 schafft, gewinnt das Spiel (bei Gleichstand weniger Strafpunkte).</li>
      </ul>`,
  });

  // Gewählte Karten in ein Ausleg-Feld legen (aus anderen Feldern werden sie dabei herausgenommen)
  function putInSlot(S, ids, i) {
    if (!ids.length || !slots[i]) return;
    slots = slots.map((l, k) => (k === i ? [...l.filter((x) => !ids.includes(x)), ...ids] : l.filter((x) => !ids.includes(x))));
    picked.clear();
    kit.render();
  }
}
