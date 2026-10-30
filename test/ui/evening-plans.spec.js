import { test, expect, login, selectGame } from './helpers.js';

async function createPlan(page, { title = 'Freitag <b>zusammen</b>', privatePlan = false, slots = 2 } = {}) {
  await page.getByRole('link', { name: 'Nächsten Abend planen', exact: true }).click();
  await page.getByRole('button', { name: 'Spieleabend planen', exact: true }).click();
  await page.getByLabel('Name des Abends', { exact: true }).fill(title);
  const times = [3, 4].map((day) => new Date(Date.now() + day * 86400000).toISOString().slice(0, 16));
  await page.getByLabel('Terminvorschlag 1', { exact: true }).fill(times[0]);
  if (slots > 1) { await page.getByRole('button', { name: 'Termin hinzufügen', exact: true }).click(); await page.getByLabel('Terminvorschlag 2', { exact: true }).fill(times[1]); }
  await page.locator('#plan-editor .plan-game-picker summary').first().click();
  await page.locator('#plan-create input[value=maumau]').check(); await page.locator('#plan-create input[value=poker]').check();
  if (privatePlan) await page.getByLabel('Nur über privaten Link auffindbar').check();
  await page.getByRole('button', { name: 'Planung erstellen', exact: true }).click();
  await expect(page.locator('#plan-body h1')).toHaveText(title);
  return page.url();
}
async function finalize(page) {
  await page.locator('.plan-manage summary').click(); await page.locator('#plan-finalize input[name=slot]').first().check();
  await page.locator('#plan-finalize input[value=maumau]').check(); await page.locator('#plan-finalize input[value=poker]').check();
  await page.locator('#plan-finalize button[type=submit]').click(); await expect(page.locator('.plan-fixed')).toBeVisible();
}

test('Planung: zwei Browser stimmen ab, schlagen Spiele vor und bereiten das gewählte Abendprogramm vor', async ({ page, app, browser }, info) => {
  test.setTimeout(60000); await login(page, app); const link = await createPlan(page);
  await expect(page.locator('#plan-body h1 b')).toHaveCount(0);
  await page.locator('#plan-ballot select').nth(0).selectOption('yes'); await page.locator('#plan-ballot select').nth(1).selectOption('maybe');
  await page.locator('#plan-ballot input[value=maumau]').check(); await page.getByRole('button', { name: 'Meine Antworten speichern', exact: true }).click();
  await expect(page.locator('.hub-head')).toContainText('1 Teilnehmer');
  const context = await browser.newContext({ viewport: page.viewportSize() });
  try {
    const guest = await context.newPage(); await login(guest, app, 'Ben'); await guest.goto(link);
    await expect(guest.locator('#plan-body h1')).toHaveText('Freitag <b>zusammen</b>'); await expect(guest.locator('.plan-manage')).toHaveCount(0);
    await guest.locator('#plan-ballot select').nth(0).selectOption('yes'); await guest.locator('#plan-ballot select').nth(1).selectOption('no');
    await guest.locator('#plan-ballot input[value=poker]').check();
    await guest.getByLabel('Verfügbares Spiel', { exact: true }).selectOption('viergewinnt'); await guest.getByRole('button', { name: 'Spiel vorschlagen', exact: true }).click();
    await expect(guest.locator('#plan-ballot input[value=poker]')).toBeChecked(); await expect(guest.locator('#plan-ballot input[value=viergewinnt]')).toBeVisible();
    await guest.getByRole('button', { name: 'Meine Antworten speichern', exact: true }).click(); await expect(guest.locator('.hub-head')).toContainText('2 Teilnehmer');
    await page.reload(); await expect(page.locator('#plan-ballot select').first()).toHaveValue('yes');
    await expect(page.locator('.plan-slots')).toContainText('2 Ja');
    await page.locator('.plan-people summary').click(); await expect(page.locator('.plan-people table')).toContainText('Ben');
    await page.screenshot({ path: info.outputPath('abend-abstimmung.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await finalize(page); await expect(page.locator('#plan-ballot')).toHaveCount(0); await expect(page.locator('.plan-fixed ol li')).toHaveCount(2);
    await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value) => { window.planLink = value; } } }); });
    await page.getByRole('button', { name: 'Link kopieren', exact: true }).click(); expect(await page.evaluate(() => window.planLink)).toBe(link);
    await page.screenshot({ path: info.outputPath('abend-festgelegt.png'), fullPage: true });
    await page.getByRole('button', { name: 'Abendprogramm vorbereiten', exact: true }).click(); await page.getByRole('button', { name: 'Neuen Tisch vorbereiten', exact: true }).click();
    await expect(page.locator('.program-banner')).toContainText('Programm vorbereitet');
    expect(await page.evaluate(() => lastState.partyProgram.config.entries.map((e) => e.game))).toEqual(['maumau', 'poker']);
    expect(await page.evaluate(() => lastState.partyProgram.status)).toBe('ready');
    await guest.reload(); await expect(guest.locator('.plan-fixed')).toBeVisible(); await expect(guest.locator('.plan-manage')).toHaveCount(0);
  } finally { await context.close(); }
});

