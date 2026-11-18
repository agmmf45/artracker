import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ChevronLeft, ChevronRight, CalendarClock, Star, Check } from 'lucide-react';
import clsx from 'clsx';
import type { Rec } from '@shared/records';
import { useI18n } from '@/core/i18n';
import { updateSettings, useRecord, useRecords, useRecordsInRange, useSettings } from '@/core/hooks';
import { bulk, revertTo } from '@/core/repo';
import { dateKey, fmtDate, hijri, relativeDay, shiftKey, todayKey } from '@/core/dates';
import { undoToast } from '@/core/toast';
import type { Settings } from '@/core/settings';
import { Segmented } from '@/design/ui';
import type { NoteData, TxnData } from '@/modules/shared/domain';
import { TaskEditor } from './tasks/TaskEditor';
import { createTask, isDone, saveTask, taskDay, type Task, type TaskData } from './tasks/model';
import { useCalendarItems } from './calendar/sources';
import { RapidLog } from './today/RapidLog';
import { TimeBlocks } from './today/TimeBlocks';
import { Trackers, Box, WriteLine } from './today/Trackers';
import { dayPageId, patchDayPage, type DayPageData } from './today/dayPage';
import { weekOf, weekPageId, type WeekPageData } from './plan/periods';

type Paper = Settings['notebook']['paper'];
const localDay = (iso: string | null | undefined) => (iso ? dateKey(new Date(iso)) : null);

/**
 * Today, as a notebook page (bullet-journal style): rapid log with keys, top 3, hour column,
 * and the day's trackers (meals, water, sleep, mood, habits, gratitude) — all from real records,
 * so each line also appears in Tasks, Calendar, Health and Journal.
 */
