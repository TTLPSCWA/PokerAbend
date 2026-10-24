// Pokerabend – Browser-Seite. Zeigt nur an, was der Server schickt, und sendet Wünsche zurück.
/* global io */
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const AVATARS = ['🦊', '🐻', '🐼', '🐸', '🦉', '🐯', '🐙', '🦄', '🐺', '🐧', '🦁', '🐢'];
const REACTIONS = ['👍', '😂', '😮', '😬', '🔥', '🙈', 'GG', 'Nice Hand', 'Glück gehabt', 'Respekt'];
const SUIT = { s: '♠', h: '♥', d: '♦', c: '♣' };
const STREET = { preflop: 'Pre-Flop', flop: 'Flop', turn: 'Turn', river: 'River', done: 'Hand vorbei' };

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
let clockOffset = 0;     // Server-Uhr minus Browser-Uhr
let raiseValue = null;
let raiseKey = null;
let panel = null;
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

function showLobby() {
  $('#game').hidden = true;
  $('#lobby').hidden = false;
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
function seatPositions(n = 9) {
  const narrow = matchMedia('(max-width: 640px)').matches;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (Math.PI / 2) + (i * 2 * Math.PI) / n;
    const rx = narrow ? 41 : 50, ry = narrow ? 50 : 52;
    out.push({ x: 50 + rx * Math.cos(a), y: 50 + ry * Math.sin(a), bx: 50 + rx * 0.62 * Math.cos(a), by: 50 + ry * 0.58 * Math.sin(a), a });
  }
  return out;
}
function viewIndex(seat) {
  const base = S?.you?.seat ?? 0;
  return (seat - base + 9) % 9;
}

function render() {
  if (!S || $('#game').hidden) return;
  document.documentElement.style.setProperty('--topbar', $('.topbar').offsetHeight + 'px');
  $('#room-code').textContent = S.code;
  $('#nav-host').hidden = !S.you?.isHost;
  const h = S.hand;
  const st = S.settings;
  $('#meta').innerHTML = `Blinds <b>${amt(st.smallBlind)}/${amt(st.bigBlind)}</b>${h ? ` · Hand <b>#${h.no}</b> · ${STREET[h.street]}` : ''}${S.paused ? ' · <b>Pause</b>' : ''}`;
  renderTable();
  renderDock();
  if (panel) renderPanel();
}

