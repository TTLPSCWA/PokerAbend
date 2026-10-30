import { TurnRoom } from '../../server/turn-room.js';
import { shuffle } from '../../server/random.js';
import { CARDS, COLORS, DECK, complete, rent } from '../../public/games/monopoly-deal/cards.js';
export { CARDS, COLORS, DECK, complete, rent };

export class Room extends TurnRoom {
  static OPTIONS = [
    { key: 'turnTime', label: 'Sekunden pro Aktion (0 = ohne)', type: 'number', min: 0, max: 180 },
    { key: 'responseTime', label: 'Sekunden für Widerspruch oder Zahlung', type: 'number', min: 5, max: 60 },
  ];
  defaultSettings() { return { turnTime: 60, responseTime: 15 }; }
  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 2, maxPlayers: 5, scoreLabel: 'Siege', winPoints: 1 });
    this.hands = {}; this.bank = {}; this.sets = {}; this.deck = []; this.discard = []; this.pending = null; this.groupSeq = 0;
  }
  setupRound() {
    this.deck = shuffle([...DECK]); this.discard = []; this.groupSeq = 0; this.pending = null; this.step = 'play';
    for (const id of this.order) { this.hands[id] = []; this.bank[id] = []; this.sets[id] = []; this.draw(id, 5); }
  }
  get actor() { return this.order[this.turn]; }
  get currentId() { return this.phase !== 'playing' ? null : this.pending ? this.pending.responder : this.actor; }
  draw(id, count) {
    for (let i = 0; i < count; i++) {
      if (!this.deck.length) { this.deck = shuffle(this.discard); this.discard = []; }
      if (!this.deck.length) break;
      this.hands[id].push(this.deck.pop());
    }
  }
  onTurnStart() { this.actions = 0; this.step = 'play'; this.draw(this.actor, this.hands[this.actor].length ? 2 : 5); this.act(this.actor, 'zieht neue Karten'); }
  requirePlay(id) { this.requireTurn(id); if (this.pending || this.step !== 'play' || this.actions >= 3) throw new Error('Erst die offene Aktion abschließen'); }
  ownCard(id, card) { if (!CARDS[card] || !this.hands[id]?.includes(card)) throw new Error('Diese Handkarte hast du nicht'); return CARDS[card]; }
  removeHand(id, card) { this.hands[id].splice(this.hands[id].indexOf(card), 1); }
  group(id, group) { const g = this.sets[id]?.find((s) => s.id === group); if (!g) throw new Error('Satz nicht gefunden'); return g; }
  locate(id, card) { return this.sets[id]?.find((g) => g.cards.includes(card)); }
  target(id, target) { if (target === id || !this.order.includes(target)) throw new Error('Wähle einen anderen Mitspieler'); }
  destination(id, color, group) {
    if (!COLORS[color]) throw new Error('Farbe nicht erlaubt');
    const g = group ? this.group(id, group) : this.sets[id].find((s) => s.color === color && s.cards.length < COLORS[color].size);
    if (g && (g.color !== color || g.cards.length >= COLORS[color].size)) throw new Error('Dieser Satz ist voll oder hat eine andere Farbe');
    return g || null;
  }
  put(id, card, color, group = null) {
    let g = this.destination(id, color, group);
    if (!g) { g = { id: 'set' + ++this.groupSeq, color, cards: [], house: null, hotel: null }; this.sets[id].push(g); }
    g.cards.push(card); return g;
  }
  removeProperty(id, card) {
    const g = this.locate(id, card); if (!g) throw new Error('Grundstück nicht gefunden');
    g.cards.splice(g.cards.indexOf(card), 1);
    // Gebäude bleiben bei Einzelzahlungen als Bankwerte beim bisherigen Besitzer.
    if (!complete(g)) { if (g.house) this.bank[id].push(g.house); if (g.hotel) this.bank[id].push(g.hotel); g.house = null; g.hotel = null; }
    this.sets[id] = this.sets[id].filter((s) => s.cards.length); return g.color;
  }
  bankCard(id, card) {
    this.requirePlay(id); const c = this.ownCard(id, card);
    if (c.kind === 'property') throw new Error('Grundstücke gehören in die Auslage');
    this.removeHand(id, card); this.bank[id].push(card); this.actions++; this.act(id, `legt ${c.value} M auf die Bank`); this.afterAction();
  }
  property(id, card, color, group = null) {
    this.requirePlay(id); const c = this.ownCard(id, card);
    if (c.kind !== 'property' || !c.colors.includes(color)) throw new Error('Diese Grundstücksfarbe ist nicht erlaubt');
    this.destination(id, color, group);
    this.removeHand(id, card); this.put(id, card, color, group); this.actions++; this.act(id, `legt ${c.name} (${COLORS[color].name})`); this.afterAction();
  }
  recolor(id, card, color, group = null) {
    this.requireTurn(id); if (this.pending) throw new Error('Erst die offene Forderung abschließen');
    const c = CARDS[card], from = this.locate(id, card);
    if (!from || c.colors.length < 2 || !c.colors.includes(color)) throw new Error('Diesen Joker kannst du nicht so umlegen');
    if (from.id === group) throw new Error('Der Joker liegt schon dort');
    this.destination(id, color, group);
    this.removeProperty(id, card); this.put(id, card, color, group); this.act(id, `ordnet einen Joker zu ${COLORS[color].name}`); this.checkWin(id);
  }
  play(id, card, args = {}) {
    this.requirePlay(id); const c = this.ownCard(id, card);
    if (!['action', 'rent'].includes(c.kind) || ['no', 'double'].includes(c.action)) throw new Error('Diese Karte wirkt nur als Reaktion oder zusammen mit Miete');
    let pending = null, boosts = [];
    if (c.kind === 'rent') {
      const g = this.group(id, args.group);
      if (!c.colors.includes(g.color) || rent(g) <= 0) throw new Error('Dafür kannst du keine Miete verlangen');
      boosts = Array.isArray(args.boosts) ? args.boosts : [];
      if (new Set(boosts).size !== boosts.length || boosts.some((b) => this.ownCard(id, b).action !== 'double') || this.actions + 1 + boosts.length > 3) throw new Error('Die Mietverdopplung passt nicht in deine drei Aktionen');
      if (c.colors.length === 10) this.target(id, args.target);
      const targets = c.colors.length === 10 ? [args.target] : this.order.filter((p) => p !== id);
      pending = { kind: 'payment', actor: id, targets, amount: rent(g) * 2 ** boosts.length };
    } else if (c.action === 'debt' || c.action === 'birthday') {
      if (c.action === 'debt') this.target(id, args.target);
      pending = { kind: 'payment', actor: id, targets: c.action === 'debt' ? [args.target] : this.order.filter((p) => p !== id), amount: c.action === 'debt' ? 5 : 2 };
    } else if (['sly', 'forced', 'breaker'].includes(c.action)) {
      this.target(id, args.target);
      if (c.action === 'breaker') {
        const g = this.group(args.target, args.group); if (!complete(g)) throw new Error('Deal Breaker braucht einen vollen Satz');
        pending = { kind: 'breaker', actor: id, targets: [args.target], group: g.id };
      } else {
        const g = this.locate(args.target, args.take); if (!g || complete(g)) throw new Error('Ein voller Satz ist gegen Einzeltausch geschützt');
        if (c.action === 'forced') { const give = this.locate(id, args.give); if (!give || complete(give)) throw new Error('Tausche aus einem unfertigen eigenen Satz'); }
        pending = { kind: c.action, actor: id, targets: [args.target], take: args.take, give: c.action === 'forced' ? args.give : null };
      }
    } else if (c.action === 'house' || c.action === 'hotel') {
      const g = this.group(id, args.group);
      if (!complete(g) || ['rail', 'utility'].includes(g.color) || g[c.action] || c.action === 'hotel' && !g.house) throw new Error('Gebäude brauchen einen passenden vollen Straßensatz; ein Hotel braucht ein Haus');
    }
    this.removeHand(id, card); this.actions += 1 + boosts.length;
    if (c.action === 'house' || c.action === 'hotel') this.group(id, args.group)[c.action] = card;
    else this.discard.push(card);
    for (const b of boosts) { this.removeHand(id, b); this.discard.push(b); }
    this.act(id, `spielt ${c.name}${boosts.length ? ` (${boosts.length}× verdoppelt)` : ''}`);
    if (c.action === 'go') this.draw(id, 2);
    if (pending) { this.pending = { ...pending, index: 0, stage: 'react', blocked: false, chain: [] }; this.nextTarget(); }
    else this.afterAction();
  }
  nextTarget() {
    const p = this.pending;
    while (p.index < p.targets.length && !this.order.includes(p.targets[p.index])) p.index++;
    if (p.index >= p.targets.length) { this.pending = null; return this.afterAction(); }
    p.target = p.targets[p.index]; p.responder = p.target; p.stage = 'react'; p.blocked = false; p.chain = []; this.moveNo++;
  }
  respond(id, useNo = false) {
    this.requireTurn(id); const p = this.pending;
    if (!p || p.stage !== 'react') throw new Error('Gerade gibt es keinen Widerspruch');
    if (useNo) {
      const card = this.hands[id].find((c) => CARDS[c].action === 'no'); if (!card) throw new Error('Du hast kein Just Say No');
      this.removeHand(id, card); this.discard.push(card); p.chain.push({ id, card }); p.blocked = !p.blocked;
      p.responder = id === p.target ? p.actor : p.target; this.act(id, 'Just Say No!'); return;
    }
    if (p.blocked) { this.act(p.target, 'wehrt die Aktion ab'); p.index++; return this.nextTarget(); }
    if (p.kind === 'payment') { p.stage = 'pay'; p.responder = p.target; this.moveNo++; if (!this.assets(p.target).length) this.pay(p.target, []); }
    else {
      if (p.kind === 'breaker') { const g = this.group(p.target, p.group); this.sets[p.target] = this.sets[p.target].filter((s) => s !== g); this.sets[p.actor].push(g); }
      else {
        const color = this.removeProperty(p.target, p.take); this.put(p.actor, p.take, color);
        if (p.kind === 'forced') { const own = this.removeProperty(p.actor, p.give); this.put(p.target, p.give, own); }
      }
      this.act(p.actor, 'übernimmt Grundstücke');
      if (this.checkWin(p.actor)) return; p.index++; this.nextTarget();
    }
  }
  assets(id) {
    return [...(this.bank[id] || []).map((card) => ({ card, kind: 'bank', value: CARDS[card].value })), ...(this.sets[id] || []).flatMap((g) => [
      ...g.cards.map((card) => ({ card, kind: 'property', color: g.color, value: CARDS[card].value })),
      ...[g.house, g.hotel].filter(Boolean).map((card) => ({ card, kind: 'building', value: CARDS[card].value })),
    ])].filter((a) => a.value > 0);
  }
  pay(id, selected) {
    this.requireTurn(id); const p = this.pending;
    if (!p || p.stage !== 'pay' || !Array.isArray(selected) || new Set(selected).size !== selected.length) throw new Error('Wähle deine Zahlungskarten');
    const assets = this.assets(id), chosen = selected.map((card) => assets.find((a) => a.card === card));
    if (chosen.some((a) => !a)) throw new Error('Nur eigene Bank und ausgelegte Werte bezahlen');
    const value = chosen.reduce((s, a) => s + a.value, 0);
    if (value < p.amount && selected.length !== assets.length) throw new Error('Zahle den Betrag oder alle verfügbaren Werte');
    // Gebäude zuerst, damit eine Grundstücksentnahme sie nicht vorher zur Bank verschiebt.
    for (const a of [...chosen].sort((a, b) => (a.kind === 'property') - (b.kind === 'property'))) {
      if (a.kind === 'bank') { this.bank[id].splice(this.bank[id].indexOf(a.card), 1); this.bank[p.actor].push(a.card); }
      else if (a.kind === 'building') {
        const g = this.sets[id].find((g) => g.house === a.card || g.hotel === a.card);
        if (g.house === a.card) { g.house = null; if (g.hotel && !selected.includes(g.hotel)) { this.bank[id].push(g.hotel); g.hotel = null; } }
        else g.hotel = null;
        this.bank[p.actor].push(a.card);
      }
      else { const color = this.removeProperty(id, a.card); this.put(p.actor, a.card, color); }
    }
    this.say(`${this.name(id)} zahlt ${value} M an ${this.name(p.actor)}${value > p.amount ? ' – ohne Wechselgeld' : value < p.amount ? ' – mehr ist nicht vorhanden' : ''}`, 'bet');
    this.act(id, `zahlt ${value} M`);
    if (this.checkWin(p.actor)) return; p.index++; this.nextTarget();
  }
  checkWin(id) {
    const colors = new Set(this.sets[id]?.filter(complete).map((g) => g.color));
    const target = this.variant === 'quick' ? 2 : 3;
    if (colors.size < target) return false;
    this.pending = null; this.finishRound([id], `${this.name(id)} hat ${target} vollständige Farbgruppen`, { [id]: 1 }); return true;
  }
  afterAction() {
    if (this.phase !== 'playing' || this.pending || this.checkWin(this.actor)) return;
    if (this.actions >= 3) { this.step = this.hands[this.actor].length > 7 ? 'discard' : 'finish'; this.moveNo++; }
  }
  endTurn(id, discard = []) {
    this.requireTurn(id); if (this.pending) throw new Error('Erst die offene Forderung abschließen');
    const excess = Math.max(0, this.hands[id].length - 7);
    if (!Array.isArray(discard) || new Set(discard).size !== discard.length || discard.some((c) => !this.hands[id].includes(c)) || discard.length && discard.length !== excess) throw new Error('Wähle genau die überzähligen Handkarten');
    if (excess && !discard.length) { this.step = 'discard'; this.moveNo++; return; }
    for (const c of discard) { this.removeHand(id, c); this.discard.push(c); }
    this.next();
  }
  syncTimer() {
    const secs = this.pending ? this.settings.responseTime : this.settings.turnTime;
    const key = this.phase === 'playing' && secs > 0 ? `${this.roundNo}:${this.currentId}:${this.moveNo}` : null;
    if (key === this.timerKey) return;
    this.clock.clearTimeout(this.turnTimer); this.timerKey = key; this.turnTimer = null; this.deadline = null;
    if (!key) return;
    this.deadline = this.clock.now() + secs * 1000;
    this.turnTimer = this.clock.setTimeout(() => { if (this.timerKey !== key) return; this.onTimeout(this.currentId); this.syncTimer(); this.onChange('state'); }, secs * 1000); this.turnTimer.unref?.();
  }
  onTimeout(id) {
    if (this.pending?.stage === 'react') return this.respond(id, false);
    if (this.pending?.stage === 'pay') return this.pay(id, paymentCards(this, id));
    return this.endTurn(id, this.hands[id].slice(0, Math.max(0, this.hands[id].length - 7)));
  }
  dropOut(p, message) {
    if (!this.order.includes(p.id)) return;
    const wasActor = this.actor === p.id, index = this.order.indexOf(p.id);
    if (message) this.say(message);
    this.discard.push(...this.hands[p.id], ...this.bank[p.id], ...this.sets[p.id].flatMap((g) => [...g.cards, ...[g.house, g.hotel].filter(Boolean)]));
    delete this.hands[p.id]; delete this.bank[p.id]; delete this.sets[p.id]; this.order.splice(index, 1);
    if (index < this.turn) this.turn--; if (this.turn >= this.order.length) this.turn = 0;
    if (this.order.length < 2) { this.pending = null; return this.finishRound([...this.order], 'Nur noch ein Spieler übrig', this.order.length ? { [this.order[0]]: 1 } : {}); }
    if (wasActor) { this.pending = null; this.onTurnStart(); }
    else if (this.pending?.target === p.id) { this.pending.index++; this.nextTarget(); }
    this.moveNo++;
  }
  onAbort() { this.dispose(); this.pending = null; }
  publicPlayer(p) { return { cards: this.hands[p.id]?.length || 0, money: (this.bank[p.id] || []).reduce((s, c) => s + CARDS[c].value, 0), full: new Set(this.sets[p.id]?.filter(complete).map((g) => g.color)).size }; }
  gameView(id) {
    return { hand: this.hands[id]?.slice() || null, bank: structuredClone(this.bank), sets: structuredClone(this.sets), deck: this.deck.length,
      discard: this.discard.slice(-1), actions: this.actions, actor: this.actor, step: this.step, pending: this.pending ? structuredClone(this.pending) : null,
      assets: this.assets(id), totals: Object.fromEntries(this.order.map((p) => [p, this.publicPlayer(this.players.get(p))])) };
  }
  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}

