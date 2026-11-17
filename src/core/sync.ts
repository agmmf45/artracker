import { useSyncExternalStore } from 'react';
import type { PullResponse, PushResponse, Rec } from '@shared/records';
import { api, ApiError } from './api';
import { db, getMeta, hasDb, setMeta } from './db';

/**
 * Sync engine (local-first).
 *  pull: GET /v2/sync/pull?since=<cursor> until `more` is false. A remote record replaces the local one
 *        unless the local copy has an un-pushed edit that is newer (updated_at).
 *  push: sends up to 100 outbox entries using the *current* local record (edits coalesce). Acked entries
 *        are dropped only if no newer edit replaced them meanwhile. Server conflicts overwrite local.
 * Runs on start, after local writes (debounced), on reconnect, on tab focus, and every 60 s.
 */

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error' | 'signed-out';
interface Status { state: SyncState; lastSync: number | null; pending: number; error: string | null }

let status: Status = { state: 'idle', lastSync: null, pending: 0, error: null };
const listeners = new Set<() => void>();
function setStatus(p: Partial<Status>) {
  status = { ...status, ...p };
  listeners.forEach((l) => l());
}
export function useSyncStatus(): Status {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => status);
}

let running: Promise<void> | null = null;
let again = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let onAuthLost: (() => void) | null = null;

export function setAuthLostHandler(fn: () => void) {
  onAuthLost = fn;
}

export function scheduleSync(delay = 700) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { void syncNow(); }, delay);
}

async function applyRemote(records: Rec[]) {
  const d = db();
  await d.transaction('rw', d.records, d.outbox, async () => {
    for (const r of records) {
      const pending = await d.outbox.get(r.id);
      if (pending) {
        const local = await d.records.get(r.id);
        if (local && local.updated_at > r.updated_at) continue; // our newer edit will be pushed
        await d.outbox.delete(r.id);
      }
      await d.records.put(r);
    }
  });
}

async function pull() {
  let cursor = await getMeta<number>('cursor', 0);
  for (let i = 0; i < 200; i++) {
    const res = await api<PullResponse>(`/v2/sync/pull?since=${cursor}&limit=500`);
    if (res.records.length) await applyRemote(res.records);
    cursor = res.cursor;
    await setMeta('cursor', cursor);
    if (!res.more) break;
  }
}

async function push() {
  const d = db();
  for (let round = 0; round < 50; round++) {
    const batch = await d.outbox.orderBy('ts').limit(100).toArray();
    if (!batch.length) break;
    const mutations = [];
    for (const e of batch) {
      const rec = await d.records.get(e.id);
      if (!rec) { await d.outbox.delete(e.id); continue; }
      const { rev: _rev, ...env } = rec;
      mutations.push({ mid: e.mid, record: env });
    }
    if (!mutations.length) continue;
    const res = await api<PushResponse>('/v2/sync/push', { mutations });
    const acked = new Set(res.acked);
    await d.transaction('rw', d.records, d.outbox, async () => {
      for (const e of batch) {
        const cur = await d.outbox.get(e.id);
        if (cur && cur.mid === e.mid && acked.has(e.mid)) await d.outbox.delete(e.id);
      }
      for (const c of res.conflicts) {
        await d.records.put(c);
        await d.outbox.delete(c.id);
      }
    });
  }
}

export async function syncNow(): Promise<void> {
  if (!hasDb()) return;
  if (running) { again = true; return running; }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setStatus({ state: 'offline', pending: await db().outbox.count() });
    return;
  }
  running = (async () => {
    setStatus({ state: 'syncing', error: null });
    try {
      await pull();
      await push();
      setStatus({ state: 'idle', lastSync: Date.now(), pending: await db().outbox.count(), error: null });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setStatus({ state: 'signed-out' });
        onAuthLost?.();
      } else if (e instanceof ApiError && e.status === 0) {
        setStatus({ state: 'offline', pending: hasDb() ? await db().outbox.count() : 0 });
      } else {
        setStatus({ state: 'error', error: e instanceof Error ? e.message : String(e) });
      }
    } finally {
      running = null;
      if (again) { again = false; scheduleSync(300); }
    }
  })();
  return running;
}

let started = false;
export function startSyncLoop() {
  if (started) return;
  started = true;
  window.addEventListener('online', () => scheduleSync(100));
  window.addEventListener('offline', () => setStatus({ state: 'offline' }));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') scheduleSync(200); });
  setInterval(() => { if (document.visibilityState === 'visible') void syncNow(); }, 60_000);
}

export function resetSyncStatus() {
  setStatus({ state: 'idle', lastSync: null, pending: 0, error: null });
}
