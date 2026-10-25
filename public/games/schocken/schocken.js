// Schocken im Browser (Regeln: games/schocken/room.js). Würfel antippen = liegen lassen.
'use strict';
{
  let keep = new Set();
  let keepKey = '';
  const held = (g, id, i) => g.forced?.[id] === i || (g.reroll?.[id] !== i && keep.has(i));
  const kit = kitGame({
    id: 'schocken',
    name: 'Schocken',
    short: [
      "Drei Würfel, bis zu drei Würfe – Würfel antippen = liegen lassen.",
      "Der Erste legt fest, wie oft alle würfeln dürfen.",
      "Stark nach schwach: Schock out (1-1-1), Schock X (1-1-X), General, Straße, Zahl.",
      "Der Schlechteste bekommt Deckel: Schock X = X, General 3, Straße 2, Zahl 1.",
      "Erst aus der Mitte, dann vom Besten. Wer dann keinen Deckel hat, ist raus.",
      "Wer alle 13 Deckel hat, verliert die Hälfte.",
    ],
    house: () => ['Schock out beendet die Hälfte sofort', 'Gleichstand: weniger Würfe gewinnt, dann wer früher dran war'],
    playerInfo: (p, S) => `${p.deckel || 0} Deckel${S.phase === 'playing' && S.g?.done?.includes(p.id) ? ` · ${esc(S.g.judged[p.id])}` : ''}`,
    onState(S) {
      // Neuer Wurf → Auswahl zurücksetzen
      const key = S.g && S.turnId ? `${S.roundNo}:${S.turnId}:${S.g.throws?.[S.turnId] || 0}:${S.g.forced?.[S.turnId] ?? ''}:${S.g.reroll?.[S.turnId] ?? ''}` : '';
      if (key !== keepKey) { keepKey = key; keep = new Set(); }
    },
    hint(S, myTurn) {
      if (!myTurn) return '';
      const g = S.g;
      const n = g.throws[S.you.id] || 0;
      if (!n) return g.first === S.you.id ? 'Würfle – du legst fest, wie oft alle würfeln dürfen' : `Würfle – höchstens ${g.maxThrows}×`;
      if (g.reroll?.[S.you.id] !== undefined) return 'Die zweite Sechs muss neu gewürfelt werden';
      if (n >= g.maxThrows) return `Du hast ${esc(g.judged[S.you.id])} – tipp „Fertig“`;
      return `Du hast ${esc(g.judged[S.you.id])}. Tipp Würfel an, die liegen bleiben, und würfle nochmal – oder „Fertig“`;
    },
    main(S) {
      const g = S.g;
      const name = (id) => esc(S.players.find((p) => p.id === id)?.name ?? '?');
      const myTurn = S.turnId === S.you?.id;
      const rows = Object.keys(g.dice).map((id) => {
        const active = id === S.turnId && !g.done.includes(id);
        const dice = g.dice[id].map((d, i) => (active && myTurn
          ? dieHTML(d, { tag: 'button', cls: `big ${held(g, id, i) ? 'kept' : ''}`, attrs: `type="button" data-g="keep" data-i="${i}" aria-pressed="${held(g, id, i)}" ${g.forced?.[id] === i || g.reroll?.[id] === i ? 'disabled' : ''}` })
          : dieHTML(d, { cls: `${g.kept[id]?.[i] ? 'kept' : ''}` }))).join('');
        return `<div class="kg-row ${active ? 'active' : ''}"><b>${name(id)}</b><div class="dice">${dice}</div>
          <small>${esc(g.judged[id])} · ${g.throws[id]}× ${g.done.includes(id) ? '· fertig' : ''}</small></div>`;
      }).join('');
      const series = S.settings.fullGame
        ? `<div class="kg-chip">${g.finale ? '<b>Finale</b>' : g.series.length ? `2. Hälfte (die 1. hat ${esc(g.series[0])} verloren)` : '1. Hälfte'}</div>` : '';
      const last = g.lastPass ? `<div class="kg-chip">Letzter Durchgang: ${name(g.lastPass.best)} mit ${esc(g.lastPass.name)} – ${name(g.lastPass.worst)} bekommt ${g.lastPass.deckel} Deckel</div>` : '';
      return `<div class="kg-table">
        <div class="kg-stack" aria-label="${g.stack} Deckel im Stapel">${'<i></i>'.repeat(Math.min(g.stack, 13))}<b>${g.stack}</b><small>Deckel in der Mitte</small></div>
        <div class="kg-chips">${series}<div class="kg-chip">Höchstens ${g.maxThrows} ${g.maxThrows === 1 ? 'Wurf' : 'Würfe'} (legt ${name(g.first)} fest)</div>${last}</div>
        <div class="kg-rows">${rows || '<p class="hint">Noch hat niemand gewürfelt.</p>'}</div>
      </div>`;
    },
    dock(S, myTurn) {
      if (!myTurn) return '';
      const g = S.g;
      const n = g.throws[S.you.id] || 0;
      if (!n) return '<button class="btn btn-brass" data-g="roll">Würfeln</button>';
      const d = g.dice[S.you.id] || [];
      const mustRoll = g.reroll?.[S.you.id] !== undefined;
      const heldCount = d.filter((_, i) => held(g, S.you.id, i)).length;
      const sixes = S.settings.sixToOne && n < g.maxThrows && g.forced?.[S.you.id] === undefined && d.filter((x) => x === 6).length >= 2
        ? '<button class="btn" data-g="sixes" title="Eine der Sechsen wird zur Eins und bleibt liegen, die andere wirfst du neu">Zwei Sechsen → Eins</button>' : '';
      return sixes + `<span class="waiting">${n}. Wurf von ${g.maxThrows}</span>
        ${n < g.maxThrows ? `<button class="btn btn-brass" data-g="roll" ${heldCount === 3 ? 'disabled' : ''}>Nochmal würfeln${heldCount ? ` (${3 - heldCount})` : ''}</button>` : ''}
        <button class="btn" data-g="stop" ${mustRoll ? 'disabled title="Erst die zweite Sechs neu würfeln"' : ''}>Fertig</button>`;
    },
    onClick(t) {
      const g = t.dataset.g;
      if (g === 'keep') { const i = Number(t.dataset.i); if (keep.has(i)) keep.delete(i); else keep.add(i); kit.render(); }
      else if (g === 'roll') send('roll', { keep: [...keep] });
      else if (g === 'stop') send('stop');
      else if (g === 'sixes') send('sixes');
    },
    rules: `<p>Drei Würfel, bis zu drei Würfe. Würfel, die liegen bleiben sollen, tippst du an – der Rest wird neu geworfen.
      Wie oft gewürfelt werden darf, legt der <b>Erste</b> im Durchgang fest.</p>
      <p><b>Wertung</b> (stark nach schwach): <b>Schock out</b> (1-1-1) · <b>Schock X</b> (1-1-X, z. B. Schock 6) · <b>General</b> (drei Gleiche) · <b>Straße</b> (drei in Folge) · <b>Zahl</b> (höchste zuerst, z. B. 6-5-3).
      Gleichstand: weniger Würfe ist besser, dann wer früher dran war.</p>
      <ul>
        <li>Der Schlechteste bekommt Deckel – so viele, wie der Wurf des Besten wert ist: Schock X = X, General = 3, Straße = 2, Zahl = 1.</li>
        <li>Erst vom Stapel in der Mitte. Ist der leer, gibt der Beste ab. Wer dann keinen Deckel hat, ist raus.</li>
        <li>Wer am Ende alle 13 hat – oder gegen einen <b>Schock out</b> verliert –, verliert die Hälfte.</li>
      </ul>
      <p>Der Verlierer fängt den nächsten Durchgang an. Wertung über den Abend: verlorene Hälften (wenig ist gut).</p>`,
  });
}
