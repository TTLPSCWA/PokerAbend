import { test, expect, login, selectGame } from './helpers.js';

async function create(page, app, game, settings = {}) {
  test.setTimeout(60000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page, app); await selectGame(page, game);
  await page.locator('#host-form button[type=submit]').click();
  await page.getByRole('button', { name: 'Mitspielen', exact: true }).click();
  const reply = await page.evaluate((settings) => send('settings', { playSecs: 10, ...settings }), settings);
  expect(reply.ok).toBe(true);
  await page.evaluate(() => {
    window.testFrame = null; window.testFrames = 0; window.testStates = 0;
    socket.on('arena', (frame) => { window.testFrame = frame; window.testFrames++; });
    socket.on('state', () => window.testStates++);
  });
}
const elapsed = (page) => page.evaluate(() => window.testFrame?.elapsed ?? -3000);
const own = (page) => page.evaluate(() => window.testFrame?.bodies.find((p) => p.id === lastState.you.id));
async function start(page) {
  await page.getByRole('button', { name: 'Runde starten', exact: true }).click();
  await expect(page.locator('#rt-canvas')).toBeVisible();
  await expect.poll(() => elapsed(page), { timeout: 6000 }).toBeGreaterThanOrEqual(0);
}
async function holdDirection(page, direction, touch) {
  if (!touch) { await page.keyboard.down(direction === 'left' ? 'ArrowLeft' : 'ArrowUp'); return () => page.keyboard.up(direction === 'left' ? 'ArrowLeft' : 'ArrowUp'); }
  const button = page.locator(`[data-rt-dir="${direction}"]`); const box = await button.boundingBox();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
  return async () => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach(); };
}