export function paymentCards(room, id) {
  const assets = room.assets(id).sort((a, b) => (a.kind !== 'bank') - (b.kind !== 'bank') || a.value - b.value);
  let sum = 0; const cards = [];
  for (const a of assets) { if (sum >= room.pending.amount) break; cards.push(a.card); sum += a.value; } return cards;
}

export function botMove(room, id) {
  const g = room.gameView(id), hand = g.hand;
  if (room.pending) {
    if (room.pending.stage === 'pay') return room.pay(id, paymentCards(room, id));
    const p = room.pending, use = p.blocked ? id === p.actor && ['breaker', 'sly', 'forced'].includes(p.kind) : id === p.target && (p.kind !== 'payment' || p.amount >= 3);
    return room.respond(id, use && hand.some((c) => CARDS[c].action === 'no'));
  }
  if (room.step === 'discard') return room.endTurn(id, [...hand].sort((a, b) => (CARDS[a].kind === 'property') - (CARDS[b].kind === 'property') || CARDS[a].value - CARDS[b].value).slice(0, hand.length - 7));
  const groups = room.sets[id];
  // Bereits ausgelegte Joker schließen zuerst passende, noch fehlende Farbgruppen.
  for (const target of groups.filter((g) => g.cards.length === COLORS[g.color].size - 1 && !groups.some((s) => s.color === g.color && complete(s)))) {
    for (const from of groups.filter((g) => g !== target && !complete(g))) {
      const wild = from.cards.find((c) => CARDS[c].colors.length > 1 && CARDS[c].colors.includes(target.color));
      if (wild && [...target.cards, wild].some((c) => CARDS[c].colors.length < 10)) return room.recolor(id, wild, target.color, target.id);
    }
  }
  if (room.actions >= 3) return room.endTurn(id);
  const props = hand.filter((c) => CARDS[c].kind === 'property').flatMap((card) => CARDS[card].colors.map((color) => {
    const g = groups.find((g) => g.color === color && !complete(g) && g.cards.length < COLORS[color].size);
    const done = groups.some((g) => g.color === color && complete(g));
    return { card, color, value: (g ? (g.cards.length + 1) / COLORS[color].size * 10 : 2 / COLORS[color].size) - (done ? 8 : 0) };
  })).sort((a, b) => b.value - a.value);
  if (props.length) return room.property(id, props[0].card, props[0].color);
  const enemies = room.order.filter((p) => p !== id);
  for (const card of hand) {
    const c = CARDS[card];
    if (c.action === 'breaker') { const p = enemies.find((p) => room.sets[p].some(complete)); if (p) return room.play(id, card, { target: p, group: room.sets[p].find(complete).id }); }
    if (c.action === 'sly' || c.action === 'forced') {
      const take = enemies.flatMap((target) => room.sets[target].filter((g) => !complete(g)).flatMap((g) => g.cards.map((c) => ({ target, card: c, color: g.color })))).sort((a, b) => Number(groups.some((g) => g.color === b.color && !complete(g))) - Number(groups.some((g) => g.color === a.color && !complete(g))));
      const give = groups.find((g) => !complete(g))?.cards[0];
      if (take.length && (c.action !== 'forced' || give)) return room.play(id, card, { target: take[0].target, take: take[0].card, give });
    }
    if (c.kind === 'rent') { const group = [...groups].filter((g) => c.colors.includes(g.color) && rent(g)).sort((a, b) => rent(b) - rent(a))[0]; if (group) return room.play(id, card, { group: group.id, target: enemies[0], boosts: hand.filter((h) => CARDS[h].action === 'double').slice(0, 2 - room.actions) }); }
    if (['go', 'debt', 'birthday'].includes(c.action)) return room.play(id, card, { target: enemies[0] });
    if (['house', 'hotel'].includes(c.action)) { const group = groups.find((g) => complete(g) && !['rail', 'utility'].includes(g.color) && !g[c.action] && (c.action !== 'hotel' || g.house)); if (group) return room.play(id, card, { group: group.id }); }
  }
  const cash = hand.filter((c) => CARDS[c].kind === 'money' || CARDS[c].kind !== 'property' && CARDS[c].action !== 'no').sort((a, b) => CARDS[b].value - CARDS[a].value)[0];
  if (cash) return room.bankCard(id, cash);
  return room.endTurn(id);
}
