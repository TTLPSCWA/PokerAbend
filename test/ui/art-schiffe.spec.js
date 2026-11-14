// ART-013 Schiffe versenken: ein Spiel, wählbare Designs (Skins). Geprüft wird im laufenden Spiel: Design aus den Raumeinstellungen,
// echte Schiffsbilder auf den richtigen Zellen, Zielmeer ohne verdeckte Schiffe, Zuschauer, Wiederverbinden, Größen und Nachbarspiele.
// Mit ART_CAPTURE=1 entstehen die Nachweisbilder unter docs/design/art/ART-013/.
import { test, expect, login, selectGame, expectNoLeak } from './helpers.js';
import { independentPlayer } from './independent-player.js';
import { mkdirSync } from 'node:fs';
import { SKINS } from '../../games/schiffe/skins.js';

const DIR = 'docs/design/art/ART-013';
const SKIN_IDS = SKINS.map((s) => s.id);
const H = (cell) => ({ cell, horizontal: true });
const FLEET_B = [H(5), H(25), H(45), H(65), H(85)]; // Ben: 5er A6…, 4er, 3er, 3er, 2er (Zeilen 1, 3, 5, 7, 9 ab Spalte F)
const capture = async (page, info, name) => {
  let path = info.outputPath(`${name}.png`);
  if (process.env.ART_CAPTURE === '1') { mkdirSync(DIR, { recursive: true }); path = `${DIR}/${name}-${info.project.name}.png`; }
  await page.screenshot({ path });
};

