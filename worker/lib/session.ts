import type { Context, MiddlewareHandler } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { AppEnv, Env, SessionUser } from '../env';
import { randomHex, sha256Hex } from './crypto';
import { HttpError, unauthorized, nowIso } from './http';

export const SESSION_COOKIE = 'dq_session';
const SESSION_DAYS = 60;
const DAY = 864e5;

/** Stored key is "h:" + sha256(token). Tokens issued by v4 were stored raw and are still accepted until they expire. */
async function storageKey(raw: string): Promise<string> {
  return `h:${await sha256Hex(raw)}`;
}

export async function createSession(c: Context<AppEnv>, userId: string): Promise<string> {
  const raw = randomHex(32);
  const now = new Date();
  await c.env.DB.prepare(
    'INSERT INTO sessions (token, user_id, created_at, expires_at, user_agent, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(await storageKey(raw), userId, now.toISOString(), new Date(now.getTime() + SESSION_DAYS * DAY).toISOString(),
      (c.req.header('User-Agent') ?? '').slice(0, 200), now.toISOString())
    .run();
  setCookie(c, SESSION_COOKIE, raw, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_DAYS * 86400,
  });
  return raw;
}

function rawTokenFrom(c: Context<AppEnv>): string | null {
  const cookie = getCookie(c, SESSION_COOKIE);
  if (cookie) return cookie;
  const auth = c.req.header('Authorization') ?? '';
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() || null : null;
}

export async function lookupSession(env: Env, raw: string | null): Promise<SessionUser | null> {
  if (!raw || raw.length > 200) return null;
  const hashed = await storageKey(raw);
  const row = await env.DB.prepare(
    `SELECT s.token, s.user_id, s.created_at, s.expires_at, s.last_seen_at, u.email, u.name
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token IN (?1, ?2)`,
  )
    .bind(hashed, raw)
    .first<{ token: string; user_id: string; created_at: string; expires_at: string; last_seen_at: string | null; email: string; name: string | null }>();
  if (!row) return null;
  const now = Date.now();
  if (Date.parse(row.expires_at) <= now) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(row.token).run();
    return null;
  }
  // sliding expiry, written at most once a day
  if (!row.last_seen_at || now - Date.parse(row.last_seen_at) > DAY) {
    await env.DB.prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE token = ?')
      .bind(nowIso(), new Date(now + SESSION_DAYS * DAY).toISOString(), row.token)
      .run();
  }
  return { id: row.user_id, email: row.email, name: row.name, sessionKey: row.token, sessionCreatedAt: row.created_at };
}

export async function destroySession(c: Context<AppEnv>): Promise<void> {
  const raw = rawTokenFrom(c);
  if (raw) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE token IN (?, ?)').bind(await storageKey(raw), raw).run();
  }
  deleteCookie(c, SESSION_COOKIE, { path: '/', secure: true });
}

/**
 * Requires a valid session. State-changing requests must also carry the `X-Daqeeq` header:
 * browsers cannot add custom headers cross-site without a CORS preflight (which we never grant),
 * so this blocks CSRF for cookie-authenticated calls.
 */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const raw = rawTokenFrom(c);
  const viaCookie = !!getCookie(c, SESSION_COOKIE) && !c.req.header('Authorization');
  if (viaCookie && c.req.method !== 'GET' && c.req.method !== 'HEAD' && !c.req.header('X-Daqeeq')) {
    throw new HttpError(403, 'csrf');
  }
  const user = await lookupSession(c.env, raw);
  if (!user) throw unauthorized();
  c.set('user', user);
  await next();
};

/** CSRF guard for unauthenticated state-changing routes (login, signup). */
export const requireAppHeader: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.req.method !== 'GET' && !c.req.header('X-Daqeeq') && !c.req.header('Authorization')) {
    // legacy v4 clients send JSON without the header; allow only JSON bodies (forms cannot send application/json cross-site without preflight)
    if (!(c.req.header('Content-Type') ?? '').includes('application/json')) throw new HttpError(403, 'csrf');
  }
  await next();
};
