import { useState } from 'react';
import { BatteryCharging } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useRecordsInRange } from '@/core/hooks';
import { create } from '@/core/repo';
import { daysBetween, shiftKey, todayKey } from '@/core/dates';
import { Card, EmptyState, PageHeader, Stat } from '@/design/ui';
import { MUSCLES } from './MuscleMap';
import { setsPerMuscle, type WorkoutData } from './workouts/model';

/**
 * Recovery view built only from what you logged: days since each muscle was trained, sets in the last
 * 7 days, your soreness ratings and recent sleep. No invented "recovery score".
 */
export default function Recovery() {
  const { L } = useI18n();
  const today = todayKey();
  const workouts = useRecordsInRange<WorkoutData>('workout', shiftKey(today, -60), today);
  const sore = useRecordsInRange<{ muscle: string; level: number }>('soreness', shiftKey(today, -3), today);
  const sleep = useRecordsInRange<{ hours: number; nap: boolean }>('sleep_log', shiftKey(today, -2), today);
  const [level, setLevel] = useState<Record<string, number>>({});
  const last: Record<string, string> = {};
  for (const w of workouts ?? []) for (const e of w.data.exercises) if (!last[e.muscle] || (w.date ?? '') > last[e.muscle]) last[e.muscle] = w.date!;
  const sets7 = setsPerMuscle((workouts ?? []).filter((w) => (w.date ?? '') >= shiftKey(today, -6)).map((w) => w.data));
  const nights = (sleep ?? []).filter((s) => !s.data.nap);
  const avgSleep = nights.length ? nights.reduce((s, n) => s + n.data.hours, 0) / nights.length : null;
  const todaySore = new Map((sore ?? []).filter((s) => s.date === today).map((s) => [s.data.muscle, s.data.level]));

  if (!workouts?.length) return <div><PageHeader title={L('الاستشفاء', 'Recovery')} /><EmptyState icon={<BatteryCharging size={28} />} title={L('سجّل تمارينك لترى حالة كل عضلة', 'Log workouts to see each muscle’s status')} /></div>;
  return (
    <div>
      <PageHeader title={L('الاستشفاء', 'Recovery')} subtitle={L('مبني على ما سجّلته فقط — ليس تقييماً طبياً.', 'Based only on what you logged — not a medical assessment.')} />
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Card className="p-4"><Stat label={L('متوسط النوم (آخر 3 ليالٍ)', 'Sleep (last 3 nights)')} value={avgSleep != null ? `${avgSleep.toFixed(1)}${L('س', 'h')}` : '—'} /></Card>
        <Card className="p-4"><Stat label={L('تمارين آخر 7 أيام', 'Workouts, last 7 days')} value={(workouts ?? []).filter((w) => (w.date ?? '') >= shiftKey(today, -6)).length} /></Card>
      </div>
      <Card className="divide-y divide-line">
        {MUSCLES.filter((m) => m.id !== 'رجل').map((m) => {
          const d = last[m.id] ? daysBetween(last[m.id], today) : null;
          const status = d === null ? { t: L('لم تُمرَّن', 'Not trained'), c: 'var(--text-3)' } : d < 2 ? { t: L('تمرّنت مؤخراً', 'Recently trained'), c: 'var(--warning)' } : { t: L('جاهزة غالباً', 'Likely ready'), c: 'var(--success)' };
          const s = todaySore.get(m.id) ?? level[m.id];
          return (
            <div key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <span className="min-w-28 font-bold">{L(m.ar, m.en)}</span>
              <span className="text-[12px] font-bold" style={{ color: status.c }}>{status.t}</span>
              <span className="num text-[12px] text-fg-3">{d !== null ? L(`قبل ${d} يوم`, `${d}d ago`) : ''} · {sets7[m.id] ?? 0} {L('مجموعة/7 أيام', 'sets/7d')}</span>
              <span className="flex-1" />
              <div className="flex items-center gap-1" role="group" aria-label={L('الإرهاق العضلي اليوم', 'Soreness today')}>
                {[0, 1, 2, 3].map((n) => (
                  <button key={n} aria-pressed={s === n} onClick={async () => { setLevel({ ...level, [m.id]: n }); await create('soreness', { muscle: m.id, level: n }, { id: `sore:${m.id}:${today}`, date: today }).catch(() => {}); }}
                    className={`size-7 rounded-full text-[11px] font-bold ${s === n ? 'bg-health text-on-accent' : 'bg-surface-2 text-fg-3'}`} title={[L('لا ألم', 'None'), L('خفيف', 'Mild'), L('متوسط', 'Moderate'), L('شديد', 'Strong')][n]}>{n}</button>
                ))}
              </div>
            </div>
          );
        })}
      </Card>
      <p className="mt-3 text-[12px] text-fg-3">{L('الألم الشديد أو المستمر يستحق مراجعة مختص.', 'Strong or persistent pain is worth checking with a professional.')}</p>
    </div>
  );
}
