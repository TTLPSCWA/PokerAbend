// ART-009 Skip-Bo: Karten mit Papierkante und Glanz, Bau-, Ablage- und Spielstapel mit sichtbarer Stapelhöhe,
// Werkbank mit Struktur. Klassisch und Team-Variante; die Farbcodierung 1–4 blau, 5–8 grün, 9–12 rot bleibt.
import { test, expect, openTable, configure } from './card-ux-helpers.js';
import { mkdirSync, writeFileSync } from 'node:fs';

const DIR = 'docs/design/art/ART-009';
const capture = async (page, info, name) => {
  let path = info.outputPath(`${name}.png`);
  if (process.env.ART_CAPTURE === '1') { mkdirSync(DIR, { recursive: true }); path = `${DIR}/${name}-${info.project.name}.png`; }
  await page.screenshot({ path });
};
const VARIANTS = ['classic', 'team'];

for (const variant of VARIANTS) {
  test(`ART-009 Skip-Bo ${variant}: Karten, Stapel und Werkbank`, async ({ page, browser, app }, info) => {
    test.skip(info.project.name === 'mobil' && variant !== 'classic', 'Handy: Klassisch genügt');
    test.setTimeout(150000);
    const room = await openTable(page, browser, app, info, 'stapelrennen', variant, variant === 'team' ? 4 : 3);
    try {
      // Szene mit belegten Baureihen, eigenen Ablagen und Spielstapel (feste Testkarten).
      await configure(page, app, room.code, { hand: [1, 2, 8, 0, 12], build: [3, 1, 7, 11] });
      await expect(page.locator('.kg-hand .kc-st').first()).toBeVisible();
      await page.waitForTimeout(700);
      if (process.env.ART_BEFORE) { await capture(page, info, `before-${variant}`); await page.locator('.st-mine').scrollIntoViewIfNeeded(); await page.waitForTimeout(300); await capture(page, info, `before-${variant}-mine`); return; }
      await expect(page.locator('.kg-stapelrennen')).toHaveAttribute('data-art-skipbo', '');
      // Kartenfront: Glanz auf dem Innenrahmen und mehrlagige Papierkante (keine Bilder aus dem Netz).
      // Karten: Glanz als Hintergrundschicht, mehrlagige Papierkante (an einer Baureihe, nicht gewählt).
      const face = await page.locator('.st-build .kc-st').first().evaluate((el) => { const s = getComputedStyle(el); return { gloss: s.backgroundImage, shadow: s.boxShadow }; });
      expect(face.gloss).toMatch(/linear-gradient/);
      expect(face.shadow.split('rgb').length).toBeGreaterThanOrEqual(4);
      // Stapelhöhe: Baureihe mit 11 Karten zeigt mehr Kanten als die mit 1 Karte.
      const edges = await page.locator('.st-build').evaluateAll((list) => list.map((b) => ({ depth: b.dataset.depth, n: getComputedStyle(b.querySelector('.kc-st') || b).boxShadow.split('rgb').length })));
      expect(edges.map((e) => e.depth)).toEqual(['1', '0', '3', '3']); // 3, 1, 7, 11 Karten
      expect(edges[3].n).toBeGreaterThan(edges[1].n);
      expect(await page.locator('.st-goal-stock').getAttribute('data-depth')).toBe('2');
      // Werkbank mit eigener Struktur.
      expect(await page.locator('.st-shared').evaluate((el) => getComputedStyle(el).backgroundImage)).toMatch(/\/games\/stapelrennen\/art\/table\.webp/);
      expect(await page.evaluate(() => fetch('/games/stapelrennen/art/table.webp').then((r) => r.status))).toBe(200);
      // Lesbarkeit: Wert und Ecken bleiben sichtbar und groß genug.
      const value = await page.locator('.kg-hand .kc-st .v').first().evaluate((el) => { const r = el.getBoundingClientRect(); return { w: r.width, h: r.height, o: getComputedStyle(el).opacity }; });
      expect(value.h).toBeGreaterThan(10); expect(Number(value.o)).toBe(1);
      await capture(page, info, `table-${variant}`); await page.locator('.st-mine').scrollIntoViewIfNeeded(); await page.waitForTimeout(300); await capture(page, info, `table-${variant}-mine`);
      // Kosten: Bildrate mit und ohne neue Optik bei 4× gedrosselter CPU, während die Hand neu gezeichnet wird.
      if (variant === 'classic' && info.project.name === 'desktop') {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Performance.enable');
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        // Gemessen wird die Rechenzeit des Hauptthreads (Stil, Layout, Zeichnen) während die Karten sich bewegen,
        // plus die Bildrate. Die reine Bildrate schwankt in der Testumgebung um mehr als 10 %, die Rechenzeit kaum.
        const metric = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
        const sample = async (on) => {
          await page.evaluate(async (on) => { const root = document.querySelector('.kg-stapelrennen'); if (on) root.dataset.artSkipbo = ''; else delete root.dataset.artSkipbo; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); }, on);
          const before = await metric();
          const frames = await page.evaluate(() => {
            // Handkarten heben sich wie beim Auswählen/Ausspielen (Web-Animation über transform).
            const runs = [...document.querySelectorAll('.kg-hand .kc-st, .st-build .kc-st')].map((c, i) => c.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-10px) rotate(2deg)' }], { duration: 420, delay: i * 60, iterations: Infinity, direction: 'alternate' }));
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
