// EXP-086 Skat: Gute Stube. Fester Knöchelklopfer beim Trumpf-Ausspielen, Bleistiftkratzen beim Reizen, Rascheln beim Skat-Aufnehmen,
// dreimaliges Stammtisch-Klopfen beim Grand Hand.
import holz from './holz.js';
import { extend } from './extend.js';
export default extend(holz, {
  id: 'skat',
  samples: { knock: 'wood-knock', rustle: 'paper', sweep: 'card-draw', press: 'card-place', highlight: 'stinger-up' },
  // Bleistiftkratzen und das dreimalige Klopfen bleiben erzeugt; dafür gibt es keine passende CC0-Aufnahme.
  synth: ['pencil', 'stammtisch'],
  events: {
    knock: [{ kind: 'tock', freq: 140, ms: 110, vol: 0.1 }],
    pencil: [{ kind: 'noise', freq: 4200, ms: 90, vol: 0.06, type: 'bandpass', q: 3 }, { kind: 'noise', freq: 3600, ms: 120, vol: 0.06, type: 'bandpass', q: 3, at: 110 }],
    rustle: [{ kind: 'noise', freq: 1300, ms: 220, vol: 0.14 }],
    sweep: [{ kind: 'noise', freq: 1100, ms: 160, vol: 0.12, type: 'lowpass', q: 0.7 }],
    press: [{ kind: 'noise', freq: 1900, ms: 70, vol: 0.13 }],
    stammtisch: [0, 170, 340].map((at) => ({ kind: 'tock', freq: 130, ms: 110, vol: 0.11, at })),
    highlight: [{ kind: 'chord', freqs: [262, 330, 392, 523], ms: 900, vol: 0.03 }],
  },
});
