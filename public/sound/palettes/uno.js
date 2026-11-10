// EXP-004 UNO: knackiges Kartenklatschen, Zieh-Rascheln, Stopp-Ton, Wusch beim Richtungswechsel, kurze Fanfare beim Ruf.
import party from './party.js';
import { extend } from './extend.js';
export default extend(party, {
  id: 'uno',
  samples: { card: 'card-place', draw: 'card-draw', wish: 'ui-pluck', highlight: 'arcade-power' },
  // Stopp-Ton, Wusch, Fanfare und der wachsende Stapelton bleiben erzeugt; dafür gibt es keine passende CC0-Aufnahme.
  synth: ['skip', 'reverse', 'call', 'stack'],
  events: {
    card: [{ kind: 'noise', freq: 2400, ms: 55, vol: 0.2 }, { kind: 'tock', freq: 300, ms: 50, vol: 0.05 }],
    draw: [{ kind: 'noise', freq: 1500, ms: 110, vol: 0.13 }],
    skip: [{ kind: 'tone', freq: 392, ms: 120, vol: 0.05, type: 'square' }, { kind: 'tone', freq: 262, ms: 220, vol: 0.05, type: 'square', at: 130 }],
    reverse: [{ kind: 'noise', freq: 700, ms: 180, vol: 0.14, type: 'bandpass', q: 1.5 }, { kind: 'noise', freq: 1600, ms: 180, vol: 0.14, type: 'bandpass', q: 1.5, at: 110 }, { kind: 'noise', freq: 3200, ms: 160, vol: 0.1, type: 'bandpass', q: 1.5, at: 220 }],
    call: [{ kind: 'tone', freq: 523, ms: 90, vol: 0.05, type: 'square' }, { kind: 'tone', freq: 659, ms: 90, vol: 0.05, type: 'square', at: 100 }, { kind: 'tone', freq: 784, ms: 90, vol: 0.05, type: 'square', at: 200 }, { kind: 'tone', freq: 1047, ms: 240, vol: 0.05, type: 'square', at: 300 }],
    stack: [{ kind: 'tone', freq: 330, ms: 90, vol: 0.05, type: 'sawtooth' }, { kind: 'tone', freq: 440, ms: 90, vol: 0.05, type: 'sawtooth', at: 90 }, { kind: 'tone', freq: 587, ms: 160, vol: 0.055, type: 'sawtooth', at: 180 }],
    wish: [{ kind: 'bell', freq: 880, ms: 220, vol: 0.035 }],
    highlight: [{ kind: 'chord', freqs: [392, 494, 587, 784], ms: 800, vol: 0.03 }],
  },
});
