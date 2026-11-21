import { test, expect, login } from './helpers.js';

const guest = { required: true, active: false, login: true, code: 'discord-required', viewer: '#PRUEF' };
const moduleLinks = 'a:is([href="#tickets"],[href="#planung"],[href="#bestenliste"],[href="#rueckblick"])';
const planId = '12345678-1234-1234-1234-123456789abc';
const go = (page, hash) => page.evaluate((target) => { location.hash = target; }, hash);

async function mockAccess(page, current) {
  await page.route('**/api/discord-access', (route) => route.fulfill({ json: current() }));
  await page.route('**/me', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...await response.json(), discordAccess: current() } });
  });
}

test('AUTH-01: Seitenstart und Fokus erzeugen bei ausgeschaltetem Exklusivmodus keine Statusabfragen', async ({ page, app }) => {
  const requests = [];
  page.on('request', (request) => { requests.push(new URL(request.url()).pathname); });
  const settings = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/me/settings' && response.ok());
  await Promise.all([settings, login(page, app)]);
  await page.evaluate(async () => {
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
    await fetch('/me');
  });
  await expect(page.locator('#side-nav').locator(moduleLinks).first()).toHaveCount(1);
  expect(requests.filter((path) => path === '/api/discord-access')).toHaveLength(0);
  expect(requests.filter((path) => path === '/api/me/settings')).toHaveLength(1);
});

test('N03/A10: Gastnavigation, direkter Planlink, Sprache, Fokus und Konfigurationsfehler', async ({ page, app }) => {
  let status = guest;
  let protectedRequests = 0;
  page.on('request', (request) => {
    if (/^\/api\/(tickets|plans|ranked|leaderboard|evenings)(\/|$)/.test(new URL(request.url()).pathname)) protectedRequests++;
  });
  await mockAccess(page, () => status);
  await login(page, app);
  await go(page, '#start');
  for (const id of ['#side-nav', '#hub-tabbar', '#hub-menu-nav']) await expect(page.locator(id).locator(moduleLinks)).toHaveCount(0);
  await expect(page.locator('#hub-main .evening-links')).toHaveCount(0);

  await go(page, '#planung/' + planId);
  const main = page.locator('#hub-main');
  const signIn = main.locator('a[href^="/auth/discord/login?"]');
  await expect(main).toBeFocused();
  await expect(signIn).toHaveText('Mit Discord anmelden');
  expect(new URL(await signIn.getAttribute('href'), app.url).searchParams.get('next')).toBe('/#planung/' + planId);
  await page.keyboard.press('Tab');
  await expect(signIn).toBeFocused();
  await page.locator('#hub-language [data-language]').selectOption('en', { force: true });
  await expect(signIn).toHaveText('Sign in with Discord');

  status = { ...guest, login: false, code: 'discord-configuration' };
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(signIn).toHaveCount(0);
  await expect(main.getByRole('status')).toContainText(/Discord.*configured/);
  expect(protectedRequests).toBe(0);
});

test('N03/A04: Berechtigungsverlust entfernt Zugang und verwirft verspätete Antworten', async ({ page, app }) => {
  let status = { ...guest, active: true, code: null };
  await mockAccess(page, () => status);
  const marker = 'Vertraulicher Titel aus alter Antwort';
  const { promise: arrived, resolve: requestArrived } = Promise.withResolvers();
  const { promise: release, resolve: releaseRequest } = Promise.withResolvers();
  await page.route('**/api/tickets?*', async (route) => {
    requestArrived();
    await release;
    await route.fulfill({ json: { tickets: [{ title: marker }] } });
  });
  await login(page, app);
  try {
    await go(page, '#tickets');
    await expect(page.getByRole('heading', { name: 'Ticket-Board' })).toBeVisible();
    await arrived;
    status = guest;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByRole('link', { name: 'Mit Discord anmelden' })).toBeVisible();
    await expect(page.locator('#side-nav').locator(moduleLinks)).toHaveCount(0);
    const response = page.waitForResponse((res) => new URL(res.url()).pathname === '/api/tickets');
    releaseRequest();
    await (await response).finished();
    await expect(page.getByText(marker)).toHaveCount(0);
  } finally { releaseRequest(); }
});
