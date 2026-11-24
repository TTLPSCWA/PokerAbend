// Tastatursteuerung über alle Echtzeit-/Arcade-Spiele: Start über den echten Knopf (Fokus wie beim Spielen),
// dann Pfeiltasten und Leertaste. Erwartet: Eingaben gehen an den Server, die Seite scrollt nicht mit.
import { test, expect, login, selectGame } from './helpers.js';

const KEYBOARD_GAMES = ['bomben-duell', 'broeckelboden', 'geschenkdiebe', 'geschenkfaenger', 'gummiband-challenge', 'kistenchaos',
  'kronenjagd', 'labyrinth-chaos', 'laser-huepfer', 'minenlauf', 'puzzle-panik', 'rhythmus-rausch', 'schatzgraeber',
  'scheinwerfer-flucht', 'schubsarena', 'stillgestanden', 'turmbauer'];
const INPUT_EVENTS = ['steer', 'arcAct', 'arcTap', 'expeditionAction'];

test.use({ createLimit: '100' });
for (const id of KEYBOARD_GAMES) {
  test(`Tastatur ${id}: Pfeiltasten und Leertaste steuern, die Seite scrollt nicht`, async ({ page, app }, info) => {
    test.skip(info.project.name !== 'desktop', 'Tastatur nur am PC');
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await login(page, app); await selectGame(page, id); await page.locator('#host-form button[type=submit]').click();
    await expect.poll(() => page.evaluate(() => typeof lastState !== 'undefined' && !!lastState?.code)).toBe(true);
    expect((await page.evaluate(() => send('sit'))).ok).toBe(true); expect((await page.evaluate(() => send('addBot'))).ok).toBe(true);
    await page.evaluate(() => {
      window.__emits = []; const emit = socket.emit.bind(socket); socket.emit = (...a) => { window.__emits.push(a[0]); return emit(...a); };
      // Serverzeit der Runde aus den Arena-Frames: negativ während des Countdowns, ab 0 nimmt der Server Eingaben an.
      window.__arenaFrame = null;
      socket.on('arena', (frame) => { window.__arenaFrame = frame; });
    });
    const start = page.getByRole('button', { name: 'Runde starten', exact: true }).first();
    await expect(start).toBeEnabled(); await start.click();
    await expect.poll(() => page.evaluate(() => lastState.phase)).toBe('playing');
    const { y: y0, from } = await page.evaluate(() => ({ y: scrollY, from: window.__emits.length }));
    if (id === 'broeckelboden') {
      // Die Startplatte bricht bereits 900 ms nach dem ersten Spieltick. Richtung während
      // des Countdowns halten und die Bewegung im Serverframe derselben Runde nachweisen.
      await page.waitForFunction(() => {
        const frame = window.__arenaFrame;
        return frame?.game === 'broeckelboden' && frame.elapsed < 0 && frame.runId === lastState.g.runId;
      });
      const initial = await page.evaluate(() => {
        const frame = window.__arenaFrame;
        return { runId: frame.runId, id: lastState.you.id, x: frame.bodies.find(body => body.id === lastState.you.id).x };
      });
      await page.keyboard.down('ArrowLeft');
      try {
        await expect.poll(() => page.evaluate(({ runId, id, x }) => {
          const frame = window.__arenaFrame;
          return frame?.runId === runId && frame.elapsed >= 0 && frame.bodies.some(body => body.id === id && body.x < x);
        }, initial)).toBe(true);
      } finally {
        await page.keyboard.up('ArrowLeft');
      }
    } else {
      // Nicht von der Host-Wanduhr ableiten, wann die serverseitige Runde Eingaben verarbeitet.
      await expect.poll(() => page.evaluate(() => window.__arenaFrame?.elapsed ?? null), { timeout: 15000 }).toBeGreaterThanOrEqual(0);
    }
    for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) { await page.keyboard.down(key); await page.waitForTimeout(250); await page.keyboard.up(key); }
    await page.keyboard.press('Space'); await page.waitForTimeout(300); await page.keyboard.press('Space'); await page.waitForTimeout(400);
    const after = await page.evaluate((n) => ({ y: scrollY, events: window.__emits.slice(n) }), from);
    expect(after.y, 'Seite darf beim Spielen nicht scrollen').toBe(y0);
    expect(after.events.filter((e) => INPUT_EVENTS.includes(e)).length, JSON.stringify(after.events)).toBeGreaterThan(0);
  });
}
