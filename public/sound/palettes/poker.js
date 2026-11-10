// EXP-002 Texas Hold'em: Privater Salon. Chips klackern, der Pot rauscht beim Einsammeln, Karten wischen über den Filz,
// ein gedämpftes Klopfen beim Check und ein tiefer Ton beim All-in.
import casino from './casino.js';
import { extend } from './extend.js';
export default extend(casino, {
  id: 'poker',
  samples: { deal: 'cloth', check: 'wood-knock', fold: 'card-draw', collect: 'chip-handle', highlight: 'stinger-up' },
  // Der tiefe All-in-Ton bleibt erzeugt; dafür gibt es keine passende CC0-Aufnahme.
  synth: ['allin'],
  events: {
    deal: [{ kind: 'noise', freq: 1100, ms: 110, vol: 0.14, type: 'lowpass', q: 0.6 }],
    check: [{ kind: 'tock', freq: 150, ms: 70, vol: 0.07 }, { kind: 'tock', freq: 140, ms: 80, vol: 0.06, at: 110 }],
    fold: [{ kind: 'noise', freq: 1400, ms: 120, vol: 0.12 }],
    collect: [0, 40, 85, 130, 180, 240].map((at, i) => ({ kind: 'bell', freq: 2000 + (i % 3) * 180, ms: 70, vol: 0.02, ratio: 3.1, at })),
    allin: [{ kind: 'bass', freq: 82, ms: 520, vol: 0.09 }, { kind: 'tone', freq: 55, ms: 560, vol: 0.06, type: 'sine' }, { kind: 'bell', freq: 2100, ms: 110, vol: 0.02, ratio: 3.1, at: 60 }],
    highlight: [{ kind: 'chord', freqs: [392, 494, 587, 784], ms: 1000, vol: 0.03 }],
  },
});
