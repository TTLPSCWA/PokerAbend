// Domain-neutral milestones for three separate rule modules. A fact must be
// derived by the game module from authoritative state, never supplied by a player.
const gamePhases = {
  spielhalle: [
    { id: 'SH-P1', enter: [], unlocks: ['card-table', 'manual-card-round', 'auto-dealer', 'room-1'], automations: ['A1'],
      automationGates: { A1: [['autoDealerOwned', true]] },
      resources: ['coins', 'servedGuests'], bottleneck: 'manual-service' },
    { id: 'SH-P2', enter: [['autoDealerOwned', true], ['servedGuests', '100']],
      unlocks: ['dice-bar', 'chess-station', 'service', 'price-tiers', 'room-2', 'research'], automations: ['A2'],
      automationGates: { A2: [['staffSchedulingResearched', true]] },
      resources: ['coins', 'knowHow'], bottleneck: 'staffing' },
    { id: 'SH-P3', enter: [['activeStationTypes', '3'], ['runRevenue', '25000'], ['firstBottleneckResolved', true]],
      unlocks: ['poker-table', 'croupier', 'room-3', 'board-game-hall', 'slot-machines'], automations: ['A3'],
      automationGates: { A3: [['marketingPlanningResearched', true]] },
      resources: ['coins', 'casinoRevenue', 'reputation'], bottleneck: 'casino-capacity' },
    { id: 'SH-P4', enter: [['casinoRevenue', '250000'], ['reputationTier', '3']],
      unlocks: ['floor-2', 'roulette', 'security', 'vip-lounge', 'vip-segment', 'second-location'], automations: [],
      resources: ['coins', 'knowHow', 'reputation'], bottleneck: 'location-operation' },
    { id: 'SH-P5', enter: [['operatingLocations', '2'], ['branchManagementResearched', true]],
      unlocks: ['locations-3-to-5', 'group-bookings', 'renown-prestige'], automations: ['A4', 'A5'],
      automationGates: { A5: [['controlCenterResearched', true]] },
      resources: ['coins', 'reputation', 'renown'], bottleneck: 'location-network',
      complete: [['locations', '5'], ['stationTypesAtOneLocation', '9'], ['allLocationsReputation5', true],
        ['servedGuests', '1000000'], ['floor3Complete', true], ['allResearch', true]] },
  ],
  studio: [
    { id: 'GS-P1', enter: [], unlocks: ['solo-developer', 'mini', 'small', 'starter-combinations', 'home-pc', 'contract-work'],
      automations: ['G-A1'],
      resources: ['budget', 'fans'], bottleneck: 'development-capacity' },
    { id: 'GS-P2', enter: [['releases', '2'], ['fans', '30']],
      unlocks: ['code-role', 'art-role', 'qa-role', 'three-employees', 'templates', 'research', 'medium',
        'four-genres-and-themes', 'queue'],
      automations: ['G-A2', 'G-A3', 'G-A4'],
      automationGates: {
        'G-A2': [['buildPipelineResearched', true]],
        'G-A3': [['projectTemplatesResearched', true]],
        'G-A4': [['releaseRulesResearched', true]],
      },
      resources: ['budget', 'researchPoints'], bottleneck: 'qa-and-budget' },
    { id: 'GS-P3', enter: [['bestReleaseRating', '80'], ['marketingIResearched', true]],
      unlocks: ['marketing-role', 'marketing-budget', 'audiences', 'trends', 'platforms-2-to-3', 'all-genres-and-themes',
        'large', 'research-team', 'six-employees'],
      automations: [], resources: ['budget', 'fans', 'researchPoints'], bottleneck: 'release-demand' },
    { id: 'GS-P4', enter: [['runSalesRevenue', '2000000'], ['employees', '6']],
      unlocks: ['two-teams', 'parallel-projects', 'publisher-contracts', 'own-brand', 'second-studio', 'epic', 'sequels'],
      automations: ['G-A5'], automationGates: { 'G-A5': [['publisherOfficeResearched', true]] },
      resources: ['budget', 'researchPoints'], bottleneck: 'parallel-project-budget' },
    { id: 'GS-P5', enter: [['engineIIIResearched', true], ['studiosWithReleases', '2']],
      unlocks: ['engine-licenses', 'own-platform', 'franchises', 'studios-3-to-4', 'industry-prestige'],
      automations: [], resources: ['budget', 'fans', 'industryPrestige'], bottleneck: 'portfolio-capacity',
      complete: [['studios', '4'], ['bestReleaseRating', '99'], ['longestFranchise', '5'],
        ['allGenresRated80', true], ['engineLicenses', '10'], ['runSales', '10000000']] },
  ],
  factory: [
    { id: 'FE-P1', enter: [], unlocks: ['starting-region', 'iron-field-a', 'emergency-mining', 'dock', 'mechanical-drill', 'manual-mining'],
      automations: [], resources: ['credits', 'ironOre'], bottleneck: 'manual-material' },
    { id: 'FE-P2', enter: [['ironOreSold', '100']],
      unlocks: ['belt-mk1', 'furnace', 'warehouse', 'press', 'iron-field-b', 'belt-diagnostic'], automations: ['FE-A1'],
      resources: ['credits', 'ironOre', 'ironIngot', 'gear'], bottleneck: 'belt-throughput' },
    { id: 'FE-P3', enter: [['ironIngotsDeliveredByBelt', '50'], ['gearsDeliveredByBelt', '50'], ['beltBottleneckShown', true]],
      unlocks: ['generator', 'electric-machines', 'splitter', 'merger', 'lab', 'inspector', 'motor-pilot-order'],
      automations: ['FE-A2', 'FE-A3'], resources: ['credits', 'copperOre', 'gear', 'motor'], bottleneck: 'power-and-pilot-supply' },
    { id: 'FE-P4', enter: [['motorPilotOrderComplete', true], ['powerGridIResearched', true]],
      unlocks: ['region-2', 'station', 'rail', 'contract-board', 'belt-mk3'], automations: ['FE-A4'],
      resources: ['credits', 'motor'], bottleneck: 'interregional-transport' },
    { id: 'FE-P5', enter: [['interregionalOrders', '3'], ['industrialPlanningIIIResearched', true]],
      unlocks: ['regions-3-to-4', 'quartz-chain', 'control-modules', 'blueprints', 'renewable-extraction', 'industry-patents'],
      automations: ['FE-A5'], resources: ['credits', 'quartz', 'controlModule', 'industryPatents'], bottleneck: 'network-throughput',
      complete: [['connectedRegions', '4'], ['runControlModules', '10000'], ['largestPowerGridMW', '100'],
        ['allOrders', true], ['renewableHalfOfOre', true], ['allResearch', true]] },
  ],
};

export const IDLE_GAME_IDS = Object.freeze(Object.keys(gamePhases));

export function phasesFor(gameId) {
  if (!Object.hasOwn(gamePhases, gameId)) throw new RangeError('Unknown idle game');
  return structuredClone(gamePhases[gameId]);
}
