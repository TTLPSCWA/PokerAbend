// Pokerabend – Browser-Seite. Zeigt nur an, was der Server schickt, und sendet Wünsche zurück.
/* global io */
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const AVATARS = ['🦊', '🐻', '🐼', '🐸', '🦉', '🐯', '🐙', '🦄', '🐺', '🐧', '🦁', '🐢'];
const REACTIONS = ['👍', '😂', '😮', '😬', '🔥', '🙈', 'GG', 'Nice Hand', 'Glück gehabt', 'Respekt'];
const SUIT = { s: '♠', h: '♥', d: '♦', c: '♣' };
const STREET = { preflop: 'Pre-Flop', flop: 'Flop', turn: 'Turn', river: 'River', done: 'Hand vorbei' };
// Pokerhände von stark nach schwach: [Kategorie, Name, englisch, Erklärung, Beispiel, Anzahl zählender Karten]
const HANDS = [
  [9, 'Royal Flush', 'Royal Flush', 'Ass bis Zehn in einer Farbe', ['As', 'Ks', 'Qs', 'Js', 'Ts'], 5],
  [8, 'Straight Flush', 'Straight Flush', 'Fünf Karten in Folge, alle in einer Farbe', ['Th', '9h', '8h', '7h', '6h'], 5],
  [7, 'Vierling', 'Four of a Kind', 'Vier Karten mit gleichem Wert', ['Qh', 'Qs', 'Qd', 'Qc', '5d'], 4],
  [6, 'Full House', 'Full House', 'Drilling und Paar zusammen', ['Ad', 'As', 'Ah', '7c', '7d'], 5],
  [5, 'Flush', 'Flush', 'Fünf Karten in einer Farbe, egal welche Werte', ['Ad', 'Jd', '8d', '5d', '7d'], 5],
  [4, 'Straße', 'Straight', 'Fünf Karten in Folge, Farben gemischt', ['Th', '9s', '8d', '7c', '6s'], 5],
  [3, 'Drilling', 'Three of a Kind', 'Drei Karten mit gleichem Wert', ['Qh', 'Qs', 'Qd', '7c', '6s'], 3],
  [2, 'Zwei Paare', 'Two Pair', 'Zwei verschiedene Paare', ['Jh', 'Jc', '9d', '9c', '2d'], 4],
  [1, 'Paar', 'One Pair', 'Zwei Karten mit gleichem Wert', ['Qs', 'Qh', '6h', '9c', '2d'], 2],
  [0, 'Höchste Karte', 'High Card', 'Nichts davon – die höchste Karte zählt', ['Ah', 'Qs', '6s', '5d', 'Tc'], 1],
];
const HAND_NAME = Object.fromEntries(HANDS.map(([cat, name]) => [cat, name]));
function pct(p) { return p >= 99.95 ? 'sicher' : p < 1 ? '< 1 %' : Math.round(p) + ' %'; }

// ---------- Persönliche Einstellungen (nur in diesem Browser) ----------
const PREF_DEFAULTS = { fourColor: false, strength: true, bb: false, sound: true, calm: false, theme: 'classic', keys: true };
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* privater Modus */ } },
};
let prefs = { ...PREF_DEFAULTS, ...store.get('poker:prefs', {}) };
function savePrefs() { store.set('poker:prefs', prefs); applyPrefs(); render(); }
function applyPrefs() {
  document.body.classList.toggle('four', prefs.fourColor);
  document.body.classList.toggle('calm', prefs.calm);
  document.documentElement.dataset.theme = prefs.theme;
}
applyPrefs();

// ---------- Zustand ----------
let S = null;            // letzter Zustand vom Server
let prevS = null;
let session = null;      // { code, token }
let account = { mode: 'open', user: null }; // aus /me: Discord, Passwort oder offen
let clockOffset = 0;     // Server-Uhr minus Browser-Uhr
let raiseValue = null;
let raiseKey = null;
let panel = null;
let handsOpen = false;
let actionSeq = 0;

const socket = io({ transports: ['websocket', 'polling'] });

// ---------- Hilfen ----------
function amt(n) {
  if (prefs.bb && S?.settings?.bigBlind) {
    const v = n / S.settings.bigBlind;
    return (Number.isInteger(v) ? v : v.toFixed(1)).toLocaleString('de-DE') + ' BB';
  }
  return Number(n).toLocaleString('de-DE');
}
function cardHTML(c, extra = '') {
  if (!c || c === '??') return `<div class="card back ${extra}" aria-label="verdeckte Karte"></div>`;
  const r = c[0] === 'T' ? '10' : c[0];
  const s = c[1];
  const red = s === 'h' || s === 'd' ? 'red' : '';
  return `<div class="card ${red} ${s} ${extra}" aria-label="${r}${SUIT[s]}"><span class="r">${r}</span><span class="s">${SUIT[s]}</span></div>`;
}
const brokenAvatars = new Set();
function avatarHTML(p) {
  if (p?.avatarUrl && !brokenAvatars.has(p.avatarUrl)) {
    return `<img class="av-img" src="${esc(p.avatarUrl)}" alt="" data-initial="${esc(initial(p.name))}" referrerpolicy="no-referrer" loading="lazy">`;
  }
  if (p?.avatarUrl) return `<span class="av-initial">${esc(initial(p.name))}</span>`;
  return esc(p?.avatar || '🙂');
}
const initial = (name) => (String(name || '?').trim()[0] || '?').toUpperCase();
// Kein Inline-onerror (CSP): Fehler beim Laden fangen wir global ab
document.addEventListener('error', (e) => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement) || !img.classList.contains('av-img')) return;
  brokenAvatars.add(img.getAttribute('src'));
  const span = document.createElement('span');
  span.className = 'av-initial';
  span.textContent = img.dataset.initial || '?';
  img.replaceWith(span);
}, true);
function chipClass(n) {
  const bb = S?.settings?.bigBlind || 100;
  const x = n / bb;
  return x >= 50 ? 'c5' : x >= 20 ? 'c4' : x >= 5 ? 'c3' : x >= 2 ? 'c2' : 'c1';
}
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
// Chip-Stapel: 1–3 Chips je nach Höhe (in Big Blinds)
function chipStack(n, max = 3) {
  const x = n / (S?.settings?.bigBlind || 100);
  const count = Math.min(max, x < 2 ? 1 : x < 10 ? 2 : 3);
  return `<span class="stack" aria-hidden="true">${`<span class="chip ${chipClass(n)}"></span>`.repeat(count)}</span>`;
}

// Eigener Bestätigungsdialog (statt confirm/prompt): Titel, ein Satz, Abbrechen links, Aktion rechts.
// <dialog> hält den Fokus im Dialog, Esc schließt. Ergebnis: false, true oder der eingegebene Wert.
function ask({ title, text = '', ok = 'OK', danger = false, input = null }) {
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
    field.setAttribute('aria-label', input.label || title);
    // Enter = Aktion (sonst würde das Formular den ersten Knopf, also „Abbrechen“, auslösen)
    field.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); d.close('ok'); } });
    extra.append(field);
  }
  const okBtn = $('#dlg-ok');
  okBtn.textContent = ok;
  okBtn.className = 'btn ' + (danger ? 'btn-danger' : 'btn-brass');
  $('#dlg-cancel').hidden = !!input?.noCancel;
  return new Promise((res) => {
    d.returnValue = '';
    d.addEventListener('close', () => res(d.returnValue === 'ok' ? (field && !field.readOnly ? field.value : true) : false), { once: true });
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
const sounds = {
  turn: () => { beep(740, 140, 0.06); setTimeout(() => beep(988, 160, 0.05), 140); },
  chips: () => { beep(2200, 40, 0.03, 'triangle'); setTimeout(() => beep(1800, 50, 0.025, 'triangle'), 50); },
  win: () => { [523, 659, 784].forEach((f, i) => setTimeout(() => beep(f, 180, 0.05), i * 110)); },
};

// ---------- Lobby ----------
const params = new URLSearchParams(location.search);
let lobbyTab = params.get('t') ? 'join' : 'create';
let avatar = store.get('poker:avatar', AVATARS[Math.floor(Math.random() * AVATARS.length)]);

function applyAccount() {
  const discord = account.mode === 'discord' && account.user;
  $('#f-name-field').hidden = !!discord;
  $('#f-avatar-field').hidden = !!discord;
  $('#f-name').required = !discord;
  const box = $('#me-box');
  box.hidden = !discord;
  if (discord) {
    box.innerHTML = `<span class="me-who">Angemeldet mit Discord als ${avatarHTML({ name: account.user.name, avatarUrl: account.user.avatar })} <b>${esc(account.user.name)}</b></span>
      <form method="post" action="/logout"><button class="btn btn-sm" type="submit">Abmelden</button></form>`;
    $('#lobby-foot').textContent = 'Nur Spielgeld, kein Echtgeld.';
  }
}
function showLobby(error = '') {
  $('#game').hidden = true;
  $('#lobby').hidden = false;
  applyAccount();
  $('#lobby-error').textContent = error;
  $('#f-name').value = store.get('poker:name', '');
  if (params.get('t')) $('#f-code').value = params.get('t').toUpperCase();
  $('#avatars').innerHTML = AVATARS.map((a) => `<button type="button" class="avatar-opt" data-a="${a}" aria-pressed="${a === avatar}" aria-label="Avatar ${a}">${a}</button>`).join('');
  setTab(lobbyTab);
}
function setTab(tab) {
  lobbyTab = tab;
  $$('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  $$('[data-for]').forEach((el) => { el.hidden = el.dataset.for !== tab; });
  $('#f-submit').textContent = tab === 'join' ? 'Platz nehmen' : 'Tisch erstellen';
  $('#f-code').required = tab === 'join';
}
$$('.tab').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
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
    session = { code: r.code, token: r.token };
    store.set('poker:session:' + r.code, r.token);
    store.set('poker:last', r.code);
    history.replaceState(null, '', '?t=' + r.code);
    showGame();
  };
  if (lobbyTab === 'create') {
    socket.emit('create', { name, avatar, settings: { startStack: $('#f-stack').value, smallBlind: $('#f-sb').value, bigBlind: $('#f-bb').value } }, done);
  } else {
    const code = $('#f-code').value.trim().toUpperCase();
    socket.emit('join', { code, name, avatar, token: store.get('poker:session:' + code, null) }, done);
  }
});