// Raum über die Oberfläche erstellen: Design (falls wählbar) und Variante wie ein Host.
async function host(page, app, { skin, variant = 'classic', reduced = true } = {}) {
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page, app); await selectGame(page, 'schiffe');
  if (skin && await page.locator('[data-choice-key=skin]').count()) await page.locator(`[data-choice-key=skin][data-choice-value="${skin}"]`).click();
  await page.locator('#host-variant').selectOption(variant);
  await page.locator('input[data-cf=turnTime]').fill('0');
  await page.locator('#host-form button[type=submit]').click();
  await page.getByRole('button', { name: 'Mitspielen', exact: true }).click();
  const code = await page.evaluate(() => lastState.code);
  return code;
}
// Gegner mit fester Aufstellung; Anna setzt zufällig über die Oberfläche
async function startGame(page, app, code, { bens = FLEET_B } = {}) {
  const ben = await independentPlayer(app, code, 'Ben');
  expect((await page.evaluate(() => send('start'))).ok).toBe(true);
  await expect.poll(() => page.evaluate(() => lastState.phase)).toBe('playing');
  expect((await ben.ask('place', { ships: bens })).ok).toBe(true);
  return ben;
}
// Anna schießt, danach schießt Ben (stiller Testspieler) auf ein festes Feld – so ist Anna wieder dran
const BEN_CELLS = [0, 1, 2, 3, 4, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
async function annaShoots(page, ben, cell) {
  await expect.poll(() => page.evaluate(() => lastState.turnId === lastState.you.id), { timeout: 15000 }).toBe(true);
  expect((await page.evaluate((c) => send('shoot', { cell: c }), cell)).ok).toBe(true);
  await expect.poll(() => page.evaluate(() => lastState.phase === 'playing' && lastState.turnId !== lastState.you.id), { timeout: 15000 }).toBe(true);
  expect((await ben.ask('shoot', { cell: BEN_CELLS.shift() })).ok).toBe(true);
}
const placeOwn = async (page) => { await page.locator('[data-g=random]').click(); await page.locator('[data-g=ready]').click(); await expect.poll(() => page.evaluate(() => lastState.g.step)).toBe('shoot'); };

// Verdeckte Schiffe des Gegners: weder in den Serverdaten noch im Bild (Zielmeer: nur Treffer, Wasser und ausdrücklich versenkte Schiffe).
// Zusätzlich läuft die allgemeine Darstellungsprüfung (ohne Pflicht zu privaten Werten: sie kennt Schiffe nicht als privaten Pfad).
async function noShipLeak(page, ben) {
  const r = await page.evaluate(() => {
    const foe = Object.keys(lastState.g.seas).find((x) => x !== lastState.you.id), sea = lastState.g.seas[foe];
    const target = [...document.querySelectorAll('.sv-sea:not(.small)')].map((el) => el.querySelector('.sv-board'));
    const sunkCells = new Set(sea.sunk.flatMap((s) => s.cells));
    const shipCells = target.flatMap((b) => [...b.querySelectorAll('.sv-cell.ship')]).map((el) => el.getAttribute('aria-label'));
    return { ships: sea.ships, sunk: sea.sunk.length, images: target.reduce((n, b) => n + b.querySelectorAll('img').length, 0), vessels: target.reduce((n, b) => n + b.querySelectorAll('.sv-vessel').length, 0), shipCells: shipCells.length, sunkCells: sunkCells.size, state: JSON.stringify(lastState) };
  });
  expect(r.ships, 'Serverdaten: Schiffe des Gegners verdeckt').toBeNull();
  expect(r.images, 'Zielmeer: ein Bild je versenktem Schiff, sonst keins').toBe(r.sunk);
  expect(r.vessels).toBe(r.sunk);
  expect(r.shipCells, 'Zielmeer: nur versenkte Zellen als Schiff markiert').toBe(r.sunkCells);
  const unsunk = FLEET_B.filter((s) => !JSON.parse(r.state).g.seas[Object.keys(JSON.parse(r.state).g.seas).find((x) => x !== JSON.parse(r.state).you.id)].sunk.some((x) => x.cells.includes(s.cell)));
  for (const s of unsunk) expect(r.state, `Position ${s.cell} nicht in den Daten`).not.toMatch(new RegExp(`"cells":\[[^\]]*\b${s.cell}\b`));
  await expectNoLeak(page, { peers: [ben.view()], requireSecrets: false });
}

// Liegt jedes Schiffsbild genau über den Zellen seines Schiffs? (Gitterbereich = Vereinigung der Zellen)
async function vesselsMatchShips(page) {
  // Taktik-Konsole auf dem Handy: das eigene Meer liegt hinter dem Reiter „Eigene Flotte“
  if (await page.locator('.sv-tabs').isVisible()) await page.locator('[data-g=svtab][data-tab=own]').click();
  return page.evaluate(() => {
    const me = lastState.you.id, ships = lastState.g.seas[me].ships;
    const board = (document.querySelector('.sv-sea.small') || document.querySelector('.sv-sea')).querySelector('.sv-board'); // im Gefecht das kleine eigene Meer, beim Setzen das einzige
    const cell = (i) => board.querySelector(`.sv-cell[aria-label^="${'ABCDEFGHIJ'[i % 10]}${Math.floor(i / 10) + 1} "]`).getBoundingClientRect();
    const vessels = [...board.querySelectorAll('.sv-vessel')], out = [];
    for (const s of ships) {
      const a = cell(s.cells[0]), b = cell(s.cells.at(-1)), want = { x: a.x, y: a.y, r: b.right, b: b.bottom };
      const vertical = s.cells[1] - s.cells[0] === 10;
      const v = vessels.find((el) => { const r = el.getBoundingClientRect(); return Math.abs(r.x - want.x) < 2.5 && Math.abs(r.y - want.y) < 2.5 && Math.abs(r.right - want.r) < 2.5 && Math.abs(r.bottom - want.b) < 2.5; });
      out.push({ size: s.size, found: !!v, orientation: v ? (v.classList.contains('v') ? 'v' : 'h') : null, vertical, loaded: v ? (v.querySelector('img').complete && v.querySelector('img').naturalWidth > 0) : false, inside: v ? (() => { const i = v.getBoundingClientRect(), bb = board.getBoundingClientRect(); return i.left >= bb.left && i.right <= bb.right && i.top >= bb.top && i.bottom <= bb.bottom && ['hidden', 'clip'].includes(getComputedStyle(board).overflow); })() : false });
    }
    return { count: vessels.length, ships: out };
  });
}

for (const skin of SKIN_IDS) for (const variant of ['classic', 'salvo']) {
  test(`ART-013 ${skin}/${variant}: Design aus den Raumeinstellungen, echte Schiffsbilder genau auf den Zellen`, async ({ page, app }, info) => {
    test.setTimeout(90000);
    const code = await host(page, app, { skin, variant });
    await expect.poll(() => page.evaluate(() => lastState.settings.skin)).toBe(skin);
    expect(await page.evaluate(() => lastState.variant)).toBe(variant);
    await expect(page.locator('#kg')).toHaveAttribute('data-sv-skin', skin);
    const ben = await startGame(page, app, code);
    try {
      await expect(page.locator('.sv-stage')).toHaveAttribute('data-skin', skin);
      await capture(page, info, `${skin}-${variant}-leer`);
      await page.locator('[data-g=random]').click();
      // Beim Setzen: ein Bild je Schiff der Flotte, alle geladen
      await expect(page.locator('.sv-board .sv-vessel')).toHaveCount(5);
      await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('.sv-vessel img')].every((i) => i.complete && i.naturalWidth > 0))).toBe(true);
      await capture(page, info, `${skin}-${variant}-setzen`);
      await page.locator('[data-g=ready]').click();
      await expect.poll(() => page.evaluate(() => lastState.g.step)).toBe('shoot');
      const own = await vesselsMatchShips(page);
      expect(own.count).toBe(5);
      for (const s of own.ships) { expect(s.found, `Schiff ${s.size}`).toBe(true); expect(s.loaded).toBe(true); expect(s.inside, 'Schiff liegt im Meer, Bildrand wird am Rahmen abgeschnitten').toBe(true); expect(s.orientation).toBe(s.vertical ? 'v' : 'h'); }
      // Zielmeer: noch kein einziges Schiffsbild und kein <img>
      await expect(page.locator('.sv-sea:not(.small) .sv-board img')).toHaveCount(0);
      await expect(page.locator('.sv-sea:not(.small) .sv-vessel')).toHaveCount(0);
    } finally { await ben.close(); }
  });
}

