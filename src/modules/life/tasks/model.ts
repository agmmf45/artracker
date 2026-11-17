import type { Rec } from '@shared/records';
import { create, update, revertTo } from '@/core/repo';
import { grantXp, revokeXp } from '@/core/xp';
import { nextAfter, type Recurrence } from '@/core/recurrence';
import { todayKey, daysBetween } from '@/core/dates';
import { undoToast } from '@/core/toast';
import type { Settings } from '@/core/settings';

export type TaskStatus = 'inbox' | 'todo' | 'doing' | 'done' | 'archived';

export interface Subtask { id: string; title: string; done: boolean }

export interface TaskData {
  title: string;
  notes: string;
  priority: number; // 0 none · 1 low · 2 normal · 3 high · 4 urgent
  category: string | null;
  tags: string[];
  /** deadline (never moved silently) */
  due: string | null;
  due_time: string | null;
  /** scheduled work session — distinct from the deadline */
  start: string | null;
  start_time: string | null;
  duration_min: number | null;
  estimate_min: number | null;
  actual_min: number | null;
  subtasks: Subtask[];
  recurrence: Recurrence | null;
  /** completed occurrences of a recurring task */
  history: Array<{ date: string; at: string }>;
  completed_at: string | null;
  project_id: string | null;
  goal_id: string | null;
  milestone_id: string | null;
  course_id: string | null;
  area: string | null;
  depends_on: string[];
  note_ids: string[];
  pinned: boolean;
  favorite: boolean;
  important?: boolean;
  urgent?: boolean;
  board_column?: string | null;
  order?: number;
  custom?: Record<string, string>;
  reminder_min?: number | null;
  capture_text?: string | null;
  source?: string;
  attachments?: Array<{ id: string; name: string; url: string }>;
  activity?: Array<{ at: string; what: string }>;
}

export type Task = Rec<TaskData>;

export function blankTask(partial: Partial<TaskData> = {}): TaskData {
  return {
    title: '', notes: '', priority: 2, category: null, tags: [], due: null, due_time: null, start: null, start_time: null,
    duration_min: null, estimate_min: null, actual_min: null, subtasks: [], recurrence: null, history: [], completed_at: null,
    project_id: null, goal_id: null, milestone_id: null, course_id: null, area: null, depends_on: [], note_ids: [],
    pinned: false, favorite: false, ...partial,
  };
}

/** The calendar day a task "lives on": scheduled work date first, then deadline. */
export function taskDay(d: Pick<TaskData, 'start' | 'due'>): string | null {
  return d.start ?? d.due ?? null;
}

export async function createTask(data: Partial<TaskData>, status: TaskStatus = 'todo'): Promise<Task> {
  const full = blankTask(data);
  return create<TaskData>('task', full, { date: taskDay(full), status, parent_id: full.project_id });
}

export async function saveTask(id: string, data: Partial<TaskData>, extra: { status?: TaskStatus } = {}) {
  const cur = data as TaskData;
  const patch: Parameters<typeof update<TaskData>>[1] = { data };
  if ('start' in data || 'due' in data) patch.date = taskDay({ start: cur.start ?? null, due: cur.due ?? null });
  if ('project_id' in data) patch.parent_id = data.project_id ?? null;
  if (extra.status) patch.status = extra.status;
  return update<TaskData>(id, patch);
}

export const isDone = (t: Task) => t.status === 'done';

export function isOverdue(t: Task, today = todayKey()): boolean {
  return !isDone(t) && !!t.data.due && t.data.due < today;
}

export function blocked(t: Task, all: Map<string, Task>): boolean {
  return (t.data.depends_on ?? []).some((id) => {
    const dep = all.get(id);
    return dep && !dep.deleted_at && !isDone(dep);
  });
}

/**
 * Completes a task. Recurring tasks stay one record: the occurrence is logged in `history` and
 * due/start move to the next occurrence. Grants XP once per occurrence; offers Undo.
 */
export async function completeTask(t: Task, settings: Settings): Promise<void> {
  const now = new Date().toISOString();
  const today = todayKey();
  const important = t.data.priority >= 3;
  if (t.data.recurrence) {
    const current = taskDay(t.data) ?? today;
    const anchor = t.data.history[0]?.date ?? current;
    const next = nextAfter(t.data.recurrence, anchor, current, today);
    const shift = (k: string | null) => (k && next ? nextShift(k, current, next) : k);
    const prev = await update<TaskData>(t.id, {
      data: {
        history: [...(t.data.history ?? []), { date: current, at: now }],
        subtasks: t.data.subtasks.map((s) => ({ ...s, done: false })),
        due: shift(t.data.due),
        start: shift(t.data.start),
        completed_at: next ? null : now,
      },
      date: next ?? t.date,
      status: next ? t.status : 'done',
    });
    await grantXp(`task:${t.id}:${current}`, important ? 'task_important' : 'task', settings, t.data.title);
    undoToast(next ? `✓ ${t.data.title} · التالي ${next}` : `✓ ${t.data.title}`, async () => {
      if (prev) await revertTo(prev as unknown as Rec);
      await revokeXp(`task:${t.id}:${current}`);
    });
    return;
  }
  const prev = await update<TaskData>(t.id, { data: { completed_at: now }, status: 'done' });
  await grantXp(`task:${t.id}:complete`, important ? 'task_important' : 'task', settings, t.data.title);
  undoToast(`✓ ${t.data.title}`, async () => {
    if (prev) await revertTo(prev as unknown as Rec);
    await revokeXp(`task:${t.id}:complete`);
  });
}

function nextShift(k: string, current: string, next: string): string {
  // keep the same offset between scheduled/due and the occurrence day
  const offset = daysBetween(current, k);
  const d = new Date(`${next}T00:00:00`);
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function uncompleteTask(t: Task): Promise<void> {
  await update<TaskData>(t.id, { data: { completed_at: null }, status: 'todo' });
  await revokeXp(`task:${t.id}:complete`);
}

export async function toggleTask(t: Task, settings: Settings) {
  if (isDone(t)) await uncompleteTask(t);
  else await completeTask(t, settings);
}

export const PRIORITY = [
  { v: 4, ar: 'عاجل', en: 'Urgent', color: 'var(--danger)' },
  { v: 3, ar: 'مهم', en: 'High', color: 'var(--warning)' },
  { v: 2, ar: 'عادي', en: 'Normal', color: 'var(--text-3)' },
  { v: 1, ar: 'منخفض', en: 'Low', color: 'var(--info)' },
  { v: 0, ar: 'بدون', en: 'None', color: 'var(--border-strong)' },
];

export function priorityColor(p: number): string {
  return PRIORITY.find((x) => x.v === p)?.color ?? 'var(--border-strong)';
}

/** Ranking for "suggested next task": overdue → due today → priority → scheduled time → age. */
export function suggestNext(tasks: Task[], today = todayKey()): Task | null {
  const open = tasks.filter((t) => !isDone(t) && t.status !== 'inbox' && t.status !== 'archived');
  const score = (t: Task) => {
    let s = 0;
    if (t.data.due && t.data.due < today) s += 1000;
    if (t.data.due === today || t.data.start === today) s += 500;
    s += (t.data.priority ?? 2) * 60;
    if (t.data.pinned) s += 80;
    if (t.data.start_time) s += 20;
    return s;
  };
  return open.sort((a, b) => score(b) - score(a))[0] ?? null;
}