// Automatisch wieder an den Tisch, wenn wir schon ein Token haben
function tryResume() {
  const code = (params.get('t') || '').toUpperCase();
  const token = code && store.get('poker:session:' + code, null);
  if (code && account.mode === 'discord') {
    socket.emit('join', { code }, (r) => {
      if (r?.ok) { session = { code: r.code, token: r.token }; store.set('poker:last', r.code); showGame(); }
      else showLobby(r?.error || '');
    });
    return;
  }
  if (!token) { showLobby(); return; }
  socket.emit('join', { code, token }, (r) => {
    if (r?.ok) { session = { code: r.code, token: r.token }; showGame(); }
    else { store.set('poker:session:' + code, null); showLobby(); }
  });
}

// ---------- Socket ----------
socket.on('connect', () => {
  $('#offline').hidden = true;
  if (session) socket.emit('join', { code: session.code, token: session.token }, (r) => { if (!r?.ok) { toast(r?.error, true); session = null; showLobby(); } });
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
// Sitzung ungültig (abgemeldet, nicht mehr auf dem Discord-Server) → zur Login-Seite
socket.on('loggedOut', () => { location.href = '/login?error=expired&next=' + encodeURIComponent(location.pathname + location.search); });
socket.on('kicked', () => { if (session) store.set('poker:session:' + session.code, null); session = null; toast('Der Host hat dich vom Tisch genommen', true); showLobby(); });
socket.on('state', (st) => {
  prevS = S; S = st;
  clockOffset = st.now - Date.now();
  if (session) { animateChips(prevS, S); render(); cues(prevS, S); }
});
socket.on('reaction', ({ seat, id, text }) => showReaction(seat, id, text));

function showGame() {
  $('#lobby').hidden = true;
  $('#game').hidden = false;
  render();
}

// ---------- Darstellung ----------
// Hochformat (Handy, Tablet hochkant): hoher Tisch. Muss zu den Media-Queries in style.css passen.
const PORTRAIT = '(max-width: 1100px) and (orientation: portrait)';
const COMPACT = '(max-width: 640px)';
// Punkte auf einer leicht eckigen Ellipse, gleichmäßig nach Bogenlänge verteilt (unten beginnend, im Uhrzeigersinn).
// So liegen die Panels überall gleich weit auseinander statt sich oben und unten zu drängen.
function ringPoints(n, aspect) {
  const P = 2.5, M = 360, pts = [];
  for (let k = 0; k <= M; k++) {
    const a = Math.PI / 2 + (k * 2 * Math.PI) / M;
    const c = Math.cos(a), s = Math.sin(a);
    pts.push([Math.sign(c) * Math.abs(c) ** (2 / P), Math.sign(s) * Math.abs(s) ** (2 / P)]);
  }
  const len = [0];
  for (let k = 1; k <= M; k++) len.push(len[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], (pts[k][1] - pts[k - 1][1]) * aspect));
  const out = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const t = (len[M] * i) / n;
    while (len[j + 1] < t) j++;
    out.push(pts[j]);
  }
  return out;
}
// Wer sitzt, sieht nur besetzte Plätze – man selbst unten. Zuschauer sehen alle 9 Plätze, um sich hinzusetzen.
function seatLayout() {
  const portrait = matchMedia(PORTRAIT).matches;
  const mySeat = S.you?.seat;
  const iAmSeated = mySeat !== null && mySeat !== undefined;
  const seated = S.seats.filter(Boolean).length;
  const showEmpty = !iAmSeated && seated < S.settings.maxPlayers;
  const base = iAmSeated ? mySeat : 0;
  const list = [];
  for (let k = 0; k < 9; k++) { const i = (base + k) % 9; if (S.seats[i] || showEmpty) list.push(i); }
  const t = $('#table');
  const aspect = t.offsetHeight / Math.max(1, t.offsetWidth);
  const rx = portrait ? 42 : 50, ry = portrait ? 47 : 51;
  const pos = {};
  ringPoints(list.length, aspect).forEach(([ux, uy], k) => { pos[list[k]] = { x: 50 + rx * ux, y: 50 + ry * uy }; });
  return pos;
}

