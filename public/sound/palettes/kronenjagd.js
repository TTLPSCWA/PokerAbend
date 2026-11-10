// EXP-042 Kronenjagd: Burghof. Fanfare beim Kronengewinn, abfallende Trompete beim Verlust.
import party from './party.js';
import { extend } from './extend.js';
const brass = (freq, at, ms) => ({ kind: 'tone', freq, ms, vol: 0.05, type: 'sawtooth', at });
export default extend(party, {
  id: 'kronenjagd',
  samples: { steal: 'wood-light', count: 'ui-click', highlight: 'stinger-up' },
  // Fanfare und Trompeten-Abfall bleiben erzeugt; dafür gibt es keine passende CC0-Aufnahme.
  synth: ['crown', 'lost'],
  events: {
    crown: [brass(392, 0, 90), brass(523, 100, 90), brass(659, 200, 90), brass(784, 300, 260)],
    lost: [brass(523, 0, 130), brass(440, 130, 130), brass(349, 260, 130), brass(262, 390, 200)],
    steal: [{ kind: 'tock', freq: 520, ms: 70, vol: 0.05 }],
    count: [{ kind: 'tock', freq: 880, ms: 40, vol: 0.04 }],
    highlight: [{ kind: 'chord', freqs: [392, 494, 587, 784], ms: 1000, vol: 0.03 }],
  },
});
