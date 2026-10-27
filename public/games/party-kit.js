// Gemeinsame Oberfläche der Partyspiele (Schätzmeister, Schlagfertig, Wer hat das gesagt?), aufgesetzt auf kitGame.
// Ein Spiel meldet sich mit partyGame({ … }) an und liefert nur, was zu seiner Frage gehört:
//   id, name, rules (HTML), short (Kurzregeln), intro, terms: { unit: 'Frage', write: 'Schätzen', vote: 'Abstimmen', waitWrite: 'schätzt …', waitVote: 'stimmt ab …' }
//   hint(S) → ein Satz für die aktuelle Stufe, question(S) → HTML Fragekarte, board(S) → Mitte in Schreib-/Abstimmstufe, reveal(S) → Mitte in der Auflösung,
//   writeForm(S) / voteDock(S) → HTML der Eingabe in der Aktionsleiste (pkForm), dockState(S) → was sich in der Eingabe ändern kann (z. B. die eigene Antwort),
//   submit(kind, text, form) → sendet die Eingabe (Promise), onClick(el, S) für eigene data-g-Knöpfe,
//   custom: { help (HTML), example } → Feld „Eigene Fragen“ im Host-Menü
// Alles, was Spieler eingeben, wird hier und im Spiel mit esc() als Text ausgegeben – nie als HTML.
// Läuft nach /core.js und /games/kit.js.
'use strict';

const pkFmt = (n) => Number(n).toLocaleString('de-DE', { maximumFractionDigits: 3 });
const pkPlayer = (S, id) => S.players.find((p) => p.id === id);
const pkName = (S, id) => pkPlayer(S, id)?.name ?? '?';
const pkAvatar = (S, id) => `<span class="pk-av" aria-hidden="true">${avatarHTML(pkPlayer(S, id))}</span>`;

// Eingabezeile für die Aktionsleiste: ein Textfeld und „Senden“. max = Zeichen (Server kürzt ebenfalls auf 120).
function pkForm({ kind, label, placeholder = '', value = '', max = 120, inputmode = 'text', button = 'Senden', note = '', counter = false }) {
  return `<form class="pk-form" data-pk="${esc(kind)}" autocomplete="off">
    <label class="sr-only" for="pk-in">${esc(label)}</label>
    <input id="pk-in" class="pk-input" type="text" inputmode="${esc(inputmode)}" enterkeyhint="send" maxlength="${max}" placeholder="${esc(placeholder)}" value="${esc(value)}" autocomplete="off" autocorrect="off" spellcheck="false">
    <button class="btn btn-brass pk-send" type="submit">${esc(button)}</button>
    ${counter ? `<small class="pk-count" aria-live="off"><span id="pk-len">${[...value].length}</span>/${max}</small>` : ''}
    ${note ? `<small class="pk-note">${note}</small>` : ''}
  </form>`;
}

// Tastatur am Handy: Die Aktionsleiste mit Eingabefeld und „Senden“ bleibt über der Tastatur sichtbar.
// visualViewport meldet, wie viel Platz wirklich da ist (Android/iOS legen die Tastatur oft nur über die Seite).
(() => {
  const vv = window.visualViewport;
  if (!vv || window.__pkKeyboard) return;
  window.__pkKeyboard = true;
  const root = document.documentElement;
  const typing = () => document.activeElement?.matches?.('.pk-input, .pk-text');
  const fit = () => {
    const open = !!typing() && innerHeight - vv.height > 120;
    root.style.setProperty('--vvh', `${vv.height}px`);
    root.style.setProperty('--vvt', `${vv.offsetTop}px`);
    document.body.classList.toggle('pk-kb', open);
    if (open && scrollY) scrollTo(0, 0);
  };
  vv.addEventListener('resize', fit);
  vv.addEventListener('scroll', fit);
  document.addEventListener('focusin', () => setTimeout(fit, 60));
  document.addEventListener('focusout', () => setTimeout(fit, 60));
})();

