import { useState } from 'react';
import { Droplets, Trash2, Plus } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { updateSettings, useRecordsInRange, useSettings } from '@/core/hooks';
import { remove } from '@/core/repo';
import { rangeKeys, relativeDay, shiftKey, todayKey } from '@/core/dates';
import { toast } from '@/core/toast';
import { Button, Card, Chip, IconButton, Input, PageHeader, Ring, Stat } from '@/design/ui';
import { Bars } from '@/design/charts';
import { logWater } from '@/modules/shared/domain';

/** Water: quick servings, custom amount, daily goal, history. Day keys are local (v4 UTC bug fixed). */
export default function Water() {
  const { L, lang, locale, fmtNum } = useI18n();
  const settings = useSettings();
  const [day, setDay] = useState(todayKey());
  const [custom, setCustom] = useState('');
  const logs = useRecordsInRange<{ ml: number; time: string | null }>('water_log', shiftKey(todayKey(), -29), todayKey());
  const goal = settings.health.waterGoal;
  const dayLogs = (logs ?? []).filter((l) => l.date === day).sort((a, b) => (b.data.time ?? '').localeCompare(a.data.time ?? ''));
  const total = dayLogs.reduce((s, l) => s + l.data.ml, 0);
  const byDay = (d: string) => (logs ?? []).filter((l) => l.date === d).reduce((s, l) => s + l.data.ml, 0);
  const days30 = rangeKeys(shiftKey(todayKey(), -29), 30);
  const hit = days30.filter((d) => byDay(d) >= goal).length;
  const add = async (ml: number) => { await logWater(ml, day); toast(L(`+${ml} مل`, `+${ml} ml`)); };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={L('الماء', 'Water')} />
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 scroll-thin">{rangeKeys(shiftKey(todayKey(), -6), 7).map((d) => <Chip key={d} active={d === day} onClick={() => setDay(d)}>{relativeDay(d, lang, locale)}</Chip>)}</div>
      <Card className="mb-4 flex flex-col items-center p-6">
        <Ring value={total} max={goal} size={180} stroke={12} color="var(--info)" label={L('الماء اليوم', 'Water today')}>
          <div><Droplets size={22} className="mx-auto text-info" /><div className="num text-3xl font-black">{fmtNum(total)}</div><div className="num text-[12px] text-fg-3">/ {fmtNum(goal)} ml</div></div>
        </Ring>
        {total >= goal && <p className="anim-in mt-3 text-sm font-bold text-success">{L('وصلت هدفك 💧', 'Goal reached 💧')}</p>}
        <div className="mt-5 flex flex-wrap justify-center gap-2">{settings.health.waterServings.map((ml) => <Button key={ml} size="lg" onClick={() => add(ml)}>+{ml} ml</Button>)}</div>
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); const v = Number(custom); if (v >= 10 && v <= 3000) { void add(v); setCustom(''); } }}>
          <input type="number" className="field w-32" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="ml" aria-label={L('كمية مخصصة', 'Custom amount')} />
          <IconButton type="submit" label={L('أضف', 'Add')}><Plus size={18} /></IconButton>
        </form>
      </Card>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Card className="p-4"><Stat label={L('متوسط 7 أيام', '7-day average')} value={`${fmtNum(Math.round(rangeKeys(shiftKey(todayKey(), -6), 7).reduce((s, d) => s + byDay(d), 0) / 7))} ml`} /></Card>
        <Card className="p-4"><Stat label={L('أيام حققت الهدف', 'Days at goal')} value={`${hit}/30`} /></Card>
        <Card className="p-4"><Input type="number" step={250} label={L('الهدف اليومي (مل)', 'Daily goal (ml)')} value={goal} onChange={(e) => updateSettings({ health: { waterGoal: Math.max(500, Number(e.target.value) || 2000) } })} /></Card>
      </div>
      <Card className="mb-4 p-4"><div className="mb-2 text-[13px] font-bold text-fg-2">{L('آخر 14 يوم', 'Last 14 days')}</div><Bars data={days30.slice(-14).map((d) => ({ label: d.slice(8), value: byDay(d) }))} height={100} color="var(--info)" goal={goal} format={(v) => `${v} ml`} /></Card>
      {dayLogs.length > 0 && (
        <Card className="divide-y divide-line">
          {dayLogs.map((l) => <div key={l.id} className="flex items-center gap-3 px-4 py-2 text-sm"><Droplets size={14} className="text-info" /><span className="num w-14 text-fg-2">{l.data.time ?? '—'}</span><span className="num flex-1 font-bold">{l.data.ml} ml</span><IconButton size="sm" tone="danger" label={L('حذف', 'Delete')} onClick={() => remove(l.id)}><Trash2 size={14} /></IconButton></div>)}
        </Card>
      )}
    </div>
  );
}
