import { Room } from './room.js';
import { SpeedRoom } from './speed.js';
import { JuniorRoom } from './junior.js';
import { turnGame } from '../../server/turn-game.js';
import { cityBoard } from '../art-kit.js';
export default turnGame(Room, {
  id: 'monopoly', name: 'Monopoly', category: 'brett', minPlayers: 2, maxPlayers: 8, duration: 90, players: '2–8 Spieler',
  variantRooms: { speed: SpeedRoom, junior: JuniorRoom },
  description: 'Spieleabend-Stadt: Grundstücke kaufen, handeln, bebauen und Mieten kassieren.', art: cityBoard(), createFields: [],
  events: {
    token: (r, p, { token }) => r.chooseToken(p.id, token),
    juniorSelect: (r, p, { field }) => { if (!r.juniorSelect) throw new Error('Keine Junior-Auswahl offen'); return r.juniorSelect(p.id, Number(field)); },
    speedSelect: (r, p, { value }) => { if (!r.speedSelect) throw new Error('Keine Tempowürfel-Auswahl offen'); return r.speedSelect(p.id, Number(value)); },
    roll: (r, p) => r.throwDice(p.id), buy: (r, p, { yes }) => r.buy(p.id, yes === true), bid: (r, p, { amount }) => r.bid(p.id, Number(amount)),
    auctionPass: (r, p) => r.passAuction(p.id), manage: (r, p, { field, action }) => r.manage(p.id, Number(field), action),
    jail: (r, p, { method }) => r.leaveJail(p.id, method), endTurn: (r, p) => r.endTurn(p.id), bankrupt: (r, p) => r.bankrupt(p.id),
    trade: (r, p, { target, give, take }) => r.proposeTrade(p.id, target, give, take), tradeReply: (r, p, { accept }) => r.respondTrade(p.id, accept === true),
    boardChoose: (r, p, { board }) => r.chooseBoard(p.id, board), boardSave: (r, p, input) => { const board = r.saveBoard(p.id, input); return { reply: { board } }; },
  },
});
