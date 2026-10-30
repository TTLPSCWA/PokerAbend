// Referenzvergleich mit isoliertem Server und fünf tatsächlichen Bildschirmgrößen.
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { chromium, webkit } from '@playwright/test';

const stage = process.argv[2] || 'after';
if (!['before', 'after', 'iteration'].includes(stage)) throw new Error('before|iteration|after');
const root = resolve(import.meta.dirname, '..');
const engine = process.env.REFERENCE_BROWSER === 'webkit' ? 'webkit' : 'chrome';
const output = join(root, 'artifacts', 'home-reference', stage + (engine === 'webkit' ? '-webkit' : ''));
mkdirSync(output, { recursive: true });
const password = 'Home-Referenz-Test';
const child = spawn(process.execPath, ['--input-type=module', '-e', `
  const { http } = await import('./server/index.js');
  const ready = () => console.log('REFERENCE_READY:' + http.address().port);
  if (http.listening) ready(); else http.once('listening', ready);
`], { cwd: root, env: { ...process.env, PORT: '0', DATA_DIR: mkdtempSync(join(tmpdir(), 'home-reference-')), POKER_NO_DOTENV: '1', SITE_PASSWORD: password, TICKET_ADMIN_PASSWORD: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
let browser, logs = '';
const errors = [], shots = [];
child.stderr.on('data', (data) => { logs += data; });
try {
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(logs)), 15000);
    child.once('error', reject);
    child.once('exit', () => { clearTimeout(timer); reject(new Error('Testserver beendet')); });
    child.stdout.on('data', (data) => { logs += data; const match = logs.match(/REFERENCE_READY:(\d+)/); if (match) { clearTimeout(timer); resolve('http://localhost:' + match[1]); } });
  });
  browser = engine === 'webkit' ? await webkit.launch({ headless: true }) : await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
  for (const [width, height] of [[1920, 1080], [1440, 900], [768, 1024], [390, 844], [360, 800]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', isMobile: width < 641, hasTouch: width < 641 });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('poker:name', JSON.stringify('Anna'));
      localStorage.setItem('poker:avatar', JSON.stringify('🦉'));
      localStorage.setItem('poker:prefs', JSON.stringify({ intros: false, sound: false }));
    });
    await page.goto(url);
    await page.getByLabel('Passwort', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Reinkommen', exact: true }).click();
    await page.locator('#hub:not([hidden])').waitFor();
    await page.evaluate(() => document.fonts.ready);
    for (const route of ['start', 'spiele']) {
      await page.evaluate((route) => { location.hash = '#' + route; }, route);
      await page.waitForFunction((route) => renderedPage === route, route);
      await page.waitForTimeout(150);
      const path = join(output, `${route}-${width}x${height}.png`);
      await page.screenshot({ path });
      const metrics = await page.evaluate(() => {
        const box = (s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null; };
        return { overflow: document.documentElement.scrollWidth > innerWidth + 1, sidebar: box('.hub-side'), heading: box('#hub-main h1'), card: box('.games > li'), right: box('.home-secondary') };
      });
      shots.push({ route, width, height, path, metrics });
    }
    if (engine === 'webkit') {
      await page.evaluate(() => { location.hash = '#start'; });
      await page.locator('#hub-search').waitFor();
      await page.getByRole('searchbox', { name: 'Spiele suchen', exact: true }).fill('Reversi');
      await page.keyboard.press('Enter');
      await page.locator('#games-body [data-host="reversi"]').waitFor();
      if (await page.locator('#games-body [data-host]').count() !== 1) throw new Error('WebKit: Suche');
      await page.locator('[data-fav="reversi"]').click();
      await page.locator('[data-local-games="favorites"] [data-game-open="reversi"]').waitFor();
      await page.locator('#games-body [data-host="reversi"]').click();
      await page.locator('#host-form').waitFor();
      await page.keyboard.press('Escape');
      await page.locator('#host-dlg').waitFor({ state: 'hidden' });
      if (width < 641) {
        await page.locator('#hub-more').click();
        await page.locator('#hub-menu-nav a[href="#planung"]').click();
        await page.waitForFunction(() => renderedPage === 'planung');
      }
      await page.locator('#profile-avatar').click();
      await page.locator('.profile-preferences summary').click();
      await page.getByRole('switch', { name: /Glaseffekt reduzieren/ }).check();
      await page.locator('#p-cancel').click();
      const fallback = await page.evaluate(() => getComputedStyle(document.querySelector('#hub'), '::before').backgroundImage);
      if (fallback !== 'none') throw new Error('WebKit: deckender Modus');
    }
    await context.close();
  }
  writeFileSync(join(output, 'report.json'), JSON.stringify({ stage, engine, errors, temporaryData: true, shots }, null, 2));
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`${shots.length} Screenshots: ${output}`);
} finally {
  await browser?.close();
  if (child.exitCode === null && child.signalCode === null) { const stopped = new Promise((resolve) => child.once('exit', resolve)); child.kill(); await stopped; }
}
