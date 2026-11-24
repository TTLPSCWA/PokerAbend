import { formatQuantity } from './engine.js';
import { errors, names } from './spielhalle-text.js';

const endpoint = '/api/idle/spielhalle';
const storage = 'poker:spielhalle:lease';
const tabStorage = storage + ':tab';
const coinsUnit = 1_000_000_000_000n, rateUnit = 1_000_000_000n;
const marks = { cards: '♣', dice: '⚄', chess: '♞', poker: '♠', arcade: '✦', blackjack: '♦',
  boardGames: '⬡', roulette: '◎', vipLounge: '★' };
const requestId = () => Array.from(crypto.getRandomValues(new Uint32Array(4)),
  (value) => value.toString(16).padStart(8, '0')).join('');

export function mountHall(root, { english, esc, played }) {
  // Opening a new window can clone sessionStorage from its opener. The
  // current window keeps its own non-secret marker across ordinary reloads.
  const tab = window.name.startsWith('poker-hall-') ? window.name : 'poker-hall-' + requestId();
  window.name = tab;
  const tr = (de, en) => english ? en : de;
  const name = (key) => names[key]?.[english ? 1 : 0] ?? key;
  const errorText = (code) => errors[code]?.[english ? 1 : 0] ?? tr('Verbindung oder Aktion fehlgeschlagen. Bitte erneut versuchen.', 'Connection or action failed. Try again.');
  const locale = english ? 'en-GB' : 'de-DE';
  const n = (value) => formatQuantity(String(value), { locale });
  const value = (amount, unit, places = 2) => {
    const v = BigInt(amount);
    const abs = v < 0n ? -v : v;
    return (v < 0n ? '−' : '') + formatQuantity(String(abs * 10n ** BigInt(places) / unit), { scale: places, locale });
  };
  const amount = (v, digits = 0) => value(v, coinsUnit, digits);
  const flow = (v, digits = 2) => value(v, rateUnit, digits) + '/s';
  const button = (caption, action, reason = '', style = '') =>
    '<span class="hall-option"><button type="button" class="hall-button ' + style + '" data-hall-action="' +
    esc(JSON.stringify(action)) + '"' + (reason ? ' aria-disabled="true" title="' + esc(errorText(reason)) + '"' : '') +
    '>' + esc(caption) + '</button>' + (reason ? '<small>' + esc(errorText(reason)) + '</small>' : '') + '</span>';
  const localButton = (label, action, style = '') => '<button type="button" class="hall-button ' + style +
    '" data-hall-local="' + esc(action) + '">' + esc(label) + '</button>';
  const section = (title, content, cls = '') => '<section class="hall-card ' + cls + '"><h2>' + esc(title) + '</h2>' + content + '</section>';
  const datum = (label, data) => '<div class="hall-datum"><dt>' + esc(label) + '</dt><dd>' + esc(data) + '</dd></div>';
  const title = tr('Die Spielhalle', 'The Game Hall');
  let snapshot, menu = 'stations', selected = 'altstadt', busy = false, disposed = false;
  let message = '', phaseMessage = '', failedOperation = null, lastPreview = null;
  let previousPhase = '', timer;

  async function request(path = '', data, token) {
    const headers = { Accept: 'application/json' };
    if (token) headers['X-Idle-Token'] = token;
    if (data !== undefined) {
      headers['Content-Type'] = 'application/json';
      headers['X-Requested-With'] = 'spieleabend';
    }
    const response = await fetch(endpoint + path, { credentials: 'same-origin', headers,
      ...(data !== undefined ? { method: 'POST', body: JSON.stringify(data) } : {}) });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(response.status), { code: json.code || 'invalid-action', path });
    return json;
  }

  function adopt(next) {
    if (disposed) return;
    snapshot = next;
    const phaseId = next.view?.phase.id;
    if (phaseId && previousPhase && phaseId !== previousPhase) {
      phaseMessage = tr('Freigeschaltet', 'Unlocked') + ' · ' + name(phaseId);
    }
    previousPhase = phaseId ?? previousPhase;
    try {
      if (next.token) { sessionStorage.setItem(tabStorage, tab); sessionStorage.setItem(storage, next.token); }
      else if (next.readOnly) sessionStorage.removeItem(storage);
    } catch { /* lease remains available in memory */ }
  }

  function intro() {
    const exists = snapshot?.revision > 0;
    return section(title, '<p>' + tr('Bediene Gäste und baue die Halle durch fünf Phasen aus.', 'Serve guests and grow through five phases.') +
      '</p><p>' + tr('Du speicherst von Hand. Offline läuft nur autorisierter Betrieb weiter.', 'Save manually. Only authorised operations continue offline.') +
      '</p>' + localButton(exists ? tr('Bestätigten Stand öffnen', 'Open confirmed save') : tr('Spiel starten', 'Start game'), 'open', 'primary'), 'hall-intro');
  }

  function header(data) {
    const status = snapshot.readOnly ? tr('Nur Ansicht', 'Read only') :
      snapshot.unsavedActions ? tr('Ungespeicherte Aktionen', 'Unsaved actions') :
      snapshot.savedAt === null ? tr('Neues Spiel · ungespeichert', 'New game · unsaved') : tr('Gespeichert', 'Saved') + ' · Rev. ' + snapshot.revision;
    return '<header class="hall-header"><div><p class="hall-kicker">' + esc(name(snapshot.view.phase.id)) +
      '</p><h1>' + title + '</h1><p class="hall-save-status"><span class="hall-status-dot"></span>' + esc(status) +
      '</p></div><div class="hall-save-actions">' +
      (snapshot.readOnly ? localButton(tr('Schreibsitzung übernehmen', 'Take over writing session'), 'takeover', 'primary') :
        localButton(tr('Speichern', 'Save'), 'save', 'primary') + localButton(tr('Speichern & exportieren', 'Save & export'), 'export')) +
      (snapshot.revision ? localButton(tr('Bestätigte Datei', 'Confirmed file'), 'download') : '') +
      (!snapshot.readOnly ? '<label class="hall-button hall-file"><span>' + tr('Datei importieren', 'Import file') +
        '</span><input type="file" data-hall-import accept=".spieleabend,.txt"></label>' : '') +
      '</div><dl class="hall-resources">' + datum(tr('Münzen', 'Coins'), amount(data.coins)) +
      datum(tr('Einnahmen', 'Income'), flow(data.rates.gross)) + datum(tr('Kosten', 'Costs'), flow(data.rates.costs)) +
      datum(tr('Netto', 'Net'), flow(data.rates.net)) + datum(tr('Gäste', 'Guests'), amount(data.guests)) +
      (data.phase >= 2 ? datum('Know-how', n(data.knowHow)) : '') + '</dl></header>';
  }

  function stage(loc, data) {
    const visible = loc.stations.filter((row) => row.owned);
    const scene = visible.map((row) => '<article class="hall-station' + (row.paused ? ' is-paused' : '') + '">' +
      '<span class="hall-station-icon" aria-hidden="true">' + marks[row.id] + '</span><strong>' + esc(name(row.id)) +
      '</strong><span>' + (row.manual ? (data.manualReady ? tr('Ein Gast wartet', 'One guest is waiting') : tr('Gast unterwegs', 'Guest on the way')) :
        row.owned - row.paused + '/' + row.owned + ' · ' + flow(row.served)) +
      '</span>' + (row.paused ? '<small>Standby · ' + row.paused + '</small>' : '') + '</article>').join('');
    return section(name(loc.profile), '<dl class="hall-local">' +
      datum(tr('Fläche', 'Space'), loc.space.used + ' / ' + loc.space.available) +
      datum(tr('Ruf', 'Reputation'), loc.tier + ' / 5 · ' + n(loc.reputation)) +
      datum(tr('Bedient', 'Served'), flow(loc.rates.served)) + '</dl><div class="hall-floor">' +
      scene + '</div>' + (data.phase >= 2 ? '<dl class="hall-queue">' + loc.segments.map((seg) =>
        datum(name(seg.id), tr('Wunsch', 'Demand') + ' ' + flow(seg.wanted) + ' · ' +
          tr('abgewiesen', 'turned away') + ' ' + flow(seg.refused))).join('') + '</dl>' : ''),
    'hall-stage' + (data.stars >= 30 ? ' hall-renowned' : ''));
  }

  function goals(data) {
    return section(data.complete ? tr('Alle Abschlussziele erreicht', 'All final goals achieved') :
      snapshot.view.next ? tr('Nächstes Ziel', 'Next goal') + ' · ' + name(snapshot.view.next) : tr('Abschlussziele', 'Final goals'),
    '<ul class="hall-goals">' + snapshot.view.progress.map(({ key, target, current, met }) =>
      '<li><span>' + esc(name(key)) + '</span><strong class="' + (met ? 'hall-met' : '') + '">' +
      (target === true ? (met ? tr('Erfüllt', 'Achieved') : tr('Offen', 'Open')) : n(current ?? 0) + ' / ' + n(target)) +
      '</strong></li>').join('') + '</ul>');
  }

  function diagnose(loc, data) {
    const row = loc.stations.find((entry) => entry.limit && BigInt(entry.wanted) > BigInt(entry.served));
    if (!row) return section(tr('Engpassdiagnose', 'Bottleneck'), '<p>' + tr('Alle angebotenen Plätze sind betriebsbereit. Beobachte Nachfrage und Nettoertrag.', 'Your open stations are ready. Watch demand and net income.') + '</p>');
    const seen = data.diagnosis?.site === loc.profile && data.diagnosis?.station === row.id;
    const staff = loc.staff.find((entry) => entry.role === row.limit);
    const actions = staff ? button(tr('Personal einstellen', 'Hire staff') + ' · ' + n(staff.cost),
      { type: 'hire', role: staff.role }, staff.reason) :
      button(tr('Station hinzufügen', 'Add station') + ' · ' + n(row.cost), { type: 'buy', station: row.id }, row.reason);
    return section(tr('Engpass', 'Bottleneck') + ' · ' + name(row.id) + ' · ' + name(row.limit),
      '<p>' + tr('Wunsch', 'Demand') + ' ' + flow(row.wanted) + ' · ' + tr('Platz', 'Capacity') + ' ' + flow(row.capacity) +
      ' · ' + tr('bedient', 'served') + ' ' + flow(row.served) + '</p><div class="hall-actions">' +
      (!seen && !snapshot.readOnly ? button(tr('Diagnose ansehen', 'Inspect bottleneck'), { type: 'diagnose', station: row.id }) : '') +
      (!snapshot.readOnly && seen ? actions + button(tr('Preisstufe erhöhen', 'Raise price tier'),
        { type: 'price', station: row.id, level: Math.min(5, row.price + 1) }, row.price === 5 ? 'locked' : '') : '') + '</div>');
  }

  const disabled = (reason) => snapshot.readOnly ? 'lease-conflict' : reason;
  function stations(loc, data) {
    return '<div class="hall-list">' + loc.stations.map((row) => '<article><div><h3>' + marks[row.id] + ' ' + esc(name(row.id)) +
      '</h3><p>' + row.owned + ' · ' + tr('Netto', 'Net') + ' ' + flow(row.net) + '</p></div><div class="hall-actions">' +
      button(tr('Bauen', 'Build') + ' · ' + n(row.cost), { type: 'buy', station: row.id }, disabled(row.reason)) +
      (row.owned && data.phase >= 2 ? '<div class="hall-prices" role="group" aria-label="' + tr('Preisstufe', 'Price tier') + ' · ' + esc(name(row.id)) + '">' +
        [1, 2, 3, 4, 5].map((level) => '<button type="button" class="hall-button" aria-pressed="' + (level === row.price) +
          '" data-hall-action="' + esc(JSON.stringify({ type: 'price', station: row.id, level })) + '"' +
          (snapshot.readOnly ? ' aria-disabled="true"' : '') + '>' + level + '</button>').join('') + '</div>' : '') +
      (row.owned - row.paused > row.protected ? button('Standby', { type: 'pause', station: row.id }, disabled('')) : '') +
      (row.paused ? '<div><p>' + tr('Reserve für Automatik', 'Automatic reopening reserve') + ' · ' + amount(row.restartReserve, 2) +
        '</p>' + button(tr('Wieder öffnen', 'Reopen') + ' · ' + flow(row.restartNet), { type: 'reopen', station: row.id }, disabled('')) + '</div>' : '') +
      (data.research.automation >= 1 && row.owned ? button(tr('Vorrang geben', 'Prioritise'), {
        type: 'priorities', pauseLosses: loc.pauseLosses, order: [row.id, ...loc.priority.filter((id) => id !== row.id)],
      }, disabled('')) : '') + '</div></article>').join('') + '</div>';
  }

  function personnel(loc) {
    return '<p>' + tr('Lohn fällt nur für zugewiesene Bedienkapazität an.', 'Wages apply only to allocated service capacity.') +
      '</p><div class="hall-list">' + loc.staff.map((staff) => '<article><h3>' + esc(name(staff.role)) + ' · ' +
      staff.count + '</h3><div class="hall-actions">' + button(tr('Einstellen', 'Hire') + ' · ' + n(staff.cost),
        { type: 'hire', role: staff.role }, disabled(staff.reason)) +
      (staff.count ? button(tr('Personal reduzieren', 'Reduce staff'), { type: 'release-staff', role: staff.role }, disabled('')) : '') +
      '</div></article>').join('') + '</div>';
  }

  function rooms(loc, data) {
    const labels = tr(['Raum 1', 'Raum 2', 'Raum 3', 'Etage 2', 'VIP-Etage 3'], ['Room 1', 'Room 2', 'Room 3', 'Floor 2', 'VIP floor 3']);
    return '<div class="hall-list">' + loc.rooms.map((room) => '<article><h3>' + labels[room.index] + ' · ' + room.size +
      '</h3>' + (room.open ? '<span>' + tr('Offen', 'Open') + '</span>' :
        button(tr('Ausbauen', 'Expand') + ' · ' + n(room.cost), { type: 'room', room: room.index }, disabled(room.reason))) +
      '</article>').join('') + '</div>' + button(tr('Komfort verbessern', 'Improve comfort') + ' · ' + data.prices.comfort,
      { type: 'comfort' }, disabled(loc.comfort ? 'already-open' : BigInt(data.coins) < BigInt(data.prices.comfort) * coinsUnit ? 'not-enough-coins' : ''));
  }

  function research(data) {
    return '<p>' + tr('200 bediente Gäste ergeben 1 Know-how. Schachgäste zählen dreifach.', 'Every 200 guests earn 1 know-how. Chess guests count triple.') +
      '</p><div class="hall-list">' + data.researchOffer.map((item) => '<article><div><h3>' + name(item.id) +
      '</h3><p>' + item.level + ' / 4</p></div>' + (item.name ? button(name(item.name) + ' · ' + n(item.cost),
        { type: 'research', branch: item.id }, disabled(item.available ? '' : item.level + 2 > data.phase ? 'locked' : 'not-enough-knowledge')) : '') +
      '</article>').join('') + '</div>';
  }

  function operation(loc, data) {
    const budget = (raw) => '<label>' + tr('Budget (Münzen)', 'Budget (coins)') + '<input name="budget" type="number" min="0" max="1000000000" step="1" required value="' + amount(raw).replace(/\D/g, '') + '"></label>';
    const submit = (caption) => '<button class="hall-button" type="submit"' + (snapshot.readOnly ? ' disabled' : '') + '>' + caption + '</button>';
    const list = '<div class="hall-actions">' + loc.events.map((event) => button(name(event.id) + ' · ' + n(event.cost),
      { type: 'event', event: event.id }, disabled(event.reason))).join('') + '</div>';
    const pause = data.research.automation ? '<p>' + tr('Dienstplan aktiv. Lege Vorrang an der Station fest.', 'Staff scheduling is available. Set priorities on a station.') +
      '</p>' + button(loc.pauseLosses ? tr('Verlustbremse ausschalten', 'Disable loss control') : tr('Verlustbringer pausieren', 'Pause loss-making stations'),
      { type: 'priorities', order: loc.priority, pauseLosses: !loc.pauseLosses }, disabled('')) : '';
    const marketing = data.research.automation >= 2 ? '<form class="hall-form" data-hall-form="marketing"><h3>Marketing · ' + amount(loc.marketing, 2) +
      '</h3>' + budget(loc.marketing) + submit(tr('Budget setzen', 'Set budget')) + '</form>' : '';
    const manager = data.phase === 5 && data.research.automation >= 3 ?
      '<form class="hall-form" data-hall-form="manager"><h3>' + tr('Filial-Manager', 'Branch manager') +
      '</h3><label>' + tr('Strategie', 'Strategy') + '<select name="strategy">' +
      ['', 'guests', 'margin', 'service'].map((id) => '<option value="' + id + '"' + (loc.manager?.strategy === id ? ' selected' : '') + '>' +
        (id ? name(id) : tr('Aus', 'Off')) + '</option>').join('') + '</select></label>' +
      budget(loc.manager?.budget ?? '0') + submit(tr('Strategie bestätigen', 'Confirm strategy')) + '</form>' : '';
    const controller = data.phase === 5 && data.research.automation >= 4 ?
      '<form class="hall-form" data-hall-form="controller"><h3>' + tr('Standort-Controller', 'Site controller') +
      '</h3><label><input name="restart" type="checkbox"' + (loc.controller?.restart ? ' checked' : '') + '> ' +
      tr('Sicherer automatischer Wiederanlauf', 'Safe automatic reopening') + '</label><label>' +
      tr('Zur Bauliste hinzufügen', 'Add to build queue') + '<select name="station"><option value="">—</option>' +
      loc.stations.map((row) => '<option value="' + row.id + '">' + name(row.id) + '</option>').join('') +
      '</select></label><p>' + (loc.controller?.queue.map(name).join(' → ') || tr('Bauliste leer', 'Build queue empty')) +
      '</p><label><input name="clear" type="checkbox"> ' + tr('Bauliste leeren', 'Clear build queue') + '</label>' +
      budget(loc.controller?.budget ?? '0') + submit(tr('Auftrag bestätigen', 'Confirm plan')) + '</form>' : '';
    return list + pause + marketing + manager + controller;
  }

  function panel(loc, data) {
    if (data.phase === 1) return section(tr('Aktionen', 'Actions'), '<div class="hall-actions">' +
      (!data.auto ? button(tr('Kartenrunde spielen', 'Play a card round') + '  +5', { type: 'manual' }, disabled(data.manualReady ? '' : 'guest-wait'), 'primary') +
      button(tr('Autogeber kaufen', 'Buy automatic dealer') + ' · 30', { type: 'auto' },
        disabled(BigInt(data.coins) >= 30n * coinsUnit ? '' : 'not-enough-coins')) +
        (BigInt(data.coins) < 30n * coinsUnit ? '<p>' + tr('Fehlbetrag für Autogeber', 'Still needed for the dealer') +
          ' · ' + amount(30n * coinsUnit - BigInt(data.coins)) + '</p>' : '') :
      '<p>' + tr('Der Autogeber bedient Gäste. Bei 100 Gästen öffnet die Spielhalle.', 'The dealer serves guests. The game hall opens at 100 guests.') + '</p>') +
      '</div>' + (data.stars >= 5 ? stations(loc, data) : ''));
    const menus = ['stations', 'personnelTab', 'rooms', 'research', 'operation'];
    const controls = { stations, personnelTab: personnel, rooms, research: (_loc, state) => research(state), operation };
    return section(name(menu), '<nav class="hall-tabs" aria-label="' + tr('Verwaltung', 'Management') + '">' +
      menus.map((id) => '<button type="button" class="hall-button" aria-pressed="' + (menu === id) +
        '" data-hall-menu="' + id + '">' + name(id) + '</button>').join('') + '</nav>' + controls[menu](loc, data));
  }

  function places(data) {
    if (data.phase < 4) return '';
    return section(tr('Standorte', 'Sites'), '<nav class="hall-tabs" aria-label="' + tr('Standort wählen', 'Choose a site') + '">' +
      data.locations.map((loc) => '<button type="button" class="hall-button" aria-pressed="' + (loc.profile === selected) +
        '" data-hall-site="' + loc.profile + '">' + name(loc.profile) + '</button>').join('') + '</nav>' +
      (data.locations.length < (data.phase === 4 ? 2 : 5) ? '<div class="hall-actions">' +
        data.locationOffer.map((id) => button(name(id) + ' · ' + n(data.prices.location), { type: 'location', profile: id },
          disabled(BigInt(data.coins) < BigInt(data.prices.location) * coinsUnit ? 'not-enough-coins' : ''))).join('') + '</div>' : ''));
  }

  function render() {
    if (disposed) return;
    const focus = root.contains(document.activeElement) ? document.activeElement : null;
    const selector = ['data-hall-action', 'data-hall-local', 'data-hall-menu', 'data-hall-site', 'data-hall-import', 'name'].find((key) => focus?.hasAttribute(key));
    const on = selector ? focus.getAttribute(selector) : null;
    const data = snapshot?.view?.data;
    const opening = !snapshot?.sessionId;
    const banner = '<div class="hall-notices" role="status" aria-live="polite">' +
      (phaseMessage ? '<p>' + esc(phaseMessage) + '</p>' : '') + (message ? '<p>' + esc(message) + '</p>' : '') +
      (failedOperation ? localButton(tr('Dieselbe Anfrage erneut senden', 'Retry the same request'), 'retry') : '') + '</div>';
    const body = !data || opening ? intro() : (() => {
      const loc = data.locations.find((item) => item.profile === selected) ?? data.locations[0];
      selected = loc.profile;
      return header(data) + places(data) + '<div class="hall-layout"><div class="hall-primary">' + stage(loc, data) + goals(data) +
        '</div><aside class="hall-secondary">' + panel(loc, data) + (data.phase >= 2 ? diagnose(loc, data) : '') +
        (data.phase === 5 ? section(tr('Renommee', 'Renown'), '<p>★ ' + data.stars + ' · ' +
          tr('Freiwilliger Neustart mit Rekordsternen.', 'Optional restart with record stars.') + '</p>' +
          (snapshot.readOnly || !data.prestige.length ? '<p>' + tr('Kein neuer Rekord verfügbar.', 'There is no new record to claim.') + '</p>' :
            localButton(tr('Renommee-Vorschau', 'Renown preview'), 'prestige'))) : '') + '</aside></div>';
    })();
    root.innerHTML = '<div class="hall-shell"' + (data ? ' data-phase="' + snapshot.view.phase.id + '"' : '') + '>' + banner + body + '</div><dialog class="hall-dialog" aria-labelledby="hall-dialog-title" aria-describedby="hall-dialog-description"></dialog>';
    if (selector) {
      const target = [...root.querySelectorAll('[' + selector + ']')].find((el) => el.getAttribute(selector) === on);
      (target ?? root.querySelector('[data-hall-local="save"], [data-hall-local="takeover"]'))?.focus({ preventScroll: true });
    }
  }

  function dialog(title, text, confirm, caption = tr('Bestätigen', 'Confirm')) {
    const host = root.querySelector('dialog');
    const trigger = document.activeElement;
    host.innerHTML = '<form method="dialog"><h2 id="hall-dialog-title">' + esc(title) +
      '</h2><p id="hall-dialog-description">' + esc(text) +
      '</p><div class="hall-actions"><button class="hall-button" value="cancel" autofocus>' + tr('Abbrechen', 'Cancel') +
      '</button><button class="hall-button primary" value="confirm">' + esc(caption) + '</button></div></form>';
    host.returnValue = '';
    host.addEventListener('close', () => {
      if (trigger.isConnected) trigger.focus({ preventScroll: true });
      if (host.returnValue === 'confirm') confirm();
    }, { once: true });
    host.showModal();
  }

  async function perform(fn) {
    if (busy || disposed) return;
    busy = true;
    try { await fn(); }
    catch (error) {
      message = error.code === 'revision-conflict' && !error.path?.startsWith('/import') ?
        tr('Die bestätigte Revision hat sich geändert. Lade die Ansicht neu.', 'The confirmed revision changed. Refresh the view.') : errorText(error.code);
      if (error.code === 'lease-conflict') message += ' ' + tr('Die nächste Sitzung ist lesend oder beginnt beim letzten Save.', 'The next session is read-only or starts at the last save.');
      if (error.code === 'lease-conflict') snapshot = { ...snapshot, readOnly: true, token: undefined };
    } finally { busy = false; render(); }
  }

  const operationFields = () => ({ id: requestId(), token: snapshot.token,
    revision: snapshot.revision, sessionVersion: snapshot.sessionVersion });
  async function reload() {
    const next = snapshot?.token ? await request('', undefined, snapshot.token) :
      snapshot?.sessionId ? await request('/session', {}) : await request();
    adopt(next);
  }

  function download(file) {
    const href = URL.createObjectURL(new Blob([file], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = href;
    link.download = 'spielhalle-spielstand.spieleabend';
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1500);
  }

  async function send(path, body) {
    failedOperation = null;
    let answer;
    try { answer = await request(path, body); }
    catch (error) {
      if (!error.code) failedOperation = { path, body };
      throw error;
    }
    if (answer.file) download(answer.file);
    if (['/save', '/export', '/prestige'].includes(path)) {
      snapshot = { ...snapshot, ...answer, unsavedActions: false };
      message = tr('Bestätigt', 'Confirmed') + ' · Rev. ' + answer.revision;
    } else message = '';
    await reload();
  }

  function action(eventAction, force = false) {
    if (!snapshot?.token || snapshot.readOnly || busy) return;
    const payload = { site: selected, ...eventAction };
    if (payload.type === 'reopen' && !force) {
      const row = snapshot.view.data.locations.find((loc) => loc.profile === selected).stations.find((item) => item.id === payload.station);
      if (BigInt(row.restartNet) < 0n) {
        dialog(tr('Wiederanlauf mit Verlust', 'Reopen at a loss'), tr('Neue Gesamtrate ', 'New total rate ') +
          flow(row.restartNet) + '. ' + tr('Möchtest du diese Kosten bewusst tragen?', 'Do you want to accept these costs?'),
        () => action({ ...payload, confirm: true }, true));
        return;
      }
    }
    perform(() => send('/actions', { ...operationFields(), action: payload }));
  }

  function open() {
    perform(async () => {
      adopt(await request('/session', {}));
      played();
      const { from, to } = snapshot.settlement;
      message = to > from ? tr('Offline-Zeit berechnet · noch nicht gespeichert.', 'Offline time settled · save to keep it.') : '';
    });
  }

  root.addEventListener('click', (event) => {
    const el = event.target.closest('button');
    if (!el || busy || el.getAttribute('aria-disabled') === 'true') return;
    if (el.dataset.hallMenu) { menu = el.dataset.hallMenu; render(); return; }
    if (el.dataset.hallSite) { selected = el.dataset.hallSite; render(); return; }
    if (el.dataset.hallAction) { action(JSON.parse(el.dataset.hallAction)); return; }
    switch (el.dataset.hallLocal) {
      case 'open': open(); break;
      case 'save': perform(() => send('/save', operationFields())); break;
      case 'export': perform(() => send('/export', operationFields())); break;
      case 'download': perform(async () => download((await request('/export')).file)); break;
      case 'retry': { const { path, body } = failedOperation; perform(() => send(path, body)); break; }
      case 'takeover':
        dialog(tr('Schreibsitzung übernehmen', 'Take over writing session'), tr('Dabei gehen ungespeicherte Aktionen aus dem anderen Tab verloren.', 'Unsaved actions in the other tab will be discarded.'), () => perform(async () => {
          const { sessionId, sessionVersion, revision } = snapshot;
          adopt(await request('/takeover', { sessionId, sessionVersion, revision, confirm: true }));
          message = tr('Schreibsitzung übernommen.', 'Writing session transferred.');
        }));
        break;
      case 'prestige': {
        const claims = snapshot.view.data.prestige;
        dialog(tr('Renommee bestätigen', 'Confirm renown'),
          tr('Du erhältst ', 'You receive ') + claims.length + tr(' neue Sterne. Münzen, Anlagen, Personal und operative Forschung beginnen neu. Deine Rekorde bleiben und der Neustart wird gespeichert.',
            ' new stars. Coins, facilities, staff and operating research reset. Your records remain and the restart is saved.'),
          () => perform(() => send('/prestige', { ...operationFields(), claims, confirm: true })));
        break;
      }
    }
  });

  root.addEventListener('submit', (event) => {
    const type = event.target.dataset.hallForm;
    if (!type) return;
    event.preventDefault();
    const form = new FormData(event.target);
    const loc = snapshot.view.data.locations.find((item) => item.profile === selected);
    const command = { type, budget: String(form.get('budget')) };
    if (type === 'manager') command.strategy = form.get('strategy');
    if (type === 'controller') {
      command.restart = form.has('restart');
      command.queue = form.has('clear') ? [] : [...(loc.controller?.queue ?? [])];
      if (form.get('station')) command.queue.push(form.get('station'));
    }
    action(command);
  });

  root.addEventListener('change', async (event) => {
    if (!event.target.hasAttribute('data-hall-import') || !event.target.files[0] || busy) return;
    const file = event.target.files[0];
    event.target.value = '';
    lastPreview = null;
    await perform(async () => {
      if (file.size > 350_000) throw Object.assign(new Error('file'), { code: 'payload-too-large' });
      lastPreview = await request('/import/preview', { token: snapshot.token, file: await file.text() });
      if (!snapshot.unsavedActions) message = tr('Diese Revision ist bereits aktiv.', 'This revision is already active.');
    });
    if (!lastPreview || !snapshot?.unsavedActions || disposed) return;
    const { previewId, revision } = lastPreview;
    lastPreview = null;
    dialog(tr('Ungespeicherte Aktionen verwerfen', 'Discard unsaved actions'),
      tr('Der bestätigte Stand wird erneut geladen. Die aktuelle Revision bleibt ', 'Reload the confirmed save. The current revision remains ') + revision + '.',
      () => perform(() => send('/import/confirm', { token: snapshot.token, previewId, confirm: true })));
  });

  const warnUnload = (event) => {
    if (snapshot?.unsavedActions && !snapshot.readOnly) { event.preventDefault(); event.returnValue = ''; }
  };
  window.addEventListener('beforeunload', warnUnload);
  let tick = 0;
  timer = setInterval(() => {
    if (disposed || busy || !snapshot?.sessionId || root.querySelector('dialog[open]') ||
        root.contains(document.activeElement) && document.activeElement.closest('form, .hall-file')) return;
    perform(async () => {
      if (snapshot.token && ++tick % 12 === 0) await request('/session/heartbeat', { token: snapshot.token });
      await reload();
    });
  }, 5000);
  perform(async () => {
    let token;
    try {
      if (sessionStorage.getItem(tabStorage) === tab) token = sessionStorage.getItem(storage);
      else sessionStorage.removeItem(storage);
    } catch { /* disabled */ }
    if (token) {
      try { adopt(await request('', undefined, token)); return; }
      catch (error) {
        if (error.code !== 'lease-conflict') throw error;
        try { sessionStorage.removeItem(storage); } catch { /* disabled */ }
        message = tr('Die vorherige Schreibsitzung ist abgelaufen. Nur bestätigte Aktionen sind dauerhaft.', 'The previous writing session expired. Only confirmed actions are permanent.');
      }
    }
    adopt(await request());
  });
  return {
    unsaved: () => Boolean(snapshot?.unsavedActions && !snapshot.readOnly),
    destroy() { disposed = true; clearInterval(timer); window.removeEventListener('beforeunload', warnUnload); },
  };
}
