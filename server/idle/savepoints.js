import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { IdleError, plainData, requireIdle, timestamp } from '../../public/idle/engine.js';
import { fingerprint, revisionOK } from './exports.js';

const accountPattern = /^[a-f0-9]{32}$/;
const gamePattern = /^[a-z][a-z0-9-]{0,63}$/;
const actionPattern = /^[a-zA-Z0-9_-]{1,80}$/;
const uuidPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const maxRecordBytes = 384 * 1024;

function recordKey(accountId, gameId) {
  requireIdle(typeof accountId === 'string' && accountPattern.test(accountId), 'invalid-account');
  requireIdle(typeof gameId === 'string' && gamePattern.test(gameId), 'wrong-game');
  return createHash('sha256').update(accountId + ':' + gameId).digest('hex');
}

function validateRecord(record) {
  plainData(record);
  requireIdle(record && Object.keys(record).length === 5 && revisionOK(record.revision) && record.revision > 0 &&
    typeof record.runId === 'string' && uuidPattern.test(record.runId) && record.snapshot && typeof record.snapshot === 'object' &&
    record.operation && typeof record.operation.id === 'string' && actionPattern.test(record.operation.id) &&
    typeof record.operation.digest === 'string' && /^[a-f0-9]{64}$/.test(record.operation.digest) &&
    record.format === 1, 'corrupt-save');
  return record;
}

