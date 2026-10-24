// Anmeldung mit Discord (OAuth2, kein Bot).
// Rein kommt nur, wer Mitglied auf unserem Discord-Server ist (optional mit Rolle).
// Sitzungen liegen auf dem Server in data/sessions.json, im Browser steckt nur eine signierte Sitzungs-ID.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { cleanName, safeAvatarUrl } from './security.js';

export const SESSION_COOKIE = 'pa_session';
export const STATE_COOKIE = 'pa_oauth';
export const SESSION_DAYS = 180;
export const STATE_MINUTES = 10;
const RETRY_MS = 60 * 60e3; // Discord nicht erreichbar → in 1 h nochmal prüfen
const CDN = 'https://cdn.discordapp.com/';

export const LOGIN_ERRORS = {
  not_member: 'Du bist nicht auf unserem Discord-Server. Tritt zuerst dem Server bei, dann klappt die Anmeldung.',
  role_missing: 'Dir fehlt auf unserem Discord-Server die Rolle für den Pokerabend. Frag einen Admin.',
  cancelled: 'Anmeldung abgebrochen. Du kannst es jederzeit nochmal versuchen.',
  state: 'Die Anmeldung ist abgelaufen oder kam nicht von dieser Seite. Bitte nochmal versuchen.',
  unreachable: 'Discord ist gerade nicht erreichbar. Probier es in ein paar Minuten nochmal.',
  expired: 'Deine Anmeldung ist nicht mehr gültig. Bitte melde dich neu an.',
  failed: 'Die Anmeldung bei Discord hat nicht geklappt. Bitte nochmal versuchen.',
};

// Konfiguration aus der Umgebung. Ohne DISCORD_CLIENT_ID: null (kein Discord-Login).
// Halb eingerichtet → Fehler mit den Namen der fehlenden Werte (nie mit Inhalten).
export function discordConfig(env = process.env) {
  const val = (k) => String(env[k] || '').trim();
  const clientId = val('DISCORD_CLIENT_ID');
  if (!clientId) return null;
  const missing = ['DISCORD_CLIENT_SECRET', 'DISCORD_GUILD_ID'].filter((k) => !val(k));
  if (missing.length) {
    throw new Error(`Discord-Login ist nur halb eingerichtet: ${missing.join(' und ')} fehlt in der .env.`);
  }
  const hours = Number(val('DISCORD_RECHECK_HOURS') || 24);
  return {
    clientId,
    clientSecret: val('DISCORD_CLIENT_SECRET'),
    guildId: val('DISCORD_GUILD_ID'),
    roleId: val('DISCORD_ROLE_ID'),
    publicUrl: (val('PUBLIC_URL') || `http://localhost:${val('PORT') || 3000}`).replace(/\/+$/, ''),
    apiBase: (val('DISCORD_API_BASE') || 'https://discord.com/api/v10').replace(/\/+$/, ''),
    authorizeUrl: val('DISCORD_AUTHORIZE_URL') || 'https://discord.com/oauth2/authorize',
    recheckMs: (Number.isFinite(hours) && hours > 0 ? hours : 24) * 3600e3,
  };
}

// ---------- Signierte Cookie-Werte ----------
export function cookieSigner(secret) {
  const mac = (v) => createHmac('sha256', secret).update(v).digest('base64url');
  return {
    sign: (v) => `${v}.${mac(v)}`,
    unsign(token) {
      if (typeof token !== 'string') return null;
      const i = token.lastIndexOf('.');
      if (i < 1) return null;
      const v = token.slice(0, i);
      const a = Buffer.from(token.slice(i + 1)); const b = Buffer.from(mac(v));
      return a.length === b.length && timingSafeEqual(a, b) ? v : null;
    },
  };
}

