'use strict';
const EveningPlans = (() => {
  const validId = (id) => typeof id === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id);
  const known = () => { const ids = store.get('poker:planIds', []); return Array.isArray(ids) ? ids.filter(validId).slice(0, 100) : []; };
  const remember = (id) => { if (validId(id)) store.set('poker:planIds', [id, ...known().filter((v) => v !== id)].slice(0, 100)); };
  const labels = { open: 'Abstimmung offen', fixed: 'Termin steht', cancelled: 'Abgesagt' };
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const date = (at) => new Intl.DateTimeFormat('de-DE', { dateStyle: 'full', timeStyle: 'short' }).format(at);
  const localDate = (at) => { const d = new Date(at); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  let current = null, generation = 0, query = '', filter = 'all', pageNumber = 1, timer;
  const drafts = new Map();
  const active = (g) => g === generation && hubVisible() && route.page === 'planung';
  async function request(path, method = 'GET', data = {}) {
    const options = { method, credentials: 'same-origin', cache: 'no-store' };
    if (method !== 'GET') { options.headers = { 'Content-Type': 'application/json', 'X-Requested-With': 'spieleabend' }; options.body = JSON.stringify({ ...data, name: profile.name, avatar: profile.avatar }); }
    const response = await fetch('/api/plans' + path, options);
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Bitte melde dich erneut auf der Seite an');
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Die Anfrage ist fehlgeschlagen'); return result;
  }
  const errorHTML = (error) => `<p class="error" role="alert">${esc(error.message)}</p><button class="btn" data-plan-refresh>Erneut versuchen</button>`;
  async function loadList(g) {
    try {
      const data = await request('?' + new URLSearchParams({ q: query, status: filter, page: pageNumber, known: known().join(',') })); if (!active(g)) return;
      pageNumber = data.page; $('#plan-new').disabled = false;
      $('#plan-results').innerHTML = `<p class="hint">${data.total} Planung${data.total === 1 ? '' : 'en'}</p><div class="plan-cards">${data.items.map((p) => `<a class="plan-card" href="#planung/${p.id}"><small>${labels[p.status]}${p.private ? ' · Privater Link' : ''}${p.canManage ? ' · Von dir' : ''}</small><h2>${esc(p.title)}</h2><p>${esc(p.owner.avatar)} ${esc(p.owner.name)} · ${p.participants} Teilnehmer</p><p>${p.selected ? esc(date(p.slots.find((s) => s.id === p.selected.slot).at)) : `${p.slots.length} Terminvorschläge · ${p.games.length} Spiele`}</p></a>`).join('') || '<p>Noch keine passende Planung. Lade die Gruppe zum nächsten Spieleabend ein.</p>'}</div>
        ${data.pages > 1 ? `<nav class="plan-actions" aria-label="Planungsseiten"><button class="btn" data-plan-page="${data.page - 1}" ${data.page <= 1 ? 'disabled' : ''}>Zurück</button><span>Seite ${data.page}/${data.pages}</span><button class="btn" data-plan-page="${data.page + 1}" ${data.page >= data.pages ? 'disabled' : ''}>Weiter</button></nav>` : ''}`;
    } catch (error) { if (active(g)) $('#plan-results').innerHTML = errorHTML(error); }
  }
  function gameChoices(selected = []) {
    return ['karten', 'wuerfel', 'brett', 'party'].map((cat) => `<details><summary>${esc(catTitle(cat))}</summary><div class="plan-game-grid">${account.games.filter((g) => g.category === cat).map((g) => `<label><input type="checkbox" name="games" value="${esc(g.id)}" ${selected.includes(g.id) ? 'checked' : ''}> ${esc(g.name)}</label>`).join('')}</div></details>`).join('');
  }
  function ballotHTML(p) {
    const draft = drafts.get(p.id) || p.mine;
    return `<form id="plan-ballot" data-id="${p.id}"><h2>Deine Zusagen</h2><p class="hint">Alle Zeiten in ${esc(zone)}. Keine Angabe zählt als unbeantwortet.</p><div class="plan-slots">${p.slots.map((s) => `<label class="plan-slot"><span>${esc(date(s.at))}<small>${s.yes} Ja · ${s.maybe} Vielleicht · ${s.no} Nein</small></span><select class="input" name="answer:${s.id}" aria-label="Antwort für ${esc(date(s.at))}">${[['', 'Keine Angabe'], ['yes', 'Ja'], ['maybe', 'Vielleicht'], ['no', 'Nein']].map(([v, label]) => `<option value="${v}" ${draft.answers[s.id] === v ? 'selected' : ''}>${label}</option>`).join('')}</select></label>`).join('')}</div>
      <h2>Welche Spiele möchtest du spielen?</h2><div class="plan-game-grid">${p.games.map((g) => `<label><input type="checkbox" name="games" value="${esc(g.id)}" ${draft.games.includes(g.id) ? 'checked' : ''}><span>${esc(g.name)} <small>${g.votes} Stimme${g.votes === 1 ? '' : 'n'}</small></span></label>`).join('') || '<p>Noch keine Spiele vorgeschlagen.</p>'}</div><p class="hint">Speichere deine Antworten vor dem Aktualisieren.</p><p class="error" data-plan-error role="alert"></p><button class="btn btn-brass" type="submit">Meine Antworten speichern</button></form>`;
  }
  function peopleHTML(p) {
    const answer = { yes: 'Ja', maybe: 'Vielleicht', no: 'Nein' };
    return `<details class="plan-people"><summary>Zusagen im Detail (${p.participants})</summary><div class="plan-table" tabindex="0" aria-label="Teilnehmer und Terminantworten"><table class="standings"><thead><tr><th>Name</th>${p.slots.map((s, i) => `<th title="${esc(date(s.at))}">Termin ${i + 1}</th>`).join('')}</tr></thead><tbody>${p.people.map((person) => `<tr><td>${esc(person.avatar)} ${esc(person.name)}${person.mine ? ' (du)' : ''}</td>${p.slots.map((s) => `<td>${answer[person.answers[s.id]] || '–'}</td>`).join('')}</tr>`).join('')}</tbody></table></div><ol class="hint">${p.slots.map((s) => `<li>${esc(date(s.at))}</li>`).join('')}</ol><p class="hint">– bedeutet unbeantwortet.</p></details>`;
  }
  function manageHTML(p) {
    if (!p.canManage) return '';
    return `<section class="hub-block plan-manage"><h2>Planung verwalten</h2>${p.status === 'open' ? `<details><summary>Termin und Spiele festlegen</summary><form id="plan-finalize" data-id="${p.id}"><p>Die Festlegung schließt die Abstimmung. Du kannst sie später wieder öffnen.</p><fieldset><legend>Ein Termin</legend>${p.slots.map((s) => `<label class="plan-choice"><input type="radio" name="slot" value="${s.id}" required> ${esc(date(s.at))} <small>(${s.yes} Ja · ${s.maybe} Vielleicht)</small></label>`).join('')}</fieldset><fieldset><legend>1 bis 12 Spiele</legend><p class="hint">Reihenfolge nach Stimmen; am Tisch später anpassbar. Die Spiele brauchen eine gemeinsame Spielerzahl.</p>${p.games.map((g) => `<label class="plan-choice"><input type="checkbox" name="games" value="${esc(g.id)}"> ${esc(g.name)} <small>(${g.votes})</small></label>`).join('') || '<p>Schlagt zuerst Spiele vor.</p>'}</fieldset><p class="error" data-plan-error role="alert"></p><button class="btn btn-brass" type="submit">Termin und Spiele festlegen</button></form></details>` : `<button class="btn" data-plan-manage="reopen">Abstimmung wieder öffnen</button>`}
      <div class="plan-actions">${p.status !== 'cancelled' ? '<button class="btn btn-outline-red" data-plan-manage="cancel">Abend absagen</button>' : ''}<button class="btn btn-ghost" data-plan-delete>Planung löschen</button></div><p class="hint">Verwaltung und eigene Antworten werden in diesem Browser wiedererkannt. Ein gleicher Profilname verleiht keine Rechte; beim Löschen der Browser-Cookies geht die Zuordnung verloren.</p></section>`;
  }
  function detailHTML(p) {
    const selected = p.selected && p.slots.find((s) => s.id === p.selected.slot);
    return `<a class="btn btn-ghost" href="#planung">← Alle Planungen</a><section class="hub-head"><p>${labels[p.status]}${p.private ? ' · Privater Link' : ''}</p><h1>${esc(p.title)}</h1><p>Geplant von ${esc(p.owner.avatar)} ${esc(p.owner.name)} · ${p.participants} Teilnehmer</p></section><p class="plan-description">${esc(p.description)}</p>
      <div class="plan-actions"><button class="btn" data-plan-share="${p.id}">Link kopieren</button><button class="btn btn-ghost" data-plan-refresh>Aktualisieren</button></div>
      ${p.private ? '<p class="hint">Diese Planung fehlt in der allgemeinen Liste. Wer den Link und den Seitenzugang hat, kann teilnehmen.</p>' : ''}
      ${selected ? `<section class="plan-fixed"><h2>${esc(date(selected.at))}</h2><p>Zeitzone: ${esc(zone)}</p><ol>${p.selected.games.map((id) => `<li>${esc(p.games.find((g) => g.id === id).name)}</li>`).join('')}</ol><button class="btn btn-brass" data-plan-import>Abendprogramm vorbereiten</button><p class="hint">Erstellt ein vorbereitetes Abendprogramm. Die Partie startet der Tisch-Host, sobald die Mitspieler da sind.</p></section>` : ''}
      ${p.status === 'open' ? ballotHTML(p) : `<section class="hub-block"><h2>Abstimmung geschlossen</h2>${p.status === 'cancelled' ? '<p>Dieser Abend wurde abgesagt.</p>' : ''}<ul>${p.games.map((g) => `<li>${esc(g.name)} · ${g.votes} Stimme${g.votes === 1 ? '' : 'n'}</li>`).join('')}</ul></section>`}
      ${peopleHTML(p)}
      ${p.status === 'open' ? `<section class="hub-block"><h2>Ein Spiel vorschlagen</h2><form id="plan-propose" data-id="${p.id}" class="plan-propose"><label class="field"><span>Verfügbares Spiel</span><select name="game" class="input" aria-label="Verfügbares Spiel">${account.games.filter((g) => !p.games.some((v) => v.id === g.id)).map((g) => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('')}</select></label><button class="btn" type="submit" ${p.games.length >= 30 ? 'disabled' : ''}>Spiel vorschlagen</button><p class="error" data-plan-error role="alert"></p></form></section>` : ''}${manageHTML(p)}`;
  }
  function show(p) {
    if (!hubVisible() || route.page !== 'planung' || route.sub !== p.id) return;
    if (current?.id === p.id && current.revision > p.revision) return;
    ++generation; current = p; remember(p.id); $('#plan-body').innerHTML = detailHTML(p); document.title = `${p.title} – Abend planen · Spieleabend`;
  }
  async function loadDetail(id, g) {
    try { const { plan } = await request('/' + id); if (active(g)) show(plan); }
    catch (error) { if (active(g)) $('#plan-body').innerHTML = errorHTML(error); }
  }
  function page() {
    clearTimeout(timer); const g = ++generation; current = null;
    if (route.sub) { const id = route.sub; queueMicrotask(() => loadDetail(id, g)); return '<div id="plan-body" aria-live="polite"><p>Lade Planung …</p></div>'; }
    queueMicrotask(() => loadList(g));
    return `<section class="hub-head"><h1>Abend planen</h1><p>Termine finden, Zusagen sammeln und gemeinsam Spiele wählen.</p></section><div class="plan-actions"><button class="btn btn-brass" id="plan-new" data-plan-new disabled>Spieleabend planen</button></div><div class="plan-filters"><label class="field"><span>Planungen suchen</span><input class="input" id="plan-search" type="search" maxlength="80" value="${esc(query)}"></label><label class="field"><span>Status</span><select class="input" id="plan-filter" aria-label="Planungsstatus">${[['all', 'Alle'], ...Object.entries(labels)].map(([v, name]) => `<option value="${v}" ${filter === v ? 'selected' : ''}>${name}</option>`).join('')}</select></label></div><div id="plan-results" aria-live="polite"><p>Lade Planungen …</p></div>`;
  }
  function dialog(id, title) {
    let d = $('#' + id); if (!d) { d = document.createElement('dialog'); d.id = id; d.className = 'dlg plan-editor'; d.addEventListener('cancel', (e) => { if (d.dataset.busy === '1') e.preventDefault(); }); document.body.append(d); }
    d.setAttribute('aria-label', title); return d;
  }
  function addSlot() {
    const count = $$('.plan-slot-input').length; if (count >= 8) return;
    $('#plan-slot-editor').insertAdjacentHTML('beforeend', `<label class="plan-slot-edit"><span>Terminvorschlag ${count + 1}</span><input class="input plan-slot-input" type="datetime-local" aria-label="Terminvorschlag ${count + 1}" min="${localDate(Date.now())}" max="${localDate(Date.now() + 366 * 86400000)}" required><button class="btn btn-ghost" type="button" data-plan-slot-remove>Entfernen</button></label>`);
    $('#plan-slot-add').disabled = count + 1 >= 8;
  }
  function openEditor() {
    if (!profile.name) { openProfile(true); return; }
    const d = dialog('plan-editor', 'Spieleabend planen');
    d.innerHTML = `<form id="plan-create"><h2>Spieleabend planen</h2><label class="field"><span>Name des Abends</span><input class="input" name="title" minlength="3" maxlength="80" required></label><label class="field"><span>Beschreibung (optional)</span><textarea class="input" name="description" rows="3" maxlength="1000"></textarea></label><h3>Terminvorschläge</h3><p class="hint">1 bis 8 Termine innerhalb eines Jahres. Deine Zeitzone: ${esc(zone)}.</p><div id="plan-slot-editor"></div><button class="btn" id="plan-slot-add" data-plan-slot-add type="button">Termin hinzufügen</button><h3>Spiele zur Abstimmung (optional)</h3><div class="plan-game-picker">${gameChoices()}</div><label class="plan-choice"><input type="checkbox" name="private"> Nur über privaten Link auffindbar</label><p class="hint">Die Gruppe sieht Namen und Zusagen. Weitere Spiele können alle Teilnehmer vorschlagen.</p><p class="error" data-plan-error role="alert"></p><div class="dlg-actions"><button class="btn btn-ghost" type="button" data-plan-close>Abbrechen</button><button class="btn btn-brass" type="submit">Planung erstellen</button></div></form>`;
    addSlot(); d.showModal(); $('[name=title]', d).focus();
  }
  function readBallot(form) {
    const data = new FormData(form);
    return { answers: Object.fromEntries([...data].filter(([k, v]) => k.startsWith('answer:') && v).map(([k, v]) => [k.slice(7), v])), games: data.getAll('games'), revision: drafts.get(form.dataset.id)?.revision ?? current.mine.revision };
  }
  async function action(element, fn) {
    const button = element.matches('form') ? element.querySelector('button[type=submit]') : element;
    const d = element.closest('#plan-editor, #plan-import');
    if (button.disabled || d?.dataset.busy === '1') return;
    const buttons = d ? [...d.querySelectorAll('button')].map((b) => [b, b.disabled]) : [[button, false]];
    if (d) d.dataset.busy = '1'; buttons.forEach(([b]) => { b.disabled = true; });
    try { await fn(); }
    catch (error) { const field = $('[data-plan-error]', element); if (field) field.textContent = error.message; else toast(error.message, true); }
    finally { if (d) delete d.dataset.busy; buttons.forEach(([b, disabled]) => { if (b.isConnected) b.disabled = disabled; }); }
  }
  async function openImport() {
    const p = current, data = await request('/' + p.id + '/program'), d = dialog('plan-import', 'Abendprogramm vorbereiten');
    d.innerHTML = `<h2>Abendprogramm vorbereiten</h2><p>${esc(p.title)} · ${data.config.entries.length} Spiele</p><p>Regeln und Reihenfolge lassen sich anschließend unter „Host → Abendprogramm planen“ anpassen.</p><button class="btn btn-brass" data-plan-table="new">Neuen ${data.private ? 'privaten ' : ''}Tisch vorbereiten</button>${session && lastState?.you?.isHost && !programBusy(lastState) && !programRunning(lastState) ? `<button class="btn" data-plan-table="existing">An meinem Tisch vorbereiten${data.private ? ' (privat)' : ''}</button><p class="hint">Ein dort bereits vorbereitetes Programm wird ersetzt.</p>` : ''}<p class="error" data-plan-error role="alert"></p><button class="btn btn-ghost" data-plan-close>Abbrechen</button>`;
    d._planData = data; d.showModal();
  }
  document.addEventListener('submit', (e) => {
    const f = e.target; if (!['plan-create', 'plan-ballot', 'plan-propose', 'plan-finalize'].includes(f.id)) return;
    e.preventDefault(); action(f, async () => {
      const data = new FormData(f);
      if (f.id === 'plan-create') {
        const slots = $$('.plan-slot-input', f).map((input) => { const at = new Date(input.value).getTime(); if (!Number.isFinite(at) || localDate(at) !== input.value) throw new Error('Dieser Zeitpunkt existiert in deiner Zeitzone nicht. Bitte prüfe den Termin'); return at; });
        const { plan } = await request('', 'POST', { title: data.get('title'), description: data.get('description'), slots, games: data.getAll('games'), private: data.has('private') });
        remember(plan.id); f.closest('dialog').close(); location.hash = '#planung/' + plan.id; return;
      }
      const p = current;
      if (f.id === 'plan-ballot') { const ballot = readBallot(f); const result = await request('/' + p.id + '/vote', 'PUT', { answers: ballot.answers, games: ballot.games, voteRevision: ballot.revision }); drafts.delete(p.id); show(result.plan); toast('Deine Antworten sind gespeichert'); }
      if (f.id === 'plan-propose') show((await request('/' + p.id + '/games', 'POST', { game: data.get('game') })).plan);
      if (f.id === 'plan-finalize') { const games = data.getAll('games'); if (!games.length || games.length > 12) throw new Error('Wähle 1 bis 12 Spiele'); show((await request('/' + p.id, 'PATCH', { action: 'fix', revision: p.revision, slot: data.get('slot'), games })).plan); }
    });
  });
  document.addEventListener('input', (e) => {
    const ballot = e.target.closest('#plan-ballot'); if (ballot) drafts.set(ballot.dataset.id, readBallot(ballot));
    if (e.target.id !== 'plan-search') return;
    query = e.target.value; pageNumber = 1; clearTimeout(timer); const g = ++generation; timer = setTimeout(() => { if (active(g)) loadList(g); }, 200);
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'plan-filter') { filter = e.target.value; pageNumber = 1; loadList(++generation); }
  });
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-plan-new], [data-plan-close], [data-plan-slot-add], [data-plan-slot-remove], [data-plan-share], [data-plan-refresh], [data-plan-page], [data-plan-manage], [data-plan-delete], [data-plan-import], [data-plan-table]'); if (!b || b.disabled) return;
    if (b.hasAttribute('data-plan-new')) return openEditor();
    if (b.hasAttribute('data-plan-close')) return b.closest('dialog').close();
    if (b.hasAttribute('data-plan-slot-add')) return addSlot();
    if (b.hasAttribute('data-plan-slot-remove')) { if ($$('.plan-slot-input').length <= 1) return; b.closest('label').remove(); $$('.plan-slot-edit').forEach((label, i) => { $('span', label).textContent = 'Terminvorschlag ' + (i + 1); $('input', label).setAttribute('aria-label', 'Terminvorschlag ' + (i + 1)); }); $('#plan-slot-add').disabled = false; return; }
    if (b.hasAttribute('data-plan-refresh') || b.dataset.planPage) { const g = ++generation; if (route.sub) { drafts.delete(route.sub); loadDetail(route.sub, g); } else { if (b.dataset.planPage) pageNumber = Number(b.dataset.planPage); loadList(g); } return; }
    if (b.dataset.planShare) {
      const link = `${location.origin}/#planung/${b.dataset.planShare}`;
      try { await navigator.clipboard.writeText(link); toast('Planungslink kopiert'); } catch { ask({ title: 'Planungslink', text: 'Markiere und kopiere den Link.', ok: 'Fertig', input: { value: link, readOnly: true, noCancel: true, label: 'Planungslink' } }); } return;
    }
    action(b, async () => {
      const p = current;
      if (b.hasAttribute('data-plan-import')) return openImport();
      if (b.dataset.planTable) {
        const d = b.closest('dialog'), data = d._planData;
        if (b.dataset.planTable === 'new') {
          const created = await send('create', { game: data.config.entries[0].game, settings: data.config.entries[0].settings, name: profile.name, avatar: profile.avatar, unlisted: data.private });
          if (!created?.ok) return; enterGame(created);
        } else if (!await joinAndEnter(session.code)) return;
        const result = await send('programSave', data.config); if (!result?.ok) { d.close(); return; }
        if (data.private) await send('unlisted', { value: true }); d.close(); toast('Abendprogramm vorbereitet – lade die Mitspieler an den Tisch ein'); return;
      }
      if (b.hasAttribute('data-plan-delete')) { if (!await ask({ title: 'Planung löschen?', text: 'Die Planung mit allen Zusagen und Stimmen wird dauerhaft entfernt.', ok: 'Löschen', danger: true })) return; await request('/' + p.id, 'DELETE', { revision: p.revision }); drafts.delete(p.id); location.hash = '#planung'; return; }
      if (b.dataset.planManage) { if (b.dataset.planManage === 'cancel' && !await ask({ title: 'Abend absagen?', text: 'Die Abstimmung wird geschlossen. Du kannst sie später wieder öffnen.', ok: 'Abend absagen' })) return; show((await request('/' + p.id, 'PATCH', { action: b.dataset.planManage, revision: p.revision })).plan); }
    });
  });
  return { page, validId };
})();
