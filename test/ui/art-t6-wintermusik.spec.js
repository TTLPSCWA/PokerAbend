// ART-T6: Wintermusik. Schalter neben dem Schneeknopf, nur in Winterwelten, Standard aus, pro Gerät gespeichert,
// spielt Stücke aus /games/card-worlds/music/ und lässt sich wieder ausschalten. Gäste haben ihren eigenen Schalter.
// ART_CAPTURE=1 legt ein Bildschirmfoto unter test-results/art-t6/ ab.
import { test, expect, openTable, emit, configure } from './card-ux-helpers.js';
import { mkdirSync } from 'node:fs';
import { worldsFor } from '../../public/games/card-worlds/worlds.js';

test('ART-T6: Musik-Schalter in Winterwelten, Standard aus, spielt und bleibt gespeichert', async ({ page, browser, app }, info) => {
  test.setTimeout(180000);
  const room = await openTable(page, browser, app, info, 'farbenchaos', 'classic', 3);
  try {
    await configure(page, app, room.code, { top: '7b', hand: ['Sr', 'Rb', 'Dy', 'Fw', 'Ww', '0g', '7r', '9b'] });
    await page.evaluate(() => CardWorlds.ready);
    await page.evaluate(() => { try { localStorage.removeItem('cwMusic'); localStorage.removeItem('cwMusicIdx'); } catch {} });
    const winter = worldsFor('farbenchaos').filter((w) => w.game === 'all');
    const own = worldsFor('farbenchaos').find((w) => w.game !== 'all').id;

    // Außerhalb der Winterwelten gibt es keinen Knopf und keine Musik
    await emit(page, 'setCardWorld', { world: own });
    await expect(page.locator('#cw-music-toggle')).toHaveCount(0);

    await emit(page, 'setCardWorld', { world: winter[0].id });
    const btn = page.locator('#cw-music-toggle');
    await expect(btn).toBeVisible();
    // Standard: aus, kein Audio-Abruf
    await expect(page.locator('body')).toHaveAttribute('data-cw-music', 'off');
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    // Knopf liegt neben dem Schneeknopf, ohne Überlappung, und ist groß genug
    const [m, s] = await Promise.all([btn.boundingBox(), page.locator('#cw-snow-toggle').boundingBox()]);
    expect(m.width).toBeGreaterThanOrEqual(34);
    expect(m.x).toBeGreaterThanOrEqual(s.x + s.width);
    expect(Math.abs(m.y - s.y)).toBeLessThan(2);

    // Einschalten: Stück läuft, Quelle aus dem Musikordner, leise
    await btn.click();
    await expect(page.locator('body')).toHaveAttribute('data-cw-music', 'on');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('cwMusic'))).toBe('on');
    await expect.poll(async () => page.evaluate(() => performance.getEntriesByType('resource').some((e) => /\/games\/card-worlds\/music\/[a-z-]+\.mp3/.test(e.name)))).toBe(true);
    // Es spielt wirklich (nicht pausiert), leise, mit einem Stück aus der Liste
    await expect.poll(() => page.evaluate(() => { const a = CardWorlds.audio(); return !!a && !a.paused && a.currentTime > 0; }), { timeout: 15000 }).toBe(true);
    const au = await page.evaluate(() => { const a = CardWorlds.audio(); return { vol: a.volume, src: a.src, loop: a.loop }; });
    expect(au.vol).toBeLessThanOrEqual(0.4);
    expect(au.src).toMatch(/\/games\/card-worlds\/music\/[a-z-]+\.mp3$/);
    // Weltwechsel zwischen Winterwelten und Statusmeldungen starten das Stück nicht neu und schalten nichts aus
    await emit(page, 'setCardWorld', { world: winter[1].id });
    await expect(page.locator('body')).toHaveAttribute('data-cw-music', 'on');
    const tracks = await page.evaluate(() => performance.getEntriesByType('resource').filter((e) => /\/music\/[a-z-]+\.mp3/.test(e.name)).map((e) => e.name));
    expect(new Set(tracks).size).toBe(1);
    if (process.env.ART_CAPTURE === '1') { mkdirSync('test-results/art-t6', { recursive: true }); await page.screenshot({ path: `test-results/art-t6/musik-an-${info.project.name}.png` }); }

    // Gast hat seinen eigenen Schalter (eigenes Gerät, Standard aus)
    await expect(room.guests[0].locator('#cw-music-toggle')).toHaveAttribute('aria-pressed', 'false');

    // Ausschalten: Zustand gespeichert, Beschriftung wechselt
    await btn.click();
    await expect(page.locator('body')).toHaveAttribute('data-cw-music', 'off');
    await expect(btn).toHaveAttribute('aria-label', /Musik einschalten|Turn music on/);
    expect(await page.evaluate(() => localStorage.getItem('cwMusic'))).toBe('off');
    expect(await page.evaluate(() => { const a = CardWorlds.audio(); return !a.src || a.paused; })).toBe(true);

    // Wieder an, dann Welt ohne Winter: Knopf und Musik verschwinden, Standard ebenfalls
    await btn.click();
    await expect(page.locator('body')).toHaveAttribute('data-cw-music', 'on');
    await emit(page, 'setCardWorld', { world: own });
    await expect(page.locator('#cw-music-toggle')).toHaveCount(0);
    await expect(page.locator('body')).not.toHaveAttribute('data-cw-music', /./);
    await emit(page, 'setCardWorld', { world: winter[2].id });
    await expect(page.locator('body')).toHaveAttribute('data-cw-music', 'on');
    await emit(page, 'setCardWorld', { world: '' });
    await expect(page.locator('#cw-music-toggle')).toHaveCount(0);
    // Tisch verlassen bzw. Startseite: Schnee, Knöpfe und Musik verschwinden, auch ohne neuen Raumstand
    await emit(page, 'setCardWorld', { world: winter[0].id });
    await expect(page.locator('body')).toHaveAttribute('data-cw-music', 'on');
    await expect.poll(() => page.evaluate(() => !CardWorlds.audio().paused), { timeout: 15000 }).toBe(true);
    await page.evaluate(() => parkRoom());
    await expect(page.locator('#cw-snow')).toHaveCount(0);
    await expect(page.locator('#cw-music-toggle, #cw-snow-toggle')).toHaveCount(0);
    await expect(page.locator('body')).not.toHaveAttribute('data-card-world', /./);
    expect(await page.evaluate(() => CardWorlds.audio().paused)).toBe(true);
    // Weiterspielen (returnToRoom): Welt, Schnee und Musik kommen sofort zurück
    await page.evaluate(() => returnToRoom());
    await expect(page.locator('#cw-snow')).toHaveCount(1);
    await expect(page.locator('body')).toHaveAttribute('data-cw-music', 'on');
    await expect.poll(() => page.evaluate(() => !CardWorlds.audio().paused), { timeout: 15000 }).toBe(true);
    // Gast schließt nicht, sondern verlässt den Tisch endgültig: ebenfalls alles weg
    await expect(room.guests[0].locator('#cw-snow')).toHaveCount(1);
    await room.guests[0].evaluate(() => leaveTable());
    await expect(room.guests[0].locator('#cw-snow, #cw-snow-toggle, #cw-music-toggle')).toHaveCount(0);
    await page.evaluate(() => { try { localStorage.removeItem('cwMusic'); } catch {} });
  } finally { await room.close(); }
});
