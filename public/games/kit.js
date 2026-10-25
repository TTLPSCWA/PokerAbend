// Gemeinsame Oberfläche für rundenbasierte Spiele (alles außer Poker): Kopfzeile, Spielerleiste,
// Seitenleiste (Verlauf, Stand, Regeln, Host), Mitspielen/Zuschauen und Runde starten.
// Ein Spiel meldet sich mit kitGame({ … }) an und liefert nur, was auf seinen Tisch und in seine Aktionsleiste gehört:
//   id, name, rules (HTML), short (Kurzregeln, Zeilen), house(S) → aktive Hausregeln (Zeilen),
//   main(S) → HTML Tisch, dock(S) → HTML Aktionen (nur wenn man in der Runde ist),
//   playerInfo(p, S) → kurzer Text in der Spielerleiste, seat(p, S) → HTML am Platz am Tisch (sonst playerInfo),
//   hint(S, myTurn) → ein Satz über der eigenen Hand: was man gerade tun kann,
//   sort: { color(c), number(c) } → Sortierschlüssel für die Hand (Knopf „Sortieren“),
//   onDrop(quelle, ziel, S) → Karte per Ziehen abgelegt (Desktop; Ziele tragen data-drop),
//   peek: true → bei überlappender Hand (Handy) erst vergrößern, zweites Tippen spielt,
//   direction: false → keinen Richtungspfeil zeigen, prefs() → eigene Schalter im Reiter „Ich“,
//   onClick(el, S) für Elemente mit data-g
// Läuft nach /core.js ($, esc, send, toast, ask, beep, socket …).
'use strict';

usePrefs({ marks: true });

