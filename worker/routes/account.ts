import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { requireAuth, destroySession } from '../lib/session';
import { HttpError, readJson } from '../lib/http';
import { verifyPassword, hasPassword } from '../lib/crypto';
import { rowToRec } from '../lib/records';
import { rateLimit } from '../lib/ratelimit';

export const account = new Hono<AppEnv>();
account.use('*', requireAuth);

/** Full portable export of everything the account owns (JSON). */
account.get('/export', async (c) => {
  const user = c.get('user');
  await rateLimit(c.env, `export:${user.id}`, 10, 3600);
  const u = await c.env.DB.prepare('SELECT id, email, name, friend_code, updated_at, last_login_at FROM users WHERE id = ?').bind(user.id).first();
  const { results } = await c.env.DB.prepare(
    'SELECT id, type, data, parent_id, date, status, private, created_at, updated_at, deleted_at, rev FROM records WHERE user_id = ? ORDER BY type, created_at',
  ).bind(user.id).all();
  const records = (results ?? []).map((r) => rowToRec(r as never));
  return c.json(
    { format: 'daqeeq-export', version: 5, exported_at: new Date().toISOString(), account: u, records },
    200,
    { 'Content-Disposition': `attachment; filename="daqeeq-export-${new Date().toISOString().slice(0, 10)}.json"` },
  );
});

/** Raw v4 blob snapshot (for users who want their original data). */
account.get('/legacy', async (c) => {
  const user = c.get('user');
  const snap = await c.env.DB.prepare('SELECT data FROM legacy_snapshots WHERE user_id = ?').bind(user.id).first<{ data: string }>();
  const row = snap ?? (await c.env.DB.prepare('SELECT data FROM users WHERE id = ?').bind(user.id).first<{ data: string }>());
  return c.body(row?.data ?? '{}', 200, { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="daqeeq-v4-backup.json"' });
});

/**
 * Permanently deletes the account. Requires the typed confirmation phrase and, for password
 * accounts, the password; Google-only accounts need a session younger than 15 minutes.
 */
account.post('/delete', async (c) => {
  const user = c.get('user');
  await rateLimit(c.env, `delete:${user.id}`, 5, 3600);
  const body = await readJson<{ confirm?: string; password?: string }>(c, 2000);
  if (body.confirm !== 'DELETE') throw new HttpError(400, 'confirm_required');
  const row = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(user.id).first<{ password_hash: string | null }>();
  if (hasPassword(row?.password_hash)) {
    if (!body.password || !(await verifyPassword(body.password, row?.password_hash))) throw new HttpError(401, 'wrong_password', 'كلمة السر غير صحيحة');
  } else if (Date.now() - Date.parse(user.sessionCreatedAt) > 15 * 60_000) {
    throw new HttpError(401, 'reauth', 'سجّل دخولك مجدداً ثم احذف الحساب');
  }
  if (c.env.FILES) {
    const { results } = await c.env.DB.prepare('SELECT r2_key FROM files WHERE user_id = ?').bind(user.id).all<{ r2_key: string }>();
    const keys = (results ?? []).map((r) => r.r2_key);
    for (let i = 0; i < keys.length; i += 1000) await c.env.FILES.delete(keys.slice(i, i + 1000));
  }
  const id = user.id;
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM records WHERE user_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM mutations WHERE user_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM user_rev WHERE user_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM files WHERE user_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM friendships WHERE user_id = ?1 OR friend_id = ?1').bind(id),
    c.env.DB.prepare('DELETE FROM friend_requests WHERE from_id = ?1 OR to_id = ?1').bind(id),
    c.env.DB.prepare('DELETE FROM legacy_snapshots WHERE user_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM health_sync WHERE user_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM sync_dedup WHERE user_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id),
  ]);
  await destroySession(c);
  return c.json({ ok: true });
});
