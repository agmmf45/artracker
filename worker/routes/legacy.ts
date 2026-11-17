import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { requireAuth, lookupSession } from '../lib/session';
import { readJson, nowIso } from '../lib/http';

/**
 * Compatibility layer for browser tabs still running the v4 page during the switch-over.
 * Kept: session check, load/save of the old blob (stored only in users.data, which v5 never reads
 * after migration — use Settings › Data › "re-import" to bring late v4 edits across).
 * Removed: /users (leaked every account) and the blob-based friend endpoints (see /v2/friends).
 */
export const legacy = new Hono<AppEnv>();

legacy.post('/session', async (c) => {
  const s = await lookupSession(c.env, c.req.header('Authorization')?.replace('Bearer ', '') ?? null);
  if (!s) return c.json({ error: 'no session' }, 401);
  return c.json({ user: { id: s.id, email: s.email, name: s.name } });
});

legacy.post('/load', requireAuth, async (c) => {
  const row = await c.env.DB.prepare('SELECT data FROM users WHERE id = ?').bind(c.get('user').id).first<{ data: string }>();
  let data = {};
  try { data = JSON.parse(row?.data || '{}'); } catch { /* empty */ }
  return c.json({ data });
});

legacy.post('/save', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await readJson<{ data?: unknown }>(c, 1_900_000);
  if (!body.data || typeof body.data !== 'object') return c.json({ ok: true });
  await c.env.DB.prepare('UPDATE users SET data = ?, updated_at = ? WHERE id = ?').bind(JSON.stringify(body.data), nowIso(), user.id).run();
  return c.json({ ok: true });
});

legacy.post('/users', requireAuth, (c) => c.json({ users: [] }));
