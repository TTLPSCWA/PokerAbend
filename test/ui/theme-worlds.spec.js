// ART-W0: Lebenszyklus der Themenwelten im Browser (activate → update → deactivate → cleanup).
// Geprüft mit den vorhandenen Kartenwelten (Winterwelten bringen Schnee und Musik mit) und mit zur Laufzeit eingespielten Testwelten
// (andere Art, fehlende Datei). Keine neue Welt wird ausgeliefert.
import { test, expect, openTable, emit } from './card-ux-helpers.js';
import { worldsFor } from '../../public/games/card-worlds/worlds.js';

const winter = worldsFor('farbenchaos').filter((w) => w.game === 'all').map((w) => w.id);
const own = worldsFor('farbenchaos').filter((w) => w.game !== 'all').map((w) => w.id);
const status = (p) => p.evaluate(() => ThemeWorlds.status());
const audioPaused = (p) => p.evaluate(() => { const a = CardWorlds.audio(); return !a || a.paused; });
async function nothingLeft(p) {
  await expect(p.locator('#cw-snow, #cw-snow-toggle, #cw-music-toggle')).toHaveCount(0);
  const attrs = await p.evaluate(() => Object.keys(document.body.dataset).filter((k) => /^(themeWorld|themeKind|cardWorld|cwFrame|cwSnow|cwMusic)$/.test(k)));
  expect(attrs).toEqual([]);
  const s = await status(p); expect(s.world).toBeNull(); expect(s.scope).toBe(0); expect(s.effectScopes).toBe(0); expect(s.effects).toEqual([]);
  expect(await audioPaused(p)).toBe(true);
}

test('ART-W0: mehrfacher Themenwechsel – passende Effekte, keine doppelten Ebenen, nichts bleibt zurück', async ({ page, browser, app }, info) => {
  test.setTimeout(240000);
  const room = await openTable(page, browser, app, info, 'farbenchaos', 'classic', 2);
  try {
    await page.evaluate(() => Promise.all([CardWorlds.ready, ThemeWorlds.ready]));
    await page.evaluate(() => { try { localStorage.setItem('cwMusic', 'on'); localStorage.removeItem('cwMusicIdx'); } catch {} });
    const steps = [winter[0], own[0], '', winter[1], winter[0], own[1], winter[2], '', own[0], winter[3], ''];
    for (const id of steps) {
      await emit(page, 'setCardWorld', { world: id });
      await expect.poll(async () => (await status(page)).world).toBe(id || null);
      const s = await status(page);
      expect(await page.locator('#cw-snow').count()).toBeLessThanOrEqual(1); expect(await page.locator('#cw-snow-toggle').count()).toBeLessThanOrEqual(1); expect(await page.locator('#cw-music-toggle').count()).toBeLessThanOrEqual(1);
      if (!id) await nothingLeft(page);
      else if (winter.includes(id)) { expect(s.effects).toEqual(['snow', 'music']); await expect(page.locator('#cw-snow')).toHaveCount(1); await expect(page.locator('body')).toHaveAttribute('data-card-world', id); await expect(page.locator('body')).toHaveAttribute('data-theme-kind', 'card'); }
      else { expect(s.effects).toEqual([]); await expect(page.locator('#cw-snow, #cw-music-toggle')).toHaveCount(0); expect(await audioPaused(page)).toBe(true); await expect(page.locator('body')).toHaveAttribute('data-card-world', id); }
      // Gast sieht dieselbe Welt
      await expect.poll(() => room.guests[0].evaluate(() => ThemeWorlds.status().world)).toBe(id || null);
    }
    // Viele Raumstände in derselben Welt lassen nichts anwachsen (keine neuen Listener, Knoten, Zeitgeber). Musik dafür aus:
    // Browser ohne MP3-Wiedergabe (z. B. WebKit unter Windows) probieren sonst kurzzeitig das nächste Stück (ein Zeitgeber, der wieder verschwindet).
    await page.evaluate(() => { try { localStorage.setItem('cwMusic', 'off'); } catch {} });
    await emit(page, 'setCardWorld', { world: winter[0] });
    await expect.poll(async () => (await status(page)).world).toBe(winter[0]);
    const before = await status(page);
    for (let i = 0; i < 8; i++) await page.evaluate(() => ThemeWorlds.refresh());
    await page.locator('#cw-snow-toggle').click(); await page.locator('#cw-snow-toggle').click();
    const after = await status(page); expect(after.scope).toBe(before.scope); expect(after.effectScopes).toBe(before.effectScopes);
    await emit(page, 'setCardWorld', { world: '' }); await nothingLeft(page);
    const fin = await status(page); expect(fin.activations).toBe(fin.deactivations);
  } finally {
    await page.evaluate(() => { try { localStorage.removeItem('cwMusic'); } catch {} }).catch(() => {});
    await room.close();
  }
});

