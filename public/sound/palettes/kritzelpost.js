// EXP-038 Kritzelpost: Postamt. Stempel-Klatsch beim Abgeben, Umschlag-Rascheln, Postsirene bei der Auflösung.
import holz from './holz.js';
import { extend } from './extend.js';
export default extend(holz, {
  id: 'kritzelpost',
  samples: { stamp: 'wood-knock', envelope: 'paper', page: 'card-place', highlight: 'stinger-up' },
  // Die Postsirene (Zweiklang-Horn) bleibt erzeugt; dafür gibt es keine passende CC0-Aufnahme.
  synth: ['siren'],
  events: {
    stamp: [{ kind: 'tock', freq: 170, ms: 130, vol: 0.09 }, { kind: 'noise', freq: 900, ms: 60, vol: 0.12 }],
    envelope: [{ kind: 'noise', freq: 1500, ms: 200, vol: 0.14 }],
    page: [{ kind: 'noise', freq: 1900, ms: 70, vol: 0.12 }],
    siren: [{ kind: 'tone', freq: 587, ms: 140, vol: 0.045, type: 'square' }, { kind: 'tone', freq: 440, ms: 140, vol: 0.045, type: 'square', at: 150 }, { kind: 'tone', freq: 587, ms: 140, vol: 0.045, type: 'square', at: 300 }, { kind: 'tone', freq: 440, ms: 150, vol: 0.045, type: 'square', at: 450 }],
    highlight: [{ kind: 'chord', freqs: [392, 494, 587, 784], ms: 900, vol: 0.03 }],
  },
});
