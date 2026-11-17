import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Timer, Droplets, Dumbbell, CalendarDays, AlertCircle, Sparkles, Flame, ArrowUpRight, Target, Trophy, Moon, Apple, BookOpen, Wallet, Clock, PenLine, Check } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { updateSettings, useNow, useProfile, useRecords, useSettings } from '@/core/hooks';
import { fmtDate, fmtDuration, fmtTime, greeting, hijri, relativeDay, shiftKey, specialDay } from '@/core/dates';
import { create } from '@/core/repo';
import { db } from '@/core/db';
import { toast } from '@/core/toast';
import { useXp } from '@/core/xp';
import { levelTitle } from '@shared/xp';
import { Bar, Button, CardHeader, CheckCircle, Ring, Stat } from '@/design/ui';
import { Heatmap } from '@/design/charts';
import { logWater, blankNote, type NoteData } from '@/modules/shared/domain';
import { TaskRow } from '../tasks/TaskRow';
import { suggestNext, type Task } from '../tasks/model';
import { logDone, toggleHabit } from '../habits/model';
import type { DashData, Range } from './data';

export interface WidgetProps { d: DashData; range: Range }

export function W({ children, className, accent }: { children: ReactNode; className?: string; accent?: string }) {
  return <section className={`card h-full p-4 md:p-5 ${className ?? ''}`} style={accent ? { borderTop: `3px solid ${accent}` } : undefined}>{children}</section>;
}

const MESSAGES: Array<[string, string]> = [
  ['خطوة واحدة مهمة تكفي للبداية.', 'One meaningful step is enough to begin.'],
  ['التقدم، مو الكمال.', 'Progress, not perfection.'],
  ['خلّ اليوم يحسب.', 'Make today count.'],
  ['ابدأ بالأصعب وهو صغير.', 'Start the hard thing while it is small.'],
  ['الاستمرار يغلب الحماس.', 'Consistency beats intensity.'],
  ['ارتاح إذا احتجت، بس لا توقف.', 'Rest if you need to — just do not quit.'],
  ['يوم هادئ ومركّز أفضل من يوم مزدحم.', 'A calm focused day beats a busy one.'],
  ['أنجز أقل، بس أنجزه بإتقان.', 'Do less, but do it well.'],
];

