// Startseite (Hub) von Spieleabend: Profil, Navigation per URL-Hash, Seiten, Hosten. Läuft nach /core.js.
// Seiten: #start · #spiele · #spiele/karten|wuerfel|brett|party · #favoriten · #tische · #bestenliste
// Name und Avatar werden einmal festgelegt (localStorage, gleiche Schlüssel wie früher) und überall verwendet.
'use strict';

// ---------- Profil ----------
const profile = {
  get name() { return String(store.get('poker:name', '') || '').trim().slice(0, 16); },
  get avatar() { const a = store.get('poker:avatar', null); return AVATARS.includes(a) ? a : AVATARS[0]; },
  save(name, avatarChoice) { store.set('poker:name', name); store.set('poker:avatar', avatarChoice); },
};

function renderProfileChip() {
  const chip = $('#profile-chip');
  if (chip) {
    chip.innerHTML = `<span class="chip-av" aria-hidden="true">${esc(profile.avatar)}</span><span class="chip-txt"><b>${esc(profile.name || 'Profil anlegen')}</b><small>Profil ändern</small></span>`;
    chip.setAttribute('aria-label', profile.name ? `Profil ändern, du bist ${profile.name}` : 'Profil anlegen');
  }
  const av = $('#profile-avatar');
  if (av) { av.textContent = profile.avatar; av.setAttribute('aria-label', profile.name ? `Profil ändern, du bist ${profile.name}` : 'Profil anlegen'); }
}

// first = allererster Besuch: der Dialog lässt sich nicht wegklicken, bis ein Name da ist
let profileChoice = null;
function openProfile(first = false) {
  const d = $('#profile-dlg');
  if (d.open) return;
  profileChoice = profile.name ? profile.avatar : AVATARS[Math.floor(Math.random() * AVATARS.length)];
  $('#profile-title').textContent = first ? 'Wie heißt du?' : 'Profil ändern';
  $('#p-name').value = profile.name;
  $('#p-error').textContent = '';
  $('#p-cancel').hidden = first;
  d.dataset.first = first ? '1' : '';
  $('#p-avatars').innerHTML = AVATARS.map((a) => `<button type="button" class="avatar-opt" data-a="${a}" aria-pressed="${a === profileChoice}" aria-label="Avatar ${a}">${a}</button>`).join('');
  d.showModal();
  $('#p-name').focus();
}
$('#p-avatars').addEventListener('click', (e) => {
  const b = e.target.closest('.avatar-opt'); if (!b) return;
  profileChoice = b.dataset.a;
  $$('#p-avatars .avatar-opt').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
});
$('#profile-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('#p-name').value.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim().slice(0, 16);
  if (!name) { $('#p-error').textContent = 'Bitte gib einen Namen ein.'; $('#p-name').focus(); return; }
  profile.save(name, profileChoice);
  $('#profile-dlg').close();
  renderProfileChip();
  if (hubVisible()) renderHub();
});
$('#p-cancel').addEventListener('click', () => $('#profile-dlg').close());
$('#profile-dlg').addEventListener('cancel', (e) => { if ($('#profile-dlg').dataset.first) e.preventDefault(); }); // Esc
$('#profile-chip').addEventListener('click', () => openProfile(false));
$('#profile-avatar').addEventListener('click', () => openProfile(false));

// ---------- Beitreten ----------
// Ist der Name am Tisch schon vergeben, schlägt der Server einen freien vor („Tobi 2“) – wir nehmen ihn und sagen es.
function joinTable(code) {
  const c = String(code || '').trim().toUpperCase();
  const token = store.get('poker:session:' + c, null);
  return new Promise((resolve) => {
    socket.emit('join', { code: c, name: profile.name, avatar: profile.avatar, token }, (r) => {
      if (r && r.ok === false && r.suggestion) {
        toast(`„${profile.name}“ ist an diesem Tisch schon vergeben – du spielst hier als „${r.suggestion}“`);
        socket.emit('join', { code: c, name: r.suggestion, avatar: profile.avatar, token: null }, resolve);
      } else resolve(r);
    });
  });
}
// Beitritt per Klick oder Code: bei Erfolg an den Tisch, sonst eine Meldung
async function joinAndEnter(code, mode = '') {
  if (!profile.name) { openProfile(true); return false; }
  const r = await joinTable(code);
  if (!r?.ok) { toast(r?.error || 'Verbindung fehlgeschlagen', true); return false; }
  inviteCode = '';
  if (mode === 'sit') {
    // Poker braucht einen bestimmten Platz – den sucht man am Tisch aus
    if (r.game === 'poker') toast('Such dir am Tisch einen freien Platz aus');
    else socket.emit('sit', {}, (s) => { if (!s?.ok) toast(s?.error || 'Der Platz ist leider schon weg – du schaust zu', true); });
  }
  enterGame(r);
  return true;
}

