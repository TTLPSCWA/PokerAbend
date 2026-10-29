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
//   status(S, myTurn) → eigene Statuszeile oben, direction: false → keinen Richtungspfeil zeigen, afterRender(S) → nach dem Zeichnen (z. B. Animationen),
//   prefs() → eigene Schalter im Reiter „Ich“, standExtra(S) → zusätzlicher Teil im Reiter „Stand“,
//   intro: [[Überschrift, Text], …] → Erste Schritte beim ersten Spiel (3 Schritte), sounds(S, prev) → eigene Töne (Namen aus SFX),
//   translate(text) → Texte vom Server anders benennen (z. B. deutsches Blatt), onClick(el, S) für Elemente mit data-g,
//   ring: false → auch am großen Bildschirm die Spielerleiste oben statt Plätzen rund um den Tisch,
//   roundWord → statt „Runde“ (Partyspiele: „Partie“), dockKey(S) → nur wenn sich der Schlüssel ändert, wird die Aktionsleiste neu gezeichnet
//   (Eingabefelder behalten so ihren Text), watchDock(S) → Aktionen für Zuschauer, hostExtra(S) → zusätzlicher Teil im Host-Menü
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

// ---------- Kartenblatt: französisch (Kreuz, Pik, Herz, Karo) oder deutsch (Eichel, Grün, Herz, Schellen) ----------
// Gilt für alle Spiele mit 32er-Blatt (Mau-Mau, Schwimmen). Karten sind immer „Rang + Farbe“ (z. B. "Kh");
// das deutsche Blatt ist nur eine andere Ansicht (Bube = Unter, Dame = Ober). Schalter unter „Ich“: deckPrefHTML().
const DECK = (() => {
  usePrefs({ deck: 'fr' });
  const german = () => prefs.deck === 'de';

  // Deutsche Farben als eigene kleine Zeichnungen (keine Bilder aus dem Netz)
  const DE_SUIT = {
    c: '<ellipse cx="12" cy="15.2" rx="5.3" ry="6.6" fill="#C8963A"/><path d="M5 10.6a7 6.2 0 0 1 14 0z" fill="#6B4423"/><path d="M7.5 8.3l9 0M6.6 9.8h10.8" stroke="#8A5C33" stroke-width=".9"/><path d="M12 4.6V1.8" stroke="#6B4423" stroke-width="2" stroke-linecap="round"/>', // Eichel
    s: '<path d="M12 2C6.4 5.8 4.3 10.8 6.1 15.6c1.3 3.3 3.7 5 5.9 5s4.6-1.7 5.9-5C19.7 10.8 17.6 5.8 12 2z" fill="#2E8B4E"/><path d="M12 5.5V23M12 10l-3-2.2M12 10l3-2.2M12 14l-3.6-2.4M12 14l3.6-2.4" stroke="#1A5A31" stroke-width="1.2" fill="none" stroke-linecap="round"/>', // Grün (Blatt)
    h: '<path d="M12 21s-7.6-4.7-9.6-9.3C.9 8.3 3.1 4.4 6.7 4.4c2.2 0 3.7 1.3 5.3 3.3 1.6-2 3.1-3.3 5.3-3.3 3.6 0 5.8 3.9 4.3 7.3C19.6 16.3 12 21 12 21z" fill="#C8322D"/>', // Herz
    d: '<circle cx="12" cy="12.5" r="8.6" fill="#E8B21C" stroke="#9A6B00" stroke-width="1"/><path d="M3.8 10.6h16.4" stroke="#C8322D" stroke-width="2.6"/><circle cx="12" cy="16.2" r="1.7" fill="#5A3A00"/><path d="M12 16.5v3.8" stroke="#5A3A00" stroke-width="1.5"/>', // Schellen
  };
  const deSuit = (s, cls = '') => `<svg class="de-suit ${cls}" viewBox="0 0 24 24" aria-hidden="true">${DE_SUIT[s]}</svg>`;
  const NAME = {
    fr: { c: 'Kreuz', s: 'Pik', h: 'Herz', d: 'Karo' },
    de: { c: 'Eichel', s: 'Grün', h: 'Herz', d: 'Schellen' },
  };
  const DE_RANK = { T: '10', J: 'U', Q: 'O', K: 'K', A: 'A' };
  const DE_RANK_NAME = { T: '10', J: 'Unter', Q: 'Ober', K: 'König', A: 'Ass' };
  const suitName = (s) => NAME[german() ? 'de' : 'fr'][s];
  const suitSign = (s) => (german() ? deSuit(s, 'inline') : SUIT_SIGN[s]);

  // Deutsches Blatt: Wert in der Ecke, große Farbe in der Mitte
  function germanCard(c, { cls = '', attrs = '' } = {}) {
    const r = DE_RANK[c[0]] || c[0];
    return `<button type="button" class="kc kc-de ${cls}" ${attrs} aria-label="${esc(`${NAME.de[c[1]]} ${DE_RANK_NAME[c[0]] || c[0]}`)}"><span class="r">${r}</span>${deSuit(c[1], 'big-suit')}</button>`;
  }
  const card = (c, o) => (german() ? germanCard(c, o) : frenchCard(c, o));

  // Texte vom Server (Verlauf, Sprechblasen) nennen französische Karten – beim deutschen Blatt übersetzen
  const DE_WORDS = [[/Kreuz/g, 'Eichel'], [/Pik/g, 'Grün'], [/Karo/g, 'Schellen'], [/Buben/g, 'Unter'], [/Bube/g, 'Unter'], [/Damen/g, 'Ober'], [/Dame/g, 'Ober'], [/[♣♠♦♥]\s?/g, '']];
  const translate = (t) => (german() ? DE_WORDS.reduce((s, [re, to]) => s.replace(re, to), t) : t);
  return { german, deSuit, suitName, suitSign, card, translate };
})();
const isGermanDeck = () => DECK.german();
const deckCard = (c, o) => DECK.card(c, o);
const deckTranslate = (t) => DECK.translate(t);
const deckSuit = (s, cls) => DECK.deSuit(s, cls);
const deckSuitName = (s) => DECK.suitName(s);
const deckSuitSign = (s) => DECK.suitSign(s);
const deckPrefHTML = () => `<label class="toggle"><span>Kartenblatt<small>Französisch: Kreuz, Pik, Herz, Karo. Deutsch: Eichel, Grün, Herz, Schellen (Unter, Ober). Gilt für alle Spiele mit 32 Karten.</small></span>
      <select data-pref="deck" class="input" style="max-width:150px">
        <option value="fr" ${isGermanDeck() ? '' : 'selected'}>Französisch</option>
        <option value="de" ${isGermanDeck() ? 'selected' : ''}>Deutsch</option>
      </select></label>`;

  // Welcher Ton passt zu einer Aktion („legt Herz König“, „UNO!“, „würfelt 5“ …)? Wichtigeres zuerst.
