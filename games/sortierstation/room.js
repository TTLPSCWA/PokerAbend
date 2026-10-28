// Sortierstation – Partyspiel (Bauart B: alle spielen gleichzeitig solo, gleicher Seed, der Server prüft das Ergebnis). Regeln und Ablauf: logic.js.
import { SoloRoom, soloOptions } from '../solo-room.js';
import * as LOGIC from '../../public/games/sortierstation/logic.js';

export class Room extends SoloRoom {
  static LOGIC = LOGIC;
  static OPTIONS = [
    ...soloOptions(),
    { key: 'switchRule', label: 'Regel wechselt zwischendurch (Farbe, dann Form)', type: 'bool' },
    { key: 'noPenalty', label: 'Ohne Minuspunkte', type: 'bool' },
  ];
  defaultSettings() { return { rounds: 3, writeSecs: 30, target: 0, spectators: false, switchRule: false, noPenalty: false }; }
  constructor(code, settings, onChange) { super(code, settings, onChange, { minPlayers: 2, maxPlayers: 8 }); }
  get timed() { return true; }
  roundOptions() { return { switchRule: !!this.settings.switchRule }; }
}
