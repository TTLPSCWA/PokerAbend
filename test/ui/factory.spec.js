import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, login, test } from './helpers.js';
import { playFactory } from '../factory-playthrough.js';

const base = '/api/idle/factory';
const key = 'poker:factory:lease';
const evidence = fileURLToPath(new URL('../../docs/factory/', import.meta.url));
const button = (page, label) => page.getByRole('button', { name: label, exact: true });

async function writable(page, token) {
  await expect(button(page, 'Speichern')).toBeEnabled();
  const owner = await page.evaluate(({ key, token }) => sessionStorage.getItem(key) === token &&
    sessionStorage.getItem(key + ':tab') === window.name, { key, token });
  expect(owner).toBe(true);
}

async function start(page) {
  await page.evaluate(() => { location.hash = '#spiele/idle'; });
  await page.locator('li[data-id="factory"] a[href="#idle/factory"]').click();
  const session = page.waitForResponse((response) => new URL(response.url()).pathname === base + '/session' &&
    response.request().method() === 'POST');
  await button(page, 'Fabrik starten').click();
  const response = await session;
  expect(response.ok()).toBe(true);
  const { token, readOnly } = await response.json();
  expect(typeof token).toBe('string');
  expect(readOnly).toBe(false);
  await writable(page, token);
  return token;
}

test('Factory bleibt ohne eigenen Schalter verborgen', async ({ page, app }) => {
  await login(page, app);
  expect((await (await page.request.get(app.url + '/me')).json()).idleGames).toEqual([]);
  expect((await page.request.get(app.url + base)).status()).toBe(404);
  await page.evaluate(() => { location.hash = '#idle/factory'; });
  await expect(page.getByText('Dieses Spiel ist hier nicht freigegeben.')).toBeVisible();
});

