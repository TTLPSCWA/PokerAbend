// Aufgenommene Klänge (Kenney, CC0): Katalog, Dateien, Lizenzliste, Paletten-Zuordnung und Wiedergabe in der Engine.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { SAMPLE_BASE, SAMPLE_SETS } from '../public/sound/samples/catalog.js';
import { createSoundEngine, loadPalette, PALETTES, MIXER_DEFAULTS } from '../public/sound/engine.js';

const DIR = 'public/sound/samples';
const LONG_EVENTS = new Set(['win', 'lose', 'highlight', 'call', 'catch', 'end']);
// MPEG-1 Layer III: Dauer über die Frames zählen (keine externen Werkzeuge in CI nötig).
function mp3Seconds(buf) {
  const RATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], SR = [44100, 48000, 32000];
  let i = 0, frames = 0, rate = 44100;
  if (buf.slice(0, 3).toString() === 'ID3') i = 10 + ((buf[6] & 0x7f) << 21 | (buf[7] & 0x7f) << 14 | (buf[8] & 0x7f) << 7 | (buf[9] & 0x7f));
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) { i++; continue; }
    const bitrate = RATES[buf[i + 2] >> 4] * 1000; rate = SR[(buf[i + 2] >> 2) & 3]; const pad = (buf[i + 2] >> 1) & 1;
    if (!bitrate || !rate) { i++; continue; }
    i += Math.floor(144 * bitrate / rate) + pad; frames++;
  }
  return frames * 1152 / rate;
}
const allFiles = () => readdirSync(DIR, { recursive: true }).filter((f) => String(f).endsWith('.mp3')).map((f) => String(f).replaceAll('\\', '/')).sort();

test('Aufnahmen: jede Katalogdatei existiert, ist eine kleine MP3 und hält die Längengrenze ihrer Gruppe', () => {
  assert.equal(SAMPLE_BASE, '/sound/samples/');
  const listed = Object.values(SAMPLE_SETS).flatMap((s) => s.files).sort();
  assert.deepEqual(allFiles(), listed, 'Ordner und Katalog stimmen überein');
  for (const [name, set] of Object.entries(SAMPLE_SETS)) {
    assert.ok(['foley', 'ui', 'jingle'].includes(set.category), name);
    assert.ok(set.files.length >= 1, name);
    for (const file of set.files) {
      const buf = readFileSync(join(DIR, file));
      assert.ok(buf.length < 40 * 1024, `${file} ist zu groß`);
      assert.ok(buf[0] === 0xff || buf.slice(0, 3).toString() === 'ID3', `${file} ist keine MP3`);
      const seconds = mp3Seconds(buf);
      assert.ok(seconds > 0.01 && seconds <= set.max + 0.08, `${file}: ${seconds.toFixed(3)} s > ${set.max} s`);
    }
  }
  const total = allFiles().reduce((n, f) => n + statSync(join(DIR, f)).size, 0);
  assert.ok(total < 1024 * 1024, `Gesamtgröße ${total}`);
});

test('Aufnahmen: jede Datei steht mit Kenney-Quelle und CC0 in SOUND_LICENSES.md', () => {
  const md = readFileSync('docs/design/SOUND_LICENSES.md', 'utf8');
  assert.match(md, /Creative Commons Zero \(CC0 1\.0\)/);
  for (const file of allFiles()) assert.match(md, new RegExp('\\| `' + file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '` \\| [^|]+ \\| `[^`]+\\.ogg` \\|'), file);
  const rows = md.split('\n').filter((l) => l.startsWith('| `'));
  assert.equal(rows.length, allFiles().length, 'keine verwaisten Einträge');
  assert.ok(existsSync('scripts/sound/build_samples.py'), 'Aufbereitung nachvollziehbar');
});