test('ART-013: Zielmeer zeigt ein Schiff erst nach „versenkt“ – Treffer und Wasser als Marken, nichts Verdecktes im DOM', async ({ page, app }, info) => {
  test.setTimeout(90000);
  const code = await host(page, app, { skin: SKIN_IDS.at(-1) });
  const ben = await startGame(page, app, code);
  try {
    await placeOwn(page);
    await expect.poll(() => page.evaluate(() => lastState.turnId === lastState.you.id)).toBe(true);
    await annaShoots(page, ben, 99); // Wasser
    await annaShoots(page, ben, 85); // Treffer auf den 2er (A…: Zeile 9, Spalte F): noch nicht versenkt
    await expect(page.locator('.sv-sea:not(.small) .sv-cell.hit')).toHaveCount(1);
    await expect(page.locator('.sv-sea:not(.small) .sv-vessel')).toHaveCount(0);
    await expect(page.locator('.sv-sea:not(.small) .sv-board img')).toHaveCount(0);
    await noShipLeak(page, ben);
    await annaShoots(page, ben, 86); // 2er versenkt
    await expect(page.locator('.sv-sea:not(.small) .sv-vessel')).toHaveCount(1);
    await expect(page.locator('.sv-sea:not(.small) .sv-vessel.wreck')).toHaveCount(1);
    await expect(page.locator('.sv-sea:not(.small) .sv-vessel img')).toHaveCount(1);
    const sunk = await page.evaluate(() => { const foe = Object.keys(lastState.g.seas).find((x) => x !== lastState.you.id); return lastState.g.seas[foe].sunk.map((s) => s.cells); });
    expect(sunk).toEqual([[85, 86]]);
    // Markierungen tragen die Information auch ohne Farbe: Treffer = Stern (eigene Form), Wasser = Ring
    const marks = await page.locator('.sv-sea:not(.small) .sv-cell.hit i').first().evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(marks).toMatch(/mark-hit\.svg/);
    const miss = await page.locator('.sv-sea:not(.small) .sv-cell.miss i').first().evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(miss).toMatch(/mark-miss\.svg/);
    await capture(page, info, `${SKIN_IDS.at(-1)}-gefecht-versenkt`);
    await noShipLeak(page, ben);
  } finally { await ben.close(); }
});

