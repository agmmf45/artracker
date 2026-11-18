import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Camera, Dumbbell, Pill, Plus, Scale, Sparkles, Trophy, Droplets, ChevronLeft } from 'lucide-react';
import clsx from 'clsx';
import { useI18n } from '@/core/i18n';
import { updateSettings, useNow, useRecords, useRecordsInRange, useSettings } from '@/core/hooks';
import { db } from '@/core/db';
import { newId } from '@/core/ids';
import { create } from '@/core/repo';
import { fmtDate, hijri, rangeKeys, relativeDay, shiftKey, todayKey, weekStartKey } from '@/core/dates';
import { toast } from '@/core/toast';
import { prompt } from '@/design/overlay';
import { Segmented } from '@/design/ui';
import { Bars, Line } from '@/design/charts';
import type { Settings } from '@/core/settings';
import { Box, Sleep, Water } from '@/modules/life/today/Trackers';
import { MuscleMap, MUSCLES } from './MuscleMap';
import { MealAnalyzer, MealEditor, type MealData } from './Nutrition';
import { bestSets, muscleRecovery, setsPerMuscle, suggestTemplate, TEMPLATES, volume, type ActiveWorkout, type ProgramData, type RecoveryState, type WExercise, type WorkoutData } from './workouts/model';
import { startWorkout } from './workouts/start';

type Paper = Settings['notebook']['paper'];
type Tab = 'fit' | 'food' | 'body';

const FILL: Record<Exclude<RecoveryState, 'none'>, string> = {
  fresh: 'color-mix(in oklab, var(--danger) 42%, var(--surface-2))',
  mid: 'color-mix(in oklab, var(--warning) 55%, var(--surface-2))',
  ready: 'color-mix(in oklab, var(--success) 40%, var(--surface-2))',
};
const MEAL_TYPES: Array<[MealData['meal_type'], string, string]> = [['breakfast', 'فطور', 'Breakfast'], ['lunch', 'غداء', 'Lunch'], ['snack', 'سناك', 'Snack'], ['dinner', 'عشاء', 'Dinner']];

/**
 * Health home as a notebook spread (kept from the v4 layout, grown): workouts on one page —
 * start button with today's suggestion, quick templates, the week, volume, a recovery map and
 * programs — and food & body on the other. Every number comes from logged records.
 */