test('Private Planung: Liste und Anmeldung, Direktlink, vorhandener Tisch, Wiederöffnen und Absagen', async ({ page, app, browser }) => {
  test.setTimeout(60000); await login(page, app); await selectGame(page, 'poker'); await page.locator('#host-form button[type=submit]').click();
  const code = await page.evaluate(() => lastState.code); await page.evaluate(() => parkRoom());
  const link = await createPlan(page, { title: 'Privater Abend', privatePlan: true, slots: 1 });
  const context = await browser.newContext({ viewport: page.viewportSize() });
  try {
    const guest = await context.newPage(); await login(guest, app, 'Ben'); await guest.evaluate(() => { location.hash = '#planung'; });
    await expect(guest.locator('#plan-results')).toContainText('0 Planungen');
    await context.clearCookies(); await guest.goto('about:blank'); await guest.goto(link); await expect(guest.getByLabel('Passwort', { exact: true })).toBeVisible();
    await guest.getByLabel('Passwort', { exact: true }).fill('Falsches Passwort'); await guest.getByRole('button', { name: 'Reinkommen', exact: true }).click();
    await expect(guest.locator('input[name=next]')).toHaveValue('/' + new URL(link).hash);
    await guest.getByLabel('Passwort', { exact: true }).fill(app.password); await guest.getByRole('button', { name: 'Reinkommen', exact: true }).click();
    await expect(guest).toHaveURL(link); await expect(guest.locator('#plan-body h1')).toHaveText('Privater Abend');
    await finalize(page); await page.getByRole('button', { name: 'Abendprogramm vorbereiten', exact: true }).click();
    await page.getByRole('button', { name: 'An meinem Tisch vorbereiten (privat)', exact: true }).click();
    await expect(page.locator('#poker-program')).toContainText('Privater Abend'); expect(await page.evaluate(() => lastState.code)).toBe(code); expect(await page.evaluate(() => lastState.unlisted)).toBe(true);
    await page.evaluate(() => parkRoom()); await page.goto(link); await page.getByRole('button', { name: 'Abendprogramm vorbereiten', exact: true }).click();
    await page.getByRole('button', { name: 'Neuen privaten Tisch vorbereiten', exact: true }).click(); await expect(page.locator('.program-banner')).toContainText('Privater Abend');
    expect(await page.evaluate(() => lastState.code)).not.toBe(code); expect(await page.evaluate(() => lastState.unlisted)).toBe(true);
    await page.evaluate(() => parkRoom()); await page.goto(link); await page.getByRole('button', { name: 'Abstimmung wieder öffnen', exact: true }).click();
    await expect(page.locator('#plan-ballot')).toBeVisible(); await page.getByRole('button', { name: 'Abend absagen', exact: true }).click(); await page.locator('#dlg-ok').click();
    await expect(page.locator('#plan-body')).toContainText('Dieser Abend wurde abgesagt');
    await page.getByRole('link', { name: 'Alle Planungen', exact: false }).click(); await expect(page.locator('.plan-card')).toHaveCount(1);
    await page.getByLabel('Planungen suchen', { exact: true }).fill('NICHTVORHANDEN'); await expect(page.locator('.plan-card')).toHaveCount(0);
    await page.getByLabel('Planungen suchen', { exact: true }).fill('Privater'); await expect(page.locator('.plan-card')).toHaveCount(1);
    await page.locator('.plan-card').click(); await page.getByRole('button', { name: 'Planung löschen', exact: true }).click(); await page.locator('#dlg-ok').click();
    await expect(page.locator('#plan-results')).toContainText('0 Planungen');
  } finally { await context.close(); }
});