// Einsätze, Blind-Chips und Dealer-Puck an den gemessenen Panels ausrichten – ohne Überlappung mit Board, Pot,
// Text, Karten oder anderen Panels. Für jedes Teil gibt es mehrere Ausweichpositionen, die erste freie gewinnt.
function placeExtras(h) {
  const T = $('#table').getBoundingClientRect();
  const rel = (r) => ({ l: r.left - T.left, t: r.top - T.top, r: r.right - T.left, b: r.bottom - T.top });
  const obstacles = [];
  const addObs = (sel) => $$(sel).forEach((e) => { const r = e.getBoundingClientRect(); if (r.width && getComputedStyle(e).display !== 'none') obstacles.push(rel(r)); });
  addObs('#board'); addObs('.pot-box'); addObs('.felt-msg > *'); addObs('.seat .plate'); addObs('.seat-cards .card'); addObs('.empty-seat');
  const pad = 3;
  const free = (c, w, hh) => {
    const b = { l: c.x - w / 2 - pad, r: c.x + w / 2 + pad, t: c.y - hh / 2 - pad, b: c.y + hh / 2 + pad };
    if (b.l < 6 || b.t < 6 || b.r > T.width - 6 || b.b > T.height - 6) return false;
    return !obstacles.some((o) => b.l < o.r && o.l < b.r && b.t < o.b && o.t < b.b);
  };
  const take = (c, w, hh) => obstacles.push({ l: c.x - w / 2, r: c.x + w / 2, t: c.y - hh / 2, b: c.y + hh / 2 });
  const pick = (cands, w, hh) => cands.find((c) => free(c, w, hh)) || cands[0];
  const cx = T.width / 2, cy = T.height / 2;
  const anchors = {}; // Platz → { px, py, ux, uy, e, bet }
  for (const plate of $$('.seat .plate')) {
    const seatEl = plate.closest('[data-seat]');
    if (getComputedStyle(seatEl).display === 'none') {
      // eigenes Panel am Handy ausgeblendet: Anker ist trotzdem sein Platz
      const px = (parseFloat(seatEl.style.left) / 100) * T.width, py = (parseFloat(seatEl.style.top) / 100) * T.height;
      const d = Math.hypot(px - cx, py - cy) || 1;
      anchors[seatEl.dataset.seat] = { px, py, ux: (px - cx) / d, uy: (py - cy) / d, hw: 10, hh: 10 };
      continue;
    }
    const r = rel(plate.getBoundingClientRect());
    const px = (r.l + r.r) / 2, py = (r.t + r.b) / 2;
    const d = Math.hypot(px - cx, py - cy) || 1;
    anchors[seatEl.dataset.seat] = { px, py, ux: (px - cx) / d, uy: (py - cy) / d, hw: (r.r - r.l) / 2, hh: (r.b - r.t) / 2 };
  }
  // Abstand vom Panel-Mittelpunkt bis zum Rand in Richtung Tischmitte
  const edge = (a) => Math.min(a.hw / Math.max(1e-3, Math.abs(a.ux)), a.hh / Math.max(1e-3, Math.abs(a.uy)));
  const inward = (a, w, hh, extra) => {
    const D = edge(a) + 10 + Math.abs(a.ux) * w / 2 + Math.abs(a.uy) * hh / 2 + extra;
    return { x: a.px - a.ux * D, y: a.py - a.uy * D };
  };
  const sideOf = (a, w, hh) => [
    { x: a.px, y: a.py - Math.sign(a.uy || 1) * (a.hh + hh / 2 + 8) },
    { x: a.px - Math.sign(a.ux || 1) * (a.hw + w / 2 + 8), y: a.py },
    { x: a.px + Math.sign(a.ux || 1) * 0, y: a.py + Math.sign(a.uy || 1) * (a.hh + hh / 2 + 8) },
  ];
  // 1. Einsätze
  for (const el of $$('#seats .bet')) {
    const a = anchors[el.dataset.bet]; if (!a) continue;
    const w = el.offsetWidth, hh = el.offsetHeight;
    const c = pick([0, 16, 34, 56, 80].map((x) => inward(a, w, hh, x)).concat(sideOf(a, w, hh)), w, hh);
    take(c, w, hh); a.bet = c;
    el.style.left = (c.x / T.width) * 100 + '%'; el.style.top = (c.y / T.height) * 100 + '%'; el.style.visibility = '';
  }
  // 2. Blind-Chips und Dealer neben dem Einsatz (oder wo er wäre)
  const nearBet = (a, s) => {
    const b = a.bet || inward(a, 60, 24, 0);
    const px = -a.uy, py = a.ux; // senkrecht zur Richtung zur Tischmitte
    const out = [];
    for (const k of [1, -1]) for (const dist of [48, 66, 86]) out.push({ x: b.x + px * dist * k, y: b.y + py * dist * k });
    out.push(inward(a, s, s, 0), inward(a, s, s, 30), ...sideOf(a, s, s));
    return out;
  };
  for (const el of $$('#seats .badge')) {
    const a = anchors[el.dataset.for]; if (!a) continue;
    const s = el.offsetWidth;
    const c = pick(nearBet(a, s), s, s);
    take(c, s, s);
    el.style.left = (c.x / T.width) * 100 + '%'; el.style.top = (c.y / T.height) * 100 + '%'; el.style.visibility = '';
  }
  const dealer = $('#dealer');
  const a = h ? anchors[h.button] : null;
  if (a) {
    dealer.hidden = false;
    const s = dealer.offsetWidth || 26;
    const c = pick(nearBet(a, s), s, s);
    take(c, s, s);
    dealer.style.left = (c.x / T.width) * 100 + '%'; dealer.style.top = (c.y / T.height) * 100 + '%';
  } else dealer.hidden = true;
}
const RING = 138.2; // Umfang des Timer-Rings (r = 22)
const ringSVG = '<svg class="ring" viewBox="0 0 48 48" aria-hidden="true"><circle class="ring-bg" cx="24" cy="24" r="22"/><circle class="ring-fg" cx="24" cy="24" r="22" stroke-dasharray="138.2" stroke-dashoffset="0"/></svg>';

function render() {
  if (!S || $('#game').hidden) return;
  document.documentElement.style.setProperty('--topbar', $('.topbar').offsetHeight + 'px');
  $('#room-code').textContent = S.code;
  $('#nav-host').hidden = !S.you?.isHost;
  const h = S.hand;
  const st = S.settings;
  $('#meta').innerHTML = `<div class="blinds"><small>Blinds</small>${amt(st.smallBlind)} / ${amt(st.bigBlind)}</div>
    <div class="meta-sub">${h ? `Hand #${h.no} · ${STREET[h.street]}` : 'Noch keine Hand'}${S.frozen ? ' · <b>Angehalten</b>' : S.paused ? ' · <b>Pause</b>' : ''}</div>`;
  const fb = $('#freeze-btn');
  fb.hidden = !S.you?.isHost || !S.started;
  fb.classList.toggle('btn-brass', !!S.frozen);
  fb.innerHTML = S.frozen ? `${ICON.play}<span class="long">Weiterspielen</span>` : `${ICON.pause}<span class="long">Alle anhalten</span>`;
  fb.title = S.frozen ? 'Weiterspielen' : 'Spiel für alle sofort anhalten';
  fb.setAttribute('aria-label', fb.title);
  document.body.classList.toggle('frozen', !!S.frozen);
  renderTable();
  renderDock();
  document.documentElement.style.setProperty('--dock-h', $('#dock').offsetHeight + 'px');
  // Erst jetzt steht die Tischgröße fest. Der Dealer-Puck bleibt dasselbe Element und gleitet deshalb.
  placeExtras(h && S.seats[h.button] ? h : null);
  if (panel) renderPanel();
  if (handsOpen) renderHands();
  renderSeb();
}

