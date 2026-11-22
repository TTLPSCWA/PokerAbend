import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, login, test } from './helpers.js';
import { playStudio } from '../studio-playthrough.js';

const base = '/api/idle/studio';
const key = 'poker:studio:lease';
const evidence = fileURLToPath(new URL('../../docs/studio/', import.meta.url));
const button = (page, label) => page.getByRole('button', { name: label, exact: true });

async function ready(page, token) {
  await expect(button(page, 'Speichern')).toBeEnabled();
  const owner = await page.evaluate(({ key, token }) => sessionStorage.getItem(key) === token &&
    sessionStorage.getItem(key + ':tab') === window.name, { key, token });
  expect(owner).toBe(true);
}

async function openStudio(page) {
  await page.evaluate(() => { location.hash = '#spiele/idle'; });
  await page.locator('li[data-id="studio"] a[href="#idle/studio"]').click();
  const session = page.waitForResponse((response) => new URL(response.url()).pathname === base + '/session' &&
    response.request().method() === 'POST');
  await button(page, 'Studio starten').click();
  const response = await session;
  expect(response.ok()).toBe(true);
  const { token, readOnly } = await response.json();
  expect(typeof token).toBe('string');
  expect(readOnly).toBe(false);
  await ready(page, token);
  return token;
}

test('Studio bleibt ohne eigenen Schalter verborgen', async ({ page, app }) => {
  await login(page, app);
  expect((await (await page.request.get(app.url + '/me')).json()).idleGames).toEqual([]);
  expect((await page.request.get(app.url + base)).status()).toBe(404);
  await page.evaluate(() => { location.hash = '#idle/studio'; });
  await expect(page.getByText('Dieses Spiel ist hier nicht freigegeben.')).toBeVisible();
});

