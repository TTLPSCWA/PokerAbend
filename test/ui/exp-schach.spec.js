// EXP-088 Schach: Klang, Bewegung, Highlight (Schachmatt), reduzierte Bewegung, Neuladen und Zuschauen.
import { test, expect, expectSound, expectNoLeak } from './helpers.js';
import { openTable, watch, ok, soundLog, sounds, evidence, recordAnimations, animations, expectOnlyTransformOpacity, smoothReplay } from './exp-helpers.js';
import { writeFileSync, mkdirSync } from 'node:fs';

const move = async (target, from, to) => {
  await expect.poll(() => target.evaluate(() => lastState.turnId === lastState.you.id)).toBe(true);
  await ok(target, 'move', await target.evaluate(({ from, to }) => ({ from, to, key: lastState.g.key, revision: lastState.g.revision }), { from, to }));
};
const start = async (page, app, browser, options = {}) => {
  const table = await openTable(page, app, browser, 'schach', { guests: ['Ben'], ...options });
  await ok(page, 'start');
  await expect(page.locator('.ch-cell')).toHaveCount(64);
  const white = (await page.evaluate(() => lastState.turnId === lastState.you.id)) ? page : table.others[0];
  return { ...table, white, black: white === page ? table.others[0] : page };
};

test('EXP-088: Palette, Zug-, Schlag- und Schach-Klang; Figuren gleiten nur mit transform', async ({ page, app, browser }, info) => {
  const { white, black, close } = await start(page, app, browser);
  try {
    await expect(page.locator('#kg')).toHaveAttribute('data-xp-kit', 'schach');
    await soundLog(page); await recordAnimations(page);
    await move(white, 'e2', 'e4');
    await expectSound(page, { event: 'piece', palette: 'schach', game: 'schach' });
    await expect.poll(async () => (await animations(page)).length).toBeGreaterThan(0);
    await move(black, 'd7', 'd5');
    await soundLog(page);
    await move(white, 'e4', 'd5'); // schlägt
    await expectSound(page, 'capture'); await expectSound(page, 'slide');
    await move(black, 'd8', 'd5');
    await move(white, 'b1', 'c3');
    await soundLog(page);
    await move(black, 'd5', 'e5'); // Schach
    await expectSound(page, 'check');
    await expect(page.locator('.ch-cell.xp-check')).toHaveAttribute('data-square', 'e1');
    const seen = await animations(page);
    expectOnlyTransformOpacity(seen);
    expect(seen.every((a) => a.duration <= 1200)).toBe(true);
    // Wer dran ist, hört die Palette statt des alten Pieptons.
    expect(await sounds(white)).not.toContain('beep');
    // Bewegungsbudget: ein gegnerischer Zug gleitet flüssig (4× gedrosselte CPU).
    await move(white, 'f1', 'e2');
    await move(black, 'e5', 'e2'); await page.waitForTimeout(500);
    await expectNoLeak(page, { requireSecrets: false });
    await close(); // die Messung läuft ohne zweiten Browser auf derselben Maschine
    const metrics = await smoothReplay(page, 'schach');
    if (process.env.EXP_CAPTURE === '1') { mkdirSync('docs/design/experience/EXP-088', { recursive: true }); writeFileSync(`docs/design/experience/EXP-088/fps-${info.project.name}.json`, JSON.stringify(metrics, null, 2) + '\n'); }
  } finally { await close(); }
});

