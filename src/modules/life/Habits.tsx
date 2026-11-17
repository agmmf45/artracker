import { useMemo, useState } from 'react';
import { Plus, Flame, Play, Check, Settings2, Minus, ListOrdered, X } from 'lucide-react';
import clsx from 'clsx';
import type { Rec } from '@shared/records';
import { useI18n } from '@/core/i18n';
import { useRecords, useRecordsInRange, useSettings } from '@/core/hooks';
import { fmtDate, rangeKeys, relativeDay, shiftKey, todayKey, weekStartKey } from '@/core/dates';
import { create, update, remove } from '@/core/repo';
import { newId } from '@/core/ids';
import { toast } from '@/core/toast';
import { Modal } from '@/design/overlay';
import { Bar, Button, Card, CheckCircle, Chip, EmptyState, IconButton, Input, PageHeader, Segmented, Select, Stat } from '@/design/ui';
import { Bars, Heatmap } from '@/design/charts';
import { HabitEditor } from './habits/HabitEditor';
import { bestStreak, consistency, indexLogs, isPaused, isScheduled, logDone, setHabitValue, streak, toggleHabit, toggleHabitSub, type Habit, type HabitData, type HabitLog, type HabitLogData } from './habits/model';

interface RoutineItem { id: string; kind: 'habit' | 'step'; habit_id?: string; text?: string }
interface RoutineData { name: string; icon: string; period: 'morning' | 'evening' | 'study' | 'exercise' | 'work' | 'weekend' | 'custom'; items: RoutineItem[]; runs?: Record<string, string[]> }

const TEMPLATES: Record<string, { ar: string; en: string; icon: string; period: RoutineData['period']; steps: Array<[string, string]> }> = {
  morning: { ar: 'روتين الصباح', en: 'Morning routine', icon: '🌅', period: 'morning', steps: [['الاستيقاظ', 'Wake up'], ['شرب الماء', 'Drink water'], ['الصلاة', 'Pray'], ['مراجعة الأولويات', 'Review priorities'], ['الاستعداد للجامعة', 'Prepare for university']] },
  evening: { ar: 'روتين المساء', en: 'Evening routine', icon: '🌙', period: 'evening', steps: [['مراجعة المنجز', 'Review completed tasks'], ['تدوين الأفكار المعلقة', 'Capture unfinished ideas'], ['تجهيز الغد', 'Prepare tomorrow'], ['يوميات قصيرة', 'Write a short journal'], ['الاستعداد للنوم', 'Prepare for sleep']] },
  study: { ar: 'روتين المذاكرة', en: 'Study routine', icon: '📚', period: 'study', steps: [['ترتيب المكتب', 'Clear the desk'], ['إبعاد الجوال', 'Phone away'], ['تحديد هدف الجلسة', 'Set a session goal'], ['جلسة تركيز', 'Focus session'], ['مراجعة البطاقات', 'Review flashcards']] },
};

