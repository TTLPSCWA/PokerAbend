// Mau-Mau im Browser (Regeln: games/maumau/room.js). Bedienung kommt aus kitShedding in /games/kit.js.
'use strict';
{
const SUIT_ACC = { c: 'ein ♣ Kreuz', s: 'ein ♠ Pik', h: 'ein ♥ Herz', d: 'ein ♦ Karo' };
const RANK_ACC = { 7: 'eine 7', 8: 'eine 8', 9: 'eine 9', T: 'eine 10', J: 'einen Buben', Q: 'eine Dame', K: 'einen König', A: 'ein Ass' };
const RANKS = '789TJQKA';
const SUITS = 'cshd';
kitShedding({
  id: 'maumau',
  name: 'Mau-Mau',
  card: frenchCard,
  // „Leg ein ♥ Herz oder einen König“ – was gerade passt
  playHint(g) {
    const suit = g.wish || g.top[1];
    const parts = [SUIT_ACC[suit]];
    if (!g.wish) parts.push(RANK_ACC[g.top[0]]);
    if (g.playable.some((c) => c[0] === 'J' && c[1] !== suit && g.top[0] !== 'J')) parts.push('einen Buben');
    return `Leg ${parts.join(' oder ')}${g.wish ? ' (gewünscht)' : ''}`;
  },
  pendingHint: () => 'Leg eine 7 drauf',
  pendingText: (g) => `+${g.pending}: der Nächste zieht ${g.pending}, außer er legt eine 7`,
  sort: {
    color: (c) => SUITS.indexOf(c[1]) * 10 + RANKS.indexOf(c[0]),
    number: (c) => RANKS.indexOf(c[0]) * 10 + SUITS.indexOf(c[1]),
  },
  needsWish: (c) => c[0] === 'J',
  wishes: [['c', '♣ Kreuz', ''], ['s', '♠ Pik', ''], ['h', '♥ Herz', 'red'], ['d', '♦ Karo', 'red']],
  wishName: (w) => ({ c: '♣ Kreuz', s: '♠ Pik', h: '♥ Herz', d: '♦ Karo' })[w],
  wishLabel: 'Welche Farbe wünschst du dir?',
  lastWord: 'Mau!',
  short: [
    "Leg eine Karte mit gleicher <b>Farbe</b> oder gleichem <b>Wert</b>.",
    "Kannst du nicht: eine Karte ziehen – passt sie, darfst du sie gleich legen.",
    "<b>7</b>: Der Nächste zieht 2 – oder legt selbst eine 7 (dann 4, 6 …).",
    "<b>8</b>: Der Nächste setzt aus.",
    "<b>Bube</b>: auf alles außer Bube, du wünschst dir eine Farbe.",
    "Wer zuerst keine Karten mehr hat, gewinnt die Runde.",
    "Punkte: die Augen der Restkarten – wenig ist gut.",
  ],
  house: () => ['Ab 6 Spielern mit zwei Kartenspielen'],
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
}
