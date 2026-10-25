// UNO im Browser (Regeln: games/farbenchaos/room.js). Bedienung wie Mau-Mau (kitShedding), eigene Karten.
'use strict';
{
  const COLOR = { r: 'Rot', y: 'Gelb', g: 'Grün', b: 'Blau', w: 'Schwarz' };
  const SIGN = { S: '⊘', R: '⇄', D: '+2', W: '★', F: '+4' };
  const LABEL = { S: 'Aussetzen', R: 'Richtungswechsel', D: 'plus zwei', W: 'Farbwahl', F: 'Farbwahl plus vier' };
  // Karte: zwei Zeichen, Wert + Farbe (z. B. "7r", "Sg", "Fw")
  const card = (c, { cls = '', attrs = '' } = {}) => {
    const v = SIGN[c[0]] || c[0];
    return `<button type="button" class="kc kc-fc fc-${c[1]} ${cls}" ${attrs} aria-label="${esc(`${c[1] === 'w' ? '' : COLOR[c[1]] + ' '}${LABEL[c[0]] || c[0]}`)}">${colorMark(c[1])}<span class="v">${v}</span></button>`;
  };
  const ADJ = { r: 'rote', y: 'gelbe', g: 'grüne', b: 'blaue' };
  const VALUE_ACC = { S: 'ein Aussetzen', R: 'einen Richtungswechsel', D: 'eine +2' };
  const VALS = '0123456789SRDWF';
  const COLORS = 'rygbw';
  kitShedding({
    id: 'farbenchaos',
    name: 'UNO',
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
    wishes: [['r', `${colorMark('r')} Rot`, 'fc-r'], ['y', `${colorMark('y')} Gelb`, 'fc-y'], ['g', `${colorMark('g')} Grün`, 'fc-g'], ['b', `${colorMark('b')} Blau`, 'fc-b']],
    wishName: (w) => COLOR[w],
    wishLabel: 'Welche Farbe soll gelten?',
    lastWord: 'UNO!',
    short: [
      "Leg gleiche <b>Farbe</b> oder gleiche <b>Zahl bzw. gleiches Symbol</b>.",
      "⊘ Aussetzen, ⇄ Richtungswechsel, <b>+2</b>: der Nächste zieht 2 und setzt aus.",
      "★ Farbwahl passt immer; <b>+4</b>: dazu zieht der Nächste 4 und setzt aus.",
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
        <li><b>★ Farbwahl</b>: passt immer, du bestimmst die Farbe. <b>+4</b>: dazu zieht der Nächste 4 und setzt aus.</li>
        <li>+2 und +4 werden nicht gestapelt.</li>
        <li>Kannst du nicht, ziehst du eine Karte. Passt sie, darfst du sie gleich spielen, sonst „Weiter“.</li>
      </ul>
      <p><b>Wertung:</b> Der Gewinner bekommt die Punkte aller übrigen Handkarten (Zahl = Wert, Aktionskarte 20, Farbwahl 50). Viel ist gut.</p>`,
  });
}
