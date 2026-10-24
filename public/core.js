// Pokerabend – gemeinsamer Teil im Browser: Startseite mit Spielauswahl, Lobby, Verbindung, Dialoge.
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

// ---------- Spielmodule ----------
// Ein Modul ist ein Objekt mit show() (Spiel einblenden), onState(state) (neuer Stand vom Server)
// und optional onPrefs() (persönliche Einstellungen geändert).
const GAME_MODULES = {};
const gameLoads = {};
let current = null;   // laufendes Spielmodul
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
  $('#game-list').innerHTML = list.map((g) => `<button type="button" class="game-card" role="radio" data-game="${esc(g.id)}" aria-checked="${g.id === gameInfo()?.id}">
      <b>${esc(g.name)}</b><small>${esc(g.players)}</small><span>${esc(g.description)}</span>
    </button>`).join('') + '<p class="game-soon">Weitere Spiele folgen.</p>';
  const g = gameInfo();
  $('#create-fields').innerHTML = (g?.createFields || []).map((f) => `<label class="field"><span>${esc(f.label)}</span>
      <input data-cf="${esc(f.key)}" type="${f.type === 'number' ? 'number' : 'text'}" ${f.min !== undefined ? `min="${f.min}"` : ''} ${f.step ? `step="${f.step}"` : ''} value="${esc(f.value)}"></label>`).join('');
  $('#create-hint').textContent = g?.createHint || '';
}
function setTab(tab) {
  lobbyTab = tab;
  $$('#lobby .tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  $$('#lobby [data-for]').forEach((el) => { el.hidden = el.dataset.for !== tab; });
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
    const settings = Object.fromEntries($$('[data-cf]').map((el) => [el.dataset.cf, el.value]));
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
socket.on('replaced', () => { session = null; document.body.innerHTML = '<main class="lobby"><div class="lobby-felt"><h1 class="wordmark">Pokerabend</h1><p class="lobby-sub">Du spielst gerade in einem anderen Tab weiter. Diesen Tab kannst du schließen.</p></div></main>'; });
socket.on('kicked', () => { if (session) store.set('poker:session:' + session.code, null); leaveGame(); toast('Der Host hat dich vom Tisch genommen', true); showLobby(); });
socket.on('state', (st) => {
  lastState = st;
  if (session && current) current.onState(st);
});

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
