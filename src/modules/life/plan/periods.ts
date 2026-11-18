import type { Rec } from '@shared/records';
import { db } from '@/core/db';
import { create, restore, update } from '@/core/repo';
import { shiftKey, todayKey, weekStartKey } from '@/core/dates';

/**
 * The Week and Month pages keep their own notes in the same review records the Reviews page uses
 * (`review:weekly:<week start>`, `review:monthly:<YYYY-MM>`), so a weekly review written on the
 * Week page is the same one shown in Reviews — nothing is stored twice.
 */
export interface WeekBig3 { id: string; title: string; goal_id: string | null; done: boolean }

interface PeriodBase { period: string; answers: Record<string, string>; mood: number | null; energy: number | null; completed: boolean }
export interface WeekPageData extends PeriodBase { kind: 'weekly'; theme?: string; big3?: WeekBig3[]; meals?: string[] }
export interface MonthPageData extends PeriodBase { kind: 'monthly'; focus?: string; goal_ids?: string[]; future?: string }

export const weekPageId = (weekStart: string) => `review:weekly:${weekStart}`;
export const monthPageId = (month: string) => `review:monthly:${month}`;

export function monthBounds(month: string): { from: string; to: string; days: number } {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(days).padStart(2, '0')}`, days };
}

export const shiftMonth = (month: string, n: number): string => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

async function patchReview<T extends PeriodBase & { kind: string }>(id: string, blank: T, lastDay: string, patch: Partial<T>): Promise<void> {
  const cur = (await db().records.get(id)) as Rec<T> | undefined;
  if (!cur) { const t = todayKey(); await create<T>('review', { ...blank, ...patch }, { id, date: lastDay > t ? t : lastDay }); return; }
  if (cur.deleted_at) await restore(id);
  await update<T>(id, { data: patch });
}

export function patchWeekPage(weekStart: string, patch: Partial<WeekPageData>) {
  return patchReview<WeekPageData>(weekPageId(weekStart), { kind: 'weekly', period: weekStart, answers: {}, mood: null, energy: null, completed: false }, shiftKey(weekStart, 6), patch);
}

export function patchMonthPage(month: string, patch: Partial<MonthPageData>) {
  return patchReview<MonthPageData>(monthPageId(month), { kind: 'monthly', period: month, answers: {}, mood: null, energy: null, completed: false }, monthBounds(month).to, patch);
}

export const weekOf = (day: string, weekStart: 0 | 1 | 6) => weekStartKey(day, weekStart);
