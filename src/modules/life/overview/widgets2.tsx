import { useMemo } from 'react';
import { Link } from 'react-router';
import { Inbox, FileText, FolderKanban, CalendarDays, TrendingUp, HeartPulse, Gift, CheckCheck, Droplets, Apple, Moon, Dumbbell, Coins } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useRecords, useSettings } from '@/core/hooks';
import { fmtDuration, fmtTime, fromKey, relativeDay, shiftKey } from '@/core/dates';
import { useXp } from '@/core/xp';
import { levelTitle } from '@shared/xp';
import { Bar, CardHeader, Ring } from '@/design/ui';
import { Bars } from '@/design/charts';
import type { NoteData } from '@/modules/shared/domain';
import type { TaskData } from '../tasks/model';
import { projectProgress, type Milestone, type MilestoneData, type Project, type ProjectData } from '../goals/model';
import { W, type WidgetProps } from './widgets';

/**
 * Overview widgets added with the responsive redesign. Same rule as the rest of the
 * dashboard: every number is read from real records, and an empty widget says what to do next.
 */

const more = (to: string, label: string, cls = 'text-accent') => <Link to={to} className={`text-[12px] font-bold ${cls}`}>{label}</Link>;
const empty = (text: string) => <p className="rounded-sm bg-[color-mix(in_oklab,var(--accent)_16%,transparent)] px-3 py-2.5 text-sm text-fg-2">{text}</p>;

/** Inbox — unprocessed captures waiting to be clarified. */
export function InboxWidget({ d }: WidgetProps) {
  const { L, lang, locale } = useI18n();
  return (
    <W>
      <CardHeader eyebrow={L('الوارد', 'Inbox')} title={d.inbox.length ? L(`${d.inbox.length} بانتظار الفرز`, `${d.inbox.length} to process`) : L('الوارد فاضي', 'Inbox zero')} icon={<Inbox size={17} />} action={more('/life/inbox', L('افرز', 'Process'))} />
      {!d.inbox.length ? empty(L('التقط فكرتك التالية هنا — زر + أو حرف N.', 'Capture your next idea here — + or N.')) : (
        <ul className="space-y-1.5">
          {d.inbox.slice(0, 5).map((t) => (
            <li key={t.id} className="flex items-center gap-2 text-sm">
              <span className="size-1.5 shrink-0 rounded-full bg-accent-ink" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{t.data.title}</span>
              <span className="num shrink-0 text-[11.5px] text-fg-3">{relativeDay(t.created_at.slice(0, 10), lang, locale)}</span>
            </li>
          ))}
        </ul>
      )}
    </W>
  );
}

