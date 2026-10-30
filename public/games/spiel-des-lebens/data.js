export const JOBS = [
  { id: 'garden', name: 'Stadtgärtnerin', salary: 60000, college: false, ability: 'cost', bonus: 10000, text: 'Bei Ausgaben für Ereignisse 10.000 sparen.' },
  { id: 'cook', name: 'Quartierskoch', salary: 70000, college: false, ability: 'gift', bonus: 10000, text: 'Bei Familiengeschenken 10.000 zusätzlich von der Bank.' },
  { id: 'craft', name: 'Werkstattmeisterin', salary: 80000, college: false, ability: 'cost', bonus: 10000, text: 'Bei Ausgaben für Ereignisse 10.000 sparen.' },
  { id: 'stage', name: 'Bühnenbauer', salary: 65000, college: false, ability: 'event', bonus: 10000, text: 'Bei positiven Geldereignissen 10.000 extra.' },
  { id: 'train', name: 'Zugbegleiterin', salary: 75000, college: false, ability: 'payday', bonus: 5000, text: 'An jedem Zahltag 5.000 extra.' },
  { id: 'books', name: 'Buchhändler', salary: 55000, college: false, ability: 'event', bonus: 15000, text: 'Bei positiven Geldereignissen 15.000 extra.' },
  { id: 'research', name: 'Wolkenforscherin', salary: 120000, college: true, ability: 'event', bonus: 20000, text: 'Bei positiven Geldereignissen 20.000 extra.' },
  { id: 'design', name: 'Brückenplaner', salary: 110000, college: true, ability: 'cost', bonus: 20000, text: 'Bei Ausgaben für Ereignisse 20.000 sparen.' },
  { id: 'doctor', name: 'Landärztin', salary: 130000, college: true, ability: 'gift', bonus: 20000, text: 'Bei Familiengeschenken 20.000 zusätzlich von der Bank.' },
  { id: 'eco', name: 'Energieberater', salary: 100000, college: true, ability: 'payday', bonus: 15000, text: 'An jedem Zahltag 15.000 extra.' },
  { id: 'code', name: 'Spieleentwicklerin', salary: 125000, college: true, ability: 'event', bonus: 15000, text: 'Bei positiven Geldereignissen 15.000 extra.' },
  { id: 'law', name: 'Mediationsprofi', salary: 140000, college: true, ability: 'cost', bonus: 10000, text: 'Bei Ausgaben für Ereignisse 10.000 sparen.' },
];
export const HOUSES = [
  { id: 'cottage', name: 'Apfelgarten-Häuschen', price: 120000, sale: [160000, 220000] },
  { id: 'loft', name: 'Atelier über den Dächern', price: 200000, sale: [260000, 350000] },
  { id: 'farm', name: 'Sonnenblumenhof', price: 180000, sale: [220000, 310000] },
  { id: 'boat', name: 'Hausboot Abendrot', price: 100000, sale: [130000, 190000] },
  { id: 'tower', name: 'Alte Wassermühle', price: 250000, sale: [300000, 430000] },
  { id: 'villa', name: 'Villa am Fuchshügel', price: 350000, sale: [420000, 570000] },
  { id: 'town', name: 'Buntes Stadthaus', price: 160000, sale: [200000, 290000] },
  { id: 'forest', name: 'Waldhaus mit Sternwarte', price: 280000, sale: [340000, 470000] },
];
export const EVENTS = [
  { text: 'Dein Marmeladenstand wird zum Dorftreff. Du bekommst 40.000.', money: 40000 },
  { text: 'Die Waschmaschine übt Stepptanz. Reparatur: 30.000.', money: -30000 },
  { text: 'Eine vergessene Sammelkarte finanziert den Urlaub. Du bekommst 60.000.', money: 60000 },
  { text: 'Das Dach hat jetzt ein ungeplantes Sternenfenster. Zahle 50.000.', money: -50000 },
  { text: 'Du organisierst das Nachbarschaftsfest. Eine Lebenskarte!', life: 1 },
  { text: 'Familienzuwachs: Ein weiterer Sitz wird belegt.', kids: 1 },
  { text: 'Doppelte Überraschung: Zwillinge steigen ein.', kids: 2 },
  { text: 'Dein Einsatz wird gesehen. Das Gehalt steigt um 20.000.', raise: 20000 },
  { text: 'Eine neue Stelle lockt. Wähle einen anderen Beruf.', job: true },
  { text: 'Der große Gartenwettbewerb: Drehe. 1–5 kostet 30.000, 6–10 bringt 70.000.', chance: true },
  { text: 'Eine Zugreise wird zum Abenteuer. Du erhältst eine Lebenskarte.', life: 1 },
  { text: 'Das selbstgebaute Regal hält – nach dem dritten Versuch. Material: 20.000.', money: -20000 },
  { text: 'Dein Hörspiel gewinnt den Publikumspreis. Du bekommst 50.000.', money: 50000 },
  { text: 'Ein verlorener Hund findet durch dich nach Hause. Eine Lebenskarte!', life: 1 },
  { text: 'Die Familienfeier braucht einen größeren Tisch. Zahle 40.000.', money: -40000 },
  { text: 'Ein neues Hobby wird zum Nebenverdienst. Du bekommst 30.000.', money: 30000 },
];

