import { create, remove } from '@/core/repo';
import { fmtDate, todayKey } from '@/core/dates';
import type { Settings } from '@/core/settings';
import { createTask } from '@/modules/life/tasks/model';
import { addMin } from '@/modules/life/calendar/sources';
import { sleepHours } from '@/modules/health/sleepLogic';
import { addTxn, blankEvent, blankNote, logWater, type EventData, type JournalData, type NoteData } from '@/modules/shared/domain';

/** A change the assistant proposed; saved only when the person taps "Add". */
export interface Proposal { id: string; name: string; input: Record<string, unknown> }

type S = string | null | undefined;
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const opt = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** One line describing the proposal (for the card), [ar, en]. */
export function describe(p: Proposal, locale: string): { icon: string; title: string; lines: string[] } {
  const i = p.input;
  const d = (k: S) => (k ? fmtDate(k, locale, { weekday: 'short', day: 'numeric', month: 'short' }) : '');
  const at = (date: S, time: S) => [d(date), time ?? ''].filter(Boolean).join(' · ');
  switch (p.name) {
    case 'add_task': return { icon: '☐', title: str(i.title), lines: [at(opt(i.date), opt(i.time)) || 'بدون تاريخ', num(i.duration_min) ? `${num(i.duration_min)} د` : ''].filter(Boolean) };
    case 'add_event': return { icon: '○', title: str(i.title), lines: [at(opt(i.date), [opt(i.start_time), opt(i.end_time)].filter(Boolean).join('–')), opt(i.location) ?? ''].filter(Boolean) };
    case 'log_expense': return { icon: 'ر.س', title: `${num(i.amount) ?? 0} ر.س — ${str(i.description)}`, lines: [opt(i.category) ?? '', d(opt(i.date))].filter(Boolean) };
    case 'log_water': return { icon: '💧', title: `${num(i.ml) ?? 250} مل ماء`, lines: [] };
    case 'log_sleep': return { icon: '☾', title: `نوم ${str(i.bed)} → ${str(i.wake)}`, lines: [d(opt(i.date)), `${sleepHours(str(i.bed) || '00:00', str(i.wake) || '00:00')} ساعة`] };
    case 'add_note': return { icon: '–', title: str(i.title) || 'ملاحظة', lines: [str(i.body).slice(0, 90)] };
    case 'add_journal': return { icon: '✎', title: 'يوميات اليوم', lines: [str(i.body).slice(0, 90)] };
    case 'add_plan': {
      const items = (Array.isArray(i.items) ? i.items : []) as Array<Record<string, unknown>>;
      return { icon: '▦', title: str(i.title) || 'خطة', lines: items.map((x) => `${at(opt(x.date), opt(x.time))}${num(x.duration_min) ? ` (${num(x.duration_min)} د)` : ''}: ${str(x.title)}`) };
    }
    default: return { icon: '•', title: p.name, lines: [] };
  }
}

/** Saves the proposal; returns the ids it created (for undo). */
export async function apply(p: Proposal, settings: Settings): Promise<string[]> {
  const i = p.input;
  const today = todayKey();
  switch (p.name) {
    case 'add_task': {
      const t = await createTask({ title: str(i.title), start: opt(i.date), start_time: opt(i.time), duration_min: num(i.duration_min), estimate_min: num(i.duration_min), notes: str(i.notes), priority: settings.tasks.defaultPriority, source: 'assistant' });
      return [t.id];
    }
    case 'add_event': {
      const date = opt(i.date) ?? today;
      const start = opt(i.start_time);
      const r = await create<EventData>('event', blankEvent({ title: str(i.title), start: date, end: date, start_time: start, end_time: opt(i.end_time) ?? (start ? addMin(start, 60) : null), all_day: !start, location: opt(i.location) }), { date });
      return [r.id];
    }
    case 'log_expense': {
      const r = await addTxn({ kind: 'expense', amount: num(i.amount) ?? 0, description: str(i.description), category: opt(i.category) }, opt(i.date) ?? today);
      return [r.id];
    }
    case 'log_water': return [(await logWater(num(i.ml) ?? 250, today)).id];
    case 'log_sleep': {
      const bed = str(i.bed) || '23:00', wake = str(i.wake) || '07:00';
      const r = await create('sleep_log', { bed, wake, hours: sleepHours(bed, wake), quality: null, nap: false, notes: '' }, { date: opt(i.date) ?? today });
      return [r.id];
    }
    case 'add_note': return [(await create<NoteData>('note', blankNote({ title: str(i.title), body: str(i.body) }))).id];
    case 'add_journal': {
      const now = new Date();
      const r = await create<JournalData>('journal', { body: str(i.body), time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, mood: num(i.mood), energy: null, prompts: {} }, { date: today });
      return [r.id];
    }
    case 'add_plan': {
      const ids: string[] = [];
      for (const x of (Array.isArray(i.items) ? i.items : []) as Array<Record<string, unknown>>) {
        const t = await createTask({ title: str(x.title), start: opt(x.date), start_time: opt(x.time), duration_min: num(x.duration_min), estimate_min: num(x.duration_min), priority: settings.tasks.defaultPriority, source: 'assistant' });
        ids.push(t.id);
      }
      return ids;
    }
    default: return [];
  }
}

export async function undo(ids: string[]) {
  for (const id of ids) await remove(id);
}

/** How a proposal is remembered in the chat sent back to the model (it only sees text). */
export function asText(p: Proposal, state: 'added' | 'skipped' | 'pending'): string {
  const d = describe(p, 'ar');
  const verb = state === 'added' ? 'أضافها المستخدم' : state === 'skipped' ? 'تجاهلها المستخدم' : 'بانتظار المستخدم';
  return `[اقتراح ${p.name}: ${d.title}${d.lines.length ? ` — ${d.lines.join('؛ ')}` : ''} — ${verb}]`;
}
