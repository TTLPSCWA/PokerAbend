// EXP-019 Schlagfertig: Comedy-Club. Publikumslachen je nach Stimmenzahl, Rimshot bei Gleichstand, Applaus beim Volltreffer.
import party from './party.js';
import { extend } from './extend.js';
// Ein „Ha“ ist ein kurzer, formantartiger Rauschstoß; mehrere versetzte ergeben ein Lachen.
const ha = (at, freq, vol) => ({ kind: 'noise', freq, ms: 70, vol, type: 'bandpass', q: 3.5, at });
const laugh = (n, vol) => Array.from({ length: n }, (_, k) => [ha(k * 95, 900 + (k % 3) * 160, vol), ha(k * 95 + 30, 1400 - (k % 2) * 200, vol * 0.7)]).flat();
export default extend(party, {
  id: 'schlagfertig',
  samples: { index: 'paper', mic: 'ui-click', highlight: 'stinger-up' },
  // Lachen, Rimshot und Applaus bleiben erzeugt (kurz, Stärke nach Stimmen); dafür gibt es keine passende CC0-Aufnahme.
  synth: ['laugh1', 'laugh2', 'laugh3', 'rimshot', 'applause'],
  events: {
    index: [{ kind: 'noise', freq: 1700, ms: 90, vol: 0.12 }],
    mic: [{ kind: 'tock', freq: 240, ms: 60, vol: 0.06 }],
    laugh1: laugh(3, 0.07),
    laugh2: laugh(5, 0.1),
    laugh3: laugh(6, 0.14),
    rimshot: [{ kind: 'tock', freq: 210, ms: 70, vol: 0.09 }, { kind: 'tock', freq: 170, ms: 80, vol: 0.09, at: 130 }, { kind: 'noise', freq: 5200, ms: 260, vol: 0.13, type: 'highpass', q: 0.7, at: 290 }],
    applause: Array.from({ length: 12 }, (_, k) => ({ kind: 'noise', freq: 1800 + (k % 4) * 500, ms: 60, vol: 0.09, type: 'bandpass', q: 1.2, at: k * 48 })),
    highlight: [{ kind: 'chord', freqs: [392, 494, 587, 784], ms: 900, vol: 0.03 }],
  },
});
