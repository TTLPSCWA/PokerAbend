// EXP-F1. All sound is synthesized locally; importing this module creates no AudioContext.
import standard from './palettes/standard.js';
import { SCENES, SCENE_RATE, sceneBuffer } from './ambient/scenes.js';
import { worldAmbient } from './ambient/worlds.js';
import { SAMPLE_BASE, SAMPLE_SETS } from './samples/catalog.js';
export const REQUIRED_EVENTS = Object.freeze(['select', 'confirm', 'deny', 'turn', 'win', 'lose']);
export const PALETTES = Object.freeze(['standard', 'casino', 'holz', 'kneipe', 'party',
  // EXP-Spielpakete: je Palette eine Zeile hier und eine in `loaders`.
  'schach',
  'huetchen',
  'scotland-yard',
  'werwolf',
  'doppelagent',
  'malen-raten',
  'kritzelpost',
  'poker',
  'uno',
  'maumau',
  'schlagfertig',
  'kronenjagd',
  'schubsarena',
  'rhythmus-rausch',
  'skat',
]);
export { SCENES } from './ambient/scenes.js';
// EXP-F5: an ambient scene is scaled by this gain on top of the atmosphere slider and fades in gently.
export const AMBIENT_LEVEL = 0.35, AMBIENT_FADE_IN = 1.5;
// Recorded CC0 samples (Kenney) per palette event; files are loudness-matched, so only the category sets the level.
export const SAMPLE_LEVEL = Object.freeze({ foley: 0.9, ui: 0.8, jingle: 0.75 });
const ALIASES = Object.freeze({ draw: 'deal', chips: 'chip', hit: 'capture', end: 'lose' });
export const MIXER_DEFAULTS = Object.freeze({ enabled: true, master: 1, effects: 1, atmosphere: 0, speech: 1, mutedGames: Object.freeze([]) });
const clamp = (n, fallback = 1) => Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
export function normalizeMixer(value = {}) {
  return { enabled: value.enabled !== false, master: clamp(value.master), effects: clamp(value.effects), atmosphere: clamp(value.atmosphere, 0), speech: clamp(value.speech), mutedGames: Array.isArray(value.mutedGames) ? value.mutedGames.filter(id => typeof id === 'string') : [] };
}
const loaders = {
  casino: () => import('./palettes/casino.js'), holz: () => import('./palettes/holz.js'),
  kneipe: () => import('./palettes/kneipe.js'), party: () => import('./palettes/party.js'),
  schach: () => import('./palettes/schach.js'),
  huetchen: () => import('./palettes/huetchen.js'),
  'scotland-yard': () => import('./palettes/scotland-yard.js'),
  werwolf: () => import('./palettes/werwolf.js'),
  doppelagent: () => import('./palettes/doppelagent.js'),
  'malen-raten': () => import('./palettes/malen-raten.js'),
  kritzelpost: () => import('./palettes/kritzelpost.js'),
  poker: () => import('./palettes/poker.js'),
  uno: () => import('./palettes/uno.js'),
  maumau: () => import('./palettes/maumau.js'),
  schlagfertig: () => import('./palettes/schlagfertig.js'),
  kronenjagd: () => import('./palettes/kronenjagd.js'),
  schubsarena: () => import('./palettes/schubsarena.js'),
  'rhythmus-rausch': () => import('./palettes/rhythmus-rausch.js'),
  skat: () => import('./palettes/skat.js'),
};
const paletteCache = new Map([['standard', Promise.resolve(standard)]]);
export function loadPalette(name) {
  if (!PALETTES.includes(name)) return Promise.reject(new Error('Unknown sound palette: ' + name));
  if (!paletteCache.has(name)) paletteCache.set(name, loaders[name]().then(m => m.default).catch(error => { paletteCache.delete(name); throw error; }));
  return paletteCache.get(name);
}

