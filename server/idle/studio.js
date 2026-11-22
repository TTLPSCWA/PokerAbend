import { createIdleEngine, quantity, requireIdle, timestamp } from '../../public/idle/engine.js';
import { phasesFor } from '../../public/idle/progression.js';
import {
  audiences, depth, fit, genres, licensees, platforms, publishers, research, roles, sizes, starters, studioCosts, topics, trophies,
} from './studio-config.js';
import {
  archiveKeep, booking, coins, cumulative, leaseWork, marketEnd, marketPotential, maxOpenMarkets,
  platform, prestigeRate, rating, receipts, researchCap, steps, trendAt,
} from './studio-economy.js';

const pointsBySize = { mini: 1, small: 4, medium: 7, large: 12, epic: 18 };
const moneyKeys = ['budget', 'spent', 'salesRevenue', 'licenseRevenue', 'advances', 'runSales', 'fanTicks'];
const phaseNumber = (id) => Number(id.slice(-1));
const known = (table, key) => typeof key === 'string' && Object.hasOwn(table, key);
const integer = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;
const plainTitle = (value) => typeof value === 'string' && value.length > 0 && value.length <= 48 &&
  !/[\p{C}<>]/u.test(value);
const credit = (data, key, value) => { data[key] = (quantity(data[key]) + value).toString(); };
const paid = (data, value) => {
  requireIdle(quantity(data.budget) >= value, 'studio-budget');
  credit(data, 'budget', -value);
  credit(data, 'spent', value);
};
const nextAt = (now, ms) => timestamp(now + ms);

function create(prestige = { points: 0, claimed: [] }) {
  return {
    budget: coins(800).toString(), spent: '0', salesRevenue: '0', licenseRevenue: '0', advances: '0',
    runSales: '0', fanTicks: '0', researchPoints: 0, reputation: 0, numReleases: 0, hits: 0,
    best: 0, bestGenres: {}, studiosWithReleases: [], studios: [1], staff: [],
    teams: [{ id: 1, studio: 1 }], research: prestige.points >= 15 ? { editor: true } : {},
    projects: [], queue: [], releases: [], recentGenres: [], franchises: [], licenses: [],
    contracts: [], order: null, lab: null, nextProject: 1, nextStaff: 1, prestige,
  };
}

const validTime = (value) => integer(value, 0, 8_640_000_000_000_000);
const validMarket = (m) => m && validTime(m.at) &&
  integer(m.half, 1, 604800000) && integer(m.cap, 0, 2_000_000) && integer(m.sold, 0, m.cap);
const validPlan = (plan) => plan && plainTitle(plan.name) && known(sizes, plan.size) && known(depth, plan.depth) &&
  genres.includes(plan.genre) && topics.includes(plan.topic) && audiences.includes(plan.audience) &&
  (plan.platform === 'own' || known(platforms, plan.platform)) && integer(plan.team, 1, 4) &&
  integer(plan.marketing, 0, 20) && integer(plan.limit, 1, 1_000_000_000) &&
  integer(plan.autoScore, 0, 100) && integer(plan.qaLimit, 0, 1_000_000_000) &&
  integer(plan.ref, 0, Number.MAX_SAFE_INTEGER) && ['title', 'sequel', 'patch'].includes(plan.kind) &&
  typeof plan.contract === 'string' && (plan.contract === '' || publishers.some(({ id }) => id === plan.contract));

