import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ClipboardCheck, Printer, Sparkles, Check, CalendarPlus } from 'lucide-react';
import clsx from 'clsx';
import type { Rec } from '@shared/records';
import { useI18n } from '@/core/i18n';
import { useRecord, useSettings } from '@/core/hooks';
import { db } from '@/core/db';
import { create, update } from '@/core/repo';
import { fmtDate, fmtDuration, rangeKeys, shiftKey, todayKey, weekStartKey } from '@/core/dates';
import { grantXp } from '@/core/xp';
import { api } from '@/core/api';
import { toast } from '@/core/toast';
import { Button, Card, Chip, PageHeader, Segmented, Stat, Textarea } from '@/design/ui';
import { Bars } from '@/design/charts';
import { saveTask, type TaskData } from './tasks/model';
import { indexLogs, isPaused, isScheduled, logDone, type HabitData } from './habits/model';

type Kind = 'daily' | 'weekly' | 'monthly' | 'annual';
interface ReviewData { kind: Kind; period: string; answers: Record<string, string>; mood: number | null; energy: number | null; completed: boolean; stats?: Record<string, number> }

const QUESTIONS: Record<Kind, Array<[string, string, string]>> = {
  daily: [['well', 'وش اللي مشى زين اليوم؟', 'What went well today?'], ['learned', 'وش تعلمت؟', 'What did I learn?'], ['improve', 'وش ممكن أحسّن؟', 'What could I improve?'], ['tomorrow', 'وش المهم بكرة؟', 'What matters tomorrow?']],
  weekly: [['wins', 'أبرز إنجازات الأسبوع', 'Wins this week'], ['hard', 'وش كان صعب، وليش؟', 'What was hard, and why?'], ['lesson', 'درس أطبقه الأسبوع الجاي', 'A lesson to apply next week'], ['focus', 'تركيزي الأسبوع القادم', 'My focus next week']],
  monthly: [['proud', 'وش أكثر شي فخور فيه هالشهر؟', 'What am I most proud of this month?'], ['change', 'وش أبي أغيّر الشهر الجاي؟', 'What will I change next month?'], ['goals', 'كيف تقدمت أهدافي؟', 'How did my goals progress?']],
  annual: [['story', 'قصة سنتي في سطرين', 'My year in two lines'], ['best', 'أفضل لحظاتها', 'Best moments'], ['next', 'وش أبي من السنة الجاية؟', 'What do I want from next year?']],
};

function periodOf(kind: Kind, ref: string, weekStart: 0 | 1 | 6): { period: string; from: string; to: string } {
  if (kind === 'daily') return { period: ref, from: ref, to: ref };
  if (kind === 'weekly') { const s = weekStartKey(ref, weekStart); return { period: s, from: s, to: shiftKey(s, 6) }; }
  if (kind === 'monthly') { const m = ref.slice(0, 7); const last = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate(); return { period: m, from: `${m}-01`, to: `${m}-${String(last).padStart(2, '0')}` }; }
  return { period: ref.slice(0, 4), from: `${ref.slice(0, 4)}-01-01`, to: `${ref.slice(0, 4)}-12-31` };
}

