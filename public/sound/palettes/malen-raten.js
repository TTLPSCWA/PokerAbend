// EXP-040 Malen & Raten: Atelier. Leiser Pinselstrich nur beim Zeichner, Treffer-Glocke, Eieruhr kurz vor Schluss.
import party from './party.js';
import { extend } from './extend.js';
export default extend(party, {
  id: 'malen-raten',
  samples: { brush: 'cloth', hit: 'glass-light', frame: 'wood-light', highlight: 'stinger-up' },
  // Das Klingeln der Eieruhr bleibt erzeugt; dafür gibt es keine passende CC0-Aufnahme.
  synth: ['ring'],
  events: {
    brush: [{ kind: 'noise', freq: 900, ms: 180, vol: 0.06, type: 'lowpass', q: 0.6 }],
    hit: [{ kind: 'bell', freq: 1320, ms: 380, vol: 0.035 }],
    frame: [{ kind: 'tock', freq: 420, ms: 80, vol: 0.05 }],
    ring: [0, 75, 150, 225, 300, 375].map((at) => ({ kind: 'bell', freq: 2100, ms: 90, vol: 0.03, at })),
    highlight: [{ kind: 'chord', freqs: [523, 659, 784, 1047], ms: 900, vol: 0.03 }],
  },
});
