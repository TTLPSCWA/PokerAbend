// EXP-036 Werwolf: Dorfplatz. Nachts Grillen und Eule, morgens der Hahn, Murmeln bei der Abstimmung, dumpfer Gong bei der Hinrichtung.
import holz from './holz.js';
import { extend } from './extend.js';
const chirp = (at) => ({ kind: 'noise', freq: 4600, ms: 38, vol: 0.09, type: 'bandpass', q: 9, at });
export default extend(holz, {
  id: 'werwolf',
  ambient: 'wald-nacht',
  samples: { vote: 'wood-light', death: 'wood-knock', flip: 'card-place', highlight: 'stinger-up', end: 'stinger-down' },
  // Grillen, Eule, Hahn, Murmeln und Gong gibt es nicht als passende CC0-Aufnahme; sie bleiben erzeugt.
  synth: ['night', 'rooster', 'murmur', 'gong'],
  events: {
    night: [chirp(0), chirp(70), chirp(140), chirp(330), chirp(400), { kind: 'tone', freq: 392, ms: 150, vol: 0.035, at: 250 }, { kind: 'tone', freq: 330, ms: 180, vol: 0.035, at: 420 }],
    rooster: [{ kind: 'tone', freq: 587, ms: 90, vol: 0.045, type: 'sawtooth' }, { kind: 'tone', freq: 784, ms: 90, vol: 0.045, type: 'sawtooth', at: 100 }, { kind: 'tone', freq: 988, ms: 200, vol: 0.05, type: 'sawtooth', at: 200 }, { kind: 'tone', freq: 740, ms: 180, vol: 0.04, type: 'sawtooth', at: 400 }],
    murmur: [{ kind: 'noise', freq: 320, ms: 520, vol: 0.2, type: 'bandpass', q: 1.2 }, { kind: 'noise', freq: 520, ms: 300, vol: 0.12, type: 'bandpass', q: 2, at: 160 }],
    gong: [{ kind: 'bell', freq: 98, ms: 600, vol: 0.09, ratio: 1.4, index: 2.2 }, { kind: 'bass', freq: 73, ms: 420, vol: 0.07 }],
    vote: [{ kind: 'tock', freq: 420, ms: 70, vol: 0.05 }],
    death: [{ kind: 'tock', freq: 190, ms: 150, vol: 0.07 }],
    flip: [{ kind: 'noise', freq: 1700, ms: 70, vol: 0.14 }],
    highlight: [{ kind: 'chord', freqs: [392, 494, 587, 784], ms: 1100, vol: 0.03 }],
    end: [{ kind: 'chord', freqs: [196, 233, 294], ms: 600, vol: 0.035 }, { kind: 'tone', freq: 440, ms: 420, vol: 0.03, at: 140 }],
  },
});
