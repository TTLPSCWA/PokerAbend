import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, login, test } from './helpers.js';
import { playHall } from '../spielhalle-playthrough.js';

const game = '/api/idle/spielhalle';
const initialTime = 1_790_000_000_000;
const evidence = fileURLToPath(new URL('../../docs/spielhalle/', import.meta.url));
const leaseKey = 'poker:spielhalle:lease';
const openFromHub = async (page) => {
  await page.evaluate(() => { location.hash = '#spiele/idle'; });
  await expect(page.getByRole('heading', { name: 'Idle', exact: true })).toBeVisible();
  await page.locator('li[data-id="spielhalle"] a[href="#idle/spielhalle"]').click();
  await page.getByRole('button', { name: 'Spiel starten', exact: true }).click();
  await expect(page.locator('.hall-shell')).toHaveAttribute('data-phase', 'SH-P1');
};
const button = (page, label) => page.getByRole('button', { name: label, exact: true });

test('ohne Freigabeschalter fehlt die Spielhalle im Katalog und in der öffentlichen API', async ({ page, app }) => {
  await login(page, app);
  const me = await (await page.request.get(app.url + '/me')).json();
  expect(me.idleGames).toEqual([]);
  expect((await page.request.get(app.url + game)).status()).toBe(404);
  await page.evaluate(() => { location.hash = '#idle/spielhalle'; });
  await expect(page.getByText('Dieses Spiel ist hier nicht freigegeben.')).toBeVisible();
});

