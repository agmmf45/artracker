import { useMemo, useRef, useState } from 'react';
import { Ruler, Camera, Trash2, Lock } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useRecords } from '@/core/hooks';
import { create, remove } from '@/core/repo';
import { fmtDate, todayKey } from '@/core/dates';
import { toast } from '@/core/toast';
import { Button, Card, Chip, EmptyState, IconButton, Input, PageHeader, Select } from '@/design/ui';
import { Line } from '@/design/charts';

interface M { kind: string; value: number; unit: string; photo_id?: string | null; note?: string }
const KINDS: Array<[string, string, string, string]> = [['waist', 'الخصر', 'Waist', 'cm'], ['chest', 'الصدر', 'Chest', 'cm'], ['hips', 'الورك', 'Hips', 'cm'], ['arm', 'الذراع', 'Arm', 'cm'], ['thigh', 'الفخذ', 'Thigh', 'cm'], ['neck', 'الرقبة', 'Neck', 'cm'], ['body_fat', 'نسبة الدهون', 'Body fat', '%']];

async function shrink(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, 720 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.75);
}

/** Body measurements + private progress photos (stored only in your account, never shared or previewed elsewhere). */
export default function Body() {
  const { L, locale } = useI18n();
  const all = useRecords<M>('measurement');
  const photos = useRecords<{ kind: string; data_url: string }>('blob');
  const [kind, setKind] = useState('waist');
  const [v, setV] = useState('');
  const [date, setDate] = useState(todayKey());
  const [custom, setCustom] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const kinds = useMemo(() => {
    const extra = [...new Set((all ?? []).map((m) => m.data.kind))].filter((k) => k !== 'weight' && !KINDS.some((x) => x[0] === k));
    return [...KINDS, ...extra.map((k) => [k, k, k, ''] as [string, string, string, string])];
  }, [all]);
  const series = (all ?? []).filter((m) => m.data.kind === kind).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  const progress = (photos ?? []).filter((p) => p.data.kind === 'progress_photo').sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  const unit = kinds.find((k) => k[0] === kind)?.[3] ?? '';

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={L('القياسات', 'Measurements')} />
      <Card className="mb-4 p-4">
        <div className="mb-3 flex flex-wrap gap-1.5">{kinds.map(([k, ar, en]) => <Chip key={k} active={kind === k} onClick={() => setKind(k)}>{L(ar, en)}</Chip>)}</div>
        <form className="flex flex-wrap items-end gap-2" onSubmit={async (e) => { e.preventDefault(); const n = Number(v); if (!n) return; await create<M>('measurement', { kind, value: n, unit }, { date }); setV(''); }}>
          <Input className="w-32" type="number" step="0.1" label={unit || L('القيمة', 'Value')} value={v} onChange={(e) => setV(e.target.value)} />
          <Input className="w-44" type="date" label={L('التاريخ', 'Date')} value={date} onChange={(e) => setDate(e.target.value)} />
          <Button type="submit" variant="primary">{L('سجّل', 'Log')}</Button>
          <span className="flex-1" />
          <Input className="w-40" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={L('قياس مخصص', 'Custom measure')} />
          <Button onClick={(e) => { e.preventDefault(); if (custom.trim()) { setKind(custom.trim()); setCustom(''); } }}>{L('أضف', 'Add')}</Button>
        </form>
      </Card>
      <Card className="mb-4 p-4">
        {series.length >= 2 ? <Line points={series.map((m) => ({ x: m.date!.slice(5), y: m.data.value }))} color="var(--health)" format={(y) => `${y}${unit}`} /> : <p className="text-sm text-fg-3">{L('سجّل قراءتين لرؤية المسار.', 'Log two readings to see a trend.')}</p>}
        <ul className="mt-3 divide-y divide-line text-sm">{[...series].reverse().slice(0, 12).map((m) => <li key={m.id} className="flex items-center gap-2 py-1.5"><span className="flex-1">{fmtDate(m.date!, locale, { day: 'numeric', month: 'short', year: 'numeric' })}</span><span className="num font-bold">{m.data.value}{unit}</span><IconButton size="sm" tone="danger" label={L('حذف', 'Delete')} onClick={() => remove(m.id)}><Trash2 size={13} /></IconButton></li>)}</ul>
      </Card>
      <div className="mb-2 flex items-center gap-2"><h2 className="flex-1 text-[13px] font-bold text-fg-2"><Lock size={13} className="inline" /> {L('صور التقدم (خاصة)', 'Progress photos (private)')}</h2><Button size="sm" icon={<Camera size={14} />} onClick={() => file.current?.click()}>{L('صورة', 'Photo')}</Button></div>
      <input ref={file} type="file" accept="image/*" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { await create('blob', { kind: 'progress_photo', data_url: await shrink(f) }, { date: todayKey(), private: true }); } catch { toast(L('تعذر حفظ الصورة', 'Could not save the photo'), { tone: 'error' }); } e.target.value = ''; }} />
      {!progress.length ? <EmptyState icon={<Ruler size={26} />} title={L('صور التقدم تبقى خاصة بك', 'Progress photos stay private to you')} /> : (
        <div className="grid grid-cols-3 gap-2 md:grid-cols-4">{progress.map((p) => (
          <figure key={p.id} className="relative"><img src={p.data.data_url} alt="" className="aspect-[3/4] w-full rounded-md object-cover" /><figcaption className="num mt-0.5 text-center text-[11px] text-fg-3">{p.date}</figcaption>
            <button aria-label={L('حذف', 'Delete')} className="absolute end-1 top-1 grid size-7 place-items-center rounded-full bg-black/50 text-white" onClick={() => remove(p.id)}><Trash2 size={13} /></button></figure>
        ))}</div>
      )}
      <Select className="hidden" aria-hidden value="" onChange={() => {}}><option /></Select>
    </div>
  );
}
