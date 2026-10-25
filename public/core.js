// Spieleabend – gemeinsamer Teil im Browser: Startseite mit Spielauswahl, Lobby, Verbindung, Dialoge.
// Die Spiele selbst liegen unter /games/<id>/<id>.js (+ .css) und melden sich mit registerGame() an.
// Alles hier ist für die Spiele sichtbar ($, esc, store, prefs, socket, send, toast, ask, beep …).
/* global io */
'use strict';
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const AVATARS = ['🦊', '🐻', '🐼', '🐸', '🦉', '🐯', '🐙', '🦄', '🐺', '🐧', '🦁', '🐢'];
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* privater Modus */ } },
};

// ---------- Persönliche Einstellungen (nur in diesem Browser) ----------
// Jedes Spiel bringt seine Standardwerte mit (usePrefs), gespeichert wird alles zusammen.
const prefs = store.get('poker:prefs', {});
function usePrefs(defaults) { for (const [k, v] of Object.entries(defaults)) if (!(k in prefs)) prefs[k] = v; }
usePrefs({ sound: true, calm: false });
function savePrefs() { store.set('poker:prefs', prefs); current?.onPrefs?.(); }

// ---------- Zustand ----------
let session = null;                       // { code, token, game }
let account = { mode: 'open', games: [] }; // aus /me: Passwort oder offen, und welche Spiele es gibt
const socket = io({ transports: ['websocket', 'polling'] });

// ---------- Hilfen ----------
const avatarHTML = (p) => esc(p?.avatar || '🙂');
const motionOff = () => prefs.calm || matchMedia('(prefers-reduced-motion: reduce)').matches;
const pick = (list) => list[Math.floor(Math.random() * list.length)];
let toastTimer;
function toast(text, bad = false) {
  const t = $('#toast');
  t.textContent = text; t.classList.toggle('bad', bad); t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
function send(event, data = {}) {
  return new Promise((res) => socket.emit(event, data, (r) => { if (!r?.ok) toast(r?.error || 'Das hat nicht geklappt', true); res(r); }));
}

// Kleine Symbole als Inline-SVG – nur wo sie Bedeutung tragen
const svg = (d, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const ICON = {
  pause: svg('<path d="M9 5v14M15 5v14"/>'),
  play: svg('<path d="M7 5l12 7-12 7z"/>', 'fill'),
  offline: svg('<path d="M3 3l18 18"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M5 12.6a10 10 0 0 1 4.3-2.4M14.7 10.2A10 10 0 0 1 19 12.6"/><path d="M12 20h.01"/>'),
  crown: svg('<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>', 'crown fill'),
  more: svg('<circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>', 'fill'),
};

// Eigener Bestätigungsdialog (statt confirm/prompt): Titel, ein Satz, Abbrechen links, Aktion rechts.
// <dialog> hält den Fokus im Dialog, Esc schließt. Ergebnis: false, true oder der eingegebene Wert.
// cancel/cancelValue: eigener Text für den linken Knopf; wer ihn drückt, bekommt cancelValue (Esc bleibt „nichts tun“).
function ask({ title, text = '', ok = 'OK', danger = false, input = null, cancel = 'Abbrechen', cancelValue }) {
  const d = $('#dlg');
  if (d.open) d.close();
  $('#dlg-title').textContent = title;
  $('#dlg-text').textContent = text;
  const extra = $('#dlg-extra');
  extra.innerHTML = '';
  extra.hidden = !input;
  let field = null;
  if (input) {
    field = document.createElement('input');
    field.className = 'input';
    field.type = input.type || 'text';
    field.value = input.value ?? '';
    field.readOnly = !!input.readOnly;
    if (input.maxLength) field.maxLength = input.maxLength;
    if (input.placeholder) field.placeholder = input.placeholder;
    field.setAttribute('aria-label', input.label || title);
    // Enter = Aktion (sonst würde das Formular den ersten Knopf, also „Abbrechen“, auslösen)
    field.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); d.close('ok'); } });
    extra.append(field);
  }
  const okBtn = $('#dlg-ok');
  okBtn.textContent = ok;
  okBtn.className = 'btn ' + (danger ? 'btn-danger' : 'btn-brass');
  $('#dlg-cancel').hidden = !!input?.noCancel;
  $('#dlg-cancel').textContent = cancel;
  return new Promise((res) => {
    d.returnValue = '';
    d.addEventListener('close', () => {
      if (d.returnValue === 'ok') res(field && !field.readOnly ? field.value : true);
      else res(d.returnValue === 'cancel' && cancelValue !== undefined ? cancelValue : false);
    }, { once: true });
    d.showModal();
    if (field && !field.readOnly) { field.focus(); field.select(); }
    else if (field) { okBtn.focus(); field.select(); }
    else (danger ? $('#dlg-cancel') : okBtn).focus();
  });
}

