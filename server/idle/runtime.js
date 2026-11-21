import { join } from 'node:path';
import { IdleError, requireIdle } from '../../public/idle/engine.js';
import { createIdleAPI } from './api.js';
import { createIdleExportCodec } from './exports.js';
import { createIdleSaveService, IDLE_GAME_ID } from './savepoints.js';
import { openIdleStorage } from './storage.js';

function configuredCodec(config) {
  requireIdle(typeof config === 'string' && config.length > 0 && config.length <= 8192, 'invalid-keyring');
  let data;
  try { data = JSON.parse(config); }
  catch { throw new IdleError('invalid-keyring'); }
  requireIdle(data && Object.getPrototypeOf(data) === Object.prototype && Object.keys(data).length === 2 &&
    typeof data.active === 'string' && Array.isArray(data.keys), 'invalid-keyring');
  const { keys: entries } = data;
  requireIdle(entries.length >= 1 && entries.length <= 8 && entries.every((entry) =>
    entry && Object.getPrototypeOf(entry) === Object.prototype && Object.keys(entry).length === 2 &&
    typeof entry.id === 'string' && typeof entry.key === 'string' && /^[a-f0-9]{64}$/.test(entry.key)),
  'invalid-keyring');
  requireIdle(new Set(entries.map(({ id }) => id)).size === entries.length &&
    new Set(entries.map(({ key }) => key)).size === entries.length, 'invalid-keyring');
  const keys = entries.map(({ id, key }) => [id, Buffer.from(key, 'hex')]);
  return createIdleExportCodec({ current: data.active, keys: Object.fromEntries(keys) });
}

export const isIdleRequest = (path) => /^\/api\/idle(?:\/|$)/i.test(path);

export function createIdleRuntime({ dataDir, engines, keyring, accountMembers, persistAccounts, now, leaseClock }) {
  const games = engines.map(({ gameId }) => gameId);
  requireIdle(new Set(games).size === games.length && games.every((id) =>
    typeof id === 'string' && IDLE_GAME_ID.test(id)), 'invalid-service');
  const store = openIdleStorage(join(dataDir, 'idle'), { enabled: games.length > 0, accountMembers });
  let service = null;
  if (games.length) {
    let codec;
    try { codec = configuredCodec(keyring); }
    catch (error) {
      if (!(error instanceof IdleError)) throw error;
      console.warn('Idle-Speichern ist gesperrt: Schlüsselring fehlt oder ist ungültig.');
    }
    if (codec) service = createIdleSaveService({ engines, store, codec, now, leaseClock, beforeSave: persistAccounts });
  }

  const mergeError = (status, code, message) => Object.assign(new Error(message), { status, code });
  return Object.freeze({
    assertAccountHistory(loadedFromDisk) {
      requireIdle(loadedFromDisk || !store?.hasSavepoints(), 'identity-store-unavailable');
    },
    router(accounts, trustProxy) {
      return games.length ? createIdleAPI({ service, games, accounts, trustProxy }) : null;
    },
    beforeMerge(from, to) {
      if (!store) return false;
      if (service?.hasUnsavedActions([from, to])) {
        throw mergeError(409, 'idle-unsaved-actions', 'Bitte speichere offene Idle-Aktionen vor dem Verbinden der Konten.');
      }
      let hasSave;
      try { hasSave = store.checkMerge(from, to); }
      catch (error) {
        if (error.code === 'account-save-conflict') {
          throw mergeError(409, 'idle-account-save-conflict', 'Beide Konten haben einen bestätigten Stand für dasselbe Idle-Spiel. Beide Spielstände bleiben erhalten.');
        }
        throw mergeError(503, 'idle-storage-unavailable', 'Die Idle-Spielstände konnten nicht geprüft werden.');
      }
      service?.invalidate([from, to]);
      return hasSave;
    },
    beforeDelete(accountIds) {
      if (!store) return false;
      service?.invalidate(accountIds);
      try { store.erase(accountIds); }
      catch { throw mergeError(503, 'idle-storage-unavailable', 'Idle-Spielstände konnten nicht vollständig gelöscht werden. Bitte erneut versuchen.'); }
      return true;
    },
    accountStates(account) {
      try { return store?.accountStates(account) ?? []; }
      catch { throw mergeError(503, 'idle-storage-unavailable', 'Die Idle-Spielstände konnten nicht exportiert werden.'); }
    },
  });
}