export default function Reviews() {
  const { L, lang, locale, fmtNum } = useI18n();
  const settings = useSettings();
  const [params] = useSearchParams();
  const [kind, setKind] = useState<Kind>(params.get('weekly') ? 'weekly' : 'daily');
  const [ref, setRef] = useState(todayKey());
  const { period, from, to } = periodOf(kind, ref, settings.weekStart);
  const id = `review:${kind}:${period}`;
  const rec = useRecord<ReviewData>(id);
  const [d, setD] = useState<ReviewData>({ kind, period, answers: {}, mood: null, energy: null, completed: false });
  useEffect(() => { setD(rec?.data ?? { kind, period, answers: {}, mood: null, energy: null, completed: false }); }, [rec?.updated_at, kind, period]); // eslint-disable-line react-hooks/exhaustive-deps
  const [summary, setSummary] = useState<{ summary: string; wins?: string[]; suggestion?: string } | null>(null);

  const stats = useLiveQuery(async () => {
    const rs = await db().records.filter((r) => !r.deleted_at && ['task', 'study_session', 'habit', 'habit_log', 'workout', 'water_log', 'sleep_log', 'txn', 'xp', 'exam', 'project', 'achievement', 'journal'].includes(r.type)).toArray();
    const inRange = (k?: string | null) => !!k && k.slice(0, 10) >= from && k.slice(0, 10) <= to;
    const tasks = rs.filter((r) => r.type === 'task') as unknown as Array<Rec<TaskData>>;
    const completed = tasks.filter((t) => t.status === 'done' && inRange(t.data.completed_at));
    const unfinished = tasks.filter((t) => t.status !== 'done' && t.status !== 'archived' && !!(t.data.start ?? t.data.due) && (t.data.start ?? t.data.due)! <= to);
    const habits = rs.filter((r) => r.type === 'habit' && r.status !== 'archived') as unknown as Array<Rec<HabitData>>;
    const idx = indexLogs(rs.filter((r) => r.type === 'habit_log' && inRange(r.date)) as never);
    let s = 0; let dn = 0;
    for (const day of rangeKeys(from, Math.min(366, Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1))) {
      if (day > todayKey()) break;
      for (const h of habits) { if (!isScheduled(h.data, day) || isPaused(h.data, day)) continue; s++; if (logDone(h.data, idx.get(h.id)?.get(day) as never)) dn++; }
    }
    const studyMin = rs.filter((r) => r.type === 'study_session' && inRange(r.date)).reduce((a, r) => a + Number((r.data as { duration_min?: number }).duration_min ?? 0), 0);
    const sleeps = rs.filter((r) => r.type === 'sleep_log' && inRange(r.date) && !(r.data as { nap?: boolean }).nap);
    const nextFrom = shiftKey(to, 1);
    const nextTo = shiftKey(to, kind === 'weekly' ? 7 : 30);
    const byMonth: Record<string, number> = {};
    for (const t of completed) byMonth[t.data.completed_at!.slice(0, 7)] = (byMonth[t.data.completed_at!.slice(0, 7)] ?? 0) + 1;
    return {
      completed, unfinished, consistency: s ? dn / s : null, studyMin,
      workouts: rs.filter((r) => r.type === 'workout' && inRange(r.date)).length,
      water: rs.filter((r) => r.type === 'water_log' && inRange(r.date)).reduce((a, r) => a + Number((r.data as { ml?: number }).ml ?? 0), 0),
      sleepAvg: sleeps.length ? sleeps.reduce((a, r) => a + Number((r.data as { hours?: number }).hours ?? 0), 0) / sleeps.length : null,
      spent: rs.filter((r) => r.type === 'txn' && inRange(r.date) && (r.data as { kind?: string }).kind === 'expense' && !(r.data as { saving?: boolean }).saving).reduce((a, r) => a + Number((r.data as { amount?: number }).amount ?? 0), 0),
      xp: rs.filter((r) => r.type === 'xp' && inRange(r.date)).reduce((a, r) => a + Number((r.data as { amount?: number }).amount ?? 0), 0),
      wins: rs.filter((r) => r.type === 'xp' && inRange(r.date) && Number((r.data as { amount?: number }).amount) > 0).map((r) => String((r.data as { label?: string }).label ?? '')).filter(Boolean).slice(-8),
      achievements: rs.filter((r) => r.type === 'achievement' && inRange(r.date)).length,
      exams: rs.filter((r) => r.type === 'exam' && (r.date ?? '') >= nextFrom && (r.date ?? '') <= nextTo).map((r) => ({ title: String((r.data as { title?: string }).title), date: r.date! })),
      deadlines: tasks.filter((t) => t.status !== 'done' && !!t.data.due && t.data.due >= nextFrom && t.data.due <= nextTo),
      projectsDone: rs.filter((r) => r.type === 'project' && r.status === 'done' && inRange(r.updated_at)).length,
      journals: rs.filter((r) => r.type === 'journal' && inRange(r.date)).length,
      byMonth,
    };
  }, [from, to, kind]);

  const save = async (completed = d.completed) => {
    const data = { ...d, completed, stats: stats ? { tasks: stats.completed.length, studyMin: stats.studyMin, workouts: stats.workouts } : undefined };
    if (rec) await update<ReviewData>(id, { data });
    else await create<ReviewData>('review', data, { id, date: to > todayKey() ? todayKey() : to });
    if (completed && !d.completed) {
      await grantXp(`review:${kind}:${period}`, kind === 'weekly' ? 'weekly_review' : 'daily_review', settings, L('مراجعة', 'Review'));
      toast(L('اكتملت المراجعة ✨', 'Review complete ✨'), { tone: 'reward' });
    }
    setD(data);
  };

  const planNext = async (t: Rec<TaskData>, day: string) => saveTask(t.id, { ...t.data, start: day });
  const nextWeek = rangeKeys(shiftKey(to, 1), 7);
  const ai = async () => {
    if (!stats) return;
    try {
      const r = await api<{ result: { summary: string; wins?: string[]; suggestion?: string } }>('/ai/weekly_summary', { input: { stats: { completed_tasks: stats.completed.length, unfinished: stats.unfinished.length, habit_consistency_pct: stats.consistency === null ? null : Math.round(stats.consistency * 100), study_minutes: stats.studyMin, workouts: stats.workouts, avg_sleep_h: stats.sleepAvg, wins: stats.wins } } });
      setSummary(r.result);
    } catch (e) { toast((e as Error).message, { tone: 'error' }); }
  };

  const label = kind === 'daily' ? fmtDate(period, locale) : kind === 'weekly' ? `${fmtDate(from, locale, { day: 'numeric', month: 'short' })} – ${fmtDate(to, locale, { day: 'numeric', month: 'short' })}` : kind === 'monthly' ? new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(`${from}T00:00:00`)) : period;
  const step = (n: number) => setRef(kind === 'daily' ? shiftKey(ref, n) : kind === 'weekly' ? shiftKey(ref, 7 * n) : kind === 'monthly' ? (() => { const x = new Date(`${from}T00:00:00`); x.setMonth(x.getMonth() + n); return x.toISOString().slice(0, 10); })() : `${Number(period) + n}-06-01`);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={L('المراجعات', 'Reviews')} subtitle={L('نظرة صادقة ولطيفة على ما حدث فعلاً.', 'An honest, kind look at what actually happened.')}
        actions={<><Segmented value={kind} onChange={(v) => { setKind(v); setRef(v === 'weekly' ? shiftKey(todayKey(), -7) : todayKey()); }} options={[{ value: 'daily', label: L('يومية', 'Daily') }, { value: 'weekly', label: L('أسبوعية', 'Weekly') }, { value: 'monthly', label: L('شهرية', 'Monthly') }, { value: 'annual', label: L('سنوية', 'Annual') }]} /><Button icon={<Printer size={16} />} onClick={() => window.print()}>{L('طباعة', 'Print')}</Button></>} />
      <div className="mb-4 flex items-center gap-2"><Button size="sm" variant="ghost" onClick={() => step(-1)}>‹</Button><span className="flex-1 text-center font-bold">{label}</span><Button size="sm" variant="ghost" onClick={() => step(1)} disabled={from > todayKey()}>›</Button></div>

      <div className="print-area">
        {stats && (
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card className="p-4"><Stat label={L('مهام أُنجزت', 'Tasks done')} value={stats.completed.length} sub={stats.unfinished.length ? L(`${stats.unfinished.length} لم تكتمل`, `${stats.unfinished.length} unfinished`) : undefined} /></Card>
            <Card className="p-4"><Stat label={L('التزام العادات', 'Habit consistency')} value={stats.consistency === null ? '—' : `${Math.round(stats.consistency * 100)}%`} /></Card>
            <Card className="p-4"><Stat label={L('مذاكرة', 'Studied')} value={fmtDuration(stats.studyMin, lang)} /></Card>
            <Card className="p-4"><Stat label={L('تمارين', 'Workouts')} value={stats.workouts} sub={stats.sleepAvg != null ? `${L('نوم', 'sleep')} ${stats.sleepAvg.toFixed(1)}${L('س', 'h')}` : undefined} /></Card>
            {kind !== 'daily' && <Card className="p-4"><Stat label={L('مصروف', 'Spent')} value={`${fmtNum(Math.round(stats.spent))} ${settings.currency}`} /></Card>}
            {kind !== 'daily' && <Card className="p-4"><Stat label="XP" value={stats.xp} /></Card>}
            {kind !== 'daily' && <Card className="p-4"><Stat label={L('إنجازات جديدة', 'New achievements')} value={stats.achievements} /></Card>}
            {kind !== 'daily' && <Card className="p-4"><Stat label={L('مشاريع اكتملت', 'Projects done')} value={stats.projectsDone} /></Card>}
          </div>
        )}
        {kind === 'annual' && stats && (
          <Card className="mb-4 p-4"><div className="mb-2 text-[13px] font-bold text-fg-2">{L('مهام منجزة شهرياً', 'Tasks completed per month')}</div>
            <Bars data={Array.from({ length: 12 }, (_, i) => { const m = `${period}-${String(i + 1).padStart(2, '0')}`; return { label: new Intl.DateTimeFormat(locale, { month: 'narrow' }).format(new Date(`${m}-01T00:00:00`)), value: stats.byMonth[m] ?? 0 }; })} height={110} color="var(--life)" />
            {!Object.keys(stats.byMonth).length && <p className="mt-2 text-sm text-fg-3">{L('لا بيانات لهذه السنة بعد — لا نخترع تاريخاً.', 'No data for this year yet — we never invent history.')}</p>}
          </Card>
        )}
        {stats && stats.wins.length > 0 && <Card className="mb-4 p-4"><div className="mb-2 text-[13px] font-bold text-fg-2">🌟 {L('انتصارات', 'Wins')}</div><div className="flex flex-wrap gap-1.5">{stats.wins.map((w, i) => <Chip key={i}>{w}</Chip>)}</div></Card>}

        {kind === 'weekly' && stats && (
          <Card className="mb-4 p-4">
            <div className="mb-2 flex items-center gap-2 text-[13px] font-bold text-fg-2"><CalendarPlus size={15} />{L('خطط الأسبوع القادم', 'Plan next week')}</div>
            {(stats.exams.length > 0 || stats.deadlines.length > 0) && (
              <ul className="mb-3 space-y-1 text-sm">
                {stats.exams.map((e) => <li key={e.title + e.date}>📝 {e.title} · {fmtDate(e.date, locale, { weekday: 'short', day: 'numeric' })}</li>)}
                {stats.deadlines.map((t) => <li key={t.id}>⏰ {t.data.title} · {fmtDate(t.data.due!, locale, { weekday: 'short', day: 'numeric' })}</li>)}
              </ul>
            )}
            {!stats.unfinished.length ? <p className="text-sm text-fg-2">{L('لا مهام معلقة — بداية نظيفة.', 'Nothing left over — a clean start.')}</p> : (
              <ul className="divide-y divide-line">{stats.unfinished.slice(0, 15).map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm">{t.data.title}</span>
                  <div className="flex gap-1">{nextWeek.map((day) => <button key={day} onClick={() => planNext(t, day)} className={clsx('rounded-full px-2 py-0.5 text-[11px] font-bold', t.data.start === day ? 'bg-accent text-on-accent' : 'bg-surface-2 text-fg-2')}>{fmtDate(day, locale, { weekday: 'narrow' })}</button>)}</div>
                </li>
              ))}</ul>
            )}
            <p className="mt-2 text-[12px] text-fg-3">{L('يغيّر موعد العمل فقط، لا الموعد النهائي.', 'Changes the scheduled day only, never the deadline.')}</p>
          </Card>
        )}

        <Card className="p-5">
          {kind === 'daily' && (
            <div className="mb-4 grid grid-cols-2 gap-4">
              {(['mood', 'energy'] as const).map((k) => (
                <div key={k}><div className="mb-1.5 text-[13px] font-bold text-fg-2">{k === 'mood' ? L('المزاج', 'Mood') : L('الطاقة', 'Energy')}</div>
                  <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} aria-pressed={d[k] === n} onClick={() => setD({ ...d, [k]: d[k] === n ? null : n })} className={clsx('num size-9 rounded-full font-black', (d[k] ?? 0) >= n ? 'bg-life text-on-accent' : 'bg-surface-2 text-fg-3')}>{n}</button>)}</div></div>
              ))}
            </div>
          )}
          <div className="space-y-3">
            {QUESTIONS[kind].map(([k, ar, en]) => <Textarea key={k} label={L(ar, en)} className="[&_textarea]:min-h-16" value={d.answers[k] ?? ''} onChange={(e) => setD({ ...d, answers: { ...d.answers, [k]: e.target.value } })} />)}
          </div>
          {summary && <div className="mt-4 rounded-md bg-surface-2 p-3 text-sm"><p>{summary.summary}</p>{summary.suggestion && <p className="mt-1 font-bold">→ {summary.suggestion}</p>}</div>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => save(d.completed)}>{L('حفظ', 'Save')}</Button>
            {!d.completed && <Button variant="primary" icon={<Check size={16} />} onClick={() => save(true)}>{L('أكمل المراجعة', 'Complete review')}</Button>}
            {d.completed && <span className="inline-flex items-center gap-1 text-sm font-bold text-success"><ClipboardCheck size={16} />{L('مكتملة', 'Completed')}</span>}
            {kind === 'weekly' && settings.privacy.ai.enabled && <Button variant="ghost" icon={<Sparkles size={15} />} onClick={ai}>{L('ملخص ذكي', 'AI summary')}</Button>}
          </div>
        </Card>
      </div>
    </div>
  );
}
