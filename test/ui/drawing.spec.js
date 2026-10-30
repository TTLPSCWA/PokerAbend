import { test, expect, login, selectGame } from './helpers.js';

async function group(page, app, browser, info, game) {
  test.setTimeout(60000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page, app); await selectGame(page, game === 'malen-raten' ? 'schaetzmeister' : game);
  await page.locator('#host-form button[type=submit]').click();
  await page.getByRole('button', { name: 'Mitspielen', exact: true }).click();
  if (game === 'malen-raten') {
    await page.evaluate(async () => { await send('addBot'); await send('switchGame', { game: 'malen-raten' }); });
    await expect(page.locator('#kg-meta .blinds')).toHaveText('Malen & Raten');
    expect(await page.evaluate(() => lastState.players.some((p) => p.bot))).toBe(false);
  }
  const code = await page.evaluate(() => lastState.code);
  const contexts = [], pages = [page], errors = [];
  try {
    for (const name of ['Ben', 'Clara']) {
      const context = await browser.newContext({ viewport: page.viewportSize(), isMobile: info.project.name === 'mobil', hasTouch: info.project.name === 'mobil' });
      contexts.push(context);
      const guest = await context.newPage();
      guest.on('pageerror', (e) => errors.push(e.message));
      await guest.emulateMedia({ reducedMotion: 'reduce' });
      await login(guest, app, name);
      await guest.evaluate((code) => joinAndEnter(code, 'sit'), code);
      await expect(guest.locator('#kg')).toBeVisible(); pages.push(guest);
    }
    await expect.poll(() => page.evaluate(() => lastState.players.filter((p) => p.seated).length)).toBe(3);
    await page.evaluate(async () => { await send('settings', { rounds: 1 }); await send('custom', { text: 'Regenschirm' }); });
    await page.getByRole('button', { name: 'Partie starten', exact: true }).click();
    return { pages, close: async () => { expect(errors).toEqual([]); await Promise.all(contexts.map((c) => c.close())); } };
  } catch (e) { await Promise.all(contexts.map((c) => c.close())); throw e; }
}

async function stroke(page, touch = false) {
  const canvas = page.locator('.draw-editor canvas'); await expect(canvas).toBeVisible();
  await canvas.scrollIntoViewIfNeeded(); const box = await canvas.boundingBox();
  if (touch) await page.touchscreen.tap(box.x + box.width * .3, box.y + box.height * .3);
  else {
    await page.mouse.move(box.x + box.width * .2, box.y + box.height * .3); await page.mouse.down();
    await page.mouse.move(box.x + box.width * .5, box.y + box.height * .6, { steps: 15 });
    await page.mouse.move(box.x + box.width * .8, box.y + box.height * .3, { steps: 15 }); await page.mouse.up();
  }
}
async function text(page, value) { await page.locator('#pk-in').fill(value); await page.locator('.pk-send').click(); }

test('Malen & Raten: gemeinsame Pause erhält den Zeichenentwurf und teilt ihn nach Fortsetzen', async ({ page, app, browser }, info) => {
  const groupOf = await group(page, app, browser, info, 'malen-raten');
  const [, ben] = groupOf.pages;
  try {
    await stroke(page, info.project.name === 'mobil');
    await page.getByRole('button', { name: 'Spiel für alle pausieren', exact: true }).click();
    await expect(ben.locator('#game-pause-banner')).toBeVisible();
    const strokes = await ben.evaluate(() => lastState.g.image.length);
    await page.waitForTimeout(700);
    expect(await ben.evaluate(() => lastState.g.image.length)).toBe(strokes);
    await expect(page.locator('.draw-meter')).toContainText('1/60 Striche');
    await page.locator('#game-pause-banner').getByRole('button', { name: 'Spiel fortsetzen', exact: true }).click();
    await expect.poll(() => ben.evaluate(() => lastState.g.image.length)).toBe(1);
  } finally { await groupOf.close(); }
});

