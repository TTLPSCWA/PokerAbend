// EXP-088 Schach: Schachcafé. Holzfiguren aus der Holz-Palette, dazu Glocke (Schach), Uhr und der fallende König.
import holz from './holz.js';
import { extend } from './extend.js';
export default extend(holz, {
  id: 'schach',
  synth: ['slide'], // Schieben über das Brett: leises Rauschen, keine passende Aufnahme
  samples: { check: 'glass-light', tick: 'ui-click', promote: 'ui-confirm', highlight: 'wood-knock' },
  events: {
    slide: [{ kind: 'noise', freq: 900, ms: 150, vol: 0.09, q: 0.7, type: 'lowpass' }],
    check: [{ kind: 'bell', freq: 1180, ms: 420, vol: 0.03, ratio: 2.4, index: 0.6 }],
    tick: [{ kind: 'tock', freq: 1500, ms: 35, vol: 0.03 }],
    promote: [{ kind: 'plop', freq: 520, ms: 120, vol: 0.05 }, { kind: 'bell', freq: 990, ms: 260, vol: 0.03, at: 110 }],
    highlight: [{ kind: 'tock', freq: 210, ms: 160, vol: 0.08 }, { kind: 'tock', freq: 150, ms: 220, vol: 0.07, at: 240 }, { kind: 'bell', freq: 392, ms: 900, vol: 0.025, at: 420 }],
  },
});
