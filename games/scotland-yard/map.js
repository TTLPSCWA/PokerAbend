// Eigener schematischer Stadtplan. Keine Koordinaten oder Routen des Originalplans.
export const MODES = ['taxi', 'bus', 'underground'];
const nodes = Array.from({ length: 49 }, (_, i) => ({ id: i + 1, x: 65 + (i % 7) * 108 + (Math.floor(i / 7) % 2) * 10, y: 55 + Math.floor(i / 7) * 80 }));
const edges = [];
const link = (a, b, mode) => { if (!edges.some((e) => e.a === Math.min(a, b) && e.b === Math.max(a, b) && e.mode === mode)) edges.push({ a: Math.min(a, b), b: Math.max(a, b), mode }); };
for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
  const id = r * 7 + c + 1;
  if (c < 6) link(id, id + 1, 'taxi');
  if (r < 6) link(id, id + 7, 'taxi');
  if (r % 2 === 0 && c < 5) link(id, id + 2, 'bus');
  if (c % 2 === 0 && r < 5) link(id, id + 14, 'bus');
}
for (const [a, b] of [[1, 19], [7, 19], [19, 25], [25, 31], [25, 35], [31, 43], [35, 49], [7, 35], [1, 31], [19, 35], [31, 49]]) link(a, b, 'underground');
for (const [a, b] of [[15, 25], [25, 41], [15, 41]]) link(a, b, 'ferry');
export const CITY = { width: 800, height: 590, nodes, edges };
export const neighbours = (at, ticket) => [...new Set(edges.filter((e) => (ticket === 'black' || e.mode === ticket) && (e.a === at || e.b === at)).map((e) => e.a === at ? e.b : e.a))];
const distanceCache = new Map();
export function distances(from) {
  if (distanceCache.has(from)) return new Map(distanceCache.get(from));
  const found = new Map([[from, 0]]), queue = [from];
  for (const node of queue) for (const next of neighbours(node, 'black')) if (!found.has(next)) { found.set(next, found.get(node) + 1); queue.push(next); }
  distanceCache.set(from, found);
  return new Map(found);
}
