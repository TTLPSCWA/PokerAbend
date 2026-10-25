import { test, expect, login, screenshot } from './helpers.js';

const names = {
  poker: "Texas Hold'em", maumau: 'Mau-Mau', farbenchaos: 'UNO', maexchen: 'Mäxchen',
  schocken: 'Schocken', huetchen: 'Mensch ärgere Dich nicht', zehnetappen: 'Phase 10', stapelrennen: 'Skip-Bo',
  schwimmen: 'Schwimmen', blackjack: 'Blackjack', kniffel: 'Kniffel', schiffe: 'Schiffe versenken',
};

test('A1: Lobby zeigt alle Anzeigenamen mit unveränderten Spiel-IDs', async ({ page, app }) => {
  await login(page, app);
  for (const [id, name] of Object.entries(names)) {
    await expect(page.locator(`[data-game="${id}"] b`)).toHaveText(name);
  }
  await expect(page.locator('.game-card')).toHaveCount(Object.keys(names).length);
  await screenshot(page, 'lobby');
});

for (const id of ['farbenchaos', 'huetchen', 'zehnetappen', 'stapelrennen']) {
  test(`A1: ${names[id]} am Tisch, in den Regeln und nach Neuladen`, async ({ page, app }) => {
    await login(page, app);
    await page.locator(`[data-game="${id}"]`).click();
    await page.getByLabel('Dein Name').fill('Anna');
    await page.getByRole('button', { name: `${names[id]} hosten`, exact: true }).click();
    await expect(page.locator('#kg-meta .blinds')).toHaveText(names[id]);
    await page.getByRole('button', { name: 'Mitspielen', exact: true }).click();
    await expect(page.locator('#kg-players:visible, #kg-main.ring')).toContainText('Anna');
    await expect(page.getByRole('button', { name: 'Zuschauen', exact: true })).toBeVisible();
    const roomUrl = page.url();
    await page.getByRole('button', { name: 'Kurzregeln und Hausregeln', exact: true }).click();
    await page.getByRole('button', { name: 'Alle Regeln', exact: true }).click();
    await expect(page.locator('#kg-panel-body')).toBeVisible();
    await expect(page.locator('#kg-panel-body')).not.toContainText(/Farbenchaos|Hütchenrennen|Zehn Etappen|Stapelrennen/);
    await page.locator('[data-kit="close"].icon-btn').click();
    await screenshot(page, id);
    await page.reload();
    await expect(page.locator('#kg-meta .blinds')).toHaveText(names[id]);
    expect(page.url()).toBe(roomUrl);
    await expect(page.locator('#kg-players:visible, #kg-main.ring')).toContainText('Anna');
    await expect(page.getByRole('button', { name: 'Zuschauen', exact: true })).toBeVisible();
  });
}

test('A2: Spieleabend in Login, Lobby, Tab und Manifest; technische Sitzungsschlüssel bleiben', async ({ page, app, context }) => {
  await page.goto(app.url);
  await expect(page).toHaveTitle('Spieleabend – Passwort');
  await expect(page.getByRole('heading', { name: 'Spieleabend', exact: true })).toBeVisible();
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', /^data:image\/svg\+xml,/);
  await screenshot(page, 'login');
  const manifest = await (await page.request.get(app.url + '/manifest.webmanifest')).json();
  expect(manifest.name).toBe('Spieleabend');
  expect(manifest.short_name).toBe('Spieleabend');
  await login(page, app);
  await expect(page).toHaveTitle('Spieleabend');
  await expect(page.getByRole('heading', { name: 'Spieleabend', exact: true })).toBeVisible();
  await expect(page.locator('#lobby-foot')).toContainText('Ohne Benutzerkonto');
  await screenshot(page, 'lobby');
  await page.locator('[data-game="poker"]').click();
  await page.getByLabel('Dein Name').fill('Anna');
  await page.getByRole('button', { name: "Texas Hold'em hosten", exact: true }).click();
  await expect(page.locator('#game')).toBeVisible();
  await expect(page).toHaveTitle('Spieleabend');
  const code = new URL(page.url()).searchParams.get('t');
  const session = await page.evaluate((key) => localStorage.getItem(key), 'poker:session:' + code);
  expect(JSON.parse(session)).toMatch(/^[a-f0-9]+$/);
  expect((await context.cookies()).some((cookie) => cookie.name === 'pa_auth' && cookie.httpOnly)).toBe(true);
});