/* ── Layer 1: welcome ── */
export function WelcomeWidget({ d }: WidgetProps) {
  const { L, lang, locale } = useI18n();
  const settings = useSettings();
  const profile = useProfile();
  const now = useNow(30_000);
  const nav = useNavigate();
  const [editing, setEditing] = useState(false);
  const intention = settings.intention?.date === d.today ? settings.intention.text : '';
  const special = specialDay(d.today, lang);
  const planned = d.todayTasks.length + d.habitsScheduledToday;
  const doneN = d.doneToday + d.habitsDoneToday;
  const pct = planned ? Math.round((doneN / Math.max(planned, doneN)) * 100) : 0;
  const msg = MESSAGES[(Number(d.today.replace(/-/g, '')) % MESSAGES.length)];

  return (
    <W className="relative overflow-hidden">
      <div className="flex flex-wrap items-start gap-5">
        <div className="min-w-0 flex-1">
          <div className="eyebrow">{fmtDate(d.today, locale)} · {hijri(d.today, lang, { day: 'numeric', month: 'long' })}</div>
          <h1 className="mt-1 text-[26px] font-black leading-tight md:text-[32px]">
            {greeting(lang, now.getHours())}{profile.display_name ? `، ${profile.display_name}` : ''}
          </h1>
          <p className="mt-1 text-fg-2">
            <span className="num font-bold text-fg">{new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', hour12: settings.timeFormat === '12' }).format(now)}</span>
            {settings.encouragement && <> · {L(msg[0], msg[1])}</>}
            {special && <span className="ms-2 rounded-full bg-[color-mix(in_oklab,var(--reward)_18%,transparent)] px-2 py-0.5 text-[12px] font-bold text-reward">{special}</span>}
          </p>
          <div className="mt-3">
            {editing ? (
              <form onSubmit={async (e) => { e.preventDefault(); const t = (new FormData(e.currentTarget).get('i') as string).trim(); await updateSettings({ intention: t ? { date: d.today, text: t } : null }); setEditing(false); }}>
                <input name="i" defaultValue={intention} autoFocus className="field" placeholder={L('نيّتي لليوم…', "Today's intention…")} onBlur={(e) => e.currentTarget.form?.requestSubmit()} />
              </form>
            ) : (
              <button onClick={() => setEditing(true)} className="inline-flex items-center gap-2 text-start text-sm text-fg-2 hover:text-fg">
                <PenLine size={15} /> {intention ? <span className="font-bold text-fg">«{intention}»</span> : L('اكتب نيّتك لليوم', 'Set an intention for today')}
              </button>
            )}
          </div>
        </div>
        <Ring value={doneN} max={Math.max(planned, doneN, 1)} size={92} stroke={8} color="var(--life)" label={L(`${pct}% من خطة اليوم`, `${pct}% of today's plan`)}>
          <div><div className="num text-xl font-black">{pct}%</div><div className="text-[10.5px] text-fg-3">{doneN}/{Math.max(planned, doneN)}</div></div>
        </Ring>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="primary" icon={<Plus size={15} />} onClick={() => window.dispatchEvent(new Event('dq:capture'))}>{L('إضافة', 'Capture')}</Button>
        <Button size="sm" icon={<Timer size={15} />} onClick={() => nav('/study/focus?start=1')}>{L('ركّز', 'Focus')}</Button>
        <Button size="sm" icon={<Droplets size={15} />} onClick={async () => { await logWater(250); toast(L('+250 مل', '+250 ml')); }}>{L('ماء', 'Water')}</Button>
        <Button size="sm" icon={<Dumbbell size={15} />} onClick={() => nav('/health/workouts?start=1')}>{L('تمرين', 'Workout')}</Button>
      </div>
    </W>
  );
}

/* ── Layer 2: today at a glance ── */
export function GlanceWidget({ d, range }: WidgetProps) {
  const { L, lang, fmtNum } = useI18n();
  const settings = useSettings();
  const active = useLiveQuery(() => db().meta.get('focus_active'), []);
  const items: Array<{ icon: ReactNode; label: string; value: ReactNode; sub?: ReactNode; to: string; tone?: string }> = [
    { icon: <Check size={16} />, label: L('مهام اليوم', "Today's tasks"), value: `${d.doneToday}/${Math.max(d.todayTasks.length, d.doneToday)}`, sub: d.overdue.length ? <span className="text-danger">{d.overdue.length} {L('متأخرة', 'overdue')}</span> : L('لا متأخرات', 'nothing overdue'), to: '/life/today' },
    { icon: <Flame size={16} />, label: L('العادات', 'Habits'), value: `${d.habitsDoneToday}/${d.habitsScheduledToday}`, sub: `${Math.round(d.habitConsistency7 * 100)}% ${L('آخر 7 أيام', 'last 7 days')}`, to: '/life/habits' },
    { icon: <BookOpen size={16} />, label: range === 'day' ? L('مذاكرة اليوم', 'Studied today') : L('مذاكرة الفترة', 'Studied'), value: fmtDuration(d.studyMinutes, lang), sub: active?.value ? <span className="text-study">● {L('جلسة جارية', 'session running')}</span> : `${L('الهدف', 'goal')} ${fmtDuration(settings.study.dailyStudyGoalMin, lang)}`, to: '/study/focus', tone: 'var(--study)' },
    { icon: <Droplets size={16} />, label: L('الماء', 'Water'), value: `${fmtNum(d.waterMl)}`, sub: `/ ${fmtNum(settings.health.waterGoal)} ${L('مل', 'ml')}`, to: '/health/water', tone: 'var(--health)' },
    { icon: <Apple size={16} />, label: L('السعرات', 'Calories'), value: fmtNum(d.kcal), sub: `/ ${fmtNum(settings.health.calorieGoal)} · ${L('بروتين', 'protein')} ${Math.round(d.protein)}g`, to: '/health/nutrition', tone: 'var(--health)' },
    { icon: <Dumbbell size={16} />, label: L('التمرين', 'Workout'), value: d.workoutToday ? L('تم ✓', 'Done ✓') : L('لا', 'Not yet'), sub: `${d.workoutsInRange} ${range === 'day' ? L('اليوم', 'today') : L('في الفترة', 'in range')}`, to: '/health/workouts', tone: 'var(--health)' },
    { icon: <Moon size={16} />, label: L('النوم', 'Sleep'), value: d.sleepHours != null ? `${d.sleepHours.toFixed(1)}${L('س', 'h')}` : '—', sub: d.sleepHours == null ? L('لم يُسجّل', 'not logged') : `${L('الهدف', 'goal')} ${settings.health.sleepGoalHours}${L('س', 'h')}`, to: '/health/sleep', tone: 'var(--health)' },
    { icon: <CalendarDays size={16} />, label: L('مواعيد قادمة', 'Upcoming'), value: d.events.filter((e) => e.date === d.today).length, sub: d.events[0] ? `${relativeDay(d.events[0].date, lang, 'ar')} · ${d.events[0].rec.data.title}` : L('لا مواعيد', 'nothing scheduled'), to: '/life/calendar' },
  ];
  return (
    <W>
      <CardHeader eyebrow={L('نظرة سريعة', 'At a glance')} title={range === 'day' ? L('يومك', 'Your day') : range === 'week' ? L('أسبوعك', 'Your week') : L('شهرك', 'Your month')} />
      <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
        {items.map((it) => (
          <Link key={it.label} to={it.to} className="group rounded-sm p-1 -m-1 hover:bg-surface-2">
            <div className="mb-1 flex items-center gap-1.5 text-fg-3" style={it.tone ? { color: it.tone } : undefined}>{it.icon}<span className="truncate text-[12px] font-bold text-fg-3">{it.label}</span></div>
            <div className="num text-[22px] font-black leading-none">{it.value}</div>
            {it.sub && <div className="mt-1 truncate text-[12px] text-fg-2">{it.sub}</div>}
          </Link>
        ))}
      </div>
    </W>
  );
}

/* ── Layer 3: action center ── */
export function PrioritiesWidget({ d }: WidgetProps) {
  const { L } = useI18n();
  const settings = useSettings();
  const top = (settings as unknown as { top3?: { date: string; ids: string[] } }).top3;
  const ids = top?.date === d.today ? top.ids : [];
  const byId = new Map(d.tasks.map((t) => [t.id, t]));
  const chosen = ids.map((id) => byId.get(id)).filter(Boolean) as Task[];
  const candidates = d.todayTasks.filter((t) => t.status !== 'done' && !ids.includes(t.id)).sort((a, b) => b.data.priority - a.data.priority).slice(0, 6);
  const pick = (id: string) => updateSettings({ top3: { date: d.today, ids: [...ids, id].slice(0, 3) } } as never);
  const allDone = chosen.length > 0 && chosen.every((t) => t.status === 'done');
  return (
    <W accent="var(--life)">
      <CardHeader eyebrow={L('أهم 3', 'Top 3')} title={L('أولويات اليوم', "Today's priorities")} icon={<Target size={17} />} />
      {allDone && <p className="anim-in mb-2 rounded-sm bg-[color-mix(in_oklab,var(--success)_14%,transparent)] px-3 py-2 text-sm font-bold text-success">{L('أنجزت أولوياتك كلها. يوم جميل 🌿', 'All priorities done. Beautiful day 🌿')}</p>}
      <div className="divide-y divide-line">
        {chosen.map((t, i) => (
          <div key={t.id} className="flex items-center gap-1">
            <span className="num w-5 text-center text-sm font-black text-fg-3">{i + 1}</span>
            <div className="min-w-0 flex-1"><TaskRow task={t} compact /></div>
            <button className="px-1 text-[12px] text-fg-3 hover:text-danger" aria-label={L('إزالة من الأولويات', 'Remove from priorities')} onClick={() => updateSettings({ top3: { date: d.today, ids: ids.filter((x) => x !== t.id) } } as never)}>×</button>
          </div>
        ))}
      </div>
      {chosen.length < 3 && (
        candidates.length ? (
          <div className="mt-2">
            <div className="mb-1 text-[12px] text-fg-3">{L('اختر من مهام اليوم:', 'Pick from today:')}</div>
            <div className="flex flex-wrap gap-1.5">
              {candidates.map((t) => <button key={t.id} onClick={() => pick(t.id)} className="max-w-full truncate rounded-full border border-dashed border-line-strong px-2.5 py-1 text-[12.5px] text-fg-2 hover:border-life hover:text-fg">+ {t.data.title}</button>)}
            </div>
          </div>
        ) : !chosen.length && <p className="text-sm text-fg-2">{L('ما عندك مهام لليوم. أضف وحدة واختَرها هنا.', 'No tasks for today. Add one and pick it here.')}</p>
      )}
    </W>
  );
}

export function TimelineWidget({ d }: WidgetProps) {
  const { L, locale } = useI18n();
  const settings = useSettings();
  const now = useNow(60_000);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const items = [
    ...d.events.filter((e) => e.date === d.today).map((e) => ({ id: e.rec.id, time: e.rec.data.start_time, end: e.rec.data.end_time, title: e.rec.data.title, kind: 'event' as const, allDay: e.rec.data.all_day })),
    ...d.todayTasks.filter((t) => (t.data.start === d.today && t.data.start_time) || (t.data.due === d.today && t.data.due_time)).map((t) => ({ id: t.id, time: t.data.start_time ?? t.data.due_time, end: null, title: t.data.title, kind: 'task' as const, allDay: false, done: t.status === 'done' })),
  ].sort((a, b) => (a.allDay ? -1 : b.allDay ? 1 : (a.time ?? '').localeCompare(b.time ?? '')));
  return (
    <W>
      <CardHeader eyebrow={L('جدول اليوم', 'Schedule')} title={L('خط اليوم الزمني', "Today's timeline")} icon={<Clock size={17} />} action={<Link to="/life/calendar" className="text-[12px] font-bold text-accent">{L('التقويم', 'Calendar')}</Link>} />
      {items.length === 0 ? <p className="text-sm text-fg-2">{L('ما فيه شي مجدول بوقت اليوم. وقتك حر.', 'Nothing time-blocked today. Your time is free.')}</p> : (
        <ol className="relative space-y-2 border-s border-line ps-4">
          {items.map((it) => {
            const [h, m] = (it.time ?? '00:00').split(':').map(Number);
            const past = !it.allDay && h * 60 + m < nowMin;
            return (
              <li key={`${it.kind}${it.id}`} className={`relative ${past ? 'opacity-55' : ''}`}>
                <span className="absolute -start-[21px] top-1.5 size-2.5 rounded-full border-2 border-surface" style={{ background: it.kind === 'event' ? 'var(--study)' : 'var(--life)' }} />
                <div className="num text-[12px] font-bold text-fg-3">{it.allDay ? L('طوال اليوم', 'All day') : `${fmtTime(it.time, locale, settings.timeFormat === '12')}${it.end ? ` – ${fmtTime(it.end, locale, settings.timeFormat === '12')}` : ''}`}</div>
                <div className={`text-sm ${'done' in it && it.done ? 'text-fg-3 line-through' : 'font-bold'}`}>{it.title}</div>
              </li>
            );
          })}
        </ol>
      )}
    </W>
  );
}

export function DeadlinesWidget({ d }: WidgetProps) {
  const { L, lang, locale } = useI18n();
  const list = [...d.overdue, ...d.deadlines].slice(0, 6);
  const exams = d.exams.slice(0, 3);
  return (
    <W>
      <CardHeader eyebrow={L('مواعيد نهائية', 'Deadlines')} title={L('القادم والمتأخر', 'Upcoming & overdue')} icon={<AlertCircle size={17} />} />
      {!list.length && !exams.length ? <p className="text-sm text-fg-2">{L('لا مواعيد نهائية هذا الأسبوع.', 'No deadlines this week.')}</p> : (
        <ul className="space-y-2">
          {exams.map((e) => (
            <li key={e.id} className="flex items-center gap-2 text-sm">
              <span className="rounded-xs bg-[color-mix(in_oklab,var(--study)_18%,transparent)] px-1.5 text-[11px] font-bold text-study">{L('اختبار', 'Exam')}</span>
              <span className="min-w-0 flex-1 truncate font-bold">{e.data.title}</span>
              <span className="num text-[12px] text-fg-2">{relativeDay(e.date!, lang, locale)}</span>
            </li>
          ))}
          {list.map((t) => (
            <li key={t.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{t.data.title}</span>
              <span className={`num text-[12px] ${t.data.due! < d.today ? 'font-bold text-danger' : 'text-fg-2'}`}>{relativeDay(t.data.due!, lang, locale)}</span>
            </li>
          ))}
        </ul>
      )}
    </W>
  );
}

export function SuggestedWidget({ d }: WidgetProps) {
  const { L } = useI18n();
  const next = suggestNext(d.tasks, d.today);
  const nextEvent = d.events.find((e) => e.date > d.today || (e.date === d.today && (e.rec.data.start_time ?? '99') >= new Date().toTimeString().slice(0, 5)));
  return (
    <W>
      <CardHeader eyebrow={L('التالي', 'Next')} title={L('خطوتك التالية', 'Your next step')} icon={<Sparkles size={17} />} />
      {next ? <TaskRow task={next} /> : <p className="text-sm text-fg-2">{L('ما فيه مهام مفتوحة. ابدأ بمهمة واحدة.', 'No open tasks. Start with one.')}</p>}
      {nextEvent && (
        <div className="mt-3 border-t border-line pt-3 text-sm">
          <div className="text-[12px] text-fg-3">{L('الموعد القادم', 'Next event')}</div>
          <div className="font-bold">{nextEvent.rec.data.title}</div>
          <div className="text-[12px] text-fg-2">{nextEvent.date} {nextEvent.rec.data.start_time ?? ''}</div>
        </div>
      )}
    </W>
  );
}

export function RoutineWidget({ d }: WidgetProps) {
  const { L } = useI18n();
  const settings = useSettings();
  const todays = d.habits.filter((h) => !h.data.schedule || h.data.schedule.type !== 'weekdays' || h.data.schedule.days?.includes(new Date().getDay())).sort((a, b) => a.data.order - b.data.order).slice(0, 8);
  return (
    <W>
      <CardHeader eyebrow={L('روتين اليوم', "Today's routine")} title={L('العادات', 'Habits')} icon={<Flame size={17} />} action={<Link to="/life/habits" className="text-[12px] font-bold text-accent">{L('الكل', 'All')}</Link>} />
      {!todays.length ? <p className="text-sm text-fg-2">{L('أضف عادة صغيرة تبي تبنيها.', 'Add a small habit you want to build.')}</p> : (
        <ul className="space-y-1.5">
          {todays.map((h) => {
            const log = d.habitLogs.get(h.id)?.get(d.today);
            const done = logDone(h.data, log);
            return (
              <li key={h.id} className="flex items-center gap-2.5">
                <CheckCircle checked={done} onToggle={() => void toggleHabit(h, d.today, log, settings)} label={h.data.name} color="var(--life)" />
                <span className="text-lg leading-none">{h.data.icon}</span>
                <span className={`min-w-0 flex-1 truncate text-sm ${done ? 'text-fg-3 line-through' : ''}`}>{h.data.name}</span>
              </li>
            );
          })}
        </ul>
      )}
    </W>
  );
}

export function QuickNoteWidget() {
  const { L } = useI18n();
  const [text, setText] = useState('');
  const save = async () => {
    if (!text.trim()) return;
    const [first, ...rest] = text.trim().split('\n');
    await create<NoteData>('note', blankNote({ title: first.slice(0, 80), body: rest.join('\n') || (first.length > 80 ? first : ''), note_type: 'quick' }));
    setText('');
    toast(L('حُفظت في الملاحظات', 'Saved to notes'));
  };
  return (
    <W>
      <CardHeader eyebrow={L('ملاحظة سريعة', 'Quick note')} title={L('فكرة على البال؟', 'Something on your mind?')} />
      <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void save(); }} className="field min-h-24 resize-none" placeholder={L('اكتب… (Ctrl+Enter للحفظ)', 'Write… (Ctrl+Enter to save)')} aria-label={L('ملاحظة', 'Note')} />
      <Button size="sm" className="mt-2" onClick={save} disabled={!text.trim()}>{L('حفظ', 'Save')}</Button>
    </W>
  );
}

