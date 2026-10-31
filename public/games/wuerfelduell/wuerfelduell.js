'use strict';
{
  const tx = (de, en) => I18n.language === 'en' ? en : de;
  const name = (S, id) => esc(S.players.find((p) => p.id === id)?.name || '?');
  kitGame({
    id: 'wuerfelduell', name: 'Würfelduell', direction: false, ring: false,
    get short() { return [tx('Gegner wählen: Angriffswürfel treffen bei 4–6, Verteidigung blockt bei 5–6.', 'Choose an opponent: attack dice hit on 4–6, defence dice block on 5–6.'), tx('Jeder ungeblockte Treffer kostet ein Leben. Ohne Leben scheidest du aus.', 'Each unblocked hit costs one health. Zero health eliminates you.'), tx('Nach jeweils zehn Angriffen steigt der Zusatzschaden um eins. Wer zuletzt lebt, gewinnt.', 'Every ten attacks, bonus damage increases by one. The last survivor wins.')]; },
    get rules() { return `<p>${tx('Zwei bis vier Spieler beginnen mit gleich vielen Lebenspunkten und derselben Würfelzahl. Wer am Zug ist, wählt einen lebenden Gegner. Der Server würfelt beide Würfe gleichzeitig.', 'Two to four players start with equal health and the same number of dice. On your turn, choose a surviving opponent. The server rolls both sets of dice simultaneously.')}</p><p>${tx('Angriff: 4, 5 und 6 zählen als Treffer. Verteidigung: 5 und 6 zählen als Schild. Schaden = maximal 0 oder Treffer minus Schilde, danach der sichtbare Druckbonus. Nach je zehn Angriffen steigt dieser Bonus um eins. Ausgeschiedene werden übersprungen. Ein Zeitlimit lässt automatisch einen schwachen Gegner angreifen.', 'Attack: 4, 5 and 6 are hits. Defence: 5 and 6 are shields. Damage is hits minus shields, at least zero, plus the visible pressure bonus. This bonus increases by one every ten attacks. Eliminated players are skipped. On timeout, a weak opponent is attacked automatically.')}</p>`; },
    playerInfo(p) { return p.health === null ? '' : `${p.health} ♥`; },
    hint(S, mine) { return mine ? tx('Wähle unten einen Gegner. Beide Würfe werden auf dem Server ausgeführt.', 'Choose an opponent below. Both rolls are made by the server.') : tx('Der aktive Spieler wählt einen Gegner.', 'The active player is choosing an opponent.'); },
    main(S) {
      const g = S.g, last = g.last;
      return `<section class="wd-table"><div class="wd-health">${S.players.filter((p) => p.inRound).map((p) => `<article class="${g.health[p.id] <= 0 ? 'out' : ''}"><b>${esc(p.name)}</b><meter min="0" max="${S.settings.health}" value="${g.health[p.id]}">${g.health[p.id]}</meter><strong>${g.health[p.id]} ♥</strong></article>`).join('')}</div><p>${tx('Druckbonus', 'Pressure bonus')}: +${g.pressure} · ${tx('Angriffe', 'Attacks')}: ${g.attacks}</p>${last ? `<div class="wd-battle"><h3>${name(S, last.attacker)} → ${name(S, last.target)}</h3><div><span>${tx('Angriff', 'Attack')} (${last.hits})</span><div class="wd-dice">${last.attack.map((n) => dieHTML(n, { cls: n >= 4 ? 'wd-hit' : '' })).join('')}</div></div><div><span>${tx('Verteidigung', 'Defence')} (${last.shields})</span><div class="wd-dice">${last.defence.map((n) => dieHTML(n, { cls: n >= 5 ? 'wd-shield' : '' })).join('')}</div></div><strong class="wd-damage">−${last.damage} ♥</strong></div>` : `<p>${tx('Das erste Duell steht bevor.', 'The first duel is about to begin.')}</p>`}</section>`;
    },
    dock(S) { return `<div class="kg-acts">${S.g.targets.map((id) => `<button class="btn btn-brass" data-g="wd-attack" data-target="${id}">${tx('Angreifen', 'Attack')}: ${name(S, id)} (${S.g.health[id]} ♥)</button>`).join('')}</div>`; },
    onClick(el) { if (el.dataset.g === 'wd-attack') send('duelAttack', { target: el.dataset.target }); },
  });
}
