import { test, expect, login, selectGame } from './helpers.js';

async function host(page, app, id, bots = 1) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page, app); await selectGame(page, id);
  await page.locator('#host-form button[type=submit]').click();
  await page.getByRole('button', { name: 'Mitspielen', exact: true }).click();
  for (let i = 0; i < bots; i++) expect((await page.evaluate(() => send('addBot'))).ok).toBe(true);
  expect((await page.evaluate(() => send('start'))).ok).toBe(true);
}

test('6 nimmt!: verdeckt wählen, Bot, Aufdecken, Reihenwahl, Reconnect und Querformat', async ({ page, app }, info) => {
  await host(page, app, 'sechs-nimmt');
  await expect(page.locator('.sn-row')).toHaveCount(4);
  await expect(page.locator('.sn-hand .sn-card')).toHaveCount(10);
  const card = page.locator('.sn-hand [data-g=choose]').first();
  expect((await card.boundingBox()).width).toBeGreaterThanOrEqual(32);
  await card.click();
  await expect.poll(() => page.evaluate(() => lastState.g.ready)).toBe(true);
  await page.reload(); await expect(page.locator('.sn-row')).toHaveCount(4);
  // Kleine Karten können eine Reihenwahl verlangen; sie erfolgt über die sichtbaren Ziele.
  await expect.poll(async () => {
    const button = page.locator('.sn-take').first();
    if (await button.isVisible()) await button.click();
    return page.evaluate(() => lastState.g.trick);
  }, { timeout: 15000 }).toBe(2);
  await expect(page.locator('.sn-hand .sn-card')).toHaveCount(9);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('sechs-nimmt.png') });
  await page.setViewportSize({ width: 900, height: 450 });
  await expect(page.locator('.sn-row').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
