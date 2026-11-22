import assert from 'node:assert/strict';

export const day = 86_400_000;
const pairs = [
  ['adventure', 'fantasy'], ['puzzle', 'animals'], ['building', 'pirates'],
  ['action', 'space'], ['strategy', 'fantasy'], ['sport', 'cooking'],
];

export async function playStudio({ command, view, wait, milestone, endgame = true }) {
  let number = 0;
  const run = (type, fields = {}) => command({ type, ...fields });
  const body = async () => (await view()).data;

  async function title({ pair = pairs[number % pairs.length], size = 'mini', depth = 'thorough',
    team = 1, platform = 'pc', marketing = 0, ...rest } = {}) {
    const name = 'Testprojekt ' + ++number;
    await run('start', { name, size, depth, genre: pair[0], topic: pair[1], audience: 'casual', team, platform, marketing, ...rest });
    for (let i = 0; i < 6; i++) {
      const current = await view();
      const project = current.data.projects.find(({ plan }) => plan.name === name);
      assert.ok(project, name);
      if (project.stage === 'gate') {
        await run('release', { id: project.id });
        return (await body()).releases.find(({ id }) => id === project.id);
      }
      assert.ok(project.slot, name + ' wartet auf Budget in ' + project.stage);
      await wait(project.slot.end - current.at);
    }
    throw new Error('Projekt erreicht das Gate nicht');
  }

  await milestone(1);
  await title({ pair: pairs[0] });
  await title({ pair: pairs[1] });
  await wait(3 * 3_600_000);
  await milestone(2);
  for (const role of ['code', 'art', 'qa']) await run('hire', { role, team: 1 });
  const witness = await title({ pair: ['puzzle', 'pirates'], size: 'small' });
  assert.equal(witness.rating, 95);
  await run('research', { id: 'marketing1' });
  await milestone(3);
  await wait(4 * 3_600_000);
  for (const role of ['marketing', 'research', 'code']) await run('hire', { role, team: 1 });
  await run('research', { id: 'editor' });
  await title({ pair: pairs[0], size: 'small' });
  await wait(4 * 3_600_000);
  await run('research', { id: 'browser' });
  for (let attempt = 0; ; attempt++) {
    const data = await body();
    if (data.phase >= 4) break;
    assert.ok(attempt < 12, 'G4-Umsatz muss erreichbar sein');
    await title({ pair: pairs[attempt % pairs.length], size: 'large', platform: 'browser', marketing: 10 });
    await wait(10 * day);
  }
  await milestone(4);
  await run('studio');
  await run('team', { studio: 2 });
  for (const role of ['code', 'art', 'qa', 'marketing', 'research']) await run('hire', { role, team: 2 });
  await run('sign', { id: 'elm' });
  const signed = await title({ pair: pairs[0], team: 2, size: 'epic', platform: 'browser', marketing: 10, contract: 'elm' });
  assert.equal(signed.studio, 2);
  assert.equal(signed.margin, 1520);
  await wait(10 * day);
  for (const id of ['engine1', 'engine2', 'engine3']) {
    while ((await body()).researchPoints < { engine1: 20, engine2: 30, engine3: 45 }[id]) {
      await title({ size: 'epic', platform: 'browser', marketing: 10 });
      await wait(10 * day);
    }
    await run('research', { id });
  }
  await milestone(5);
  if (!endgame) return;

  await run('studio');
  await run('studio');
  for (const id of (await body()).licensees) await run('license', { id });
  for (const id of ['measurement', 'campaigns', 'distribution']) {
    while ((await body()).researchPoints < { measurement: 6, campaigns: 8, distribution: 16 }[id]) {
      await title({ size: 'epic', platform: 'browser', marketing: 10 });
      await wait(10 * day);
    }
    await run('research', { id });
  }
  for (const pair of pairs) await title({ pair, size: 'epic', platform: 'own', marketing: 20 });
  let last = await title({ pair: pairs[1], size: 'epic', platform: 'own', marketing: 20 });
  for (let i = 0; i < 4; i++) {
    last = await title({ kind: 'sequel', ref: last.id, pair: pairs[1], size: 'epic', platform: 'own', marketing: 20 });
  }
  await wait(180 * day);
  for (let i = 0; BigInt((await body()).runSales) < 10_000_000n; i++) {
    assert.ok(i < 80, '10 Mio. reguläre Verkäufe müssen erreichbar sein');
    await title({ pair: pairs[i % pairs.length], size: 'epic', platform: 'own', marketing: 20 });
    await wait(180 * day);
  }
  await milestone(5, true);
}
