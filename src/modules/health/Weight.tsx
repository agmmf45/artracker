import { useState } from 'react';
import { Scale, Trash2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useRecords, useSettings } from '@/core/hooks';
import { create, remove } from '@/core/repo';
import { fmtDate, todayKey } from '@/core/dates';
import { toast } from '@/core/toast';
import { Button, Card, EmptyState, IconButton, Input, PageHeader, Segmented, Stat } from '@/design/ui';
import { Line } from '@/design/charts';

interface M { kind: string; value: number; unit: string; source?: string | null; photo_id?: string | null; note?: string }

/** Body weight (v4 bodyweight entries are migrated here as measurement kind "weight"). BMI optional. */
export default function Weight() {
  const { L, locale } = useI18n();
  const settings = useSettings();
  const all = useRecords<M>('measurement');
  const [v, setV] = useState('');
  const [date, setDate] = useState(todayKey());
  const [range, setRange] = useState<'30' | '90' | 'all'>('90');
  const ws = (all ?? []).filter((m) => m.data.kind === 'weight').sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  const cutoff = range === 'all' ? '' : new Date(Date.now() - Number(range) * 864e5).toISOString().slice(0, 10);
  const shown = ws.filter((w) => (w.date ?? '') >= cutoff);
  const latest = ws.at(-1);
  const first = shown[0];
  const h = settings.health.heightCm;
  const bmi = latest && h ? latest.data.value / (h / 100) ** 2 : null;
  const imperial = settings.units === 'imperial';
  const show = (kg: number) => (imperial ? `${(kg * 2.20462).toFixed(1)} lb` : `${kg.toFixed(1)} kg`);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    let kg = Number(v);
    if (imperial) kg /= 2.20462;
    if (!kg || kg < 25 || kg > 350) { toast(L('أدخل وزناً صحيحاً', 'Enter a valid weight'), { tone: 'error' }); return; }
    await create<M>('measurement', { kind: 'weight', value: Math.round(kg * 10) / 10, unit: 'kg' }, { date });
    setV('');
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={L('الوزن', 'Weight')} />
      <Card className="mb-4 p-4">
        <form onSubmit={save} className="flex flex-wrap items-end gap-2">
          <Input className="w-36" type="number" step="0.1" label={imperial ? 'lb' : 'kg'} value={v} onChange={(e) => setV(e.target.value)} />
          <Input className="w-44" type="date" label={L('التاريخ', 'Date')} value={date} onChange={(e) => setDate(e.target.value)} />
          <Button type="submit" variant="primary">{L('سجّل', 'Log')}</Button>
        </form>
      </Card>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Card className="p-4"><Stat label={L('الحالي', 'Current')} value={latest ? show(latest.data.value) : '—'} sub={latest ? fmtDate(latest.date!, locale, { day: 'numeric', month: 'short' }) : undefined} /></Card>
        <Card className="p-4"><Stat label={L('التغيّر في الفترة', 'Change in range')} value={latest && first ? `${latest.data.value - first.data.value >= 0 ? '+' : ''}${(latest.data.value - first.data.value).toFixed(1)}` : '—'} /></Card>
        <Card className="p-4"><Stat label="BMI" value={bmi ? bmi.toFixed(1) : '—'} sub={h ? L('مؤشر عام فقط', 'general indicator only') : L('أضف طولك في الإعدادات', 'Add height in Settings')} /></Card>
      </div>
      <Card className="mb-4 p-4">
        <div className="mb-2 flex items-center"><span className="flex-1 text-[13px] font-bold text-fg-2">{L('المسار', 'Trend')}</span><Segmented size="sm" value={range} onChange={setRange} options={[{ value: '30', label: '30d' }, { value: '90', label: '90d' }, { value: 'all', label: L('الكل', 'All') }]} /></div>
        {shown.length >= 2 ? <Line points={shown.map((w) => ({ x: w.date!.slice(5), y: imperial ? w.data.value * 2.20462 : w.data.value }))} color="var(--health)" format={(y) => y.toFixed(1)} /> : <p className="text-sm text-fg-3">{L('سجّل قراءتين على الأقل لرؤية المسار.', 'Log at least two readings to see a trend.')}</p>}
      </Card>
      {!ws.length ? <EmptyState icon={<Scale size={28} />} title={L('لا قراءات بعد', 'No readings yet')} /> : (
        <Card className="divide-y divide-line">{[...ws].reverse().slice(0, 40).map((w) => (
          <div key={w.id} className="flex items-center gap-3 px-4 py-2 text-sm"><span className="flex-1">{fmtDate(w.date!, locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span><span className="num font-bold">{show(w.data.value)}</span>{w.data.source && <span className="text-[11px] text-fg-3">{w.data.source}</span>}<IconButton size="sm" tone="danger" label={L('حذف', 'Delete')} onClick={() => remove(w.id)}><Trash2 size={14} /></IconButton></div>
        ))}</Card>
      )}
    </div>
  );
}
