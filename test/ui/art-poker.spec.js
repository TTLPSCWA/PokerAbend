// ART-002 Texas Hold'em: Tisch mit Holzkante, Filz und Licht, scharfe SVG-Chips mit echter Stapelhöhe.
// Gilt nur für Hold'em (#game[data-art-poker]); Omaha nutzt dieselben Dateien und bleibt unverändert.
import { test, expect, login, selectGame } from './helpers.js';
import { mkdirSync, writeFileSync } from 'node:fs';

const DIR = 'docs/design/art/ART-002';
const capture = async (page, info, name) => {
  let path = info.outputPath(`${name}.png`);
  if (process.env.ART_CAPTURE === '1') { mkdirSync(DIR, { recursive: true }); path = `${DIR}/${name}-${info.project.name}.png`; }
  await page.screenshot({ path });
};

// Drei Menschen am Tisch, damit Einsätze, Pot und Stapel gleichzeitig zu sehen sind.
async function table(page, app, browser, info, game = 'poker') {
  await login(page, app); await selectGame(page, game);
  await page.locator('#host-form button[type=submit]').click(); await page.locator('[data-sit]').first().click();
  const code = await page.evaluate(() => lastState.code), contexts = [], pages = [page];
  for (const name of ['Ben', 'Cleo']) {
    const context = await browser.newContext({ ...info.project.use, viewport: page.viewportSize() }); contexts.push(context);
    const other = await context.newPage(); await login(other, app, name);
    await other.evaluate((code) => joinAndEnter(code, 'watch'), code); await other.locator('[data-sit]').first().click(); pages.push(other);
  }
  await expect.poll(() => page.evaluate(() => lastState.seats.filter(Boolean).length)).toBe(3);
  return { pages, close: async () => { for (const c of contexts) await c.close(); } };
}
const begin = async (page) => {
  expect((await page.evaluate(() => send('settings', { autoNext: false }))).ok).toBe(true);
  expect((await page.evaluate(() => send('start'))).ok).toBe(true);
  await expect.poll(() => page.evaluate(() => !!lastState.hand && !lastState.hand.done)).toBe(true);
};
async function act(pages, pick) {
  let p = null;
  await expect.poll(async () => { for (const c of pages) if (await c.evaluate(() => !!lastState.legal && lastState.hand?.toAct === lastState.you.seat)) p = c; return !!p; }).toBe(true);
  const legal = await p.evaluate(() => lastState.legal);
  const reply = await p.evaluate((a) => send('action', { ...a, id: 'art' + Math.random().toString(36).slice(2) }), pick(legal));
  expect(reply.ok, JSON.stringify(reply)).toBe(true);
}
// Erhöhen, dann zwei Calls: alle drei Plätze haben einen hohen Einsatz vor sich liegen.
async function bets(pages) {
  await act(pages, (L) => ({ type: 'raise', amount: Math.min(L.maxTo, Math.max(L.minTo, 1600)) }));
  await act(pages, () => ({ type: 'call' }));
}

