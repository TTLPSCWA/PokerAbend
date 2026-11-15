// ART-W1 · TW-01 „Schatten über Neuengland“ – Referenzwelt für Monopoly (Standard und Tempowürfel, nie Junior).
// Eigener Entwurf: eine erfundene neblige Hafenstadt an einer Küste der 1920er-Jahre (Leuchttürme, Lagerhäuser, Messing, Leder,
// alte Bücher, zurückhaltend Unheimliches). Keine Namen, Orte, Figuren oder Zeichen aus fremden Werken oder Spielen.
// Nur Darstellung: Feld-, Karten- und Figurennamen sind Texte; Preise, Mieten, Kartenwirkungen und Reihenfolge stehen allein in
// public/games/monopoly/data.js. {field:N} in Kartentexten wird durch den angezeigten Namen von Feld N ersetzt (eigene Bretter zuerst).
export const TW01_FIELDS = {
  0: 'Los · Alter Kai', 1: 'Fischergasse', 2: 'Kirchenkasse', 3: 'Netzmacherweg', 4: 'Hafengebühr', 5: 'Küstenbahn Nord',
  6: 'Möwenstieg', 7: 'Seltsame Begebenheit', 8: 'Ankerplatz', 9: 'Bootsbauerkai', 10: 'Zollturm · nur zu Besuch',
  11: 'Kapellenweg', 12: 'Gaswerk am Hafen', 13: 'Glockengasse', 14: 'Pfarrhof', 15: 'Fährlinie Ost', 16: 'Lagerhausstraße',
  17: 'Kirchenkasse', 18: 'Teerkochergasse', 19: 'Salzspeicher', 20: 'Rast im Nebel', 21: 'Bibliotheksstufen',
  22: 'Seltsame Begebenheit', 23: 'Archivgasse', 24: 'Alte Druckerei', 25: 'Postdampfer Süd', 26: 'Kapitänsallee',
  27: 'Walfängerhaus', 28: 'Leuchtfeuer-Werk', 29: 'Reederkontor', 30: 'Ab in den Zollturm', 31: 'Klippenweg',
  32: 'Kreideklippe', 33: 'Kirchenkasse', 34: 'Sternwarte', 35: 'Nachtzug West', 36: 'Seltsame Begebenheit',
  37: 'Leuchtturmklippe', 38: 'Nebelsteuer', 39: 'Haus auf der Landzunge',
};
// Gleiche Reihenfolge und Wirkung wie EVENTS/CHEST in data.js (Beträge und Ziele stehen im Text, damit nichts überrascht).
export const TW01_CARDS = {
  event: [
    'Ein Telegramm ruft dich zurück zum Hafen: ziehe vor auf {field:0} und kassiere den Startbonus.',
    'Im Nebel siehst du ein Licht in der {field:24}. Ziehe dorthin.',
    'Die Glocke ruft. Ziehe vor zum {field:11}.',
    'Das Licht flackert. Ziehe zum nächsten Werk; gehört es jemand anderem, zahlst du das Zehnfache eines neuen Wurfs.',
    'Der letzte Zug fährt gleich ab. Ziehe zur nächsten Verbindung; gehört sie jemand anderem, zahlst du die doppelte Miete.',
    'Eine Laterne winkt dich zur nächsten Verbindung. Dort gilt die doppelte Miete.',
    'Im Treibgut liegt eine Messingkiste: 50 von der Bank.',
    'Ein alter Siegelbrief öffnet jede Tür. Behalte diese Karte, um den Zollturm zu verlassen.',
    'Schritte hinter dir im Nebel. Gehe drei Felder zurück.',
    'Der Hafenwächter hat dich gesehen: direkt in den Zollturm, ohne Startbonus.',
    'Der Sturm hat Dächer abgedeckt: 25 je Haus, 100 je Leuchtturm zahlen.',
    'Nach Sonnenuntergang am Kai erwischt: 15 an die Bank.',
    'Treffpunkt {field:5}. Falls du dabei Los passierst, gibt es den Startbonus.',
    'Ein Brief ohne Absender lädt dich ins {field:39}. Geh dorthin.',
    'Du lädst alle zum Fischessen ein. Zahle jedem anderen 50.',
    'Eine verschollene Fracht wird ausgelöst: 150 von der Bank.',
  ],
  chest: [
    'Die Gemeinde sammelt sich am Kai. Vorrücken auf {field:0}.',
    'Ein Irrtum der Hafenkasse zu deinen Gunsten: du erhältst 200.',
    'Der Arzt kommt bei Nacht. Zahle 50.',
    'Alte Seekarten verkauft: 50 für deine Kasse.',
    'Der Pfarrer verbürgt sich für dich. Behalte diese Karte, um den Zollturm zu verlassen.',
    'Beim Schmuggel ertappt: direkt in den Zollturm.',
    'Die Versicherung zahlt für das gesunkene Boot: 100 für dich.',
    'Im Mantelfutter finden sich 20.',
    'Dein Geburtstag im Gasthaus: alle anderen geben dir je 10.',
    'Ein Erbe aus der Stadt: 100.',
    'Neue Laternen fürs Haus. Zahle 100.',
    'Spende für die Rettungsbootstation: 50 bezahlen.',
    'Du hilfst beim Entladen. Die Bank zahlt dir 25.',
    'Teeren und Kalfatern: 40 je Haus, 115 je Leuchtturm.',
    'Dein Bild hängt im Postamt: 10 als Preis.',
    'Ein entfernter Verwandter auf See hinterlässt dir 100.',
  ],
};
export const TW01_TOKENS = { hat: 'Laterne', car: 'Kompass', dog: 'Rabe', ship: 'Anker', thimble: 'Taschenuhr', barrow: 'Schlüssel', shoe: 'Fernrohr', cat: 'Schwarze Katze' };

const BASE = '/games/theme-worlds/tw-01/';
export const TW01 = {
  id: 'TW-01', kind: 'board', source: 'ART-W1', released: true, fallback: 'standard',
  name: { de: 'Schatten über Neuengland', en: 'Shadows over New England' },
  description: { de: 'Neblige Hafenstadt der 1920er: Leuchttürme, Lagerhäuser, Messing und alte Bücher.', en: 'A foggy 1920s harbour town: lighthouses, warehouses, brass and old books.' },
  games: ['monopoly'], variants: { monopoly: ['classic', 'speed'] },
  assets: { preview: BASE + 'preview.svg', css: [BASE + 'tw-01.css'], preload: [BASE + 'preview.svg', BASE + 'table.svg', BASE + 'card-back.svg'] },
  palette: { colors: ['#1b2a33', '#2f4550', '#c8a462', '#e6dcc3', '#5b2b26', '#3e5a4a'], background: '#11191e', text: '#1d1a15' },
  fonts: [], effects: [],
  texts: { fields: TW01_FIELDS, cards: TW01_CARDS, tokens: TW01_TOKENS },
};