// ---------- Seiten und Navigation ----------
let inviteCode = (params.get('t') || '').toUpperCase(); // Link von außen: einmal anbieten
const GAME_CATEGORIES = [['karten', 'Kartenspiele'], ['wuerfel', 'Würfelspiele'], ['brett', 'Brettspiele'], ['party', 'Party']]; // wie games/index.js
const hubVisible = () => !$('#hub').hidden;
const ico = (d) => `<svg class="hub-ico" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const ICONS = {
  start: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/>',
  tische: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14c3 0 4.5 2 4.5 5"/>',
  favoriten: '<path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
  bestenliste: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4v1a4 4 0 0 0 4 4"/><path d="M16 6h4v1a4 4 0 0 1-4 4"/><path d="M12 13v4M8 20h8"/>',
  spiele: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  karten: '<rect x="4" y="6" width="11" height="14" rx="2"/><path d="M9 3.5h8a2 2 0 0 1 2 2V16"/>',
  wuerfel: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/><circle cx="9" cy="15" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/>',
  brett: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17"/>',
  party: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
};
const PAGES = ['start', 'spiele', 'favoriten', 'tische', 'bestenliste'];
let route = { page: 'start', sub: '' };
function parseRoute() {
  const [p = 'start', s = ''] = location.hash.replace(/^#/, '').split('/');
  const page = PAGES.includes(p) ? p : 'start';
  return { page, sub: page === 'spiele' && GAME_CATEGORIES.some(([id]) => id === s) ? s : '' };
}
const hashOf = (page, sub = '') => `#${page}${sub ? '/' + sub : ''}`;
let hubTables = [];                      // offene Tische (vom Server, siehe Teil H3)
const openTableCount = () => hubTables.length;

function navHTML() {
  const cur = hashOf(route.page, route.sub);
  const item = (href, key, label, extra = '') => `<a class="nav-item" href="${href}" ${cur === href ? 'aria-current="page"' : ''}>${ico(ICONS[key])}<span class="side-label">${label}</span>${extra}</a>`;
  const n = openTableCount();
  const badge = n ? `<span class="badge" aria-label="${n} offene${n === 1 ? 'r' : ''} Tisch${n === 1 ? '' : 'e'}">${n}</span>` : '';
  const games = account.games || [];
  return `${item('#start', 'start', 'Start')}${item('#tische', 'tische', 'Offene Tische', badge)}${item('#favoriten', 'favoriten', 'Favoriten')}${item('#bestenliste', 'bestenliste', 'Bestenliste')}
    <h2 class="side-title side-label">Spiele</h2>
    ${GAME_CATEGORIES.map(([id, title]) => item(`#spiele/${id}`, id, title, `<span class="count side-label" aria-label="${games.filter((g) => (g.category || 'karten') === id).length} Spiele">${games.filter((g) => (g.category || 'karten') === id).length}</span>`)).join('')}`;
}
function tabbarHTML() {
  const cur = route.page;
  const tab = (href, key, label, on, extra = '') => `<a class="tab-item" href="${href}" ${on ? 'aria-current="page"' : ''}>${ico(ICONS[key])}<span>${label}</span>${extra}</a>`;
  const n = openTableCount();
  return tab('#start', 'start', 'Start', cur === 'start') + tab('#spiele', 'spiele', 'Spiele', cur === 'spiele' || cur === 'favoriten')
    + tab('#tische', 'tische', 'Tische', cur === 'tische', n ? `<span class="badge" aria-label="${n} offen">${n}</span>` : '') + tab('#bestenliste', 'bestenliste', 'Bestenliste', cur === 'bestenliste');
}

