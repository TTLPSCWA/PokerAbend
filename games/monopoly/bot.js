import { BOARD, PROPERTIES, group } from './room.js';
function value(room, id, field) {
  const f = BOARD[field];
  if (!f.color) return f.price * (f.type === 'rail' ? 1.3 : 1);
  const members = group(field), count = members.filter((i) => room.owned[i].owner === id).length;
  return f.price * (1 + count / members.length * .7 + (count === members.length - 1 ? 1.3 : count === members.length ? 2 : 0)) - (room.owned[field].mortgage ? f.price / 2 : 0);
}
export function botMove(room, id) {
  if (room.debt) return room.onTimeout(id);
  if (room.auction) {
    const a = room.auction, max = Math.min(Math.floor(value(room, id, a.field)), room.people[id].money - 120);
    return a.bid + 10 <= max ? room.bid(id, Math.max(1, a.bid + 10)) : room.passAuction(id);
  }
  if (room.trade) {
    const t = room.trade, incoming = t.give.money + t.give.properties.reduce((s, i) => s + value(room, id, i), 0) + t.give.free * 35;
    const outgoing = t.take.money + t.take.properties.reduce((s, i) => s + value(room, id, i), 0) + t.take.free * 35;
    const fee = t.give.properties.reduce((s, i) => s + (room.owned[i].mortgage ? Math.ceil(BOARD[i].price / 20) : 0), 0);
    return room.respondTrade(id, incoming >= outgoing + fee && room.people[id].money + t.give.money - t.take.money >= fee);
  }
  const p = room.people[id];
  if (room.step === 'buy') return room.buy(id, p.money >= BOARD[p.position].price + 70);
  if (room.step === 'jail') {
    if (p.free.length) return room.leaveJail(id, 'card');
    if (p.money > 250) return room.leaveJail(id, 'pay');
    return room.throwDice(id);
  }
  const actions = room.possible(id);
  const build = actions.filter((a) => a.build && p.money > BOARD[a.field].build + 250).sort((a, b) => BOARD[b.field].rents[room.owned[b.field].level + 1] / BOARD[b.field].build - BOARD[a.field].rents[room.owned[a.field].level + 1] / BOARD[a.field].build)[0];
  if (build) return room.manage(id, build.field, 'build');
  const unmortgage = actions.find((a) => a.unmortgage && p.money > BOARD[a.field].price * .55 + 250);
  if (unmortgage) return room.manage(id, unmortgage.field, 'unmortgage');
  if (room.traded[id] !== room.turnNo) {
    room.traded[id] = room.turnNo;
    const wanted = PROPERTIES.filter((i) => BOARD[i].color && room.owned[i].owner && room.owned[i].owner !== id && !room.owned[i].mortgage && group(i).some((j) => room.owned[j].owner === id) && !group(i).some((j) => room.owned[j].level));
    wanted.sort((a, b) => group(b).filter((j) => room.owned[j].owner === id).length - group(a).filter((j) => room.owned[j].owner === id).length);
    const field = wanted.find((i) => p.money > BOARD[i].price * 3 + 250);
    if (field !== undefined) return room.proposeTrade(id, room.owned[field].owner, { money: BOARD[field].price * 3 }, { properties: [field] });
  }
  return room.step === 'roll' ? room.throwDice(id) : room.endTurn(id);
}
