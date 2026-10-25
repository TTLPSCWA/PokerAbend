// Spielmodul Texas Hold'em. Die Plattform (server/index.js) kennt nur diese Beschreibung:
// Name und Felder für die Startseite, wie ein Raum entsteht oder geladen wird, und welche Ereignisse das Spiel versteht.
import { Room } from './room.js';

const str = (v, max = 40) => String(v ?? '').slice(0, max);

export default {
  id: 'poker',
  name: "Texas Hold'em",
  description: 'No Limit mit Spielgeld: Blinds, Side Pots, steigende Blinds, Abendstand.',
  category: 'karten', // Karten, Würfel oder Brett – gruppiert die Startseite
  players: '2–9 Spieler',
  // Felder beim Hosten (alles andere stellt der Host am Tisch ein)
  createFields: [
    { key: 'startStack', label: 'Startchips', type: 'number', min: 100, step: 100, value: 10000 },
    { key: 'smallBlind', label: 'Small Blind', type: 'number', min: 1, value: 50 },
    { key: 'bigBlind', label: 'Big Blind', type: 'number', min: 2, value: 100 },
  ],
  createHint: 'Alles andere stellst du am Tisch unter „Host“ ein.',

  create: (code, settings, onChange) => new Room(code, settings, onChange),
  restore: (data, onChange) => Room.restore(data, onChange),

  // Ereignisse vom Browser: (room, player, payload). Fehler gehen als Antwort zurück, danach bekommen alle den neuen Stand.
  events: {
    sit: (room, p, { seat }) => room.sit(p.id, Number(seat)),
    stand: (room, p) => room.stand(p.id),
    sitOut: (room, p, { value }) => room.setSittingOut(p.id, !!value),
    rebuy: (room, p) => room.rebuy(p.id),
    show: (room, p) => room.show(p.id),
    action: (room, p, a) => { room.act(p.id, { type: str(a.type, 20), amount: a.amount, id: str(a.id) || undefined }); },
    preAction: (room, p, { type }) => room.setPreAction(p.id, type ?? null),
    nudge: (room, p, { id }) => room.nudge(p.id, str(id)),
    gift: (room, p, { id, amount, message }) => { room.offerGift(p.id, str(id), amount, message); },
    giftAnswer: (room, p, { id, accept }) => { room.answerGift(p.id, str(id), !!accept); },
    // Host
    start: (room, p) => room.start(p.id),
    pause: (room, p) => room.togglePause(p.id),
    freeze: (room, p) => room.toggleFreeze(p.id),
    nextHand: (room, p) => room.nextHand(p.id),
    newGame: (room, p) => room.newGame(p.id),
    settings: (room, p, s) => room.updateSettings(p.id, s),
    adjust: (room, p, { id, amount }) => room.adjustStack(p.id, id, amount),
  },
};
