import { Hono } from 'hono';
import type { AppEnv, Env } from '../env';
import { requireAuth } from '../lib/session';
import { bad, HttpError, nowIso, readJson } from '../lib/http';
import { rateLimit } from '../lib/ratelimit';

/**
 * Social graph lives in friendships / friend_requests (not inside user blobs), so one user's save
 * can never wipe another user's requests. Friends see only a small public card, never records.
 */
export const friends = new Hono<AppEnv>();
friends.use('*', requireAuth);

const CODE_RE = /^[A-Z0-9]{4,12}$/;

function genCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return [...a].map((b) => alphabet[b % alphabet.length]).join('');
}

export async function ensureFriendCode(env: Env, userId: string): Promise<string> {
  const row = await env.DB.prepare('SELECT friend_code FROM users WHERE id = ?').bind(userId).first<{ friend_code: string | null }>();
  if (row?.friend_code) return row.friend_code;
  for (let i = 0; i < 5; i++) {
    const code = genCode();
    try {
      await env.DB.prepare('UPDATE users SET friend_code = ? WHERE id = ? AND friend_code IS NULL').bind(code, userId).run();
      const again = await env.DB.prepare('SELECT friend_code FROM users WHERE id = ?').bind(userId).first<{ friend_code: string | null }>();
      if (again?.friend_code) return again.friend_code;
    } catch { /* unique collision → retry */ }
  }
  throw new HttpError(500, 'code_failed');
}

/** Public card: what a friend is allowed to see. Built from the profile record + today's habit logs count. */
async function publicCards(env: Env, ids: string[]) {
  if (!ids.length) return [];
  const ph = ids.map(() => '?').join(',');
  const { results: users } = await env.DB.prepare(`SELECT id, name, friend_code, profile_picture FROM users WHERE id IN (${ph})`).bind(...ids)
    .all<{ id: string; name: string | null; friend_code: string | null; profile_picture: string | null }>();
  const { results: profiles } = await env.DB.prepare(
    `SELECT user_id, data FROM records WHERE type = 'profile' AND id = 'profile' AND user_id IN (${ph})`,
  ).bind(...ids).all<{ user_id: string; data: string }>();
  const pmap = new Map<string, Record<string, unknown>>();
  for (const p of profiles ?? []) { try { pmap.set(p.user_id, JSON.parse(p.data)); } catch { /* ignore */ } }
  return (users ?? []).map((u) => {
    const p = pmap.get(u.id) ?? {};
    const share = p.share_progress !== false;
    return {
      code: u.friend_code,
      name: (p.display_name as string) || u.name || 'صديق',
      avatar_emoji: (p.avatar_emoji as string) ?? null,
      avatar_color: (p.avatar_color as string) ?? null,
      avatar_photo: (p.avatar_photo as string) ?? u.profile_picture ?? null,
      status_note: share ? ((p.status_note as string) ?? null) : null,
      level: share ? ((p.level as number) ?? null) : null,
      streak: share ? ((p.best_streak as number) ?? null) : null,
      today: share ? ((p.today as { date: string; pct: number } | undefined) ?? null) : null,
    };
  });
}

friends.get('/', async (c) => {
  const me = c.get('user');
  const code = await ensureFriendCode(c.env, me.id);
  const f = await c.env.DB.prepare('SELECT friend_id FROM friendships WHERE user_id = ?').bind(me.id).all<{ friend_id: string }>();
  const inc = await c.env.DB.prepare('SELECT from_id FROM friend_requests WHERE to_id = ?').bind(me.id).all<{ from_id: string }>();
  const out = await c.env.DB.prepare('SELECT to_id FROM friend_requests WHERE from_id = ?').bind(me.id).all<{ to_id: string }>();
  return c.json({
    code,
    friends: await publicCards(c.env, (f.results ?? []).map((r) => r.friend_id)),
    incoming: await publicCards(c.env, (inc.results ?? []).map((r) => r.from_id)),
    outgoing: await publicCards(c.env, (out.results ?? []).map((r) => r.to_id)),
  });
});

