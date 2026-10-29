// Regelwerte sind öffentlich. Motive, Namen und Kurztexte sind für den Spieleabend geschrieben.
export const COLORS = {
  brown: { name: 'Braun', size: 2, rent: [1, 2], value: 1, hex: '#9a6548' },
  lightblue: { name: 'Hellblau', size: 3, rent: [1, 2, 3], value: 1, hex: '#8bc8e6' },
  pink: { name: 'Pink', size: 3, rent: [1, 2, 4], value: 2, hex: '#df8bbb' },
  orange: { name: 'Orange', size: 3, rent: [1, 3, 5], value: 2, hex: '#e89b49' },
  red: { name: 'Rot', size: 3, rent: [2, 3, 6], value: 3, hex: '#df665d' },
  yellow: { name: 'Gelb', size: 3, rent: [2, 4, 6], value: 3, hex: '#e3ce67' },
  green: { name: 'Grün', size: 3, rent: [2, 4, 7], value: 4, hex: '#6fad86' },
  blue: { name: 'Dunkelblau', size: 2, rent: [3, 8], value: 4, hex: '#7c9cdb' },
  rail: { name: 'Bahnhof', size: 4, rent: [1, 2, 3, 4], value: 2, hex: '#a2a6ac' },
  utility: { name: 'Werk', size: 2, rent: [1, 2], value: 2, hex: '#d3d7bc' },
};
const streets = ['Kekswinkel', 'Sofagasse', 'Teesteg', 'Wolkengasse', 'Eulenweg', 'Musikplatz', 'Gartenbogen', 'Kartenhof', 'Sonnensteg', 'Lampenweg', 'Küchenring', 'Würfelpfad', 'Bücherplatz', 'Mondallee', 'Sternensteg', 'Kronengasse', 'Glitzerhof', 'Uferbogen', 'Wiesenring', 'Balkonweg', 'Goldpfad', 'Silberplatz', 'Nordhalt', 'Osthalt', 'Südhalt', 'Westhalt', 'Lichtwerk', 'Wasserwerk'];
const list = [];
const add = (n, def) => { for (let i = 0; i < n; i++) list.push({ id: 'md' + String(list.length + 1).padStart(3, '0'), ...def }); };
for (const [value, n] of [[1, 6], [2, 5], [3, 3], [4, 3], [5, 2], [10, 1]]) add(n, { kind: 'money', value, name: `${value} M`, text: 'Für deine Bank und offene Rechnungen.' });
for (const [action, n, value, name, text] of [
  ['breaker', 2, 5, 'Deal Breaker', 'Übernimm einen ganzen fertigen Satz.'], ['no', 3, 4, 'Just Say No', 'Widersprich einer Aktion gegen dich.'],
  ['sly', 3, 3, 'Sly Deal', 'Hol dir ein Grundstück aus einem unfertigen Satz.'], ['forced', 3, 3, 'Forced Deal', 'Tausche zwei Grundstücke aus unfertigen Sätzen.'],
  ['debt', 3, 3, 'Debt Collector', 'Ein Mitspieler schuldet dir 5 M.'], ['birthday', 3, 2, "It's My Birthday", 'Alle anderen schulden dir je 2 M.'],
  ['go', 10, 1, 'Pass Go', 'Ziehe zwei neue Karten.'], ['house', 3, 3, 'Haus', 'Ein fertiger Straßensatz bringt 3 M mehr Miete.'],
  ['hotel', 2, 4, 'Hotel', 'Mit Haus: weitere 4 M Miete.'], ['double', 2, 1, 'Double the Rent', 'Nur zusammen mit Miete: verdopple die Forderung.'],
]) add(n, { kind: 'action', action, value, name, text });
for (const colors of [['brown', 'lightblue'], ['pink', 'orange'], ['red', 'yellow'], ['green', 'blue'], ['rail', 'utility']]) add(2, { kind: 'rent', colors, value: 1, name: 'Miete', text: 'Alle anderen zahlen für eine dieser Farben.' });
add(3, { kind: 'rent', colors: Object.keys(COLORS), value: 3, name: 'Wunschmiete', text: 'Eine Farbe, ein Mitspieler: deine Miete.' });
let street = 0;
for (const [color, g] of Object.entries(COLORS)) for (let i = 0; i < g.size; i++) add(1, { kind: 'property', colors: [color], value: g.value, name: streets[street++], text: `${g.name}: ${g.size} Grundstücke für einen Satz.` });
for (const [colors, n, value] of [[['blue', 'green'], 1, 4], [['green', 'rail'], 1, 4], [['utility', 'rail'], 1, 2], [['lightblue', 'rail'], 1, 4], [['lightblue', 'brown'], 1, 1], [['pink', 'orange'], 2, 2], [['red', 'yellow'], 2, 3], [Object.keys(COLORS), 2, 0]]) add(n, { kind: 'property', colors, value, name: 'Grundstücks-Joker', text: 'Im eigenen Zug kostenlos umordnen.' });
export const CARDS = Object.fromEntries(list.map((c) => [c.id, c]));
export const DECK = list.map((c) => c.id);
export const complete = (g) => g.cards.length === COLORS[g.color].size && g.cards.some((id) => CARDS[id].colors.length < 10);
export const rent = (g) => (g.cards.some((id) => CARDS[id].value > 0) ? COLORS[g.color].rent[Math.min(g.cards.length, COLORS[g.color].size) - 1] : 0) + (g.house ? 3 : 0) + (g.hotel ? 4 : 0);
