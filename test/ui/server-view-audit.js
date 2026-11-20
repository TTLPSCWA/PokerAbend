import { isDeepStrictEqual } from 'node:util';

function transportKey(stamp) {
  if (Number.isSafeInteger(stamp?.revision) && stamp.revision > 0 &&
      typeof stamp.connection === 'string' && stamp.connection) {
    return JSON.stringify([stamp.revision, stamp.connection]);
  }
}

function instance(value) {
  return value === null || (Number.isSafeInteger(value) && value > 0);
}

export function viewKey(stamp) {
  if (transportKey(stamp) && Number.isSafeInteger(stamp.room) && stamp.room > 0 &&
      instance(stamp.hand) && instance(stamp.round) &&
      typeof stamp.viewer === 'string' && stamp.viewer && ['player', 'spectator'].includes(stamp.role)) {
    return JSON.stringify([stamp.revision, stamp.connection, stamp.room, stamp.hand, stamp.round, stamp.viewer, stamp.role]);
  }
}

export class ServerViewLedger {
  #views = new Map();
  #closed = new WeakSet();
  #generation = 0;

  get generation() { return this.#generation; }

  navigate() {
    this.#generation++;
    this.#views.clear();
  }

  capture(payload, generation, source) {
    if (generation !== this.#generation || this.#closed.has(source)) return;
    for (const raw of payload.split('\x1e')) {
      if (!raw.startsWith('42[')) continue;
      let packet;
      try { packet = JSON.parse(raw.slice(2)); } catch { continue; }
      const [event, view] = packet;
      const stamp = view?.__roomViewAudit;
      const key = transportKey(stamp);
      if (event !== 'state' || !key) continue;
      const valid = viewKey(stamp) && view.code && view.game && view.you?.id === stamp.viewer && viewerRole(view) === stamp.role;
      const entry = this.#views.get(key);
      if (entry) {
        if (!valid || !isDeepStrictEqual(entry.view, view)) entry.ambiguous = true;
        if (source) entry.sources.add(source);
      } else {
        this.#views.set(key, { view, ambiguous: !valid, sources: new Set(source ? [source] : []) });
        if (this.#views.size > 512) this.#views.delete(this.#views.keys().next().value);
      }
    }
  }

  close(source) {
    this.#closed.add(source);
  }

  find(stamp) {
    const key = viewKey(stamp);
    if (!key) return;
    const entry = this.#views.get(transportKey(stamp));
    if (entry && !entry.ambiguous && viewKey(entry.view.__roomViewAudit) === key &&
        ![...entry.sources].some(source => this.#closed.has(source))) return entry.view;
  }

  peers(view, accept) {
    const matching = [];
    for (const entry of this.#views.values()) {
      const peer = entry.view;
      if (this.find(peer.__roomViewAudit) && accept(view, peer)) matching.push(peer);
    }
    return matching;
  }
}

function sameRoom(view, other) {
  return Boolean(view?.code && view.code === other?.code && view.game && view.game === other.game &&
    Number.isSafeInteger(view.__roomViewAudit?.room) && view.__roomViewAudit.room === other.__roomViewAudit?.room &&
    view.__roomViewAudit.round === other.__roomViewAudit.round &&
    view.phase === other.phase && view.roundNo === other.roundNo);
}

export function samePokerSituation(view, other) {
  if (!sameRoom(view, other)) return false;
  const a = view.hand;
  const b = other.hand;
  const identity = view.__roomViewAudit.hand;
  return Boolean(Number.isSafeInteger(identity) && identity === other.__roomViewAudit.hand &&
    Number.isSafeInteger(a?.no) && a.no === b?.no && a.street === b.street &&
    a.done === b.done && a.toAct === b.toAct && a.currentBet === b.currentBet &&
    isDeepStrictEqual(a.board, b.board));
}

export function samePokerViewer(view, other) {
  return Boolean(samePokerSituation(view, other) && view.you?.id && view.you.id === other.you?.id &&
    viewerRole(view) === viewerRole(other) && view.you.seat === other.you.seat);
}

function viewerRole(view) {
  if (typeof view.you?.playing === 'boolean') return view.you.playing ? 'player' : 'spectator';
  return Number.isInteger(view.you?.seat) || view.players?.some(player => player.id === view.you?.id && player.seated)
    ? 'player' : 'spectator';
}

export function isLivePeer(view, peer) {
  const a = view.__roomViewAudit;
  const b = peer?.__roomViewAudit;
  return Boolean(viewKey(a) && viewKey(b) && a.revision === b.revision && a.connection !== b.connection &&
    a.hand === b.hand && view.you?.id && peer.you?.id && view.you.id !== peer.you.id && sameRoom(view, peer) &&
    (!['poker', 'omaha'].includes(view.game) || !(view.hand || peer.hand) || samePokerSituation(view, peer)));
}

// Scan before waiting for peers. A missing frame cannot be supplied after capture.
export function bindPresentation(samples, find) {
  const batches = new Map();
  for (const sample of samples) {
    const key = viewKey(sample.stamp);
    if (!batches.has(key)) {
      const view = find(sample.stamp);
      if (!key || !view || viewKey(view.__roomViewAudit) !== key) {
        throw new Error('No captured server view for the DOM revision');
      }
      batches.set(key, { view, samples: [] });
    }
    batches.get(key).samples.push(sample);
  }
  return [...batches.values()];
}

// Serialized by Playwright and installed before core.js runs.
export function installRoomViewAudit() {
  const received = new WeakMap();
  let newest = 0;
  let rendered = null;
  let pending = null;
  let listener;
  const current = () => {
    const frame = pending ?? rendered;
    return frame?.socket.connected && frame.socket.id === frame.stamp.connection ? frame.stamp : null;
  };
  globalThis.__pokerRoomViewAudit = Object.freeze({
    received(view, socket) {
      const stamp = view?.__roomViewAudit;
      if (socket.connected && stamp?.connection === socket.id && stamp.viewer === view.you?.id &&
          Number.isSafeInteger(stamp.revision) && stamp.revision > 0) {
        received.set(view, { stamp: Object.freeze({ ...stamp }), socket });
      }
    },
    beforeRender(view, socket) {
      listener?.flush(current());
      const frame = received.get(view);
      rendered = null;
      pending = frame?.socket === socket && frame.stamp.revision >= newest ? frame : null;
    },
    afterRender(applied) {
      listener?.rendered(applied ? current() : null);
      rendered = applied ? pending : null;
      if (rendered) newest = rendered.stamp.revision;
      pending = null;
    },
    invalidate() {
      listener?.flush(current());
      rendered = pending = null;
      listener?.invalidate();
    },
    current,
    watch(observer) {
      listener = observer;
    },
  });
}