test.describe('Spielhalle auf ausdrücklich aktiviertem Testserver', () => {
  test.use({ idleHall: true });

  test('der echte Server erreicht aus einem neuen Konto alle fünf Phasen und sämtliche Abschlussziele', async ({ page, app }, info) => {
    test.setTimeout(90_000); // includes six views and twenty-plus authorised game actions
    await login(page, app);
    await openFromHub(page);
    let at = initialTime;
    const token = await page.evaluate((key) => sessionStorage.getItem(key), leaseKey);
    const api = async (path, data) => {
      const headers = { 'x-idle-token': token, 'x-requested-with': 'spieleabend' };
      const endpoint = app.url + game + path;
      const response = data ? await page.request.post(endpoint, { data, headers }) : await page.request.get(endpoint, { headers });
      const body = await response.json();
      expect(response.ok(), JSON.stringify(body)).toBe(true);
      return body;
    };
    let session = await api('');
    let id = 0;
    const fields = () => ({ id: 'test-run-' + ++id, token, revision: session.revision, sessionVersion: session.sessionVersion });
    await playHall({
      async command(action) {
        // Exercise keyboard/touch through the real UI for the first two actions.
        if (action.type === 'manual') {
          const manual = page.getByRole('button', { name: /Kartenrunde spielen/ });
          if (info.project.name === 'mobil') await manual.tap();
          else { await manual.focus(); await manual.press('Enter'); }
          await expect(page.getByRole('button', { name: /Autogeber kaufen/ })).not.toHaveAttribute('aria-disabled', 'true');
          session = await api('');
          return;
        }
        if (action.type === 'auto') {
          await page.getByRole('button', { name: /Autogeber kaufen/ }).click();
          await expect(page.getByText(/Der Autogeber bedient Gäste/)).toBeVisible();
          session = await api('');
          return;
        }
        Object.assign(session, await api('/actions', { ...fields(), action }));
      },
      async wait(ms) { at += ms; await app.setIdleTime(at); },
      async milestone(phase, complete = false) {
        session = await api('');
        expect(session.view.phase.id).toBe('SH-P' + phase);
        expect(session.view.data.complete).toBe(complete);
        if (complete) expect(session.view.progress.every(({ met }) => met)).toBe(true);
        if (phase > 1) {
          Object.assign(session, await api('/save', fields()));
          await page.reload();
        }
        await expect(page.locator('.hall-shell')).toHaveAttribute('data-phase', 'SH-P' + phase);
        if (complete) await expect(page.getByRole('heading', { name: 'Alle Abschlussziele erreicht' })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width + 1);
        if (process.env.HALL_EVIDENCE === '1' && !complete) {
          await page.screenshot({ path: join(evidence, 'SH-P' + phase + '-' + info.project.name + '.png'), fullPage: true });
        }
      },
    });
    expect(session.view.data.locations).toHaveLength(5);
    await button(page, 'Renommee-Vorschau').click();
    const dialog = page.locator('dialog[open]');
    await expect(dialog).toContainText('wird gespeichert');
    await dialog.getByRole('button', { name: 'Abbrechen' }).click();
    await expect(page.locator('.hall-shell')).toHaveAttribute('data-phase', 'SH-P5');
  });

  test('Speichern, Datei-Import, Reconnect, Tab-Übernahme und Englisch bleiben bedienbar', async ({ page, app, context }) => {
    test.setTimeout(60_000);
    await login(page, app);
    await openFromHub(page);
    await page.getByRole('button', { name: /Kartenrunde spielen/ }).click();
    const downloadEvent = page.waitForEvent('download');
    await button(page, 'Speichern & exportieren').click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe('spielhalle-spielstand.spieleabend');
    await expect(page.getByText('Gespeichert · Rev. 1', { exact: true })).toBeVisible();
    const path = await download.path();
    await page.locator('[data-hall-import]').setInputFiles(path);
    await expect(page.getByText('Diese Revision ist bereits aktiv.')).toBeVisible();
    await page.getByRole('button', { name: /Autogeber kaufen/ }).click();
    await expect(page.getByText('Ungespeicherte Aktionen', { exact: true })).toBeVisible();
    await page.locator('[data-hall-import]').setInputFiles(path);
    const dialog = page.locator('dialog[open]');
    await expect(dialog).toContainText('Ungespeicherte Aktionen verwerfen');
    await dialog.getByRole('button', { name: 'Bestätigen' }).click();
    await expect(page.getByRole('button', { name: /Autogeber kaufen/ })).toBeVisible();
    await page.reload();
    await expect(page.getByText('Gespeichert · Rev. 1', { exact: true })).toBeVisible();
    const popupEvent = page.waitForEvent('popup');
    await page.evaluate(() => window.open(location.href, '_blank'));
    const popup = await popupEvent;
    try {
      await button(popup, 'Bestätigten Stand öffnen').click();
      await expect(popup.getByText('Nur Ansicht', { exact: true })).toBeVisible();
    } finally { await popup.close(); }
    const next = await context.newPage();
    try {
      await next.goto(app.url + '/#idle/spielhalle');
      await button(next, 'Bestätigten Stand öffnen').click();
      await expect(next.getByText('Nur Ansicht', { exact: true })).toBeVisible();
      await button(next, 'Schreibsitzung übernehmen').click();
      await expect(next.locator('dialog[open]')).toContainText('anderen Tab');
      await next.locator('dialog[open]').getByRole('button', { name: 'Bestätigen' }).click();
      await expect(next.getByText('Schreibsitzung übernommen.')).toBeVisible();
      // Check the fencing over HTTP without generating an expected network error in the UI.
      const oldLease = await page.evaluate((key) => sessionStorage.getItem(key), leaseKey);
      expect((await page.request.get(app.url + game, { headers: { 'x-idle-token': oldLease } })).status()).toBe(409);
    } finally { await next.close(); }
    await page.evaluate((key) => {
      sessionStorage.removeItem(key);
      I18n.select('en');
    }, leaseKey);
    await page.goto(app.url + '/#spiele/idle');
    await expect(page.getByText('The Game Hall', { exact: true })).toBeVisible();
    await page.locator('li[data-id="spielhalle"] a').click();
    await button(page, 'Open confirmed save').click();
    await expect(page.getByRole('heading', { name: 'The Game Hall' })).toBeVisible();
  });

  test('ein verbundenes Gerät lädt den bestätigten Stand desselben Kontos', async ({ page, app, browser }) => {
    await login(page, app);
    await openFromHub(page);
    await page.getByRole('button', { name: /Kartenrunde spielen/ }).click();
    await button(page, 'Speichern').click();
    await expect(page.getByText('Gespeichert · Rev. 1')).toBeVisible();
    const post = async (device, path, data = {}) => device.request.post(app.url + path, {
      data, headers: { 'x-requested-with': 'spieleabend' },
    });
    const link = await post(page, '/api/identity/link/create');
    expect(link.ok()).toBe(true);
    const { code } = await link.json();
    const other = await browser.newContext({ viewport: page.viewportSize() });
    try {
      const device = await other.newPage();
      await login(device, app, 'Ben');
      expect((await (await device.request.get(app.url + game)).json()).revision).toBe(0);
      const redeem = await post(device, '/api/identity/link/redeem', { code });
      expect(redeem.ok(), await redeem.text()).toBe(true);
      expect((await (await device.request.get(app.url + game)).json()).revision).toBe(1);
      await device.evaluate(() => { location.hash = '#idle/spielhalle'; });
      await button(device, 'Bestätigten Stand öffnen').click();
      await expect(device.getByText('Gespeichert · Rev. 1')).toBeVisible();
    } finally { await other.close(); }
  });
});
