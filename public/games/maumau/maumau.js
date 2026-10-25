// Mau-Mau im Browser (Regeln: games/maumau/room.js). Bedienung kommt aus kitShedding in /games/kit.js.
// Kartenblatt unter „Ich“ umschaltbar: französisch (Kreuz, Pik, Herz, Karo) oder deutsch (Eichel, Grün, Herz, Schellen).
// Gespielt wird immer mit denselben Karten – das deutsche Blatt ist nur eine andere Ansicht (Bube = Unter, Dame = Ober).
'use strict';
{
  usePrefs({ deck: 'fr' });
  const german = () => prefs.deck === 'de';
  const RANKS = '789TJQKA';
  const SUITS = 'cshd';

  // Deutsche Farben als eigene kleine Zeichnungen (keine Bilder aus dem Netz)
  const DE_SUIT = {
    c: '<ellipse cx="12" cy="15.2" rx="5.3" ry="6.6" fill="#C8963A"/><path d="M5 10.6a7 6.2 0 0 1 14 0z" fill="#6B4423"/><path d="M7.5 8.3l9 0M6.6 9.8h10.8" stroke="#8A5C33" stroke-width=".9"/><path d="M12 4.6V1.8" stroke="#6B4423" stroke-width="2" stroke-linecap="round"/>', // Eichel
    s: '<path d="M12 2C6.4 5.8 4.3 10.8 6.1 15.6c1.3 3.3 3.7 5 5.9 5s4.6-1.7 5.9-5C19.7 10.8 17.6 5.8 12 2z" fill="#2E8B4E"/><path d="M12 5.5V23M12 10l-3-2.2M12 10l3-2.2M12 14l-3.6-2.4M12 14l3.6-2.4" stroke="#1A5A31" stroke-width="1.2" fill="none" stroke-linecap="round"/>', // Grün (Blatt)
    h: '<path d="M12 21s-7.6-4.7-9.6-9.3C.9 8.3 3.1 4.4 6.7 4.4c2.2 0 3.7 1.3 5.3 3.3 1.6-2 3.1-3.3 5.3-3.3 3.6 0 5.8 3.9 4.3 7.3C19.6 16.3 12 21 12 21z" fill="#C8322D"/>', // Herz
    d: '<circle cx="12" cy="12.5" r="8.6" fill="#E8B21C" stroke="#9A6B00" stroke-width="1"/><path d="M3.8 10.6h16.4" stroke="#C8322D" stroke-width="2.6"/><circle cx="12" cy="16.2" r="1.7" fill="#5A3A00"/><path d="M12 16.5v3.8" stroke="#5A3A00" stroke-width="1.5"/>', // Schellen
  };
  const deSuit = (s, cls = '') => `<svg class="de-suit ${cls}" viewBox="0 0 24 24" aria-hidden="true">${DE_SUIT[s]}</svg>`;
  const NAME = {
    fr: { c: 'Kreuz', s: 'Pik', h: 'Herz', d: 'Karo' },
    de: { c: 'Eichel', s: 'Grün', h: 'Herz', d: 'Schellen' },
  };
  const DE_RANK = { T: '10', J: 'U', Q: 'O', K: 'K', A: 'A' };
  const DE_RANK_NAME = { T: '10', J: 'Unter', Q: 'Ober', K: 'König', A: 'Ass' };
  const suitName = (s) => NAME[german() ? 'de' : 'fr'][s];
  const suitSign = (s) => (german() ? deSuit(s, 'inline') : SUIT_SIGN[s]);

  // Deutsches Blatt: Wert in der Ecke, große Farbe in der Mitte
  function germanCard(c, { cls = '', attrs = '' } = {}) {
    const r = DE_RANK[c[0]] || c[0];
    return `<button type="button" class="kc kc-de ${cls}" ${attrs} aria-label="${esc(`${NAME.de[c[1]]} ${DE_RANK_NAME[c[0]] || c[0]}`)}"><span class="r">${r}</span>${deSuit(c[1], 'big-suit')}</button>`;
  }
  const card = (c, o) => (german() ? germanCard(c, o) : frenchCard(c, o));

  // Texte vom Server (Verlauf, Sprechblasen) nennen französische Karten – beim deutschen Blatt übersetzen
  const DE_WORDS = [[/Kreuz/g, 'Eichel'], [/Pik/g, 'Grün'], [/Karo/g, 'Schellen'], [/Buben/g, 'Unter'], [/Bube/g, 'Unter'], [/Damen/g, 'Ober'], [/Dame/g, 'Ober'], [/[♣♠♦♥]\s?/g, '']];
  const translate = (t) => (german() ? DE_WORDS.reduce((s, [re, to]) => s.replace(re, to), t) : t);

  const SUIT_ACC = {
    fr: { c: 'ein ♣ Kreuz', s: 'ein ♠ Pik', h: 'ein ♥ Herz', d: 'ein ♦ Karo' },
    de: { c: 'eine Eichel', s: 'ein Grün', h: 'ein Herz', d: 'eine Schelle' },
  };
  const RANK_ACC = { 7: 'eine 7', 8: 'eine 8', 9: 'eine 9', T: 'eine 10', J: 'einen Buben', Q: 'eine Dame', K: 'einen König', A: 'ein Ass' };
  const rankAcc = (r) => (german() ? { J: 'einen Unter', Q: 'einen Ober' }[r] : null) || RANK_ACC[r];

  kitShedding({
    id: 'maumau',
    name: 'Mau-Mau',
    // Erste Schritte beim ersten Spiel (3 Schritte, abschaltbar unter „Ich“)
    intro: [
      ["Ziel", "Werde als Erster alle Karten los. Leg eine Karte mit gleicher <b>Farbe</b> oder gleichem <b>Wert</b> auf die Ablage."],
      ["Deine Karten", "Karten mit Goldrand passen gerade – antippen legt sie (am Computer auch auf die Ablage ziehen). Passt nichts: „Karte ziehen“."],
      ["Sonderkarten", "<b>7</b>: der Nächste zieht 2. <b>8</b>: der Nächste setzt aus. <b>Bube</b>: du wünschst dir eine Farbe. Alles Weitere unter „?“."],
    ],
    card,
    translate,
    // „Leg ein ♥ Herz oder einen König“ – was gerade passt
    playHint(g) {
      const suit = g.wish || g.top[1];
      const parts = [SUIT_ACC[german() ? 'de' : 'fr'][suit]];
      if (!g.wish) parts.push(rankAcc(g.top[0]));
      if (g.playable.some((c) => c[0] === 'J' && c[1] !== suit && g.top[0] !== 'J')) parts.push(rankAcc('J'));
      return `Leg ${parts.join(' oder ')}${g.wish ? ' (gewünscht)' : ''}`;
    },
    pendingHint: () => 'Leg eine 7 drauf',
    pendingText: (g) => `der Nächste zieht ${g.pending}, außer er legt eine 7`,
    sort: {
      color: (c) => SUITS.indexOf(c[1]) * 10 + RANKS.indexOf(c[0]),
      number: (c) => RANKS.indexOf(c[0]) * 10 + SUITS.indexOf(c[1]),
    },
    needsWish: (c) => c[0] === 'J',
    get wishes() { return [...SUITS].map((s) => [s, `${suitSign(s)} ${suitName(s)}`, !german() && (s === 'h' || s === 'd') ? 'red' : '']); },
    wishName: (w) => suitName(w),
    // Gewünschte Farbe groß neben der Ablage
    wishBadge: (w) => `<span class="mm-wish-sign ${!german() && (w === 'h' || w === 'd') ? 'red' : ''}">${german() ? deSuit(w) : SUIT_SIGN[w]}</span>`,
    wishLabel: 'Welche Farbe wünschst du dir?',
    lastWord: 'Mau!',
    prefs: () => `<label class="toggle"><span>Kartenblatt<small>Französisch: Kreuz, Pik, Herz, Karo. Deutsch: Eichel, Grün, Herz, Schellen (Unter, Ober). Gilt nur hier am Tisch für dich.</small></span>
      <select data-pref="deck" class="input" style="max-width:150px">
        <option value="fr" ${german() ? '' : 'selected'}>Französisch</option>
        <option value="de" ${german() ? 'selected' : ''}>Deutsch</option>
      </select></label>`,
    get short() {
      return [
        'Leg eine Karte mit gleicher <b>Farbe</b> oder gleichem <b>Wert</b>.',
        'Kannst du nicht: eine Karte ziehen – passt sie, darfst du sie gleich legen.',
        '<b>7</b>: Der Nächste zieht 2 – oder legt selbst eine 7 (dann 4, 6 …).',
        '<b>8</b>: Der Nächste setzt aus.',
        translate('<b>Bube</b>: auf alles außer Bube, du wünschst dir eine Farbe.'),
        'Wer zuerst keine Karten mehr hat, gewinnt die Runde.',
        'Punkte: die Augen der Restkarten – wenig ist gut.',
      ];
    },
    house: () => ['Ab 6 Spielern mit zwei Kartenspielen'],
    get rules() {
      return translate(`<p>Leg eine Karte, die in <b>Farbe oder Wert</b> zur obersten Karte passt. Wer zuerst keine Karten mehr hat, gewinnt die Runde.</p>
      <ul>
        <li><b>7</b>: Der Nächste zieht 2 – außer er legt auch eine 7, dann zieht der Übernächste 4 usw.</li>
        <li><b>8</b>: Der Nächste setzt aus.</li>
        <li><b>Bube</b>: passt auf alles (nur nicht auf einen Buben) – du wünschst dir eine Farbe.</li>
        <li>Kannst du nicht, ziehst du eine Karte. Passt sie, darfst du sie gleich spielen, sonst „Weiter“.</li>
        <li>„Mau!“ bei der letzten Karte sagt die Seite für dich – außer mit der Hausregel „Mau sagen“: Dann tippst du bei der vorletzten Karte selbst auf „Mau“.</li>
      </ul>
      <p><b>Wertung über den Abend:</b> Der Gewinner bekommt 0 Punkte, alle anderen die Augen ihrer Karten (7–10 = Wert, Bube 2, Dame 3, König 4, Ass 11). Wenig Punkte sind gut.</p>`)
        + (german() ? '<p>Deutsches Blatt: Eichel = Kreuz, Grün = Pik, Herz = Herz, Schellen = Karo; Unter = Bube, Ober = Dame.</p>' : '');
    },
  });
}