export function setCookie(name, value, { secure, path = '/', maxAge }) {
  return [
    `${name}=${encodeURIComponent(value)}`, `Path=${path}`, 'HttpOnly', 'SameSite=Lax',
    `Max-Age=${Math.round(maxAge)}`, secure ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}

// ---------- Sitzungen (data/sessions.json, nur für den Server lesbar) ----------
export function createSessions(dataDir) {
  const file = join(dataDir, 'sessions.json');
  let map = new Map();
  try {
    if (existsSync(file)) map = new Map(Object.entries(JSON.parse(readFileSync(file, 'utf8'))));
  } catch (e) { console.error('Sitzungen konnten nicht geladen werden:', e.message); }

  let timer = null;
  function flush() {
    clearTimeout(timer); timer = null;
    try {
      mkdirSync(dataDir, { recursive: true });
      writeFileSync(file + '.tmp', JSON.stringify(Object.fromEntries(map)), { mode: 0o600 });
      renameSync(file + '.tmp', file);
      try { chmodSync(file, 0o600); } catch { /* Windows */ }
    } catch (e) { console.error('Sitzungen speichern fehlgeschlagen:', e.message); }
  }
  const save = () => { if (!timer) { timer = setTimeout(flush, 300); timer.unref?.(); } };

  return {
    get(id) {
      const s = typeof id === 'string' ? map.get(id) : null;
      if (s && s.expiresAt < Date.now()) { map.delete(id); save(); return null; }
      return s || null;
    },
    create(data) {
      const id = randomBytes(24).toString('base64url');
      map.set(id, { ...data, createdAt: Date.now(), expiresAt: Date.now() + SESSION_DAYS * 864e5 });
      save();
      return id;
    },
    touch(id) {
      const s = map.get(id);
      if (s) { s.expiresAt = Date.now() + SESSION_DAYS * 864e5; save(); }
    },
    changed: save,
    delete(id) { if (map.delete(id)) save(); },
    flush,
  };
}

// ---------- Discord-API ----------
function fail(code) { const e = new Error(code); e.code = code; return e; }

// Name: Server-Nickname, sonst Anzeigename, sonst Benutzername. Bild: Server-Avatar, sonst Profilbild, sonst Standardbild.
export function profileFrom(cfg, user, member = {}) {
  if (!/^\d{1,25}$/.test(String(user?.id || ''))) throw fail('failed');
  const hash = (h) => (typeof h === 'string' && /^[a-z0-9_]{1,64}$/i.test(h) ? h : null);
  let avatarUrl;
  if (hash(member.avatar)) avatarUrl = `${CDN}guilds/${cfg.guildId}/users/${user.id}/avatars/${member.avatar}.png?size=128`;
  else if (hash(user.avatar)) avatarUrl = `${CDN}avatars/${user.id}/${user.avatar}.png?size=128`;
  else avatarUrl = `${CDN}embed/avatars/${Number((BigInt(user.id) >> 22n) % 6n)}.png`;
  return {
    discordId: String(user.id),
    name: cleanName(member.nick || user.global_name || user.username) || 'Discord',
    avatarUrl: safeAvatarUrl(avatarUrl),
  };
}

export function createDiscord(cfg) {
  const redirectUri = cfg.publicUrl + '/auth/discord/callback';

  async function call(path, { token, form } = {}) {
    let res;
    try {
      res = await fetch(cfg.apiBase + path, {
        method: form ? 'POST' : 'GET',
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
        },
        body: form ? new URLSearchParams(form) : undefined,
        signal: AbortSignal.timeout(10000),
      });
    } catch { throw fail('unreachable'); }
    if (res.status >= 500 || res.status === 429) throw fail('unreachable');
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  const tokenCall = (form) => call('/oauth2/token', { form: { client_id: cfg.clientId, client_secret: cfg.clientSecret, ...form } });
  const tokensFrom = (d) => ({
    accessToken: d.access_token, refreshToken: d.refresh_token,
    tokenExpires: Date.now() + Number(d.expires_in || 3600) * 1000,
  });
  const memberCall = (token) => call(`/users/@me/guilds/${cfg.guildId}/member`, { token });
  const hasRole = (member) => !cfg.roleId || (Array.isArray(member.roles) && member.roles.includes(cfg.roleId));

  function authorizeUrl(state) {
    const u = new URL(cfg.authorizeUrl);
    u.search = new URLSearchParams({
      client_id: cfg.clientId, response_type: 'code', redirect_uri: redirectUri,
      scope: 'identify guilds.members.read', state, prompt: 'none',
    }).toString();
    return u.toString();
  }

  // Code gegen Tokens tauschen und Mitgliedschaft prüfen. Wirft Fehler mit code aus LOGIN_ERRORS.
  async function login(code) {
    const t = await tokenCall({ grant_type: 'authorization_code', code: String(code), redirect_uri: redirectUri });
    if (t.status !== 200 || !t.data.access_token) throw fail('failed');
    const tokens = tokensFrom(t.data);
    const u = await call('/users/@me', { token: tokens.accessToken });
    if (u.status !== 200) throw fail('failed');
    const m = await memberCall(tokens.accessToken);
    if (m.status === 404 || m.status === 403) throw fail('not_member');
    if (m.status !== 200) throw fail('failed');
    if (!hasRole(m.data)) throw fail('role_missing');
    return { ...profileFrom(cfg, u.data, m.data), ...tokens, checkedAt: Date.now(), nextCheck: Date.now() + cfg.recheckMs };
  }

  async function refresh(s) {
    if (!s.refreshToken) return false;
    const t = await tokenCall({ grant_type: 'refresh_token', refresh_token: s.refreshToken });
    if (t.status !== 200 || !t.data.access_token) return false; // widerrufen
    Object.assign(s, tokensFrom(t.data));
    return true;
  }

  // Mitgliedschaft neu prüfen, wenn fällig. true = Sitzung bleibt, false = Sitzung löschen.
  async function recheck(s) {
    const now = Date.now();
    if (now < (s.nextCheck || 0)) return true;
    try {
      if (s.tokenExpires && s.tokenExpires < now + 60e3 && !(await refresh(s))) return false;
      let m = await memberCall(s.accessToken);
      if (m.status === 401) {
        if (!(await refresh(s))) return false;
        m = await memberCall(s.accessToken);
      }
      if (m.status === 404 || m.status === 403 || m.status === 401) return false;
      if (m.status !== 200) throw fail('unreachable');
      if (!hasRole(m.data)) return false;
      if (m.data.user) Object.assign(s, profileFrom(cfg, m.data.user, m.data));
      s.checkedAt = now;
      s.nextCheck = now + cfg.recheckMs;
      return true;
    } catch (e) {
      // Discord weg? Niemanden aussperren, später nochmal.
      if (e.code !== 'unreachable') console.error('Discord-Prüfung fehlgeschlagen:', e.message);
      s.nextCheck = now + RETRY_MS;
      return true;
    }
  }

  return { authorizeUrl, login, recheck, redirectUri };
}
