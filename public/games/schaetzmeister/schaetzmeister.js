// Schätzmeister im Browser (Regeln: games/schaetzmeister/room.js). Alle schätzen eine Zahl, danach zeigt ein Zahlenstrahl alle Schätzungen und die richtige Antwort.
'use strict';
{
  const unitText = (u) => (u ? ` ${esc(u)}` : '');

  // Zahlenstrahl: Schätzungen als Avatar + Name, in Bahnen übereinander gelegt; bei sehr weit auseinanderliegenden Werten logarithmisch
  function numberLine(S, R) {
    const vals = [...R.guesses.map((g) => g.value), R.answer];
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const log = lo > 0 && hi / lo >= 100;
    const t = (v) => (log ? Math.log10(v) : v);
    const span = t(hi) - t(lo) || 1;
    const pos = (v) => (hi === lo ? 50 : 10 + ((t(v) - t(lo)) / span) * 80);
    const items = R.guesses.map((g) => ({ ...g, x: pos(g.value) })).sort((a, b) => a.x - b.x);
    const lanes = [];
    for (const it of items) {
      let l = lanes.findIndex((last) => it.x - last >= 12);
      if (l < 0) l = lanes.length < 5 ? lanes.length : lanes.indexOf(Math.min(...lanes));
      lanes[l] = it.x; it.lane = l;
    }
    const height = 46 + Math.max(1, lanes.length) * 52;
    const bestPts = Math.max(0, ...R.guesses.filter((g) => !g.spectator).map((g) => g.pts));
    const markers = items.map((g, i) => `<span class="sm-m ${g.pts && g.pts === bestPts && !g.spectator ? 'win' : ''} ${g.id === S.you?.id ? 'me' : ''} ${g.spectator ? 'spec' : ''}" style="left:${g.x}%;top:${44 + g.lane * 52}px;--i:${i}">
        <i aria-hidden="true">${avatarHTML(pkPlayer(S, g.id))}</i><small>${esc(pkName(S, g.id))}</small></span>`).join('');
    const label = `Zahlenstrahl: richtig ${pkFmt(R.answer)}${R.unit ? ' ' + R.unit : ''}; ${R.guesses.map((g) => `${pkName(S, g.id)} ${pkFmt(g.value)}`).join(', ')}`;
    return `<div class="sm-line" style="height:${height}px" role="img" aria-label="${esc(label)}">
        <div class="sm-axis"></div>
        <div class="sm-flag" style="left:${pos(R.answer)}%"><span>Richtig</span></div>${markers}</div>
      <p class="sm-scale">${pkFmt(lo)} bis ${pkFmt(hi)}${log ? ' · logarithmische Skala, weil die Schätzungen weit auseinanderliegen' : ''}</p>`;
  }

  const kit = partyGame({
    id: 'schaetzmeister',
    name: 'Schätzmeister',
    terms: { unit: 'Frage', write: 'Schätzen', waitWrite: 'schätzt …' },
    intro: [
      ['Schätzen', 'Jede Runde kommt eine Frage, deren Antwort eine Zahl ist. Alle schätzen gleichzeitig – niemand sieht die Zahlen der anderen.'],
      ['Auflösung', 'Danach liegen alle Schätzungen auf einem Zahlenstrahl, und die richtige Antwort wird gezeigt.'],
      ['Punkte', 'Wer am nächsten dran liegt, bekommt 3 Punkte, der Zweite 2, der Dritte 1. Genau richtig gibt 2 Punkte extra.'],
    ],
    short: [
      'Jede Runde eine Schätzfrage: Alle geben gleichzeitig eine Zahl ein.',
      'Danach zeigt ein Zahlenstrahl alle Schätzungen und die richtige Antwort.',
      'Am nächsten dran: 3 Punkte, Zweiter 2, Dritter 1. Gleich weit weg = gleiche Punkte. Genau richtig: +2.',
      'Wer nichts eingibt, bekommt keine Punkte. Wer am Ende die meisten Punkte hat, gewinnt.',
    ],
    hint: (S) => (S.g.mine === null ? 'Gib deine Schätzung als Zahl ein – Komma für Dezimalstellen' : 'Deine Schätzung steht – du kannst sie bis zum Ende der Zeit noch ändern'),
    question(S) {
      const G = S.g;
      return `<div class="pk-q"><h2>${esc(G.question)}</h2>${G.unit ? `<p>Antwort in: <b>${esc(G.unit)}</b></p>` : ''}</div>`;
    },
    board(S) {
      const G = S.g;
      return `<div class="pk-wait">${G.mine !== null
        ? `<p class="pk-mine">Deine Schätzung: <b>${pkFmt(G.mine)}</b>${unitText(G.unit)}</p>`
        : G.canAnswer ? '<p class="pk-mine pk-open">Du hast noch nicht geschätzt</p>' : ''}
        <p>Die Schätzungen der anderen siehst du, sobald alle fertig sind oder die Zeit abläuft.</p></div>`;
    },
    writeForm(S) {
      const G = S.g;
      return pkForm({
        kind: 'guess', label: 'Deine Schätzung als Zahl', placeholder: G.unit ? `Deine Schätzung in ${G.unit}` : 'Deine Schätzung', inputmode: 'decimal', max: 30,
        value: G.mine === null ? '' : String(G.mine).replace('.', ','), button: G.mine === null ? 'Schätzen' : 'Ändern',
        note: G.mine === null ? 'Punkt = Tausendertrenner, Komma = Dezimalzeichen' : `Abgegeben: <b>${pkFmt(G.mine)}</b>`,
      });
    },
    dockState: (S) => `${S.g?.mine ?? ''}`,
    submit: (kind, text) => send('guess', { text }),
    reveal(S) {
      const R = S.g.reveal;
      const rows = R.guesses.map((g) => {
        const diff = Math.abs(g.value - R.answer);
        return `<li class="${g.pts && !g.spectator ? 'win' : ''} ${g.id === S.you?.id ? 'me' : ''}">${pkAvatar(S, g.id)}<span class="nm">${esc(pkName(S, g.id))}${g.id === S.you?.id ? ' <small>(du)</small>' : ''}</span>
          <span class="val">${pkFmt(g.value)}${unitText(R.unit)}<small>${g.exact ? 'genau richtig!' : `${pkFmt(diff)} daneben`}</small></span>
          <span class="pts pk-pts">${g.spectator ? 'Zuschauer' : g.pts ? `+${g.pts}` : '0'}</span></li>`;
      }).join('');
      const missing = R.missing.map((id) => esc(pkName(S, id))).join(', ');
      return `<div class="sm-answer" role="status"><small>Richtig ist</small><b>${pkFmt(R.answer)}</b><span>${esc(R.unit)}</span></div>
        ${R.guesses.length ? numberLine(S, R) : '<p class="hint">Niemand hat geschätzt.</p>'}
        <ol class="sm-rank">${rows}</ol>
        ${missing ? `<p class="hint" style="margin:0">Keine Schätzung: ${missing}</p>` : ''}
        <p class="sm-src">Quelle: ${esc(R.src)}</p>`;
    },
    custom: {
      help: 'Eine Frage pro Zeile im Format <b>Frage | Zahl | Einheit</b> (die Einheit ist optional). Bis zu 100 Fragen.',
      example: 'Wie viele Stufen hat unser Treppenhaus? | 56 | Stufen',
    },
    rules: `<p>Pro Runde eine Schätzfrage, deren Antwort eine Zahl ist. Alle schätzen gleichzeitig; erst nach der Zeit (oder wenn alle abgegeben haben) werden alle Schätzungen und die richtige Antwort gezeigt.</p>
      <ul>
        <li><b>Punkte:</b> am nächsten dran 3, Zweiter 2, Dritter 1. Wer gleich weit weg liegt, bekommt gleich viele Punkte; danach geht es mit dem nächsten Abstand weiter. Genau richtig: +2 Bonus.</li>
        <li><b>Prozent-Wertung (Hausregel):</b> höchstens 5 % daneben 3 Punkte, bis 15 % 2 Punkte, bis 30 % 1 Punkt – gut bei sehr großen Zahlen.</li>
        <li><b>Eingabe:</b> Zahl mit Komma für Dezimalstellen, Punkt als Tausendertrenner (1.234,5). Du kannst deine Schätzung bis zum Ende der Zeit ändern.</li>
        <li>Wer nichts eingibt, bekommt keine Punkte und hält niemanden auf. Wer offline ist, wird nicht abgewartet.</li>
        <li>Die Partie endet nach der eingestellten Zahl an Runden oder wenn jemand das Punkte-Ziel erreicht.</li>
        <li>Der Host kann eigene Fragen für den Abend ergänzen (Host-Menü). Zuschauer dürfen auf Wunsch außer Wertung mitschätzen.</li>
        <li>Computerspieler kennen die Antwort nicht genau: Sie liegen meist ordentlich, aber nie sicher richtig.</li>
      </ul>`,
  });
}
