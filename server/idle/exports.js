import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { IdleError, plainData, requireIdle, timestamp } from '../../public/idle/engine.js';

const maxPayload = 256 * 1024;
const keyIdPattern = /^[a-zA-Z0-9_-]{1,32}$/;
const base64url = /^[a-zA-Z0-9_-]+$/;
export const revisionOK = (value) => Number.isSafeInteger(value) && value >= 0;

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

export function fingerprint(value) {
  plainData(value);
  const data = canonical(value);
  requireIdle(Buffer.byteLength(data) <= maxPayload, 'payload-too-large');
  return createHash('sha256').update(data).digest('hex');
}

function digest(key, domain, value) {
  return createHmac('sha256', key).update(domain + '\0').update(value).digest();
}

function decode(text) {
  requireIdle(base64url.test(text), 'invalid-export');
  const bytes = Buffer.from(text, 'base64url');
  requireIdle(bytes.toString('base64url') === text, 'invalid-export');
  return bytes;
}

function equal(a, b) {
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createIdleExportCodec({ keys, current }) {
  const keyring = new Map(Object.entries(keys).map(([id, key]) => {
    requireIdle(keyIdPattern.test(id) && Buffer.isBuffer(key) && key.length >= 32, 'invalid-key');
    return [id, Buffer.from(key)];
  }));
  requireIdle(keyring.has(current), 'unknown-key');
  const binding = (key, accountId) => digest(key, 'idle-account-v1', accountId).toString('base64url');
  const signature = (key, id, payload) => digest(key, 'idle-save-v1', id + '.' + payload);

  return Object.freeze({
    activeKeyId: current,
    encode(accountId, record, keyId = current) {
      const key = keyring.get(keyId);
      requireIdle(key, 'unknown-key');
      const body = {
        version: 1, gameId: record.snapshot.gameId, runId: record.runId, revision: record.revision,
        savedAt: record.snapshot.at, binding: binding(key, accountId), snapshot: record.snapshot,
      };
      plainData(body);
      const data = Buffer.from(canonical(body), 'utf8');
      requireIdle(data.length <= maxPayload, 'payload-too-large');
      const payload = data.toString('base64url');
      return [keyId, payload, signature(key, keyId, payload).toString('base64url')].join('.');
    },
    decode(accountId, gameId, text) {
      requireIdle(typeof text === 'string' && text.length <= Math.ceil(maxPayload * 4 / 3) + 80, 'payload-too-large');
      const parts = text.split('.');
      requireIdle(parts.length === 3 && keyIdPattern.test(parts[0]), 'invalid-export');
      const [id, payload, mac] = parts;
      const key = keyring.get(id);
      requireIdle(key, 'unknown-key');
      requireIdle(equal(decode(mac), signature(key, id, payload)), 'invalid-signature');
      const data = decode(payload);
      requireIdle(data.length <= maxPayload, 'payload-too-large');
      let body;
      try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data)); }
      catch { throw new IdleError('invalid-export'); }
      plainData(body);
      requireIdle(body && body.version === 1 && Object.keys(body).length === 7, 'unsupported-envelope');
      requireIdle(body.gameId === gameId && body.snapshot?.gameId === gameId, 'wrong-game');
      requireIdle(typeof body.binding === 'string' &&
        equal(Buffer.from(body.binding), Buffer.from(binding(key, accountId))), 'wrong-account');
      requireIdle(typeof body.runId === 'string' && revisionOK(body.revision) && body.revision > 0 &&
        timestamp(body.savedAt) === body.snapshot.at, 'invalid-export');
      requireIdle(canonical(body) === data.toString('utf8'), 'invalid-export');
      return body;
    },
  });
}