// Kurzregeln („?“ am Tisch): ein paar Zeilen und die Hausregeln, die an diesem Tisch gelten.
// Zeilen sind HTML aus dem Spielcode (keine Eingaben von Spielern).
function showHelp({ title, short, house = [], more = null }) {
  let d = $('#help-dlg');
  if (!d) {
    d = document.createElement('dialog');
    d.id = 'help-dlg'; d.className = 'dlg help-dlg';
    d.setAttribute('aria-labelledby', 'help-title');
    document.body.append(d);
    // Klick neben den Dialog oder auf „Alles klar“ schließt
    d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-help-close]')) d.close(); });
  }
  d.innerHTML = `<div class="help-body"><h2 id="help-title">${esc(title)}</h2>
    <ul class="help-list">${short.map((l) => `<li>${l}</li>`).join('')}</ul>
    ${house.length ? `<h3>Hausregeln an diesem Tisch</h3><ul class="help-list house">${house.map((l) => `<li>${l}</li>`).join('')}</ul>` : ''}
    <div class="dlg-actions">${more ? '<button class="btn btn-ghost" data-help-more>Alle Regeln</button>' : '<span></span>'}<button class="btn btn-brass" data-help-close>Alles klar</button></div></div>`;
  d.querySelector('[data-help-more]')?.addEventListener('click', () => { d.close(); more(); });
  d.showModal();
  d.querySelector('[data-help-close]').focus();
}

// ---------- Töne ----------
let audio;
function beep(freq = 660, ms = 120, vol = 0.05, type = 'sine') {
  if (!prefs.sound) return;
  try {
    audio = audio || new AudioContext();
    const o = audio.createOscillator(); const g = audio.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = vol;
    o.connect(g); g.connect(audio.destination);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + ms / 1000);
    o.start(); o.stop(audio.currentTime + ms / 1000);
  } catch { /* kein Ton */ }
}

// Kurze Spiel-Töne, alle per Web Audio erzeugt (keine Dateien): Karten, Würfel, Rufe. Schalter „Töne“ unter „Ich“.
function noise(sec, freq, vol, type = 'bandpass', q = 1) {
  if (!prefs.sound) return;
  try {
    audio = audio || new AudioContext();
    const len = Math.max(1, Math.floor(audio.sampleRate * sec));
    const buf = audio.createBuffer(1, len, audio.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len); // klingt von selbst aus
    const src = audio.createBufferSource(); const f = audio.createBiquadFilter(); const g = audio.createGain();
    src.buffer = buf; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(audio.destination);
    src.start();
  } catch { /* kein Ton */ }
}
const SFX = {
  card: () => noise(0.06, 2600, 0.35),                                                       // Karte legen: kurzes Wischen
  draw: () => noise(0.1, 1600, 0.22, 'bandpass', 0.7),                                       // Karte ziehen
  shuffle: () => [0, 45, 90, 135, 180, 225].forEach((t) => setTimeout(() => noise(0.04, 3200, 0.2), t)), // Mischen
  dice: () => [0, 55, 95, 150, 185].forEach((t, i) => setTimeout(() => noise(0.025, 1800 + i * 300, 0.5, 'bandpass', 4), t + Math.random() * 20)), // Würfelklappern
  call: () => { beep(660, 110, 0.07, 'square'); setTimeout(() => beep(990, 170, 0.07, 'square'), 110); }, // „UNO!“ / „Mau!“
  catch: () => { beep(180, 220, 0.08, 'sawtooth'); },                                          // Erwischt
  hit: () => { beep(420, 90, 0.07, 'triangle'); setTimeout(() => beep(210, 160, 0.07, 'triangle'), 90); }, // Schlagen
  skip: () => { beep(520, 90, 0.05); setTimeout(() => beep(390, 120, 0.05), 90); },          // Aussetzen
  drum: () => noise(0.22, 300, 0.6, 'lowpass'),                                               // Aufdecken
  chips: () => { beep(2200, 40, 0.03, 'triangle'); setTimeout(() => beep(1800, 50, 0.025, 'triangle'), 50); }, // Chips setzen
  splash: () => { noise(0.28, 700, 0.5, 'lowpass'); setTimeout(() => noise(0.18, 1400, 0.15, 'bandpass'), 60); }, // Wasser (Schiffe versenken)
  done: () => [523, 659, 784].forEach((f, i) => setTimeout(() => beep(f, 140, 0.05), i * 90)), // Phase geschafft
  win: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 200, 0.055), i * 110)),
  end: () => { beep(440, 160, 0.045); setTimeout(() => beep(330, 220, 0.045), 160); },
};
const sfx = (name) => SFX[name]?.();

