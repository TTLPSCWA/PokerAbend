import { readFileSync } from 'node:fs';
import { test, expect, login } from './helpers.js';

test.use({ ticketAdminPassword: 'Nur-fuer-Ticket-UI-Tests' });
async function board(page, app, name = 'Anna') {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await login(page, app, name);
  await page.locator(page.viewportSize().width < 641 ? '#hub-tabbar' : '#side-nav').getByRole('link', { name: 'Tickets', exact: true }).click();
  await expect(page).toHaveTitle('Tickets – Spieleabend');
  await expect(page.locator('.ticket-count')).toBeVisible();
}
async function create(page, title = 'Eine Idee für den Spieleabend', description = 'Eine ausführliche Beschreibung mit einem konkreten Vorschlag.') {
  await page.getByRole('button', { name: 'Ticket erstellen', exact: true }).click();
  const editor = page.locator('#ticket-editor');
  await editor.getByLabel('Titel', { exact: true }).fill(title);
  await editor.getByLabel('Beschreibung', { exact: true }).fill(description);
  await editor.getByRole('button', { name: 'Ticket erstellen', exact: true }).click();
  await expect(editor).not.toBeVisible(); await expect(page.locator('.ticket-detail h1')).toContainText(title);
}
async function admin(page, app) {
  await page.getByRole('button', { name: 'Verwaltung anmelden', exact: true }).click();
  await page.getByLabel('Admin-Passwort', { exact: true }).fill(app.ticketAdminPassword);
  await page.locator('#ticket-admin-form').getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(page.locator('.ticket-admin-on')).toBeVisible();
}
async function downloadText(page, name) {
  const promised = page.waitForEvent('download'); await page.getByRole('link', { name, exact: true }).click();
  const download = await promised; expect(download.suggestedFilename()).toMatch(/\.md$/);
  return readFileSync(await download.path(), 'utf8');
}