const TITLES = { start: 'Start', spiele: 'Spiele', favoriten: 'Favoriten', tische: 'Offene Tische', bestenliste: 'Bestenliste' };
let renderedPage = null;
function renderHub(focus = false) {
  route = parseRoute();
  $('#side-nav').innerHTML = navHTML();
  $('#hub-tabbar').innerHTML = tabbarHTML();
  const page = { start: pageStart, spiele: pageGames, favoriten: pageGames, tische: pageTables, bestenliste: pageBoard }[route.page];
  const main = $('#hub-main');
  const scroll = main.scrollTop;
  main.innerHTML = page();
  document.title = `${TITLES[route.page]} – Spieleabend`;
  if (focus || renderedPage !== route.page + route.sub) { main.focus({ preventScroll: true }); scrollTo(0, 0); } else main.scrollTop = scroll;
  renderedPage = route.page + route.sub;
  afterPage?.();
}
let afterPage = null;
window.addEventListener('hashchange', () => { if (hubVisible()) renderHub(true); });

function showLobby(error = '') {
  $('#game-root').hidden = true;
  $('#hub').hidden = false;
  if (error) toast(error, true);
  if (location.search) history.replaceState(null, '', location.pathname + location.hash); // ?t=CODE gehört zum Tisch, nicht zur Startseite
  renderProfileChip();
  if (!profile.name) openProfile(true); // allererster Besuch
  renderHub();
}

// ---------- Hosten (Seitenpanel bzw. Leiste von unten) ----------
function openHost(id) {
  const g = (account.games || []).find((x) => x.id === id);
  if (!g) return;
  if (!profile.name) { openProfile(true); return; }
  const d = $('#host-dlg');
  d.innerHTML = `<form id="host-form" autocomplete="off">
      <button type="button" class="host-close" data-host-close aria-label="Schließen">✕</button>
      <div class="host-art cat-${esc(g.category)}">${g.art}</div>
      <div><h2 id="host-title">${esc(g.name)} hosten</h2>
      <p class="host-meta">${esc(catTitle(g.category))} · ${esc(playersText(g))} · ca. ${g.duration} Min.</p></div>
      <p>${esc(g.description)}</p>
      ${(g.createFields || []).length ? `<div class="host-fields">${g.createFields.map((f) => `<label class="field"><span>${esc(f.label)}</span>
        <input data-cf="${esc(f.key)}" type="${f.type === 'number' ? 'number' : 'text'}" ${f.min !== undefined ? `min="${f.min}"` : ''} ${f.step ? `step="${f.step}"` : ''} value="${esc(f.value)}"></label>`).join('')}</div>` : ''}
      <p class="hint">Alles Weitere stellst du am Tisch unter „Host“ ein.</p>
      <p id="host-error" class="error" role="alert"></p>
      <button class="btn btn-brass btn-big" type="submit">Tisch erstellen</button>
    </form>`;
  d.dataset.game = id;
  d.showModal();
  d.querySelector('input, button.btn-brass')?.focus();
}
$('#host-dlg').addEventListener('click', (e) => { if (e.target === $('#host-dlg') || e.target.closest('[data-host-close]')) $('#host-dlg').close(); });
$('#host-dlg').addEventListener('submit', (e) => {
  e.preventDefault();
  const d = $('#host-dlg');
  const settings = Object.fromEntries($$('[data-cf]', d).map((el) => [el.dataset.cf, el.value]));
  socket.emit('create', { game: d.dataset.game, name: profile.name, avatar: profile.avatar, settings }, (r) => {
    if (!r?.ok) { $('#host-error').textContent = r?.error || 'Verbindung fehlgeschlagen'; return; }
    d.close();
    enterGame(r);
  });
});

