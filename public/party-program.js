// Päckchen 7: eigener Dialog, damit Live-Updates die Playlist-Eingaben nicht überschreiben.
'use strict';
const PROGRAM_LABELS = { abend: 'Abend-Modus · alle Spiele', mix: 'Party-Mix', turnier: 'Party-Turnier', playlist: 'Eigene Playlist', team: 'Team-Duell' };
const programRunning = (S) => ['running', 'between'].includes(S.partyProgram?.status);
const programBusy = (S) => S.phase === 'playing' || !!(S.hand && !S.hand.done);
const programSeated = (S) => S.players ? S.players.filter((p) => p.seated) : S.seats.filter(Boolean);
const programGameOptions = (g, variant = 'classic') => variantMeta(g.id, variant)?.options || account.programOptions?.[g.id] || g.options || [];
const programGameName = (entry) => { const base = account.games.find((g) => g.id === entry.game)?.name || entry.game; return entry.variant && entry.variant !== 'classic' ? `${base} ${variantMeta(entry.game, entry.variant)?.name || entry.variant}` : base; };
const programGameSelect = (choices, selected) => ['karten', 'wuerfel', 'brett', 'party'].map((category, i) => {
  const games = choices.filter((g) => g.category === category);
  return games.length ? `<optgroup label="${['Kartenspiele', 'Würfelspiele', 'Brettspiele', 'Partyspiele'][i]}">${games.map((g) => `<option value="${g.id}" ${selected === g.id ? 'selected' : ''}>${esc(g.name)} (${g.minPlayers}–${g.maxPlayers})</option>`).join('')}</optgroup>` : '';
}).join('');
const copyProgram = (value) => JSON.parse(JSON.stringify(value));
let programDraft = null;
const programChoices = (mode = 'mix') => account.games.filter((g) => mode === 'abend' || g.category === 'party' && (mode !== 'team' || (account.partyTeamGames || []).includes(g.id)));
function programPresets() {
  const saved = store.get('poker:partyPlaylists', []);
  if (!Array.isArray(saved)) return [];
  return saved.filter((p) => p && Object.hasOwn(PROGRAM_LABELS, p.mode) && typeof p.name === 'string' && Array.isArray(p.entries))
    .slice(0, 10).map((p) => {
      const allowed = programChoices(p.mode);
      const entries = p.entries.filter((e) => e && allowed.some((g) => g.id === e.game)).slice(0, 12).map((e) => {
        const entry = programEntry(e.game, e.variant || 'classic');
        for (const o of programGameOptions(allowed.find((g) => g.id === e.game), entry.variant)) {
          const value = e.settings?.[o.key];
          if (o.type === 'bool' ? typeof value === 'boolean' : o.type === 'select' ? o.values.some((v) => v.value === value) : Number.isSafeInteger(value) && value >= o.min && value <= o.max) entry.settings[o.key] = value;
        }
        return entry;
      });
      return { name: p.name.slice(0, 40), mode: p.mode, entries, teams: p.teams && typeof p.teams === 'object' ? p.teams : {} };
    }).filter((p) => p.entries.length);
}
function assignProgramTeams() {
  const saved = programDraft.teams || {};
  programDraft.teams = Object.fromEntries(programSeated(lastState).map((p, i) => [p.id, ['a', 'b'].includes(saved[p.id]) ? saved[p.id] : i % 2 ? 'b' : 'a']));
}
function programEntry(game, variant = 'classic') {
  const settings = { ...(variantMeta(game, variant)?.defaults || account.partyDefaults?.[game] || {}) };
  if ('rounds' in settings) settings.rounds = 1;
  if ('target' in settings && programGameOptions(account.games.find((g) => g.id === game)).some((o) => o.key === 'target' && o.min === 0)) settings.target = 0;
  return { game, settings, ...(variant !== 'classic' ? { variant } : {}) };
}
function programControlsHTML(S) {
  const p = S.partyProgram, active = programRunning(S);
  return `<section class="program-controls" aria-label="Abendprogramm"><h3>Gemeinsamer Spieleabend</h3>
    <p class="hint">${p ? `${esc(p.config.name)} · ${PROGRAM_LABELS[p.config.mode]}` : 'Karten, Würfel, Brett und Partyspiele verbinden – mit gemeinsamer Abendwertung.'}</p>
    <button type="button" class="btn" data-program="plan" ${programBusy(S) || active ? 'disabled' : ''}>${p ? 'Programm neu planen' : 'Abendprogramm planen'}</button>
    ${p?.status === 'ready' ? '<button type="button" class="btn btn-brass" data-program="start">Programm starten</button>' : ''}
    ${p?.id && p.results.length ? `<button type="button" class="btn" data-review-open="${esc(p.id)}">Abend-Rückblick öffnen</button>` : ''}
    ${active && !programBusy(S) ? `<button type="button" class="btn btn-brass" data-program="next">${p.status === 'between' ? 'Nächstes Programm-Spiel' : 'Partie wiederholen'}</button>` : ''}
    ${p ? `<button type="button" class="btn" data-program="stand">Gesamtwertung ansehen</button>${p.status !== 'stopped' ? `<button type="button" class="btn btn-outline-red" data-program="stop" ${programBusy(S) ? 'disabled' : ''}>Programm beenden</button>` : ''}` : ''}</section>`;
}
function programStandHTML(S) {
  const p = S.partyProgram;
  if (!p) return '';
  const table = (list) => `<table class="standings"><thead><tr><th>Platz</th><th>Name</th><th class="num">${p.config.mode === 'abend' ? 'Abendpunkte' : 'Programmpunkte'}</th></tr></thead><tbody>${list.map((row) => `<tr><td>${1 + list.filter((other) => other.points > row.points).length}</td><td>${esc(row.name)}${row.team ? ` <small>· Team ${row.team === 'a' ? '1' : '2'}</small>` : ''}</td><td class="num">${row.points}</td></tr>`).join('')}</tbody></table>`;
  return `<section class="program-stand"><h3>${p.status === 'done' ? 'Siegerehrung' : p.config.mode === 'abend' ? 'Abend-Gesamtwertung' : 'Programm-Gesamtwertung'}</h3>
    ${p.status === 'done' ? `<p class="program-winners">${p.winners.length ? `★ ${esc(p.winners.join(' und '))} ${p.winners.length > 1 ? 'teilen sich den Sieg' : 'gewinnt'}!` : 'Das Programm ist beendet – ohne Sieger.'}</p>` : ''}
    ${p.config.mode === 'team' ? table([...p.teams].sort((a, b) => b.points - a.points)) : ''}${table(p.standings)}
    <p class="hint">Pro Spiel zählt die Platzierung: N Punkte für Platz 1 bei N Mitspielern, dann jeweils einer weniger. Gleichstände teilen sich den Platz.${p.config.mode === 'team' ? ' Die Einzelpunkte werden im Team addiert.' : ''} Zuschauer zählen nicht mit.</p>
    <ol class="program-results">${p.results.map((r) => `<li>${esc(programGameName(r))}: ${p.standings.filter((person) => person.id in r.points).map((person) => `${esc(person.name)} ${r.points[person.id]}`).join(' · ')}</li>`).join('')}</ol>${p.id && p.results.length ? `<button type="button" class="btn btn-brass" data-review-open="${esc(p.id)}">Abend-Rückblick öffnen</button>` : ''}</section>`;
}
function programBannerHTML(S) {
  const p = S.partyProgram;
  if (!p) return '';
  const status = p.status === 'done' ? 'Programm beendet · Siegerehrung' : p.status === 'stopped' ? 'Programm beendet' : p.status === 'ready' ? 'Programm vorbereitet' : `Spiel ${p.index + 1} von ${p.plan.length}${p.status === 'between' ? ' · bereit für das nächste Spiel' : ''}`;
  return `<section class="program-banner" aria-label="Aktuelles Abendprogramm"><div><b>${esc(p.config.name)}</b><small>${PROGRAM_LABELS[p.config.mode]} · ${status}</small></div><button type="button" class="btn" data-program="stand">Gesamtwertung</button>${S.you?.isHost && p.status === 'between' ? '<button type="button" class="btn btn-brass" data-program="next">Nächstes Programm-Spiel</button>' : ''}</section>`;
}
function programDialog() {
  let d = $('#program-dlg');
  if (!d) {
    d = document.createElement('dialog'); d.id = 'program-dlg'; d.className = 'dlg program-dlg'; document.body.appendChild(d);
    d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-program-close]')) d.close(); });
  }
  return d;
}
function openProgramPlan() {
  const S = lastState;
  if (!S?.you?.isHost || programBusy(S) || programRunning(S)) return;
  const party = account.games.find((g) => g.id === S.game)?.category === 'party';
  programDraft = S.partyProgram ? copyProgram(S.partyProgram.config) : { name: party ? 'Unser Party-Abend' : 'Unser Spieleabend', mode: party ? 'mix' : 'abend', entries: [programEntry(S.game)], teams: {} };
  assignProgramTeams();
  drawProgramPlan(); programDialog().scrollTop = 0; programDialog().showModal(); $('#program-name').focus();
}
function drawProgramPlan() {
  const d = programDialog(), choices = programChoices(programDraft.mode);
  const presets = programPresets();
  d.setAttribute('aria-labelledby', 'program-title'); d.removeAttribute('aria-label');
  const selected = programDraft.entries.map((e) => { const g = choices.find((g) => g.id === e.game); return variantMeta(e.game, e.variant) || g; }).filter(Boolean);
  const min = Math.max(...selected.map((g) => g.minPlayers)), max = Math.min(...selected.map((g) => g.maxPlayers));
  d.innerHTML = `<form id="program-form"><h2 id="program-title">Abendprogramm planen</h2>
    <p>Der Host startet das nächste Spiel mit einem Klick. Raum, Mitspieler und Gesamtwertung bleiben erhalten.</p>
    <label class="field"><span>Programmname</span><input id="program-name" maxlength="40" required value="${esc(programDraft.name)}"></label>
    <label class="field"><span>Modus</span><select id="program-mode">${Object.entries(PROGRAM_LABELS).map(([id, label]) => `<option value="${id}" ${programDraft.mode === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
    <p class="hint">${programDraft.mode === 'abend' ? `Alle ${programChoices('abend').length} Spiele in frei gewählter Reihenfolge. Eine abgeschlossene Spielrunde pro Station; Poker und Omaha zählen je eine Hand mit gleichen Startchips. Platzierungspunkte ergeben die Abendwertung.` : programDraft.mode === 'mix' ? 'Der Server mischt die gewählten Spiele zufällig.' : programDraft.mode === 'team' ? 'Alle antworten einzeln; ihre Platzierungspunkte werden im Team addiert. Gleich große Teams sind empfohlen.' : 'Die Spiele laufen in dieser Reihenfolge, mit Gesamtwertung und Siegerehrung.'}</p>
    <p class="notice">${min <= max ? `Diese Auswahl braucht ${min}–${max} Mitspieler. Am Tisch sitzen ${programSeated(lastState).length}.` : 'Die Spielerzahlen dieser Auswahl passen nicht zusammen. Wähle andere Spiele.'}</p>
    <div class="program-editor">${programDraft.entries.map((entry, i) => {
      const game = choices.find((g) => g.id === entry.game);
      const fields = (game ? programGameOptions(game, entry.variant) : []).map((o) => `<label class="${o.type === 'bool' ? 'toggle' : 'field'}"><span>${esc(o.label)}</span>${o.type === 'select' ? `<select data-program-setting="${esc(o.key)}" data-index="${i}">${o.values.map((v) => `<option value="${v.value}" ${entry.settings[o.key] === v.value ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select>` : `<input data-program-setting="${esc(o.key)}" data-index="${i}" type="${o.type === 'bool' ? 'checkbox' : 'number'}" ${o.type === 'bool' ? `role="switch" ${entry.settings[o.key] ? 'checked' : ''}` : `min="${o.min}" max="${o.max}" step="1" value="${Number.isFinite(entry.settings[o.key]) ? entry.settings[o.key] : o.min}"`}>`}</label>`).join('');
      return `<fieldset class="program-entry"><legend>Spiel ${i + 1}</legend><label class="field"><span>Spiel ${i + 1} auswählen</span><select data-program-game="${i}">${programGameSelect(choices, entry.game)}</select></label>
        ${(game?.variants || []).length > 1 ? `<label class="field"><span>Variante für Spiel ${i + 1}</span><select data-program-variant="${i}">${game.variants.map((v) => `<option value="${v.id}" ${v.id === (entry.variant || 'classic') ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label>` : ''}
        <details><summary>Rundenzahl, Zeiten & Regeln</summary><div class="program-options">${fields}</div></details>
        <div class="program-row-actions"><button type="button" class="btn" data-program-up="${i}" aria-label="Spiel ${i + 1} nach oben" ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" class="btn" data-program-down="${i}" aria-label="Spiel ${i + 1} nach unten" ${i === programDraft.entries.length - 1 ? 'disabled' : ''}>↓</button><button type="button" class="btn btn-outline-red" data-program-remove="${i}" ${programDraft.entries.length === 1 ? 'disabled' : ''}>Spiel entfernen</button></div></fieldset>`;
    }).join('')}</div><button type="button" class="btn" data-program-add ${programDraft.entries.length >= 12 ? 'disabled' : ''}>Spiel hinzufügen</button>
    ${programDraft.mode === 'team' ? `<fieldset class="program-teams"><legend>Teams einteilen</legend>${programSeated(lastState).map((p) => `<label class="field"><span>${esc(p.name)}</span><select data-program-team="${p.id}"><option value="a" ${programDraft.teams[p.id] === 'a' ? 'selected' : ''}>Team 1</option><option value="b" ${programDraft.teams[p.id] === 'b' ? 'selected' : ''}>Team 2</option></select></label>`).join('') || '<p>Setzt euch zuerst an den Tisch, um Teams einzuteilen.</p>'}</fieldset>` : ''}
    <section class="program-presets"><h3>Playlist-Vorlagen in diesem Browser</h3><button type="button" class="btn" data-program-preset-save>Als Vorlage speichern</button><label class="field"><span>Gespeicherte Playlist</span><select id="program-preset">${presets.map((p, i) => `<option value="${i}">${esc(p.name)}</option>`).join('') || '<option value="">Noch keine Vorlage</option>'}</select></label><button type="button" class="btn" data-program-preset-load ${presets.length ? '' : 'disabled'}>Vorlage laden</button></section>
    <p id="program-error" class="error" role="alert"></p><div class="dlg-actions"><button type="button" class="btn btn-ghost" data-program-close>Abbrechen</button><button type="submit" class="btn btn-brass">Programm übernehmen</button></div></form>`;
}
function updateProgramDraft(e) {
  if (!e.target.closest('#program-form') || !programDraft) return;
  const t = e.target;
  if (t.id === 'program-name') programDraft.name = t.value;
  if (t.dataset.programSetting) programDraft.entries[Number(t.dataset.index)].settings[t.dataset.programSetting] = t.type === 'checkbox' ? t.checked : t.tagName === 'SELECT' ? t.value : Number(t.value);
  if (t.dataset.programTeam) programDraft.teams[t.dataset.programTeam] = t.value;
}
document.addEventListener('input', updateProgramDraft);
document.addEventListener('change', (e) => {
  updateProgramDraft(e);
  if (e.target.dataset.programVariant !== undefined) { const i = Number(e.target.dataset.programVariant); programDraft.entries[i] = programEntry(programDraft.entries[i].game, e.target.value); drawProgramPlan(); }
  if (e.target.id === 'program-mode') {
    programDraft.mode = e.target.value;
    const ids = new Set(programChoices(programDraft.mode).map((g) => g.id));
    programDraft.entries = programDraft.entries.filter((entry) => ids.has(entry.game));
    if (!programDraft.entries.length) programDraft.entries = [programEntry([...ids][0])];
    drawProgramPlan(); $('#program-mode').focus();
  }
  if (e.target.dataset.programGame !== undefined) {
    const index = Number(e.target.dataset.programGame);
    programDraft.entries[index] = programEntry(e.target.value);
    drawProgramPlan(); $(`[data-program-game="${index}"]`).focus();
  }
});
document.addEventListener('submit', async (e) => {
  if (e.target.id !== 'program-form') return;
  e.preventDefault();
  const r = await send('programSave', programDraft);
  if (r?.ok) { programDialog().close(); $('.kg-over [data-kit="closeResult"]')?.click(); toast('Programm vorbereitet – jetzt kann der Host starten'); }
  else $('#program-error').textContent = r?.error || 'Programm konnte nicht gespeichert werden';
});
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-program], [data-program-add], [data-program-remove], [data-program-up], [data-program-down], [data-program-preset-save], [data-program-preset-load]');
  if (!b || b.disabled) return;
  const action = b.dataset.program;
  if (action === 'plan') return openProgramPlan();
  if (action === 'stand') {
    const d = programDialog(); d.setAttribute('aria-label', 'Programm-Gesamtwertung'); d.removeAttribute('aria-labelledby');
    d.innerHTML = programStandHTML(lastState) + '<button type="button" class="btn btn-brass" data-program-close>Schließen</button>'; d.showModal(); return;
  }
  if (action) {
    if (action === 'stop' && !await ask({ title: 'Abendprogramm beenden?', text: 'Die bisherigen Programmpunkte bleiben sichtbar. Ihr könnt danach frei weiterspielen oder neu planen.', ok: 'Beenden' })) return;
    return send({ start: 'programStart', next: 'programNext', stop: 'programStop' }[action]);
  }
  if (b.hasAttribute('data-program-add')) programDraft.entries.push(programEntry(programChoices(programDraft.mode)[0].id));
  if (b.dataset.programRemove !== undefined) programDraft.entries.splice(Number(b.dataset.programRemove), 1);
  const move = b.dataset.programUp !== undefined ? -1 : b.dataset.programDown !== undefined ? 1 : 0;
  if (move) {
    const from = Number(b.dataset.programUp ?? b.dataset.programDown), to = from + move;
    [programDraft.entries[from], programDraft.entries[to]] = [programDraft.entries[to], programDraft.entries[from]];
  }
  if (b.hasAttribute('data-program-preset-save')) {
    const list = programPresets();
    store.set('poker:partyPlaylists', [copyProgram(programDraft), ...list.filter((p) => p.name !== programDraft.name)].slice(0, 10)); toast('Playlist-Vorlage gespeichert');
  }
  if (b.hasAttribute('data-program-preset-load')) {
    const preset = programPresets()[Number($('#program-preset').value)];
    if (preset && PROGRAM_LABELS[preset.mode] && Array.isArray(preset.entries)) {
      programDraft = copyProgram(preset);
      const allowed = new Set(programChoices(programDraft.mode).map((g) => g.id));
      programDraft.entries = programDraft.entries.filter((entry) => allowed.has(entry.game)).slice(0, 12);
      if (!programDraft.entries.length) programDraft.entries = [programEntry([...allowed][0])];
      assignProgramTeams();
    }
  }
  drawProgramPlan();
  if (b.hasAttribute('data-program-preset-load')) { programDialog().scrollTop = 0; $('#program-name').focus(); }
});
socket.on('state', (S) => {
  const d = $('#program-dlg');
  if (d?.open && !$('#program-form') && S.partyProgram) d.innerHTML = programStandHTML(S) + '<button type="button" class="btn btn-brass" data-program-close>Schließen</button>';
});
