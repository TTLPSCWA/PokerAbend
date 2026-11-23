// B07 (OPEN-QA-AUDIO, Restpunkt aus QA-CI-01): Der Ersatz-Zugton besteht aus zwei Tönen
// (740 Hz/140 ms, 140 ms später 988 Hz/160 ms). Der zweite darf nicht mehr erklingen, wenn inzwischen
// die Verbindung getrennt wurde. Geprüft im Spiel-Kit (Vier gewinnt, ohne Erlebnismodul) und bei Poker.
import { test, expect, login, selectGame } from './helpers.js';

const FIRST = '740/140/0.06', SECOND = '988/160/0.05'; // genaue Signatur; 988 Hz nutzen auch Spielgeräusche
const emit = (page, event, data = {}) => page.evaluate(([e, d]) => send(e, d), [event, data]);
const myTurn = (page) => page.evaluate(() => lastState?.phase === 'playing' && lastState.turnId === lastState.you?.id);
const count = (page, sig) => page.evaluate((s) => window.__beeps.filter((x) => x === s).length, sig);

// Zählt jeden Ton mit vollständiger Signatur; beim ersten Zugton kann der Test die Verbindung kappen.
const hook = (page) => page.evaluate(() => {
  window.__beeps = []; window.__cut = false; const real = beep;
  beep = (...args) => { const sig = args.join('/'); window.__beeps.push(sig); if (sig === '740/140/0.06' && window.__cut) socket.disconnect(); return real(...args); };
});

async function open(page, app, id, seat) {
  await login(page, app);
  await selectGame(page, id);
  await page.locator('#host-form button[type=submit]').click();
  await expect.poll(() => page.evaluate(() => lastState?.game)).toBe(id);
  await hook(page);
  await emit(page, 'sit', seat); await emit(page, 'addBot');
}

test('B07 Audio Spiel-Kit: zweiter Ersatz-Zugton entfällt nach Verbindungsabbruch', async ({ page, app }, info) => {
  test.skip(info.project.name !== 'desktop', 'Tonlogik ist geräteunabhängig');
  test.setTimeout(60000);
  await open(page, app, 'viergewinnt', {});
  await emit(page, 'start');
  await expect.poll(() => myTurn(page), { timeout: 15000 }).toBe(true);
  // Kontrolle: Ein Zugwechsel ohne Abbruch spielt beide Töne vollständig.
  await expect.poll(() => count(page, SECOND), { timeout: 5000 }).toBeGreaterThanOrEqual(1);
  await page.evaluate(() => { window.__beeps = []; });
  expect((await emit(page, 'drop', { col: 0 }))?.ok).toBe(true);
  await expect.poll(() => count(page, SECOND), { timeout: 15000 }).toBe(1);
  expect(await count(page, FIRST)).toBe(1);
  // Fall: Die Verbindung bricht direkt nach dem ersten Ton ab – der zweite Ton entfällt.
  await page.evaluate(() => { window.__beeps = []; window.__cut = true; });
  expect((await emit(page, 'drop', { col: 6 }))?.ok).toBe(true);
  await expect.poll(() => count(page, FIRST), { timeout: 15000 }).toBe(1);
  await page.waitForTimeout(400); // deutlich länger als der Abstand von 140 ms
  expect(await page.evaluate(() => socket.connected)).toBe(false);
  expect(await count(page, SECOND)).toBe(0);
  await page.evaluate(() => socket.connect());
  await expect.poll(() => page.evaluate(() => socket.connected)).toBe(true);
});

test('B07 Audio Poker: zweiter Zugton entfällt nach Verbindungsabbruch', async ({ page, app }, info) => {
  test.skip(info.project.name !== 'desktop', 'Tonlogik ist geräteunabhängig');
  test.setTimeout(60000);
  // Der Ersatzton gilt, solange das Erlebnismodul (EXP-002) noch lädt; der Abruf wird bis zum Testende zurückgehalten.
  let held = null;
  await page.route('**/games/poker/experience.js', (route) => { held = route; });
  await open(page, app, 'poker', { seat: 0 });
  // Der Zugton kann vor der Startbestätigung eintreffen und trennt dann die Verbindung: nicht auf die Antwort warten.
  await page.evaluate(() => { window.__cut = true; send('start'); });
  await expect.poll(() => count(page, FIRST), { timeout: 20000 }).toBe(1);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => socket.connected)).toBe(false);
  expect(await count(page, SECOND)).toBe(0);
  await page.evaluate(() => socket.connect());
  await expect.poll(() => page.evaluate(() => socket.connected)).toBe(true);
  await held?.continue();
});
