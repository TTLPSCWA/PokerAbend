// SEC-SOCKET-01: Der Seitenzugang einer Socket.IO-Verbindung gilt nicht dauerhaft ab dem Handshake.
// Jedes eingehende Paket (auch Ereignisse außerhalb des gemeinsamen Spiel-Handlers) und ein regelmäßiger
// Durchlauf für ruhige Verbindungen prüfen ihn erneut. Fällt er weg, bekommt der Browser „auth-expired“ und die
// Verbindung wird getrennt. Die Trennung läuft über den normalen disconnect-Weg: Sitzplatz, Spielstand,
// Zug-Timer und Offline-Fristen folgen unverändert den bestehenden Regeln.
export const ACCESS_EXPIRED = 'site-access-expired';

/**
 * @param {{ valid: (socket: any) => boolean, sweepMs?: number }} options
 *   valid: prüft den Seitenzugang der Verbindung (ohne Seiteneffekte auf Spielzustand).
 */
export function createSocketAccess({ valid, sweepMs = 60_000 }) {
  const live = new Set();
  let timer = null, soon = false;

  const ok = (socket) => {
    if (socket.data.accessDenied) return false;
    try { return !!valid(socket); } catch { return false; } // Fehler bei der Prüfung sperren statt durchlassen
  };
  function deny(socket) {
    if (socket.data.accessDenied) return;
    socket.data.accessDenied = true;
    socket.emit('auth-expired', { code: ACCESS_EXPIRED });
    socket.disconnect(true);
  }
  function sweep() {
    let denied = 0;
    for (const socket of live) if (!ok(socket)) { deny(socket); denied++; }
    return denied;
  }

  return {
    /** Verbindung beobachten; muss vor allen anderen socket.use-Prüfungen aufgerufen werden. */
    attach(socket) {
      live.add(socket);
      socket.on('disconnect', () => live.delete(socket));
      socket.use((packet, next) => {
        if (ok(socket)) return next();
        const cb = packet[packet.length - 1];
        if (typeof cb === 'function') cb({ ok: false, code: ACCESS_EXPIRED, error: 'Bitte melde dich erneut an.' });
        deny(socket);
        next(new Error(ACCESS_EXPIRED));
      });
    },
    /** Alle beobachteten Verbindungen sofort prüfen (z. B. nach Logout); liefert die Zahl der getrennten. */
    sweep,
    /** Prüfung nach dem aktuellen Aufruf nachholen, ohne Rekursion aus Speicher-Rückrufen heraus. */
    sweepSoon() {
      if (soon) return;
      soon = true;
      setImmediate(() => { soon = false; sweep(); }).unref?.();
    },
    /** Schnittstelle für SEC-SESSION-01: Verbindungen gezielt sperren, z. B. alle einer widerrufenen Sitzung. */
    revoke(match) {
      let denied = 0;
      for (const socket of live) if (match(socket)) { deny(socket); denied++; }
      return denied;
    },
    start() { if (!timer) { timer = setInterval(sweep, sweepMs); timer.unref?.(); } },
    stop() { clearInterval(timer); timer = null; },
    get size() { return live.size; },
  };
}
