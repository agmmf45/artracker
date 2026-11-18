import type { CaptureKind, Parsed } from '@/core/capture/parse';
import { create } from '@/core/repo';
import { todayKey } from '@/core/dates';
import type { Settings } from '@/core/settings';
import { createTask } from '@/modules/life/tasks/model';
import { addMin } from '@/modules/life/calendar/sources';
import { addTxn, blankEvent, blankNote, logWater, type CaptureData, type EventData, type JournalData, type NoteData } from './domain';

/**
 * One write path for anything typed into a capture box (the global Quick Capture sheet and the
 * notebook's rapid log). `day` is the page's day: a line with no date of its own lands on it.
 * Returns the [ar, en] confirmation text, or throws with a user-facing message.
 */
export async function saveCapture(kind: CaptureKind, raw: string, parsed: Parsed, settings: Settings, day: string | null = null): Promise<[string, string]> {
  const title = parsed.title || raw;
  /** null = unscheduled (the global sheet keeps undated tasks undated) */
  const date = parsed.date ?? day;
  const onDay = date ?? todayKey();
  switch (kind) {
    case 'task':
      await createTask({
        title, priority: parsed.priority ?? settings.tasks.defaultPriority, tags: parsed.tags, category: parsed.category,
        start: date, start_time: parsed.time, duration_min: parsed.duration_min, estimate_min: parsed.duration_min, capture_text: raw, source: 'capture',
      });
      return ['أُضيفت المهمة', 'Task added'];
    case 'event':
      await create<EventData>('event', blankEvent({
        title, start: onDay, end: onDay, start_time: parsed.time, all_day: !parsed.time,
        end_time: parsed.time && parsed.duration_min ? addMin(parsed.time, parsed.duration_min) : parsed.time ? addMin(parsed.time, 60) : null,
        notes: raw === title ? '' : raw, source: 'capture',
      }), { date: onDay });
      return ['أُضيف الموعد للتقويم', 'Event added to calendar'];
    case 'note':
      await create<NoteData>('note', blankNote({ title, body: '', tags: parsed.tags, note_type: /فكرة|idea/i.test(raw) ? 'idea' : 'quick' }));
      return ['حُفظت الملاحظة', 'Note saved'];
    case 'expense':
    case 'income':
      if (!parsed.amount) throw new Error('اكتب المبلغ، مثل: قهوة 15');
      await addTxn({ kind, amount: parsed.amount, description: title, category: kind === 'expense' ? parsed.category ?? settings.categories.expenses.at(-1) ?? null : null }, onDay);
      return [`سُجّل ${parsed.amount} ر.س`, `Logged ${parsed.amount} SAR`];
    case 'water':
      await logWater(parsed.ml ?? 250, onDay);
      return [`+${parsed.ml ?? 250} مل ماء`, `+${parsed.ml ?? 250} ml water`];
    case 'journal':
      await create<JournalData>('journal', { body: raw, time: new Date().toTimeString().slice(0, 5), mood: null, energy: null, prompts: {} }, { date: onDay });
      return ['أُضيفت لليوميات', 'Added to journal'];
    default:
      await create<CaptureData>('capture', { text: raw, source: 'quick', parsed }, { status: 'open', date: todayKey() });
      return ['في الوارد — رتّبه لاحقاً', 'In your inbox — sort it later'];
  }
}
