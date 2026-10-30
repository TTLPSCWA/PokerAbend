import { test, expect, login, selectGame } from './helpers.js';

async function create(page, app, game, settings = {}) {
  await login(page, app);
  await selectGame(page, game);
  await page.locator('#host-form button[type=submit]').click();
  await expect.poll(() => page.evaluate(() => lastState?.game)).toBe(game);
  if (Object.keys(settings).length) expect((await page.evaluate((settings) => send('settings', settings), settings)).ok).toBe(true);
}
async function startWithBot(page) {
  await page.getByRole('button', { name: 'Mitspielen', exact: true }).click();
  expect((await page.evaluate(() => send('addBot'))).ok).toBe(true);
  expect((await page.evaluate(() => send('start'))).ok).toBe(true);
}
async function pause(page) {
  await page.getByRole('button', { name: 'Spiel für alle pausieren', exact: true }).click();
  await expect(page.locator('#game-pause-banner')).toBeVisible();
  await expect.poll(() => page.evaluate(() => lastState.gamePaused)).toBe(true);
  expect(await page.locator('.topbar').evaluate((header) => {
    const left = header.querySelector('.top-left').getBoundingClientRect();
    const right = header.querySelector('.top-right').getBoundingClientRect();
    return right.top >= left.bottom - 1 || right.left >= left.right;
  })).toBe(true);
}
async function resume(page) {
  await page.locator('#game-pause-banner').getByRole('button', { name: 'Spiel fortsetzen', exact: true }).click();
  await expect(page.locator('#game-pause-banner')).toBeHidden();
  await expect.poll(() => page.evaluate(() => lastState.gamePaused)).toBe(false);
}

test('Gemeinsame Pause: sichtbar für Mitspieler, Host-Rechte und Reconnect', async ({ page, app, browser }, info) => {
  await create(page, app, 'maumau');
  await page.getByRole('button', { name: 'Mitspielen', exact: true }).click();
  const code = await page.evaluate(() => lastState.code);
  const context = await browser.newContext({ viewport: page.viewportSize(), isMobile: info.project.name === 'mobil', hasTouch: info.project.name === 'mobil' });
  try {
    const guest = await context.newPage(); await login(guest, app, 'Ben');
    await guest.evaluate((code) => joinAndEnter(code, 'sit'), code);
    expect((await page.evaluate(() => send('start'))).ok).toBe(true);
    await pause(page);
    await expect(guest.locator('#game-pause-banner')).toBeVisible();
    await expect(guest.locator('[data-game-pause]')).toHaveCount(0);
    expect((await guest.evaluate(() => send('gamePause', { paused: false }))).ok).toBe(false);
    expect(await page.locator('#kg-main').evaluate((el) => el.inert)).toBe(true);
    expect(await guest.locator('#kg-dock').evaluate((el) => el.inert)).toBe(true);
    await page.reload();
    await expect(page.locator('#game-pause-banner')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('gemeinsame-pause.png') });
    await resume(page);
    await expect(guest.locator('#game-pause-banner')).toBeHidden();
    expect(await guest.locator('#kg-dock').evaluate((el) => el.inert)).toBe(false);
  } finally { await context.close(); }
});

test('Poker: vorhandenes Anhalten nutzt dieselbe gemeinsame Pause', async ({ page, app }) => {
  await create(page, app, 'poker');
  await page.locator('[data-sit]').first().click();
  expect((await page.evaluate(() => send('addBot'))).ok).toBe(true);
  expect((await page.evaluate(() => send('start'))).ok).toBe(true);
  await page.locator('#freeze-btn').click();
  await expect(page.locator('#game-pause-banner')).toBeVisible();
  expect(await page.evaluate(() => lastState.gamePaused && lastState.frozen)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('#dock').evaluate((el) => el.inert)).toBe(true);
  await resume(page);
  expect(await page.evaluate(() => lastState.frozen)).toBe(false);
});

test('Pfeilfieber: lokale Spielzeit und Eingaben warten und laufen anschließend weiter', async ({ page, app }, info) => {
  await create(page, app, 'pfeilfieber'); await startWithBot(page);
  await expect(page.locator('.pf-seq')).toBeVisible();
  await pause(page);
  const time = await page.getByRole('progressbar', { name: 'Zeit', exact: true }).getAttribute('aria-valuenow');
  const sequence = await page.locator('.pf-seq').innerHTML();
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(1300);
  await expect(page.getByRole('progressbar', { name: 'Zeit', exact: true })).toHaveAttribute('aria-valuenow', time);
  expect(await page.locator('.pf-seq').innerHTML()).toBe(sequence);
  await page.screenshot({ path: info.outputPath('pfeilfieber-pause.png') });
  await resume(page);
  await expect.poll(() => page.getByRole('progressbar', { name: 'Zeit', exact: true }).getAttribute('aria-valuenow')).not.toBe(time);
});

test('Kronenjagd: Echtzeitframes und Bewegungen halten für alle an', async ({ page, app }, info) => {
  await create(page, app, 'kronenjagd');
  await page.evaluate(() => { window.pauseFrames = 0; socket.on('arena', () => window.pauseFrames++); });
  await startWithBot(page);
  await expect(page.locator('#rt-canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.pauseFrames)).toBeGreaterThan(0);
  await pause(page);
  const frames = await page.evaluate(() => window.pauseFrames);
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.pauseFrames)).toBe(frames);
  expect((await page.evaluate(() => send('steer', { runId: lastState.g.runId, round: lastState.roundNo, seq: 999, x: 1, y: 0 }))).ok).toBe(false);
  await page.screenshot({ path: info.outputPath('kronenjagd-pause.png') });
  await resume(page);
  await expect.poll(() => page.evaluate(() => window.pauseFrames)).toBeGreaterThan(frames);
});
