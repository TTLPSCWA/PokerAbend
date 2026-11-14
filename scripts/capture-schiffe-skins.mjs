// ART-013: Screenshots der Schiffe-versenken-Designs aus dem echten, laufenden Spiel (kein Entwurfsbild).
// Startet einen Testserver mit eigenem Datenordner, spielt gegen einen Computer-Gegner und speichert
//   • die Vorschaubilder der Designauswahl: public/games/schiffe/art/preview-<skin>.webp (288 × 180, beide Meere)
//   • die Nachweisbilder unter docs/design/art/ART-013/ (WebP: Desktop und Handy, Klassisch/Salvo, je Design, dazu die Designauswahl)
//
//   node scripts/capture-schiffe-skins.mjs                 alle Designs
//   node scripts/capture-schiffe-skins.mjs naval           nur dieses Design
//   Optionen: --previews-only  --docs-only
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { SKINS } from '../games/schiffe/skins.js';

const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const only = args.filter((a) => !a.startsWith('--'));
const skins = SKINS.map((s) => s.id).filter((id) => !only.length || only.includes(id));
const wantPreviews = !args.includes('--docs-only'), wantDocs = !args.includes('--previews-only');
const docsDir = join(root, 'docs', 'design', 'art', 'ART-013'), artDir = join(root, 'public', 'games', 'schiffe', 'art');
mkdirSync(docsDir, { recursive: true });

const dataDir = mkdtempSync(join(tmpdir(), 'schiffe-capture-'));
const server = spawn(process.execPath, ['--input-type=module', '-e', `
  const { http } = await import('./server/index.js');
  const ready = () => console.log('TEST_READY:' + http.address().port);
  if (http.listening) ready(); else http.once('listening', ready);`], { cwd: root, env: { ...process.env, PORT: '0', DATA_DIR: dataDir, POKER_NO_DOTENV: '1', SITE_PASSWORD: 'capture-pw', CREATE_LIMIT: '200' }, stdio: ['ignore', 'pipe', 'pipe'] });
let out = '';
server.stderr.on('data', (d) => { out += d; });
const url = await new Promise((res, rej) => {
  const timer = setTimeout(() => rej(new Error('Server startet nicht: ' + out)), 45000);
  server.stdout.on('data', (d) => { out += d; const m = out.match(/TEST_READY:(\d+)/); if (m) { clearTimeout(timer); res('http://localhost:' + m[1]); } });
});
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });

// Eine Partie bis zu einem zeigbaren Stand spielen. Gibt die Seite zurück.
async function play({ skin, variant, width, height, shots, dpr = 2 }) {
  const mobile = width < 600;
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => { localStorage.setItem('poker:name', JSON.stringify('Anna')); localStorage.setItem('poker:avatar', JSON.stringify('🦉')); localStorage.setItem('poker:prefs', JSON.stringify({ intros: false })); });
  const p = await ctx.newPage();
  await p.goto(url); await p.getByLabel('Passwort').fill('capture-pw'); await p.getByRole('button', { name: 'Reinkommen' }).click();
  await p.waitForSelector('#hub');
  await p.evaluate(() => { location.hash = '#spiele'; }); await p.locator('[data-host="schiffe"]').first().click();
  await p.waitForSelector('#host-form');
  if (await p.locator(`[data-choice-value="${skin}"]`).count()) await p.locator(`[data-choice-value="${skin}"]`).click();
  await p.locator('#host-variant').selectOption(variant);
  await p.locator('input[data-cf=turnTime]').fill('0');
  await p.locator('#host-form button[type=submit]').click();
  await p.getByRole('button', { name: 'Mitspielen', exact: true }).click();
  await p.evaluate(() => send('addBot')); await p.evaluate(() => send('start'));
  await p.waitForFunction(() => lastState?.phase === 'playing');
  await p.locator('[data-g=random]').click(); await p.locator('[data-g=ready]').click();
  await p.waitForFunction(() => lastState.g.step === 'shoot');
  const order = [...Array(100).keys()].sort((a, b) => ((a * 37 + 11) % 100) - ((b * 37 + 11) % 100)); // feste Reihenfolge: gleiche Bilder bei jedem Lauf
  let fired = 0;
  for (let guard = 0; guard < 500 && fired < shots; guard++) {
    const st = await p.evaluate(() => { const foe = Object.keys(lastState.g.seas).find((x) => x !== lastState.you.id); return { phase: lastState.phase, turn: lastState.turnId === lastState.you.id, salvo: lastState.variant === 'salvo', quota: lastState.g.salvoQuota || 0, ready: lastState.g.salvoReady?.[lastState.you.id], shots: Object.keys(lastState.g.seas[foe].shots).map(Number) }; });
    if (st.phase !== 'playing') break;
    if (st.salvo) { if (st.ready) { await p.waitForTimeout(120); continue; } const free = order.filter((c) => !st.shots.includes(c)).slice(0, st.quota); await p.evaluate((cells) => send('salvo', { cells }), free); fired += free.length; await p.waitForTimeout(300); continue; }
    if (!st.turn) { await p.waitForTimeout(120); continue; }
    await p.evaluate((cell) => send('shoot', { cell }), order.find((c) => !st.shots.includes(c))); fired++; await p.waitForTimeout(60);
  }
  await p.waitForTimeout(500);
  return { p, ctx };
}

