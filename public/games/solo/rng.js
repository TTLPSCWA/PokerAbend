// Gemeinsamer Zufall für die Solo-Partyspiele (Bauart B): Server und Browser erzeugen aus demselben Seed dieselbe Folge.
// Dieselbe Datei wird vom Server (games/solo-room.js) und vom Browser (import('/games/solo/rng.js')) geladen.
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  const next = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = (n) => Math.floor(next() * n);          // 0 … n−1
  next.pick = (list) => list[next.int(list.length)];
  return next;
}
