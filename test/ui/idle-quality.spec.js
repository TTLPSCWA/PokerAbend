import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { expect, login, test } from './helpers.js';

test.use({ idleHall: true, idleStudio: true, idleFactory: true });

const games = [
  { id: 'spielhalle', de: 'Die Spielhalle', en: 'The Game Hall', start: 'Spiel starten', shell: '.hall-shell' },
  { id: 'studio', de: 'Game Studio Tycoon', en: 'Game Studio Tycoon', start: 'Studio starten', shell: '.gs-shell' },
  { id: 'factory', de: 'Factory Empire', en: 'Factory Empire', start: 'Fabrik starten', shell: '.fe-shell' },
];
const button = (page, name) => page.getByRole('button', { name, exact: true });
const write = async (page, id, suffix, name, project) => {
  if (!process.env.IDLE_QA_SCREENSHOTS) return;
  const folder = resolve(process.env.IDLE_QA_SCREENSHOTS);
  await mkdir(folder, { recursive: true });
  await page.screenshot({ path: join(folder, id + '-' + project + '-' + suffix + '.png'), fullPage: true,
    animations: 'disabled', mask: [page.getByText(name, { exact: true })] });
};

async function openGame(page, game) {
  await page.evaluate((id) => { location.hash = '#idle/' + id; }, game.id);
  await expect(page.getByRole('heading', { name: game.de, exact: true })).toBeVisible();
  await button(page, game.start).click();
  await expect(page.locator(game.shell + '[data-phase]')).toBeVisible();
}

test('QA Idle: drei Spiele im selben Hub, Sprachwechsel, Schreibaktionen und Bedienung', async ({ page, app }, info) => {
  const name = 'Idle QA';
  await login(page, app, name);
  const my = await (await page.request.get(app.url + '/me')).json();
  expect(my.idleGames.map(({ id }) => id)).toEqual(games.map(({ id }) => id));
  for (const game of games) {
    await openGame(page, game);
    if (game.id === 'spielhalle') {
      await button(page, 'Kartenrunde spielen +5').click();
      await expect(page.getByText('Ungespeicherte Aktionen', { exact: true })).toBeVisible();
    }
    if (game.id === 'factory') {
      const tile = page.getByRole('button', { name: /^Kachel 9\/5,/ });
      await tile.click();
      await page.locator('.fe-shell select[name="rotation"]').selectOption('2');
      await button(page, 'Auf dieser Kachel bauen').click();
      await expect(page.getByText('Ungespeicherte Aktionen', { exact: true })).toBeVisible();
      await tile.click();
      await page.getByRole('tab', { name: 'Inspektor' }).click();
      await expect(page.getByText(/^Der Ausgang ist nicht verbunden\./)).toBeVisible();
    }
    const save = button(page, 'Speichern');
    if (info.project.name === 'mobil') await save.tap();
    else { await save.focus(); await save.press('Enter'); }
    await expect(page.getByText('Gespeichert · Rev. 1', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width + 1);
    await write(page, game.id, 'de', name, info.project.name);
  }
  await page.evaluate(() => { I18n.select('en'); });
  for (const game of games) {
    await page.goto(app.url + '/#idle/' + game.id);
    await expect(page.getByRole('heading', { name: game.en, exact: true })).toBeVisible();
    await expect(button(page, 'Save')).toBeVisible();
    await expect(page.getByText(/^Saved · rev\. 1$/i)).toBeVisible();
    if (game.id === 'factory') {
      await page.getByRole('button', { name: /^Tile 9\/5,/ }).click();
      await page.getByRole('tab', { name: 'Inspector' }).click();
      await expect(page.getByText(/^The outlet is disconnected\./)).toBeVisible();
    }
  }
});

async function openLaterStudio(page, app) {
  const token = await page.evaluate(() => sessionStorage.getItem('poker:studio:lease'));
  const url = app.url + '/api/idle/studio';
  const headers = { 'x-requested-with': 'spieleabend', 'x-idle-token': token };
  let at = 1_790_000_000_000, sequence = 0;
  const state = async () => {
    const response = await page.request.get(url, { headers });
    expect(response.ok()).toBe(true);
    return response.json();
  };
  const action = async (value) => {
    const { revision, sessionVersion } = await state();
    const result = await page.request.post(url + '/actions', { headers,
      data: { id: 'qa-scroll-' + ++sequence, token, revision, sessionVersion, action: value } });
    expect(result.ok(), await result.text()).toBe(true);
  };
  for (const [genre, topic] of [['puzzle', 'animals'], ['adventure', 'fantasy']]) {
    await action({ type: 'start', name: 'Testprojekt ' + genre, genre, topic, size: 'mini', depth: 'rush',
      audience: 'casual', platform: 'pc', team: 1 });
    at += 80_000;
    await app.setIdleTime(at);
    await action({ type: 'release', id: (await state()).view.data.projects[0].id });
  }
  await app.setIdleTime(at + 4 * 3_600_000);
  await page.reload();
  await expect(page.locator('.gs-shell')).toHaveAttribute('data-phase', 'GS-P2');
}

for (const entry of [games[1], games[2]]) {
  test('QA Idle: ' + entry.id + ' hält den aktiven Tab sichtbar beim Aktualisieren', async ({ page, app }, info) => {
    test.skip(info.project.name !== 'mobil', 'Horizontal scroll only in the narrow breakpoint.');
    await page.setViewportSize({ width: 300, height: 740 });
    const name = 'Idle QA';
    await login(page, app, name);
    await page.clock.install();
    await openGame(page, entry);
    if (entry.id === 'studio') await openLaterStudio(page, app);
    const tabs = page.getByRole('tablist');
    const last = tabs.getByRole('tab').last();
    await last.tap();
    await expect(last).toBeFocused();
    await expect(last).toHaveAttribute('aria-selected', 'true');
    const left = await tabs.evaluate((node) => node.scrollLeft);
    expect(left).toBeGreaterThan(0);
    const read = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/idle/' + entry.id);
    await page.clock.runFor(11_000);
    expect((await read).ok()).toBe(true);
    await expect(last).toHaveAttribute('aria-selected', 'true');
    await expect(last).toBeFocused();
    await expect.poll(() => tabs.evaluate((node) => node.scrollLeft)).toBeGreaterThanOrEqual(left - 1);
    await write(page, entry.id, 'scroll', name, info.project.name);
    await last.press('Home');
    await expect(tabs.getByRole('tab').first()).toBeFocused();
  });
}
