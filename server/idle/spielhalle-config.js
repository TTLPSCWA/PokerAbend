// D00 rules with the D04.1 starting parameters. Missing operating prices
// are kept here as separate, adjustable playtest parameters.
export const PROFILES = {
  altstadt: ['0.05', '0.32'], hafen: ['0.19', '0.02'], kurort: ['0.11', '0.13'],
  messe: ['0.25', '0.07'], bahnhof: ['0.3', '0.035'],
};
export const ROLES = {
  croupier: { capacity: '0.38', wage: '0.11', cost: 360, phase: 3 },
  service: { capacity: '0.08', wage: '0.038', cost: 110, phase: 2 },
  security: { capacity: '0.6', wage: '0.12', cost: 700, phase: 4 },
};
export const STATIONS = Object.fromEntries([
  ['cards',       1, 2, '0.08',  8, '1',    '0',     80, '1',    '0',    []],
  ['dice',        2, 2, '0.23', 13, '3',    '0.05', 170, '1.25', '0',    ['service']],
  ['chess',       2, 2, '0.15',  2, '0.25', '0.015',120, '0.85', '0',    []],
  ['poker',       3, 3, '0.4',  65, '8',    '0.45',1000, '1.5',  '1.45', ['croupier']],
  ['arcade',      3, 1, '0.25', 24, '5',    '0.15', 550, '1.6',  '0',    ['service']],
  ['blackjack',   3, 3, '0.25', 60, '12',   '0.4', 1500, '0.9',  '1.4',  ['croupier']],
  ['boardGames',  3, 6, '0.2',  17, '2',    '0.08', 420, '1',    '0',    []],
  ['roulette',    4, 5, '0.3',  85, '16',   '0.55',2800, '0.3',  '1.6',  ['croupier', 'security']],
  ['vipLounge',   4, 8, '0.25', 95, '22',   '0.8', 4200, '0',    '2',    ['service', 'security']],
].map(([id, phase, area, capacity, value, variable, upkeep, cost, regular, vip, roles]) =>
  [id, { phase, area, capacity, value, variable, upkeep, cost, regular, vip, roles }]));
export const ROOM_AREA = [8, 12, 20, 40, 20];
export const ROOM_PHASE = [1, 2, 3, 4, 4];
export const ROOM_COST = [0, 600, 1400, 4500, 9000];
export const RESEARCH = {
  automation: ['staffScheduling', 'marketingPlanning', 'branchManagement', 'controlCenter'],
  visitors: ['windowDisplay', 'loyaltyCard', 'themeEvents', 'groupBooking'],
  personnel: ['training', 'croupierTraining', 'securityTraining', 'vipService'],
};
export const RESEARCH_COST = [3, 6, 9, 12];
export const EVENTS = {
  theme: { phase: 4, cost: 1500, duration: 1_800_000, cooldown: 7_200_000 },
  tournament: { phase: 3, cost: 1100, duration: 1_200_000, cooldown: 14_400_000 },
  group: { phase: 5, cost: 1800, duration: 3_600_000, cooldown: 21_600_000 },
};
export const PRICES = { value: ['0.6', '0.8', '1', '1.25', '1.5'], weight: ['1.3', '1.15', '1', '0.8', '0.6'] };
export const REPUTATION = [0, 1000, 10000, 100000, 1000000];
export const REPUTATION_DEMAND = ['1', '1.04', '1.1', '1.18', '1.25'];
export const MARKETING_RATE = '0.25';
export const COMFORT_COST = 150;
export const LOCATION_COST = 18000;
