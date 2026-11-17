import { useLiveQuery } from 'dexie-react-hooks';
import type { Rec } from '@shared/records';
import { db } from '@/core/db';
import { occurrences } from '@/core/recurrence';
import { fromKey, hm, rangeKeys, daysBetween } from '@/core/dates';
import type { Settings } from '@/core/settings';
import type { EventData } from '@/modules/shared/domain';
import type { TaskData } from '../tasks/model';

/**
 * Calendar aggregation. Nothing is copied: each item points to its source record
 * (event, task, exam, assignment, course schedule, workout, medication). Recurring events and
 * weekly course sessions are expanded only for the visible range.
 */
export type CalKind = 'event' | 'task' | 'deadline' | 'exam' | 'assignment' | 'class' | 'workout' | 'medication';

export interface CalItem {
  key: string;
  recId: string;
  kind: CalKind;
  title: string;
  date: string;
  start: string | null; // HH:MM
  end: string | null;
  allDay: boolean;
  color: string;
  done?: boolean;
  location?: string | null;
  private?: boolean;
}

export const KIND_COLOR: Record<CalKind, string> = {
  event: 'var(--life)',
  task: 'var(--viz-6)',
  deadline: 'var(--warning)',
  exam: 'var(--danger)',
  assignment: 'var(--study)',
  class: 'var(--study)',
  workout: 'var(--health)',
  medication: 'var(--health)',
};

interface CourseSession { day: number; start: string; end: string; kind?: 'lecture' | 'lab' | 'clinical'; room?: string }
interface CourseData { name: string; code?: string; color?: string; schedule?: CourseSession[]; semester_id?: string | null; start?: string | null; end?: string | null; archived?: boolean }

