import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import clsx from 'clsx';
import type { Rec } from '@shared/records';
import { useI18n } from '@/core/i18n';
import { useRecord, useRecords, useRecordsInRange, useSettings } from '@/core/hooks';
import { update } from '@/core/repo';
import { fmtDate, fromKey, rangeKeys, shiftKey, todayKey, weekStartKey } from '@/core/dates';
import type { JournalData, TxnData } from '@/modules/shared/domain';
import { useCalendarItems, type CalItem } from './calendar/sources';
import { isDone, saveTask, taskDay, type TaskData } from './tasks/model';
import { goalProgress, type GoalData, type MilestoneData } from './goals/model';
import { indexLogs, logDone, type HabitData, type HabitLogData } from './habits/model';
import { Box, WriteLine } from './today/Trackers';
import { dayMood } from './today/dayPage';
import { monthBounds, monthPageId, patchMonthPage, shiftMonth, type MonthPageData, type WeekPageData } from './plan/periods';
import { PeriodNav, Ritual } from './plan/ui';

const SYM: Partial<Record<CalItem['kind'], string>> = { event: '○', exam: '★', assignment: '◇', deadline: '!' };
const MOOD = ['', '#C9B6EC', '#D8C9EE', '#F2E2B3', '#F2C75C', '#E9A23B'];

/**
 * The month, on its own page: a calendar of dates only (events, exams, deadlines, bills), 2–3 goals
 * with what each week took from them, the month list, money, habit and mood trackers, the future
 * log and the month-end reflection. Day details stay on the day page.
 */
