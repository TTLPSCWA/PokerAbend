import {
  audiences, depth, fit, genres, markets, platforms, sizes,
} from './studio-config.js';

export const coins = (amount) => BigInt(amount) * 100n;
export const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
export const steps = ['concept', 'development', 'qa'];
const second = 1000;
export const leaseWork = 60 * second;
export const researchCap = 500;
export const maxOpenMarkets = 80;
export const archiveKeep = 24;
export const ownPlatform = { phase: 5, market: 100, fee: 0 };
export const platform = (id) => id === 'own' ? ownPlatform : platforms[id];

export function prestigeRate(points) {
  return 1 + 0.4 * (1 - 0.95 ** points);
}

export function terms(data, plan) {
  const people = data.staff.filter(({ team }) => team === plan.team);
  const seats = people.length + Number(plan.team === 1);
  const skills = new Set(people.map(({ role }) => role));
  const contributorSkill = people.reduce((sum, { skill }) => sum + skill, 0) / Math.max(1, people.length);
  const competency = clamp(0.56 + skills.size * 0.045 + (skills.has('qa') ? 0.025 : 0) +
    (contributorSkill ? (contributorSkill - 1) * 0.022 : 0) + (data.research.editor ? 0.016 : 0) +
    (data.research.engine1 ? 0.018 : 0) + (data.research.engine2 ? 0.018 : 0) +
    (data.research.engine3 ? 0.028 : 0), 0.4, 0.96);
  const rate = Math.min(3.6, 1 + 0.58 * (seats - 1)) * prestigeRate(data.prestige.points);
  const qaRate = rate * (skills.has('qa') ? 1.18 : 1);
  const salary = BigInt(seats * 12);
  const size = sizes[plan.size];
  const work = [size.work * 0.2, size.work * 0.6, size.work * depth[plan.depth] / 500];
  const bugLoad = size.work * 0.60 * (1 - competency) * 0.08;
  const qaRemoves = work[2] * 0.14 * competency;
  return {
    work, salary, competency, rate, qaRate, seats,
    bugs: Math.round(bugLoad * 1000), qaClear: Math.round(qaRemoves * 1000),
  };
}

export function rating(plan, competency, remainingBugs) {
  const rest = clamp(remainingBugs / (16 * sizes[plan.size].work), 0, 1);
  const score = 55 + 25 * competency + 20 * (1 - rest) +
    10 * (fit(plan.genre, plan.topic, plan.audience) / 100 - 1);
  return clamp(Math.round(score), 0, 100);
}

export function booking(data, project) {
  const t = terms(data, project.plan);
  const index = steps.indexOf(project.stage);
  const more = project.stage === 'polish';
  const duration = Math.ceil((more ? sizes[project.plan.size].work * 0.24 : t.work[index]) /
    (more || index === 2 ? t.qaRate : t.rate)) * second;
  const extra = index === 0 ? coins(sizes[project.plan.size].tools + platform(project.plan.platform).fee +
    project.plan.marketing * 120) : 0n;
  const wages = BigInt(duration / 1000) * t.salary;
  return { duration, extra, wages, total: extra + wages,
    competency: t.competency, bugs: t.bugs, clear: more ?
      Math.round(sizes[project.plan.size].work * 0.24 * 0.14 * t.competency * 1000) : t.qaClear };
}

export const marketEnd = (market) => Math.min(8_640_000_000_000_000, market.at + market.half * markets.end);

// Every settlement uses a delta of this same cumulative counter (integer units).
export function cumulative(market, at) {
  if (at <= market.at || !market.cap) return 0;
  const age = at - market.at;
  const halves = Math.floor(age / market.half);
  if (halves >= markets.end) return market.cap;
  const remainder = (age % market.half) * 4;
  const quarter = Math.floor(remainder / market.half);
  const offset = BigInt(remainder % market.half), width = BigInt(market.half);
  const tail = BigInt(markets.quarter[quarter]) * (width - offset) + BigInt(markets.quarter[quarter + 1]) * offset;
  const denominator = BigInt(markets.quarter[0]) * width * (1n << BigInt(halves));
  return Number(BigInt(market.cap) * (denominator - tail) / denominator);
}

export const trendAt = (at) => genres[Math.floor(at / (7 * 86_400_000)) % genres.length];

export function marketPotential(data, plan, score, phase, at, franchise) {
  const size = sizes[plan.size];
  const quality = clamp(score / 85, 0.45, 1.18);
  const fanFactor = 1 + Math.min(1, Number(BigInt(data.fanTicks) > 80_000_000n ?
    80_000_000n : BigInt(data.fanTicks)) / 80_000_000);
  const fatigue = data.recentGenres.filter((genre) => genre === plan.genre).length;
  const trend = phase >= 3 && trendAt(at) === plan.genre ? 1.12 : 1;
  const sequel = franchise ? 1.3 * 0.85 ** Math.max(0, franchise.parts - 1) : 1;
  return Math.floor(size.market * platform(plan.platform).market / 100 *
    markets.audience[audiences.indexOf(plan.audience)] / 100 *
    fit(plan.genre, plan.topic, plan.audience) / 100 * quality * (1 + plan.marketing / 40) *
    fanFactor * 0.85 ** fatigue * trend * sequel);
}

export function receipts(data, at) {
  let income = 0n, gameRevenue = 0n, units = 0n, fans = 0n;
  for (const title of data.releases) {
    const sold = BigInt(title.markets.reduce((total, m) => total + cumulative(m, at) - m.sold, 0));
    units += sold;
    fans += sold * BigInt(title.rating);
    gameRevenue += sold * BigInt(title.margin);
  }
  for (const grant of data.licenses) {
    income += BigInt(cumulative(grant.market, at) - grant.market.sold) * BigInt(grant.margin);
  }
  return { income: income + gameRevenue, gameRevenue, units, fans };
}