test('Aufnahmen: jede Palette ordnet ihren Ereignissen vorhandene Gruppen zu, Effekte bleiben kurz', async () => {
  for (const name of PALETTES) {
    const palette = await loadPalette(name);
    for (const [event, set] of Object.entries(palette.samples)) {
      assert.ok(SAMPLE_SETS[set], `${name}.${event} → ${set}`);
      if (!LONG_EVENTS.has(event)) assert.ok(SAMPLE_SETS[set].max <= 0.6, `${name}.${event} darf höchstens 0,6 s dauern`);
    }
    // Spielpaletten dürfen einzelne Ereignisse ausdrücklich als erzeugten Ton führen (`synth`), wenn keine Aufnahme passt.
    for (const event of palette.synth || []) assert.ok(palette.events[event]?.length && !palette.samples[event], `${name}.${event} ist als erzeugt markiert`);
    for (const event of Object.keys(palette.events)) if (event !== 'splash' && !(palette.synth || []).includes(event)) assert.ok(palette.samples[event], `${name}.${event} ohne Aufnahme`);
  }
});

function fakeAudio(created) {
  const param = () => ({ value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} });
  const node = (kind) => () => { const n = { kind, gain: param(), frequency: param(), Q: param(), playbackRate: param(), connect() {}, disconnect() {}, start() { created.push(this); }, stop() {} }; return n; };
  return () => ({ currentTime: 0, sampleRate: 44100, state: 'running', destination: {},
    createGain: node('gain'), createOscillator: node('osc'), createBufferSource: node('buffer'), createBiquadFilter: node('filter'),
    createBuffer: (_c, len) => ({ length: len, getChannelData: () => new Float32Array(len) }),
    decodeAudioData: (data) => Promise.resolve({ duration: 0.3, bytes: data.byteLength }), close: async () => {} });
}
test('Engine: spielt Aufnahmen, wechselt Varianten, fällt ohne Dateien auf die Töne zurück', async () => {
  const started = [], fetched = [];
  const engine = createSoundEngine({ host: {}, game: () => 'maumau', settings: () => MIXER_DEFAULTS, contextFactory: fakeAudio(started),
    fetchSample: (url) => { fetched.push(url); return Promise.resolve(new ArrayBuffer(8)); } });
  assert.equal(engine.sampleSetFor('card'), 'card-place');
  assert.equal(engine.sampleSetFor('splash'), null);
  // Erster Ton: Dateien sind noch nicht da → synthetischer Ersatz, Laden startet.
  engine.play('card');
  const isSample = (n) => n.buffer?.duration === 0.3;
  assert.ok(started.length > 0 && !started.some(isSample), 'Ersatzton');
  assert.ok(fetched.includes('/sound/samples/card-place/1.mp3'));
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(engine.samplesReady >= SAMPLE_SETS['card-place'].files.length);
  started.length = 0;
  const picks = [];
  for (let i = 0; i < 8; i++) { engine.play('card'); picks.push(started.at(-1).buffer); }
  assert.ok(picks.every((b) => b && b.duration === 0.3), 'Aufnahme statt Ton');
  assert.ok(picks.every((b, i) => i === 0 || b !== picks[i - 1]), 'nie zweimal dieselbe Variante hintereinander');
  // Palette wechseln lädt deren Gruppen.
  await engine.use('casino'); await new Promise((r) => setTimeout(r, 20));
  assert.ok(fetched.some((u) => u.startsWith('/sound/samples/win-sax/')));
  await engine.dispose();
  // Ohne fetch (alte Browser, Node): immer die Töne.
  const tones = [];
  const plain = createSoundEngine({ host: {}, game: () => 'maumau', settings: () => MIXER_DEFAULTS, contextFactory: fakeAudio(tones) });
  plain.play('card'); assert.ok(tones.length > 0 && !tones.some((n) => n.buffer?.duration === 0.3)); await plain.dispose();
});

test('Engine: Testmodus protokolliert ein Ereignis genau einmal, auch mit Aufnahmen', async () => {
  const host = { __soundLog: [] };
  const engine = createSoundEngine({ host, game: () => 'skat', settings: () => MIXER_DEFAULTS, contextFactory: fakeAudio([]), fetchSample: () => Promise.resolve(new ArrayBuffer(8)) });
  engine.play('card'); engine.play('win');
  assert.deepEqual(host.__soundLog.map((e) => e.event), ['card', 'win']);
  await engine.dispose();
});