test('Kronenjagd: zwei Browser, Tastatur/Touch, kompakte Frames, Stoppen und Wiederverbinden', async ({ page, app, browser }, info) => {
  await create(page, app, 'kronenjagd', { playSecs: 20 });
  const code = await page.evaluate(() => lastState.code);
  const context = await browser.newContext({ viewport: page.viewportSize() });
  const errors = [];
  try {
    const guest = await context.newPage(); guest.on('pageerror', (e) => errors.push(e.message));
    await login(guest, app, 'Ben'); await guest.evaluate((code) => joinAndEnter(code, 'sit'), code);
    await expect.poll(() => page.evaluate(() => lastState.players.filter((p) => p.seated).length)).toBe(2);
    await guest.evaluate(() => socket.on('arena', (frame) => window.testFrame = frame));
    await start(page);
    await page.evaluate(() => { window.testCanvas = document.querySelector('#rt-canvas'); window.testStates = 0; });
    const before = await own(page);
    const release = await holdDirection(page, 'left', info.project.name === 'mobil');
    await expect.poll(async () => (await own(page))?.x).toBeLessThan(before.x - 70);
    await release();
    await expect.poll(() => page.evaluate(() => window.testFrames)).toBeGreaterThan(5);
    expect(await page.evaluate(() => window.testStates)).toBe(0);
    expect(await page.evaluate(() => window.testCanvas === document.querySelector('#rt-canvas'))).toBe(true);
    await expect.poll(async () => {
      const p = await own(page);
      const x = await guest.evaluate((id) => window.testFrame?.bodies.find((p) => p.id === id)?.x, p.id);
      return Math.abs(p.x - x);
    }).toBeLessThan(20);
    await expect.poll(() => page.evaluate(() => window.testFrame?.tick)).toBeGreaterThan(90);
    const stopped = (await own(page)).x;
    const tick = await page.evaluate(() => window.testFrame.tick);
    await expect.poll(() => page.evaluate(() => window.testFrame.tick)).toBeGreaterThan(tick + 8);
    expect(Math.abs((await own(page)).x - stopped)).toBeLessThan(.01);
    const id = (await own(page)).id;
    await page.reload(); await expect(page.locator('#rt-canvas')).toBeVisible();
    await page.evaluate(() => socket.on('arena', (frame) => window.testFrame = frame));
    await expect.poll(() => own(page)).toBeTruthy();
    expect((await own(page)).id).toBe(id);
    const reconnected = (await own(page)).x;
    await page.keyboard.down('ArrowLeft');
    await expect.poll(async () => (await own(page))?.x).toBeLessThan(reconnected - 30); await page.keyboard.up('ArrowLeft');
    await page.screenshot({ path: info.outputPath('kronenjagd.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const checkField = async () => {
      const field = await page.locator('#rt-canvas').boundingBox(), dock = await page.locator('#kg-dock').boundingBox();
      const clock = await page.locator('#rt-time').boundingBox(), help = await page.locator('.help-btn').boundingBox();
      const overlap = clock.x < help.x + help.width && clock.x + clock.width > help.x && clock.y < help.y + help.height && clock.y + clock.height > help.y;
      return field.y + field.height <= dock.y + 1 && dock.y + dock.height <= await page.evaluate(() => innerHeight) + 1 && !overlap;
    };
    await expect.poll(checkField).toBe(true);
    await page.setViewportSize({ width: 900, height: 450 });
    await expect.poll(checkField).toBe(true);
    await page.screenshot({ path: info.outputPath('kronenjagd-querformat.png'), fullPage: true });
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('Bröckelboden: Bots, Sprungknopf, stabile Touch-Steuerung und Rundenende', async ({ page, app }, info) => {
  await create(page, app, 'broeckelboden', { jump: true });
  expect((await page.evaluate(() => send('addBot'))).ok).toBe(true);
  await start(page);
  const release = await holdDirection(page, 'left', info.project.name === 'mobil');
  await page.getByRole('button', { name: 'Springen', exact: true }).click();
  await expect.poll(async () => { const p = await own(page); return p?.jumpUntil - await elapsed(page); }).toBeGreaterThan(0);
  await page.screenshot({ path: info.outputPath('broeckelboden.png'), fullPage: true });
  await release();
  await expect(page.locator('.kg-over')).toBeVisible({ timeout: 18000 });
  await expect(page.locator('.kg-over')).toContainText('Bot 1');
});

test('Laser-Hüpfer: Hausregeln, Sprung, Vorwarnung und gemeinsame Wertung', async ({ page, app }, info) => {
  await create(page, app, 'laser-huepfer', { lives: 2, doubleLaser: true });
  await page.evaluate(() => send('addBot')); await start(page);
  await expect.poll(() => page.evaluate(() => window.testFrame.hazards.length)).toBe(2);
  await page.keyboard.press('Space');
  await expect.poll(async () => { const p = await own(page); return p?.jumpUntil - await elapsed(page); }).toBeGreaterThan(0);
  await page.screenshot({ path: info.outputPath('laser-huepfer.png'), fullPage: true });
  await expect(page.locator('.kg-over')).toBeVisible({ timeout: 18000 });
  expect(await page.evaluate(() => Object.values(lastState.result.points).every((n) => Number.isFinite(n)))).toBe(true);
});

test('Abendprogramm: alle drei Echtzeitspiele, gleicher Raum, Übergänge und Siegerehrung', async ({ page, app }) => {
  test.setTimeout(75000);
  await create(page, app, 'kronenjagd'); test.setTimeout(75000);
  await page.evaluate(() => send('addBot'));
  const code = await page.evaluate(() => lastState.code);
  const reply = await page.evaluate(async () => {
    const config = { name: 'Arena-Abend', mode: 'playlist', entries: ['kronenjagd', 'broeckelboden', 'laser-huepfer'].map((game) => ({ game, settings: { playSecs: 10 } })) };
    const saved = await send('programSave', config); if (!saved.ok) return saved;
    return send('programStart');
  });
  expect(reply.ok).toBe(true);
  for (let i = 0; i < 3; i++) {
    await expect(page.locator('.kg-over')).toBeVisible({ timeout: 20000 });
    expect(await page.evaluate(() => lastState.code)).toBe(code);
    expect(await page.evaluate(() => lastState.partyProgram.results.length)).toBe(i + 1);
    if (i < 2) await Promise.all([
      page.waitForEvent('load'),
      page.locator('.kg-over [data-kit="start"]').click(),
    ]);
  }
  await expect(page.locator('.kg-over')).toContainText('Siegerehrung');
  expect(await page.evaluate(() => lastState.partyProgram.status)).toBe('done');
});
