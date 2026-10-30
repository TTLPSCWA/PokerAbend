import { test, expect, login, selectGame } from './helpers.js';

test('Abend-Rückblick: echte Partie, Gesamtwertung, Verlauf, Export, Direktlink und Hub-Suche', async ({ page, app, browser }, info) => {
  test.setTimeout(60000); await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page, app); await selectGame(page, 'viergewinnt'); await page.locator('#host-form button[type=submit]').click();
  await page.getByRole('button', { name: 'Mitspielen', exact: true }).click();
  const code = await page.evaluate(() => lastState.code), context = await browser.newContext({ viewport: page.viewportSize() });
  try {
    const guest = await context.newPage(); await login(guest, app, 'Ben'); await guest.evaluate((code) => joinAndEnter(code, 'sit'), code);
    await expect.poll(() => page.evaluate(() => lastState.players.filter((p) => p.seated).length)).toBe(2);
    await page.locator('[data-kit-panel=host]').click(); await page.getByRole('button', { name: 'Abendprogramm planen', exact: true }).click();
    await page.getByLabel('Programmname', { exact: true }).fill('Freitagsrunde <b>');
    await page.getByRole('button', { name: 'Programm übernehmen', exact: true }).click(); await page.locator('.program-controls [data-program=start]').click();
    await page.locator('#kg-panel .icon-btn[data-kit=close]').click();
    for (let i = 0; i < 7; i++) {
      const own = await page.evaluate(() => lastState.turnId === lastState.you.id);
      expect((await (own ? page : guest).evaluate((col) => send('drop', { col }), own ? 0 : 1)).ok).toBe(true);
    }
    await expect(page.locator('.kg-over')).toContainText('Siegerehrung');
    const id = await page.evaluate(() => lastState.partyProgram.id);
    await page.locator('.kg-over [data-review-open]').click();
    await expect(page).toHaveURL(app.url + '/#rueckblick/' + id);
    await expect(page.locator('#review-body h1')).toHaveText('Freitagsrunde <b>'); await expect(page.locator('#review-body h1 b')).toHaveCount(0);
    await expect(page.locator('.review-winner')).toContainText('Anna'); await expect(page.locator('#review-chart svg')).toBeVisible();
    await page.getByLabel('Anzeige', { exact: true }).selectOption('p1'); await expect(page.locator('.review-legend')).toHaveText('Ben');
    await page.locator('.review-stations summary').click(); await expect(page.locator('.review-stations table')).toContainText('Abendpunkte');
    await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => { window.copiedReview = text; } } }); });
    await page.getByRole('button', { name: 'Link kopieren', exact: true }).click(); expect(await page.evaluate(() => window.copiedReview)).toBe(app.url + '/#rueckblick/' + id);
    const download = page.waitForEvent('download'); await page.getByRole('link', { name: 'Als Text speichern' }).click(); expect((await download).suggestedFilename()).toBe('spieleabend-' + id + '.md');
    await page.screenshot({ path: info.outputPath('abend-rueckblick.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('link', { name: 'Alle Rückblicke', exact: false }).click(); await expect(page.locator('.review-card')).toHaveCount(1);
    await page.getByLabel('Rückblicke suchen').fill('NICHTVORHANDEN'); await expect(page.locator('.review-card')).toHaveCount(0);
    await page.getByLabel('Rückblicke suchen').fill('Ben'); await expect(page.locator('.review-card')).toHaveCount(1);
    await page.locator('.review-card').click(); await page.reload(); await expect(page.locator('#review-body h1')).toHaveText('Freitagsrunde <b>');
    // Der Hub-Einstieg bleibt auch mit den sechs mobilen Hauptreitern erreichbar.
    await page.evaluate(() => { location.hash = '#bestenliste'; }); await page.getByRole('link', { name: 'Abend-Rückblicke öffnen', exact: true }).click();
    await expect(page.locator('.review-card')).toHaveCount(1);
    expect((await page.request.get(app.url + '/api/evenings/' + id)).ok()).toBe(true);
  } finally { await context.close(); }
});

test('Privater Rückblick: allgemeine Liste verborgen, bekannter Link erreichbar und nach Tischende erhalten', async ({ page, app, browser }) => {
  test.setTimeout(60000); await login(page, app); await selectGame(page, 'zahlenzoo'); await page.locator('#host-form button[type=submit]').click();
  await page.getByRole('button', { name: 'Mitspielen', exact: true }).click(); await page.evaluate(() => send('addBot'));
  await page.evaluate(() => send('unlisted', { value: true }));
  expect((await page.evaluate(() => send('programSave', { name: 'Privater Abend', mode: 'abend', entries: [{ game: 'zahlenzoo', settings: { rounds: 1 } }] }))).ok).toBe(true);
  await page.evaluate(() => send('programStart'));
  await page.getByRole('button', { name: 'Alle fertig – weiter', exact: true }).click(); await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await expect(page.locator('.kg-over')).toContainText('Siegerehrung'); const { id, code } = await page.evaluate(() => ({ id: lastState.partyProgram.id, code: lastState.code }));
  await page.locator('.kg-over [data-review-open]').click(); await expect(page.locator('#review-body')).toContainText('Privater Rückblick');
  await page.getByRole('link', { name: 'Alle Rückblicke', exact: false }).click(); await expect(page.locator('.review-card')).toHaveCount(1);
  const context = await browser.newContext({ viewport: page.viewportSize() });
  try {
    const guest = await context.newPage(); await login(guest, app, 'Zoe'); await guest.evaluate(() => { location.hash = '#rueckblick'; });
    await expect(guest.locator('#review-results')).toContainText('0 Rückblicke'); await expect(guest.locator('.review-card')).toHaveCount(0);
    await guest.goto(app.url + '/#rueckblick/' + id); await expect(guest.locator('#review-body h1')).toHaveText('Privater Abend');
    // Zum Tisch zurückkehren und wirklich schließen: das Archiv bleibt erhalten.
    expect((await page.evaluate(async (code) => { await joinAndEnter(code); return send('closeTable'); }, code)).ok).toBe(true);
    await guest.reload(); await expect(guest.locator('#review-body h1')).toHaveText('Privater Abend');
  } finally { await context.close(); }
});
