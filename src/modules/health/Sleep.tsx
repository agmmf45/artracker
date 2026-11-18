import { useState } from 'react';
import { Moon, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useRecordsInRange, useSettings } from '@/core/hooks';
import { create, remove } from '@/core/repo';
import { fmtDate, rangeKeys, shiftKey, todayKey } from '@/core/dates';
import { Modal } from '@/design/overlay';
import { Button, Card, EmptyState, IconButton, Input, PageHeader, Stat, Textarea } from '@/design/ui';
import { Bars } from '@/design/charts';
import { bedMinutes, bedtimeSpread, fromBedMinutes, sleepHours } from './sleepLogic';

interface SleepData { bed: string; wake: string; hours: number; quality: number | null; nap: boolean; notes: string }

export default function Sleep() {
  const { L, locale } = useI18n();
  const settings = useSettings();
  const logs = useRecordsInRange<SleepData>('sleep_log', shiftKey(todayKey(), -29), todayKey());
  const [open, setOpen] = useState(false);
  const nights = (logs ?? []).filter((l) => !l.data.nap).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  const last7 = nights.filter((n) => (n.date ?? '') >= shiftKey(todayKey(), -6));
  const avg = last7.length ? last7.reduce((s, n) => s + n.data.hours, 0) / last7.length : null;
  const spread = bedtimeSpread(last7.map((n) => n.data.bed));
  const avgBed = last7.length ? fromBedMinutes(last7.reduce((s, n) => s + bedMinutes(n.data.bed), 0) / last7.length) : null;
  const goal = settings.health.sleepGoalHours;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={L('النوم', 'Sleep')} actions={<Button variant="primary" icon={<Plus size={17} />} onClick={() => setOpen(true)}>{L('سجّل نوم', 'Log sleep')}</Button>} />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Card className="p-4"><Stat label={L('متوسط 7 ليالٍ', '7-night average')} value={avg != null ? `${avg.toFixed(1)}${L('س', 'h')}` : '—'} sub={`${L('الهدف', 'goal')} ${goal}${L('س', 'h')}`} /></Card>
        <Card className="p-4"><Stat label={L('متوسط وقت النوم', 'Average bedtime')} value={avgBed ?? '—'} /></Card>
        <Card className="p-4"><Stat label={L('ثبات وقت النوم', 'Bedtime consistency')} value={spread != null ? `±${spread}${L('د', 'm')}` : '—'} sub={L('أقل = أثبت', 'lower = steadier')} /></Card>
      </div>
      <Card className="mb-4 p-4"><div className="mb-2 text-[13px] font-bold text-fg-2">{L('ساعات النوم — 14 ليلة', 'Hours slept — 14 nights')}</div>
        <Bars data={rangeKeys(shiftKey(todayKey(), -13), 14).map((d) => ({ label: d.slice(8), value: nights.filter((n) => n.date === d).reduce((s, n) => s + n.data.hours, 0) }))} height={100} color="var(--viz-1)" goal={goal} format={(v) => `${v.toFixed(1)}h`} />
      </Card>
      {!logs?.length ? <EmptyState icon={<Moon size={28} />} title={L('سجّل نومك كل صباح بضغطة', 'Log your sleep each morning in one tap')} /> : (
        <Card className="divide-y divide-line">
          {[...(logs ?? [])].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).map((l) => (
            <div key={l.id} className="flex items-center gap-3 px-4 py-2.5">
              <Moon size={15} className="text-viz-1" style={{ color: 'var(--viz-1)' }} />
              <div className="min-w-0 flex-1"><div className="text-sm font-bold">{fmtDate(l.date!, locale, { weekday: 'short', day: 'numeric', month: 'short' })}{l.data.nap ? ` · ${L('قيلولة', 'nap')}` : ''}</div><div className="num text-[12px] text-fg-3">{l.data.bed} → {l.data.wake}{l.data.quality ? ` · ${'★'.repeat(l.data.quality)}` : ''}{l.data.notes ? ` · ${l.data.notes}` : ''}</div></div>
              <span className="num font-black">{l.data.hours.toFixed(1)}{L('س', 'h')}</span>
              <IconButton size="sm" tone="danger" label={L('حذف', 'Delete')} onClick={() => remove(l.id)}><Trash2 size={14} /></IconButton>
            </div>
          ))}
        </Card>
      )}
      {open && <SleepEditor onClose={() => setOpen(false)} />}
    </div>
  );
}

function SleepEditor({ onClose }: { onClose: () => void }) {
  const { L } = useI18n();
  const [d, setD] = useState<SleepData>({ bed: '23:30', wake: '07:00', hours: 7.5, quality: null, nap: false, notes: '' });
  const [date, setDate] = useState(todayKey());
  const set = (p: Partial<SleepData>) => setD((x) => { const n = { ...x, ...p }; return { ...n, hours: sleepHours(n.bed, n.wake) }; });
  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title={L('سجّل النوم', 'Log sleep')} footer={<Button variant="primary" onClick={async () => { await create<SleepData>('sleep_log', d, { date }); onClose(); }}>{L('حفظ', 'Save')}</Button>}>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <Input type="time" label={L('نمت', 'Bedtime')} value={d.bed} onChange={(e) => set({ bed: e.target.value })} />
          <Input type="time" label={L('صحيت', 'Woke up')} value={d.wake} onChange={(e) => set({ wake: e.target.value })} />
          <Input type="date" label={L('صباح يوم', 'Morning of')} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <p className="num text-center text-2xl font-black">{d.hours.toFixed(2)} {L('ساعة', 'hours')}</p>
        <div className="flex items-center gap-2"><span className="text-sm">{L('الجودة', 'Quality')}</span>{[1, 2, 3, 4, 5].map((n) => <button key={n} aria-label={`${n}`} onClick={() => set({ quality: d.quality === n ? null : n })} className={`text-2xl ${(d.quality ?? 0) >= n ? 'text-reward' : 'text-line-strong'}`}>★</button>)}</div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--accent)]" checked={d.nap} onChange={(e) => set({ nap: e.target.checked })} />{L('قيلولة', 'Nap')}</label>
        <Textarea label={L('ملاحظات', 'Notes')} value={d.notes} onChange={(e) => set({ notes: e.target.value })} />
      </div>
    </Modal>
  );
}