export default function Habits() {
  const { L, lang, locale } = useI18n();
  const settings = useSettings();
  const today = todayKey();
  const [day, setDay] = useState(today);
  const [tab, setTab] = useState<'day' | 'week' | 'routines'>('day');
  const [editing, setEditing] = useState<Habit | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [detail, setDetail] = useState<Habit | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const habits = useRecords<HabitData>('habit');
  const logs = useRecordsInRange<HabitLogData>('habit_log', shiftKey(today, -400), today);
  const idx = useMemo(() => indexLogs(logs), [logs]);
  const list = (habits ?? []).filter((h) => (showArchived ? h.status === 'archived' : h.status !== 'archived')).sort((a, b) => a.data.order - b.data.order);
  const forDay = list.filter((h) => isScheduled(h.data, day));
  const doneCount = forDay.filter((h) => logDone(h.data, idx.get(h.id)?.get(day))).length;

  return (
    <div>
      <PageHeader title={L('العادات', 'Habits')} subtitle={L('الاستمرار أهم من الكمال. أيام الراحة لا تُحسب غياباً.', 'Consistency over perfection. Rest days never count as misses.')}
        actions={<Button variant="primary" icon={<Plus size={17} />} onClick={() => { setEditing(null); setEditorOpen(true); }}>{L('عادة', 'Habit')}</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'day', label: L('اليوم', 'Day') }, { value: 'week', label: L('الأسبوع', 'Week') }, { value: 'routines', label: L('الروتينات', 'Routines') }]} />
        <span className="flex-1" />
        <Chip active={showArchived} onClick={() => setShowArchived(!showArchived)}>{L('المؤرشفة', 'Archived')}</Chip>
      </div>

      {tab === 'routines' ? <Routines habits={list} idx={idx} /> : !habits ? <div className="skeleton h-40" /> : !list.length ? (
        <EmptyState icon={<Flame size={30} />} title={L('ابدأ بعادة صغيرة جداً.', 'Start with a tiny habit.')} hint={L('مثلاً: كوب ماء بعد الاستيقاظ. الصغير يستمر.', 'e.g. a glass of water after waking. Small sticks.')}
          action={<Button variant="primary" icon={<Plus size={16} />} onClick={() => { setEditing(null); setEditorOpen(true); }}>{L('أضف عادة', 'Add a habit')}</Button>} />
      ) : tab === 'day' ? (
        <>
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 scroll-thin">
            {rangeKeys(shiftKey(today, -6), 7).map((d) => {
              const sch = list.filter((h) => isScheduled(h.data, d) && !isPaused(h.data, d));
              const dn = sch.filter((h) => logDone(h.data, idx.get(h.id)?.get(d))).length;
              return (
                <button key={d} onClick={() => setDay(d)} className={clsx('flex min-w-14 shrink-0 flex-col items-center rounded-md border px-2 py-1.5', d === day ? 'border-accent bg-[color-mix(in_oklab,var(--accent)_12%,transparent)]' : 'border-line')}>
                  <span className="text-[11px] text-fg-3">{fmtDate(d, locale, { weekday: 'short' })}</span>
                  <span className="num font-black">{Number(d.slice(8))}</span>
                  <span className="num text-[10px] text-fg-3">{dn}/{sch.length}</span>
                </button>
              );
            })}
          </div>
          <div className="mb-3 flex items-center gap-3"><span className="text-sm font-bold">{relativeDay(day, lang, locale)}</span><Bar value={doneCount} max={Math.max(1, forDay.length)} className="flex-1" /><span className="num text-sm text-fg-2">{doneCount}/{forDay.length}</span></div>
          <div className="grid gap-2 md:grid-cols-2">
            {forDay.map((h) => <HabitCard key={h.id} h={h} day={day} logs={idx.get(h.id)} onEdit={() => { setEditing(h); setEditorOpen(true); }} onDetail={() => setDetail(h)} />)}
          </div>
          {forDay.length < list.length && <p className="mt-3 text-[12px] text-fg-3">{L(`${list.length - forDay.length} عادة غير مجدولة هذا اليوم`, `${list.length - forDay.length} habits not scheduled this day`)}</p>}
        </>
      ) : (
        <WeekGrid habits={list} idx={idx} onDetail={setDetail} />
      )}

      <HabitEditor habit={editing} open={editorOpen} onOpenChange={setEditorOpen} />
      <HabitDetail habit={detail} logs={detail ? idx.get(detail.id) : undefined} onClose={() => setDetail(null)} weekStart={settings.weekStart} />
    </div>
  );
}

