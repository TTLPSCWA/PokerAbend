import { test, expect, login, selectGame } from './release-helpers.js';

const sizes = [[320,568],[360,800],[390,844],[641,720],[768,1024],[900,450],[1280,720],
  [1440,900],[1682,864],[1920,1080],[2560,1440],[3440,1440],[5120,1440]];

test('Kniffel keeps its controls, scores and compact player strip reachable across sizes', async ({page, app}, info) => {
  test.setTimeout(90000);
  await login(page, app);
  await expect.poll(() => page.evaluate(() => Boolean(socket?.connected))).toBe(true);
  await selectGame(page, 'kniffel');
  await page.locator('#host-form button[type=submit]').press('Enter');
  await expect.poll(() => page.evaluate(() => lastState?.game)).toBe('kniffel');
  await page.evaluate(async () => {
    await send('sit');
    for (let i = 0; i < 4; i++) await send('addBot');
    await send('start');
  });
  await expect(page.locator('.kn-sheet')).toBeVisible();
  await expect(page.locator('#kg-players')).toBeVisible();
  await expect(page.locator('#kg-main')).not.toHaveClass(/\bring\b/);
  const original = await page.evaluate(() => [lastState.you.id, lastState.code, lastState.g.rolls]);
  const roll = page.locator('.kn-tray [data-g=roll]');
  const total = page.locator('.kn-sheet tr.total');
  for (const [width, height] of sizes) {
    await page.setViewportSize({width, height});
    await expect.poll(() => page.locator('.kn-sheet-wrap').evaluate(sheet => {
      const tray = document.querySelector('.kn-tray');
      return sheet.getBoundingClientRect().top >= tray.getBoundingClientRect().bottom - 1;
    })).toBe(true);
    await page.locator('#kg-main').evaluate(main => { main.scrollTop = 0; });
    await page.locator('.kn-sheet-wrap').evaluate(sheet => { sheet.scrollTop = 0; });
    await expect(page.locator('.kn-tray')).toBeInViewport();
    if (width === 1682) {
      await expect(page.locator('.kn-sheet tr.kn-sum').nth(1)).toBeInViewport({ratio: 1});
      await page.screenshot({path: info.outputPath('kniffel-1682x864.png')});
    }
    await roll.evaluate(button => button.scrollIntoView({block:'nearest',inline:'nearest'}));
    await expect(roll).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    await total.evaluate(row => row.scrollIntoView({block:'nearest',inline:'nearest'}));
    await expect(total).toBeInViewport();
    const rects = await page.evaluate(() => {
      const header = document.querySelector('.kn-sheet th[scope=col]').getBoundingClientRect();
      const sheet = document.querySelector('.kn-sheet-wrap').getBoundingClientRect();
      return [header.top, sheet.top];
    });
    expect(rects[0]).toBeGreaterThanOrEqual(rects[1] - 2);
    if ([360, 3440].includes(width)) await page.screenshot({path: info.outputPath('kniffel-' + width + 'x' + height + '.png')});
  }
  expect(await page.evaluate(() => [lastState.you.id, lastState.code, lastState.g.rolls])).toEqual(original);
  await page.setViewportSize({width: 390, height: 844});
  await roll.click();
  await expect(page.locator('[data-g=keep]').first()).toBeVisible();
  await page.locator('[data-g=keep]').first().press('Space');
  await expect(page.locator('[data-g=keep]').first()).toBeFocused();
  await expect(page.locator('[data-g=keep]').first()).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-g=quick]').click();
  await expect(page.locator('.kn-quick-list [data-g=score][data-f=chance]')).toBeVisible();
  await expect(page.locator('.kn-sheet [data-g=score][data-f=chance]')).toBeVisible();
  await page.locator('.kn-quick-list [data-g=score][data-f=chance]').click();
  await expect.poll(() => page.evaluate(() => lastState.g.sheets[lastState.you.id].chance)).toBeGreaterThan(0);
});
