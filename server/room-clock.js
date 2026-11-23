// Eigene Spielzeit pro Tisch: Pausen zählen weder für Fristen noch für Wertungen.
// Netzwerk, Persistenz und Offline-Erkennung verwenden weiterhin die echte Uhr.
// Höchstens so viele verpasste Intervalle holt ein Takt nach einer Verzögerung nach (B07).
const MAX_CATCHUP = 4;
export class RoomClock {
  constructor() {
    this.pausedAt = null;
    this.pauseMs = 0;
    this.timers = new Set();
  }
  get paused() { return this.pausedAt !== null; }
  now() { return (this.pausedAt ?? Date.now()) - this.pauseMs; }

  setPaused(value) {
    if (value === this.paused) return;
    if (value) {
      this.pausedAt = Date.now();
      for (const timer of this.timers) { clearTimeout(timer.native); timer.native = null; }
    } else {
      this.pauseMs += Date.now() - this.pausedAt;
      this.pausedAt = null;
      for (const timer of this.timers) this.arm(timer);
    }
  }

  setTimeout(fn, ms) { return this.schedule(fn, ms, false); }
  setInterval(fn, ms) { return this.schedule(fn, ms, true); }
  schedule(fn, ms, repeat) {
    const delay = Math.max(repeat ? 1 : 0, Number(ms) || 0);
    const timer = { fn, delay, repeat, due: this.now() + delay, native: null, referenced: true,
      unref() { this.referenced = false; this.native?.unref?.(); return this; } };
    this.timers.add(timer);
    this.arm(timer);
    return timer;
  }
  arm(timer) {
    if (this.paused || !this.timers.has(timer)) return;
    timer.native = setTimeout(() => {
      timer.native = null;
      if (this.paused || !this.timers.has(timer)) return;
      if (!timer.repeat) this.timers.delete(timer);
      else {
        // B07: fester Takt. Der nächste Termin folgt dem geplanten, nicht dem tatsächlichen Auslösezeitpunkt;
        // sonst summieren sich Timerverspätungen (z. B. 50 → 62,5 ms) zu bleibendem Spielzeitverlust.
        // Liegt der Takt nach Überlast mehr als MAX_CATCHUP Intervalle zurück, richtet er sich neu aus statt aufzuholen.
        const next = timer.due + timer.delay;
        timer.due = next < this.now() - timer.delay * MAX_CATCHUP ? this.now() + timer.delay : next;
      }
      try { timer.fn(); }
      finally { if (timer.repeat) this.arm(timer); }
    }, Math.max(0, timer.due - this.now()));
    if (!timer.referenced) timer.native.unref?.();
  }
  clearTimeout(timer) {
    if (!timer) return;
    clearTimeout(timer.native);
    this.timers.delete(timer);
  }
  clearInterval(timer) { this.clearTimeout(timer); }
  dispose() { for (const timer of this.timers) this.clearTimeout(timer); }
}