function renderTable() {
  const h = S.hand;
  const pos = seatLayout();
  const winning = new Set();
  const winners = new Map(); // Platz → gewonnener Betrag
  if (h?.done && h.result) {
    for (const p of h.result.pots) {
      (p.cards || []).forEach((c) => winning.add(c));
      for (const w of p.winners) winners.set(w, (winners.get(w) || 0) + Math.floor(p.amount / p.winners.length));
    }
  }
  const justDone = !!(h?.done && !(prevS?.hand?.done && prevS.hand.no === h.no));

  // Pot: Main Pot und Side Pots als eigene Panels
  const pots = h && !h.done ? h.pots : [];
  $('#pot').innerHTML = pots.map((p, i) => {
    const label = pots.length > 1 ? (i ? 'Side Pot' + (pots.length > 2 ? ' ' + i : '') : 'Main Pot') : 'Pot';
    return `<div class="pot-box ${i ? 'side' : ''}">${chipStack(p, i ? 2 : 3)}<span class="pot-text"><small>${label}</small><b>${amt(p)}</b></span></div>`;
  }).join('');

  // Board
  const board = h?.board || [];
  const prevBoard = prevS?.hand?.no === h?.no ? prevS?.hand?.board || [] : [];
  let html = '';
  for (let i = 0; i < 5; i++) {
    const c = board[i];
    if (c) html += cardHTML(c, `${i >= prevBoard.length ? 'deal' : ''} ${h.done && winning.size ? (winning.has(c) ? `win ${justDone ? 'glow' : ''}` : 'dim') : ''}`);
    else html += '<div class="slot" aria-hidden="true"></div>';
  }
  $('#board').innerHTML = html;

  // Nachricht auf dem Filz
  let msg = '';
  if (S.frozen) {
    msg = `<div class="big">${ICON.pause} Angehalten</div><div class="sub">${S.you?.isHost ? 'Mit <b>Weiterspielen</b> oben geht es genau hier weiter.' : 'Der Host hat das Spiel angehalten. Gleich geht es weiter.'}</div>`;
  } else if (!h || (!S.started && !h)) {
    const seated = S.seats.filter(Boolean).length;
    msg = S.you?.isHost
      ? `<div class="big">${seated < 2 ? 'Warte auf Mitspieler' : 'Alle da?'}</div><div class="sub">${seated < 2 ? 'Teil den Link oben – sobald 2 sitzen, kannst du starten.' : `<button class="btn btn-brass" data-do="start">Spiel starten</button>`}</div>`
      : `<div class="big">Gleich geht’s los</div><div class="sub">Der Host startet das Spiel.</div>`;
  } else if (h.done && h.result) {
    const lines = h.result.pots.map((p, i) => `<div class="${i ? 'sub' : 'big'}">${esc(p.names.join(' & '))} ${p.winners.length > 1 ? 'teilen sich' : 'gewinnt'} ${amt(p.amount)}${p.hand ? ` mit ${esc(p.hand)}` : ''}</div>`);
    const next = S.nextAt ? Math.max(0, Math.ceil((S.nextAt - (Date.now() + clockOffset)) / 1000)) : null;
    let sub = '';
    if (S.paused) sub = 'Pause – der Host macht weiter';
    else if (next !== null) sub = `Nächste Hand in <span data-countdown>${next}</span> s`;
    else if (S.you?.isHost) sub = '<button class="btn btn-brass btn-sm" data-do="nextHand">Nächste Hand</button>';
    else if (!S.settings.autoNext) sub = 'Der Host startet die nächste Hand';
    msg = lines.join('') + (sub ? `<div class="sub" style="margin-top:6px">${sub}</div>` : '');
  } else if (!h.done && S.paused) {
    msg = '<div class="sub">Pause nach dieser Hand</div>';
  }
  $('#felt-msg').innerHTML = msg;

  // Plätze
  const mySeat = S.you?.seat;
  const iAmSeated = mySeat !== null && mySeat !== undefined;
  const seatedCount = S.seats.filter(Boolean).length;
  let seatsHTML = '';
  for (const [key, p] of Object.entries(pos)) {
    const i = Number(key);
    const s = S.seats[i];
    const style = `left:${p.x}%;top:${p.y}%`;
    if (!s) {
      seatsHTML += `<div class="empty-seat" style="${style}">${!iAmSeated && seatedCount < S.settings.maxPlayers ? `<button class="sit-btn" data-sit="${i}" aria-label="Hier sitzen"><span class="plus" aria-hidden="true">+</span><span class="long">Hier sitzen</span></button>` : '<div class="empty-dot"></div>'}</div>`;
      continue;
    }
    const turn = h && !h.done && h.toAct === i;
    const showing = s.cards && s.cards[0] !== '??' && i !== mySeat;
    const won = winners.get(i);
    const prev = prevS?.seats?.[i];
    const fx = (k) => (prev && prev.id === s.id && prev[k] !== s[k] ? 'fx' : '');
    const cls = ['seat', showing && 'showing', turn && 'turn', i === mySeat && 'me', s.folded && 'folded',
      (s.sittingOut || s.busted) && !s.inHand && 'out', s.sittingOut && 'break', !s.connected && 'is-offline',
      s.allIn && 'allin', won && 'winner', won && justDone && 'shine'].filter(Boolean).join(' ');
    let cards = '';
    if (s.cards && i !== mySeat) cards = s.cards.map((c) => cardHTML(c, h.done && winning.size ? (winning.has(c) ? 'win' : '') : '')).join('');
    // Status: immer Symbol bzw. Text, nie nur Farbe
    let status = '';
    if (won) status = '<span class="plaque status gold">★ Gewinnt</span>';
    else if (s.allIn) status = `<span class="plaque status red ${fx('allIn')}">All-in</span>`;
    else if (!s.connected) status = `<span class="plaque status ${fx('connected')}">${ICON.offline}offline</span>`;
    else if (s.sittingOut) status = `<span class="plaque status blue ${fx('sittingOut')}" title="${h && !h.done && s.inHand && !s.folded ? 'Macht ab der nächsten Hand Pause' : 'Macht Pause'}">${ICON.pause}Pause</span>`;
    else if (s.folded) status = `<span class="plaque status ${fx('folded')}">Fold</span>`;
    else if (s.busted) status = '<span class="plaque status">pleite</span>';
    // Letzte Aktion über dem Panel: Check/Call neutral, Bet/Raise Gold (All-in steht schon als Status da)
    let act = '';
    if (h && !h.done && !s.folded && !s.allIn && ['Check', 'Call', 'Bet', 'Raise'].includes(s.lastAction)) {
      act = `<span class="plaque act ${['Bet', 'Raise'].includes(s.lastAction) ? 'gold' : ''} ${fx('lastAction')}">${esc(s.lastAction)}</span>`;
    }
    const handName = h?.done && h.result?.hands?.[i] ? `<div class="p-hand">${esc(h.result.hands[i])}</div>` : '';
    seatsHTML += `<div class="${cls}" style="${style}" data-seat="${i}">
      <div class="seat-cards">${cards}</div>
      <div class="plate">
        <div class="av-wrap">${ringSVG}<div class="avatar">${avatarHTML(s)}</div></div>
        <div class="p-info">
          <div class="p-name"><span>${esc(s.name)}</span>${s.isHost ? `${ICON.crown}<span class="sr-only">(Host)</span>` : ''}</div>
          <div class="p-stack"><span class="chip c5" aria-hidden="true"></span>${amt(s.stack)}</div>
          ${handName}
        </div>
        ${act}${status}
        ${won ? `<span class="p-win ${justDone ? 'pop' : ''}">+${amt(won)}</span>` : ''}
      </div>
    </div>`;
    if (s.bet > 0) seatsHTML += `<div class="bet" style="visibility:hidden" data-bet="${i}">${chipStack(s.bet, 3)}${amt(s.bet)}</div>`;
    if (h && !h.done) {
      const blind = h.bb === i ? 'bb' : h.sb === i && h.sb !== h.button ? 'sb' : null;
      if (blind) seatsHTML += `<b class="badge ${blind}" style="visibility:hidden" data-for="${i}" title="${blind === 'sb' ? 'Small Blind' : 'Big Blind'}">${blind.toUpperCase()}</b>`;
    }
  }
  $('#seats').innerHTML = seatsHTML;
}

function renderDock() {
  const dock = $('#dock');
  const h = S.hand;
  const mySeat = S.you?.seat;
  if (mySeat === null || mySeat === undefined) {
    dock.innerHTML = `<div class="mine">${handsBtn()}<div class="waiting">Du schaust zu. Klick auf <b>Hier sitzen</b>, um mitzuspielen.</div></div><div></div>`;
    return;
  }
  const me = S.seats[mySeat];
  const myCards = me.cards && me.cards[0] !== '??' ? me.cards : null;
  const winning = new Set();
  if (h?.done) h.result?.pots.forEach((p) => (p.cards || []).forEach((c) => winning.add(c)));
  const fresh = prevS?.hand?.no !== h?.no;
  const cardsHTML = myCards ? myCards.map((c) => cardHTML(c, `${fresh ? 'deal' : ''} ${winning.has(c) ? 'win' : ''}`)).join('') : '';
  let chances = '';
  if (S.odds && S.strengthCat !== null && h && !h.done && h.street !== 'river') {
    const better = HANDS.filter(([cat]) => cat > S.strengthCat && S.odds[cat] >= 1).sort((a, b) => S.odds[b[0]] - S.odds[a[0]]).slice(0, 2);
    if (better.length) chances = `<small class="chances">Chance: ${better.map(([cat, name]) => `${name} ${pct(S.odds[cat])}`).join(' · ')}</small>`;
  }
  const strength = myCards && prefs.strength && S.strength ? `<button class="strength" data-hands title="Alle Pokerhände und deine Chancen"><span>${esc(S.strength)}</span><small>${STREET[h.street]}</small>${chances}</button>` : '';
  const myChips = `<span class="me-chips"><span class="chip c5" aria-hidden="true"></span>${amt(me.stack)}${S.legal ? ' · <b>Du bist dran</b>' : ''}</span>`;
  const left = `<div class="mine">${handsBtn()}<div class="cards">${cardsHTML}</div><div class="mine-info">${strength}${myChips}</div></div>`;

  let right = '';
  const L = S.legal;
  if (L) {
    const key = `${h.no}:${h.street}:${h.currentBet}`;
    if (raiseKey !== key) { raiseKey = key; raiseValue = L.minTo; }
    raiseValue = Math.min(L.maxTo, Math.max(L.minTo, raiseValue));
    const kb = (k) => (prefs.keys ? `<kbd>${k}</kbd>` : '');
    const callInner = L.canCheck
      ? `<span class="amt">Check</span><small>kostet nichts ${kb('C')}</small>`
      : `<small>${L.toCall >= me.stack ? 'All-in' : 'Call'} ${kb('C')}</small><span class="amt">${amt(L.toCall)}</span>`;
    right = `<div class="actions">
      ${L.canRaise && L.maxTo > L.minTo ? `<div class="raise-box">
        <div class="presets">
          <button class="btn btn-sm" data-preset="0.5">½ Pot</button>
          <button class="btn btn-sm" data-preset="0.75">¾ Pot</button>
          <button class="btn btn-sm" data-preset="1">Pot</button>
          <button class="btn btn-sm" data-preset="all">All-in</button>
        </div>
        <div class="raise-line">
          <input type="range" id="raise-range" min="${L.minTo}" max="${L.maxTo}" step="${Math.max(1, Math.floor(S.settings.smallBlind))}" value="${raiseValue}" aria-label="Betrag">
          <input type="number" id="raise-num" min="${L.minTo}" max="${L.maxTo}" value="${raiseValue}" aria-label="Betrag eingeben">
        </div>
      </div>` : ''}
      <div class="act-row act-main">
        <button class="btn btn-outline-red" data-act="fold" ${L.canCheck ? 'title="Du könntest auch checken"' : ''}><span class="amt">Fold</span><small>${L.canCheck ? 'statt Check' : 'aussteigen'} ${kb('F')}</small></button>
        <button class="btn" data-act="${L.canCheck ? 'check' : 'call'}">${callInner}</button>
        ${L.canRaise ? `<button class="btn btn-brass" data-act="raise" id="raise-btn">${raiseInner(raiseValue)}</button>` : ''}
      </div>
    </div>`;
  } else {
    const parts = [];
    if (S.frozen) parts.push(`<span class="waiting"><b>${ICON.pause} Angehalten</b> – warte auf den Host</span>`);
    else if (me.sittingOut) parts.push(`<span class="waiting break-note">${ICON.pause} Du machst Pause${h && !h.done && me.inHand && !me.folded ? ' ab der nächsten Hand' : ' und bekommst keine Karten'}</span>`);
    else if (h && !h.done && h.toAct >= 0) {
      const who = S.seats[h.toAct];
      parts.push(`<span class="waiting">${me.folded ? 'Du bist raus. ' : ''}<b>${esc(who?.name)}</b> ist dran …</span>`);
    } else if (h?.done) {
      parts.push('<span class="waiting">Hand vorbei</span>');
    }
    if (S.canShow) parts.push('<button class="btn btn-brass" data-do="show">Karten zeigen</button>');
    if (me.busted && !(h && !h.done && me.inHand && !me.folded)) {
      parts.push(S.settings.rebuy === 'off' ? '<span class="waiting">Keine Chips mehr</span>' : `<button class="btn btn-brass" data-do="rebuy">Nachkaufen (${amt(S.settings.startStack)})</button>`);
    }
    parts.push(me.sittingOut ? '<button class="btn btn-brass" data-do="back">Bin wieder da</button>' : `<button class="btn" data-do="sitout" title="Du bekommst keine Karten, bis du zurück bist">${ICON.pause}<span><span class="long">Ich mache </span>Pause</span></button>`);
    parts.push(`<button class="btn btn-ghost" data-do="stand">${me.leaving ? 'Stehe nach der Hand auf' : 'Aufstehen'}</button>`);
    right = `<div class="actions"><div class="act-row">${parts.join('')}</div></div>`;
  }
  dock.innerHTML = left + right;
}
function raiseInner(v) {
  const L = S.legal;
  const val = Math.min(L.maxTo, Math.max(L.minTo, v));
  return `<small>${L.isBet ? 'Bet' : 'Raise auf'}${val === L.maxTo ? ' · All-in' : ''} ${prefs.keys ? '<kbd>R</kbd>' : ''}</small><span class="amt">${amt(val)}</span>`;
}