const ACT_SOUNDS = [[/^(UNO|Mau|31|Feuer|Kniffel)!/, 'call'], [/^Box zu!/, 'call'], [/^alle sechs!/, 'call'], [/^Mühle!/, 'call'], [/^setzt$/, 'chips'], [/^Niete/, 'end'], [/^schreibt/, 'done'], [/^\+\d/, 'chips'], [/^schließt/, 'chips'], [/^klopft/, 'drum'], [/versenkt!$/, 'drum'], [/^Blackjack!/, 'call'], [/über 21/, 'end'], [/ Treffer$/, 'hit'], [/ Wasser$/, 'splash'], [/^Erwischt/, 'catch'], [/schlägt/, 'hit'], [/zweifelt/, 'drum'], [/^Phase d+ ✓/, 'done'],
  [/setzt aus/, 'skip'], [/würfelt/, 'dice'], [/^(zieht|nimmt Ablage|erwischt)/, 'draw'], [/^(legt|wirft ab|ungesehen|tauscht|Karte:|verdoppelt|teilt)/, 'card'], [/^(setzt d|versichert|kauft)/, 'chips']];
function actSound(acts, prev) {
  const seen = Math.max(0, ...Object.values(prev || {}).map((a) => a.n));
  const fresh = Object.values(acts || {}).filter((a) => a.n > seen).map((a) => a.text);
  for (const [re, name] of ACT_SOUNDS) if (fresh.some((t) => re.test(t))) return name;
  return null;
}

