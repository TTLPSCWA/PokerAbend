'use strict';
{
  const horns = (n) => n === 55 ? 7 : n % 11 === 0 ? 5 : n % 10 === 0 ? 3 : n % 5 === 0 ? 2 : 1;
  const points = (r) => r.reduce((s, c) => s + horns(c), 0);
  const bull = '<svg viewBox="0 0 32 24" aria-hidden="true"><path d="M8 10C2 11 1 4 3 2c0 5 5 4 7 5h12c2-1 7 0 7-5 2 2 1 9-5 8l-2 10H10z" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="white"/><circle cx="20" cy="12" r="1" fill="white"/></svg>';
  const card = (n, attrs = '', cls = '') => `<button type="button" class="kc sn-card ${cls}" ${attrs} aria-label="${n}, ${horns(n)} Hornochsen"><b>${n}</b><span>${bull} ${horns(n)}</span></button>`;
  let last = 0;
  const kit = kitGame({
    id: 'sechs-nimmt', name: '6 nimmt!', ring: false, direction: false,
    short: ['104 Karten, zehn für jeden, vier offene Reihen. Alle wählen gleichzeitig verdeckt.', 'Aufsteigend aufdecken: Die Karte kommt an das nächstkleinere Reihenende.', 'Die sechste Karte nimmt die fünf vorherigen. Unter allen Enden: eine Reihe wählen und nehmen.', 'Nach zehn Karten neu geben. Bei 66 Hornochsen endet die Partie; die wenigsten gewinnen.'],
    rules: '<h3>6 nimmt!</h3><p>Alle wählen verdeckt eine Handkarte. Sobald alle fertig sind, werden die Karten nach Zahl aufsteigend zugeordnet: an das größte Reihenende unter der Karte. Eine sechste Karte nimmt die fünf bisherigen; sie beginnt die Reihe neu. Ist sie kleiner als alle Enden, wählt ihr eine Reihe und nehmt sie.</p><p>55 zählt 7 Hornochsen, sonst Vielfache von 11: 5, von 10: 3, von 5: 2, andere: 1. Nach zehn Karten wird neu gegeben, bis jemand das Ziel erreicht. Wenigste Hornochsen gewinnt. Der Timer wählt bei Ablauf zufällig.</p><p>Profi: nur 1 bis 10 × Spieler + 4, jede Reihe mit kleinerem Ende ist wählbar. Taktik: der gesamte Kartenpool ist bekannt, ohne Zuordnung zu Händen.</p>',
    house: (S) => [`Ziel: ${S.settings.target}`, `${S.settings.turnTime} Sekunden`, ...(S.settings.pro ? ['Profi'] : []), ...(S.settings.tactics ? ['Offener Kartenpool'] : [])],
    playerInfo: (p) => `${p.horns || 0} Hornochsen · ${p.ready ? '✓ gewählt' : `${p.cards} Karten`}`,
    status: (S) => `Blatt ${S.g.deal} · Karte ${S.g.trick}/10 · ${S.g.stage === 'pick' ? 'Alle wählen' : S.g.stage === 'row' ? 'Reihe wählen' : 'Aufdecken'}`,
    hint: (S) => S.g.stage === 'pick' ? S.g.ready ? '✓ Deine Karte ist gebunden. Die anderen wählen noch.' : 'Wähle eine Karte. Erst wenn alle fertig sind, wird aufgedeckt.' : S.g.stage === 'row' ? S.turnId === S.you?.id ? 'Tippe eine erlaubte Reihe an' : 'Eine Reihe wird gewählt' : 'Die Karten werden aufsteigend angelegt',
    main(S) {
      const g = S.g, mine = g.stage === 'row' && S.turnId === S.you?.id;
      return `<div class="kg-table sn-table"><div class="sn-reveal" aria-live="polite">${g.queue.map((p, i) => `<span class="sn-choice ${i === g.index ? 'active' : ''}">${esc(S.players.find((x) => x.id === p.id)?.name || '?')}<b>${p.card}</b></span>`).join('') || '<span>Die Auswahl bleibt verdeckt</span>'}</div><div class="sn-rows">${g.rows.map((row, i) => `<div class="sn-row" data-row="${i}"><span class="sn-row-no">${i + 1}<small>${points(row)} ${bull}</small></span>${row.map((n) => card(n, 'disabled tabindex="-1"')).join('')}${Array.from({ length: 5 - row.length }, () => '<span class="sn-slot"></span>').join('')}<span class="sn-six">6!</span>${mine && g.allowed.includes(i) ? `<button type="button" class="sn-take" data-g="row" data-r="${i}" aria-label="Reihe ${i + 1}, ${points(row)} Hornochsen wählen">Reihe ${i + 1} wählen · ${points(row)}</button>` : ''}</div>`).join('')}</div><div class="sn-scores">${S.players.filter((p) => p.inRound).map((p) => `<div><b>${esc(p.name)} ${p.ready ? '✓' : ''}</b><span>${g.totals[p.id] || 0}/${S.settings.target}</span><progress max="${S.settings.target}" value="${g.totals[p.id] || 0}" aria-label="Hornochsen von ${esc(p.name)}"></progress></div>`).join('')}</div>${g.pool ? `<details><summary>Kartenpool (${g.pool.length})</summary><p class="sn-pool">${g.pool.join(' · ')}</p></details>` : ''}</div>`;
    },
    dock: (S) => `<div class="kg-hand sn-hand" aria-label="Deine Karten">${(S.g.hand || []).map((n) => card(n, S.g.stage === 'pick' && !S.g.ready ? `data-g="choose" data-c="${n}"` : 'disabled')).join('')}</div><div class="kg-acts"></div>`,
    onClick(t) { if (t.dataset.g === 'choose') send('choose', { card: Number(t.dataset.c) }); if (t.dataset.g === 'row') send('takeRow', { row: Number(t.dataset.r) }); },
    afterRender(S) {
      const r = S.g?.recent;
      if (!r || r.n === last) return; last = r.n;
      if (motionOff()) return;
      const el = document.querySelector(`[data-row="${r.row}"] .sn-card:last-of-type`);
      el?.animate([{ transform: 'translateY(-24px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300 });
      if (r.taken.length) {
        const from = document.querySelector(`[data-row="${r.row}"]`).getBoundingClientRect();
        const players = S.players.filter((p) => p.seated), index = players.findIndex((p) => p.id === r.id);
        const target = (r.id === S.you?.id ? document.querySelector('#kg-dock') : document.querySelectorAll('#kg-players .kp')[index])?.getBoundingClientRect();
        if (!target) return;
        const ghost = document.createElement('div'); ghost.className = 'sn-flight'; ghost.setAttribute('aria-hidden', 'true');
        ghost.innerHTML = r.taken.map((n) => card(n, 'disabled tabindex="-1"')).join('');
        ghost.style.left = from.x + 'px'; ghost.style.top = from.y + 'px'; document.body.append(ghost);
        const animation = ghost.animate([{ transform: 'none', opacity: .9 }, { transform: `translate(${target.x - from.x}px,${target.y - from.y}px) scale(.25)`, opacity: 0 }], { duration: 450 });
        animation.finished.catch(() => {}).finally(() => ghost.remove());
      }
    },
  });
}