export default function Today() {
  const { L, lang, locale } = useI18n();
  const settings = useSettings();
  const [params, setParams] = useSearchParams();
  const today = todayKey();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') ?? '') ? params.get('date')! : today;
  const setDay = (d: string) => setParams(d === today ? {} : { date: d }, { replace: true });
  const tomorrow = shiftKey(day, 1);

  const tasks = useRecords<TaskData>('task');
  const items = useCalendarItems(day, day, settings);
  const notesAll = useRecords<NoteData>('note');
  const txnsDay = useRecordsInRange<TxnData>('txn', day, day);
  const journalDay = useRecordsInRange<DayPageData>('journal', day, day);
  const [editing, setEditing] = useState<Task | null>(null);
  const paper: Paper = settings.notebook?.paper ?? 'dots';
  const h12 = settings.timeFormat === '12';

  const t = useMemo(() => {
    const xs = (tasks ?? []).filter((x) => x.status !== 'archived' && x.status !== 'inbox');
    const open = xs.filter((x) => !isDone(x) && (taskDay(x.data) === day || x.data.due === day));
    const done = xs.filter((x) => isDone(x) && localDay(x.data.completed_at) === day);
    const recurringDone = xs.filter((x) => !isDone(x) && x.data.recurrence && taskDay(x.data) !== day && (x.data.history ?? []).some((h) => h.date === day));
    const overdue = day === today ? xs.filter((x) => !isDone(x) && !open.includes(x) && ((x.data.start && x.data.start < today) || (!x.data.start && x.data.due && x.data.due < today))) : [];
    const top = [...open, ...done].filter((x) => x.data.important).slice(0, 3);
    const tomorrowTop = xs.some((x) => !isDone(x) && x.data.important && taskDay(x.data) === shiftKey(day, 1));
    return { open, done, recurringDone, overdue, top, tomorrowTop };
  }, [tasks, day, today]);

  const events = (items ?? []).filter((i) => i.kind !== 'task' && i.kind !== 'deadline');
  const notes = (notesAll ?? []).filter((n) => (n.data.note_type === 'quick' || n.data.note_type === 'idea') && localDay(n.created_at) === day);
  const txns = (txnsDay ?? []).filter((x) => x.data.kind !== 'transfer');
  const page = journalDay?.find((e) => e.id === dayPageId(day))?.data;
  const prompts = page?.prompts ?? {};
  const setPrompt = (k: string, v: string) => void patchDayPage(day, { prompts: { ...prompts, [k]: v } });
  // the week's top 3 feed today's top 3 (month goals → week priorities → today)
  const ws = weekOf(day, settings.weekStart);
  const week = useRecord<WeekPageData>(weekPageId(ws));
  const titlesToday = new Set([...t.open, ...t.done].map((x) => x.data.title));
  const weekPicks = t.top.length < 3 ? (week?.data.big3 ?? []).filter((b) => !b.done && b.title && !titlesToday.has(b.title)) : [];
  const spent = txns.filter((x) => x.data.kind === 'expense').reduce((a, x) => a + x.data.amount, 0);

  const moveAll = async (list: Task[], to: string) => {
    const snaps = list.map((x) => x as unknown as Rec);
    await bulk(async () => { for (const x of list) await saveTask(x.id, { ...x.data, start: to }); });
    undoToast(L(`رُحّلت ${list.length} مهمة لـ${relativeDay(to, lang, locale)}`, `${list.length} moved to ${relativeDay(to, lang, locale)}`), async () => { for (const s of snaps) await revertTo(s); });
  };

  const shutdown = [
    { ok: t.open.length === 0, ar: 'ما بقى شي مفتوح لليوم', en: 'Nothing left open today',
      act: t.open.length ? <button onClick={() => void moveAll(t.open, tomorrow)} className="font-bold text-accent-ink hover:underline">{L(`رحّل الباقي (${t.open.length}) لبكرة`, `Move the rest (${t.open.length}) to tomorrow`)}</button> : null },
    { ok: t.tomorrowTop, ar: 'حدّدت أهم مهمة لبكرة', en: 'Picked tomorrow’s top task',
      act: !t.tomorrowTop ? <button onClick={() => setDay(tomorrow)} className="font-bold text-accent-ink hover:underline">{L('افتح صفحة بكرة', 'Open tomorrow')}</button> : null },
    { ok: !!page?.prompts?.line, ar: 'كتبت سطر اليوم', en: 'Wrote the line of the day', act: null },
    { ok: !!page?.prompts?.win, ar: 'كتبت فوز اليوم', en: 'Wrote today’s win', act: null },
  ];

  const dayNum = fmtDate(day, locale, { day: 'numeric' });
  const rest = fmtDate(day, locale, { month: 'long' });
  const weekday = fmtDate(day, locale, { weekday: 'long' });

  return (
    <div className="mx-auto max-w-[1360px]">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className="text-[13px] font-bold text-fg-2">{day === today ? L('اليوم', 'Today') : relativeDay(day, lang, locale)}</p>
          <h1 className="nb-title text-[34px] leading-tight md:text-[40px]">{weekday}، <span className="nb-hl">{dayNum} {rest}</span></h1>
          <p className="mt-0.5 text-[13.5px] text-fg-2">{hijri(day, lang)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-full border border-line bg-surface">
            <button onClick={() => setDay(shiftKey(day, -1))} aria-label={L('اليوم السابق', 'Previous day')} className="grid size-10 place-items-center rounded-full hover:bg-surface-2"><ChevronRight size={18} className="ltr:rotate-180" /></button>
            <button onClick={() => setDay(today)} disabled={day === today} className="h-10 px-3 text-sm font-bold disabled:text-fg-3">{L('اليوم', 'Today')}</button>
            <button onClick={() => setDay(shiftKey(day, 1))} aria-label={L('اليوم التالي', 'Next day')} className="grid size-10 place-items-center rounded-full hover:bg-surface-2"><ChevronLeft size={18} className="ltr:rotate-180" /></button>
          </div>
          <Segmented size="sm" value={paper} onChange={(v) => void updateSettings({ notebook: { paper: v } })}
            options={[{ value: 'dots', label: L('نقاط', 'Dots') }, { value: 'lines', label: L('سطور', 'Lines') }, { value: 'grid', label: L('مربعات', 'Grid') }, { value: 'plain', label: L('سادة', 'Plain') }]} />
          <Link to="/life/week" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-sm font-bold hover:bg-surface-2"><CalendarClock size={16} />{L('الأسبوع', 'Week')}</Link>
        </div>
      </header>

      <div className="@container/nb">
      <div className="grid grid-cols-1 gap-4 @[1060px]/nb:grid-cols-2 @[1060px]/nb:gap-0">
        {/* ── page one: the log ── */}
        <section className={clsx('nb-paper nb-page nb-a @container/pa px-4 pb-6 pt-8 sm:px-7', `paper-${paper}`)} aria-label={L('سجل اليوم', 'Daily log')}>
          <span className="nb-washi -top-3 end-14 rotate-3" aria-hidden="true" />
          <div className="grid grid-cols-1 gap-7 @[720px]/pa:grid-cols-[minmax(0,1fr)_210px]">
            <div className="min-w-0">
              <label data-tour="focus" className="mb-5 flex items-center gap-2.5">
                <span className="shrink-0 text-[13.5px] font-bold">{L('تركيز اليوم:', 'Today’s focus:')}</span>
                <WriteLine value={prompts.focus ?? ''} label={L('تركيز اليوم', 'Today’s focus')} placeholder={L('جملة وحدة: وش أهم شي اليوم؟', 'One line: what matters most today?')} onSave={(v) => setPrompt('focus', v)} className="text-[16px]" />
              </label>
              <h2 className="nb-title mb-2 text-2xl text-life-ink">{L('أهم 3', 'Top 3')}</h2>
              <ol data-tour="top3" className="mb-6 flex flex-col gap-1.5">
                {[0, 1, 2].map((k) => {
                  const x = t.top[k];
                  return (
                    <li key={k} className="flex min-h-9 items-center gap-2.5 text-[15.5px]">
                      <span className={clsx('num grid size-7 shrink-0 place-items-center rounded-full border-[1.5px] text-[13px] font-black', x && isDone(x) ? 'border-study-ink bg-study' : 'border-fg')}>
                        {x && isDone(x) ? <Check size={14} /> : k + 1}
                      </span>
                      {x ? (
                        <button onClick={() => setEditing(x)} className={clsx('min-w-0 truncate text-start', isDone(x) ? 'text-fg-2 line-through' : 'nb-hl')}>{x.data.title}</button>
                      ) : (
                        <span className="text-[13.5px] text-fg-3">{k === 0 ? <>{L('اضغط', 'Tap')} <Star size={12} className="inline" /> {L('جنب أي مهمة تحت', 'next to any task below')}</> : '—'}</span>
                      )}
                    </li>
                  );
                })}
              </ol>
              {weekPicks.length > 0 && (
                <div className="-mt-3 mb-6 flex flex-wrap items-center gap-1.5">
                  <span className="text-[12.5px] text-fg-2">{L('من أولويات الأسبوع:', 'From this week’s priorities:')}</span>
                  {weekPicks.map((b) => (
                    <button key={b.id} onClick={() => void createTask({ title: b.title, start: day, important: true, goal_id: b.goal_id, source: 'week' })}
                      className="inline-flex min-h-8 items-center rounded-full border-[1.5px] border-dashed border-line-strong bg-surface px-3 text-[13px] hover:border-solid">+ {b.title}</button>
                  ))}
                </div>
              )}

              {t.overdue.length > 0 && (
                <div className="nb-box mb-5 !py-3">
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-[14px] font-bold text-danger">{L('من أيام سابقة', 'Carried over')} · <span className="num">{t.overdue.length}</span></h3>
                    <button onClick={() => void moveAll(t.overdue, today)} className="text-[13px] font-bold text-accent-ink hover:underline">{L('كلها لليوم', 'All to today')}</button>
                  </div>
                  <ul>
                    {t.overdue.slice(0, 6).map((x) => (
                      <li key={x.id} className="flex min-h-10 items-center gap-2 text-[14px]">
                        <button onClick={() => setEditing(x)} className="min-w-0 flex-1 truncate text-start">{x.data.title}</button>
                        <button onClick={() => void saveTask(x.id, { ...x.data, start: today })} className="h-9 rounded-xs px-2 text-[12.5px] font-bold hover:bg-surface-2">{L('لليوم', 'Today')}</button>
                        <button onClick={() => void saveTask(x.id, { ...x.data, start: shiftKey(today, 1) })} className="h-9 rounded-xs px-2 text-[12.5px] font-bold hover:bg-surface-2">{L('بكرة', 'Tmrw')}</button>
                        {!x.data.due && <button onClick={() => void saveTask(x.id, { ...x.data, start: null, plan_week: ws })} className="h-9 rounded-xs px-2 text-[12.5px] font-bold hover:bg-surface-2">{L('للأسبوع', 'This week')}</button>}
                      </li>
                    ))}
                  </ul>
                  {t.overdue.length > 6 && <Link to="/life/tasks" className="text-[12.5px] font-bold text-accent-ink">{L(`+${t.overdue.length - 6} في المهام`, `+${t.overdue.length - 6} in Tasks`)}</Link>}
                </div>
              )}

              <div data-tour="log">
              <h2 className="nb-title mb-2 text-2xl text-life-ink">{L('السجل السريع', 'Rapid log')}</h2>
              <RapidLog day={day} tasks={t.open} doneTasks={t.done} recurringDone={t.recurringDone} events={events} notes={notes} txns={txns} settings={settings} onOpen={setEditing} />
              </div>
            </div>

            <div className="min-w-0" data-tour="hours">
              <h2 className="nb-title mb-3 text-xl text-life-ink">{L('جدول الساعات', 'Hours')}</h2>
              <TimeBlocks items={items ?? []} day={day} today={today} dayStart={settings.dayStart} dayEnd={settings.dayEnd} h12={h12} />
            </div>
          </div>
        </section>

        {/* ── page two: trackers ── */}
        <section data-tour="trackers" className={clsx('nb-paper nb-page nb-b px-4 pb-6 pt-8 sm:px-7', `paper-${paper}`)} aria-label={L('متتبعات اليوم', 'Day trackers')}>
          <span className="nb-washi -top-2.5 start-16 -rotate-6" style={{ ['--washi' as string]: 'var(--study)' }} aria-hidden="true" />
          <h2 className="nb-title mb-4 text-2xl text-life-ink">{L('متتبّعات اليوم', 'Day trackers')}</h2>
          <Trackers day={day} settings={settings} />
          <Box title={L('صرفت اليوم', 'Spent today')} extra={<Link to="/life/finance" className="font-bold text-accent-ink">{L('المال', 'Money')}</Link>} className="mt-3.5 !py-2.5">
            <p className="text-[14px]"><b className="num">{spent.toLocaleString(locale)} {L('ر.س', 'SAR')}</b>{' '}
              <span className="text-[13px] text-fg-2">{txns.filter((x) => x.data.kind === 'expense').map((x) => `${x.data.description} ${x.data.amount}`).join(' · ') || L('ولا ريال — دوّن «قهوة 15» لو صرفت', 'Nothing — write “coffee 15” if you spend')}</span></p>
          </Box>

          {day === today && (
            <div data-tour="shutdown">
            <Box title={L('إغلاق اليوم', 'Shut down the day')} extra={L('دقيقتين قبل النوم', 'two minutes before bed')} className="mt-3.5 !bg-[color-mix(in_oklab,var(--health)_22%,var(--surface))]">
              <label className="mb-3 flex items-center gap-2.5">
                <span className="shrink-0 text-[13.5px] font-bold">🏆 {L('فوز اليوم:', 'Today’s win:')}</span>
                <WriteLine value={prompts.win ?? ''} label={L('فوز اليوم', 'Today’s win')} placeholder={L('شي واحد مشى زين اليوم', 'One thing that went well')} onSave={(v) => setPrompt('win', v)} className="text-[15px]" />
              </label>
              <ul className="flex flex-col gap-2">
                {shutdown.map((s) => (
                  <li key={s.en} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14.5px]">
                    <span className={clsx('grid size-6 shrink-0 place-items-center rounded-[7px] border-[1.5px]', s.ok ? 'border-study-ink bg-study-ink text-surface' : 'border-line-strong')} aria-hidden="true">{s.ok && <Check size={14} />}</span>
                    <span className={clsx(s.ok && 'text-fg-2')}>{L(s.ar, s.en)}<span className="sr-only">{s.ok ? L(' — تم', ' — done') : L(' — باقي', ' — not yet')}</span></span>
                    {s.act && <span className="text-[13px]">{s.act}</span>}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex justify-end">
                {prompts.closed
                  ? <span className="nb-title text-xl text-health-ink">✓ {L('اليوم مسكّر — أشوفك بكرة', 'Day closed — see you tomorrow')}</span>
                  : <button onClick={() => setPrompt('closed', new Date().toISOString())} className="h-10 rounded-full bg-fg px-5 text-sm font-bold text-bg hover:opacity-90">☾ {L('سكّر اليوم', 'Close the day')}</button>}
              </div>
            </Box>
            </div>
          )}
        </section>
      </div>
      </div>

      <TaskEditor task={editing} open={!!editing} onOpenChange={(v) => !v && setEditing(null)} />
    </div>
  );
}