// Timer und Countdown laufen ohne komplettes Neuzeichnen
function tick() {
  const seat = $('.seat.turn');
  const fg = seat?.querySelector('.ring-fg');
  if (fg) {
    const frozenLeft = S?.frozen ? S.hand?.frozenLeft : null;
    if (S?.hand && !S.hand.done && (S.hand.deadline || frozenLeft != null) && S.hand.turnTime) {
      const total = Math.max(1, S.hand.turnTime) * 1000;
      const left = frozenLeft != null ? frozenLeft : S.hand.deadline - (Date.now() + clockOffset);
      const f = Math.max(0, Math.min(1, left / total));
      fg.style.strokeDashoffset = String(RING * (1 - f));
      seat.classList.toggle('low', left < 8000);
    } else fg.style.strokeDashoffset = '0'; // ohne Zeitlimit: voller Ring
  }
  const cd = $('[data-countdown]');
  if (cd && S?.nextAt) cd.textContent = Math.max(0, Math.ceil((S.nextAt - (Date.now() + clockOffset)) / 1000));
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// Töne und Hinweise bei Zustandswechseln
function cues(a, b) {
  if (!b?.hand) return;
  const mine = b.you?.seat;
  const wasMyTurn = a?.hand && !a.hand.done && a.hand.toAct === mine && a.hand.no === b.hand.no && a.hand.street === b.hand.street && a.hand.currentBet === b.hand.currentBet;
  if (b.legal && !wasMyTurn) { sounds.turn(); if (document.hidden) document.title = '● Du bist dran – Pokerabend'; }
  if (!b.legal) document.title = 'Pokerabend';
  const betsBefore = a?.hand && !a.hand.done ? a.hand.bets : 0;
  if (b.hand.bets > betsBefore) sounds.chips();
  if (b.hand.done && !(a?.hand?.done && a.hand.no === b.hand.no)) {
    if (b.hand.result?.pots.some((p) => p.winners.includes(mine))) sounds.win(); else sounds.chips();
  }
}

// Einsätze fliegen in die Mitte, Pots fliegen zum Gewinner
function animateChips(a, b) {
  if (prefs.calm || !a?.hand || !b?.hand || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const sameHand = a.hand.no === b.hand.no;
  const streetChanged = sameHand && (a.hand.street !== b.hand.street);
  if (!streetChanged) return;
  const potEl = $('#pot');
  const target = potEl.getBoundingClientRect();
  const tx = target.left + target.width / 2; const ty = target.top + target.height / 2;
  const flights = [];
  $$('.bet').forEach((el) => {
    const r = el.getBoundingClientRect();
    const f = el.cloneNode(true);
    f.classList.add('flying'); f.style.left = r.left + 'px'; f.style.top = r.top + 'px'; f.style.transform = 'none';
    document.body.appendChild(f); flights.push([f, tx - r.left - r.width / 2, ty - r.top - r.height / 2]);
  });
  const winners = b.hand.done ? [...new Set(b.hand.result?.pots.flatMap((p) => p.winners) || [])] : [];
  requestAnimationFrame(() => requestAnimationFrame(() => {
    for (const [f, dx, dy] of flights) { f.style.transform = `translate(${dx}px, ${dy}px) scale(.8)`; f.style.opacity = '0'; }
    setTimeout(() => { flights.forEach(([f]) => f.remove()); potEl.classList.add('pulse'); setTimeout(() => potEl.classList.remove('pulse'), 400); }, 400);
    if (winners.length) {
      setTimeout(() => {
        for (const w of winners) {
          const seat = $(`.seat[data-seat="${w}"] .plate`); if (!seat) continue;
          const r = seat.getBoundingClientRect();
          const f = document.createElement('div'); f.className = 'flying';
          f.innerHTML = `<span class="chip c5" style="width:26px;height:26px;display:block"></span>`;
          f.style.left = tx + 'px'; f.style.top = ty + 'px';
          document.body.appendChild(f);
          requestAnimationFrame(() => requestAnimationFrame(() => { f.style.transform = `translate(${r.left + r.width / 2 - tx}px, ${r.top - ty}px)`; f.style.opacity = '.2'; }));
          setTimeout(() => f.remove(), 420);
        }
      }, 420);
    }
  }));
}

function showReaction(seat, id, text) {
  const el = seat !== null && seat !== undefined ? $(`.seat[data-seat="${seat}"]`) : null;
  if (!el) { const who = S?.standings.find((p) => p.id === id); toast(`${who?.name || 'Jemand'}: ${text}`); return; }
  const b = document.createElement('div');
  b.className = 'reaction'; b.textContent = text;
  b.style.left = el.style.left; b.style.top = el.style.top;
  $('#seats').appendChild(b);
  setTimeout(() => b.remove(), 2700);
}

// ---------- Easter Egg „Waiting for Sebastian“ ----------
// Der Server schickt in S.sebs, wer gerade als „Sebastian“ Pause macht. Hier nur Anzeige, kein Spielzustand.
const SEB_JOKES = [
  'Er kommt bestimmt gleich raus. Bestimmt.',
  'Tag 37: Sebastian ist immer noch verschwunden.',
  'Vielleicht kommt er nach 18:00 Uhr raus.',
  'Die nächste Jahreszeit beginnt bald …',
  'Sebastian.exe reagiert nicht.',
  'Wir haben mittlerweile den Winter erreicht.',
];
// Pixel-Art: Farmer wartet vor Sebastians Zimmertür, Uhr dreht, Zzz steigt auf
const SEB_SCENE = `<svg class="seb-scene" viewBox="0 0 80 46" shape-rendering="crispEdges" aria-hidden="true">
  <rect width="80" height="34" fill="#5b4030"/>
  <g fill="#4e3627"><rect y="8" width="80" height="1"/><rect y="17" width="80" height="1"/><rect y="26" width="80" height="1"/></g>
  <rect y="31" width="80" height="3" fill="#3b2619"/>
  <rect y="34" width="80" height="12" fill="#8a6a45"/>
  <g fill="#7a5c3a"><rect y="38" width="80" height="1"/><rect y="42" width="80" height="1"/><rect x="18" y="34" width="1" height="4"/><rect x="52" y="38" width="1" height="4"/><rect x="34" y="42" width="1" height="4"/></g>
  <!-- Fenster mit Nachthimmel -->
  <rect x="5" y="9" width="12" height="11" fill="#3b2619"/><rect x="6" y="10" width="10" height="9" fill="#1d2a4d"/>
  <rect x="10" y="10" width="1" height="9" fill="#3b2619"/><rect x="6" y="14" width="10" height="1" fill="#3b2619"/>
  <rect x="13" y="11" width="2" height="2" fill="#f4e7a1"/><rect x="7" y="16" width="1" height="1" fill="#f4e7a1"/>
  <!-- Wanduhr -->
  <rect x="23" y="5" width="9" height="9" fill="#3b2619"/><rect x="24" y="6" width="7" height="7" fill="#f3ead2"/>
  <rect x="27" y="6" width="1" height="1" fill="#3b2619"/><rect x="27" y="12" width="1" height="1" fill="#3b2619"/><rect x="24" y="9" width="1" height="1" fill="#3b2619"/><rect x="30" y="9" width="1" height="1" fill="#3b2619"/>
  <g class="seb-hand-h"><rect x="27" y="8" width="1" height="2" fill="#3b2619"/></g>
  <g class="seb-hand-m"><rect x="27" y="7" width="1" height="3" fill="#c8323c"/></g>
  <!-- Sebastians Tür -->
  <rect x="50" y="7" width="16" height="27" fill="#3b2619"/>
  <rect x="51" y="8" width="14" height="26" fill="#8f5f34"/>
  <rect x="53" y="10" width="10" height="9" fill="#7a4f2a"/><rect x="53" y="21" width="10" height="11" fill="#7a4f2a"/>
  <rect x="55" y="12" width="6" height="3" fill="#d9cba3"/><rect x="56" y="13" width="4" height="1" fill="#5b4030"/>
  <rect x="62" y="20" width="2" height="2" fill="#e8b04a"/>
  <rect x="51" y="33" width="14" height="1" fill="#1a110b"/>
  <!-- Wartender Farmer -->
  <g class="seb-farmer">
    <rect x="37" y="17" width="9" height="1" fill="#c9a24e"/>
    <rect x="38" y="15" width="7" height="2" fill="#e3c16f"/><rect x="38" y="16" width="7" height="1" fill="#b5532f"/>
    <rect x="39" y="18" width="5" height="4" fill="#f1c27d"/><rect x="38" y="18" width="2" height="3" fill="#6b3f1f"/>
    <rect x="43" y="19" width="1" height="1" fill="#2a1a10"/>
    <rect x="38" y="22" width="7" height="5" fill="#4a7fc1"/><rect x="40" y="22" width="1" height="5" fill="#3a6aa5"/>
    <rect x="37" y="23" width="1" height="3" fill="#4a7fc1"/><rect x="37" y="26" width="1" height="1" fill="#f1c27d"/>
    <rect x="45" y="23" width="1" height="3" fill="#4a7fc1"/><rect x="45" y="26" width="1" height="1" fill="#f1c27d"/>
    <rect x="39" y="27" width="5" height="4" fill="#3b4f7a"/><rect x="41" y="28" width="1" height="3" fill="#2d3d60"/>
    <rect x="39" y="31" width="2" height="2" fill="#3b2619"/><rect x="42" y="31" width="2" height="2" fill="#3b2619"/>
  </g>
  <g class="seb-z" fill="#e8f0ff" font-family="monospace" font-weight="700">
    <text x="45" y="14" font-size="4">z</text><text x="47" y="10" font-size="5">z</text><text x="44" y="6" font-size="6">Z</text>
  </g>
</svg>`;
let sebKey = null;
let sebIds = null;
let sebSmall = matchMedia('(max-width: 640px)').matches; // am Handy klein starten
let sebJokeTimer = null;
function sebWho(sebs) {
  const meIn = sebs.some((s) => s.id === S.you?.id);
  const others = sebs.filter((s) => s.id !== S.you?.id).map((s) => esc(s.name));
  const list = others.length > 1 ? others.slice(0, -1).join(', ') + ' und ' + others[others.length - 1] : others[0];
  if (meIn) return 'Alle warten darauf, dass du wiederkommst.' + (others.length ? ` Und auf ${list}.` : '');
  return `${list} ${others.length > 1 ? 'machen' : 'macht'} gerade Pause.`;
}
function renderSeb() {
  const el = $('#seb');
  const sebs = S?.sebs || [];
  const ids = sebs.map((s) => s.id);
  // Wer nicht mehr pausiert, aber noch am Tisch sitzt, ist zurück
  if (sebIds) {
    const back = sebIds.filter((id) => !ids.includes(id)).map((id) => S.seats.find((s) => s?.id === id)).filter((s) => s && !s.sittingOut);
    if (back.length) toast('Sebastian has finally emerged from his room!');
  }
  const fresh = sebIds !== null && ids.some((id) => !sebIds.includes(id));
  sebIds = ids;
  if (!sebs.length) { el.hidden = true; el.innerHTML = ''; sebKey = null; clearInterval(sebJokeTimer); return; }
  const key = JSON.stringify([sebs, S.you?.id, sebSmall]);
  if (key === sebKey) return; // nicht neu zeichnen, sonst starten die Animationen neu
  sebKey = key;
  el.hidden = false;
  el.classList.toggle('small', sebSmall);
  if (fresh) { el.classList.remove('intro'); void el.offsetWidth; el.classList.add('intro'); }
  el.innerHTML = `<button class="seb-toggle" data-seb-toggle aria-label="${sebSmall ? 'Szene zeigen' : 'Verkleinern'}" title="${sebSmall ? 'Szene zeigen' : 'Verkleinern'}">${sebSmall ? '▴' : '▾'}</button>
    <div class="seb-title">Waiting for Sebastian...</div>
    ${sebSmall ? '' : SEB_SCENE}
    <div class="seb-who" role="status" aria-live="polite">${sebWho(sebs)}</div>
    ${sebSmall ? '' : `<div class="seb-joke">${SEB_JOKES[0]}</div>`}`;
  clearInterval(sebJokeTimer);
  let i = 0;
  sebJokeTimer = setInterval(() => {
    const j = $('#seb .seb-joke'); if (!j) return;
    i = (i + 1) % SEB_JOKES.length;
    j.textContent = SEB_JOKES[i];
  }, 5000);
}

// ---------- Pokerhände (klappt unten links nach oben auf) ----------
const handsBtn = () => `<button class="hands-btn" data-hands aria-expanded="${handsOpen}" title="Welche Pokerhände gibt es?">Hände</button>`;
function toggleHands(open = !handsOpen) {
  handsOpen = open;
  $('#hands-pop').hidden = !open;
  $$('.hands-btn').forEach((b) => b.setAttribute('aria-expanded', String(open)));
  if (open) { renderHands(); $('.hrank.now')?.scrollIntoView({ block: 'center' }); }
}
function renderHands() {
  const odds = S.odds;
  const mine = S.strengthCat;
  $('#hands-body').innerHTML = `<p class="hint" style="margin:0;color:var(--muted)">${odds
    ? 'Prozent = so wahrscheinlich ist das am River deine Hand. Die Karten der anderen kennt keiner, die zählen nicht mit.'
    : 'Von oben nach unten: die stärkste Hand zuerst. Haben zwei dasselbe, gewinnt die höhere Karte.'}</p>
    <div class="hranks">${HANDS.map(([cat, name, en, desc, cards, used]) => {
      const p = odds ? odds[cat] : null;
      const tag = mine === cat ? '<span class="hr-now">Hast du</span>' : '';
      const chance = p === null ? '' : `<span class="hr-pct ${p > 0 ? '' : 'none'}">${p > 0 ? pct(p) : '–'}</span>`;
      return `<div class="hrank ${mine === cat ? 'now' : ''}">
        <div class="hr-head"><b>${name}</b>${en !== name ? `<small>${en}</small>` : ''}${tag}${chance}</div>
        <div class="hr-cards">${cards.map((c, i) => cardHTML(c, i >= used ? 'dim' : '')).join('')}</div>
        <small class="hr-desc">${desc}</small>
      </div>`;
    }).join('')}</div>`;
}

// ---------- Seitenleiste ----------
const PANEL_TITLES = { log: 'Verlauf', stand: 'Stand des Abends', me: 'Meine Einstellungen', host: 'Host' };
function openPanel(name) {
  panel = panel === name ? null : name;
  $('#panel').hidden = !panel;
  $$('.nav-btn').forEach((b) => b.setAttribute('aria-current', String(b.dataset.panel === panel)));
  if (panel) { $('#panel-title').textContent = PANEL_TITLES[panel]; renderPanel(true); }
}
$$('.nav-btn').forEach((b) => b.addEventListener('click', () => openPanel(b.dataset.panel)));
$('#panel-close').addEventListener('click', () => openPanel(null));

let hostTab = 'spiel';
let openMenu = null;          // Spieler-ID, deren ⋯-Menü offen ist
const openGroups = new Set(['blinds']);
// Kartennamen im Verlauf als Mini-Karten („Flop: A♠ K♦ 7♣“). Text ist schon escaped.
const SUIT_KEY = { '♠': 's', '♥': 'h', '♦': 'd', '♣': 'c' };
function miniCards(text) {
  return text.replace(/(^|[\s:(])(10|[2-9JQKA])([♠♥♦♣])/g, (_, pre, r, s) => `${pre}<span class="mc ${s === '♥' || s === '♦' ? 'red' : ''} ${SUIT_KEY[s]}">${r}${s}</span>`);
}

function renderPanel(force = false) {
  const body = $('#panel-body');
  // Formulare nicht neu zeichnen, während jemand tippt oder ein Menü offen ist
  if (!force && (panel === 'host' || panel === 'me') && body.contains(document.activeElement) && document.activeElement.matches('input, select')) return;
  if (!force && panel === 'host' && openMenu) return;
  if (panel === 'log') {
    const atBottom = body.scrollTop + body.clientHeight >= body.scrollHeight - 30;
    body.innerHTML = `<div class="reacts">${REACTIONS.map((r) => `<button class="btn btn-sm" data-react="${esc(r)}">${esc(r)}</button>`).join('')}</div>
      <ul class="log">${S.log.map((l) => `<li class="${l.kind}">${miniCards(esc(l.text))}</li>`).join('')}</ul>`;
    if (atBottom || force) body.scrollTop = body.scrollHeight;
  } else if (panel === 'stand') {
    const st = S.stats;
    body.innerHTML = `<table class="standings"><tbody>${S.standings.map((p, k) => `<tr>
        <td><span class="rank ${k < 3 ? 'r' + (k + 1) : ''}" aria-label="Platz ${k + 1}">${k + 1}</span></td>
        <td><span class="mini-av">${avatarHTML(p)}</span> ${esc(p.name)}${p.connected ? '' : ` <small style="color:var(--text-2)">${ICON.offline} offline</small>`}${p.rebuys ? `<br><small style="color:var(--text-2)">${p.rebuys}× nachgekauft</small>` : ''}</td>
        <td class="num">${amt(p.chips)}</td>
        <td class="num ${p.net > 0 ? 'pos' : p.net < 0 ? 'neg' : ''}">${p.net > 0 ? '+' : p.net < 0 ? '−' : '±'}${amt(Math.abs(p.net))}</td></tr>`).join('')}</tbody></table>
      <div class="facts">
        <div class="fact"><small>Gespielte Hände</small>${st.hands}</div>
        ${st.biggestPot ? `<div class="fact"><small>Größter Pot</small>${amt(st.biggestPot.amount)} – ${esc(st.biggestPot.name)}${st.biggestPot.hand ? ` mit ${esc(st.biggestPot.hand)}` : ''}</div>` : ''}
        ${st.bestHand ? `<div class="fact"><small>Beste Hand des Abends</small>${esc(st.bestHand.hand)} – ${esc(st.bestHand.name)}</div>` : ''}
      </div>`;
  } else if (panel === 'me') {
    const t = (k, label, sub = '') => `<label class="toggle"><span>${label}${sub ? `<small>${sub}</small>` : ''}</span><input type="checkbox" role="switch" data-pref="${k}" ${prefs[k] ? 'checked' : ''}></label>`;
    body.innerHTML = `<div>
      ${t('fourColor', 'Vier-Farben-Deck', 'Karo blau, Kreuz grün')}
      ${t('strength', 'Meine Hand anzeigen', S.settings.handStrength ? 'z. B. „Zwei Paare“ neben deinen Karten' : 'Der Host hat das an diesem Tisch ausgeschaltet')}
      ${t('bb', 'Beträge in Big Blinds')}
      ${t('sound', 'Töne', 'Signal, wenn du dran bist')}
      ${t('keys', 'Tastenkürzel', 'F = Fold, C = Check/Call, R = Raise')}
      ${t('calm', 'Animationen aus')}
      </div>
      <label class="field"><span>Tisch</span>
        <select data-pref="theme"><option value="classic" ${prefs.theme === 'classic' ? 'selected' : ''}>Klassisch – grüner Filz</option><option value="night" ${prefs.theme === 'night' ? 'selected' : ''}>Nacht – blauer Filz</option></select>
      </label>
      <form method="post" action="/logout" class="logout-form"><button class="btn btn-ghost" type="submit">Von dieser Seite abmelden</button></form>`;
  } else if (panel === 'host') {
    if (!S.you?.isHost) { openPanel(null); return; }
    const s = S.settings;
    const num = (k, label, min, step = 1) => `<label class="field"><span>${label}</span><input type="number" data-set="${k}" min="${min}" step="${step}" value="${s[k]}"></label>`;
    const sw = (k, label, sub = '') => `<label class="toggle"><span>${label}${sub ? `<small>${sub}</small>` : ''}</span><input type="checkbox" role="switch" data-set="${k}" ${s[k] ? 'checked' : ''}></label>`;
    const group = (id, title, inner) => `<details class="group" data-group="${id}" ${openGroups.has(id) ? 'open' : ''}><summary>${title}</summary><div class="group-body">${inner}</div></details>`;
    const tabs = [['spiel', 'Spiel'], ['regeln', 'Regeln'], ['spieler', 'Spieler']]
      .map(([id, l]) => `<button role="tab" aria-selected="${hostTab === id}" data-host-tab="${id}">${l}</button>`).join('');
    let inner = '';
    if (hostTab === 'spiel') {
      inner = `<div class="big-actions">
        ${!S.started || !S.hand ? `<button class="btn btn-brass" data-do="start">${ICON.play} Spiel starten</button>` : `
          <button class="btn ${S.frozen ? 'btn-brass' : ''}" data-do="freeze">${S.frozen ? `${ICON.play} Weiterspielen` : `${ICON.pause} Sofort für alle anhalten`}</button>
          <button class="btn" data-do="pause">${S.paused ? `${ICON.play} Weiterspielen` : 'Pause nach dieser Hand'}</button>`}
        ${S.hand?.done ? '<button class="btn" data-do="nextHand">Nächste Hand</button>' : ''}
      </div>
      <p class="hint" style="margin:0">„Sofort anhalten“ friert alles ein, auch den Zug-Timer. „Pause nach dieser Hand“ lässt die laufende Hand zu Ende spielen.</p>`;
    } else if (hostTab === 'regeln') {
      inner = `<div class="notice" role="note">Änderungen gelten ab der nächsten Hand.</div>
        ${group('blinds', 'Blinds &amp; Chips', `<div class="host-grid">
          ${num('smallBlind', 'Small Blind', 1)}
          ${num('bigBlind', 'Big Blind', 2)}
          ${num('startStack', 'Startchips / Nachkauf', 100, 100)}
          ${num('maxPlayers', 'Max. Spieler', 2)}
          <label class="field" style="grid-column:1/-1"><span>Nachkaufen</span><select data-set="rebuy">
            ${[['unlimited', 'unbegrenzt'], ['off', 'aus'], ['1', 'max. 1×'], ['2', 'max. 2×'], ['3', 'max. 3×'], ['5', 'max. 5×']].map(([v, l]) => `<option value="${v}" ${String(s.rebuy) === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select></label></div>`)}
        ${group('zeit', 'Zeit', `<div class="host-grid">
          <label class="field"><span>Zeit pro Zug</span><select data-set="turnTime">
            ${[[0, 'aus'], [15, '15 s'], [30, '30 s'], [45, '45 s'], [60, '60 s'], [90, '90 s']].map(([v, l]) => `<option value="${v}" ${s.turnTime === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select></label>
          ${num('nextDelay', 'Pause zwischen Händen (s)', 2)}</div>
          ${sw('autoNext', 'Nächste Hand automatisch starten')}`)}
        ${group('komfort', 'Komfort', sw('handStrength', 'Handanzeige erlauben', 'Spieler sehen, was sie gerade haben, und ihre Chancen'))}`;
    } else {
      const others = S.standings.filter((p) => p.id !== S.you.id);
      inner = `<div class="plist">${others.map((p) => `<div class="prow">
          <span class="mini-av">${avatarHTML(p)}</span>
          <div class="who"><b>${esc(p.name)}</b><small>${p.seated ? amt(p.chips) + ' Chips' : 'steht'}${p.connected ? '' : ' · offline'}</small></div>
          <button class="icon-btn" data-menu="${p.id}" aria-haspopup="menu" aria-expanded="${openMenu === p.id}" aria-label="Aktionen für ${esc(p.name)}">${ICON.more}</button>
          ${openMenu === p.id ? `<div class="menu" role="menu">
            <button role="menuitem" data-adjust-open="${p.id}">Chips korrigieren</button>
            <button role="menuitem" data-host-open="${p.id}">${ICON.crown} Host weitergeben</button>
            <button role="menuitem" class="danger" data-kick-open="${p.id}">Vom Tisch entfernen</button>
          </div>` : ''}
        </div>`).join('') || '<p class="hint" style="margin:0">Noch niemand sonst da.</p>'}</div>`;
    }
    body.innerHTML = `<div class="seg" role="tablist" aria-label="Host-Menü">${tabs}</div>${inner}`;
  }
}

// ---------- Eingaben ----------
function newId() { return Date.now().toString(36) + (actionSeq++).toString(36); }

async function doAction(type) {
  const L = S?.legal; if (!L) return;
  if (type === 'fold' && L.canCheck) {
    const ok = await ask({ title: 'Wirklich folden?', text: 'Du könntest kostenlos checken und bleibst trotzdem in der Hand.', ok: 'Trotzdem folden', danger: true });
    if (!ok || !S?.legal) return;
  }
  const payload = { type, id: newId() };
  if (type === 'raise') payload.amount = raiseValue;
  send('action', payload);
}

function closeMenu() {
  if (!openMenu) return;
  const id = openMenu; openMenu = null;
  renderPanel(true);
  $(`[data-menu="${id}"]`)?.focus();
}
const playerName = (id) => S.standings.find((x) => x.id === id)?.name || 'Spieler';

document.addEventListener('click', async (e) => {
  // Klick außerhalb schließt das ⋯-Menü
  if (openMenu && !e.target.closest('.menu, [data-menu]')) closeMenu();
  const t = e.target.closest('button, [data-pref], [data-set]');
  if (!t) return;
  if (t.dataset.act) doAction(t.dataset.act);
  else if (t.dataset.sit !== undefined) send('sit', { seat: Number(t.dataset.sit) });
  else if (t.dataset.preset) {
    const L = S.legal; const h = S.hand;
    if (t.dataset.preset === 'all') raiseValue = L.maxTo;
    else {
      const pot = h.pots.reduce((a, b) => a + b, 0) + h.bets + L.toCall;
      raiseValue = Math.round(h.currentBet + pot * Number(t.dataset.preset));
    }
    renderDock();
  } else if (t.dataset.react) socket.emit('react', { text: t.dataset.react });
  else if (t.dataset.hands !== undefined) toggleHands();
  else if (t.dataset.sebToggle !== undefined) { sebSmall = !sebSmall; renderSeb(); }
  else if (t.dataset.hostTab) { hostTab = t.dataset.hostTab; openMenu = null; renderPanel(true); $(`[data-host-tab="${hostTab}"]`)?.focus(); }
  else if (t.dataset.menu) {
    openMenu = openMenu === t.dataset.menu ? null : t.dataset.menu;
    renderPanel(true);
    if (openMenu) $('.menu button')?.focus(); else $(`[data-menu="${t.dataset.menu}"]`)?.focus();
  } else if (t.dataset.kickOpen) {
    const id = t.dataset.kickOpen; openMenu = null; renderPanel(true);
    const name = playerName(id);
    if (await ask({ title: `${name} entfernen?`, text: `${name} verliert Platz und Chips an diesem Tisch. Läuft gerade eine Hand, foldet ${name} zuerst.`, ok: 'Entfernen', danger: true })) send('kick', { id });
  } else if (t.dataset.adjustOpen) {
    const id = t.dataset.adjustOpen; openMenu = null; renderPanel(true);
    const p = S.standings.find((x) => x.id === id);
    const v = await ask({ title: 'Chips korrigieren', text: `Neuer Chipstand für ${p?.name || 'Spieler'}. Die Korrektur steht im Verlauf.`, ok: 'Speichern', input: { type: 'number', value: p?.chips ?? 0, label: 'Neuer Chipstand' } });
    if (v !== false) send('adjust', { id, amount: v }).then((r) => r?.ok && toast('Chips korrigiert'));
  } else if (t.dataset.hostOpen) {
    const id = t.dataset.hostOpen; openMenu = null; renderPanel(true);
    const name = playerName(id);
    if (await ask({ title: 'Host weitergeben?', text: `${name} wird Host und kann das Spiel steuern. Du bist danach normaler Spieler.`, ok: 'Weitergeben' })) send('makeHost', { id });
  } else if (t.dataset.do) {
    const map = { start: 'start', nextHand: 'nextHand', pause: 'pause', freeze: 'freeze', show: 'show', rebuy: 'rebuy', stand: 'stand' };
    if (t.dataset.do === 'sitout') send('sitOut', { value: true });
    else if (t.dataset.do === 'back') send('sitOut', { value: false });
    else send(map[t.dataset.do]);
  }
});

// Abmelden immer erst bestätigen
document.addEventListener('submit', async (e) => {
  const form = e.target;
  if (!form.matches('form[action="/logout"]') || form.dataset.confirmed) return;
  e.preventDefault();
  if (await ask({ title: 'Abmelden?', text: 'Du musst dich danach neu anmelden. Am Tisch bleibt dein Platz 5 Minuten frei.', ok: 'Abmelden', danger: true })) {
    form.dataset.confirmed = '1';
    form.submit();
  }
});
$('#panel-grip').addEventListener('click', () => openPanel(null));
document.addEventListener('toggle', (e) => {
  const g = e.target.closest?.('details[data-group]');
  if (g) { if (g.open) openGroups.add(g.dataset.group); else openGroups.delete(g.dataset.group); }
}, true);

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'raise-range' || t.id === 'raise-num') {
    raiseValue = Number(t.value) || 0;
    const other = t.id === 'raise-range' ? $('#raise-num') : $('#raise-range');
    if (other) other.value = raiseValue;
    const L = S.legal; const btn = $('#raise-btn');
    if (btn && L) {
      const v = Math.min(L.maxTo, Math.max(L.minTo, raiseValue));
      btn.innerHTML = raiseInner(v);
    }
  }
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'raise-num') { const L = S.legal; raiseValue = Math.min(L.maxTo, Math.max(L.minTo, Number(t.value) || L.minTo)); renderDock(); }
  if (t.dataset.pref) { prefs[t.dataset.pref] = t.type === 'checkbox' ? t.checked : t.value; savePrefs(); }
  if (t.dataset.set) {
    const v = t.type === 'checkbox' ? t.checked : t.tagName === 'SELECT' && t.dataset.set === 'turnTime' ? Number(t.value) : t.value;
    send('settings', { [t.dataset.set]: v }).then((r) => r?.ok && toast('Gespeichert – gilt ab der nächsten Hand'));
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#dlg').open) {
    if (openMenu) { closeMenu(); return; }
    if (handsOpen) { toggleHands(false); return; }
    if (panel) { openPanel(null); return; }
  }
  if ($('#dlg').open) return;
  if (!prefs.keys || !S?.legal || e.target.matches('input, select, textarea') || e.metaKey || e.ctrlKey) return;
  const k = e.key.toLowerCase();
  if (k === 'f') doAction('fold');
  else if (k === 'c') doAction(S.legal.canCheck ? 'check' : 'call');
  else if (k === 'r' && S.legal.canRaise) doAction('raise');
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) document.title = 'Pokerabend'; });
window.addEventListener('resize', () => render());

$('#copy-link').addEventListener('click', async () => {
  const link = `${location.origin}/?t=${S?.code || ''}`;
  try { await navigator.clipboard.writeText(link); toast('Link kopiert – schick ihn in eure Gruppe'); }
  catch { ask({ title: 'Einladungslink', text: 'Kopieren hat nicht geklappt. Markier den Link und kopier ihn selbst.', ok: 'Fertig', input: { value: link, readOnly: true, noCancel: true, label: 'Einladungslink' } }); }
});

async function boot() {
  try {
    const r = await fetch('/me', { credentials: 'same-origin' });
    if (r.status === 401) { location.href = '/login?next=' + encodeURIComponent(location.pathname + location.search); return; }
    if (r.ok) account = await r.json();
  } catch { /* offline – Socket.IO versucht es weiter */ }
  applyAccount();
  tryResume();
}
boot();
