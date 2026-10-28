// Zahlenzoo – Partyspiel (Bauart B: alle spielen gleichzeitig solo, gleicher Seed, der Server prüft das Ergebnis). Regeln und Ablauf: logic.js.
import { SoloRoom, soloOptions } from '../solo-room.js';
import * as LOGIC from '../../public/games/zahlenzoo/logic.js';

export class Room extends SoloRoom {
  static LOGIC = LOGIC;
  static OPTIONS = [
    ...soloOptions(),
    { key: 'countOnly', label: 'Nur Zählen ohne Rechnen', type: 'bool' },
    { key: 'timeBonus', label: 'Zeitbonus für schnelle Antworten', type: 'bool' },
  ];
  defaultSettings() { return { rounds: 6, writeSecs: 40, target: 0, spectators: false, countOnly: false, timeBonus: true }; }
  constructor(code, settings, onChange) { super(code, settings, onChange, { minPlayers: 2, maxPlayers: 8 }); }
  get timed() { return false; }
  roundOptions() { return { countOnly: !!this.settings.countOnly }; }
}
