// Oberfläche für Bauart B (Solo-Partyspiele: alle spielen gleichzeitig dieselbe Runde, aus demselben Seed) – aufgesetzt auf partyGame.
// Die Spiellogik (public/games/<spiel>/logic.js) wird als Modul nachgeladen und läuft hier genauso wie auf dem Server.
// Ein Spiel meldet sich mit soloGame({ … }) an:
//   id, name, intro, short, rules, terms (optional),
//   render(c) → HTML des Spielfelds, sig(c) → Kennung des Zustands (ändert sie sich, wird neu gezeichnet), tick(c) (optional, jedes Bild),
//   hint(c), question(c) → HTML (optional), onClick(el, c), onKey(e, c), timed (true: nach playMs wird mit payload(c) automatisch abgegeben),
//   payload(c) → Eingaben für den Server, form(c) → HTML der Eingabezeile (optional), formPayload(text, c) → Eingaben aus dem Textfeld,
//   solution(R, S) → HTML der Lösung in der Auflösung.
// c = { S, G, L (Logik-Modul), round, local (Zustand dieser Runde), t (ms seit Rundenbeginn auf der Serveruhr), canPlay, submit(payload), refresh() }
'use strict';

function soloGame(def) {
  let L = null, loading = false, key = '', local = {}, round = null, submitted = false, raf = 0;
  const ensureLogic = () => {
    if (L || loading) return;
    loading = true;
    import(`/games/${def.id}/logic.js`).then((m) => { L = m; kit?.render?.(); }).catch(() => { loading = false; });
  };

  function ctxOf(S) {
    const G = S.g;
    const k = `${S.roundNo}:${G?.q}`;
    if (k !== key) { key = k; local = {}; round = null; submitted = false; }
    ensureLogic();
    if (!round && L && G?.seed) round = L.makeRound(G.seed, G.level, { ...G.options, playMs: G.playMs });
    const c = {
      S, G, L, round, local, t: G ? gameNow(S) - G.t0 : 0,
      canPlay: !!(!S.gamePaused && G && G.stage === 'write' && G.canAnswer && G.mine === null && !submitted),
      submitted: submitted || (G?.mine ?? null) !== null,
      submit,
      refresh: () => refresh(c),
    };
    return c;
  }
  async function submit(payload) {
    if (kit.S?.gamePaused) return;
    if (submitted) return;
    submitted = true;
    const r = await send('solo', { payload });
    if (!r?.ok) { submitted = false; toast(r?.error || 'Das hat nicht geklappt', true); }
    else sfx?.('chips');
  }
  function refresh(c) {
    const area = $('#so-area');
    if (!area || !c.round) return;
    const sg = def.sig(c);
    if (area.dataset.sig !== sg) { area.dataset.sig = sg; area.innerHTML = def.render(c); }
  }
  function loop() {
    raf = 0;
    const S = kit?.S;
    if (!S || S.gamePaused || session?.game !== def.id || S.g?.stage !== 'write' || document.hidden) return;
    const c = ctxOf(S);
    if (c.round && c.canPlay) {
      def.tick?.(c);
      refresh(c);
      if (def.timed && c.t >= c.G.playMs) submit(def.payload(c));
    }
    raf = requestAnimationFrame(loop);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !raf) raf = requestAnimationFrame(loop); });
  document.addEventListener('keydown', (e) => {
    const S = kit?.S;
    if (!S || S.gamePaused || session?.game !== def.id || !def.onKey || e.target.closest?.('input, textarea, select')) return;
    const c = ctxOf(S);
    if (c.round && c.canPlay) def.onKey(e, c);
  });

  const kit = partyGame({
    id: def.id, name: def.name, intro: def.intro, short: def.short, rules: def.rules,
    terms: { unit: 'Runde', write: 'Spielen', waitWrite: 'spielt …', ...def.terms },
    hint(S) {
      const c = ctxOf(S);
      if (c.submitted) return 'Abgegeben – die anderen spielen noch';
      return c.round ? def.hint(c) : 'Einen Moment …';
    },
    question: (S) => (def.question ? def.question(ctxOf(S)) : ''),
    board(S) {
      const c = ctxOf(S);
      if (!c.round) return '<div class="so-wait" role="status">Die Runde wird vorbereitet …</div>';
      if (c.submitted) return `<div class="so-wait" role="status"><p>${S.g.mine ? `Deine Wertung: <b>${S.g.mine.pts}</b> Punkte` : 'Abgegeben.'}</p><p class="hint">Die Ergebnisse siehst du, sobald alle fertig sind oder die Zeit abläuft.</p></div>`;
      if (!c.G.canAnswer) return '<div class="so-wait" role="status"><p>Du schaust zu.</p></div>';
      return `<div id="so-area" class="so-area so-${def.id}" data-sig="${esc(def.sig(c))}">${def.render(c)}</div>`;
    },
    writeForm(S) { const c = ctxOf(S); return def.form && c.round && c.canPlay ? def.form(c) : ''; },
    dockState: (S) => `${S.g?.mine ? 1 : 0}|${submitted ? 1 : 0}|${round ? 1 : 0}`,
    submit(kind, text) { const c = ctxOf(kit.S); const p = def.formPayload?.(text, c); if (p === null || p === undefined) { toast('Das habe ich nicht verstanden', true); return Promise.resolve(null); } return submit(p).then(() => ({ ok: true })); },
    reveal(S) {
      const R = S.g.reveal;
      const rows = R.results.map((r) => `<li class="${r.pts ? 'win' : ''} ${r.id === S.you?.id ? 'me' : ''}">${pkAvatar(S, r.id)}<span class="nm">${esc(pkName(S, r.id))}${r.id === S.you?.id ? ' <small>(du)</small>' : ''}</span>
        <span class="val"><small>${esc(r.detail)}</small></span><span class="pts pk-pts">${r.pts ? `+${r.pts}` : '0'}</span></li>`).join('');
      return `${def.solution ? def.solution(R.solution, S) : ''}<ol class="sm-rank so-rank">${rows}</ol>`;
    },
    onClick(el, S, e) { const c = ctxOf(S); if (c.round) def.onClick?.(el, c, e); },
    afterRender(S) {
      if (!S.gamePaused && S.g?.stage === 'write' && !raf) raf = requestAnimationFrame(loop);
    },
  });
  return Object.assign(kit, { ctx: () => ctxOf(kit.S) });
}
