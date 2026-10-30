// Kontaktbogen und technische Vorher-/Nachher-Differenz; keine Pixelgleichheitsbehauptung zur Referenz.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
const dir = resolve('artifacts/home-reference');
const uri = (path) => 'data:image/png;base64,' + readFileSync(path).toString('base64');
const images = {
  reference: uri('design/referenz-game-library.png'),
  before: uri(join(dir, 'before/start-1920x1080.png')),
  after: uri(join(dir, 'after/start-1920x1080.png')),
  libraryBefore: uri(join(dir, 'before/spiele-1440x900.png')),
  libraryAfter: uri(join(dir, 'after/spiele-1440x900.png')),
};
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.setContent(`<style>*{box-sizing:border-box}body{margin:0;padding:20px;background:#101410;color:#f7f0dd;font:16px system-ui}h1,h2{margin:10px 0}p{color:#c8c8b9}.reference{width:100%;display:block}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}.pair img{width:100%;display:block}figcaption{padding:10px}figure{margin:0}</style><h1>PokerAbend – Vergleich mit der Originalreferenz</h1><p>Unterschiedliche echte Inhalte und ein eigenständiger Raumhintergrund. Keine pixelgenaue Kopie.</p><img class="reference" src="${images.reference}" alt="Originalreferenz"><h2>Startseite – 1920 × 1080</h2><div class="pair"><figure><figcaption>Vorher</figcaption><img src="${images.before}"></figure><figure><figcaption>Nachher</figcaption><img src="${images.after}"></figure></div><h2>Spielebibliothek – 1440 × 900</h2><div class="pair"><figure><figcaption>Vorher</figcaption><img src="${images.libraryBefore}"></figure><figure><figcaption>Nachher</figcaption><img src="${images.libraryAfter}"></figure></div>`);
  await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode())));
  await page.screenshot({ path: join(dir, 'vergleich.png'), fullPage: true });
  const diff = await page.evaluate(async ({ before, after }) => {
    const load = async (src) => { const image = new Image(); image.src = src; await image.decode(); return image; };
    const a = await load(before), b = await load(after);
    const canvas = document.createElement('canvas'); canvas.width = a.width; canvas.height = a.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(a, 0, 0); const old = ctx.getImageData(0, 0, a.width, a.height);
    ctx.drawImage(b, 0, 0); const next = ctx.getImageData(0, 0, a.width, a.height);
    for (let i = 0; i < old.data.length; i += 4) {
      for (let c = 0; c < 3; c++) old.data[i + c] = Math.abs(old.data[i + c] - next.data[i + c]);
      old.data[i + 3] = 255;
    }
    ctx.putImageData(old, 0, 0); return canvas.toDataURL('image/png').split(',')[1];
  }, images);
  writeFileSync(join(dir, 'differenz-vorher-nachher.png'), Buffer.from(diff, 'base64'));
  console.log('Vergleich und RGB-Differenz gespeichert: ' + dir);
} finally { await browser.close(); }
