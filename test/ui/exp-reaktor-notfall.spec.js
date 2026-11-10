// EXP-094 Reaktor-Notfall: Kontrollraum, Temperatursäule, glühende Rohre, Zischen bei jedem Code, Alarm steigt, Dampf und „Gerettet“.
import { test, expect, expectSound, expectNoLeak } from './helpers.js';
import { openTable, watch, ok, soundLog, sounds, evidence, recordAnimations, animations, expectOnlyTransformOpacity, smoothReplay, fpsEvidence } from './exp-helpers.js';

const start = async (page, app, browser, options = {}) => {
  const table = await openTable(page, app, browser, 'reaktor-notfall', { guests: ['Ben'], settings: { heatSecs: 60, penaltySecs: 20, rounds: 2 }, ...options });
  await soundLog(page); await recordAnimations(page);
  await ok(page, 'start'); await expect(page.locator('.rn-panel')).toBeVisible();
  return { ...table, pages: [page, ...table.others] };
};
// Beide tragen denselben Code ein. Ist er falsch, kostet das Strafsekunden.
const propose = async (pages, code) => { for (const p of pages) { const g = await p.evaluate(() => lastState.g); await ok(p, 'propose', { key: g.key, question: g.question, code: code.slice(0, g.len) }); } };
const wrongCode = async (page) => page.evaluate(() => '0000000'.slice(0, lastState.g.len)); // Wird als falsch geprüft, sonst gibt der Test eine andere Ziffernfolge vor.
const savedScene = (page, heatMs) => page.evaluate((heatMs) => {
  const prev = JSON.parse(JSON.stringify(lastState)), view = JSON.parse(JSON.stringify(lastState));
  view.g.stage = 'reveal'; view.g.heatMs = heatMs; view.g.result = { solved: true, code: '1234'.slice(0, view.g.len), clues: [] };
  return __experiences['reaktor-notfall'].present(prev, view);
}, heatMs);

test('EXP-094: Säule und Rohre, Zischen bei echten Codes, Strafe, Alarm mit der Temperatur, Dampf und Rettung in letzter Sekunde, Bewegungsbudget', async ({ page, app, browser }, info) => {
  test.setTimeout(150000);
  const { pages, close } = await start(page, app, browser);
  try {
    await expect(page.locator('#kg')).toHaveAttribute('data-xp-kit', 'reaktor-notfall');
    await expect(page.locator('.xp-rn-column')).toBeVisible();
    await expect(page.locator('.xp-rn-gauge')).toHaveCount(2);
    // Echte, falsche Codes: Zischen, Fehlerton, Strafsekunden – die Säule steigt, bis der Alarm einsetzt.
    let code = await wrongCode(page);
    for (let i = 0; i < 2; i++) {
      await propose(pages, code);
      await expect.poll(() => page.evaluate(() => lastState.g.mistakes)).toBe(i + 1);
      code = code.replace(/^./, String(i + 1)); // nicht zweimal denselben falschen Code
    }
    await expectSound(page, { event: 'hiss', palette: 'reaktor-notfall', game: 'reaktor-notfall' }); await expectSound(page, 'wrong');
    await expect.poll(() => page.evaluate(() => Number(getComputedStyle(document.querySelector('.rn-panel')).getPropertyValue('--xp-heat')))).toBeGreaterThan(0.6);
    await expectSound(page, 'alarm1', { timeout: 6000 });
    await expect.poll(() => page.locator('.xp-rn-pipes > i').evaluate((el) => Number(getComputedStyle(el).opacity))).toBeGreaterThan(0.2);
    await evidence(page, info, 'EXP-094', 'kontrollraum');
    // Rettung in letzter Sekunde (Darstellung auf dem echten Tisch): Entwarnung, Dampf, Instrumente auf Grün, Seufzer.
    await soundLog(page); await recordAnimations(page);
    expect(await savedScene(page, 300)).toBe(true);
    await expectSound(page, 'allclear'); await expectSound(page, 'sigh'); await expectSound(page, 'highlight');
    await expect(page.locator('#kg')).toHaveAttribute('data-xp', 'gerettet');
    await expect(page.locator('.xp-plaque.xp-rn-saved')).toContainText('Gerettet');
    await expect(page.locator('.xp-rn-steam').first()).toBeAttached();
    expectOnlyTransformOpacity(await animations(page));
    await page.waitForTimeout(500); await evidence(page, info, 'EXP-094', 'gerettet');
    // Gelöst mit viel Restzeit: Dampf und Entwarnung, aber kein Highlight.
    await soundLog(page); expect(await savedScene(page, 30000)).toBe(true); await expectSound(page, 'allclear'); await page.waitForTimeout(1100);
    expect(await sounds(page)).not.toContain('sigh');
    expect(await sounds(page)).not.toContain('beep');
    await expectNoLeak(page, { requireSecrets: false });
    await fpsEvidence(info, 'EXP-094', await smoothReplay(page, 'reaktor-notfall', { gap: 1600 }));
  } finally { await close(); }
});

test('EXP-094: Hinweise bleiben privat, „Animationen reduzieren“, Pause ohne Alarm, Neuladen und Zuschauen ohne Rückstau', async ({ page, app, browser }) => {
  test.setTimeout(120000);
  const { pages, others, close } = await start(page, app, browser, { reduced: true });
  try {
    const mine = await page.evaluate(() => lastState.g.mine), theirs = await others[0].evaluate(() => lastState.g.mine);
    expect(mine).not.toEqual(theirs);
    await propose(pages, await wrongCode(page));
    await expectSound(page, 'hiss');
    expect(await savedScene(page, 300)).toBe(true);
    await expect(page.locator('.xp-plaque.xp-rn-saved')).toHaveCount(1);
    for (const a of await animations(page)) expect(a.duration, JSON.stringify(a)).toBeLessThanOrEqual(150);
    await ok(page, 'gamePause', { paused: true }); await page.waitForTimeout(300); await soundLog(page); await page.waitForTimeout(2800);
    expect((await sounds(page)).filter((e) => /^alarm/.test(e))).toEqual([]);
    await ok(page, 'gamePause', { paused: false });
    await page.reload(); await expect(page.locator('.rn-panel')).toBeVisible();
    await expect(page.locator('.xp-plaque')).toHaveCount(0);
    const { watcher, close: leave } = await watch(page, app, browser);
    try { await expect(watcher.locator('.rn-panel')).toBeVisible(); expect(await watcher.evaluate(() => lastState.g.mine)).toEqual([]); await expect(watcher.locator('.xp-plaque')).toHaveCount(0); } finally { await leave(); }
  } finally { await close(); }
});