test('ART-013: Sinkbewegung läuft nur ohne reduzierte Bewegung und genau einmal je Schiff', async ({ page, app }) => {
  test.setTimeout(90000);
  const code = await host(page, app, { skin: SKIN_IDS.at(-1), reduced: false });
  const ben = await startGame(page, app, code);
  try {
    await placeOwn(page);
    await expect.poll(() => page.evaluate(() => lastState.turnId === lastState.you.id)).toBe(true);
    await annaShoots(page, ben, 85);
    await annaShoots(page, ben, 86);
    await expect(page.locator('.sv-sea:not(.small) .sv-vessel.sinking')).toHaveCount(1);
    await page.waitForTimeout(1100);
    await page.evaluate(() => savePrefs()); // erneutes Zeichnen: die Bewegung beginnt nicht von vorn
    await page.waitForTimeout(100);
    await expect(page.locator('.sv-sea:not(.small) .sv-vessel.sinking')).toHaveCount(0);
    await expect(page.locator('.sv-sea:not(.small) .sv-vessel.wreck')).toHaveCount(1);
  } finally { await ben.close(); }
});

test('ART-013: Zuschauer sehen dasselbe Design und versenkte Schiffe, aber keine verdeckten', async ({ page, app, browser }, info) => {
  test.setTimeout(90000);
  const skin = SKIN_IDS.at(-1);
  const code = await host(page, app, { skin });
  const ben = await startGame(page, app, code);
  const context = await browser.newContext({ ...info.project.use, viewport: page.viewportSize() });
  try {
    await placeOwn(page);
    const watcher = await context.newPage(); await login(watcher, app, 'Zoe');
    await watcher.evaluate((c) => joinAndEnter(c, 'watch'), code);
    await expect.poll(() => watcher.evaluate(() => lastState?.settings?.skin)).toBe(skin);
    await expect(watcher.locator('#kg')).toHaveAttribute('data-sv-skin', skin);
    await expect(watcher.locator('.sv-board')).toHaveCount(2);
    await expect(watcher.locator('.sv-vessel')).toHaveCount(0); // noch nichts versenkt, nichts offen
    await expect.poll(() => page.evaluate(() => lastState.turnId === lastState.you.id)).toBe(true);
    await annaShoots(page, ben, 85);
    await annaShoots(page, ben, 86);
    await expect(watcher.locator('.sv-vessel')).toHaveCount(1);
    await expect(watcher.locator('.sv-vessel.wreck')).toHaveCount(1);
    await expect(watcher.locator('.sv-vessel img')).toHaveCount(1);
    await capture(watcher, info, `${skin}-zuschauer`);
  } finally { await context.close(); await ben.close(); }
});

test('ART-013: Wiederverbinden (Seite neu laden) stellt Design und Schiffe wieder her, ohne Sinkbewegung', async ({ page, app }) => {
  test.setTimeout(90000);
  const skin = SKIN_IDS.at(-1);
  const code = await host(page, app, { skin, reduced: false });
  const ben = await startGame(page, app, code);
  try {
    await placeOwn(page);
    await expect.poll(() => page.evaluate(() => lastState.turnId === lastState.you.id)).toBe(true);
    await annaShoots(page, ben, 85);
    await annaShoots(page, ben, 86);
    await expect(page.locator('.sv-sea:not(.small) .sv-vessel.wreck')).toHaveCount(1);
    await page.reload();
    await expect.poll(() => page.evaluate(() => lastState?.settings?.skin), { timeout: 20000 }).toBe(skin);
    await expect(page.locator('#kg')).toHaveAttribute('data-sv-skin', skin);
    await expect(page.locator('.sv-sea.small .sv-vessel')).toHaveCount(5);
    await expect(page.locator('.sv-sea:not(.small) .sv-vessel.wreck')).toHaveCount(1);
    await expect(page.locator('.sv-vessel.sinking')).toHaveCount(0);
  } finally { await ben.close(); }
});

