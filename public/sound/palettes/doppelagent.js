// EXP-081 Doppelagent: Geheimdienst-Lounge. Schreibmaschine bei Fragen und Antworten, Akte öffnen, Spionage-Akkord bei der Enthüllung.
import standard from './standard.js';
import { extend } from './extend.js';
export default extend(standard, {
  id: 'doppelagent',
  ambient: 'stadtregen',
  samples: { type: 'ui-click', file: 'paper', accuse: 'wood-knock', vote: 'wood-light', highlight: 'stinger-up' },
  // Der Spionage-Akkord (Moll mit großer Septime) bleibt erzeugt; dafür gibt es keine passende CC0-Aufnahme.
  synth: ['reveal'],
  events: {
    type: [0, 70, 150, 210].map((at, i) => ({ kind: 'tock', freq: 1900 - i * 90, ms: 28, vol: 0.045, at })),
    file: [{ kind: 'noise', freq: 1300, ms: 170, vol: 0.14 }],
    accuse: [{ kind: 'tock', freq: 180, ms: 140, vol: 0.08 }, { kind: 'tock', freq: 140, ms: 160, vol: 0.07, at: 150 }],
    vote: [{ kind: 'tock', freq: 520, ms: 60, vol: 0.05 }],
    reveal: [{ kind: 'tone', freq: 220, ms: 560, vol: 0.035, type: 'triangle' }, { kind: 'tone', freq: 261.6, ms: 520, vol: 0.03, type: 'triangle', at: 40 }, { kind: 'tone', freq: 329.6, ms: 480, vol: 0.03, type: 'triangle', at: 80 }, { kind: 'tone', freq: 415.3, ms: 440, vol: 0.035, type: 'triangle', at: 120 }],
    highlight: [{ kind: 'chord', freqs: [294, 370, 440, 554], ms: 900, vol: 0.03 }],
  },
});
