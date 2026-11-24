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

const accessibilityCases = [
  { ...games[0], file: '[data-hall-import]', importTitle: 'Ungespeicherte Aktionen verwerfen' },
  { ...games[1], file: '[data-gs-import]', importTitle: 'Bestätigte Revision laden' },
  { ...games[2], file: '[data-fe-import]', importTitle: 'Bestätigte Revision laden' },
];

async function makeUnsavedChanges(page, id) {
  if (id === 'spielhalle') {
    const round = page.getByRole('button', { name: /^Kartenrunde spielen/ });
    await round.focus();
    await round.press('Space');
  } else if (id === 'studio') {
    const project = button(page, 'Projekt starten');
    await project.focus();
    await project.press('Enter');
  } else {
    const tabs = page.getByRole('tablist');
    const start = tabs.getByRole('tab').first();
    await start.focus();
    await start.press('ArrowRight');
    const inspector = tabs.getByRole('tab', { name: 'Inspektor' });
    await expect(inspector).toBeFocused();
    await inspector.press('ArrowRight');
    await expect(tabs.getByRole('tab', { name: 'Material' })).toBeFocused();
    const mine = button(page, 'Manuell abbauen · Eisenerz');
    await mine.focus();
    await mine.press('Space');
  }
  await expect(page.getByText('Ungespeicherte Aktionen', { exact: true })).toBeVisible();
}

for (const game of accessibilityCases) {
  test('Idle Bedienung: ' + game.id + ' hält den Tastaturfokus bei Start, Datei und modaler Bestätigung', async ({ page, app }) => {
    await login(page, app, 'Idle Tastatur');
    await page.goto(app.url + '/#idle/' + game.id);
    const start = button(page, game.start);
    await start.focus();
    await start.press('Enter');
    const shell = page.locator(game.shell + '[data-phase]');
    await expect(shell).toBeVisible();
    const save = button(page, 'Speichern');
    await expect(save).toBeFocused();
    expect(await save.evaluate((node) => getComputedStyle(node).outlineStyle)).toBe('solid');

    const exportButton = button(page, 'Speichern & exportieren');
    await exportButton.focus();
    const download = page.waitForEvent('download');
    await exportButton.press('Space');
    const path = await (await download).path();
    const saved = page.getByText('Gespeichert · Rev. 1', { exact: true });
    await expect(saved).toBeVisible();

    const file = page.locator(game.file);
    await file.focus();
    await file.setInputFiles({ name: 'too-large.spieleabend', mimeType: 'text/plain', buffer: Buffer.alloc(350_001) });
    const notice = shell.getByRole('status');
    await expect(notice).not.toBeEmpty();
    await expect(saved).toBeVisible();
    await expect(file).toBeFocused();

    await makeUnsavedChanges(page, game.id);
    await file.focus();
    await file.setInputFiles(path);
    const modal = page.getByRole('dialog');
    const cancel = modal.getByRole('button', { name: 'Abbrechen', exact: true });
    const confirm = modal.getByRole('button', { name: 'Bestätigen', exact: true });
    await expect(modal).toBeVisible();
    await expect(modal).toHaveAccessibleName(game.importTitle);
    await expect(modal).toHaveAccessibleDescription(/bestätigt|geprüft/i);
    await expect(cancel).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(confirm).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(cancel).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
    await expect(file).toBeFocused();
    await expect(file).toHaveValue('');
    await expect(page.getByText('Ungespeicherte Aktionen', { exact: true })).toBeVisible();
  });
}

test('Idle Bedienung: fünf Bildschirmgrößen und reduzierte Bewegung', async ({ page, app }) => {
  test.setTimeout(60_000);
  await login(page, app, 'Idle Viewports');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const game of accessibilityCases) {
    await openGame(page, game);
    const shell = page.locator(game.shell + '[data-phase]');
    for (const width of [320, 375, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: width <= 390 ? 740 : 900 });
      await expect(shell).toBeVisible();
      const save = button(page, 'Speichern');
      await save.scrollIntoViewIfNeeded();
      const rect = await save.boundingBox();
      expect(rect.x, game.id + ' save left at ' + width).toBeGreaterThanOrEqual(-1);
      expect(rect.x + rect.width, game.id + ' save right at ' + width).toBeLessThanOrEqual(width + 1);
      expect(rect.height, game.id + ' save hit target at ' + width).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), game.id + ' document width at ' + width).toBeLessThanOrEqual(width + 1);
    }
    if (game.id !== 'spielhalle') {
      await page.setViewportSize({ width: 320, height: 740 });
      const tabs = shell.getByRole('tablist').getByRole('tab');
      await tabs.first().focus();
      await tabs.first().press('End');
      await expect(tabs.last()).toBeFocused();
      await expect(tabs.last()).toHaveAttribute('aria-selected', 'true');
      await expect(tabs.last()).toBeVisible();
    }
    expect(await shell.evaluate((node) => ({
      reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
      moving: node.getAnimations({ subtree: true }).filter((animation) => animation.playState === 'running').length,
    }))).toEqual({ reduced: true, moving: 0 });
  }
});