function renderTable() {
  const h = S.hand;
  const pos = seatPositions();
  const winning = new Set();
  const winners = new Set();
  if (h?.done && h.result) {
    for (const p of h.result.pots) { (p.cards || []).forEach((c) => winning.add(c)); p.winners.forEach((w) => winners.add(w)); }
  }

  // Pot
  const pots = h && !h.done ? h.pots : [];
  $('#pot').innerHTML = pots.map((p, i) => `<span class="pot-chip ${i ? 'side' : ''}"><span class="chip ${chipClass(p)}"></span>${amt(p)} ${pots.length > 1 ? `<small>${i ? 'Side Pot' + (pots.length > 2 ? ' ' + i : '') : 'Main Pot'}</small>` : ''}</span>`).join('');

  // Board
  const board = h?.board || [];
  const prevBoard = prevS?.hand?.no === h?.no ? prevS?.hand?.board || [] : [];
  let html = '';
  for (let i = 0; i < 5; i++) {
    const c = board[i];
    if (c) html += cardHTML(c, `${i >= prevBoard.length ? 'deal' : ''} ${h.done && winning.size ? (winning.has(c) ? 'win' : 'dim') : ''}`);
    else html += '<div class="slot"></div>';
  }
  $('#board').innerHTML = html;

  // Nachricht auf dem Filz
  let msg = '';
  if (!h || (!S.started && !h)) {
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
  S.seats.forEach((s, i) => {
    const p = pos[viewIndex(i)];
    const style = `left:${p.x}%;top:${p.y}%`;
    if (!s) {
      seatsHTML += `<div class="empty-seat" style="${style}">${!iAmSeated && seatedCount < S.settings.maxPlayers ? `<button class="sit-btn" data-sit="${i}">Hier sitzen</button>` : '<div class="empty-dot"></div>'}</div>`;
      return;
    }
    const turn = h && !h.done && h.toAct === i;
    const showing = s.cards && s.cards[0] !== '??' && i !== mySeat;
    const cls = ['seat', showing && 'showing', turn && 'turn', i === mySeat && 'me', s.folded && 'folded', (s.sittingOut || s.busted) && !s.inHand && 'out', !s.connected && 'offline'].filter(Boolean).join(' ');
    let cards = '';
    if (s.cards && i !== mySeat) cards = s.cards.map((c) => cardHTML(c, h.done && winning.size ? (winning.has(c) ? 'win' : '') : '')).join('');
    let tag = '';
    if (h?.done && winners.has(i)) tag = '<span class="p-tag hot">Gewinnt</span>';
    else if (s.allIn) tag = '<span class="p-tag allin">All-in</span>';
    else if (s.lastAction && h && !h.done) tag = `<span class="p-tag">${esc(s.lastAction)}</span>`;
    else if (!s.connected) tag = '<span class="p-tag">offline</span>';
    else if (s.busted) tag = '<span class="p-tag">pleite</span>';
    else if (s.sittingOut) tag = '<span class="p-tag">Pause</span>';
    const shownHand = `<div class="p-stack"><b>${amt(s.stack)}</b></div>${h?.done && h.result?.hands?.[i] ? `<div class="p-hand">${esc(h.result.hands[i])}</div>` : ''}`;
    seatsHTML += `<div class="${cls}" style="${style}" data-seat="${i}">
      <div class="seat-cards">${cards}</div>
      <div class="plate">
        <div class="avatar">${esc(s.avatar || '🙂')}</div>
        <div class="p-name">${esc(s.name)}${s.isHost ? '<span class="host-mark" title="Host">★</span>' : ''}</div>
        ${shownHand}
        ${tag}
        ${turn ? '<div class="timer"><i></i></div>' : ''}
      </div>
    </div>`;
    if (s.bet > 0) seatsHTML += `<div class="bet" style="left:${p.bx}%;top:${p.by}%" data-bet="${i}"><span class="chip ${chipClass(s.bet)}"></span>${amt(s.bet)}</div>`;
    if (h) {
      const badges = [];
      if (h.button === i) badges.push('<b class="badge d">D</b>');
      if (!h.done && h.sb === i && h.sb !== h.button) badges.push('<b class="badge sb">SB</b>');
      if (!h.done && h.bb === i) badges.push('<b class="badge bb">BB</b>');
      badges.forEach((b, k) => {
        const bx = 50 + (p.x - 50) * 0.78 + Math.sin(p.a) * (k ? 3.5 : 0) + (k ? 0 : Math.sin(p.a) * -3);
        const by = 50 + (p.y - 50) * 0.70 + Math.cos(p.a) * (k ? -4 : 4);
        seatsHTML += b.replace('<b ', `<b style="left:${bx}%;top:${by}%;transform:translate(-50%,-50%)" `);
      });
    }
  });
  $('#seats').innerHTML = seatsHTML;
}

function renderDock() {
  const dock = $('#dock');
  const h = S.hand;
  const mySeat = S.you?.seat;
  if (mySeat === null || mySeat === undefined) {
    dock.innerHTML = `<div class="mine"><div class="waiting">Du schaust zu. Klick auf <b>Hier sitzen</b>, um mitzuspielen.</div></div><div></div>`;
    return;
  }
  const me = S.seats[mySeat];
  const myCards = me.cards && me.cards[0] !== '??' ? me.cards : null;
  const winning = new Set();
  if (h?.done) h.result?.pots.forEach((p) => (p.cards || []).forEach((c) => winning.add(c)));
  const fresh = prevS?.hand?.no !== h?.no;
  const cardsHTML = myCards ? myCards.map((c) => cardHTML(c, `${fresh ? 'deal' : ''} ${winning.has(c) ? 'win' : ''}`)).join('') : '';
  const strength = myCards && prefs.strength && S.strength ? `<div class="strength">${esc(S.strength)}<small>${STREET[h.street]}</small></div>` : '';
  const left = `<div class="mine"><div class="cards">${cardsHTML}</div>${strength}</div>`;

  let right = '';
  const L = S.legal;
  if (L) {
    const key = `${h.no}:${h.street}:${h.currentBet}`;
    if (raiseKey !== key) { raiseKey = key; raiseValue = L.minTo; }
    raiseValue = Math.min(L.maxTo, Math.max(L.minTo, raiseValue));
    const callLabel = L.canCheck ? 'Check' : (L.toCall >= me.stack ? `All-in ${amt(L.toCall)}` : `Call ${amt(L.toCall)}`);
    const raiseLabel = (L.isBet ? 'Bet' : 'Raise auf') + ' ' + amt(raiseValue) + (raiseValue === L.maxTo ? ' (All-in)' : '');
    const kb = prefs.keys;
    right = `<div class="actions">
      ${L.canRaise && L.maxTo > L.minTo ? `<div class="raise-box">
        <div class="presets">
          <button class="btn btn-sm" data-preset="0.5">½ Pot</button>
          <button class="btn btn-sm" data-preset="0.75">¾ Pot</button>
          <button class="btn btn-sm" data-preset="1">Pot</button>
          <button class="btn btn-sm" data-preset="all">All-in</button>
        </div>
        <input type="range" id="raise-range" min="${L.minTo}" max="${L.maxTo}" step="${Math.max(1, Math.floor(S.settings.smallBlind))}" value="${raiseValue}" aria-label="Betrag">
        <input type="number" id="raise-num" min="${L.minTo}" max="${L.maxTo}" value="${raiseValue}" aria-label="Betrag eingeben">
      </div>` : ''}
      <div class="act-row">
        <button class="btn btn-red" data-act="fold" ${L.canCheck ? 'title="Du könntest auch checken"' : ''}>Fold${kb ? '<kbd>F</kbd>' : ''}</button>
        <button class="btn" data-act="${L.canCheck ? 'check' : 'call'}">${callLabel}${kb ? '<kbd>C</kbd>' : ''}</button>
        ${L.canRaise ? `<button class="btn btn-brass" data-act="raise" id="raise-btn">${raiseLabel}${kb ? '<kbd>R</kbd>' : ''}</button>` : ''}
      </div>
    </div>`;
  } else {
    const parts = [];
    if (h && !h.done && h.toAct >= 0) {
      const who = S.seats[h.toAct];
      parts.push(`<span class="waiting">${me.folded ? 'Du bist raus. ' : ''}<b>${esc(who?.name)}</b> ist dran …</span>`);
    } else if (h?.done) {
      parts.push('<span class="waiting">Hand vorbei</span>');
    }
    if (S.canShow) parts.push('<button class="btn btn-brass" data-do="show">Karten zeigen</button>');
    if (me.busted && !(h && !h.done && me.inHand && !me.folded)) {
      parts.push(S.settings.rebuy === 'off' ? '<span class="waiting">Keine Chips mehr</span>' : `<button class="btn btn-brass" data-do="rebuy">Nachkaufen (${amt(S.settings.startStack)})</button>`);
    }
    parts.push(me.sittingOut ? '<button class="btn" data-do="back">Bin wieder da</button>' : '<button class="btn" data-do="sitout">Pause</button>');
    parts.push(`<button class="btn" data-do="stand">${me.leaving ? 'Stehe nach der Hand auf' : 'Aufstehen'}</button>`);
    right = `<div class="actions"><div class="act-row">${parts.join('')}</div></div>`;
  }
  dock.innerHTML = left + right;
}

// Timer und Countdown laufen ohne komplettes Neuzeichnen
function tick() {
  if (S?.hand && !S.hand.done && S.hand.deadline && S.hand.turnTime) {
    const el = $('.seat.turn .timer');
    if (el) {
      const total = Math.max(1, S.hand.turnTime) * 1000;
      const left = S.hand.deadline - (Date.now() + clockOffset);
      const f = Math.max(0, Math.min(1, left / total));
      el.firstElementChild.style.transform = `scaleX(${f})`;
      el.classList.toggle('low', left < 8000);
    }
  } else {
    const el = $('.seat.turn .timer'); if (el) el.hidden = true;
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
    setTimeout(() => { flights.forEach(([f]) => f.remove()); potEl.classList.add('pulse'); setTimeout(() => potEl.classList.remove('pulse'), 600); }, 460);
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
          setTimeout(() => f.remove(), 600);
        }
      }, 480);
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

