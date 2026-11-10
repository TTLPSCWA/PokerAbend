// EXP-001 Scotland Yard: Ticketklänge, Fahrt entlang der Linie, Tageszeit, Auftauchen im Nebel, Festnahme als Highlight.
import { test, expect, expectSound, expectNoLeak } from './helpers.js';
import { openTable, watch, ok, soundLog, sounds, evidence, recordAnimations, animations, expectOnlyTransformOpacity, smoothReplay, fpsEvidence } from './exp-helpers.js';

const turnPage = async (pages) => { for (const p of pages) if (await p.evaluate(() => lastState.turnId === lastState.you.id)) return p; return null; };
// Wer am Zug ist, fährt zur ersten erlaubten Haltestelle. Liefert Seite, Rolle und Ticket.
async function move(pages) {
  let p; await expect.poll(async () => !!(p = await turnPage(pages))).toBe(true);
  const { legal, isX } = await p.evaluate(() => ({ legal: lastState.g.legal, isX: lastState.g.isX }));
  const choice = legal.find((m) => m.ticket !== 'black') || legal[0];
  await ok(p, 'syMove', { to: choice.to, ticket: choice.ticket, double: false });
  return { p, isX, ticket: choice.ticket };
}
const start = async (page, app, browser, options = {}) => {
  const table = await openTable(page, app, browser, 'scotland-yard', { guests: ['Ben', 'Cleo'], ...options });
  await ok(page, 'syRole', { target: await table.others[0].evaluate(() => lastState.you.id) }); // Ben ist Mr. X, die Hauptseite Detektiv
  await ok(page, 'start'); await expect(page.locator('.sy-map')).toBeVisible();
  return table;
};
// Darstellung auf dem bestätigten Tisch: Mr. X taucht an einer Haltestelle auf.
const revealScene = (page) => page.evaluate(() => {
  const prev = JSON.parse(JSON.stringify(lastState)), view = JSON.parse(JSON.stringify(lastState));
  const station = view.g.map.nodes.find((n) => !view.g.detectives.some((d) => d.station === n.id)).id;
  view.g.travel.push({ move: view.g.travel.length + 1, ticket: 'taxi', station }); view.g.move = view.g.travel.length;
  view.g.lastSeen = { move: view.g.move, station }; view.g.xPosition = station;
  return __experiences['scotland-yard'].present(prev, view) && station;
});
// Darstellung auf dem bestätigten Tisch: Ein Detektiv steht auf dem Feld von Mr. X, die Detektive gewinnen.
const arrestScene = (page) => page.evaluate(() => {
  const prev = JSON.parse(JSON.stringify(lastState)), view = JSON.parse(JSON.stringify(lastState));
  view.phase = 'over'; view.g.xPosition = view.g.detectives[0].station; view.result = { winners: view.g.detectives.map((d) => d.id) };
  return __experiences['scotland-yard'].present(prev, view);
});

test('EXP-001: Ticketklang, Fahrt entlang der Linie nur mit transform, Tageszeit, Bewegungsbudget', async ({ page, app, browser }, info) => {
  test.setTimeout(120000);
  const { others, close } = await start(page, app, browser);
  try {
    const pages = [page, ...others];
    await expect(page.locator('#kg')).toHaveAttribute('data-xp-kit', 'scotland-yard');
    await expect(page.locator('.sy-map')).toHaveAttribute('data-xp-time', 'tag');
    await soundLog(page); await recordAnimations(page);
    const first = await move(pages); expect(first.isX).toBe(true);
    await expectSound(page, { event: first.ticket, palette: 'scotland-yard', game: 'scotland-yard' });
    // Mr. X ist verdeckt gefahren: Für Detektive bewegt sich nichts.
    expect((await animations(page)).filter((a) => /sy-piece/.test(a.target))).toEqual([]);
    let mine = null;
    for (let i = 0; i < 4 && !mine; i++) { const m = await move(pages); if (m.p === page) mine = m; }
    expect(mine, 'Hauptseite war als Detektiv am Zug').toBeTruthy();
    await expectSound(page, mine.ticket);
    await expect.poll(async () => (await animations(page)).some((a) => /sy-piece/.test(a.target))).toBe(true);
    const seen = await animations(page);
    expectOnlyTransformOpacity(seen);
    for (const a of seen) expect(a.duration).toBeLessThanOrEqual(900);
    expect(await sounds(page)).not.toContain('beep');
    await expectNoLeak(page, { requireSecrets: false });
    await close(); // Messung ohne weitere Browser
    await fpsEvidence(info, 'EXP-001', await smoothReplay(page, 'scotland-yard', { gap: 1000 }));
  } finally { await close(); }
});

