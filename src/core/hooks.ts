import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import type { Rec, RecordType } from '@shared/records';
import { db } from './db';
import { DEFAULT_SETTINGS, deepMerge, type Settings } from './settings';
import { upsert } from './repo';

/** Live list of non-deleted records of a type (re-renders on any local or synced change). */
export function useRecords<T = Record<string, any>>(type: RecordType, deps: unknown[] = []): Rec<T>[] | undefined {
  return useLiveQuery(
    () => db().records.where('type').equals(type).filter((r) => !r.deleted_at).toArray() as unknown as Promise<Rec<T>[]>,
    [type, ...deps],
  );
}

/** Records of a type whose `date` is within [from, to] (inclusive, string compare on YYYY-MM-DD or ISO). */
export function useRecordsInRange<T = Record<string, any>>(type: RecordType, from: string, to: string): Rec<T>[] | undefined {
  return useLiveQuery(
    () => db().records.where('[type+date]').between([type, from], [type, `${to}￿`], true, true)
      .filter((r) => !r.deleted_at).toArray() as unknown as Promise<Rec<T>[]>,
    [type, from, to],
  );
}

export function useRecord<T = Record<string, any>>(id: string | null | undefined): Rec<T> | undefined | null {
  return useLiveQuery(async () => (id ? ((await db().records.get(id)) as unknown as Rec<T>) ?? null : null), [id]);
}

export function useChildren<T = Record<string, any>>(parentId: string | null | undefined, type?: RecordType): Rec<T>[] | undefined {
  return useLiveQuery(
    () => (parentId
      ? db().records.where('parent_id').equals(parentId).filter((r) => !r.deleted_at && (!type || r.type === type)).toArray()
      : Promise.resolve([])) as unknown as Promise<Rec<T>[]>,
    [parentId, type],
  );
}

export function useTrash(): Rec[] | undefined {
  return useLiveQuery(() => db().records.filter((r) => !!r.deleted_at && r.status !== 'purged' && r.type !== 'xp').toArray(), []);
}

export function useSettings(): Settings {
  const rec = useLiveQuery(() => db().records.get('settings'), []);
  return deepMerge(DEFAULT_SETTINGS, rec?.data ?? {});
}

export function updateSettings(patch: Partial<Settings> | Record<string, unknown>) {
  return db().records.get('settings').then((cur) => {
    const merged = deepMerge((cur?.data ?? {}) as Record<string, unknown>, patch);
    return upsert('settings', 'settings', merged);
  });
}

export interface Profile {
  display_name: string | null;
  avatar_emoji: string | null;
  avatar_color: string | null;
  avatar_photo: string | null;
  status_note: string | null;
  share_progress?: boolean;
  level?: number;
  best_streak?: number;
}

export function useProfile(): Profile {
  const rec = useLiveQuery(() => db().records.get('profile'), []);
  return { display_name: null, avatar_emoji: '😊', avatar_color: null, avatar_photo: null, status_note: null, ...(rec?.data ?? {}) } as Profile;
}

/** Re-render every `ms` (for clocks and "now" lines). */
export function useNow(ms = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function useMedia(query: string): boolean {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return m;
}