function renderPanel(force = false) {
  const body = $('#panel-body');
  // Formulare nicht neu zeichnen, während jemand tippt
  if (!force && (panel === 'host' || panel === 'me') && body.contains(document.activeElement) && document.activeElement.matches('input, select')) return;
  if (panel === 'log') {
    const atBottom = body.scrollTop + body.clientHeight >= body.scrollHeight - 30;
    body.innerHTML = `<div class="reacts">${REACTIONS.map((r) => `<button class="btn btn-sm" data-react="${esc(r)}">${esc(r)}</button>`).join('')}</div>
      <ul class="log">${S.log.map((l) => `<li class="${l.kind}">${esc(l.text)}</li>`).join('')}</ul>`;
    if (atBottom || force) body.scrollTop = body.scrollHeight;
  } else if (panel === 'stand') {
    const st = S.stats;
    body.innerHTML = `<table class="standings"><tbody>${S.standings.map((p) => `<tr>
        <td>${esc(p.avatar || '')} ${esc(p.name)}${p.connected ? '' : ' <small style="color:var(--muted)">offline</small>'}</td>
        <td style="color:var(--muted)">${p.rebuys ? `${p.rebuys}× nachgekauft` : ''}</td>
        <td>${amt(p.chips)}</td>
        <td class="${p.net > 0 ? 'pos' : p.net < 0 ? 'neg' : ''}">${p.net > 0 ? '+' : ''}${amt(p.net)}</td></tr>`).join('')}</tbody></table>
      <div class="facts">
        <div class="fact"><small>Gespielte Hände</small>${st.hands}</div>
        ${st.biggestPot ? `<div class="fact"><small>Größter Pot</small>${amt(st.biggestPot.amount)} – ${esc(st.biggestPot.name)}${st.biggestPot.hand ? ` mit ${esc(st.biggestPot.hand)}` : ''}</div>` : ''}
        ${st.bestHand ? `<div class="fact"><small>Beste Hand des Abends</small>${esc(st.bestHand.hand)} – ${esc(st.bestHand.name)}</div>` : ''}
      </div>`;
  } else if (panel === 'me') {
    const t = (k, label, sub = '') => `<label class="toggle"><span>${label}${sub ? `<small>${sub}</small>` : ''}</span><input type="checkbox" data-pref="${k}" ${prefs[k] ? 'checked' : ''}></label>`;
    body.innerHTML = `<div>
      ${t('fourColor', 'Vier-Farben-Deck', 'Karo blau, Kreuz grün')}
      ${t('strength', 'Meine Hand anzeigen', S.settings.handStrength ? 'z. B. „Zwei Paare“ unter deinen Karten' : 'Der Host hat das an diesem Tisch ausgeschaltet')}
      ${t('bb', 'Beträge in Big Blinds')}
      ${t('sound', 'Töne', 'Signal, wenn du dran bist')}
      ${t('keys', 'Tastenkürzel', 'F = Fold, C = Check/Call, R = Raise')}
      ${t('calm', 'Animationen aus')}
      </div>
      <label class="field"><span>Tisch</span>
        <select data-pref="theme"><option value="classic" ${prefs.theme === 'classic' ? 'selected' : ''}>Klassisch – grüner Filz</option><option value="night" ${prefs.theme === 'night' ? 'selected' : ''}>Nacht – blauer Filz</option></select>
      </label>
      <form method="post" action="/logout"><button class="btn btn-sm" type="submit">Von dieser Seite abmelden</button></form>`;
  } else if (panel === 'host') {
    if (!S.you?.isHost) { openPanel(null); return; }
    const s = S.settings;
    const num = (k, label, min, step = 1) => `<label class="field"><span>${label}</span><input type="number" data-set="${k}" min="${min}" step="${step}" value="${s[k]}"></label>`;
    body.innerHTML = `<div class="host-actions">
        ${!S.started || !S.hand ? '<button class="btn btn-brass" data-do="start">Spiel starten</button>' : `<button class="btn" data-do="pause">${S.paused ? 'Weiterspielen' : 'Pause nach der Hand'}</button>`}
        ${S.hand?.done ? '<button class="btn" data-do="nextHand">Nächste Hand</button>' : ''}
      </div>
      <h3>Tischregeln</h3>
      <div class="host-grid">
        ${num('smallBlind', 'Small Blind', 1)}
        ${num('bigBlind', 'Big Blind', 2)}
        ${num('startStack', 'Startchips / Nachkauf', 100, 100)}
        <label class="field"><span>Nachkaufen</span><select data-set="rebuy">
          ${[['unlimited', 'unbegrenzt'], ['off', 'aus'], ['1', 'max. 1×'], ['2', 'max. 2×'], ['3', 'max. 3×'], ['5', 'max. 5×']].map(([v, l]) => `<option value="${v}" ${String(s.rebuy) === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></label>
        <label class="field"><span>Zeit pro Zug</span><select data-set="turnTime">
          ${[[0, 'aus'], [15, '15 s'], [30, '30 s'], [45, '45 s'], [60, '60 s'], [90, '90 s']].map(([v, l]) => `<option value="${v}" ${s.turnTime === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></label>
        ${num('nextDelay', 'Pause zwischen Händen (s)', 2)}
        ${num('maxPlayers', 'Max. Spieler', 2)}
      </div>
      <div>
        <label class="toggle"><span>Nächste Hand automatisch starten</span><input type="checkbox" data-set="autoNext" ${s.autoNext ? 'checked' : ''}></label>
        <label class="toggle"><span>Handanzeige erlauben<small>Spieler sehen, was sie gerade haben</small></span><input type="checkbox" data-set="handStrength" ${s.handStrength ? 'checked' : ''}></label>
      </div>
      <p class="hint" style="margin:0;color:var(--muted)">Änderungen gelten ab der nächsten Hand.</p>
      <h3>Spieler</h3>
      <div class="plist">${S.standings.filter((p) => p.id !== S.you.id).map((p) => `<div class="prow">
          <div>${esc(p.avatar || '')} ${esc(p.name)} <small style="color:var(--muted)">${p.seated ? amt(p.chips) : 'steht'}${p.connected ? '' : ' · offline'}</small></div>
          <div class="tools">
            <button class="btn btn-sm" data-host="${p.id}" title="Zum Host machen">Host</button>
            <button class="btn btn-sm btn-red" data-kick="${p.id}" title="Vom Tisch nehmen">Entfernen</button>
          </div>
          <div class="tools" style="grid-column:1/-1">
            <input type="number" min="0" value="${p.chips}" data-adjust-input="${p.id}" aria-label="Chips von ${esc(p.name)}">
            <button class="btn btn-sm" data-adjust="${p.id}">Chips korrigieren</button>
          </div>
        </div>`).join('') || '<p class="hint" style="margin:0;color:var(--muted)">Noch niemand sonst da.</p>'}</div>`;
  }
}

// ---------- Eingaben ----------
function newId() { return Date.now().toString(36) + (actionSeq++).toString(36); }

function doAction(type) {
  const L = S?.legal; if (!L) return;
  if (type === 'fold' && L.canCheck && !confirm('Du könntest kostenlos checken. Trotzdem folden?')) return;
  const payload = { type, id: newId() };
  if (type === 'raise') payload.amount = raiseValue;
  send('action', payload);
}

document.addEventListener('click', (e) => {
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
  else if (t.dataset.kick) { const p = S.standings.find((x) => x.id === t.dataset.kick); if (confirm(`${p?.name} wirklich vom Tisch nehmen?`)) send('kick', { id: t.dataset.kick }); }
  else if (t.dataset.host) send('makeHost', { id: t.dataset.host });
  else if (t.dataset.adjust) send('adjust', { id: t.dataset.adjust, amount: $(`[data-adjust-input="${t.dataset.adjust}"]`).value }).then((r) => r?.ok && toast('Chips korrigiert'));
  else if (t.dataset.do) {
    const map = { start: 'start', nextHand: 'nextHand', pause: 'pause', show: 'show', rebuy: 'rebuy', stand: 'stand' };
    if (t.dataset.do === 'sitout') send('sitOut', { value: true });
    else if (t.dataset.do === 'back') send('sitOut', { value: false });
    else send(map[t.dataset.do]);
  }
});

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'raise-range' || t.id === 'raise-num') {
    raiseValue = Number(t.value) || 0;
    const other = t.id === 'raise-range' ? $('#raise-num') : $('#raise-range');
    if (other) other.value = raiseValue;
    const L = S.legal; const btn = $('#raise-btn');
    if (btn && L) {
      const v = Math.min(L.maxTo, Math.max(L.minTo, raiseValue));
      btn.innerHTML = (L.isBet ? 'Bet' : 'Raise auf') + ' ' + amt(v) + (v === L.maxTo ? ' (All-in)' : '') + (prefs.keys ? '<kbd>R</kbd>' : '');
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
  catch { prompt('Einladungslink:', link); }
});

tryResume();