function validate(data) {
  if (!data || !moneyKeys.every((key) => quantity(data[key]) >= 0n)) return false;
  const lists = [data.studios, data.teams, data.staff, data.projects, data.queue, data.releases, data.licenses,
    data.franchises, data.contracts, data.studiosWithReleases, data.recentGenres, data.prestige?.claimed];
  if (!lists.every(Array.isArray)) return false;
  const unique = (rows, key) => new Set(rows.map(key)).size === rows.length;
  return data.studios.length >= 1 && data.studios.length <= 4 && unique(data.studios, (id) => id) &&
    data.studios.every((id, index) => id === index + 1) && data.teams.length >= 1 &&
    data.teams.length <= 4 && unique(data.teams, (t) => t.id) &&
    data.teams.every((t) => integer(t.id, 1, 4) && data.studios.includes(t.studio)) &&
    data.staff.length <= 24 && unique(data.staff, (s) => s.id) &&
    data.staff.every((s) => data.teams.some((t) => t.id === s.team) && roles.includes(s.role) && integer(s.skill, 1, 3)) &&
    data.projects.length <= data.teams.length && unique(data.projects, (row) => row.plan.team) &&
    data.projects.every((p) => validPlan(p.plan) && team(data, p.plan.team) && [...steps, 'polish', 'gate'].includes(p.stage) &&
      (quantity(p.spent) >= 0n) && (!p.slot || (quantity(p.slot.total) >= quantity(p.slot.tools) &&
        quantity(p.slot.tools) >= 0n && integer(p.slot.start, 0, p.slot.end) &&
        integer(p.slot.end, p.slot.start, 8_640_000_000_000_000)))) &&
    data.queue.length <= data.teams.length && data.queue.every((p) => validPlan(p.plan) && team(data, p.plan.team)) &&
    data.releases.length <= maxOpenMarkets + 2 * archiveKeep &&
    data.releases.every((row) => plainTitle(row.name) && integer(row.rating, 0, 100) &&
      integer(row.margin, 0, 10000) && row.markets.length <= 2 && row.markets.every(validMarket)) &&
    data.franchises.length <= archiveKeep && data.contracts.length <= publishers.length &&
    data.licenses.length <= licensees.length && unique(data.licenses, (l) => l.id) &&
    data.licenses.every((row) => licensees.includes(row.id) && validMarket(row.market)) &&
    (!data.order || validTime(data.order.end)) &&
    (!data.lab || (team(data, data.lab.team) && validTime(data.lab.end) && quantity(data.lab.cost) === coins(216))) &&
    integer(data.researchPoints, 0, researchCap) && Object.entries(data.research).every(([id, met]) => known(research, id) && met === true) &&
    integer(data.prestige.points, 0, 100) && data.prestige.claimed.length === data.prestige.points &&
    unique(data.prestige.claimed, (id) => id) &&
    data.prestige.claimed.every((key) => Object.entries(trophies).some(([type, ladder]) => ladder.some((n) => key === type + '-' + n)));
}

const fans = (data) => quantity(data.fanTicks) / 800n;
const team = (data, id) => data.teams.find((row) => row.id === id);
const occupants = (data, id) => data.staff.filter((row) => row.team === id);
const staffLimit = (phase) => [0, 3, 6, 12, 24][phase - 1];
const teamLimit = (phase) => phase < 4 ? 1 : phase < 5 ? 2 : 4;
const score = (data, id) => data.releases.find((row) => row.id === id);
const contract = (data, id) => data.contracts.find((row) => row.id === id);
const franchise = (data, title) => data.franchises.find((row) => row.id === (title.franchise || title.id));
const titleOpen = (row) => row.markets.some((market) => market.sold < market.cap);
const portfolioFull = (data) => data.releases.filter(titleOpen).length >= maxOpenMarkets;

function facts(data) {
  return {
    releases: String(data.numReleases), fans: String(fans(data)), bestReleaseRating: String(data.best),
    marketingIResearched: Boolean(data.research.marketing1), runSalesRevenue: String(quantity(data.salesRevenue) / 100n),
    employees: String(data.staff.length), engineIIIResearched: Boolean(data.research.engine3),
    studiosWithReleases: String(data.studiosWithReleases.length), studios: String(data.studios.length),
    longestFranchise: String(longest(data)), allGenresRated80: genres.every((g) => data.bestGenres[g] >= 80),
    engineLicenses: String(data.licenses.length), runSales: data.runSales,
    buildPipelineResearched: Boolean(data.research.pipeline), projectTemplatesResearched: Boolean(data.research.templates),
    releaseRulesResearched: Boolean(data.research.releaseRules), publisherOfficeResearched: Boolean(data.research.publisherOffice),
  };
}

const longest = (data) => Math.max(Number(data.numReleases > 0), ...data.franchises.map((f) => f.parts));
function claims(data, phase) {
  if (phase < 5) return [];
  const counts = { hit: BigInt(data.hits), sales: quantity(data.runSales),
    franchise: BigInt(longest(data)), licenses: BigInt(data.licenses.length) };
  return Object.entries(trophies).flatMap(([type, ladder]) => ladder
    .filter((n) => counts[type] >= BigInt(n)).map((n) => type + '-' + n))
    .filter((id) => !data.prestige.claimed.includes(id));
}

