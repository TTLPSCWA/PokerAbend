import { test, expect, login, selectGame } from './helpers.js';

test('Beschädigte lokale Einstellungen blockieren weder Start noch Bibliothek oder Tisch', async ({ page, app }) => {
  await page.addInitScript(() => {
    localStorage.setItem('poker:name', JSON.stringify('Anna'));
    localStorage.setItem('poker:prefs', 'null');
    localStorage.setItem('poker:favs', '{}');
    localStorage.setItem('poker:recent', '"broken"');
    localStorage.setItem('poker:roadmapOpen', 'null');
  });
  await login(page, app);
  // Test all malformed object/array shapes without changing scalar session keys.
  expect(await page.evaluate(() => {
    const result = [];
    for (const value of [null, 42, 'broken', [], {}]) {
      localStorage.setItem('test:shape', JSON.stringify(value));
      result.push([Array.isArray(store.get('test:shape', [])), typeof store.get('test:shape', {}), Array.isArray(store.get('test:shape', {}))]);
    }
    localStorage.removeItem('test:shape');
    return result;
  })).toEqual(Array.from({ length: 5 }, () => [true, 'object', false]));
  await page.evaluate(() => { location.hash = '#spiele'; });
  await page.locator('#games-body [data-fav="hex"]').click();
  await expect(page.locator('#games-body [data-fav="hex"]')).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => { location.hash = '#roadmap'; });
  await expect(page.locator('.roadmap-stage').first()).toBeVisible();
  await selectGame(page, 'hex');
  await page.locator('#host-form button[type=submit]').click();
  await expect.poll(() => page.evaluate(() => lastState?.game)).toBe('hex');
  await expect(page.locator('#kg')).toBeVisible();
  expect(await page.evaluate(() => store.get('poker:recent', {}).hex)).toBeGreaterThan(0);
  expect(await page.evaluate(() => profile.name)).toBe('Anna');
});

test('Sprachwechsel erhält den Wert eines deutschen Zahlenentwurfs bis zur Abgabe', async ({ page, app }) => {
  await login(page, app);
  await selectGame(page, 'schaetzmeister');
  await page.locator('#host-form button[type=submit]').click();
  await expect.poll(() => page.evaluate(() => lastState?.game)).toBe('schaetzmeister');
  expect((await page.evaluate(() => send('sit'))).ok).toBe(true);
  expect((await page.evaluate(() => send('addBot'))).ok).toBe(true);
  expect((await page.evaluate(() => send('start'))).ok).toBe(true);
  await page.locator('#pk-in').fill('1.234');
  await page.locator('[data-kit-panel="me"]').click();
  await page.locator('#kg-panel [data-language]').selectOption('en');
  await expect(page.locator('#pk-in')).toHaveValue('1234');
  await page.locator('.panel-head [data-kit="close"]').click();
  await page.locator('.pk-send').click();
  await expect.poll(() => page.evaluate(() => lastState.g.mine)).toBe(1234);
});
