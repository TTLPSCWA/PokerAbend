// Rückblicke enthalten ausschließlich gewertete Ergebnisse des Abendprogramms.
'use strict';
const EveningReviews = (() => {
  const validId = (id) => typeof id === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id);
  const known = () => { const ids = store.get('poker:reviewIds', []); return Array.isArray(ids) ? ids.filter(validId).slice(0, 100) : []; };
  const remember = (id) => { if (validId(id)) store.set('poker:reviewIds', [id, ...known().filter((v) => v !== id)].slice(0, 100)); };
  const status = (s) => ({ done: 'Abgeschlossen', stopped: 'Vorzeitig beendet', running: 'Läuft noch', between: 'Läuft noch' })[s];
  const date = (n) => n ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(n) : 'Zeitpunkt nicht erfasst';
  const table = (headers, rows) => `<div class="review-table"><table class="standings"><thead><tr>${headers.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((v) => `<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  let generation = 0, current = null, query = '', pageNumber = 1, timer;
  const active = (g) => g === generation && hubVisible() && route.page === 'rueckblick';
  async function request(path) {
    const res = await fetch('/api/evenings' + path, { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (res.redirected || res.status === 401) throw new Error('Bitte erneut anmelden und den Rückblick öffnen.');
    const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Rückblick konnte nicht geladen werden.'); return data;
  }
  function failure(target, error) {
    target.innerHTML = I18n.html`<p class="error" role="alert">${esc(error.message)}</p><button type="button" class="btn" data-review-retry>Erneut versuchen</button>`;
  }
  async function loadList(g) {
    const target = $('#review-results'); if (!target) return;
    target.setAttribute('aria-busy', 'true');
    try {
      const data = await request('?' + new URLSearchParams({ q: query, page: pageNumber, known: known().join(',') }));
      if (!active(g)) return;
      target.innerHTML = I18n.html`<p class="hint">${data.total} Rückblick${data.total === 1 ? '' : 'e'}</p><div class="review-cards">${data.items.map((r) => I18n.html`<a class="review-card" href="#rueckblick/${r.id}"><span class="review-eyebrow">${esc(status(r.status))}${r.private ? ' · Privater Link' : ''}</span><h2>${esc(r.name)}</h2><p>${esc(date(r.startedAt))} · ${r.players} Mitspieler</p><p>${r.completed}/${r.planned} Stationen · ${esc([...new Set(r.games)].join(' · '))}</p>${r.winners.length ? `<strong>★ ${esc(r.winners.join(' & '))}</strong>` : ''}</a>`).join('') || I18n.html('<p>Noch kein abgeschlossener Spieleabend gefunden. Plane am Tisch unter „Host“ ein Abendprogramm.</p>')}</div>
        ${data.total > 20 ? I18n.html`<nav class="review-actions" aria-label="Rückblick-Seiten"><button class="btn" data-review-page="${pageNumber - 1}" ${pageNumber <= 1 ? 'disabled' : ''}>Zurück</button><span>Seite ${pageNumber} / ${Math.ceil(data.total / 20)}</span><button class="btn" data-review-page="${pageNumber + 1}" ${pageNumber * 20 >= data.total ? 'disabled' : ''}>Weiter</button></nav>` : ''}`;
    } catch (error) { if (active(g)) failure(target, error); }
    finally { if (active(g)) target.removeAttribute('aria-busy'); }
  }
  function momentText(m, r) {
    const names = m.players.map((key) => r.players.find((p) => p.key === key)?.name || I18n.t('Mitspieler')).join(' & ');
    return m.kind === 'opening' ? I18n.html`${names} ${m.players.length === 1 ? 'führt' : 'führen'} nach Station ${m.station}.`
      : m.kind === 'lead' ? I18n.html`${names} übernimmt nach Station ${m.station} die alleinige Führung.`
      : m.kind === 'tie' ? I18n.html`${r.winners.join(' & ')} teilen sich den Gesamtsieg.`
      : m.kind === 'close' ? I18n.html`Nur ${m.gap} Abendpunkt${m.gap === 1 ? '' : 'e'} zwischen Platz 1 und 2.`
      : I18n.html`${names} holt ${m.gap} Abendpunkte Rückstand auf und erreicht Platz 1.`;
  }
  function detailHTML(r) {
    const names = new Map(r.players.map((p) => [p.key, p]));
    return I18n.html`<a href="#rueckblick" class="btn btn-ghost">← Alle Rückblicke</a><section class="hub-head"><p class="review-eyebrow">${esc(PROGRAM_LABELS[r.mode])} · ${esc(status(r.status))}</p><h1>${esc(r.name)}</h1><p>${esc(date(r.startedAt))} · ${r.stations.length}/${r.planned} Stationen · ${r.players.length} Mitspieler</p></section>
      ${r.status !== 'done' ? I18n.html('<p class="notice">Zwischenstand: Nur abgeschlossene Stationen zählen. Für dieses Programm gibt es noch keinen Gesamtsieger.</p>') : `<p class="review-winner">${r.winners.length ? `★ ${esc(r.winners.join(' & '))} ${r.winners.length === 1 ? 'gewinnt' : 'teilen sich den Sieg'}!` : 'Beendet ohne Gesamtsieger.'}</p>`}
      <div class="review-actions"><button class="btn" type="button" data-review-share="${r.id}">Link kopieren</button><a class="btn" href="/api/evenings/${r.id}/export" download>Als Text speichern</a><button class="btn btn-ghost" type="button" data-review-retry>Aktualisieren</button></div>
      ${r.private ? I18n.html('<p class="hint">Privater Rückblick: nicht in der allgemeinen Liste. Wer diesen Link und den Zugang zur Seite hat, kann ihn ansehen.</p>') : ''}
      <section class="hub-block"><h2>Gesamtwertung</h2>${r.mode === 'team' ? table(['Team', 'Abendpunkte'], [...r.teams].sort((a, b) => b.points - a.points).map((p) => [esc(p.name), p.points])) : ''}
      ${table(['Platz', I18n.t('Name'), 'Abendpunkte'], r.standings.map((p) => [p.place, `${esc(p.avatar)} ${esc(p.name)}${p.team ? I18n.html` <small>· Team ${p.team === 'a' ? 1 : 2}</small>` : ''}`, p.points]))}<p class="hint">Platzierungspunkte pro Station; Gleichstände teilen sich den Platz. Die Rohwerte stehen bei den einzelnen Spielen.</p></section>
      <section class="hub-block"><div class="hub-block-head"><h2>Punkteverlauf</h2><label>Anzeige <select id="review-chart-choice" aria-label="Anzeige"><option value="top">${r.mode === 'team' ? 'Beide Teams' : 'Top 5'}</option>${r.mode !== 'team' ? I18n.html`<option value="all">Alle Mitspieler</option>${r.standings.map((p) => `<option value="${p.key}">${esc(p.name)}</option>`).join('')}` : ''}</select></label></div><div id="review-chart"></div></section>
      <section class="hub-block"><h2>Besondere Momente</h2><ul class="review-moments">${r.moments.map((m) => `<li>${esc(momentText(m, r))}</li>`).join('') || I18n.html('<li>Noch keine besonderen Momente in den gewerteten Ergebnissen.</li>')}</ul><p class="hint">Aus den Abendpunkten berechnet.</p></section>
      <section class="hub-block"><h2>Die Spiele</h2><div class="review-stations">${r.stations.map((s) => I18n.html`<details><summary>${s.index + 1}. ${esc(s.gameName)} <span>${esc(date(s.at))}</span></summary><p>Rohwert: ${esc(s.scoreLabel)}${s.lowWins ? ' · Weniger ist besser.' : ''}</p>${table([I18n.t('Name'), 'Rohwert', 'Abendpunkte'], s.values.map((v) => [esc(names.get(v.player)?.name || I18n.t('Mitspieler')) + (v.won ? ' ★' : ''), v.raw, v.points]))}</details>`).join('')}</div></section>`;
  }
  function drawChart() {
    const r = current, target = $('#review-chart'); if (!r || !target) return;
    const choice = $('#review-chart-choice').value;
    const series = r.mode === 'team' ? r.teams : choice === 'top' ? r.standings.slice(0, 5) : r.standings.filter((p) => choice === 'all' || p.key === choice);
    const points = (p) => r.timeline.map((t) => r.mode === 'team' ? r.players.filter((v) => v.team === p.key).reduce((sum, v) => sum + t.scores[v.key], 0) : t.scores[p.key]);
    const max = Math.max(1, ...series.flatMap(points)), x = (i) => 90 + i * 585 / (r.timeline.length - 1), y = (n) => 220 - n * 190 / max;
    const axisLabel = (n) => (n >= 1000 ? n / 1000 : n).toLocaleString(I18n.locale, { maximumFractionDigits: 1 }) + (n >= 1000 ? 'k' : '');
    target.innerHTML = I18n.html`<svg viewBox="0 0 710 265" role="img" aria-labelledby="review-chart-title review-chart-desc"><title id="review-chart-title">Abendpunkte nach jeder Station</title><desc id="review-chart-desc">${esc(series.map((p) => I18n.html`${p.name}: ${points(p).join(', ')} Abendpunkte`).join('. '))}</desc>
      ${[0, 0.5, 1].map((f) => `<path d="M90 ${y(max * f)}H675" stroke="currentColor" opacity=".15"/><text x="80" y="${y(max * f) + 4}" text-anchor="end">${axisLabel(max * f)}</text>`).join('')}
      ${r.timeline.map((t, i) => `<text x="${x(i)}" y="245" text-anchor="middle">${t.station}</text>`).join('')}
      ${series.map((p, i) => `<polyline points="${points(p).map((n, j) => `${x(j)},${y(n)}`).join(' ')}" fill="none" stroke="hsl(${(i * 137 + 42) % 360} 65% 65%)" stroke-width="3" ${i % 2 ? 'stroke-dasharray="7 3"' : ''}/>`).join('')}</svg>
      <ul class="review-legend">${series.map((p, i) => `<li><span style="background:hsl(${(i * 137 + 42) % 360} 65% 65%)" aria-hidden="true"></span>${esc(p.name)}</li>`).join('')}</ul><p class="hint">Station 0 ist der Start. Die Einzelwerte stehen unter „Die Spiele“.</p>`;
  }
  async function loadDetail(id, g) {
    const target = $('#review-body');
    try { const r = await request('/' + id); if (!active(g)) return; remember(id); current = r; target.innerHTML = detailHTML(r); drawChart(); document.title = I18n.html`${r.name} – Rückblick · Spieleabend`; }
    catch (error) { if (active(g)) failure(target, error); }
  }
  function page() {
    clearTimeout(timer); const g = ++generation; current = null;
    if (route.sub) { const id = route.sub; queueMicrotask(() => loadDetail(id, g)); return I18n.html('<div id="review-body" aria-live="polite"><p>Lade Rückblick …</p></div>'); }
    queueMicrotask(() => loadList(g));
    return I18n.html`<section class="hub-head"><h1>Abend-Rückblick</h1><p>Gemeinsame Abende, Ergebnisse und besondere Momente.</p></section><label class="field review-search"><span>Rückblicke suchen</span><input id="review-search" type="search" maxlength="80" placeholder="Abend, Spiel oder Mitspieler" value="${esc(query)}"></label><div id="review-results" aria-live="polite"><p>Lade Rückblicke …</p></div>`;
  }
  function open(id) {
    if (!validId(id)) return; remember(id);
    document.querySelectorAll('dialog[open]').forEach((d) => d.close());
    if (!hubVisible()) parkRoom();
    location.hash = '#rueckblick/' + id;
  }
  socket.on('state', (S) => { if (S.partyProgram?.results?.length) remember(S.partyProgram.id); });
  document.addEventListener('input', (e) => {
    if (e.target.id !== 'review-search') return;
    query = e.target.value; pageNumber = 1; clearTimeout(timer); const g = ++generation;
    timer = setTimeout(() => { if (active(g)) loadList(g); }, 200);
  });
  document.addEventListener('change', (e) => { if (e.target.id === 'review-chart-choice') drawChart(); });
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-review-open], [data-review-retry], [data-review-page], [data-review-share]'); if (!b || b.disabled) return;
    if (b.dataset.reviewOpen) return open(b.dataset.reviewOpen);
    if (b.dataset.reviewShare) {
      const link = I18n.html`${location.origin}/#rueckblick/${b.dataset.reviewShare}`;
      try { await navigator.clipboard.writeText(link); toast('Rückblick-Link kopiert'); }
      catch { ask({ title: 'Rückblick-Link', text: 'Markiere und kopiere den Link.', ok: I18n.t('Fertig'), input: { value: link, readOnly: true, noCancel: true, label: 'Rückblick-Link' } }); }
      return;
    }
    if (b.dataset.reviewPage) pageNumber = Number(b.dataset.reviewPage);
    const g = ++generation; if (route.sub) loadDetail(route.sub, g); else loadList(g);
  });
  return { page, open, validId };
})();