export function FocusWidget({ d }: WidgetProps) {
  const { L, lang } = useI18n();
  const settings = useSettings();
  const active = useLiveQuery(() => db().meta.get('focus_active'), []);
  const now = useNow(1000);
  const a = active?.value as { started_at: string; planned_min: number; mode: string } | undefined;
  const elapsed = a ? Math.floor((now.getTime() - Date.parse(a.started_at)) / 1000) : 0;
  const days = Array.from({ length: 7 }, (_, i) => shiftKey(d.today, i - 6));
  return (
    <W accent="var(--study)">
      <CardHeader eyebrow={L('تركيز', 'Focus')} title={a ? L('جلسة جارية', 'Session running') : L('مؤقت التركيز', 'Focus timer')} icon={<Timer size={17} />} />
      {a ? (
        <div className="num text-3xl font-black text-study">{String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}</div>
      ) : (
        <div className="text-sm text-fg-2">{L(`اليوم: ${fmtDuration(d.studyByDay[d.today] ?? 0, lang)} من ${fmtDuration(settings.study.dailyStudyGoalMin, lang)}`, `Today: ${fmtDuration(d.studyByDay[d.today] ?? 0, lang)} of ${fmtDuration(settings.study.dailyStudyGoalMin, lang)}`)}</div>
      )}
      <Bar className="mt-3" value={d.studyByDay[d.today] ?? 0} max={settings.study.dailyStudyGoalMin} color="var(--study)" />
      <div className="mt-3 flex items-end gap-1" aria-hidden>
        {days.map((k) => <div key={k} className="flex-1 rounded-t-[3px] bg-study/70" style={{ height: `${Math.max(3, Math.min(48, ((d.studyByDay[k] ?? 0) / Math.max(1, settings.study.dailyStudyGoalMin)) * 48))}px`, background: 'var(--study)', opacity: k === d.today ? 1 : 0.5 }} />)}
      </div>
      <Link to="/study/focus?start=1" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-study">{a ? L('افتح المؤقت', 'Open timer') : L(`ابدأ ${settings.focus.work} دقيقة`, `Start ${settings.focus.work} min`)} <ArrowUpRight size={14} /></Link>
    </W>
  );
}

