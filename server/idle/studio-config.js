// The confirmed progression lives in public/idle/progression.js.
export const genres = ['adventure', 'puzzle', 'building', 'action', 'strategy', 'sport'];
export const topics = ['fantasy', 'space', 'pirates', 'detective', 'animals', 'cooking', 'future', 'medieval'];
export const audiences = ['casual', 'core', 'family'];
export const roles = ['code', 'art', 'qa', 'marketing', 'research'];
export const starters = [
  ['puzzle', 'animals'], ['adventure', 'fantasy'], ['puzzle', 'cooking'],
];
export const sizes = {
  mini: {
    work: 100,
    market: 200,
    half: 1800,
    margin: 12,
    tools: 40,
    phase: 1
  },
  small: {
    work: 1650,
    market: 1650,
    half: 7200,
    margin: 14,
    tools: 190,
    phase: 1
  },
  medium: {
    work: 14800,
    market: 11200,
    half: 43200,
    margin: 20,
    tools: 750,
    phase: 2
  },
  large: {
    work: 72000,
    market: 33000,
    half: 172800,
    margin: 25,
    tools: 4500,
    phase: 3
  },
  epic: {
    work: 230400,
    market: 95000,
    half: 604800,
    margin: 38,
    tools: 17500,
    phase: 4
  }
};
export const platforms = {
  pc: {
    phase: 1,
    fee: 0,
    market: 100
  },
  browser: {
    phase: 3,
    fee: 90,
    market: 108
  },
  handheld: {
    phase: 3,
    fee: 150,
    market: 92
  },
  console: {
    phase: 4,
    fee: 850,
    market: 122
  },
  phone: {
    phase: 4,
    fee: 650,
    market: 120
  }
};

// D04.1: 0 = weak, 1 = neutral, 2 = strong. Rows follow the genre, topic and audience catalogues.
const affinity = [
  [[2, 1, 1, 1, 2, 2, 0, 1], [2, 1, 2, 2, 2, 1, 1, 1], [1, 1, 2, 0, 1, 2, 2, 2], [1, 2, 2, 1, 0, 0, 2, 1], [2, 2, 1, 1, 0, 0, 2, 2], [0, 1, 1, 0, 1, 2, 1, 1]],
  [[2, 2, 1, 2, 0, 0, 2, 2], [1, 1, 0, 2, 1, 1, 2, 1], [1, 2, 1, 0, 1, 0, 2, 2], [2, 2, 2, 1, 0, 0, 2, 2], [2, 2, 2, 1, 0, 0, 2, 2], [0, 0, 0, 0, 1, 1, 1, 1]],
  [[2, 1, 2, 1, 2, 2, 1, 1], [1, 1, 1, 2, 2, 2, 1, 1], [1, 1, 2, 0, 2, 2, 2, 1], [1, 1, 2, 0, 0, 0, 1, 1], [1, 1, 0, 1, 0, 1, 1, 2], [0, 0, 1, 0, 2, 2, 1, 0]]
];
export const fit = (genre, topic, audience) =>
  [70, 100, 120][affinity[audiences.indexOf(audience)][genres.indexOf(genre)][topics.indexOf(topic)]];
export const depth = { rush: 0, normal: 100, thorough: 165 };
export const markets = { audience: [100, 85, 92], quarter: [1000000, 840896, 707107, 594604, 500000], end: 24 };

export const research = {
  editor: [2, 2, 200], pipeline: [2, 3, 300, 'editor'], templates: [2, 3, 320],
  releaseRules: [2, 4, 420, 'templates'], marketing1: [2, 3, 360],
  measurement: [3, 6, 780, 'marketing1'], campaigns: [3, 8, 1250, 'measurement'],
  browser: [3, 3, 350, 'editor'], handheld: [3, 5, 600, 'browser'],
  console: [4, 10, 2250, 'handheld'], phone: [4, 12, 2600, 'console'],
  engine1: [3, 20, 5000, 'editor'], engine2: [4, 30, 7500, 'engine1'],
  engine3: [4, 45, 10000, 'engine2'], publisherOffice: [4, 15, 3500, 'releaseRules'],
  distribution: [5, 16, 15000, 'engine3'],
};
export const studioCosts = [0, 18000, 72000, 160000];
export const publishers = [
  { id: 'elm', advance: 9000, genre: 'adventure', size: 'epic', rating: 80 },
  { id: 'prism', advance: 5200, genre: 'puzzle', size: 'large', rating: 82 },
  { id: 'orbit', advance: 7200, genre: 'strategy', size: 'large', rating: 84 },
];
export const licensees = [
  'quartz', 'ember', 'tide', 'meadow', 'comet', 'fjord', 'lumen', 'sable', 'cedar', 'mica',
];
export const trophies = {
  hit: [1, 5, 25, 50, 100, 250, 500, 1000],
  sales: [100000, 1000000, 10000000, 100000000, 1000000000],
  franchise: [3, 5],
  licenses: [5, 10],
};
