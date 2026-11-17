import { APPEND_ONLY_TYPES, PRIVATE_TYPES, dataSize, maxBytesFor, type Rec, type RecordType } from '@shared/records';
import { db } from './db';
import { newId, newMid } from './ids';
import { scheduleSync } from './sync';

/**
 * The only write path for user data. Every write goes to IndexedDB and the outbox in one
 * transaction, then sync pushes it. Screens never talk to the network directly.
 */

export interface CreateOpts {
  id?: string;
  parent_id?: string | null;
  date?: string | null;
  status?: string | null;
  private?: boolean;
}

function stamp(): string {
  return new Date().toISOString();
}

function assertSize(type: RecordType, data: unknown) {
  if (dataSize(data) > maxBytesFor(type)) throw new Error('المحتوى أكبر من الحد المسموح');
}

async function write(rec: Rec): Promise<void> {
  const d = db();
  await d.transaction('rw', d.records, d.outbox, async () => {
    await d.records.put(rec);
    await d.outbox.put({ id: rec.id, mid: newMid(), ts: Date.now() });
  });
  scheduleSync();
}

export async function create<T extends object>(type: RecordType, data: T, opts: CreateOpts = {}): Promise<Rec<T>> {
  assertSize(type, data);
  const now = stamp();
  const id = opts.id ?? newId();
  if (opts.id) {
    const existing = await db().records.get(id);
    if (existing && APPEND_ONLY_TYPES.has(type)) return existing as unknown as Rec<T>;
  }
  const rec: Rec<T> = {
    id,
    type,
    data,
    parent_id: opts.parent_id ?? null,
    date: opts.date ?? null,
    status: opts.status ?? null,
    private: (opts.private ?? PRIVATE_TYPES.has(type)) ? 1 : 0,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    rev: 0,
  };
  await write(rec as unknown as Rec);
  return rec;
}

export interface Patch<T> {
  data?: Partial<T>;
  parent_id?: string | null;
  date?: string | null;
  status?: string | null;
  private?: boolean;
}

/** Shallow-merges `patch.data` into the record. Returns the previous version (for undo). */
export async function update<T extends object>(id: string, patch: Patch<T>): Promise<Rec<T> | undefined> {
  const prev = (await db().records.get(id)) as Rec<T> | undefined;
  if (!prev) return undefined;
  if (APPEND_ONLY_TYPES.has(prev.type)) throw new Error('append-only record');
  const data = patch.data ? { ...prev.data, ...patch.data } : prev.data;
  assertSize(prev.type, data);
  const next: Rec<T> = {
    ...prev,
    data,
    parent_id: patch.parent_id !== undefined ? patch.parent_id : prev.parent_id,
    date: patch.date !== undefined ? patch.date : prev.date,
    status: patch.status !== undefined ? patch.status : prev.status,
    private: patch.private !== undefined ? (patch.private ? 1 : 0) : prev.private,
    updated_at: stamp(),
  };
  await write(next as unknown as Rec);
  return prev;
}

/** Upsert for singletons (settings, profile, layout). */
export async function upsert<T extends object>(type: RecordType, id: string, data: Partial<T>): Promise<void> {
  const prev = await db().records.get(id);
  if (prev) await update<T>(id, { data });
  else await create(type, data as T, { id });
}

/** Soft delete (moves to trash). Returns the previous version for undo. */
export async function remove(id: string): Promise<Rec | undefined> {
  const prev = await db().records.get(id);
  if (!prev || APPEND_ONLY_TYPES.has(prev.type)) return prev;
  await write({ ...prev, deleted_at: stamp(), updated_at: stamp() });
  return prev;
}

export async function restore(id: string): Promise<void> {
  const prev = await db().records.get(id);
  if (!prev) return;
  await write({ ...prev, deleted_at: null, updated_at: stamp() });
}

/** Permanent delete: content is wiped, a tombstone remains so other devices learn about it. */
export async function purge(id: string): Promise<void> {
  const prev = await db().records.get(id);
  if (!prev || APPEND_ONLY_TYPES.has(prev.type)) return;
  await write({ ...prev, data: {}, status: 'purged', deleted_at: prev.deleted_at ?? stamp(), updated_at: stamp() });
}

/** Writes back an earlier snapshot (used by undo). */
export async function revertTo(snapshot: Rec): Promise<void> {
  await write({ ...snapshot, updated_at: stamp() });
}

export async function bulk(fn: () => Promise<void>): Promise<void> {
  const d = db();
  await d.transaction('rw', d.records, d.outbox, fn);
}
