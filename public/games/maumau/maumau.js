// Mau-Mau im Browser (Regeln: games/maumau/room.js). Bedienung kommt aus kitShedding in /games/kit.js.
'use strict';
kitShedding({
  id: 'maumau',
  name: 'Mau-Mau',
  card: frenchCard,
  needsWish: (c) => c[0] === 'J',
  wishes: [['c', '♣ Kreuz', ''], ['s', '♠ Pik', ''], ['h', '♥ Herz', 'red'], ['d', '♦ Karo', 'red']],
  wishName: (w) => ({ c: '♣ Kreuz', s: '♠ Pik', h: '♥ Herz', d: '♦ Karo' })[w],
  wishLabel: 'Welche Farbe wünschst du dir?',
  lastWord: 'Mau!',
  rules: `<p>Leg eine Karte, die in <b>Farbe oder Wert</b> zur obersten Karte passt. Wer zuerst keine Karten mehr hat, gewinnt die Runde.</p>
    <ul>
      <li><b>7</b>: Der Nächste zieht 2 – außer er legt auch eine 7, dann zieht der Übernächste 4 usw.</li>
      <li><b>8</b>: Der Nächste setzt aus.</li>
      <li><b>Bube</b>: passt auf alles (nur nicht auf einen Buben) – du wünschst dir eine Farbe.</li>
      <li>Kannst du nicht, ziehst du eine Karte. Passt sie, darfst du sie gleich spielen, sonst „Weiter“.</li>
      <li>„Mau!“ bei der letzten Karte zeigt die Seite selbst an.</li>
    </ul>
    <p><b>Wertung über den Abend:</b> Der Gewinner bekommt 0 Punkte, alle anderen die Augen ihrer Karten (7–10 = Wert, Bube 2, Dame 3, König 4, Ass 11). Wenig Punkte sind gut.</p>`,
});
