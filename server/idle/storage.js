import { lstatSync, mkdirSync, readdirSync, rmdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { IdleError, requireIdle } from '../../public/idle/engine.js';
import { createIdleFileStore, IDLE_GAME_ID } from './savepoints.js';

const temporarySave = /^[a-f0-9]{64}\.json\.[a-f0-9-]{36}\.tmp$/;
const storeFailure = () => new IdleError('storage-unavailable');

// Managed layout: one directory per game, atomic files from the low-level adapter.
// The writer directory is intentionally left after an unclean exit. An operator must
// verify exclusive ownership before clearing it, including across Docker namespaces.
export function openIdleStorage(directory, { enabled, accountMembers }) {
  try { requireIdle(lstatSync(directory).isDirectory(), 'storage-unavailable'); }
  catch (error) {
    if (error.code !== 'ENOENT') throw storeFailure();
    if (!enabled) return null;
    try {
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      requireIdle(lstatSync(directory).isDirectory(), 'storage-unavailable');
    } catch { throw storeFailure(); }
  }

  const lock = join(directory, '.writer');
  try { mkdirSync(lock, { mode: 0o700 }); }
  catch (error) { throw new IdleError(error.code === 'EEXIST' ? 'storage-writer-exists' : 'storage-unavailable'); }
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    process.off('exit', close);
    try { rmdirSync(lock); } catch { /* an uncertain lock must not be removed forcibly */ }
  };

  function storedGames() {
    requireIdle(!closed, 'storage-unavailable');
    try {
      return readdirSync(directory, { withFileTypes: true }).filter((item) => item.name !== '.writer').map((item) => {
        requireIdle(item.isDirectory() && IDLE_GAME_ID.test(item.name), 'storage-unavailable');
        return item.name;
      });
    } catch { throw storeFailure(); }
  }

  try {
    for (const gameId of storedGames()) {
      const path = join(directory, gameId);
      for (const file of readdirSync(path, { withFileTypes: true })) {
        if (file.isFile() && temporarySave.test(file.name)) rmSync(join(path, file.name));
      }
    }
  } catch (error) {
    close();
    throw error instanceof IdleError ? error : storeFailure();
  }
  process.once('exit', close);

  function adapter(gameId) {
    requireIdle(!closed && typeof gameId === 'string' && IDLE_GAME_ID.test(gameId), 'storage-unavailable');
    const path = join(directory, gameId);
    try {
      requireIdle(lstatSync(path).isDirectory(), 'storage-unavailable');
    } catch (error) {
      if (error.code !== 'ENOENT') throw storeFailure();
    }
    return createIdleFileStore(path);
  }

  function locate(accountId, gameId, files = adapter(gameId)) {
    const members = accountMembers(accountId);
    requireIdle(members.includes(accountId), 'invalid-account');
    let match = null;
    for (const owner of members) {
      const record = files.read(owner, gameId);
      if (!record) continue;
      requireIdle(!match, 'account-save-conflict');
      match = { owner, record };
    }
    return match;
  }

  return Object.freeze({
    close,
    hasSavepoints() {
      try {
        return storedGames().some((gameId) => readdirSync(join(directory, gameId))
          .some((name) => /^[a-f0-9]{64}\.json$/.test(name)));
      } catch { throw storeFailure(); }
    },
    read(accountId, gameId) { return locate(accountId, gameId)?.record ?? null; },
    compareAndSet(accountId, gameId, expected, record) {
      const files = adapter(gameId);
      const match = locate(accountId, gameId, files);
      return files.compareAndSet(match?.owner ?? accountId, gameId, expected, record);
    },
    checkMerge(from, to) {
      let hasSave = false;
      for (const gameId of storedGames()) {
        const files = adapter(gameId);
        const source = locate(from, gameId, files);
        const target = locate(to, gameId, files);
        requireIdle(!source || !target, 'account-save-conflict');
        hasSave ||= Boolean(source || target);
      }
      return hasSave;
    },
    erase(accountIds) {
      for (const gameId of storedGames()) {
        const files = adapter(gameId);
        for (const id of accountIds) files.remove(id, gameId);
      }
    },
    accountStates(accountId) {
      return storedGames().flatMap((gameId) => {
        const match = locate(accountId, gameId);
        if (!match) return [];
        const { revision, snapshot } = match.record;
        requireIdle(snapshot.gameId === gameId, 'corrupt-save');
        return [{ gameId, revision, savedAt: snapshot.at, stateVersion: snapshot.stateVersion,
          rulesVersion: snapshot.rulesVersion, state: snapshot.data }];
      });
    },
  });
}
