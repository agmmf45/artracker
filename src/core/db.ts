import Dexie, { type Table } from 'dexie';
import type { Rec } from '@shared/records';

export interface OutboxEntry {
  /** record id — one pending entry per record, newer edits overwrite older ones (coalescing) */
  id: string;
  mid: string;
  ts: number;
}

export interface MetaEntry {
  key: string;
  value: unknown;
}

export class DaqeeqDB extends Dexie {
  records!: Table<Rec, string>;
  outbox!: Table<OutboxEntry, string>;
  meta!: Table<MetaEntry, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      records: 'id, type, [type+date], parent_id, status, updated_at, rev',
      outbox: 'id, ts',
      meta: 'key',
    });
  }
}

let current: DaqeeqDB | null = null;

/** One IndexedDB per account so two people on one device never see each other's data. */
export function openDb(userId: string): DaqeeqDB {
  const name = `daqeeq-${userId}`;
  if (current?.name === name) return current;
  current?.close();
  current = new DaqeeqDB(name);
  return current;
}

/**
 * Opens this account's local database, giving up after `ms` — on phones IndexedDB can hang
 * (e.g. after the tab was killed mid-write) and the app must never wait on it forever.
 */
export async function openDbWithin(userId: string, ms: number): Promise<boolean> {
  const d = openDb(userId);
  if (d.isOpen()) return true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const ok = await Promise.race([
    d.open().then(() => true, () => false),
    new Promise<boolean>((res) => { timer = setTimeout(() => res(false), ms); }),
  ]);
  clearTimeout(timer);
  return ok;
}

/** Closes the open database (so it can be deleted) without deleting it. */
export function closeDb(): void {
  current?.close();
  current = null;
}

export function db(): DaqeeqDB {
  if (!current) throw new Error('database not open');
  return current;
}

export function hasDb(): boolean {
  return !!current;
}

export async function closeAndDeleteDb(): Promise<void> {
  if (!current) return;
  const d = current;
  current = null;
  d.close();
  await Dexie.delete(d.name);
}

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db().meta.get(key);
  return (row?.value as T) ?? fallback;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db().meta.put({ key, value });
}