// ---------- Rahmen ----------
function kitGame(def) {
  const mod = {};
  let S = null;
  let panel = null;
  let fullLog = null; // ganzer Verlauf, wenn geladen
  const isMine = () => current === mod && S;

  // Was „Ansehen“ zeigt: die Teile des Spiels (def.look) und die letzten Züge – alles aus dem öffentlichen Zustand
  function lookSheet(st) {
    return { title: `${def.name} ansehen`, sections: [...(def.look?.(st) || []), { title: 'Letzte Züge', html: lookMoves(st.moves, { detail: def.moveDetail ? (m) => def.moveDetail(m, st) : null }) }] };
  }
  mod.lookSheet = lookSheet;

  function mount() {
    $('#game-root').innerHTML = `<div id="kg" class="kg kg-${def.id}">
      <header class="topbar">
        <div class="top-left">
          ${homeButtonHTML()}
          <button class="code-chip" data-kit="copy" title="Einladungslink kopieren" aria-label="Einladungslink kopieren">
            <span class="code-label">Raum</span> <b id="kg-code">-----</b>
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>
          </button>
        </div>
        <div class="meta" id="kg-meta" aria-live="polite"></div>
        <div class="top-right">
          <nav class="topnav" aria-label="Seitenleisten">
            <button class="nav-btn" data-kit-panel="log">${svg('<path d="M4 6h16M4 12h16M4 18h10"/>')}<span>Verlauf</span></button>
            <button class="nav-btn" data-kit="look" id="kg-nav-look" hidden aria-label="Ansehen">${svg('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>')}<span>Ansehen</span></button>
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
  let dockKeyPrev = null; // Schlüssel der zuletzt gezeichneten Aktionsleiste (dockKey)
  let resultClosed = 0; // Rundennummer, deren Ergebnisfenster weggeklickt wurde
  let peekKey = null;   // Handy: vergrößerte Karte in einer überlappenden Hand

  // Was am Platz bzw. in der Leiste über einen Spieler steht
  // Am eigenen Platz unten reicht die kurze Zeile – Hand, Stapel usw. liegen ohnehin vor dir
  const infoOf = (p, seat) => (S.phase !== 'lobby' && p.inRound !== undefined ? (seat && def.seat && p.id !== S.you?.id ? def.seat(p, S) : def.playerInfo?.(p, S)) || '' : '');
  const tr = (t) => (def.translate ? def.translate(t) : t);
  const RW = def.roundWord || 'Runde';
  const lastAct = () => Math.max(0, ...Object.values(S.acts || {}).map((a) => a.n));
  const bubble = (p, cls) => {
    const a = S.acts?.[p.id];
    return a ? `<span class="${cls} ${a.n === lastAct() ? 'fresh' : ''}">${esc(tr(a.text))}</span>` : '';
  };
  const nameHTML = (p) => `${esc(p.name)}${p.isHost ? ` ${ICON.crown}<span class="sr-only">(Host)</span>` : ''}`;
  const statusText = (p) => [p.id === S.turnId && '<em>am Zug</em>', !p.connected && `${ICON.offline} offline`,
    S.phase === 'playing' && !p.inRound && 'ab nächster Runde'].filter(Boolean).join(' · ');
  const pClass = (p) => `${p.id === S.turnId ? 'turn' : ''} ${p.id === S.you?.id ? 'me' : ''} ${p.connected ? '' : 'is-offline'} ${S.phase === 'playing' && !p.inRound ? 'out' : ''}`;

  function seatHTML(p) {
    return `<div class="ks ${pClass(p)}" data-pid="${esc(p.id)}">
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
      return `<div class="kp ${pClass(p)}" data-pid="${esc(p.id)}">
        <span class="kp-av" aria-hidden="true">${avatarHTML(p)}</span>
        <span class="kp-txt"><b>${nameHTML(p)}</b>
          <small>${st}${st && info ? ' · ' : ''}${info}</small>${bubble(p, 'kp-act')}</span>
      </div>`;
    }).join('') + (watchers ? `<div class="kp kp-watch"><small>${watchers} schau${watchers === 1 ? 't' : 'en'} zu</small></div>` : '')
      || '<p class="hint" style="margin:0">Noch spielt niemand mit.</p>';
  }

  // Restzeit des Zug-Timers anzeigen (Serverzeit, an die eigene Uhr angeglichen)
  let clockOffset = 0;
  function tickClock() {
    const el = $('#kg-clock');
    if (!el || !S?.deadline) return;
    const left = Math.max(0, Math.ceil((S.deadline - (Date.now() + clockOffset)) / 1000));
    el.textContent = `noch ${left} s`;
    el.classList.toggle('urgent', left <= 10);
  }
  setInterval(() => { if (isMine()) tickClock(); }, 1000);

  function render() {
    if (!isMine() || !$('#kg')) return;
    document.documentElement.style.setProperty('--topbar', $('#kg .topbar').offsetHeight + 'px');
    document.body.classList.toggle('calm', !!prefs.calm);
    document.body.classList.toggle('marks', !!prefs.marks);
    $('#kg-code').textContent = S.code;
    $('#kg-nav-host').hidden = !S.you?.isHost;
    $('#kg-nav-look').hidden = S.phase === 'lobby';
    const myTurn = S.turnId && S.turnId === S.you?.id;
    // status(S) darf das Spiel selbst liefern (z. B. „Schiffe setzen“, wenn niemand dran ist)
    const status = (S.phase === 'playing' && def.status?.(S, myTurn)) || (S.phase === 'playing' ? `${RW} #${S.roundNo} · ${myTurn ? '<b>Du bist dran</b>' : `${esc(nameOf(S.turnId))} ist dran`}`
      : S.phase === 'over' ? `${RW} #${S.roundNo} vorbei` : 'Noch nicht gestartet');
    // Zug-Timer: Restzeit (läuft im Sekundentakt weiter, siehe tickClock)
    const clock = S.phase === 'playing' && S.deadline ? ` · <span id="kg-clock" class="${myTurn ? 'mine' : ''}"></span>` : '';
    $('#kg-meta').innerHTML = `<div class="blinds">${esc(def.name)}</div><div class="meta-sub">${status}${clock}</div>`;
    tickClock();
    document.body.classList.toggle('kg-myturn', !!myTurn);

    const ring = WIDE.matches && def.ring !== false; // ring: false → immer die kompakte Spielerleiste (Partyspiele haben lange Auflösungen)
    $('#kg-players').hidden = ring;
    if (!ring) $('#kg-players').innerHTML = stripHTML();

    // Tisch – mit „?“ für die Kurzregeln oben rechts
    const main = $('#kg-main');
    main.classList.toggle('ring', ring);
    const help = '<button class="help-btn" data-kit="help" aria-label="Kurzregeln und Hausregeln" title="Kurzregeln">?</button>';
    const center = S.phase === 'lobby' ? lobbyHTML() : def.main(S, { ring });
    main.classList.toggle('has-program', !!S.partyProgram);
    main.innerHTML = help + programBannerHTML(S) + (ring ? ringHTML(center) : center) + (S.phase === 'over' && S.result && resultClosed !== S.roundNo ? resultHTML() : '');

    // Aktionsleiste
    const baseDockKey = def.dockKey ? def.dockKey(S, myTurn) : null;
    const dkey = baseDockKey === null ? null : `${baseDockKey}|${S.partyProgram?.status || ''}|${S.partyProgram?.index ?? ''}`;
    if (dkey === null || dkey !== dockKeyPrev || !$('#kg-dock').firstChild) { $('#kg-dock').innerHTML = dockHTML(myTurn); dockKeyPrev = dkey; }
    document.documentElement.style.setProperty('--dock-h', $('#kg-dock').offsetHeight + 'px');
    setupHand();
    if (panel) renderPanel();
    def.afterRender?.(S);
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
      return `<tr class="${won ? 'won' : ''}"><td><span class="mini-av">${avatarHTML(p)}</span> ${esc(p.name)}${id === S.you?.id ? ' <small>(du)</small>' : ''}${won ? ` <span class="kg-won">${ICON.crown} gewinnt</span>` : ''}${r.detail?.[id] ? `<small class="kg-detail">${esc(r.detail[id])}</small>` : ''}</td>
        <td class="num">${pts(id)}</td><td class="num">${p.score}</td></tr>`;
    }).join('');
    const host = S.you?.isHost;
    return `<div class="kg-over" role="dialog" aria-labelledby="kg-over-title"><div class="kg-over-card">
      <small class="kg-over-kicker">${RW} #${S.roundNo} vorbei</small>
      <h2 id="kg-over-title">${esc(r.text)}</h2>
      ${rows ? `<table class="standings"><thead><tr><th>Name</th><th class="num">Runde</th><th class="num">Abend (${esc(S.scoreLabel)})</th></tr></thead><tbody>${rows}</tbody></table>
        <p class="hint" style="margin:0">${S.lowWins ? 'Wenig Punkte sind gut.' : 'Viel ist gut.'}</p>` : ''}
      ${def.resultExtra ? def.resultExtra(S) : ''}
      ${S.partyProgram?.status === 'done' ? programStandHTML(S) : ''}
      <div class="kg-over-acts">
        <button class="btn btn-ghost" data-kit="closeResult">Schließen</button>
        ${host && S.partyProgram?.status === 'done' ? '<button type="button" class="btn btn-brass" data-program="plan">Neues Programm planen</button>' : host ? `<button class="btn" data-kit="switchPanel">Spiel wechseln</button><button class="btn btn-brass" data-kit="start" ${seatedCount() >= S.minPlayers ? '' : 'disabled'}>${S.partyProgram?.status === 'between' ? 'Nächstes Programm-Spiel' : `Nächste ${RW}`}</button>`
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
    const watch = S.phase === 'playing' && def.watchDock ? def.watchDock(S) : '';
    if (me?.playing) {
      parts.push(`<span class="waiting">${S.phase === 'playing' ? 'Du spielst ab der nächsten Runde mit.' : 'Du spielst mit.'}</span>`);
      parts.push('<button class="btn btn-ghost" data-kit="stand">Zuschauen</button>');
    } else {
      parts.push('<span class="waiting">Du schaust zu.</span>');
      parts.push(`<button class="btn btn-brass" data-kit="sit" ${seatedCount() >= S.maxPlayers ? 'disabled title="Alle Plätze sind besetzt"' : ''}>Mitspielen</button>`);
    }
    if (me?.isHost && S.phase !== 'playing') {
      const p = S.partyProgram;
      const pending = p?.status === 'ready' || programRunning(S);
      const enough = pending ? seatedCount() > 0 : seatedCount() >= S.minPlayers;
      const label = p?.status === 'ready' ? 'Abendprogramm starten' : p?.status === 'between' ? 'Nächstes Programm-Spiel' : programRunning(S) ? 'Partie wiederholen' : S.phase === 'over' ? 'Nochmal' : S.roundNo ? `Nächste ${RW}` : `${RW} starten`;
      parts.push(p?.status === 'done' ? '<button type="button" class="btn btn-brass" data-program="plan">Programm planen</button>' : `<button class="btn btn-brass" data-kit="start" ${enough ? '' : `disabled title="Es müssen mindestens ${S.minPlayers} mitspielen"`}>${label}</button>`);
      if (S.phase === 'over') parts.push(`<button class="btn" data-kit-panel="host">${programRunning(S) ? 'Programm verwalten' : 'Anderes Spiel …'}</button>`);
    }
    const row = `<div class="kg-dock-row">${parts.join('')}</div>`;
    return watch ? `<div class="kg-dock-in">${watch}${row}</div>` : row;
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
    if (!force && body.contains(document.activeElement) && document.activeElement.matches('input, select, textarea')) return;
    if (panel === 'log') {
      const list = fullLog || S.log;
      let round = null;
      const atBottom = body.scrollTop + body.clientHeight >= body.scrollHeight - 30;
      body.innerHTML = `<ul class="log">${list.filter((l) => l.cat !== 'hand').map((l) => {
        const head = l.hand !== round ? `<li class="hand">${l.hand ? `${RW} #${l.hand}` : 'Vor der ersten Runde'}</li>` : '';
        round = l.hand;
        return `${head}<li class="${esc(l.kind)}">${esc(tr(l.text))}</li>`;
      }).join('')}</ul>
        ${fullLog ? '' : '<button class="btn btn-sm btn-ghost" data-kit="history">Ganzen Verlauf laden</button>'}`;
      if (atBottom || force) body.scrollTop = body.scrollHeight;
    } else if (panel === 'stand') {
      const winsCol = S.scoreLabel !== 'Siege'; // zählt das Spiel ohnehin Siege, nicht zweimal zeigen
      body.innerHTML = `${programStandHTML(S)}<table class="standings"><thead><tr><th></th><th>Name</th><th class="num">${esc(S.scoreLabel)}</th>${winsCol ? '<th class="num">Siege</th>' : ''}</tr></thead><tbody>
        ${S.standings.map((p, k) => `<tr><td><span class="rank ${k < 3 ? 'r' + (k + 1) : ''}" aria-label="Platz ${k + 1}">${k + 1}</span></td>
          <td><span class="mini-av">${avatarHTML(p)}</span> ${esc(p.name)}</td><td class="num">${p.score}</td>${winsCol ? `<td class="num">${p.wins}</td>` : ''}</tr>`).join('')}
        </tbody></table>
        <p class="hint">${S.lowWins ? 'Wenig Punkte sind gut.' : 'Viel ist gut.'}</p>
        ${def.standExtra ? def.standExtra(S) : ''}
        <button class="btn btn-sm btn-ghost" data-leaderboard="${def.id}">Bestenliste aller Abende</button>`;
    } else if (panel === 'rules') {
      body.innerHTML = `<div class="kg-rules">${def.rules}</div>`;
    } else if (panel === 'me') {
      // Persönliche Einstellungen – gelten in diesem Browser für alle Spiele (gleicher Speicher wie beim Poker)
      const t = (k, label, sub = '') => `<label class="toggle"><span>${label}${sub ? `<small>${sub}</small>` : ''}</span><input type="checkbox" role="switch" data-pref="${k}" ${prefs[k] ? 'checked' : ''}></label>`;
      body.innerHTML = `<div class="kg-switches">
        ${t('marks', 'Farbsymbole auf Karten', `Jede Farbe hat zusätzlich eine Form: ${Object.keys(MARK_SHAPE).map((k) => `${colorMark(k)} ${MARK_NAME[k]}`).join(', ')}`)}
        ${t('sound', 'Töne', 'Karten, Würfel, „UNO!“ und ein Signal, wenn du dran bist')}
        ${t('calm', 'Animationen aus', 'Karten, Würfel und Figuren springen ohne Bewegung an ihren Platz. Ist am Gerät „Bewegung reduzieren“ an, gilt das sowieso.')}
        ${t('intros', 'Erste Schritte zeigen', 'Kurze Einführung beim ersten Spiel jeder Art. Einschalten zeigt sie wieder.')}
        ${def.prefs ? def.prefs() : ''}
      </div>`;
    } else if (panel === 'host') {
      if (!S.you?.isHost) { openPanel(null); return; }
      const others = S.players.filter((p) => p.id !== S.you.id);
      const off = S.phase === 'playing' || programRunning(S) ? 'disabled' : '';
      const opts = gameOptions();
      const nums = opts.filter((o) => o.type !== 'bool').map((o) => `<label class="field"><span>${esc(o.label)}</span>
        <input type="number" data-kit-set="${o.key}" min="${o.min}" max="${o.max}" value="${esc(S.settings[o.key])}" ${off}></label>`).join('');
      const bools = opts.filter((o) => o.type === 'bool').map((o) => `<label class="toggle"><span>${esc(o.label)}</span>
        <input type="checkbox" role="switch" data-kit-set="${o.key}" ${S.settings[o.key] ? 'checked' : ''} ${off}></label>`).join('');
      const fields = opts.length ? `${nums ? `<div class="host-grid">${nums}</div>` : ''}<div class="kg-switches">${bools}</div>` : '';
      body.innerHTML = `<div class="big-actions">
          ${S.phase !== 'playing' ? `<button class="btn btn-brass" data-kit="start">${ICON.play} ${S.phase === 'over' ? 'Nochmal' : S.roundNo ? `Nächste ${RW}` : `${RW} starten`}</button>` : ''}
          <button class="btn btn-outline-red" data-kit="newGame" ${S.phase === 'playing' ? 'disabled title="Geht nur zwischen zwei Runden"' : ''}>Neues Spiel (Punkte auf null)</button>
        </div>
        ${programControlsHTML(S)}
        ${def.noBots ? '' : botControlsHTML(S, S.phase === 'playing' || programRunning(S))}
        ${unlistedSwitchHTML(S)}
        ${fields ? `<h3>Regeln an diesem Tisch</h3>${fields}<p class="hint" style="margin:0">Änderungen gehen nur zwischen den Runden. Die Standardwerte sind unsere üblichen Hausregeln – alle sehen die aktiven Regeln unter „?“.</p>` : ''}
        ${def.hostExtra ? def.hostExtra(S) : ''}
        ${switchGameHTML(def.id, S.phase === 'playing')}
        ${endGameHTML(S.phase === 'playing', RW)}
        <h3>Leute im Raum</h3>
        <div class="plist">${others.map((p) => `<div class="prow"><span class="mini-av">${avatarHTML(p)}</span>
          <div class="who"><b>${esc(p.name)}</b><small>${p.seated ? 'spielt mit' : 'schaut zu'}${p.connected ? '' : ' · offline'}</small></div>
          ${p.bot ? '' : `<button class="btn btn-sm" data-kit-host="${p.id}" title="Host weitergeben">${ICON.crown}</button>`}
          <button class="btn btn-sm btn-outline-red" data-kit-kick="${p.id}">Entfernen</button></div>`).join('') || '<p class="hint" style="margin:0">Noch niemand sonst da.</p>'}</div>`;
    }
  }

  // ---------- Eingaben ----------
  document.addEventListener('click', async (e) => {
    if (!isMine()) return;
    const t = e.target.closest('[data-kit], [data-end], [data-kit-panel], [data-kit-kick], [data-kit-host], [data-g]');
    if (!t || t.disabled) return;
    if (t.dataset.end) return endGameClick(t.dataset.end, RW);
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
    } else if (k === 'look') openLook(lookSheet(S));
    else if (k === 'start') send('start');
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
    if (t.dataset?.pref && t.closest('#kg')) {
      prefs[t.dataset.pref] = t.type === 'checkbox' ? t.checked : t.value;
      if (t.dataset.pref === 'intros' && t.checked) resetIntros();
      savePrefs();
      return;
    }
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
    show() {
      mount(); render();
      if (def.intro) setTimeout(() => { if (isMine() && !$('#dlg').open) showIntro(def.id, def.name, def.intro); }, 400);
    },
    onState(st) {
      const prev = S;
      S = st;
      // Bin ich gerade drangekommen? Ton und Hinweis im Tab
      const now = st.turnId && st.turnId === st.you?.id;
      const before = prev && prev.turnId === prev.you?.id && prev.roundNo === st.roundNo;
      if (now && !before) { beep(740, 140, 0.06); setTimeout(() => beep(988, 160, 0.05), 140); if (document.hidden) document.title = '● Du bist dran – Spieleabend'; }
      if (!now) document.title = 'Spieleabend';
      if (!now || !before) peekKey = null;
      // Spiel-Töne: neue Runde = mischen, Rundenende = Sieg oder Schluss, sonst passend zur letzten Aktion
      if (prev && prev.roundNo !== st.roundNo && st.phase === 'playing') sfx('shuffle');
      else if (prev?.phase === 'playing' && st.phase === 'over') sfx(st.result?.winners?.includes(st.you?.id) ? 'win' : 'end');
      else if (prev && prev.roundNo === st.roundNo) { const name = def.sounds?.(st, prev) || actSound(st.acts, prev.acts); if (name) sfx(name); }
      sortHand(st);
      clockOffset = (st.now || Date.now()) - Date.now();
      def.onState?.(st, prev);
      render();
      // Neues Rundenende: Fokus ins Ergebnisfenster (Tastatur, Bildschirmleser)
      if (st.phase === 'over' && prev?.phase === 'playing') $('#kg .kg-over .btn-brass, #kg .kg-over .btn')?.focus();
    },
    onPrefs() { if (S) sortHand(S); render(); },
  });
  registerGame(def.id, mod);
  return { render, get S() { return S; }, lookSheet };
}

// ---------- Ablegespiele (Mau-Mau, UNO): gleiche Bedienung, andere Karten ----------
// opts: { id, name, rules, card(c, extra) → HTML, wishes: [[Wert, Beschriftung, Klasse]], wishLabel, lastWord }
function kitShedding(opts) {
  let wishFor = null; // Karte, für die gerade eine Farbe gewählt wird
  let callArmed = false; // „Mau“/„UNO“ für den nächsten Zug angesagt
  const kit = kitGame({
    id: opts.id, name: opts.name, house: opts.house, sort: opts.sort, prefs: opts.prefs, translate: opts.translate, intro: opts.intro,
    look: (S) => [{ title: 'Zuletzt gelegt', html: lookMoves(S.moves, { filter: (m) => /^legt /.test(m.t), n: 10 }) }],
    moveDetail: () => '',
    get rules() { return opts.rules; },
    get short() { return opts.short; },
    peek: true,
    playerInfo: (p) => `${p.cards} Karte${p.cards === 1 ? '' : 'n'}${p.last ? ` · <b class="kg-call">${opts.lastWord}</b>` : ''}`,
    seat: (p) => `${fanHTML(p.cards)}<span>${p.cards} Karte${p.cards === 1 ? '' : 'n'}</span>${p.last ? `<b class="kg-call">${opts.lastWord}</b>` : ''}`,
    hint(S, myTurn) {
      const g = S.g;
      if (g.forgot && g.forgot !== S.you?.id) return `<b>${esc(S.players.find((p) => p.id === g.forgot)?.name ?? '?')} hat „${opts.lastWord.replace('!', '')}“ vergessen</b> – tipp schnell auf „Erwischt!“`;
      if (!myTurn) return `${esc(S.players.find((p) => p.id === S.turnId)?.name ?? '?')} ist dran`;
      if (wishFor) return esc(opts.wishLabel);
      if (g.forgot === S.you?.id) return `Du hast „${opts.lastWord.replace('!', '')}“ vergessen – schnell nachholen, bevor dich jemand erwischt!`;
      const n = g.playable.length;
      if (g.drawn) return n ? 'Gezogen – du darfst die Karte gleich legen oder „Weiter“ sagen' : 'Die gezogene Karte passt nicht – sag „Weiter“';
      if (g.pending) return n ? `${opts.pendingHint(g)} – oder zieh ${g.pending}` : `Zieh ${g.pending} Karten`;
      return n ? opts.playHint(g) : 'Nichts passt – zieh eine Karte';
    },
    onDrop(src) { if (src.dataset.card) src.click(); }, // Ablage ist das einzige Ziel – Ziehen = Antippen
    onState(S) {
      if (!S.g?.playable?.includes(wishFor)) wishFor = null; // Karte weg oder nicht mehr spielbar
      if (S.turnId !== S.you?.id) callArmed = false;
    },
    main(S) {
      const g = S.g;
      const wishBig = g.wish && opts.wishBadge
        ? `<div class="kg-pile kg-wish" role="status"><div class="kg-wish-badge">${opts.wishBadge(g.wish)}</div><small>Gewünscht: <b>${esc(opts.wishName(g.wish))}</b></small></div>` : '';
      const wish = g.wish && !opts.wishBadge ? `<div class="kg-chip">Gewünscht: <b>${esc(opts.wishName(g.wish))}</b></div>` : '';
      const pending = g.pending ? `<div class="kg-chip warn">${esc(opts.pendingText(g))}</div>` : '';
      const penalty = g.pending ? `<span class="kg-penalty" aria-label="Strafe: ${g.pending} Karten ziehen">+${g.pending}</span>` : '';
      return `<div class="kg-table">
        <div class="kg-piles">
          <div class="kg-pile">${backCard(g.deck)}<small>Stapel</small></div>
          <div class="kg-pile kg-discard ${opts.pileClass ? opts.pileClass(g) : ''}" data-drop="discard">${g.top ? opts.card(g.top, { cls: 'big', attrs: 'disabled' }) : ''}${penalty}<small>Ablage</small></div>
          ${wishBig}
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
        acts = `<div class="kg-wishes" role="group" aria-label="${esc(opts.wishLabel)}">${opts.wishes.map(([v, l, cls]) => `<button class="btn wish ${cls}" data-g="wish" data-wish="${v}">${l}</button>`).join('')}</div>
          <button class="btn btn-ghost" data-g="nowish">Abbrechen</button>`;
      } else if (myTurn) {
        const call = g.callNeeded && (g.hand || []).length === 2
          ? `<button class="btn btn-call ${callArmed ? 'armed' : ''}" data-g="call" aria-pressed="${callArmed}" title="Bei der vorletzten Karte selbst sagen – sonst gibt es Strafkarten">${callArmed ? '✓ ' : ''}${opts.lastWord}</button>` : '';
        acts = call + (g.drawn
          ? '<button class="btn" data-g="pass">Weiter</button>'
          : `<button class="btn ${playable.size ? '' : 'btn-brass'}" data-g="draw">${g.pending ? `${g.pending} Karten ziehen` : 'Karte ziehen'}</button>`);
      }
      if (g.forgot === S.you?.id) acts = `<button class="btn btn-call" data-g="late">${opts.lastWord}</button>` + acts;
      else if (g.forgot) acts = `<button class="btn btn-call catch" data-g="catch">Erwischt! (+2 für ${esc(S.players.find((p) => p.id === g.forgot)?.name ?? '?')})</button>` + acts;
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
      else if (g === 'catch') send('catch');
      else if (g === 'late') send('late');
    },
  });
  return kit;
}