function HabitCard({ h, day, logs, onEdit, onDetail }: { h: Habit; day: string; logs?: Map<string, HabitLog>; onEdit: () => void; onDetail: () => void }) {
  const { L } = useI18n();
  const settings = useSettings();
  const log = logs?.get(day);
  const done = logDone(h.data, log);
  const paused = isPaused(h.data, day);
  const st = streak(h.data, logs, todayKey(), settings.weekStart);
  return (
    <Card className={clsx('p-3.5 transition-colors', done && 'border-[color-mix(in_oklab,var(--life)_45%,var(--border))]')}>
      <div className="flex items-center gap-3">
        {h.data.kind === 'check' ? (
          <CheckCircle checked={done} size={28} onToggle={() => void toggleHabit(h, day, log, settings)} label={h.data.name} color="var(--life)" />
        ) : (
          <div className="flex items-center gap-1">
            <IconButton size="sm" label="-" onClick={() => setHabitValue(h, day, Math.max(0, (log?.data.value ?? 0) - 1), log, settings)}><Minus size={15} /></IconButton>
            <IconButton size="sm" label="+" onClick={() => setHabitValue(h, day, (log?.data.value ?? 0) + 1, log, settings)}><Plus size={15} /></IconButton>
          </div>
        )}
        <span className="text-2xl leading-none">{h.data.icon}</span>
        <button className="min-w-0 flex-1 text-start" onClick={onDetail}>
          <div className={clsx('truncate font-bold', done && 'text-fg-2')}>{h.data.name}</div>
          <div className="flex items-center gap-2 text-[12px] text-fg-3">
            {st > 0 && <span className="inline-flex items-center gap-0.5 font-bold text-reward"><Flame size={12} />{st}</span>}
            {h.data.kind !== 'check' && <span className="num">{log?.data.value ?? 0} / {h.data.target} {h.data.unit ?? ''}</span>}
            {paused && <span>{L('راحة', 'Rest')}</span>}
          </div>
        </button>
        <IconButton size="sm" label={L('تعديل', 'Edit')} onClick={onEdit}><Settings2 size={16} /></IconButton>
      </div>
      {h.data.kind !== 'check' && <Bar className="mt-2.5" value={log?.data.value ?? 0} max={h.data.target} color="var(--life)" />}
      {!!h.data.subtasks.length && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {h.data.subtasks.map((s) => {
            const on = !!log?.data.subtasks?.[s.id];
            return <Chip key={s.id} active={on} onClick={() => void toggleHabitSub(h, day, s.id, log, settings)}>{on && <Check size={12} />}{s.name}</Chip>;
          })}
        </div>
      )}
    </Card>
  );
}

