// Gedächtnisküche – Partyspiel (Bauart B: alle spielen gleichzeitig solo, gleicher Seed, der Server prüft das Ergebnis). Regeln und Ablauf: logic.js.
import { SoloRoom, soloOptions } from '../solo-room.js';
import * as LOGIC from '../../public/games/gedaechtnis-kueche/logic.js';

export class Room extends SoloRoom {
  static LOGIC = LOGIC;
  static OPTIONS = [
    ...soloOptions(),
    { key: 'reverse', label: 'Rezept rückwärts nennen', type: 'bool' },
  ];
  defaultSettings() { return { rounds: 5, writeSecs: 60, target: 0, spectators: false, reverse: false }; }
  constructor(code, settings, onChange) { super(code, settings, onChange, { minPlayers: 2, maxPlayers: 8 }); }
  get timed() { return false; }
  roundOptions() { return { reverse: !!this.settings.reverse }; }
}