async function toWebp(page, buffer, w, h, q = 0.82, keep = false) {
  const data = await page.evaluate(async ({ b64, w, h, q, keep }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    if (keep) { w = img.width; h = img.height; } // Originalgröße (Nachweisbild ohne Zuschnitt)
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
    const s = Math.max(w / img.width, h / img.height), dw = img.width * s, dh = img.height * s; x.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    return c.toDataURL('image/webp', q).split(',')[1];
  }, { b64: buffer.toString('base64'), w, h, q, keep });
  return Buffer.from(data, 'base64');
}

// Designauswahl beim Erstellen (Vorschaukarten), Desktop und Handy
async function chooser(width, height, name) {
  const mobile = width < 600, dpr = mobile ? 2 : 1;
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => { localStorage.setItem('poker:name', JSON.stringify('Anna')); localStorage.setItem('poker:avatar', JSON.stringify('🦉')); localStorage.setItem('poker:prefs', JSON.stringify({ intros: false })); });
  const p = await ctx.newPage();
  await p.goto(url); await p.getByLabel('Passwort').fill('capture-pw'); await p.getByRole('button', { name: 'Reinkommen' }).click();
  await p.waitForSelector('#hub'); await p.evaluate(() => { location.hash = '#spiele'; }); await p.locator('[data-host="schiffe"]').first().click();
  await p.waitForSelector('#host-form .create-choice-pick');
  await p.waitForFunction(() => [...document.querySelectorAll('.create-choice-art img')].every((i) => i.complete && i.naturalWidth > 0));
  await p.waitForTimeout(600);
  writeFileSync(join(docsDir, `${name}.webp`), await toWebp(p, await p.locator('#host-dlg').screenshot(), 0, 0, 0.82, true));
  await ctx.close();
  console.log('Nachweis', name);
}

try {
  if (wantDocs && skins.length > 1) { await chooser(1440, 900, 'designauswahl-desktop'); await chooser(390, 844, 'designauswahl-mobil'); }
  for (const skin of skins) {
    if (wantPreviews) {
      // Vorschau: beide Meere mit Schiffen, Treffern und Wasser, Desktop, Klassische Regeln
      const { p, ctx } = await play({ skin, variant: 'classic', width: 1440, height: 900, shots: 22 });
      const shot = await p.locator('.sv-two').first().screenshot();
      writeFileSync(join(artDir, `preview-${skin}.webp`), await toWebp(p, shot, 288, 180));
      await ctx.close();
      console.log('Vorschau', skin);
    }
    if (wantDocs) {
      for (const [variant, shots, size, name] of [['classic', 26, [1440, 900], 'desktop-classic'], ['salvo', 20, [1440, 900], 'desktop-salvo'], ['classic', 26, [390, 844], 'mobil-classic'], ['salvo', 20, [390, 844], 'mobil-salvo']]) {
        const dpr = size[0] < 600 ? 2 : 1;
        const { p, ctx } = await play({ skin, variant, width: size[0], height: size[1], shots, dpr });
        writeFileSync(join(docsDir, `${skin}-${name}.webp`), await toWebp(p, await p.screenshot(), size[0] * dpr, size[1] * dpr, 0.8));
        await ctx.close();
        console.log('Nachweis', skin, name);
      }
    }
  }
} finally { await browser.close(); server.kill(); }
