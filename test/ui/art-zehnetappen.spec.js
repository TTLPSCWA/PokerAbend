// ART-008 Phase 10: Karten mit Papierkante und Glanz, ausgelegte Phasen als echte Kartenreihen, Stapel mit Höhe,
// Tisch mit Struktur. Klassisch, Kurz und Team; die vier Kartenfarben, Joker und Aussetzen bleiben erkennbar.
import { test, expect, openTable, configure } from './card-ux-helpers.js';
import { mkdirSync, writeFileSync } from 'node:fs';

const DIR = 'docs/design/art/ART-008';
const capture = async (page, info, name) => {
  let path = info.outputPath(`${name}.png`);
  if (process.env.ART_CAPTURE === '1') { mkdirSync(DIR, { recursive: true }); path = `${DIR}/${name}-${info.project.name}.png`; }
  await page.screenshot({ path });
};
const VARIANTS = ['classic', 'short', 'team'];

for (const variant of VARIANTS) {
  test(`ART-008 Phase 10 ${variant}: Karten, Auslagen und Tisch`, async ({ page, browser, app }, info) => {
    test.skip(info.project.name === 'mobil' && variant !== 'classic', 'Handy: Klassisch genügt');
    test.setTimeout(150000);
    const room = await openTable(page, browser, app, info, 'zehnetappen', variant, variant === 'team' ? 4 : 3);
    try {
      // Szene: eigene Phase ausgelegt (Drilling + Folge), gemischte Hand mit Joker und Aussetzen (feste Testkarten).
      await configure(page, app, room.code, { hand: ['y7', 'j0', 'r2', 's0', 'g9', 'b12'], laid: [{ type: 'set', cards: ['r7', 'g7', 'b7'], vals: [7, 7, 7] }, { type: 'run', cards: ['r3', 'g4', 'b5', 'y6'], vals: [3, 4, 5, 6] }] });
      await expect(page.locator('.kg-hand .kc-ze').first()).toBeVisible();
      await page.waitForTimeout(700);
      if (process.env.ART_BEFORE) { await capture(page, info, `before-${variant}`); await page.locator('.ze-public').scrollIntoViewIfNeeded(); await page.waitForTimeout(300); await capture(page, info, `before-${variant}-laid`); return; }
      await expect(page.locator('.kg-zehnetappen')).toHaveAttribute('data-art-phase10', '');
      // Kartenfront: Glanz auf dem Innenrahmen und mehrlagige Papierkante (keine Bilder aus dem Netz).
      // Karten: Glanz als Hintergrundschicht, mehrlagige Papierkante (an einer ausgelegten Karte).
      const face = await page.locator('.ze-cards .kc-ze').first().evaluate((el) => { const s = getComputedStyle(el); return { gloss: s.backgroundImage, shadow: s.boxShadow }; });
      expect(face.gloss).toMatch(/linear-gradient/);
      expect(face.shadow.split('rgb').length).toBeGreaterThanOrEqual(4);
      // Ausgelegte Phase als Kartenreihe: Karten rücken zusammen, überdecken aber nie die große Zahl.
      const row = await page.locator('.ze-group').nth(1).locator('.ze-cards .kc-ze').evaluateAll((list) => list.map((c) => { const r = c.getBoundingClientRect(), v = c.querySelector('.v').getBoundingClientRect(); return { l: r.left, r: r.right, vl: v.left, vr: v.right }; }));
      expect(row.length).toBe(4);
      for (let i = 1; i < row.length; i++) { expect(row[i].l).toBeLessThan(row[i - 1].r); expect(row[i].l).toBeGreaterThanOrEqual(row[i - 1].vr - 1); }
      // Phasenanzeige als runde Spielsteine, erledigte golden.
      const stones = await page.locator('.ze-progress i').evaluateAll((list) => list.map((i) => ({ r: getComputedStyle(i).borderRadius, done: i.classList.contains('done'), bg: getComputedStyle(i).backgroundImage })));
      expect(stones[0].r).toBe('50%'); expect(stones.find((s) => s.done).bg).toMatch(/radial-gradient/);
      // Tisch mit eigener Struktur.
      expect(await page.locator('.ze-public').evaluate((el) => getComputedStyle(el).backgroundImage)).toMatch(/\/games\/zehnetappen\/art\/table\.webp/);
      expect(await page.evaluate(() => fetch('/games/zehnetappen/art/table.webp').then((r) => r.status))).toBe(200);
      // Lesbarkeit: Wert und Ecken bleiben sichtbar und groß genug.
      const value = await page.locator('.kg-hand .kc-ze .v').first().evaluate((el) => { const r = el.getBoundingClientRect(); return { w: r.width, h: r.height, o: getComputedStyle(el).opacity }; });
      expect(value.h).toBeGreaterThan(10); expect(Number(value.o)).toBe(1);
      await capture(page, info, `table-${variant}`); await page.locator('.ze-public').scrollIntoViewIfNeeded(); await page.waitForTimeout(300); await capture(page, info, `table-${variant}-laid`);
      // Kosten: Bildrate mit und ohne neue Optik bei 4× gedrosselter CPU, während die Hand neu gezeichnet wird.
      if (variant === 'classic' && info.project.name === 'desktop') {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Performance.enable');
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        // Gemessen wird die Rechenzeit des Hauptthreads (Stil, Layout, Zeichnen) während die Karten sich bewegen,
        // plus die Bildrate. Die reine Bildrate schwankt in der Testumgebung um mehr als 10 %, die Rechenzeit kaum.
        const metric = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
        const sample = async (on) => {
          await page.evaluate(async (on) => { const root = document.querySelector('.kg-zehnetappen'); if (on) root.dataset.artPhase10 = ''; else delete root.dataset.artPhase10; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); }, on);
          const before = await metric();
          const frames = await page.evaluate(() => {
            // Handkarten heben sich wie beim Auswählen/Ausspielen (Web-Animation über transform).
            const runs = [...document.querySelectorAll('.kg-hand .kc-ze, .ze-cards .kc-ze')].map((c, i) => c.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-10px) rotate(2deg)' }], { duration: 420, delay: i * 60, iterations: Infinity, direction: 'alternate' }));
            return new Promise((done) => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(tick); else { runs.forEach((a) => a.cancel()); done(n / (performance.now() - t0) * 1000); } }; requestAnimationFrame(tick); });
          });
          const after = await metric();
          return { fps: frames, work: after.TaskDuration - before.TaskDuration };
        };
        const median = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
        const off = [], on = [];
        for (let i = 0; i < 5; i++) { if (i % 2) { on.push(await sample(true)); off.push(await sample(false)); } else { off.push(await sample(false)); on.push(await sample(true)); } }
        const round = (x) => Math.round(x * 1000) / 1000;
        const workOff = median(off.map((x) => x.work)), workOn = median(on.map((x) => x.work));
        const best = { fps: round(median(on.map((x) => x.fps))), baselineFps: round(median(off.map((x) => x.fps))), workSeconds: round(workOn), baselineWorkSeconds: round(workOff), ratio: round(workOff / workOn), fpsRatio: round(median(on.map((x) => x.fps)) / median(off.map((x) => x.fps))), cpuThrottle: 4, minRatio: 0.9, method: 'Hauptthread-Rechenzeit ohne/mit neuer Optik (Median aus 5 Läufen, Reihenfolge wechselnd); ratio = Rechenzeit ohne / mit' };
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
        if (process.env.ART_CAPTURE === '1') { mkdirSync(DIR, { recursive: true }); writeFileSync(`${DIR}/fps-desktop.json`, JSON.stringify(best, null, 2) + '\n'); }
        expect(best.ratio, JSON.stringify(best)).toBeGreaterThanOrEqual(0.9);
        expect(best.fpsRatio, JSON.stringify(best)).toBeGreaterThanOrEqual(0.85); // Bildrate schwankt stärker, daher etwas Luft
      }
    } finally { await room.close(); }
  });
}