export default function Month() {
  const { L, locale } = useI18n();
  const settings = useSettings();
  const [params, setParams] = useSearchParams();
  const today = todayKey();
  const thisMonth = today.slice(0, 7);
  const raw = params.get('m') ?? '';
  const m = /^\d{4}-\d{2}$/.test(raw) ? raw : thisMonth;
  const go = (x: string) => setParams(x === thisMonth ? {} : { m: x }, { replace: true });
  const { from, to, days: nDays } = monthBounds(m);
  const days = rangeKeys(from, nDays);
  const prevM = shiftMonth(m, -1);

  const page = useRecord<MonthPageData>(monthPageId(m))?.data;
  const items = useCalendarItems(from, to, settings);
  const later = useCalendarItems(monthBounds(shiftMonth(m, 1)).from, monthBounds(shiftMonth(m, 2)).to, settings);
  const tasks = useRecords<TaskData>('task');
  const goals = useRecords<GoalData>('goal');
  const milestones = useRecords<MilestoneData>('milestone');
  const reviews = useRecords<WeekPageData | MonthPageData>('review');
  const subs = useRecords<{ name: string; amount: number; next_date?: string; status?: string }>('subscription');
  const txns = useRecordsInRange<TxnData>('txn', from, to);
  const journal = useRecordsInRange<JournalData>('journal', from, to);
  const habits = useRecords<HabitData>('habit');
  const logs = useRecordsInRange<HabitLogData>('habit_log', from, to);
  const logIdx = useMemo(() => indexLogs(logs), [logs]);

  // calendar: dates only — no tasks, no classes
  const dated = (items ?? []).filter((i) => i.kind === 'event' || i.kind === 'exam' || i.kind === 'assignment' || i.kind === 'deadline');
  const bills = (subs ?? []).filter((s) => s.data.next_date && s.data.next_date >= from && s.data.next_date <= to && s.data.status !== 'cancelled');
  const spentOn = (d: string) => (txns ?? []).filter((x) => x.date === d && x.data.kind === 'expense').reduce((a, x) => a + x.data.amount, 0);
  const lead = (fromKey(from).getDay() - settings.weekStart + 7) % 7;
  const heads = rangeKeys(weekStartKey(from, settings.weekStart), 7).map((d) => fmtDate(d, locale, { weekday: 'short' }));

  // goals: month-horizon goals plus the ones pinned to this month; each shows what the weeks took from it
  const pinned = page?.goal_ids ?? [];
  const monthGoals = (goals ?? []).filter((g) => g.status !== 'archived' && (pinned.includes(g.id) || (g.data.horizon === 'month' && (!g.data.due || g.data.due.slice(0, 7) === m))));
  const otherGoals = (goals ?? []).filter((g) => g.status !== 'done' && g.status !== 'archived' && !monthGoals.includes(g));
  const weekPages = (reviews ?? []).filter((r) => (r.data as WeekPageData).kind === 'weekly' && r.data.period >= shiftKey(from, -6) && r.data.period <= to) as Array<Rec<WeekPageData>>;
  const fromGoal = (id: string) => weekPages.flatMap((w) => (w.data.big3 ?? []).filter((b) => b.goal_id === id && b.title));

  const thisWeek = weekStartKey(today, settings.weekStart);
  const open = (x: Rec<TaskData>) => !taskDay(x.data) && !isDone(x) && x.status !== 'archived';
  const monthList = (tasks ?? []).filter((x) => x.data.plan_month === m && open(x));
  const carried = m === thisMonth ? (tasks ?? []).filter((x) => x.data.plan_month === prevM && open(x)) : [];

  const past = days.filter((d) => d <= today);
  const expenses = (txns ?? []).filter((x) => x.data.kind === 'expense');
  const spent = expenses.reduce((a, x) => a + x.data.amount, 0);
  const budget = settings.finance.monthlyBudget;
  const cats = Object.entries(expenses.reduce<Record<string, number>>((a, x) => { const k = x.data.category ?? L('أخرى', 'Other'); a[k] = (a[k] ?? 0) + x.data.amount; return a; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const noSpend = past.filter((d) => !spentOn(d)).length;
  const activeHabits = (habits ?? []).filter((h) => h.status !== 'archived').sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0)).slice(0, 8);
  const moodOf = (d: string) => (d <= today ? dayMood(journal, d).mood : null);
  const answers = page?.answers ?? {};
  const setAnswer = (k: string, v: string) => void patchMonthPage(m, { answers: { ...answers, [k]: v } });
  const monthName = fmtDate(from, locale, { month: 'long', year: 'numeric' });
  const laterByMonth = [shiftMonth(m, 1), shiftMonth(m, 2)].map((mm) => ({
    mm, items: (later ?? []).filter((i) => i.date.slice(0, 7) === mm && (i.kind === 'event' || i.kind === 'exam' || i.kind === 'deadline')).slice(0, 6),
  }));

  return (
    <div className="mx-auto max-w-[1360px]">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className="text-[13px] font-bold text-fg-2">{m === thisMonth ? L(`باقي ${nDays - Number(today.slice(8))} يوم`, `${nDays - Number(today.slice(8))} days left`) : m > thisMonth ? L('شهر جاي', 'Upcoming') : L('شهر راح', 'Past month')}</p>
          <h1 className="nb-title text-[34px] leading-tight md:text-[40px]">{L('الشهر', 'Month')} <span className="nb-hl">{monthName}</span></h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Ritual storeKey={`dq_ritual_month_${m}`} title={<>◆ {L('سكّر الشهر · 30 د', 'Close the month · 30 min')}</>} steps={[
            ['راجع الأهداف والمتتبّعات', 'Review goals and trackers'], ['رحّل المهام: خلّها، انقلها، أو اشطبها', 'Migrate: keep, move or drop'],
            ['اختر 2–3 أهداف للشهر الجاي', 'Pick 2–3 goals for next month'], ['انقل من السجل المستقبلي', 'Pull from the future log'], ['حط الفواتير والمناسبات بالتقويم', 'Put bills and occasions on the calendar'],
          ]} />
          <PeriodNav label={monthName} isNow={m === thisMonth} nowLabel={L('هالشهر', 'This month')} onPrev={() => go(prevM)} onNext={() => go(shiftMonth(m, 1))} onNow={() => go(thisMonth)} />
        </div>
      </header>

      <div className="@container/nb">
        <div className="grid grid-cols-1 gap-4 @[1060px]/nb:grid-cols-2 @[1060px]/nb:gap-0">
          <section className="nb-paper nb-page nb-a paper-dots px-4 pb-6 pt-8 sm:px-6" aria-label={L('تقويم الشهر', 'Month calendar')}>
            <span className="nb-washi -top-3 end-16 rotate-3" style={{ ['--washi' as string]: 'var(--health)' }} aria-hidden="true" />
            <label className="mb-4 flex items-center gap-2.5">
              <span className="shrink-0 text-[13.5px] font-bold">{L('تركيز الشهر:', 'Month focus:')}</span>
              <WriteLine value={page?.focus ?? ''} label={L('تركيز الشهر', 'Month focus')} placeholder={L('وش أهم شي هالشهر؟', 'What matters most this month?')} onSave={(v) => void patchMonthPage(m, { focus: v })} className="text-[16px]" />
            </label>
            <div className="grid grid-cols-7 overflow-hidden rounded-md border-[1.5px] border-line bg-surface/90">
              {heads.map((h, i) => <div key={i} className="border-b border-line py-1.5 text-center text-[12px] font-bold text-fg-2">{h}</div>)}
              {Array.from({ length: lead }, (_, i) => <div key={`x${i}`} className="border-t border-dashed border-line/60" />)}
              {days.map((d) => {
                const its = [
                  ...dated.filter((i) => i.date === d).map((i) => ({ k: i.key, t: `${SYM[i.kind] ?? '○'} ${i.title}`, c: i.color })),
                  ...bills.filter((b) => b.data.next_date === d).map((b) => ({ k: b.id, t: `↻ ${b.data.name} ${b.data.amount}`, c: 'var(--reward-ink)' })),
                ];
                const mood = moodOf(d);
                return (
                  <Link key={d} to={`/life/today?date=${d}`} className={clsx('relative flex min-h-[78px] flex-col gap-0.5 border-s border-t border-dashed border-line/60 p-1 pb-2 text-[11px] hover:bg-surface-2 max-sm:min-h-14', d === today && 'bg-[color-mix(in_oklab,var(--reward)_25%,var(--surface))]')}>
                    <span className="flex items-center justify-between"><b className="num text-[13px]">{Number(d.slice(8))}</b>{d <= today && !spentOn(d) && <span className="text-[10px] font-bold text-success" title={L('بدون صرف', 'No spend')}>✓</span>}</span>
                    {its.slice(0, 2).map((x) => <span key={x.k} className="truncate rounded-[4px] px-1 max-sm:hidden" style={{ background: `color-mix(in oklab, ${x.c} 22%, var(--surface))` }}>{x.t}</span>)}
                    {its.length > 0 && <span className="flex gap-0.5 sm:hidden">{its.slice(0, 4).map((x) => <i key={x.k} className="size-1.5 rounded-full" style={{ background: x.c }} />)}</span>}
                    {its.length > 2 && <span className="text-[10px] text-fg-2 max-sm:hidden">+{its.length - 2}</span>}
                    {mood != null && <span className="absolute inset-x-0 bottom-0 h-1" style={{ background: MOOD[mood] }} aria-hidden="true" />}
                  </Link>
                );
              })}
            </div>
            <p className="mt-2 flex flex-wrap gap-x-4 text-[12px] text-fg-2"><span>{L('بالتقويم: المواعيد والاختبارات والتسليمات والفواتير', 'Calendar: events, exams, deadlines and bills')}</span><span>{L('الشريط = مزاجك', 'Strip = your mood')}</span><span>✓ {L('بدون صرف', 'no spend')}</span></p>
          </section>

          <section className="nb-paper nb-page nb-b paper-dots flex flex-col gap-3.5 px-4 pb-6 pt-8 sm:px-6" aria-label={L('أهداف ومهام الشهر', 'Month goals and list')}>
            <Box title={L('أهداف الشهر', 'Month goals')} extra={L('2–3 بس · تنزل منها أولويات الأسابيع', '2–3 · they feed weekly priorities')}>
              {!monthGoals.length && <p className="text-[13.5px] text-fg-2">{L('ما فيه هدف للشهر. اختر من أهدافك أو دوّن «هدف: …».', 'No month goal yet. Pick one or write “goal: …”.')}</p>}
              <ul className="flex flex-col gap-3">
                {monthGoals.map((g) => {
                  const p = goalProgress(g, tasks ?? [], milestones ?? []);
                  const ws = fromGoal(g.id);
                  return (
                    <li key={g.id}>
                      <div className="flex items-baseline gap-2 text-[14.5px]"><b className="text-life-ink">◆</b><Link to="/life/goals" className="flex-1 font-bold hover:underline">{g.data.title}</Link>{p != null && <span className="num text-[12.5px] text-fg-2">{Math.round(p * 100)}٪</span>}</div>
                      {p != null && <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-health" style={{ width: `${p * 100}%` }} /></div>}
                      <p className="mt-0.5 text-[12px] text-fg-2">{ws.length ? L(`نزل منه للأسابيع: ${ws.map((b) => b.title + (b.done ? ' ✓' : '')).join('، ')}`, `Weekly priorities from it: ${ws.map((b) => b.title).join(', ')}`) : L('ما نزل منه شي للأسابيع بعد', 'Not in any week yet')}</p>
                    </li>
                  );
                })}
              </ul>
              {monthGoals.length < 3 && otherGoals.length > 0 && (
                <select value="" onChange={(e) => e.target.value && void patchMonthPage(m, { goal_ids: [...pinned, e.target.value] })} aria-label={L('أضف هدف لهالشهر', 'Add a goal to this month')}
                  className="mt-2 h-8 rounded-full border border-line bg-surface px-2 text-[12.5px]">
                  <option value="">+ {L('أضف هدف لهالشهر', 'Add a goal to this month')}</option>
                  {otherGoals.map((g) => <option key={g.id} value={g.id}>{g.data.title}</option>)}
                </select>
              )}
            </Box>

            <Box title={L('مهام الشهر', 'Month list')} extra={L('بدون أسبوع · انقلها لما يجي وقتها', 'No week yet · move when it’s time')}>
              {!monthList.length && <p className="text-[13.5px] text-fg-2">{L('فاضية. دوّن «… هالشهر».', 'Empty. Write “… this month”.')}</p>}
              <ul>
                {monthList.map((x) => (
                  <li key={x.id} className="flex min-h-10 flex-wrap items-center gap-1.5 border-b border-dashed border-line text-[14.5px]">
                    <span className="font-bold">•</span><span className="min-w-28 flex-1">{x.data.title}</span>
                    <button onClick={() => void saveTask(x.id, { ...x.data, plan_week: thisWeek, plan_month: null })} className="h-7 rounded-full border border-line bg-surface px-2.5 text-[12px] font-bold hover:border-fg">{L('هالأسبوع', 'This week')}</button>
                    <button onClick={() => void saveTask(x.id, { ...x.data, plan_week: shiftKey(thisWeek, 7), plan_month: null })} className="h-7 rounded-full border border-line bg-surface px-2.5 text-[12px] font-bold hover:border-fg">{L('الجاي', 'Next')}</button>
                  </li>
                ))}
              </ul>
              {carried.length > 0 && (
                <div className="mt-3 rounded-sm border border-dashed border-line-strong p-2.5">
                  <p className="mb-1 text-[13px] font-bold">{L('ترحيل: باقي من الشهر اللي راح', 'Migrate: left from last month')}</p>
                  {carried.map((x) => (
                    <div key={x.id} className="flex min-h-9 flex-wrap items-center gap-1.5 text-[14px]">
                      <span className="flex-1">{x.data.title}</span>
                      <button onClick={() => void saveTask(x.id, { ...x.data, plan_month: m })} className="h-7 rounded-full border border-line bg-surface px-2.5 text-[12px] font-bold">{L('لهالشهر', 'Keep')}</button>
                      <button onClick={() => void update(x.id, { status: 'archived' })} className="h-7 rounded-full border border-line bg-surface px-2.5 text-[12px] font-bold text-danger">{L('اشطب', 'Drop')}</button>
                    </div>
                  ))}
                </div>
              )}
            </Box>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <Box title={L('فلوس الشهر', 'Month’s money')} extra={<Link to="/life/finance" className="font-bold text-accent-ink">{L('المال', 'Money')}</Link>}>
                <p className="num text-[24px] font-black leading-none">{spent.toLocaleString(locale)} {budget ? <span className="text-[12.5px] font-medium text-fg-2">/ {budget.toLocaleString(locale)}</span> : null}</p>
                {budget ? <div className="my-2 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className={clsx('h-full rounded-full', spent > budget ? 'bg-danger' : 'bg-reward-ink')} style={{ width: `${Math.min(100, (spent / budget) * 100)}%` }} /></div> : <div className="h-2" />}
                {cats.map(([n, v]) => <div key={n} className="flex text-[12.5px]"><span className="flex-1">{n}</span><b className="num">{v.toLocaleString(locale)}</b></div>)}
                <p className="mt-1 text-[12px] text-fg-2">{L(`${noSpend} أيام بدون صرف`, `${noSpend} no-spend days`)}</p>
              </Box>
              <Box title={L('السجل المستقبلي', 'Future log')}>
                {laterByMonth.map(({ mm, items: its }) => (
                  <div key={mm} className="mb-1.5 text-[13px]">
                    <b>{fmtDate(`${mm}-01`, locale, { month: 'long' })}</b>
                    <div className="text-fg-2">{its.length ? its.map((i) => `${SYM[i.kind] ?? '○'} ${i.title} ${Number(i.date.slice(8))}`).join(' · ') : '—'}</div>
                  </div>
                ))}
                <WriteLine value={page?.future ?? ''} label={L('ملاحظة للشهور الجاية', 'Note for coming months')} placeholder={L('شي للشهور الجاية…', 'Something for later months…')} onSave={(v) => void patchMonthPage(m, { future: v })} className="text-[14px]" />
              </Box>
            </div>
          </section>
        </div>
      </div>

      <section className="nb-paper paper-plain mt-4 rounded-lg px-4 pb-5 pt-6 shadow-[0_18px_40px_-26px_rgba(47,41,38,.45)] sm:px-6" aria-label={L('متتبعات الشهر', 'Month trackers')}>
        <h2 className="nb-title mb-3 text-2xl text-life-ink">{L('متتبّعات الشهر', 'Month trackers')}</h2>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[640px] border-separate border-spacing-[2px] text-[12px]">
            <thead><tr><th />{days.map((d) => <th key={d} className="num w-[2.6%] text-center font-normal text-fg-3">{Number(d.slice(8)) % 5 === 1 ? Number(d.slice(8)) : ''}</th>)}<th /></tr></thead>
            <tbody>
              {activeHabits.map((h) => {
                const hits = past.filter((d) => logDone(h.data, logIdx.get(h.id)?.get(d))).length;
                return (
                  <tr key={h.id}>
                    <td className="max-w-36 truncate pe-2">{h.data.icon} {h.data.name}</td>
                    {days.map((d) => <td key={d}><span className={clsx('block aspect-square rounded-[3px]', d > today ? 'border border-dashed border-line' : logDone(h.data, logIdx.get(h.id)?.get(d)) ? 'bg-study-ink' : 'bg-surface-2')} /></td>)}
                    <td className="num ps-2 text-fg-2">{hits}/{past.length}</td>
                  </tr>
                );
              })}
              <tr>
                <td className="pe-2 font-bold">{L('المزاج', 'Mood')}</td>
                {days.map((d) => { const md = moodOf(d); return <td key={d}><span className="block aspect-square rounded-[3px]" style={{ background: md != null ? MOOD[md] : 'var(--surface-2)' }} /></td>; })}
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        <Box title={L('تأمّل الشهر', 'Month reflection')} extra={L('آخر يوم · تنحفظ في المراجعات', 'Last day · saved to Reviews')} className="mt-4 !bg-[color-mix(in_oklab,var(--health)_18%,var(--surface))]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {([['proud', 'وش أكثر شي فخور فيه؟', 'Most proud of?'], ['goals', 'كيف تقدمت أهدافي؟', 'How did goals go?'], ['habits', 'أي عادة ثبتت، وأيها طاحت؟', 'Which habits held?'], ['change', 'وش أغيّر الشهر الجاي؟', 'What changes next month?']] as const).map(([k, ar, en]) => (
              <label key={k} className="text-[13px] font-bold">{L(ar, en)}
                <WriteLine value={answers[k] ?? ''} label={L(ar, en)} onSave={(v) => setAnswer(k, v)} className="mt-1 text-[15px] font-normal" />
              </label>
            ))}
          </div>
        </Box>
      </section>
    </div>
  );
}