function WeekGrid({ habits, idx, onDetail }: { habits: Habit[]; idx: Map<string, Map<string, HabitLog>>; onDetail: (h: Habit) => void }) {
  const { L, locale } = useI18n();
  const settings = useSettings();
  const start = weekStartKey(todayKey(), settings.weekStart);
  const days = rangeKeys(start, 7);
  const today = todayKey();
  return (
    <Card className="overflow-x-auto p-3 scroll-thin">
      <table className="w-full min-w-[560px] text-sm">
        <thead><tr><th className="pb-2 text-start font-bold text-fg-2">{L('العادة', 'Habit')}</th>{days.map((d) => <th key={d} className={clsx('pb-2 text-center text-[11px] font-bold', d === today ? 'text-accent' : 'text-fg-3')}>{fmtDate(d, locale, { weekday: 'short' })}</th>)}<th className="pb-2 text-[11px] text-fg-3">%</th></tr></thead>
        <tbody>
          {habits.map((h) => {
            const logs = idx.get(h.id);
            return (
              <tr key={h.id} className="border-t border-line">
                <td className="py-2"><button className="flex items-center gap-2 text-start" onClick={() => onDetail(h)}><span>{h.data.icon}</span><span className="max-w-40 truncate">{h.data.name}</span></button></td>
                {days.map((d) => {
                  const sch = isScheduled(h.data, d);
                  const rest = isPaused(h.data, d);
                  const done = logDone(h.data, logs?.get(d));
                  return (
                    <td key={d} className="text-center">
                      {d > today ? <span className="text-line-strong">·</span>
                        : <span className={clsx('inline-grid size-7 place-items-center rounded-full text-[11px]', done ? 'bg-life text-on-accent' : rest ? 'bg-surface-2 text-fg-3' : sch ? 'border border-line-strong' : 'text-line-strong')} title={rest ? L('راحة', 'Rest') : undefined}>{done ? <Check size={14} /> : rest ? '—' : ''}</span>}
                    </td>
                  );
                })}
                <td className="num text-center text-[12px] text-fg-2">{Math.round(consistency(h.data, logs, 7) * 100)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function HabitDetail({ habit, logs, onClose, weekStart }: { habit: Habit | null; logs?: Map<string, HabitLog>; onClose: () => void; weekStart: 0 | 1 | 6 }) {
  const { L, locale } = useI18n();
  if (!habit) return null;
  const values: Record<string, number> = {};
  for (const [k, l] of logs ?? []) values[k] = logDone(habit.data, l) ? 1 : l.data.value > 0 ? 0.5 : 0;
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const ws = shiftKey(weekStartKey(todayKey(), weekStart), -7 * (7 - i));
    let s = 0; let d = 0;
    for (const k of rangeKeys(ws, 7)) { if (k > todayKey() || !isScheduled(habit.data, k) || isPaused(habit.data, k)) continue; s++; if (logDone(habit.data, logs?.get(k))) d++; }
    return { label: fmtDate(ws, locale, { day: 'numeric', month: 'numeric' }), value: s ? Math.round((d / s) * 100) : 0 };
  });
  const notes = [...(logs?.values() ?? [])].filter((l) => l.data.note).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).slice(0, 5);
  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title={`${habit.data.icon} ${habit.data.name}`} wide>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label={L('السلسلة الحالية', 'Current streak')} value={streak(habit.data, logs, todayKey(), weekStart)} />
        <Stat label={L('أطول سلسلة', 'Longest')} value={bestStreak(habit.data, logs)} />
        <Stat label={L('الالتزام 30 يوم', '30-day consistency')} value={`${Math.round(consistency(habit.data, logs, 30) * 100)}%`} />
        <Stat label={L('مرات الإنجاز', 'Times done')} value={[...(logs?.values() ?? [])].filter((l) => logDone(habit.data, l)).length} />
      </div>
      <h3 className="mb-2 mt-5 text-[13px] font-bold text-fg-2">{L('آخر 6 أشهر', 'Last 6 months')}</h3>
      <Heatmap values={values} max={1} weeks={26} weekStart={weekStart} label={L('سجل العادة', 'Habit history')} />
      <h3 className="mb-2 mt-5 text-[13px] font-bold text-fg-2">{L('الالتزام الأسبوعي %', 'Weekly consistency %')}</h3>
      <Bars data={weeks} height={90} color="var(--life)" format={(v) => `${v}%`} />
      {notes.length > 0 && (
        <>
          <h3 className="mb-2 mt-5 text-[13px] font-bold text-fg-2">{L('ملاحظات', 'Notes')}</h3>
          <ul className="space-y-1 text-sm">{notes.map((n) => <li key={n.id}><span className="text-fg-3">{n.date}:</span> {n.data.note}</li>)}</ul>
        </>
      )}
    </Modal>
  );
}

/* ── Routines ─────────────────────────────────────────── */
function Routines({ habits, idx }: { habits: Habit[]; idx: Map<string, Map<string, HabitLog>> }) {
  const { L } = useI18n();
  const settings = useSettings();
  const routines = useRecords<RoutineData>('routine');
  const [running, setRunning] = useState<Rec<RoutineData> | null>(null);
  const [editing, setEditing] = useState<Rec<RoutineData> | null>(null);
  const today = todayKey();

  const fromTemplate = async (k: string) => {
    const t = TEMPLATES[k];
    await create<RoutineData>('routine', { name: L(t.ar, t.en), icon: t.icon, period: t.period, items: t.steps.map(([ar, en]) => ({ id: newId('r'), kind: 'step', text: L(ar, en) })) });
    toast(L('أُضيف الروتين — عدّله كما تحب', 'Routine added — tweak it as you like'));
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant="primary" icon={<Plus size={16} />} onClick={async () => { const r = await create<RoutineData>('routine', { name: L('روتين جديد', 'New routine'), icon: '✨', period: 'custom', items: [] }); setEditing(r); }}>{L('روتين', 'Routine')}</Button>
        {Object.entries(TEMPLATES).map(([k, t]) => <Button key={k} variant="ghost" onClick={() => fromTemplate(k)}>{t.icon} {L(t.ar, t.en)}</Button>)}
      </div>
      {!routines?.length ? <EmptyState icon={<ListOrdered size={28} />} title={L('الروتين = مجموعة خطوات مرتّبة', 'A routine is an ordered set of steps')} hint={L('ابدأ بقالب الصباح أو المساء.', 'Start from the morning or evening template.')} /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {routines.map((r) => {
            const doneIds = r.data.runs?.[today] ?? [];
            const total = r.data.items.length;
            const doneN = r.data.items.filter((it) => (it.kind === 'habit' && it.habit_id ? logDone(habits.find((h) => h.id === it.habit_id)?.data ?? ({} as HabitData), idx.get(it.habit_id)?.get(today)) : doneIds.includes(it.id))).length;
            return (
              <Card key={r.id} className="p-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{r.data.icon}</span>
                  <div className="min-w-0 flex-1"><div className="font-bold">{r.data.name}</div><div className="num text-[12px] text-fg-3">{doneN}/{total}</div></div>
                  <IconButton size="sm" label={L('تعديل', 'Edit')} onClick={() => setEditing(r)}><Settings2 size={16} /></IconButton>
                  <Button size="sm" variant="primary" icon={<Play size={14} />} disabled={!total} onClick={() => setRunning(r)}>{L('ابدأ', 'Start')}</Button>
                </div>
                <Bar className="mt-3" value={doneN} max={Math.max(1, total)} color="var(--life)" />
              </Card>
            );
          })}
        </div>
      )}
      {running && <RunRoutine r={running} habits={habits} idx={idx} onClose={() => setRunning(null)} settings={settings} />}
      {editing && <RoutineEditor r={editing} habits={habits} onClose={() => setEditing(null)} />}
    </div>
  );
}

function RunRoutine({ r, habits, idx, onClose, settings }: { r: Rec<RoutineData>; habits: Habit[]; idx: Map<string, Map<string, HabitLog>>; onClose: () => void; settings: ReturnType<typeof useSettings> }) {
  const { L } = useI18n();
  const today = todayKey();
  const [i, setI] = useState(0);
  const it = r.data.items[i];
  const habit = it?.kind === 'habit' ? habits.find((h) => h.id === it.habit_id) : undefined;
  const next = async () => {
    if (habit) { const log = idx.get(habit.id)?.get(today); if (!logDone(habit.data, log)) await toggleHabit(habit, today, log, settings); }
    else if (it) { const runs = { ...(r.data.runs ?? {}) }; runs[today] = [...new Set([...(runs[today] ?? []), it.id])]; for (const k of Object.keys(runs)) if (k < shiftKey(today, -60)) delete runs[k]; await update<RoutineData>(r.id, { data: { runs } }); r.data.runs = runs; }
    if (i + 1 >= r.data.items.length) { toast(L('أنهيت الروتين 🌿', 'Routine complete 🌿'), { tone: 'reward' }); onClose(); } else setI(i + 1);
  };
  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title={`${r.data.icon} ${r.data.name}`}>
      <div className="py-6 text-center">
        <div className="num text-[12px] text-fg-3">{i + 1} / {r.data.items.length}</div>
        <div className="mt-3 text-2xl font-black">{habit ? `${habit.data.icon} ${habit.data.name}` : it?.text}</div>
        <Bar className="mx-auto mt-6 max-w-xs" value={i} max={r.data.items.length} color="var(--life)" />
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="ghost" onClick={() => (i + 1 >= r.data.items.length ? onClose() : setI(i + 1))}>{L('تخطَّ', 'Skip')}</Button>
          <Button variant="primary" size="lg" icon={<Check size={18} />} onClick={next}>{L('تم', 'Done')}</Button>
        </div>
      </div>
    </Modal>
  );
}

function RoutineEditor({ r, habits, onClose }: { r: Rec<RoutineData>; habits: Habit[]; onClose: () => void }) {
  const { L } = useI18n();
  const [d, setD] = useState<RoutineData>(r.data);
  const [step, setStep] = useState('');
  const move = (i: number, dir: -1 | 1) => { const items = [...d.items]; const j = i + dir; if (j < 0 || j >= items.length) return; [items[i], items[j]] = [items[j], items[i]]; setD({ ...d, items }); };
  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title={L('تعديل الروتين', 'Edit routine')}
      footer={<>
        <Button variant="ghost" className="me-auto text-danger" onClick={async () => { await remove(r.id); onClose(); }}>{L('حذف', 'Delete')}</Button>
        <Button variant="primary" onClick={async () => { await update<RoutineData>(r.id, { data: d }); onClose(); }}>{L('حفظ', 'Save')}</Button>
      </>}>
      <div className="space-y-3">
        <div className="flex gap-2">
          <input className="field w-14 text-center text-xl" value={d.icon} onChange={(e) => setD({ ...d, icon: e.target.value })} aria-label={L('أيقونة', 'Icon')} />
          <Input className="flex-1" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} aria-label={L('الاسم', 'Name')} />
        </div>
        <Select label={L('الفترة', 'Period')} value={d.period} onChange={(e) => setD({ ...d, period: e.target.value as RoutineData['period'] })}>
          <option value="morning">{L('صباح', 'Morning')}</option><option value="evening">{L('مساء', 'Evening')}</option><option value="study">{L('مذاكرة', 'Study')}</option>
          <option value="exercise">{L('رياضة', 'Exercise')}</option><option value="work">{L('عمل', 'Work')}</option><option value="weekend">{L('عطلة', 'Weekend')}</option><option value="custom">{L('مخصص', 'Custom')}</option>
        </Select>
        <ol className="space-y-1">
          {d.items.map((it, i) => {
            const h = habits.find((x) => x.id === it.habit_id);
            return (
              <li key={it.id} className="flex items-center gap-2 rounded-sm bg-surface-2 px-2 py-1.5 text-sm">
                <span className="num w-5 text-fg-3">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{it.kind === 'habit' ? `${h?.data.icon ?? ''} ${h?.data.name ?? '?'}` : it.text}</span>
                <button aria-label="up" onClick={() => move(i, -1)} className="px-1 text-fg-3">↑</button>
                <button aria-label="down" onClick={() => move(i, 1)} className="px-1 text-fg-3">↓</button>
                <button aria-label={L('حذف', 'Remove')} onClick={() => setD({ ...d, items: d.items.filter((x) => x.id !== it.id) })} className="text-fg-3"><X size={14} /></button>
              </li>
            );
          })}
        </ol>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!step.trim()) return; setD({ ...d, items: [...d.items, { id: newId('r'), kind: 'step', text: step.trim() }] }); setStep(''); }}>
          <input className="field" value={step} onChange={(e) => setStep(e.target.value)} placeholder={L('خطوة جديدة…', 'New step…')} />
          <IconButton type="submit" label={L('إضافة', 'Add')}><Plus size={18} /></IconButton>
        </form>
        {habits.length > 0 && (
          <Select value="" onChange={(e) => e.target.value && setD({ ...d, items: [...d.items, { id: newId('r'), kind: 'habit', habit_id: e.target.value }] })} aria-label={L('أضف عادة', 'Add habit')}>
            <option value="">{L('+ أضف عادة موجودة', '+ Add an existing habit')}</option>
            {habits.map((h) => <option key={h.id} value={h.id}>{h.data.icon} {h.data.name}</option>)}
          </Select>
        )}
      </div>
    </Modal>
  );
}
