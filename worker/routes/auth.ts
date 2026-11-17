import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { hashPassword, verifyPassword, hasPassword } from '../lib/crypto';
import { getCookie } from 'hono/cookie';
import { createSession, destroySession, requireAuth, requireAppHeader, lookupSession, SESSION_COOKIE } from '../lib/session';
import { bad, clientIp, HttpError, nowIso, readJson } from '../lib/http';
import { rateLimit } from '../lib/ratelimit';

const emailSchema = z.string().trim().toLowerCase().email().max(200);
const passwordSchema = z.string().min(8, 'كلمة السر 8 أحرف على الأقل').max(200);

const GENERIC_LOGIN_ERROR = 'الإيميل أو كلمة السر غير صحيحة';

export function publicUser(u: { id: string; email: string; name: string | null; profile_picture?: string | null; password_hash?: string | null; google_id?: string | null }) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    profile_picture: u.profile_picture ?? null,
    has_password: hasPassword(u.password_hash),
    has_google: !!u.google_id,
  };
}

const USER_COLS = 'id, email, name, profile_picture, password_hash, google_id';

export const auth = new Hono<AppEnv>();

auth.post('/signup', requireAppHeader, async (c) => {
  const body = await readJson<{ email?: string; password?: string; name?: string }>(c, 10_000);
  await rateLimit(c.env, `signup:${clientIp(c)}`, 5, 3600);
  const email = emailSchema.safeParse(body.email);
  if (!email.success) throw bad('invalid_email', 'الإيميل غير صحيح');
  const pw = passwordSchema.safeParse(body.password);
  if (!pw.success) throw bad('weak_password', pw.error.issues[0]?.message);
  const name = (body.name ?? '').trim().slice(0, 80) || email.data.split('@')[0];

  const exists = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email.data).first();
  if (exists) throw new HttpError(409, 'email_taken', 'هذا الإيميل مسجّل، سجّل دخولك بدلاً من ذلك');

  const id = crypto.randomUUID();
  const now = nowIso();
  await c.env.DB.prepare(
    'INSERT INTO users (id, email, password_hash, name, data, updated_at, migrated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(id, email.data, await hashPassword(pw.data), name, '{}', now, now)
    .run();
  const token = await createSession(c, id);
  return c.json({ user: publicUser({ id, email: email.data, name, password_hash: 'x:y' }), token });
});

auth.post('/login', requireAppHeader, async (c) => {
  const body = await readJson<{ email?: string; password?: string }>(c, 10_000);
  const email = emailSchema.safeParse(body.email);
  await rateLimit(c.env, `login:${clientIp(c)}`, 20, 600);
  if (!email.success || typeof body.password !== 'string') throw new HttpError(401, 'invalid_credentials', GENERIC_LOGIN_ERROR);
  await rateLimit(c.env, `login:${email.data}`, 8, 600);
  const u = await c.env.DB.prepare(`SELECT ${USER_COLS} FROM users WHERE email = ?`).bind(email.data)
    .first<{ id: string; email: string; name: string | null; profile_picture: string | null; password_hash: string | null; google_id: string | null }>();
  // run PBKDF2 even when the user is missing so timing does not reveal registered emails
  const ok = await verifyPassword(body.password, u?.password_hash ?? 'aaaaaaaaaaaaaaaa:invalid');
  if (!u || !ok) throw new HttpError(401, 'invalid_credentials', GENERIC_LOGIN_ERROR);
  await c.env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').bind(nowIso(), u.id).run();
  const token = await createSession(c, u.id);
  return c.json({ user: publicUser(u), token });
});