test.describe('Game Studio Tycoon auf isoliertem Testserver', () => {
  test.use({ idleStudio: true });

  test('regulärer Studio-Spielweg zeigt alle fünf Phasen auf Desktop und Mobil', async ({ page, app }, info) => {
    test.setTimeout(90000);
    await login(page, app);
    const catalog = (await (await page.request.get(app.url + '/me')).json()).idleGames;
    expect(catalog.map(({ id }) => id)).toEqual(['studio']);
    expect((await page.request.get(app.url + '/api/idle/spielhalle')).status()).toBe(404);
    const token = await openStudio(page);
    let at = 1790000000000, seq = 0, manual = 0;
    const headers = { 'x-idle-token': token, 'x-requested-with': 'spieleabend' };
    const read = async () => {
      const response = await page.request.get(app.url + base, { headers });
      expect(response.ok()).toBe(true);
      return response.json();
    };
    const post = async (path, state, extra = {}) => {
      const body = { id: 'studio-ui-' + ++seq, token, revision: state.revision,
        sessionVersion: state.sessionVersion, ...extra };
      const response = await page.request.post(app.url + base + path, { headers, data: body });
      expect(response.ok(), await response.text()).toBe(true);
      return response.json();
    };
    let state = await read();
    await playStudio({
      endgame: false,
      async view() { state = await read(); return state.view; },
      async wait(ms) { at += ms; await app.setIdleTime(at); },
      async command(action) {
        if (manual === 0 && action.type === 'start') {
          await page.getByLabel('Projekttitel').fill(action.name);
          await page.getByLabel('Testtiefe').selectOption(action.depth);
          const saving = page.waitForResponse((response) => new URL(response.url()).pathname === base + '/actions');
          const start = button(page, 'Projekt starten');
          if (info.project.name === 'mobil') await start.tap();
          else { await start.focus(); await start.press('Enter'); }
          expect((await saving).ok()).toBe(true);
          await expect(page.getByText(action.name, { exact: true })).toBeVisible();
          manual++;
          return;
        }
        Object.assign(state, await post('/actions', state, { action }));
      },
      async milestone(phase) {
        state = await read();
        expect(state.view.phase.id).toBe('GS-P' + phase);
        if (phase > 1) {
          await post('/save', state);
          state = await read();
          await page.reload();
          await ready(page, token);
        }
        await expect(page.locator('.gs-shell')).toHaveAttribute('data-phase', 'GS-P' + phase);
        if (phase >= 4) await page.getByRole('tab', { name: 'Ausbau' }).click();
        if (phase === 2) {
          const tab = page.getByRole('tab', { name: 'Projekte' });
          await tab.focus();
          await tab.press('End');
          await expect(page.getByRole('tab', { name: 'Forschung' })).toBeFocused();
        }
        const width = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(width).toBeLessThanOrEqual(page.viewportSize().width + 1);
        if (process.env.STUDIO_EVIDENCE === '1') {
          await page.screenshot({ path: join(evidence, 'GS-P' + phase + '-' + info.project.name + '.png'), fullPage: true });
        }
      },
    });
    await expect(page.getByRole('heading', { name: 'Engine-Lizenzen', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lizenz erteilen' })).toHaveCount(10);
  });

  test('Spielstand, signierter Export, Importbestätigung, Popup und Sprachwechsel', async ({ page, app, context }) => {
    test.setTimeout(60000);
    await login(page, app);
    const token = await openStudio(page);
    await button(page, 'Projekt starten').click();
    await expect(page.getByText('Ungespeicherte Aktionen', { exact: true })).toBeVisible();
    const download = page.waitForEvent('download');
    await button(page, 'Speichern & exportieren').click();
    const backup = await download;
    expect(backup.suggestedFilename()).toBe('studio-spielstand.spieleabend');
    await expect(page.getByText('Gespeichert · Rev. 1', { exact: true })).toBeVisible();
    const path = await backup.path();
    await page.locator('[data-gs-import]').setInputFiles(path);
    await expect(page.getByText('Diese Revision ist bereits aktiv.')).toBeVisible();
    await button(page, 'Auftragsarbeit starten').click();
    await expect(page.getByText('Ungespeicherte Aktionen', { exact: true })).toBeVisible();
    await page.locator('[data-gs-import]').setInputFiles(path);
    const modal = page.getByRole('dialog');
    await expect(modal).toContainText('Signatur, Spiel und Konto geprüft');
    await modal.getByRole('button', { name: 'Bestätigen', exact: true }).click();
    await expect(page.getByText('Gespeichert · Rev. 1', { exact: true })).toBeVisible();

    const popup = page.waitForEvent('popup');
    await page.evaluate(() => window.open(location.href, '_blank'));
    const second = await popup;
    try {
      await button(second, 'Bestätigten Stand öffnen').click();
      await expect(second.getByText('Nur Ansicht', { exact: true })).toBeVisible();
      await button(second, 'Schreibsitzung übernehmen').click();
      await expect(second.getByRole('dialog')).toContainText('anderen Tab');
      await second.getByRole('dialog').getByRole('button', { name: 'Bestätigen', exact: true }).click();
      await expect(second.getByText('Schreibsitzung übernommen.')).toBeVisible();
      expect((await page.request.get(app.url + base, { headers: { 'x-idle-token': token } })).status()).toBe(409);
    } finally { await second.close(); }
    await page.evaluate((storage) => { sessionStorage.removeItem(storage); I18n.select('en'); }, key);
    await page.goto(app.url + '/#idle/studio');
    await button(page, 'Open confirmed save').click();
    await expect(page.getByRole('heading', { name: 'Game Studio Tycoon' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Finances' })).toBeVisible();
  });

  test('Geräteverknüpfung lädt ausschließlich den bestätigten Studio-Stand des Kontos', async ({ page, app, browser }) => {
    await login(page, app);
    await openStudio(page);
    await button(page, 'Projekt starten').click();
    await expect(page.getByText('Ungespeicherte Aktionen', { exact: true })).toBeVisible();
    await button(page, 'Speichern').click();
    await expect(page.getByText('Gespeichert · Rev. 1', { exact: true })).toBeVisible();
    const headers = { 'x-requested-with': 'spieleabend' };
    const link = await page.request.post(app.url + '/api/identity/link/create', { headers, data: {} });
    expect(link.ok()).toBe(true);
    const { code } = await link.json();
    const other = await browser.newContext({ viewport: page.viewportSize() });
    try {
      const device = await other.newPage();
      await login(device, app, 'Ben');
      expect((await (await device.request.get(app.url + base)).json()).revision).toBe(0);
      const result = await device.request.post(app.url + '/api/identity/link/redeem', { headers, data: { code } });
      expect(result.ok(), await result.text()).toBe(true);
      expect((await (await device.request.get(app.url + base)).json()).revision).toBe(1);
    } finally { await other.close(); }
  });
});
