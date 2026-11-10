// EXP-072 Rhythmus-Rausch: Konzertbühne. Eigener Beat (Kick, Snare, Hi-Hat) im Takt der Noten, Treffer spielen Töne der Melodie,
// Fehltipps einen dumpfen Ton, die 50er-Serie Publikumsjubel. Alles erzeugt: Ein Beat muss exakt im Takt liegen.
import arcade from './party.js';
import { extend } from './extend.js';
// Pentatonik in a-Moll: Jede Bahn hat ihren Ton, die Melodie entsteht aus den getroffenen Bahnen.
const SCALE = [440, 523.25, 587.33, 659.25, 783.99];
const lane = (freq) => [{ kind: 'bell', freq, ms: 220, vol: 0.04, ratio: 2, index: 1.2 }, { kind: 'tone', freq: freq / 2, ms: 160, vol: 0.02, type: 'triangle' }];
const cheer = Array.from({ length: 11 }, (_, k) => ({ kind: 'noise', freq: 1500 + (k % 4) * 450, ms: 70, vol: 0.08, type: 'bandpass', q: 1.1, at: k * 45 }));
export default extend(arcade, {
  id: 'rhythmus-rausch',
  synth: ['kick', 'snare', 'hat', 'lane0', 'lane1', 'lane2', 'lane3', 'perfect', 'stray', 'cheer'],
  events: {
    kick: [{ kind: 'bass', freq: 58, ms: 150, vol: 0.09 }],
    snare: [{ kind: 'noise', freq: 1800, ms: 90, vol: 0.12, type: 'bandpass', q: 0.9 }, { kind: 'tock', freq: 210, ms: 50, vol: 0.04 }],
    hat: [{ kind: 'noise', freq: 7000, ms: 30, vol: 0.05, type: 'highpass', q: 0.7 }],
    lane0: lane(SCALE[0]), lane1: lane(SCALE[1]), lane2: lane(SCALE[2]), lane3: lane(SCALE[4]),
    perfect: [{ kind: 'bell', freq: 1760, ms: 120, vol: 0.02 }],
    stray: [{ kind: 'tone', freq: 98, ms: 120, vol: 0.05, type: 'square' }],
    cheer,
  },
});
