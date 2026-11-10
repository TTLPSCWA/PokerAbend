// EXP-079 Schubsarena: Sumo-Ring auf einer Eisscholle. Stoß-Wumms, Rutschen auf Eis, Platsch beim Rausfallen.
import party from './party.js';
import { extend } from './extend.js';
export default extend(party, {
  id: 'schubsarena',
  samples: { shove: 'punch', count: 'ui-click', highlight: 'stinger-up' },
  // Rutschen, Platsch und Eisknacken bleiben erzeugt; dafür gibt es keine passende CC0-Aufnahme.
  synth: ['slide', 'splash', 'crack'],
  events: {
    shove: [{ kind: 'bass', freq: 90, ms: 160, vol: 0.1 }, { kind: 'noise', freq: 500, ms: 80, vol: 0.14, type: 'lowpass', q: 0.8 }],
    slide: [{ kind: 'noise', freq: 5200, ms: 300, vol: 0.07, type: 'highpass', q: 0.7 }],
    splash: [{ kind: 'bass', freq: 120, ms: 140, vol: 0.08 }, { kind: 'noise', freq: 900, ms: 300, vol: 0.2, type: 'lowpass', q: 0.7, at: 40 }, { kind: 'noise', freq: 2600, ms: 220, vol: 0.09, type: 'bandpass', q: 1.2, at: 120 }],
    crack: [{ kind: 'noise', freq: 3200, ms: 45, vol: 0.12, type: 'bandpass', q: 4 }, { kind: 'noise', freq: 2100, ms: 60, vol: 0.1, type: 'bandpass', q: 4, at: 70 }],
    count: [{ kind: 'tock', freq: 880, ms: 40, vol: 0.04 }],
    highlight: [{ kind: 'chord', freqs: [392, 494, 587, 784], ms: 900, vol: 0.03 }],
  },
});