auth.post('/google', requireAppHeader, async (c) => {
  const body = await readJson<{ idToken?: string; credential?: string }>(c, 10_000);
  await rateLimit(c.env, `google:${clientIp(c)}`, 30, 600);
  const idToken = (body.idToken ?? body.credential ?? '').trim();
  if (!idToken || idToken.length > 5000) throw bad('no_token');

  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!res.ok) throw new HttpError(401, 'google_invalid', 'فشل التحقق من Google');
  const info = (await res.json()) as Record<string, string>;
  if (info.aud !== c.env.GOOGLE_CLIENT_ID) throw new HttpError(401, 'google_audience');
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(info.iss)) throw new HttpError(401, 'google_issuer');
  if (Number(info.exp) * 1000 < Date.now()) throw new HttpError(401, 'google_expired');

  const googleId = info.sub;
  const email = (info.email ?? '').trim().toLowerCase();
  const verified = info.email_verified === 'true';
  const name = (info.name ?? email.split('@')[0] ?? 'مستخدم').trim().slice(0, 80);
  const picture = info.picture ?? null;
  const now = nowIso();

  type Row = { id: string; email: string; name: string | null; profile_picture: string | null; password_hash: string | null; google_id: string | null };
  let user = await c.env.DB.prepare(`SELECT ${USER_COLS} FROM users WHERE google_id = ?`).bind(googleId).first<Row>();
  if (!user && email) {
    const byEmail = await c.env.DB.prepare(`SELECT ${USER_COLS} FROM users WHERE email = ?`).bind(email).first<Row>();
    if (byEmail) {
      // Only link to an existing email account when Google has verified that address.
      if (!verified) throw new HttpError(403, 'email_unverified', 'إيميل Google غير موثّق، سجّل دخول بكلمة السر');
      user = byEmail;
    }
  }
  if (!user) {
    if (!email) throw bad('google_no_email');
    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO users (id, email, name, google_id, profile_picture, last_login_at, password_hash, data, updated_at, migrated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(id, email, name, googleId, picture, now, 'google:', '{}', now, now).run();
    user = { id, email, name, profile_picture: picture, password_hash: 'google:', google_id: googleId };
  } else {
    await c.env.DB.prepare('UPDATE users SET google_id = ?, profile_picture = ?, last_login_at = ? WHERE id = ?')
      .bind(googleId, picture, now, user.id).run();
    user = { ...user, google_id: googleId, profile_picture: picture };
  }
  const token = await createSession(c, user.id);
  return c.json({ ok: true, user: publicUser(user), token });
});

auth.post('/logout', async (c) => {
  await destroySession(c);
  return c.json({ ok: true });
});

auth.get('/session', async (c) => {
  const bearer = c.req.header('Authorization')?.replace('Bearer ', '') ?? null;
  const s = await lookupSession(c.env, getCookie(c, SESSION_COOKIE) ?? bearer);
  if (!s) return c.json({ user: null }, 401);
  const u = await c.env.DB.prepare(`SELECT ${USER_COLS}, migrated_at FROM users WHERE id = ?`).bind(s.id)
    .first<{ id: string; email: string; name: string | null; profile_picture: string | null; password_hash: string | null; google_id: string | null; migrated_at: string | null }>();
  if (!u) return c.json({ user: null }, 401);
  return c.json({ user: { ...publicUser(u), migrated: !!u.migrated_at } });
});

/** Converts a v4 bearer token (kept in localStorage) into an HttpOnly cookie session. */
auth.post('/adopt', requireAuth, async (c) => {
  const user = c.get('user');
  if (!c.req.header('Authorization')) return c.json({ ok: true });
  await c.env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(user.sessionKey).run();
  await createSession(c, user.id);
  return c.json({ ok: true });
});

auth.post('/change-password', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await readJson<{ current?: string; next?: string }>(c, 10_000);
  await rateLimit(c.env, `pw:${user.id}`, 5, 900);
  const next = passwordSchema.safeParse(body.next);
  if (!next.success) throw bad('weak_password', next.error.issues[0]?.message);
  const row = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(user.id).first<{ password_hash: string | null }>();
  if (hasPassword(row?.password_hash)) {
    if (!body.current || !(await verifyPassword(body.current, row?.password_hash))) {
      throw new HttpError(401, 'wrong_password', 'كلمة السر الحالية غير صحيحة');
    }
  } else if (Date.now() - Date.parse(user.sessionCreatedAt) > 15 * 60_000) {
    // Google-only account adding a password: require a fresh sign-in
    throw new HttpError(401, 'reauth', 'سجّل خروج ثم دخول مجدداً قبل إضافة كلمة سر');
  }
  await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashPassword(next.data), user.id).run();
  // sign out every other device
  await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND token <> ?').bind(user.id, user.sessionKey).run();
  return c.json({ ok: true });
});

auth.get('/sessions', requireAuth, async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare(
    'SELECT token, created_at, last_seen_at, user_agent FROM sessions WHERE user_id = ? ORDER BY COALESCE(last_seen_at, created_at) DESC',
  ).bind(user.id).all<{ token: string; created_at: string; last_seen_at: string | null; user_agent: string | null }>();
  return c.json({
    sessions: (results ?? []).map((s) => ({
      id: s.token.replace(/^h:/, '').slice(0, 12),
      created_at: s.created_at,
      last_seen_at: s.last_seen_at,
      user_agent: s.user_agent,
      current: s.token === user.sessionKey,
    })),
  });
});

auth.post('/sessions/revoke', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await readJson<{ id?: string; all_others?: boolean }>(c, 2_000);
  if (body.all_others) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND token <> ?').bind(user.id, user.sessionKey).run();
  } else if (body.id && /^[0-9a-f]{6,64}$/.test(body.id)) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?1 AND (substr(token, 3, 12) = ?2 OR substr(token, 1, 12) = ?2) AND token <> ?3')
      .bind(user.id, body.id, user.sessionKey).run();
  }
  return c.json({ ok: true });
});
