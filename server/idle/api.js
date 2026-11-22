import express from 'express';
import { IdleError, requireIdle } from '../../public/idle/engine.js';
import { clientIp, limiter, sameOrigin } from '../security.js';
import { revisionOK } from './exports.js';

const id = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
const uuid = (value) => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const object = (value) => value && Object.getPrototypeOf(value) === Object.prototype;
const string = (value) => typeof value === 'string';
const confirmed = (value) => value === true;
const claims = (value) => Array.isArray(value) && value.length > 0 && value.length <= 140 && value.every(id);
const fields = { token: uuid, revision: revisionOK, sessionVersion: revisionOK, id };

const errors = {
  'invalid-account': [401, 'Bitte öffne Spieleabend mit deinem Konto im Browser.'],
  'wrong-game': [404, 'Dieses Idle-Spiel ist nicht verfügbar.'],
  'lease-conflict': [409, 'Die Schreibsitzung ist abgelaufen oder wurde übernommen.'],
  'session-conflict': [409, 'Die Sitzung hat sich geändert. Bitte lade die Ansicht neu.'],
  'revision-conflict': [409, 'Die bestätigte Revision hat sich geändert oder passt nicht zur Sicherungsdatei.'],
  'operation-conflict': [409, 'Diese Anfragen-ID wurde bereits mit einem anderen Inhalt verwendet.'],
  'preview-conflict': [409, 'Bitte erstelle eine neue Importvorschau.'],
  'no-ledger': [409, 'Ein bestätigter Spielstand fehlt. Die Datei kann hier nicht zur Wiederherstellung verwendet werden.'],
  'account-save-conflict': [409, 'Für dieses Spiel gibt es mehrere bestätigte Stände.'],
  'clock-regressed': [409, 'Die Serverzeit liegt vor dem Zeitanker. Bitte später erneut versuchen.'],
  'wrong-account': [400, 'Diese Sicherungsdatei gehört zu einem anderen Konto.'],
  'invalid-export': [400, 'Diese Datei ist keine gültige Sicherung.'],
  'invalid-signature': [400, 'Die Signatur der Sicherungsdatei ist ungültig.'],
  'unknown-key': [400, 'Der Signaturschlüssel dieser Sicherung wird nicht akzeptiert.'],
  'unsupported-envelope': [400, 'Das Dateiformat der Sicherung wird nicht unterstützt.'],
  'unsupported-version': [409, 'Diese Spielstandsversion wird nicht unterstützt.'],
  'invalid-request': [400, 'Die Anfrage enthält fehlende oder ungültige Felder.'],
  'payload-too-large': [413, 'Die Anfrage oder der Spielstand ist zu groß.'],
  'corrupt-save': [503, 'Der bestätigte Spielstand ist beschädigt und wurde beibehalten.'],
  'invalid-game-state': [503, 'Der bestätigte Spielstand ist ungültig und wurde beibehalten.'],
  'storage-unavailable': [503, 'Der Spielstandspeicher ist vorübergehend nicht verfügbar.'],
  'session-capacity': [503, 'Der Server kann derzeit keine weitere Schreibsitzung öffnen.'],
  'work-budget': [503, 'Die Rückkehr konnte nicht vollständig berechnet werden.'],
  'prestige-conflict': [409, 'Die erreichbaren Meilensteine haben sich geändert. Bitte öffne die Vorschau erneut.'],
  'locked': [400, 'Diese Aktion ist noch gesperrt.'],
  'not-enough-coins': [400, 'Nicht genug Münzen.'],
  'not-enough-knowledge': [400, 'Nicht genug Know-how.'],
  'no-space': [400, 'Für diese Station fehlt freie Fläche.'],
  'guest-wait': [409, 'Der nächste Gast ist noch unterwegs.'],
  'loss-warning': [409, 'Der Wiederanlauf würde dein Guthaben belasten.'],
  'cooldown': [409, 'Für dieses Ereignis läuft noch die Wartezeit.'],
  'event-active': [409, 'Hier läuft bereits ein Ereignis.'],
  'studio-budget': [400, 'Für diesen Schritt reicht das verfügbare Budget nicht.'],
  'studio-team': [400, 'Dieses Team arbeitet bereits oder hat keinen freien Personalplatz.'],
  'studio-stage': [400, 'Das Projekt ist für diese Aktion noch nicht bereit.'],
  'studio-research': [400, 'Für diese Forschung fehlen Forschungspunkte.'],
  'studio-portfolio': [400, 'Der Titel ist für diese Aktion nicht verfügbar oder das Portfolio ist ausgelastet.'],
  'studio-contract': [400, 'Dieser Vertrag ist nicht verfügbar oder seine Bedingungen sind noch nicht erfüllt.'],
};

function input(body, schema) {
  const value = body ?? {};
  requireIdle(object(value) && Object.keys(value).length === Object.keys(schema).length &&
    Object.entries(schema).every(([key, valid]) => Object.hasOwn(value, key) && valid(value[key])), 'invalid-request');
  return value;
}