/* ── Layer 4: life balance ── */
export function BalanceWidget({ d }: WidgetProps) {
  const { L } = useI18n();
  const settings = useSettings();
  const goals = useRecords<{ area?: string | null; progress?: number; target?: number | null; current?: number | null }>('goal');
  // Activity per area over 30 days: completed tasks + completed habit logs + active goals linked to that area
  const since = shiftKey(d.today, -30);
  const rows = settings.lifeAreas.map((a) => {
    const tasksDone = d.tasks.filter((t) => t.data.area === a.id && t.status === 'done' && (t.data.completed_at ?? '').slice(0, 10) >= since).length;
    let habitDone = 0;
    for (const h of d.habits.filter((x) => x.data.area === a.id)) for (const [k, l] of d.habitLogs.get(h.id) ?? []) if (k >= since && logDone(h.data, l)) habitDone++;
    const gs = (goals ?? []).filter((g) => g.data.area === a.id && g.status !== 'done');
    return { a, count: tasksDone + habitDone, goals: gs.length };
  });
  const max = Math.max(1, ...rows.map((r) => r.count));
  const any = rows.some((r) => r.count || r.goals);
  return (
    <W>
      <CardHeader eyebrow={L('توازن الحياة', 'Life balance')} title={L('أين يذهب جهدك (30 يوماً)', 'Where your effort goes (30 days)')} />
      {!any ? (
        <p className="text-sm text-fg-2">{L('اربط مهامك وعاداتك وأهدافك بمجال حياة (من شاشة التعديل) ليظهر التوازن هنا.', 'Link tasks, habits and goals to a life area to see your balance here.')}</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map(({ a, count, goals: g }) => (
            <li key={a.id}>
              <div className="mb-1 flex items-center gap-2 text-[13px]"><span>{a.icon}</span><span className="flex-1">{a.name}</span><span className="num text-fg-2">{count}{g ? ` · ${g} ${L('هدف', 'goals')}` : ''}</span></div>
              <Bar value={count} max={max} color={a.color} label={a.name} />
            </li>
          ))}
        </ul>
      )}
      <Link to="/settings/categories" className="mt-3 inline-block text-[12px] text-fg-3 hover:text-fg">{L('عدّل مجالات الحياة', 'Edit life areas')}</Link>
    </W>
  );
}

