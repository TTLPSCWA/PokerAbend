// Schiffe versenken im Browser (Regeln: games/schiffe/room.js). Der Server schickt die gegnerischen Schiffe erst nach Spielende –
// vorher kennt diese Seite nur Treffer, Wasser und versenkte Schiffe.
// Setzen: Schiff unten wählen, aufs eigene Meer tippen (oder ziehen), „Drehen“, „Zufällig verteilen“, „Fertig“.
// Schießen: Feld im gegnerischen Meer antippen. Mit Maus schießt ein Klick, auf dem Handy erst wählen, dann „Feuer“.
'use strict';
{
  const SIZE = 10;
  const FLEETS_N = { standard: 5, classic: 10 }; // Schiffe je Flotte (Server: FLEETS in room.js)
  const COLS = 'ABCDEFGHIJ';
  const SHIP = { 5: 'Flugzeugträger', 4: 'Schlachtschiff', 3: 'Kreuzer', 2: 'Zerstörer' };
  const cellName = (i) => `${COLS[i % SIZE]}${Math.floor(i / SIZE) + 1}`;
  const FINE = matchMedia('(pointer: fine)');

  // ---- Design (Skin): nur das Aussehen. Die ID kommt als Raumeinstellung vom Server (games/schiffe/skins.js) und gilt für alle am Tisch. ----
  const SKINS = ['naval', 'space'];
  const skinOf = (S) => (SKINS.includes(S?.settings?.skin) ? S.settings.skin : 'naval');
  let skinNow = 'naval', svTab = 'target'; // Design des Tisches; Reiter „Zielsektor / Eigene Flotte“ auf schmalen Handys (nur Taktik-Konsole)
  function applySkin(S) { if (S) skinNow = skinOf(S); const root = document.getElementById('kg'); if (root && S) root.dataset.svSkin = skinNow; }
  // Klassisch (naval): vorgerenderte Watercraft-Modelle von oben (Kenney, CC0), Stahlton eingerechnet. Passregel aus dem Entwurf (Design C):
  // Länge N − 0,1 Felder, Breite höchstens 0,96 Zeilen, rundum 22 % Rand für den Schatten. len/wid in Feldern.
  const NAVAL_ART = '/games/schiffe/art/naval/';
  const NAVAL_FIT = {
    5: [{ m: 'ship-ocean-liner', len: 4.9, wid: 0.96 }], 4: [{ m: 'ship-ocean-liner-small', len: 3.68, wid: 0.96 }],
    3: [{ m: 'ship-cargo-a', len: 2.9, wid: 0.96 }, { m: 'ship-cargo-b', len: 2.9, wid: 0.96 }], 2: [{ m: 'boat-tow-a', len: 1.9, wid: 0.89 }],
  };
  // Modellwahl nur aus Länge und Lage der Zellen – für alle gleich (auch die Gegenseite sieht dasselbe Modell, nichts Verdecktes)
  const navalFit = (n, first) => { const list = NAVAL_FIT[n] || NAVAL_FIT[n > 5 ? 5 : 2]; return list[(Math.floor(first / SIZE) + first % SIZE) % list.length]; };
  // Taktik-Konsole (space): fünf Raumschiffklassen in Draufsicht aus dem Vault-Entwurf (eigene Zeichnungen, art/space/). Längen und Regeln bleiben, die Klassennamen sind nur Anzeige.
  const SPACE_ART = '/games/schiffe/art/space/';
  const SPACE_CLASS = { 5: ['Träger'], 4: ['Schlachtkreuzer'], 3: ['Fregatte', 'Korvette'], 2: ['Jäger'] };
  const spaceSize = (n) => (n >= 5 ? 5 : n <= 2 ? 2 : n);
  const spaceName = (n, k = 0) => { const list = SPACE_CLASS[spaceSize(n)]; return list[k % list.length]; };
  const spaceNames = (sizes) => { const seen = {}; return sizes.map((n) => spaceName(n, (seen[n] = (seen[n] ?? -1) + 1))); };
  const spaceImg = (n, vertical, wreck) => SPACE_ART + 'ship-' + spaceSize(n) + '-' + (vertical ? 'v' : 'h') + (wreck ? '-wreck' : '') + '.svg';
  const T = (de) => esc(I18n.t(de));
  Object.assign(window.EN || {}, { 'Eigener Sektor': 'Own sector', 'Zielsektor · Gegner {0}': 'Target sector · opponent {0}', 'Sektor von {0}': 'Sector of {0}', 'Zielsektor': 'Target sector', 'Eigene Flotte': 'Own fleet',
    'Eigene Flotte · Rumpfintegrität': 'Own fleet · hull integrity', 'Gegnerflotte · erfasst': 'Enemy fleet · detected', 'Gefechtsprotokoll': 'Combat log', 'Position unbekannt': 'Position unknown', 'VERNICHTET': 'DESTROYED', 'Sektionen': 'sections',
    'Noch kein Schuss.': 'No shot yet.', 'Ansicht': 'View', 'Träger': 'Carrier', 'Schlachtkreuzer': 'Battlecruiser', 'Fregatte': 'Frigate', 'Korvette': 'Corvette', 'Jäger': 'Fighter', 'Taktik-Konsole': 'Tactical console',
    'Flotte ausrichten': 'Align your fleet', 'Gefechtsstand': 'Battle station' });
  const SINK_MS = 900;
  let sunkRound = null, sunkSeen = new Set(), sunkFresh = new Map(); // frisch versenkte Schiffe: Schlüssel → Startzeit der Sinkbewegung (läuft auch über ein Neuzeichnen hinweg weiter)
  const sunkKeys = (g) => new Set(Object.entries(g.seas).flatMap(([id, sea]) => (sea.sunk || []).map((x) => id + ':' + Math.min(...x.cells))));
  const vesselHTML = (cells, { owner, sunk, picked }) => {
    cells = [...cells].sort((a, b) => a - b);
    const n = cells.length; if (!n) return '';
    const first = cells[0], r0 = Math.floor(first / SIZE), c0 = first % SIZE, vertical = n > 1 && cells[1] - first === SIZE, fit = navalFit(n, first), space = skinNow === 'space';
    const wreck = cells.every((c) => sunk.has(c)), since = Date.now() - (sunkFresh.get(owner + ':' + first) ?? -Infinity), sinking = wreck && since < SINK_MS && !motionOff();
    // Absolut platziert (nimmt an der Zellenplatzierung nicht teil) – darum Start und Ende aller Linien angeben; „auto“ hieße bis zum Rand
    const pos = vertical ? 'grid-row:' + (r0 + 2) + ' / ' + (r0 + 2 + n) + ';grid-column:' + (c0 + 2) + ' / ' + (c0 + 3) : 'grid-row:' + (r0 + 2) + ' / ' + (r0 + 3) + ';grid-column:' + (c0 + 2) + ' / ' + (c0 + 2 + n);
    return '<span class="sv-vessel ' + (vertical ? 'v' : 'h') + (space ? ' space' : '') + (wreck ? ' wreck' : '') + (sinking ? ' sinking' : '') + (picked ? ' picked' : '') + '" style="' + pos + ';--n:' + n + ';--len:' + fit.len + ';--wid:' + fit.wid + (sinking ? ';--sink-delay:-' + Math.round(since) + 'ms' : '') + '" aria-hidden="true"><img src="' + (space ? spaceImg(n, vertical, wreck) : NAVAL_ART + 'stahl-' + fit.m + '-' + (vertical ? 'v' : 'h') + '.webp') + '" alt="" decoding="async" draggable="false"></span>';
  };
  // Taktik-Konsole: eigene Flotte mit Rumpfintegrität (eigene Schiffe und die Schüsse des Gegners darauf), Gegnerflotte nur „unbekannt“ oder „vernichtet“
  // (aus den versenkten Schiffen), Protokoll aus den öffentlichen Zügen. Nichts davon enthält Positionen nicht versenkter gegnerischer Schiffe.
  const secHTML = (n, hit) => Array.from({ length: n }, (_, i) => '<i' + (i < hit ? ' class="hit"' : '') + '></i>').join('');
  function ownFleetHTML(mine) {
    const hits = new Set(Object.keys(mine.shots || {}).filter((c) => mine.shots[c] === 'hit').map(Number)), ships = mine.ships || [], names = spaceNames(ships.map((x) => x.size));
    return '<section class="sv-panel sv-own-fleet"><h3>' + T('Eigene Flotte · Rumpfintegrität') + '</h3><ul>' + ships.map((x, k) => {
      const hit = x.cells.filter((c) => hits.has(c)).length, dead = hit === x.size;
      return '<li class="sv-fl' + (dead ? ' dead' : '') + '">' + fleetIconHTML(x.size, dead) + '<span class="sv-fl-t"><b>' + T(names[k]) + '</b><small>' + (x.size - hit) + '/' + x.size + ' ' + T('Sektionen') + '</small></span><span class="sv-sec" aria-hidden="true">' + secHTML(x.size, hit) + '</span></li>';
    }).join('') + '</ul></section>';
  }
  function foeFleetHTML(S, foe) {
    const g = S.g, sunk = (g.seas[foe].sunk || []).map((x) => x.size), names = spaceNames(g.fleet);
    return '<section class="sv-panel sv-foe-fleet"><h3>' + T('Gegnerflotte · erfasst') + '</h3><ul>' + g.fleet.map((size, k) => {
      const at = sunk.indexOf(size), dead = at >= 0; if (dead) sunk.splice(at, 1);
      return '<li class="sv-fl' + (dead ? ' dead' : '') + '">' + fleetIconHTML(size, dead) + '<span class="sv-fl-t"><b>' + T(names[k]) + '</b><small>' + (dead ? T('VERNICHTET') : T('Position unbekannt')) + '</small></span></li>';
    }).join('') + '</ul></section>';
  }
  function logHTML(S) {
    const rows = (S.moves || []).filter((m) => m.n).slice(-7).reverse();
    // Salve: die aufgelösten Schüsse beider Seiten (öffentlich, erst nach der gemeinsamen Auflösung)
    const salvo = S.g.lastSalvo ? Object.entries(S.g.lastSalvo.shots).map(([id, list]) => '<li class="salvo"><b>' + nameOf(S, id) + '</b> ' + list.map((x) => cellName(x.cell) + (x.hit ? ' ✕' : ' •')).join(' ') + '</li>').join('') : '';
    return '<section class="sv-panel sv-log"><h3>' + T('Gefechtsprotokoll') + '</h3>' + (rows.length ? '<ol>' + salvo + rows.map((m) => '<li class="' + (/versenkt/i.test(m.t) ? 'sunk' : /treffer/i.test(m.t) ? 'hit' : '') + '"><b>' + esc(m.n) + '</b> ' + esc(m.t) + '</li>').join('') + '</ol>' : '<p class="hint">' + T('Noch kein Schuss.') + '</p>') + '</section>';
  }
  const tabsHTML = () => '<div class="sv-tabs" role="group" aria-label="' + T('Ansicht') + '">' + [['target', 'Zielsektor'], ['own', 'Eigene Flotte']].map(([k, label]) => '<button type="button" class="sv-tab" data-g="svtab" data-tab="' + k + '" aria-pressed="' + (svTab === k) + '">' + T(label) + '</button>').join('') + '</div>';
  // Flottenliste beim Setzen: das Schiff als kleines Bild (waagerecht)
  const fleetIconHTML = (size, wreck = false) => { if (skinNow === 'space') return '<span class="sv-hull sv-hull-img sv-hull-space" style="--n:' + size + '" aria-hidden="true"><img src="' + spaceImg(size, false, wreck) + '" alt="" decoding="async" draggable="false"></span>'; const fit = navalFit(size, 0); return '<span class="sv-hull sv-hull-img" style="--len:' + fit.len + ';--wid:' + fit.wid + '" aria-hidden="true"><img src="' + NAVAL_ART + 'stahl-' + fit.m + '-h.webp" alt="" decoding="async" draggable="false"></span>'; };

  // Gleiche Prüfung wie auf dem Server (der entscheidet am Ende trotzdem selbst)
  function shipCells(cell, size, horizontal) {
    const r = Math.floor(cell / SIZE), c = cell % SIZE;
    if (horizontal ? c + size > SIZE : r + size > SIZE) return null;
    return Array.from({ length: size }, (_, k) => (horizontal ? cell + k : cell + k * SIZE));
  }
  const around = (cell) => {
    const r = Math.floor(cell / SIZE), c = cell % SIZE, out = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc;
      if ((dr || dc) && rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE) out.push(rr * SIZE + cc);
    }
    return out;
  };
  // Passt Schiff k an diese Stelle (gegen die anderen schon gesetzten)? → Zellen oder Fehlertext
  function fits(fleet, draft, k, cell, horizontal, touch) {
    const cells = shipCells(cell, fleet[k], horizontal);
    if (!cells) return 'Das Schiff ragt übers Meer hinaus';
    const others = new Set(), near = new Set();
    draft.forEach((d, j) => { if (d && j !== k) shipCells(d.cell, fleet[j], d.horizontal).forEach((c) => { others.add(c); around(c).forEach((n) => near.add(n)); }); });
    if (cells.some((c) => others.has(c))) return 'Da liegt schon ein Schiff';
    if (!touch && cells.some((c) => near.has(c))) return 'Schiffe dürfen sich nicht berühren – auch nicht über Eck';
    return cells;
  }
  function randomDraft(fleet, touch) {
    for (let tries = 0; tries < 500; tries++) {
      const draft = fleet.map(() => null);
      let ok = true;
      for (let k = 0; k < fleet.length && ok; k++) {
        ok = false;
        for (let n = 0; n < 200 && !ok; n++) {
          const cand = { cell: Math.floor(Math.random() * SIZE * SIZE), horizontal: Math.random() < 0.5 };
          if (Array.isArray(fits(fleet, draft, k, cand.cell, cand.horizontal, touch))) { draft[k] = cand; ok = true; }
        }
      }
      if (ok) return draft;
    }
    return fleet.map(() => null);
  }

  let draft = [];           // eigene Aufstellung beim Setzen: je Schiff { cell, horizontal } oder null
  let draftKey = '';
  let selShip = null;       // gewähltes Schiff beim Setzen
  let horizontal = true;    // Ausrichtung fürs nächste Setzen
  let aim = null;           // Handy: gewähltes Ziel, „Feuer“ schießt
  let volley = new Set(), volleyKey = '';
  const nameOf = (S, id) => esc(S.players.find((p) => p.id === id)?.name ?? '?');
  const meIn = (S) => S.you && S.g?.seas?.[S.you.id];
  const foeOf = (S, id) => Object.keys(S.g.seas).find((x) => x !== id);

  // Ein Meer zeichnen. opts: { ships: [[Zellen]], target (anklickbar zum Schießen), place (anklickbar zum Setzen), small, title }
  function board(sea, { ships = [], target = false, place = false, small = false, title = '', sel = null, label = '', owner = '' }) {
    const own = new Map(); ships.forEach((cells, k) => cells.forEach((c) => own.set(c, k)));
    const sunk = new Set((sea?.sunk || []).flatMap((s) => s.cells));
    const shots = sea?.shots || {};
    let html = '<span class="sv-corner"></span>' + [...COLS].map((c) => `<span class="sv-lab">${c}</span>`).join('');
    for (let r = 0; r < SIZE; r++) {
      html += `<span class="sv-lab">${r + 1}</span>`;
      for (let c = 0; c < SIZE; c++) {
        const i = r * SIZE + c;
        const shot = shots[i];
        const cls = ['sv-cell', own.has(i) ? 'ship' : '', sunk.has(i) ? 'sunk' : '', shot === 'hit' ? 'hit' : '', shot === 'miss' ? 'miss' : '', (sel instanceof Set ? sel.has(i) : sel === i) ? 'aim' : '',
          place && selShip !== null && own.get(i) === selShip ? 'picked' : ''].filter(Boolean).join(' ');
        const mark = shot === 'hit' ? '<i aria-hidden="true">✕</i>' : shot === 'miss' ? '<i aria-hidden="true">•</i>' : '';
        const state = sunk.has(i) ? 'versenkt' : shot === 'hit' ? 'Treffer' : shot === 'miss' ? 'Wasser' : own.has(i) ? 'Schiff' : 'frei';
        const clickable = (target && !shot) || place;
        html += clickable
          ? `<button type="button" class="${cls}" data-g="${target ? 'aim' : 'cell'}" data-i="${i}" ${place ? `data-drop="cell"` : ''} aria-label="${cellName(i)} ${state}">${mark}</button>`
          : `<span class="${cls}" role="img" aria-label="${cellName(i)} ${state}">${mark}</span>`;
      }
    }
    html += ships.map((cells, k) => vesselHTML(cells, { owner, sunk, picked: place && selShip === k })).join('');
    return `<div class="sv-sea ${small ? 'small' : ''}">${title ? `<h3>${title}${label ? ` <small>${label}</small>` : ''}</h3>` : ''}<div class="sv-board" role="grid" aria-label="${esc(title || 'Meer')}">${html}</div></div>`;
  }
  const draftCells = (fleet) => draft.map((d, k) => (d ? shipCells(d.cell, fleet[k], d.horizontal) : [])).map((x) => x || []);
  const shipList = (list) => (list || []).map((s) => s.cells);

  // ---- Lobby (VIS-013): eigener Start- und Lobbybildschirm je Design. Die Plätze zeigt die Plattform selbst (Tischring, auf dem Handy die Leiste),
  // deshalb steht hier keine zweite Spielerliste: Briefing, Variante, Regeln dieses Tisches, Ablauf und Status. Alles aus dem Raumzustand; keine Bereitschaft vor dem Start. ----
  const LOBBY_FLEET = [[5, 1, 1, true], [4, 6, 3, false], [3, 0, 5, true], [3, 4, 7, true], [2, 8, 7, false]]; // nur Schmuck: Länge, Spalte, Zeile, waagerecht – keine Spielstellung
  function lobbyChart(space) {
    const ships = LOBBY_FLEET.map(([n, c, r, h]) => {
      const first = r * SIZE + c, cx = (c + (h ? n : 1) / 2) * 10, cy = (r + (h ? 1 : n) / 2) * 10;
      let src, w;
      if (space) { src = spaceImg(n, !h, false); w = h ? n * 10 : 13; } else { const fit = navalFit(n, first); src = NAVAL_ART + 'stahl-' + fit.m + '-' + (h ? 'h' : 'v') + '.webp'; w = (h ? fit.len : fit.wid) * 12.2; }
      return '<img class="sv-lb-ship" src="' + src + '" alt="" decoding="async" draggable="false" style="left:' + cx + '%;top:' + cy + '%;width:' + w + '%">';
    }).join('');
    const cols = [...COLS].map((c, i) => '<span style="left:' + (i * 10 + 5) + '%">' + c + '</span>').join(''), rows = Array.from({ length: SIZE }, (_, i) => '<span style="top:' + (i * 10 + 5) + '%">' + (i + 1) + '</span>').join('');
    const compass = space ? '' : '<svg class="sv-lb-compass" viewBox="-50 -50 100 100"><circle r="44" fill="none" stroke="currentColor" stroke-width="2"/><circle r="36" fill="none" stroke="currentColor" stroke-width=".8" stroke-dasharray="2 3"/><path d="M0-46L9-9L46 0L9 9L0 46L-9 9L-46 0L-9-9Z" fill="currentColor" opacity=".85"/><path d="M0-46L9-9L0 0Z" fill="#b3342b"/><text y="-52" font-size="12" font-weight="700" text-anchor="middle" fill="currentColor">N</text></svg>';
    return '<div class="sv-lb-wrap" aria-hidden="true"><div class="sv-lb-cols">' + cols + '</div><div class="sv-lb-rows">' + rows + '</div><div class="sv-lb-chart">' + ships + compass + '</div></div>';
  }
  function lobbyHTML(S) {
    applySkin(S);
    const t = WorldKit.t, space = skinNow === 'space', salvo = S.variant === 'salvo', cfg = S.settings || {};
    const need = S.minPlayers || 2, max = S.maxPlayers || 2, seated = S.players.filter((p) => p.seated).length, watchers = S.players.length - seated;
    const meSeated = !!S.players.find((p) => p.id === S.you?.id)?.seated, full = seated >= need, host = !!S.you?.isHost;
    const fleetN = cfg.classic ? FLEETS_N.classic : FLEETS_N.standard, tt = Number(cfg.turnTime) || 0;
    const missing = need - seated;
    const status = !full ? t('Es fehlt noch ' + missing + ' Mitspieler. Wer mitspielen will, tippt unten auf „Mitspielen“.', missing + ' more player needed. To join, tap “Play” below.')
      : host ? t('Beide Plätze sind besetzt – du kannst die Runde unten starten.', 'Both seats are taken – you can start the round below.') : t('Beide Plätze sind besetzt – der Host startet die Runde.', 'Both seats are taken – the host starts the round.');
    const pips = Array.from({ length: max }, (_, i) => '<i class="' + (i < seated ? 'on' : '') + '"></i>').join('');
    const facts = [
      [t('Design', 'Design'), space ? t('Taktik-Konsole', 'Tactical console') : t('Klassisch', 'Classic')],
      [t('Variante', 'Variant'), salvo ? t('Salvo', 'Salvo') : t('Klassisch', 'Classic')],
      [t('Flotte', 'Fleet'), fleetN + ' ' + t('Schiffe', 'ships') + (cfg.classic ? ' · ' + t('Hausregel „Klassisch“', 'house rule “Classic”') : '')],
      [t('Zeit pro Schuss', 'Time per shot'), tt ? tt + ' s' : t('ohne Limit', 'no limit')],
      [t('Schiffe', 'Ships'), cfg.touch ? t('dürfen sich berühren', 'may touch') : t('berühren sich nicht', 'must not touch')],
      ...(!salvo ? [[t('Nach einem Treffer', 'After a hit'), cfg.again ? t('nochmal schießen', 'fire again') : t('Wechsel', 'turn passes')]] : []),
    ].map(([k, v]) => '<div><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>').join('');
    const steps = [
      [t('Flotte setzen', 'Deploy'), space ? t('Ordnet eure Raumschiffe im Sektor an – beide gleichzeitig, ohne Einblick.', 'Arrange your ships in the sector – both at once, unseen.') : t('Verteilt eure Schiffe auf der Seekarte – beide gleichzeitig, ohne Einblick.', 'Place your ships on the chart – both at once, unseen.')],
      salvo ? [t('Salve festlegen', 'Plan a salvo'), t('Ihr wählt gleichzeitig so viele Ziele, wie ihr noch Schiffe habt; beide Salven werden gemeinsam aufgelöst.', 'You both pick as many targets as you have ships left; both salvos resolve together.')]
        : [t('Feuern', 'Fire'), t('Abwechselnd ein Feld wählen: Wasser, Treffer oder versenkt.', 'Take turns picking a square: miss, hit or sunk.')],
      [t('Gewinnen', 'Win'), space ? t('Wer zuerst die ganze gegnerische Flotte vernichtet, gewinnt.', 'The first to destroy the whole enemy fleet wins.') : t('Wer zuerst die ganze gegnerische Flotte versenkt, gewinnt.', 'The first to sink the whole enemy fleet wins.')],
    ].map(([h, p], i) => '<li><b>' + (i + 1) + '</b><span><strong>' + esc(h) + '</strong>' + esc(p) + '</span></li>').join('');
    return '<section class="sv-lobby" data-skin="' + skinNow + '">' +
      '<div class="sv-lb-art">' + lobbyChart(space) + '</div>' +
      '<div class="sv-lb-brief"><span class="sv-lb-eyebrow">' + (space ? t('TAKTIK-KONSOLE · GEFECHTSSTAND', 'TACTICAL CONSOLE · BATTLE STATION') : t('FLOTTENKOMMANDO · SEEKARTE', 'FLEET COMMAND · SEA CHART')) + '</span>' +
      '<h2>' + (space ? t('Zwei Flotten.<br>Ein Sektor.', 'Two fleets.<br>One sector.') : t('Zwei Flotten.<br>Ein Meer.', 'Two fleets.<br>One sea.')) + '</h2>' +
      '<p class="sv-lb-lead">' + (space ? t('Positioniert eure Schiffe im Sektor und feuert abwechselnd auf Koordinaten. Das Briefing steht, die Konsole ist bereit.', 'Position your ships in the sector and fire at coordinates in turn. Briefing done, console ready.') : t('Versteckt eure Schiffe auf der Seekarte und feuert abwechselnd auf Koordinaten. Wer die Flotte des anderen findet, gewinnt die Seeschlacht.', 'Hide your ships on the chart and fire at coordinates in turn. Find the other fleet to win the battle.')) + '</p>' +
      '<dl class="sv-lb-facts">' + facts + '</dl><ol class="sv-lb-steps">' + steps + '</ol>' +
      '<div class="sv-lb-status" role="status"><span class="sv-lb-pips" aria-hidden="true">' + pips + '</span><span><b>' + seated + ' / ' + max + ' ' + esc(t('Plätze besetzt', 'seats taken')) + '</b>' + esc(status) + (!meSeated ? ' ' + esc(t('Du schaust zu.', 'You are watching.')) : '') + (watchers ? ' · ' + watchers + ' ' + esc(t('Zuschauer', 'watching')) : '') + '</span></div></div></section>';
  }

  const kit = kitGame({
    id: 'schiffe',
    name: 'Schiffe versenken',
    direction: false,
    // Erste Schritte beim ersten Spiel (3 Schritte, abschaltbar unter „Ich“)
    intro: [
      ['Flotte setzen', 'Wähle unten ein Schiff und tipp aufs Meer – oder „Zufällig verteilen“. „Drehen“ stellt es quer oder längs. Dann „Fertig“.'],
      ['Schießen', 'Abwechselnd ein Feld im gegnerischen Meer antippen: • Wasser, ✕ Treffer. Versenkte Schiffe werden ganz gezeigt.'],
      ['Gewinnen', 'Wer zuerst alle Schiffe des anderen versenkt, gewinnt. Oben läuft die Zeit pro Schuss mit.'],
    ],
    short: [
      'Zwei Meere 10 × 10: deins und das des Gegners. Erst setzen beide ihre Flotte, dann wird abwechselnd geschossen.',
      'Schiffe dürfen sich nicht überlappen und nicht berühren – auch nicht über Eck.',
      'Ein Feld antippen = Schuss: • Wasser, ✕ Treffer. Danach ist der andere dran.',
      'Ist ein Schiff ganz getroffen, wird es als versenkt gezeigt.',
      'Wer zuerst alle gegnerischen Schiffe versenkt, gewinnt. Läuft die Zeit ab, wird zufällig geschossen.',
    ],
    house: () => [],
    status: (S) => { applySkin(S); return S.g?.step === 'place' ? I18n.html`Runde #${S.roundNo} · Schiffe setzen` : null; },
    playerInfo: (p, S) => (S.g?.step === 'place' ? (p.ready ? '✓ bereit' : 'setzt Schiffe') : p.afloat !== null && p.afloat !== undefined ? I18n.html`${p.afloat} Schiff${p.afloat === 1 ? '' : 'e'} übrig` : ''),
    onState(S) {
      applySkin(S); // auch in der Lobby: das Design gehört zum Tisch
      const g = S.g;
      if (!g) return;
      const now = sunkKeys(g);
      const t = Date.now();
      if (sunkRound !== S.roundNo) { sunkRound = S.roundNo; sunkFresh = new Map(); } // neue Runde oder erster Stand (Laden, Wiederverbinden): ohne Bewegung
      else { sunkFresh = new Map([...sunkFresh].filter(([, t0]) => t - t0 < SINK_MS)); for (const k of now) if (!sunkSeen.has(k)) sunkFresh.set(k, t); }
      sunkSeen = now;
      const vk = `${S.variant}:${S.roundNo}:${g.salvoRound}`;
      if (vk !== volleyKey) { volleyKey = vk; volley.clear(); }
      const key = `${S.roundNo}:${g.fleet.join(',')}`;
      if (key !== draftKey) { draftKey = key; draft = g.fleet.map(() => null); selShip = 0; horizontal = true; }
      // Ziel vergessen, wenn ich nicht mehr dran bin oder das Feld inzwischen beschossen ist
      if (S.turnId !== S.you?.id || g.step !== 'shoot' || (aim !== null && g.seas[foeOf(S, S.you.id)]?.shots[aim])) aim = null;
    },
    hint(S, myTurn) {
      const g = S.g;
      const mine = meIn(S);
      if (g.step === 'place') {
        if (!mine) return 'Die beiden setzen gerade ihre Schiffe';
        if (mine.ready) return I18n.html`Fertig – warte, bis ${nameOf(S, foeOf(S, S.you.id))} seine Flotte gesetzt hat`;
        if (draft.every(Boolean)) return 'Alles gesetzt – tipp „Fertig“ (oder verschieb noch Schiffe)';
        if (selShip !== null) return I18n.html`Tipp aufs Meer: dort beginnt der ${SHIP[g.fleet[selShip]]} (${g.fleet[selShip]} Felder, ${horizontal ? 'nach rechts' : 'nach unten'})`;
        return 'Wähle unten ein Schiff, dann tipp aufs Meer – oder „Zufällig verteilen“';
      }
      if (!mine) return I18n.html`${nameOf(S, S.turnId)} schießt`;
      if (S.variant === 'salvo') return g.salvoReady?.[S.you.id] ? 'Salve abgegeben – warte auf die andere Flotte' : I18n.html`Wähle ${g.salvoQuota} verschiedene Ziele. Beide Salven werden gemeinsam aufgelöst.`;
      if (!myTurn) return I18n.html`${nameOf(S, S.turnId)} schießt auf dein Meer`;
      if (aim !== null) return I18n.html`Ziel <b>${cellName(aim)}</b> – „Feuer“ oder ein anderes Feld wählen`;
      return 'Tipp ein Feld im gegnerischen Meer an';
    },
    lobby(S) { return lobbyHTML(S); },
    main(S) {
      const W = WorldKit, t = W.t, g1 = S.g, over1 = S.phase === 'over', mine1 = meIn(S);
      const chips = [g1.step === 'place' && !over1 ? W.chip('⚓', mine1?.ready ? t('Flotte steht – warte auf den Gegner', 'Fleet ready – waiting for the opponent') : t('Phase: Schiffe setzen', 'Phase: placing ships'), mine1?.ready ? 'good' : 'warn') : over1 ? W.chip('🏁', t('Partie vorbei – beide Meere aufgedeckt', 'Game over – both seas revealed')) : W.chip('🎯', S.turnId === S.you?.id ? t('Du schießt', 'You are firing') : t('Der Gegner schießt', 'The opponent is firing'), S.turnId === S.you?.id ? 'good' : ''), S.variant === 'salvo' ? W.chip('✦', t('Salve-Variante', 'Salvo variant')) : ''].filter(Boolean);
      applySkin(S);
      return `<div class="wk-stage sv-stage" data-skin="${skinOf(S)}">${W.head({ eyebrow: skinOf(S) === 'space' ? t('Taktik-Konsole', 'Tactical console') : t('Seekarte', 'Sea chart'), title: g1.step === 'place' && !over1 ? (skinOf(S) === 'space' ? t('Flotte ausrichten', 'Align your fleet') : t('Flotte aufstellen', 'Deploy your fleet')) : (skinOf(S) === 'space' ? t('Gefechtsstand', 'Battle station') : t('Seeschlacht', 'Sea battle')), chips })}${this.mainBody(S)}</div>`;
    },
    mainBody(S) {
      const g = S.g;
      const me = S.you?.id;
      const mine = meIn(S);
      const ids = Object.keys(g.seas);
      const over = S.phase === 'over';
      // Setzen: nur das eigene Meer, groß
      if (g.step === 'place' && !over) {
        if (!mine) return I18n.html`<div class="kg-table sv-wrap"><p class="hint">Die beiden setzen gerade ihre Schiffe – gleich geht es los.</p></div>`;
        const ships = mine.ready ? shipList(mine.ships) : draftCells(g.fleet);
        return `<div class="kg-table sv-wrap">${board(mine, { ships, place: !mine.ready, title: skinNow === 'space' ? T('Eigener Sektor') : 'Dein Meer', label: mine.ready ? '✓ bereit' : '', owner: me })}</div>`;
      }
      // Zuschauer oder Spielende: beide Meere (nach Spielende mit allen Schiffen)
      if (!mine || over) {
        return `<div class="kg-table sv-wrap"><div class="sv-two">${ids.map((id) => board(g.seas[id], { ships: shipList(g.seas[id].ships || g.seas[id].sunk), small: true, title: skinNow === 'space' ? I18n.html`Sektor von ${nameOf(S, id)}` : I18n.html`Meer von ${nameOf(S, id)}`, label: over ? 'aufgedeckt' : '', owner: id })).join('')}</div></div>`;
      }
      const foe = foeOf(S, me);
      const salvo = S.variant === 'salvo';
      const myTurn = salvo ? !g.salvoReady?.[me] : S.turnId === me;
      const space = skinNow === 'space';
      const targetBoard = board(g.seas[foe], { ships: shipList(g.seas[foe].sunk), target: myTurn, sel: salvo ? volley : aim, title: space ? I18n.html`Zielsektor · Gegner ${nameOf(S, foe)}` : I18n.html`Meer von ${nameOf(S, foe)}`, label: myTurn ? 'du schießt' : '', owner: foe });
      const ownBoard = board(mine, { ships: shipList(mine.ships), small: true, title: space ? T('Eigener Sektor') : 'Dein Meer', owner: me });
      // Taktik-Konsole: eigener Sektor und Flotte links, Zielsektor in der Mitte, Gegnerflotte und Protokoll rechts; auf dem Handy zwei Reiter
      if (space) return `<div class="kg-table sv-wrap sv-console" data-tab="${svTab}">${tabsHTML()}<div class="sv-two sv-three"><div class="sv-col sv-col-own">${ownBoard}${ownFleetHTML(mine)}</div><div class="sv-col sv-col-target">${targetBoard}</div><div class="sv-col sv-col-info">${foeFleetHTML(S, foe)}${logHTML(S)}</div></div></div>`;
      return `<div class="kg-table sv-wrap"><div class="sv-two">${targetBoard}${ownBoard}</div></div>`;
    },
    dock(S, myTurn) {
      const g = S.g;
      const mine = meIn(S);
      if (!mine) return '';
      if (g.step === 'place') {
        if (mine.ready) return I18n.html('<button class="btn" data-g="unplace">Doch nochmal umstellen</button>');
        const ships = g.fleet.map((size, k) => `<button type="button" class="sv-ship ${selShip === k ? 'sel' : ''} ${draft[k] ? 'set' : ''}" data-g="ship" data-k="${k}" data-drag="ship${k}" aria-pressed="${selShip === k}">
            ${fleetIconHTML(size)}<span>${skinNow === 'space' ? T(spaceNames(g.fleet)[k]) : SHIP[size]}${draft[k] ? ' ✓' : ''}</span></button>`).join('');
        const done = draft.every(Boolean);
        return I18n.html`<div class="sv-ships" role="group" aria-label="Deine Flotte">${ships}</div>
          <div class="kg-acts"><button class="btn" data-g="turn">Drehen (${horizontal ? 'quer' : 'längs'})</button>
            <button class="btn" data-g="random">Zufällig verteilen</button>
            <button class="btn btn-ghost" data-g="clear">Alles neu</button>
            <button class="btn ${done ? 'btn-brass' : ''}" data-g="ready" ${done ? '' : 'disabled title="Erst alle Schiffe setzen"'}>Fertig</button></div>`;
      }
      if (S.variant === 'salvo') return g.salvoReady?.[S.you.id] ? I18n.html('<p class="hint">Salve festgelegt</p>') : I18n.html`<button class="btn btn-brass" data-g="salvo" ${volley.size === g.salvoQuota ? '' : 'disabled'}>Salve abgeben (${volley.size}/${g.salvoQuota})</button>`;
      if (myTurn && aim !== null) return I18n.html`<button class="btn btn-brass sv-fire" data-g="fire">Feuer auf ${cellName(aim)}</button><button class="btn btn-ghost" data-g="noaim">Anderes Feld</button>`;
      return '';
    },
    // Ziehen (Maus): Schiff aus der Liste aufs Meer
    onDrop(src, z, S) {
      if (!src.dataset.k || z.dataset.drop !== 'cell') return;
      selShip = Number(src.dataset.k);
      putShip(S, Number(z.dataset.i));
    },
    onClick(t, S) {
      const g = t.dataset.g;
      const fleet = S.g.fleet;
      if (g === 'svtab') { svTab = t.dataset.tab === 'own' ? 'own' : 'target'; kit.render(); return; }
      if (g === 'ship') { const k = Number(t.dataset.k); selShip = selShip === k ? null : k; if (selShip !== null && draft[selShip]) horizontal = draft[selShip].horizontal; kit.render(); }
      else if (g === 'cell') {
        const i = Number(t.dataset.i);
        // Tipp auf ein gesetztes Schiff ohne Auswahl: dieses Schiff wählen (zum Verschieben)
        const hitShip = draftCells(fleet).findIndex((cells) => cells.includes(i));
        if (selShip === null || (hitShip >= 0 && hitShip !== selShip && draft[selShip])) { selShip = hitShip >= 0 ? hitShip : null; if (selShip !== null) horizontal = draft[selShip].horizontal; kit.render(); return; }
        putShip(S, i);
      } else if (g === 'turn') {
        horizontal = !horizontal;
        if (selShip !== null && draft[selShip]) {
          const res = fits(fleet, draft, selShip, draft[selShip].cell, horizontal, S.settings.touch);
          if (Array.isArray(res)) draft[selShip] = { cell: draft[selShip].cell, horizontal }; else { toast(res, true); horizontal = !horizontal; }
        }
        kit.render();
      } else if (g === 'random') { draft = randomDraft(fleet, S.settings.touch); selShip = null; kit.render(); }
      else if (g === 'clear') { draft = fleet.map(() => null); selShip = 0; kit.render(); }
      else if (g === 'ready') send('place', { ships: draft });
      else if (g === 'unplace') send('unplace');
      else if (g === 'salvo') send('salvo', { cells: [...volley] });
      else if (g === 'aim') {
        const i = Number(t.dataset.i);
        if (S.variant === 'salvo') { if (volley.has(i)) volley.delete(i); else if (volley.size < S.g.salvoQuota) volley.add(i); kit.render(); return; }
        if (FINE.matches || aim === i) { aim = null; send('shoot', { cell: i }); } // Maus: sofort; Handy: zweimal tippen oder „Feuer“
        else { aim = i; kit.render(); }
      } else if (g === 'fire' && aim !== null) { const i = aim; aim = null; send('shoot', { cell: i }); }
      else if (g === 'noaim') { aim = null; kit.render(); }
    },
    rules: I18n.html`<p>Zwei Meere mit 10 × 10 Feldern (Spalten A–J, Zeilen 1–10): deins und das deines Gegners.</p>
      <ul>
        <li><b>Flotte</b> (Standard): 1 Flugzeugträger (5), 1 Schlachtschiff (4), 2 Kreuzer (3), 1 Zerstörer (2). Hausregel „Klassisch“: 1× 5, 2× 4, 3× 3, 4× 2.</li>
        <li><b>Setzen:</b> beide gleichzeitig. Schiffe liegen quer oder längs, dürfen sich nicht überlappen und nicht berühren – auch nicht über Eck (Hausregel: Berühren erlaubt).</li>
        <li><b>Schießen:</b> abwechselnd ein Feld im gegnerischen Meer. • Wasser oder ✕ Treffer – danach ist der andere dran (Hausregel: nach einem Treffer nochmal).</li>
        <li>Sind alle Felder eines Schiffs getroffen, ist es <b>versenkt</b> und wird ganz gezeigt.</li>
        <li>Wer zuerst alle gegnerischen Schiffe versenkt, gewinnt. Die Zeit pro Schuss steht oben; läuft sie ab, wird zufällig geschossen.</li>
        <li>Zuschauer sehen während des Spiels nur Treffer und Wasser – beide Flotten werden erst nach dem Spiel aufgedeckt.</li>
      </ul>`,
  });

  // Gewähltes Schiff an Zelle i setzen (Bug), danach das nächste noch freie Schiff wählen
  function putShip(S, i) {
    const fleet = S.g.fleet;
    const res = fits(fleet, draft, selShip, i, horizontal, S.settings.touch);
    if (!Array.isArray(res)) { toast(res, true); return; }
    draft[selShip] = { cell: i, horizontal };
    const next = draft.findIndex((d) => !d);
    selShip = next >= 0 ? next : null;
    kit.render();
  }
}
