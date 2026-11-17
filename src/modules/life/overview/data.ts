import { useLiveQuery } from 'dexie-react-hooks';
import type { Rec } from '@shared/records';
import { db } from '@/core/db';
import { shiftKey, todayKey, weekStartKey } from '@/core/dates';
import { occurrences } from '@/core/recurrence';
import type { TaskData } from '../tasks/model';
import type { HabitData, HabitLogData } from '../habits/model';
import { indexLogs, isPaused, isScheduled, logDone } from '../habits/model';
import type { EventData } from '@/modules/shared/domain';

/**
 * Dashboard aggregates. Each number is computed from records in IndexedDB using indexed
 * [type+date] range reads — never full datasets, never invented values.
 *
 * Definitions (documented in docs/PRODUCT_SPEC.md › Overview metrics)
 *  - todayProgress = (tasks completed today + habits completed today) / (tasks planned today + habits scheduled today)
 *      tasks planned today = open tasks scheduled/due on or before today + tasks completed today
 *  - studyMinutes = sum of study_session.duration_min whose date is in range
 *  - water = sum of water_log.ml for today; nutrition = sum of meal.calories for today
 *  - sleep = most recent sleep_log (hours) ending today
 *  - habitConsistency(7d) = completed scheduled habit-days / scheduled habit-days (rest days excluded)
 */

export type Range = 'day' | 'week' | 'month';

export function rangeBounds(r: Range, weekStart: 0 | 1 | 6): { from: string; to: string } {
  const t = todayKey();
  if (r === 'day') return { from: t, to: t };
  if (r === 'week') { const s = weekStartKey(t, weekStart); return { from: s, to: shiftKey(s, 6) }; }
  const d = new Date();
  const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return { from, to: `${from.slice(0, 8)}${String(last).padStart(2, '0')}` };
}

async function byRange<T>(type: string, from: string, to: string): Promise<Array<Rec<T>>> {
  return (await db().records.where('[type+date]').between([type, from], [type, `${to}￿`], true, true).filter((r) => !r.deleted_at).toArray()) as unknown as Array<Rec<T>>;
}

export interface DashData {
  today: string;
  tasks: Array<Rec<TaskData>>;
  todayTasks: Array<Rec<TaskData>>;
  doneToday: number;
  overdue: Array<Rec<TaskData>>;
  deadlines: Array<Rec<TaskData>>;
  events: Array<{ rec: Rec<EventData>; date: string }>;
  habits: Array<Rec<HabitData>>;
  habitLogs: Map<string, Map<string, Rec<HabitLogData>>>;
  habitsScheduledToday: number;
  habitsDoneToday: number;
  habitConsistency7: number;
  studyMinutes: number;
  studyByDay: Record<string, number>;
  waterMl: number;
  kcal: number;
  protein: number;
  sleepHours: number | null;
  workoutsInRange: number;
  workoutToday: boolean;
  completedInRange: number;
  spentInRange: number;
  activityByDay: Record<string, number>;
  exams: Array<Rec<{ title: string; date: string; course_id?: string }>>;
}

