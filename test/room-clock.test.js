// B07 (OPEN-QA-PERF): Der Spieltakt von RoomClock.setInterval darf Timer-Verspätungen nicht aufsummieren.
// Gemessen war lokal ein 50-ms-Takt von etwa 62,5 ms (Timerkörnung) und unter Last bleibender Zeitverlust.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomClock } from '../server/room-clock.js';

// Die Zeitattrappe führt neu geplante Timer nur aus, wenn die Zeit in kleinen Schritten läuft.
const advance = (t, ms) => { for (let i = 0; i < ms; i++) t.mock.timers.tick(1); };

// Jeder native Timer feuert `late` ms zu spät – wie bei grober Timerauflösung oder kurzer Überlast.
function lateTimers(t, late) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  const mocked = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms, ...rest) => mocked(fn, (ms || 0) + late, ...rest);
  t.after(() => { globalThis.setTimeout = mocked; });
}

test('RoomClock-Intervall hält den Takt trotz verspäteter Timer (kein Aufsummieren)', (t) => {
  lateTimers(t, 15);
  const clock = new RoomClock(); let calls = 0;
  clock.setInterval(() => calls++, 50);
  advance(t, 1000);
  // 1000 ms / 50 ms = 20 Takte; die konstante Verspätung verschiebt nur den Beginn.
  assert.ok(calls >= 19 && calls <= 20, `erwartet 19–20 Takte, erhalten ${calls}`);
  clock.dispose();
});

test('RoomClock-Intervall holt nach langer Überlast nicht unbegrenzt auf', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  const clock = new RoomClock(); const at = [];
  clock.setInterval(() => at.push(Date.now()), 50);
  advance(t, 50); assert.equal(at.length, 1);
  // Der Prozess hängt 2 s (Date springt, kein Timer feuert zwischendurch).
  t.mock.timers.setTime(Date.now() + 2000);
  t.mock.timers.tick(1);
  const burst = at.length;
  advance(t, 200);
  // Höchstens wenige Nachholtakte, danach wieder regulär alle 50 ms – kein Schwall von 40 Takten.
  assert.ok(burst <= 6, `zu viele Nachholtakte: ${burst - 1}`);
  assert.ok(at.length - burst >= 3 && at.length - burst <= 5, `regulärer Takt nach dem Neuausrichten: ${at.length - burst}`);
  clock.dispose();
});

test('RoomClock-Intervall: Pausen zählen weiter nicht, der Takt läuft danach gleichmäßig', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  const clock = new RoomClock(); let calls = 0;
  clock.setInterval(() => calls++, 50);
  advance(t, 100); assert.equal(calls, 2);
  clock.setPaused(true); advance(t, 5000); assert.equal(calls, 2);
  clock.setPaused(false); advance(t, 100); assert.equal(calls, 4);
  clock.dispose();
});
