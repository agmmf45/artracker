import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import clsx from 'clsx';
import { useI18n } from '@/core/i18n';
import { useRecord, useRecords, useRecordsInRange, useSettings } from '@/core/hooks';
import { fmtDate, fmtTime, rangeKeys, shiftKey, todayKey, weekStartKey } from '@/core/dates';
import type { TxnData } from '@/modules/shared/domain';
import { useCalendarItems, type CalItem } from './calendar/sources';
import { isDone, saveTask, taskDay, type TaskData } from './tasks/model';
import type { GoalData } from './goals/model';
import { indexLogs, isScheduled, logDone, type HabitData, type HabitLogData } from './habits/model';
import { Box, WriteLine } from './today/Trackers';
import { patchWeekPage, weekPageId, type WeekBig3, type WeekPageData } from './plan/periods';
import { PeriodNav, Ritual, Tick } from './plan/ui';

const SYM: Partial<Record<CalItem['kind'], string>> = { event: '○', exam: '★', assignment: '◇', deadline: '!', workout: '◐', task: '•' };

/**
 * The week, on its own page: focus, the week's top 3 (each tied to a month goal), the week list
 * (tasks with no day yet), what each day holds, habit streaks, a dinner plan, the week's money
 * and the Friday review. No hours here — those live on the day page.
 */
