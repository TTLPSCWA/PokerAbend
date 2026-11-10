// EXP-094 Reaktor-Notfall: Retro-Kontrollraum einer fiktiven Anlage. Ein weicher Alarm, der mit der Temperatur steigt (nie schrill),
// Zischen der Kühlung bei jedem Code, Entwarnung bei Erfolg, ein Seufzer der Anlage bei der Rettung in letzter Sekunde.
import standard from './standard.js';
import { extend } from './extend.js';
const alarm = (freq) => [{ kind: 'tone', freq, ms: 220, vol: 0.035, type: 'triangle' }, { kind: 'tone', freq: freq * 0.84, ms: 220, vol: 0.035, type: 'triangle', at: 240 }];
export default extend(standard, {
  id: 'reaktor-notfall',
  samples: { switch: 'ui-click', wrong: 'ui-error', highlight: 'stinger-up' },
  // Alarm, Zischen, Entwarnung und Seufzer bleiben erzeugt; dafür gibt es keine passende CC0-Aufnahme.
  synth: ['alarm1', 'alarm2', 'alarm3', 'hiss', 'allclear', 'sigh'],
  events: {
    alarm1: alarm(392), alarm2: alarm(466), alarm3: alarm(554),
    hiss: [{ kind: 'noise', freq: 6000, ms: 420, vol: 0.09, type: 'highpass', q: 0.7 }],
    allclear: [{ kind: 'tone', freq: 523, ms: 160, vol: 0.04, type: 'sine' }, { kind: 'tone', freq: 659, ms: 160, vol: 0.04, type: 'sine', at: 170 }, { kind: 'tone', freq: 784, ms: 260, vol: 0.04, type: 'sine', at: 340 }],
    sigh: [{ kind: 'noise', freq: 700, ms: 560, vol: 0.12, type: 'lowpass', q: 0.6 }, { kind: 'tone', freq: 196, ms: 500, vol: 0.03, type: 'sine', at: 40 }],
    switch: [{ kind: 'tock', freq: 900, ms: 40, vol: 0.05 }],
    wrong: [{ kind: 'tone', freq: 140, ms: 220, vol: 0.05, type: 'square' }],
    highlight: [{ kind: 'chord', freqs: [392, 494, 587, 784], ms: 900, vol: 0.03 }],
  },
});