// ---------- Seiten (werden in den nächsten Teilen gefüllt) ----------
function pageStart() {
  loadResume();
  return `<section class="hub-head"><h1>Hallo ${esc(profile.name)} <span aria-hidden="true">${esc(profile.avatar)}</span></h1><p>Setz dich an einen offenen Tisch oder mach selbst einen auf.</p></section>
    ${inviteHTML()}
    <section class="hub-block"><div class="hub-block-head"><h2>Offene Tische</h2></div><div data-tables="4">${tablesBlockHTML(4)}</div></section>
    ${gamesPreviewHTML()}
    ${codeBoxHTML()}
    <p class="hub-foot">Ohne Benutzerkonto. Nur Spielgeld, kein Echtgeld.</p>`;
}
// ---------- Spieleliste ----------
// Favoriten, „zuletzt gespielt“ und die Ansicht liegen nur in diesem Browser.
const favs = () => new Set(store.get('poker:favs', []));
const recent = () => store.get('poker:recent', {}) || {};
function markPlayed(id) { const r = recent(); r[id] = Date.now(); store.set('poker:recent', r); }
function toggleFav(id) { const f = favs(); f.has(id) ? f.delete(id) : f.add(id); store.set('poker:favs', [...f]); }
let gamesFilter = 'all';   // all | fav | p2 | p34 | p56 | p7 | short
let gamesQuery = '';
let gamesView = store.get('poker:view', 'list') === 'tiles' ? 'tiles' : 'list';
const CHIPS = [['all', 'Alle'], ['fav', '★ Favoriten'], ['p2', '2 Spieler'], ['p34', '3–4 Spieler'], ['p56', '5–6 Spieler'], ['p7', '7+ Spieler'], ['short', 'Kurz (< 15 Min.)']];
const RANGES = { p2: [2, 2], p34: [3, 4], p56: [5, 6], p7: [7, 99] };
const SEARCH_FROM = 20; // Suche ab so vielen Spielen
const catTitle = (id) => (GAME_CATEGORIES.find(([c]) => c === id) || [, ''])[1];
const allGames = () => [...(account.games || []), ...(account.planned || []).map((p) => ({ ...p, planned: true }))];
const playersText = (g) => (g.minPlayers === g.maxPlayers ? `${g.maxPlayers} Spieler` : `${g.minPlayers}–${g.maxPlayers} Spieler`);