export default function HealthOverview() {
  const { L, lang, locale } = useI18n();
  const settings = useSettings();
  const [params, setParams] = useSearchParams();
  const today = todayKey();
  const raw = params.get('date') ?? '';
  const day = /^\d{4}-\d{2}-\d{2}$/.test(raw) && raw <= today ? raw : today;
  const setDay = (d: string) => setParams(d === today ? {} : { date: d }, { replace: true });
  const [tab, setTab] = useState<Tab>('fit');
  const paper: Paper = settings.notebook?.paper ?? 'dots';
  const strip = rangeKeys(shiftKey(today, -6), 7);
  const [weekday, ...rest] = fmtDate(day, locale, { weekday: 'long', day: 'numeric', month: 'long' }).split(/[،,]\s*/);
  const onNarrow = (t: Tab) => (tab === t ? '' : 'hidden @[1060px]/nb:block');

  return (
    <div className="mx-auto max-w-[1280px]">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] font-bold text-fg-2">{day === today ? L('اليوم', 'Today') : relativeDay(day, lang, locale)} · {hijri(day, lang)}</p>
          <h1 className="nb-title text-[34px] leading-tight md:text-[40px]">{L('الصحة', 'Health')} <span className="nb-hl text-[0.7em]">{weekday}{rest.length ? `، ${rest.join('، ')}` : ''}</span></h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1" role="group" aria-label={L('اختر اليوم', 'Pick a day')}>
            {strip.map((d) => (
              <button key={d} onClick={() => setDay(d)} aria-pressed={d === day} aria-label={fmtDate(d, locale, { weekday: 'long', day: 'numeric', month: 'long' })}
                className={clsx('flex h-12 w-10 flex-col items-center justify-center rounded-sm border text-[11px] leading-tight', d === day ? 'border-fg bg-fg font-bold text-bg' : 'border-line bg-surface hover:bg-surface-2')}>
                <span>{fmtDate(d, locale, { weekday: 'narrow' })}</span>
                <span className="num text-[15px] font-black">{Number(d.slice(8))}</span>
              </button>
            ))}
          </div>
          <Segmented size="sm" value={paper} onChange={(v) => void updateSettings({ notebook: { paper: v } })}
            options={[{ value: 'dots', label: L('نقاط', 'Dots') }, { value: 'lines', label: L('سطور', 'Lines') }, { value: 'grid', label: L('مربعات', 'Grid') }, { value: 'plain', label: L('سادة', 'Plain') }]} />
        </div>
      </header>

      <div className="@container/nb">
        <Segmented className="mb-4 w-full @[1060px]/nb:hidden" value={tab} onChange={setTab}
          options={[{ value: 'fit', label: L('التمارين', 'Training') }, { value: 'food', label: L('السعرات', 'Food') }, { value: 'body', label: L('الجسم', 'Body') }]} />
        <div className="grid grid-cols-1 gap-4 @[1060px]/nb:grid-cols-2 @[1060px]/nb:gap-0">
          <section className={clsx('nb-paper nb-page nb-a @container/pa px-4 pb-6 pt-8 sm:px-7', `paper-${paper}`, onNarrow('fit'))} aria-label={L('التمارين', 'Training')}>
            <span className="nb-washi -top-3 end-14 rotate-3" aria-hidden="true" />
            <Training day={day} />
          </section>
          <section className={clsx('nb-paper nb-page nb-b @container/pb px-4 pb-6 pt-8 sm:px-7', `paper-${paper}`, tab === 'fit' && 'hidden @[1060px]/nb:block')} aria-label={L('السعرات والجسم', 'Food and body')}>
            <div className={onNarrow('food')}><Food day={day} settings={settings} /></div>
            <div className={clsx(tab === 'body' ? 'mt-0 @[1060px]/nb:mt-8' : 'mt-8', onNarrow('body'))}><Body day={day} settings={settings} /></div>
          </section>
        </div>
      </div>
      <p className="mt-4 text-[12px] text-fg-3">{L('لأغراض التنظيم الشخصي فقط، وليس تشخيصاً طبياً.', 'For personal organization only — not medical diagnosis.')}</p>
    </div>
  );
}

/* ───────────────────────── training page ───────────────────────── */

