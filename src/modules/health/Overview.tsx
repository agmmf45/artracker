import { Link } from 'react-router';
import { Apple, Droplets, Dumbbell, Moon, Scale, Pill } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useRecords, useRecordsInRange, useSettings } from '@/core/hooks';
import { rangeKeys, shiftKey, todayKey, weekStartKey } from '@/core/dates';
import { Bar, Card, CardHeader, Ring, Stat } from '@/design/ui';
import { Bars } from '@/design/charts';
import { logWater } from '@/modules/shared/domain';
import { toast } from '@/core/toast';
import type { WorkoutData } from './workouts/model';

/** Health overview — recorded data only; no invented health or recovery score. */
export default function HealthOverview() {
  const { L, fmtNum } = useI18n();
  const settings = useSettings();
  const h = settings.health;
  const today = todayKey();
  const from = shiftKey(today, -13);
  const meals = useRecordsInRange<{ calories: number; protein: number }>('meal', from, today);
  const water = useRecordsInRange<{ ml: number }>('water_log', from, today);
  const sleep = useRecordsInRange<{ hours: number; nap: boolean }>('sleep_log', shiftKey(today, -1), today);
  const workouts = useRecordsInRange<WorkoutData>('workout', shiftKey(today, -27), today);
  const weights = useRecords<{ kind: string; value: number }>('measurement');
  const meds = useRecords<{ name: string; times?: string[] }>('medication');
  const medLogs = useRecordsInRange<{ medication_id: string }>('med_log', today, today);
  const sum = <T,>(xs: Array<{ date: string | null; data: T }> | undefined, d: string, f: (x: T) => number) => (xs ?? []).filter((x) => x.date === d).reduce((s, x) => s + f(x.data), 0);
  const kcal = sum(meals, today, (m) => m.calories);
  const protein = sum(meals, today, (m) => m.protein);
  const ml = sum(water, today, (w) => w.ml);
  const night = (sleep ?? []).filter((s) => !s.data.nap).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0];
  const w = (weights ?? []).filter((x) => x.data.kind === 'weight').sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  const ws = weekStartKey(today, settings.weekStart);
  const weekWorkouts = (workouts ?? []).filter((x) => (x.date ?? '') >= ws).length;
  const activeMeds = (meds ?? []).filter((m) => m.status !== 'stopped');
  const dosesToday = activeMeds.reduce((s, m) => s + (m.data.times?.length ?? 0), 0);
  const days = rangeKeys(from, 14);

  return (
    <div>
      <h1 className="mb-5 text-2xl font-black">{L('صحتي', 'My health')}</h1>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link to="/health/nutrition" className="card flex items-center gap-3 p-4 hover:border-line-strong">
          <Ring value={kcal} max={h.calorieGoal} size={64} stroke={6} color="var(--health)"><Apple size={18} className="text-health" /></Ring>
          <Stat label={L('السعرات', 'Calories')} value={fmtNum(Math.round(kcal))} sub={`/ ${fmtNum(h.calorieGoal)} · P ${Math.round(protein)}g`} />
        </Link>
        <div className="card flex items-center gap-3 p-4">
          <button onClick={async () => { await logWater(250); toast(L('+250 مل', '+250 ml')); }} aria-label={L('أضف 250 مل', 'Add 250 ml')}><Ring value={ml} max={h.waterGoal} size={64} stroke={6} color="var(--info)"><Droplets size={18} className="text-info" /></Ring></button>
          <Link to="/health/water"><Stat label={L('الماء', 'Water')} value={`${fmtNum(ml)}`} sub={`/ ${fmtNum(h.waterGoal)} ml`} /></Link>
        </div>
        <Link to="/health/sleep" className="card flex items-center gap-3 p-4 hover:border-line-strong">
          <Ring value={night?.data.hours ?? 0} max={h.sleepGoalHours} size={64} stroke={6} color="var(--viz-1)"><Moon size={18} style={{ color: 'var(--viz-1)' }} /></Ring>
          <Stat label={L('نوم البارحة', 'Last night')} value={night ? `${night.data.hours.toFixed(1)}${L('س', 'h')}` : '—'} sub={night ? undefined : L('لم يُسجّل', 'not logged')} />
        </Link>
        <Link to="/health/workouts" className="card flex items-center gap-3 p-4 hover:border-line-strong">
          <div className="grid size-16 place-items-center rounded-full bg-[color-mix(in_oklab,var(--health)_38%,transparent)]"><Dumbbell size={22} className="text-health" /></div>
          <Stat label={L('تمارين الأسبوع', 'Workouts this week')} value={weekWorkouts} sub={(workouts ?? []).some((x) => x.date === today) ? L('تمرّنت اليوم ✓', 'trained today ✓') : undefined} />
        </Link>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4"><CardHeader title={L('السعرات — 14 يوم', 'Calories — 14 days')} icon={<Apple size={16} />} /><Bars data={days.map((d) => ({ label: d.slice(8), value: sum(meals, d, (m) => m.calories) }))} height={100} color="var(--health)" goal={h.calorieGoal} /></Card>
        <Card className="p-4"><CardHeader title={L('الماء — 14 يوم', 'Water — 14 days')} icon={<Droplets size={16} />} /><Bars data={days.map((d) => ({ label: d.slice(8), value: sum(water, d, (x) => x.ml) }))} height={100} color="var(--info)" goal={h.waterGoal} /></Card>
        <Card className="p-4">
          <CardHeader title={L('الوزن', 'Weight')} icon={<Scale size={16} />} action={<Link to="/health/weight" className="text-[12px] font-bold text-health">{L('الكل', 'All')}</Link>} />
          {w.length ? <div className="num text-2xl font-black">{w.at(-1)!.data.value} kg <span className="text-sm font-bold text-fg-3">{w.length > 1 ? `${(w.at(-1)!.data.value - w.at(-2)!.data.value >= 0 ? '+' : '')}${(w.at(-1)!.data.value - w.at(-2)!.data.value).toFixed(1)}` : ''}</span></div> : <p className="text-sm text-fg-3">{L('لا قراءات', 'No readings')}</p>}
        </Card>
        {activeMeds.length > 0 && (
          <Card className="p-4">
            <CardHeader title={L('أدوية اليوم', 'Medication today')} icon={<Pill size={16} />} action={<Link to="/health/medication" className="text-[12px] font-bold text-health">{L('فتح', 'Open')}</Link>} />
            <div className="num text-2xl font-black">{medLogs?.length ?? 0}/{dosesToday}</div>
            <Bar className="mt-2" value={medLogs?.length ?? 0} max={Math.max(1, dosesToday)} color="var(--health)" />
          </Card>
        )}
      </div>
      <p className="mt-4 text-[12px] text-fg-3">{L('لأغراض التنظيم الشخصي فقط، وليس تشخيصاً طبياً.', 'For personal organization only — not medical diagnosis.')}</p>
    </div>
  );
}
