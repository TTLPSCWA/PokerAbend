// Tickendes Paket im Browser (Regeln: games/tickendes-paket/room.js). Wer das Paket hat, tippt ein passendes Wort ein und gibt es weiter.
'use strict';
{
  const nameOf = (S, id) => esc(S.players.find((p) => p.id === id)?.name ?? '?');
  let cd = null; // Rest-Countdown beim sichtbaren Zünder: { endsAt, el }

  const kit = kitGame({
    id: 'tickendes-paket',
    name: 'Tickendes Paket',
    direction: false,
    intro: [
      ['Ziel', 'Gib das tickende Paket schnell weiter, bevor es dir in der Hand platzt.'],
      ['Weitergeben', 'Du bekommst eine Frage wie „Tier mit K“. Tipp ein passendes Wort ein – dann bekommt der Nächste das Paket.'],
      ['Minuspunkte', 'Wem das Paket platzt, bekommt einen Minuspunkt. Wer am Ende die wenigsten hat, gewinnt.'],
    ],
    short: [
      'Ein Paket tickt mit einer unbekannten Zeit und wandert von Hand zu Hand.',
      'Wer es hat, antwortet auf eine Kurzfrage mit einem Wort mit dem verlangten Anfangsbuchstaben – jedes Wort nur einmal pro Paket.',
      'Wer zu lange braucht, behält das Paket. Platzt es, gibt es einen Minuspunkt.',
      'Ob das Wort zur Kategorie passt, prüft die Gruppe – der Server prüft nur Buchstabe und Wiederholung.',
    ],
    house: (S) => (S.settings.visibleFuse ? ['Sichtbarer Countdown'] : []),
    playerInfo: (p) => I18n.html`${p.minus ?? 0} Minus${p.holder ? I18n.html(' · <b>hat das Paket</b>') : ''}`,
    seat: (p) => I18n.html`<span>${p.minus ?? 0} Minuspunkt${p.minus === 1 ? '' : 'e'}</span>${p.holder ? I18n.html('<b class="kg-call">Paket</b>') : ''}`,
    sounds(S, prev) { return S.g?.exploded?.bomb !== prev.g?.exploded?.bomb && S.g?.exploded ? 'drum' : null; },
    hint(S, myTurn) {
      const g = S.g;
      if (!myTurn) return I18n.html`${nameOf(S, S.turnId)} hat das Paket`;
      return g.prompt ? I18n.html`Schnell: ${g.prompt.cat} mit ${g.prompt.letter}!` : '';
    },
    main(S) {
      const g = S.g;
      const myTurn = S.turnId === S.you?.id && S.phase === 'playing';
      const boom = g.exploded && g.exploded.bomb === g.bomb - 1 ? I18n.html`<div class="tp-boom" role="status">💥 Geplatzt bei ${nameOf(S, g.exploded.id)}!</div>` : '';
      const fuse = g.visibleFuse && g.fuseLeft !== null ? I18n.html`<div class="tp-fuse" data-fuse="${S.now + g.fuseLeft}" role="timer" aria-label="Zünder">⏱ ${Math.ceil(g.fuseLeft / 1000)} s</div>` : '';
      const prompt = g.prompt ? I18n.html`<div class="tp-prompt ${myTurn ? 'mine' : ''}"><small>${nameOf(S, S.turnId)} muss nennen:</small><b>${esc(g.prompt.cat)}</b><span class="tp-letter" aria-label="mit dem Buchstaben ${esc(g.prompt.letter)}">${esc(g.prompt.letter)}</span></div>` : '';
      const used = g.used.length ? I18n.html`<div class="tp-used" aria-label="Schon genannt"><small>Schon genannt:</small> ${g.used.map((w) => `<i>${esc(w)}</i>`).join('')}</div>` : '';
      return I18n.html`<div class="kg-table tp-wrap"><div class="tp-pkg" aria-hidden="true"><span class="tp-box ${myTurn ? 'hot' : ''}">📦</span></div>
        <div class="kg-chip">Paket ${g.bomb} von ${g.rounds}</div>${boom}${fuse}${prompt}${used}</div>`;
    },
    dock(S, myTurn) {
      if (!myTurn) return '';
      return I18n.html`<form class="pk-form tp-form" data-tp autocomplete="off"><label class="sr-only" for="tp-in">Dein Wort</label>
        <input id="tp-in" class="pk-input" type="text" maxlength="30" enterkeyhint="send" placeholder="Dein Wort mit ${esc(S.g.prompt?.letter ?? '')} …" autocomplete="off" autocorrect="off" spellcheck="false">
        <button class="btn btn-brass pk-send" type="submit">Weitergeben</button></form>`;
    },
    dockKey: (S) => `${S.turnId}|${S.g?.prompt?.letter}|${S.g?.prompt?.cat}|${S.phase}|${S.roundNo}|${S.you?.playing}|${S.you?.inRound}|${S.you?.isHost}|${S.players.filter((p) => p.seated).length}`,
    afterRender(S) {
      if (S.turnId === S.you?.id && matchMedia('(pointer: fine)').matches) $('#tp-in')?.focus({ preventScroll: true });
    },
    onClick() {},
    rules: I18n.html`<p>Ein Paket tickt mit einer Zeit, die niemand kennt, und wandert von Hand zu Hand.</p>
      <ul>
        <li>Wer das Paket hat, bekommt eine <b>Kurzfrage</b> („Tier mit K“) und tippt ein passendes Wort ein, das mit dem Buchstaben beginnt. Dann geht das Paket an den Nächsten.</li>
        <li>Jedes Wort darf in einem Paket nur <b>einmal</b> vorkommen. Ob es wirklich zur Kategorie passt, entscheidet die Gruppe – ein Wörterbuch gibt es nicht.</li>
        <li>Wer zu lange braucht, <b>behält</b> das Paket und bekommt eine neue Frage.</li>
        <li>Platzt das Paket, bekommt der Halter einen <b>Minuspunkt</b> und fängt das nächste Paket an.</li>
        <li>Nach den eingestellten Runden gewinnt, wer die <b>wenigsten Minuspunkte</b> hat.</li>
        <li>Hausregel: sichtbarer Countdown statt Zufallszeit.</li>
      </ul>`,
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest?.('form[data-tp]');
    if (!f || session?.game !== 'tickendes-paket') return;
    e.preventDefault();
    const input = f.querySelector('input');
    const text = input.value.trim();
    if (!text) return;
    send('answer', { text }).then((r) => { if (r?.ok) { input.value = ''; sfx?.('card'); } else if (r?.error) toast(r.error, true); });
  });
  // Sichtbarer Zünder: Sekunden herunterzählen
  setInterval(() => {
    document.querySelectorAll('[data-fuse]').forEach((el) => { el.textContent = I18n.html`⏱ ${Math.max(0, Math.ceil((Number(el.dataset.fuse) - gameNow(kit.S)) / 1000))} s`; });
  }, 250);
  void kit; void cd;
}