for (const [w, h] of [[1920, 1080], [1440, 900], [390, 844], [360, 800]]) {
  test(`ART-013: ${w}×${h}: nichts läuft über, Zellen bedienbar, Schiffe im Meer`, async ({ page, app }, info) => {
    test.setTimeout(90000);
    test.skip(info.project.name === 'mobil' && w > 600, 'Desktopgrößen nur im Desktop-Projekt');
    test.skip(info.project.name === 'desktop' && w < 600, 'Handygrößen nur im Mobil-Projekt');
    await page.setViewportSize({ width: w, height: h });
    const code = await host(page, app, { skin: SKIN_IDS.at(-1) });
    const ben = await startGame(page, app, code);
    try {
      await page.locator('[data-g=random]').click();
      const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.body.scrollWidth <= innerWidth + 1);
      expect(await noOverflow()).toBe(true);
      const cell = await page.locator('.sv-board .sv-cell').first().boundingBox();
      expect(cell.width, 'Zellenbreite').toBeGreaterThanOrEqual(w < 600 ? 27 : 34);
      expect(Math.abs(cell.width - cell.height), 'quadratische Zellen').toBeLessThan(2);
      await page.locator('[data-g=ready]').click();
      await expect.poll(() => page.evaluate(() => lastState.g.step)).toBe('shoot');
      await expect.poll(() => page.evaluate(() => lastState.turnId === lastState.you.id)).toBe(true);
      expect(await noOverflow()).toBe(true);
      // Ein Feld im Zielmeer antippen (Handy: erst wählen, dann Feuer) – die Marke erscheint nach dem Schuss
      const target = page.locator('.sv-sea:not(.small) button.sv-cell').nth(3);
      await target.scrollIntoViewIfNeeded(); await target.click();
      if (w < 600) await page.locator('[data-g=fire]').click();
      await expect.poll(() => page.evaluate(() => { const foe = Object.keys(lastState.g.seas).find((x) => x !== lastState.you.id); return Object.keys(lastState.g.seas[foe].shots).length; })).toBe(1);
      await capture(page, info, `${SKIN_IDS.at(-1)}-${w}x${h}`);
    } finally { await ben.close(); }
  });
}

test('ART-013: das Design gilt nur in Schiffe versenken – Nachbarspiele bleiben unverändert', async ({ page, app }) => {
  await login(page, app); await selectGame(page, 'viergewinnt');
  await page.locator('#host-form button[type=submit]').click();
  await expect(page.locator('#kg')).toBeVisible();
  await expect(page.locator('#kg')).not.toHaveAttribute('data-sv-skin', /.*/);
  await expect(page.locator('.sv-vessel, .sv-board')).toHaveCount(0);
});

