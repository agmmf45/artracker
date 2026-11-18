import type { Rec } from '@shared/records';
import { db } from '@/core/db';
import { create, restore, update } from '@/core/repo';
import type { JournalData } from '@/modules/shared/domain';

/**
 * The notebook's own entry for a day lives in the journal (private by default), one per day with a
 * fixed id, so mood, gratitude and "line of the day" also show in Journal and its mood chart.
 */
export interface DayPageData extends JournalData {
  kind: 'day_page';
  gratitude: string[];
}

export const dayPageId = (day: string) => `day:${day}`;

export function blankDayPage(): DayPageData {
  return { kind: 'day_page', title: 'صفحة اليوم', body: '', time: null, mood: null, energy: null, prompts: {}, gratitude: ['', '', ''] };
}

/** Writes a partial change to the day's entry, creating it on first write. */
export async function patchDayPage(day: string, patch: Partial<DayPageData>): Promise<void> {
  const id = dayPageId(day);
  const cur = (await db().records.get(id)) as Rec<DayPageData> | undefined;
  if (!cur) { await create<DayPageData>('journal', { ...blankDayPage(), ...patch }, { id, date: day }); return; }
  if (cur.deleted_at) await restore(id); // writing to a trashed day page brings it back
  await update<DayPageData>(id, { data: patch });
}

/** Mood/energy shown on the page: the day entry first, else the latest journal entry that has one. */
export function dayMood(entries: Rec<JournalData>[] | undefined, day: string): { mood: number | null; energy: number | null } {
  const xs = (entries ?? []).filter((e) => e.date === day);
  const own = xs.find((e) => e.id === dayPageId(day));
  const latest = (k: 'mood' | 'energy') => [...xs].sort((a, b) => (b.data.time ?? '').localeCompare(a.data.time ?? '')).find((e) => e.data[k] != null)?.data[k] ?? null;
  return { mood: own?.data.mood ?? latest('mood'), energy: own?.data.energy ?? latest('energy') };
}