// ---------- Bausteine, die mehrere Spiele brauchen ----------
// Farbsymbol für farbbasierte Karten (Farbenblind-Hilfe, Schalter unter „Ich“): jede Farbe hat ihre eigene Form
const MARK_SHAPE = {
  r: '<path d="M12 3 22 20H2z"/>',                 // Rot: Dreieck
  y: '<circle cx="12" cy="12" r="9.5"/>',           // Gelb: Kreis
  g: '<rect x="3" y="3" width="18" height="18"/>',  // Grün: Quadrat
  b: '<path d="M12 1.5 22.5 12 12 22.5 1.5 12z"/>', // Blau: Raute
};
const MARK_NAME = { r: 'Dreieck', y: 'Kreis', g: 'Quadrat', b: 'Raute' };
const colorMark = (k) => (MARK_SHAPE[k] ? `<svg class="cm" viewBox="0 0 24 24" aria-hidden="true">${MARK_SHAPE[k]}</svg>` : '');
// Verdeckter Kartenfächer für den Platz am Tisch (zeigt nur die Anzahl)
function fanHTML(n) {
  const k = Math.min(n, 7);
  return `<span class="fan" aria-hidden="true">${[...Array(k)].map((_, i) => `<i style="--r:${(i - (k - 1) / 2) * 9}deg"></i>`).join('')}</span>`;
}

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
            <button class="nav-btn" data-kit-panel="me">${svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>')}<span>Ich</span></button>
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
  // Regel-Optionen kommen vom Server (games/<id>/room.js → static OPTIONS), über /me in account.games
  const gameOptions = () => account.games.find((g) => g.id === def.id)?.options || [];
  const optionLines = () => gameOptions().map((o) => `${esc(o.label)}: <b>${o.type === 'bool' ? (S.settings[o.key] ? 'an' : 'aus') : esc(S.settings[o.key])}</b>`);
  const seatedCount = () => S.players.filter((p) => p.seated).length;

  // Große Bildschirme: Gegner sitzen rund um den Tisch. Handy und kleine Fenster: kompakte Leiste oben.
  const WIDE = matchMedia('(min-width: 900px) and (min-height: 620px)');
  WIDE.addEventListener('change', () => { if (isMine()) render(); });
  const FINE = matchMedia('(pointer: fine)');
  let resultClosed = 0; // Rundennummer, deren Ergebnisfenster weggeklickt wurde
  let peekKey = null;   // Handy: vergrößerte Karte in einer überlappenden Hand

  // Was am Platz bzw. in der Leiste über einen Spieler steht
  // Am eigenen Platz unten reicht die kurze Zeile – Hand, Stapel usw. liegen ohnehin vor dir
  const infoOf = (p, seat) => (S.phase !== 'lobby' && p.inRound !== undefined ? (seat && def.seat && p.id !== S.you?.id ? def.seat(p, S) : def.playerInfo?.(p, S)) || '' : '');
  const lastAct = () => Math.max(0, ...Object.values(S.acts || {}).map((a) => a.n));
  const bubble = (p, cls) => {
    const a = S.acts?.[p.id];
    return a ? `<span class="${cls} ${a.n === lastAct() ? 'fresh' : ''}">${esc(a.text)}</span>` : '';
  };
  const nameHTML = (p) => `${esc(p.name)}${p.isHost ? ` ${ICON.crown}<span class="sr-only">(Host)</span>` : ''}`;
  const statusText = (p) => [p.id === S.turnId && '<em>am Zug</em>', !p.connected && `${ICON.offline} offline`,
    S.phase === 'playing' && !p.inRound && 'ab nächster Runde'].filter(Boolean).join(' · ');
  const pClass = (p) => `${p.id === S.turnId ? 'turn' : ''} ${p.id === S.you?.id ? 'me' : ''} ${p.connected ? '' : 'is-offline'} ${S.phase === 'playing' && !p.inRound ? 'out' : ''}`;

  function seatHTML(p) {
    return `<div class="ks ${pClass(p)}">
      ${bubble(p, 'ks-bubble')}
      <div class="ks-head"><span class="kp-av" aria-hidden="true">${avatarHTML(p)}</span>
        <span class="kp-txt"><b>${nameHTML(p)}${p.id === S.you?.id ? ' <small>(du)</small>' : ''}</b><small>${statusText(p)}</small></span></div>
      <div class="ks-info">${infoOf(p, true)}</div>
    </div>`;
  }

  // Tisch mit Plätzen: links (von unten nach oben), oben (von links nach rechts), rechts (von oben nach unten) –
  // so sitzt der Nächste in Spielrichtung links von dir, wie am echten Tisch. Du selbst unten.
  function ringHTML(center) {
    const seated = S.players.filter((p) => p.seated || p.inRound);
    const meI = seated.findIndex((p) => p.id === S.you?.id);
    const others = meI < 0 ? seated : [...seated.slice(meI + 1), ...seated.slice(0, meI)];
    const n = others.length;
    const side = n < 3 ? 0 : n < 6 ? 1 : 2;
    const left = others.slice(0, side), top = others.slice(side, n - side), right = others.slice(n - side);
    const me = meI < 0 ? null : seated[meI];
    const watchers = S.players.length - seated.length;
    const showDir = def.direction !== false && S.phase === 'playing' && seated.filter((p) => p.inRound).length > 2;
    const dirText = S.dir < 0 ? 'Spielrichtung: gegen den Uhrzeigersinn' : 'Spielrichtung: im Uhrzeigersinn';
    return `<div class="kt">
      <div class="kt-rail kt-left">${left.map(seatHTML).join('')}</div>
      <div class="kt-rail kt-top">${top.map(seatHTML).join('')}</div>
      <div class="kt-rail kt-right">${right.map(seatHTML).join('')}</div>
      <div class="kt-center">
        ${showDir ? `<div class="kt-dir ${S.dir < 0 ? 'ccw' : ''}" role="img" aria-label="${dirText}" title="${dirText}"><i></i><b>➜</b></div>` : ''}
        <div class="kt-content">${center}</div>
      </div>
      <div class="kt-rail kt-bottom">${me ? seatHTML(me) : ''}${watchers ? `<span class="kt-watch">${watchers} schau${watchers === 1 ? 't' : 'en'} zu</span>` : ''}</div>
    </div>`;
  }

  // Kompakte Leiste (Handy): wer mitspielt, wer dran ist, was man über ihn wissen darf
  function stripHTML() {
    const players = S.players.filter((p) => p.seated || p.inRound);
    const watchers = S.players.length - players.length;
    const dir = def.direction !== false && S.phase === 'playing' && players.filter((p) => p.inRound).length > 2
      ? `<div class="kp kp-watch" title="Spielrichtung"><small>${S.dir < 0 ? '↺ andersherum' : '↻ Richtung'}</small></div>` : '';
    return dir + players.map((p) => {
      const info = infoOf(p, false);
      const st = statusText(p);
      return `<div class="kp ${pClass(p)}">
        <span class="kp-av" aria-hidden="true">${avatarHTML(p)}</span>
        <span class="kp-txt"><b>${nameHTML(p)}</b>
          <small>${st}${st && info ? ' · ' : ''}${info}</small>${bubble(p, 'kp-act')}</span>
      </div>`;
    }).join('') + (watchers ? `<div class="kp kp-watch"><small>${watchers} schau${watchers === 1 ? 't' : 'en'} zu</small></div>` : '')
      || '<p class="hint" style="margin:0">Noch spielt niemand mit.</p>';
  }

  function render() {
    if (!isMine() || !$('#kg')) return;
    document.documentElement.style.setProperty('--topbar', $('#kg .topbar').offsetHeight + 'px');
    document.body.classList.toggle('calm', !!prefs.calm);
    document.body.classList.toggle('marks', !!prefs.marks);
    $('#kg-code').textContent = S.code;
    $('#kg-nav-host').hidden = !S.you?.isHost;
    const myTurn = S.turnId && S.turnId === S.you?.id;
    const status = S.phase === 'playing' ? `Runde #${S.roundNo} · ${myTurn ? '<b>Du bist dran</b>' : `${esc(nameOf(S.turnId))} ist dran`}`
      : S.phase === 'over' ? `Runde #${S.roundNo} vorbei` : 'Noch nicht gestartet';
    $('#kg-meta').innerHTML = `<div class="blinds">${esc(def.name)}</div><div class="meta-sub">${status}</div>`;
    document.body.classList.toggle('kg-myturn', !!myTurn);

    const ring = WIDE.matches;
    $('#kg-players').hidden = ring;
    if (!ring) $('#kg-players').innerHTML = stripHTML();

    // Tisch – mit „?“ für die Kurzregeln oben rechts
    const main = $('#kg-main');
    main.classList.toggle('ring', ring);
    const help = '<button class="help-btn" data-kit="help" aria-label="Kurzregeln und Hausregeln" title="Kurzregeln">?</button>';
    const center = S.phase === 'lobby' ? lobbyHTML() : def.main(S, { ring });
    main.innerHTML = help + (ring ? ringHTML(center) : center) + (S.phase === 'over' && S.result && resultClosed !== S.roundNo ? resultHTML() : '');

    // Aktionsleiste
    $('#kg-dock').innerHTML = dockHTML(myTurn);
    document.documentElement.style.setProperty('--dock-h', $('#kg-dock').offsetHeight + 'px');
    setupHand();
    if (panel) renderPanel();
  }

  // Hand nach dem Zeichnen: Ziehen auf die Ablage (Maus) und Überlappen bei vielen Karten (Handy)
  function setupHand() {
    const hand = $('#kg-dock .kg-hand');
    if (FINE.matches && def.onDrop) $$('#kg [data-drag]').forEach((el) => { if (!el.disabled) el.draggable = true; });
    if (!hand) return;
    const cards = [...hand.children];
    hand.classList.remove('overlap');
    hand.style.removeProperty('--ov');
    if (cards.length < 2 || FINE.matches && innerWidth > 640) return;
    const w = cards[0].offsetWidth;
    const gap = 6;
    const avail = hand.clientWidth - 20; // Rand, damit die vergrößerte Karte nicht abgeschnitten wird
    if (cards.length * (w + gap) - gap <= avail) return;
    // So weit überlappen, dass alles in eine Zeile passt – aber von jeder Karte bleibt ein Streifen zu sehen
    const step = Math.max(20, (avail - w) / (cards.length - 1));
    hand.classList.add('overlap');
    hand.style.setProperty('--ov', `${Math.min(0, step - w)}px`);
    if (peekKey) hand.querySelector(`[data-peek="${CSS.escape(peekKey)}"]`)?.classList.add('peek');
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

  // Rundenende: großes Fenster mit den Punkten dieser Runde und dem Stand des Abends
  function resultHTML() {
    const r = S.result;
    const ids = (r.players || Object.keys(r.points || {})).filter((id) => S.players.some((p) => p.id === id));
    const pts = (id) => r.points?.[id] || 0;
    const dir = S.lowWins ? 1 : -1;
    ids.sort((a, b) => (r.winners.includes(b) - r.winners.includes(a)) || (pts(a) - pts(b)) * dir);
    const rows = ids.map((id) => {
      const p = S.players.find((x) => x.id === id);
      const won = r.winners.includes(id);
      return `<tr class="${won ? 'won' : ''}"><td><span class="mini-av">${avatarHTML(p)}</span> ${esc(p.name)}${id === S.you?.id ? ' <small>(du)</small>' : ''}${won ? ` <span class="kg-won">${ICON.crown} gewinnt</span>` : ''}</td>
        <td class="num">${pts(id)}</td><td class="num">${p.score}</td></tr>`;
    }).join('');
    const host = S.you?.isHost;
    return `<div class="kg-over" role="dialog" aria-labelledby="kg-over-title"><div class="kg-over-card">
      <small class="kg-over-kicker">Runde #${S.roundNo} vorbei</small>
      <h2 id="kg-over-title">${esc(r.text)}</h2>
      ${rows ? `<table class="standings"><thead><tr><th>Name</th><th class="num">Runde</th><th class="num">Abend (${esc(S.scoreLabel)})</th></tr></thead><tbody>${rows}</tbody></table>
        <p class="hint" style="margin:0">${S.lowWins ? 'Wenig Punkte sind gut.' : 'Viel ist gut.'}</p>` : ''}
      <div class="kg-over-acts">
        <button class="btn btn-ghost" data-kit="closeResult">Schließen</button>
        ${host ? `<button class="btn" data-kit="switchPanel">Spiel wechseln</button><button class="btn btn-brass" data-kit="start" ${seatedCount() >= S.minPlayers ? '' : 'disabled'}>Nächste Runde</button>`
          : '<span class="waiting">Der Host startet die nächste Runde.</span>'}
      </div></div></div>`;
  }

  // Ein Satz über der Hand, was man gerade tun kann – plus Sortieren, wenn das Spiel es anbietet
  function hintRow(myTurn) {
    // hint() liefert HTML – Namen darin escapt das Spiel selbst
    const text = (def.hint && def.hint(S, myTurn)) || (myTurn ? 'Du bist dran' : `${esc(nameOf(S.turnId))} ist dran`);
    const sortKey = prefs['sort:' + def.id] || 'none';
    const sort = def.sort ? `<button class="btn btn-sm btn-ghost kg-sort" data-kit="sort" title="Handkarten sortieren">Sortieren: ${{ none: 'aus', color: 'Farbe', number: 'Zahl' }[sortKey]}</button>` : '';
    return `<div class="kg-hint-row"><p class="kg-hint ${myTurn ? 'mine' : ''}" aria-live="polite">${text}</p>${sort}</div>`;
  }

  function dockHTML(myTurn) {
    const me = S.you;
    if (S.phase === 'playing' && me?.inRound) {
      const html = def.dock(S, myTurn);
      // Spiele ohne Kartenhand liefern nur Knöpfe – die kommen in eine zentrierte Zeile
      return `<div class="kg-dock-in">${hintRow(myTurn)}${html.includes('kg-acts') ? html : `<div class="kg-acts">${html}</div>`}</div>`;
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
      parts.push(`<button class="btn btn-brass" data-kit="start" ${enough ? '' : `disabled title="Es müssen mindestens ${S.minPlayers} mitspielen"`}>${S.phase === 'over' ? 'Nochmal' : S.roundNo ? 'Nächste Runde' : 'Runde starten'}</button>`);
      if (S.phase === 'over') parts.push('<button class="btn" data-kit-panel="host">Anderes Spiel …</button>');
    }
    return `<div class="kg-dock-row">${parts.join('')}</div>`;
  }

  // ---------- Seitenleiste ----------
  const TITLES = { log: 'Verlauf', stand: 'Stand des Abends', rules: 'Regeln', host: 'Host', me: 'Ich' };
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
        <p class="hint">${S.lowWins ? 'Wenig Punkte sind gut.' : 'Viel ist gut.'}</p>
        <button class="btn btn-sm btn-ghost" data-leaderboard="${def.id}">Bestenliste aller Abende</button>`;
    } else if (panel === 'rules') {
      body.innerHTML = `<div class="kg-rules">${def.rules}</div>`;
    } else if (panel === 'me') {
      // Persönliche Einstellungen – gelten in diesem Browser für alle Spiele (gleicher Speicher wie beim Poker)
      const t = (k, label, sub = '') => `<label class="toggle"><span>${label}${sub ? `<small>${sub}</small>` : ''}</span><input type="checkbox" role="switch" data-pref="${k}" ${prefs[k] ? 'checked' : ''}></label>`;
      body.innerHTML = `<div class="kg-switches">
        ${t('marks', 'Farbsymbole auf Karten', `Jede Farbe hat zusätzlich eine Form: ${Object.keys(MARK_SHAPE).map((k) => `${colorMark(k)} ${MARK_NAME[k]}`).join(', ')}`)}
        ${t('sound', 'Töne')}
        ${t('calm', 'Animationen aus', 'Karten, Würfel und Figuren springen ohne Bewegung an ihren Platz. Ist am Gerät „Bewegung reduzieren“ an, gilt das sowieso.')}
        ${def.prefs ? def.prefs() : ''}
      </div>`;
    } else if (panel === 'host') {
      if (!S.you?.isHost) { openPanel(null); return; }
      const others = S.players.filter((p) => p.id !== S.you.id);
      const off = S.phase === 'playing' ? 'disabled' : '';
      const opts = gameOptions();
      const nums = opts.filter((o) => o.type !== 'bool').map((o) => `<label class="field"><span>${esc(o.label)}</span>
        <input type="number" data-kit-set="${o.key}" min="${o.min}" max="${o.max}" value="${esc(S.settings[o.key])}" ${off}></label>`).join('');
      const bools = opts.filter((o) => o.type === 'bool').map((o) => `<label class="toggle"><span>${esc(o.label)}</span>
        <input type="checkbox" role="switch" data-kit-set="${o.key}" ${S.settings[o.key] ? 'checked' : ''} ${off}></label>`).join('');
      const fields = opts.length ? `${nums ? `<div class="host-grid">${nums}</div>` : ''}<div class="kg-switches">${bools}</div>` : '';
      body.innerHTML = `<div class="big-actions">
          ${S.phase !== 'playing' ? `<button class="btn btn-brass" data-kit="start">${ICON.play} ${S.phase === 'over' ? 'Nochmal' : S.roundNo ? 'Nächste Runde' : 'Runde starten'}</button>` : ''}
          <button class="btn btn-outline-red" data-kit="newGame" ${S.phase === 'playing' ? 'disabled title="Geht nur zwischen zwei Runden"' : ''}>Neues Spiel (Punkte auf null)</button>
        </div>
        ${fields ? `<h3>Regeln an diesem Tisch</h3>${fields}<p class="hint" style="margin:0">Änderungen gehen nur zwischen den Runden. Die Standardwerte sind unsere üblichen Hausregeln – alle sehen die aktiven Regeln unter „?“.</p>` : ''}
        ${switchGameHTML(def.id, S.phase === 'playing')}
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
    // Überlappende Hand auf dem Handy: erstes Tippen vergrößert die Karte, zweites spielt sie
    if (def.peek && t.dataset.peek && t.closest('.kg-hand.overlap') && peekKey !== t.dataset.peek) {
      peekKey = t.dataset.peek;
      $$('#kg-dock .kg-hand .peek').forEach((x) => x.classList.remove('peek'));
      t.classList.add('peek');
      return;
    }
    peekKey = null;
    const k = t.dataset.kit;
    if (k === 'close') openPanel(null);
    else if (k === 'closeResult') { resultClosed = S.roundNo; render(); }
    else if (k === 'switchPanel') { resultClosed = S.roundNo; openPanel('host', true); render(); $('#switch-game')?.focus(); }
    else if (k === 'sort') {
      const order = ['none', 'color', 'number'];
      prefs['sort:' + def.id] = order[(order.indexOf(prefs['sort:' + def.id] || 'none') + 1) % 3];
      savePrefs();
    }
    else if (k === 'sit') send('sit');
    else if (k === 'stand') {
      if (S.phase === 'playing' && S.you?.inRound && !(await ask({ title: 'Aus der Runde aussteigen?', text: 'Deine Karten bzw. dein Spielstand in dieser Runde sind dann weg.', ok: 'Aussteigen', danger: true }))) return;
      send('stand');
    } else if (k === 'help') {
      showHelp({ title: `${def.name} – kurz erklärt`, short: def.short || [], house: [...optionLines(), ...(def.house?.(S) || [])], more: () => openPanel('rules', true) });
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
  // Karte auf ein Ziel ziehen (nur mit Maus): Quelle trägt data-drag, Ziel data-drop
  let dragEl = null;
  document.addEventListener('dragstart', (e) => {
    if (!isMine() || !def.onDrop) return;
    dragEl = e.target.closest?.('#kg [data-drag]');
    if (!dragEl) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragEl.dataset.drag);
    $$('#kg [data-drop]').forEach((z) => z.classList.add('drop-ok'));
  });
  document.addEventListener('dragend', () => { dragEl = null; $$('#kg .drop-ok, #kg .drag-over').forEach((z) => z.classList.remove('drop-ok', 'drag-over')); });
  document.addEventListener('dragover', (e) => {
    const z = dragEl && e.target.closest?.('#kg [data-drop]');
    if (!z) return;
    e.preventDefault();
    $$('#kg .drag-over').forEach((x) => x !== z && x.classList.remove('drag-over'));
    z.classList.add('drag-over');
  });
  document.addEventListener('drop', (e) => {
    const z = dragEl && e.target.closest?.('#kg [data-drop]');
    if (!z) return;
    e.preventDefault();
    const src = dragEl;
    dragEl = null;
    def.onDrop(src, z, S);
  });

  document.addEventListener('change', (e) => {
    if (!isMine()) return;
    const t = e.target;
    if (t.dataset?.pref && t.closest('#kg')) { prefs[t.dataset.pref] = t.type === 'checkbox' ? t.checked : t.value; savePrefs(); return; }
    if (t.dataset?.kitSet) send('settings', { [t.dataset.kitSet]: t.type === 'checkbox' ? t.checked : Number(t.value) }).then((r) => r?.ok && toast('Gespeichert – gilt ab der nächsten Runde'));
    else if (t.closest?.('#kg') && t.dataset?.g !== undefined) def.onChange?.(t, S, e);
  });
  document.addEventListener('keydown', (e) => {
    if (!isMine() || e.key !== 'Escape' || $('#dlg').open) return;
    if (panel) openPanel(null);
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && isMine()) document.title = 'Spieleabend'; });

  // Hand nur im Browser sortieren – gespielt wird über den Kartenwert bzw. die Karten-ID, nicht die Position
  function sortHand(st) {
    const how = prefs['sort:' + def.id];
    const key = def.sort?.[how];
    if (!key || !Array.isArray(st.g?.hand)) return;
    st.g.hand = st.g.hand.map((c, i) => [key(c), i, c]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1])).map((x) => x[2]);
  }

  Object.assign(mod, {
    show() { mount(); render(); },
    onState(st) {
      const prev = S;
      S = st;
      // Bin ich gerade drangekommen? Ton und Hinweis im Tab
      const now = st.turnId && st.turnId === st.you?.id;
      const before = prev && prev.turnId === prev.you?.id && prev.roundNo === st.roundNo;
      if (now && !before) { beep(740, 140, 0.06); setTimeout(() => beep(988, 160, 0.05), 140); if (document.hidden) document.title = '● Du bist dran – Spieleabend'; }
      if (!now) document.title = 'Spieleabend';
      if (!now || !before) peekKey = null;
      sortHand(st);
      def.onState?.(st, prev);
      render();
      // Neues Rundenende: Fokus ins Ergebnisfenster (Tastatur, Bildschirmleser)
      if (st.phase === 'over' && prev?.phase === 'playing') $('#kg .kg-over .btn-brass, #kg .kg-over .btn')?.focus();
    },
    onPrefs() { if (S) sortHand(S); render(); },
  });
  registerGame(def.id, mod);
  return { render, get S() { return S; } };
}

