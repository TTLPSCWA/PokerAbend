// Mäxchen im Browser (Regeln: games/maexchen/room.js). Der eigene Wurf ist nur für einen selbst sichtbar.
'use strict';
{
  const MAEXCHEN = 21;
  const vName = (v) => (v === MAEXCHEN ? 'Mäxchen' : v % 11 === 0 ? `Pasch ${v / 11}` : String(v));
  const digits = (v) => (v === MAEXCHEN ? [2, 1] : [Math.floor(v / 10), v % 10]);
  let choice = null; // gewählte Ansage
  const kit = kitGame({
    id: 'maexchen',
    name: 'Mäxchen',
    settings: [{ key: 'lives', label: 'Leben pro Spieler', min: 1, max: 10 }],
    playerInfo: (p, S) => (p.out || (S.phase !== 'lobby' && !p.inRound && p.seated && !p.lives) ? 'raus' : `<span class="lives" aria-hidden="true">${'♥'.repeat(p.lives || 0)}</span><span class="sr-only">${p.lives} Leben</span>`),
    onState(S, prev) { if (!S.g?.cup || prev?.g?.cup) return; choice = null; },
    main(S) {
      const g = S.g;
      const name = (id) => esc(S.players.find((p) => p.id === id)?.name ?? '?');
      let center = '';
      if (g.reveal) {
        const r = g.reveal;
        center = `<div class="kg-reveal"><small>Aufgedeckt</small><div class="dice">${digits(r.actual).map((d) => dieHTML(d, { cls: 'big' })).join('')}</div>
          <b>${vName(r.actual)}</b> – angesagt war ${vName(r.value)}. <b>${name(r.loser)}</b> verliert.</div>`;
      } else if (g.last) {
        center = `<div class="kg-announce"><small>${name(g.last.by)} sagt</small><b>${vName(g.last.value)}</b>
          <div class="dice cup">${dieHTML(0, { cls: 'big hidden' })}${dieHTML(0, { cls: 'big hidden' })}</div><small>Becher zu – glaubst du es?</small></div>`;
      } else center = '<div class="kg-announce"><small>Neue Runde</small><b>Würfeln und ansagen</b></div>';
      const mine = g.cup ? `<div class="kg-cup"><small>Dein Wurf (nur du siehst ihn)</small><div class="dice">${g.cup.map((d) => dieHTML(d, { cls: 'big' })).join('')}</div><b>${vName(g.cup[0] === g.cup[1] ? g.cup[0] * 11 : Math.max(...g.cup) === 2 && Math.min(...g.cup) === 1 ? MAEXCHEN : Math.max(...g.cup) * 10 + Math.min(...g.cup))}</b></div>` : '';
      return `<div class="kg-table">${center}${mine}</div>`;
    },
    dock(S, myTurn) {
      const g = S.g;
      if (!myTurn) return '<span class="waiting">Warte, bis du dran bist</span>';
      if (g.cup) {
        const min = g.last ? g.values.indexOf(g.last.value) + 1 : 0;
        const opts = g.values.slice(min);
        if (choice === null || !opts.includes(choice)) choice = opts[0];
        return `<label class="field kg-say"><span>Ansage</span><select data-g="value">${opts.map((v) => `<option value="${v}" ${v === choice ? 'selected' : ''}>${vName(v)}</option>`).join('')}</select></label>
          <button class="btn btn-brass" data-g="announce">Ansagen</button>`;
      }
      if (g.last?.value === MAEXCHEN) return '<span class="waiting">Mäxchen!</span><button class="btn btn-outline-red" data-g="doubt">Anzweifeln</button><button class="btn" data-g="accept">Gelten lassen (1 Leben)</button>';
      if (g.last) return '<button class="btn btn-outline-red" data-g="doubt">Anzweifeln</button><button class="btn btn-brass" data-g="roll">Glauben und würfeln</button>';
      return '<button class="btn btn-brass" data-g="roll">Würfeln</button>';
    },
    onChange(t) { if (t.dataset.g === 'value') choice = Number(t.value); },
    onClick(t) {
      const g = t.dataset.g;
      if (g === 'roll') send('roll');
      else if (g === 'announce') send('announce', { value: choice });
      else if (g === 'doubt') send('doubt');
      else if (g === 'accept') send('accept');
    },
    rules: `<p>Zwei Würfel unter dem Becher. Die höhere Zahl steht vorne: 5 und 3 = <b>53</b>.</p>
      <p><b>Reihenfolge:</b> 31 < 32 < 41 < … < 65 < Pasch 1 < … < Pasch 6 < <b>Mäxchen</b> (2 und 1).</p>
      <ul>
        <li>Du würfelst verdeckt und sagst einen Wert an, der <b>höher</b> sein muss als die letzte Ansage – ehrlich oder geblufft.</li>
        <li>Der Nächste glaubt dir (und würfelt selbst) oder <b>zweifelt an</b>. Dann wird aufgedeckt: Gelogen → du verlierst ein Leben, sonst der Zweifler.</li>
        <li>Bei Mäxchen geht es um zwei Leben. Auf Mäxchen kann man nur anzweifeln oder es gelten lassen (ein Leben, ohne Aufdecken).</li>
        <li>Wer verliert, fängt neu an. Ohne Leben ist man raus – der Letzte gewinnt.</li>
      </ul>`,
  });
}