// ---------- Erste Schritte: beim ersten Spiel einer Art eine kurze Einführung in 3 Schritten ----------
// Wird pro Browser gemerkt (poker:intro); unter „Ich“ abschaltbar (prefs.intros).
usePrefs({ intros: true });
function showIntro(gameId, title, steps, force = false) {
  const seen = store.get('poker:intro', {});
  if (!force && (!prefs.intros || seen[gameId] || !steps?.length)) return;
  seen[gameId] = true;
  store.set('poker:intro', seen);
  let d = $('#intro-dlg');
  if (!d) {
    d = document.createElement('dialog');
    d.id = 'intro-dlg'; d.className = 'dlg help-dlg intro-dlg';
    d.setAttribute('aria-labelledby', 'intro-title');
    document.body.append(d);
  }
  let k = 0;
  const draw = () => {
    const [head, text] = steps[k];
    d.innerHTML = `<div class="help-body"><small class="intro-step">Erste Schritte · ${esc(title)} · Schritt ${k + 1} von ${steps.length}</small>
      <h2 id="intro-title">${esc(head)}</h2><p class="intro-text">${text}</p>
      <div class="intro-dots" aria-hidden="true">${steps.map((_, i) => `<i class="${i === k ? 'on' : ''}"></i>`).join('')}</div>
      <label class="toggle intro-off"><span>Keine Einführungen mehr zeigen<small>Wieder einschalten unter „Ich“</small></span><input type="checkbox" role="switch" data-intro-off ${prefs.intros ? '' : 'checked'}></label>
      <div class="dlg-actions"><button class="btn btn-ghost" data-intro="skip">${k ? 'Zurück' : 'Überspringen'}</button>
        <button class="btn btn-brass" data-intro="next">${k === steps.length - 1 ? 'Los geht’s' : 'Weiter'}</button></div></div>`;
    d.querySelector('[data-intro="next"]').focus();
  };
  d.onclick = (e) => {
    const b = e.target.closest('[data-intro]');
    if (!b) return;
    if (b.dataset.intro === 'next') { if (k < steps.length - 1) { k++; draw(); } else d.close(); }
    else if (k) { k--; draw(); } else d.close();
  };
  d.onchange = (e) => { if (e.target.matches('[data-intro-off]')) { prefs.intros = !e.target.checked; savePrefs(); } };
  draw();
  if (!d.open) d.showModal();
}
// Alle Einführungen wieder zeigen (Schalter unter „Ich“ wieder an)
function resetIntros() { store.set('poker:intro', {}); }

// ---------- Spielmodule ----------
// Ein Modul ist ein Objekt mit show() (Spiel einblenden), onState(state) (neuer Stand vom Server)
// und optional onPrefs() (persönliche Einstellungen geändert).
const GAME_MODULES = {};
const gameLoads = {};
let current = null;   // laufendes Spielmodul
let mounted = null;   // dessen Oberfläche gerade in #game-root steckt
let lastState = null; // letzter Stand vom Server – kommt oft, bevor das Modul geladen ist
function registerGame(id, mod) { GAME_MODULES[id] = mod; }
function loadGame(id) {
  if (GAME_MODULES[id]) return Promise.resolve(GAME_MODULES[id]);
  if (!/^[a-z0-9-]{1,30}$/.test(id)) return Promise.reject(new Error('Dieses Spiel gibt es nicht'));
  gameLoads[id] ||= new Promise((res, rej) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = `/games/${id}/${id}.css`;
    const js = document.createElement('script');
    js.src = `/games/${id}/${id}.js`;
    let ready = 0;
    const done = () => {
      if (++ready < 2) return;
      if (GAME_MODULES[id]) res(GAME_MODULES[id]); else { delete gameLoads[id]; rej(new Error('Das Spiel konnte nicht geladen werden')); }
    };
    css.addEventListener('load', done); css.addEventListener('error', done); // ohne Stylesheet geht es zur Not auch
    js.addEventListener('load', done);
    js.addEventListener('error', () => { delete gameLoads[id]; rej(new Error('Das Spiel konnte nicht geladen werden')); });
    document.head.append(css);
    document.body.append(js);
  });
  return gameLoads[id];
}

