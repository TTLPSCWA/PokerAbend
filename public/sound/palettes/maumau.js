// EXP-003 Mau-Mau: Küchentisch. Lockeres Kartenschnippen, der Löffel klirrt bei „Mau“ an der Tasse, Doppelklirr bei „Mau-Mau“.
import holz from './holz.js';
import { extend } from './extend.js';
export default extend(holz, {
  id: 'maumau',
  samples: { card: 'card-place', draw: 'card-draw', deal: 'card-deal', mau: 'glass-light', maumau: 'glass-medium', seven: 'wood-light', wish: 'ui-pluck', highlight: 'stinger-up' },
  // Das „Einschlafen“ bei der 8 bleibt erzeugt; dafür gibt es keine passende CC0-Aufnahme.
  synth: ['sleep'],
  events: {
    card: [{ kind: 'noise', freq: 2100, ms: 60, vol: 0.16 }],
    draw: [{ kind: 'noise', freq: 1500, ms: 110, vol: 0.13 }],
    mau: [{ kind: 'bell', freq: 1760, ms: 260, vol: 0.035 }],
    maumau: [{ kind: 'bell', freq: 1760, ms: 200, vol: 0.035 }, { kind: 'bell', freq: 2093, ms: 300, vol: 0.035, at: 170 }],
    seven: [{ kind: 'tock', freq: 520, ms: 70, vol: 0.06 }],
    sleep: [{ kind: 'tone', freq: 392, ms: 200, vol: 0.04, type: 'sine' }, { kind: 'tone', freq: 294, ms: 320, vol: 0.04, type: 'sine', at: 190 }],
    wish: [{ kind: 'bell', freq: 880, ms: 220, vol: 0.035 }],
    highlight: [{ kind: 'chord', freqs: [392, 494, 587, 784], ms: 900, vol: 0.03 }],
  },
});