/* ── Layer 5: personal journey ── */
export function JourneyWidget({ d }: WidgetProps) {
  const { L, lang } = useI18n();
  const settings = useSettings();
  const xp = useXp();
  const achievements = useRecords('achievement');
  if (!settings.gamification.enabled) {
    return (
      <W>
        <CardHeader eyebrow={L('رحلتي', 'Journey')} title={L('نشاطك', 'Your activity')} />
        <Heatmap values={d.activityByDay} weekStart={settings.weekStart} label={L('خريطة النشاط', 'Activity heatmap')} />
      </W>
    );
  }
  const lv = xp?.level;
  return (
    <W accent="var(--reward)">
      <CardHeader eyebrow={L('رحلتي', 'Journey')} title={lv ? `${L('المستوى', 'Level')} ${lv.level} · ${levelTitle(lv.level, settings.gamification.levelTitles ?? undefined, lang)}` : '…'} icon={<Trophy size={17} />} action={<Link to="/life/achievements" className="text-[12px] font-bold text-reward">{L('التفاصيل', 'Details')}</Link>} />
      {lv && (
        <>
          <div className="mb-1 flex justify-between text-[12px] text-fg-2"><span className="num">{xp!.total} XP</span><span className="num">{lv.need - lv.into} {L('للمستوى التالي', 'to next level')}</span></div>
          <Bar value={lv.into} max={lv.need} color="var(--reward)" />
        </>
      )}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label={L('الإنجازات', 'Achievements')} value={achievements?.length ?? 0} />
        <Stat label={L('أنجزت', 'Completed')} value={d.completedInRange} sub={L('في الفترة', 'in range')} />
        <Stat label={L('الالتزام', 'Consistency')} value={`${Math.round(d.habitConsistency7 * 100)}%`} sub={L('7 أيام', '7 days')} />
      </div>
      <div className="mt-4"><Heatmap values={d.activityByDay} weekStart={settings.weekStart} weeks={16} label={L('خريطة النشاط', 'Activity heatmap')} /></div>
      {!!xp?.recent.length && (
        <div className="mt-3 text-[12px] text-fg-2">{L('آخر إنجاز:', 'Latest win:')} <span className="font-bold text-fg">{xp.recent[0].label ?? ''}</span> <span className="num text-reward">+{xp.recent[0].amount}</span></div>
      )}
    </W>
  );
}

