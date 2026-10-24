// Farbenchaos im Browser (Regeln: games/farbenchaos/room.js). Bedienung wie Mau-Mau (kitShedding), eigene Karten.
'use strict';
{
  const COLOR = { r: 'Rot', y: 'Gelb', g: 'Grün', b: 'Blau', w: 'Schwarz' };
  const SIGN = { S: '⊘', R: '⇄', D: '+2', W: '★', F: '+4' };
  const LABEL = { S: 'Aussetzen', R: 'Richtungswechsel', D: 'plus zwei', W: 'Farbwahl', F: 'Farbwahl plus vier' };
  // Karte: zwei Zeichen, Wert + Farbe (z. B. "7r", "Sg", "Fw")
  const card = (c, { cls = '', attrs = '' } = {}) => {
    const v = SIGN[c[0]] || c[0];
    return `<button type="button" class="kc kc-fc fc-${c[1]} ${cls}" ${attrs} aria-label="${esc(`${c[1] === 'w' ? '' : COLOR[c[1]] + ' '}${LABEL[c[0]] || c[0]}`)}"><span class="v">${v}</span></button>`;
  };
  kitShedding({
    id: 'farbenchaos',
    name: 'Farbenchaos',
    card,
    needsWish: (c) => c[1] === 'w',
    wishes: [['r', 'Rot', 'fc-r'], ['y', 'Gelb', 'fc-y'], ['g', 'Grün', 'fc-g'], ['b', 'Blau', 'fc-b']],
    wishName: (w) => COLOR[w],
    wishLabel: 'Welche Farbe soll gelten?',
    lastWord: 'Chaos!',
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