test('A3: Spielwechsel zeigt ausschließlich die zugehörigen Lobby-Einstellungen', async ({ page, app }) => {
  const fields = {
    poker: ['startStack', 'smallBlind', 'bigBlind'], maumau: ['handSize'], farbenchaos: ['handSize'], maexchen: ['lives'],
    schocken: [], huetchen: [], zehnetappen: [], stapelrennen: ['stockSize'],
    schwimmen: ['lives'], blackjack: ['startStack', 'minBet', 'maxBet'], kniffel: [], schiffe: ['turnTime'],
  };
  await login(page, app);
  await page.locator('[data-cf="startStack"]').fill('25000');
  for (const id of [...Object.keys(fields), 'poker', 'farbenchaos']) {
    await page.locator(`[data-game="${id}"]`).click();
    expect(await page.locator('#create-fields input').evaluateAll((inputs) => inputs.map((input) => input.dataset.cf))).toEqual(fields[id]);
    await expect(page.locator('#f-submit')).toHaveText(`${names[id]} hosten`);
    for (const key of fields[id]) {
      await expect(page.locator(`[data-cf="${key}"]`)).toBeVisible();
      await expect(page.locator(`[data-cf="${key}"]`)).toBeEnabled();
    }
  }
  await expect(page.getByLabel('Karten pro Spieler')).toHaveValue('7');
  await screenshot(page, 'lobby-uno');
  await page.getByLabel('Dein Name').fill('Anna');
  await page.getByLabel('Karten pro Spieler').fill('9');
  await page.getByRole('button', { name: 'UNO hosten', exact: true }).click();
  await expect(page.locator('#kg-meta .blinds')).toHaveText('UNO');
  await page.locator('[data-kit-panel="host"]').click();
  await expect(page.locator('[data-kit-set="handSize"]')).toHaveValue('9');
  await expect(page.locator('[data-kit-set="startStack"]')).toHaveCount(0);
});

test('A3: ausgeblendete Host-Einstellungen blockieren den Beitritt nicht', async ({ page, app, browser }) => {
  await login(page, app);
  await page.locator('[data-game="schocken"]').click();
  await page.getByLabel('Dein Name').fill('Anna');
  await page.getByRole('button', { name: 'Schocken hosten', exact: true }).click();
  await expect(page.locator('#kg-meta .blinds')).toHaveText('Schocken');
  const code = new URL(page.url()).searchParams.get('t');
  const guestContext = await browser.newContext({ viewport: page.viewportSize() });
  try {
    const guest = await guestContext.newPage();
    await login(guest, app);
    await guest.getByLabel('Dein Name').fill('Ben');
    await guest.locator('[data-cf="startStack"]').fill('0'); // als Poker-Einstellung ungültig
    await guest.getByRole('tab', { name: 'Lobby beitreten (Code)' }).click();
    await guest.getByRole('tab', { name: 'Spiel hosten', exact: true }).click();
    await expect(guest.locator('[data-cf="startStack"]')).toBeEnabled();
    await expect(guest.locator('#f-code')).toBeDisabled();
    expect(await guest.locator('#lobby-form').evaluate((form) => form.checkValidity())).toBe(false);
    await guest.getByRole('tab', { name: 'Lobby beitreten (Code)' }).click();
    await guest.getByLabel('Code', { exact: true }).fill(code);
    expect(await guest.locator('#lobby-form').evaluate((form) => form.checkValidity())).toBe(true);
    await expect(guest.locator('[data-cf="startStack"]')).toBeDisabled();
    await guest.getByRole('button', { name: 'Beitreten', exact: true }).click();
    await expect(guest.locator('#kg-meta .blinds')).toHaveText('Schocken');
    await guest.getByRole('button', { name: 'Mitspielen', exact: true }).click();
    await expect(guest.locator('#kg-players:visible, #kg-main.ring')).toContainText('Ben');
  } finally {
    await guestContext.close();
  }
});