test('ART-W0: Verbindungsabbruch hält den Ton an, die Wiederverbindung stellt Welt und Effekte wieder her', async ({ page, browser, app, browserName }, info) => {
  test.setTimeout(180000);
  const room = await openTable(page, browser, app, info, 'farbenchaos', 'classic', 2);
  try {
    await page.evaluate(() => Promise.all([CardWorlds.ready, ThemeWorlds.ready]));
    await page.evaluate(() => { try { localStorage.setItem('cwMusic', 'on'); } catch {} });
    await emit(page, 'setCardWorld', { world: winter[0] });
    await expect.poll(async () => (await status(page)).world).toBe(winter[0]);
    if (browserName === 'chromium') await expect.poll(() => audioPaused(page), { timeout: 15000 }).toBe(false);
    await page.evaluate(() => socket.disconnect());
    await expect.poll(async () => (await status(page)).suspended).toBe(true);
    expect(await audioPaused(page)).toBe(true);
    await expect(page.locator('#cw-snow')).toHaveCount(1); // Darstellung bleibt, bis der Server antwortet
    // Während der Trennung wählt der Host … nichts; ein Gast kann nicht wählen
    expect((await room.guests[0].evaluate(() => send('setCardWorld', { world: 'U-01' }))).ok).toBe(false);
    await page.evaluate(() => socket.connect());
    await expect.poll(async () => (await status(page)).suspended, { timeout: 15000 }).toBe(false);
    expect((await status(page)).world).toBe(winter[0]);
    if (browserName === 'chromium') await expect.poll(() => audioPaused(page), { timeout: 15000 }).toBe(false);
    await expect(page.locator('#cw-snow')).toHaveCount(1); await expect(page.locator('#cw-music-toggle')).toHaveCount(1);
    // Neuladen = neue Verbindung: dieselbe Welt
    await room.guests[0].reload(); await expect.poll(() => room.guests[0].evaluate(() => typeof ThemeWorlds !== 'undefined' && ThemeWorlds.status().world), { timeout: 15000 }).toBe(winter[0]);
  } finally {
    await page.evaluate(() => { try { localStorage.removeItem('cwMusic'); } catch {} }).catch(() => {});
    await room.close();
  }
});

// Testwelten werden nur in diesem Browser eingespielt (der Server kennt sie nicht); der Raumstand wird lokal nachgestellt.
const injectTestWorlds = (p) => p.evaluate(async () => {
  const m = await import('/games/theme-worlds/registry.js');
  const base = { name: { de: 'Test', en: 'Test' }, description: { de: 'Test', en: 'Test' }, games: ['farbenchaos'], variants: null, palette: { colors: ['#334455'] }, fonts: [], fallback: 'standard', released: true, source: 'ART-W0-Test' };
  ThemeWorlds.useRegistry(m.createRegistry([...m.BUILTIN,
    { ...base, id: 'TW-DEFEKT', kind: 'card', card: { frame: 'gilded' }, assets: { preview: null, css: [], preload: ['/card-worlds.css'] }, effects: [{ type: 'snow' }] },
    { ...base, id: 'TW-FEHLT', kind: 'card', card: { frame: 'gilded' }, assets: { preview: null, css: [], preload: ['/games/card-worlds/art/FEHLT/0.svg'] }, effects: [{ type: 'snow' }] },
    { ...base, id: 'TW-ANDERS', kind: 'generic', assets: { preview: null, css: [], preload: ['/games/card-worlds/art/U-01/0.svg'] }, effects: [{ type: 'snow' }] }]));
});

