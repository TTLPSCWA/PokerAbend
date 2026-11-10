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

/** Echtzeit-Spiele zeichnen im Canvas, dessen Bildrate das Spiel selbst vorgibt. Gemessen wird deshalb der Vergleich:
 *  Bildrate mit Erlebnis-Paket gegen dieselbe Szene ohne Paket, bei 4× gedrosselter CPU. Das Paket darf höchstens `loss` kosten. */
export async function canvasBudget(page, id, { ms = 2500, loss = 0.1, effect = true } = {}) {
  const cdp = await page.context().newCDPSession(page);
  const fps = () => page.evaluate((ms) => new Promise((done) => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(tick); else done(Math.round(n / (performance.now() - t0) * 100000) / 100); }; requestAnimationFrame(tick); }), ms);
  try {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    let best = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.evaluate((id) => { window.__xpKeep = __experiences[id]; delete __experiences[id]; }, id);
      const without = await fps();
      await page.evaluate(({ id, effect }) => { __experiences[id] = window.__xpKeep; if (effect) __experiences[id].replay(); }, { id, effect });
      const withPackage = await fps();
      const result = { fps: withPackage, baselineFps: without, ratio: Math.round(withPackage / without * 1000) / 1000, cpuThrottle: 4, minRatio: 1 - loss };
      if (!best || result.ratio > best.ratio) best = result;
      if (best.ratio >= 1 - loss) break;
    }
    const { expect } = await import('./helpers.js');
    expect(best.ratio, `Canvas mit Paket ${best.fps} FPS, ohne ${best.baselineFps} FPS`).toBeGreaterThanOrEqual(1 - loss);
    return best;
  } finally { await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }).catch(() => {}); await cdp.detach().catch(() => {}); }
}
