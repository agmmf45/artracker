import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Plus, CalendarArrowDown, Sun, Clock } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useRecords, useRecordsInRange, useSettings } from '@/core/hooks';
import { fmtDate, fmtTime, hijri, shiftKey, todayKey } from '@/core/dates';
import { Button, Card, CheckCircle, EmptyState, PageHeader, Section } from '@/design/ui';
import { TaskRow } from './tasks/TaskRow';
import { TaskEditor } from './tasks/TaskEditor';
import { createTask, isDone, saveTask, taskDay, type Task, type TaskData } from './tasks/model';
import { indexLogs, isPaused, isScheduled, logDone, toggleHabit, type HabitData, type HabitLogData } from './habits/model';
import { useCalendarItems } from './calendar/sources';

export default function Today() {
  const { L, lang, locale } = useI18n();
  const settings = useSettings();
  const today = todayKey();
  const tasks = useRecords<TaskData>('task');
  const habits = useRecords<HabitData>('habit');
  const logs = useRecordsInRange<HabitLogData>('habit_log', today, today);
  const items = useCalendarItems(today, today, settings);
  const [title, setTitle] = useState('');
  const [editing, setEditing] = useState<Task | null>(null);

  const { overdue, todays, done } = useMemo(() => {
    const xs = (tasks ?? []).filter((t) => t.status !== 'archived' && t.status !== 'inbox');
    return {
      overdue: xs.filter((t) => !isDone(t) && ((t.data.due && t.data.due < today) || (t.data.start && t.data.start < today && (!t.data.due || t.data.due >= today)))),
      todays: xs.filter((t) => !isDone(t) && (taskDay(t.data) === today || t.data.due === today)),
      done: xs.filter((t) => isDone(t) && t.data.completed_at?.slice(0, 10) === today),
    };
  }, [tasks, today]);

  const logIdx = useMemo(() => indexLogs(logs), [logs]);
  const todaysHabits = (habits ?? []).filter((h) => h.status !== 'archived' && isScheduled(h.data, today) && !isPaused(h.data, today)).sort((a, b) => a.data.order - b.data.order);
  const timed = (items ?? []).filter((i) => !i.allDay && i.kind !== 'task');

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await createTask({ title: title.trim(), start: today, priority: settings.tasks.defaultPriority });
    setTitle('');
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow={hijri(today, lang)} title={fmtDate(today, locale)} subtitle={L(`${todays.length} مهمة · ${todaysHabits.length} عادة · ${timed.length} موعد`, `${todays.length} tasks · ${todaysHabits.length} habits · ${timed.length} events`)}
        actions={<Link to="/life/planner"><Button icon={<CalendarArrowDown size={16} />}>{L('خطط يومك', 'Plan your day')}</Button></Link>} />

      <form onSubmit={add} className="mb-6 flex gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="field" placeholder={L('أضف مهمة لليوم…', 'Add a task for today…')} aria-label={L('مهمة جديدة لليوم', 'New task for today')} />
        <Button type="submit" variant="primary" icon={<Plus size={17} />} disabled={!title.trim()}>{L('أضف', 'Add')}</Button>
      </form>

      {overdue.length > 0 && (
        <Section title={<span className="text-danger">{L('من أيام سابقة', 'Carried over')} · {overdue.length}</span>}
          action={<Button size="sm" variant="ghost" onClick={async () => { for (const t of overdue) await saveTask(t.id, { ...t.data, start: today }); }}>{L('خطّطها كلها لليوم', 'Plan all for today')}</Button>}>
          <Card className="divide-y divide-line p-1.5">
            {overdue.map((t) => (
              <div key={t.id} className="flex items-center gap-1">
                <div className="min-w-0 flex-1"><TaskRow task={t} onOpen={setEditing} /></div>
                <Button size="sm" variant="ghost" onClick={() => saveTask(t.id, { ...t.data, start: today })}>{L('لليوم', 'Today')}</Button>
                <Button size="sm" variant="ghost" onClick={() => saveTask(t.id, { ...t.data, start: shiftKey(today, 1) })}>{L('بكرة', 'Tmrw')}</Button>
              </div>
            ))}
          </Card>
          <p className="mt-1.5 text-[12px] text-fg-3">{L('نغيّر موعد العمل فقط — الموعد النهائي يبقى كما هو.', 'Only the scheduled date changes — deadlines stay as they are.')}</p>
        </Section>
      )}

      {timed.length > 0 && (
        <Section title={L('مواعيد اليوم', "Today's events")}>
          <Card className="divide-y divide-line">
            {timed.map((i) => (
              <div key={i.key} className="flex items-center gap-3 px-4 py-2.5">
                <span className="h-7 w-1 rounded-full" style={{ background: i.color }} />
                <span className="num w-28 text-[12px] text-fg-2"><Clock size={12} className="me-1 inline" />{fmtTime(i.start, locale, settings.timeFormat === '12')}{i.end ? `–${fmtTime(i.end, locale, settings.timeFormat === '12')}` : ''}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{i.title}</span>
              </div>
            ))}
          </Card>
        </Section>
      )}

      <Section title={L('مهام اليوم', "Today's tasks")}>
        {todays.length ? (
          <Card className="divide-y divide-line p-1.5">{todays.sort((a, b) => (a.data.start_time ?? '99').localeCompare(b.data.start_time ?? '99') || b.data.priority - a.data.priority).map((t) => <TaskRow key={t.id} task={t} onOpen={setEditing} showDate={false} />)}</Card>
        ) : <EmptyState icon={<Sun size={26} />} title={L('يومك هادئ.', 'A calm day.')} hint={L('اختر خطوة واحدة تقدّمك، وابدأ.', 'Pick one step that moves you forward, and start.')} />}
      </Section>

      {todaysHabits.length > 0 && (
        <Section title={L('عادات اليوم', "Today's habits")} action={<Link to="/life/habits" className="text-[12px] font-bold text-accent">{L('العادات', 'Habits')}</Link>}>
          <Card className="grid gap-1 p-2 sm:grid-cols-2">
            {todaysHabits.map((h) => {
              const log = logIdx.get(h.id)?.get(today);
              const ok = logDone(h.data, log);
              return (
                <div key={h.id} className="flex items-center gap-2.5 rounded-sm px-2 py-2 hover:bg-surface-2">
                  <CheckCircle checked={ok} onToggle={() => void toggleHabit(h, today, log, settings)} label={h.data.name} color="var(--life)" />
                  <span className="text-lg">{h.data.icon}</span>
                  <span className={`truncate text-sm ${ok ? 'text-fg-3 line-through' : ''}`}>{h.data.name}</span>
                  {h.data.kind !== 'check' && <span className="num ms-auto text-[12px] text-fg-3">{log?.data.value ?? 0}/{h.data.target} {h.data.unit ?? ''}</span>}
                </div>
              );
            })}
          </Card>
        </Section>
      )}

      {settings.tasks.showCompletedInToday && done.length > 0 && (
        <Section title={L(`أنجزت اليوم · ${done.length}`, `Done today · ${done.length}`)}>
          <Card className="divide-y divide-line p-1.5 opacity-80">{done.map((t) => <TaskRow key={t.id} task={t} onOpen={setEditing} compact />)}</Card>
        </Section>
      )}

      <TaskEditor task={editing} open={!!editing} onOpenChange={(v) => !v && setEditing(null)} />
    </div>
  );
}