function allowedPair(data, phase, genre, topic) {
  if (phase === 1) return starters.slice(0, data.prestige.points >= 5 ? 3 : 2).some(([g, t]) => g === genre && t === topic);
  if (phase === 2) {
    return genres.slice(0, 4).includes(genre) &&
      (['fantasy', 'animals', 'space', 'pirates'].includes(topic) ||
        data.prestige.points >= 5 && genre === 'puzzle' && topic === 'cooking');
  }
  return genres.includes(genre) && topics.includes(topic);
}

const activeProject = (data, id) => data.projects.find((p) => p.id === id);
const allPlans = (data) => [...data.projects, ...data.queue];
const teamBusy = (data, id) => data.projects.some((p) => p.plan.team === id) || data.lab?.team === id;

function createProject(data, action, phase, queued) {
  const { name, size, genre, topic, audience, platform: platformId, team: teamId,
    depth: testing, marketing = 0, limit = 1_000_000, autoScore = 0, qaLimit = 0,
    kind = 'title', ref = 0, contract: publisherId = '' } = action;
  const plan = { name: typeof name === 'string' ? name.trim() : '', size, genre, topic, audience, platform: platformId,
    team: teamId, depth: testing, marketing, limit, autoScore, qaLimit, kind, ref, contract: publisherId };
  requireIdle(validPlan(plan), 'invalid-request');
  requireIdle(team(data, teamId) && (teamId === 1 || occupants(data, teamId).length > 0), 'studio-team');
  requireIdle(sizes[size].phase <= phase && (platformId === 'pc' || data.research[platformId === 'own' ? 'distribution' : platformId]) &&
    (phase >= 3 || (audience === 'casual' && marketing === 0)) && (marketing <= 10 || data.research.campaigns) &&
    (!autoScore || data.research.releaseRules) && (!qaLimit || data.research.pipeline), 'locked');

  if (kind === 'title') {
    requireIdle(ref === 0 && allowedPair(data, phase, genre, topic), 'locked');
  } else {
    requireIdle(phase >= 4 && !publisherId, 'locked');
    const target = score(data, ref);
    requireIdle(target && target.genre === genre && target.topic === topic, 'studio-portfolio');
    const related = allPlans(data).some((row) => row.plan.kind === kind && row.plan.ref === ref);
    if (kind === 'patch') {
      requireIdle(!related && !target.patched && titleOpen(target), 'studio-portfolio');
    } else {
      const line = franchise(data, target);
      requireIdle(!related && target.rating >= 80 && (!line ? data.franchises.length < archiveKeep : line.last === ref),
        'studio-portfolio');
    }
  }

  if (publisherId) {
    const offer = publishers.find((row) => row.id === publisherId);
    requireIdle(phase >= 4 && contract(data, publisherId)?.active && offer.genre === genre && offer.size === size &&
      !allPlans(data).some((row) => row.plan.contract === publisherId) &&
      (!autoScore || data.research.publisherOffice), 'studio-contract');
  }
  requireIdle(queued ? data.research.templates && data.queue.length < data.teams.length : !teamBusy(data, teamId), 'studio-team');
  const project = { id: data.nextProject++, plan, stage: 'concept', spent: '0', bugs: 0, competency: 0, rating: 0, slot: null };
  if (queued) data.queue.push(project);
  else data.projects.push(project);
}

function requiredBooking(data, project) {
  if (project.slot || project.stage === 'gate' || data.order && project.plan.team === 1) return null;
  const cost = booking(data, project);
  const qa = project.stage === 'qa' || project.stage === 'polish';
  if (cost.total + quantity(project.spent) > coins(project.plan.limit) ||
      qa && project.plan.qaLimit && cost.total > coins(project.plan.qaLimit)) return null;
  return cost;
}

function openBooking(data, project, cost, at) {
  credit(data, 'budget', -cost.total);
  project.slot = { start: at, end: nextAt(at, cost.duration), duration: cost.duration, tools: String(cost.extra),
    total: String(cost.total), competency: Math.round(cost.competency * 10_000), bugs: cost.bugs, clear: cost.clear };
}

function finishBooking(data, project) {
  const slot = project.slot;
  credit(data, 'spent', quantity(slot.total));
  credit(project, 'spent', quantity(slot.total));
  project.slot = null;
  switch (project.stage) {
    case 'concept': project.stage = 'development'; break;
    case 'development':
      project.stage = 'qa';
      project.competency = slot.competency;
      project.bugs = slot.bugs;
      break;
    default:
      project.bugs = Math.max(0, project.bugs - slot.clear);
      project.rating = rating(project.plan, project.competency / 10_000, project.bugs);
      project.stage = 'gate';
  }
}

