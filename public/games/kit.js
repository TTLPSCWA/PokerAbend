// Gemeinsame Oberfläche für rundenbasierte Spiele (alles außer Poker): Kopfzeile, Spielerleiste,
// Seitenleiste (Verlauf, Stand, Regeln, Host), Mitspielen/Zuschauen und Runde starten.
// Ein Spiel meldet sich mit kitGame({ … }) an und liefert nur, was auf seinen Tisch und in seine Aktionsleiste gehört:
//   id, name, rules (HTML), main(S) → HTML Tisch, dock(S) → HTML Aktionen (nur wenn man in der Runde ist),
//   playerInfo(p, S) → kurzer Text in der Spielerleiste, onClick(el, S) für Elemente mit data-g, settings: [{ key, label, min, max }]
// Läuft nach /core.js ($, esc, send, toast, ask, beep, socket …).
'use strict';

// ---------- Bausteine, die mehrere Spiele brauchen ----------
const SUIT_SIGN = { c: '♣', s: '♠', h: '♥', d: '♦' };
const RANK_DE = { T: '10', J: 'B', Q: 'D', K: 'K', A: 'A' };
// Französische Karte (Mau-Mau): "Th" → 10♥
function frenchCard(c, { cls = '', attrs = '' } = {}) {
  const red = c[1] === 'h' || c[1] === 'd';
  const r = RANK_DE[c[0]] || c[0];
  return `<button type="button" class="kc kc-fr ${red ? 'red' : ''} ${cls}" ${attrs} aria-label="${esc(r + ' ' + SUIT_SIGN[c[1]])}"><span class="r">${r}</span><span class="s">${SUIT_SIGN[c[1]]}</span></button>`;
}
// Würfel mit Augen (3 × 3 Raster)
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
function dieHTML(n, { cls = '', attrs = '', tag = 'span' } = {}) {
  return `<${tag} class="die ${cls}" ${attrs} role="img" aria-label="Würfel ${n || 'leer'}">${[...Array(9)].map((_, i) => `<i class="${PIPS[n]?.includes(i) ? 'on' : ''}"></i>`).join('')}</${tag}>`;
}
const backCard = (label = '') => `<div class="kc kc-back" aria-hidden="true">${label}</div>`;