test('ART-013: Designauswahl beim Erstellen – nur Aussehen, getrennt von der Spielvariante', async ({ page, app }, info) => {
  test.skip(SKIN_IDS.length < 2, 'erst mit zwei Designs gibt es eine Auswahl');
  await login(page, app); await selectGame(page, 'schiffe');
  const cards = page.locator('.create-choice-pick');
  await expect(cards).toHaveCount(SKIN_IDS.length);
  await expect(cards.first()).toHaveAttribute('aria-pressed', 'true'); // Standard: Klassisch
  expect(await cards.first().getAttribute('data-choice-value')).toBe('naval');
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('.create-choice-art img')].every((i) => i.complete && i.naturalWidth > 0))).toBe(true);
  await expect(page.locator('#host-variant option')).toHaveCount(2); // Variante bleibt eine eigene Auswahl
  await cards.nth(1).click();
  await expect(cards.nth(1)).toHaveAttribute('aria-pressed', 'true'); await expect(cards.first()).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#host-variant').selectOption('salvo');
  await expect(cards.nth(1)).toHaveAttribute('aria-pressed', 'true'); // Variantenwechsel ändert das Design nicht
  await capture(page, info, 'designauswahl');
  await page.locator('input[data-cf=turnTime]').fill('0');
  await page.locator('#host-form button[type=submit]').click();
  await expect.poll(() => page.evaluate(() => lastState?.settings?.skin)).toBe(SKIN_IDS[1]);
  expect(await page.evaluate(() => lastState.variant)).toBe('salvo');
});

test('ART-013: zwei Räume mit verschiedenen Designs gleichzeitig, kein Zustand läuft über', async ({ page, app, browser }, info) => {
  test.skip(SKIN_IDS.length < 2, 'erst mit zwei Designs möglich');
  test.setTimeout(90000);
  const codeA = await host(page, app, { skin: SKIN_IDS[0] });
  const context = await browser.newContext({ ...info.project.use, viewport: page.viewportSize() });
  try {
    const other = await context.newPage();
    const codeB = await host(other, app, { skin: SKIN_IDS.at(-1) });
    expect(codeA).not.toBe(codeB);
    await expect.poll(() => page.evaluate(() => lastState.settings.skin)).toBe(SKIN_IDS[0]);
    await expect.poll(() => other.evaluate(() => lastState.settings.skin)).toBe(SKIN_IDS.at(-1));
    await expect(page.locator('#kg')).toHaveAttribute('data-sv-skin', SKIN_IDS[0]);
    await expect(other.locator('#kg')).toHaveAttribute('data-sv-skin', SKIN_IDS.at(-1));
    // Zurück zur Startseite und in den anderen Raum: das Design des alten Raums bleibt nicht hängen
    await page.evaluate((c) => { location.hash = '#start'; }, codeA);
    await page.evaluate((c) => joinAndEnter(c, 'watch'), codeB);
    await expect(page.locator('#kg')).toHaveAttribute('data-sv-skin', SKIN_IDS.at(-1));
  } finally { await context.close(); }
});

