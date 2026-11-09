// Gemeinsame Bausteine für die EXP-Spielpaket-Specs (Klang, Bewegung, Highlight je Spiel).
import { expect, login, selectGame, observeServerView } from './helpers.js';
import { mkdirSync } from 'node:fs';

export const send = (page, type, data) => page.evaluate(({ type, data }) => send(type, data), { type, data });
export const state = (page) => page.evaluate(() => lastState);
export const ok = async (page, type, data) => { const reply = await send(page, type, data); expect(reply?.ok, `${type}: ${reply?.error}`).toBe(true); return reply; };
export const soundLog = (page) => page.evaluate(() => { window.__soundLog = []; });
export const sounds = (page) => page.evaluate(() => (window.__soundLog || []).map((entry) => entry.event));
/** „Animationen reduzieren“ über den echten Schalter in den Einstellungen setzen (vor dem Öffnen eines Tisches). */
export async function calm(page) {
  await page.evaluate(() => { location.hash = '#einstellungen/anzeige'; });
  await page.locator('[data-set="display.calm"]').check();
}

/** Host eröffnet den Tisch und setzt sich; weitere Menschen kommen in eigenen Browser-Kontexten dazu. */
export async function openTable(page, app, browser, game, { guests = [], settings, sit = {}, reduced = false } = {}) {
  await login(page, app); if (reduced) await calm(page); await selectGame(page, game);
  await page.locator('#host-form button[type=submit]').click();
  await expect(page.locator(`[data-scene="${game}"]`)).toBeVisible();
  await ok(page, 'sit', sit);
  if (settings) await ok(page, 'settings', settings);
  const code = await page.evaluate(() => lastState.code), contexts = [], others = [];
  for (const name of guests) {
    const context = await browser.newContext({ viewport: page.viewportSize() || undefined }); contexts.push(context);
    const other = await context.newPage(); observeServerView(other);
    await login(other, app, name);
    await other.evaluate((code) => joinAndEnter(code, 'sit'), code);
    others.push(other);
  }
  if (guests.length) await expect.poll(() => page.evaluate(() => lastState.players.filter((p) => p.seated).length)).toBe(1 + guests.length);
  return { code, others, close: async () => { for (const context of contexts) await context.close(); } };
}

/** Zuschauer in eigenem Kontext; liefert die Seite und eine Aufräumfunktion. */
export async function watch(page, app, browser, name = 'Zuschauer') {
  const code = await page.evaluate(() => lastState.code), context = await browser.newContext({ viewport: page.viewportSize() || undefined });
  const watcher = await context.newPage(); await login(watcher, app, name);
  await watcher.evaluate((code) => joinAndEnter(code, 'watch'), code);
  return { watcher, close: () => context.close() };
}

/** Dauerhafter Nachweis nur mit EXP_CAPTURE=1, sonst im Testausgabe-Ordner. */
export async function evidence(page, info, id, name) {
  let path = info.outputPath(`${name}.png`);
  if (process.env.EXP_CAPTURE === '1') { const dir = `docs/design/experience/${id}`; mkdirSync(dir, { recursive: true }); path = `${dir}/${name}-${info.project.name}.png`; }
  await page.screenshot({ path });
  return path;
}

/** Zeichnet neue Web-Animationen auf: Dauer und animierte Eigenschaften (nur transform/opacity sind erlaubt). */
export async function recordAnimations(page) {
  await page.evaluate(() => {
    if (window.__xpAnimations) { window.__xpAnimations.length = 0; return; }
    const log = window.__xpAnimations = [], original = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) {
      const list = Array.isArray(frames) ? frames : [frames];
      log.push({ duration: typeof options === 'number' ? options : options?.duration, delay: options?.delay || 0, target: this.className?.baseVal ?? this.className, props: [...new Set(list.flatMap((f) => Object.keys(f || {})))].filter((k) => !['offset', 'easing', 'composite'].includes(k)) });
      return original.call(this, frames, options);
    };
  });
}
export const animations = (page) => page.evaluate(() => window.__xpAnimations || []);
export function expectOnlyTransformOpacity(list) {
  for (const a of list) expect(a.props.every((p) => p === 'transform' || p === 'opacity'), JSON.stringify(a)).toBe(true);
}

/**
 * Bewegungsbudget eines Spielpakets: spielt die zuletzt gezeigte Änderung mehrmals stumm nach (nur Darstellung) und misst dabei.
 * So bewertet die Messung die Bewegung selbst und nicht Netzwerk, Server und das Neuzeichnen des Tisches.
 */
export async function smoothReplay(page, id, { times = 3, gap = 420, attempts = 3, ...options } = {}) {
  const { expectSmoothMotion } = await import('./helpers.js');
  // PC: mindestens 45 FPS bei 4× gedrosselter CPU (Standard des Helfers). Mobilansicht: Der Helfer drosselt auch hier 4×;
  // jeder Bewegungsstart kostet dann 2–3 Bilder, deshalb gilt dort 50 statt der ungedrosselten 60-Hz-Vorgabe.
  if (options.minFps === undefined && await page.evaluate(() => matchMedia('(pointer: coarse)').matches)) options.minFps = 50;
  let failure;
  // Bis zu drei Messungen: Eine bestandene zeigt, dass die Bewegung das Budget hält; einzelne Ausreißer der Testmaschine zählen nicht.
  for (let n = 0; n < attempts; n++) {
    try {
      return await expectSmoothMotion(page, () => page.evaluate(async ({ id, times, gap }) => {
        for (let i = 0; i < times; i++) { if (!__experiences[id].replay()) throw Error('Keine Änderung zum Nachspielen'); await new Promise((r) => setTimeout(r, gap)); }
      }, { id, times, gap }), options);
    } catch (error) { failure = error; if (process.env.EXP_FPS_DEBUG) console.log('FPSDBG', String(error.message).split('\n')[0]); if (!/Motion: /.test(String(error.message))) throw error; }
  }
  throw failure;
}

/** FPS-Messwerte als Nachweis ablegen (nur mit EXP_CAPTURE=1). */
export async function fpsEvidence(info, id, metrics) {
  if (process.env.EXP_CAPTURE !== '1') return metrics;
  const { writeFileSync } = await import('node:fs');
  mkdirSync(`docs/design/experience/${id}`, { recursive: true });
  writeFileSync(`docs/design/experience/${id}/fps-${info.project.name}.json`, JSON.stringify(metrics, null, 2) + '\n');
  return metrics;
}