export function useCalendarItems(from: string, to: string, settings: Settings): CalItem[] | undefined {
  return useLiveQuery(async () => {
    const out: CalItem[] = [];
    const days = rangeKeys(from, daysBetween(from, to) + 1);
    const types = ['event', 'task', 'exam', 'assignment', 'course', 'workout', 'medication', 'semester'];
    const recs = await db().records.where('type').anyOf(types).filter((r) => !r.deleted_at).toArray();

    const semesters = new Map(recs.filter((r) => r.type === 'semester').map((r) => [r.id, r.data as { start?: string; end?: string }]));

    for (const r of recs) {
      if (r.type === 'event') {
        const e = r.data as unknown as EventData;
        const dates = e.recurrence ? occurrences(e.recurrence, e.start, from, to) : multiDay(e.start, e.end ?? e.start, from, to);
        for (const d of dates) {
          out.push({ key: `${r.id}:${d}`, recId: r.id, kind: e.kind === 'exam' ? 'exam' : 'event', title: e.title, date: d, start: e.all_day ? null : e.start_time, end: e.all_day ? null : e.end_time, allDay: e.all_day || !e.start_time, color: e.color ?? KIND_COLOR.event, location: e.location });
        }
      } else if (r.type === 'task' && settings.calendar.showTasks && r.status !== 'archived') {
        const t = r.data as unknown as TaskData;
        const done = r.status === 'done';
        if (t.start && t.start >= from && t.start <= to) {
          const end = t.start_time && (t.duration_min || t.estimate_min) ? addMin(t.start_time, t.duration_min ?? t.estimate_min ?? 30) : null;
          out.push({ key: `${r.id}:s`, recId: r.id, kind: 'task', title: t.title, date: t.start, start: t.start_time, end, allDay: !t.start_time, color: KIND_COLOR.task, done });
        }
        if (t.due && t.due >= from && t.due <= to && t.due !== t.start) {
          out.push({ key: `${r.id}:d`, recId: r.id, kind: 'deadline', title: t.title, date: t.due, start: t.due_time, end: null, allDay: !t.due_time, color: KIND_COLOR.deadline, done });
        }
      } else if (r.type === 'exam' && r.date && r.date >= from && r.date <= to) {
        const x = r.data as { title: string; time?: string | null; duration_min?: number | null; location?: string | null };
        out.push({ key: r.id, recId: r.id, kind: 'exam', title: x.title, date: r.date.slice(0, 10), start: x.time ?? null, end: x.time && x.duration_min ? addMin(x.time, x.duration_min) : null, allDay: !x.time, color: KIND_COLOR.exam, location: x.location });
      } else if (r.type === 'assignment' && r.date && r.date >= from && r.date <= to) {
        const x = r.data as { title: string; due_time?: string | null };
        out.push({ key: r.id, recId: r.id, kind: 'assignment', title: x.title, date: r.date.slice(0, 10), start: x.due_time ?? null, end: null, allDay: !x.due_time, color: KIND_COLOR.assignment, done: r.status === 'done' });
      } else if (r.type === 'course') {
        const c = r.data as unknown as CourseData;
        if (c.archived || !c.schedule?.length) continue;
        const sem = c.semester_id ? semesters.get(c.semester_id) : undefined;
        const s0 = c.start ?? sem?.start ?? null;
        const s1 = c.end ?? sem?.end ?? null;
        for (const d of days) {
          if ((s0 && d < s0) || (s1 && d > s1)) continue;
          const wd = fromKey(d).getDay();
          for (const [i, s] of c.schedule.entries()) {
            if (s.day !== wd) continue;
            out.push({ key: `${r.id}:${d}:${i}`, recId: r.id, kind: 'class', title: `${c.code ? `${c.code} · ` : ''}${c.name}${s.kind && s.kind !== 'lecture' ? ` (${s.kind === 'lab' ? 'معمل' : 'سريري'})` : ''}`, date: d, start: s.start, end: s.end, allDay: false, color: c.color ?? KIND_COLOR.class, location: s.room ?? null });
          }
        }
      } else if (r.type === 'workout' && settings.calendar.showHealth && !settings.privacy.hideHealthInCalendar && r.date && r.date >= from && r.date <= to) {
        const w = r.data as { name: string; started_at?: string; duration_min?: number };
        const st = w.started_at ? new Date(w.started_at) : null;
        const start = st ? `${String(st.getHours()).padStart(2, '0')}:${String(st.getMinutes()).padStart(2, '0')}` : null;
        out.push({ key: r.id, recId: r.id, kind: 'workout', title: w.name, date: r.date.slice(0, 10), start, end: start && w.duration_min ? addMin(start, w.duration_min) : null, allDay: !start, color: KIND_COLOR.workout, private: true });
      } else if (r.type === 'medication' && settings.calendar.showHealth && !settings.privacy.hideHealthInCalendar && r.status !== 'stopped') {
        const m = r.data as { name: string; times?: string[] };
        for (const d of days) for (const t of m.times ?? []) out.push({ key: `${r.id}:${d}:${t}`, recId: r.id, kind: 'medication', title: m.name, date: d, start: t, end: null, allDay: false, color: KIND_COLOR.medication, private: true });
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date) || Number(b.allDay) - Number(a.allDay) || (a.start ?? '').localeCompare(b.start ?? ''));
  }, [from, to, settings.calendar.showTasks, settings.calendar.showHealth, settings.privacy.hideHealthInCalendar]);
}

function multiDay(start: string, end: string, from: string, to: string): string[] {
  if (end < from || start > to) return [];
  const s = start < from ? from : start;
  const e = end > to ? to : end;
  return rangeKeys(s, daysBetween(s, e) + 1);
}

export function addMin(time: string, min: number): string {
  const t = Math.min(24 * 60 - 1, (hm(time) ?? 0) + min);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** Overlapping timed items on the same day (conflict detection). */
export function conflicts(items: CalItem[]): Set<string> {
  const bad = new Set<string>();
  const timed = items.filter((i) => !i.allDay && i.start && !i.done && i.kind !== 'deadline' && i.kind !== 'medication');
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i];
      const b = timed[j];
      if (a.date !== b.date) continue;
      const as = hm(a.start)!;
      const ae = hm(a.end) ?? as + 30;
      const bs = hm(b.start)!;
      const be = hm(b.end) ?? bs + 30;
      if (as < be && bs < ae) { bad.add(a.key); bad.add(b.key); }
    }
  }
  return bad;
}

export type { Rec };
