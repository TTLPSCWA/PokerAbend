// Moderation für /admin (V2-17): Rückblicke, Bestenlisten, Ergebnisse, Spieler und Tickets.
// Alles läuft über Game-IDs bzw. öffentliche Daten; interne Konto-IDs verlassen den Server nie.
// Die Funktionen werfen Fehler mit status, admin.js protokolliert jede Änderung.
import { createHash } from 'node:crypto';
import { GAME_ID } from './account-store.js';

const fail = (status, message) => Object.assign(new Error(message), { status });

const DAY = 86400000, PAGE_SIZES = [25, 50, 100], DELETE_ALL = 'ALLE SPIELER LÖSCHEN', MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function createAdminTools({ reviews, leaderboard, accounts, mergeAccounts, changed = () => {}, erase = null, activeAccounts = () => new Set(), backup = null, idleSaves = () => 0, now = () => Date.now(), gameIds = null }) {
  let busy = false; // ein Masseneingriff nach dem anderen
  const exclusive = (fn) => { if (busy) throw fail(409, 'Es läuft schon ein Eingriff. Bitte kurz warten.'); busy = true; try { return fn(); } finally { busy = false; } };
  const gameIdOf = (owner) => (owner ? accounts.get(owner)?.gameId || '' : '');
  const pair = (fromGameId, toGameId) => {
    if (typeof fromGameId !== 'string' || typeof toGameId !== 'string' || !GAME_ID.test(fromGameId) || !GAME_ID.test(toGameId)) throw fail(400, 'Bitte zwei gültige Game-IDs angeben');
    if (fromGameId === toGameId) throw fail(400, 'Das ist dieselbe Person');
    const from = accounts.byGameId(fromGameId), to = accounts.byGameId(toGameId);
    if (!from || !to) throw fail(404, 'Eine der beiden Game-IDs gibt es nicht');
    if (from.mergedInto || to.mergedInto) throw fail(409, 'Eines der Konten wurde schon zusammengeführt und ist kein eigener Spieler mehr');
    return [from, to];
  };
  const resolveMany = (ids) => {
    if (!Array.isArray(ids) || !ids.length || ids.length > 1000 || !ids.every((id) => typeof id === 'string' && GAME_ID.test(id))) throw fail(400, 'Bitte gültige Game-IDs auswählen');
    const list = [...new Set(ids)].map((id) => accounts.byGameId(id));
    if (list.some((a) => !a)) throw fail(404, 'Mindestens ein Spieler existiert nicht (mehr)');
    // Ein schon zusammengeführtes Konto würde über sein Ziel das gesamte Konto mitlöschen – deshalb nie über die alte Game-ID ansprechbar
    if (list.some((a) => a.mergedInto)) throw fail(409, 'Mindestens ein Konto wurde schon zusammengeführt. Bitte die Liste neu laden.');
    return list;
  };
  const tokenOf = (list) => createHash('sha256').update(list.map((a) => a.gameId + ':' + accounts.members(a.id).length).sort().join(',')).digest('hex').slice(0, 24);
  // Löscht Konto für Konto und meldet genau, was gelungen ist: ein Fehler bei einem Konto stoppt die übrigen nicht und verschweigt nichts.
  const eraseAll = (list) => {
    const deleted = [], failed = [];
    for (const a of list) { try { erase(a.id); deleted.push(a.gameId); } catch (error) { failed.push({ gameId: a.gameId, error: String(error?.message || 'Fehler').slice(0, 120) }); } }
    return { deleted: deleted.length, failed };
  };
  const statsFilter = (scope = {}) => {
    const game = typeof scope.game === 'string' && scope.game ? scope.game : 'all';
    if (game !== 'all' && (!/^[a-z0-9-]{1,40}(~[a-z0-9-]{1,40})?$/.test(game) || (gameIds && !gameIds().has(game.split('~')[0])))) throw fail(400, 'Unbekanntes Spiel');
    if (scope.month != null && scope.month !== '' && !MONTH.test(String(scope.month))) throw fail(400, 'Ungültiger Monat (JJJJ-MM)');
    const owners = scope.gameIds != null ? new Set(resolveMany(scope.gameIds).map((a) => a.id)) : null;
    return { owners, game, month: scope.month || null };
  };
  const statsToken = (scope, preview) => createHash('sha256').update(JSON.stringify([scope.gameIds ? [...scope.gameIds].sort() : null, scope.game || 'all', scope.month || null, preview.rounds, preview.entries, preview.counters])).digest('hex').slice(0, 24);
  const needReviews = () => { if (!reviews) throw fail(503, 'Das Rückblick-Archiv ist nicht lesbar'); return reviews; };
  const periods = ['week', 'month', 'all'];
  return {
    reviews: {
      list: () => ({ items: needReviews().adminList({ limit: 200 }) }),
      get: (id) => needReviews().adminGet(id),
      hide(id, hidden) {
        if (typeof hidden !== 'boolean') throw fail(400, 'Bitte ausblenden oder einblenden angeben');
        const info = needReviews().setHidden(id, hidden);
        if (!info) throw fail(404, 'Diesen Rückblick gibt es nicht');
        return info;
      },
    },
    leaderboard(game = 'all', period = 'all') {
      if (typeof game !== 'string' || game.length > 40 || !periods.includes(period)) throw fail(400, 'Ungültige Auswahl');
      const rows = leaderboard.rankedTable(game, period, false, { withOwner: true }).slice(0, 100).map(({ owner, ...row }) => ({ ...row, name: accounts.get(owner)?.name || row.name, gameId: gameIdOf(owner) }));
      return { game, period, rows, summary: leaderboard.rankedSummary(game, period) };
    },
    rounds: {
      list({ game = 'all', hidden = false, limit = 50 } = {}) {
        if (typeof game !== 'string' || game.length > 40) throw fail(400, 'Ungültiges Spiel');
        return { items: leaderboard.adminRounds({ game, hiddenOnly: hidden === true, limit }).map((r) => ({ ...r, players: r.players.map(({ account, ...p }) => ({ ...p, gameId: gameIdOf(account) })) })) };
      },
      hide(id, hidden) {
        if (typeof hidden !== 'boolean') throw fail(400, 'Bitte ausblenden oder einblenden angeben');
        const info = leaderboard.setRoundHidden(id, hidden);
        if (!info) throw fail(404, 'Diese Runde gibt es nicht');
        changed();
        return info;
      },
    },
    stats: {
      // Bestenlisten-Bereinigung getrennt von den Konten. scope: { gameIds?: [...], game?: 'all'|Spiel-ID, month?: 'JJJJ-MM' }
      preview(scope) { const filter = statsFilter(scope), preview = leaderboard.statsPreview(filter); return { ...preview, token: statsToken(scope, preview) }; },
      remove(scope, token) {
        return exclusive(() => {
          const filter = statsFilter(scope), preview = leaderboard.statsPreview(filter);
          if (!token || token !== statsToken(scope, preview)) throw fail(409, 'Die Voranzeige ist veraltet. Bitte neu prüfen.');
          if (!preview.rounds && !preview.entries && !preview.counters) throw fail(404, 'Dazu gibt es keine Statistik');
          const copy = backup ? backup('bestenliste') : null;
          const done = leaderboard.statsDelete(filter);
          changed();
          return { ...done, backup: copy?.dir || null };
        });
      },
    },
    players: {
      search: (q) => ({ items: accounts.search(typeof q === 'string' ? q.slice(0, 40) : '') }),
      // Vollständige, seitenweise Liste. Nur Game-ID, Anzeigename und Kennzahlen – nie interne Konto-IDs oder Discord-Kennungen.
      list({ q = '', filter = 'all', sort = 'recent', page = 1, pageSize = 50 } = {}) {
        if (!['all', 'guest', 'discord', 'active', 'inactive'].includes(filter) || !['recent', 'name', 'created', 'wins'].includes(sort)) throw fail(400, 'Ungültige Auswahl');
        const size = PAGE_SIZES.includes(Number(pageSize)) ? Number(pageSize) : 50, term = String(q).trim().toLowerCase().slice(0, 40);
        const stats = new Map(leaderboard.rankedTable('all', 'all', false, { withOwner: true }).map((r) => [r.owner, r]));
        const online = activeAccounts(), t = now();
        const rows = accounts.all().map((a) => {
          const st = stats.get(a.id), discord = accounts.isRegistered(a.id), recent = (a.lastSeen || 0) >= t - 30 * DAY;
          return { gameId: a.gameId, name: a.name || '', avatar: a.avatar || '', discord, createdAt: a.createdAt || 0, lastSeen: a.lastSeen || 0, played: st?.played || 0, wins: st?.wins || 0, status: online.has(a.id) ? 'in-spiel' : recent ? 'aktiv' : 'inaktiv', type: discord ? 'discord' : 'gast' };
        }).filter((r) => (!term || r.gameId.toLowerCase().includes(term) || r.name.toLowerCase().includes(term))
          && (filter === 'all' || (filter === 'guest' ? r.type === 'gast' : filter === 'discord' ? r.discord : filter === 'active' ? r.status !== 'inaktiv' : r.status === 'inaktiv')));
        const collator = new Intl.Collator('de', { sensitivity: 'base', numeric: true });
        rows.sort(sort === 'name' ? (a, b) => collator.compare(a.name || '~', b.name || '~') || collator.compare(a.gameId, b.gameId) : sort === 'created' ? (a, b) => b.createdAt - a.createdAt : sort === 'wins' ? (a, b) => b.wins - a.wins || b.played - a.played : (a, b) => b.lastSeen - a.lastSeen);
        const pages = Math.max(1, Math.ceil(rows.length / size)), current = Math.min(pages, Math.max(1, Number(page) | 0 || 1));
        return { total: rows.length, all: accounts.count(), page: current, pages, pageSize: size, items: rows.slice((current - 1) * size, current * size) };
      },
      // Auswahl aller Treffer eines Filters (nur Game-IDs, damit die Oberfläche „alle Treffer“ auswählen kann)
      ids(opts = {}) { const first = this.list({ ...opts, page: 1, pageSize: 100 }); const out = first.items.map((i) => i.gameId); for (let page = 2; page <= first.pages && out.length < 2000; page++) out.push(...this.list({ ...opts, page, pageSize: 100 }).items.map((i) => i.gameId)); return { ids: out, total: first.total }; },
      // Vergleich vor dem Zusammenführen
      compare(fromGameId, toGameId) {
        const [from, to] = pair(fromGameId, toGameId);
        const side = (a) => ({ gameId: a.gameId, name: a.name || '', avatar: a.avatar || '', discord: accounts.isRegistered(a.id), createdAt: a.createdAt || 0, lastSeen: a.lastSeen || 0, ...leaderboard.accountSummary(a.id), achievements: Object.keys(a.achievements || {}).length, idleSaves: idleSaves(a.id) });
        return { from: side(from), to: side(to), effects: ['Statistik, Runden, Erfolge, Tickets, Planungen und Idle-Spielstände der Quelle gehören danach dem Ziel.', 'Das Quellkonto zeigt anschließend auf das Zielkonto; die Bestenliste führt beide als eine Person.', 'Der Anzeigename des Ziels bleibt.'] };
      },
      // Löschen: Voranzeige mit Auswirkungen und Prüfwert (nur wer die Voranzeige kennt, kann bestätigen)
      deletePreview(ids) {
        const list = resolveMany(ids), online = activeAccounts();
        const items = list.map((a) => ({ gameId: a.gameId, name: a.name || '', discord: accounts.isRegistered(a.id), ...leaderboard.accountSummary(a.id), achievements: Object.keys(a.achievements || {}).length, idleSaves: idleSaves(a.id), active: online.has(a.id) }));
        return { count: items.length, active: items.filter((i) => i.active).length, items: items.slice(0, 100), effects: ['Konto, Geräteverknüpfungen, Discord-Verknüpfung, Einstellungen, Freigaben, Erfolge und Idle-Spielstände werden gelöscht.', 'Ergebnisse anderer Spieler bleiben; der Name wird in den Runden anonymisiert.', 'Tickets und Planungen bleiben ohne Kontozuordnung bestehen.'], token: tokenOf(list) };
      },
      remove(ids, token) {
        return exclusive(() => {
          const list = resolveMany(ids);
          if (!token || token !== tokenOf(list)) throw fail(409, 'Die Voranzeige ist veraltet. Bitte die Auswahl neu prüfen.');
          const online = activeAccounts(), blocked = list.filter((a) => online.has(a.id));
          if (blocked.length) throw fail(409, blocked.length + ' Spieler sitzen gerade an einem Tisch (' + blocked.slice(0, 5).map((a) => a.gameId).join(', ') + '). Bitte zuerst den Tisch schließen.');
          if (!erase) throw fail(503, 'Löschen ist nicht verfügbar');
          const copy = backup ? backup('spieler-loeschen') : null;
          const done = eraseAll(list);
          changed();
          return { ...done, backup: copy?.dir || null };
        });
      },
      removeAllPreview() {
        const list = accounts.all(), online = activeAccounts();
        return { count: list.length, active: list.filter((a) => online.has(a.id)).length, discord: list.filter((a) => accounts.isRegistered(a.id)).length, rounds: leaderboard.roundCount(), phrase: DELETE_ALL, token: tokenOf(list), effects: ['Alle Konten, Geräteverknüpfungen, Discord-Verknüpfungen, Erfolge und Idle-Spielstände werden gelöscht.', 'Die Bestenlisten-Runden bleiben anonymisiert erhalten; zum Leeren die Bestenliste getrennt zurücksetzen.', 'Vorher wird eine geprüfte Sicherung des gesamten Datenordners angelegt.'] };
      },
      // Alle Konten löschen: Bestätigungstext, aktuelle Voranzeige, keine aktive Sitzung und geprüfte Sicherung – erst danach wird etwas verändert.
      removeAll({ confirm, token }) {
        return exclusive(() => {
          if (confirm !== DELETE_ALL) throw fail(400, 'Bitte „' + DELETE_ALL + '“ genau eintippen');
          const list = accounts.all();
          if (!list.length) throw fail(404, 'Es gibt keine Konten');
          if (!token || token !== tokenOf(list)) throw fail(409, 'Die Voranzeige ist veraltet. Bitte neu prüfen.');
          const online = activeAccounts();
          if (list.some((a) => online.has(a.id))) throw fail(409, 'Es sitzen noch Spieler an Tischen. Bitte zuerst alle Tische schließen.');
          if (!erase || !backup) throw fail(503, 'Löschen oder Sicherung ist nicht verfügbar');
          const copy = backup('alle-spieler-loeschen'); // wirft bei fehlgeschlagener Prüfung, bevor etwas gelöscht wird
          if (!copy?.verified && !copy?.empty) throw fail(503, 'Die Sicherung ist nicht bestätigt – nichts wurde gelöscht');
          const done = eraseAll(list);
          changed();
          return { ...done, backup: copy.dir };
        });
      },
      // Wie beim Geräte-Verbinden: alles von „from“ gehört danach „to“. Das Konto „from“ zeigt auf „to“ (Eintrag bleibt im Konto-Protokoll).
      merge(fromGameId, toGameId) {
        const [from, to] = pair(fromGameId, toGameId);
        accounts.merge(from.id, to.id);
        leaderboard.merge(from.id, to.id, to.name);
        mergeAccounts(from.id, to.id, { fromGameId, toGameId });
        accounts.audit('Spieler per Admin zusammengeführt', `${fromGameId} → ${toGameId}`);
        changed();
        return { from: fromGameId, to: toGameId, name: to.name };
      },
    },
  };
}
