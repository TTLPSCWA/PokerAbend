// EXP-081 Doppelagent: Schreibmaschine, Anklage dreht die Akten um, Enthüllung mit Sonnenbrille, „Mission erfüllt“ als Highlight.
import { test, expect, expectSound, expectNoLeak } from './helpers.js';
import { openTable, watch, ok, soundLog, sounds, evidence, recordAnimations, animations, expectOnlyTransformOpacity, smoothReplay, fpsEvidence } from './exp-helpers.js';

const start = async (page, app, browser, options = {}) => {
  const table = await openTable(page, app, browser, 'doppelagent', { guests: ['Ben', 'Cleo'], ...options });
  await soundLog(page); await recordAnimations(page);
  await ok(page, 'start'); await expect(page.locator('.da-world')).toBeVisible();
  return table;
};
const g = (p) => p.evaluate(() => lastState.g);
const me = (p) => p.evaluate(() => lastState.you.id);
const stamp = async (p) => { const s = await g(p); return { key: s.key, revision: s.revision }; };
// Wer am Zug ist, stellt eine Frage; der Gefragte antwortet.
async function exchange(pages) {
  for (const stage of ['ask', 'answer']) {
    let p = null; await expect.poll(async () => { for (const c of pages) if (await c.evaluate((stage) => lastState.turnId === lastState.you.id && lastState.g.stage === stage, stage)) p = c; return !!p; }).toBe(true);
    const s = await g(p), id = await me(p);
    await ok(p, stage, { ...(await stamp(p)), target: s.people.find((x) => x !== id && x !== s.previous), text: stage === 'ask' ? 'Wie ist das Wetter dort?' : 'Meistens angenehm.' });
  }
}
// Der Agent errät den Ort (den Ort kennt der Test von einer Ermittlerseite).
async function agentGuesses(pages) {
  let spy = null, place = null;
  for (const p of pages) { const s = await g(p); if (s.secret.spy) spy = p; else place = s.secret.location.de; }
  const s = await g(spy);
  await ok(spy, 'guess', { ...(await stamp(spy)), location: s.locations.find((l) => l.de === place).id });
  return spy;
}

test('EXP-081: Akte, Schreibmaschine, Anklage dreht die Akten um, Enthüllung mit Sonnenbrille, Bewegungsbudget', async ({ page, app, browser }, info) => {
  test.setTimeout(120000);
  const { others, close } = await start(page, app, browser);
  try {
    const pages = [page, ...others];
    await expect(page.locator('#kg')).toHaveAttribute('data-xp-kit', 'doppelagent');
    await expectSound(page, { event: 'file', palette: 'doppelagent', game: 'doppelagent' });
    await exchange(pages);
    await expectSound(page, 'type');
    await expect.poll(async () => (await animations(page)).some((a) => /da-secret/.test(a.target))).toBe(true);
    // Anklage: Die Hauptseite klagt Ben an, Cleo stimmt zu – einstimmig, die Akte wird geöffnet.
    await soundLog(page); await recordAnimations(page);
    await ok(page, 'accuse', { ...(await stamp(page)), target: await me(others[0]) });
    await expectSound(page, 'accuse');
    await expect(page.locator('.da-vote')).toBeVisible();
    await expect.poll(async () => (await animations(page)).filter((a) => a.props.includes('transform')).length).toBeGreaterThan(2);
    for (const p of pages) { const s = await g(p); if (s.stage === 'vote' && s.vote.canVote) await ok(p, 'agentVote', { key: s.key, voteId: s.vote.id, agree: true }); }
    await expect(page.locator('.da-reveal')).toBeVisible();
    await expectSound(page, 'reveal');
    await expect(page.locator('.xp-da-agent .xp-da-shades')).toBeVisible();
    expectOnlyTransformOpacity(await animations(page));
    expect(await sounds(page)).not.toContain('beep');
    await expectNoLeak(page, { requireSecrets: false });
    await page.waitForTimeout(1200); await evidence(page, info, 'EXP-081', 'enthuellung');
    await close(); // Messung ohne weitere Browser
    await fpsEvidence(info, 'EXP-081', await smoothReplay(page, 'doppelagent', { gap: 1300 }));
  } finally { await close(); }
});

test('EXP-081: Agent errät den Ort – Postkarte fliegt ins Bild, „Mission erfüllt“', async ({ page, app, browser }, info) => {
  const { others, close } = await start(page, app, browser);
  try {
    const pages = [page, ...others];
    await soundLog(page); await recordAnimations(page);
    await agentGuesses(pages);
    await expect(page.locator('.xp-da-postcard')).toContainText('Mission erfüllt');
    await expect(page.locator('#kg')).toHaveAttribute('data-xp', 'mission');
    await expectSound(page, 'reveal'); await expectSound(page, 'highlight');
    expectOnlyTransformOpacity(await animations(page));
    await page.waitForTimeout(900); await evidence(page, info, 'EXP-081', 'mission');
    // Die Postkarte verschwindet von selbst; der nächste Zustand räumt ohnehin alles weg.
    await ok(page, 'next');
    await expect(page.locator('.xp-da-postcard')).toHaveCount(0);
    await expectSound(page, 'file');
  } finally { await close(); }
});

test('EXP-081: „Animationen reduzieren“, Neuladen und Zuschauen ohne Rückstau und ohne geheime Karte', async ({ page, app, browser }) => {
  test.setTimeout(120000);
  const { others, close } = await start(page, app, browser, { reduced: true });
  try {
    const pages = [page, ...others];
    await recordAnimations(page);
    await exchange(pages);
    await expectSound(page, 'type');
    await agentGuesses(pages);
    await expect(page.locator('.xp-da-postcard')).toHaveCount(1);
    await expect(page.locator('.xp-da-agent')).toBeVisible();
    for (const a of await animations(page)) expect(a.duration, JSON.stringify(a)).toBeLessThanOrEqual(150);
    await page.reload(); await expect(page.locator('.da-world')).toBeVisible();
    await soundLog(page); await recordAnimations(page); await page.waitForTimeout(400);
    expect(await sounds(page)).toEqual([]); expect(await animations(page)).toEqual([]);
    await expect(page.locator('.xp-da-agent')).toBeVisible(); // Endzustand der Enthüllung steht sofort
    await expect(page.locator('.xp-da-postcard')).toHaveCount(0);
    await ok(page, 'next');
    const { watcher, close: leave } = await watch(page, app, browser);
    try { await expect(watcher.locator('.da-world')).toBeVisible(); await expect(watcher.locator('.da-secret')).toHaveCount(0); await expect(watcher.locator('.xp-da-agent')).toHaveCount(0); } finally { await leave(); }
  } finally { await close(); }
});
