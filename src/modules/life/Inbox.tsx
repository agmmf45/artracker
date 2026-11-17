import { useState } from 'react';
import { Inbox as InboxIcon, ListChecks, StickyNote, CalendarPlus, Wallet, Trash2, Sparkles, CheckCheck } from 'lucide-react';
import type { Rec } from '@shared/records';
import { useI18n } from '@/core/i18n';
import { useRecords, useSettings } from '@/core/hooks';
import { create, remove, revertTo, update } from '@/core/repo';
import { relativeDay, todayKey } from '@/core/dates';
import { parseCapture } from '@/core/capture/parse';
import { api } from '@/core/api';
import { toast, undoToast } from '@/core/toast';
import { confirm } from '@/design/overlay';
import { Button, Card, EmptyState, IconButton, PageHeader } from '@/design/ui';
import { addTxn, blankEvent, blankNote, type CaptureData, type EventData, type NoteData } from '@/modules/shared/domain';
import { createTask, type TaskData } from './tasks/model';
import { TaskEditor } from './tasks/TaskEditor';
import { blankHabit, type HabitData } from './habits/model';

/** Universal inbox: everything captured without a type. Sort each item in one tap. */
export default function Inbox() {
  const { L, lang, locale } = useI18n();
  const settings = useSettings();
  const captures = useRecords<CaptureData>('capture');
  const inboxTasks = useRecords<TaskData>('task');
  const [taskFrom, setTaskFrom] = useState<Partial<TaskData> | null>(null);
  const [busy, setBusy] = useState(false);
  const open = (captures ?? []).filter((c) => c.status !== 'done').sort((a, b) => b.created_at.localeCompare(a.created_at));
  const tasks = (inboxTasks ?? []).filter((t) => t.status === 'inbox');

  const done = async (c: Rec<CaptureData>) => update(c.id, { status: 'done' });

  const toTask = async (c: Rec<CaptureData>) => {
    const p = parseCapture(c.data.text);
    setTaskFrom({ title: p.title, start: p.date, start_time: p.time, duration_min: p.duration_min, tags: p.tags, priority: p.priority ?? 2, capture_text: c.data.text });
    await done(c);
  };
  const toNote = async (c: Rec<CaptureData>) => { await create<NoteData>('note', blankNote({ title: c.data.text.slice(0, 80), body: c.data.text.length > 80 ? c.data.text : '', note_type: 'idea' })); await done(c); toast(L('صارت ملاحظة', 'Now a note')); };
  const toEvent = async (c: Rec<CaptureData>) => {
    const p = parseCapture(c.data.text);
    const d = p.date ?? todayKey();
    await create<EventData>('event', blankEvent({ title: p.title, start: d, end: d, start_time: p.time, all_day: !p.time }), { date: d });
    await done(c); toast(L('صار موعداً في التقويم', 'Added to calendar'));
  };
  const toExpense = async (c: Rec<CaptureData>) => {
    const p = parseCapture(c.data.text);
    if (!p.amount) { toast(L('ما لقينا مبلغ في النص', 'No amount found in the text'), { tone: 'error' }); return; }
    await addTxn({ kind: 'expense', amount: p.amount, description: p.title, category: p.category });
    await done(c); toast(L('سُجّل كمصروف', 'Logged as expense'));
  };
  const del = async (c: Rec<CaptureData>) => { const prev = await remove(c.id); undoToast(L('حُذف', 'Deleted'), async () => { if (prev) await revertTo(prev); }); };

  const organizeAI = async () => {
    if (!open.length) return;
    setBusy(true);
    try {
      const habits = await import('@/core/db').then(({ db }) => db().records.where('type').equals('habit').toArray());
      const res = await api<{ result: { habits?: Array<{ name: string; icon: string }>; tasks?: Array<{ title: string; priority?: number; due?: string | null; due_time?: string | null; duration_min?: number | null }>; message?: string } }>('/ai/capture_organize', {
        input: { text: open.map((c) => c.data.text).join('\n'), existing_habits: habits.map((h) => (h.data as unknown as HabitData).name) }, today: todayKey(),
      });
      const r = res.result;
      const ok = await confirm(L('اقتراح المساعد', 'Assistant suggestion'), {
        message: `${r.message ?? ''}\n\n${L('مهام', 'Tasks')}: ${(r.tasks ?? []).map((t) => t.title).join('، ') || '—'}\n${L('عادات', 'Habits')}: ${(r.habits ?? []).map((h) => `${h.icon} ${h.name}`).join('، ') || '—'}`,
        okText: L('أضفها كلها', 'Add all'),
      });
      if (!ok) return;
      for (const t of r.tasks ?? []) await createTask({ title: t.title, priority: t.priority ?? 2, due: t.due ?? null, due_time: t.due_time ?? null, estimate_min: t.duration_min ?? null, source: 'ai' });
      for (const h of r.habits ?? []) await create<HabitData>('habit', blankHabit({ name: h.name, icon: h.icon || '✅' }), { status: 'active' });
      for (const c of open) await done(c);
      toast(L('رُتّب الوارد', 'Inbox organized'));
    } catch (e) { toast((e as Error).message, { tone: 'error' }); } finally { setBusy(false); }
  };

  const actions = (c: Rec<CaptureData>) => (
    <div className="flex shrink-0 gap-0.5">
      <IconButton size="sm" label={L('مهمة', 'Task')} onClick={() => toTask(c)}><ListChecks size={16} /></IconButton>
      <IconButton size="sm" label={L('ملاحظة', 'Note')} onClick={() => toNote(c)}><StickyNote size={16} /></IconButton>
      <IconButton size="sm" label={L('موعد', 'Event')} onClick={() => toEvent(c)}><CalendarPlus size={16} /></IconButton>
      <IconButton size="sm" label={L('مصروف', 'Expense')} onClick={() => toExpense(c)}><Wallet size={16} /></IconButton>
      <IconButton size="sm" tone="danger" label={L('حذف', 'Delete')} onClick={() => del(c)}><Trash2 size={16} /></IconButton>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={L('الوارد', 'Inbox')} subtitle={L('كل ما التقطته بسرعة. رتّبه بنقرة.', 'Everything you captured quickly. Sort it in one tap.')}
        actions={settings.privacy.ai.enabled && open.length > 0 ? <Button icon={<Sparkles size={16} />} loading={busy} onClick={organizeAI}>{L('رتّبه بالذكاء', 'Organize with AI')}</Button> : undefined} />
      {!open.length && !tasks.length ? (
        <EmptyState icon={<CheckCheck size={30} />} title={L('الوارد فاضي. ذهن صافي.', 'Inbox zero. Clear mind.')} hint={L('استخدم زر + أو حرف N لالتقاط أي فكرة.', 'Use + or N to capture anything.')} action={<Button variant="primary" onClick={() => window.dispatchEvent(new Event('dq:capture'))}>{L('التقاط', 'Capture')}</Button>} />
      ) : (
        <Card className="divide-y divide-line">
          {open.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
              <InboxIcon size={16} className="shrink-0 text-fg-3" />
              <div className="min-w-0 flex-1">
                <div className="break-words text-sm">{c.data.text}</div>
                <div className="text-[11px] text-fg-3">{relativeDay(c.created_at.slice(0, 10), lang, locale)}</div>
              </div>
              {actions(c)}
            </div>
          ))}
          {tasks.map((t) => (
            <div key={t.id} className="flex items-center gap-2 px-4 py-3">
              <ListChecks size={16} className="text-fg-3" />
              <span className="min-w-0 flex-1 truncate text-sm">{t.data.title}</span>
              <Button size="sm" variant="ghost" onClick={() => update(t.id, { status: 'todo' })}>{L('إلى المهام', 'To tasks')}</Button>
            </div>
          ))}
        </Card>
      )}
      <TaskEditor task={null} open={!!taskFrom} defaults={taskFrom ?? undefined} onOpenChange={(v) => !v && setTaskFrom(null)} />
    </div>
  );
}
