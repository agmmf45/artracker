import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Droplets, Moon, UtensilsCrossed, Lock, Check, Repeat } from 'lucide-react';
import clsx from 'clsx';
import { useI18n } from '@/core/i18n';
import { useRecords, useRecordsInRange } from '@/core/hooks';
import { create, remove } from '@/core/repo';
import { fmtTime } from '@/core/dates';
import { toast } from '@/core/toast';
import type { Settings } from '@/core/settings';
import { logWater, type JournalData, type WaterData } from '@/modules/shared/domain';
import type { MealData } from '@/modules/health/Nutrition';
import { sleepHours } from '@/modules/health/sleepLogic';
import { indexLogs, isPaused, isScheduled, logDone, toggleHabit, type HabitData, type HabitLogData } from '../habits/model';
import { dayMood, dayPageId, patchDayPage, type DayPageData } from './dayPage';

interface SleepData { bed: string; wake: string; hours: number; quality: number | null; nap: boolean; notes: string }

export function Box({ title, icon, extra, children, className }: { title: ReactNode; icon?: ReactNode; extra?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx('nb-box', className)}>
      <h3 className="mb-2.5 flex items-center gap-2 text-[15px] font-bold">{icon}{title}{extra && <span className="ms-auto text-[12.5px] font-medium text-fg-2">{extra}</span>}</h3>
      {children}
    </section>
  );
}

const MEAL_TYPES: Array<[MealData['meal_type'], string, string]> = [['breakfast', 'فطور', 'Breakfast'], ['lunch', 'غداء', 'Lunch'], ['snack', 'سناك', 'Snack'], ['dinner', 'عشاء', 'Dinner']];

function Meals({ day }: { day: string }) {
  const { L } = useI18n();
  const meals = useRecordsInRange<MealData>('meal', day, day);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const add = async (type: MealData['meal_type']) => {
    const name = (draft[type] ?? '').trim();
    if (!name) return;
    await create<MealData>('meal', { meal_type: type, name, calories: 0, protein: 0, carbs: 0, fat: 0, estimated: false, photo_id: null, analysis_id: null, extra: { from: 'notebook' } }, { date: day });
    setDraft((d) => ({ ...d, [type]: '' }));
  };
  return (
    <Box title={L('الوجبات', 'Meals')} icon={<UtensilsCrossed size={16} className="text-life-ink" />} extra={<Link to="/health/nutrition?tab=meals" className="font-bold text-accent-ink hover:underline">{L('السعرات', 'Calories')}</Link>}>
      <div className="flex flex-col gap-1.5">
        {MEAL_TYPES.map(([type, ar, en]) => {
          const xs = (meals ?? []).filter((m) => m.data.meal_type === type);
          return (
            <div key={type} className="flex items-baseline gap-2 text-[14.5px]">
              <b className="w-14 shrink-0">{L(ar, en)}</b>
              <div className="min-w-0 flex-1">
                {xs.length > 0 && <span>{xs.map((m) => m.data.name).join(' + ')}</span>}
                <form onSubmit={(e) => { e.preventDefault(); void add(type); }} className={xs.length ? 'mt-0.5' : ''}>
                  <input value={draft[type] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [type]: e.target.value }))}
                    className="nb-write text-[14px]" placeholder={xs.length ? L('+ أضف', '+ add') : L('وش أكلت؟', 'What did you eat?')}
                    aria-label={L(`أضف ${ar}`, `Add ${en.toLowerCase()}`)} enterKeyHint="done" />
                </form>
              </div>
            </div>
          );
        })}
      </div>
    </Box>
  );
}