test.describe('Factory Empire auf isoliertem Testserver', () => {
  test.use({ idleFactory: true });

  test('regulärer Spielweg über HTTP, fünf Phasen und Desktop-Endgame', async ({ page, app }, info) => {
    test.setTimeout(180_000); // Endgame uses the public API and honours its real rate limits.
    await login(page, app);
    const catalog = (await (await page.request.get(app.url + '/me')).json()).idleGames;
    expect(catalog.map(({ id }) => id)).toEqual(['factory']);
    for (const game of ['studio', 'spielhalle']) {
      expect((await page.request.get(app.url + '/api/idle/' + game)).status()).toBe(404);
    }
    const token = await start(page);
    let at = 1790000000000, seq = 0, first = true;
    let useUi = true;
    const headers = { 'x-idle-token': token, 'x-requested-with': 'spieleabend' };
    async function endpoint(path, body) {
      const options = body ? { headers, data: body } : { headers };
      const call = () => body ? page.request.post(app.url + base + path, options) : page.request.get(app.url + base + path, options);
      let response = await call();
      if (response.status() === 429) {
        const retry = Number(response.headers()['retry-after']);
        expect(retry).toBeGreaterThan(0);
        expect(retry).toBeLessThanOrEqual(60);
        await new Promise((resolve) => setTimeout(resolve, (retry + 1) * 1000));
        response = await call();
      }
      expect(response.ok(), await response.text()).toBe(true);
      return response.json();
    }
    let state = await endpoint('');
    const post = (path, fields = {}) => endpoint(path, { id: 'factory-ui-' + ++seq, token,
      revision: state.revision, sessionVersion: state.sessionVersion, ...fields });
    await playFactory({
      stopAfter: info.project.name === 'mobil' ? 5 : undefined,
      async view() { state = await endpoint(''); return state.view; },
      async wait(ms) { at += ms; await app.setIdleTime(at); },
      async command(action) {
        if (first && action.type === 'layout') {
          await page.getByRole('button', { name: /Kachel 9\/5/ }).click();
          const build = button(page, 'Auf dieser Kachel bauen');
          const applied = page.waitForResponse((response) => new URL(response.url()).pathname === base + '/actions');
          if (info.project.name === 'mobil') await build.tap();
          else { await build.focus(); await build.press('Enter'); }
          expect((await applied).ok()).toBe(true);
          await expect(page.getByText('Ungespeicherte Aktionen', { exact: true })).toBeVisible();
          state = await endpoint('');
          first = false;
          return;
        }
        Object.assign(state, await post('/actions', { action }));
      },
      async milestone(phase, complete) {
        state = await endpoint('');
        expect(state.view.phase.id).toBe('FE-P' + phase);
        if (complete) {
          expect(state.view.progress.every(({ met }) => met)).toBe(true);
          expect(Number(state.view.data.record.runControlModules)).toBeGreaterThanOrEqual(10000);
          await post('/save');
          return;
        }
        if (phase > 1) {
          await post('/save');
          state = await endpoint('');
          await page.reload();
          await writable(page, token);
        }
        await expect(page.locator('.fe-shell')).toHaveAttribute('data-phase', 'FE-P' + phase);
        if (phase >= 4) await page.getByRole('tab', { name: 'Regionen und Bahn' }).click();
        if (phase === 3) await page.getByRole('tab', { name: 'Aufträge' }).click();
        if (phase === 1) {
          const tile = page.getByRole('button', { name: /Kachel 0\/0/ });
          await tile.focus();
          await tile.press('ArrowRight');
          await expect(page.getByRole('button', { name: /Kachel 1\/0/ })).toBeFocused();
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width + 1);
        if (process.env.FACTORY_EVIDENCE === '1') {
          await page.screenshot({ path: join(evidence, 'FE-P' + phase + '-' + info.project.name + '.png'), fullPage: true });
        }
        if (phase === 5 && info.project.name === 'desktop') {
          await page.evaluate(() => { location.hash = '#spiele/idle'; });
          await expect(page.locator('.fe-shell')).toHaveCount(0);
          useUi = false;
        }
      },
    });
    expect(useUi).toBe(info.project.name === 'mobil');
  });

  test('Savepoint, Export, Import, Tab-Übernahme und Sprachwechsel', async ({ page, app }) => {
    test.setTimeout(60_000);
    await login(page, app);
    const token = await start(page);
    await page.getByRole('tab', { name: 'Material', exact: true }).click();
    await button(page, 'Manuell abbauen · Eisenerz').click();
    await expect(page.getByText('Ungespeicherte Aktionen', { exact: true })).toBeVisible();
    const downloadEvent = page.waitForEvent('download');
    await button(page, 'Speichern & exportieren').click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe('factory-spielstand.spieleabend');
    await expect(page.getByText('Gespeichert · Rev. 1', { exact: true })).toBeVisible();
    const path = await download.path();
    await page.locator('[data-fe-import]').setInputFiles(path);
    await expect(page.getByText('Diese Revision ist bereits aktiv.')).toBeVisible();
    await button(page, 'Verkaufen · Eisenerz').click();
    await expect(page.getByText('Ungespeicherte Aktionen', { exact: true })).toBeVisible();
    await page.locator('[data-fe-import]').setInputFiles(path);
    const modal = page.getByRole('dialog');
    await expect(modal).toContainText('Signatur, Spiel und Konto geprüft');
    await modal.getByRole('button', { name: 'Bestätigen', exact: true }).click();
    await expect(page.getByText('Gespeichert · Rev. 1', { exact: true })).toBeVisible();
    const popup = page.waitForEvent('popup');
    await page.evaluate(() => window.open(location.href, '_blank'));
    const other = await popup;
    try {
      await button(other, 'Bestätigten Stand öffnen').click();
      await expect(other.getByText('Nur Ansicht', { exact: true })).toBeVisible();
      await button(other, 'Schreibsitzung übernehmen').click();
      await expect(other.getByRole('dialog')).toContainText('anderen Tabs');
      await other.getByRole('dialog').getByRole('button', { name: 'Bestätigen', exact: true }).click();
      await expect(other.getByText('Schreibsitzung übernommen.')).toBeVisible();
      expect((await page.request.get(app.url + base, { headers: { 'x-idle-token': token } })).status()).toBe(409);
    } finally { await other.close(); }
    await page.evaluate((storage) => { sessionStorage.removeItem(storage); I18n.select('en'); }, key);
    await page.goto(app.url + '/#idle/factory');
    await button(page, 'Open confirmed save').click();
    await expect(page.getByRole('heading', { name: 'Factory Empire' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Materials' })).toBeVisible();
  });

  test('Verknüpftes Gerät erhält nur den bestätigten Factory-Spielstand', async ({ page, app, browser }) => {
    await login(page, app);
    await start(page);
    await button(page, 'Speichern').click();
    await expect(page.getByText('Gespeichert · Rev. 1', { exact: true })).toBeVisible();
    const headers = { 'x-requested-with': 'spieleabend' };
    const link = await page.request.post(app.url + '/api/identity/link/create', { headers, data: {} });
    expect(link.ok()).toBe(true);
    const { code } = await link.json();
    const device = await browser.newContext();
    try {
      const second = await device.newPage();
      await login(second, app, 'Ben');
      expect((await (await second.request.get(app.url + base)).json()).revision).toBe(0);
      expect((await second.request.post(app.url + '/api/identity/link/redeem', { headers, data: { code } })).ok()).toBe(true);
      expect((await (await second.request.get(app.url + base)).json()).revision).toBe(1);
    } finally { await device.close(); }
  });
});