// ---------- Ablegespiele (Mau-Mau, UNO): gleiche Bedienung, andere Karten ----------
// opts: { id, name, rules, card(c, extra) → HTML, wishes: [[Wert, Beschriftung, Klasse]], wishLabel, lastWord }
function kitShedding(opts) {
  let wishFor = null; // Karte, für die gerade eine Farbe gewählt wird
  let callArmed = false; // „Mau“/„UNO“ für den nächsten Zug angesagt
  const kit = kitGame({
    id: opts.id, name: opts.name, rules: opts.rules, short: opts.short, house: opts.house, sort: opts.sort, prefs: opts.prefs,
    peek: true,
    playerInfo: (p) => `${p.cards} Karte${p.cards === 1 ? '' : 'n'}${p.last ? ` · <b class="kg-call">${opts.lastWord}</b>` : ''}`,
    seat: (p) => `${fanHTML(p.cards)}<span>${p.cards} Karte${p.cards === 1 ? '' : 'n'}</span>${p.last ? `<b class="kg-call">${opts.lastWord}</b>` : ''}`,
    hint(S, myTurn) {
      const g = S.g;
      if (!myTurn) return `${esc(S.players.find((p) => p.id === S.turnId)?.name ?? '?')} ist dran`;
      if (wishFor) return esc(opts.wishLabel);
      const n = g.playable.length;
      if (g.drawn) return n ? 'Gezogen – du darfst die Karte gleich legen oder „Weiter“ sagen' : 'Die gezogene Karte passt nicht – sag „Weiter“';
      if (g.pending) return n ? `${opts.pendingHint(g)} – oder zieh ${g.pending}` : `Zieh ${g.pending} Karten`;
      return n ? opts.playHint(g) : 'Nichts passt – zieh eine Karte';
    },
    onDrop(src) { if (src.dataset.card) src.click(); }, // Ablage ist das einzige Ziel – Ziehen = Antippen
    onState(S) {
      if (!S.g?.playable?.length) wishFor = null;
      if (S.turnId !== S.you?.id) callArmed = false;
    },
    main(S) {
      const g = S.g;
      const wish = g.wish ? `<div class="kg-chip">Gewünscht: <b>${esc(opts.wishName(g.wish))}</b></div>` : '';
      const pending = g.pending ? `<div class="kg-chip warn">${esc(opts.pendingText(g))}</div>` : '';
      return `<div class="kg-table">
        <div class="kg-piles">
          <div class="kg-pile">${backCard(g.deck)}<small>Stapel</small></div>
          <div class="kg-pile" data-drop="discard">${g.top ? opts.card(g.top, { cls: 'big', attrs: 'disabled' }) : ''}<small>Ablage</small></div>
        </div>
        <div class="kg-chips">${wish}${pending}</div>
      </div>`;
    },
    dock(S, myTurn) {
      const g = S.g;
      const playable = new Set(g.playable);
      // Spielbare Karten heben sich an und haben einen Goldrand, die anderen bleiben normal
      const hand = (g.hand || []).map((c, i) => opts.card(c, {
        cls: `${myTurn && playable.has(c) ? 'can' : ''} ${wishFor === c ? 'sel' : ''}`,
        attrs: `data-g="card" data-card="${c}" data-peek="${c}:${i}" ${myTurn && playable.has(c) ? `data-drag="${c}"` : ''} ${myTurn ? '' : 'disabled'}`,
      })).join('');
      let acts = '';
      if (myTurn && wishFor) {
        acts = `${opts.wishes.map(([v, l, cls]) => `<button class="btn wish ${cls}" data-g="wish" data-wish="${v}">${l}</button>`).join('')}
          <button class="btn btn-ghost" data-g="nowish">Abbrechen</button>`;
      } else if (myTurn) {
        const word = opts.lastWord.replace('!', '');
        const call = g.callNeeded && (g.hand || []).length === 2
          ? `<button class="btn ${callArmed ? 'btn-brass' : ''}" data-g="call" aria-pressed="${callArmed}" title="Bei der vorletzten Karte selbst sagen – sonst gibt es Strafkarten">„${word}“ sagen</button>` : '';
        acts = call + (g.drawn
          ? '<button class="btn" data-g="pass">Weiter</button>'
          : `<button class="btn ${playable.size ? '' : 'btn-brass'}" data-g="draw">${g.pending ? `${g.pending} Karten ziehen` : 'Karte ziehen'}</button>`);
      }
      return `<div class="kg-hand" role="group" aria-label="Deine Karten">${hand}</div><div class="kg-acts">${acts}</div>`;
    },
    onClick(t, S) {
      const g = t.dataset.g;
      if (g === 'card') {
        const c = t.dataset.card;
        if (opts.needsWish(c)) { wishFor = c; kit.render(); return; }
        send('play', { card: c, call: callArmed }); callArmed = false;
      } else if (g === 'wish') { send('play', { card: wishFor, wish: t.dataset.wish, call: callArmed }); wishFor = null; callArmed = false; }
      else if (g === 'call') { callArmed = !callArmed; kit.render(); }
      else if (g === 'nowish') { wishFor = null; kit.render(); }
      else if (g === 'draw') send('draw');
      else if (g === 'pass') send('pass');
    },
  });
  return kit;
}
