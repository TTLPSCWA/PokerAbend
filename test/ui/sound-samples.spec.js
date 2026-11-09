// Aufnahmen (Kenney, CC0) im echten Browser: Auslieferung, Dekodieren, Abspielen, Palettenwechsel.
import { test, expect, login, selectGame } from './helpers.js';

test('Aufnahmen werden ausgeliefert, im Browser dekodiert und statt der Ersatztöne gespielt', async ({ page, app }) => {
  await login(page, app);
  const res = await page.request.get(app.url + '/sound/samples/card-place/1.mp3');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toMatch(/audio\/mpeg/);
  await selectGame(page, 'maumau'); await page.locator('#host-form button[type=submit]').click();
  await expect.poll(() => page.evaluate(() => typeof lastState !== 'undefined' && !!lastState?.code)).toBe(true);
  await page.locator('#kg-main').click({ position: { x: 5, y: 5 } }); // Nutzergeste für Web Audio
  await page.evaluate(() => Sound.play('select'));
  await expect.poll(() => page.evaluate(() => Sound.samplesReady()), { timeout: 15000 }).toBeGreaterThanOrEqual(40);
  for (const event of ['card', 'draw', 'shuffle', 'dice', 'chips', 'win', 'lose', 'turn', 'confirm', 'deny', 'piece', 'capture']) {
    expect(await page.evaluate((e) => Sound.play(e), event), event).toBe(true);
  }
  // Andere Palette: deren Gruppen kommen nach.
  const before = await page.evaluate(() => Sound.samplesReady());
  await page.evaluate(() => Sound.use('casino'));
  await expect.poll(() => page.evaluate(() => Sound.samplesReady()), { timeout: 15000 }).toBeGreaterThan(before);
  expect(await page.evaluate(() => Sound.play('win'))).toBe(true);
});