function compact(data) {
  const refs = new Set([...allPlans(data).map((p) => p.plan.ref), ...data.franchises.map((line) => line.last)]);
  const candidates = data.releases.filter((r) => !titleOpen(r) && !refs.has(r.id));
  const obsolete = new Set(candidates.slice(0, Math.max(0, candidates.length - archiveKeep + refs.size)).map((r) => r.id));
  data.releases = data.releases.filter((r) => !obsolete.has(r.id));
}

function mayRelease(data, p) {
  if (p.stage !== 'gate') return 'studio-stage';
  const { plan } = p;
  if (plan.kind === 'patch') return '';
  if (plan.contract) {
    const rules = publishers.find(({ id }) => id === plan.contract);
    if (!contract(data, rules.id)?.active || p.rating < rules.rating) return 'studio-contract';
  }
  if (portfolioFull(data)) return 'studio-portfolio';
  if (plan.kind === 'sequel') {
    const previous = score(data, plan.ref);
    const line = previous && franchise(data, previous);
    if (!previous || (!line && data.franchises.length >= archiveKeep)) return 'studio-portfolio';
  }
  return '';
}

function publish(data, project, phase, at) {
  const { plan } = project;
  const previous = score(data, plan.ref);
  if (plan.kind === 'patch') {
    const left = previous.markets.reduce((n, m) => n + m.cap - m.sold, 0);
    previous.markets.push({ at, cap: Math.floor(left / 5), sold: 0, half: sizes[plan.size].half * 1000 });
    previous.patched = true;
  } else {
    let line = plan.kind === 'sequel' ? franchise(data, previous) : null;
    if (plan.kind === 'sequel' && !line) {
      line = { id: previous.id, name: previous.name, parts: 1, last: previous.id };
      data.franchises.push(line);
    }
    const cap = marketPotential(data, plan, project.rating, phase, at, line);
    let margin = sizes[plan.size].margin * 100;
    if (plan.contract) {
      margin = Math.floor(margin * 0.4);
      const deal = contract(data, plan.contract);
      deal.active = false;
      deal.completed++;
    }
    if (plan.platform === 'own') margin = Math.floor(margin * 1.15);
    const studio = team(data, plan.team).studio;
    data.releases.push({
      id: project.id, name: plan.name, studio, genre: plan.genre, topic: plan.topic, rating: project.rating,
      platform: plan.platform, size: plan.size, margin, patched: false, franchise: line?.id ?? 0,
      markets: [{ at, cap, sold: 0, half: sizes[plan.size].half * 1000 }],
    });
    if (line) { line.parts++; line.last = project.id; }
    if (!data.studiosWithReleases.includes(studio)) data.studiosWithReleases.push(studio);
    data.studiosWithReleases.sort();
    data.numReleases++;
    if (project.rating >= 90) data.hits++;
    data.best = Math.max(data.best, project.rating);
    data.bestGenres[plan.genre] = Math.max(data.bestGenres[plan.genre] ?? 0, project.rating);
    data.reputation += Math.max(1, Math.floor(project.rating / 20));
    data.recentGenres = [...data.recentGenres.slice(-4), plan.genre];
  }
  data.researchPoints = Math.min(researchCap, data.researchPoints + pointsBySize[plan.size]);
  data.projects = data.projects.filter((row) => row.id !== project.id);
  compact(data);
}

function settleWork(data, phase, at) {
  // Existing authorisations are handled in creation order. An earlier blocked team
  // doesn't prevent an affordable project from using its team's own slot.
  const candidates = allPlans(data).sort((a, b) => a.id - b.id);
  for (const project of candidates) {
    if (project.slot && project.slot.end <= at) finishBooking(data, project);
  }
  for (const project of candidates) {
    if (project.plan.autoScore && project.rating >= project.plan.autoScore && !mayRelease(data, project)) {
      publish(data, project, phase, at);
    }
  }
  for (const project of candidates) {
    const enqueued = data.queue.includes(project);
    if (enqueued && teamBusy(data, project.plan.team) || !enqueued && !data.projects.includes(project)) continue;
    const cost = requiredBooking(data, project);
    if (!cost || quantity(data.budget) < cost.total) continue;
    if (enqueued) {
      data.queue = data.queue.filter((row) => row !== project);
      data.projects.push(project);
    }
    openBooking(data, project, cost, at);
    if (cost.duration === 0) {
      finishBooking(data, project);
      if (project.plan.autoScore && project.rating >= project.plan.autoScore && !mayRelease(data, project)) {
        publish(data, project, phase, at);
      }
    }
  }
}