/** Recently edited notes. */
export function NotesWidget() {
  const { L, lang, locale } = useI18n();
  const notes = useRecords<NoteData>('note');
  const list = useMemo(() => [...(notes ?? [])].sort((a, b) => Number(b.data.pinned) - Number(a.data.pinned) || b.updated_at.localeCompare(a.updated_at)).slice(0, 5), [notes]);
  return (
    <W>
      <CardHeader eyebrow={L('الملاحظات', 'Notes')} title={L('آخر ما كتبت', 'Recent notes')} icon={<FileText size={17} />} action={more('/life/notes', L('الكل', 'All'))} />
      {!list.length ? empty(L('دوّن فكرتك الأولى — الملاحظات تترابط مع الوقت.', 'Jot your first idea — notes connect over time.')) : (
        <ul className="divide-y divide-line">
          {list.map((n) => (
            <li key={n.id}>
              <Link to={`/life/notes?open=${n.id}`} className="flex items-center gap-2 py-2 text-sm hover:text-accent-ink">
                <span className="min-w-0 flex-1 truncate font-bold">{n.data.title || L('بدون عنوان', 'Untitled')}</span>
                <span className="num shrink-0 text-[11.5px] text-fg-3">{relativeDay(n.updated_at.slice(0, 10), lang, locale)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </W>
  );
}

/** Active projects with progress from their tasks and milestones. */
export function ProjectsWidget() {
  const { L } = useI18n();
  const projects = useRecords<ProjectData>('project');
  const tasks = useRecords<TaskData>('task');
  const milestones = useRecords<MilestoneData>('milestone');
  const list = useMemo(() => (projects ?? []).filter((p) => p.status === 'active' || p.status === 'planning')
    .sort((a, b) => b.data.priority - a.data.priority || (a.data.due ?? '9').localeCompare(b.data.due ?? '9')).slice(0, 4)
    .map((p) => ({ p, pr: projectProgress(p as Project, tasks ?? [], (milestones ?? []) as Milestone[]) })), [projects, tasks, milestones]);
  return (
    <W>
      <CardHeader eyebrow={L('المشاريع', 'Projects')} title={L('قيد العمل', 'In progress')} icon={<FolderKanban size={17} />} action={more('/life/projects', L('الكل', 'All'))} />
      {!list.length ? empty(L('مشروع واحد بخطوة تالية واضحة يكفي.', 'One project with a clear next step is enough.')) : (
        <ul className="space-y-3">
          {list.map(({ p, pr }) => (
            <li key={p.id}>
              <Link to={`/life/projects?open=${p.id}`} className="block">
                <div className="mb-1 flex items-center gap-2 text-sm">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: p.data.color ?? 'var(--life)' }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-bold">{p.data.title}</span>
                  <span className="num text-[12px] text-fg-2">{pr.pct == null ? '—' : `${Math.round(pr.pct * 100)}%`}</span>
                </div>
                <Bar value={pr.pct ?? 0} max={1} color={p.data.color ?? 'var(--life)'} label={p.data.title} />
                {p.data.next_action && <div className="mt-1 truncate text-[12px] text-fg-3">{L('التالي:', 'Next:')} {p.data.next_action}</div>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </W>
  );
}

/** Seven-day calendar snapshot: events plus scheduled task counts per day. */
export function CalendarWidget({ d }: WidgetProps) {
  const { L, locale } = useI18n();
  const settings = useSettings();
  const days = Array.from({ length: 7 }, (_, i) => shiftKey(d.today, i));
  const tasksOn = (k: string) => d.tasks.filter((t) => t.status !== 'done' && (t.data.start ?? t.data.due) === k).length;
  const first = days.find((k) => d.events.some((e) => e.date === k));
  return (
    <W>
      <CardHeader eyebrow={L('التقويم', 'Calendar')} title={L('أسبوعك القادم', 'Your week ahead')} icon={<CalendarDays size={17} />} action={more('/life/calendar', L('افتح', 'Open'))} />
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((k) => {
          const ev = d.events.filter((e) => e.date === k).length;
          const tk = tasksOn(k);
          const isToday = k === d.today;
          return (
            <Link key={k} to={`/life/calendar?date=${k}`} className={`flex flex-col items-center gap-1 rounded-sm border py-2 text-center ${isToday ? 'border-transparent bg-accent text-on-accent' : 'border-line bg-surface hover:bg-surface-2'}`}>
              <span className="text-[10.5px] font-bold opacity-80">{new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(fromKey(k))}</span>
              <span className="num text-base font-black leading-none">{fromKey(k).getDate()}</span>
              <span className="flex h-2 items-center gap-0.5" aria-label={L(`${ev} موعد، ${tk} مهمة`, `${ev} events, ${tk} tasks`)}>
                {ev > 0 && <span className="size-1.5 rounded-full bg-study-ink" />}
                {tk > 0 && <span className="size-1.5 rounded-full bg-life-ink" />}
              </span>
            </Link>
          );
        })}
      </div>
      {first ? (
        <ul className="mt-3 space-y-1.5">
          {d.events.slice(0, 3).map((e) => (
            <li key={`${e.rec.id}${e.date}`} className="flex items-center gap-2 text-sm">
              <span className="num w-20 shrink-0 text-[12px] text-fg-3">{e.date === d.today ? L('اليوم', 'Today') : new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric' }).format(fromKey(e.date))}</span>
              <span className="min-w-0 flex-1 truncate font-bold">{e.rec.data.title}</span>
              {e.rec.data.start_time && !e.rec.data.all_day && <span className="num text-[12px] text-fg-2">{fmtTime(e.rec.data.start_time, locale, settings.timeFormat === '12')}</span>}
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 text-sm text-fg-2">{L('أسبوعك يبدأ بخطة واحدة.', 'Your week can begin with one plan.')}</p>}
    </W>
  );
}

/** Task progress: today's completion plus a 7-day bar chart of completed tasks. */
export function ProgressWidget({ d }: WidgetProps) {
  const { L, locale } = useI18n();
  const planned = Math.max(d.todayTasks.length, d.doneToday);
  const days = Array.from({ length: 7 }, (_, i) => shiftKey(d.today, i - 6));
  const week = days.reduce((s, k) => s + (d.completedByDay[k] ?? 0), 0);
  return (
    <W>
      <CardHeader eyebrow={L('تقدم المهام', 'Task progress')} title={L(`${week} مهمة منجزة هذا الأسبوع`, `${week} done in 7 days`)} icon={<CheckCheck size={17} />} action={more('/life/tasks', L('المهام', 'Tasks'))} />
      <div className="flex items-center gap-4">
        <Ring value={d.doneToday} max={Math.max(planned, 1)} size={74} stroke={8} color="var(--life)" label={L('إنجاز اليوم', "Today's completion")}>
          <div className="num text-base font-black">{d.doneToday}/{planned}</div>
        </Ring>
        <div className="min-w-0 flex-1">
          <Bars height={74} color="var(--life)" data={days.map((k) => ({ label: new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(fromKey(k)), value: d.completedByDay[k] ?? 0 }))} />
        </div>
      </div>
      {d.overdue.length > 0 && <p className="mt-2 text-[12.5px] font-bold text-danger">{L(`${d.overdue.length} مهمة متأخرة — اختر وحدة وأنهها.`, `${d.overdue.length} overdue — pick one and close it.`)}</p>}
    </W>
  );
}

/** Health snapshot: today's water, nutrition, sleep and training. */
export function HealthWidget({ d }: WidgetProps) {
  const { L, fmtNum } = useI18n();
  const settings = useSettings();
  const h = settings.health;
  const rows = [
    { icon: <Droplets size={15} />, label: L('الماء', 'Water'), v: d.waterMl, max: h.waterGoal, text: `${fmtNum(d.waterMl)} / ${fmtNum(h.waterGoal)} ${L('مل', 'ml')}`, to: '/health/water' },
    { icon: <Apple size={15} />, label: L('السعرات', 'Calories'), v: d.kcal, max: h.calorieGoal, text: `${fmtNum(d.kcal)} / ${fmtNum(h.calorieGoal)}`, to: '/health/nutrition' },
    { icon: <Moon size={15} />, label: L('النوم', 'Sleep'), v: d.sleepHours ?? 0, max: h.sleepGoalHours, text: d.sleepHours != null ? `${d.sleepHours.toFixed(1)} / ${h.sleepGoalHours} ${L('س', 'h')}` : L('لم يُسجّل', 'not logged'), to: '/health/sleep' },
  ];
  return (
    <W accent="var(--health)">
      <CardHeader eyebrow={L('الصحة', 'Health')} title={L('جسمك اليوم', 'Your body today')} icon={<HeartPulse size={17} />} action={more('/health', L('الصحة', 'Health'), 'text-health')} />
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.label}>
            <Link to={r.to} className="block">
              <div className="mb-1 flex items-center gap-1.5 text-[13px]"><span className="text-health">{r.icon}</span><span className="flex-1 font-bold">{r.label}</span><span className="num text-fg-2">{r.text}</span></div>
              <Bar value={r.v} max={r.max || 1} color="var(--health)" label={r.label} />
            </Link>
          </li>
        ))}
      </ul>
      <Link to="/health/workouts" className="mt-3 flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-[13px] hover:bg-surface-2">
        <Dumbbell size={15} className="text-health" />
        <span className="flex-1 font-bold">{d.workoutToday ? L('تمرّنت اليوم ✓', 'Trained today ✓') : L('لا تمرين اليوم بعد', 'No workout yet today')}</span>
      </Link>
    </W>
  );
}

/** Activity trends: 14 days of study minutes and completed tasks. */
export function TrendsWidget({ d }: WidgetProps) {
  const { L, lang, locale } = useI18n();
  const days = Array.from({ length: 14 }, (_, i) => shiftKey(d.today, i - 13));
  const lbl = (k: string) => (fromKey(k).getDay() === 0 || k === d.today ? new Intl.DateTimeFormat(locale, { day: 'numeric' }).format(fromKey(k)) : '');
  const studyTotal = days.reduce((s, k) => s + (d.study14[k] ?? 0), 0);
  const doneTotal = days.reduce((s, k) => s + (d.completedByDay[k] ?? 0), 0);
  return (
    <W>
      <CardHeader eyebrow={L('الاتجاهات', 'Trends')} title={L('آخر 14 يوماً', 'Last 14 days')} icon={<TrendingUp size={17} />} />
      {!studyTotal && !doneTotal ? empty(L('ابدأ بمهمة صغيرة أو جلسة تركيز — الرسم يتكوّن من نشاطك الحقيقي.', 'Start with one small task or a focus session — this chart grows from real activity.')) : (
        <div className="grid gap-5 sm:grid-cols-2">
          <div data-section="study">
            <div className="mb-2 flex items-baseline justify-between text-[12.5px]"><span className="font-bold">{L('المذاكرة', 'Study')}</span><span className="num text-fg-2">{fmtDuration(studyTotal, lang)}</span></div>
            <Bars height={84} color="var(--study)" format={(v) => fmtDuration(v, lang)} data={days.map((k) => ({ label: lbl(k), value: d.study14[k] ?? 0 }))} />
          </div>
          <div>
            <div className="mb-2 flex items-baseline justify-between text-[12.5px]"><span className="font-bold">{L('مهام منجزة', 'Tasks done')}</span><span className="num text-fg-2">{doneTotal}</span></div>
            <Bars height={84} color="var(--life)" data={days.map((k) => ({ label: lbl(k), value: d.completedByDay[k] ?? 0 }))} />
          </div>
        </div>
      )}
    </W>
  );
}

/** Compact reward progress: level bar, coins and the closest affordable reward. */
export function RewardWidget() {
  const { L, lang } = useI18n();
  const settings = useSettings();
  const xp = useXp();
  const rewards = useRecords<{ name: string; cost: number }>('reward');
  if (!settings.gamification.enabled) return null;
  const lv = xp?.level;
  const next = [...(rewards ?? [])].sort((a, b) => a.data.cost - b.data.cost).find((r) => r.data.cost > (xp?.coins ?? 0)) ?? null;
  return (
    <W accent="var(--reward)">
      <CardHeader eyebrow={L('المكافآت', 'Rewards')} title={lv ? `${L('المستوى', 'Level')} ${lv.level} · ${levelTitle(lv.level, settings.gamification.levelTitles ?? undefined, lang)}` : '…'} icon={<Gift size={17} />} action={more('/life/achievements', L('رحلتي', 'Journey'), 'text-reward')} />
      {lv && (
        <>
          <div className="mb-1 flex justify-between text-[12px] text-fg-2"><span className="num">{lv.into}/{lv.need} XP</span><span className="num inline-flex items-center gap-1 font-bold text-fg"><Coins size={13} className="text-reward" />{xp!.coins}</span></div>
          <Bar value={lv.into} max={lv.need} color="var(--reward)" label={L('التقدم للمستوى التالي', 'Progress to next level')} />
        </>
      )}
      <p className="mt-3 text-[12.5px] text-fg-2">
        {next ? L(`باقي ${next.data.cost - (xp?.coins ?? 0)} عملة على «${next.data.name}»`, `${next.data.cost - (xp?.coins ?? 0)} coins to “${next.data.name}”`)
          : rewards?.length ? L('تقدر تستبدل أي مكافأة الحين 🎉', 'You can redeem any reward now 🎉') : L('أضف مكافأة حقيقية تحبها لتعمل لها.', 'Add a real reward you love to work toward.')}
      </p>
    </W>
  );
}