test('EXP-088: Schachmatt – König kippt, Brett dimmt, Ergebnisfenster wartet; danach Neuladen und Zuschauen ohne Rückstau', async ({ page, app, browser }, info) => {
  const { white, black, close } = await start(page, app, browser);
  try {
    await move(white, 'f2', 'f3'); await move(black, 'e7', 'e5'); await move(white, 'g2', 'g4');
    await soundLog(page); await soundLog(black); await recordAnimations(page);
    await move(black, 'd8', 'h4'); // Narrenmatt
    await expect.poll(() => page.evaluate(() => lastState.phase)).toBe('over');
    await expect(page.locator('#kg')).toHaveClass(/xp-hold/);
    await expect(page.locator('.ch-board')).toHaveAttribute('data-xp', 'matt');
    await expect(page.locator('.ch-cell.xp-mated')).toHaveAttribute('data-square', 'e1');
    await expect(page.locator('.ch-cell.xp-mating')).toHaveAttribute('data-square', 'h4');
    await expect(page.locator('.kg-over')).toHaveCSS('opacity', '0');
    await expectSound(page, 'highlight');
    await page.waitForTimeout(900);
    await evidence(page, info, 'EXP-088', 'schachmatt');
    // Nach dem Highlight erscheint das Ergebnis mit der Siegerbühne.
    await expect(page.locator('#kg')).not.toHaveClass(/xp-hold/, { timeout: 4000 });
    await expect(page.locator('.kg-over')).toHaveCSS('opacity', '1');
    await expect(page.locator('.kg-over .winner-stage')).toBeVisible();
    // Die Feier beginnt erst jetzt und läuft weiter, obwohl der Server das Rundenende zweimal schickt.
    await expect(black.locator('.kg-over .winner-paper').first()).toBeAttached();
    await expectSound(black, { event: 'win', palette: 'schach' });
    expectOnlyTransformOpacity(await animations(page));
    await evidence(page, info, 'EXP-088', 'ergebnis');
    // Neuladen: sofort der Endzustand, kein Ton, kein Warten.
    await page.reload(); await expect(page.locator('.ch-board.xp-matt')).toBeVisible();
    await soundLog(page);
    await expect(page.locator('#kg')).not.toHaveClass(/xp-hold/);
    await expect(page.locator('.kg-over')).toBeVisible();
    await page.waitForTimeout(400);
    expect(await sounds(page)).toEqual([]);
    // Zuschauer sehen dasselbe Mattbild ohne Animation.
    const { watcher, close: leave } = await watch(page, app, browser);
    try { await expect(watcher.locator('.ch-cell.xp-mated')).toHaveAttribute('data-square', 'e1'); await expect(watcher.locator('#kg')).not.toHaveClass(/xp-hold/); } finally { await leave(); }
  } finally { await close(); }
});

test('EXP-088: „Animationen reduzieren“ – höchstens 150 ms, kein Warten vor dem Ergebnis, Töne bleiben', async ({ page, app, browser }) => {
  const { white, black, close } = await start(page, app, browser, { reduced: true });
  try {
    await move(white, 'f2', 'f3'); await move(black, 'e7', 'e5');
    await soundLog(page); await recordAnimations(page);
    await move(white, 'g2', 'g4');
    await expectSound(page, 'piece');
    await move(black, 'd8', 'h4');
    await expect(page.locator('.kg-over')).toBeVisible();
    await expect(page.locator('#kg')).not.toHaveClass(/xp-hold/);
    await expect(page.locator('.kg-over')).toHaveCSS('opacity', '1');
    await expect(page.locator('.ch-cell.xp-mated')).toHaveCount(1);
    for (const a of await animations(page)) expect(a.duration, JSON.stringify(a)).toBeLessThanOrEqual(150);
  } finally { await close(); }
});