test('ART-W0: fehlende Welt-Assets fallen auf Standard zurück; eine Welt anderer Art nutzt dieselben Effekte und räumt ab', async ({ page, browser, app }, info) => {
  test.setTimeout(120000);
  const room = await openTable(page, browser, app, info, 'farbenchaos', 'classic', 2);
  try {
    await page.evaluate(() => Promise.all([CardWorlds.ready, ThemeWorlds.ready]));
    // Fehlende Datei (404) beim Gast: Rückfall auf Standard. (Die Fehlermeldung des Browsers zum 404 gehört zum Test.)
    const guest = room.guests[0];
    await guest.evaluate(() => Promise.all([CardWorlds.ready, ThemeWorlds.ready])); await injectTestWorlds(guest);
    await guest.evaluate(() => ThemeWorlds.apply({ ...lastState, cardWorld: 'TW-FEHLT' }));
    await expect.poll(async () => (await status(guest)).failed).toContain('TW-FEHLT');
    await nothingLeft(guest);
    // Unbrauchbare Datei (vorhanden, aber kein Bild) beim Host: ebenfalls Standard, ohne Netzwerkfehler
    await injectTestWorlds(page);
    const r = await page.evaluate(async () => {
      ThemeWorlds.apply({ ...lastState, cardWorld: 'TW-DEFEKT' });
      return ThemeWorlds.status().world;
    });
    expect(r).toBe('TW-DEFEKT'); // erst aktiv, dann erkennt der Ladeversuch die fehlende Datei
    await expect.poll(async () => (await status(page)).failed).toContain('TW-DEFEKT');
    await nothingLeft(page);
    // Andere Art: kein Kartenrahmen, aber derselbe Schnee-Effekt
    await page.evaluate(() => ThemeWorlds.apply({ ...lastState, cardWorld: 'TW-ANDERS' }));
    await expect(page.locator('#cw-snow')).toHaveCount(1); await expect(page.locator('body')).toHaveAttribute('data-theme-kind', 'generic');
    await expect(page.locator('body')).not.toHaveAttribute('data-card-world', /./);
    await page.waitForTimeout(400); expect((await status(page)).world).toBe('TW-ANDERS');
    // Zurück zum echten Raumstand (Standard): alles weg; echte Registry wieder aktiv
    await page.evaluate(async () => { ThemeWorlds.useRegistry((await import('/games/theme-worlds/registry.js')).themeRegistry()); ThemeWorlds.apply(lastState); });
    await nothingLeft(page);
    await emit(page, 'setCardWorld', { world: own[2] }); await expect(page.locator('body')).toHaveAttribute('data-card-world', own[2]);
  } finally { await room.close(); }
});

test('ART-W0: Host schließt den Tisch, Seite wird verlassen, Tisch wird gewechselt – Schnee und Wintermusik laufen nicht weiter', async ({ page, browser, app }, info) => {
  test.setTimeout(180000);
  const room = await openTable(page, browser, app, info, 'farbenchaos', 'classic', 2);
  try {
    await page.evaluate(() => Promise.all([CardWorlds.ready, ThemeWorlds.ready]));
    await emit(page, 'setCardWorld', { world: winter[4] });
    const guest = room.guests[0];
    await expect(guest.locator('#cw-snow')).toHaveCount(1);
    // Seite verlassen (pagehide) räumt ab, Rückkehr aus dem Zurück-Cache (pageshow persisted) stellt her
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
    await nothingLeft(page);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    await expect(page.locator('#cw-snow')).toHaveCount(1); expect((await status(page)).world).toBe(winter[4]);
    // Andere Ansicht (Startseite mit Platz behalten): nichts aktiv, zurück am Tisch wieder da
    await page.evaluate(() => parkRoom()); await nothingLeft(page);
    await page.evaluate(() => returnToRoom()); await expect(page.locator('#cw-snow')).toHaveCount(1, { timeout: 15000 });
    // Host schließt den Tisch: beim Gast verschwindet alles
    await emit(page, 'closeTable', {});
    await nothingLeft(guest); await nothingLeft(page);
  } finally { await room.close(); }
});

test('ART-W0: reduzierte Bewegung, Bedienbarkeit und Mobilansicht', async ({ page, browser, app }, info) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const room = await openTable(page, browser, app, info, 'farbenchaos', 'classic', 2);
  try {
    await page.evaluate(() => Promise.all([CardWorlds.ready, ThemeWorlds.ready]));
    await emit(page, 'setCardWorld', { world: winter[1] });
    await expect(page.locator('#cw-snow')).toHaveCount(1);
    const anim = await page.evaluate(() => [...document.querySelectorAll('#cw-snow i')].map((i) => getComputedStyle(i).animationName));
    expect(anim.every((n) => n === 'none')).toBe(true);
    expect(await page.evaluate(() => getComputedStyle(document.getElementById('cw-snow')).pointerEvents)).toBe('none');
    // Die eigene Hand bleibt bedienbar: die Schneeebene fängt keine Klicks
    const card = page.locator('#kg-dock .card, #kg-dock [data-card], .hand .card').first();
    if (await card.count()) { const b = await card.boundingBox(); const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('#cw-snow') === null, { x: b.x + b.width / 2, y: b.y + b.height / 2 }); expect(hit).toBe(true); }
    for (const id of ['#cw-snow-toggle', '#cw-music-toggle']) { const b = await page.locator(id).boundingBox(); expect(b.width).toBeGreaterThanOrEqual(34); expect(b.x + b.width).toBeLessThanOrEqual(page.viewportSize().width + 1); }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  } finally { await room.close(); }
});
