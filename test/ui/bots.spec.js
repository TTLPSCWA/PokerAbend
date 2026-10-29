import { test, expect, login, selectGame } from './helpers.js';

for (const [game, name] of [['poker', "Texas Hold'em"], ['farbenchaos', 'UNO']]) {
  test(`${name}: Host kann ohne Bots starten, Bots hinzufügen, wiederverbinden und entfernen`, async ({ page, app }, testInfo) => {
    await login(page, app);
    await selectGame(page, game);
    await page.locator('#host-form button[type=submit]').click();
    const hostMenu = page.locator(game === 'poker' ? '[data-panel="host"]' : '[data-kit-panel="host"]').first();
    await hostMenu.click();
    const controls = page.getByRole('region', { name: 'Computer-Mitspieler' });
    await expect(controls).toContainText('Ohne Bots');
    await controls.getByRole('button', { name: 'Bot hinzufügen', exact: true }).click();
    await expect(controls).toContainText('Bot 1 · Computer');
    await page.reload();
    await hostMenu.click();
    await expect(controls).toContainText('Bot 1 · Computer');
    await page.screenshot({ path: testInfo.outputPath('bots.png'), fullPage: true });
    await controls.getByRole('button', { name: 'Bot 1 entfernen', exact: true }).click();
    await expect(controls).toContainText('Ohne Bots');
  });
}

test('Bot spielt live, bleibt beim Spielwechsel; Gäste dürfen keine Bots oder Bot-Hosts anlegen', async ({ page, app, browser }) => {
  await login(page, app);
  await selectGame(page, 'viergewinnt');
  await page.locator('#host-form button[type=submit]').click();
  await page.locator('[data-kit-panel="host"]').first().click();
  await page.getByRole('button', { name: 'Bot hinzufügen', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Computer-Mitspieler' })).toContainText('Bot 1');
  const code = new URL(page.url()).searchParams.get('t');
  const context = await browser.newContext();
  try {
    const guest = await context.newPage();
    await login(guest, app);
    const response = await guest.evaluate((code) => new Promise((resolve) => socket.emit('join', { code, name: 'Ben' }, resolve)), code);
    expect(response.ok).toBe(true);
    const denied = await guest.evaluate(() => new Promise((resolve) => socket.emit('addBot', {}, resolve)));
    expect(denied.ok).toBe(false);
    expect(denied.error).toContain('Host');
    const hostReply = await page.evaluate(() => new Promise((resolve) => {
      const id = document.querySelector('[data-remove-bot]').dataset.removeBot;
      socket.emit('makeHost', { id }, resolve);
    }));
    expect(hostReply.ok).toBe(false);
    await page.locator('#switch-game').selectOption('schocken');
    await page.locator('[data-switch-game]').click();
    await page.locator('#dlg').getByRole('button', { name: 'Wechseln', exact: true }).click();
    await expect(page.locator('#kg-meta .blinds')).toHaveText('Schocken');
    await page.locator('[data-kit-panel="host"]').first().click();
    await expect(page.getByRole('region', { name: 'Computer-Mitspieler' })).toContainText('Bot 1');
    await page.getByRole('button', { name: 'Bot hinzufügen', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Computer-Mitspieler' })).toContainText('Bot 2');
    await page.locator('#kg-panel [data-kit="start"]').click();
    await expect(page.locator('#kg-meta')).not.toContainText('Noch nicht gestartet');
    await expect(page.getByRole('button', { name: 'Bot hinzufügen', exact: true })).toBeDisabled();
    // Host schaut zu; die Computer spielen ihre Würfe selbst.
    await expect(page.locator('#kg-meta')).toContainText(/Runde/, { timeout: 5000 });
    await expect.poll(async () => page.evaluate(() => new Promise((resolve) => socket.emit('history', {}, (r) => resolve(r.entries.some((e) => /Bot .*würfelt/.test(e.text))))))).toBe(true);
  } finally { await context.close(); }
});
