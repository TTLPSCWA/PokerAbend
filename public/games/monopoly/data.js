export const COLORS = {
  brown: { name: 'Braun', hex: '#9d725b', build: 50 }, lightblue: { name: 'Hellblau', hex: '#93cce4', build: 50 },
  pink: { name: 'Pink', hex: '#d48fb9', build: 100 }, orange: { name: 'Orange', hex: '#e4a057', build: 100 },
  red: { name: 'Rot', hex: '#df766b', build: 150 }, yellow: { name: 'Gelb', hex: '#e5d373', build: 150 },
  green: { name: 'Grün', hex: '#81bd94', build: 200 }, blue: { name: 'Dunkelblau', hex: '#7f9dd9', build: 200 },
};
const streets = [
  [1, 'Kastaniengasse', 'brown', 60, [2, 10, 30, 90, 160, 250]], [3, 'Lindengasse', 'brown', 60, [4, 20, 60, 180, 320, 450]],
  [6, 'Brunnenweg', 'lightblue', 100, [6, 30, 90, 270, 400, 550]], [8, 'Mühlenweg', 'lightblue', 100, [6, 30, 90, 270, 400, 550]], [9, 'Ahornweg', 'lightblue', 120, [8, 40, 100, 300, 450, 600]],
  [11, 'Musikplatz', 'pink', 140, [10, 50, 150, 450, 625, 750]], [13, 'Gartenbogen', 'pink', 140, [10, 50, 150, 450, 625, 750]], [14, 'Rathausplatz', 'pink', 160, [12, 60, 180, 500, 700, 900]],
  [16, 'Sonnenstraße', 'orange', 180, [14, 70, 200, 550, 750, 950]], [18, 'Laternenstraße', 'orange', 180, [14, 70, 200, 550, 750, 950]], [19, 'Marktring', 'orange', 200, [16, 80, 220, 600, 800, 1000]],
  [21, 'Theaterplatz', 'red', 220, [18, 90, 250, 700, 875, 1050]], [23, 'Bücherplatz', 'red', 220, [18, 90, 250, 700, 875, 1050]], [24, 'Mondallee', 'red', 240, [20, 100, 300, 750, 925, 1100]],
  [26, 'Sternenallee', 'yellow', 260, [22, 110, 330, 800, 975, 1150]], [27, 'Kronengasse', 'yellow', 260, [22, 110, 330, 800, 975, 1150]], [29, 'Kronenhof', 'yellow', 280, [24, 120, 360, 850, 1025, 1200]],
  [31, 'Uferbogen', 'green', 300, [26, 130, 390, 900, 1100, 1275]], [32, 'Wiesenring', 'green', 300, [26, 130, 390, 900, 1100, 1275]], [34, 'Parkstraße', 'green', 320, [28, 150, 450, 1000, 1200, 1400]],
  [37, 'Goldallee', 'blue', 350, [35, 175, 500, 1100, 1300, 1500]], [39, 'Schlossplatz', 'blue', 400, [50, 200, 600, 1400, 1700, 2000]],
];
const other = {
  0: ['Los', 'go'], 2: ['Gemeinschaft', 'chest'], 4: ['Einkommensteuer', 'tax', 200], 5: ['Nordhalt', 'rail', 200], 7: ['Ereignis', 'event'],
  10: ['Gefängnis / Besuch', 'jail'], 12: ['Lichtwerk', 'utility', 150], 15: ['Osthalt', 'rail', 200], 17: ['Gemeinschaft', 'chest'],
  20: ['Frei Parken', 'parking'], 22: ['Ereignis', 'event'], 25: ['Südhalt', 'rail', 200], 28: ['Wasserwerk', 'utility', 150],
  30: ['Gehe ins Gefängnis', 'gotojail'], 33: ['Gemeinschaft', 'chest'], 35: ['Westhalt', 'rail', 200], 36: ['Ereignis', 'event'], 38: ['Zusatzsteuer', 'tax', 100],
};
export const BOARD = Array.from({ length: 40 }, (_, index) => {
  const s = streets.find((s) => s[0] === index);
  if (s) return { index, name: s[1], type: 'street', color: s[2], price: s[3], rents: s[4], build: COLORS[s[2]].build };
  const [name, type, amount] = other[index]; return { index, name, type, ...(type === 'tax' ? { tax: amount } : amount ? { price: amount } : {}) };
});
export const PROPERTIES = BOARD.filter((f) => f.price).map((f) => f.index);
export const redemption = (field) => BOARD[field].price / 2 + Math.ceil(BOARD[field].price / 20);
export const group = (field) => BOARD.filter((f) => f.color && f.color === BOARD[field].color).map((f) => f.index);
export const square = (index) => index <= 10 ? [10, 10 - index] : index <= 20 ? [20 - index, 0] : index <= 30 ? [0, index - 20] : [index - 30, 10];
export const JUNIOR_BOARD = Array.from({ length: 24 }, (_, index) => {
  const corners = { 0: ['Los', 'go'], 6: ['Gefängnis / Besuch', 'jail'], 12: ['Frei Parken', 'parking'], 18: ['Gehe ins Gefängnis', 'gotojail'] };
  if (corners[index]) return { index, name: corners[index][0], type: corners[index][1] };
  if (index % 6 === 3) return { index, name: 'Ereignis', type: 'event' };
  const pair = Math.floor(index / 3), color = Object.keys(COLORS)[pair], price = [1, 1, 2, 2, 3, 3, 4, 5][pair];
  const names = ['Kastaniengasse', 'Lindengasse', 'Brunnenweg', 'Mühlenweg', 'Wiesenplatz', 'Gartenplatz', 'Hafenstraße', 'Uferstraße', 'Theaterallee', 'Opernallee', 'Parkring', 'Blütenring', 'Sonnenhöhe', 'Mondhöhe', 'Schlossufer', 'Kronenufer'];
  return { index, name: names[pair * 2 + (index % 3 === 2 ? 1 : 0)], type: 'street', color, price, rents: [price, price * 2] };
});
export const juniorSquare = (i) => i <= 6 ? [6, 6 - i] : i <= 12 ? [12 - i, 0] : i <= 18 ? [0, i - 12] : [i - 18, 6];
const card = (text, kind, args = {}) => ({ text, kind, ...args });
export const EVENTS = [
  card('Der Spieleabend zieht um: ab zu Los, Startbonus inklusive.', 'move', { field: 0 }),
  card('Die Buchung steht: Besuch in der Mondallee.', 'move', { field: 24 }), card('Die Playlist ruft dich zum Musikplatz.', 'move', { field: 11 }),
  card('Strom oder Wasser? Zum nächsten Werk; fremde Leitung kostet zehnmal einen neuen Wurf.', 'utility'),
  card('Der nächste Zug fährt nur für dich. Zum nächsten Halt, fremdes Gleis kostet doppelt.', 'rail'),
  card('Der Nachtzug wartet. Zum nächsten Halt, dort gilt die doppelte Miete.', 'rail'),
  card('Der Snackfonds zahlt eine Überraschungsprämie: 50.', 'bank', { amount: 50 }), card('Dein Alibi überzeugt. Diese Freikarte fürs Gefängnis behalten.', 'free'),
  card('Die Chips stehen drei Plätze hinter dir. Drei Felder zurück.', 'back', { steps: 3 }), card('Zu laut gejubelt: direkt ins Gefängnis, ohne Startbonus.', 'jail'),
  card('Renovierung vor dem Besuch: 25 je Haus, 100 je Hotel zahlen.', 'repairs', { house: 25, hotel: 100 }),
  card('Mit dem Einkaufswagen geblitzt. 15 an die Bank.', 'bank', { amount: -15 }), card('Treffpunkt Nordhalt. Falls du Los passierst, gibt es den Startbonus.', 'move', { field: 5 }),
  card('Die letzte freie Lounge liegt am Schlossplatz. Geh dorthin.', 'move', { field: 39 }),
  card('Du hast alle eingeladen. Zahle jedem anderen 50 fürs Abendessen.', 'each', { amount: -50 }), card('Dein Sparvertrag für neue Spiele ist fällig: 150 von der Bank.', 'bank', { amount: 150 }),
];
export const CHEST = [
  card('Die Runde trifft sich am Anfang. Vorrücken auf Los.', 'move', { field: 0 }), card('Die Bank hat zu viel Wechselgeld eingepackt. Du erhältst 200.', 'bank', { amount: 200 }),
  card('Die Eule braucht einen Pflasterverband. Zahle 50.', 'bank', { amount: -50 }), card('Alte Spiele verkauft: 50 für deine Kasse.', 'bank', { amount: 50 }),
  card('Der Schlüssel steckt unter der Fußmatte. Freikarte behalten.', 'free'), card('Beim Schummeln erwischt: direkt ins Gefängnis.', 'jail'),
  card('Der Urlaubstopf wird aufgelöst: 100 für dich.', 'bank', { amount: 100 }), card('Portokasse wiedergefunden: 20.', 'bank', { amount: 20 }),
  card('Geburtstag! Alle anderen geben dir je 10.', 'each', { amount: 10 }), card('Die Versicherung ersetzt den umgekippten Tisch: 100.', 'bank', { amount: 100 }),
  card('Neue Brille nach dem Würfeltreffer. Zahle 100.', 'bank', { amount: -100 }), card('Spielekurs für Fortgeschrittene: 50 bezahlen.', 'bank', { amount: -50 }),
  card('Du erklärst die Regeln. Die Bank zahlt dir 25.', 'bank', { amount: 25 }), card('Frischer Anstrich: 40 je Haus, 115 je Hotel.', 'repairs', { house: 40, hotel: 115 }),
  card('Dein schönster Spielzug gewinnt den Publikumspreis: 10.', 'bank', { amount: 10 }), card('Ein ferner Spielefreund hinterlässt dir 100.', 'bank', { amount: 100 }),
];