// Ins Spiel wechseln, sobald das Modul geladen ist
async function enterGame(r) {
  session = { code: r.code, token: r.token, game: r.game || 'poker' };
  store.set('poker:session:' + r.code, r.token);
  store.set('poker:last', r.code);
  history.replaceState(null, '', '?t=' + r.code);
  try { current = await loadGame(session.game); } catch (e) { session = null; showLobby(e.message); return; }
  if (!session) return; // inzwischen rausgeflogen
  // Ein anderes Spiel war schon geladen: Seite neu laden, damit sich die Oberflächen nicht in die Quere kommen
  if (mounted && mounted !== session.game) { location.href = '/?t=' + session.code; return; }
  mounted = session.game;
  $('#lobby').hidden = true;
  $('#game-root').hidden = false;
  current.show();
  if (lastState) current.onState(lastState);
}
function leaveGame() {
  session = null; lastState = null;
  $('#game-root').hidden = true;
}

// ---------- Startseite: Spiele, Lobby beitreten, Spiel hosten ----------
const params = new URLSearchParams(location.search);
let lobbyTab = params.get('t') ? 'join' : 'create';
let avatar = store.get('poker:avatar', AVATARS[Math.floor(Math.random() * AVATARS.length)]);
let chosenGame = store.get('poker:game', 'poker');
const gameInfo = () => account.games.find((g) => g.id === chosenGame) || account.games[0] || null;
const GAME_CATEGORIES = [['karten', 'Kartenspiele'], ['wuerfel', 'Würfelspiele'], ['brett', 'Brettspiele']]; // wie games/index.js

function showLobby(error = '') {
  $('#game-root').hidden = true;
  $('#lobby').hidden = false;
  $('#lobby-error').textContent = error;
  $('#f-name').value = store.get('poker:name', '');
  if (params.get('t')) $('#f-code').value = params.get('t').toUpperCase();
  $('#avatars').innerHTML = AVATARS.map((a) => `<button type="button" class="avatar-opt" data-a="${a}" aria-pressed="${a === avatar}" aria-label="Avatar ${a}">${a}</button>`).join('');
  renderGames();
  setTab(lobbyTab);
}
function renderGames() {
  const list = account.games;
  // Nach Kategorien gruppiert (Karten, Würfel, Brett) – Kategorien ohne Spiel fallen weg
  const card = (g) => `<button type="button" class="game-card" role="radio" data-game="${esc(g.id)}" aria-checked="${g.id === gameInfo()?.id}">
      <b>${esc(g.name)}</b><small>${esc(g.players)}</small><span>${esc(g.description)}</span>
    </button>`;
  $('#game-list').innerHTML = GAME_CATEGORIES.map(([id, title]) => {
    const games = list.filter((g) => (g.category || 'karten') === id);
    return games.length ? `<div class="game-cat" role="group" aria-label="${title}"><h3>${title}</h3><div class="game-cat-list">${games.map(card).join('')}</div></div>` : '';
  }).join('');
  const g = gameInfo();
  $('#create-fields').innerHTML = (g?.createFields || []).map((f) => `<label class="field"><span>${esc(f.label)}</span>
      <input data-cf="${esc(f.key)}" type="${f.type === 'number' ? 'number' : 'text'}" ${f.min !== undefined ? `min="${f.min}"` : ''} ${f.step ? `step="${f.step}"` : ''} value="${esc(f.value)}"></label>`).join('');
  $('#create-hint').textContent = g?.createHint || '';
}
function setTab(tab) {
  lobbyTab = tab;
  $$('#lobby .tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  $$('#lobby [data-for]').forEach((el) => {
    el.hidden = el.dataset.for !== tab;
    // Versteckte Felder dürfen weder Validierung noch Übermittlung beeinflussen.
    $$('input, select, textarea', el).forEach((field) => { field.disabled = el.hidden; });
  });
  $('#f-submit').textContent = tab === 'join' ? 'Beitreten' : `${gameInfo()?.name || 'Spiel'} hosten`;
  $('#f-code').required = tab === 'join';
}
$$('#lobby .tab').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
$('#game-list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-game]'); if (!b) return;
  chosenGame = b.dataset.game; store.set('poker:game', chosenGame);
  renderGames(); setTab(lobbyTab);
});
$('#avatars').addEventListener('click', (e) => {
  const b = e.target.closest('.avatar-opt'); if (!b) return;
  avatar = b.dataset.a; store.set('poker:avatar', avatar);
  $$('.avatar-opt').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
});
$('#lobby-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('#f-name').value.trim();
  store.set('poker:name', name);
  $('#lobby-error').textContent = '';
  const done = (r) => {
    if (!r?.ok) { $('#lobby-error').textContent = r?.error || 'Verbindung fehlgeschlagen'; return; }
    enterGame(r);
  };
  if (lobbyTab === 'create') {
    const settings = Object.fromEntries($$('#create-fields [data-cf]:enabled').map((el) => [el.dataset.cf, el.value]));
    socket.emit('create', { game: gameInfo()?.id, name, avatar, settings }, done);
  } else {
    const code = $('#f-code').value.trim().toUpperCase();
    socket.emit('join', { code, name, avatar, token: store.get('poker:session:' + code, null) }, done);
  }
});

