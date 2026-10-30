// Reproduzierbare lokale Vorher-/Nachher-Bilder; ausschließlich temporäre Testdaten.
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { chromium } from '@playwright/test';

const stage = process.argv[2] || 'after';
if (!['before', 'after'].includes(stage)) throw new Error('Aufruf: node scripts/capture-ui-redesign.mjs before|after');
const root = resolve(import.meta.dirname, '..'), output = join(root, 'artifacts', 'ui-redesign', stage);
mkdirSync(output, { recursive: true });
const password = 'Nur-lokale-Redesign-Pruefung';
const child = spawn(process.execPath, ['--input-type=module', '-e', `
  const { http } = await import('./server/index.js');
  const ready = () => console.log('CAPTURE_READY:' + http.address().port);
  if (http.listening) ready(); else http.once('listening', ready);
`], { cwd: root, env: { ...process.env, PORT: '0', POKER_NO_DOTENV: '1', DATA_DIR: mkdtempSync(join(tmpdir(), 'poker-redesign-')), SITE_PASSWORD: password, TICKET_ADMIN_PASSWORD: '', CREATE_LIMIT: '100' }, stdio: ['ignore', 'pipe', 'pipe'] });
let browser, logs = '';
const errors = [];
child.stderr.on('data', (d) => { logs += d; });
try {
  const url = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Testserver startet nicht: ' + logs)), 15000);
    child.once('error', (e) => { clearTimeout(timeout); reject(e); });
    child.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Server beendet: ${code}`)); });
    child.stdout.on('data', (d) => { logs += d; const match = logs.match(/CAPTURE_READY:(\d+)/); if (match) { clearTimeout(timeout); resolve('http://localhost:' + match[1]); } });
  });
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
  for (const [device, width, height] of [['desktop', 1440, 900], ['mobil', 390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', isMobile: device === 'mobil', hasTouch: device === 'mobil' });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(`${device}: ${e.message}`));
    await page.addInitScript(() => { localStorage.setItem('poker:name', JSON.stringify('Anna')); localStorage.setItem('poker:avatar', JSON.stringify('🦉')); localStorage.setItem('poker:prefs', JSON.stringify({ intros: false, sound: false })); });
    await page.goto(url); await page.getByLabel('Passwort', { exact: true }).waitFor();
    await page.screenshot({ path: join(output, `${device}-login.png`) });
    await page.getByLabel('Passwort', { exact: true }).fill(password); await page.getByRole('button', { name: 'Reinkommen', exact: true }).click();
    await page.locator('#hub:not([hidden])').waitFor(); await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(output, `${device}-home.png`), fullPage: true });
    await page.evaluate(() => { location.hash = '#spiele'; }); await page.locator('#games-body [data-id]').first().waitFor();
    await page.screenshot({ path: join(output, `${device}-library.png`), fullPage: true });
    await page.evaluate(() => { location.hash = '#tickets'; }); await page.locator('.ticket-count').waitFor();
    await page.getByRole('button', { name: 'Ticket erstellen', exact: true }).click();
    await page.locator('#ticket-editor').getByLabel('Titel', { exact: true }).fill('Ideen für unseren nächsten Spieleabend');
    await page.locator('#ticket-editor').getByLabel('Beschreibung', { exact: true }).fill('Welche kurzen Spiele passen gut zwischen zwei größeren Runden? Vorschläge sammeln wir hier gemeinsam.');
    await page.locator('#ticket-editor').getByRole('button', { name: 'Ticket erstellen', exact: true }).click();
    await page.locator('.ticket-detail h1').waitFor();
    await page.screenshot({ path: join(output, `${device}-ticket-detail.png`), fullPage: true });
    await page.evaluate(() => { location.hash = '#tickets'; }); await page.locator('.ticket-card').first().waitFor();
    await page.screenshot({ path: join(output, `${device}-tickets.png`), fullPage: true });
    await page.evaluate(() => { location.hash = '#spiele'; }); await page.locator('[data-host="kniffel"]').click();
    await page.locator('#host-form button[type=submit]').click();
    await page.getByRole('button', { name: 'Mitspielen', exact: true }).click();
    for (const event of ['addBot', 'start']) { const r = await page.evaluate((event) => send(event), event); if (!r.ok) throw new Error(r.error); }
    await page.getByRole('button', { name: 'Würfeln', exact: true }).click(); await page.locator('.kn-pick').first().waitFor();
    await page.screenshot({ path: join(output, `${device}-kniffel.png`) });
    if (stage === 'after' && device === 'desktop') {
      await page.evaluate(() => send('closeTable'));
      await page.locator('#hub:not([hidden])').waitFor();
      await page.evaluate(() => { location.hash = '#spiele'; });
      await page.locator('[data-host="poker"]').click();
      await page.locator('#host-form button[type=submit]').click();
      await page.locator('[data-sit]').first().click();
      for (const event of ['addBot', 'start']) { const r = await page.evaluate((event) => send(event), event); if (!r.ok) throw new Error(r.error); }
      await page.setViewportSize({ width: 900, height: 450 });
      await page.screenshot({ path: join(output, 'desktop-poker-landscape.png') });
    }
    await context.close();
  }
  writeFileSync(join(output, 'report.json'), JSON.stringify({ stage, errors, screens: ['login', 'home', 'library', 'tickets', 'ticket-detail', 'kniffel'], temporaryData: true }, null, 2));
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`${stage === 'after' ? 13 : 12} Screenshots ohne Browserfehler: ${output}`);
} finally {
  await browser?.close();
  if (child.exitCode === null && child.signalCode === null) { const stopped = new Promise((resolve) => child.once('exit', resolve)); child.kill(); await stopped; }
}