export function Water({ day, settings }: { day: string; settings: Settings }) {
  const { L, fmtNum } = useI18n();
  const logs = useRecordsInRange<WaterData>('water_log', day, day);
  const goal = settings.health.waterGoal;
  // a "glass": the user's first serving of 200 ml or more, grown if needed so the goal fits in 12 glasses
  const base = settings.health.waterServings.find((ml) => ml >= 200) ?? 250;
  const serving = Math.max(base, Math.ceil(goal / 12 / 10) * 10);
  const cups = Math.min(12, Math.max(4, Math.ceil(goal / serving)));
  const total = (logs ?? []).reduce((s, l) => s + l.data.ml, 0);
  const full = Math.min(cups, Math.floor(total / serving));
  const tap = async (k: number) => {
    if (k < full) {
      // tapping the last filled cup takes the latest log back
      const last = [...(logs ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      if (last && k === full - 1) await remove(last.id);
      return;
    }
    await logWater(serving, day);
  };
  return (
    <Box title={L('الماء', 'Water')} icon={<Droplets size={16} className="text-info" />} extra={<bdi dir="ltr" className="num">{fmtNum(total)} / {fmtNum(goal)} ml</bdi>}>
      <div className="flex flex-wrap">
        {Array.from({ length: cups }, (_, k) => (
          <button key={k} onClick={() => void tap(k)} className="grid h-11 w-8 place-items-center rounded-xs hover:bg-surface-2"
            aria-label={k < full ? L(`كوب ${k + 1} — مشروب`, `Glass ${k + 1} — done`) : L(`اشرب كوب (${serving} مل)`, `Log a glass (${serving} ml)`)} aria-pressed={k < full}>
            <svg width="24" height="32" viewBox="0 0 24 32" aria-hidden="true">
              <path d="M6 11h12l-1.6 17H7.6Z" fill={k < full ? 'color-mix(in oklab, var(--info) 45%, var(--surface))' : 'transparent'} />
              <path d="M3 3h18l-2.6 26H5.6Z" fill="none" stroke="var(--info)" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </button>
        ))}
      </div>
      <p className="mt-1 text-[12px] text-fg-2">{L(`كل كوب ${serving} مل · اضغط آخر كوب ممتلئ للتراجع`, `Each glass ${serving} ml · tap the last full one to undo`)}</p>
    </Box>
  );
}

export function Sleep({ day, settings }: { day: string; settings: Settings }) {
  const { L, locale } = useI18n();
  const logs = useRecordsInRange<SleepData>('sleep_log', day, day);
  const night = (logs ?? []).find((l) => !l.data.nap);
  const [bed, setBed] = useState('23:30');
  const [wake, setWake] = useState('07:00');
  const h12 = settings.timeFormat === '12';
  const goal = settings.health.sleepGoalHours;
  const save = async () => {
    await create<SleepData>('sleep_log', { bed, wake, hours: sleepHours(bed, wake), quality: null, nap: false, notes: '' }, { date: day });
    toast(L('سُجّل نومك', 'Sleep logged'));
  };
  if (night) {
    const h = night.data.hours;
    const pct = Math.min(100, (h / Math.max(goal, 1)) * 100);
    return (
      <Box title={L('النوم', 'Sleep')} icon={<Moon size={16} className="text-health-ink" />} extra={<span className="num">{Math.floor(h)}{L('س', 'h')} {Math.round((h % 1) * 60)}{L('د', 'm')}</span>}>
        <div className="h-6 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={L(`${h.toFixed(1)} من ${goal} ساعات`, `${h.toFixed(1)} of ${goal} hours`)}>
          <div className="h-full rounded-full bg-health" style={{ width: `${pct}%` }} />
        </div>
        <div className="num mt-1.5 flex justify-between text-[12px] text-fg-2">
          <span>{L('نمت', 'Bed')} {fmtTime(night.data.bed, locale, h12)}</span>
          <span>{L('الهدف', 'Goal')} {goal}{L('س', 'h')}</span>
          <span>{L('صحيت', 'Up')} {fmtTime(night.data.wake, locale, h12)}</span>
        </div>
      </Box>
    );
  }
  return (
    <Box title={L('النوم', 'Sleep')} icon={<Moon size={16} className="text-health-ink" />} extra={<span className="num">{sleepHours(bed, wake).toFixed(1)}{L('س', 'h')}</span>}>
      <div className="flex flex-col gap-1.5">
        <label className="flex items-center justify-between gap-2 text-[13px] text-fg-2">{L('نمت', 'Bed')}<input type="time" value={bed} onChange={(e) => setBed(e.target.value)} className="nb-write num !w-32 text-[14.5px]" /></label>
        <label className="flex items-center justify-between gap-2 text-[13px] text-fg-2">{L('صحيت', 'Up')}<input type="time" value={wake} onChange={(e) => setWake(e.target.value)} className="nb-write num !w-32 text-[14.5px]" /></label>
        <button onClick={() => void save()} className="mt-1 h-10 rounded-full bg-health text-sm font-bold text-on-accent hover:brightness-95">{L('سجّل نوم الليلة', 'Log last night')}</button>
      </div>
    </Box>
  );
}

const MOUTHS = ['M8 19c3-3 7-3 10 0', 'M8 18c3-1.5 7-1.5 10 0', 'M8 17h10', 'M8 16c3 2 7 2 10 0', 'M7 15c3 4 9 4 12 0'];
const MOOD_LABELS: Array<[string, string]> = [['سيئ', 'Bad'], ['متضايق', 'Low'], ['عادي', 'Okay'], ['زين', 'Good'], ['ممتاز', 'Great']];

function Mood({ day, entries }: { day: string; entries: Array<import('@shared/records').Rec<JournalData>> | undefined }) {
  const { L } = useI18n();
  const { mood, energy } = dayMood(entries, day);
  return (
    <Box title={L('المزاج والطاقة', 'Mood & energy')}>
      <div className="flex justify-between gap-1" role="radiogroup" aria-label={L('المزاج', 'Mood')}>
        {MOUTHS.map((d, k) => {
          const v = k + 1;
          const on = mood === v;
          return (
            <button key={v} role="radio" aria-checked={on} aria-label={L(MOOD_LABELS[k][0], MOOD_LABELS[k][1])}
              onClick={() => void patchDayPage(day, { mood: on ? null : v })}
              className={clsx('grid size-11 place-items-center rounded-full border-[1.5px] transition', on ? 'border-reward-ink bg-reward' : 'border-line-strong bg-surface hover:bg-surface-2')}>
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="var(--text)" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                <circle cx="9" cy="10" r="1" fill="var(--text)" /><circle cx="17" cy="10" r="1" fill="var(--text)" /><path d={d} />
              </svg>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-2 text-[13.5px]">
        <span className="text-fg-2">{L('الطاقة', 'Energy')}</span>
        <div className="flex gap-1" role="radiogroup" aria-label={L('الطاقة', 'Energy')}>
          {[1, 2, 3, 4, 5].map((v) => (
            <button key={v} role="radio" aria-checked={energy === v} aria-label={`${v}/5`} onClick={() => void patchDayPage(day, { energy: energy === v ? null : v })}
              className="grid size-8 place-items-center">
              <span className={clsx('size-5 rounded-[5px] border-[1.5px]', energy != null && v <= energy ? 'border-reward-ink bg-reward' : 'border-line-strong')} />
            </button>
          ))}
        </div>
      </div>
    </Box>
  );
}

function Habits({ day, settings }: { day: string; settings: Settings }) {
  const { L } = useI18n();
  const habits = useRecords<HabitData>('habit');
  const logs = useRecordsInRange<HabitLogData>('habit_log', day, day);
  const idx = useMemo(() => indexLogs(logs), [logs]);
  const list = (habits ?? []).filter((h) => h.status !== 'archived' && isScheduled(h.data, day) && !isPaused(h.data, day)).sort((a, b) => a.data.order - b.data.order);
  const done = list.filter((h) => logDone(h.data, idx.get(h.id)?.get(day))).length;
  return (
    <Box title={L('عادات اليوم', "Today's habits")} icon={<Repeat size={16} className="text-study-ink" />} extra={list.length ? <span className="num">{done}/{list.length}</span> : null}>
      {list.length === 0 ? (
        <p className="text-[13.5px] text-fg-2">{L('ما عندك عادات لهاليوم.', 'No habits scheduled today.')} <Link to="/life/habits" className="font-bold text-accent-ink hover:underline">{L('أضف عادة', 'Add a habit')}</Link></p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {list.map((h) => {
            const log = idx.get(h.id)?.get(day);
            const ok = logDone(h.data, log);
            return (
              <button key={h.id} onClick={() => void toggleHabit(h, day, log, settings)} aria-pressed={ok}
                className={clsx('inline-flex min-h-10 items-center gap-1.5 rounded-full border-[1.5px] px-3 text-[13.5px] font-medium transition',
                  ok ? 'border-study-ink bg-[color-mix(in_oklab,var(--study)_45%,var(--surface))]' : 'border-dashed border-line-strong bg-surface hover:border-solid')}>
                {ok ? <Check size={14} className="text-study-ink" /> : <span aria-hidden="true">{h.data.icon}</span>}
                {h.data.name}
                {h.data.kind !== 'check' && <span className="num text-[12px] text-fg-2">{log?.data.value ?? 0}/{h.data.target}{h.data.unit ? ` ${h.data.unit}` : ''}</span>}
              </button>
            );
          })}
        </div>
      )}
    </Box>
  );
}

/** Text that saves when you leave the field (no save button, nothing lost on refresh mid-typing). */
export function WriteLine({ value, onSave, label, placeholder, className }: { value: string; onSave: (v: string) => void; label: string; placeholder?: string; className?: string }) {
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  return (
    <input value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { if (v !== value) onSave(v.trim()); }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      aria-label={label} placeholder={placeholder} className={clsx('nb-write', className)} />
  );
}

function Reflection({ day, page }: { day: string; page: DayPageData | undefined }) {
  const { L } = useI18n();
  const grat = [0, 1, 2].map((k) => page?.gratitude?.[k] ?? '');
  return (
    <>
      <Box title={L('الامتنان', 'Gratitude')} className="lg:col-span-1">
        <ol className="flex flex-col gap-1">
          {grat.map((g, k) => (
            <li key={k} className="flex items-baseline gap-2"><span className="num w-4 text-[13px] font-bold text-fg-2">{k + 1}</span>
              <WriteLine value={g} label={L(`شي ممتن له ${k + 1}`, `Grateful for ${k + 1}`)} placeholder={k === 0 ? L('شي صغير يكفي…', 'Something small is enough…') : ''}
                onSave={(v) => { const next = [...grat]; next[k] = v; void patchDayPage(day, { gratitude: next }); }} className="text-[15px]" />
            </li>
          ))}
        </ol>
      </Box>
      <Box title={L('سطر اليوم', 'Line of the day')}>
        <WriteLine value={page?.prompts?.line ?? ''} label={L('سطر اليوم', 'Line of the day')} placeholder={L('ذكرى اليوم بسطر واحد', 'Today in one line')}
          onSave={(v) => void patchDayPage(day, { prompts: { ...(page?.prompts ?? {}), line: v } })} className="text-[15px]" />
        <p className="mt-2 text-[12px] text-fg-2">{L('يتحفظ في اليوميات — خاص فيك.', 'Saved to your journal — private.')}</p>
      </Box>
    </>
  );
}

export function Trackers({ day, settings }: { day: string; settings: Settings }) {
  const { L } = useI18n();
  const entries = useRecordsInRange<JournalData>('journal', day, day);
  const page = entries?.find((e) => e.id === dayPageId(day))?.data as DayPageData | undefined;
  const [unlocked, setUnlocked] = useState(!settings.privacy.lockJournal);
  useEffect(() => { setUnlocked(!settings.privacy.lockJournal); }, [settings.privacy.lockJournal, day]);

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
      <Meals day={day} />
      <Water day={day} settings={settings} />
      <Sleep day={day} settings={settings} />
      {unlocked ? <Mood day={day} entries={entries} /> : null}
      <div className="sm:col-span-2"><Habits day={day} settings={settings} /></div>
      {unlocked ? <Reflection day={day} page={page} /> : (
        <button onClick={() => setUnlocked(true)} className="nb-box flex items-center justify-center gap-2 text-sm font-bold text-fg-2 hover:text-fg sm:col-span-2">
          <Lock size={16} />{L('المزاج والامتنان مقفلة — افتح', 'Mood & gratitude are locked — open')}
        </button>
      )}
    </div>
  );
}