// Automatisch wieder in den Raum, wenn wir schon ein Token haben
function tryResume() {
  const code = (params.get('t') || '').toUpperCase();
  const token = code && store.get('poker:session:' + code, null);
  if (!token) { showLobby(); return; }
  socket.emit('join', { code, token }, (r) => {
    if (r?.ok) enterGame(r);
    else { store.set('poker:session:' + code, null); showLobby(); }
  });
}

// ---------- Verbindung ----------
socket.on('connect', () => {
  $('#offline').hidden = true;
  if (session) socket.emit('join', { code: session.code, token: session.token }, (r) => { if (!r?.ok) { toast(r?.error, true); leaveGame(); showLobby(); } });
});
socket.on('disconnect', () => { if (session) $('#offline').hidden = false; });
// Verbindung abgelehnt? Dann ist meist das Passwort-Cookie abgelaufen → zur Passwort-Seite
socket.on('connect_error', async () => {
  try {
    const r = await fetch('/me', { credentials: 'same-origin' });
    if (r.status === 401) location.href = '/login?next=' + encodeURIComponent(location.pathname + location.search);
  } catch { /* Server nicht erreichbar – Socket.IO versucht es weiter */ }
});
socket.on('replaced', () => { session = null; document.body.innerHTML = '<main class="lobby"><div class="lobby-felt"><h1 class="wordmark">Spieleabend</h1><p class="lobby-sub">Du spielst gerade in einem anderen Tab weiter. Diesen Tab kannst du schließen.</p></div></main>'; });
socket.on('kicked', () => { if (session) store.set('poker:session:' + session.code, null); leaveGame(); toast('Der Host hat dich vom Tisch genommen', true); showLobby(); });
socket.on('state', (st) => {
  lastState = st;
  // Der Host hat das Spiel gewechselt: neu laden, das neue Spiel kommt automatisch (gleicher Raum, gleiches Token)
  if (session && st.game && st.game !== session.game) {
    session.game = st.game;
    if (mounted) { location.href = '/?t=' + session.code; return; }
  }
  if (session && current) current.onState(st);
});

