// UNO im Browser (Regeln: games/farbenchaos/room.js). Bedienung wie Mau-Mau (kitShedding), eigene Karten.
'use strict';
{
  const tx = (de, en) => I18n.language === 'en' ? en : de;
  const variantLabel = (S) => ({ classic: tx('Klassisch', 'Classic'), flip: 'Flip', 'no-mercy': 'No Mercy', 'all-wild': 'All Wild' }[S.variant] || tx('Klassisch', 'Classic'));
  const variantBrief = (S) => ({
    classic: tx('Gleiche Farbe. Gleiche Zahl. Dein nächster Zug.', 'Match a colour. Match a number. Make your move.'),
    flip: tx('Zwei Seiten. Neue Farben. Eine überraschende Wendung.', 'Two sides. New colours. An unexpected turn.'),
    'no-mercy': tx('Große Aktionen. Klare Entscheidungen. Bei 25 Karten scheidest du aus.', 'Big actions. Clear choices. Reaching 25 cards eliminates you.'),
    'all-wild': tx('Jede Karte passt. Welche Aktion spielst du?', 'Every card fits. Which action will you play?'),
  }[S.variant] || '');
  const COLOR = { r: 'Rot', y: 'Gelb', g: 'Grün', b: 'Blau', w: 'Schwarz', p: 'Pink', t: 'Türkis', o: 'Orange', v: 'Lila' };
  const LABEL = { S: 'Aussetzen', R: 'Richtungswechsel', D: 'plus zwei', W: 'Farbwahl', F: 'plus vier', I: 'plus eins', H: 'plus fünf', B: 'Farbwahl plus zwei', L: 'Flip', E: 'Alle aussetzen', C: 'Zieh bis Farbe', A: 'Alle ablegen', U: 'plus sechs', Z: 'plus zehn', V: 'Richtung plus vier', Q: 'Farbroulette', K: 'Zwei aussetzen', T: 'Gezieltes plus zwei', X: 'Hände tauschen' };
  // Symbole selbst gezeichnet: Aussetzen = Kreis mit Strich, Richtungswechsel = zwei Pfeile, Farbwahl = vierfarbiger Kreis
  const SKIP = '<svg class="sym" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="3"/><path d="M6.5 17.5l11-11" stroke="currentColor" stroke-width="3"/></svg>';
  const REV = '<svg class="sym" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h12M12 4.5 16.5 9 12 13.5M20 15H8M12 10.5 7.5 15 12 19.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const WHEEL = '<span class="wheel" aria-hidden="true"></span>';
  const BIG = { S: SKIP, R: REV, D: '+2', W: WHEEL, F: '+4', I: '+1', H: '+5', B: '+2', L: '↻', E: '⊘∀', C: '+色', A: '↓∀', U: '+6', Z: '+10', V: '⇄+4', Q: '色↻', K: '⊘2', T: '◎+2', X: '⇆' };
  const CORNER = { ...BIG, W: '<span class="wheel mini"></span>' };
  // Karte: zwei Zeichen, Wert + Farbe (z. B. "7r", "Sg", "Fw"). Aufbau wie gewohnt: Werte in zwei Ecken, groß im schrägen Oval.
  const card = (c, { cls = '', attrs = '' } = {}) => {
    const corner = CORNER[c[0]] || c[0];
    return `<button type="button" class="kc kc-fc fc-${c[1]} ${cls}" ${attrs} aria-label="${esc(`${c[1] === 'w' ? '' : COLOR[c[1]] + ' '}${LABEL[c[0]] || c[0]}`)}">${colorMark(c[1])}
      <span class="cr tl">${corner}</span><span class="oval"><span class="v ${c[0] === '6' || c[0] === '9' ? 'ul' : ''}">${BIG[c[0]] || c[0]}</span></span><span class="cr br">${corner}</span></button>`;
  };
  const ADJ = { r: 'rote', y: 'gelbe', g: 'grüne', b: 'blaue' };
  const VALUE_ACC = { S: 'ein Aussetzen', R: 'einen Richtungswechsel', D: 'eine +2' };
  const VALS = '0123456789SRDWF';
  const COLORS = 'rygbw';
  kitShedding({
    id: 'farbenchaos',
    name: 'UNO',
    ring: false,
    lobby(S) {
      const players = S.players.filter((p) => p.seated), ready = players.length >= S.minPlayers;
      return `<section class="cw-lobby fc-lobby"><div class="cw-lobby-art fc-lobby-art" aria-hidden="true"><div class="fc-colour-orbit"></div>${(S.variant === 'all-wild' ? ['Ww','Rw','Dw','Fw'] : S.variant === 'flip' ? ['7r','Lb','Iy','9g'] : ['7r','Rb','Dy','9g']).map((c, i) => `<span style="--fan:${i}">${card(c, { attrs: 'disabled' })}</span>`).join('')}<span class="cw-art-caption">${variantLabel(S)} · ${S.variant === 'flip' ? tx('Zwei Kartenseiten', 'Two card sides') : S.variant === 'all-wild' ? tx('Jede Karte passt', 'Every card fits') : tx('Vier Farben', 'Four colours')}</span></div><div class="cw-brief"><span class="cw-eyebrow">UNO · ${variantLabel(S)}</span><h2>${tx('Farbe bekennen.<br>Karten loswerden.', 'Show your colours.<br>Play your hand.')}</h2><p class="cw-lead">${variantBrief(S)}</p><div class="cw-facts"><span><b>${S.minPlayers === S.maxPlayers ? S.minPlayers : `${S.minPlayers}–${S.maxPlayers}`}</b>${tx('Spieler', 'Players')}</span><span><b>${S.variant === 'all-wild' ? tx('Aktion', 'Action') : tx('Farbe', 'Colour')}</b>${S.variant === 'all-wild' ? tx('Jede Karte passt', 'Every card fits') : tx('oder Zahl / Symbol', 'or number / symbol')}</span><span><b>UNO!</b>${tx('Die letzte Karte zählt', 'Make your last card count')}</span></div><div class="cw-ready"><i class="${ready ? 'ready' : ''}"></i><b>${ready ? tx('Bereit für die nächste Runde', 'Ready for the next round') : tx('Warten auf Mitspieler', 'Waiting for players')}</b><span>${players.length}/${S.maxPlayers}</span></div><ul class="cw-roster">${players.map((p) => `<li><span class="cw-player-initial">${esc(Array.from(p.name)[0] || '?')}</span>${esc(p.name)}${p.id === S.you?.id ? `<small>${tx('du', 'you')}</small>` : ''}</li>`).join('')}</ul><p class="cw-footnote">${S.you?.isHost ? tx('Starte unten, sobald alle bereit sind. Bots und Hausregeln findest du im Host-Menü.', 'Start below when everyone is ready. Bots and house rules are in the host menu.') : tx('Der Host startet. Deine Hand bleibt nur für dich sichtbar.', 'The host will start. Only you can see your hand.')}</p></div><div class="cw-brief-steps"><article><b>01</b><span>${tx('Passend ablegen', 'Find your match')}</span><p>${S.variant === 'all-wild' ? tx('Jede Karte passt. Lies ihre Aktion, bevor du sie spielst.', 'Every card fits. Read its action before playing it.') : tx('Farbe, Zahl oder Symbol – die passende Karte hat einen klaren Rand.', 'Colour, number or symbol — playable cards have a clear outline.')}</p></article><article><b>02</b><span>${tx('Aktionen lesen', 'Read the action')}</span><p>${tx('Richtung, Ziehstrafe und Farbwahl bleiben auf dem Tisch sichtbar.', 'Direction, draw penalties and colour choices stay visible on the table.')}</p></article><article><b>03</b><span>${tx('Die letzte Karte', 'Your last card')}</span><p>${tx('Die geltenden Ansage- und Erwischen-Regeln stehen unter „?“.', 'Find the current call and catch rules under “?”.')}</p></article></div></section>`;
    },
    tableIntro(S) {
      const g = S.g, color = g.top?.[1] === 'w' ? g.wish : g.top?.[1];
      const name = esc(S.players.find((p) => p.id === S.turnId)?.name || '');
      return `<header class="cw-table-head fc-table-head"><div><span class="cw-eyebrow">UNO · ${variantLabel(S)}</span><h2>${tx('Deine nächste Karte.', 'Your next card.')}</h2></div><span class="cw-turn ${S.turnId === S.you?.id ? 'is-mine' : ''}">${S.phase === 'over' ? tx('Runde beendet', 'Round complete') : S.turnId === S.you?.id ? tx('Du bist am Zug', 'Your turn') : `${name} · ${tx('am Zug', 'on turn')}`}</span></header><div class="fc-state-strip"><span class="fc-current-colour fc-${color || 'w'}">${colorMark(color || 'w')}<b>${S.variant === 'all-wild' ? tx('Alle Karten passen', 'Every card fits') : color ? I18n.t(COLOR[color]) : tx('Freie Farbwahl', 'Open colour choice')}</b></span><span>${S.dir < 0 ? '↶' : '↷'} ${tx('Spielrichtung', 'Direction')}</span>${S.variant === 'flip' ? `<span class="fc-side-state">${g.side ? '◐' : '◒'} ${g.side ? tx('Dunkle Seite', 'Dark side') : tx('Helle Seite', 'Light side')}</span>` : ''}${g.pending ? `<strong>+${g.pending} ${tx('ziehen', 'to draw')}</strong>` : ''}</div>`;
    },
    resultExtra(S) {
      const involved = S.result.players?.includes(S.you?.id), won = S.result.winners.includes(S.you?.id);
      return `<div class="cw-result fc-result"><span class="cw-eyebrow">UNO · ${variantLabel(S)}</span><h3>${won ? tx('Diese Runde gehört dir.', 'This round is yours.') : tx('Neue Runde, neue Farben.', 'New round, new colours.')}</h3><p>${involved ? won ? tx('Du gewinnst diese Runde.', 'You win this round.') : tx('Der Rundensieg geht an die andere Seite.', 'The other side takes this round.') : tx('Die Wertung steht oben. Die nächste Runde startet der Host.', 'The scores are above. The host starts the next round.')}</p></div>`;
    },
    // Erste Schritte beim ersten Spiel (3 Schritte, abschaltbar unter „Ich“)
    intro: [
      ["Ziel", I18n.html("Werde als Erster alle Karten los: gleiche <b>Farbe</b> oder gleiche <b>Zahl bzw. gleiches Symbol</b>.")],
      ["Bedienung", "Karten mit Goldrand passen – antippen legt sie. Bei der Farbwahl tippst du einen der vier Farbkreise an."],
      ["Sonderkarten", "Aussetzen, Richtungswechsel, +2, Farbwahl und +4. Der Gewinner kassiert die Punkte der Restkarten. Welche Hausregeln gelten, steht unter „?“."],
    ],
    card,
    // „Leg eine rote Karte oder eine 7“ – was gerade passt
    playHint(g) {
      const color = g.top[1] === 'w' ? g.wish : g.top[1];
      const parts = color ? [I18n.html`eine ${ADJ[color]} Karte`] : [];
      if (g.top[1] !== 'w') parts.push(VALUE_ACC[g.top[0]] || I18n.html`eine ${g.top[0]}`);
      if (g.playable.some((c) => c[1] === 'w')) parts.push('eine schwarze');
      return parts.length ? I18n.html`Leg ${parts.join(' oder ')}` : 'Leg eine beliebige Karte';
    },
    pendingHint: () => 'Leg eine Plus-Karte drauf',
    pendingText: (g) => I18n.html`+${g.pending}: der Nächste zieht ${g.pending}, außer er legt eine Plus-Karte drauf`,
    sort: {
      color: (c) => COLORS.indexOf(c[1]) * 100 + VALS.indexOf(c[0]),
      number: (c) => VALS.indexOf(c[0]) * 10 + COLORS.indexOf(c[1]),
    },
    needsWish: (c, S) => S.variant !== 'all-wild' && c[1] === 'w' && c[0] !== 'Q',
    needsTarget: (c, S) => (S.variant === 'no-mercy' || S.settings.sevenZero) && c[0] === '7' || S.variant === 'all-wild' && ['T', 'X'].includes(c[0]),
    // Farbwahl: vier große Farbkreise (mit Name und Form – nicht nur Farbe)
    wishes: (S) => (S.g.colors || ['r', 'y', 'g', 'b']).map((k) => [k, `<span class="wc-dot">${colorMark(k)}</span><span>${COLOR[k]}</span>`, I18n.html`wish-circle fc-${k}`]),
    seat: (p, S) => p.eliminated ? I18n.html('<span>Ausgeschieden (25 Karten)</span>') : S.g.inactiveHands?.[p.id] ? I18n.html`<div class="uno-backs">${S.g.inactiveHands[p.id].map((c) => card(c, { attrs: 'disabled', cls: 'inactive' })).join('')}</div><small>Inaktive Seite · ${p.cards} Karten</small>` : null,
    extraMain: (S) => `${S.variant === 'flip' ? I18n.html`<p class="hint">${S.g.side ? 'Dunkle' : 'Helle'} Seite · Gegner zeigen die inaktive Seite</p>${S.g.drawBack ? I18n.html`<div class="uno-drawback">${card(S.g.drawBack, { attrs: 'disabled' })}<small>Rückseite des Nachziehstapels</small></div>` : ''}<div class="uno-backs">${S.players.filter((p) => p.inRound && p.id !== S.you?.id).map((p) => I18n.html`<div><small>${esc(p.name)} · inaktive Seite</small><div>${(S.g.inactiveHands?.[p.id] || []).map((c) => card(c, { attrs: 'disabled' })).join('')}</div></div>`).join('')}</div>` : ''}${S.g.revealed?.length ? I18n.html`<details><summary>Aufgedeckte Roulette-Karten (${S.g.revealed.length})</summary><div class="uno-backs">${S.g.revealed.map((c) => card(c, { attrs: 'disabled' })).join('')}</div></details>` : ''}${S.g.challengeHand ? I18n.html`<details open><summary>Bei der Anfechtung vorgezeigte Hand</summary><div class="uno-backs">${S.g.challengeHand.map((c) => card(c, { attrs: 'disabled' })).join('')}</div></details>` : ''}`,
    specialHint: (S, mine) => mine && S.g.colorChoice ? 'Wähle eine Farbe für die offene Entscheidung' : mine && S.g.challenge ? 'Ziehstrafe annehmen oder die letzte Plus-Karte anfechten' : S.variant === 'all-wild' && mine ? 'Jede Karte passt – Aktionskarten wirken sofort' : null,
    specialDock: (S, mine) => !mine ? null : S.g.colorChoice ? `<div class="kg-wishes">${S.g.colors.map((c) => `<button class="btn wish-circle fc-${c}" data-g="chooseColor" data-color="${c}">${COLOR[c]}</button>`).join('')}</div>` : S.g.challenge ? I18n.html('<button class="btn" data-g="acceptDraw">Strafe ziehen</button><button class="btn" data-g="challengeDraw">Anfechten (+2 bei Irrtum)</button>') : null,
    onClick: (t) => { const g = t.dataset.g; if (g === 'chooseColor') { send('chooseColor', { color: t.dataset.color }); return true; } if (['acceptDraw', 'challengeDraw'].includes(g)) { send('challenge', { challenge: g === 'challengeDraw' }); return true; } return false; },
    // Gewählte Farbe: leuchtender Ring um die Ablage (dazu steht „Gewünscht: Rot“ darunter)
    pileClass: (g) => (g.wish && g.top?.[1] === 'w' ? I18n.html`wish-ring ring-${g.wish}` : ''),
    wishName: (w) => COLOR[w],
    wishLabel: 'Welche Farbe soll gelten?',
    lastWord: 'UNO!',
    short: [
      I18n.html("Leg gleiche <b>Farbe</b> oder gleiche <b>Zahl bzw. gleiches Symbol</b>."),
      I18n.html("⊘ Aussetzen, ⇄ Richtungswechsel, <b>+2</b>: der Nächste zieht 2 und setzt aus."),
      I18n.html("Farbwahl (vierfarbiger Kreis) passt immer; <b>+4</b>: dazu zieht der Nächste 4 und setzt aus."),
      "Kannst du nicht: eine Karte ziehen – passt sie, darfst du sie gleich legen.",
      "Wer zuerst keine Karten mehr hat, gewinnt die Runde.",
      "Punkte: Der Gewinner kassiert die Restkarten der anderen (Zahl = Wert, Aktion 20, Farbwahl 50).",
    ],
    house: () => ['Kein Ende bei 500 Punkten – gezählt wird über den Abend'],
    rules: I18n.html`<p>Leg eine Karte mit <b>gleicher Farbe oder gleichem Wert/Symbol</b>. Wer zuerst keine Karten mehr hat, gewinnt die Runde.</p>
      <ul>
        <li><b>⊘ Aussetzen</b>: Der Nächste setzt aus.</li>
        <li><b>⇄ Richtungswechsel</b>: Es geht andersherum weiter (zu zweit wie Aussetzen).</li>
        <li><b>+2</b>: Der Nächste zieht 2 und setzt aus.</li>
        <li><b>Farbwahl</b> (vierfarbiger Kreis): passt immer, du bestimmst die Farbe. <b>+4</b>: dazu zieht der Nächste 4 und setzt aus.</li>
        <li>+2 und +4 werden nicht gestapelt (außer mit der Hausregel „stapeln“).</li>
        <li><b>„UNO!“</b>: Mit den Hausregeln tippst du bei der vorletzten Karte selbst auf „UNO!“. Mit <b>Erwischen</b> kostet Vergessen erst etwas, wenn dich jemand meldet, bevor der Nächste spielt – dann ziehst du 2.</li>
        <li>Kannst du nicht, ziehst du eine Karte. Passt sie, darfst du sie gleich spielen, sonst „Weiter“.</li>
      </ul>
      <p><b>Wertung:</b> Der Gewinner bekommt die Punkte aller übrigen Handkarten (Zahl = Wert, Aktionskarte 20, Farbwahl 50). Viel ist gut.</p>`,
  });
}