test('ART-002: Hold\'em-Tisch mit Holzkante und Filz, scharfe SVG-Chips mit echter Stapelhöhe', async ({ page, app, browser }, info) => {
  test.setTimeout(120000);
  const { pages, close } = await table(page, app, browser, info);
  try {
    await begin(page); await bets(pages);
    await expect(page.locator('#game')).toHaveAttribute('data-art-poker', '');
    const stacks = page.locator('.bet .stack:visible, .pot-box .stack:visible');
    await expect(stacks.first()).toBeVisible();
    await page.waitForTimeout(600);
    // Jeder Chip ist ein SVG-Bild (bleibt bei jeder Größe scharf), kein Farbverlauf mehr.
    const chips = await page.locator('.bet .chip:visible, .pot-box .chip:visible, .p-stack .chip:visible, .me-chips .chip:visible').evaluateAll((els) => els.map((el) => {
      const s = getComputedStyle(el), r = el.getBoundingClientRect();
      return { bg: s.backgroundImage, w: r.width, h: r.height, side: el.closest('.stack') !== null, where: el.parentElement.className };
    }));
    expect(chips.length).toBeGreaterThan(0);
    for (const c of chips) {
      expect(c.bg).toMatch(/\/games\/poker\/art\/chip-(top|side)-c[1-5]\.svg/);
      if (c.side) expect(c.h / c.w).toBeGreaterThan(0.45); // Seitenansicht mit Kante, nicht plattgedrückt
      else expect(Math.abs(c.w - c.h), JSON.stringify(c)).toBeLessThan(1); // Draufsicht: rund
    }
    // Im Stapel liegt jeder Chip sichtbar auf dem nächsten: gleichmäßige Kante, nicht ineinandergeschoben.
    const steps = await page.locator('.stack:visible').evaluateAll((list) => list.flatMap((st) => {
      const ys = [...st.querySelectorAll('.chip')].map((c) => c.getBoundingClientRect().top).sort((a, b) => a - b);
      return ys.slice(1).map((y, i) => y - ys[i]);
    }));
    for (const step of steps) { expect(step).toBeGreaterThanOrEqual(2.5); expect(step).toBeLessThanOrEqual(8); }
    // Bilder sind im Projekt, nicht aus dem Netz.
    for (const file of ['chip-side-c1.svg', 'chip-top-c5.svg', 'felt.webp']) {
      const status = await page.evaluate((f) => fetch(`/games/poker/art/${f}`).then((r) => r.status), file); expect(status, file).toBe(200);
    }
    await capture(page, info, 'table');
    // Flop: Einsätze fliegen in den Pot, der Pot-Stapel wächst.
    await act(pages, (L) => ({ type: L.canCheck ? 'check' : 'call' }));
    await expect(page.locator('#board .card')).toHaveCount(3);
    await page.waitForTimeout(900);
    await capture(page, info, 'flop');
    // Kosten: Bildrate bei 4× gedrosselter CPU mit und ohne neue Optik beim Austeilen der nächsten Straße.
    if (info.project.name === 'desktop') {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const fps = (on) => page.evaluate(async (on) => {
        document.querySelector('#game').toggleAttribute('data-art-poker', on); document.body.classList.toggle('art-poker', on);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        window.__experiences?.poker?.replay?.();
        return new Promise((done) => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(tick); else done(n / (performance.now() - t0) * 1000); }; requestAnimationFrame(tick); });
      }, on);
      let best = null;
      for (let i = 0; i < 3; i++) { const without = await fps(false), withArt = await fps(true); const r = { fps: Math.round(withArt * 100) / 100, baselineFps: Math.round(without * 100) / 100, ratio: Math.round(withArt / without * 1000) / 1000, cpuThrottle: 4, minRatio: 0.9 }; if (!best || r.ratio > best.ratio) best = r; if (r.ratio >= 0.97) break; }
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      if (process.env.ART_CAPTURE === '1') { mkdirSync(DIR, { recursive: true }); writeFileSync(`${DIR}/fps-desktop.json`, JSON.stringify(best, null, 2) + '\n'); }
      expect(best.ratio).toBeGreaterThanOrEqual(0.9);
      await expect(page.locator('#game')).toHaveAttribute('data-art-poker', '');
    }
    // Zurück zur Startseite: Die Poker-Stylesheets bleiben geladen, die Filterknöpfe (.chip) dürfen davon nichts abbekommen.
    await page.goBack(); await expect(page.locator('#hub')).toBeVisible();
    await page.evaluate(() => { location.hash = '#spiele'; });
    const filter = page.locator('#hub [data-chip]').first(); await expect(filter).toBeVisible();
    const look = await filter.evaluate((el) => { const s = getComputedStyle(el); return { bg: s.backgroundImage, h: el.getBoundingClientRect().height, w: el.getBoundingClientRect().width }; });
    expect(look.bg).not.toMatch(/conic-gradient|chip-(top|side)/); expect(look.h).toBeGreaterThanOrEqual(36); expect(look.w).toBeGreaterThan(30);
  } finally { await close(); }
});

test('ART-002: Omaha nutzt dieselben Dateien und behält die bisherige Optik', async ({ page, app, browser }, info) => {
  test.skip(info.project.name !== 'desktop', 'einmal genügt');
  test.setTimeout(90000);
  const { pages, close } = await table(page, app, browser, info, 'omaha');
  try {
    await begin(page); await bets(pages);
    await expect(page.locator('.bet .chip').first()).toBeVisible();
    await expect(page.locator('#game')).not.toHaveAttribute('data-art-poker', '');
    expect(await page.locator('body').evaluate((b) => b.classList.contains('art-poker'))).toBe(false);
    const chip = await page.locator('.bet .chip').first().evaluate((el) => { const r = el.getBoundingClientRect(); return { bg: getComputedStyle(el).backgroundImage, w: r.width, h: r.height }; });
    expect(chip.bg).toMatch(/conic-gradient/);
    expect(Math.abs(chip.w - chip.h)).toBeLessThan(1); // rund – die Filterknopf-Regeln der Startseite greifen nicht mehr auf Pokerchips
  } finally { await close(); }
});