function settleSales(data, at) {
  const earned = receipts(data, at);
  credit(data, 'budget', earned.income);
  credit(data, 'salesRevenue', earned.gameRevenue);
  credit(data, 'licenseRevenue', earned.income - earned.gameRevenue);
  credit(data, 'fanTicks', earned.fans);
  credit(data, 'runSales', earned.units);
  for (const r of [...data.releases.flatMap((title) => title.markets), ...data.licenses.map(({ market }) => market)]) {
    r.sold = cumulative(r, at);
  }
  compact(data);
}

function thresholdAt(from, to, met) {
  if (!met(to) || met(from)) return to;
  let low = from, high = to;
  while (high - low > 1) {
    const middle = low + Math.floor((high - low) / 2);
    if (met(middle)) high = middle;
    else low = middle;
  }
  return high;
}

function advance(data, { from, to, phase: phaseView }) {
  const phase = phaseNumber(phaseView.phase.id);
  settleWork(data, phase, from);
  const open = [...data.releases.flatMap((title) => title.markets), ...data.licenses.map(({ market }) => market)]
    .filter((m) => m.sold < m.cap);
  let until = Math.min(to, data.order?.end ?? to, data.lab?.end ?? to,
    ...data.projects.map((project) => project.slot?.end ?? to),
    ...open.map(marketEnd).filter((at) => at > from));
  if (open.length) {
    const available = quantity(data.budget);
    const requests = allPlans(data).filter((p) => data.projects.includes(p) || !teamBusy(data, p.plan.team))
      .map((p) => requiredBooking(data, p)?.total).filter((n) => n !== undefined && n > available);
    if (requests.length) {
      const target = requests.reduce((low, n) => n < low ? n : low);
      until = thresholdAt(from, until, (at) => available + receipts(data, at).income >= target);
    }
    if (phase === 1 && data.numReleases >= 2 && fans(data) < 30n) {
      until = thresholdAt(from, until, (at) => quantity(data.fanTicks) + receipts(data, at).fans >= 30n * 800n);
    }
    if (phase === 3 && data.staff.length >= 6 && quantity(data.salesRevenue) < coins(2_000_000)) {
      until = thresholdAt(from, until, (at) => quantity(data.salesRevenue) + receipts(data, at).gameRevenue >= coins(2_000_000));
    }
  }
  settleSales(data, until);
  if (data.order?.end === until) { credit(data, 'budget', coins(150)); data.order = null; }
  if (data.lab?.end === until) {
    data.researchPoints = Math.min(researchCap, data.researchPoints + 8);
    credit(data, 'spent', quantity(data.lab.cost));
    data.lab = null;
  }
  settleWork(data, phase, until);
  return { until, data };
}

function cancel(data, project, at) {
  const slot = project.slot;
  if (slot) {
    const paused = slot.end - slot.start - slot.duration;
    const residualPause = Math.max(0, (data.order?.end ?? at) - at);
    const worked = Math.max(0, at - slot.start - paused + (project.plan.team === 1 ? residualPause : 0));
    const wages = quantity(slot.total) - quantity(slot.tools);
    const used = quantity(slot.tools) + wages * BigInt(Math.min(worked, slot.duration)) / BigInt(slot.duration);
    credit(data, 'budget', quantity(slot.total) - used);
    credit(data, 'spent', used);
  }
  data.projects = data.projects.filter((p) => p !== project);
  data.queue = data.queue.filter((p) => p !== project);
}

