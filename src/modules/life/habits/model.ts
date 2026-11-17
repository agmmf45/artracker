import type { Rec } from '@shared/records';
import { create, update, remove, revertTo } from '@/core/repo';
import { grantXp, revokeXp } from '@/core/xp';
import { fromKey, shiftKey, todayKey, weekStartKey } from '@/core/dates';
import { undoToast } from '@/core/toast';
import type { Settings } from '@/core/settings';

export type HabitKind = 'check' | 'number' | 'time';

export interface HabitSchedule {
  type: 'daily' | 'weekdays' | 'weekly_count' | 'interval';
  /** for weekdays: 0..6 */
  days?: number[];
  /** for weekly_count: times per week */
  count?: number;
  /** for interval: every N days from start */
  every?: number;
}

export interface HabitData {
  name: string;
  icon: string;
  kind: HabitKind;
  target: number;
  unit: string | null;
  schedule: HabitSchedule;
  subtasks: Array<{ id: string; name: string }>;
  order: number;
  category: string | null;
  area?: string | null;
  start?: string | null;
  reminder?: string | null;
  /** dates the user marked as rest (never counted as a miss) */
  rest_days?: string[];
  paused_from?: string | null;
  paused_until?: string | null;
  color?: string | null;
  goal_id?: string | null;
}

export interface HabitLogData {
  habit_id: string;
  value: number;
  subtasks: Record<string, boolean>;
  note: string | null;
}

export type Habit = Rec<HabitData>;
export type HabitLog = Rec<HabitLogData>;

export function isScheduled(h: HabitData, key: string): boolean {
  if (h.start && key < h.start) return false;
  const s = h.schedule ?? { type: 'daily' };
  if (s.type === 'weekdays') return (s.days ?? []).includes(fromKey(key).getDay());
  if (s.type === 'interval') {
    const start = h.start ?? key;
    const diff = Math.round((fromKey(key).getTime() - fromKey(start).getTime()) / 864e5);
    return diff >= 0 && diff % Math.max(1, s.every ?? 1) === 0;
  }
  return true; // daily & weekly_count are available every day
}

export function isPaused(h: HabitData, key: string): boolean {
  if (h.rest_days?.includes(key)) return true;
  if (h.paused_from && key >= h.paused_from && (!h.paused_until || key <= h.paused_until)) return true;
  return false;
}

export function logDone(h: HabitData, log: HabitLog | undefined): boolean {
  if (!log) return false;
  return log.data.value >= (h.kind === 'check' ? 1 : Math.max(1, h.target || 1));
}

/** Map habitId → date → log, for quick lookups. */
export function indexLogs(logs: HabitLog[] | undefined): Map<string, Map<string, HabitLog>> {
  const m = new Map<string, Map<string, HabitLog>>();
  for (const l of logs ?? []) {
    const hid = l.data.habit_id ?? l.parent_id ?? '';
    if (!m.has(hid)) m.set(hid, new Map());
    if (l.date) m.get(hid)!.set(l.date.slice(0, 10), l);
  }
  return m;
}

/**
 * Current streak in scheduled days. Rest/paused/unscheduled days are skipped (never break the streak).
 * Today counts only once done, so an unfinished today doesn't reset yesterday's streak.
 * weekly_count habits count consecutive weeks that met the target.
 */
export function streak(h: HabitData, logs: Map<string, HabitLog> | undefined, today = todayKey(), weekStart: 0 | 1 | 6 = 6): number {
  if (h.schedule?.type === 'weekly_count') {
    let n = 0;
    let wk = weekStartKey(today, weekStart);
    const target = Math.max(1, h.schedule.count ?? 1);
    for (let i = 0; i < 260; i++) {
      let c = 0;
      for (let d = 0; d < 7; d++) if (logDone(h, logs?.get(shiftKey(wk, d)))) c++;
      if (c >= target) n++;
      else if (i > 0) break;
      wk = shiftKey(wk, -7);
    }
    return n;
  }
  let n = 0;
  let k = today;
  for (let i = 0; i < 3660; i++) {
    if (h.start && k < h.start) break;
    if (!isScheduled(h, k) || isPaused(h, k)) { k = shiftKey(k, -1); continue; }
    if (logDone(h, logs?.get(k))) n++;
    else if (k !== today) break;
    k = shiftKey(k, -1);
  }
  return n;
}