function Training({ day }: { day: string }) {
  const { L, locale, fmtNum } = useI18n();
  const settings = useSettings();
  const nav = useNavigate();
  const now = useNow(60_000);
  const workouts = useRecords<WorkoutData>('workout');
  const programs = useRecords<ProgramData>('program');
  const legacyPrs = useRecords<{ exercise: string; weight: number; reps: number }>('pr');
  const active = useLiveQuery(() => db().meta.get('workout_active').then((r) => (r?.value as ActiveWorkout | null) ?? null), []);
  const [muscle, setMuscle] = useState<string | null>(null);

  const ws = useMemo(() => (workouts ?? []).filter((w) => w.date).map((w) => ({ ...w.data, date: w.date as string })), [workouts]);
  const history = useMemo(() => (workouts ?? []).map((w) => w.data), [workouts]);
  const rec = useMemo(() => muscleRecovery(ws, day), [ws, day]);
  const suggestion = suggestTemplate(rec);
  const prs = useMemo(() => bestSets(ws, (legacyPrs ?? []).map((p) => ({ exercise: p.data.exercise, weight: p.data.weight, reps: p.data.reps, date: p.date }))), [ws, legacyPrs]);

  const weekStart = weekStartKey(day, settings.weekStart);
  const weekDays = rangeKeys(weekStart, 7);
  const thisWeek = ws.filter((w) => w.date >= weekStart && w.date <= shiftKey(weekStart, 6));
  const trainedDays = new Set(thisWeek.map((w) => w.date));
  const weekVol = thisWeek.reduce((s, w) => s + volume(w), 0);
  const weeks = Array.from({ length: 6 }, (_, i) => {
    const s = shiftKey(weekStart, -7 * (5 - i));
    return { label: fmtDate(s, locale, { day: 'numeric', month: 'numeric' }), value: Math.round(ws.filter((w) => w.date >= s && w.date <= shiftKey(s, 6)).reduce((a, w) => a + volume(w), 0)) };
  });
  const tons = (kg: number) => (kg >= 1000 ? `${(kg / 1000).toFixed(1)} ${L('طن', 't')}` : `${fmtNum(Math.round(kg))} ${L('كجم', 'kg')}`);
  const fills = Object.fromEntries(Object.entries(rec).map(([m, r]) => [m, FILL[r.state as Exclude<RecoveryState, 'none'>]]));
  const sets7 = setsPerMuscle(ws.filter((w) => w.date >= shiftKey(day, -6) && w.date <= day));

  const go = async (name: string, program_id: string | null = null, exercises?: WExercise[]) => {
    if (!active) await startWorkout(name, program_id, exercises, history);
    nav('/health/workouts');
  };
  const name = (id: string) => { const m = MUSCLES.find((x) => x.id === id); return m ? L(m.ar, m.en) : id; };
  const stateText = (s: RecoveryState | undefined) => (s === 'fresh' ? L('تتعافى', 'Recovering') : s === 'mid' ? L('شبه جاهزة', 'Almost ready') : s === 'ready' ? L('جاهزة', 'Ready') : L('ما تمرّنتها', 'No data'));
  const tpl = (t: string) => (t === 'Push' ? L('دفع', 'Push') : t === 'Pull' ? L('سحب', 'Pull') : t === 'Legs' ? L('أرجل', 'Legs') : t);
  const ago = (d: number | null | undefined) => (d == null ? L('ما سجّلت لها تمرين', 'No sessions logged') : d === 0 ? L('تمرّنتها اليوم', 'Trained today') : d === 1 ? L('تمرّنتها أمس', 'Trained yesterday') : L(`آخر مرة قبل ${d} أيام`, `Last trained ${d} days ago`));
  const elapsed = active ? Math.max(0, Math.round((now.getTime() - Date.parse(active.started_at)) / 60000)) : 0;
  const trainedToday = trainedDays.has(day);

  const selExercises = muscle ? [...new Set(ws.flatMap((w) => w.exercises.filter((e) => e.muscle === muscle).map((e) => e.name)))].map((n) => [n, prs.get(n)] as const).filter(([, p]) => p).slice(0, 3) : [];

  return (
    <>
      <h2 className="nb-title mb-3 text-2xl text-health-ink">{L('التمارين', 'Training')}</h2>

      <div className="mb-3 flex items-center gap-3 rounded-md bg-fg p-4 text-bg">
        <Dumbbell size={26} className="shrink-0" />
        <div className="min-w-0 flex-1">
          {active ? (
            <><div className="text-lg font-black">{L('عُد للتمرين', 'Back to your workout')}</div><div className="truncate text-[13px] opacity-80">{active.name} · {L(`من ${elapsed} دقيقة`, `${elapsed} min in`)}</div></>
          ) : (
            <><div className="text-lg font-black">{L('ابدأ تمرين', 'Start a workout')}</div>
              <div className="text-[13px] opacity-80">{suggestion ? L(`اقتراح اليوم: ${tpl(suggestion)} — عضلاتها مرتاحة`, `Today’s pick: ${suggestion} — those muscles are rested`) : trainedToday ? L('تمرّنت اليوم ✓', 'Trained today ✓') : L('ابدأ فاضي وأضف التمارين وأنت تمشي', 'Start empty and add exercises as you go')}</div></>
          )}
        </div>
        <button onClick={() => void go(suggestion ?? L('تمرين', 'Workout'), null, suggestion ? undefined : [])} className="h-11 shrink-0 rounded-full bg-health px-5 text-sm font-bold text-on-accent hover:brightness-95">
          {active ? L('كمّل', 'Resume') : L('ابدأ', 'Start')}
        </button>
      </div>

      {!active && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          {[...Object.keys(TEMPLATES), L('كارديو', 'Cardio')].map((t) => (
            <button key={t} onClick={() => void go(t)} className={clsx('h-9 rounded-full border px-3.5 text-[13px] font-bold', t === suggestion ? 'border-health-ink bg-health text-on-accent' : 'border-line bg-surface hover:bg-surface-2')}>
              {tpl(t)}{t === suggestion ? ' ★' : ''}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 @[560px]/pa:grid-cols-2">
        <Box title={L('هذا الأسبوع', 'This week')} extra={L(`${trainedDays.size} من 7 أيام`, `${trainedDays.size} of 7 days`)}>
          <div className="flex justify-between">
            {weekDays.map((d) => (
              <div key={d} className="flex flex-col items-center gap-1 text-[11px] text-fg-2">
                <span className={clsx('grid size-8 place-items-center rounded-full border-[1.5px]', trainedDays.has(d) ? 'border-health-ink bg-health text-on-accent' : 'border-line', d === day && 'ring-2 ring-fg/40')} aria-label={trainedDays.has(d) ? L('تمرّنت', 'Trained') : L('راحة', 'Rest')}>
                  {trainedDays.has(d) ? '✓' : ''}
                </span>
                {fmtDate(d, locale, { weekday: 'narrow' })}
              </div>
            ))}
          </div>
        </Box>
        <div className="grid grid-cols-3 gap-2">
          {[[L('تمارين الأسبوع', 'This week'), fmtNum(thisWeek.length)], [L('حجم الأسبوع', 'Week volume'), tons(weekVol)], [L('كل تمارينك', 'All time'), fmtNum(ws.length)]].map(([k, v]) => (
            <div key={k} className="nb-box flex flex-col justify-center !p-3 text-center">
              <div className="num text-[19px] font-black leading-tight">{v}</div>
              <div className="mt-0.5 text-[11.5px] text-fg-2">{k}</div>
            </div>
          ))}
        </div>
      </div>

      <Box className="mt-4" title={L('الحجم الأسبوعي', 'Weekly volume')} extra={L('آخر 6 أسابيع', 'last 6 weeks')}>
        <Bars data={weeks} height={90} color="var(--health)" format={(v) => tons(v)} />
      </Box>

      <Box className="mt-4" title={L('خريطة الاستشفاء', 'Recovery map')} extra={L('اضغط عضلة', 'Tap a muscle')}>
        <div className="grid grid-cols-1 gap-4 @[560px]/pa:grid-cols-[minmax(0,1fr)_200px]">
          <MuscleMap intensity={{}} fills={fills} selected={muscle} onSelect={(m) => setMuscle(m === muscle ? null : m)} />
          <div className="flex flex-col gap-3">
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-fg-2 @[560px]/pa:flex-col">
              {(['ready', 'mid', 'fresh'] as const).map((s) => <li key={s} className="flex items-center gap-1.5"><span className="size-3 rounded-full border border-line-strong" style={{ background: FILL[s] }} />{stateText(s)}</li>)}
              <li className="flex items-center gap-1.5"><span className="size-3 rounded-full border border-line-strong bg-surface-2" />{stateText(undefined)}</li>
            </ul>
            {muscle ? (
              <div className="rounded-sm border border-line bg-surface p-3 text-[13px]">
                <div className="mb-1 flex items-center justify-between font-bold"><span>{name(muscle)}</span><span className="text-[12px] text-fg-2">{stateText(rec[muscle]?.state)}</span></div>
                <p className="text-fg-2">{ago(rec[muscle]?.days)} · {L(`${sets7[muscle] ?? 0} مجموعة بآخر 7 أيام`, `${sets7[muscle] ?? 0} sets in 7 days`)}</p>
                {selExercises.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {selExercises.map(([n, p]) => <li key={n} className="flex gap-1.5"><Trophy size={13} className="mt-0.5 shrink-0 text-reward-ink" /><span className="min-w-0 flex-1 truncate">{n}</span><span className="num font-bold">{p!.weight}×{p!.reps}</span></li>)}
                  </ul>
                )}
                <Link to="/health/workouts" className="mt-2 inline-block text-[12.5px] font-bold text-health-ink">{L('تمارينها وفيديوهاتها ←', 'Exercises & videos →')}</Link>
              </div>
            ) : (
              <p className="text-[12.5px] text-fg-2">{L('اللون من آخر مرة تمرّنت فيها العضلة. يوم أو أقل: تتعافى، يومين: شبه جاهزة، ثلاثة وأكثر: جاهزة.', 'Colour comes from when you last trained it: ≤1 day recovering, 2 days almost ready, 3+ ready.')}</p>
            )}
          </div>
        </div>
      </Box>

      <Box className="mt-4" title={L('برامجي', 'My programs')} extra={<Link to="/health/workouts" className="font-bold text-health-ink">+ {L('برنامج', 'Program')}</Link>}>
        {!programs?.length ? <p className="text-[13px] text-fg-2">{L('اصنع برنامج أيام (دفع، سحب، أرجل…) وابدأ أي يوم منه بضغطة.', 'Build a multi-day program (Push, Pull, Legs…) and start any day in one tap.')}</p> : (
          <ul className="space-y-2">
            {programs.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-1.5">
                <span className="me-1 font-bold">{p.data.name}</span>
                {p.data.days.map((d, i) => (
                  <button key={i} disabled={!!active} onClick={() => void go(d.name, p.id, d.exercises.map((e) => ({ id: newId('ex'), name: e.name, muscle: e.muscle, notes: '', sets: Array.from({ length: e.sets ?? 3 }, () => ({ reps: e.reps ?? '', weight: '', rpe: '', done: false })) })))}
                    className="h-8 rounded-full border border-line bg-surface px-3 text-[12.5px] font-bold hover:bg-surface-2 disabled:opacity-50">▶ {d.name}</button>
                ))}
              </li>
            ))}
          </ul>
        )}
      </Box>

      <Link to="/health/workouts" className="mt-4 inline-flex items-center gap-1 text-[13px] font-bold text-health-ink">{L('السجل والأرقام القياسية', 'History & records')}<ChevronLeft size={15} className="ltr:rotate-180" /></Link>
    </>
  );
}

/* ───────────────────────── food ───────────────────────── */

function Food({ day, settings }: { day: string; settings: Settings }) {
  const { L, fmtNum } = useI18n();
  const meals = useRecordsInRange<MealData>('meal', day, day);
  const workoutsDay = useRecordsInRange<WorkoutData>('workout', day, day);
  const [add, setAdd] = useState<MealData['meal_type'] | null>(null);
  const [ai, setAi] = useState(false);
  const h = settings.health;
  const xs = meals ?? [];
  const tot = xs.reduce((s, m) => ({ cal: s.cal + (m.data.calories || 0), p: s.p + (m.data.protein || 0), c: s.c + (m.data.carbs || 0), f: s.f + (m.data.fat || 0) }), { cal: 0, p: 0, c: 0, f: 0 });
  const burned = (workoutsDay ?? []).reduce((s, w) => s + (w.data.calories || 0), 0);
  const left = h.calorieGoal + burned - tot.cal;
  const pct = Math.min(100, (tot.cal / Math.max(1, h.calorieGoal + burned)) * 100);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="nb-title text-2xl text-health-ink">{L('السعرات', 'Food')}</h2>
        <button onClick={() => setAi(true)} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-[13px] font-bold hover:bg-surface-2"><Camera size={15} />{L('حلّل وجبة بالصورة', 'Analyze a meal photo')}</button>
      </div>

      <div className="mb-3 rounded-md bg-fg p-4 text-bg">
        <div className="flex items-baseline gap-2">
          <span className="num text-[34px] font-black leading-none">{fmtNum(Math.round(tot.cal))}</span>
          <span className="num text-[14px] opacity-75">/ {fmtNum(h.calorieGoal)} {L('سعرة', 'kcal')}</span>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-bg/25" role="img" aria-label={L(`${Math.round(pct)}٪ من الهدف`, `${Math.round(pct)}% of goal`)}>
          <div className={clsx('h-full rounded-full', left < 0 ? 'bg-warning' : 'bg-health')} style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[12.5px]">
          <span className="rounded-full bg-bg/15 px-2.5 py-1">{left >= 0 ? L(`متبقي ${fmtNum(Math.round(left))}`, `${fmtNum(Math.round(left))} left`) : L(`زيادة ${fmtNum(Math.round(-left))}`, `${fmtNum(Math.round(-left))} over`)}</span>
          {burned > 0 && <span className="rounded-full bg-bg/15 px-2.5 py-1">{L(`محروق +${fmtNum(Math.round(burned))}`, `burned +${fmtNum(Math.round(burned))}`)}</span>}
          <span className="rounded-full bg-bg/15 px-2.5 py-1">{L(`${xs.length} ${xs.length === 1 ? 'صنف' : 'أصناف'}`, `${xs.length} item${xs.length === 1 ? '' : 's'}`)}</span>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2">
        {([[L('بروتين', 'Protein'), tot.p, h.proteinGoal, 'var(--viz-2)'], [L('كارب', 'Carbs'), tot.c, h.carbGoal, 'var(--viz-4)'], [L('دهون', 'Fat'), tot.f, h.fatGoal, 'var(--viz-5)']] as const).map(([label, v, g, col]) => (
          <div key={label} className="nb-box !p-3">
            <div className="flex items-baseline justify-between gap-1 text-[12.5px]"><span className="font-bold">{label}</span>{g ? <span className="num text-[11px] text-fg-2">{Math.round((v / g) * 100)}٪</span> : null}</div>
            <div className="num mt-0.5 text-[15px] font-black">{Math.round(v)}<span className="text-[11.5px] font-medium text-fg-2">{g ? ` / ${g}` : ''} g</span></div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full" style={{ width: `${g ? Math.min(100, (v / g) * 100) : v ? 100 : 0}%`, background: col }} /></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 @[480px]/pb:grid-cols-2">
        {MEAL_TYPES.map(([type, ar, en]) => {
          const items = xs.filter((m) => m.data.meal_type === type);
          const kcal = items.reduce((s, m) => s + (m.data.calories || 0), 0);
          return (
            <Box key={type} title={L(ar, en)} extra={items.length ? <span className="num">{fmtNum(Math.round(kcal))} {L('سعرة', 'kcal')}</span> : undefined}>
              {items.length > 0 && (
                <ul className="mb-2 space-y-1 text-[13.5px]">
                  {items.map((m) => (
                    <li key={m.id} className="flex items-center gap-1.5">
                      <span className="min-w-0 flex-1 truncate">{m.data.name}</span>
                      {m.data.confidence != null ? <span className="inline-flex items-center gap-0.5 rounded-full bg-surface-2 px-1.5 text-[10.5px] font-bold text-fg-2"><Sparkles size={10} />{Math.round(m.data.confidence)}٪</span>
                        : m.data.estimated ? <span className="text-[10.5px] text-fg-3">{L('تقديري', 'est.')}</span> : null}
                      <span className="num text-[12.5px] text-fg-2">{fmtNum(Math.round(m.data.calories || 0))}</span>
                    </li>
                  ))}
                </ul>
              )}
              <button onClick={() => setAdd(type)} className="inline-flex items-center gap-1 text-[13px] font-bold text-health-ink"><Plus size={14} />{L('إضافة', 'Add')}</button>
            </Box>
          );
        })}
      </div>
      <Link to="/health/nutrition" className="mt-3 inline-flex items-center gap-1 text-[13px] font-bold text-health-ink">{L('وجباتي المحفوظة والتفاصيل', 'Saved meals & details')}<ChevronLeft size={15} className="ltr:rotate-180" /></Link>

      {add && <MealEditor initial={{ meal_type: add }} day={day} onClose={() => setAdd(null)} />}
      {ai && <MealAnalyzer day={day} onClose={() => setAi(false)} />}
    </>
  );
}

/* ───────────────────────── body ───────────────────────── */

function Body({ day, settings }: { day: string; settings: Settings }) {
  const { L, locale, fmtNum } = useI18n();
  const water7 = useRecordsInRange<{ ml: number }>('water_log', shiftKey(day, -6), day);
  const all = useRecords<{ kind: string; value: number }>('measurement');
  const meds = useRecords<{ name: string; times?: string[] }>('medication');
  const medLogs = useRecordsInRange<{ medication_id: string }>('med_log', day, day);
  const [v, setV] = useState('');
  const h = settings.health;
  const imperial = settings.units === 'imperial';
  const show = (kg: number) => (imperial ? (kg * 2.20462).toFixed(1) : kg.toFixed(1));
  const unit = imperial ? 'lb' : L('كجم', 'kg');

  const weights = (all ?? []).filter((m) => m.data.kind === 'weight' && m.date && m.date <= day).sort((a, b) => a.date!.localeCompare(b.date!));
  const latest = weights.at(-1);
  const monthAgo = [...weights].reverse().find((w) => w.date! <= shiftKey(day, -30)) ?? weights[0];
  const change = latest && monthAgo && latest !== monthAgo ? latest.data.value - monthAgo.data.value : null;
  const shown = weights.filter((w) => w.date! >= shiftKey(day, -90));
  const goal = h.weightGoal ?? null;
  const days7 = rangeKeys(shiftKey(day, -6), 7);
  const activeMeds = (meds ?? []).filter((m) => m.status !== 'stopped');
  const doses = activeMeds.reduce((s, m) => s + (m.data.times?.length ?? 0), 0);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    let kg = Number(v);
    if (imperial) kg /= 2.20462;
    if (!kg || kg < 25 || kg > 350) { toast(L('أدخل وزناً صحيحاً', 'Enter a valid weight'), { tone: 'error' }); return; }
    await create('measurement', { kind: 'weight', value: Math.round(kg * 10) / 10, unit: 'kg' }, { date: day });
    setV('');
    toast(L('سُجّل الوزن', 'Weight logged'));
  };
  const setGoal = async () => {
    const r = await prompt(L(`هدف الوزن (${unit})`, `Goal weight (${unit})`), { type: 'number', value: goal ? show(goal) : '' });
    if (r === null) return;
    const n = Number(r);
    await updateSettings({ health: { weightGoal: r.trim() === '' || !n ? null : Math.round((imperial ? n / 2.20462 : n) * 10) / 10 } });
  };

  return (
    <>
      <h2 className="nb-title mb-3 text-2xl text-health-ink">{L('الجسم', 'Body')}</h2>
      <div className="grid grid-cols-1 gap-3 @[480px]/pb:grid-cols-2">
        <div className="flex flex-col gap-3">
          <Water day={day} settings={settings} />
          <Box title={L('الماء — 7 أيام', 'Water — 7 days')} icon={<Droplets size={15} className="text-info" />}>
            <Bars data={days7.map((d) => ({ label: fmtDate(d, locale, { weekday: 'narrow' }), value: (water7 ?? []).filter((w) => w.date === d).reduce((s, w) => s + w.data.ml, 0) }))} height={70} color="var(--info)" goal={h.waterGoal} format={(n) => `${fmtNum(n)} ml`} />
          </Box>
        </div>
        <div className="flex flex-col gap-3">
          <Box title={L('الوزن', 'Weight')} icon={<Scale size={15} />} extra={<button onClick={() => void setGoal()} className="font-bold text-health-ink">{goal ? L(`الهدف ${show(goal)}`, `Goal ${show(goal)}`) : L('حدّد هدف', 'Set goal')}</button>}>
            {latest ? (
              <div className="mb-2 flex flex-wrap items-baseline gap-2">
                <span className="num text-[28px] font-black leading-none">{show(latest.data.value)}</span><span className="text-[13px] text-fg-2">{unit}</span>
                {change != null && <span className={clsx('num rounded-full px-2 py-0.5 text-[12px] font-bold', change <= 0 ? 'bg-[color-mix(in_oklab,var(--success)_25%,transparent)]' : 'bg-surface-2')}>{change > 0 ? '+' : ''}{(imperial ? change * 2.20462 : change).toFixed(1)} {L('بالشهر', '/ month')}</span>}
                {goal && <span className="text-[12px] text-fg-2">{L(`باقي ${show(Math.abs(latest.data.value - goal))}`, `${show(Math.abs(latest.data.value - goal))} to go`)}</span>}
              </div>
            ) : <p className="mb-2 text-[13px] text-fg-2">{L('سجّل أول قراءة.', 'Log your first reading.')}</p>}
            {shown.length >= 2 && <Line points={shown.map((w) => ({ x: w.date!.slice(5), y: imperial ? w.data.value * 2.20462 : w.data.value }))} height={90} color="var(--health)" format={(y) => y.toFixed(1)} />}
            <form onSubmit={save} className="mt-2 flex items-center gap-2">
              <input type="number" step="0.1" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} className="nb-write num min-w-0 flex-1 text-[15px]" placeholder={L(`الوزن (${unit})`, `Weight (${unit})`)} aria-label={L('الوزن', 'Weight')} />
              <button type="submit" className="h-9 rounded-full bg-health px-4 text-[13px] font-bold text-on-accent hover:brightness-95">{L('حفظ', 'Save')}</button>
            </form>
          </Box>
          <Sleep day={day} settings={settings} />
          {activeMeds.length > 0 && (
            <Link to="/health/medication" className="nb-box flex items-center gap-2 hover:bg-surface-2">
              <Pill size={16} className="text-health-ink" /><span className="flex-1 text-[14px] font-bold">{L('أدوية اليوم', 'Medication today')}</span>
              <span className="num text-[14px] font-black">{medLogs?.length ?? 0}/{doses}</span>
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
