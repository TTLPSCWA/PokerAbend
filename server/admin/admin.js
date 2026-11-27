'use strict';
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let timer = null;

async function call(path, method = 'GET', body = null) {
  const res = await fetch('/admin/api' + path, {
    method, credentials: 'same-origin',
    headers: { 'X-Requested-With': 'spieleabend', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/login') { showLogin(); throw new Error(data.error || 'Nicht angemeldet'); }
  if (!res.ok) throw new Error(data.error || 'Das hat nicht geklappt');
  return data;
}
function confirmDialog(title, text, ok = 'Bestätigen') {
  return new Promise((resolve) => {
    const d = $('#confirm');
    $('#confirm-title').textContent = title; $('#confirm-text').textContent = text; $('#confirm-ok').textContent = ok;
    d.addEventListener('close', () => resolve(d.returnValue === 'ok'), { once: true });
    d.returnValue = 'cancel'; d.showModal();
  });
}
const say = (text, bad = false) => { const m = $('#msg'); m.textContent = text; m.className = bad ? 'bad' : 'good'; };
const mb = (n) => (n / 1048576).toFixed(1) + ' MB';
const size = (n) => (n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : mb(n));
const dur = (ms) => { const m = Math.max(0, Math.floor(ms / 60000)); return m < 1 ? 'unter 1 Min.' : m < 60 ? m + ' Min.' : Math.floor(m / 60) + ' Std. ' + (m % 60) + ' Min.'; };
const time = (at) => new Date(at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'medium' });
const uptime = (s) => { const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60); return (d ? d + ' T ' : '') + h + ' Std. ' + m + ' Min.'; };

function render(s) {
  $('#version').textContent = `Version ${s.version}${s.commit ? ' · ' + s.commit.slice(0, 7) : ''}`;
  $('#system').innerHTML = [
    ['Laufzeit', uptime(s.system.uptimeSec)], ['Speicher (RSS)', mb(s.system.memory.rss)], ['Heap', `${mb(s.system.memory.heapUsed)} / ${mb(s.system.memory.heapTotal)}`],
    ['CPU (letzte Messung)', s.system.cpuPercent + ' %'], ['Verbindungen online', s.online.connections], ['Spieler an Tischen (online)', s.online.players], ['Offene Räume', s.rooms.length], ['Node', s.system.node],
  ].map(([k, v]) => `<div class="stat"><span class="muted">${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
  const u = s.update;
  $('#update').innerHTML = u
    ? `<p><b class="bad">Update angekündigt</b> – ${u.due ? 'fällig, wartet auf laufende Runden' : 'in ' + dur(u.leftMs)}.</p><p class="muted">Neue Runden starten nicht mehr; laufende dürfen fertig werden. Danach speichert und beendet der Server.</p><button class="ghost" type="button" data-cancel-update>Ankündigung zurücknehmen</button>`
    : `<p class="muted">Zeigt allen ein Banner. Neue Runden starten nicht mehr, laufende dürfen fertig werden, danach speichert und beendet der Server.</p><form id="update-form" class="row"><input type="number" name="minutes" min="1" max="${s.maxUpdateMinutes}" value="5" required aria-label="Minuten"><span class="muted">Minuten</span><button type="submit">Update ankündigen</button></form>`;
  $('#rooms').innerHTML = s.rooms.length ? `<table><thead><tr><th>Code</th><th>Spiel</th><th>Spieler</th><th>Laufzeit</th><th>Letzte Aktivität</th><th>Status</th><th></th></tr></thead><tbody>${s.rooms.map((r) => `<tr>
    <td><b>${esc(r.code)}</b></td><td>${esc(r.gameName)}${r.private ? ' <span class="muted">(privat)</span>' : ''}</td>
    <td>${r.humans} (${r.online} online)${r.bots ? ' · ' + r.bots + ' Bot' : ''}<br><span class="muted">${esc(r.names.join(', '))}</span></td>
    <td>${dur(s.now - r.openedAt)}</td><td>vor ${dur(s.now - r.lastActivity)}</td><td>${r.busy ? 'Runde läuft' : 'wartet'}${r.paused ? ' · pausiert' : ''}</td>
    <td><button class="danger" type="button" data-close="${esc(r.code)}" data-label="${esc(r.gameName)}">Schließen</button></td></tr>`).join('')}</tbody></table>` : '<p class="muted">Keine offenen Räume.</p>';
  $('#files').innerHTML = s.data.files.map((f) => `<div class="stat"><span>${esc(f.name)}</span><b>${size(f.size)}</b></div>`).join('') + `<div class="stat"><span class="muted">Gesamt</span><b>${size(s.data.total)}</b></div>`;
  $('#claims').innerHTML = s.claims.length ? `<table><thead><tr><th>Alter Name</th><th>Übernommen von</th><th>Wann</th><th></th></tr></thead><tbody>${s.claims.map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.gameId || '?')} <span class="muted">${esc(c.by)}</span></td><td class="muted">${esc(time(c.claimedAt))}</td><td><button class="danger" type="button" data-undo-claim="${esc(c.key)}" data-label="${esc(c.name)}">Rückgängig</button></td></tr>`).join('')}</tbody></table>` : '<p class="muted">Noch hat niemand alte Statistiken übernommen.</p>';
  $('#errors').innerHTML = s.errors.length ? `<table><thead><tr><th>Meldung</th><th>Spiel</th><th>Anzahl</th><th>Zuletzt</th></tr></thead><tbody>${s.errors.map((e) => `<tr><td>${esc(e.message)}</td><td>${esc(e.game)}</td><td>${e.count}</td><td>${esc(time(e.last))}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Keine Fehler gemeldet.</p>';
  $('#log').innerHTML = s.log.length ? `<table><tbody>${s.log.map((l) => `<tr><td class="muted">${esc(time(l.at))}</td><td>${esc(l.action)}</td><td class="muted">${esc(l.detail)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Noch keine Einträge.</p>';
}
const bad = (e) => say(e.message, true);
const fmtDay = (at) => (at ? new Date(at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '–');
const tag = (gid) => (gid ? ` <span class="muted">${esc(gid)}</span>` : '');
async function loadReviews() {
  const { items } = await call('/reviews');
  $('#reviews').innerHTML = items.length ? `<table><thead><tr><th>Abend</th><th>Spieler</th><th>Stationen</th><th>Sieger</th><th>Stand</th><th></th></tr></thead><tbody>${items.map((r) => `<tr><td><b>${esc(r.name)}</b>${r.private ? ' <span class="muted">(privat)</span>' : ''}${r.hidden ? ' <span class="bad">(ausgeblendet)</span>' : ''}<br><span class="muted">${esc(fmtDay(r.endedAt || r.updatedAt))}</span></td>
    <td>${r.players.map((p) => esc(p.name) + tag(p.gameId)).join(', ')}</td><td>${r.completed}/${r.planned}<br><span class="muted">${esc(r.games.join(', '))}</span></td><td>${esc(r.winners.join(', ') || '–')}</td><td>${esc(r.status)}</td>
    <td><button class="${r.hidden ? 'ghost' : 'danger'}" type="button" data-hide-review="${esc(r.id)}" data-hidden="${r.hidden ? 0 : 1}" data-label="${esc(r.name)}">${r.hidden ? 'Einblenden' : 'Ausblenden'}</button></td></tr>`).join('')}</tbody></table>` : '<p class="muted">Noch keine Rückblicke.</p>';
}
async function loadBoard() {
  const f = new FormData($('#board-form')), game = String(f.get('game') || '').trim() || 'all', period = String(f.get('period') || 'all'), hidden = f.get('hidden') ? '1' : '0';
  const [b, r] = await Promise.all([call(`/leaderboard?game=${encodeURIComponent(game)}&period=${encodeURIComponent(period)}`), call(`/rounds?game=${encodeURIComponent(game)}&hidden=${hidden}&limit=50`)]);
  $('#board').innerHTML = b.rows.length ? `<table><thead><tr><th>#</th><th>Spieler</th><th>Partien</th><th>Siege</th><th>Ø Platz</th><th>Punkte</th></tr></thead><tbody>${b.rows.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.name)}${tag(x.gameId)}</td><td>${x.played}</td><td>${x.wins}</td><td>${x.avgPlace}</td><td>${x.points ?? '–'}</td></tr>`).join('')}</tbody></table><p class="muted">Gewertet: ${b.summary.ranked} · nicht gewertet: ${b.summary.notRanked}</p>` : '<p class="muted">Keine gewerteten Partien.</p>';
  $('#rounds').innerHTML = r.items.length ? `<table><thead><tr><th>Wann</th><th>Spiel</th><th>Ergebnis</th><th>Wertung</th><th></th></tr></thead><tbody>${r.items.map((x) => `<tr><td class="muted">${esc(fmtDay(x.at))}</td><td>${esc(x.game)}</td>
    <td>${x.players.map((p) => `${p.place}. ${esc(p.name)}${p.bot ? ' (Bot)' : ''}${tag(p.gameId)}`).join('<br>')}</td><td>${x.hidden ? '<span class="bad">ausgeblendet</span>' : x.ranked ? 'gewertet' : '<span class="muted">nicht gewertet</span>'}</td>
    <td><button class="${x.hidden ? 'ghost' : 'danger'}" type="button" data-hide-round="${esc(x.id)}" data-hidden="${x.hidden ? 0 : 1}" data-label="${esc(x.game)}">${x.hidden ? 'Einblenden' : 'Ausblenden'}</button></td></tr>`).join('')}</tbody></table>` : '<p class="muted">Keine Partien.</p>';
}
async function loadTickets() {
  const f = new FormData($('#ticket-filter')), data = await call(`/tickets?q=${encodeURIComponent(String(f.get('q') || ''))}&status=${encodeURIComponent(String(f.get('status') || ''))}`);
  const sel = $('#ticket-filter [name=status]'); if (sel.options.length === 1) for (const [k, v] of Object.entries(data.statuses)) sel.add(new Option(v, k));
  $('#tickets').innerHTML = data.tickets.length ? `<table><thead><tr><th>#</th><th>Ticket</th><th>Von</th><th>Status</th><th></th></tr></thead><tbody>${data.tickets.map((t) => `<tr data-ticket="${t.id}" data-revision="${t.revision}"><td>${t.id}</td><td><b>${esc(t.title)}</b><br><span class="muted">${esc(t.excerpt)}</span><br><span class="muted">${t.votes} Stimmen · ${t.commentCount} Kommentare</span></td>
    <td>${esc(t.author.name)}${tag(t.author.gameId)}</td><td><select aria-label="Status #${t.id}">${Object.entries(data.statuses).map(([k, v]) => `<option value="${k}"${k === t.status ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></td>
    <td class="row"><button type="button" data-ticket-save="${t.id}">Speichern</button><button class="ghost" type="button" data-ticket-comment="${t.id}">Kommentieren</button><button class="danger" type="button" data-ticket-delete="${t.id}" data-label="${esc(t.title)}">Löschen</button></td></tr>`).join('')}</tbody></table>` : '<p class="muted">Keine Tickets.</p>';
}
const SOURCE = { admin: 'Admin-Einstellung', env: '.env', standard: 'Standard' };
let featureState = null;
function renderFeatures() {
  if (!featureState) return;
  $('#feature-flags').innerHTML = `<table><thead><tr><th>Funktion</th><th>Zustand</th><th>Quelle</th><th></th></tr></thead><tbody>${featureState.flags.map((f) => `<tr><td><b>${esc(f.label)}</b><br><span class="muted">${esc(f.hint)}</span></td>
    <td><b class="${f.value ? 'good' : 'bad'}">${f.value ? 'an' : 'aus'}</b></td><td>${esc(SOURCE[f.source])}${f.source === 'admin' ? `<br><span class="muted">sonst: ${f.baseline ? 'an' : 'aus'}</span>` : ''}</td>
    <td class="row"><button class="${f.value ? 'danger' : ''}" type="button" data-flag="${esc(f.name)}" data-value="${f.value ? 0 : 1}" data-label="${esc(f.label)}">${f.value ? 'Ausschalten' : 'Einschalten'}</button>${f.source === 'admin' ? `<button class="ghost" type="button" data-flag="${esc(f.name)}" data-value="reset" data-label="${esc(f.label)}">Zurücksetzen</button>` : ''}</td></tr>`).join('')}</tbody></table>`;
  const q = $('#feature-filter').value.trim().toLowerCase(), view = $('#feature-view').value, only = $('#feature-cat')?.value || '';
  const CAT = { karten: 'Kartenspiele', wuerfel: 'Würfelspiele', brett: 'Brettspiele', party: 'Partyspiele', einzelspieler: 'Einzelspieler', idle: 'Idle-Games' };
  const KIND = { multiplayer: 'Mehrspieler', solo: 'Einzelspieler', idle: 'Idle' };
  const open = new Set([...document.querySelectorAll('#feature-games details[open]')].map((d) => d.dataset.cat));
  const searching = !!q || view !== 'all' || !!only;
  const cats = Object.keys(CAT).map((c) => {
    const all = featureState.games.filter((g) => g.category === c);
    const shown = all.filter((g) => (!q || g.id.includes(q) || (g.name || '').toLowerCase().includes(q)) && (view === 'all' || (view === 'on') === g.enabled) && (!only || only === c));
    return [c, all, shown];
  }).filter(([, , shown]) => shown.length);
  $('#feature-games').innerHTML = cats.length ? cats.map(([c, all, shown]) => {
    const on = all.filter((g) => g.enabled).length;
    return '<details class="cat" data-cat="' + c + '" ' + (searching || open.has(c) || !open.size && c === 'karten' ? 'open' : '') + '><summary><span>' + CAT[c] + '</span><span class="pill">' + all.length + ' Spiele</span><span class="pill good">' + on + ' aktiv</span><span class="pill ' + (all.length - on ? 'bad' : '') + '">' + (all.length - on) + ' ausgeblendet</span>' +
      '<span class="cat-actions"><button type="button" class="ghost" data-bulk="on" data-cat="' + c + '">Alle einblenden</button><button type="button" class="danger" data-bulk="off" data-cat="' + c + '">Alle ausblenden</button></span></summary><div class="cat-body"><div class="game-grid">' +
      shown.map((g) => '<div class="game-card ' + (g.enabled ? '' : 'off') + '"><span><b>' + esc(g.name) + '</b><br><span class="muted"><code>' + esc(g.id) + '</code> · ' + esc(KIND[g.kind] || '') + (g.variants > 1 ? ' · ' + g.variants + ' Varianten (folgen diesem Spiel)' : '') + (g.source !== 'standard' ? ' · ' + esc(SOURCE[g.source]) : '') + '</span></span>' +
        '<span class="row"><button class="' + (g.enabled ? 'danger' : '') + '" type="button" role="switch" aria-checked="' + g.enabled + '" aria-label="' + esc(g.name) + (g.enabled ? ' ausblenden' : ' einblenden') + '" data-game="' + esc(g.id) + '" data-value="' + (g.enabled ? 0 : 1) + '">' + (g.enabled ? 'Ausblenden' : 'Einblenden') + '</button>' +
        (g.source === 'admin' ? '<button class="ghost" type="button" data-game="' + esc(g.id) + '" data-value="reset" title="Admin-Einstellung zurücknehmen">↺</button>' : '') + '</span></div>').join('') + '</div></div></details>';
  }).join('') : '<p class="muted">Keine Spiele gefunden.</p>';
  $('#feature-total').textContent = featureState.games.filter((g) => g.enabled).length + ' von ' + featureState.games.length + ' Spielen aktiv';
}
async function loadFeatures() { featureState = await call('/features'); renderFeatures(); }
for (const id of ['#feature-filter', '#feature-view', '#feature-cat']) $(id).addEventListener('input', renderFeatures);
$('#mod-features').addEventListener('click', async (e) => {
  const bulk = e.target.closest('button[data-bulk]');
  if (bulk && featureState) {
    e.preventDefault();
    const on = bulk.dataset.bulk === 'on', cat = bulk.dataset.cat;
    const ids = featureState.games.filter((g) => !cat || g.category === cat).map((g) => g.id);
    const label = cat ? 'Kategorie „' + ({ karten: 'Kartenspiele', wuerfel: 'Würfelspiele', brett: 'Brettspiele', party: 'Partyspiele', einzelspieler: 'Einzelspieler', idle: 'Idle-Games' })[cat] + '“' : 'Alle Spiele';
    if (!await confirmDialog(label + (on ? ' einblenden?' : ' ausblenden?'), ids.length + ' Spiele werden ' + (on ? 'wieder sichtbar' : 'aus den Listen genommen. Laufende Tische spielen weiter, neue lassen sich nicht anlegen') + '. Spielstände und Daten bleiben erhalten.', on ? 'Einblenden' : 'Ausblenden')) return;
    try { featureState = await call('/features/games', 'POST', { ids, value: on }); renderFeatures(); say(label + ': ' + (on ? 'eingeblendet' : 'ausgeblendet')); } catch (err) { bad(err); }
    return;
  }
  const b = e.target.closest('button[data-flag],button[data-game]'); if (!b) return;
  const value = b.dataset.value === 'reset' ? null : b.dataset.value === '1';
  const what = b.dataset.flag ? b.dataset.label : 'Spiel ' + b.dataset.game;
  if (value === false && b.dataset.flag && !await confirmDialog(what + ' ausschalten?', 'Die Funktion ist danach für alle sofort weg. Daten bleiben erhalten.', 'Ausschalten')) return;
  try { featureState = await call(b.dataset.flag ? '/features/' + encodeURIComponent(b.dataset.flag) : '/features/games/' + encodeURIComponent(b.dataset.game), 'POST', { value }); renderFeatures(); say(what + ': ' + (value === null ? 'zurückgesetzt' : value ? 'eingeblendet' : 'ausgeblendet')); } catch (err) { bad(err); }
});

// ---- Seiten & Endpunkte
let catalog = null;
async function loadEndpoints() { catalog = await call('/catalog'); renderEndpoints(); }
function renderEndpoints() {
  if (!catalog) return;
  const q = $('#ep-search').value.trim().toLowerCase(), m = $('#ep-method').value, lv = $('#ep-level').value;
  const rows = [...catalog.pages.map((x) => ({ ...x, method: 'GET', level: '', page: true })), ...catalog.endpoints]
    .filter((e) => (!q || (e.path + ' ' + e.title + ' ' + e.protection).toLowerCase().includes(q)) && (!m || e.method === m) && (!lv || e.level === lv));
  $('#ep-count').textContent = rows.length + ' Einträge';
  const groups = [...new Set(rows.map((e) => e.group))];
  $('#endpoint-list').innerHTML = groups.map((g) => {
    const list = rows.filter((e) => e.group === g);
    return '<details class="cat" ' + (q || m || lv ? 'open' : '') + '><summary><span>' + esc(g) + '</span><span class="pill">' + list.length + '</span></summary><div class="cat-body scroll"><table><thead><tr><th>Name</th><th>Methode</th><th>Pfad</th><th>Zugriffsschutz</th><th></th></tr></thead><tbody>' + list.map((e) =>
      '<tr><td>' + (e.link ? '<a href="' + esc(e.path) + '" target="_blank" rel="noopener">' + esc(e.title) + '</a>' : esc(e.title)) + '</td><td><span class="method ' + (e.changes ? 'write' : '') + '">' + esc(e.method) + '</span></td><td class="ep-path">' + esc(e.path) + '</td><td><span class="pill ' + (e.level === 'checked' ? 'good' : e.level === 'unknown' ? 'warn' : e.level === 'open' ? '' : '') + '">' + esc(e.protection) + '</span></td><td><button type="button" class="ghost mini" data-copy="' + esc(e.path) + '">Pfad kopieren</button></td></tr>').join('') + '</tbody></table></div></details>';
  }).join('') || '<p class="muted">Nichts gefunden.</p>';
}
for (const id of ['#ep-search', '#ep-method', '#ep-level']) $(id).addEventListener('input', renderEndpoints);
$('#endpoint-list').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-copy]'); if (!b) return;
  try { await navigator.clipboard.writeText(b.dataset.copy); say('Kopiert: ' + b.dataset.copy); } catch { say('Kopieren nicht möglich – Pfad: ' + b.dataset.copy, true); }
});

// ---- Gefahrendialog: Auswirkungen, optional Bestätigungstext und Passwort
function dangerDialog({ title, lines = [], phrase = '', password = false, ok = 'Bestätigen' }) {
  return new Promise((resolve) => {
    const d = $('#danger'), phraseInput = $('#danger-phrase'), pass = $('#danger-pass'), err = $('#danger-error');
    $('#danger-title').textContent = title;
    $('#danger-body').innerHTML = '<ul class="effects">' + lines.map((l) => '<li>' + esc(l) + '</li>').join('') + '</ul>';
    $('#danger-phrase-field').hidden = !phrase; $('#danger-phrase-label').textContent = 'Zur Bestätigung eintippen: ' + phrase; phraseInput.value = '';
    $('#danger-pass-field').hidden = !password; pass.value = ''; err.textContent = ''; $('#danger-ok').textContent = ok;
    const finish = (value) => { d.close(); resolve(value); };
    $('#danger-cancel').onclick = () => finish(null);
    d.oncancel = (e) => { e.preventDefault(); finish(null); };
    $('#danger-form').onsubmit = (e) => {
      e.preventDefault();
      if (phrase && phraseInput.value !== phrase) { err.textContent = 'Der Bestätigungstext stimmt nicht genau.'; return; }
      if (password && !pass.value) { err.textContent = 'Bitte das Admin-Passwort eingeben.'; return; }
      finish({ phrase: phraseInput.value, password: pass.value });
    };
    d.showModal();
  });
}
const fmtDate = (t) => (t ? new Date(t).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '–');

// ---- Spielerverwaltung
const picked = new Set();
let playerPage = 1, playerRows = [], mergeFrom = null, mergeTo = null;
const playerOpts = (page = playerPage) => { const f = new FormData($('#player-search')); return '?' + new URLSearchParams({ q: String(f.get('q') || ''), filter: String(f.get('filter')), sort: String(f.get('sort')), pageSize: String(f.get('pageSize')), page: String(page) }); };
function updatePicked() { $('#player-selected').textContent = picked.size + ' ausgewählt'; $('#player-delete').disabled = !picked.size; }
async function loadPlayers(page = playerPage) {
  const data = await call('/players/list' + playerOpts(page));
  playerPage = data.page; playerRows = data.items;
  $('#player-count').textContent = data.total + ' von ' + data.all + ' Konten';
  $('#players').innerHTML = data.items.length ? '<table><thead><tr><th></th><th>Spieler</th><th>Game-ID</th><th>Typ</th><th>Status</th><th>Erstellt</th><th>Zuletzt aktiv</th><th>Gewertet</th><th>Siege</th><th></th></tr></thead><tbody>' + data.items.map((p) =>
    '<tr><td class="sel"><input type="checkbox" data-pick="' + esc(p.gameId) + '" aria-label="' + esc(p.name || p.gameId) + ' auswählen" ' + (picked.has(p.gameId) ? 'checked' : '') + '></td><td>' + esc(p.avatar) + ' <b>' + esc(p.name || '–') + '</b></td><td><code>' + esc(p.gameId) + '</code></td><td>' + (p.discord ? '<span class="pill good">Discord</span>' : '<span class="pill">Gast</span>') + '</td><td><span class="pill ' + (p.status === 'in-spiel' ? 'warn' : p.status === 'aktiv' ? 'good' : '') + '">' + esc(p.status) + '</span></td><td class="muted">' + esc(fmtDate(p.createdAt)) + '</td><td class="muted">' + esc(fmtDate(p.lastSeen)) + '</td><td>' + p.played + '</td><td>' + p.wins + '</td>' +
    '<td class="row"><button type="button" class="ghost mini" data-merge-from="' + esc(p.gameId) + '">Quelle</button><button type="button" class="ghost mini" data-merge-to="' + esc(p.gameId) + '">Ziel</button><button type="button" class="danger mini" data-delete-one="' + esc(p.gameId) + '">Löschen</button></td></tr>').join('') + '</tbody></table>' : '<p class="muted">Keine Konten gefunden.</p>';
  $('#player-pager').innerHTML = data.pages > 1 ? '<button type="button" class="ghost mini" data-page="' + (data.page - 1) + '" ' + (data.page <= 1 ? 'disabled' : '') + '>← Zurück</button><span>Seite ' + data.page + ' von ' + data.pages + '</span><button type="button" class="ghost mini" data-page="' + (data.page + 1) + '" ' + (data.page >= data.pages ? 'disabled' : '') + '>Weiter →</button>' : '';
  updatePicked();
}
$('#player-search').addEventListener('submit', (e) => { e.preventDefault(); playerPage = 1; loadPlayers(1).catch(bad); });
$('#player-pager').addEventListener('click', (e) => { const b = e.target.closest('[data-page]'); if (b && !b.disabled) loadPlayers(Number(b.dataset.page)).catch(bad); });
$('#player-select-page').addEventListener('click', () => { playerRows.forEach((p) => picked.add(p.gameId)); loadPlayers().catch(bad); });
$('#player-select-none').addEventListener('click', () => { picked.clear(); loadPlayers().catch(bad); });
$('#player-select-all').addEventListener('click', async () => { try { const r = await call('/players/ids' + playerOpts(1)); r.ids.forEach((id) => picked.add(id)); say(r.ids.length + ' Treffer ausgewählt'); await loadPlayers(); } catch (err) { bad(err); } });
$('#players').addEventListener('change', (e) => { const c = e.target.closest('[data-pick]'); if (!c) return; if (c.checked) picked.add(c.dataset.pick); else picked.delete(c.dataset.pick); updatePicked(); });
function showMerge() { $('#merge-from').textContent = 'Quelle: ' + (mergeFrom || '–'); $('#merge-to').textContent = 'Ziel: ' + (mergeTo || '–'); $('#merge-compare').disabled = !(mergeFrom && mergeTo && mergeFrom !== mergeTo); }
$('#players').addEventListener('click', async (e) => {
  const f = e.target.closest('[data-merge-from]'), t = e.target.closest('[data-merge-to]'), d = e.target.closest('[data-delete-one]');
  if (f) { mergeFrom = f.dataset.mergeFrom; showMerge(); } else if (t) { mergeTo = t.dataset.mergeTo; showMerge(); } else if (d) await deletePlayers([d.dataset.deleteOne]);
});
$('#merge-clear').addEventListener('click', () => { mergeFrom = mergeTo = null; showMerge(); });
const sideHTML = (s) => '<div><b>' + esc(s.avatar) + ' ' + esc(s.name || '–') + '</b> <code>' + esc(s.gameId) + '</code><br>' + (s.discord ? 'Discord verknüpft' : 'Gast') + '<br>Erstellt ' + esc(fmtDate(s.createdAt)) + '<br>Zuletzt aktiv ' + esc(fmtDate(s.lastSeen)) + '<br>' + s.played + ' gewertete Spiele, ' + s.wins + ' Siege<br>' + s.achievements + ' Erfolge · ' + s.idleSaves + ' Idle-Spielstände</div>';
$('#merge-compare').addEventListener('click', async () => {
  try {
    const c = await call('/players/compare?from=' + encodeURIComponent(mergeFrom) + '&to=' + encodeURIComponent(mergeTo));
    const d = $('#danger');
    $('#danger-title').textContent = 'Spieler zusammenführen?';
    $('#danger-body').innerHTML = '<div class="cmp"><div><small class="muted">Quelle (wird aufgelöst)</small></div><div><small class="muted">Ziel (bleibt bestehen)</small></div>' + sideHTML(c.from) + sideHTML(c.to) + '</div><ul class="effects">' + c.effects.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>';
    $('#danger-phrase-field').hidden = true; $('#danger-pass-field').hidden = true; $('#danger-error').textContent = ''; $('#danger-ok').textContent = 'Zusammenführen';
    const go = await new Promise((resolve) => { $('#danger-cancel').onclick = () => { d.close(); resolve(false); }; d.oncancel = (ev) => { ev.preventDefault(); d.close(); resolve(false); }; $('#danger-form').onsubmit = (ev) => { ev.preventDefault(); d.close(); resolve(true); }; d.showModal(); });
    if (!go) return;
    await call('/players/merge', 'POST', { from: mergeFrom, to: mergeTo });
    say(mergeFrom + ' wurde mit ' + mergeTo + ' zusammengeführt'); picked.delete(mergeFrom); mergeFrom = mergeTo = null; showMerge(); await loadPlayers(); loadTools();
  } catch (err) { bad(err); }
});
async function deletePlayers(ids) {
  try {
    const pre = await call('/players/delete-preview', 'POST', { ids });
    const names = pre.items.slice(0, 8).map((i) => (i.name || '–') + ' ' + i.gameId + ' (' + i.played + ' Spiele, ' + i.achievements + ' Erfolge, ' + i.idleSaves + ' Idle)').join('; ');
    const go = await dangerDialog({ title: pre.count + (pre.count === 1 ? ' Spieler' : ' Spieler') + ' endgültig löschen?', lines: [names + (pre.count > 8 ? ' …' : ''), ...pre.effects, ...(pre.active ? ['ACHTUNG: ' + pre.active + ' sitzen gerade an einem Tisch – die Löschung wird abgelehnt.'] : []), 'Vorher entsteht eine geprüfte Sicherung.'], ok: 'Endgültig löschen' });
    if (!go) return;
    const r = await call('/players/delete', 'POST', { ids, token: pre.token });
    ids.forEach((id) => picked.delete(id));
    if (r.failed?.length) say(r.deleted + ' gelöscht, ABER ' + r.failed.length + ' fehlgeschlagen (' + r.failed.slice(0, 5).map((f) => f.gameId).join(', ') + '). Sicherung: ' + r.backup, true); else say(r.deleted + ' Spieler gelöscht (Sicherung ' + r.backup + ')');
    await loadPlayers(); loadTools();
  } catch (err) { bad(err); }
}
$('#player-delete').addEventListener('click', () => deletePlayers([...picked]));
$('#player-delete-all').addEventListener('click', async () => {
  try {
    const pre = await call('/players/delete-all-preview');
    const go = await dangerDialog({ title: 'ALLE ' + pre.count + ' Spieler löschen?', lines: [pre.count + ' Konten (' + pre.discord + ' mit Discord), ' + pre.rounds + ' gespeicherte Runden.', ...pre.effects, ...(pre.active ? ['ACHTUNG: ' + pre.active + ' Spieler sitzen an Tischen – die Aktion wird abgelehnt.'] : [])], phrase: pre.phrase, password: true, ok: 'Alle Spieler löschen' });
    if (!go) return;
    const r = await call('/players/delete-all', 'POST', { confirm: go.phrase, password: go.password, token: pre.token });
    picked.clear();
    if (r.failed?.length) say(r.deleted + ' gelöscht, ABER ' + r.failed.length + ' fehlgeschlagen. Sicherung: ' + r.backup, true); else say(r.deleted + ' Spieler gelöscht (Sicherung ' + r.backup + ')');
    await loadPlayers(); loadTools();
  } catch (err) { bad(err); }
});

// ---- Statistik bereinigen (Bestenliste getrennt von den Konten)
function statsScope() {
  const f = new FormData($('#stats-form')), ids = String(f.get('ids') || '').split(/[\s,;]+/).map((x) => x.trim().toUpperCase()).filter(Boolean);
  return { game: String(f.get('game') || '').trim() || 'all', month: String(f.get('month') || '').trim() || null, ...(ids.length ? { gameIds: ids } : {}) };
}
async function runStats(whole) {
  try {
    const scope = statsScope();
    if (whole && scope.gameIds) { say('Für „Gesamte Bestenliste“ keine Spieler eintragen. Dafür „Statistik endgültig löschen“ verwenden.', true); return; }
    if (!whole && !scope.gameIds) { say('Bitte mindestens einen Spieler (#GAMEID) eintragen – oder „Gesamte Bestenliste zurücksetzen“ wählen.', true); return; }
    const pre = await call('/stats/preview', 'POST', { scope });
    const where = (scope.game === 'all' ? 'alle Spiele' : 'Spiel ' + scope.game) + ', ' + (scope.month ? 'Monat ' + scope.month : 'gesamter Zeitraum');
    const go = await dangerDialog({ title: whole ? 'Gesamte Bestenliste zurücksetzen?' : 'Statistik endgültig löschen?', lines: [where, pre.rounds + ' Runden und ' + pre.entries + ' Spielereinträge sowie ' + pre.counters + ' Zähler sind betroffen (' + pre.players + ' Spieler).', 'Konten, Namen und bereits freigeschaltete Erfolge bleiben. Die Aktion lässt sich nur über die Sicherung rückgängig machen.', whole ? 'Dabei werden die Runden aller Spieler entfernt.' : 'Runden anderer Spieler bleiben erhalten.'], phrase: whole && !scope.month && scope.game === 'all' ? 'BESTENLISTE ZURÜCKSETZEN' : '', password: whole && !scope.month && scope.game === 'all', ok: whole ? 'Zurücksetzen' : 'Endgültig löschen' });
    if (!go) return;
    const r = await call('/stats/delete', 'POST', { scope, token: pre.token, confirm: go.phrase, password: go.password });
    say('Statistik gelöscht: ' + r.rounds + ' Runden, ' + r.entries + ' Einträge, ' + r.counters + ' Zähler (Sicherung ' + r.backup + ')'); loadBoard().catch(bad);
  } catch (err) { bad(err); }
}
$('#stats-delete').addEventListener('click', () => runStats(false));
$('#stats-reset').addEventListener('click', () => runStats(true));
async function loadMemePacks() {
  const res = await call('/meme-packs').catch(error => {
    if (/JSON|404|hat nicht geklappt/.test(error.message)) return null;
    throw error;
  });
  if (!res) return;
  const panel = $('#mod-memes'), form = $('#meme-create'), motif = form.elements.template;
  panel.hidden = false;
  if (!motif.options.length) for (const name of res.motifs) motif.add(new Option(name,name));
  const provider = $('#meme-provider');
  provider.textContent = res.providerEnabled ? 'Charts deaktivieren' : 'Charts aktivieren';
  provider.dataset.enabled = String(res.providerEnabled);
  $('#meme-refresh').disabled = !res.providerEnabled;
  $('#meme-chart-date').textContent = res.checkedAt ? 'Letzte Prüfung: ' + time(res.checkedAt) : 'Noch kein Abruf';
  const changes = {initial:'Erster Abruf',popular:'Beliebt','new-in-chart':'Neu in den Charts','rank-rise':'Stärker gestiegen'};
  $('#meme-chart').innerHTML = res.listings.length ? `<table><thead><tr><th>Rang</th><th>Vorlage</th><th>Beobachtung</th></tr></thead><tbody>${res.listings.map(row=>
    `<tr><td>${esc(row.rank)}</td><td><a href="https://imgflip.com/memetemplate/${encodeURIComponent(row.id)}" target="_blank" rel="noopener noreferrer">${esc(row.name)}</a></td><td>${esc(changes[row.observation])}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Keine Vorlagen erfasst.</p>';
  const reviewState = {pending:'Wartet auf Prüfung',approved:'Freigegeben',disabled:'Deaktiviert'};
  $('#meme-entries').innerHTML = res.entries.length ? `<table><thead><tr><th>Beitrag</th><th>Quelle und Rechte</th><th>Status</th><th>Aktion</th></tr></thead><tbody>${res.entries.map(row=>
    `<tr><td>${esc(row.title[0])} (${esc(row.type)})<br>${esc(row.situation[0])}<br>${esc(row.caption[0])}<br>${esc(row.situation[1])}<br>${esc(row.caption[1])}</td><td>${esc(row.source)}<br>${esc(row.license)}<br>${esc(row.extended ? 'Erweiterter Humor' : 'Standard')}</td><td>${esc(reviewState[row.status])}</td><td><button type="button" data-meme-review="${esc(row.id)}" data-status="${row.status==='approved'?'disabled':'approved'}">${row.status==='approved'?'Deaktivieren':'Freigeben'}</button></td></tr>`).join('')}</tbody></table>` : '<p class="muted">Keine Community-Beiträge erfasst.</p>';
}
$('#meme-create').addEventListener('submit', async e => {
  e.preventDefault();
  const form=e.currentTarget, content=Object.fromEntries(new FormData(form));
  content.extended=form.elements.extended.checked;
  try { await call('/meme-packs','POST',content); form.reset(); await loadMemePacks(); } catch (error) { bad(error); }
});
$('#mod-memes').addEventListener('click', async e => {
  const button=e.target.closest('button');
  if (!button || (!button.id && !button.dataset.memeReview)) return;
  if (button.id && !['meme-provider','meme-refresh'].includes(button.id)) return;
  try {
    if (button.id==='meme-provider') await call('/meme-packs/provider','POST',{enabled:button.dataset.enabled!=='true'});
    else if (button.id==='meme-refresh') await call('/meme-packs/refresh','POST',{});
    else {
      const status=button.dataset.status;
      if (status==='approved' && !await confirmDialog('Beitrag für das Spiel freigeben?', 'Sind die Rechte, beide Sprachfassungen und die Inhaltseignung geprüft?', 'Freigeben')) return;
      await call('/meme-packs/'+encodeURIComponent(button.dataset.memeReview)+'/review','POST',{status,confirmed:true});
    }
    await loadMemePacks();
  } catch (error) { bad(error); }
});
async function loadTools() { await Promise.all([loadReviews(), loadBoard(), loadPlayers(), loadTickets(), loadFeatures(), loadEndpoints()].map((p) => p.catch(bad))); }
async function load() {
  try { const s = await call('/status'); $('#login').hidden = true; $('#app').hidden = false; render(s); }
  catch (e) { if (!$('#app').hidden) say(e.message, true); }
}
function showLogin() { $('#app').hidden = true; $('#login').hidden = false; clearInterval(timer); timer = null; }
function start() { clearInterval(timer); timer = setInterval(load, 5000); load(); loadTools(); loadMemePacks().catch(bad); }

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try { await call('/login', 'POST', { password: $('#pw').value }); $('#pw').value = ''; $('#login-error').textContent = ''; start(); }
  catch (err) { $('#login-error').textContent = err.message; }
});
$('#logout').addEventListener('click', async () => { await call('/logout', 'POST', {}).catch(() => {}); showLogin(); });
$('#refresh').addEventListener('click', () => { load(); loadTools(); loadMemePacks().catch(bad); });
for (const [id, fn] of [['#board-form', loadBoard], ['#ticket-filter', loadTickets]]) $(id).addEventListener('submit', (e) => { e.preventDefault(); fn().catch(bad); });
document.addEventListener('submit', async (e) => {
  if (e.target.id !== 'update-form') return;
  e.preventDefault();
  const minutes = Number(new FormData(e.target).get('minutes'));
  if (!await confirmDialog('Update ankündigen?', `Alle sehen sofort „Update in ${minutes} Minuten“. Neue Runden starten nicht mehr. Danach beendet sich der Server.`, 'Ankündigen')) return;
  try { await call('/update', 'POST', { minutes }); say('Update angekündigt'); } catch (err) { say(err.message, true); }
  load();
});
document.addEventListener('click', async (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.close) {
    if (!await confirmDialog('Raum schließen?', `Raum ${b.dataset.close} (${b.dataset.label}) wird sofort geschlossen. Alle Spieler landen auf der Startseite.`, 'Raum schließen')) return;
    try { await call(`/rooms/${encodeURIComponent(b.dataset.close)}/close`, 'POST', {}); say(`Raum ${b.dataset.close} geschlossen`); } catch (err) { say(err.message, true); }
    load();
  } else if (b.dataset.undoClaim) {
    if (!await confirmDialog('Zuordnung rückgängig machen?', `Die alte Statistik „${b.dataset.label}“ gehört danach wieder niemandem und kann neu übernommen werden. Gespielte Partien gehen nicht verloren.`, 'Rückgängig')) return;
    try { await call('/identity/claims/undo', 'POST', { key: b.dataset.undoClaim }); say('Zuordnung rückgängig gemacht'); } catch (err) { say(err.message, true); }
    load();
  } else if (b.dataset.hideReview || b.dataset.hideRound) {
    const hide = b.dataset.hidden === '1', review = !!b.dataset.hideReview, id = b.dataset.hideReview || b.dataset.hideRound;
    if (hide && !await confirmDialog(review ? 'Rückblick ausblenden?' : 'Partie ausblenden?', review ? `„${b.dataset.label}“ verschwindet aus dem öffentlichen Archiv. Die Daten bleiben gespeichert.` : `Diese Partie (${b.dataset.label}) zählt danach in keiner Wertung mehr. Die Daten bleiben gespeichert.`, 'Ausblenden')) return;
    try { await call(`/${review ? 'reviews' : 'rounds'}/${encodeURIComponent(id)}/hide`, 'POST', { hidden: hide }); say(hide ? 'Ausgeblendet' : 'Eingeblendet'); } catch (err) { bad(err); }
    loadTools();
  } else if (b.dataset.ticketSave) {
    const row = b.closest('tr');
    try { await call('/tickets/' + b.dataset.ticketSave, 'PATCH', { status: row.querySelector('select').value, revision: Number(row.dataset.revision) }); say('Ticket gespeichert'); } catch (err) { bad(err); }
    loadTickets().catch(bad);
  } else if (b.dataset.ticketComment) {
    const text = prompt('Kommentar der Verwaltung (öffentlich sichtbar):');
    if (!text) return;
    try { await call(`/tickets/${b.dataset.ticketComment}/comments`, 'POST', { text }); say('Kommentar gespeichert'); } catch (err) { bad(err); }
    loadTickets().catch(bad);
  } else if (b.dataset.ticketDelete) {
    if (!await confirmDialog('Ticket löschen?', `„${b.dataset.label}“ wird samt Kommentaren endgültig gelöscht.`, 'Löschen')) return;
    try { await call('/tickets/' + b.dataset.ticketDelete, 'DELETE'); say('Ticket gelöscht'); } catch (err) { bad(err); }
    loadTickets().catch(bad);
  } else if (b.hasAttribute('data-cancel-update')) {
    if (!await confirmDialog('Ankündigung zurücknehmen?', 'Das Banner verschwindet, neue Runden starten wieder.', 'Zurücknehmen')) return;
    try { await call('/update', 'DELETE'); say('Ankündigung zurückgenommen'); } catch (err) { say(err.message, true); }
    load();
  }
});
start();