// Sortierung: Favoriten zuerst, dann zuletzt gespielt, dann alphabetisch; Geplantes ans Ende
function sortGames(list) {
  const f = favs(), r = recent();
  return [...list].sort((a, b) => (a.planned ? 1 : 0) - (b.planned ? 1 : 0) || f.has(b.id) - f.has(a.id) || (r[b.id] || 0) - (r[a.id] || 0) || a.name.localeCompare(b.name, 'de'));
}
function visibleGames() {
  const f = favs();
  const filter = route.page === 'favoriten' ? 'fav' : gamesFilter;
  const q = gamesQuery.trim().toLowerCase();
  return sortGames(allGames().filter((g) => {
    if (route.sub && (g.category || 'karten') !== route.sub) return false;
    if (filter === 'fav') return !g.planned && f.has(g.id);
    if (RANGES[filter]) return g.minPlayers <= RANGES[filter][1] && g.maxPlayers >= RANGES[filter][0];
    if (filter === 'short') return g.duration < 15;
    return true;
  }).filter((g) => !q || g.name.toLowerCase().includes(q) || (g.description || '').toLowerCase().includes(q)));
}
function gameHTML(g, tiles) {
  const fav = favs().has(g.id);
  const meta = `${catTitle(g.category)} · ${playersText(g)} · ${g.duration} Min.`;
  const star = g.planned ? '' : `<button type="button" class="star" data-fav="${esc(g.id)}" aria-pressed="${fav}" aria-label="${esc(g.name)} ${fav ? 'aus den Favoriten nehmen' : 'zu den Favoriten'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/></svg></button>`;
  const action = g.planned ? '<span class="soon">In Planung</span>' : `<button type="button" class="btn btn-brass" data-host="${esc(g.id)}" aria-label="${esc(g.name)} hosten">Hosten</button>`;
  return `<li class="game-${tiles ? 'tile' : 'row'} cat-${esc(g.category)}${g.planned ? ' planned' : ''}" ${g.planned ? 'aria-disabled="true"' : ''}>
      <div class="ga">${g.art}</div>
      <div class="gr-main"><b>${esc(g.name)}${fav ? ' <span class="fav-mark" aria-label="Favorit">★</span>' : ''}</b><small>${esc(meta)}</small><span class="gr-desc">${esc(g.description)}</span></div>
      <div class="gr-actions">${star}${action}</div></li>`;
}
function gamesToolbarHTML() {
  const filter = route.page === 'favoriten' ? 'fav' : gamesFilter;
  const chips = CHIPS.filter(([id]) => route.page !== 'favoriten' || id !== 'fav').map(([id, label]) => `<button type="button" class="chip" data-chip="${id}" aria-pressed="${filter === id}">${label}</button>`).join('');
  return `<div class="chips" role="group" aria-label="Filter">${chips}</div>
    <div class="view-toggle" role="group" aria-label="Ansicht"><button type="button" data-view="list" aria-pressed="${gamesView === 'list'}">Liste</button><button type="button" data-view="tiles" aria-pressed="${gamesView === 'tiles'}">Kacheln</button></div>`;
}
function gamesBodyHTML() {
  const list = visibleGames();
  if (!list.length) return `<p class="hint">${route.page === 'favoriten' ? 'Noch keine Favoriten – tipp bei einem Spiel auf den Stern.' : 'Dazu gibt es kein Spiel. Probier einen anderen Filter.'}</p>`;
  return `<ul class="games ${gamesView === 'tiles' ? 'tiles' : 'rows'}">${list.map((g) => gameHTML(g, gamesView === 'tiles')).join('')}</ul>`;
}
function pageGames() {
  const title = route.page === 'favoriten' ? 'Favoriten' : route.sub ? catTitle(route.sub) : 'Alle Spiele';
  const search = allGames().length >= SEARCH_FROM ? `<label class="search"><span class="sr-only">Spiel suchen</span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input id="games-search" type="search" placeholder="Spiel suchen" value="${esc(gamesQuery)}" autocomplete="off"></label>` : '';
  return `<section class="hub-head"><h1>${esc(title)}</h1><p>Such dir ein Spiel aus und mach einen Tisch auf – die anderen kommen per Link oder Code dazu.</p></section>
    <div class="games-tools"><div id="games-toolbar" class="toolbar">${gamesToolbarHTML()}</div>${search}</div>
    <div id="games-body">${gamesBodyHTML()}</div>`;
}
function refreshGames() { $('#games-toolbar').innerHTML = gamesToolbarHTML(); $('#games-body').innerHTML = gamesBodyHTML(); }
// Start: die ersten Spiele (Favoriten, zuletzt gespielt) als Kacheln
function gamesPreviewHTML() {
  const list = sortGames(allGames().filter((g) => !g.planned)).slice(0, 6);
  return `<section class="hub-block"><div class="hub-block-head"><h2>Deine Spiele</h2></div><ul class="games tiles">${list.map((g) => gameHTML(g, true)).join('')}</ul><p class="more"><a href="#spiele">Alle Spiele ansehen</a></p></section>`;
}
function pageTables() {
  loadResume();
  return `<section class="hub-head"><h1>Offene Tische</h1><p>Alle Tische, an die du dich setzen oder bei denen du zuschauen kannst – live aktuell.</p></section>
    <section class="hub-block"><div data-tables="0">${tablesBlockHTML(0)}</div></section>${codeBoxHTML()}`;
}
// ---------- Bestenliste (Seite) ----------
// Filter nach Spiel und Monat; Daten wie im Dialog am Tisch (/api/leaderboard). Das Spiel wird gemerkt.
let boardGame = store.get('poker:boardgame', 'poker');
let boardPeriod = 'all';
let boardToken = 0;
function pageBoard() {
  loadBoard();
  return `<section class="hub-head"><h1>Bestenliste</h1><p>Alle Abende, nach Siegen sortiert. Wiedererkannt wird man am Namen.</p></section><div id="board-body" class="board" aria-live="polite"><p class="hint">Lade …</p></div>`;
}
async function loadBoard() {
  const token = ++boardToken;
  const r = await fetchLeaderboard(boardGame, boardPeriod);
  if (!r || token !== boardToken || route.page !== 'bestenliste' || !$('#board-body')) return;
  boardGame = r.game; boardPeriod = r.period;
  store.set('poker:boardgame', boardGame);
  $('#board-body').innerHTML = leaderboardInner(r, 'lbp');
}
document.addEventListener('change', (e) => {
  if (!e.target.matches('[data-lbp]')) return;
  boardGame = $('#lbp-game').value; boardPeriod = $('#lbp-period').value;
  loadBoard();
});

// Code von außen eintippen
function codeBoxHTML() {
  return `<section class="hub-block code-box"><h2>Du hast einen Code?</h2>
    <form id="code-form" class="code-form" autocomplete="off"><label class="sr-only" for="code-in">Tisch-Code</label>
      <input id="code-in" class="code-input" maxlength="5" placeholder="ABCDE" autocapitalize="characters" spellcheck="false">
      <button class="btn btn-brass" type="submit">Beitreten</button></form></section>`;
}