// ---------- Rahmen ----------
function kitGame(def) {
  const mod = {};
  let S = null;
  let panel = null;
  let fullLog = null; // ganzer Verlauf, wenn geladen
  const isMine = () => current === mod && S;

  function mount() {
    $('#game-root').innerHTML = `<div id="kg" class="kg kg-${def.id}">
      <header class="topbar">
        <div class="top-left">
          <button class="code-chip" data-kit="copy" title="Einladungslink kopieren" aria-label="Einladungslink kopieren">
            <span class="code-label">Raum</span> <b id="kg-code">-----</b>
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>
          </button>
        </div>
        <div class="meta" id="kg-meta" aria-live="polite"></div>
        <div class="top-right">
          <nav class="topnav" aria-label="Seitenleisten">
            <button class="nav-btn" data-kit-panel="log">${svg('<path d="M4 6h16M4 12h16M4 18h10"/>')}<span>Verlauf</span></button>
            <button class="nav-btn" data-kit-panel="stand">${svg('<path d="M5 20V11M12 20V5M19 20v-6"/>')}<span>Stand</span></button>
            <button class="nav-btn" data-kit-panel="rules">${svg('<path d="M5 4h11l3 3v13H5z"/><path d="M9 10h6M9 14h6"/>')}<span>Regeln</span></button>
            <button class="nav-btn" data-kit-panel="host" id="kg-nav-host" hidden>${svg('<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>')}<span>Host</span></button>
          </nav>
        </div>
      </header>
      <section class="kg-players" id="kg-players" aria-label="Mitspieler"></section>
      <main class="kg-main" id="kg-main"></main>
      <section class="kg-dock" id="kg-dock"></section>
      <aside class="panel" id="kg-panel" hidden aria-labelledby="kg-panel-title">
        <button class="grip" data-kit="close" aria-label="Schließen"></button>
        <div class="panel-head"><h2 id="kg-panel-title"></h2>
          <button class="icon-btn" data-kit="close" aria-label="Schließen"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
        <div class="panel-body" id="kg-panel-body"></div>
      </aside>
    </div>`;
    fullLog = null;
    if (panel) openPanel(panel, true);
  }

  const nameOf = (id) => S.players.find((p) => p.id === id)?.name ?? '?';
  const seatedCount = () => S.players.filter((p) => p.seated).length;

  function render() {
    if (!isMine() || !$('#kg')) return;
    document.documentElement.style.setProperty('--topbar', $('#kg .topbar').offsetHeight + 'px');
    $('#kg-code').textContent = S.code;
    $('#kg-nav-host').hidden = !S.you?.isHost;
    const myTurn = S.turnId && S.turnId === S.you?.id;
    const status = S.phase === 'playing' ? `Runde #${S.roundNo} · ${myTurn ? '<b>Du bist dran</b>' : `${esc(nameOf(S.turnId))} ist dran`}`
      : S.phase === 'over' ? `Runde #${S.roundNo} vorbei` : 'Noch nicht gestartet';
    $('#kg-meta').innerHTML = `<div class="blinds">${esc(def.name)}</div><div class="meta-sub">${status}</div>`;
    document.body.classList.toggle('kg-myturn', !!myTurn);

    // Spielerleiste: wer mitspielt, wer dran ist, was man über ihn wissen darf
    const players = S.players.filter((p) => p.seated || p.inRound);
    const watchers = S.players.length - players.length;
    $('#kg-players').innerHTML = players.map((p) => {
      const turn = p.id === S.turnId;
      const info = S.phase !== 'lobby' && p.inRound !== undefined ? def.playerInfo?.(p, S) || '' : '';
      return `<div class="kp ${turn ? 'turn' : ''} ${p.id === S.you?.id ? 'me' : ''} ${p.connected ? '' : 'is-offline'} ${S.phase === 'playing' && !p.inRound ? 'out' : ''}">
        <span class="kp-av" aria-hidden="true">${avatarHTML(p)}</span>
        <span class="kp-txt"><b>${esc(p.name)}${p.isHost ? ` ${ICON.crown}<span class="sr-only">(Host)</span>` : ''}</b>
          <small>${turn ? '<em>am Zug</em> · ' : ''}${p.connected ? '' : `${ICON.offline} offline · `}${info}</small></span>
      </div>`;
    }).join('') + (watchers ? `<div class="kp kp-watch"><small>${watchers} schau${watchers === 1 ? 't' : 'en'} zu</small></div>` : '')
      || '<p class="hint" style="margin:0">Noch spielt niemand mit.</p>';

    // Tisch
    const main = $('#kg-main');
    if (S.phase === 'lobby') main.innerHTML = lobbyHTML();
    else main.innerHTML = (S.phase === 'over' && S.result ? resultHTML() : '') + def.main(S);

    // Aktionsleiste
    $('#kg-dock').innerHTML = dockHTML(myTurn);
    document.documentElement.style.setProperty('--dock-h', $('#kg-dock').offsetHeight + 'px');
    if (panel) renderPanel();
  }

  function lobbyHTML() {
    const n = seatedCount();
    const enough = n >= S.minPlayers;
    return `<div class="kg-lobby">
      <h2>${esc(def.name)}</h2>
      <p>${n} von höchstens ${S.maxPlayers} spielen mit${enough ? '.' : ` – es braucht mindestens ${S.minPlayers}.`}</p>
      <p class="hint">${S.you?.isHost ? (enough ? 'Du bist Host: Starte die Runde unten.' : 'Teil den Link oben, damit die anderen dazukommen.') : 'Der Host startet die Runde.'}
        Die Regeln stehen oben unter „Regeln“.</p>
    </div>`;
  }

  function resultHTML() {
    return `<div class="kg-result" role="status"><b>${esc(S.result.text)}</b>
      <small>${S.you?.isHost ? 'Mit „Nächste Runde“ unten geht es weiter.' : 'Der Host startet die nächste Runde.'}</small></div>`;
  }

  function dockHTML(myTurn) {
    const me = S.you;
    if (S.phase === 'playing' && me?.inRound) {
      const html = def.dock(S, myTurn);
      // Spiele ohne Kartenhand liefern nur Knöpfe – die kommen in eine zentrierte Zeile
      return `<div class="kg-dock-in">${html.includes('kg-acts') ? html : `<div class="kg-acts">${html}</div>`}</div>`;
    }
    const parts = [];
    if (me?.playing) {
      parts.push(`<span class="waiting">${S.phase === 'playing' ? 'Du spielst ab der nächsten Runde mit.' : 'Du spielst mit.'}</span>`);
      parts.push('<button class="btn btn-ghost" data-kit="stand">Zuschauen</button>');
    } else {
      parts.push('<span class="waiting">Du schaust zu.</span>');
      parts.push(`<button class="btn btn-brass" data-kit="sit" ${seatedCount() >= S.maxPlayers ? 'disabled title="Alle Plätze sind besetzt"' : ''}>Mitspielen</button>`);
    }
    if (me?.isHost && S.phase !== 'playing') {
      const enough = seatedCount() >= S.minPlayers;
      parts.push(`<button class="btn btn-brass" data-kit="start" ${enough ? '' : `disabled title="Es müssen mindestens ${S.minPlayers} mitspielen"`}>${S.roundNo ? 'Nächste Runde' : 'Runde starten'}</button>`);
    }
    return `<div class="kg-dock-row">${parts.join('')}</div>`;
  }

  // ---------- Seitenleiste ----------
  const TITLES = { log: 'Verlauf', stand: 'Stand des Abends', rules: 'Regeln', host: 'Host' };
  function openPanel(name, keep = false) {
    panel = keep ? name : panel === name ? null : name;
    $('#kg-panel').hidden = !panel;
    $$('#kg [data-kit-panel]').forEach((b) => b.setAttribute('aria-current', String(b.dataset.kitPanel === panel)));
    if (panel) { $('#kg-panel-title').textContent = TITLES[panel]; renderPanel(true); }
  }
  function renderPanel(force = false) {
    const body = $('#kg-panel-body');
    if (!force && body.contains(document.activeElement) && document.activeElement.matches('input, select')) return;
    if (panel === 'log') {
      const list = fullLog || S.log;
      let round = null;
      const atBottom = body.scrollTop + body.clientHeight >= body.scrollHeight - 30;
      body.innerHTML = `<ul class="log">${list.filter((l) => l.cat !== 'hand').map((l) => {
        const head = l.hand !== round ? `<li class="hand">${l.hand ? `Runde #${l.hand}` : 'Vor der ersten Runde'}</li>` : '';
        round = l.hand;
        return `${head}<li class="${esc(l.kind)}">${esc(l.text)}</li>`;
      }).join('')}</ul>
        ${fullLog ? '' : '<button class="btn btn-sm btn-ghost" data-kit="history">Ganzen Verlauf laden</button>'}`;
      if (atBottom || force) body.scrollTop = body.scrollHeight;
    } else if (panel === 'stand') {
      body.innerHTML = `<table class="standings"><thead><tr><th></th><th>Name</th><th class="num">${esc(S.scoreLabel)}</th><th class="num">Siege</th></tr></thead><tbody>
        ${S.standings.map((p, k) => `<tr><td><span class="rank ${k < 3 ? 'r' + (k + 1) : ''}" aria-label="Platz ${k + 1}">${k + 1}</span></td>
          <td><span class="mini-av">${avatarHTML(p)}</span> ${esc(p.name)}</td><td class="num">${p.score}</td><td class="num">${p.wins}</td></tr>`).join('')}
        </tbody></table>
        <p class="hint">${S.lowWins ? 'Wenig Punkte sind gut.' : 'Viel ist gut.'}</p>`;
    } else if (panel === 'rules') {
      body.innerHTML = `<div class="kg-rules">${def.rules}</div>`;
    } else if (panel === 'host') {
      if (!S.you?.isHost) { openPanel(null); return; }
      const others = S.players.filter((p) => p.id !== S.you.id);
      const fields = (def.settings || []).map((f) => `<label class="field"><span>${esc(f.label)}</span>
        <input type="number" data-kit-set="${f.key}" min="${f.min}" max="${f.max}" value="${esc(S.settings[f.key])}" ${S.phase === 'playing' ? 'disabled' : ''}></label>`).join('');
      body.innerHTML = `<div class="big-actions">
          ${S.phase !== 'playing' ? `<button class="btn btn-brass" data-kit="start">${ICON.play} ${S.roundNo ? 'Nächste Runde' : 'Runde starten'}</button>` : ''}
          <button class="btn btn-outline-red" data-kit="newGame" ${S.phase === 'playing' ? 'disabled title="Geht nur zwischen zwei Runden"' : ''}>Neues Spiel (Punkte auf null)</button>
        </div>
        ${fields ? `<h3>Einstellungen</h3><div class="host-grid">${fields}</div><p class="hint" style="margin:0">Änderungen gehen nur zwischen den Runden.</p>` : ''}
        <h3>Leute im Raum</h3>
        <div class="plist">${others.map((p) => `<div class="prow"><span class="mini-av">${avatarHTML(p)}</span>
          <div class="who"><b>${esc(p.name)}</b><small>${p.seated ? 'spielt mit' : 'schaut zu'}${p.connected ? '' : ' · offline'}</small></div>
          <button class="btn btn-sm" data-kit-host="${p.id}" title="Host weitergeben">${ICON.crown}</button>
          <button class="btn btn-sm btn-outline-red" data-kit-kick="${p.id}">Entfernen</button></div>`).join('') || '<p class="hint" style="margin:0">Noch niemand sonst da.</p>'}</div>`;
    }
  }

  // ---------- Eingaben ----------
  document.addEventListener('click', async (e) => {
    if (!isMine()) return;
    const t = e.target.closest('[data-kit], [data-kit-panel], [data-kit-kick], [data-kit-host], [data-g]');
    if (!t || t.disabled) return;
    if (t.dataset.kitPanel) return openPanel(t.dataset.kitPanel);
    if (t.dataset.kitKick) {
      const name = nameOf(t.dataset.kitKick);
      if (await ask({ title: `${name} entfernen?`, text: `${name} fliegt aus dem Raum. Läuft gerade eine Runde, steigt ${name} aus.`, ok: 'Entfernen', danger: true })) send('kick', { id: t.dataset.kitKick });
      return;
    }
    if (t.dataset.kitHost) {
      const name = nameOf(t.dataset.kitHost);
      if (await ask({ title: 'Host weitergeben?', text: `${name} wird Host und startet die Runden.`, ok: 'Weitergeben' })) send('makeHost', { id: t.dataset.kitHost });
      return;
    }
    const k = t.dataset.kit;
    if (k === 'close') openPanel(null);
    else if (k === 'sit') send('sit');
    else if (k === 'stand') {
      if (S.phase === 'playing' && S.you?.inRound && !(await ask({ title: 'Aus der Runde aussteigen?', text: 'Deine Karten bzw. dein Spielstand in dieser Runde sind dann weg.', ok: 'Aussteigen', danger: true }))) return;
      send('stand');
    } else if (k === 'start') send('start');
    else if (k === 'newGame') {
      if (await ask({ title: 'Neues Spiel starten?', text: 'Alle Punkte und Siege gehen auf null. Der alte Stand kommt in den Verlauf.', ok: 'Neues Spiel', danger: true })) send('newGame');
    } else if (k === 'history') {
      socket.emit('history', { after: 0 }, (r) => { if (r?.ok) { fullLog = r.entries; renderPanel(true); } });
    } else if (k === 'copy') {
      const link = `${location.origin}/?t=${S.code}`;
      try { await navigator.clipboard.writeText(link); toast('Link kopiert – schick ihn in eure Gruppe'); }
      catch { ask({ title: 'Einladungslink', text: 'Kopieren hat nicht geklappt. Markier den Link und kopier ihn selbst.', ok: 'Fertig', input: { value: link, readOnly: true, noCancel: true, label: 'Einladungslink' } }); }
    } else if (t.dataset.g !== undefined) def.onClick?.(t, S, e);
  });
  document.addEventListener('change', (e) => {
    if (!isMine()) return;
    const t = e.target;
    if (t.dataset?.kitSet) send('settings', { [t.dataset.kitSet]: Number(t.value) }).then((r) => r?.ok && toast('Gespeichert'));
    else if (t.closest?.('#kg') && t.dataset?.g !== undefined) def.onChange?.(t, S, e);
  });
  document.addEventListener('keydown', (e) => {
    if (!isMine() || e.key !== 'Escape' || $('#dlg').open) return;
    if (panel) openPanel(null);
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && isMine()) document.title = 'Pokerabend'; });

  Object.assign(mod, {
    show() { mount(); render(); },
    onState(st) {
      const prev = S;
      S = st;
      // Bin ich gerade drangekommen? Ton und Hinweis im Tab
      const now = st.turnId && st.turnId === st.you?.id;
      const before = prev && prev.turnId === prev.you?.id && prev.roundNo === st.roundNo;
      if (now && !before) { beep(740, 140, 0.06); setTimeout(() => beep(988, 160, 0.05), 140); if (document.hidden) document.title = '● Du bist dran – Pokerabend'; }
      if (!now) document.title = 'Pokerabend';
      def.onState?.(st, prev);
      render();
    },
    onPrefs() { render(); },
  });
  registerGame(def.id, mod);
  return { render, get S() { return S; } };
}

