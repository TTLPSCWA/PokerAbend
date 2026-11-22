export const unit = 1000n;
export const units = (n) => BigInt(n) * unit;
export const goods = ['ironOre', 'ironIngot', 'gear', 'copperOre', 'copperIngot', 'wire', 'motor', 'quartz', 'silicon', 'chip', 'controlModule'];
export const prices = { ironOre: 1, copperOre: 1, ironIngot: 3, copperIngot: 3, gear: 5, wire: 2, motor: 25, controlModule: 150 };
export const scopes = ['free', 'line', 'pilot', 'rail'];
export const gateScope = [null, null, 'line', 'pilot', 'rail', null];
export const cap = 500_000n;
export const dockRate = 20_000n;
export const tripSeconds = 120;

export const regions = [
  { id: 1, size: 12, dock: [11, 5], credits: 0, parts: {}, phase: 1, fields: [
    { id: 'startA', good: 'ironOre', amount: 250000, phase: 1, areas: [[0, 0, 5, 4], [9, 5, 2, 3]], reserved: { line: 200, pilot: 280, rail: 680 } },
    { id: 'startB', good: 'ironOre', amount: 400000, phase: 2, areas: [[5, 0, 5, 3]], reserved: {} },
    { id: 'startCopper', good: 'copperOre', amount: 300000, phase: 3, research: 'copper', areas: [[0, 8, 5, 4]], reserved: { pilot: 200, rail: 230 } },
  ] },
  { id: 2, size: 24, dock: [23, 11], credits: 1500, parts: { motor: 15 }, phase: 4, fields: [
    { id: 'coast', good: 'copperOre', amount: 1400000, phase: 4, areas: [[0, 0, 6, 5]], reserved: {} },
    { id: 'coastIron', good: 'ironOre', amount: 1100000, phase: 4, areas: [[0, 7, 5, 5]], reserved: {} },
    { id: 'coastDeep', good: 'copperOre', amount: 1300000, phase: 4, research: 'sensors', areas: [[7, 2, 4, 4]], reserved: {} },
  ] },
  { id: 3, size: 24, dock: [23, 11], credits: 4500, parts: { motor: 30 }, phase: 5, fields: [
    { id: 'plateau', good: 'quartz', amount: 1700000, phase: 5, areas: [[0, 0, 6, 5]], reserved: {} },
    { id: 'plateauCopper', good: 'copperOre', amount: 1200000, phase: 5, areas: [[0, 7, 5, 4]], reserved: {} },
    { id: 'plateauIron', good: 'ironOre', amount: 1000000, phase: 5, areas: [[0, 13, 5, 4]], reserved: {} },
  ] },
  { id: 4, size: 24, dock: [23, 11], credits: 9000, parts: { motor: 40, controlModule: 100 }, phase: 5, fields: [
    { id: 'ridge', good: 'ironOre', amount: 2300000, phase: 5, areas: [[0, 0, 7, 6]], reserved: {} },
    { id: 'ridgeCopper', good: 'copperOre', amount: 1600000, phase: 5, areas: [[0, 8, 6, 4]], reserved: {} },
  ] },
];
export const fields = Object.fromEntries(regions.flatMap((r) => r.fields.map((field) => [field.id, { ...field, region: r.id }])));

