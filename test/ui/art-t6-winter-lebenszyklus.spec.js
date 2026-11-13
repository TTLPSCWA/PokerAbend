// Kartenwelt-Lebenszyklus (Nachtrag zu ART-T6): Winterwelt, Schnee und Wintermusik dürfen nach dem Verlassen nicht
// zurückkommen, beim ersten Betreten und nach „Platz behalten“ muss die aktuelle Welt des Raums erscheinen,
// und beim Wechsel in einen anderen Raum darf die alte Welt nicht übernommen werden.
//
// Hinweis zu Fall A: Der Test ruft die registrierten state-Empfänger mit einem zuvor empfangenen Raumstand direkt auf.
// Das prüft das Verhalten der Empfänger für eine verspätete Nachricht, beweist aber nicht, dass diese Reihenfolge im
// Netzwerk tatsächlich auftritt (der Client räumt nach socket.emit('leave') sofort auf, der Server antwortet später).
import { test, expect, openTable, emit } from './card-ux-helpers.js';
import { login, selectGame } from './helpers.js';
import { worldsFor } from '../../public/games/card-worlds/worlds.js';

const winter = worldsFor('farbenchaos').filter((w) => w.game === 'all');
const own = worldsFor('farbenchaos').filter((w) => w.game !== 'all');
const gone = async (p) => {
  await expect(p.locator('#cw-snow, #cw-snow-toggle, #cw-music-toggle')).toHaveCount(0);
  await expect(p.locator('body')).not.toHaveAttribute('data-card-world', /./);
  await expect(p.locator('body')).not.toHaveAttribute('data-cw-music', /./);
  expect(await p.evaluate(() => { const a = CardWorlds.audio(); return !a || a.paused; })).toBe(true);
};

test('Winterwelt: erstes Betreten, Verlassen mit Musik, verspäteter Raumstand nach dem Verlassen', async ({ page, browser, app }, info) => {
  test.setTimeout(180000);
  const room = await openTable(page, browser, app, info, 'farbenchaos', 'classic', 3);
  try {
    await page.evaluate(() => CardWorlds.ready);
    await page.evaluate(() => { try { localStorage.setItem('cwMusic', 'on'); localStorage.removeItem('cwMusicIdx'); } catch {} });
    await emit(page, 'setCardWorld', { world: winter[0].id });
    await expect(page.locator('body')).toHaveAttribute('data-card-world', winter[0].id);
    await expect(page.locator('#cw-snow')).toHaveCount(1);
    await expect(page.locator('body')).toHaveAttribute('data-cw-music', 'on');
    await expect.poll(() => page.evaluate(() => !CardWorlds.audio().paused), { timeout: 15000 }).toBe(true);

    // B: Erstes Betreten eines Raums mit gesetzter Winterwelt (der Raumstand kommt vor der Join-Bestätigung)
    const dana = await room.add('Dana', false);
    await expect(dana.locator('body')).toHaveAttribute('data-card-world', winter[0].id);
    await expect(dana.locator('#cw-snow')).toHaveCount(1);

    // E: Verlassen mit laufender Wintermusik – Musik, Schnee und Knöpfe verschwinden vollständig
    await page.evaluate(() => { window.__alterStand = lastState; leaveTable(); });
    await gone(page);

    // A: Ein vorher empfangener Raumstand wird danach noch verarbeitet (verspätete Nachricht)
    await page.evaluate(() => socket.listeners('state').forEach((f) => f(window.__alterStand)));
    await page.waitForTimeout(500);
    await gone(page);
  } finally {
    await page.evaluate(() => { try { localStorage.removeItem('cwMusic'); } catch {} }).catch(() => {});
    await room.close();
  }
});

test('Winterwelt: Raum A verlassen, Raum B mit derselben Spielart und anderer Welt betreten', async ({ page, browser, app }, info) => {
  test.setTimeout(180000);
  const room = await openTable(page, browser, app, info, 'farbenchaos', 'classic', 2);
  let evaCtx = null;
  try {
    await page.evaluate(() => CardWorlds.ready);
    await emit(page, 'setCardWorld', { world: winter[0].id });
    await expect(page.locator('#cw-snow')).toHaveCount(1);
    await page.evaluate(() => leaveTable());
    await gone(page);
    // C: Raum B mit demselben Spiel, aber anderer Welt betreten – die alte Winterwelt darf nicht übernommen werden
    evaCtx =await browser.newContext({ viewport: page.viewportSize(), reducedMotion: 'reduce', ...(info.project.use.isMobile ? { isMobile: true, hasTouch: true } : {}) });
    const eva = await evaCtx.newPage();
    await login(eva, app, 'Eva'); await selectGame(eva, 'farbenchaos');
    await eva.locator('#host-variant').selectOption('classic');
    await eva.locator('#host-form button[type=submit]').click();
    await expect(eva.locator('#kg')).toBeVisible();
    await emit(eva, 'setCardWorld', { world: own[0].id });
    const codeB = await eva.evaluate(() => lastState.code);
    await page.evaluate((code) => joinAndEnter(code, 'watch'), codeB);
    await expect.poll(() => page.evaluate(() => lastState?.code)).toBe(codeB);
    await expect(page.locator('body')).toHaveAttribute('data-card-world', own[0].id);
    await expect(page.locator('#cw-snow, #cw-snow-toggle, #cw-music-toggle')).toHaveCount(0);
    expect(await page.evaluate(() => { const a = CardWorlds.audio(); return !a || a.paused; })).toBe(true);
    // Umgekehrt: aus Raum B zurück und in Raum A (Winter) – die Winterwelt erscheint wieder
    await page.evaluate(() => leaveTable());
    await gone(page);
    await page.evaluate((code) => joinAndEnter(code, 'watch'), room.code);
    await expect.poll(() => page.evaluate(() => lastState?.code)).toBe(room.code);
    await expect(page.locator('body')).toHaveAttribute('data-card-world', winter[0].id);
    await expect(page.locator('#cw-snow')).toHaveCount(1);
  } finally {
    if (evaCtx) await evaCtx.close();
    await room.close();
  }
});

test('Winterwelt: Platz behalten, Host wechselt die Welt, Rückkehr zeigt die aktuelle Welt', async ({ page, browser, app }, info) => {
  test.setTimeout(180000);
  const room = await openTable(page, browser, app, info, 'farbenchaos', 'classic', 2);
  try {
    const guest = room.guests[0];
    await emit(page, 'setCardWorld', { world: winter[0].id });
    await expect(guest.locator('body')).toHaveAttribute('data-card-world', winter[0].id);
    await expect(guest.locator('#cw-snow')).toHaveCount(1);
    // D: Gast parkt, Host wählt währenddessen eine andere Welt, Gast kehrt zurück
    await guest.evaluate(() => parkRoom());
    await gone(guest);
    await emit(page, 'setCardWorld', { world: winter[1].id });
    await gone(guest);
    await guest.evaluate(() => returnToRoom());
    await expect(guest.locator('body')).toHaveAttribute('data-card-world', winter[1].id);
    await expect(guest.locator('#cw-snow')).toHaveCount(1);
  } finally { await room.close(); }
});