// ---------- Klicks ----------
document.addEventListener('submit', (e) => {
  if (e.target.id !== 'code-form') return;
  e.preventDefault();
  const code = $('#code-in').value.trim().toUpperCase();
  if (!code) { toast('Gib erst einen Code ein', true); return; }
  joinAndEnter(code);
});
document.addEventListener('click', (e) => {
  if (!hubVisible()) return;
  const host = e.target.closest('[data-host]');
  if (host) { openHost(host.dataset.host); return; }
  const fav = e.target.closest('[data-fav]');
  if (fav) { toggleFav(fav.dataset.fav); route.page === 'start' ? renderHub() : refreshGames(); $$('[data-fav]').find((x) => x.dataset.fav === fav.dataset.fav)?.focus({ preventScroll: true }); return; }
  const chip = e.target.closest('[data-chip]');
  if (chip) { gamesFilter = chip.dataset.chip; refreshGames(); $$('[data-chip]').find((x) => x.dataset.chip === gamesFilter)?.focus({ preventScroll: true }); return; }
  const view = e.target.closest('[data-view]');
  if (view) { gamesView = view.dataset.view; store.set('poker:view', gamesView); refreshGames(); $$('[data-view]').find((x) => x.dataset.view === gamesView)?.focus({ preventScroll: true }); return; }
  const join = e.target.closest('[data-join]');
  if (join) { joinAndEnter(join.dataset.join, join.dataset.mode || ''); return; }
  if (e.target.closest('[data-invite-join]')) { joinAndEnter(inviteCode); return; }
  if (e.target.closest('[data-invite-dismiss]')) { inviteCode = ''; renderHub(); }
});

// ---------- Offene Tische ----------
// Der Server schickt die Liste (ohne Geheimes) und meldet Änderungen höchstens einmal pro Sekunde.
const CAT_NAME = { karten: 'Kartenspiel', wuerfel: 'Würfelspiel', brett: 'Brettspiel', party: 'Partyspiel' };
let hubResume = [];     // meine eigenen Tische (Token im Browser) – stehen ganz vorne
let resumeAt = 0;
function subscribeLobby() { socket.emit('lobby', {}, (r) => { if (r?.ok) { hubTables = r.tables; refreshTables(); } }); }
socket.on('connect', subscribeLobby);
if (socket.connected) subscribeLobby();
socket.on('lobby', (list) => { hubTables = list; refreshTables(); });