test('Malen & Raten: Werkzeuge, Finger/Maus, geteilte Zeichnung, Neuladen, geheimes Raten und Auflösung', async ({ page, app, browser }, info) => {
  const groupOf = await group(page, app, browser, info, 'malen-raten');
  const [, ben, clara] = groupOf.pages;
  try {
    await expect(page.locator('.pk-q')).toContainText('Regenschirm');
    await expect(ben.locator('#kg')).not.toContainText('Regenschirm');
    await page.getByRole('button', { name: 'Rot', exact: true }).click();
    await page.getByRole('combobox', { name: 'Stiftstärke', exact: true }).selectOption('18');
    await stroke(page, info.project.name === 'mobil');
    await expect.poll(() => ben.evaluate(() => lastState.g.image.length)).toBe(1);
    expect(await ben.evaluate(() => lastState.g.image[0].color)).toBe('#df493d');
    await page.getByRole('button', { name: 'Radierer', exact: true }).click();
    await stroke(page); await expect.poll(() => ben.evaluate(() => lastState.g.image.length)).toBe(2);
    await page.getByRole('button', { name: 'Rückgängig', exact: true }).click();
    await expect.poll(() => ben.evaluate(() => lastState.g.image.length)).toBe(1);
    await page.reload(); await expect(page.locator('.draw-editor canvas')).toBeVisible();
    await expect(page.locator('.draw-meter')).toContainText('1/60');
    await page.getByRole('button', { name: 'Leeren', exact: true }).click();
    await page.locator('#dlg-cancel').click(); await expect(page.locator('.draw-meter')).toContainText('1/60');
    await page.screenshot({ path: info.outputPath('zeichnen.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await text(ben, 'Regenschirm'); await expect(ben.locator('#kg')).toContainText('Richtig!');
    await expect(clara.locator('#kg')).not.toContainText('Regenschirm');
    await text(clara, 'Regenschirm'); await expect(page.locator('.draw-solution')).toContainText('Regenschirm');
    await page.getByRole('button', { name: 'Weiter', exact: true }).click();
    await expect(page.locator('.kg-over')).toBeVisible();
  } finally { await groupOf.close(); }
});

test('Kritzelpost: drei Menschen schreiben, zeichnen, beschreiben und decken ihre Ketten auf', async ({ page, app, browser }, info) => {
  const groupOf = await group(page, app, browser, info, 'kritzelpost');
  try {
    for (let i = 0; i < 3; i++) await text(groupOf.pages[i], ['GEHEIMER DRACHE', 'Kaktus', 'Pinguin'][i]);
    for (const player of groupOf.pages) {
      await stroke(player);
      await player.getByRole('button', { name: 'Zeichnung abgeben', exact: true }).click();
    }
    for (const player of groupOf.pages) { await expect(player.locator('.draw-picture')).toBeVisible(); await text(player, 'Ein lustiges Bild'); }
    await expect(page.locator('.draw-chains > details')).toHaveCount(3);
    await expect(page.locator('.draw-chains')).toContainText('GEHEIMER DRACHE');
    await expect(page.locator('.draw-chains li')).toHaveCount(9);
    await page.screenshot({ path: info.outputPath('kritzelpost.png'), fullPage: true });
    await page.getByRole('button', { name: 'Weiter', exact: true }).click();
    await expect(page.locator('.kg-over')).toBeVisible();
  } finally { await groupOf.close(); }
});

test('Bildunterschrift: verdeckte Beiträge, Abstimmen und gemeinsame Auflösung', async ({ page, app, browser }, info) => {
  const groupOf = await group(page, app, browser, info, 'bildunterschrift');
  const [, ben, clara] = groupOf.pages;
  try {
    await stroke(page); await page.getByRole('button', { name: 'Zeichnung abgeben', exact: true }).click();
    await text(ben, 'Geheime Bildunterschrift');
    await expect(clara.locator('#kg')).not.toContainText('Geheime Bildunterschrift');
    await text(clara, 'Das fliegende Sofa');
    await expect(page.locator('.draw-answers .btn')).toHaveCount(2);
    await page.locator('.draw-answers .btn').first().click();
    await ben.locator('.draw-answers .btn:not([disabled])').click();
    await clara.locator('.draw-answers .btn:not([disabled])').click();
    await expect(page.locator('.draw-results')).toContainText('Geheime Bildunterschrift');
    await expect(page.locator('.draw-results')).toContainText('Ben');
    await page.screenshot({ path: info.outputPath('bildunterschrift.png'), fullPage: true });
    await page.getByRole('button', { name: 'Weiter', exact: true }).click();
    await expect(page.locator('.kg-over')).toBeVisible();
  } finally { await groupOf.close(); }
});