test('EXP-001: Auftauchen im Nebel und Festnahme mit Handschellen und Stempel', async ({ page, app, browser }, info) => {
  const { close } = await start(page, app, browser);
  try {
    await soundLog(page); await recordAnimations(page);
    const station = await revealScene(page); expect(station).toBeTruthy();
    await expectSound(page, 'taxi'); await expectSound(page, 'reveal');
    await expect(page.locator('.xp-sy-fog')).toBeAttached();
    await expect(page.locator('.sy-map')).toHaveAttribute('data-xp', 'auftauchen');
    expectOnlyTransformOpacity(await animations(page));
    await page.waitForTimeout(500); await evidence(page, info, 'EXP-001', 'auftauchen');
    await soundLog(page);
    expect(await arrestScene(page)).toBe(true);
    await expect(page.locator('.sy-map')).toHaveAttribute('data-xp', 'festnahme');
    await expectSound(page, 'cuffs'); await expectSound(page, 'stamp'); await expectSound(page, 'highlight');
    await expect(page.locator('.xp-plaque.xp-sy-stamp')).toContainText('GEFASST');
    expectOnlyTransformOpacity(await animations(page));
    await page.waitForTimeout(350); await evidence(page, info, 'EXP-001', 'festnahme');
    // Der nächste bestätigte Zustand räumt alles weg (kein Rückstau).
    await ok(page, 'gamePause', { paused: true });
    await expect(page.locator('.xp-plaque')).toHaveCount(0); await expect(page.locator('.xp-sy-fog')).toHaveCount(0);
    await ok(page, 'gamePause', { paused: false });
  } finally { await close(); }
});

test('EXP-001: „Animationen reduzieren“, Neuladen und Zuschauen ohne Rückstau und ohne Geheimnisse', async ({ page, app, browser }) => {
  test.setTimeout(120000);
  const { others, close } = await start(page, app, browser, { reduced: true });
  try {
    const pages = [page, ...others];
    await soundLog(page); await recordAnimations(page);
    let mine = null;
    for (let i = 0; i < 5 && !mine; i++) { const m = await move(pages); if (m.p === page) mine = m; }
    await expectSound(page, mine.ticket);
    for (const a of await animations(page)) expect(a.duration, JSON.stringify(a)).toBeLessThanOrEqual(150);
    expect(await arrestScene(page)).toBe(true);
    await expect(page.locator('.xp-plaque.xp-sy-stamp')).toHaveCount(1);
    for (const a of await animations(page)) expect(a.duration, JSON.stringify(a)).toBeLessThanOrEqual(150);
    await page.reload(); await expect(page.locator('.sy-map')).toBeVisible();
    await soundLog(page); await recordAnimations(page); await page.waitForTimeout(400);
    expect(await sounds(page)).toEqual([]); expect(await animations(page)).toEqual([]);
    await expect(page.locator('.sy-map')).toHaveAttribute('data-xp-time', 'tag');
    const { watcher, close: leave } = await watch(page, app, browser);
    try {
      await expect(watcher.locator('.sy-map')).toBeVisible(); await expect(watcher.locator('.xp-plaque')).toHaveCount(0);
      // Zuschauer sehen Mr. X nicht, solange er nicht aufgetaucht ist.
      await expect(watcher.locator('.sy-stop.mister')).toHaveCount(0);
    } finally { await leave(); }
  } finally { await close(); }
});