export function createSoundEngine({ settings = () => MIXER_DEFAULTS, game = () => null, host = globalThis,
  paused = () => false, defaultAmbient = worldAmbient,
  // Samples load over fetch; without fetch (Node tests, very old browsers) every event uses its synthesized fallback.
  fetchSample = host.fetch ? (url) => host.fetch(url).then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status)))) : null,
  contextFactory = () => new (host.AudioContext || host.webkitAudioContext)() } = {}) {
  let context, master, effects, atmosphere, palette = standard, selection = 0, loading = null, activeGame = game();
  // ambientName: the atmosphere this table wants (world default or set by the game); ambientVoice: what is audible now.
  let ambientName = null, ambientExplicit = false, ambientVoice = null, disposed = false;
  ambientName = defaultAmbient(activeGame) || null;
  const voices = new Set();
  const sampleRaw = new Map(), sampleBuffers = new Map(), sampleDecoding = new Map(), lastSample = new Map();
  const mixer = () => normalizeMixer(settings());
  const hidden = () => !!host.document?.hidden;
  const logging = () => Array.isArray(host.__soundLog);
  const allowed = (channel, id = game()) => {
    const m = mixer();
    return !disposed && !hidden() && m.enabled && m.master > 0 && m[channel] > 0 && !m.mutedGames.includes(id) && !(channel === 'atmosphere' && paused());
  };
  function stopVoice(voice) {
    if (!voice) return;
    voices.delete(voice);
    for (const source of voice.sources) { try { source.stop(); } catch { /* already ended */ } }
    for (const node of voice.nodes) { try { node.disconnect(); } catch { /* already disconnected */ } }
    if (ambientVoice === voice) ambientVoice = null;
  }
  function stopAll() { for (const voice of [...voices]) stopVoice(voice); }
  function syncGame() {
    const id = game();
    if (id !== activeGame) { activeGame = id; ambientName = defaultAmbient(id) || null; ambientExplicit = false; stopAll(); palette = standard; selection++; loading = null; }
  }
  function ensureContext() {
    if (disposed) return null;
    try {
      if (!context) {
        context = contextFactory();
        master = context.createGain(); effects = context.createGain(); atmosphere = context.createGain();
        effects.connect(master); atmosphere.connect(master); master.connect(context.destination);
        decodeSamples();
      }
      const m = mixer();
      master.gain.value = m.enabled && !m.mutedGames.includes(game()) ? m.master : 0;
      effects.gain.value = m.effects; atmosphere.gain.value = m.atmosphere;
      // A rejected resume (autoplay restrictions) is harmless. Never replay a backlog after unlocking.
      if (context.state === 'suspended') context.resume().catch(() => {});
      return context;
    } catch { return null; }
  }
  function log(event, channel, id, opts = {}) {
    if (!logging()) return false;
    // Test mode also stops any previously audible ambient or effects.
    stopAll();
    host.__soundLog.push({ event, palette: palette.id, game: id, channel, ...opts });
    return true;
  }
  function reserve(sources, nodes, end) {
    // Count an FM carrier+modulator as one voice; each audible chord note is its own voice.
    while (voices.size >= 6) stopVoice([...voices].find(voice => voice !== ambientVoice) || voices.values().next().value);
    const voice = { sources, nodes, end };
    voices.add(voice);
    sources[0].onended = () => stopVoice(voice);
    return voice;
  }
  function render(note, channel, volume = 1, loop = false) {
    const ctx = ensureContext();
    if (!ctx || ctx.state === 'suspended') return null;
    const now = ctx.currentTime, at = now + (Math.max(0, note.at || 0) + Math.random() * (note.jitter || 0)) / 1000;
    const duration = Math.max(0.001, note.ms / 1000), end = at + duration;
    const gain = ctx.createGain(), sources = [], nodes = [gain];
    gain.connect(channel === 'atmosphere' ? atmosphere : effects);
    const level = Math.max(0.0001, (note.vol ?? 0.05) * clamp(volume));
    if (note.kind === 'chord') {
      gain.disconnect();
      for (const freq of note.freqs.slice(0, 6)) render({ ...note, kind: 'soft', freq }, channel, volume);
      return null;
    }
    if (note.kind === 'noise') {
      const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate), data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (loop ? 1 : 1 - i / len);
      const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter();
      source.buffer = buffer; source.loop = loop;
      filter.type = note.type || 'bandpass'; filter.frequency.value = note.freq; filter.Q.value = note.q ?? 1;
      source.connect(filter); filter.connect(gain); sources.push(source); nodes.push(source, filter);
      gain.gain.value = level; // The original noise already decays in the sample buffer.
    } else {
      const source = ctx.createOscillator();
      source.type = note.type || (note.kind === 'tock' ? 'triangle' : 'sine');
      source.frequency.setValueAtTime(note.freq, at);
      source.connect(gain); sources.push(source); nodes.push(source);
      if (note.kind === 'plop' || note.kind === 'bass' || note.kind === 'tock') source.frequency.exponentialRampToValueAtTime(Math.max(25, note.freq * 0.45), end);
      if (note.kind === 'bell') {
        const mod = ctx.createOscillator(), depth = ctx.createGain();
        mod.frequency.value = note.freq * (note.ratio ?? 2);
        depth.gain.setValueAtTime(note.freq * (note.index ?? 1), at); depth.gain.exponentialRampToValueAtTime(0.0001, end);
        mod.connect(depth); depth.connect(source.frequency); sources.push(mod); nodes.push(mod, depth);
      }
      gain.gain.setValueAtTime(note.kind === 'soft' ? 0.0001 : level, at);
      if (note.kind === 'soft') gain.gain.linearRampToValueAtTime(level, at + Math.min(0.04, duration / 4));
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
    }
    const voice = reserve(sources, nodes, end);
    for (const source of sources) { source.start(at); if (!loop) source.stop(end); }
    return voice;
  }
  function playNotes(event, notes, opts = {}) {
    syncGame();
    const id = opts.game ?? game();
    if (!Array.isArray(notes) || !notes.length || !allowed('effects', id)) return false;
    const safe = notes.map(n => ({ ...n, ms: Math.max(1, Math.min(n.ms, ['win', 'lose', 'highlight'].includes(event) ? 5000 : Math.max(1, 600 - (n.at || 0) - (n.jitter || 0)))) }));
    if (log(event, 'effects', id)) return true;
    try { for (const note of safe) render(note, 'effects', opts.volume); } catch { return false; }
    return !!context && context.state !== 'suspended';
  }
  const sampleUrl = (file) => SAMPLE_BASE + file;
  function sampleSetFor(event, from = palette) {
    const map = from.samples || {}, std = standard.samples || {};
    return map[event] || map[ALIASES[event]] || (from.events?.[event] ? null : std[event] || std[ALIASES[event]]) || null;
  }
  function prefetchSamples(pal) {
    if (!fetchSample || disposed) return;
    for (const set of new Set(Object.values(pal.samples || {}))) for (const file of SAMPLE_SETS[set]?.files || []) {
      const url = sampleUrl(file);
      if (!sampleRaw.has(url)) sampleRaw.set(url, fetchSample(url).catch(() => null));
    }
    decodeSamples();
  }
  function decodeSamples() {
    if (!context?.decodeAudioData) return;
    for (const [url, raw] of sampleRaw) {
      if (sampleBuffers.has(url) || sampleDecoding.has(url)) continue;
      sampleDecoding.set(url, raw.then(data => data && new Promise((resolve, reject) => {
        // decodeAudioData detaches its input; keep the fetched bytes for a later context.
        const p = context.decodeAudioData(data.slice(0), resolve, reject); if (p?.then) p.then(resolve, reject);
      })).then(buffer => { if (buffer) sampleBuffers.set(url, buffer); }).catch(() => {}).finally(() => sampleDecoding.delete(url)));
    }
  }
  function pickSample(setName) {
    const files = (SAMPLE_SETS[setName]?.files || []).map(sampleUrl).filter(url => sampleBuffers.has(url));
    if (!files.length) return null;
    const last = lastSample.get(setName), choices = files.length > 1 ? files.filter(url => url !== last) : files;
    const url = choices[Math.floor(Math.random() * choices.length)];
    lastSample.set(setName, url);
    return sampleBuffers.get(url);
  }
  function playSample(event, setName, opts = {}) {
    const id = opts.game ?? game();
    if (!allowed('effects', id)) return false;
    if (log(event, 'effects', id)) return true;
    const ctx = ensureContext(), buffer = ctx && pickSample(setName);
    if (!ctx || ctx.state === 'suspended' || !buffer) return null;
    try {
      const set = SAMPLE_SETS[setName], source = ctx.createBufferSource(), gain = ctx.createGain(), now = ctx.currentTime;
      source.buffer = buffer;
      // Small pitch variation keeps repeated foley (cards, dice, pieces) from sounding mechanical.
      if (set.category === 'foley' && source.playbackRate) source.playbackRate.value = 0.96 + Math.random() * 0.08;
      gain.gain.value = (SAMPLE_LEVEL[set.category] ?? 0.8) * clamp(opts.volume);
      source.connect(gain); gain.connect(effects);
      reserve([source], [source, gain], now + buffer.duration);
      source.start(now);
      return true;
    } catch { return null; }
  }
  function play(event, opts = {}) {
    syncGame();
    if (loading) {
      const pending = loading, requested = Date.now(), id = game();
      return pending.then(() => Date.now() - requested < 600 && game() === id ? play(event, opts) : false, () => false);
    }
    const setName = sampleSetFor(event);
    if (setName) {
      const played = playSample(event, setName, opts);
      if (played !== null) return played;
      prefetchSamples(palette);
    }
    // Synthesized fallback: palette notes, then the standard palette (also while samples are still loading).
    return playNotes(event, palette.events[event] || palette.events[ALIASES[event]] || standard.events[event], opts);
  }
  function use(name) {
    syncGame();
    const request = ++selection;
    loading = loadPalette(name).then(next => {
      if (request !== selection || disposed) return false;
      if (palette !== next) {
        stopAll(); palette = next; prefetchSamples(next);
        // A palette may bring its world's atmosphere; an atmosphere the game chose itself wins.
        if (!ambientExplicit && next.ambient) ambientName = next.ambient;
        startAmbient();
      }
      return true;
    }).finally(() => { if (request === selection) loading = null; });
    return loading;
  }
  function startAmbient() {
    stopVoice(ambientVoice);
    if (!ambientName || !allowed('atmosphere')) return false;
    if (log('ambient', 'atmosphere', game(), { name: ambientName })) return true;
    try {
      if (!SCENES.includes(ambientName)) return false;
      const ctx = ensureContext();
      if (!ctx || ctx.state === 'suspended') return false;
      const data = sceneBuffer(ambientName), buffer = ctx.createBuffer(1, data.length, SCENE_RATE);
      if (buffer.copyToChannel) buffer.copyToChannel(data, 0); else buffer.getChannelData(0).set(data);
      const source = ctx.createBufferSource(), gain = ctx.createGain(), now = ctx.currentTime;
      source.buffer = buffer; source.loop = true;
      gain.gain.setValueAtTime(0.0001, now); gain.gain.linearRampToValueAtTime(AMBIENT_LEVEL, now + AMBIENT_FADE_IN);
      source.connect(gain); gain.connect(atmosphere);
      ambientVoice = reserve([source], [source, gain], Infinity);
      source.start(now);
    } catch { return false; }
    return !!ambientVoice;
  }
  function ambient(name) {
    syncGame();
    // 'room' is the F1 name for the plain noise bed; it is a scene now as well.
    ambientName = typeof name === 'string' && name ? name : null; ambientExplicit = true;
    return startAmbient();
  }
  function refresh() {
    syncGame();
    if (logging() || hidden() || !allowed('effects')) {
      for (const voice of [...voices]) if (voice !== ambientVoice) stopVoice(voice);
    }
    if (context) {
      const m = mixer();
      master.gain.value = m.enabled && !m.mutedGames.includes(game()) && !hidden() ? m.master : 0;
      effects.gain.value = m.effects; atmosphere.gain.value = m.atmosphere;
    }
    if (!allowed('atmosphere') || logging()) stopVoice(ambientVoice);
    else if (ambientName && !ambientVoice) startAmbient();
  }
  // Hidden tab: everything stops; back in view only the atmosphere resumes (effects are never replayed).
  const onVisibility = () => { if (hidden()) stopAll(); else refresh(); };
  const onPageHide = () => stopAll();
  // Unlock only on an actual gesture, without creating an AudioContext before any sound is requested.
  const unlock = () => { if (context?.state === 'suspended') context.resume().then(refresh).catch(() => {}); };
  // Navigation away from a table must stop ambient even when no further sound is played.
  const observer = host.MutationObserver && host.document?.body ? new host.MutationObserver(() => { if (game() !== activeGame) refresh(); }) : null;
  observer?.observe(host.document.body, { childList: true, subtree: true });
  host.addEventListener?.('hashchange', refresh);
  host.addEventListener?.('settingschange', refresh);
  host.addEventListener?.('pagehide', onPageHide);
  host.document?.addEventListener('visibilitychange', onVisibility);
  host.document?.addEventListener('pointerdown', unlock);
  host.document?.addEventListener('keydown', unlock);
  // Fetch the standard samples shortly after start, outside the critical page load.
  if (fetchSample && host.setTimeout) host.setTimeout(() => prefetchSamples(standard), 1200);
  return {
    use, play, ambient, refresh,
    beep: (freq = 660, ms = 120, vol = 0.05, type = 'sine') => playNotes('beep', [{ kind: 'tone', freq, ms, vol, type }]),
    noise: (sec, freq, vol, type = 'bandpass', q = 1) => playNotes('noise', [{ kind: 'noise', freq, ms: sec * 1000, vol, type, q }]),
    get palette() { return palette.id; },
    get ambientScene() { return ambientName; },
    get ambientPlaying() { return !!ambientVoice; },
    get voiceCount() { return voices.size; },
    get samplesReady() { return sampleBuffers.size; },
    sampleSetFor: (event) => sampleSetFor(event),
    dispose() {
      disposed = true; selection++; loading = null; stopAll(); observer?.disconnect();
      host.removeEventListener?.('hashchange', refresh);
      host.removeEventListener?.('settingschange', refresh); host.removeEventListener?.('pagehide', onPageHide);
      host.document?.removeEventListener('visibilitychange', onVisibility);
      host.document?.removeEventListener('pointerdown', unlock); host.document?.removeEventListener('keydown', unlock);
      return context?.close().catch(() => {});
    },
  };
}
