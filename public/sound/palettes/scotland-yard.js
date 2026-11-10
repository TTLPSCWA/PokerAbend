// EXP-001 Scotland Yard: Stadt Aure bei Nacht. Jedes Ticket hat seinen Klang, Auftauchen spannt an, Festnahme klickt und stempelt.
import standard from './standard.js';
import { extend } from './extend.js';
export default extend(standard, {
  id: 'scotland-yard',
  ambient: 'stadtregen',
  samples: { black: 'paper', casefile: 'paper', reveal: 'glass-medium', cuffs: 'chip-collide', stamp: 'wood-knock', highlight: 'stinger-up' },
  // Hupe, Bremse, U-Bahn und Fährhorn gibt es nicht als passende CC0-Aufnahme; sie bleiben erzeugt.
  synth: ['taxi', 'bus', 'underground', 'ferry'],
  events: {
    taxi: [{ kind: 'tone', freq: 440, ms: 110, vol: 0.05, type: 'square' }, { kind: 'tone', freq: 554, ms: 110, vol: 0.05, type: 'square' }, { kind: 'tone', freq: 440, ms: 150, vol: 0.05, type: 'square', at: 150 }, { kind: 'tone', freq: 554, ms: 150, vol: 0.05, type: 'square', at: 150 }],
    bus: [{ kind: 'noise', freq: 3400, ms: 320, vol: 0.16, type: 'highpass', q: 0.7 }, { kind: 'bass', freq: 96, ms: 220, vol: 0.06, at: 240 }],
    underground: [{ kind: 'noise', freq: 240, ms: 520, vol: 0.3, type: 'lowpass', q: 0.8 }, { kind: 'bass', freq: 62, ms: 480, vol: 0.07, type: 'sawtooth' }],
    ferry: [{ kind: 'tone', freq: 146, ms: 560, vol: 0.06, type: 'sawtooth' }, { kind: 'tone', freq: 110, ms: 560, vol: 0.05, type: 'sawtooth' }],
    black: [{ kind: 'noise', freq: 1500, ms: 140, vol: 0.14 }],
    casefile: [{ kind: 'noise', freq: 1200, ms: 180, vol: 0.14 }],
    reveal: [{ kind: 'chord', freqs: [220, 261, 311], ms: 600, vol: 0.03 }],
    cuffs: [{ kind: 'tock', freq: 2100, ms: 40, vol: 0.06 }, { kind: 'tock', freq: 1700, ms: 55, vol: 0.06, at: 90 }],
    stamp: [{ kind: 'tock', freq: 160, ms: 150, vol: 0.09 }],
    highlight: [{ kind: 'chord', freqs: [294, 370, 440], ms: 800, vol: 0.03 }],
  },
});
