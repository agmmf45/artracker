import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { APPEND_ONLY_TYPES, pushBodySchema, type PushResponse, type RecordEnvelope } from '../../shared/records';
import { migrateLegacyBlob } from '../../shared/legacy/migrate';
import { requireAuth } from '../lib/session';
import { bad, nowIso, readJson } from '../lib/http';
import { assertEnvelope, currentRev, fetchByIds, pullSince, upsertStatements } from '../lib/records';
import { rateLimit } from '../lib/ratelimit';

export const sync = new Hono<AppEnv>();
sync.use('*', requireAuth);

sync.get('/pull', async (c) => {
  const since = Math.max(0, Number(c.req.query('since') ?? 0) || 0);
  const limit = Math.min(1000, Math.max(1, Number(c.req.query('limit') ?? 500) || 500));
  return c.json(await pullSince(c.env, c.get('user').id, since, limit));
});

sync.post('/push', async (c) => {
  const user = c.get('user');
  await rateLimit(c.env, `push:${user.id}`, 600, 60);
  const parsed = pushBodySchema.safeParse(await readJson(c, 6_000_000));
  if (!parsed.success) throw bad('invalid_push', parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  const muts = parsed.data.mutations;
  if (!muts.length) return c.json({ acked: [], conflicts: [], cursor: await currentRev(c.env, user.id) } satisfies PushResponse);

  // idempotency: skip mutation ids already applied
  const mids = muts.map((m) => m.mid);
  const { results: seen } = await c.env.DB.prepare(
    `SELECT mutation_id FROM mutations WHERE user_id = ? AND mutation_id IN (${mids.map(() => '?').join(',')})`,
  ).bind(user.id, ...mids).all<{ mutation_id: string }>();
  const already = new Set((seen ?? []).map((r) => r.mutation_id));
  const fresh = muts.filter((m) => !already.has(m.mid));

  // when the same record appears twice in one push, keep only the newest version
  const latest = new Map<string, RecordEnvelope>();
  for (const m of fresh) {
    assertEnvelope(m.record);
    const prev = latest.get(m.record.id);
    if (!prev || prev.updated_at <= m.record.updated_at) latest.set(m.record.id, m.record);
  }
  const recs = [...latest.values()];
  if (recs.length) {
    const now = nowIso();
    const stmts = upsertStatements(c.env, user.id, recs);
    const mark = c.env.DB.prepare('INSERT OR IGNORE INTO mutations (user_id, mutation_id, applied_at) VALUES (?, ?, ?)');
    for (const m of fresh) stmts.push(mark.bind(user.id, m.mid, now));
    await c.env.DB.batch(stmts);
  }

  // report records where the server kept a newer (or different-type) version
  const stored = await fetchByIds(c.env, user.id, recs.map((r) => r.id));
  const conflicts = stored.filter((s) => {
    const mine = latest.get(s.id)!;
    return (
      s.updated_at !== mine.updated_at ||
      s.type !== mine.type ||
      (APPEND_ONLY_TYPES.has(s.type) && JSON.stringify(s.data) !== JSON.stringify(mine.data))
    );
  });
  return c.json({ acked: mids, conflicts, cursor: await currentRev(c.env, user.id) } satisfies PushResponse);
});

/**
 * One-time conversion of the v4 blob into records. Safe to call repeatedly:
 * ids are deterministic and inserts never overwrite (mode 'ignore').
 */
sync.post('/migrate', async (c) => {
  const user = c.get('user');
  await rateLimit(c.env, `migrate:${user.id}`, 10, 3600);
  const row = await c.env.DB.prepare('SELECT data, migrated_at FROM users WHERE id = ?').bind(user.id)
    .first<{ data: string | null; migrated_at: string | null }>();
  let blob: Record<string, unknown> = {};
  try { blob = JSON.parse(row?.data || '{}'); } catch { /* corrupt blob → nothing to import */ }
  const now = nowIso();

  if (Object.keys(blob).length) {
    await c.env.DB.prepare('INSERT OR IGNORE INTO legacy_snapshots (user_id, data, created_at) VALUES (?, ?, ?)')
      .bind(user.id, row?.data ?? '{}', now).run();
  }
  const result = migrateLegacyBlob(blob, now);
  const envelopes: RecordEnvelope[] = [
    ...result.records,
    { id: 'profile', type: 'profile', data: result.profile, parent_id: null, date: null, status: null, private: 0, created_at: now, updated_at: now, deleted_at: null },
    { id: 'settings', type: 'settings', data: result.settings, parent_id: null, date: null, status: null, private: 0, created_at: now, updated_at: now, deleted_at: null },
  ];
  for (let i = 0; i < envelopes.length; i += 40) {
    await c.env.DB.batch(upsertStatements(c.env, user.id, envelopes.slice(i, i + 40), 'ignore'));
  }
  await c.env.DB.prepare('UPDATE users SET migrated_at = COALESCE(migrated_at, ?) WHERE id = ?').bind(now, user.id).run();
  return c.json({ ok: true, counts: result.counts, skipped: result.skipped, total: result.records.length });
});
