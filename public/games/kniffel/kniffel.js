// Kniffel im Browser (Regeln: games/kniffel/room.js). Würfel antippen = liegen lassen, Feld in der eigenen Spalte antippen = eintragen.
'use strict';
{
  const UPPER = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
  const LOWER = ['threeKind', 'fourKind', 'fullHouse', 'smallStraight', 'largeStraight', 'kniffel', 'chance'];
  const NAME = {
    ones: 'Einser', twos: 'Zweier', threes: 'Dreier', fours: 'Vierer', fives: 'Fünfer', sixes: 'Sechser',
    threeKind: 'Dreierpasch', fourKind: 'Viererpasch', fullHouse: 'Full House', smallStraight: 'Kleine Straße', largeStraight: 'Große Straße', kniffel: 'Kniffel', chance: 'Chance',
  };
  const HINT = {
    ones: 'nur Einser zählen', twos: 'nur Zweier', threes: 'nur Dreier', fours: 'nur Vierer', fives: 'nur Fünfer', sixes: 'nur Sechser',
    threeKind: '3 gleiche: alle Augen', fourKind: '4 gleiche: alle Augen', fullHouse: '3 + 2 gleiche: 25', smallStraight: '4 in Folge: 30',
    largeStraight: '5 in Folge: 40', kniffel: '5 gleiche: 50', chance: 'alle Augen',
  };
  const EN_NAME = {ones:'Ones',twos:'Twos',threes:'Threes',fours:'Fours',fives:'Fives',sixes:'Sixes',threeKind:'Three of a kind',fourKind:'Four of a kind',fullHouse:'Full house',smallStraight:'Small straight',largeStraight:'Large straight',kniffel:'Five of a kind',chance:'Chance'};
  const EN_HINT = {ones:'count only ones',twos:'only twos',threes:'only threes',fours:'only fours',fives:'only fives',sixes:'only sixes',threeKind:'3 alike: all dice',fourKind:'4 alike: all dice',fullHouse:'3 + 2 alike: 25',smallStraight:'4 in sequence: 30',largeStraight:'5 in sequence: 40',kniffel:'5 alike: 50',chance:'all dice'};
  const label = f => I18n.language === 'en' ? EN_NAME[f] : NAME[f];
  const hint = f => I18n.language === 'en' ? EN_HINT[f] : HINT[f];
  let keep = new Set();
  let column = 0;
  let keepKey = '';
  let quickScores = false;
  const nameOf = (S, id) => esc(S.players.find((p) => p.id === id)?.name ?? '?');

  let dice3D, dice3DImport, rollPending;
  let dice3DState = 'idle';
  const uses3D = () => store.get('poker:three-d:kniffel',false);
  const trayActive = () => session?.game === 'kniffel' && !parked && !$('#game-root').hidden && uses3D() && !motionOff();
  const tx3 = (de,en) => I18n.content(de,en);
  const ttWeighted = () => tx3('Gewichtete Summe','Weighted total');
  function trayStatus(value) {
    dice3DState = value;
    const slot = $('#kniffel-3d-stage');
    const button = $('#kniffel-view3d');
    if (!slot || !button) return;
    const ready = value === 'ready';
    slot.closest('.kn-tray').classList.toggle('kn-tray-live',ready);
    $('#kniffel-3d-angles').hidden = !ready;
    button.textContent = ready || value === 'loading' ? '2D' : '3D';
    button.setAttribute('aria-pressed',String(ready));
    button.setAttribute('aria-label',ready || value==='loading' ? tx3('Zur 2D-Ansicht','Switch to 2D') : tx3('3D-Ansicht öffnen','Open 3D view'));
    $('#kniffel-3d-status').textContent = value === 'loading' ? tx3('3D-Ansicht lädt','Loading 3D view') :
      value === 'unavailable' ? tx3('3D ist hier gerade nicht verfügbar. Die 2D-Würfel bleiben bedienbar.','3D is unavailable. The 2D dice remain playable.') :
      value === 'reduced' ? tx3('3D ist bei reduzierter Bewegung aus.','3D is off while motion is reduced.') : '';
  }
  function syncDice3D(S) {
    const slot = $('#kniffel-3d-stage');
    if (!slot || !S.g || !trayActive()) {
      dice3D?.dispose();
      trayStatus(uses3D() && motionOff() ? 'reduced' : 'idle');
      return;
    }
    if (dice3DState === 'unavailable') { trayStatus('unavailable'); return; }
    if (!dice3D) {
      trayStatus('loading');
      if (!dice3DImport) {
        dice3DImport = import('/games/kniffel/tray-3d.js').then(({kniffelView})=>{
          dice3D=kniffelView({
            active:trayActive,onStatus:trayStatus,
            onPick(value) { document.querySelector('.kn-tray button[data-g="keep"][data-i="' + (value-1) + '"]')?.click(); },
          });
          if(trayActive())kit.render();
        }).catch(()=>{if(trayActive())trayStatus('unavailable');}).finally(()=>{dice3DImport=null;});
      }
      return;
    }
    const g = S.g;
    const canKeep = S.turnId === S.you?.id && g.rolls > 0 && g.rolls < 3;
    dice3D.sync(slot,{
      room:S.code, round:S.roundNo, turn:S.turnId, rolls:g.rolls,
      values:g.dice.slice(0,5),
      held:g.held.map((held,i)=>canKeep ? keep.has(i) : held),
      paused:!!S.gamePaused || S.phase !== 'playing',
    });
    trayStatus(dice3D.state);
  }
  function trayExtras() {
    return '<button class="btn btn-sm kn-mode" type="button" id="kniffel-view3d" data-g="view3d" aria-pressed="false">3D</button>' +
      '<div class="td-surface" id="kniffel-3d-stage"></div>' +
      '<div class="td-controls kn-3d-angles" id="kniffel-3d-angles" hidden>' +
      '<button type="button" class="btn btn-sm" data-g="home3d">'+tx3('Ausgangsposition','Reset view')+'</button>' +
      '<button type="button" class="btn btn-sm" data-g="near3d">'+tx3('Nahansicht','Close-up')+'</button>' +
      '<span class="kn-hold-note">'+tx3('Halteablage hinter der Messingleiste','Held dice behind the brass rail')+'</span></div>' +
      '<small class="td-status" id="kniffel-3d-status" role="status"></small>';
  }
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',()=>{
    if(session?.game==='kniffel'&&!parked)kit.render();
  });

  function rollAction(g, myTurn) {
    if (!myTurn || g.rolls >= 3) return '';
    if (rollPending) return '<button type="button" class="btn kn-roll" data-g="roll" aria-disabled="true">'+tx3('Wurf läuft','Rolling')+'</button>';
    const all = g.rolls && keep.size === 5;
    return `<button type="button" class="btn btn-brass kn-roll" data-g="roll" ${all ? 'disabled title="Alle Würfel liegen – trag ein Feld ein"' : ''}>${g.rolls ? I18n.html`Nochmal würfeln (${g.rolls + 1}. von 3)` : I18n.t('Würfeln')}</button>`;
  }

  function rerenderAt(selector) {
    const old = document.querySelector('.kn-sheet-wrap');
    const scroll = old ? [old.scrollLeft, old.scrollTop] : null;
    kit.render();
    if (scroll) document.querySelector('.kn-sheet-wrap')?.scrollTo(...scroll);
    document.querySelector(`.kn-stage ${selector}`)?.focus({ preventScroll: true });
  }

  const kit = kitGame({
    id: 'kniffel',
    ring: false,
    dock: () => '',
    look(S) {
      const g = S.g;
      if (g.columnSheets) {
        const columns = Object.keys(g.columnSheets).flatMap((id) => [0, 1, 2].map((column) => ({ id, column })));
        const row = (f) => `<tr><th>${label(f)}</th>${columns.map(({ id, column }) => `<td class="num">${g.columnSheets[id][column][f] ?? '–'}</td>`).join('')}</tr>`;
        return [{ title: 'Alle drei Spalten', html: I18n.html`<div class="look-table"><table class="look-big"><thead><tr><th></th>${columns.map(({ id, column }) => `<th>${nameOf(S, id)} ×${column + 1}</th>`).join('')}</tr></thead><tbody>${[...UPPER, ...LOWER].map(row).join('')}<tr><th>Gewichtete Summe</th>${columns.map(({ id, column }) => `<td class="num">${g.columnTotals[id][column].total * (column + 1)}</td>`).join('')}</tr></tbody></table></div>` }];
      }
      const ids = Object.keys(g.sheets);
      const cell = (id, f) => { const v = g.sheets[id][f]; return `<td class="num">${v === null ? '' : v === 0 ? '–' : v}</td>`; };
      const row = (f) => `<tr><th scope="row">${label(f)}</th>${ids.map((id) => cell(id, f)).join('')}</tr>`;
      const head = ids.map((id) => `<th class="num" scope="col">${nameOf(S, id)}</th>`).join('');
      const sum = (label, fn) => `<tr class="kn-sum"><th scope="row">${label}</th>${ids.map((id) => `<td class="num"><b>${fn(g.totals[id])}</b></td>`).join('')}</tr>`;
      return [{ title: 'Punkteblätter aller', html: `<div class="look-table"><table class="look-big"><thead><tr><th></th>${head}</tr></thead><tbody>${UPPER.map(row).join('')}${sum(I18n.language === 'en' ? 'Upper total' : 'Summe oben', (t) => t.upper)}${LOWER.map(row).join('')}${sum(I18n.t('Gesamt'), (t) => t.total)}</tbody></table></div>` }];
    },
    name: 'Kniffel',
    direction: false,
    afterRender: syncDice3D,
    lobbyExtra(S) {
      const triple = S.variant === 'triple';
      const variant = triple ? tx3('Dreifachblatt','Triple sheet') : tx3('Klassisches Punkteblatt','Classic score sheet');
      const rounds = triple ? tx3('39 Einträge mit Spaltenfaktoren ×1, ×2 und ×3','39 entries with column weights ×1, ×2 and ×3')
        : tx3('13 Einträge auf einem Blatt','13 entries on one sheet');
      return '<div class="kn-lobby-card"><strong>'+variant+'</strong><p>'+rounds+'</p><div class="kn-rule-tags">'+
        '<span>'+tx3('Extra-Kniffel','Extra five of a kind')+' · '+(S.settings.extraBonus ? tx3('an','on') : tx3('aus','off'))+'</span>'+
        '<span>'+tx3('Joker','Joker')+' · '+(S.settings.joker ? tx3('an','on') : tx3('aus','off'))+'</span></div></div>';
    },

    // Erste Schritte beim ersten Spiel (3 Schritte, abschaltbar unter „Ich“)
    intro: [
      ['Würfeln', 'Bis zu drei Würfe pro Zug. Tipp Würfel an, die liegen bleiben sollen – die anderen werden neu geworfen.'],
      ['Eintragen', 'Nach dem Zug trägst du genau ein Feld in deiner Spalte ein. Grau stehen die Punkte, die dein Wurf dort bringt – 0 heißt streichen.'],
      ['Gewinnen', 'Nach 13 Runden ist jedes Feld voll. Oben gibt es ab 63 Punkten 35 Bonus. Die höchste Summe gewinnt.'],
    ],
    short: [
      'Fünf Würfel, bis zu drei Würfe pro Zug – Würfel antippen = liegen lassen.',
      'Nach dem Zug genau ein freies Feld eintragen (auch 0 = streichen).',
      'Oben: Einser bis Sechser zählen ihre Augen. Ab 63 Punkten oben gibt es 35 Bonus.',
      'Unten: Dreier- und Viererpasch (alle Augen), Full House 25, Kleine Straße 30, Große Straße 40, Kniffel 50, Chance (alle Augen).',
      'Nach 13 Runden gewinnt die höchste Summe.',
    ],
    house: () => [],
    playerInfo: (p, S) => { const n = S.variant === 'triple' ? 39 : 13; if (I18n.language === 'en' && p.total !== null && p.total !== undefined) return `${p.total} points · Round ${Math.min(n, (p.filled || 0) + 1)}/${n}`; return p.total === null || p.total === undefined ? '' : I18n.html`${p.total} Punkte · Runde ${Math.min(n, (p.filled || 0) + 1)}/${n}`; },
    onState(S) {
      const g = S.g;
      const key = g && S.turnId ? `${S.code}:${S.roundNo}:${S.turnId}:${g.rolls}` : '';
      if (rollPending && (key !== rollPending.key || socket.id !== rollPending.connection || S.phase !== 'playing')) rollPending = undefined;
      if (key !== keepKey) { keepKey = key; keep = new Set((g?.held || []).map((h, i) => (h ? i : -1)).filter((i) => i >= 0)); }
    },
    hint(S, myTurn) {
      const g = S.g;
      if (!myTurn) return I18n.html`${nameOf(S, S.turnId)} würfelt`;
      if (!g.rolls) return I18n.t('Würfle');
      if (g.rolls < 3) return I18n.t('Würfel antippen = liegen lassen. Nochmal würfeln – oder ein Feld in deiner Spalte antippen (grau = Punkte)');
      return I18n.t('Trag ein Feld ein – grau stehen die Punkte, 0 heißt streichen');
    },
    main(S) {
      const raw = S.g, triple = S.variant === 'triple';
      const g = triple ? { ...raw, sheets: Object.fromEntries(Object.entries(raw.columnSheets).map(([id, columns]) => [id, columns[column]])), totals: Object.fromEntries(Object.entries(raw.columnTotals).map(([id, values]) => [id, values[column]])), options: raw.optionsByColumn?.[column] } : raw;
      const me = S.you?.id;
      const myTurn = S.turnId === me;
      // Würfel des Aktiven; wer dran ist, tippt sie an (liegen lassen)
      const canKeep = myTurn && g.rolls > 0 && g.rolls < 3;
      const dice = g.dice.map((v, i) => {
        const kept = canKeep ? keep.has(i) : g.held[i];
        const die = canKeep ? dieHTML(v, { tag: 'button', cls: I18n.html`big ${kept ? 'kept' : ''}`, attrs: `type="button" data-g="keep" data-i="${i}" aria-pressed="${kept}"` }) : dieHTML(v, { cls: I18n.html`big ${kept ? 'kept' : ''}` });
        return `<span class="kn-slot ${kept ? 'kept' : ''}">${die}<small>${kept ? (I18n.language === 'en' ? 'kept' : 'bleibt') : ''}</small></span>`;
      }).join('');
      const tray = `<div class="kn-tray">${trayExtras()}<small>${nameOf(S, S.turnId)}${g.rolls ? I18n.html` · ${g.rolls}. Wurf von 3` : (I18n.language === 'en' ? ' · not rolled yet' : ' · noch nicht gewürfelt')}</small><div class="kn-dice">${dice}</div>${rollAction(g, myTurn)}</div>`;
      // Punkteblatt: alle Spieler nebeneinander, eigene Spalte hervorgehoben
      // Eigene Spalte zuerst (auf dem Handy sonst rechts abgeschnitten), dann die anderen in Sitzreihenfolge
      const ids = Object.keys(g.sheets).sort((x, y) => (y === me) - (x === me));
      const opts = myTurn && !rollPending ? g.options || {} : {};
      const scoreButton = (f, short = false) => `<button type="button" class="kn-pick ${opts[f] ? '' : 'zero'}" data-g="score" data-f="${f}" aria-label="${label(f)}: ${opts[f] ? I18n.html`${opts[f]} Punkte eintragen` : I18n.t('Streichen')}">${short ? `${label(f)} · ` : ''}${opts[f]}</button>`;
      const cell = (id, f) => {
        const v = g.sheets[id][f];
        const mc = id === me ? 'me' : '';
        if (v !== null) return `<td class="num ${mc} ${v === 0 ? 'zero' : ''}">${v}</td>`;
        if (id === me && f in opts) return `<td class="num me">${scoreButton(f)}</td>`;
        return `<td class="num ${mc}"></td>`;
      };
      const row = (f) => `<tr><th scope="row"><span>${label(f)}</span><small>${hint(f)}</small></th>${ids.map((id) => cell(id, f)).join('')}</tr>`;
      const sumRow = (label, fn, cls = '') => `<tr class="kn-sum ${cls}"><th scope="row">${label}</th>${ids.map((id) => `<td class="num ${id === me ? 'me' : ''}">${fn(g.totals[id], id)}</td>`).join('')}</tr>`;
      const head = ids.map((id) => `<th class="num ${id === me ? 'me' : ''} ${id === S.turnId && S.phase === 'playing' ? 'turn' : ''}" scope="col">${nameOf(S, id)}${id === me ? I18n.html(' <small>(du)</small>') : ''}</th>`).join('');
      const sheet = `<div class="kn-sheet-wrap" tabindex="0" role="region" aria-label="${I18n.content('Punkteblatt', 'Score sheet')}"><table class="kn-sheet"><thead><tr><th></th>${head}</tr></thead><tbody>
        ${UPPER.map(row).join('')}
        ${sumRow(I18n.language === 'en' ? 'Upper total' : 'Summe oben', (t) => t.upper)}
        ${sumRow(I18n.html('Bonus <small>ab 63: 35</small>'), (t) => (t.bonus ? '35' : `<small>${I18n.language === 'en' ? 'need' : 'noch'} ${Math.max(0, 63 - t.upper)}</small>`))}
        ${LOWER.map(row).join('')}
        ${S.settings.extraBonus ? sumRow('Extra-Kniffel', (t) => t.extra || '–') : ''}
        ${sumRow(I18n.t('Gesamt'), (t) => `<b>${t.total}</b>`, 'total')}
        ${triple ? sumRow(ttWeighted(),(_total,id)=>S.players.find(p=>p.id===id)?.total ?? 0,'total') : ''}
        </tbody></table></div>`;
      const W = WorldKit, tt = W.t, free = Object.values(g.sheets[me] || {}).filter((v) => v === null).length;
      const chips = [g.sheets[me] ? W.chip('✎', `${free} ${tt('Felder offen', 'boxes open')}`) : '', triple ? W.chip('×3', `${tt('Dreifachblatt', 'Triple sheet')} · ${tt('Spalte', 'column')} ×${column + 1}`, 'warn') : '', myTurn && g.options && g.rolls ? W.chip('✔', tt('Feld antippen zum Eintragen', 'Tap a box to score'), 'good') : ''].filter(Boolean);
      const possible = Object.keys(opts);
      const choices = possible.length ? `<div class="kn-quick"><button type="button" class="btn" data-g="quick" aria-expanded="${quickScores}">${tt('Freie Wertungen', 'Available scores')}</button>${quickScores ? `<div class="kn-quick-list">${possible.map(f => scoreButton(f, true)).join('')}</div>` : ''}</div>` : '';
      return `<div class="kg-table kn-table wk-stage kn-stage">${W.head({ title: myTurn ? tt('Du bist dran', 'Your turn') : `${nameOf(S, S.turnId)} ${tt('ist dran', 'is playing')}`, chips })}${triple ? `<div class="kg-acts">${[0, 1, 2].map((i) => I18n.html`<button class="btn" data-g="column" data-column="${i}" aria-pressed="${column === i}">Spalte ×${i + 1}</button>`).join('')}</div>` : ''}<div class="kn-play">${tray}${choices}</div>${sheet}</div>`;
    },
    async onClick(t, S) {
      const g = t.dataset.g;
      if (g === 'view3d') {
        const enable = dice3DState !== 'ready' && dice3DState !== 'loading';
        if (enable && dice3DState === 'unavailable') {dice3D?.dispose();dice3DState='idle';}
        store.set('poker:three-d:kniffel',enable);
        rerenderAt('#kniffel-view3d');
        return;
      }
      if (g === 'home3d' || g === 'near3d') {dice3D?.action(g === 'home3d' ? 'home' : 'near');return;}
      if (g === 'quick') {
        quickScores = !quickScores;
        rerenderAt('[data-g="quick"]');
        return;
      }
      if (g === 'column') { column = Number(t.dataset.column); rerenderAt(`[data-column="${column}"]`); return; }
      if (g === 'keep') { const i = Number(t.dataset.i); if (keep.has(i)) keep.delete(i); else keep.add(i); rerenderAt(`[data-g="keep"][data-i="${i}"]`); }
      else if (g === 'roll') {
        if (rollPending || !socket.connected || S.turnId !== S.you?.id) return;
        const pending = {key:keepKey, connection:socket.id};
        rollPending = pending;
        rerenderAt('[data-g="roll"]');
        const reply = await send('roll', {keep:[...keep]});
        if (!reply?.ok && rollPending === pending) {
          rollPending = undefined;
          rerenderAt('[data-g="roll"]');
        }
      }
      else if (g === 'score') {
        const f = t.dataset.f;
        const v = S.variant === 'triple' ? S.g.optionsByColumn?.[column]?.[f] : S.g.options?.[f];
        if (!v && !(await ask({ title: I18n.html`${label(f)} streichen?`, text: 'Das Feld bekommt 0 Punkte und ist für dieses Spiel belegt.', ok: I18n.t('Streichen'), danger: true }))) return;
        send('score', { field: f, column });
      }
    },
    rules: I18n.html`<p>Fünf Würfel, 13 Runden. Wer am Ende die höchste Summe hat, gewinnt.</p>
      <ul>
        <li><b>Zug:</b> bis zu drei Würfe. Würfel, die liegen bleiben sollen, tippst du an – die anderen werden neu geworfen.</li>
        <li>Danach trägst du <b>genau ein</b> freies Feld in deiner Spalte ein. Passt nichts, streichst du ein Feld (0 Punkte).</li>
        <li><b>Oben:</b> Einser bis Sechser – die Summe dieser Augen. Ab 63 Punkten oben gibt es <b>35 Bonus</b>.</li>
        <li><b>Unten:</b> Dreierpasch und Viererpasch (Summe aller Würfel), Full House (3 + 2 gleiche) 25, Kleine Straße (4 in Folge) 30, Große Straße (5 in Folge) 40, Kniffel (5 gleiche) 50, Chance (Summe aller Würfel).</li>
        <li>Hausregel <b>Extra-Kniffel-Bonus</b>: Jeder weitere Kniffel bringt 50 Punkte extra, wenn das Kniffel-Feld schon 50 hat.</li>
        <li>Hausregel <b>Joker</b>: Bei einem weiteren Kniffel musst du erst das passende obere Feld nehmen. Ist das belegt, zählt er unten in jedem Feld voll (Full House 25, Straßen 30/40) – sonst oben 0.</li>
      </ul>`,
  });
}