export function GoalsWidget() {
  const { L } = useI18n();
  const goals = useRecords<{ title: string; progress_mode?: string; target?: number | null; current?: number | null; horizon?: string; due?: string | null }>('goal');
  const tasks = useRecords<{ goal_id?: string | null }>('task');
  const list = useMemo(() => (goals ?? []).filter((g) => g.status !== 'done' && g.status !== 'archived').slice(0, 4).map((g) => {
    let pct: number;
    if (g.data.target) pct = Math.min(1, (g.data.current ?? 0) / g.data.target);
    else {
      const linked = (tasks ?? []).filter((t) => t.data.goal_id === g.id);
      pct = linked.length ? linked.filter((t) => t.status === 'done').length / linked.length : 0;
    }
    return { g, pct };
  }), [goals, tasks]);
  return (
    <W>
      <CardHeader eyebrow={L('أهداف بعيدة', 'Long-term')} title={L('تقدم الأهداف', 'Goal progress')} icon={<Target size={17} />} action={<Link to="/life/goals" className="text-[12px] font-bold text-accent">{L('الكل', 'All')}</Link>} />
      {!list.length ? <p className="text-sm text-fg-2">{L('حدّد هدف واحد يهمك. نحسب تقدمه من مهامه أو من رقم تقيسه.', 'Set one goal that matters. Progress comes from its tasks or a number you track.')}</p> : (
        <ul className="space-y-3">
          {list.map(({ g, pct }) => (
            <li key={g.id}>
              <div className="mb-1 flex justify-between text-sm"><span className="truncate font-bold">{g.data.title}</span><span className="num text-fg-2">{Math.round(pct * 100)}%</span></div>
              <Bar value={pct} max={1} />
            </li>
          ))}
        </ul>
      )}
    </W>
  );
}

