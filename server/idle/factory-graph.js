import { beltTypes, fields, machines, recipes, regions } from './factory-config.js';

const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const pointKey = (x, y) => x + ',' + y;
const cell = (region, x, y) => region + ':' + pointKey(x, y);
const edgeKey = (src, target) => src + '>' + target;

export function footprint(building) {
  const { width, height } = machines[building.type];
  const [w, h] = building.rotation % 2 ? [height, width] : [width, height];
  return Array.from({ length: w * h }, (_, i) => [building.x + i % w, building.y + Math.floor(i / w)]);
}

function oriented(node, port) {
  const { width, height } = machines[node.type];
  const [x, y, side] = port;
  const positions = [[x, y], [height - 1 - y, x], [width - 1 - x, height - 1 - y], [y, width - 1 - x]];
  const [rx, ry] = positions[node.rotation];
  return { x: node.x + rx, y: node.y + ry, side: (side + node.rotation) % 4 };
}

function ports(node) {
  const model = machines[node.type];
  const left = Array.from({ length: model.height }, (_, y) => [0, y, 2]);
  const right = [[model.width - 1, 0, 0]];
  let input = left, output = right;
  switch (node.type) {
    case 'cable': case 'generator': input = []; output = []; break;
    case 'dock': case 'lab': output = []; break;
    case 'belt': input = [[0, 0, 2], [0, 0, 3], [0, 0, 1]]; break;
    case 'station': if (node.mode === 'out') output = []; else input = []; break;
    case 'splitter': output = [[0, 0, 0], [0, 0, 1], [0, 0, 3]]; break;
    case 'merger': input = [[0, 0, 2], [0, 0, 3], [0, 0, 1]]; break;
    default: if (model.field) input = [];
  }
  return { input: input.map((port) => oriented(node, port)), output: output.map((port) => oriented(node, port)) };
}

export function occupancy(buildings) {
  const cells = new Map();
  for (const node of buildings) {
    const region = regions[node.region - 1];
    for (const [x, y] of footprint(node)) {
      const key = cell(node.region, x, y);
      if (x < 0 || y < 0 || x >= region.size || y >= region.size) return null;
      const at = cells.get(key) ?? {};
      // Overhead cables can cross conveyors. Buildings still occupy the full plot.
      if (node.type === 'cable') {
        if (at.wire || at.type && at.type !== 'belt') return null;
        at.wire = node.id;
      } else {
        if (at.node || (at.wire && node.type !== 'belt')) return null;
        at.node = node.id; at.type = node.type;
      }
      cells.set(key, at);
    }
  }
  return cells;
}

export function fieldAt(building) {
  const tiles = footprint(building);
  return Object.values(fields).find((field) => field.region === building.region && field.areas.some(([x, y, w, h]) =>
    tiles.every(([tx, ty]) => tx >= x && tx < x + w && ty >= y && ty < y + h)));
}

const flowActive = (node) => node.enabled;

export function materialGraph(buildings, includeStopped = false) {
  const nodes = new Map(buildings.map((node) => [node.id, node]));
  const output = new Map(), input = new Map(), graphPorts = new Map(), portIndex = new Map();
  for (const node of buildings) {
    output.set(node.id, []); input.set(node.id, []);
    const list = ports(node);
    graphPorts.set(node.id, list);
    if (includeStopped || flowActive(node)) {
      for (const [slot, port] of list.input.entries()) portIndex.set(cell(node.region, port.x, port.y) + ':' + port.side, { id: node.id, slot });
    }
  }
  for (const node of buildings) {
    if (!includeStopped && !flowActive(node)) continue;
    for (const [slot, port] of graphPorts.get(node.id).output.entries()) {
      const [dx, dy] = directions[port.side];
      const next = portIndex.get(cell(node.region, port.x + dx, port.y + dy) + ':' + ((port.side + 2) % 4));
      if (!next || next.id === node.id) continue;
      const edge = { src: node.id, to: next.id, slot, input: next.slot, key: edgeKey(node.id, next.id) + ':' + slot };
      output.get(node.id).push(edge);
      input.get(next.id).push(edge);
    }
  }
  for (const incoming of input.values()) incoming.sort((a, b) => a.input - b.input || a.src - b.src);
  const remaining = new Map([...input].map(([id, edges]) => [id, edges.length]));
  const ready = buildings.filter((node) => remaining.get(node.id) === 0).map(({ id }) => id);
  for (let i = 0; i < ready.length; i++) {
    for (const edge of output.get(ready[i])) {
      const count = remaining.get(edge.to) - 1;
      remaining.set(edge.to, count);
      if (!count) ready.push(edge.to);
    }
  }
  return { nodes, input, output, cyclic: ready.length !== buildings.length };
}

// A cable or generator can relay electricity. Machines attach to one adjoining grid.
export function powerGrid(buildings) {
  const used = occupancy(buildings);
  const nodes = new Map(buildings.map((node) => [node.id, node]));
  const grids = [], served = new Set(), associated = new Map();
  const carrier = (node) => node?.enabled && ['generator', 'cable'].includes(node.type);
  const adjacent = (node) => [...new Set(footprint(node).flatMap(([x, y]) =>
    directions.flatMap(([dx, dy]) => {
      const at = used.get(cell(node.region, x + dx, y + dy));
      return at ? [at.node, at.wire] : [];
    })))]
    .map((id) => nodes.get(id)).filter((other) => other && other.id !== node.id);
  for (const node of buildings) {
    if (!carrier(node) || associated.has(node.id)) continue;
    const index = grids.length, connected = [node], grid = { id: node.id, region: node.region, supply: 0, used: 0, demand: 0, members: [] };
    associated.set(node.id, index);
    for (let i = 0; i < connected.length; i++) {
      const member = connected[i];
      grid.supply += machines[member.type].generation ?? 0;
      grid.members.push(member.id);
      for (const neighbor of adjacent(member)) {
        if (!carrier(neighbor) || associated.has(neighbor.id)) continue;
        associated.set(neighbor.id, index);
        connected.push(neighbor);
      }
    }
    grids.push(grid);
  }
  const loads = buildings.filter((node) => node.enabled && machines[node.type].power)
    .sort((a, b) => Number(b.critical) - Number(a.critical) || a.id - b.id);
  for (const node of loads) {
    const neighbors = adjacent(node).filter(carrier).map(({ id }) => associated.get(id));
    if (!neighbors.length) continue;
    const grid = grids[Math.min(...neighbors)], needed = machines[node.type].power;
    grid.members.push(node.id);
    grid.demand += needed;
    if (grid.supply - grid.used < needed) continue;
    grid.used += needed;
    served.add(node.id);
  }
  return { served, grids };
}

export function rate(node, data) {
  const model = machines[node.type];
  const base = node.type === 'belt' ? beltTypes[node.level].rate : model.rate ?? recipes[node.good]?.rate ?? 0;
  return BigInt(Math.floor(base * 1000 * (1 + 0.3 * (1 - 0.95 ** data.prestige.points))));
}
