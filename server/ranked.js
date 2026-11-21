// Ranked-Berechtigung über serverseitige Konten und aktive Sitzung pro Platz.
export const RANK_REASONS = ['bots', 'gast', 'zu-wenige', 'teilnehmer', 'aus'];

export function rankedReason(players, { authorized, resolve }) {
  const list = (players || []).filter(Boolean);
  if (list.some((p) => p.bot)) return 'bots';
  if (list.length < 2) return 'zu-wenige';
  if (list.some((p) => !p.accountId || !authorized(p))) return 'gast';
  const count = new Set(list.map((p) => resolve(p.accountId))).size;
  if (count < 2) return 'zu-wenige';
  if (count !== list.length) return 'teilnehmer';
  return '';
}

// Verbindet Räume (onChange 'roundStart' / 'roundAbort' / 'result') mit der Rundenablage der Bestenliste.
// Die Berechtigung wird beim Rundenstart eingefroren; jede eingefrorene Runde wird höchstens einmal verbucht.
// enabled: Feature-Flag „Ranked“ (V2-10). Aus = jede neue Runde zählt nicht (Grund 'aus'); bisherige Ergebnisse und die Namensstatistik bleiben unberührt.
export function createRanked({ accounts, leaderboard, lowWins = () => false, newId, enabled = () => true, sessionOf = () => null, sessionValid = () => false }) {
  const resolve = (id) => accounts.resolve(id);
  const reasonOf = (room, ids, refs) => !enabled() ? 'aus' : rankedReason((ids || []).map((id) => room.players.get(id)),
    { authorized: (p) => sessionValid(refs ? refs[p.id] : sessionOf(p), resolve(p.accountId)), resolve });
  const seated = (room) => (Array.isArray(room.seats) ? room.seats : [...room.players.values()]
    .filter((p) => p.seat !== null && p.seat !== undefined && !p.kicked).map((p) => p.id))
    .filter((id) => room.players.has(id));
  const frozenAccounts = (room, ids) => Object.fromEntries(ids.map((id) => [id, resolve(room.players.get(id)?.accountId)]));
  function checkFrozen(room, frozen) {
    if (frozen.reason) return frozen.reason;
    if (!enabled()) return (frozen.reason = 'aus');
    for (const id of frozen.ids) {
      const player = room.players.get(id), account = frozen.accounts[id];
      if (!player || player.kicked || player.bot || resolve(player.accountId) !== account || resolve(account) !== account) return (frozen.reason = 'teilnehmer');
      if (!sessionValid(frozen.refs[id], account)) return (frozen.reason = 'gast');
    }
    return '';
  }
  return {
    freeze(room, ids) {
      const list = [...new Set((ids || []).filter((id) => room.players.has(id)))];
      const refs = Object.fromEntries(list.map((id) => [id, sessionOf(room.players.get(id))]));
      room.rankedRound = { id: newId(), ids: list, reason: reasonOf(room, list, refs), accounts: frozenAccounts(room, list), refs };
    },
    abort(room) { room.rankedRound = null; },
    reconnect(room, player, ref) {
      const frozen = room.rankedRound;
      if (!frozen || frozen.reason || !frozen.ids.includes(player.id)) return;
      if (frozen.refs[player.id] !== ref) frozen.reason = 'gast';
      else checkFrozen(room, frozen);
    },
    snapshot(room) {
      const frozen = room.rankedRound;
      return frozen ? { id: frozen.id, ids: frozen.ids, accounts: frozen.accounts } : null;
    },
    restore(room, snapshot) {
      if (!room.busy) return;
      const ids = Array.isArray(snapshot?.ids) ? snapshot.ids.filter((id) => room.players.has(id)) : seated(room);
      const id = /^[a-f0-9]{16}$/.test(snapshot?.id || '') ? snapshot.id : newId();
      room.rankedRound = { id, ids, accounts: frozenAccounts(room, ids), refs: {}, reason: 'unbekannt' };
    },
    state(room) {
      const reason = room.rankedRound ? checkFrozen(room, room.rankedRound) : reasonOf(room, seated(room));
      return { ranked: !reason, reason, frozen: !!room.rankedRound };
    },
    record(room, data) {
      const frozen = room.rankedRound; room.rankedRound = null;
      if (!frozen || !Array.isArray(data?.entries)) return false;
      const byName = new Map([...room.players.values()].map((p) => [p.name, p]));
      let reason = checkFrozen(room, frozen);
      const seen = new Set();
      const players = data.entries.map((e, i) => {
        const p = Array.isArray(data.ids) ? room.players.get(data.ids[i]) : byName.get(e.name);
        if (!p || !frozen.ids.includes(p.id) || seen.has(p.id)) reason ||= 'teilnehmer';
        if (p) seen.add(p.id);
        return { accountId: (p && frozen.accounts[p.id]) || null, name: e.name, bot: !!p?.bot, win: e.win, points: e.points };
      });
      if (frozen.ids.some((id) => !seen.has(id))) reason ||= 'teilnehmer';
      const p = room.partyProgram;
      const program = p && ['running','between','done'].includes(p.status) && p.results?.some(r=>r.index===p.index && r.game===room.game) ? { id:p.id, mode:p.config.mode, index:p.index, total:p.plan.length } : null;
      return leaderboard.recordRound({ id: frozen.id, game: room.game, variant: room.variant || 'classic', ranked: !reason, reason, players, lowWins: !!lowWins(room), program });
    },
  };
}
