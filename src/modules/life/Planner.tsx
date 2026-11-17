import { useMemo, useState } from 'react';
import { AlertTriangle, Coffee, Plus, Sparkles, X } from 'lucide-react';
import clsx from 'clsx';
import { useI18n } from '@/core/i18n';
import { useRecords, useSettings } from '@/core/hooks';
import { fmtDate, fmtDuration, fromMinutes, hm, rangeKeys, relativeDay, shiftKey, todayKey, weekStartKey } from '@/core/dates';
import { create } from '@/core/repo';
import { api } from '@/core/api';
import { toast } from '@/core/toast';
import { Bar, Button, Card, EmptyState, PageHeader, Section, Segmented } from '@/design/ui';
import { confirm } from '@/design/overlay';
import { blankEvent, type EventData } from '@/modules/shared/domain';
import { TaskRow } from './tasks/TaskRow';
import { TaskEditor } from './tasks/TaskEditor';
import { isDone, saveTask, taskDay, type Task, type TaskData } from './tasks/model';
import { conflicts, useCalendarItems } from './calendar/sources';

/**
 * Daily planning: see workload vs. free time, pull tasks into the day, time-block them,
 * spot overlaps, reserve breaks. Weekly view shows load per day. Never moves deadlines.
 */
export default function Planner() {
  const { L, lang, locale } = useI18n();
  const settings = useSettings();
  const [mode, setMode] = useState<'day' | 'week'>('day');
  const [day, setDay] = useState(todayKey());
  const [editing, setEditing] = useState<Task | null>(null);
  const tasks = useRecords<TaskData>('task');
  const weekStart = weekStartKey(day, settings.weekStart);
  const items = useCalendarItems(mode === 'day' ? day : weekStart, mode === 'day' ? day : shiftKey(weekStart, 6), settings);

  const dayStart = hm(settings.dayStart) ?? 420;
  const dayEnd = hm(settings.dayEnd) ?? 1380;

  const plan = useMemo(() => {
    const open = (tasks ?? []).filter((t) => !isDone(t) && t.status !== 'archived' && t.status !== 'inbox');
    const scheduled = open.filter((t) => taskDay(t.data) === day);
    const backlog = open.filter((t) => !taskDay(t.data) || taskDay(t.data)! < day).sort((a, b) => b.data.priority - a.data.priority || (a.data.due ?? '9').localeCompare(b.data.due ?? '9'));
    const busy = (items ?? []).filter((i) => i.date === day && !i.allDay && i.kind !== 'task' && i.kind !== 'deadline' && i.start);
    const busyMin = busy.reduce((s, i) => s + Math.max(0, (hm(i.end) ?? (hm(i.start)! + 60)) - hm(i.start)!), 0);
    const available = Math.max(0, dayEnd - dayStart - busyMin);
    const workload = scheduled.reduce((s, t) => s + (t.data.duration_min ?? t.data.estimate_min ?? 30), 0);
    const unestimated = scheduled.filter((t) => !t.data.duration_min && !t.data.estimate_min).length;
    return { scheduled, backlog, busy, busyMin, available, workload, unestimated };
  }, [tasks, items, day, dayStart, dayEnd]);

  const clash = useMemo(() => conflicts((items ?? []).filter((i) => i.date === day)), [items, day]);
  const over = plan.workload > plan.available;

  const addBreak = async () => {
    const free = firstFreeSlot(day, 15);
    if (!free) { toast(L('ما فيه وقت فاضي لاستراحة', 'No free slot for a break'), { tone: 'error' }); return; }
    await create<EventData>('event', blankEvent({ title: L('استراحة', 'Break'), start: day, end: day, start_time: free, end_time: fromMinutes(hm(free)! + 15), all_day: false, color: 'var(--health)', reminder_min: null }), { date: day });
    toast(L(`أضفنا استراحة ${free}`, `Break added at ${free}`));
  };

  function firstFreeSlot(d: string, len: number): string | null {
    const taken = (items ?? []).filter((i) => i.date === d && !i.allDay && i.start).map((i) => [hm(i.start)!, hm(i.end) ?? hm(i.start)! + 30] as const);
    const nowMin = d === todayKey() ? new Date().getHours() * 60 + new Date().getMinutes() : 0;
    for (let t = Math.max(dayStart, Math.ceil(nowMin / 15) * 15); t + len <= dayEnd; t += 15) {
      if (!taken.some(([a, b]) => t < b && a < t + len)) return fromMinutes(t);
    }
    return null;
  }

  const autoBlock = async () => {
    const pending = plan.scheduled.filter((t) => !t.data.start_time);
    if (!pending.length) { toast(L('كل مهام اليوم لها وقت', 'Every task already has a time')); return; }
    if (!(await confirm(L('نوزّع المهام بدون وقت على الأوقات الفاضية؟', 'Fit untimed tasks into free slots?'), { message: L('ما نلمس المواعيد الموجودة، ونترك 10 دقائق بين المهام.', 'Existing events are untouched; 10 minutes are left between tasks.') }))) return;
    const taken = (items ?? []).filter((i) => i.date === day && !i.allDay && i.start).map((i) => [hm(i.start)!, hm(i.end) ?? hm(i.start)! + 30] as [number, number]);
    let placed = 0;
    for (const t of pending.sort((a, b) => b.data.priority - a.data.priority)) {
      const len = t.data.duration_min ?? t.data.estimate_min ?? 30;
      const nowMin = day === todayKey() ? new Date().getHours() * 60 + new Date().getMinutes() : 0;
      for (let s = Math.max(dayStart, Math.ceil(nowMin / 15) * 15); s + len <= dayEnd; s += 15) {
        if (!taken.some(([a, b]) => s < b + 10 && a < s + len + 10)) {
          await saveTask(t.id, { ...t.data, start_time: fromMinutes(s), duration_min: len });
          taken.push([s, s + len]);
          placed++;
          break;
        }
      }
    }
    toast(L(`جدولنا ${placed} من ${pending.length}`, `Scheduled ${placed} of ${pending.length}`));
  };

  const aiPlan = async () => {
    try {
      const busy = plan.busy.map((b) => ({ start: b.start!, end: b.end ?? fromMinutes(hm(b.start)! + 60), title: b.title }));
      const res = await api<{ result: { blocks: Array<{ task_id: string; start: string; end: string }>; message?: string } }>('/ai/plan_day', {
        input: { date: day, day_start: settings.dayStart, day_end: settings.dayEnd, busy, tasks: plan.scheduled.concat(plan.backlog.slice(0, 15)).map((t) => ({ id: t.id, title: t.data.title, priority: t.data.priority, estimate_min: t.data.estimate_min ?? t.data.duration_min, due: t.data.due })) },
        today: todayKey(),
      });
      const blocks = res.result.blocks ?? [];
      const ok = await confirm(L('اقتراح المساعد', 'Assistant suggestion'), { message: `${res.result.message ?? ''}\n${blocks.map((b) => `${b.start}–${b.end} · ${(tasks ?? []).find((t) => t.id === b.task_id)?.data.title ?? '?'}`).join('\n')}`, okText: L('طبّق', 'Apply') });
      if (!ok) return;
      for (const b of blocks) {
        const t = (tasks ?? []).find((x) => x.id === b.task_id);
        if (t) await saveTask(t.id, { ...t.data, start: day, start_time: b.start, duration_min: Math.max(15, (hm(b.end) ?? 0) - (hm(b.start) ?? 0)) });
      }
    } catch (e) { toast((e as Error).message, { tone: 'error' }); }
  };

  return (
    <div>
      <PageHeader title={L('المخطط', 'Planner')} subtitle={L('خطة واقعية بمساحة للراحة.', 'A realistic plan, with room to breathe.')}
        actions={<Segmented value={mode} onChange={setMode} options={[{ value: 'day', label: L('اليوم', 'Day') }, { value: 'week', label: L('الأسبوع', 'Week') }]} />} />

      {mode === 'week' ? (
        <WeekLoad weekStart={weekStart} tasks={tasks ?? []} onPick={(d) => { setDay(d); setMode('day'); }} />
      ) : (
        <>
          <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 scroll-thin">
            {rangeKeys(todayKey(), 7).map((d) => (
              <button key={d} onClick={() => setDay(d)} className={clsx('shrink-0 rounded-sm border px-3 py-1.5 text-[13px] font-bold', d === day ? 'border-accent bg-accent text-on-accent' : 'border-line text-fg-2')}>{relativeDay(d, lang, locale)}</button>
            ))}
          </div>

          <Card className="mb-4 p-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label={L('وقتك المتاح', 'Free time')} value={fmtDuration(plan.available, lang)} />
              <Stat label={L('محجوز (مواعيد)', 'Booked')} value={fmtDuration(plan.busyMin, lang)} />
              <Stat label={L('حمل المهام', 'Task load')} value={fmtDuration(plan.workload, lang)} tone={over ? 'var(--danger)' : undefined} />
              <Stat label={L('وقت للتركيز', 'Focus room')} value={fmtDuration(Math.max(0, plan.available - plan.workload), lang)} />
            </div>
            <Bar className="mt-3" value={plan.workload} max={Math.max(plan.available, 1)} color={over ? 'var(--danger)' : 'var(--life)'} label={L('الحمل مقابل الوقت', 'Load vs time')} />
            {over && <p className="mt-2 flex items-center gap-1.5 text-[13px] font-bold text-danger"><AlertTriangle size={15} />{L('اليوم مزدحم أكثر من وقتك. انقل مهمة لبكرة؟', 'More planned than time available. Move something to tomorrow?')}</p>}
            {plan.unestimated > 0 && <p className="mt-1 text-[12px] text-fg-3">{L(`${plan.unestimated} مهمة بدون تقدير — حسبناها 30 دقيقة.`, `${plan.unestimated} tasks have no estimate — counted as 30 min.`)}</p>}
            {clash.size > 0 && <p className="mt-1 flex items-center gap-1.5 text-[13px] text-warning"><AlertTriangle size={14} />{L(`${clash.size} عنصر متعارض في الوقت`, `${clash.size} overlapping items`)}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={autoBlock}>{L('وزّع على الأوقات الفاضية', 'Fit into free time')}</Button>
              <Button size="sm" icon={<Coffee size={15} />} onClick={addBreak}>{L('احجز استراحة', 'Reserve a break')}</Button>
              {settings.privacy.ai.enabled && <Button size="sm" icon={<Sparkles size={15} />} onClick={aiPlan}>{L('خطط لي (ذكي)', 'Plan with AI')}</Button>}
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Section title={`${L('خطة', 'Plan for')} ${fmtDate(day, locale, { weekday: 'long' })} · ${plan.scheduled.length}`}>
              {plan.scheduled.length ? (
                <Card className="divide-y divide-line p-1.5">
                  {plan.scheduled.sort((a, b) => (a.data.start_time ?? '99').localeCompare(b.data.start_time ?? '99')).map((t) => (
                    <div key={t.id} className="flex items-center gap-1">
                      <div className="min-w-0 flex-1"><TaskRow task={t} onOpen={setEditing} showDate={false} /></div>
                      <input type="time" className="field h-8 min-h-0 w-28 py-0.5 text-[12px]" value={t.data.start_time ?? ''} aria-label={L('الوقت', 'Time')} onChange={(e) => saveTask(t.id, { ...t.data, start_time: e.target.value || null })} />
                      <button aria-label={L('إزالة من اليوم', 'Unschedule')} className="p-1 text-fg-3 hover:text-fg" onClick={() => saveTask(t.id, { ...t.data, start: null, start_time: null })}><X size={15} /></button>
                    </div>
                  ))}
                </Card>
              ) : <EmptyState title={L('اختر من القائمة مهام لهذا اليوم', 'Pull tasks into this day from the list')} />}
            </Section>
            <Section title={L('بانتظار جدولة', 'Unscheduled & carried over')}>
              {plan.backlog.length ? (
                <Card className="max-h-[60vh] divide-y divide-line overflow-y-auto p-1.5 scroll-thin">
                  {plan.backlog.map((t) => (
                    <div key={t.id} className="flex items-center gap-1">
                      <div className="min-w-0 flex-1"><TaskRow task={t} onOpen={setEditing} /></div>
                      <Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={() => saveTask(t.id, { ...t.data, start: day })}>{L('أضف', 'Add')}</Button>
                    </div>
                  ))}
                </Card>
              ) : <EmptyState title={L('ما فيه مهام معلقة 👌', 'Nothing waiting 👌')} />}
            </Section>
          </div>
        </>
      )}
      <TaskEditor task={editing} open={!!editing} onOpenChange={(v) => !v && setEditing(null)} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return <div><div className="text-[12px] font-bold text-fg-3">{label}</div><div className="num text-lg font-black" style={tone ? { color: tone } : undefined}>{value}</div></div>;
}

function WeekLoad({ weekStart, tasks, onPick }: { weekStart: string; tasks: Task[]; onPick: (d: string) => void }) {
  const { L, lang, locale } = useI18n();
  const settings = useSettings();
  const days = rangeKeys(weekStart, 7);
  const items = useCalendarItems(days[0], days[6], settings);
  const cap = (hm(settings.dayEnd) ?? 1380) - (hm(settings.dayStart) ?? 420);
  return (
    <div className="grid gap-2 md:grid-cols-7">
      {days.map((d) => {
        const ts = tasks.filter((t) => !isDone(t) && taskDay(t.data) === d);
        const load = ts.reduce((s, t) => s + (t.data.duration_min ?? t.data.estimate_min ?? 30), 0);
        const busy = (items ?? []).filter((i) => i.date === d && !i.allDay && i.kind !== 'task' && i.start).reduce((s, i) => s + Math.max(0, (hm(i.end) ?? hm(i.start)! + 60) - hm(i.start)!), 0);
        const pct = (load + busy) / cap;
        return (
          <button key={d} onClick={() => onPick(d)} className="card p-3 text-start hover:border-line-strong">
            <div className="text-[12px] font-bold text-fg-3">{fmtDate(d, locale, { weekday: 'short', day: 'numeric' })}</div>
            <div className="num mt-1 text-lg font-black" style={{ color: pct > 1 ? 'var(--danger)' : undefined }}>{Math.round(pct * 100)}%</div>
            <Bar value={load + busy} max={cap} color={pct > 1 ? 'var(--danger)' : pct > 0.75 ? 'var(--warning)' : 'var(--life)'} />
            <div className="mt-2 text-[12px] text-fg-2">{ts.length} {L('مهمة', 'tasks')} · {fmtDuration(busy, lang)} {L('مواعيد', 'booked')}</div>
            {pct > 1 && <div className="mt-1 text-[11px] font-bold text-danger">{L('يوم مزدحم', 'Overloaded')}</div>}
          </button>
        );
      })}
    </div>
  );
}
