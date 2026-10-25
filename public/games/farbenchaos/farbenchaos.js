// UNO im Browser (Regeln: games/farbenchaos/room.js). Bedienung wie Mau-Mau (kitShedding), eigene Karten.
'use strict';
{
  const COLOR = { r: 'Rot', y: 'Gelb', g: 'Grün', b: 'Blau', w: 'Schwarz' };
  const LABEL = { S: 'Aussetzen', R: 'Richtungswechsel', D: 'plus zwei', W: 'Farbwahl', F: 'Farbwahl plus vier' };
  // Symbole selbst gezeichnet: Aussetzen = Kreis mit Strich, Richtungswechsel = zwei Pfeile, Farbwahl = vierfarbiger Kreis
  const SKIP = '<svg class="sym" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="3"/><path d="M6.5 17.5l11-11" stroke="currentColor" stroke-width="3"/></svg>';
  const REV = '<svg class="sym" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h12M12 4.5 16.5 9 12 13.5M20 15H8M12 10.5 7.5 15 12 19.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const WHEEL = '<span class="wheel" aria-hidden="true"></span>';
  const BIG = { S: SKIP, R: REV, D: '+2', W: WHEEL, F: `${WHEEL}<b class="plus4">+4</b>` };
  const CORNER = { S: SKIP, R: REV, D: '+2', W: '<span class="wheel mini"></span>', F: '+4' };
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
    // Erste Schritte beim ersten Spiel (3 Schritte, abschaltbar unter „Ich“)
    intro: [
      ["Ziel", "Werde als Erster alle Karten los: gleiche <b>Farbe</b> oder gleiche <b>Zahl bzw. gleiches Symbol</b>."],
      ["Bedienung", "Karten mit Goldrand passen – antippen legt sie. Bei der Farbwahl tippst du einen der vier Farbkreise an."],
      ["Sonderkarten", "Aussetzen, Richtungswechsel, +2, Farbwahl und +4. Der Gewinner kassiert die Punkte der Restkarten. Welche Hausregeln gelten, steht unter „?“."],
    ],
    card,
    // „Leg eine rote Karte oder eine 7“ – was gerade passt
    playHint(g) {
      const color = g.top[1] === 'w' ? g.wish : g.top[1];
      const parts = color ? [`eine ${ADJ[color]} Karte`] : [];
      if (g.top[1] !== 'w') parts.push(VALUE_ACC[g.top[0]] || `eine ${g.top[0]}`);
      if (g.playable.some((c) => c[1] === 'w')) parts.push('eine schwarze');
      return parts.length ? `Leg ${parts.join(' oder ')}` : 'Leg eine beliebige Karte';
    },
    pendingHint: () => 'Leg eine Plus-Karte drauf',
    pendingText: (g) => `+${g.pending}: der Nächste zieht ${g.pending}, außer er legt eine Plus-Karte drauf`,
    sort: {
      color: (c) => COLORS.indexOf(c[1]) * 100 + VALS.indexOf(c[0]),
      number: (c) => VALS.indexOf(c[0]) * 10 + COLORS.indexOf(c[1]),
    },
    needsWish: (c) => c[1] === 'w',
    // Farbwahl: vier große Farbkreise (mit Name und Form – nicht nur Farbe)
    wishes: ['r', 'y', 'g', 'b'].map((k) => [k, `<span class="wc-dot">${colorMark(k)}</span><span>${COLOR[k]}</span>`, `wish-circle fc-${k}`]),
    // Gewählte Farbe: leuchtender Ring um die Ablage (dazu steht „Gewünscht: Rot“ darunter)
    pileClass: (g) => (g.wish && g.top?.[1] === 'w' ? `wish-ring ring-${g.wish}` : ''),
    wishName: (w) => COLOR[w],
    wishLabel: 'Welche Farbe soll gelten?',
    lastWord: 'UNO!',
    short: [
      "Leg gleiche <b>Farbe</b> oder gleiche <b>Zahl bzw. gleiches Symbol</b>.",
      "⊘ Aussetzen, ⇄ Richtungswechsel, <b>+2</b>: der Nächste zieht 2 und setzt aus.",
      "Farbwahl (vierfarbiger Kreis) passt immer; <b>+4</b>: dazu zieht der Nächste 4 und setzt aus.",
      "Kannst du nicht: eine Karte ziehen – passt sie, darfst du sie gleich legen.",
      "Wer zuerst keine Karten mehr hat, gewinnt die Runde.",
      "Punkte: Der Gewinner kassiert die Restkarten der anderen (Zahl = Wert, Aktion 20, Farbwahl 50).",
    ],
    house: () => ['Kein Ende bei 500 Punkten – gezählt wird über den Abend'],
    rules: `<p>Leg eine Karte mit <b>gleicher Farbe oder gleichem Wert/Symbol</b>. Wer zuerst keine Karten mehr hat, gewinnt die Runde.</p>
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