export function bestStreak(h: HabitData, logs: Map<string, HabitLog> | undefined, today = todayKey()): number {
  if (!logs?.size) return 0;
  const first = [...logs.keys()].sort()[0];
  let best = 0;
  let cur = 0;
  for (let k = first; k <= today; k = shiftKey(k, 1)) {
    if (!isScheduled(h, k) || isPaused(h, k)) continue;
    if (logDone(h, logs.get(k))) { cur++; best = Math.max(best, cur); }
    else if (k !== today) cur = 0;
  }
  return best;
}

/** Share of scheduled (non-rest) days completed over the last `days` days. */
export function consistency(h: HabitData, logs: Map<string, HabitLog> | undefined, days = 30, today = todayKey()): number {
  let sched = 0;
  let done = 0;
  for (let i = 0; i < days; i++) {
    const k = shiftKey(today, -i);
    if (h.start && k < h.start) break;
    if (!isScheduled(h, k) || isPaused(h, k)) continue;
    if (k === today && !logDone(h, logs?.get(k))) continue;
    sched++;
    if (logDone(h, logs?.get(k))) done++;
  }
  return sched ? done / sched : 0;
}

export async function setHabitValue(h: Habit, key: string, value: number, existing: HabitLog | undefined, settings: Settings) {
  const wasDone = logDone(h.data, existing);
  let prev: Rec | undefined;
  if (existing) {
    prev = (await update<HabitLogData>(existing.id, { data: { value }, status: value ? 'done' : 'partial' })) as unknown as Rec;
  } else {
    await create<HabitLogData>('habit_log', { habit_id: h.id, value, subtasks: {}, note: null }, { id: `hl:${h.id}:${key}`, parent_id: h.id, date: key, status: 'done' });
  }
  const nowDone = value >= (h.data.kind === 'check' ? 1 : Math.max(1, h.data.target || 1));
  const base = `habit:${h.id}:${key}`;
  if (nowDone && !wasDone) await grantXp(base, 'habit', settings, h.data.name);
  if (!nowDone && wasDone) await revokeXp(base);
  return prev;
}

export async function toggleHabit(h: Habit, key: string, existing: HabitLog | undefined, settings: Settings) {
  const done = logDone(h.data, existing);
  await setHabitValue(h, key, done ? 0 : (h.data.kind === 'check' ? 1 : Math.max(1, h.data.target)), existing, settings);
}

export async function toggleHabitSub(h: Habit, key: string, subId: string, existing: HabitLog | undefined, settings: Settings) {
  const subs = { ...(existing?.data.subtasks ?? {}), [subId]: !existing?.data.subtasks?.[subId] };
  const all = h.data.subtasks.length > 0 && h.data.subtasks.every((s) => subs[s.id]);
  if (existing) {
    await update<HabitLogData>(existing.id, { data: { subtasks: subs } });
  } else {
    await create<HabitLogData>('habit_log', { habit_id: h.id, value: 0, subtasks: subs, note: null }, { id: `hl:${h.id}:${key}`, parent_id: h.id, date: key, status: 'partial' });
  }
  if (all && !logDone(h.data, existing)) {
    const fresh = existing ? { ...existing, data: { ...existing.data, subtasks: subs } } : undefined;
    await setHabitValue(h, key, h.data.kind === 'check' ? 1 : h.data.target, fresh as HabitLog | undefined, settings);
  }
}

export async function deleteHabit(h: Habit) {
  const prev = await remove(h.id);
  undoToast(`حُذفت العادة «${h.data.name}»`, async () => { if (prev) await revertTo(prev); });
}

export function blankHabit(partial: Partial<HabitData> = {}): HabitData {
  return { name: '', icon: '✅', kind: 'check', target: 1, unit: null, schedule: { type: 'daily' }, subtasks: [], order: Date.now(), category: null, start: todayKey(), ...partial };
}