// ---------- Taktik-Konsole (space): Flottenstatus, Gegnerflotte, Protokoll, Reiter, Zielerfassung ----------
test.describe('Taktik-Konsole', () => {
  test.skip(!SKIN_IDS.includes('space'), 'Design space nicht vorhanden');
  test('ART-013 space: Flottenstatus mit Rumpfintegrität, Gegnerflotte nur „unbekannt“ oder „vernichtet“, Protokoll – nichts Verdecktes', async ({ page, app }, info) => {
    test.setTimeout(90000);
    const code = await host(page, app, { skin: 'space' });
    const ben = await startGame(page, app, code);
    try {
      await placeOwn(page);
      if (info.project.name === 'mobil') await page.locator('[data-g=svtab][data-tab=own]').click(); // Flottenstatus und Protokoll liegen hinter dem Reiter
      await expect(page.locator('.sv-console')).toHaveCount(1);
      await expect(page.locator('.sv-own-fleet .sv-fl')).toHaveCount(5);
      await expect(page.locator('.sv-foe-fleet .sv-fl')).toHaveCount(5);
      await expect(page.locator('.sv-foe-fleet .sv-fl small', { hasText: 'Position unbekannt' })).toHaveCount(5);
      await expect(page.locator('.sv-foe-fleet .sv-fl.dead')).toHaveCount(0);
      await expect(page.locator('.sv-log')).toBeVisible(); // Protokoll: öffentliche Züge (z. B. „bereit“)
      await expect(page.locator('.sv-own-fleet .sv-sec i.hit')).toHaveCount(0);
      await annaShoots(page, ben, 99); // Wasser
      // Bens erster Schuss: Zelle 0 trifft Annas Schiff nur zufällig – Rumpfintegrität stimmt in jedem Fall mit den Schüssen überein
      const mine = await page.evaluate(() => { const me = lastState.you.id, sea = lastState.g.seas[me]; const hits = Object.keys(sea.shots).filter((c) => sea.shots[c] === 'hit').length; return { hits }; });
      await expect(page.locator('.sv-own-fleet .sv-sec i.hit')).toHaveCount(mine.hits);
      await expect(page.locator('.sv-log li')).not.toHaveCount(0);
      await annaShoots(page, ben, 85); await annaShoots(page, ben, 86); // 2er versenkt
      await expect(page.locator('.sv-foe-fleet .sv-fl.dead')).toHaveCount(1);
      await expect(page.locator('.sv-foe-fleet .sv-fl small', { hasText: 'Position unbekannt' })).toHaveCount(4);
      await expect(page.locator('.sv-foe-fleet .sv-fl.dead small')).toHaveText(/VERNICHTET/);
      // Die Gegnerflotte verrät keine Lage: kein Hinweis auf Zellen in der Liste, nur Name, Zustand und die Schiffsklasse als Bild
      const panel = await page.locator('.sv-foe-fleet').innerHTML();
      for (const s of FLEET_B) expect(panel).not.toMatch(new RegExp('\b' + s.cell + '\b'));
      await noShipLeak(page, ben);
      await capture(page, info, 'space-konsole');
    } finally { await ben.close(); }
  });

  test('ART-013 space: Reiter „Zielsektor / Eigene Flotte“ nur auf dem Handy, Zielerfassung vor dem Schuss', async ({ page, app }, info) => {
    test.setTimeout(90000);
    const code = await host(page, app, { skin: 'space' });
    const ben = await startGame(page, app, code);
    try {
      await placeOwn(page);
      const mobile = info.project.name === 'mobil';
      await expect(page.locator('.sv-tabs')).toBeVisible({ visible: mobile });
      if (mobile) {
        await expect(page.locator('.sv-col-target')).toBeVisible(); await expect(page.locator('.sv-col-own')).toBeHidden();
        await page.locator('[data-g=svtab][data-tab=own]').click();
        await expect(page.locator('.sv-col-own')).toBeVisible(); await expect(page.locator('.sv-col-target')).toBeHidden(); await expect(page.locator('.sv-col-info')).toBeVisible();
        await page.locator('[data-g=svtab][data-tab=target]').click();
        await expect(page.locator('.sv-col-target')).toBeVisible();
      } else { await expect(page.locator('.sv-col-own')).toBeVisible(); await expect(page.locator('.sv-col-target')).toBeVisible(); await expect(page.locator('.sv-col-info')).toBeVisible(); }
      // Zielen: Handy = Feld wählen (Klammern), dann „Feuer“; Maus = ein Klick schießt
      await expect.poll(() => page.evaluate(() => lastState.turnId === lastState.you.id)).toBe(true);
      const cell = page.locator('.sv-sea:not(.small) button.sv-cell').nth(7);
      await cell.scrollIntoViewIfNeeded(); await cell.click();
      if (mobile) {
        await expect(page.locator('.sv-sea:not(.small) .sv-cell.aim')).toHaveCount(1);
        const aim = await page.locator('.sv-sea:not(.small) .sv-cell.aim').evaluate((el) => getComputedStyle(el, '::after').backgroundImage);
        expect(aim).toMatch(/mark-aim.svg/);
        await page.locator('[data-g=fire]').click();
      }
      await expect.poll(() => page.evaluate(() => { const foe = Object.keys(lastState.g.seas).find((x) => x !== lastState.you.id); return Object.keys(lastState.g.seas[foe].shots).length; })).toBe(1);
    } finally { await ben.close(); }
  });
});