function manageStaff(data, action, phase) {
  const worker = data.staff.find(({ id }) => id === action.staff);
  const from = worker && worker.team;
  if (action.type === 'hire') {
    requireIdle(phase >= 2 && roles.slice(0, phase === 2 ? 3 : 5).includes(action.role), 'locked');
    requireIdle(team(data, action.team) && data.staff.length < staffLimit(phase) && occupants(data, action.team).length < 6,
      'studio-team');
    paid(data, coins(phase >= 4 ? 2400 : 420));
    data.staff.push({ id: data.nextStaff++, team: action.team, role: action.role, skill: 1 });
    return;
  }
  requireIdle(worker && !teamBusy(data, from), 'studio-team');
  if (action.type === 'train') {
    requireIdle(worker.skill < 3, 'locked');
    paid(data, coins(750 * worker.skill));
    worker.skill++;
  } else if (action.type === 'fire') data.staff = data.staff.filter((s) => s !== worker);
  else {
    requireIdle(team(data, action.team) && !teamBusy(data, action.team) && occupants(data, action.team).length < 6, 'studio-team');
    worker.team = action.team;
  }
}

function doResearch(data, key, phase) {
  requireIdle(known(research, key), 'invalid-request');
  const [required, points, cost, prereq] = research[key];
  requireIdle(phase >= required && !data.research[key] && (!prereq || data.research[prereq]), 'locked');
  requireIdle(data.researchPoints >= points, 'studio-research');
  paid(data, coins(cost));
  data.researchPoints -= points;
  data.research[key] = true;
}

function business(data, action, phase, at) {
  switch (action.type) {
    case 'studio':
      requireIdle(phase >= 4 && data.studios.length < (phase === 4 ? 2 : 4), 'locked');
      paid(data, coins(studioCosts[data.studios.length]));
      data.studios.push(data.studios.length + 1);
      break;
    case 'team':
      requireIdle(data.studios.includes(action.studio) && data.teams.length < teamLimit(phase), 'locked');
      paid(data, coins(data.teams.length === 1 ? 600 : 2500));
      data.teams.push({ id: data.teams.length + 1, studio: action.studio });
      break;
    case 'relocate':
      requireIdle(phase >= 4 && team(data, action.team) && !teamBusy(data, action.team) && data.studios.includes(action.studio), 'studio-team');
      team(data, action.team).studio = action.studio;
      break;
    case 'sign': {
      const offer = publishers.find(({ id }) => id === action.id);
      requireIdle(phase >= 4 && offer && !contract(data, offer.id)?.active, 'studio-contract');
      const deal = contract(data, offer.id);
      if (deal) deal.active = true;
      else data.contracts.push({ id: offer.id, active: true, completed: 0 });
      credit(data, 'budget', coins(offer.advance));
      credit(data, 'advances', coins(offer.advance));
      break;
    }
    case 'license': {
      const index = licensees.indexOf(action.id);
      requireIdle(phase >= 5 && index !== -1 && !data.licenses.some(({ id }) => id === action.id), 'studio-contract');
      const market = { at, half: 172800000, cap: 1500, sold: 0 };
      data.licenses.push({ id: action.id, margin: 200, market });
      credit(data, 'budget', coins(600));
      credit(data, 'licenseRevenue', coins(600));
      break;
    }
    default: requireIdle(false, 'invalid-request');
  }
}

function command(data, action, phaseView, at) {
  const phase = phaseNumber(phaseView.phase.id);
  const p = activeProject(data, action.id);
  switch (action.type) {
    case 'start':
    case 'queue': createProject(data, action, phase, action.type === 'queue'); break;
    case 'cancel': {
      const selected = p ?? data.queue.find(({ id }) => id === action.id);
      requireIdle(selected && action.confirm === true, 'studio-stage');
      cancel(data, selected, at);
      break;
    }
    case 'raise-limit':
      requireIdle(p && !p.slot && integer(action.limit, p.plan.limit, 1_000_000_000) &&
        integer(action.qaLimit, p.plan.qaLimit, 1_000_000_000), 'studio-stage');
      Object.assign(p.plan, { limit: action.limit, qaLimit: action.qaLimit });
      break;
    case 'polish':
      requireIdle(p && p.stage === 'gate' && p.bugs > 0, 'studio-stage');
      p.stage = 'polish';
      break;
    case 'release':
      requireIdle(p, 'studio-stage');
      { const block = mayRelease(data, p); requireIdle(!block, block); }
      publish(data, p, phase, at);
      break;
    case 'side-job':
      requireIdle(!data.order, 'studio-stage');
      data.order = { end: nextAt(at, leaseWork) };
      if (data.projects.some((p) => p.plan.team === 1 && p.slot)) {
        const owned = data.projects.find((p) => p.plan.team === 1);
        owned.slot.end = nextAt(owned.slot.end, leaseWork);
      }
      break;
    case 'hire': case 'train': case 'fire': case 'move': manageStaff(data, action, phase); break;
    case 'research': doResearch(data, action.id, phase); break;
    case 'lab': {
      requireIdle(phase >= 3 && data.researchPoints < researchCap && !data.lab && !teamBusy(data, action.team) &&
        occupants(data, action.team).some(({ role }) => role === 'research') && (action.team !== 1 || !data.order), 'studio-team');
      const cost = coins(216);
      requireIdle(quantity(data.budget) >= cost, 'studio-budget');
      credit(data, 'budget', -cost);
      data.lab = { team: action.team, end: nextAt(at, 1800000), cost: String(cost) };
      break;
    }
    default: business(data, action, phase, at);
  }
  settleWork(data, phase, at);
  return data;
}

