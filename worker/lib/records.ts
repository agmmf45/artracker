import type { Env } from '../env';
import { APPEND_ONLY_TYPES, dataSize, maxBytesFor, type Rec, type RecordEnvelope, type RecordType } from '../../shared/records';
import { bad } from './http';

interface Row {
  id: string; type: RecordType; data: string; parent_id: string | null; date: string | null; status: string | null;
  private: number; created_at: string; updated_at: string; deleted_at: string | null; rev: number;
}

export function rowToRec(r: Row): Rec {
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(r.data); } catch { /* keep {} */ }
  return { ...r, data, private: r.private ? 1 : 0 };
}

const REC_COLS = 'id, type, data, parent_id, date, status, private, created_at, updated_at, deleted_at, rev';

export async function pullSince(env: Env, userId: string, since: number, limit = 500) {
  const { results } = await env.DB.prepare(
    `SELECT ${REC_COLS} FROM records WHERE user_id = ? AND rev > ? ORDER BY rev ASC LIMIT ?`,
  ).bind(userId, since, limit + 1).all<Row>();
  const rows = results ?? [];
  const more = rows.length > limit;
  const page = more ? rows.slice(0, limit) : rows;
  const cursor = page.length ? page[page.length - 1].rev : since;
  return { records: page.map(rowToRec), cursor, more };
}

export function assertEnvelope(r: RecordEnvelope) {
  if (dataSize(r.data) > maxBytesFor(r.type)) throw bad('record_too_large', `السجل ${r.id} أكبر من الحد المسموح`);
}

/**
 * Upserts records for one user inside a single D1 batch (atomic).
 * - rev is taken from the per-user counter, incremented per record.
 * - Last-writer-wins on updated_at; append-only types are never overwritten.
 * - `mode: 'ignore'` never overwrites anything (used for the legacy import).
 */
export function upsertStatements(env: Env, userId: string, recs: RecordEnvelope[], mode: 'lww' | 'ignore' = 'lww') {
  const stmts: D1PreparedStatement[] = [];
  const bump = env.DB.prepare(
    'INSERT INTO user_rev (user_id, rev) VALUES (?, 1) ON CONFLICT(user_id) DO UPDATE SET rev = rev + 1',
  );
  for (const r of recs) {
    stmts.push(bump.bind(userId));
    const appendOnly = APPEND_ONLY_TYPES.has(r.type) || mode === 'ignore';
    const conflict = appendOnly
      ? 'ON CONFLICT(user_id, id) DO NOTHING'
      : `ON CONFLICT(user_id, id) DO UPDATE SET
           type = excluded.type, data = excluded.data, parent_id = excluded.parent_id, date = excluded.date,
           status = excluded.status, private = excluded.private, updated_at = excluded.updated_at,
           deleted_at = excluded.deleted_at, rev = excluded.rev
         WHERE excluded.updated_at > records.updated_at AND records.type = excluded.type`;
    stmts.push(
      env.DB.prepare(
        `INSERT INTO records (user_id, id, type, data, parent_id, date, status, private, created_at, updated_at, deleted_at, rev)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, (SELECT rev FROM user_rev WHERE user_id = ?1))
         ${conflict}`,
      ).bind(userId, r.id, r.type, JSON.stringify(r.data), r.parent_id, r.date, r.status, r.private, r.created_at, r.updated_at, r.deleted_at),
    );
  }
  return stmts;
}

export async function currentRev(env: Env, userId: string): Promise<number> {
  const row = await env.DB.prepare('SELECT rev FROM user_rev WHERE user_id = ?').bind(userId).first<{ rev: number }>();
  return row?.rev ?? 0;
}

export async function fetchByIds(env: Env, userId: string, ids: string[]): Promise<Rec[]> {
  const out: Rec[] = [];
  for (let i = 0; i < ids.length; i += 90) {
    const chunk = ids.slice(i, i + 90);
    const { results } = await env.DB.prepare(
      `SELECT ${REC_COLS} FROM records WHERE user_id = ? AND id IN (${chunk.map(() => '?').join(',')})`,
    ).bind(userId, ...chunk).all<Row>();
    out.push(...(results ?? []).map(rowToRec));
  }
  return out;
}