export function useDashData(range: Range, weekStart: 0 | 1 | 6): DashData | undefined {
  return useLiveQuery(async () => {
    const today = todayKey();
    const { from, to } = rangeBounds(range, weekStart);
    const hFrom = shiftKey(today, -125);

    const allTasks = (await db().records.where('type').equals('task').filter((r) => !r.deleted_at && r.status !== 'archived').toArray()) as unknown as Array<Rec<TaskData>>;
    const tasks = allTasks.filter((t) => t.status !== 'inbox');
    const doneToday = tasks.filter((t) => t.status === 'done' && t.data.completed_at?.slice(0, 10) === today).length
      + tasks.reduce((n, t) => n + (t.data.history ?? []).filter((h) => h.at.slice(0, 10) === today).length, 0);
    const todayTasks = tasks.filter((t) => {
      if (t.status === 'done') return t.data.completed_at?.slice(0, 10) === today;
      const d = t.data.start ?? t.data.due;
      return !!d && d <= today;
    });
    const overdue = tasks.filter((t) => t.status !== 'done' && !!t.data.due && t.data.due < today);
    const deadlines = tasks.filter((t) => t.status !== 'done' && !!t.data.due && t.data.due >= today && t.data.due <= shiftKey(today, 7)).sort((a, b) => a.data.due!.localeCompare(b.data.due!));

    // events in the next 7 days, recurring ones expanded virtually
    const evAll = (await db().records.where('type').equals('event').filter((r) => !r.deleted_at).toArray()) as unknown as Array<Rec<EventData>>;
    const horizon = shiftKey(today, 7);
    const events: DashData['events'] = [];
    for (const e of evAll) {
      if (e.data.recurrence) for (const d of occurrences(e.data.recurrence, e.data.start, today, horizon)) events.push({ rec: e, date: d });
      else if (e.data.start <= horizon && (e.data.end ?? e.data.start) >= today) events.push({ rec: e, date: e.data.start < today ? today : e.data.start });
    }
    events.sort((a, b) => a.date.localeCompare(b.date) || (a.rec.data.start_time ?? '').localeCompare(b.rec.data.start_time ?? ''));

    const habits = ((await db().records.where('type').equals('habit').filter((r) => !r.deleted_at && r.status !== 'archived').toArray()) as unknown as Array<Rec<HabitData>>);
    const logs = await byRange<HabitLogData>('habit_log', hFrom, today);
    const habitLogs = indexLogs(logs);
    let sched = 0;
    let done = 0;
    let s7 = 0;
    let d7 = 0;
    for (const h of habits) {
      const m = habitLogs.get(h.id);
      if (isScheduled(h.data, today) && !isPaused(h.data, today)) { sched++; if (logDone(h.data, m?.get(today))) done++; }
      for (let i = 1; i <= 7; i++) {
        const k = shiftKey(today, -i);
        if (!isScheduled(h.data, k) || isPaused(h.data, k) || (h.data.start && k < h.data.start)) continue;
        s7++;
        if (logDone(h.data, m?.get(k))) d7++;
      }
    }

    const sessions = await byRange<{ duration_min: number }>('study_session', from, to);
    const studyByDay: Record<string, number> = {};
    for (const s of sessions) studyByDay[s.date!.slice(0, 10)] = (studyByDay[s.date!.slice(0, 10)] ?? 0) + (s.data.duration_min ?? 0);

    const water = await byRange<{ ml: number }>('water_log', today, today);
    const meals = await byRange<{ calories: number; protein: number }>('meal', today, today);
    const sleeps = await byRange<{ hours: number }>('sleep_log', shiftKey(today, -1), today);
    const workouts = await byRange<object>('workout', from, to);
    const workoutToday = (await byRange<object>('workout', today, today)).length > 0;
    const txns = await byRange<{ kind: string; amount: number; saving?: boolean }>('txn', from, to);
    const xp = await byRange<{ amount: number }>('xp', hFrom, today);
    const activityByDay: Record<string, number> = {};
    for (const x of xp) if (x.data.amount > 0) activityByDay[x.date!] = (activityByDay[x.date!] ?? 0) + 1;

    const completedInRange = tasks.filter((t) => t.status === 'done' && !!t.data.completed_at && t.data.completed_at.slice(0, 10) >= from && t.data.completed_at.slice(0, 10) <= to).length
      + tasks.reduce((n, t) => n + (t.data.history ?? []).filter((h) => h.at.slice(0, 10) >= from && h.at.slice(0, 10) <= to).length, 0);

    const exams = (await byRange<{ title: string; date: string; course_id?: string }>('exam', today, shiftKey(today, 60))).sort((a, b) => a.date!.localeCompare(b.date!));

    return {
      today, tasks, todayTasks, doneToday, overdue, deadlines, events, habits, habitLogs,
      habitsScheduledToday: sched, habitsDoneToday: done, habitConsistency7: s7 ? d7 / s7 : 0,
      studyMinutes: sessions.reduce((s, x) => s + (x.data.duration_min ?? 0), 0), studyByDay,
      waterMl: water.reduce((s, x) => s + (x.data.ml ?? 0), 0),
      kcal: meals.reduce((s, x) => s + (x.data.calories ?? 0), 0),
      protein: meals.reduce((s, x) => s + (x.data.protein ?? 0), 0),
      sleepHours: sleeps.length ? sleeps.sort((a, b) => b.date!.localeCompare(a.date!))[0].data.hours : null,
      workoutsInRange: workouts.length, workoutToday,
      completedInRange,
      spentInRange: txns.filter((t) => t.data.kind === 'expense' && !t.data.saving).reduce((s, t) => s + t.data.amount, 0),
      activityByDay, exams,
    };
  }, [range, weekStart]);
}