test('Tickets: Erstellen, sichere Texte, eigene Bearbeitung, Stimme nach Neuladen und Kommentardraft', async ({ page, app }, info) => {
  await board(page, app);
  await create(page, 'Ein Wunsch mit <b>Text</b>', 'Beschreibung mit <img src=x onerror="window.ticketXss=1">\nZweite Zeile für den Vorschlag.');
  await expect(page.locator('.ticket-description img')).toHaveCount(0); expect(await page.evaluate(() => window.ticketXss)).toBeUndefined();
  await expect(page.locator('#ticket-status-form')).toHaveCount(0);
  await page.locator('[data-ticket-vote]').click(); await expect(page.locator('[data-ticket-vote]')).toHaveAttribute('aria-pressed', 'true');
  await page.reload(); await expect(page.locator('[data-ticket-vote]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-ticket-vote] b')).toHaveText('1');
  await page.getByLabel('Dein Kommentar', { exact: true }).fill('Mein Entwurf bleibt beim Abstimmen stehen.');
  await page.locator('[data-ticket-vote]').click(); await expect(page.locator('[data-ticket-vote]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByLabel('Dein Kommentar', { exact: true })).toHaveValue('Mein Entwurf bleibt beim Abstimmen stehen.');
  await page.getByRole('button', { name: 'Kommentar senden', exact: true }).click();
  await expect(page.locator('.ticket-discussion ol')).toContainText('Mein Entwurf bleibt');
  await page.getByRole('button', { name: 'Ticket bearbeiten', exact: true }).click();
  await page.locator('#ticket-editor').getByLabel('Titel', { exact: true }).fill('Verbesserter Vorschlag für den Hub');
  await page.getByRole('button', { name: 'Änderungen speichern', exact: true }).click();
  await expect(page.locator('.ticket-detail h1')).toContainText('Verbesserter Vorschlag');
  const md = await downloadText(page, 'Ticket als Markdown'); expect(md).toContain('Verbesserter Vorschlag'); expect(md).toContain('Mein Entwurf bleibt'); expect(md).not.toContain('<img');
  await page.screenshot({ path: info.outputPath('ticket-detail.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Verwaltung: zweiter Browser, echte Rechte, Statusverlauf, Moderation und bestätigtes Löschen', async ({ page, app, browser }, info) => {
  await board(page, app); await create(page);
  await page.getByLabel('Dein Kommentar', { exact: true }).fill('Kommentar der Autorin');
  await page.getByRole('button', { name: 'Kommentar senden', exact: true }).click(); await expect(page.locator('.ticket-discussion ol')).toContainText('Kommentar der Autorin');
  const context = await browser.newContext({ viewport: page.viewportSize() }); const errors = [];
  try {
    const ben = await context.newPage(); ben.on('pageerror', (e) => errors.push(e.message));
    await board(ben, app, 'Ben'); await ben.locator('.ticket-card h2 a').click();
    await expect(ben.getByRole('button', { name: 'Ticket bearbeiten', exact: true })).toHaveCount(0);
    await expect(ben.getByRole('button', { name: 'Kommentar löschen', exact: true })).toHaveCount(0);
    await ben.locator('[data-ticket-vote]').click(); await expect(ben.locator('[data-ticket-vote]')).toHaveAttribute('aria-pressed', 'true');
    await admin(ben, app);
    await ben.getByLabel('Status verwalten', { exact: true }).selectOption('progress'); await ben.getByRole('button', { name: 'Status übernehmen', exact: true }).click();
    await expect(ben.locator('.ticket-detail .ticket-status')).toHaveText('In Arbeit');
    await ben.locator('.ticket-history summary').click(); await expect(ben.locator('.ticket-history')).toContainText('Neu → In Arbeit');
    await ben.screenshot({ path: info.outputPath('ticket-verwaltung.png'), fullPage: true });
    await ben.getByRole('button', { name: 'Kommentar löschen', exact: true }).click(); await ben.locator('#dlg-ok').click();
    await expect(ben.locator('.ticket-discussion ol')).not.toContainText('Kommentar der Autorin');
    await ben.getByRole('button', { name: 'Verwaltung abmelden', exact: true }).click(); await expect(ben.locator('#ticket-status-form')).toHaveCount(0);
    await page.getByRole('button', { name: 'Aktualisieren', exact: true }).click(); await expect(page.locator('.ticket-detail .ticket-status')).toHaveText('In Arbeit');
    await admin(ben, app); await ben.getByRole('button', { name: 'Ticket löschen', exact: true }).click();
    await ben.locator('#dlg-cancel').click(); await expect(ben.locator('.ticket-detail')).toBeVisible();
    await ben.getByRole('button', { name: 'Ticket löschen', exact: true }).click(); await ben.locator('#dlg-ok').click();
    await expect(ben.locator('.ticket-empty')).toBeVisible(); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('Board: Filter, Suche, Sortierung, gefilterter Markdown-Export und mobile Navigation', async ({ page, app }, info) => {
  await board(page, app);
  const rows = [
    { title: 'Fehler beim Poker', type: 'bug', game: 'poker' },
    { title: 'Idee für den Hub', type: 'idea', game: '' },
    { title: 'Eine zweite Idee', type: 'idea', game: '' },
  ];
  for (const row of rows) {
    const response = await page.request.post(app.url + '/api/tickets', { headers: { 'X-Requested-With': 'spieleabend' }, data: { ...row, description: 'Eine ausführliche Beschreibung für den Test.', name: 'Anna', avatar: '🦉' } });
    expect(response.status()).toBe(201);
  }
  await page.getByRole('button', { name: 'Aktualisieren', exact: true }).click(); await expect(page.locator('.ticket-card')).toHaveCount(3);
  const filters = page.locator('.ticket-filter-panel');
  if (await filters.getAttribute('open') === null) await filters.locator('summary').click();
  await page.getByLabel('Art', { exact: true }).selectOption('bug'); await page.getByLabel('Spiel', { exact: true }).selectOption('poker');
  await page.getByLabel('Tickets durchsuchen', { exact: true }).fill('Poker'); await page.getByLabel('Sortierung', { exact: true }).selectOption('new');
  await page.getByRole('button', { name: 'Filter anwenden', exact: true }).click(); await expect(page.locator('.ticket-card')).toHaveCount(1);
  const md = await downloadText(page, 'Markdown exportieren'); expect(md).toContain('Fehler beim Poker'); expect(md).not.toContain('Idee für den Hub');
  await page.getByRole('button', { name: 'Zurücksetzen', exact: true }).click(); await expect(page.locator('.ticket-card')).toHaveCount(3);
  if (await filters.getAttribute('open') !== null) await filters.locator('summary').click();
  await page.screenshot({ path: info.outputPath('ticket-board.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const box of await page.locator('.ticket-toolbar .btn').all()) expect((await box.boundingBox()).height).toBeGreaterThanOrEqual(44);
});

test('Langsames Laden des Ticket-Moduls: Anmeldung wartet auf die gemeinsamen Hub-Skripte', async ({ page, app }) => {
  await board(page, app);
  let release;
  await page.route('**/tickets.js', async (route) => { await new Promise((resolve) => { release = resolve; }); await route.continue(); });
  try {
    await page.reload({ waitUntil: 'commit' });
    await expect.poll(() => typeof release).toBe('function');
    await expect.poll(() => page.evaluate(() => account.games.length)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.readyState)).toBe('loading');
    await expect(page.locator('#hub')).not.toBeVisible();
  } finally { release?.(); }
  await expect(page.getByRole('heading', { name: 'Ticket-Board', exact: true })).toBeVisible();
  await expect(page.locator('.ticket-count')).toBeVisible();
  await page.unroute('**/tickets.js');
});

test.describe('Ohne konfigurierte Verwaltung', () => {
  test.use({ ticketAdminPassword: '' });
  test('Tickets bleiben nutzbar und die Verwaltung ist ausgeschaltet', async ({ page, app }) => {
    await board(page, app); await expect(page.locator('.ticket-admin-bar')).toContainText('noch nicht eingerichtet');
    await expect(page.getByRole('button', { name: 'Verwaltung anmelden', exact: true })).toHaveCount(0);
    await create(page); await expect(page.locator('.ticket-detail .ticket-status')).toHaveText('Neu');
  });
});