function tableCardHTML(t, mine = false) {
  const free = t.max - t.seats.length;
  const seats = t.seats.map((s) => `<li class="tc-seat"><span class="tc-av" aria-hidden="true">${esc(s.avatar || '🙂')}</span>${esc(s.name)}${s.bot ? ' <small>(Computer)</small>' : ''}</li>`).join('');
  const actions = mine ? `<button type="button" class="btn btn-brass" data-join="${esc(t.code)}">Zurück an den Tisch</button>`
    : free > 0 ? `<button type="button" class="btn btn-brass" data-join="${esc(t.code)}" data-mode="sit">Dazusetzen</button><button type="button" class="btn btn-ghost" data-join="${esc(t.code)}" data-mode="watch">Zuschauen</button>`
      : `<button type="button" class="btn btn-brass" data-join="${esc(t.code)}" data-mode="watch">Zuschauen</button>`;
  return `<article class="table-card cat-${esc(t.category)}${mine ? ' mine' : ''}" aria-label="${esc(t.gameName)}, Tisch ${esc(t.code)}">
      <header><span class="tc-cat">${mine ? 'Dein Tisch' : esc(CAT_NAME[t.category] || '')}</span><span class="tc-code">${esc(t.code)}</span></header>
      <h3>${esc(t.gameName)}</h3>
      <p class="tc-host">Host: ${esc(t.host?.avatar || '')} ${esc(t.host?.name || '?')}</p>
      <ul class="tc-seats" aria-label="Am Tisch">${seats || '<li class="tc-empty">Noch niemand sitzt</li>'}</ul>
      <p class="tc-meta"><b>${t.seats.length} von ${t.max}</b> Plätzen belegt · ${esc(t.status)}${t.watchers ? ` · ${t.watchers} schau${t.watchers === 1 ? 't' : 'en'} zu` : ''}</p>
      <div class="tc-actions">${actions}</div></article>`;
}
// limit 0 = alle
function tablesBlockHTML(limit) {
  const mine = new Set(hubResume.map((t) => t.code));
  const list = hubTables.filter((t) => !mine.has(t.code));
  const cards = [...hubResume.map((t) => tableCardHTML(t, true)), ...(limit ? list.slice(0, limit) : list).map((t) => tableCardHTML(t))];
  if (!cards.length) return `<div class="empty-tables"><p><b>Gerade spielt niemand.</b> Mach doch einen Tisch auf!</p><a class="btn btn-brass" href="#spiele">Tisch aufmachen</a></div>`;
  const more = limit && list.length > limit ? `<p class="more"><a href="#tische">Alle ${list.length} offenen Tische ansehen</a></p>` : '';
  return `<div class="table-grid">${cards.join('')}<a class="table-card table-new" href="#spiele"><span class="plus" aria-hidden="true">+</span><b>Neuen Tisch aufmachen</b></a></div>${more}`;
}
// Nur die Tisch-Bereiche und Zähler neu zeichnen, damit Eingaben (Code) und Fokus erhalten bleiben
let shownCount = -1;
function refreshTables() {
  if (!hubVisible()) return;
  const slots = $$('[data-tables]');
  const focused = document.activeElement?.closest?.('[data-tables]') ? document.activeElement.dataset.join + '|' + (document.activeElement.dataset.mode || '') : '';
  slots.forEach((el) => { el.innerHTML = tablesBlockHTML(Number(el.dataset.tables)); });
  if (focused) $$('[data-join]').find((b) => b.dataset.join + '|' + (b.dataset.mode || '') === focused)?.focus({ preventScroll: true });
  if (hubTables.length !== shownCount) { shownCount = hubTables.length; $('#side-nav').innerHTML = navHTML(); $('#hub-tabbar').innerHTML = tabbarHTML(); }
}
// „Weiterspielen“: Tische, für die dieser Browser ein Token hat und die es noch gibt (private eingeschlossen)
async function loadResume() {
  if (Date.now() - resumeAt < 5000) return;
  resumeAt = Date.now();
  const codes = [];
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith('poker:session:')) codes.push(k.slice('poker:session:'.length)); } } catch { /* privater Modus */ }
  const last = store.get('poker:last', null);
  codes.sort((a, b) => (b === last) - (a === last));
  const found = [];
  for (const code of codes.slice(0, 5)) {
    const token = store.get('poker:session:' + code, null);
    if (!token) continue;
    const r = await new Promise((res) => socket.emit('peek', { code, token }, res));
    if (r?.ok && r.found) found.push(r);
    else if (r?.ok) store.set('poker:session:' + code, null); // den Tisch gibt es nicht mehr
  }
  hubResume = found;
  refreshTables();
}
// Einladung per Link (?t=CODE): erst fragen, dann beitreten
function inviteHTML() {
  return inviteCode ? `<section class="invite" aria-label="Einladung"><div><b>Einladung zu Tisch ${esc(inviteCode)}</b><p>Mit deinem Profil beitreten (${esc(profile.avatar)} ${esc(profile.name)})?</p></div>
    <div class="invite-actions"><button type="button" class="btn btn-brass" data-invite-join>Beitreten</button><button type="button" class="btn btn-ghost" data-invite-dismiss>Nein danke</button></div></section>` : '';
}

// Suche in der Spieleliste (ab 20 Spielen sichtbar)
document.addEventListener('input', (e) => {
  if (e.target.id !== 'games-search') return;
  gamesQuery = e.target.value;
  $('#games-body').innerHTML = gamesBodyHTML();
});

// Tablet: Seitenleiste ein-/ausklappen (nur Symbole ↔ mit Text), Wahl wird gemerkt
function syncSideToggle() {
  const open = $('#hub').classList.contains('side-open');
  $('#side-toggle').setAttribute('aria-expanded', String(open));
  $('#side-toggle').setAttribute('aria-label', open ? 'Seitenleiste einklappen' : 'Seitenleiste ausklappen');
}
$('#hub').classList.toggle('side-open', store.get('poker:sidebar', 'closed') === 'open');
syncSideToggle();
$('#side-toggle').addEventListener('click', () => {
  const open = $('#hub').classList.toggle('side-open');
  store.set('poker:sidebar', open ? 'open' : 'closed');
  syncSideToggle();
});
