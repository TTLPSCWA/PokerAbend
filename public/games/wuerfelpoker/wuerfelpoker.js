// Würfelpoker im Browser (Regeln: games/wuerfelpoker/room.js). Würfeln, Würfel zum Behalten antippen, wieder würfeln oder aufhören.
'use strict';
{
  let keep = new Set();
  let seen = '';
  const nameOf = (S, id) => esc(S.players.find((p) => p.id === id)?.name ?? '?');
  const mini = (dice) => `<span class="wp-mini">${dice.map((d) => dieHTML(d, { cls: 'small' })).join('')}</span>`;

  const kit = kitGame({
    id: 'wuerfelpoker',
    name: 'Würfelpoker',
    direction: false,
    intro: [
      ['Ziel', 'Wirf mit fünf Würfeln die beste Pokerhand. Wer die schlechteste hat, bekommt einen Strich.'],
      ['Dein Zug', 'Würfeln, dann gute Würfel antippen (sie bleiben liegen) und den Rest neu würfeln – bis zu dreimal.'],
      ['Ausscheiden', 'Wer die eingestellte Strichzahl erreicht, ist raus. Der Letzte gewinnt.'],
    ],
    short: [
      'Pro Zug bis zu drei Würfe; nach jedem Wurf legst du Würfel beiseite und würfelst den Rest neu.',
      'Hände: Fünfling, Vierling, Full House, große Straße (2–6), kleine Straße (1–5), Drilling, zwei Paare, Paar, hohe Karte.',
      'Wer zuerst dran ist, legt fest, wie oft alle anderen höchstens würfeln.',
      'Die schlechteste Hand bekommt einen Strich. Wer genug Striche hat, scheidet aus.',
    ],
    house: () => [],
    playerInfo: (p, S) => (p.out ? 'raus' : `${'✗'.repeat(p.strikes || 0)}${'·'.repeat(Math.max(0, (S?.g?.strikesMax || 0) - (p.strikes || 0)))}`),
    seat: (p, S) => (p.out ? '<span>raus</span>' : `<span>${p.strikes || 0} von ${S.g?.strikesMax ?? '?'} Strichen</span>${S.g?.results?.[p.id] ? `<span>${esc(S.g.results[p.id].name)}</span>` : ''}`),
    sounds(S, prev) { return S.g && prev.g && S.g.throws > prev.g.throws ? 'dice' : null; },
    onState(S) {
      const key = `${S.turnId}:${S.g?.hands}:${S.g?.throws}`;
      if (key !== seen) { seen = key; keep = new Set(); }
    },
    hint(S, myTurn) {
      const g = S.g;
      if (!myTurn) return `${nameOf(S, S.turnId)} ist dran`;
      if (!g.throws) return `Würfel! Du hast bis zu ${g.maxThrows} Würfe${g.limit ? ` (der Erste hat bei ${g.limit} aufgehört)` : ''}`;
      return `Tipp die Würfel an, die liegen bleiben sollen – der Rest wird neu gewürfelt (${g.throws} von ${g.maxThrows})`;
    },
    main(S) {
      const g = S.g;
      const myTurn = S.turnId === S.you?.id && S.phase === 'playing';
      const dice = g.dice.map((d, i) => dieHTML(d, myTurn && g.throws && g.throws < g.maxThrows
        ? { tag: 'button', cls: `big ${keep.has(i) ? 'kept' : ''}`, attrs: `type="button" data-g="keep" data-i="${i}" aria-pressed="${keep.has(i)}"` }
        : { cls: `big ${g.kept.includes(i) ? 'kept' : ''}` })).join('');
      const tray = `<div class="wp-tray"><small>${nameOf(S, S.turnId)}${g.throws ? ` · ${g.throws}. Wurf von ${g.maxThrows}` : ' · noch nicht gewürfelt'}</small><div class="wp-dice">${dice}</div>${g.current ? `<b class="wp-cat">${esc(g.current)}</b>` : ''}</div>`;
      const rows = Object.entries(g.results).map(([id, r]) => `<li><b>${nameOf(S, id)}</b>${mini(r.dice)}<span>${esc(r.name)}</span></li>`).join('');
      const L = g.last;
      const last = L ? `<details class="wp-last" open><summary>Runde ${L.no}: ${L.losers.length ? `Strich für ${L.losers.map((id) => nameOf(S, id)).join(', ')}` : 'kein Strich'}</summary>
        <ol>${Object.entries(L.results).map(([id, r]) => `<li class="${L.losers.includes(id) ? 'lost' : ''}"><b>${nameOf(S, id)}</b>${mini(r.dice)}<span>${esc(r.name)}</span></li>`).join('')}</ol></details>` : '';
      return `<div class="kg-table wp-wrap">${tray}${rows ? `<ul class="wp-results" aria-label="Fertig in dieser Runde">${rows}</ul>` : ''}${last}</div>`;
    },
    dock(S, myTurn) {
      const g = S.g;
      if (!myTurn) return '';
      const can = g.throws < g.maxThrows;
      const roll = !g.throws ? '<button class="btn btn-brass" data-g="throw">Würfeln</button>'
        : can ? `<button class="btn btn-brass" data-g="throw">${keep.size ? `${5 - keep.size} neu würfeln` : 'Alle neu würfeln'}</button>` : '';
      return `<div class="kg-acts">${roll}${g.throws ? '<button class="btn" data-g="stop">Fertig</button>' : ''}</div>`;
    },
    onClick(t) {
      const g = t.dataset.g;
      if (g === 'keep') { const i = Number(t.dataset.i); if (keep.has(i)) keep.delete(i); else keep.add(i); kit.render(); }
      else if (g === 'throw') { const k = [...keep]; keep = new Set(); send('throw', { keep: k }); }
      else if (g === 'stop') send('stop');
    },
    rules: `<p>Fünf Würfel, die beste Pokerhand gewinnt die Runde.</p>
      <ul>
        <li>Pro Zug bis zu <b>drei Würfe</b>. Nach jedem Wurf legst du Würfel beiseite (antippen) und würfelst den Rest neu.</li>
        <li>Wer in einer Runde als <b>Erster</b> dran ist, legt mit der Zahl seiner Würfe fest, wie oft alle anderen höchstens würfeln dürfen.</li>
        <li>Hände von oben nach unten: <b>Fünfling, Vierling, Full House, große Straße (2–6), kleine Straße (1–5), Drilling, zwei Paare, Paar, hohe Karte</b>. Bei gleicher Hand zählt die höhere Augenzahl.</li>
        <li>Wer die schlechteste Hand hat, bekommt einen <b>Strich</b> (bei Gleichstand alle Betroffenen; haben alle dasselbe, gibt es keinen).</li>
        <li>Wer die eingestellte Strichzahl erreicht, scheidet aus. Der Letzte gewinnt. Der Verlierer der Runde fängt die nächste an.</li>
      </ul>`,
  });
}