// Synchronous compare-and-set for a single Node process and a local filesystem.
// Writes occur only on an explicit commit; the old file survives a failed write.
export function createIdleFileStore(directory) {
  const pathFor = (accountId, gameId) => join(directory, recordKey(accountId, gameId) + '.json');
  function read(accountId, gameId) {
    const file = pathFor(accountId, gameId);
    let text;
    try {
      requireIdle(statSync(file).size <= maxRecordBytes, 'corrupt-save');
      text = readFileSync(file, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      if (error instanceof IdleError) throw error;
      throw new IdleError('storage-unavailable');
    }
    try { return validateRecord(JSON.parse(text)); }
    catch { throw new IdleError('corrupt-save'); }
  }
  return Object.freeze({
    read,
    compareAndSet(accountId, gameId, expected, record) {
      requireIdle((read(accountId, gameId)?.revision ?? 0) === expected, 'revision-conflict');
      requireIdle(validateRecord(record).revision === expected + 1, 'revision-conflict');
      const text = JSON.stringify(record);
      requireIdle(Buffer.byteLength(text) <= maxRecordBytes, 'payload-too-large');
      const file = pathFor(accountId, gameId);
      const temporary = file + '.' + randomUUID() + '.tmp';
      try {
        mkdirSync(directory, { recursive: true, mode: 0o700 });
        writeFileSync(temporary, text, { flag: 'wx', mode: 0o600, flush: true });
        renameSync(temporary, file);
      } catch {
        try { rmSync(temporary, { force: true }); } catch { /* report the original write failure */ }
        throw new IdleError('storage-unavailable');
      }
    },
  });
}

// The caller supplies a canonical server account and allowed module registry.
// No HTTP routes, browser storage, account merge, or production flags live here.
export function createIdleSaveService({ engines, store, codec, migrations = {},
  now = Date.now, leaseClock = () => performance.now(), leaseMs = 300_000, maxSessions = 1024 }) {
  const registry = new Map(engines.map((engine) => [engine.gameId, engine]));
  requireIdle(registry.size === engines.length && Number.isSafeInteger(leaseMs) && leaseMs > 0 &&
    Number.isSafeInteger(maxSessions) && maxSessions > 0, 'invalid-service');
  const sessions = new Map();

  function select(accountId, gameId) {
    const key = recordKey(accountId, gameId);
    const engine = registry.get(gameId);
    requireIdle(engine, 'wrong-game');
    return { accountId, gameId, key, engine };
  }

  function current(ctx) {
    const active = sessions.get(ctx.key);
    if (active && active.until > leaseClock()) return active;
    sessions.delete(ctx.key);
    return null;
  }

  function writer(ctx, token) {
    const active = current(ctx);
    requireIdle(active && token === active.token, 'lease-conflict');
    return active;
  }

  function read(ctx) {
    return store.read(ctx.accountId, ctx.gameId);
  }

  function load(ctx, snapshot) {
    try { return ctx.engine.validate(snapshot); }
    catch (error) {
      if (error.code !== 'unsupported-version') throw error;
      const version = snapshot.stateVersion + '/' + snapshot.rulesVersion;
      const migration = migrations[ctx.gameId]?.[version];
      requireIdle(typeof migration?.validate === 'function' && migration.validate(structuredClone(snapshot)) === true, 'unsupported-version');
      return ctx.engine.migrate(snapshot, migration.upgrade);
    }
  }

  function refreshLease(active) {
    active.until = leaseClock() + leaseMs;
  }

  function snapshotView(ctx, active, readOnly = false) {
    return {
      sessionId: active.id,
      ...(readOnly ? {} : { token: active.token }),
      readOnly, revision: active.base, sessionVersion: active.version, savedAt: active.savedAt,
      dirty: active.dirty, settlement: { ...active.settlement },
      view: ctx.engine.view(active.snapshot),
    };
  }

  function liveView(ctx, active, readOnly) {
    const { snapshot, ...interval } = ctx.engine.advance(active.snapshot, timestamp(now()));
    const result = snapshotView(ctx, { ...active, snapshot, dirty: active.dirty || interval.to > interval.from }, readOnly);
    return { ...result, previewUntil: interval.to };
  }

  function begin(ctx) {
    const at = timestamp(now());
    const record = read(ctx);
    const snapshot = record ? load(ctx, record.snapshot) : ctx.engine.create(at);
    const { snapshot: advanced, ...settlement } = ctx.engine.advance(snapshot, at);
    for (const [key, session] of sessions) {
      if (leaseClock() >= session.until) sessions.delete(key);
    }
    requireIdle(sessions.has(ctx.key) || sessions.size < maxSessions, 'session-capacity');
    const active = {
      id: randomUUID(), token: randomUUID(), runId: record?.runId ?? randomUUID(), base: record?.revision ?? 0,
      savedAt: record?.snapshot.at ?? null, version: 0, snapshot: advanced, settlement,
      dirty: (record?.snapshot.at ?? at) < advanced.at, commands: new Map(), preview: null,
    };
    refreshLease(active);
    const result = snapshotView(ctx, active);
    sessions.set(ctx.key, active);
    return result;
  }

  const receipt = (record) => ({ revision: record.revision, savedAt: record.snapshot.at });

  function save(ctx, { token, sessionVersion, revision, id }, withExport = false) {
    requireIdle(typeof id === 'string' && actionPattern.test(id), 'invalid-operation');
    requireIdle(typeof token === 'string' && uuidPattern.test(token) && revisionOK(revision) &&
      revisionOK(sessionVersion), 'invalid-operation');
    const digest = fingerprint({ id, token, sessionVersion, revision });
    const previous = read(ctx);
    if (previous?.operation.id === id) {
      requireIdle(previous.operation.digest === digest, 'operation-conflict');
      load(ctx, previous.snapshot);
      return { record: previous, file: withExport ? codec.encode(ctx.accountId, previous) : undefined };
    }
    const active = writer(ctx, token);
    requireIdle(active.version === sessionVersion && active.base === revision &&
      revision === (previous?.revision ?? 0) && revisionOK(revision + 1), 'revision-conflict');
    const { snapshot } = ctx.engine.advance(active.snapshot, timestamp(now()));
    const next = { format: 1, revision: revision + 1, runId: active.runId, snapshot, operation: { id, digest } };
    const file = codec.encode(ctx.accountId, next);
    store.compareAndSet(ctx.accountId, ctx.gameId, revision, next);
    active.base = next.revision;
    active.savedAt = snapshot.at;
    active.snapshot = snapshot;
    active.dirty = false;
    active.settlement = { from: snapshot.at, to: snapshot.at, segments: 0 };
    refreshLease(active);
    return { record: next, file: withExport ? file : undefined };
  }

  function ensureCurrentImport(ctx, encoded) {
    const imported = codec.decode(ctx.accountId, ctx.gameId, encoded);
    load(ctx, imported.snapshot);
    requireIdle(imported.savedAt <= timestamp(now()), 'clock-regressed');
    const record = read(ctx);
    requireIdle(record, 'no-ledger');
    requireIdle(record.runId === imported.runId && record.revision === imported.revision &&
      fingerprint(record.snapshot) === fingerprint(imported.snapshot), 'revision-conflict');
    return record;
  }

  return Object.freeze({
    open(accountId, gameId) {
      const ctx = select(accountId, gameId);
      const active = current(ctx);
      return active ? liveView(ctx, active, true) : begin(ctx);
    },
    takeover(accountId, gameId, expectedSessionId) {
      const ctx = select(accountId, gameId);
      const active = current(ctx);
      requireIdle(active && active.id === expectedSessionId, 'lease-conflict');
      return begin(ctx);
    },
    view(accountId, gameId, token) {
      const ctx = select(accountId, gameId);
      return liveView(ctx, writer(ctx, token), false);
    },
    heartbeat(accountId, gameId, token) {
      refreshLease(writer(select(accountId, gameId), token));
    },
    command(accountId, gameId, { token, sessionVersion, revision, id, action }) {
      const ctx = select(accountId, gameId);
      const active = writer(ctx, token);
      requireIdle(typeof id === 'string' && actionPattern.test(id) && revisionOK(sessionVersion) && revisionOK(revision), 'invalid-operation');
      const digest = fingerprint({ sessionVersion, revision, action });
      const known = active.commands.get(id);
      if (known) {
        requireIdle(known.digest === digest, 'operation-conflict');
        return { ...known.result };
      }
      requireIdle(active.base === revision && active.version === sessionVersion && revisionOK(sessionVersion + 1), 'session-conflict');
      const snapshot = ctx.engine.command(active.snapshot, timestamp(now()), action);
      const result = { sessionVersion: ++active.version, at: snapshot.at };
      active.snapshot = snapshot;
      active.dirty = true;
      active.commands.set(id, { digest, result });
      if (active.commands.size > 128) active.commands.delete(active.commands.keys().next().value);
      refreshLease(active);
      return { ...result };
    },
    save(accountId, gameId, request) {
      return receipt(save(select(accountId, gameId), request).record);
    },
    saveAndExport(accountId, gameId, request) {
      const { record, file } = save(select(accountId, gameId), request, true);
      return { ...receipt(record), file };
    },
    exportConfirmed(accountId, gameId) {
      const ctx = select(accountId, gameId);
      const record = read(ctx);
      requireIdle(record, 'no-ledger');
      load(ctx, record.snapshot);
      return { ...receipt(record), file: codec.encode(accountId, record) };
    },
    previewImport(accountId, gameId, { token, file }) {
      const ctx = select(accountId, gameId);
      const active = writer(ctx, token);
      const record = ensureCurrentImport(ctx, file);
      requireIdle(record.revision === active.base, 'revision-conflict');
      const preview = { id: randomUUID(), runId: record.runId, revision: record.revision,
        snapshotDigest: fingerprint(record.snapshot), version: active.version,
        until: leaseClock() + Math.min(leaseMs, 60_000), result: null };
      active.preview = preview;
      return { previewId: preview.id, ...receipt(record), discardsUnsavedChanges: active.dirty };
    },
    confirmImport(accountId, gameId, { token, previewId }) {
      const ctx = select(accountId, gameId);
      const active = writer(ctx, token);
      const preview = active.preview;
      requireIdle(preview && preview.id === previewId && preview.until > leaseClock(), 'preview-conflict');
      if (preview.result) return { ...preview.result };
      const record = read(ctx);
      requireIdle(record && record.runId === preview.runId && record.revision === preview.revision &&
        fingerprint(record.snapshot) === preview.snapshotDigest && active.version === preview.version &&
        revisionOK(active.version + 1), 'revision-conflict');
      const { snapshot, ...settlement } = ctx.engine.advance(load(ctx, record.snapshot), timestamp(now()));
      active.snapshot = snapshot;
      active.settlement = settlement;
      active.dirty = settlement.to > settlement.from;
      active.commands.clear();
      active.version++;
      refreshLease(active);
      preview.result = { ...receipt(record), sessionVersion: active.version };
      return { ...preview.result };
    },
  });
}
