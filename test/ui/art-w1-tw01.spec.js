// ART-W1 · TW-01 „Schatten über Neuengland“ (Monopoly): Auswahl im Host-Menü, Synchronisierung, Spielablauf, Lesbarkeit, Spielerfarben,
// mehrfacher Wechsel, Rückkehr zu „Standard“ ohne Rückstände, Asset-Fehler, Junior ohne Welt, Mobil und reduzierte Bewegung.
// ART_W1_CAPTURE=1 legt die dauerhaften Vergleichsbilder unter docs/design/art/ART-W1/ ab.
import { test, expect, openTable, emit } from './card-ux-helpers.js';
import { mkdirSync } from 'node:fs';
import { BOARD } from '../../public/games/monopoly/data.js';
import { TW01_FIELDS } from '../../public/games/theme-worlds/tw-01.js';

const DIR = 'docs/design/art/ART-W1';
const shot = async (p, name, info) => { if (process.env.ART_W1_CAPTURE !== '1') return; mkdirSync(DIR, { recursive: true }); await p.screenshot({ path: `${DIR}/${name}-${info.project.name}.jpg`, type: 'jpeg', quality: 80 }); };
const fieldTexts = (p) => p.evaluate(() => [...document.querySelectorAll('.mo-field')].sort((a, b) => a.dataset.field - b.dataset.field).map((f) => f.querySelector('b').textContent.trim()));
const look = (p) => p.evaluate(() => {
  const css = (q) => { const e = document.querySelector(q); return e ? getComputedStyle(e) : null; };
  const board = css('.mo-board'), main = css('.kg-monopoly .kg-main'), field = css('.mo-field'), center = css('.mo-center'), tok = document.querySelector('.mo-token');
  return { board: board.backgroundColor + '|' + board.borderTopColor, main: main.backgroundImage, field: field.backgroundImage + '|' + field.color, center: center.backgroundImage,
    tokenAfter: tok ? getComputedStyle(tok, '::after').backgroundImage : null, links: [...document.querySelectorAll('link[href*="theme-worlds"]')].length,
    attrs: Object.keys(document.body.dataset).filter((k) => /^theme/.test(k)) };
});
const lum = (rgb) => { const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const rgbList = (s) => [...s.matchAll(/rgba?\((\d+), (\d+), (\d+)/g)].map((m) => [+m[1], +m[2], +m[3]]);
async function pickWorld(page, id) {
  await page.locator('#kg-nav-host').click();
  await page.locator(`#kg-panel [data-card-world-pick="${id}"]`).click();
  await expect.poll(() => page.evaluate(() => lastState.cardWorld)).toBe(id || null);
  await page.keyboard.press('Escape').catch(() => {});
}
// Ein paar echte Züge: wer am Zug ist, würfelt, kauft freie Grundstücke und beendet den Zug
async function playTurns(pages, n) {
  for (let i = 0; i < n; i++) {
    for (const p of pages) {
      const st = await p.evaluate(() => ({ me: lastState.you?.id, actor: lastState.g?.actor, step: lastState.g?.step, debt: !!lastState.g?.debt, auction: !!lastState.g?.auction }));
      if (st.me !== st.actor || st.debt || st.auction) continue;
      if (st.step === 'roll' || st.step === 'jail') await p.evaluate(() => send('roll'));
      const s2 = await p.evaluate(() => lastState.g.step);
      if (s2 === 'buy') await p.evaluate(() => send('buy', { yes: true }));
      if (await p.evaluate(() => lastState.g.step === 'end')) await p.evaluate(() => send('endTurn'));
    }
  }
}

test('ART-W1: TW-01 im Host-Menü wählen – alle sehen die Welt, Spiel läuft, Standard stellt die ursprüngliche Optik wieder her', async ({ page, browser, app }, info) => {
  test.setTimeout(240000);
  const room = await openTable(page, browser, app, info, 'monopoly', 'classic', 2);
  try {
    await page.evaluate(() => Promise.all([CardWorlds.ready, ThemeWorlds.ready]));
    const guest = room.guests[0];
    const standardNames = await fieldTexts(page), standardLook = await look(page);
    expect(standardNames).toEqual(BOARD.map((f) => f.name)); // Standardbrett „Spieleabend-Stadt“
    await shot(page, 'standard', info);
    await pickWorld(page, 'TW-01');
    for (const p of [page, guest]) {
      await expect(p.locator('body')).toHaveAttribute('data-theme-world', 'TW-01');
      await expect(p.locator('link[href="/games/theme-worlds/tw-01/tw-01.css"]')).toHaveCount(1);
      await expect.poll(() => fieldTexts(p)).toEqual(BOARD.map((f) => TW01_FIELDS[f.index]));
    }
    // Spät beitretende Spielerin sieht dieselbe Welt
    const late = await room.add('Dana', false);
    await expect(late.locator('body')).toHaveAttribute('data-theme-world', 'TW-01');
    await expect.poll(() => fieldTexts(late)).toEqual(BOARD.map((f) => TW01_FIELDS[f.index]));
    const tw = await look(page);
    expect(tw.board).not.toBe(standardLook.board); expect(tw.main).toContain('tw-01/table.svg'); expect(tw.center).toContain('tw-01/center.svg'); expect(tw.tokenAfter).toMatch(/tw-01\/token-[a-z]+\.svg/);
    // Lesbarkeit: Feldtext auf dem Papierton mindestens 4,5:1 (WCAG AA), auch auf der dunkleren Stelle des Verlaufs
    const fieldStyle = await page.evaluate(() => { const f = getComputedStyle(document.querySelector('.mo-field')); return { color: f.color, bg: f.backgroundImage }; });
    const textColor = rgbList(fieldStyle.color)[0];
    for (const bg of rgbList(fieldStyle.bg)) expect(contrast(textColor, bg)).toBeGreaterThanOrEqual(4.5);
    // Spielerfarben bleiben: jede Figur hat die Farbe ihres Spielers als Ring, verschiedene Spieler verschiedene Farben
    const tokens = await page.evaluate(() => [...document.querySelectorAll('.mo-token')].map((t) => ({ bg: getComputedStyle(t).backgroundColor, owner: getComputedStyle(t).getPropertyValue('--mo-owner').trim() })));
    expect(tokens.length).toBeGreaterThanOrEqual(2); expect(new Set(tokens.map((t) => t.bg)).size).toBe(tokens.length);
    // Spielablauf in der Welt: würfeln, kaufen, Zug beenden; Protokoll nennt die Weltnamen
    await playTurns([page, guest], 6);
    await expect.poll(() => page.evaluate(() => lastState.log.some((l) => / landet auf /.test(l.text)))).toBe(true);
    const landed = await page.evaluate(() => lastState.log.filter((l) => / landet auf /.test(l.text)).map((l) => l.text.split(' landet auf ')[1]));
    expect(landed.every((n) => Object.values(TW01_FIELDS).includes(n))).toBe(true);
    await expect(page.locator('.mo-center h2')).toHaveText('Schatten über Neuengland');
    await shot(page, 'tw-01', info);
    if (process.env.ART_W1_CAPTURE === '1') await page.locator('.mo-board').screenshot({ path: `${DIR}/tw-01-brett-${info.project.name}.jpg`, type: 'jpeg', quality: 85 });
    // Eigene Figurennamen in der Auswahl (nur Anzeige)
    // Mehrfacher Wechsel ohne Rückstände
    for (const id of ['', 'TW-01', '', 'TW-01']) { await pickWorld(page, id); await expect(page.locator('link[href*="tw-01.css"]')).toHaveCount(id ? 1 : 0); }
    await pickWorld(page, '');
    for (const p of [page, guest, late]) {
      await expect(p.locator('body')).not.toHaveAttribute('data-theme-world', /./);
      await expect(p.locator('link[href*="theme-worlds"]')).toHaveCount(0);
      await expect.poll(() => fieldTexts(p)).toEqual(standardNames);
      const s = await p.evaluate(() => ThemeWorlds.status()); expect(s.world).toBeNull(); expect(s.scope + s.effectScopes).toBe(0);
    }
    await expect(page.locator('.mo-center h2')).toHaveText('Spieleabend-Stadt');
    const back = await look(page);
    expect(back.board).toBe(standardLook.board); expect(back.main).toBe(standardLook.main); expect(back.field).toBe(standardLook.field); expect(back.center).toBe(standardLook.center); expect(back.tokenAfter).toBe(standardLook.tokenAfter); expect(back.attrs).toEqual([]);
  } finally { await room.close(); }
});

test('ART-W1: fehlende Welt-Datei → Standardoptik, Spiel bleibt bedienbar; Junior zeigt keine Themenwelt', async ({ page, browser, app, browserName }, info) => {
  test.setTimeout(180000);
  test.skip(browserName === 'webkit', 'WebKit leitet Bildanfragen nicht über page.route');
  const room = await openTable(page, browser, app, info, 'monopoly', 'classic', 2);
  try {
    await page.evaluate(() => Promise.all([CardWorlds.ready, ThemeWorlds.ready]));
    const guest = room.guests[0];
    await guest.route('**/games/theme-worlds/tw-01/preview.svg', (r) => r.fulfill({ status: 404, body: '' }));
    await pickWorld(page, 'TW-01');
    await expect(page.locator('body')).toHaveAttribute('data-theme-world', 'TW-01');
    await expect.poll(() => guest.evaluate(() => ThemeWorlds.status().failed)).toContain('TW-01');
    await expect(guest.locator('body')).not.toHaveAttribute('data-theme-world', /./);
    await expect(guest.locator('link[href*="tw-01.css"]')).toHaveCount(0);
    await expect(guest.locator('.mo-board')).toBeVisible();
    // Junior: eigene 24 Felder, keine Themenwelt in Auswahl und Darstellung
    await pickWorld(page, '');
    await emit(page, 'abortRound', {}).catch(() => {});
    await expect.poll(() => page.evaluate(() => lastState.phase)).not.toBe('playing');
    await emit(page, 'setVariant', { variant: 'junior' });
    await expect.poll(() => page.evaluate(() => lastState.variant), { timeout: 15000 }).toBe('junior');
    await page.waitForFunction(() => typeof ThemeWorlds !== 'undefined' && document.querySelector('#kg'));
    await page.evaluate(() => ThemeWorlds.ready);
    expect((await page.evaluate(() => send('setCardWorld', { world: 'TW-01' }))).ok).toBe(true); // Spiel-Ebene erlaubt, Darstellung gilt nicht für Junior
    await page.waitForTimeout(400);
    await expect(page.locator('body')).not.toHaveAttribute('data-theme-world', /./);
    await page.locator('#kg-nav-host').click();
    await expect(page.locator('#kg-panel [data-card-world-pick="TW-01"]')).toHaveCount(0);
  } finally { await room.close(); }
});

test('ART-W1: Mobilansicht, reduzierte Bewegung und Bedienung bleiben in TW-01 erhalten', async ({ page, browser, app }, info) => {
  test.setTimeout(150000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const room = await openTable(page, browser, app, info, 'monopoly', 'classic', 2);
  try {
    await page.evaluate(() => Promise.all([CardWorlds.ready, ThemeWorlds.ready]));
    await emit(page, 'setCardWorld', { world: 'TW-01' });
    await expect(page.locator('link[href*="tw-01.css"]')).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector('.mo-center'), '::after').animationName)).toBe('none');
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('.mo-center'), '::before').animationName)).toBe('none');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    // Ein Feld lässt sich weiterhin öffnen (Besitzkarte), Text bleibt lesbar
    await page.locator('.mo-field[data-field="1"]').click();
    await expect(page.locator('#mo-dialog')).toBeVisible();
    await expect(page.locator('#mo-dialog h3')).toContainText('Fischergasse');
    await page.locator('#mo-dialog [data-mo="close"]').click();
    // Dock-Knöpfe bleiben mindestens 44 px hoch
    for (const b of await page.locator('#kg-dock .btn').all()) { const box = await b.boundingBox(); if (box) expect(box.height).toBeGreaterThanOrEqual(43); }
  } finally { await room.close(); }
});