function partyGame(def) {
  const T = { unit: 'Frage', write: 'Schreiben', vote: 'Abstimmen', waitWrite: 'schreibt …', waitVote: 'stimmt ab …', ...def.terms };
  const STAGE = { write: T.write, vote: T.vote, reveal: 'Auflösung' };
  let customDraft = null; // ungespeicherter Text im Feld „Eigene Fragen“
  let focusKey = null;    // für welche Stufe das Eingabefeld schon automatisch den Fokus hatte (nur am Computer)
  const mine = (S) => session?.game === def.id && S?.you;
  const inGame = (S) => S.phase === 'playing' && S.g?.stage;

  // ---------- Bausteine ----------
  const progress = (S) => {
    const G = S.g;
    const players = S.players.filter((p) => p.inRound);
    const done = players.filter((p) => p.ready).length;
    const counting = G.stage !== 'reveal';
    return `<div class="pk-progress" role="status">
      <b>${esc(T.unit)} ${G.q} von ${G.of}</b>
      <span class="pk-stage">${esc(STAGE[G.stage])}</span>
      ${counting ? `<span class="pk-done">${done} von ${players.length} fertig</span>` : ''}
      <div class="pk-bar" role="progressbar" aria-label="Fortschritt" aria-valuemin="1" aria-valuemax="${G.of}" aria-valuenow="${G.q}"><i style="width:${Math.round((G.q / G.of) * 100)}%"></i></div>
    </div>`;
  };

  // Ende der Partie: Rangliste mit den Punkten dieser Partie
  const finalHTML = (S) => {
    const list = S.players.filter((p) => p.inRound || p.pts).sort((a, b) => (b.pts || 0) - (a.pts || 0));
    return `<div class="kg-table pk-table"><div class="pk-final"><h2>Partie vorbei</h2>
      <ol>${list.map((p, i) => `<li><span class="rank ${i < 3 ? 'r' + (i + 1) : ''}" aria-label="Platz ${i + 1}">${i + 1}</span>${pkAvatar(S, p.id)}<b>${esc(p.name)}${p.id === S.you?.id ? ' <small>(du)</small>' : ''}</b><span class="pk-pts">${p.pts || 0} Punkte</span></li>`).join('')}</ol></div></div>`;
  };

  // Aktionsleiste: Eingabe (Schreiben/Abstimmen) bzw. „Weiter“ (Auflösung)
  const stageDock = (S) => {
    const G = S.g;
    const host = S.you?.isHost;
    if (G.stage === 'reveal') return `<div class="kg-acts pk-acts">${host ? '<button class="btn btn-brass" data-g="pk-next">Weiter</button>' : '<span class="waiting">Gleich geht es weiter …</span>'}</div>`;
    const form = (G.stage === 'write' ? def.writeForm?.(S) : def.voteDock?.(S)) || '';
    const skip = host ? '<button class="btn btn-ghost pk-skip" data-g="pk-next" title="Diese Stufe jetzt beenden – wer noch nicht fertig ist, bekommt keine Antwort">Alle fertig – weiter</button>' : '';
    return `<div class="kg-acts pk-acts">${form}${skip}</div>`;
  };

  const kit = kitGame({
    id: def.id, name: def.name, rules: def.rules, short: def.short, intro: def.intro,
    roundWord: 'Partie', direction: false, ring: false,
    house: () => [],
    playerInfo(p, S) {
      if (!inGame(S) || p.inRound === undefined) return '';
      const state = S.g.stage === 'reveal' || !p.inRound ? '' : p.ready ? '✓ fertig' : S.g.stage === 'write' ? T.waitWrite : T.waitVote;
      return [`${p.pts || 0} Pkt.`, state].filter(Boolean).join(' · ');
    },
    status(S) { return inGame(S) ? `${esc(T.unit)} ${S.g.q} von ${S.g.of} · ${esc(STAGE[S.g.stage])}` : null; },
    hint(S) {
      if (!inGame(S)) return '';
      if (S.g.stage === 'reveal') return S.you?.isHost ? 'Tipp auf „Weiter“, wenn ihr bereit seid – sonst geht es von selbst weiter' : 'Auflösung – gleich geht es weiter';
      if (!S.you?.inRound && !S.g.canAnswer) return 'Du schaust zu – in der nächsten Partie kannst du mitspielen';
      return def.hint(S);
    },
    main(S) {
      if (!inGame(S)) return finalHTML(S);
      return `<div class="kg-table pk-table">${progress(S)}${def.question(S)}${S.g.stage === 'reveal' ? def.reveal(S) : def.board?.(S) || ''}</div>`;
    },
    dock(S) { return inGame(S) ? stageDock(S) : ''; },
    // Zuschauer dürfen mitmachen, wenn der Host es erlaubt hat (Server sendet canAnswer)
    watchDock(S) { return inGame(S) && S.g.canAnswer && !S.you?.inRound ? stageDock(S) : ''; },
    // Die Aktionsleiste wird nur neu gezeichnet, wenn sich daran etwas ändert – sonst ginge getippter Text verloren
    dockKey(S) {
      const G = S.g || {};
      return [S.phase, S.roundNo, S.you?.inRound, S.you?.playing, S.you?.isHost, G.stage, G.sub, G.q, G.canAnswer, S.players.filter((p) => p.seated).length, def.dockState?.(S) ?? ''].join('|');
    },
    sounds(S, prev) {
      if (S.g?.stage === 'reveal' && prev.g?.stage !== 'reveal') return 'drum';
      if (S.g?.stage && prev.g?.q !== S.g.q && S.phase === 'playing' && prev.roundNo === S.roundNo) return 'draw';
      return null;
    },
    afterRender(S) {
      // Am Computer gleich ins Eingabefeld; am Handy nicht (die Tastatur würde die Frage verdecken)
      const key = inGame(S) ? `${S.roundNo}:${S.g.q}:${S.g.stage}:${S.g.sub}` : null;
      if (key && key !== focusKey && matchMedia('(pointer: fine)').matches && !$('#dlg')?.open && !document.activeElement?.closest?.('#kg-panel')) {
        const input = $('#kg-dock .pk-input');
        if (input) { focusKey = key; input.focus({ preventScroll: true }); }
      }
      def.afterRender?.(S);
    },
    hostExtra(S) {
      if (!def.custom) return '';
      const off = S.phase === 'playing';
      const saved = S.custom || [];
      return `<section class="pk-custom" aria-label="Eigene Fragen"><h3>Eigene Fragen für diesen Abend</h3>
        <p class="hint" style="margin:0">${def.custom.help}</p>
        <label class="field"><span class="sr-only">Eigene Fragen, eine pro Zeile</span>
          <textarea id="pk-custom" class="pk-text" rows="6" maxlength="20000" placeholder="${esc(def.custom.example)}" ${off ? 'disabled' : ''}>${esc(customDraft ?? saved.join('\n'))}</textarea></label>
        <button type="button" class="btn" data-g="pk-save" ${off ? 'disabled' : ''}>Fragen speichern</button>
        <p class="hint" style="margin:0">${saved.length ? `${saved.length} eigene Frage${saved.length === 1 ? '' : 'n'} gespeichert` : 'Noch keine eigenen Fragen'} – sie gelten nur in diesem Raum${off ? ' und lassen sich zwischen den Partien ändern' : ''}.</p></section>`;
    },
    async onClick(el, S, e) {
      const g = el.dataset.g;
      if (g === 'pk-next') send('next');
      else if (g === 'pk-save') {
        const text = $('#pk-custom')?.value ?? '';
        const r = await send('custom', { text });
        if (r?.ok) { customDraft = null; toast(r.count ? `${r.count} Frage${r.count === 1 ? '' : 'n'} gespeichert${r.skipped ? ` – ${r.skipped} Zeile${r.skipped === 1 ? '' : 'n'} nicht lesbar` : ''}` : 'Eigene Fragen entfernt'); kit.render(); }
      } else def.onClick?.(el, S, e);
    },
  });

  // Eingabe absenden (Enter am Computer, „Senden“ am Handy)
  document.addEventListener('submit', async (e) => {
    const f = e.target.closest?.('form[data-pk]');
    if (!f || !mine(kit.S)) return;
    e.preventDefault();
    const input = f.querySelector('.pk-input');
    const text = input?.value.trim() ?? '';
    if (!text) { toast('Schreib erst etwas hin', true); input?.focus(); return; }
    const r = await def.submit(f.dataset.pk, text, f);
    if (r?.ok) { sfx('chips'); if (f.dataset.pk !== 'keep') input.blur?.(); }
  });
  document.addEventListener('input', (e) => {
    if (!mine(kit.S)) return;
    if (e.target.id === 'pk-custom') customDraft = e.target.value;
    else if (e.target.id === 'pk-in') { const n = $('#pk-len'); if (n) n.textContent = [...e.target.value].length; }
  });
  return kit;
}
