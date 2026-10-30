// Phase 10 im Browser (Regeln: games/zehnetappen/room.js).
// Hand: Karte antippen = in die aktive Gruppe der Phase legen (Feld über der Hand antippen = Gruppe wechseln), nochmal antippen = zurück.
// Ist die Phase ausgelegt: Karte wählen, dann leuchten die Auslagen, an die sie passt (Anlegen). „Abwerfen“ ist ein eigener Modus (roter Rand, Ablage leuchtet).
// Die Prüfung im Browser ist nur Anzeige – der Server entscheidet.
'use strict';
{
  const COLOR = { r: 'Rot', g: 'Grün', b: 'Blau', y: 'Gelb' };
  const SKIP = '<svg class="sym" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="3"/><path d="M6.5 17.5l11-11" stroke="currentColor" stroke-width="3"/></svg>';
  let picked = new Set();  // gewählte Karte(n) zum Anlegen oder Abwerfen
  let slots = [];          // Ausleg-Felder: je Gruppe der Phase eine Liste von Karten-IDs
  let active = 0;          // aktive Gruppe: dorthin kommen angetippte Karten
  let mode = null;         // null = Standard (Auslegen bzw. Anlegen), 'discard' = Abwerfen
  let slotKey = '';        // Runde + Phase – wechselt sie, werden die Felder geleert
  let skipFor = null;      // Aussetzen-Karte, für die gerade jemand gewählt wird

  // Karte im bekannten Aufbau: Farbe, große Zahl in der Mitte, kleine in den Ecken; Joker mit „J“, Aussetzen mit eigenem Zeichen
  const card = (c, { cls = '', attrs = '', tag = 'button', badge = '' } = {}) => {
    const label = c.c === 'j' ? 'Joker' : c.c === 's' ? 'Aussetzen' : `${COLOR[c.c]} ${c.n}`;
    const corner = c.c === 'j' ? 'J' : c.c === 's' ? SKIP : c.n;
    const face = c.c === 'j' ? I18n.html('<b class="ze-j">J</b><small>Joker</small>') : c.c === 's' ? I18n.html`${SKIP}<small>Aussetzen</small>` : `<b>${c.n}</b>`;
    return `<${tag} ${tag === 'button' ? 'type="button"' : 'role="img"'} class="kc kc-ze ze-${c.c} ${cls}" ${attrs} aria-label="${label}">${colorMark(c.c)}
      <span class="cr tl">${corner}</span><span class="v">${face}</span><span class="cr br">${corner}</span>${badge}</${tag}>`;
  };
  const TYPE = { set: 'gleiche Zahl', run: 'Folge', color: 'eine Farbe' };
  const SET_WORD = { 2: 'Zwilling', 3: 'Drilling', 4: 'Vierling', 5: 'Fünfling' };
  const groupName = (gr) => (gr.type === 'set' ? SET_WORD[gr.size] : gr.type === 'run' ? I18n.html`${gr.size}er-Folge` : I18n.html`${gr.size} einer Farbe`);
  // Passen die Karten als Gruppe? (wie auf dem Server: Joker füllen Lücken, Aussetzen nie, mindestens eine echte Karte)
  function validGroup(type, cards) {
    if (cards.some((c) => c.c === 's')) return false;
    const nat = cards.filter((c) => c.c !== 'j');
    if (!nat.length) return false;
    if (type === 'set') return new Set(nat.map((c) => c.n)).size <= 1;
    if (type === 'color') return new Set(nat.map((c) => c.c)).size <= 1;
    if (cards.length > 12) return false;
    const ns = nat.map((c) => c.n);
    if (new Set(ns).size !== ns.length) return false;
    return Math.max(...ns) - Math.min(...ns) + 1 <= cards.length;
  }
  // Kurzer Grund, warum ein Feld noch nicht passt (null = passt)
  function reason(gr, cards, exact) {
    if (!cards.length) return I18n.html`noch ${gr.size} Karten`;
    if (cards.some((c) => c.c === 's')) return 'Aussetzen gehört in keine Gruppe';
    const nat = cards.filter((c) => c.c !== 'j');
    if (!nat.length) return 'mindestens eine echte Karte nötig';
    if (gr.type === 'set' && new Set(nat.map((c) => c.n)).size > 1) return 'verschiedene Zahlen';
    if (gr.type === 'color' && new Set(nat.map((c) => c.c)).size > 1) return 'verschiedene Farben';
    if (gr.type === 'run') {
      const ns = nat.map((c) => c.n).sort((a, b) => a - b);
      const dup = ns.find((n, i) => n === ns[i - 1]);
      if (dup) return I18n.html`${dup} doppelt`;
      if (cards.length > 12) return 'höchstens 12 Karten';
      if (ns[ns.length - 1] - ns[0] + 1 > cards.length) { for (let v = ns[0]; v <= ns[ns.length - 1]; v++) if (!ns.includes(v)) return I18n.html`keine Folge – ${v} fehlt`; }
    }
    if (cards.length < gr.size) return I18n.html`noch ${gr.size - cards.length} Karte${gr.size - cards.length === 1 ? '' : 'n'}`;
    if (exact && cards.length > gr.size) return I18n.html`genau ${gr.size} Karten`;
    return null;
  }
  // Passt die Karte an diese ausgelegte Gruppe? Seiten: 'set' (Satz/Farbe), 'high', 'low' – wie auf dem Server (Joker haben feste Werte)
  function sides(gr, c) {
    if (c.c === 's') return [];
    if (gr.type === 'set') return c.c === 'j' || c.n === gr.vals[0] ? ['set'] : [];
    if (gr.type === 'color') return c.c === 'j' || c.c === gr.vals[0] ? ['set'] : [];
    const lo = gr.vals[0], hi = gr.vals[gr.vals.length - 1];
    if (c.c === 'j') return [...(hi < 12 ? ['high'] : []), ...(lo > 1 ? ['low'] : [])];
    return c.n === hi + 1 && hi < 12 ? ['high'] : c.n === lo - 1 && lo > 1 ? ['low'] : [];
  }
  const jokerLabel = (gr, i) => `★ = ${gr.type === 'color' ? COLOR[gr.vals[i]] : gr.vals[i]}`;
  const groupCards = (gr, tag = 'span') => gr.cards.map((c, i) => (c.c === 'j'
    ? `<span class="ze-cw">${card(c, { tag })}<small class="ze-jv">${jokerLabel(gr, i)}</small></span>` : card(c, { tag }))).join('');

  const meOf = (S) => S.players.find((p) => p.id === S.you?.id);
  const handCard = (S, id) => S.g.hand.find((c) => c.id === id);
  const slotCards = (S, i) => (slots[i] || []).map((id) => handCard(S, id)).filter(Boolean);
  const slotReason = (S, i) => reason(S.g.myGroups[i], slotCards(S, i), S.settings.exactSize);
  const slotOk = (S, i) => slotReason(S, i) === null;
  const slotOf = (id) => slots.findIndex((l) => l.includes(id));
  // Modus: 'lay' (Phase vorbereiten), 'hit' (anlegen), 'discard' (abwerfen)
  const modeOf = (S) => (mode === 'discard' ? 'discard' : meOf(S)?.laidDone ? 'hit' : 'lay');
  const canAct = (S) => S.turnId === S.you?.id && S.g?.step === 'play';

  function doDiscard(S) {
    const id = [...picked][0];
    const c = handCard(S, id);
    if (!c) return;
    // Aussetzen mit freier Wahl: Knöpfe mit den Namen statt Eintippen
    if (c.c === 's' && S.settings.skipChoose) { skipFor = id; kit.render(); return; }
    const target = c.c === 's' ? S.players.find((p) => p.inRound && p.id !== S.you.id)?.id : '';
    send('discard', { card: id, target }).then((r) => { if (r?.ok) { picked.clear(); mode = null; } });
  }
  function doHit(S, owner, group, end) {
    const id = [...picked][0];
    if (id === undefined) return;
    send('hit', { card: id, owner, group, end }).then((r) => { if (r?.ok) picked.clear(); });
  }

  const kit = kitGame({
    id: 'zehnetappen',
    look(S) {
      const laid = Object.entries(S.g.laid).filter(([, gs]) => gs.length).map(([id, gs]) => I18n.html`<div class="look-pile"><h4>${esc(S.players.find((p) => p.id === id)?.name ?? '?')} · Phase ${S.players.find((p) => p.id === id)?.phase ?? ''}</h4>${gs.map((gr) => `<p class="hint" style="margin:6px 0 2px">${TYPE[gr.type]}</p><div class="look-fan">${groupCards(gr)}</div>`).join('')}</div>`).join('');
      const thrown = S.moves.filter((m) => m.t === 'wirft ab' && m.d).slice(-5).map((m) => card(m.d, { tag: 'span' }));
      return [{ title: 'Ausgelegte Phasen', html: laid || I18n.html('<p class="hint">Noch hat niemand eine Phase ausgelegt.</p>') },
        { title: 'Ablage – die letzten 5 Karten', note: 'Ganz rechts liegt die oberste Karte.', html: lookFan(thrown, { topLabel: 'oben' }) }];
    },
    moveDetail: (m) => (m.d && m.d.c ? `<span class="look-d">${m.d.c === 'j' ? 'Joker' : m.d.c === 's' ? 'Aussetzen' : `${COLOR[m.d.c]} ${m.d.n}`}</span>` : ''),
    name: 'Phase 10',
    // Erste Schritte beim ersten Spiel (3 Schritte, abschaltbar unter „Ich“)
    intro: [
      ["Ziel", "Schaff die zehn Phasen nacheinander. Deine aktuelle Phase steht oben groß."],
      ["Dein Zug", "Erst eine Karte ziehen (Stapel oder Ablage), zum Schluss eine Karte abwerfen."],
      ["Auslegen", "Karten antippen: Sie wandern in die aktive Gruppe über deiner Hand. Steht überall ✓, tippst du „Phase auslegen“."],
    ],
    short: [
      "Jede Runde versuchst du, deine aktuelle Phase auszulegen (Liste unter „Alle Regeln“). Die Mengen sind Mindestangaben – du darfst mehr Karten legen.",
      "Zug: eine Karte ziehen (Stapel oder Ablage), evtl. auslegen und anlegen, eine Karte abwerfen.",
      I18n.html("<b>J</b> Joker ersetzen jede Karte, bleiben in Auslagen aber fest liegen. Aussetzen lässt jemanden einmal aussetzen."),
      "Wer seine Phase ausgelegt hat, darf überall anlegen.",
      "Die Runde ist vorbei, wenn jemand keine Karten mehr hat – wer ausgelegt hat, kommt eine Phase weiter.",
      "Wer zuerst Phase 10 schafft, gewinnt (Gleichstand: weniger Strafpunkte).",
    ],
    house: (S) => (S.settings.exactSize ? [I18n.t('Phase nur mit genauer Kartenanzahl auslegen')] : []),
    playerInfo: (p, S) => I18n.html`Phase ${p.phase}${p.laidDone ? ' ✓' : ''} · ${p.cards} Karten · ${p.penalty} Strafp.${p.skipped ? I18n.html(' · <b>setzt aus</b>') : ''}${p.partner ? I18n.html` · Partner: ${esc(S.players.find((q) => q.id === p.partner)?.name || '')}` : ''}`,
    seat: (p) => I18n.html`${fanHTML(p.cards)}<span>${p.cards} Karten</span><span>Phase ${p.phase}${p.laidDone ? I18n.html(' <b>✓ ausgelegt</b>') : ''}</span>${p.skipped ? I18n.html('<b class="kg-call">setzt aus</b>') : ''}`,
    // „Stand“: Phasen aller Spieler als Tabelle
    standExtra(S) {
      const list = S.players.filter((p) => p.seated || p.inRound);
      if (!list.length || S.phase === 'lobby') return '';
      return I18n.html`<h3>Phasen</h3><table class="standings ze-phases"><thead><tr><th>Name</th><th>Phase</th><th class="num">Strafpunkte</th></tr></thead><tbody>
        ${list.map((p) => `<tr><td><span class="mini-av">${avatarHTML(p)}</span> ${esc(p.name)}</td>
          <td><b>${p.phase ?? '–'}</b>/${S.variant === 'short' ? 5 : 10} ${p.laidDone ? I18n.html('<span class="ze-ok">✓ liegt</span>') : ''}<small class="ze-ptext">${esc(S.g?.phases?.[p.id] || '')}</small></td>
          <td class="num">${p.penalty ?? 0}</td></tr>`).join('')}</tbody></table>`;
    },
    hint(S, myTurn) {
      const g = S.g;
      const m = modeOf(S);
      if (skipFor !== null) return 'Wer soll aussetzen?';
      if (!myTurn) return I18n.html`${esc(S.players.find((p) => p.id === S.turnId)?.name ?? '?')} ist dran – du kannst schon Karten in die Gruppen legen`;
      if (g.step === 'draw') return 'Zieh eine Karte – vom Stapel oder die oberste der Ablage';
      if (m === 'discard') return 'Abwerfen: genau eine Karte wählen, dann „Abwerfen“ oder die Ablage antippen';
      if (m === 'hit') return picked.size ? 'Die leuchtenden Auslagen passen – antippen zum Anlegen' : 'Anlegen: Karte wählen – oder „Abwerfen“, wenn du fertig bist';
      return 'Karten antippen: Sie kommen in die aktive Gruppe. Passt alles, „Phase auslegen“ – zum Schluss abwerfen';
    },
    // Farbe: Rot, Grün, Blau, Gelb, dann Aussetzen und Joker; Zahl: 1–12, dann Aussetzen und Joker
    sort: {
      color: (c) => ('rgbysj'.indexOf(c.c)) * 100 + (c.n || 0),
      number: (c) => (c.c === 's' ? 1300 : c.c === 'j' ? 1400 : (c.n || 0) * 10 + 'rgby'.indexOf(c.c)),
    },
    // Ziehen (Maus): Karte in ein Ausleg-Feld, auf eine Auslage = anlegen, auf die Ablage = abwerfen
    onDrop(src, z, S) {
      const id = Number(src.dataset.id);
      if (z.dataset.drop === 'slot') { putInSlot(S, id, Number(z.dataset.i)); return; }
      if (z.dataset.drop === 'discard') { picked = new Set([id]); doDiscard(S); return; }
      if (z.dataset.drop === 'group') { picked = new Set([id]); doHit(S, z.dataset.owner, Number(z.dataset.group), null); }
    },
    onState(S) {
      const ids = new Set((S.g?.hand || []).map((c) => c.id));
      picked = new Set([...picked].filter((id) => ids.has(id)));
      const key = `${S.roundNo}:${S.g?.myPhase}:${(S.g?.myGroups || []).length}`;
      if (key !== slotKey || meOf(S)?.laidDone) { slotKey = key; slots = (S.g?.myGroups || []).map(() => []); active = 0; }
      slots = slots.map((l) => l.filter((id) => ids.has(id)));
      if (active >= slots.length) active = 0;
      if (S.turnId !== S.you?.id) { skipFor = null; mode = null; picked.clear(); }
    },
    main(S) {
      const g = S.g;
      const me = meOf(S);
      const name = (id) => esc(S.players.find((p) => p.id === id)?.name ?? '?');
      const playing = canAct(S);
      const m = modeOf(S);
      const one = picked.size === 1 ? handCard(S, [...picked][0]) : null;
      const hitting = playing && m === 'hit' && one;
      const limit = S.variant === 'short' ? 5 : 10, n = Math.min(g.myPhase, limit);
      const phase = me?.inRound ? I18n.html`<div class="ze-phase"><div><small>Deine Phase</small><b>Phase ${n}: ${esc(g.phaseText)}</b>${S.settings.exactSize ? '' : I18n.html('<small class="ze-min">Mengen sind Mindestangaben – mehr Karten sind erlaubt</small>')}</div>
        <div class="ze-progress" role="img" aria-label="Phase ${n} von ${limit}">${[...Array(limit)].map((_, i) => `<i class="${i < n - 1 ? 'done' : i === n - 1 ? 'now' : ''}"></i>`).join('')}<span>${n}/${limit}</span></div></div>` : '';
      const laid = Object.entries(g.laid).filter(([, gs]) => gs.length).map(([id, gs]) => `<div class="ze-laid"><b>${name(id)}</b>${gs.map((gr, i) => {
        const sd = hitting ? sides(gr, one) : [];
        const fits = sd.length > 0;
        const both = fits && one.c === 'j' && gr.type === 'run' && sd.length === 2;
        const label = I18n.html`Gruppe ${TYPE[gr.type]} von ${name(id)}${fits ? ' – passt, antippen zum Anlegen' : ''}`;
        return `<div class="ze-group ${fits ? 'can' : ''}" ${playing && m === 'hit' ? 'data-drop="group"' : ''} data-owner="${id}" data-group="${i}">
          <button type="button" class="ze-gbtn" data-g="hit" data-owner="${id}" data-group="${i}" ${fits && !both ? '' : 'disabled'} aria-label="${label}">
            <small>${TYPE[gr.type]}${gr.type === 'run' ? ` ${gr.vals[0]}–${gr.vals[gr.vals.length - 1]}` : ''}</small><span class="ze-cards">${groupCards(gr)}</span></button>
          ${both ? I18n.html`<span class="ze-ends"><button type="button" class="btn btn-sm btn-brass" data-g="hit" data-owner="${id}" data-group="${i}" data-end="low">unten (${gr.vals[0] - 1})</button><button type="button" class="btn btn-sm btn-brass" data-g="hit" data-owner="${id}" data-group="${i}" data-end="high">oben (${gr.vals[gr.vals.length - 1] + 1})</button></span>` : ''}</div>`;
      }).join('')}</div>`).join('');
      const targetPile = playing && m === 'discard' && picked.size === 1;
      const top = g.top ? card(g.top, { cls: 'big', attrs: 'disabled' }) : '<div class="kc kc-empty"></div>';
      return I18n.html`<div class="kg-table">
        <div class="ze-top">${phase}
        <div class="kg-piles"><div class="kg-pile">${backCard(g.deck)}<small>Stapel</small></div>
          <div class="kg-pile ${targetPile ? 'ze-target' : ''}" ${playing ? 'data-drop="discard"' : ''}><button type="button" class="ze-pile-btn" data-g="discard-pile" ${targetPile ? '' : 'disabled'} aria-label="Ablage${targetPile ? ' – hier abwerfen' : ''}">${top}</button><small>${targetPile ? 'Hier abwerfen' : I18n.t('Ablage')}</small></div></div></div>
        <div class="ze-table">${laid || I18n.html('<p class="hint">Noch hat niemand eine Phase ausgelegt.</p>')}</div>
      </div>`;
    },
    dock(S, myTurn) {
      const g = S.g;
      const me = meOf(S);
      const m = modeOf(S);
      const inRound = !!me?.inRound;
      // Ausleg-Leiste über der Hand: ein Feld je Gruppe
      const bar = inRound && !me.laidDone && g.myGroups.length && m !== 'discard' ? I18n.html`<div class="ze-slots" role="group" aria-label="Phase auslegen: Gruppen">${g.myGroups.map((gr, i) => {
        const cards = slotCards(S, i);
        const why = slotReason(S, i);
        const exact = S.settings.exactSize;
        return I18n.html`<div class="ze-slot ${why === null ? 'ok' : ''} ${active === i ? 'active' : ''}" data-drop="slot" data-i="${i}">
          <button type="button" class="ze-slot-head" data-g="slot" data-i="${i}" aria-pressed="${active === i}" aria-label="Gruppe ${i + 1}: ${groupName(gr)} wählen">
            <b>Gruppe ${i + 1}: ${groupName(gr)}</b><small>${cards.length}/${gr.size}${exact ? '' : '+'}${why === null ? ' ✓' : ''}</small></button>
          <div class="ze-slot-cards">${cards.length ? cards.map((c) => card(c, { attrs: `data-g="unslot" data-id="${c.id}" title="Zurück auf die Hand"` })).join('') : `<span class="ze-empty">${active === i ? 'Karten antippen – sie kommen hierher' : 'Feld antippen, dann Karten wählen'}</span>`}</div>
          <div class="ze-why ${why === null ? 'ok' : ''}" role="status">${why === null ? '✓ passt' : esc(why)}</div></div>`;
      }).join('')}</div>` : '';
      const chosen = m === 'lay' ? slots.flat().length : picked.size;
      const counter = inRound && (m === 'lay' || picked.size || m === 'discard')
        ? I18n.html`<div class="ze-count" role="status"><span>${chosen} ausgewählt${m === 'discard' ? ' (zum Abwerfen: genau 1)' : ''}</span>${chosen ? I18n.html('<button type="button" class="btn btn-sm btn-ghost" data-g="clear">Auswahl aufheben</button>') : ''}</div>` : '';
      const hand = (g.hand || []).map((c) => {
        const si = m === 'lay' ? slotOf(c.id) : -1;
        const isPick = picked.has(c.id);
        const cls = `${si >= 0 ? 'ze-sel' : ''} ${isPick ? (m === 'discard' ? 'ze-disc' : 'ze-sel') : ''}`;
        const badge = si >= 0 ? `<i class="ze-badge" aria-hidden="true">${si + 1}</i>` : '';
        return card(c, { cls, badge, attrs: `data-g="pick" data-id="${c.id}" aria-pressed="${si >= 0 || isPick}" data-drag="${c.id}"` });
      }).join('');
      let acts = '';
      if (skipFor !== null) {
        const others = S.players.filter((p) => p.inRound && p.id !== S.you.id);
        acts = I18n.html`${others.map((p) => I18n.html`<button class="btn" data-g="skipwho" data-who="${esc(p.id)}">${esc(p.name)} aussetzen lassen</button>`).join('')}<button class="btn btn-ghost" data-g="noskip">Abbrechen</button>`;
      } else if (myTurn && g.step === 'draw') {
        acts = I18n.html`<button class="btn btn-brass" data-g="draw-deck">Vom Stapel ziehen</button>
          <button class="btn" data-g="draw-discard" ${!g.top || g.top.c === 's' ? 'disabled title="Aussetzen darf man nicht aufnehmen"' : ''}>Ablage nehmen</button>`;
      } else if (myTurn) {
        const done = me?.laidDone;
        const ready = !done && slots.length && slots.every((_, i) => slotOk(S, i));
        acts = `${done ? '' : I18n.html`<button class="btn ${ready ? 'btn-brass' : ''}" data-g="lay" ${ready ? '' : 'disabled title="Erst alle Gruppen passend füllen"'}>Phase auslegen</button>`}
          ${m === 'discard' ? I18n.html`<button class="btn btn-outline-red ze-discard-btn" data-g="discard" ${picked.size === 1 ? '' : 'disabled title="Genau eine Karte auswählen"'}>Abwerfen</button><button class="btn btn-ghost" data-g="mode-back">${done ? 'Zurück zum Anlegen' : 'Zurück zum Auslegen'}</button>`
            : I18n.html`<button class="btn" data-g="mode-discard">Karte abwerfen …</button>`}`;
      }
      return I18n.html`${bar}${counter}<div class="kg-hand ze-hand" role="group" aria-label="Deine Karten">${hand}</div><div class="kg-acts">${acts}</div>`;
    },
    async onClick(t, S) {
      const g = t.dataset.g;
      const m = modeOf(S);
      if (g === 'pick') {
        const id = Number(t.dataset.id);
        if (m === 'lay') {
          if (slotOf(id) >= 0) slots = slots.map((l) => l.filter((x) => x !== id));
          else if (slots.length) putInSlot(S, id, active);
          kit.render();
        } else if (picked.has(id)) { picked.delete(id); kit.render(); }
        else { picked = new Set([id]); kit.render(); } // anlegen/abwerfen: genau eine Karte
      } else if (g === 'slot') { active = Number(t.dataset.i); kit.render(); }
      else if (g === 'unslot') { const id = Number(t.dataset.id); slots = slots.map((l) => l.filter((x) => x !== id)); kit.render(); }
      else if (g === 'clear') { picked.clear(); slots = slots.map(() => []); kit.render(); }
      else if (g === 'mode-discard') { mode = 'discard'; picked.clear(); kit.render(); }
      else if (g === 'mode-back') { mode = null; picked.clear(); kit.render(); }
      else if (g === 'draw-deck') send('draw', { from: 'deck' });
      else if (g === 'draw-discard') send('draw', { from: 'discard' });
      else if (g === 'lay') send('lay', { cards: slots.flat(), groups: slots }).then((r) => { if (r?.ok) { slots = slots.map(() => []); picked.clear(); } });
      else if (g === 'hit') doHit(S, t.dataset.owner, Number(t.dataset.group), t.dataset.end || null);
      else if (g === 'discard' || g === 'discard-pile') { if (picked.size === 1) doDiscard(S); }
      else if (g === 'skipwho') { const id = skipFor; skipFor = null; send('discard', { card: id, target: t.dataset.who }).then((r) => { if (r?.ok) { picked.clear(); mode = null; } }); }
      else if (g === 'noskip') { skipFor = null; kit.render(); }
    },
    rules: I18n.html`<p>Zehn Phasen nacheinander. Jede Runde versuchst du, deine aktuelle Phase auszulegen:</p>
      <ol class="ze-list"><li>2 Drillinge</li><li>Drilling + 4er-Folge</li><li>Vierling + 4er-Folge</li><li>7er-Folge</li><li>8er-Folge</li>
        <li>9er-Folge</li><li>2 Vierlinge</li><li>7 Karten einer Farbe</li><li>Fünfling + Zwilling</li><li>Fünfling + Drilling</li></ol>
      <ul>
        <li><b>Zug:</b> eine Karte ziehen (Stapel oder Ablage), dann evtl. auslegen, dann eine Karte abwerfen.</li>
        <li><b>Mindestmengen:</b> „4er-Folge“ heißt mindestens vier Karten in Folge, „Drilling“ mindestens drei gleiche, „7 einer Farbe“ mindestens sieben. Du darfst also gleich mehr Karten in eine Gruppe legen (Hausregel im Host-Menü: nur die genaue Anzahl).</li>
        <li><b>Auslegen:</b> Karten antippen – sie kommen in die aktive Gruppe über deiner Hand (Gruppe wechseln: Feld antippen). Jedes Feld zeigt, ob es passt. Am Computer kannst du Karten auch ziehen.</li>
        <li>Wer ausgelegt hat, darf in späteren Zügen Karten an alle ausgelegten Gruppen <b>anlegen</b>: Karte wählen, die leuchtenden Auslagen passen. Folgen wachsen an beiden Enden.</li>
        <li><b>Joker</b> (J) ersetzen jede Karte. In Auslagen bekommt jeder Joker beim Legen einen <b>festen Wert</b> (steht als „★ = 7“ dabei) und bleibt für immer liegen – er lässt sich nicht tauschen oder aufnehmen. <b>Aussetzen</b> abwerfen: jemand deiner Wahl setzt einmal aus.</li>
        <li>Die Runde endet, wenn jemand keine Karten mehr hat. Wer seine Phase ausgelegt hat, ist eine weiter.</li>
        <li>Strafpunkte für Restkarten: 1–9 = 5, 10–12 = 10, Aussetzen 15, Joker 25.</li>
        <li>Wer zuerst Phase 10 schafft, gewinnt das Spiel (bei Gleichstand weniger Strafpunkte).</li>
      </ul>`,
  });

  // Karte in ein Ausleg-Feld legen (aus anderen Feldern wird sie dabei herausgenommen)
  function putInSlot(S, id, i) {
    if (!slots[i]) return;
    slots = slots.map((l, k) => (k === i ? [...l.filter((x) => x !== id), id] : l.filter((x) => x !== id)));
    active = i;
    kit.render();
  }
}