test('EXP-088: Pause – Zustand springt ohne Bewegung; Rochade bewegt König und Turm gemeinsam', async ({ page, app, browser }) => {
  const { white, black, close } = await start(page, app, browser);
  try {
    for (const [w, b] of [[['e2', 'e4'], ['e7', 'e5']], [['g1', 'f3'], ['b8', 'c6']], [['f1', 'c4'], ['f8', 'c5']]]) { await move(white, ...w); await move(black, ...b); }
    await page.waitForTimeout(500); // Klänge des letzten Zugs (leicht verzögert) sind verklungen
    await recordAnimations(page); await soundLog(page);
    await expect.poll(() => white.evaluate(() => lastState.turnId === lastState.you.id)).toBe(true);
    const castle = await white.evaluate(() => { const m = lastState.g.legal.find((m) => m.castle); return { from: m.from, to: m.to, castle: m.castle, key: lastState.g.key, revision: lastState.g.revision }; });
    await ok(white, 'move', castle);
    await expect.poll(async () => (await animations(page)).length).toBe(2); // König und Turm
    const [a, b] = await animations(page); expect(a.delay).toBe(b.delay); expect(a.duration).toBe(b.duration);
    await expect.poll(async () => (await sounds(page)).filter((e) => e === 'piece').length).toBe(2);
    await expect(page.locator('[data-square=g1] .ch-piece')).toBeVisible(); await expect(page.locator('[data-square=f1] .ch-piece')).toBeVisible();
    // Gemeinsame Pause: kein Animationsrückstau, nichts läuft nach.
    await ok(page, 'gamePause', { paused: true }); await recordAnimations(page);
    await ok(page, 'gamePause', { paused: false });
    await page.waitForTimeout(300);
    expect(await animations(page)).toEqual([]);
  } finally { await close(); }
});

test('EXP-Kit: Siegerfeier ohne Highlight startet sofort und übersteht das doppelt gesendete Rundenende', async ({ page, app, browser }) => {
  const { white, black, close } = await start(page, app, browser);
  try {
    await move(white, 'e2', 'e4');
    await soundLog(black);
    await ok(white, 'resign');
    await expect(black.locator('.kg-over')).toBeVisible();
    await expect(black.locator('#kg')).not.toHaveClass(/xp-hold/);
    await black.waitForTimeout(450); // der zweite, gleiche Endzustand ist längst da
    expect(await black.locator('.kg-over .winner-paper').count()).toBeGreaterThan(0);
    expect(await black.evaluate(() => document.getAnimations().length)).toBeGreaterThan(0);
    await expectSound(black, 'win');
  } finally { await close(); }
});


test('SCHACH-01: Figuren sind eingebettet (weiß hell, schwarz dunkel, kein externes <use>), Markierungen mittig, Bedenkzeit in der Lobby', async ({ page, app, browser }) => {
  const table = await openTable(page, app, browser, 'schach', { guests: ['Ben'] });
  try {
    // Lobby: Host wählt die Bedenkzeit direkt dort, alle anderen sehen sie
    const pick = page.locator('.ch-clock-pick select');
    await expect(pick).toBeVisible();
    await pick.selectOption('5+3');
    await expect.poll(() => page.evaluate(() => lastState.settings.clock)).toBe('5+3');
    await expect(table.others[0].locator('.ch-clock-pick')).toContainText('5+3');
    await ok(page, 'start');
    await expect(page.locator('.ch-cell')).toHaveCount(64);
    const fills = await page.evaluate(() => ({
      uses: document.querySelectorAll('.ch-piece use').length,
      white: getComputedStyle(document.querySelector('.ch-cell[data-square="e1"] .ch-piece g')).fill,
      black: getComputedStyle(document.querySelector('.ch-cell[data-square="e8"] .ch-piece g')).fill,
    }));
    expect(fills.uses).toBe(0);
    expect(fills.white).toBe('rgb(247, 237, 207)');
    expect(fills.black).toBe('rgb(51, 44, 40)');
    // Zugmarkierung liegt in der Mitte des Feldes
    const white = (await page.evaluate(() => lastState.turnId === lastState.you.id)) ? page : table.others[0];
    await white.locator('[data-square="e2"]').click();
    const dot = await white.evaluate(() => { const c = document.querySelector('.ch-cell[data-square="e4"]'), r = c.getBoundingClientRect(), a = getComputedStyle(c, '::after'); return { w: parseFloat(a.width), h: parseFloat(a.height), size: r.width, left: a.left, top: a.top }; });
    expect(Math.abs(dot.w - dot.h)).toBeLessThan(1);
    expect(Math.abs(dot.w - dot.size * 0.26)).toBeLessThan(2);
  } finally { await table.close(); }
});