function deriveView(data, id, at) {
  const phase = phaseNumber(id);
  const availableSizes = Object.keys(sizes).filter((key) => sizes[key].phase <= phase);
  const quotes = data.teams.filter((t) => t.id === 1 || occupants(data, t.id).length > 0)
    .flatMap(({ id: team }) => availableSizes.flatMap((size) => Object.keys(depth).map((testing) => {
      const plan = { team, size, depth: testing, platform: 'pc', marketing: 0 };
      const stages = steps.map((stage) => booking(data, { plan, stage }));
      return { team, size, depth: testing, duration: stages.reduce((sum, row) => sum + row.duration, 0),
        cost: String(stages.reduce((sum, row) => sum + row.total, 0n)) };
    })));
  return {
    ...data, phase, availableGenres: genres.filter((genre) => topics.some((topic) => allowedPair(data, phase, genre, topic))),
    availableTopics: topics.filter((topic) => genres.some((genre) => allowedPair(data, phase, genre, topic))),
    pairs: Object.fromEntries(genres.map((genre) => [genre, topics.filter((topic) => allowedPair(data, phase, genre, topic))])),
    sizes: availableSizes, quotes,
    platforms: [...Object.keys(platforms), 'own'].filter((key) => key === 'pc' || data.research[key === 'own' ? 'distribution' : key]),
    platformFees: Object.fromEntries([...Object.keys(platforms), 'own'].map((key) => [key, platform(key).fee])),
    roleList: phase > 1 ? roles.slice(0, phase === 2 ? 3 : 5) : [], staffLimit: staffLimit(phase),
    projections: data.projects.map((p) => ({
      id: p.id, releaseBlock: mayRelease(data, p), required: p.stage !== 'gate' && !p.slot ? booking(data, p).total.toString() : '0',
      locked: !p.slot && p.stage !== 'gate' && !requiredBooking(data, p),
    })),
    reserve: (data.projects.reduce((sum, p) => sum + (p.slot ? quantity(p.slot.total) : 0n), 0n) +
      (data.lab ? quantity(data.lab.cost) : 0n)).toString(),
    fans: String(fans(data)), trend: trendAt(at), teamLimit: teamLimit(phase),
    offers: phase >= 4 ? publishers : [], licensees: phase >= 5 ? licensees : [],
    researchOffers: Object.entries(research).filter(([key, row]) => !data.research[key] && row[0] <= phase)
      .map(([key, [, points, cost, prereq]]) => ({ key, points, cost, prereq: prereq ?? null })),
    possibleClaims: claims(data, phase), prestigeBonus: Math.round((prestigeRate(data.prestige.points) - 1) * 1000) / 10,
    complete: phase === 5 && data.studios.length === 4 && data.best >= 99 && longest(data) >= 5 &&
      genres.every((g) => data.bestGenres[g] >= 80) && data.licenses.length === 10 && quantity(data.runSales) >= 10_000_000n,
  };
}

const module = {
  id: 'studio', stateVersion: 1, rulesVersion: 1, create, validate, facts, advance, command, deriveView,
  reset(data, id, _at, requested) {
    const eligible = claims(data, phaseNumber(id));
    requireIdle(eligible.length > 0 && Array.isArray(requested) && requested.length === eligible.length &&
      eligible.every((key, i) => key === requested[i]), 'prestige-conflict');
    return create({ points: data.prestige.points + eligible.length, claimed: [...data.prestige.claimed, ...eligible] });
  },
};

export const studioEngine = createIdleEngine(module, phasesFor('studio'));
