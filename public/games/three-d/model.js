const cardValue = /^[2-9TJQKA][shdc]$/;
const cardFace = card => typeof card === 'string' && cardValue.test(card) ? card : null;
const chips = count => Number.isSafeInteger(count) && count > 0 ? count : 0;

// A display denomination, independent of the server's integer accounting.
export const CHIP_INKS = ['#32617a','#995553','#287355','#66518a','#c48142','#c7ab65'];

export function chipBreakdown(amount, blind) {
  let remaining = chips(amount);
  const base = chips(blind) || 1;
  return [...new Set([base * 50, base * 20, base * 5, base * 2, base, 1].filter(Number.isSafeInteger))].flatMap((value,kind) => {
    const count = Math.floor(remaining / value);
    remaining -= count * value;
    return count ? [{ value, count, kind }] : [];
  });
}

// A 3D scene receives the viewer's authorized presentation only.
export function pokerPresentation(state) {
  const hand = state.hand;
  const mySeat = state.you?.seat ?? null;
  return {
    room: state.code,
    hand: hand?.no ?? null,
    street: hand?.street ?? null,
    done: !!hand?.done,
    paused: !!(state.paused || state.frozen),
    button: hand?.button ?? null,
    turn: hand?.toAct ?? null,
    mySeat,
    blind: chips(state.blinds?.bb) || 1,
    board: (hand?.board || []).slice(0, 5).map(cardFace),
    seats: state.seats.map((seat, index) => seat ? {
      name: String(seat.name ?? ''), avatar: typeof seat.avatar === 'string' ? seat.avatar : '',
      stack: chips(seat.stack), bet: chips(seat.bet), folded: !!seat.folded, connected: !!seat.connected,
      allIn: !!seat.allIn, sittingOut: !!seat.sittingOut,
      cards: Array.isArray(seat.cards) ? seat.cards.slice(0, 2).map(card => (index === mySeat || hand?.done) ? cardFace(card) : null) : [],
    } : null),
    pots: (hand?.pots || []).map(chips).filter(Boolean),
    winners: (hand?.result?.pots || []).flatMap(pot => (pot.winners || []).filter(Number.isInteger)),
  };
}

export const DIE_FACES = [
  {value:1, normal:[0,1,0], axis:[1,0,0], angle:0},
  {value:6, normal:[0,-1,0], axis:[1,0,0], angle:Math.PI},
  {value:2, normal:[0,0,-1], axis:[1,0,0], angle:Math.PI/2},
  {value:5, normal:[0,0,1], axis:[1,0,0], angle:-Math.PI/2},
  {value:3, normal:[1,0,0], axis:[0,0,1], angle:Math.PI/2},
  {value:4, normal:[-1,0,0], axis:[0,0,1], angle:-Math.PI/2},
];

export function rollChanged(previous, current) {
  return previous && previous.room === current.room && previous.round === current.round &&
    previous.turn === current.turn && current.rolls > previous.rolls;
}
