import { formatQuantity } from './engine.js';
import { notices, vocabulary } from './studio-text.js';

const endpoint = '/api/idle/studio';
const leaseKey = 'poker:studio:lease';
const markerKey = leaseKey + ':tab';
const uid = () => Array.from(crypto.getRandomValues(new Uint32Array(4)),
  (n) => n.toString(16).padStart(8, '0')).join('');
const day = 86_400_000;

export function mountStudio(root, { english, esc, played }) {
  const tr = (de, en) => english ? en : de;
  const title = 'Game Studio Tycoon';
  const name = (key) => vocabulary[key]?.[english ? 1 : 0] ?? key;
  const messageFor = (key) => notices[key]?.[english ? 1 : 0] ??
    tr('Aktion fehlgeschlagen. Prüfe die Eingaben und den Spielstand.', 'The action failed. Check your input and game state.');
  const locale = tr('de-DE', 'en-GB');
  const n = (value, scale = 0) => formatQuantity(String(value), { scale, locale });
  const money = (value) => n(value, 2) + ' ' + tr('Kredite', 'credits');
  const span = (ms) => {
    const seconds = Math.ceil(Math.max(0, ms) / 1000);
    return seconds >= 86400 ? n(Math.floor(seconds / 86400)) + ' ' + tr('Tage', 'days') :
      seconds >= 60 ? Math.floor(seconds / 60) + ' min ' + seconds % 60 + ' s' : seconds + ' s';
  };
  // Both games use the same non-secret window marker. Each game keeps its own lease.
  if (!window.name.startsWith('poker-hall-')) window.name = 'poker-hall-' + uid();
  const tab = window.name;
  let snapshot, tabId = 'projects', status = '', busy = false, ended = false;
  let form = {}, details = false, retry, phaseSeen, beat = 0;
  let pollPending = false, foregroundRevision = 0, pressedPointer;

  const section = (caption, html) => '<section class="gs-card"><h2>' + esc(caption) + '</h2>' + html + '</section>';
  const action = (label, data, reason = '') => '<button type="button" data-gs-action="' + esc(JSON.stringify(data)) +
    '"' + (reason ? ' aria-disabled="true" title="' + esc(reason) + '"' : '') + '>' + esc(label) + '</button>' +
    (reason ? '<small class="gs-lock">' + esc(reason) + '</small>' : '');
  const local = (label, key) => '<button type="button" data-gs-local="' + key + '">' + esc(label) + '</button>';
  const option = (label, value, selected) => '<option value="' + esc(String(value)) + '"' +
    (String(value) === String(selected) ? ' selected' : '') + '>' + esc(label) + '</option>';
  const select = (caption, field, values, selected, label = name) => '<label>' + esc(caption) + '<select name="' + field + '">' +
    values.map((key) => option(label(key), key, selected)).join('') + '</select></label>';
  const field = (caption, key, value, min, max) => '<label>' + esc(caption) + '<input name="' + key + '" type="number" required min="' + min +
    '" max="' + max + '" value="' + esc(String(value)) + '"></label>';
  const stat = (caption, value) => '<div><dt>' + esc(caption) + '</dt><dd>' + esc(String(value)) + '</dd></div>';
  const readonly = () => snapshot?.readOnly ? messageFor('lease-conflict') : '';

  function projects(data, at) {
    const rows = data.projects.map((p) => {
      const estimate = data.projections.find((row) => row.id === p.id);
      const gate = p.stage === 'gate';
      const duration = p.slot?.duration ?? 1;
      const paused = p.slot ? p.slot.end - p.slot.start - duration : 0;
      const ms = p.slot ? at - p.slot.start - paused +
        (p.plan.team === 1 ? Math.max(0, (data.order?.end ?? at) - at) : 0) : 0;
      const percentage = Math.max(0, Math.min(100, Math.floor(100 * ms / duration)));
      const reason = readonly() || (estimate.releaseBlock ? messageFor(estimate.releaseBlock) : '');
      return '<article class="gs-row"><div><strong>' + esc(p.plan.name) + '</strong><p>' +
        esc('Team ' + p.plan.team + ' · ' + name(p.stage)) + '</p></div>' +
        (p.slot ? '<progress max="100" value="' + percentage + '" aria-label="' + esc(tr('Projektfortschritt', 'Project progress')) +
          '"></progress><p>' + esc(span(p.slot.end - at)) + '</p>' : '') +
        (!p.slot && !gate ? '<p>' + esc(tr('Wartet auf Budget', 'Waiting for budget') + ' · ' + money(estimate.required)) + '</p>' : '') +
        (gate ? '<p>' + esc(tr('Bewertung', 'Rating') + ' ' + p.rating + '/100 · ' + tr('Restfehler', 'Remaining bugs') +
          ' ' + n(p.bugs, 3)) + '</p>' + action(tr('Veröffentlichen', 'Publish'), { type: 'release', id: p.id }, reason) +
          (p.bugs ? action(tr('Nachbessern', 'Polish'), { type: 'polish', id: p.id }, readonly()) : '') : '') +
        (!p.slot && estimate.locked && !gate ? action(tr('Budgetgrenze anheben', 'Raise budget limit'),
          { type: 'raise-limit', id: p.id, limit: Math.min(1e9, p.plan.limit * 2), qaLimit: Math.min(1e9, p.plan.qaLimit * 2) }, readonly()) : '') +
        action(tr('Projekt abbrechen', 'Cancel project'), { type: 'cancel', id: p.id }, readonly()) + '</article>';
    }).join('');
    if (!rows && !data.queue.length) return '<p>' + tr('Kein Projekt in Arbeit.', 'No project in progress.') + '</p>';
    return rows + data.queue.map((p) => '<article class="gs-row"><strong>' + esc(p.plan.name) + '</strong><p>' +
      esc(tr('Genehmigte Warteschlange', 'Approved queue') + ' · Team ' + p.plan.team) + '</p>' +
      action(tr('Aus Warteschlange nehmen', 'Remove queued project'), { type: 'cancel', id: p.id }, readonly()) + '</article>').join('');
  }

  function planner(data) {
    const lockedTarget = form.ref ? data.releases.find(({ id }) => id === Number(form.ref)) : undefined;
    const activeDeals = data.contracts.filter((row) => row.active).map((row) => row.id);
    const deal = activeDeals.includes(form.contract) && data.offers.find(({ id }) => id === form.contract);
    const genres = lockedTarget ? [lockedTarget.genre] : deal ? [deal.genre] : data.availableGenres;
    const genre = genres.includes(form.genre) ? form.genre : genres[0];
    const topics = lockedTarget ? [lockedTarget.topic] : data.pairs[genre];
    const sizes = deal ? [deal.size] : data.sizes;
    const hasQueue = data.research.templates;
    const blocked = snapshot.readOnly ? ' disabled' : '';
    const defaultTitle = tr('Projekt ', 'Project ') + data.nextProject;
    const teams = data.teams.filter((t) => t.id === 1 || data.staff.some(({ team }) => team === t.id)).map(({ id }) => id);
    const selected = (key, fallback) => form[key] ?? fallback;
    const type = lockedTarget ? form.kind : 'title';
    const size = sizes.includes(form.size) ? form.size : sizes[0];
    const selectedTeam = Number(form.team || teams[0]);
    const occupied = data.projects.some((row) => row.plan.team === selectedTeam) || data.lab?.team === selectedTeam;
    const quote = data.quotes.find((row) => row.team === selectedTeam &&
      row.size === size && row.depth === selected('depth', 'normal'));
    const tiers = Math.min(data.research.campaigns ? 20 : 10, Math.max(0, Math.trunc(Number(form.marketing) || 0)));
    const extras = ((data.platformFees[form.platform] ?? 0) + tiers * 120) * 100;
    return '<form data-gs-form="project"><div class="gs-form-grid">' +
      '<label>' + tr('Projekttitel', 'Project title') + '<input name="name" required maxlength="48" value="' +
      esc(selected('name', defaultTitle)) + '"></label>' +
      select(tr('Genre', 'Genre'), 'genre', genres, genre) +
      select(tr('Thema', 'Theme'), 'topic', topics, form.topic) +
      select(tr('Umfang', 'Scope'), 'size', sizes, size) +
      select(tr('Testtiefe', 'Test depth'), 'depth', ['rush', 'normal', 'thorough'], selected('depth', 'normal')) +
      (data.phase >= 3 ? select(tr('Zielgruppe', 'Audience'), 'audience', ['casual', 'core', 'family'], form.audience) +
        select(tr('Plattform', 'Platform'), 'platform', data.platforms, form.platform) +
        field(tr('Marketingstufen à 120 Kredite', 'Marketing tiers at 120 credits'), 'marketing', selected('marketing', 0), 0, data.research.campaigns ? 20 : 10) : '') +
      (data.phase >= 4 ? select('Team', 'team', teams, form.team, (id) => 'Team ' + id) : '') +
      (activeDeals.length && type === 'title' ? select(tr('Verlag', 'Publisher'), 'contract', ['', ...activeDeals], form.contract,
        (key) => key ? name(key) : tr('Eigenmarke', 'Own label')) : '') + '</div>' +
      (lockedTarget ? '<p>' + esc((type === 'sequel' ? tr('Fortsetzung zu ', 'Sequel to ') : tr('Pflegeprojekt für ', 'Maintenance for ')) + lockedTarget.name) +
        '</p>' + local(tr('Neuer Titel', 'New title'), 'clear') : '') +
      (data.phase >= 2 ? '<details' + (details ? ' open' : '') + '><summary>' + tr('Budget und Automation', 'Budget and automation') +
        '</summary><div class="gs-form-grid">' +
        field(tr('Gesamtbudget in Krediten', 'Total budget in credits'), 'limit', selected('limit', 1000000), 1, 1000000000) +
        (data.research.pipeline ? field(tr('QA-Budget je Schritt, 0 = offen', 'QA budget per step, 0 = no limit'), 'qaLimit',
          selected('qaLimit', 0), 0, 1000000000) : '') +
        (data.research.releaseRules && (!deal || data.research.publisherOffice) ? field(
          tr('Auto-Release ab Bewertung, 0 = manuell', 'Auto-publish rating, 0 = manual'), 'autoScore', selected('autoScore', 0), 0, 100) : '') +
        '</div></details>' : '') +
      (quote ? '<p class="gs-quote">' + esc(tr('Planwert ohne Wartezeit: ', 'Estimate before any waiting: ') +
        span(quote.duration) + ' · ' + money(BigInt(quote.cost) + BigInt(extras))) + '</p>' : '') +
      '<div class="gs-actions">' +
      (data.phase >= 2 ? local(tr('Vorlage Schnellstart', 'Quick-start template'), 'template-mini') +
        local(tr('Vorlage Qualität', 'Quality template'), 'template-small') : '') +
      '<button type="submit" value="start"' + (occupied ? ' disabled' : blocked) + '>' + tr('Projekt starten', 'Start project') + '</button>' +
      (hasQueue ? '<button type="submit" value="queue"' + (data.queue.length >= data.teams.length ? ' disabled' : blocked) +
        '>' + tr('Warteschlange genehmigen', 'Approve for queue') + '</button>' : '') +
      '</div>' + (occupied ? '<p class="gs-lock">' + tr('Das gewählte Team arbeitet bereits.', 'The selected team is already working.') + '</p>' : '') +
      (hasQueue && data.queue.length >= data.teams.length ? '<p class="gs-lock">' +
        tr('Die Warteschlange ist voll.', 'The queue is full.') + '</p>' : '') + '</form>';
  }

  function people(data) {
    const ref = tr('Person ', 'Person ');
    return data.teams.map((t) => {
      const staff = data.staff.filter((s) => s.team === t.id);
      const busyTeam = data.projects.some((p) => p.plan.team === t.id) || data.lab?.team === t.id;
      const full = staff.length >= 6 || data.staff.length >= data.staffLimit;
      const lock = readonly() || (busyTeam ? messageFor('studio-team') : '');
      return section('Team ' + t.id, '<p>' + esc(tr('Studio ', 'Studio ') + t.studio + ' · ' +
        tr('Lohn pro aktivem Platz und Sekunde: 0,12', 'Wage per active seat per second: 0.12')) + '</p>' +
        (t.id === 1 ? '<p>' + tr('Gründerplatz', 'Founder seat') + '</p>' : '') +
        staff.map((s) => '<article class="gs-row"><strong>' + esc(ref + s.id + ' · ' + name(s.role)) +
          '</strong><p>' + esc(tr('Stufe ', 'Level ') + s.skill) + '</p>' +
          action(tr('Schulen', 'Train'), { type: 'train', staff: s.id }, lock || (s.skill === 3 ? messageFor('locked') : '')) +
          action(tr('Entlassen', 'Dismiss'), { type: 'fire', staff: s.id }, lock) +
          data.teams.filter(({ id }) => id !== t.id).map(({ id }) =>
            action(tr('Wechsel zu Team ', 'Move to team ') + id, { type: 'move', staff: s.id, team: id }, lock ||
              (data.projects.some((p) => p.plan.team === id) || data.lab?.team === id ||
                data.staff.filter((person) => person.team === id).length >= 6 ? messageFor('studio-team') : ''))).join('') + '</article>').join('') +
        '<div class="gs-actions">' + data.roleList.map((role) =>
          action(tr('Einstellen · ', 'Hire · ') + name(role), { type: 'hire', role, team: t.id },
            readonly() || (full ? messageFor('studio-team') : ''))).join('') + '</div>' +
        (data.phase >= 3 && staff.some(({ role }) => role === 'research') ?
          action(tr('Forschungsauftrag starten', 'Start research assignment'), { type: 'lab', team: t.id },
            lock || (data.lab ? messageFor('studio-team') : '')) : ''));
    }).join('');
  }

  function portfolio(data) {
    const rows = data.releases.slice().reverse().map((item) => {
      const left = item.markets.reduce((sum, m) => sum + m.cap - m.sold, 0);
      const sold = item.markets.reduce((sum, m) => sum + m.sold, 0);
      const line = data.franchises.find(({ id }) => id === (item.franchise || item.id));
      return '<article class="gs-row"><div><strong>' + esc(item.name) + '</strong><p>' +
        esc(name(item.genre) + ' · ' + name(item.platform) + ' · Studio ' + item.studio) + '</p></div>' +
        '<p>' + esc(tr('Bewertung', 'Rating') + ' ' + item.rating + '/100 · ' + tr('Verkauft', 'Sold') + ' ' + n(sold) +
          ' · ' + tr('Restmarkt', 'Remaining market') + ' ' + n(left) + ' · ' + tr('Marge', 'Margin') + ' ' + money(item.margin)) + '</p>' +
        (line ? '<p>' + esc(line.name + ' · ' + tr('Teile', 'Entries') + ' ' + line.parts) + '</p>' : '') +
        (data.phase >= 4 ? action(tr('Fortsetzung planen', 'Plan a sequel'), { type: 'draft-sequel', id: item.id },
          readonly() || (item.rating < 80 || line && line.last !== item.id ? messageFor('studio-portfolio') : '')) +
          action(tr('Patch planen', 'Plan a patch'), { type: 'draft-patch', id: item.id },
            readonly() || (item.patched || !left ? messageFor('studio-portfolio') : '')) : '') + '</article>';
    }).join('');
    return section(tr('Endliche Absatzmärkte', 'Finite sales markets'),
      (data.phase >= 3 ? '<p>' + esc(tr('Trend dieser Woche: ', 'This week’s trend: ') + name(data.trend) +
        ' · ' + tr('Genre der letzten Titel: ', 'Genres of recent releases: ') + data.recentGenres.map(name).join(', ')) + '</p>' : '') +
      (rows || '<p>' + tr('Deine veröffentlichten Spiele erscheinen hier.', 'Your released games will appear here.') + '</p>'));
  }

  function expansion(data) {
    const studioRows = data.studios.map((id) => '<article class="gs-row"><strong>Studio ' + id + '</strong><p>' +
      esc(data.studiosWithReleases.includes(id) ? tr('Titel veröffentlicht', 'Release published') :
        tr('Erster Release steht aus', 'First release pending')) + '</p>' +
      (data.teams.length < data.teamLimit ? action(tr('Team aufbauen', 'Establish a team'), { type: 'team', studio: id }, readonly()) : '') +
      data.teams.filter((t) => t.studio !== id).map((t) => action(tr('Team hierher verlegen · ', 'Relocate team here · ') + t.id,
        { type: 'relocate', team: t.id, studio: id }, readonly() || (data.projects.some((p) => p.plan.team === t.id) ||
          data.lab?.team === t.id ? messageFor('studio-team') : ''))).join('') + '</article>').join('');
    return section(tr('Studios und Teams', 'Studios and teams'), studioRows +
      (data.studios.length < (data.phase === 4 ? 2 : 4) ? action(tr('Studio eröffnen', 'Open studio') + ' · ' +
        money([0, 1800000, 7200000, 16000000][data.studios.length]), { type: 'studio' }, readonly()) : '')) +
      section(tr('Verträge', 'Contracts'), data.offers.map((offer) => {
        const current = data.contracts.find(({ id }) => id === offer.id);
        return '<article class="gs-row"><strong>' + esc(name(offer.id)) + '</strong><p>' +
          esc(name(offer.genre) + ' · ' + name(offer.size) + ' · ≥ ' + offer.rating + ' · ' +
            tr('40 % Umsatz · Vorschuss ', '40% of sales · advance ') + money(offer.advance * 100)) + '</p>' +
          action(current?.active ? tr('Vertrag läuft', 'Contract active') : tr('Vertrag annehmen', 'Accept contract'),
            { type: 'sign', id: offer.id }, readonly() || (current?.active ? messageFor('studio-contract') : '')) + '</article>';
      }).join('')) + (data.phase === 5 ? section(tr('Engine-Lizenzen', 'Engine licences'), data.licensees.map((id) => {
        const row = data.licenses.find((r) => r.id === id);
        return '<article class="gs-row"><strong>' + esc(id[0].toUpperCase() + id.slice(1)) + '</strong>' +
          (row ? '<p>' + n(row.market.sold) + ' / ' + n(row.market.cap) + '</p>' :
            '<p>' + esc(tr('600 Kredite einmalig · danach begrenzter Absatz', '600 credits once · then finite sales')) + '</p>' +
            action(tr('Lizenz erteilen', 'Grant licence'), { type: 'license', id }, readonly())) + '</article>';
      }).join('')) : '');
  }

  function researchPanel(data) {
    return section(tr('Forschung und Technologie', 'Research and technology'),
      data.researchOffers.map((row) => '<article class="gs-row"><strong>' + esc(name(row.key)) + '</strong><p>' +
        esc(row.points + ' ' + tr('Forschungspunkte', 'research points') + ' · ' + money(row.cost * 100)) + '</p>' +
        action(tr('Erforschen · ', 'Research · ') + name(row.key), { type: 'research', id: row.key }, readonly() ||
          (row.prereq && !data.research[row.prereq] ? tr('Benötigt ', 'Requires ') + name(row.prereq) :
            data.researchPoints < row.points ? messageFor('studio-research') :
              BigInt(data.budget) < BigInt(row.cost) * 100n ? messageFor('studio-budget') : '')) + '</article>').join('') +
      '<p>' + esc(tr('Erforscht: ', 'Researched: ') + Object.keys(data.research).map(name).join(', ')) + '</p>');
  }

  function finance(data, at) {
    return section(tr('Finanzen', 'Finances'), '<dl class="gs-stats">' +
      stat(tr('Freies Budget', 'Available budget'), money(data.budget)) + stat(tr('Reserviert', 'Reserved'), money(data.reserve)) +
      stat(tr('Bisher ausgegeben', 'Cash spent'), money(data.spent)) + stat(tr('Spieleumsatz', 'Game revenue'), money(data.salesRevenue)) +
      stat(tr('Lizenzumsatz', 'Licence revenue'), money(data.licenseRevenue)) +
      stat(tr('Vorschüsse', 'Advances'), money(data.advances)) + '</dl>' +
      '<p>' + (data.order ? esc(tr('Auftragsarbeit endet in ', 'Contract work ends in ') + span(data.order.end - at)) :
        tr('Kostenlose Auftragsarbeit bringt nach 60 Sekunden 150 Kredite und belegt in dieser Zeit den Gründerplatz.',
          'Free contract work takes 60 seconds, pays 150 credits and occupies the founder seat.')) + '</p>' +
      action(tr('Auftragsarbeit starten', 'Start contract work'), { type: 'side-job' },
        readonly() || (data.order ? messageFor('studio-stage') : '')));
  }

  function diagnosis(v) {
    const data = v.data;
    const blocked = data.projects.find((p) => !p.slot && p.stage !== 'gate');
    const gate = data.projects.find((p) => p.stage === 'gate');
    if (blocked) return tr('Das Projekt wartet auf eine volle Reservierung. Senke den Umfang im Folgeprojekt, passe die Budgetgrenze an oder nimm Auftragsarbeit an.',
      'The project needs a full reservation. Reduce the next project’s scope, change the limit or take contract work.');
    if (gate) return tr('Ein Projekt wartet auf Freigabe. Nachbessern kostet Zeit und Budget. Ein früher Release kann weniger verkaufen.',
      'A project awaits approval. Polishing takes time and budget. An early release may sell less.');
    if (data.phase === 1) return tr('Plane eine kurze Demo und entscheide nach der Testphase über die Veröffentlichung.',
      'Plan a short demo and decide whether to publish after testing.');
    if (data.phase === 2) return tr('Gute Genre-Passung und gründliche QA verbessern die Bewertung. Prüfe Rollen und Zeitbudget.',
      'Good genre fit and thorough QA improve ratings. Review the roles and time budget.');
    if (data.phase === 3) return tr('Jeder Markt läuft aus. Wechsle Genres oder erreiche mit Marketing mehr Publikum.',
      'Every market runs out. Rotate genres or reach more players with marketing.');
    if (data.phase === 4) return tr('Teams teilen das freie Budget. Starte nur finanzierte Projektphasen. Ein Verlag bietet einen Vorschuss.',
      'Teams share available cash. Fund each stage before it starts. A publisher can offer an advance.');
    return tr('Wachse mit Engine-Lizenzen und eigenen Studios. Wiederholte Reihen verlieren Reichweite.',
      'Grow with engine licences and your own studios. Repeated franchises lose reach.');
  }

  function opened(v) {
    const data = v.data;
    const panels = [['projects', tr('Projekte', 'Projects')], ['market', tr('Veröffentlichungen', 'Releases')], ['finance', tr('Finanzen', 'Finances')]];
    if (data.phase >= 2) panels.push(['people', tr('Personal', 'Staff')], ['research', tr('Forschung', 'Research')]);
    if (data.phase >= 4) panels.push(['expansion', tr('Ausbau', 'Expansion')]);
    const builders = { projects: () => section(tr('Projekte', 'Projects'), projects(data, v.at)) +
      section(tr('Projekt planen', 'Plan a project'), planner(data)), market: () => portfolio(data),
    finance: () => finance(data, v.at), people: () => people(data), research: () => researchPanel(data), expansion: () => expansion(data) };
    if (!panels.some(([id]) => id === tabId)) tabId = 'projects';
    const current = snapshot.readOnly ? tr('Nur Ansicht', 'Read only') :
      snapshot.unsavedActions ? tr('Ungespeicherte Aktionen', 'Unsaved actions') :
        snapshot.savedAt === null ? tr('Neues Spiel · ungespeichert', 'New game · unsaved') : tr('Gespeichert · Rev. ', 'Saved · rev. ') + snapshot.revision;
    const save = snapshot.readOnly ? local(tr('Schreibsitzung übernehmen', 'Take over writing session'), 'takeover') :
      local(tr('Speichern', 'Save'), 'save') + local(tr('Speichern & exportieren', 'Save & export'), 'export') +
      '<label class="gs-file">' + tr('Datei importieren', 'Import file') + '<input type="file" data-gs-import accept=".spieleabend,.txt"></label>';
    const targets = v.progress.map((goal) => '<li><span>' + (goal.met ? '✓ ' : '○ ') + esc(name(goal.key)) +
      '</span><strong>' + (goal.target === true ? (goal.met ? tr('Erfüllt', 'Met') : tr('Offen', 'Open')) :
        n(goal.current ?? 0) + ' / ' + n(goal.target)) + '</strong></li>').join('');
    return '<header class="gs-header"><div><p class="gs-kicker">' + esc(name(v.phase.id)) + '</p><h1>' + title +
      '</h1><p class="gs-save-status">' + esc(current) + '</p></div><div class="gs-actions">' + save +
      (snapshot.revision ? local(tr('Bestätigte Datei', 'Confirmed file'), 'download') : '') +
      '</div><dl class="gs-stats">' + stat(tr('Budget', 'Budget'), money(data.budget)) +
      stat(tr('Gebunden', 'Reserved'), money(data.reserve)) + stat('Fans', n(data.fans)) +
      stat(tr('Ruf', 'Reputation'), n(data.reputation)) + (data.phase >= 2 ? stat(tr('Forschung', 'Research'), n(data.researchPoints)) : '') +
      '</dl></header><div class="gs-layout"><div class="gs-overview">' +
      '<section class="gs-scene" aria-label="' + tr('Studioübersicht', 'Studio overview') +
      '"><div class="gs-lamp" aria-hidden="true">✧</div><div class="gs-desks">' +
      data.studios.map((id) => {
        const teams = data.teams.filter((t) => t.studio === id).length;
        return '<article><span aria-hidden="true">▣</span><h2>Studio ' + id + '</h2><p>' +
          esc(teams + ' ' + (teams === 1 ? tr('Team', 'team') : tr('Teams', 'teams'))) + '</p></article>';
      }).join('') +
      '</div></section>' +
      section(data.complete ? tr('Alle Abschlussziele erreicht', 'All completion goals met') : v.next ?
        tr('Nächstes Ziel · ', 'Next goal · ') + name(v.next) : tr('Abschlussziele', 'Completion goals'),
      '<ul class="gs-goals">' + targets + '</ul>') + section(tr('Engpass', 'Bottleneck'), '<p>' + esc(diagnosis(v)) + '</p>') +
      (data.phase < 4 && tabId !== 'finance' && !data.order ? action(tr('Auftragsarbeit starten', 'Start contract work'), { type: 'side-job' }, readonly()) : '') +
      (data.phase === 5 ? section(tr('Branchenruf', 'Industry prestige'), '<p>' +
        esc(n(data.prestige.points) + ' · +' + data.prestigeBonus.toLocaleString(locale) + ' % ' + tr('Arbeitsrate', 'work rate')) + '</p>' +
        (data.possibleClaims.length && !readonly() ? local(tr('Branchenruf-Vorschau', 'Industry prestige preview'), 'prestige') :
          '<p>' + tr('Kein neuer Rekordanspruch.', 'No new record reward.') + '</p>')) : '') +
      '</div><aside class="gs-controls"><div role="tablist" class="gs-tabs" aria-label="' + tr('Studiobereiche', 'Studio sections') + '">' +
      panels.map(([id, label]) => '<button type="button" id="gs-tab-' + id + '" role="tab" aria-controls="gs-panel" aria-selected="' +
        (id === tabId) + '" tabindex="' + (id === tabId ? '0' : '-1') + '" data-gs-tab="' + id + '">' + esc(label) + '</button>').join('') +
      '</div><div id="gs-panel" role="tabpanel" aria-labelledby="gs-tab-' + tabId + '">' + builders[tabId]() + '</div></aside></div>';
  }

  function render() {
    if (ended) return;
    const focused = root.contains(document.activeElement) ? document.activeElement : null;
    const key = ['data-gs-action', 'data-gs-local', 'data-gs-tab', 'data-gs-import', 'name'].find((attr) => focused?.hasAttribute(attr));
    const value = key && focused.getAttribute(key);
    const tabScroll = root.querySelector('.gs-tabs')?.scrollLeft ?? 0;
    const v = snapshot?.view;
    const active = snapshot?.sessionId && v;
    root.innerHTML = '<div class="gs-shell"' + (active ? ' data-phase="' + v.phase.id + '"' : '') +
      '><div role="status" class="gs-notice">' + esc(status) + (retry ? local(tr('Erneut senden', 'Retry'), 'retry') : '') + '</div>' +
      (active ? opened(v) : section(title, '<p>' +
        tr('Plane dein erstes Spiel und entwickle das Studio über fünf Phasen.', 'Plan your first game and grow the studio through five phases.') +
        '</p>' + (snapshot ? local(snapshot.revision ? tr('Bestätigten Stand öffnen', 'Open confirmed save') :
          tr('Studio starten', 'Start studio'), 'open') : local(tr('Ansicht neu laden', 'Reload view'), 'refresh')))) +
      '</div><dialog class="gs-dialog" aria-labelledby="gs-dialog-title" aria-describedby="gs-dialog-description"></dialog>';
    root.querySelector('.gs-tabs')?.scrollTo(tabScroll, 0);
    if (key) {
      const target = [...root.querySelectorAll('[' + key + ']')].find((el) => el.getAttribute(key) === value);
      (target ?? root.querySelector('[data-gs-local="save"], [data-gs-local="takeover"]'))?.focus({ preventScroll: true });
    }
  }

  async function request(path = '', body, token) {
    const headers = { Accept: 'application/json' };
    if (token) headers['X-Idle-Token'] = token;
    if (body) Object.assign(headers, { 'Content-Type': 'application/json', 'X-Requested-With': 'spieleabend' });
    let result;
    try { result = await fetch(endpoint + path, body ? { method: 'POST', body: JSON.stringify(body), headers } : { headers }); }
    catch { throw Object.assign(new Error('network'), { code: 'network' }); }
    const data = await result.json().catch(() => ({}));
    if (!result.ok) throw Object.assign(new Error('request'), { code: data.code, status: result.status });
    return data;
  }

  function adopt(value) {
    if (ended) return;
    snapshot = value;
    const phase = value.view?.phase.id;
    if (phaseSeen && phase && phase !== phaseSeen) status = tr('Freigeschaltet · ', 'Unlocked · ') + name(phase);
    phaseSeen = phase ?? phaseSeen;
    try {
      if (value.token) { sessionStorage.setItem(markerKey, tab); sessionStorage.setItem(leaseKey, value.token); }
      else sessionStorage.removeItem(leaseKey);
    } catch { /* the live lease remains available in memory */ }
  }
  async function refresh() {
    if (snapshot?.token) adopt(await request('', undefined, snapshot.token));
    else if (snapshot?.sessionId) adopt(await request('/session', {}));
    else if (sessionStorage.getItem(markerKey) === tab && sessionStorage.getItem(leaseKey)) {
      adopt(await request('', undefined, sessionStorage.getItem(leaseKey)));
    } else adopt(await request());
  }
  async function recover(err, current = () => !ended) {
    status = messageFor(err.code);
    if (err.code !== 'lease-conflict') return;
    sessionStorage.removeItem(leaseKey);
    try {
      const value = await request();
      if (current()) adopt(value);
    } catch { if (current()) snapshot = null; }
  }
  async function perform(fn, repaint = true) {
    if (busy || ended) return;
    foregroundRevision++;
    busy = true;
    try { await fn(); }
    catch (err) { await recover(err); repaint = true; }
    finally { busy = false; if (repaint) render(); }
  }
  function confirm(heading, paragraph, operation) {
    const dlg = root.querySelector('dialog');
    const trigger = document.activeElement;
    dlg.innerHTML = '<form method="dialog"><h2 id="gs-dialog-title">' + esc(heading) +
      '</h2><p id="gs-dialog-description">' + esc(paragraph) +
      '</p><div class="gs-actions"><button value="cancel" autofocus>' + tr('Abbrechen', 'Cancel') +
      '</button><button value="confirm">' + tr('Bestätigen', 'Confirm') + '</button></div></form>';
    dlg.returnValue = '';
    dlg.addEventListener('close', () => {
      if (trigger.isConnected) trigger.focus({ preventScroll: true });
      if (dlg.returnValue === 'confirm') operation();
    }, { once: true });
    dlg.showModal();
  }
  function download(file) {
    const href = URL.createObjectURL(new Blob([file], { type: 'text/plain' }));
    const anchor = document.createElement('a');
    anchor.href = href; anchor.download = 'studio-spielstand.spieleabend'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(href), 1500);
  }
  const fields = () => ({ id: uid(), revision: snapshot.revision, sessionVersion: snapshot.sessionVersion, token: snapshot.token });
  async function send(path, body) {
    retry = null;
    let result;
    try { result = await request(path, body); }
    catch (err) { if (err.code === 'network') retry = { path, body }; throw err; }
    if (result.file) download(result.file);
    status = path === '/actions' ? '' : tr('Bestätigt', 'Confirmed') + ' · Rev. ' + result.revision;
    await refresh();
  }
  function gameAction(data) {
    if (data.type.startsWith('draft-')) {
      const item = snapshot.view.data.releases.find(({ id }) => id === data.id);
      if (!item) return;
      form = { kind: data.type.slice(6), ref: data.id, genre: item.genre, topic: item.topic, size: item.size, platform: item.platform };
      tabId = 'projects'; render(); return;
    }
    if (!snapshot?.token) return;
    const run = () => perform(() => send('/actions', { ...fields(), action: data }));
    if (['cancel', 'fire'].includes(data.type)) confirm(tr('Aktion bestätigen', 'Confirm action'),
      tr('Diese Änderung wirkt sofort in deiner laufenden Sitzung.', 'This change applies immediately in your active session.'),
      () => { if (data.type === 'cancel') data.confirm = true; run(); });
    else run();
  }

  root.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || busy || button.getAttribute('aria-disabled') === 'true') return;
    if (button.dataset.gsTab) {
      tabId = button.dataset.gsTab; render();
      const selected = root.querySelector('#gs-tab-' + tabId);
      selected?.focus({ preventScroll: true });
      selected?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      return;
    }
    if (button.dataset.gsAction) { gameAction(JSON.parse(button.dataset.gsAction)); return; }
    switch (button.dataset.gsLocal) {
      case 'open': perform(async () => {
        adopt(await request('/session', {})); played();
        const interval = snapshot.settlement.to - snapshot.settlement.from;
        status = interval > 0 ? tr('Offline fortgeführt · ', 'Continued offline · ') +
          span(interval) + (interval >= day ? tr(' · Prüfe Releases und Projektstopps.', ' · Review sales and paused projects.') : '') : '';
      }); break;
      case 'refresh': perform(refresh); break;
      case 'save': case 'export': perform(() => send('/' + button.dataset.gsLocal, fields())); break;
      case 'download': perform(async () => download((await request('/export')).file)); break;
      case 'retry': { const old = retry; perform(() => send(old.path, old.body)); break; }
      case 'clear': form = {}; render(); break;
      case 'template-mini': case 'template-small':
        form = { ...form, size: button.dataset.gsLocal.slice(9), depth: button.dataset.gsLocal.endsWith('mini') ? 'rush' : 'thorough' };
        render(); break;
      case 'takeover':
        confirm(tr('Schreibsitzung übernehmen', 'Take over writing session'),
          tr('Ungespeicherte Aktionen aus dem anderen Tab gehen verloren.', 'Unsaved actions from the other tab will be discarded.'),
          () => perform(async () => {
            const { sessionId, sessionVersion, revision } = snapshot;
            adopt(await request('/takeover', { sessionId, sessionVersion, revision, confirm: true }));
            status = tr('Schreibsitzung übernommen.', 'Writing session transferred.');
          }));
        break;
      case 'prestige': {
        const claims = snapshot.view.data.possibleClaims;
        const awards = claims.map((key) => {
          const [type, count] = key.split('-'); return name(type) + ' ' + n(count);
        });
        confirm(tr('Branchenruf bestätigen', 'Confirm industry prestige'),
          tr('Neuer Branchenruf: ', 'New prestige: ') + claims.length + ' · ' + awards.join(', ') + '. ' +
          tr('Budget, Studios, Projekte und normale Forschung beginnen neu. Trophäen bleiben, Neustart wird gespeichert.',
            'Budget, studios, projects and regular research reset. Trophies remain and the restart is saved.'),
          () => perform(async () => {
            form = {}; tabId = 'projects'; await send('/prestige', { ...fields(), claims, confirm: true });
          }));
        break;
      }
    }
  });

  root.addEventListener('keydown', (event) => {
    const tabs = [...root.querySelectorAll('[role="tab"]')];
    const i = tabs.indexOf(event.target);
    if (i < 0) return;
    const next = { ArrowLeft: (i - 1 + tabs.length) % tabs.length, ArrowRight: (i + 1) % tabs.length, Home: 0, End: tabs.length - 1 };
    if (Object.hasOwn(next, event.key)) { event.preventDefault(); tabs[next[event.key]].click(); }
  });
  root.addEventListener('input', (event) => {
    if (event.target.form?.dataset.gsForm === 'project') form[event.target.name] = event.target.value;
  });
  root.addEventListener('change', (event) => {
    if (['genre', 'contract', 'team', 'size', 'depth', 'platform', 'marketing'].includes(event.target.name) &&
        event.target.form?.dataset.gsForm === 'project') { render(); return; }
    if (!event.target.matches('[data-gs-import]') || !event.target.files[0]) return;
    const file = event.target.files[0];
    event.target.value = '';
    perform(async () => {
      if (file.size > 350000) throw Object.assign(new Error('file'), { code: 'payload-too-large' });
      const { previewId, revision, savedAt } = await request('/import/preview', { token: snapshot.token, file: await file.text() });
      if (ended) return;
      if (!snapshot.unsavedActions) { status = tr('Diese Revision ist bereits aktiv.', 'This revision is already active.'); render(); return; }
      confirm(tr('Bestätigte Revision laden', 'Restore confirmed revision'),
        tr('Signatur, Spiel und Konto geprüft. Ungespeicherte Aktionen verwerfen und Revision ',
          'Signature, game and account verified. Discard unsaved actions and restore revision ') + revision +
        ' (' + new Date(savedAt).toLocaleString(locale) + ')?',
        () => perform(() => send('/import/confirm', { token: snapshot.token, previewId, confirm: true })));
    }, false);
  });
  root.addEventListener('toggle', (event) => {
    if (event.target.matches('[data-gs-form] details')) details = event.target.open;
  }, true);
  root.addEventListener('submit', (event) => {
    if (event.target.dataset.gsForm !== 'project') return;
    event.preventDefault();
    if (!snapshot?.token || busy) return;
    const data = new FormData(event.target);
    const payload = { type: event.submitter?.value || 'start',
      name: data.get('name'), genre: data.get('genre'), topic: data.get('topic'), size: data.get('size'),
      depth: data.get('depth'), audience: data.get('audience') || 'casual', platform: data.get('platform') || 'pc',
      marketing: Number(data.get('marketing') || 0), team: Number(data.get('team') || 1),
      limit: Number(data.get('limit') || 1e6), qaLimit: Number(data.get('qaLimit') || 0), autoScore: Number(data.get('autoScore') || 0),
      contract: data.get('contract') || '', kind: form.kind || 'title', ref: Number(form.ref || 0),
    };
    perform(async () => { await send('/actions', { ...fields(), action: payload }); form = {}; });
  });
  const unload = (event) => {
    if (snapshot?.unsavedActions && !snapshot.readOnly) { event.preventDefault(); event.returnValue = ''; }
  };
  window.addEventListener('beforeunload', unload);
  const press = (event) => {
    if (event.isPrimary && event.button === 0 && event.target.closest('button')) pressedPointer = event;
  };
  const release = (event) => {
    const pressEvent = pressedPointer;
    if (pressEvent?.pointerId !== event.pointerId) return;
    // Keep the button through the click that follows pointerup.
    setTimeout(() => { if (pressedPointer === pressEvent) pressedPointer = undefined; }, 0);
  };
  const clearPress = () => { pressedPointer = undefined; };
  root.addEventListener('pointerdown', press);
  window.addEventListener('pointerup', release, true);
  window.addEventListener('pointercancel', release, true);
  window.addEventListener('blur', clearPress);

  const canRefresh = () => !pressedPointer && !root.querySelector('dialog[open]') &&
    (!root.contains(document.activeElement) || !document.activeElement.closest('[data-gs-form], .gs-file'));
  const timer = setInterval(async () => {
    if (busy || pollPending || !snapshot?.sessionId) return;
    const token = snapshot.token;
    if (!token) {
      if (canRefresh()) perform(refresh);
      return;
    }
    // Foreground actions can run during a background read. Its response may
    // only replace the view if it still belongs to the same foreground state.
    const revision = foregroundRevision;
    const current = () => !ended && revision === foregroundRevision && canRefresh();
    pollPending = true;
    try {
      if (++beat % 12 === 0) await request('/session/heartbeat', { token });
      if (!current()) return;
      const value = await request('', undefined, token);
      if (!current()) return;
      adopt(value);
      render();
    } catch (err) {
      if (!current()) return;
      await recover(err, current);
      if (current()) render();
    } finally { pollPending = false; }
  }, 5000);
  perform(refresh);
  return {
    unsaved: () => Boolean(snapshot?.unsavedActions && !snapshot.readOnly),
    destroy() {
      ended = true;
      clearInterval(timer);
      root.removeEventListener('pointerdown', press);
      window.removeEventListener('pointerup', release, true);
      window.removeEventListener('pointercancel', release, true);
      window.removeEventListener('blur', clearPress);
      window.removeEventListener('beforeunload', unload);
    },
  };
}
