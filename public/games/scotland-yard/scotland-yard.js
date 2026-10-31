'use strict';
{
  const tx = (de, en) => I18n.language === 'en' ? en : de;
  const modeName = (m) => ({ taxi: 'Taxi', bus: 'Bus', underground: tx('U-Bahn', 'Underground'), black: tx('Black-Ticket', 'Black ticket'), ferry: tx('Fähre (Black)', 'Ferry (black)') }[m] || m);
  const nameOf = (S, id) => S.players.find((p) => p.id === id)?.name || '?';
  const person = (S, id) => esc(nameOf(S, id));
  // Presentation coordinates only. Every connection still comes from g.map.edges.
  const layout = [[105,120],[240,80],[415,110],[560,75],[760,115],[960,75],[1090,130], [85,250],[270,225],[410,275],[570,210],[735,255],[920,225],[1120,275], [140,370],[300,360],[455,410],[615,350],[805,375],[975,360],[1110,410], [80,490],[260,485],[410,520],[575,475],[760,500],[935,495],[1120,530], [150,600],[315,575],[495,625],[645,575],[820,625],[980,590],[1110,635], [85,720],[270,690],[430,740],[590,700],[740,735],[925,700],[1120,755], [150,835],[320,825],[480,855],[640,820],[800,855],[980,830],[1115,860]];
  const symbols = {
    taxi: '<path d="m4 10 2-5h12l2 5M3 10h18v8H3zM7 18v2m10-2v2M6 13h2m8 0h2M10 5V3h4v2"/>',
    bus: '<rect x="4" y="3" width="16" height="16" rx="3"/><path d="M4 11h16M8 19v2m8-2v2M8 15h1m6 0h1M8 7h8"/>',
    underground: '<path d="M4 19V9a8 8 0 0 1 16 0v10M8 22l2-4m6 4-2-4"/><rect x="7" y="5" width="10" height="12" rx="3"/><path d="M7 11h10M10 14h4"/>',
    ferry: '<path d="M3 16h18l-4 5H7zM7 16V8h10v8M12 8V3m0 0 6 3h-6M2 23q3-2 6 0t6 0 6 0"/>',
    black: '<path d="m4 8 3-5h10l3 5M2 8h20M5 13l4-2h6l4 2M5 22l3-6 4 3 4-3 3 6"/>',
    double: '<path d="M2 8h16m-5-5 5 5-5 5M22 17H6m5-5-5 5 5 5"/>',
    search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
    target: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/>',
  };
  const icon = (kind) => `<svg class="sy-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${symbols[kind] || symbols.search}</svg>`;
  const agent = (S, id) => Math.max(0, S.g?.detectives.findIndex((p) => p.id === id) ?? S.players.filter((p) => p.seated).findIndex((p) => p.id === id)) % 5 + 1;
  const badge = (S, p) => `<span class="sy-agent" data-agent="${agent(S, p.id)}">${esc(Array.from(p.name)[0] || '?')}</span>`;
  const point = (id) => layout[id - 1];
  function route(e) {
    const [ax, ay] = point(e.a), [bx, by] = point(e.b), distance = Math.hypot(bx - ax, by - ay);
    const offset = { taxi: 5, bus: -14, underground: 28, ferry: -42 }[e.mode] || 0;
    return `M${ax} ${ay}Q${(ax + bx) / 2 - (by - ay) / distance * offset} ${(ay + by) / 2 + (bx - ax) / distance * offset} ${bx} ${by}`;
  }
  function roster(S, lobby = false) {
    const players = S.players.filter((p) => lobby ? p.seated : p.inRound);
    return `<ul class="sy-roster">${players.map((p) => {
      const isX = lobby ? S.xChoice === p.id : p.role === 'x';
      return `<li>${isX ? `<span class="sy-agent sy-agent-x">${icon('black')}</span>` : badge(S, p)}<span><b>${esc(p.name)}${p.id === S.you?.id ? ` <small>${tx('(du)', '(you)')}</small>` : ''}</b><small>${isX ? 'Mr. X' : lobby ? tx('Bereit für die Fahndung', 'Ready for the hunt') : `${tx('Detektiv', 'Detective')} ${agent(S, p.id)} · ${tx('Station', 'Stop')} ${p.station}`}</small></span>${p.id === S.turnId ? `<span class="sy-turn-dot" aria-label="${tx('Am Zug', 'On turn')}"></span>` : ''}</li>`;
    }).join('')}</ul>`;
  }
  function wallet(S) {
    if (!S.g.tickets) return `<p class="sy-muted">${tx('Du beobachtest die öffentlichen Hinweise. Die Tickets von Mr. X bleiben geheim.', 'You are following the public clues. Mr. X’s tickets stay secret.')}</p>`;
    return `<div class="sy-wallet">${Object.entries(S.g.tickets).map(([mode, count]) => `<span class="sy-wallet-ticket sy-${mode}">${icon(mode)}<span>${mode === 'double' ? tx('Doppel', 'Double') : modeName(mode)}</span><b>${count}</b></span>`).join('')}</div>`;
  }
  function journal(S) {
    const g = S.g;
    return `<section class="sy-log"><div class="sy-section-head"><span class="sy-eyebrow">${tx('Ermittlungsprotokoll', 'Case journal')}</span><b>${String(g.move).padStart(2, '0')}<small> / ${g.limit}</small></b></div><h3>${tx('Reiseverlauf von Mr. X', 'Mr. X travel log')}</h3><ol>${g.travel.map((m) => `<li class="sy-log-entry sy-${m.ticket} ${m.station ? 'is-sighting' : ''}"><b class="sy-log-number">${String(m.move).padStart(2, '0')}</b>${icon(m.ticket)}<span>${modeName(m.ticket)}${m.double ? `<small>${icon('double')}${tx('Doppelzug', 'Double move')}</small>` : ''}</span>${m.station ? `<strong>${tx('Station', 'Stop')} ${m.station}</strong>` : `<small>${tx('verdeckt', 'hidden')}</small>`}</li>`).join('') || `<li class="sy-log-empty">${icon('search')}<b>${tx('Noch keine Spuren.', 'No clues yet.')}</b><span>${tx('Jede Fahrt hinterlässt ein Ticket. Jede Sichtung bringt euch näher.', 'Every journey leaves a ticket. Every sighting brings you closer.')}</span></li>`}</ol><p class="sy-log-note">${g.isX ? tx('Nur deine Sicht zeigt deine aktuelle geheime Position.', 'Only your view shows your current secret position.') : `${g.candidates.length} ${tx('Stationen passen zu den öffentlichen Hinweisen.', 'stops match the public clues.')}`}</p></section>`;
  }
  let ticket = 'taxi', double = false, selectedRound = null;
  let pan = null, panRound = null, ticketPan = 0;
  const rules = () => tx(
    '<p>Eigener Stadtplan mit 49 Haltestellen: ein Mr. X gegen zwei bis fünf Detektive. Der Host kann die Rolle vor dem Start vergeben, sonst wechselt sie mit dem Startspieler.</p><ul><li>Mr. X zieht zuerst, dann jeder Detektiv einmal. Wähle ein Verkehrsmittel und eine erreichbare Haltestelle. Detektive dürfen keine andere Detektiv-Haltestelle betreten; Mr. X ebenfalls nicht.</li><li>Detektive beginnen mit 10 Taxi-, 8 Bus- und 4 U-Bahn-Tickets; verbrauchte Tickets gehen an Mr. X. Mr. X beginnt mit 4 Taxi, 3 Bus, 3 U-Bahn, 5 Black und 2 Doppelzügen. Sein Ticketvorrat ist geheim.</li><li>Black-Tickets verbergen das Verkehrsmittel und erlauben auch die Fähren. Der Reiseverlauf verrät sonst nur das Ticket, niemals das geheime Ziel.</li><li>Normal zeigt sich Mr. X nach Zug 3, 8, 13, 18 und 24 sowie immer im letzten Zug. Der Host kann häufigeres oder selteneres Auftauchen wählen.</li><li>Ein Doppelzug verbraucht zwei Fahrtickets und ein Doppel-Ticket. Beide Teilzüge zählen; ein Auftauchen dazwischen bleibt im Verlauf sichtbar.</li><li>Die Detektive gewinnen durch Betreten der aktuellen Mr.-X-Station oder wenn er eingeschlossen ist. Mr. X gewinnt nach dem letzten Antwortzug der Detektive oder wenn keiner von ihnen mehr ziehen kann. Blockierte Detektive setzen automatisch aus.</li><li>Alle können die öffentlichen Hinweise sehen. Nur Mr. X sieht seine geheime Position; erst nach dem Ende wird sie für alle aufgedeckt. Bots und Zeitablauf benutzen dieselben erlaubten Informationen.</li><li>Eigene Stadt und angepasste Regeln; keine Nachbildung des Originalplans.</li></ul>',
    '<p>An original city map with 49 stops: one Mr. X against two to five detectives. The host may assign the role before starting; otherwise it rotates with the starting player.</p><ul><li>Mr. X moves first, followed by each detective once. Choose transport and a reachable stop. Detectives cannot enter another detective’s stop; neither can Mr. X.</li><li>Detectives start with 10 taxi, 8 bus and 4 underground tickets. Spent tickets go to Mr. X. Mr. X starts with 4 taxi, 3 bus, 3 underground, 5 black and 2 double tickets. His ticket supply stays private.</li><li>A black ticket hides the transport and also permits ferry routes. Otherwise the travel log shows only the ticket, never the hidden destination.</li><li>Normally Mr. X surfaces after moves 3, 8, 13, 18 and 24, and always on the final move. The host can change this frequency.</li><li>A double move uses two travel tickets and one double ticket. Both legs count. Surfacing between them remains visible in the log.</li><li>Detectives win by reaching Mr. X’s current stop or trapping him. Mr. X wins after the detectives’ final response, or when none can move. Blocked detectives automatically pass.</li><li>Only Mr. X sees his secret position until the game ends. Bots and timeouts use the same permitted information.</li><li>This is an original city with adapted rules, not a copy of the original map.</li></ul>');
  const kit = kitGame({
    id: 'scotland-yard', name: 'Scotland Yard', direction: false, ring: false,
    keepMain(S) { const el = document.querySelector('.sy-viewport'); pan = panRound === S.roundNo && el ? [el.scrollLeft, el.scrollTop] : null; panRound = S.roundNo; ticketPan = document.querySelector('.sy-tickets')?.scrollLeft || 0; return false; },
    afterRender(S) {
      document.querySelector('.sy-tickets')?.scrollTo(ticketPan, 0);
      const el = document.querySelector('.sy-viewport'), map = el?.querySelector('.sy-map');
      if (!el || !map) return;
      if (pan) el.scrollTo(...pan);
      else {
        const station = S.g.isX ? S.g.xPosition : S.g.detectives.find((p) => p.id === S.you?.id)?.station;
        const [x, y] = point(station) || [600, 460];
        el.scrollTo(x / 1200 * map.offsetWidth - el.clientWidth / 2, y / 920 * map.offsetHeight - el.clientHeight / 2);
      }
    },
    lobby(S) {
      const seated = S.players.filter((p) => p.seated), ready = seated.length >= S.minPlayers;
      return `<section class="sy-lobby"><div class="sy-lobby-art" aria-hidden="true"><div class="sy-folio"><span>STADTARCHIV · AURE</span><img src="/games/scotland-yard/city-board.svg" alt=""/><div class="sy-folio-seal">${icon('black')}<b>49</b></div></div><span class="sy-lobby-stamp">${tx('STRENG VERTRAULICH', 'STRICTLY CONFIDENTIAL')}</span></div><div class="sy-briefing"><span class="sy-eyebrow">SCOTLAND YARD · ${tx('ERMITTLUNGSZENTRALE', 'OPERATIONS ROOM')}</span><h2>${tx('Eine Stadt.<br>Ein Geheimnis.', 'One city.<br>One secret.')}</h2><p class="sy-lead">${tx('Mr. X verschwindet in den Straßen. Eure einzige Spur: ein Ticket, ein flüchtiger Blick. Könnt ihr ihn gemeinsam stellen?', 'Mr. X disappears into the city. Your only clues: a ticket, a fleeting glimpse. Can you work together to catch him?')}</p><div class="sy-brief-stats"><span><b>49</b>${tx('Stationen', 'Stops')}</span><span><b>3–6</b>${tx('Spieler', 'Players')}</span><span><b>${S.settings.rounds}</b>${tx('Mr.-X-Züge', 'Mr. X moves')}</span></div><div class="sy-lobby-status"><span class="sy-status-light ${ready ? 'ready' : ''}"></span><b>${ready ? tx('Das Team ist bereit.', 'The team is ready.') : tx('Warten auf Mitspieler', 'Waiting for players')}</b><span>${seated.length} / ${S.maxPlayers}</span></div>${roster(S, true)}<div class="sy-role-choice">${icon('black')}<span><small>${tx('Mr. X für die nächste Partie', 'Mr. X for the next game')}</small><b>${S.xChoice ? person(S, S.xChoice) : tx('Automatisch wechseln', 'Rotate automatically')}</b></span>${S.you?.isHost ? `<button class="btn btn-ghost" data-g="sy-host">${tx('Rolle zuweisen', 'Assign role')}</button>` : ''}</div><p class="sy-brief-hint">${ready ? S.you?.isHost ? tx('Starte die Fahndung unten. Die Detektive ziehen nach Mr. X.', 'Start the hunt below. Detectives move after Mr. X.') : tx('Der Host startet die Fahndung.', 'The host will start the hunt.') : tx('Mindestens drei Spieler: ein Mr. X und zwei Detektive. Teile den Raum-Link oder ergänze Bots im Host-Menü.', 'At least three players: one Mr. X and two detectives. Share the room link or add bots from the host menu.')}</p></div><div class="sy-brief-rules"><article>${icon('search')}<b>${tx('Spuren lesen', 'Follow the clues')}</b><p>${tx('Tickets verraten das Verkehrsmittel. Sichtungen verraten eine Station.', 'Tickets reveal transport. Sightings reveal a stop.')}</p></article><article>${icon('taxi')}<b>${tx('Klug reisen', 'Travel wisely')}</b><p>${tx('Taxi, Bus, U-Bahn – wählt eure Verbindungen und teilt euch auf.', 'Taxi, bus, underground – choose your connections and spread out.')}</p></article><article>${icon('black')}<b>${tx('Gemeinsam stellen', 'Close the net')}</b><p>${tx('Nur Mr. X kennt seine geheime Position. Fangt ihn oder schließt ihn ein.', 'Only Mr. X knows his secret position. Catch him or trap him.')}</p></article></div></section>`;
    },
    get rules() { return rules(); },
    get short() { return [tx('Ein Mr. X gegen alle Detektive auf einem eigenen Stadtplan.', 'One Mr. X against all detectives on an original city map.'), tx('Verkehrsmittel wählen, dann eine erlaubte Haltestelle antippen. Black und Doppelzüge helfen Mr. X.', 'Choose transport, then tap a legal stop. Black and double tickets help Mr. X.'), tx('Auftauchen und benutzte Tickets sind öffentlich; die geheime Position bleibt auf dem Server.', 'Surfacing and used tickets are public; the secret position stays on the server.')]; },
    onState(S) { if (selectedRound !== S.roundNo) { selectedRound = S.roundNo; ticket = 'taxi'; double = false; } if (!S.g?.canDouble) double = false; },
    playerInfo(p, S) { return p.role ? `<span class="sy-player-role" ${p.role === 'detective' ? `data-agent="${agent(S, p.id)}"` : ''}>${p.role === 'x' ? 'Mr. X' : `${tx('Detektiv', 'Detective')} ${agent(S, p.id)}`}${p.station ? ' · ' + p.station : ''}</span>` : ''; },
    hint(S, mine) { return !mine ? tx('Der aktive Spieler wählt seine nächste Verbindung.', 'The active player is choosing their next route.') : tx('Ticket wählen und eine markierte Station antippen. Der Stadtplan lässt sich verschieben.', 'Choose a ticket and tap a highlighted stop. You can scroll the map.'); },
    main(S) {
      const g = S.g, ownTurn = S.turnId === S.you?.id;
      const options = g.legal.filter((m) => !double || m.doubleAllowed);
      if (!options.some((m) => m.ticket === ticket)) ticket = options[0]?.ticket || 'taxi';
      const legal = new Set(ownTurn ? options.filter((m) => m.ticket === ticket).map((m) => m.to) : []);
      const ownStation = g.isX ? g.xPosition : g.detectives.find((p) => p.id === S.you?.id)?.station;
      const roads = g.map.edges.map((e) => {
        const active = ownTurn && (e.mode === ticket || ticket === 'black') && (e.a === ownStation && legal.has(e.b) || e.b === ownStation && legal.has(e.a));
        return `<path class="sy-road sy-${e.mode}${active ? ' is-route' : ''}" d="${route(e)}"/>`;
      }).join('');
      const stations = g.map.nodes.map((n) => {
        const detective = g.detectives.find((p) => p.station === n.id), x = g.xPosition === n.id, ghost = !x && g.lastSeen?.station === n.id;
        const title = `${tx('Station', 'Stop')} ${n.id}${detective ? ' · ' + nameOf(S, detective.id) : ''}${x ? ' · Mr. X' : ghost ? ' · ' + tx('zuletzt gesehen', 'last seen') : ''}${legal.has(n.id) ? ' · ' + tx('erreichbar', 'reachable') : ''}`;
        const [px, py] = point(n.id);
        return `<button type="button" class="sy-stop ${legal.has(n.id) ? 'can' : ''} ${detective ? 'detective' : ''} ${x ? 'mister' : ''} ${ghost ? 'ghost' : ''}" style="left:${px / 1200 * 100}%;top:${py / 920 * 100}%" ${detective ? `data-agent="${agent(S, detective.id)}"` : ''} data-g="sy-stop" data-to="${n.id}" aria-label="${esc(title)}" ${legal.has(n.id) ? '' : 'disabled'}><b>${n.id}</b>${detective ? `<small class="sy-piece">${agent(S, detective.id)}</small>` : x ? `<small class="sy-piece">${icon('black')}</small>` : ghost ? '<small class="sy-piece">?</small>' : ''}${legal.has(n.id) ? '<span class="sy-destination-dot" aria-hidden="true"></span>' : ''}</button>`;
      }).join('');
      const seen = g.lastSeen ? `${tx('Zuletzt gesehen', 'Last seen')}: ${g.lastSeen.station} · ${tx('Zug', 'Move')} ${g.lastSeen.move}` : tx('Mr. X wurde noch nicht gesehen.', 'Mr. X has not surfaced yet.');
      const status = S.phase === 'over' ? tx('Fahndung abgeschlossen', 'Hunt concluded') : ownTurn ? tx('Du bist am Zug', 'Your move') : `${person(S, S.turnId)} · ${tx('am Zug', 'on turn')}`;
      return `<section class="sy-layout"><header class="sy-case-head"><div><span class="sy-eyebrow">${tx('FAHNDUNGSAKTE', 'CASE FILE')} 49 · AURE</span><div class="sy-map-head"><h2>${g.isX ? tx('Du bist Mr. X', 'You are Mr. X') : tx('Fahndung nach Mr. X', 'Hunt for Mr. X')}</h2></div></div><span class="sy-case-status ${ownTurn ? 'is-mine' : ''}"><span class="sy-status-light"></span>${status}</span></header>
        <div class="sy-map-card"><div class="sy-board-caption"><span>${icon('search')}${tx('Stadtplan & Verbindungen', 'City map & connections')}</span><b>${tx('Zug', 'Move')} ${g.move}<small> / ${g.limit}</small></b></div>
          <div class="sy-viewport" tabindex="0" aria-label="${tx('Verschiebbarer Stadtplan', 'Scrollable city map')}"><div class="sy-map"><svg viewBox="0 0 1200 920" aria-hidden="true">${roads}</svg>${stations}</div></div>
          <div class="sy-map-tools"><div class="sy-legend">${['taxi', 'bus', 'underground', 'ferry'].map((m) => `<span class="sy-${m}">${icon(m)}<i></i>${modeName(m)}</span>`).join('')}</div><p>${tx('Plan verschieben · Ziele auch unten auswählbar', 'Scroll the map · Destinations also available below')}</p></div></div>
        <aside class="sy-travel"><div class="sy-clue-card">${icon(g.lastSeen ? 'target' : 'black')}<div><span class="sy-eyebrow">${tx('LETZTE ÖFFENTLICHE SPUR', 'LAST PUBLIC CLUE')}</span><p class="sy-clue">${esc(seen)}</p></div>${g.isX && S.phase === 'playing' ? `<span class="sy-private">${tx('Deine Station', 'Your stop')} <b>${g.xPosition}</b><small>${tx('Nur für dich sichtbar', 'Visible only to you')}</small></span>` : ''}</div>
          ${g.doublePending ? `<p class="sy-double-note">${icon('double')}${tx('Zweiter Teil des Doppelzugs', 'Second leg of double move')}</p>` : ''}${journal(S)}<details class="sy-team" open><summary>${tx('Einsatzteam & Fahrkarten', 'Team & tickets')}</summary>${roster(S)}<h3>${g.isX ? tx('Deine geheimen Fahrkarten', 'Your secret tickets') : g.tickets ? tx('Deine Fahrkarten', 'Your tickets') : tx('Zuschaueransicht', 'Spectator view')}</h3>${wallet(S)}</details></aside></section>`;
    },
    dock(S, myTurn) {
      if (!myTurn) return `<div class="sy-waiting">${icon(S.g.isX ? 'black' : 'search')}<span>${S.g.isX ? tx('Bleib im Verborgenen. Die Detektive ermitteln.', 'Stay hidden. The detectives are investigating.') : tx('Beobachte die Spuren. Dein Team ist unterwegs.', 'Follow the clues. Your team is on the move.')}</span></div>`;
      const g = S.g, legal = g.legal.filter((m) => !double || m.doubleAllowed), modes = [...new Set(legal.map((m) => m.ticket))];
      return `<div class="sy-dock"><div class="sy-tickets" role="group" aria-label="${tx('Verkehrsmittel wählen', 'Choose transport')}">${['taxi', 'bus', 'underground', ...(g.isX ? ['black'] : [])].map((m) => `<button class="sy-ticket sy-${m}" data-g="sy-ticket" data-ticket="${m}" aria-pressed="${ticket === m}" ${modes.includes(m) ? '' : 'disabled'}>${icon(m)}<span>${modeName(m)}<small>${tx('Fahrkarte', 'Travel ticket')}</small></span><b>${g.tickets[m]}</b></button>`).join('')}${g.canDouble ? `<button class="sy-ticket sy-double" data-g="sy-double" aria-pressed="${double}">${icon('double')}<span>${tx('Doppelzug', 'Double move')}<small>${tx('Zwei Fahrten', 'Two journeys')}</small></span><b>${g.tickets.double}</b></button>` : ''}</div><div class="sy-destination-row"><span>${tx('Zielstation', 'Destination')}</span><div class="sy-destinations" aria-label="${tx('Erreichbare Stationen', 'Reachable stops')}">${legal.filter((m) => m.ticket === ticket).map((m) => `<button class="sy-destination" data-g="sy-stop" data-to="${m.to}" aria-label="${tx('Fahre zu Station', 'Travel to stop')} ${m.to}"><span aria-hidden="true">↗</span> ${m.to}</button>`).join('')}</div>${double ? `<small>${tx('Erste von zwei Fahrten', 'First of two journeys')}</small>` : ''}</div></div>`;
    },
    resultExtra(S) {
      const won = S.result.winners.includes(S.you?.id), xWon = S.result.winners.includes(S.g.xId);
      return `<div class="sy-result-seal ${won ? 'is-winner' : ''}">${icon(xWon ? 'black' : 'search')}<span class="sy-eyebrow">${tx('AKTE GESCHLOSSEN', 'CASE CLOSED')}</span><h3>${xWon ? tx('Mr. X ist entkommen.', 'Mr. X escaped.') : tx('Die Stadt ist sicher.', 'The city is safe.')}</h3><p>${S.you?.inRound ? won ? tx('Mission erfolgreich. Gut gespielt.', 'Mission accomplished. Well played.') : tx('Diese Fahndung geht an die Gegenseite.', 'The other side won this hunt.') : tx('Alle öffentlichen Spuren bleiben im Reiseverlauf sichtbar.', 'All public clues remain in the travel log.')}</p></div>`;
    },
    dockKey: () => null,
    hostExtra(S) { return `<label class="field"><span>${tx('Mr. X für die nächste Partie', 'Mr. X for the next game')}</span><select data-sy-role ${S.phase === 'playing' ? 'disabled' : ''}><option value="">${tx('Automatisch wechseln', 'Rotate automatically')}</option>${S.players.filter((p) => p.seated).map((p) => `<option value="${p.id}" ${S.xChoice === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>`; },
    onClick(el) {
      if (el.dataset.g === 'sy-host') { $('#kg-nav-host')?.click(); document.querySelector('[data-sy-role]')?.focus(); }
      else if (el.dataset.g === 'sy-ticket' || el.dataset.g === 'sy-double') {
        const isDouble = el.dataset.g === 'sy-double';
        if (isDouble) double = !double; else ticket = el.dataset.ticket;
        kit.render();
        document.querySelector(isDouble ? '[data-g="sy-double"]' : `[data-g="sy-ticket"][data-ticket="${ticket}"]`)?.focus({ preventScroll: true });
      } else if (el.dataset.g === 'sy-stop') send('syMove', { to: Number(el.dataset.to), ticket, double });
    },
  });
  document.addEventListener('change', (event) => { if (session?.game === 'scotland-yard' && event.target.matches('[data-sy-role]')) send('syRole', { target: event.target.value || null }); });
}