// ---------- Bestenliste über alle Abende ----------
// Daten von /api/leaderboard; Spiel und Zeitraum (alle Abende oder ein Monat) wählbar
async function showLeaderboard(game, period = 'all') {
  let d = $('#lb-dlg');
  if (!d) {
    d = document.createElement('dialog');
    d.id = 'lb-dlg'; d.className = 'dlg lb-dlg';
    d.setAttribute('aria-labelledby', 'lb-title');
    document.body.append(d);
    d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-lb-close]')) d.close(); });
    d.addEventListener('change', (e) => { if (e.target.matches('[data-lb]')) showLeaderboard($('#lb-game').value, $('#lb-period').value); });
  }
  let r;
  try {
    const res = await fetch(`/api/leaderboard?game=${encodeURIComponent(game || '')}&period=${encodeURIComponent(period)}`, { credentials: 'same-origin' });
    r = await res.json();
  } catch { toast('Die Bestenliste ist gerade nicht erreichbar', true); return; }
  const info = r.games.find((g) => g.id === r.game);
  const isPoker = r.game === 'poker';
  const monthName = (m) => new Date(m + '-15T12:00:00').toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  const months = r.months.includes(r.current) ? r.months : [r.current, ...r.months];
  const fmtPoints = (n) => (isPoker ? `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n).toLocaleString('de-DE')}` : n.toLocaleString('de-DE'));
  const rows = r.rows.map((x, k) => `<tr><td><span class="rank ${k < 3 ? 'r' + (k + 1) : ''}" aria-label="Platz ${k + 1}">${k + 1}</span></td>
    <td>${esc(x.name)}</td><td class="num">${x.played}</td>
    <td class="num">${x.wins} <small>(${Math.round((100 * x.wins) / x.played)} %)</small></td>
    <td class="num ${isPoker ? (x.points > 0 ? 'pos' : x.points < 0 ? 'neg' : '') : ''}">${fmtPoints(x.points)}</td></tr>`).join('');
  d.innerHTML = `<div class="help-body"><h2 id="lb-title">Bestenliste aller Abende</h2>
    <div class="lb-filters">
      <label class="field"><span>Spiel</span><select id="lb-game" class="input" data-lb>${r.games.map((g) => `<option value="${esc(g.id)}" ${g.id === r.game ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Zeitraum</span><select id="lb-period" class="input" data-lb><option value="all">Alle Abende</option>${months.map((m) => `<option value="${m}" ${m === r.period ? 'selected' : ''}>${monthName(m)}</option>`).join('')}</select></label>
    </div>
    ${rows ? `<div class="lb-scroll"><table class="standings lb-table"><thead><tr><th></th><th>Name</th><th class="num">${isPoker ? 'Hände' : 'Partien'}</th><th class="num">Siege</th><th class="num">${esc(info?.scoreLabel || 'Punkte')}</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : '<p class="hint">In diesem Zeitraum wurde das noch nicht gespielt.</p>'}
    <p class="hint" style="margin:0">Sortiert nach Siegen. ${isPoker ? 'Eine Partie ist eine Hand, gezählt werden gewonnene und verlorene Chips.' : `Eine Partie ist eine Runde. ${info?.lowWins ? 'Punkte: wenig ist gut.' : ''}`} Wiedererkannt wird man am Namen.</p>
    <div class="dlg-actions"><span></span><button class="btn btn-brass" data-lb-close>Schließen</button></div></div>`;
  if (!d.open) d.showModal();
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-leaderboard]');
  if (t) showLeaderboard(t.dataset.leaderboard || chosenGame);
});

// Host-Menü: in ein anderes Spiel wechseln (gleicher Raum, alle bleiben drin)
function switchGameHTML(currentId, busy) {
  const others = account.games.filter((g) => g.id !== currentId);
  return `<h3>Spiel wechseln</h3>
    <div class="switch-game"><select class="input" id="switch-game" aria-label="Neues Spiel">${others.map((g) => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('')}</select>
      <button class="btn" data-switch-game ${busy ? 'disabled title="Geht erst, wenn die Runde vorbei ist"' : ''}>Wechseln</button></div>
    <p class="hint" style="margin:0">Gleicher Raum und Code, alle bleiben drin. Wer gerade mitspielt, sitzt im neuen Spiel wieder. Der bisherige Stand kommt in den Verlauf.</p>`;
}
async function askSwitchGame() {
  const id = $('#switch-game')?.value;
  const g = account.games.find((x) => x.id === id);
  if (!g) return;
  if (await ask({ title: `Zu ${g.name} wechseln?`, text: 'Die laufende Wertung dieses Spiels endet – sie steht danach im Verlauf. Alle bleiben im Raum.', ok: 'Wechseln' })) send('switchGame', { game: id });
}
document.addEventListener('click', (e) => { if (e.target.closest('[data-switch-game]:not(:disabled)')) askSwitchGame(); });

// Abmelden immer erst bestätigen
document.addEventListener('submit', async (e) => {
  const form = e.target;
  if (!form.matches('form[action="/logout"]') || form.dataset.confirmed) return;
  e.preventDefault();
  if (await ask({ title: 'Abmelden?', text: 'Du musst danach das Gruppenpasswort neu eingeben. Am Tisch bleibt dein Platz 5 Minuten frei.', ok: 'Abmelden', danger: true })) {
    form.dataset.confirmed = '1';
    form.submit();
  }
});

async function boot() {
  try {
    const r = await fetch('/me', { credentials: 'same-origin' });
    if (r.status === 401) { location.href = '/login?next=' + encodeURIComponent(location.pathname + location.search); return; }
    if (r.ok) account = { games: [], ...(await r.json()) };
  } catch { /* offline – Socket.IO versucht es weiter */ }
  tryResume();
}
boot();

// Als App installierbar (Homescreen): kleiner Service Worker ohne Zwischenspeicher
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => { /* egal – geht auch ohne */ });