export function createIdleAPI({ service, games, accounts, trustProxy = false }) {
  const router = express.Router();
  const catalog = new Set(games);
  const reads = limiter({ windowMs: 60_000, max: 120 });
  const writes = limiter({ windowMs: 60_000, max: 90 });
  const transfers = limiter({ windowMs: 60_000, max: 15 });
  const json = express.json({ limit: '8kb', inflate: false });
  const importJSON = express.json({ limit: '352kb', inflate: false });
  const error = (res, status, code, message) => res.status(status).json({ code, error: message });

  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!accounts.get(req.accountId)) return error(res, 401, 'invalid-account', errors['invalid-account'][1]);
    if (Object.keys(req.query).length) return error(res, 400, 'invalid-request', errors['invalid-request'][1]);
    const post = req.method === 'POST';
    if (post && (!sameOrigin(req) || req.headers['sec-fetch-site'] === 'cross-site' || req.headers['x-requested-with'] !== 'spieleabend')) {
      return error(res, 403, 'invalid-origin', 'Diese Aktion muss von der Spieleabend-Seite kommen.');
    }
    if (post && !req.is('application/json')) return error(res, 415, 'json-required', 'Bitte JSON senden.');
    const key = clientIp(req, trustProxy) + ':' + req.accountId;
    const limit = /\/(?:import\/preview|export)\/?$/.test(req.path) ? transfers : post ? writes : reads;
    if (!limit.hit(key)) {
      res.setHeader('Retry-After', limit.retryAfter(key));
      return error(res, 429, 'rate-limited', 'Zu viele Anfragen. Bitte warte kurz.');
    }
    next();
  });

  router.param('gameId', (req, res, next, gameId) => {
    if (!catalog.has(gameId)) return error(res, 404, 'wrong-game', errors['wrong-game'][1]);
    if (!service) return error(res, 503, 'idle-unavailable', 'Idle-Speichern ist nicht eingerichtet.');
    return next();
  });

  router.get('/', (_req, res) => res.json({ games: service ? [...catalog] : [] }));
  router.get('/:gameId', (req, res) => {
    const token = req.headers['x-idle-token'];
    if (token !== undefined) requireIdle(uuid(token), 'invalid-request');
    const view = token === undefined ? service.preview(req.accountId, req.params.gameId)
      : service.view(req.accountId, req.params.gameId, token);
    res.json(view);
  });
  router.get('/:gameId/export', (req, res) => res.json(service.exportConfirmed(req.accountId, req.params.gameId)));

  function post(path, schema, run, parser = json) {
    router.post('/:gameId/' + path, parser, (req, res) =>
      res.json(run(req.accountId, req.params.gameId, input(req.body, schema))));
  }
  post('session', {}, (account, game) => service.open(account, game));
  post('session/heartbeat', { token: uuid }, (account, game, { token }) => {
    service.heartbeat(account, game, token);
    return { ok: true };
  });
  post('takeover', { sessionId: uuid, sessionVersion: revisionOK, revision: revisionOK, confirm: confirmed },
    (account, game, body) => service.takeover(account, game, body.sessionId, body));
  post('actions', { ...fields, action: object }, (account, game, body) => service.command(account, game, body));
  post('save', fields, (account, game, body) => service.save(account, game, body));
  post('export', fields, (account, game, body) => service.saveAndExport(account, game, body));
  post('prestige', { ...fields, claims, confirm: confirmed }, (account, game, body) => service.prestige(account, game, body));
  post('import/preview', { token: uuid, file: string },
    (account, game, body) => service.previewImport(account, game, body), importJSON);
  post('import/confirm', { token: uuid, previewId: uuid, confirm: confirmed },
    (account, game, body) => service.confirmImport(account, game, body));

  router.use((_req, res) => error(res, 404, 'not-found', 'Diese Idle-Route existiert nicht.'));
  router.use((failure, req, res, _next) => {
    if (failure instanceof IdleError) {
      if (failure.code === 'unknown-key' && req.method === 'POST' && /\/export\/?$/i.test(req.path)) {
        return error(res, 409, 'export-key-retired', 'Der frühere Schlüssel wurde entfernt. Lade die aktuelle Sicherung erneut herunter.');
      }
      const known = Object.hasOwn(errors, failure.code);
      const [status, message] = known ? errors[failure.code] : [400, 'Die Idle-Aktion ist in diesem Zustand nicht möglich.'];
      if (failure.code === 'revision-conflict' && /\/import\/preview\/?$/i.test(req.path)) {
        return error(res, status, failure.code, 'Nur die aktuell bestätigte Revision kann importiert werden. Ältere Sicherungen werden hier nicht wiederhergestellt.');
      }
      return error(res, status, known ? failure.code : 'invalid-action', message);
    }
    if (failure.status === 413) return error(res, 413, 'payload-too-large', errors['payload-too-large'][1]);
    if (failure.status === 415) return error(res, 415, 'unsupported-encoding', 'Die Kodierung wird nicht unterstützt.');
    if (failure.status === 400) return error(res, 400, 'invalid-request', errors['invalid-request'][1]);
    return error(res, 503, 'storage-unavailable', errors['storage-unavailable'][1]);
  });
  return router;
}