export function MoneyWidget({ d, range }: WidgetProps) {
  const { L, fmtNum } = useI18n();
  const settings = useSettings();
  const budget = settings.finance.monthlyBudget;
  return (
    <W>
      <CardHeader eyebrow={L('المال', 'Money')} title={range === 'month' ? L('مصروف الشهر', 'Spent this month') : range === 'week' ? L('مصروف الأسبوع', 'Spent this week') : L('مصروف اليوم', 'Spent today')} icon={<Wallet size={17} />} action={<Link to="/life/finance" className="text-[12px] font-bold text-accent">{L('المالية', 'Finance')}</Link>} />
      <div className="num text-[26px] font-black">{fmtNum(d.spentInRange, { maximumFractionDigits: 0 })} <span className="text-sm font-bold text-fg-3">{settings.currency}</span></div>
      {budget && range === 'month' && <><Bar className="mt-2" value={d.spentInRange} max={budget} color={d.spentInRange > budget ? 'var(--danger)' : 'var(--life)'} /><div className="mt-1 text-[12px] text-fg-2">{L('من ميزانية', 'of budget')} {fmtNum(budget)}</div></>}
    </W>
  );
}

export function StudyWidget({ d }: WidgetProps) {
  const { L, lang, locale } = useI18n();
  const lectures = useRecords<{ title: string; state?: string }>('lecture');
  const queue = (lectures ?? []).filter((l) => l.data.state === 'revision').length;
  return (
    <W accent="var(--study)">
      <CardHeader eyebrow={L('الدراسة', 'Study')} title={L('اختبارات قادمة', 'Upcoming exams')} icon={<BookOpen size={17} />} action={<Link to="/study" className="text-[12px] font-bold text-study">{L('الدراسة', 'Study')}</Link>} />
      {!d.exams.length ? <p className="text-sm text-fg-2">{L('لا اختبارات خلال 60 يوماً.', 'No exams in the next 60 days.')}</p> : (
        <ul className="space-y-2">
          {d.exams.slice(0, 4).map((e) => {
            const days = Math.round((Date.parse(e.date!) - Date.parse(d.today)) / 864e5);
            return (
              <li key={e.id} className="flex items-center gap-3">
                <div className="num grid size-11 shrink-0 place-items-center rounded-sm bg-[color-mix(in_oklab,var(--study)_15%,transparent)] text-center leading-none text-study">
                  <div><div className="text-base font-black">{days}</div><div className="text-[9px]">{L('يوم', 'days')}</div></div>
                </div>
                <div className="min-w-0"><div className="truncate text-sm font-bold">{e.data.title}</div><div className="text-[12px] text-fg-2">{fmtDate(e.date!, locale, { weekday: 'short', day: 'numeric', month: 'short' })}</div></div>
              </li>
            );
          })}
        </ul>
      )}
      {queue > 0 && <p className="mt-3 text-[12px] text-fg-2">{L(`${queue} محاضرة تحتاج مراجعة`, `${queue} lectures need revision`)}</p>}
      <span className="hidden">{lang}</span>
    </W>
  );
}