export function lifeBoard(short = false) {
  const marks = short ? { graduation: 4, wedding: 9, house: 14, family: 18, risk: 26, retirement: 38 } : { graduation: 8, wedding: 18, house: 28, family: 35, risk: 50, retirement: 72 };
  const cols = short ? 8 : 12, step = short ? 112 : 76, labels = { graduation: 'Abschluss', wedding: 'Hochzeit', house: 'Hauskauf', family: 'Familie / Karriere', risk: 'Sicher / Riskant', retirement: 'Ruhestand' };
  const board = Array.from({ length: marks.retirement + 1 }, (_, i) => {
    const stop = Object.keys(marks).find((k) => marks[k] === i), row = Math.floor(i / cols), col = i % cols;
    const kind = stop || (i === 0 ? 'start' : i % 5 === 0 ? 'payday' : i % 7 === 0 ? 'life' : 'event');
    return { id: String(i), index: i, kind, name: labels[kind] || { start: 'Dein Start', payday: 'Zahltag', life: 'Lebensmoment', event: 'Überraschung' }[kind], stop: !!stop,
      x: 65 + (row % 2 ? cols - 1 - col : col) * step, y: 100 + row * 150 + Math.sin(col / (cols - 1) * Math.PI) * 30, next: i < marks.retirement ? String(i + 1) : null };
  });
  for (const [fork, prefix, length, route] of [['family', 'c', short ? 4 : 8, 'career'], ['risk', 'r', short ? 5 : 10, 'risk']]) {
    const start = marks[fork], end = start + length + 1;
    for (let i = start + 1; i < end; i++) { const base = board[i]; board.push({ ...base, id: prefix + i, route, y: base.y - 62, kind: route === 'career' ? i % 2 ? 'raise' : 'job' : 'risk-event', name: route === 'career' ? 'Karrierechance' : 'Wagnis', stop: false, next: i === end - 1 ? String(end) : prefix + (i + 1) }); if (fork === 'family' && base.kind === 'event') { base.kind = i % 2 ? 'child' : 'life'; base.name = base.kind === 'child' ? 'Familienzuwachs' : 'Lebensmoment'; } }
    board[start].branches = fork === 'family' ? { family: String(start + 1), career: prefix + (start + 1) } : { safe: String(start + 1), risk: prefix + (start + 1) };
  }
  return { fields: board, marks, width: 1000, height: Math.ceil((marks.retirement + 1) / cols) * 150 + 160 };
}
