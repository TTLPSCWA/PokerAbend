import assert from 'node:assert/strict';

export const second = 1000;
const cell = (type, x, y, rotation = 0, extra = {}) => ({ type, x, y, rotation, ...extra });
const belt = (x, y, direction = 0, level = 1) => cell('belt', x, y, direction, { level });
const store = (x, y, good, rotation = 0) => cell('warehouse', x, y, rotation, { good });
const points = (pairs) => pairs.map(([x, y, direction]) => belt(x, y, direction));

export function operations({ command, view, wait }) {
  let cached;
  const run = async (type, fields = {}) => {
    cached = null;
    return command({ type, ...fields });
  };
  const layout = (region, scope, build) => run('layout', { region, scope, build });
  const board = () => cached ??= Promise.resolve(view()).then(({ data }) => data);
  const node = async (region, x, y) => {
    const row = (await board()).buildings.find((item) => item.region === region && item.x === x && item.y === y);
    assert.ok(row, 'missing building at ' + [region, x, y]);
    return row;
  };
  const id = async (...args) => (await node(...args)).id;
  const remove = async (region, places) => {
    if (places.length) await run('remove', { ids: await Promise.all(places.map(([x, y]) => id(region, x, y))) });
  };
  const move = (region, scope, good, from, to) => run('move', { region, scope, good, from, to });
  const tech = async (region, scope, target, lab, source) => {
    const d = await board(), spec = d.research.find(({ id }) => id === target);
    await run('configure', { id: lab, scope, target });
    if (source) await move(region, scope, spec.good, source, lab);
    await run('research', { id: lab, tech: target });
  };
  async function connectPower(region, scope, receivers, generators) {
    const snapshot = await board(), buildings = snapshot.buildings.filter((row) => row.region === region);
    const size = snapshot.regions.find(({ id }) => id === region).size;
    const occupied = new Set(buildings.filter(({ type }) => type !== 'belt').flatMap(({ tiles }) => tiles.map(([x, y]) => x + ',' + y)));
    const keys = (row) => row.tiles.map(([x, y]) => x + ',' + y);
    const initial = snapshot.power.find(({ members }) => members.includes(generators[0]))?.members ?? generators.slice(0, 1);
    const grid = new Set(buildings.filter(({ id, type }) => initial.includes(id) && ['cable','generator'].includes(type)).flatMap(keys));
    const delta = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    const near = (key) => {
      const [x, y] = key.split(',').map(Number);
      return delta.map(([dx, dy]) => [x + dx, y + dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < size && y < size)
        .map(([x, y]) => x + ',' + y);
    };
    // Bring all requested generator groups onto the same grid with real cable tiles.
    const destinations = [...generators.slice(1), ...receivers].map((id) => buildings.find((row) => row.id === id));
    const wire = [];
    for (const finish of destinations) {
      const goals = new Set(keys(finish).flatMap(near));
      const search = [...grid];
      const previous = new Map(search.map((key) => [key, null]));
      let end;
      for (let i = 0; i < search.length; i++) {
        const key = search[i];
        if (goals.has(key)) { end = key; break; }
        for (const candidate of near(key)) {
          if (!previous.has(candidate) && (!occupied.has(candidate) || grid.has(candidate))) {
            previous.set(candidate, key); search.push(candidate);
          }
        }
      }
      assert.ok(end, 'no cable path to ' + [region, finish.x, finish.y]);
      for (let here = end; !grid.has(here); here = previous.get(here)) {
        occupied.add(here); grid.add(here);
        wire.push(cell('cable', ...here.split(',').map(Number)));
      }
      if (finish.type === 'generator') keys(finish).forEach((key) => grid.add(key));
    }
    if (wire.length) await layout(region, scope, wire);
  }
  return { run, layout, board, node, id, remove, move, tech, connectPower, wait(n) { cached = null; return wait(n * second); } };
}

export async function playFactory(harness) {
  const { run, layout, board, node, id, remove, move, tech, connectPower, wait } = operations(harness);
  const milestone = harness.milestone;
  await milestone(1);
  await layout(1, 'free', [cell('drill', 9, 5)]);
  await wait(2400);
  await milestone(2);
  await remove(1, [[9, 5]]);

  const direct = [[6, 2], [7, 2], [8, 2], [9, 2], [10, 2, 1], [10, 3, 1], [10, 4, 1], [10, 5]];
  await layout(1, 'line', [cell('drill', 1, 2), cell('furnace', 4, 2), belt(3, 2), ...points(direct)]);
  await run('inspect', { id: await id(1, 3, 2) });
  await wait(20);
  assert.equal((await board()).record.ironIngotsDeliveredByBelt, '50');
  await remove(1, [[7, 2]]);
  await layout(1, 'line', [cell('press', 7, 2)]);
  await wait(25);
  await milestone(3);

  await remove(1, (await board()).buildings.filter(({ type }) => type !== 'dock').map(({ x, y }) => [x, y]));
  const iron = [cell('drill', 0, 0), belt(2, 0), cell('furnace', 3, 0), belt(5, 0),
    cell('press', 6, 0), belt(7, 0), store(8, 0, 'gear')];
  await layout(1, 'pilot', [...iron, cell('generator', 4, 4), cell('lab', 2, 5, 0, { good: 'gear' }), store(5, 2, 'gear')]);
  await wait(70);
  const geared = await id(1, 8, 0), lab = await id(1, 2, 5), hopper = await id(1, 5, 2), gen = await id(1, 4, 4);
  assert.equal((await node(1, 8, 0)).inventory, '140000');
  await tech(1, 'pilot', 'copper', lab, geared);
  await tech(1, 'pilot', 'grid', lab, geared);
  await move(1, 'pilot', 'gear', geared, hopper);

  const output = [[11, 2, 1], [11, 3, 1], [11, 4, 2], [10, 4, 1], [10, 5, 0]];
  await layout(1, 'pilot', [
    cell('drill', 0, 8), belt(2, 8), cell('furnace', 3, 8, 0, { good: 'copperIngot' }), belt(5, 8), cell('wire', 6, 8),
    belt(7, 8), store(8, 8, 'wire'), store(7, 4, 'wire', 3), ...points([[7, 3], [8, 3]]),
    belt(7, 2), belt(8, 2), cell('assembly', 9, 2), ...points(output),
  ]);
  await connectPower(1, 'pilot', [await id(1, 6, 8), await id(1, 9, 2)], [gen]);
  const wireStore = await id(1, 8, 8), wireHopper = await id(1, 7, 4);
  await run('accept', { id: 'pilot' });
  await wait(50);
  await move(1, 'pilot', 'wire', wireStore, wireHopper);
  await wait(100);
  assert.equal((await board()).record.motorPilotOrderComplete, true);
  await milestone(4);
  if (harness.stopAfter === 4) return;

  const production = (await board()).buildings.filter((item) => !['dock', 'generator', 'cable'].includes(item.type));
  await run('scope-line', { ids: production.map(({ id }) => id), scope: 'rail' });
  await remove(1, [[10, 5]]);
  await layout(1, 'rail', [...points([[10, 5, 1], [10, 6, 1]]), store(10, 7, 'motor', 1)]);
  await wait(118);
  await move(1, 'rail', 'gear', geared, hopper);
  await move(1, 'rail', 'wire', wireStore, wireHopper);
  await wait(115);
  const motors = await id(1, 10, 7);
  assert.equal((await node(1, 10, 7)).inventory, '115000');
  await run('region', { from: 1 });
  for (const name of ['industry1', 'industry2', 'industry3']) await tech(1, 'rail', name, lab, motors);

  await layout(1, 'rail', [cell('station', 0, 5, 0, { good: 'motor', mode: 'out' })]);
  await layout(2, 'rail', [cell('generator', 15, 9), cell('station', 18, 9, 0, { good: 'motor', mode: 'in' })]);
  const from = await id(1, 0, 5), to = await id(2, 18, 9);
  // The original grid has only 3 MW left. This feeder reuses 2 MW.
  await connectPower(1, 'rail', [from], [gen]);
  await run('track', { source: from, destination: to, wagons: 1, auto: true });
  const consign = async (order, good, source) => {
    await run('configure', { id: from, good });
    await run('configure', { id: to, good });
    await run('accept', { id: order });
    await move(1, 'rail', good, source, from);
    // Automatic dispatch has a physical loading and trip interval.
    assert.equal((await board()).orders.find(({ id }) => id === order).received, '0');
    await wait(239);
    assert.equal((await board()).orders.find(({ id }) => id === order).received, '0');
    await wait(1);
    assert.equal((await board()).orders.find(({ id }) => id === order).received, '50000');
    await wait(720);
    assert.equal((await board()).orders.find(({ id }) => id === order).complete, true);
  };
  await consign('F4-03', 'motor', motors);
  await consign('F4-02', 'gear', hopper);
  await remove(1, [[5, 0], [7, 2], [8, 2], [5, 2]]);
  await layout(1, 'rail', [belt(5, 0, 1), belt(5, 1, 1), store(5, 2, 'ironIngot', 1)]);
  await wait(40);
  await consign('F4-01', 'ironIngot', await id(1, 5, 2));
  await milestone(5);
  if (harness.stopAfter === 5) return;
  await endgame(harness);
}

async function endgame(harness) {
  const { run, layout, board, node, id, remove, move, tech, connectPower, wait } = operations(harness);
  const line = (from, to, y) => Array.from({ length: to - from + 1 }, (_, i) => belt(from + i, y));
  const climb = (x, from, to) => Array.from({ length: from - to + 1 }, (_, i) => belt(x, from - i, 3));
  await remove(1, [[5, 0], [5, 1], [5, 2]]);
  await layout(1, 'free', [belt(5, 0), store(5, 2, 'gear'), belt(7, 2), belt(8, 2)]);
  await wait(250);
  const lab = await id(1, 2, 5), geared = await id(1, 8, 0), copper = await id(1, 8, 8);
  for (const code of ['belt2', 'sensors']) await tech(1, 'free', code, lab, geared);
  await move(1, 'free', 'gear', geared, await id(1, 5, 2));
  await move(1, 'free', 'wire', copper, await id(1, 7, 4));
  await wait(220);
  const motors = await id(1, 10, 7);
  await tech(1, 'free', 'warehouse', lab, motors);
  await run('region', { from: 1 });

  const generation = [15, 18, 21].flatMap((y) => [9, 12, 15, 18].map((x) => cell('generator', x, y)));
  generation.push(cell('generator', 21, 21));
  await layout(3, 'free', [
    ...generation, cell('drill', 0, 0), belt(2, 0), cell('quartzFurnace', 3, 0), ...line(5, 12, 0),
    cell('chipPlant', 13, 0), belt(15, 0, 1), store(15, 1, 'chip', 1), ...line(16, 18, 3),
    cell('drill', 0, 7), belt(2, 7), cell('furnace', 3, 7, 0, { good: 'copperIngot' }), belt(5, 7), cell('wire', 6, 7),
    belt(7, 7), cell('splitter', 8, 7), ...climb(8, 6, 2), ...line(8, 12, 1),
    ...line(9, 10, 7), belt(11, 7, 1), belt(11, 8),
    cell('drill', 0, 13), belt(2, 13), cell('furnace', 3, 13), belt(5, 13), cell('press', 6, 13),
    ...line(7, 9, 13), ...climb(10, 13, 10), ...line(10, 11, 9),
    cell('assembly', 12, 8), belt(14, 8, 3), belt(14, 7), store(15, 6, 'motor'),
    ...climb(17, 6, 5), ...line(17, 18, 4),
    cell('modulePlant', 19, 3), ...points([[21, 3, 1], [21, 4, 1], [21, 5, 1]]), store(20, 6, 'controlModule', 1),
    cell('lab', 19, 0, 0, { good: 'chip' }),
    cell('station', 21, 17, 0, { good: 'copperOre', mode: 'in' }),
  ]);
  const primes = await Promise.all(generation.map(({ x, y }) => id(3, x, y)));
  const modules = await id(3, 19, 3);
  const chipStore = await id(3, 15, 1), lateLab = await id(3, 19, 0);
  const sourcePoints = [[0, 0], [0, 7], [0, 13]];
  const station3 = await id(3, 21, 17);
  const machines = [await id(3, 3, 0), await id(3, 13, 0), await id(3, 6, 7), await id(3, 12, 8), modules, lateLab, station3];
  await connectPower(3, 'free', machines, primes);
  await run('toggle', { id: modules });
  await wait(150);
  assert.ok(BigInt((await node(3, 15, 1)).inventory) >= 70000n);
  await tech(3, 'free', 'renewable', lateLab, chipStore);
  await tech(3, 'free', 'blueprint', lateLab, chipStore);
  await remove(3, sourcePoints);
  await layout(3, 'free', sourcePoints.map(([x, y]) => cell('renewable', x, y)));
  await connectPower(3, 'free', await Promise.all(sourcePoints.map(([x, y]) => id(3, x, y))), [primes[0]]);
  await run('blueprint', { name: 'Kraftwerksmodul', ids: [primes[0]] });
  await run('build-blueprint', { index: 0, region: 3, x: 21, y: 0 });
  await run('toggle', { id: modules });
  await wait(780);
  assert.ok(BigInt((await node(3, 20, 6)).inventory) >= 100000n);
  await run('toggle', { id: modules });
  await wait(200);
  assert.ok(BigInt((await node(3, 15, 6)).inventory) >= 40000n);
  await run('region', { from: 3 });
  await run('toggle', { id: modules });
  await layout(3, 'free', [...points([[21, 8, 1], [21, 9, 1], [21, 10, 1], [21, 11], [22, 11]])]);
  await run('accept', { id: 'F5-01' });

  await layout(2, 'free', [cell('station', 13, 9, 0, { good: 'copperOre', mode: 'out' })]);
  await run('track', { source: await id(2, 13, 9), destination: station3, wagons: 1, auto: false });
  await layout(1, 'free', [cell('station', 0, 2, 0, { good: 'wire', mode: 'out' })]);
  await connectPower(1, 'free', [await id(1, 0, 2)], [await id(1, 4, 4)]);
  await layout(4, 'free', [cell('generator', 15, 9), cell('station', 18, 9, 0, { good: 'wire', mode: 'in' })]);
  await run('toggle', { id: await id(1, 9, 2) });
  const wireTerminal = await id(1, 0, 2);
  await run('track', { source: wireTerminal, destination: await id(4, 18, 9), wagons: 3, auto: false });
  await run('auto-order', { good: 'wire' });
  await move(1, 'free', 'wire', copper, wireTerminal);
  const wireRail = (await board()).tracks.find((row) => row.source === wireTerminal).id;
  await run('dispatch', { id: wireRail });
  await wait(45_000);
  assert.equal((await board()).orders.filter(({ complete }) => complete).length, 6);
  await harness.milestone(5, true);
}