const machine = (phase, width, height, cost, options = {}) => ({ phase, width, height, cost, ...options });
const recipe = (rate, output, input, batch = 1) => ({ rate, output, input, batch });
export const recipes = {
  ironIngot: recipe(4, 'ironIngot', { ironOre: 2 }),
  copperIngot: recipe(4, 'copperIngot', { copperOre: 2 }),
  gear: recipe(2, 'gear', { ironIngot: 1 }),
  wire: recipe(4, 'wire', { copperIngot: 1 }, 2),
  motor: recipe(1, 'motor', { gear: 1, wire: 2 }),
  silicon: recipe(2, 'silicon', { quartz: 2 }),
  chip: recipe(1, 'chip', { silicon: 1, wire: 2 }),
  controlModule: recipe(0.5, 'controlModule', { motor: 1, chip: 2 }),
};
export const machines = {
  dock: machine(1, 1, 2, 0),
  drill: machine(1, 2, 2, 30, { field: true, rate: 10 }),
  belt: machine(2, 1, 1, 2, { rate: 5 }),
  furnace: machine(2, 2, 2, 45, { recipes: ['ironIngot', 'copperIngot'] }),
  press: machine(2, 1, 2, 35, { recipes: ['gear'] }),
  warehouse: machine(2, 2, 2, 25),
  cable: machine(3, 1, 1, 2),
  generator: machine(3, 3, 3, 120, { generation: 8 }),
  electricDrill: machine(3, 2, 2, 85, { field: true, rate: 20, power: 2 }),
  electricFurnace: machine(3, 2, 2, 120, { recipes: ['ironIngot', 'copperIngot'], rate: 8, power: 4 }),
  wire: machine(3, 1, 2, 50, { recipes: ['wire'], power: 1 }),
  assembly: machine(3, 2, 2, 110, { recipes: ['motor'], power: 3 }),
  lab: machine(3, 2, 2, 90, { power: 1 }),
  splitter: machine(3, 1, 1, 30, { rate: 45 }),
  merger: machine(3, 1, 1, 25, { rate: 45 }),
  station: machine(4, 2, 2, 460, { power: 2 }),
  quartzFurnace: machine(5, 2, 2, 180, { recipes: ['silicon'], power: 4 }),
  chipPlant: machine(5, 2, 2, 230, { recipes: ['chip'], power: 6 }),
  modulePlant: machine(5, 2, 2, 300, { recipes: ['controlModule'], power: 5 }),
  renewable: machine(5, 2, 2, 260, { field: true, rate: 2, power: 6, research: 'renewable' }),
};
export const beltTypes = { 1: { cost: 2, rate: 5, phase: 2 }, 2: { cost: 5, rate: 15, phase: 3, research: 'belt2' }, 3: { cost: 12, rate: 45, phase: 4 } };

export const research = {
  copper: { phase: 3, good: 'gear', amount: 20, cost: 60, scope: 'pilot' },
  grid: { phase: 3, good: 'gear', amount: 20, cost: 80, scope: 'pilot' },
  belt2: { phase: 3, good: 'gear', amount: 10, cost: 90 },
  sensors: { phase: 3, good: 'gear', amount: 10, cost: 75 },
  industry1: { phase: 4, good: 'motor', amount: 10, cost: 300, scope: 'rail' },
  industry2: { phase: 4, good: 'motor', amount: 15, cost: 450, prior: 'industry1', scope: 'rail' },
  industry3: { phase: 4, good: 'motor', amount: 15, cost: 700, prior: 'industry2', scope: 'rail' },
  warehouse: { phase: 4, good: 'motor', amount: 10, cost: 185 },
  renewable: { phase: 5, good: 'chip', amount: 40, cost: 1800, prior: 'grid' },
  blueprint: { phase: 5, good: 'chip', amount: 30, cost: 1400, prior: 'industry3' },
};
export const orders = {
  pilot: { phase: 3, good: 'motor', amount: 100, reward: 2500, region: 1, scope: 'pilot' },
  'F4-01': { phase: 4, good: 'ironIngot', amount: 100, reward: 700, region: 2, scope: 'rail', rail: true },
  'F4-02': { phase: 4, good: 'gear', amount: 120, reward: 1000, region: 2, scope: 'rail', rail: true },
  'F4-03': { phase: 4, good: 'motor', amount: 60, reward: 2200, region: 2, scope: 'rail', rail: true },
  'F5-01': { phase: 5, good: 'controlModule', amount: 1000, reward: 18000, region: 3, scope: 'free' },
  'F5-02': { phase: 5, good: 'wire', amount: 500, reward: 3800, region: 4, scope: 'free', rail: true },
};
export const fundingTargets = { line: 180, pilot: 615, rail: 5300 };
export const trophyLadders = {
  motor: [1000, 10000, 100000, 1000000], modules: [100, 1000, 10000, 100000, 1000000],
  regions: [2, 3, 4], grid: [32, 64, 128, 256], orders: [1, 3, 6],
};
