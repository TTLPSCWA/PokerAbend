// EXP-007 Mensch ärgere Dich nicht: Gartentisch. Holzpöppel tocken, Rauswurf ploppt, kurzes Grummeln.
import holz from './holz.js';
import { extend } from './extend.js';
export default extend(holz, {
  id: 'huetchen',
  samples: { six: 'ui-pluck', home: 'ui-confirm', highlight: 'stinger-up' },
  synth: ['plop', 'grumble'],
  events: {
    plop: [{ kind: 'plop', freq: 560, ms: 170, vol: 0.09 }],
    grumble: [{ kind: 'bass', freq: 132, ms: 190, vol: 0.07, type: 'sawtooth' }, { kind: 'bass', freq: 104, ms: 260, vol: 0.07, type: 'sawtooth', at: 170 }],
    six: [{ kind: 'bell', freq: 1040, ms: 260, vol: 0.03 }],
    home: [{ kind: 'bell', freq: 780, ms: 240, vol: 0.03 }, { kind: 'bell', freq: 1170, ms: 300, vol: 0.03, at: 130 }],
    highlight: [{ kind: 'chord', freqs: [523, 659, 784], ms: 700, vol: 0.03 }, { kind: 'bell', freq: 1568, ms: 500, vol: 0.025, at: 260 }],
  },
});
