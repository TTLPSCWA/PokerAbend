import { test, expect, login, selectGame } from './helpers.js';

test('Abend-Modus: alle Kategorien planen, Brett → Poker → Party, Reconnect und gemeinsame Siegerehrung', async ({ page, app, browser }, info) => {
  test.setTimeout(90000); await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page, app); await selectGame(page, 'maumau');
  await page.locator('#host-form button[type=submit]').click(); await page.getByRole('button', { name: 'Mitspielen', exact: true }).click();
  const code = await page.evaluate(() => lastState.code), ownId = await page.evaluate(() => lastState.you.id);
  const context = await browser.newContext({ viewport: page.viewportSize() }), errors = [];
  try {
    const guest = await context.newPage(); guest.on('pageerror', (e) => errors.push(e.message)); await guest.emulateMedia({ reducedMotion: 'reduce' });
    await login(guest, app, 'Ben'); await guest.evaluate((code) => joinAndEnter(code, 'sit'), code);
    await expect.poll(() => page.evaluate(() => lastState.players.filter((p) => p.seated).length)).toBe(2);
    await page.locator('[data-kit-panel=host]').click(); await page.getByRole('button', { name: 'Abendprogramm planen', exact: true }).click();
    await expect(page.locator('#program-mode')).toHaveValue('abend');
    await expect(page.locator('[data-program-game="0"] option')).toHaveCount(46);
    await expect(page.locator('[data-program-game="0"] option[value=kniffel]')).toHaveCount(1);
    await expect(page.locator('[data-program-game="0"] option[value=monopoly]')).toHaveCount(1);
    await page.getByLabel('Programmname', { exact: true }).fill('Unser bunter Abend');
    await page.locator('[data-program-game="0"]').selectOption('viergewinnt');
    await page.getByRole('button', { name: 'Spiel hinzufügen', exact: true }).click(); await page.locator('[data-program-game="1"]').selectOption('poker');
    await page.locator('.program-entry').nth(1).locator('summary').click(); await page.locator('[data-program-setting=startStack][data-index="1"]').fill('2000');
    await page.getByRole('button', { name: 'Spiel hinzufügen', exact: true }).click(); await page.locator('[data-program-game="2"]').selectOption('zahlenzoo');
    await page.getByRole('button', { name: 'Als Vorlage speichern', exact: true }).click();
    await page.getByRole('button', { name: 'Vorlage laden', exact: true }).click(); await expect(page.locator('[data-program-game="1"]')).toHaveValue('poker');
    await page.getByRole('button', { name: 'Programm übernehmen', exact: true }).click();
    await page.locator('.program-controls [data-program=start]').click();
    await expect(page.locator('.kg-viergewinnt')).toBeVisible(); await expect(guest.locator('.kg-viergewinnt')).toBeVisible();
    for (let i = 0; i < 7; i++) {
      const own = await page.evaluate(() => lastState.turnId === lastState.you.id), active = own ? page : guest;
      expect((await active.evaluate((col) => send('drop', { col }), own ? 0 : 1)).ok).toBe(true);
    }
    await expect(page.locator('.kg-over')).toBeVisible(); await page.locator('.kg-over [data-kit=start]').click();
    await expect(page.locator('#game')).toBeVisible(); await expect(guest.locator('#game')).toBeVisible();
    await expect(page.locator('#poker-program')).toContainText('Spiel 2 von 3');
    await page.reload(); await expect(page.locator('#poker-program')).toContainText('Unser bunter Abend');
    expect(await page.evaluate(() => lastState.you.id)).toBe(ownId);
    const myTurn = await page.evaluate(() => lastState.hand.toAct === lastState.you.seat);
    expect((await (myTurn ? page : guest).evaluate(() => send('action', { type: 'fold' }))).ok).toBe(true);
    await expect(page.locator('#poker-program [data-program=next]')).toBeVisible();
    expect(await page.evaluate(() => lastState.partyProgram.results.length)).toBe(2);
    const fit = await page.evaluate(() => { const table = document.querySelector('#table').getBoundingClientRect(), dock = document.querySelector('#dock').getBoundingClientRect(); return table.bottom <= dock.top + 1 && dock.bottom <= innerHeight + 1; });
    expect(fit).toBe(true); await page.screenshot({ path: info.outputPath('abend-poker.png') });
    await page.locator('#poker-program [data-program=next]').click(); await expect(page.locator('.kg-zahlenzoo')).toBeVisible();
    await page.getByRole('button', { name: 'Alle fertig – weiter', exact: true }).click(); await page.getByRole('button', { name: 'Weiter', exact: true }).click();
    await expect(page.locator('.kg-over')).toContainText('Siegerehrung');
    await expect(page.locator('#kg-over-title')).toHaveText('Spieleabend beendet');
    await expect(page.locator('.kg-over .program-stand')).not.toContainText('Team 1');
    expect(await page.evaluate(() => lastState.partyProgram.results.length)).toBe(3);
    expect(await page.evaluate(() => lastState.partyProgram.standings.length)).toBe(2);
    expect(new URL(page.url()).searchParams.get('t')).toBe(code);
    await page.screenshot({ path: info.outputPath('abend-siegerehrung.png') }); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('Abend-Modus lässt sich auch direkt am Pokertisch vorbereiten und als Vorlage speichern', async ({ page, app }) => {
  await login(page, app); await selectGame(page, 'poker'); await page.locator('#host-form button[type=submit]').click();
  await page.locator('[data-sit]').first().click(); await page.evaluate(() => send('addBot'));
  await page.locator('#nav-host').click(); await page.getByRole('button', { name: 'Abendprogramm planen', exact: true }).click();
  await expect(page.locator('#program-mode')).toHaveValue('abend'); await expect(page.locator('[data-program-game="0"]')).toHaveValue('poker');
  await expect(page.locator('#program-form')).toContainText('Am Tisch sitzen 2');
  await page.locator('.program-entry summary').click(); await expect(page.locator('[data-program-setting=bigBlind]')).toBeVisible();
  await page.locator('[data-program-setting=bigBlind]').fill('200');
  await page.getByRole('button', { name: 'Als Vorlage speichern', exact: true }).click(); await page.getByRole('button', { name: 'Vorlage laden', exact: true }).click();
  await page.locator('.program-entry summary').click(); await expect(page.locator('[data-program-setting=bigBlind]')).toHaveValue('200');
  await page.getByRole('button', { name: 'Programm übernehmen', exact: true }).click(); await expect(page.locator('#poker-program')).toContainText('Programm vorbereitet');
});