export default function Week() {
  const { L, locale } = useI18n();
  const settings = useSettings();
  const [params, setParams] = useSearchParams();
  const today = todayKey();
  const thisWeek = weekStartKey(today, settings.weekStart);
  const raw = params.get('w') ?? '';
  const ws = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? weekStartKey(raw, settings.weekStart) : thisWeek;
  const we = shiftKey(ws, 6);
  const go = (w: string) => setParams(w === thisWeek ? {} : { w }, { replace: true });
  const days = rangeKeys(ws, 7);

  const page = useRecord<WeekPageData>(weekPageId(ws))?.data;
  const tasks = useRecords<TaskData>('task');
  const goals = useRecords<GoalData>('goal');
  const items = useCalendarItems(ws, shiftKey(ws, 13), settings);
  const txns = useRecordsInRange<TxnData>('txn', ws, we);
  const habits = useRecords<HabitData>('habit');
  const logs = useRecordsInRange<HabitLogData>('habit_log', ws, we);
  const logIdx = useMemo(() => indexLogs(logs), [logs]);

  const activeGoals = (goals ?? []).filter((g) => g.status !== 'done' && g.status !== 'archived');
  const big3: WeekBig3[] = [0, 1, 2].map((i) => page?.big3?.[i] ?? { id: `b${i}`, title: '', goal_id: null, done: false });
  const setBig = (i: number, p: Partial<WeekBig3>) => { const next = big3.map((b, k) => (k === i ? { ...b, ...p } : b)); void patchWeekPage(ws, { big3: next }); };

  const weekList = (tasks ?? []).filter((x) => x.data.plan_week === ws && !taskDay(x.data) && !isDone(x) && x.status !== 'archived');
  const remaining = days.filter((d) => d >= today);
  const spentOn = (d: string) => (txns ?? []).filter((x) => x.date === d && x.data.kind === 'expense').reduce((a, x) => a + x.data.amount, 0);
  const past = days.filter((d) => d <= today);
  const weekSpent = past.reduce((a, d) => a + spentOn(d), 0);
  const noSpend = past.filter((d) => !spentOn(d)).length;
  const activeHabits = (habits ?? []).filter((h) => h.status !== 'archived').sort((a, b) => a.data.order - b.data.order).slice(0, 8);
  const meals = days.map((_, i) => page?.meals?.[i] ?? '');
  const answers = page?.answers ?? {};
  const setAnswer = (k: string, v: string) => void patchWeekPage(ws, { answers: { ...answers, [k]: v } });
  const nextWs = shiftKey(ws, 7);
  const nextFixed = (items ?? []).filter((i) => i.date >= nextWs && i.kind !== 'class' && i.kind !== 'task' && i.kind !== 'medication');
  const nextList = (tasks ?? []).filter((x) => x.data.plan_week === nextWs && !taskDay(x.data) && !isDone(x)).length;
  const h12 = settings.timeFormat === '12';
  const short = (d: string) => fmtDate(d, locale, { weekday: 'short' });
  // one letter per day (ح ن ث ر خ ج س) — the Arabic "short" name is the full word and overflows a phone
  const letter = (d: string) => fmtDate(d, locale, { weekday: 'narrow' });
  const label = `${fmtDate(ws, locale, { day: 'numeric', month: 'short' })} – ${fmtDate(we, locale, { day: 'numeric', month: 'short' })}`;

  return (
    <div className="mx-auto max-w-[1360px]">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className="text-[13px] font-bold text-fg-2">{ws === thisWeek ? L('هالأسبوع', 'This week') : ws > thisWeek ? L('أسبوع جاي', 'Upcoming week') : L('أسبوع راح', 'Past week')}</p>
          <h1 className="nb-title text-[34px] leading-tight md:text-[40px]">{L('الأسبوع', 'Week')} <span className="nb-hl">{label}</span></h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Ritual storeKey={`dq_ritual_week_${ws}`} title={<>▦ {L('خطّط أسبوعك · 20 د', 'Plan the week · 20 min')}</>} steps={[
            ['راجع الأسبوع اللي راح', 'Review last week'], ['شوف أهداف الشهر', 'Look at the month’s goals'], ['اختر أهم 3 للأسبوع', 'Pick the week’s top 3'],
            ['حط المواعيد الثابتة', 'Place fixed events'], ['وزّع قائمة الأسبوع على الأيام', 'Spread the week list over days'], ['خطّط راحتك', 'Plan your rest'],
          ]} />
          <PeriodNav label={label} isNow={ws === thisWeek} nowLabel={L('هالأسبوع', 'This week')} onPrev={() => go(shiftKey(ws, -7))} onNext={() => go(shiftKey(ws, 7))} onNow={() => go(thisWeek)} />
        </div>
      </header>

      <section className="nb-paper paper-grid relative rounded-lg px-4 pb-6 pt-8 shadow-[0_18px_40px_-26px_rgba(47,41,38,.45)] sm:px-7">
        <span className="nb-washi -top-3 end-20 rotate-3" style={{ ['--washi' as string]: 'var(--study)' }} aria-hidden="true" />
        <label className="mb-5 flex items-center gap-2.5">
          <span className="shrink-0 text-[13.5px] font-bold">{L('محور الأسبوع:', 'Week theme:')}</span>
          <WriteLine value={page?.theme ?? ''} label={L('محور الأسبوع', 'Week theme')} placeholder={L('كلمة أو جملة للأسبوع', 'A word or line for the week')} onSave={(v) => void patchWeekPage(ws, { theme: v })} className="text-[16px]" />
        </label>

        <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Box title={L('أهم 3 هالأسبوع', 'This week’s top 3')} extra={L('تنزل منها «أهم 3» لكل يوم', 'They feed each day’s top 3')}>
            <ol className="flex flex-col gap-2">
              {big3.map((b, i) => (
                <li key={b.id} className="flex flex-wrap items-center gap-2">
                  <Tick on={b.done} onClick={b.title ? () => setBig(i, { done: !b.done }) : undefined} label={b.title || L(`أولوية ${i + 1}`, `Priority ${i + 1}`)} />
                  <WriteLine value={b.title} label={L(`أولوية ${i + 1}`, `Priority ${i + 1}`)} placeholder={L('أولوية للأسبوع…', 'A priority for the week…')} onSave={(v) => setBig(i, { title: v })} className={clsx('min-w-40 flex-1 text-[15px]', b.done && 'line-through opacity-60')} />
                  <select value={b.goal_id ?? ''} onChange={(e) => setBig(i, { goal_id: e.target.value || null })} aria-label={L('من أي هدف؟', 'From which goal?')}
                    className="h-8 max-w-44 rounded-full border border-line bg-surface px-2 text-[12.5px] text-fg-2">
                    <option value="">{L('↑ بدون هدف', '↑ no goal')}</option>
                    {activeGoals.map((g) => <option key={g.id} value={g.id}>↑ {g.data.title}</option>)}
                  </select>
                </li>
              ))}
            </ol>
          </Box>

          <Box title={L('قائمة الأسبوع', 'Week list')} extra={L('بدون يوم · وزّعها بضغطة', 'No day yet · tap a day')}>
            {!weekList.length ? <p className="text-[13.5px] text-fg-2">{L('فاضية. دوّن «… هالأسبوع» من أي مكان.', 'Empty. Write “… this week” anywhere.')}</p> : (
              <ul className="flex flex-col">
                {weekList.map((x) => (
                  <li key={x.id} className="flex min-h-10 flex-wrap items-center gap-1.5 border-b border-dashed border-line text-[14.5px]">
                    <span className="font-bold">•</span><span className="min-w-28 flex-1">{x.data.title}</span>
                    {remaining.map((d) => (
                      <button key={d} onClick={() => void saveTask(x.id, { ...x.data, start: d, plan_week: null })} title={fmtDate(d, locale, { weekday: 'long', day: 'numeric' })}
                        className="h-7 min-w-8 rounded-full border border-line bg-surface px-2 text-[12px] font-bold hover:border-fg">{short(d)}</button>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </Box>
        </div>

        {/* what each day holds — no hours, one line per thing */}
        <div className="grid grid-cols-1 overflow-hidden rounded-md border-[1.5px] border-line bg-surface/90 md:grid-cols-7">
          {days.map((d) => {
            const its = (items ?? []).filter((i) => i.date === d && i.kind !== 'class' && i.kind !== 'medication').sort((a, b) => (a.kind === 'task' ? 1 : 0) - (b.kind === 'task' ? 1 : 0) || (a.start ?? '99').localeCompare(b.start ?? '99'));
            const classes = (items ?? []).filter((i) => i.date === d && i.kind === 'class').length;
            const sp = spentOn(d);
            return (
              <div key={d} className={clsx('flex min-h-40 flex-col border-line max-md:border-b md:border-s md:first:border-s-0', d === today && 'bg-[color-mix(in_oklab,var(--reward)_22%,var(--surface))]', d < today && 'bg-surface-2/40')}>
                <Link to={`/life/today?date=${d}`} className={clsx('flex items-baseline gap-1.5 border-b border-line px-2.5 py-2 hover:bg-surface-2', d === today && 'shadow-[inset_0_3px_0_var(--reward-ink)]')}>
                  <b className="num text-[19px]">{fmtDate(d, locale, { day: 'numeric' })}</b><span className="text-[12.5px] text-fg-2">{fmtDate(d, locale, { weekday: 'long' })}</span>
                </Link>
                <ul className="flex flex-1 flex-col gap-0.5 px-2.5 py-1.5 text-[13px]">
                  {its.map((i) => (
                    <li key={i.key} className={clsx('leading-snug', i.kind !== 'task' && 'font-semibold', i.done && 'text-fg-2 line-through')}>
                      <span style={{ color: i.color }}>{SYM[i.kind] ?? '○'}</span> {i.title}{i.start && <span className="num ms-1 text-[11.5px] font-normal text-fg-2">{fmtTime(i.start, locale, h12)}</span>}
                    </li>
                  ))}
                  {classes > 0 && <li className="text-[12px] text-fg-2">🎓 {L(`${classes} محاضرات`, `${classes} classes`)}</li>}
                  {!its.length && !classes && <li className="text-[12px] text-fg-3">—</li>}
                </ul>
                {d <= today && <div className="border-t border-dashed border-line px-2.5 py-1 text-[11.5px] text-fg-2">{sp ? `${L('ر.س', 'SAR')} ${sp}` : L('بدون صرف ✓', 'No spend ✓')}</div>}
              </div>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Box title={L('سلسلة العادات', 'Habit streaks')}>
            {!activeHabits.length ? <p className="text-[13.5px] text-fg-2"><Link to="/life/habits" className="font-bold text-accent-ink">{L('أضف عادة', 'Add a habit')}</Link></p> : (
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full table-fixed text-[13px]">
                  <thead><tr><th className="w-[38%] text-start font-normal" />{days.map((d) => <th key={d} title={short(d)} className={clsx('pb-1 text-center text-[11.5px] font-bold', d === today ? 'text-reward-ink' : 'text-fg-2')}>{letter(d)}</th>)}</tr></thead>
                  <tbody>
                    {activeHabits.map((h) => (
                      <tr key={h.id}>
                        <td className="truncate py-1 pe-2">{h.data.icon} {h.data.name}</td>
                        {days.map((d) => {
                          const sched = isScheduled(h.data, d);
                          const done = logDone(h.data, logIdx.get(h.id)?.get(d));
                          return <td key={d} className="text-center"><span className={clsx('mx-auto block size-4 rounded-full border-[1.5px]', done ? 'border-study-ink bg-study-ink' : d > today ? 'border-dashed border-line' : sched ? 'border-line-strong' : 'border-transparent bg-surface-2')} aria-label={done ? L('تم', 'done') : ''} /></td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Box>
          <Box title={L('فلوس الأسبوع', 'Week’s money')}>
            <p className="num text-[26px] font-black leading-none">{weekSpent.toLocaleString(locale)} <span className="text-[13px] font-medium text-fg-2">{L('ر.س', 'SAR')}</span></p>
            <div className="mt-2.5 flex flex-wrap gap-1">
              {days.map((d) => (
                <span key={d} className={clsx('grid size-7 place-items-center rounded-full text-[11px] font-bold', d > today ? 'text-fg-3' : spentOn(d) ? 'bg-surface-2 text-fg-2' : 'bg-[color-mix(in_oklab,var(--success)_25%,var(--surface))] text-success')}>{d <= today && !spentOn(d) ? '✓' : letter(d)}</span>
              ))}
            </div>
            <p className="mt-1.5 text-[12.5px] text-fg-2">{L(`${noSpend} ${noSpend === 1 ? 'يوم' : 'أيام'} بدون صرف`, `${noSpend} no-spend day${noSpend === 1 ? '' : 's'}`)}</p>
          </Box>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <Box title={L('خطة العشاء', 'Dinner plan')}>
            <ul className="flex flex-col gap-1">
              {days.map((d, i) => (
                <li key={d} className="flex items-center gap-2"><b className="w-14 shrink-0 text-[13px]">{short(d)}</b>
                  <WriteLine value={meals[i]} label={L(`عشاء ${short(d)}`, `Dinner ${short(d)}`)} placeholder="—" onSave={(v) => { const next = [...meals]; next[i] = v; void patchWeekPage(ws, { meals: next }); }} className="text-[14px]" />
                </li>
              ))}
            </ul>
          </Box>
          <Box title={L('مراجعة الأسبوع', 'Weekly review')} extra={L('الجمعة · 15 دقيقة · تنحفظ في المراجعات', 'Friday · 15 min · saved to Reviews')} className="!bg-[color-mix(in_oklab,var(--health)_18%,var(--surface))]">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {([['wins', '✓ وش مشى زين؟', '✓ What went well?'], ['hard', '✗ وش علّق؟', '✗ What got stuck?'], ['rest', '☕ كيف برتاح الأسبوع الجاي؟', '☕ How will I recharge?']] as const).map(([k, ar, en]) => (
                <label key={k} className="text-[13px] font-bold">{L(ar, en)}
                  <WriteLine value={answers[k] ?? ''} label={L(ar, en)} onSave={(v) => setAnswer(k, v)} className="mt-1 text-[15px] font-normal" />
                </label>
              ))}
            </div>
          </Box>
        </div>

        {ws === thisWeek && (
          <Box title={L('الأسبوع الجاي', 'Next week')} extra={<button onClick={() => go(nextWs)} className="font-bold text-accent-ink">{L('افتحه ←', 'Open →')}</button>} className="mt-4 !border-dashed">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4 lg:grid-cols-7">
              {rangeKeys(nextWs, 7).map((d) => {
                const its = nextFixed.filter((i) => i.date === d);
                return (
                  <div key={d} className="text-[13px]">
                    <b>{short(d)} <span className="num">{fmtDate(d, locale, { day: 'numeric' })}</span></b>
                    <div className="text-fg-2">{its.length ? its.map((i) => `${SYM[i.kind] ?? '○'} ${i.title}${i.start ? ` ${fmtTime(i.start, locale, h12)}` : ''}`).join(' · ') : '—'}</div>
                  </div>
                );
              })}
            </div>
            {nextList > 0 && <p className="mt-2 text-[12.5px] text-fg-2">{L(`وفي قائمته ${nextList} مهام بدون يوم`, `Plus ${nextList} tasks in its list`)}</p>}
          </Box>
        )}
      </section>
    </div>
  );
}
