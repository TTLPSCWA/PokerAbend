import { create, MACHINE_IDS, MACHINES, MAX_BALANCE, restore, serialize } from './slots-logic.js';
import * as saves from './storage.js';

export const ID = 'slot-arcade';
export const HISTORY_LIMIT = 12;
const isInteger = (value, max) => Number.isSafeInteger(value) && value >= 0 && value <= max;

export function newArcade(nextSeed) {
  return {
    selected: MACHINE_IDS[0],
    volume: 0,
    quiet: false,
    machines: Object.fromEntries(MACHINE_IDS.map(id => [id, create({ machine: id, seed: nextSeed() })])),
    histories: Object.fromEntries(MACHINE_IDS.map(id => [id, []])),
  };
}

export function recordSpin(arcade, result) {
  const brief = {
    id: result.id,
    bet: result.bet,
    total: result.total,
    free: result.free.length,
    stops: [...result.stops],
  };
  const history = arcade.histories[result.machine];
  history.unshift(brief);
  history.length = Math.min(history.length, HISTORY_LIMIT);
}

export function writeArcade(storage, arcade) {
  return saves.save(storage, ID, {
    selected: arcade.selected,
    volume: arcade.volume,
    quiet: arcade.quiet,
    machines: Object.fromEntries(MACHINE_IDS.map(id => [id, serialize(arcade.machines[id])])),
    histories: arcade.histories,
  });
}

export function readArcade(storage) {
  return saves.load(storage, ID, value => {
    if (!value || !MACHINE_IDS.includes(value.selected) || !isInteger(value.volume, 100) ||
        typeof value.quiet !== 'boolean' || !value.machines || !value.histories) return null;

    const machines = {};
    const histories = {};
    for (const id of MACHINE_IDS) {
      const machine = MACHINES[id];
      const restored = restore(value.machines[id]);
      const history = value.histories[id];
      if (restored?.machine !== id || !Array.isArray(history) || history.length > HISTORY_LIMIT) return null;
      let previousSpin = restored.spins + 1;
      for (const entry of history) {
        if (!entry || !isInteger(entry.id, previousSpin - 1) || entry.id < 1 ||
            !machine.bets.includes(entry.bet) || !isInteger(entry.total, MAX_BALANCE) ||
            !isInteger(entry.free, 16) || !Array.isArray(entry.stops) ||
            entry.stops.length !== machine.reels ||
            entry.stops.some((stop, index) => !isInteger(stop, machine.strips[index].length - 1))) return null;
        previousSpin = entry.id;
      }
      machines[id] = restored;
      histories[id] = history.map(({id, bet, total, free, stops}) => ({id, bet, total, free, stops}));
    }
    return {selected: value.selected, volume: value.volume, quiet: value.quiet, machines, histories};
  });
}
