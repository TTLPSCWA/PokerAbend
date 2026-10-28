// Mogeln im Browser (Regeln: games/mogeln/room.js). Karten antippen (mehrere möglich), „Ablegen“, oder „Mogeln!“ rufen.
'use strict';
{
  let sel = new Set();
  const RANK_NAME = { A: 'Asse', T: 'Zehner', J: 'Buben', Q: 'Damen', K: 'Könige' };
  const rn = (r) => RANK_NAME[r] || `${r}er`;
  const ORDER = 'A23456789TJQK';
  const nameOf = (S, id) => esc(S.players.find((p) => p.id === id)?.name ?? '?');
  const sortHand = (h) => [...h].sort((a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]) || a[1].localeCompare(b[1]));

  const kit = kitGame({
    id: 'mogeln',
    name: 'Mogeln',
    intro: [
      ['Ziel', 'Wirf alle deine Karten ab. Wer als Erster keine Karten mehr hat, gewinnt.'],
      ['Dein Zug', 'Tipp Karten an und leg sie verdeckt ab. Du behauptest, es seien Karten des angesagten Werts – ob es stimmt, ist egal.'],
      ['Mogeln!', 'Glaubst du dem Vorgänger nicht, tipp auf „Mogeln!“. Die Karten werden aufgedeckt: Der Lügner nimmt den Stapel – oder du, wenn es gestimmt hat.'],
    ],
    short: [
      'Reihum wird in fester Folge angesagt: Ass, 2, 3 … König, wieder Ass.',
      'Du legst 1 bis 4 Karten verdeckt ab und behauptest, es seien Karten des angesagten Werts.',
      'Jeder andere darf „Mogeln!“ rufen. War gelogen, nimmt der Lügner den Stapel, sonst der Zweifler.',
      'Wer den Stapel nimmt, fängt an. Wer zuerst keine Karten mehr hat (und nicht erwischt wird), gewinnt.',
    ],
    house: () => [],
    playerInfo: (p) => `${p.cards} Karte${p.cards === 1 ? '' : 'n'}`,
    seat: (p) => `${fanHTML(p.cards)}<span>${p.cards} Karte${p.cards === 1 ? '' : 'n'}</span>`,
    onState(S, prev) {
      if (S.turnId !== S.you?.id || S.moveNo !== prev?.moveNo) { const h = new Set(S.g?.hand || []); sel = new Set([...sel].filter((c) => h.has(c))); }
    },
    hint(S, myTurn) {
      const g = S.g;
      if (!myTurn) return `${nameOf(S, S.turnId)} ist dran – angesagt: <b>${rn(g.need)}</b>${g.canCall ? ' · glaubst du es nicht? „Mogeln!“' : ''}`;
      return `Du bist dran: leg Karten verdeckt ab und sag „${rn(g.need)}“ – egal, was es wirklich ist`;
    },
    main(S) {
      const g = S.g;
      const L = g.last;
      const last = L ? `<div class="kg-chip">${nameOf(S, L.by)} hat ${L.count} × ${rn(L.rank)} abgelegt</div>` : '<div class="kg-chip">Der Stapel ist leer</div>';
      let reveal = '';
      if (g.reveal) {
        const R = g.reveal;
        reveal = `<div class="mg-reveal ${R.truth ? 'true' : 'lie'}" role="status"><b>${nameOf(S, R.caller)} ruft „Mogeln!“</b>
          <span class="mg-cards">${R.cards.map((c) => frenchCard(c, { attrs: 'disabled tabindex="-1"' })).join('')}</span>
          <span>${R.truth ? 'Es stimmte' : 'Gelogen'} – ${nameOf(S, R.taker)} nimmt den Stapel</span></div>`;
      }
      return `<div class="kg-table mg-table">
        <div class="mg-need" role="status"><small>Angesagt</small><b>${rn(g.need)}</b></div>
        <div class="mg-pile" aria-label="Stapel: ${g.pile} Karten"><span class="mg-stack">${fanHTML(Math.min(g.pile, 5))}</span><small>${g.pile} Karte${g.pile === 1 ? '' : 'n'} im Stapel</small></div>
        <div class="kg-chips">${last}</div>
        ${reveal}
      </div>`;
    },
    dock(S, myTurn) {
      const g = S.g;
      const hand = sortHand(g.hand || []).map((c) => frenchCard(c, { cls: sel.has(c) ? 'sel' : '', attrs: myTurn ? `data-g="pick" data-c="${c}"` : 'disabled' })).join('');
      const n = sel.size;
      const acts = `${myTurn ? `<button class="btn btn-brass" data-g="play" ${n && n <= g.maxCards ? '' : 'disabled'}>${n ? `${n} Karte${n === 1 ? '' : 'n'} als ${rn(g.need)} ablegen` : 'Karten wählen'}</button>` : ''}
        ${g.canCall ? '<button class="btn btn-danger" data-g="call">Mogeln!</button>' : ''}`;
      return `<div class="kg-hand" role="group" aria-label="Deine Karten">${hand}</div><div class="kg-acts">${acts}</div>`;
    },
    onClick(t, S) {
      const g = t.dataset.g;
      if (g === 'pick') {
        const c = t.dataset.c;
        if (sel.has(c)) sel.delete(c); else if (sel.size < S.g.maxCards) sel.add(c); else toast(`Höchstens ${S.g.maxCards} Karte${S.g.maxCards === 1 ? '' : 'n'} pro Zug`, true);
        kit.render();
      } else if (g === 'play') { const cards = [...sel]; sel = new Set(); send('play', { cards }); }
      else if (g === 'call') send('call');
    },
    rules: `<p>Das ganze 52er-Blatt wird verteilt. Ziel: als Erster alle Karten loswerden.</p>
      <ul>
        <li>Reihum wird in fester Folge angesagt: <b>Ass, 2, 3 … Dame, König</b>, dann wieder Ass.</li>
        <li>Wer dran ist, legt <b>1 bis 4 Karten verdeckt</b> ab und behauptet, es seien Karten des angesagten Werts. Ob das stimmt, ist egal.</li>
        <li>Jeder andere darf bis zum nächsten Ablegen <b>„Mogeln!“</b> rufen. Dann wird die zuletzt abgelegte Gruppe aufgedeckt.</li>
        <li>War sie nicht ganz wie angesagt, nimmt der <b>Lügner</b> den ganzen Stapel auf. Stimmte die Ansage, bekommt ihn der <b>Zweifler</b>. Wer den Stapel nimmt, fängt an.</li>
        <li>Wer zuerst keine Karten mehr hat und nicht durchschaut wird, gewinnt.</li>
      </ul>`,
  });
}