// ---------- Ablegespiele (Mau-Mau, Farbenchaos): gleiche Bedienung, andere Karten ----------
// opts: { id, name, rules, card(c, extra) → HTML, wishes: [[Wert, Beschriftung, Klasse]], wishLabel, lastWord }
function kitShedding(opts) {
  let wishFor = null; // Karte, für die gerade eine Farbe gewählt wird
  const kit = kitGame({
    id: opts.id, name: opts.name, rules: opts.rules,
    settings: [{ key: 'handSize', label: 'Karten pro Spieler', min: 3, max: 10 }],
    playerInfo: (p) => `${p.cards} Karte${p.cards === 1 ? '' : 'n'}${p.last ? ` · <b class="kg-call">${opts.lastWord}</b>` : ''}`,
    onState(S) { if (!S.g?.playable?.length) wishFor = null; },
    main(S) {
      const g = S.g;
      const wish = g.wish ? `<div class="kg-chip">Gewünscht: <b>${esc(opts.wishName(g.wish))}</b></div>` : '';
      const pending = g.pending ? `<div class="kg-chip warn">Der Nächste zieht ${g.pending}, außer er legt eine 7</div>` : '';
      return `<div class="kg-table">
        <div class="kg-piles">
          <div class="kg-pile">${backCard(g.deck)}<small>Stapel</small></div>
          <div class="kg-pile">${g.top ? opts.card(g.top, { cls: 'big', attrs: 'disabled' }) : ''}<small>Ablage</small></div>
        </div>
        <div class="kg-chips">${wish}${pending}</div>
      </div>`;
    },
    dock(S, myTurn) {
      const g = S.g;
      const playable = new Set(g.playable);
      const hand = (g.hand || []).map((c) => opts.card(c, {
        cls: `${myTurn && playable.has(c) ? 'can' : myTurn ? 'cant' : ''} ${wishFor === c ? 'sel' : ''}`,
        attrs: `data-g="card" data-card="${c}" ${myTurn ? '' : 'disabled'}`,
      })).join('');
      let acts = '';
      if (myTurn && wishFor) {
        acts = `<span class="waiting">${esc(opts.wishLabel)}</span>${opts.wishes.map(([v, l, cls]) => `<button class="btn wish ${cls}" data-g="wish" data-wish="${v}">${l}</button>`).join('')}
          <button class="btn btn-ghost" data-g="nowish">Abbrechen</button>`;
      } else if (myTurn) {
        acts = g.drawn
          ? `<span class="waiting">Gezogen – ${playable.size ? 'spielen oder' : ''} weiter</span><button class="btn" data-g="pass">Weiter</button>`
          : `<button class="btn" data-g="draw">${g.pending ? `${g.pending} Karten ziehen` : 'Karte ziehen'}</button>${playable.size ? '' : '<span class="waiting">Nichts passt – zieh eine Karte</span>'}`;
      } else acts = '<span class="waiting">Warte, bis du dran bist</span>';
      return `<div class="kg-hand" role="group" aria-label="Deine Karten">${hand}</div><div class="kg-acts">${acts}</div>`;
    },
    onClick(t, S) {
      const g = t.dataset.g;
      if (g === 'card') {
        const c = t.dataset.card;
        if (opts.needsWish(c)) { wishFor = c; kit.render(); return; }
        send('play', { card: c });
      } else if (g === 'wish') { send('play', { card: wishFor, wish: t.dataset.wish }); wishFor = null; }
      else if (g === 'nowish') { wishFor = null; kit.render(); }
      else if (g === 'draw') send('draw');
      else if (g === 'pass') send('pass');
    },
  });
  return kit;
}
