// EXP-087 Doppelkopf: Vereinsheim. „Re!“ als kurzer Messington, „Kontra!“ als tieferer Gegenton, Jagdhorn beim gefangenen Fuchs.
import holz from './holz.js';
import { extend } from './extend.js';
const brass = (freq, at, ms, vol = 0.05) => ({ kind: 'tone', freq, ms, vol, type: 'sawtooth', at });
export default extend(holz, {
  id: 'doppelkopf',
  samples: { sweep: 'card-draw', flip: 'card-place', highlight: 'stinger-up' },
  // Ansagen und Jagdhorn bleiben erzeugt; dafür gibt es keine passende CC0-Aufnahme.
  synth: ['re', 'kontra', 'horn'],
  events: {
    re: [brass(523, 0, 110), brass(659, 110, 200)],
    kontra: [brass(330, 0, 110), brass(247, 110, 220)],
    horn: [brass(392, 0, 120, 0.045), brass(392, 130, 80, 0.045), brass(523, 220, 120, 0.045), brass(659, 350, 220, 0.05)],
    sweep: [{ kind: 'noise', freq: 1100, ms: 160, vol: 0.12, type: 'lowpass', q: 0.7 }],
    flip: [{ kind: 'noise', freq: 1900, ms: 70, vol: 0.13 }],
    highlight: [{ kind: 'chord', freqs: [294, 370, 440, 587], ms: 900, vol: 0.03 }],
  },
});