async function idByCode(env: Env, raw: unknown): Promise<string> {
  const code = String(raw ?? '').trim().toUpperCase();
  if (!CODE_RE.test(code)) throw bad('invalid_code', 'الكود غير صحيح');
  const row = await env.DB.prepare('SELECT id FROM users WHERE friend_code = ?').bind(code).first<{ id: string }>();
  if (!row) throw new HttpError(404, 'not_found', 'ما لقينا أحد بهذا الكود');
  return row.id;
}

friends.post('/request', async (c) => {
  const me = c.get('user');
  await rateLimit(c.env, `friendreq:${me.id}`, 20, 3600);
  const target = await idByCode(c.env, (await readJson<{ code?: string }>(c, 1000)).code);
  if (target === me.id) throw bad('self', 'هذا كودك أنت');
  const now = nowIso();
  const reverse = await c.env.DB.prepare('SELECT 1 AS x FROM friend_requests WHERE from_id = ? AND to_id = ?').bind(target, me.id).first();
  if (reverse) {
    await c.env.DB.batch([
      c.env.DB.prepare('INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)').bind(me.id, target, now),
      c.env.DB.prepare('INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)').bind(target, me.id, now),
      c.env.DB.prepare('DELETE FROM friend_requests WHERE (from_id = ?1 AND to_id = ?2) OR (from_id = ?2 AND to_id = ?1)').bind(me.id, target),
    ]);
    return c.json({ ok: true, mutual: true });
  }
  const already = await c.env.DB.prepare('SELECT 1 AS x FROM friendships WHERE user_id = ? AND friend_id = ?').bind(me.id, target).first();
  if (already) return c.json({ ok: true, already: true });
  await c.env.DB.prepare('INSERT OR IGNORE INTO friend_requests (from_id, to_id, created_at) VALUES (?, ?, ?)').bind(me.id, target, now).run();
  return c.json({ ok: true, mutual: false });
});

friends.post('/accept', async (c) => {
  const me = c.get('user');
  const from = await idByCode(c.env, (await readJson<{ code?: string }>(c, 1000)).code);
  // must have a pending request from that user — accepting arbitrary codes is not possible
  const req = await c.env.DB.prepare('SELECT 1 AS x FROM friend_requests WHERE from_id = ? AND to_id = ?').bind(from, me.id).first();
  if (!req) throw new HttpError(404, 'no_request', 'لا يوجد طلب من هذا الشخص');
  const now = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)').bind(me.id, from, now),
    c.env.DB.prepare('INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)').bind(from, me.id, now),
    c.env.DB.prepare('DELETE FROM friend_requests WHERE (from_id = ?1 AND to_id = ?2) OR (from_id = ?2 AND to_id = ?1)').bind(me.id, from),
  ]);
  return c.json({ ok: true });
});

friends.post('/reject', async (c) => {
  const me = c.get('user');
  const from = await idByCode(c.env, (await readJson<{ code?: string }>(c, 1000)).code);
  await c.env.DB.prepare('DELETE FROM friend_requests WHERE from_id = ? AND to_id = ?').bind(from, me.id).run();
  return c.json({ ok: true });
});

friends.post('/cancel', async (c) => {
  const me = c.get('user');
  const to = await idByCode(c.env, (await readJson<{ code?: string }>(c, 1000)).code);
  await c.env.DB.prepare('DELETE FROM friend_requests WHERE from_id = ? AND to_id = ?').bind(me.id, to).run();
  return c.json({ ok: true });
});

friends.post('/remove', async (c) => {
  const me = c.get('user');
  const other = await idByCode(c.env, (await readJson<{ code?: string }>(c, 1000)).code);
  await c.env.DB.prepare('DELETE FROM friendships WHERE (user_id = ?1 AND friend_id = ?2) OR (user_id = ?2 AND friend_id = ?1)').bind(me.id, other).run();
  return c.json({ ok: true });
});
