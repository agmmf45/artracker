import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Rec } from '@shared/records';
import { useI18n } from '@/core/i18n';
import { create, remove, revertTo, update } from '@/core/repo';
import { undoToast, toast } from '@/core/toast';
import { describeRecurrence, type Recurrence } from '@/core/recurrence';
import { Modal } from '@/design/overlay';
import { Button, IconButton, Input, Select, Switch, Textarea } from '@/design/ui';
import { blankEvent, type EventData } from '@/modules/shared/domain';

const COLORS = ['var(--life)', 'var(--study)', 'var(--health)', 'var(--reward)', 'var(--danger)', 'var(--viz-6)'];

export function EventEditor({ rec, open, onOpenChange, defaults, occurrence }: { rec: Rec<EventData> | null; open: boolean; onOpenChange: (v: boolean) => void; defaults?: Partial<EventData>; occurrence?: string }) {
  const { L, lang } = useI18n();
  const [d, setD] = useState<EventData>(blankEvent());
  useEffect(() => { if (open) setD(rec ? { ...blankEvent(), ...rec.data } : blankEvent(defaults)); }, [open, rec, defaults]);
  const set = <K extends keyof EventData>(k: K, v: EventData[K]) => setD((p) => ({ ...p, [k]: v }));
  const r = d.recurrence;
  const setR = (p: Partial<Recurrence> | null) => set('recurrence', p === null ? null : ({ ...(r ?? { freq: 'weekly', interval: 1 }), ...p } as Recurrence));

  const save = async () => {
    if (!d.title.trim()) { toast(L('اكتب عنوان الموعد', 'Add a title'), { tone: 'error' }); return; }
    if (d.end < d.start) d.end = d.start;
    if (!d.all_day && d.start_time && d.end_time && d.end === d.start && d.end_time <= d.start_time) { toast(L('وقت النهاية قبل البداية', 'End is before start'), { tone: 'error' }); return; }
    if (rec) await update<EventData>(rec.id, { data: d, date: d.start });
    else await create<EventData>('event', d, { date: d.start });
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={rec ? L('تعديل الموعد', 'Edit event') : L('موعد جديد', 'New event')}
      footer={<>
        {rec && (
          <div className="me-auto flex gap-1">
            <IconButton label={L('حذف', 'Delete')} tone="danger" onClick={async () => { const p = await remove(rec.id); onOpenChange(false); undoToast(L('حُذف الموعد', 'Event deleted'), async () => { if (p) await revertTo(p); }); }}><Trash2 size={17} /></IconButton>
            {r && occurrence && <Button size="sm" variant="ghost" onClick={async () => { await update<EventData>(rec.id, { data: { recurrence: { ...r, exceptions: [...(r.exceptions ?? []), occurrence] } } }); onOpenChange(false); toast(L('تخطّينا هذا الموعد فقط', 'Skipped this occurrence only')); }}>{L('احذف هذا التكرار فقط', 'Skip this occurrence')}</Button>}
          </div>
        )}
        <Button variant="ghost" onClick={() => onOpenChange(false)}>{L('إلغاء', 'Cancel')}</Button>
        <Button variant="primary" onClick={save}>{L('حفظ', 'Save')}</Button>
      </>}>
      <div className="space-y-3">
        <Input value={d.title} onChange={(e) => set('title', e.target.value)} placeholder={L('عنوان الموعد', 'Event title')} aria-label={L('العنوان', 'Title')} className="[&_input]:font-bold" autoFocus={!rec} />
        <Switch checked={d.all_day} onChange={(v) => set('all_day', v)} label={L('طوال اليوم', 'All day')} />
        <div className="grid grid-cols-2 gap-3">
          <Input type="date" label={L('من', 'From')} value={d.start} onChange={(e) => { set('start', e.target.value); if (d.end < e.target.value) set('end', e.target.value); }} />
          {!d.all_day && <Input type="time" label={L('الوقت', 'Time')} value={d.start_time ?? ''} onChange={(e) => set('start_time', e.target.value || null)} />}
          <Input type="date" label={L('إلى', 'To')} value={d.end} onChange={(e) => set('end', e.target.value)} />
          {!d.all_day && <Input type="time" label={L('الوقت', 'Time')} value={d.end_time ?? ''} onChange={(e) => set('end_time', e.target.value || null)} />}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label={L('النوع', 'Type')} value={d.kind ?? 'personal'} onChange={(e) => set('kind', e.target.value as EventData['kind'])}>
            <option value="personal">{L('شخصي', 'Personal')}</option><option value="appointment">{L('موعد', 'Appointment')}</option>
            <option value="lecture">{L('محاضرة', 'Lecture')}</option><option value="clinical">{L('سريري', 'Clinical')}</option>
            <option value="exam">{L('اختبار', 'Exam')}</option><option value="workout">{L('تمرين', 'Workout')}</option><option value="other">{L('أخرى', 'Other')}</option>
          </Select>
          <Select label={L('تذكير', 'Reminder')} value={d.reminder_min ?? ''} onChange={(e) => set('reminder_min', e.target.value === '' ? null : Number(e.target.value))}>
            <option value="">{L('بدون', 'None')}</option><option value="0">{L('وقت الموعد', 'At start')}</option><option value="10">10 {L('د', 'min')}</option><option value="30">30 {L('د', 'min')}</option><option value="60">{L('ساعة', '1 hour')}</option><option value="1440">{L('يوم', '1 day')}</option>
          </Select>
        </div>
        <Input label={L('المكان', 'Location')} value={d.location ?? ''} onChange={(e) => set('location', e.target.value || null)} />
        <div>
          <div className="mb-1.5 text-[13px] font-bold text-fg-2">{L('اللون', 'Colour')}</div>
          <div className="flex gap-2">{COLORS.map((c) => <button key={c} aria-label={c} onClick={() => set('color', c)} className={`size-7 rounded-full ${d.color === c ? 'ring-2 ring-fg ring-offset-2 ring-offset-elevated' : ''}`} style={{ background: c }} />)}</div>
        </div>
        <div className="rounded-md border border-line p-3">
          <Switch checked={!!r} onChange={(v) => setR(v ? { freq: 'weekly', interval: 1 } : null)} label={L('يتكرر', 'Repeats')} hint={r ? describeRecurrence(r, lang) : undefined} />
          {r && (
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Select value={r.freq} onChange={(e) => setR({ freq: e.target.value as Recurrence['freq'] })} aria-label={L('التكرار', 'Frequency')}>
                <option value="daily">{L('يومي', 'Daily')}</option><option value="weekly">{L('أسبوعي', 'Weekly')}</option><option value="monthly">{L('شهري', 'Monthly')}</option><option value="yearly">{L('سنوي', 'Yearly')}</option>
              </Select>
              <Input type="number" min={1} value={r.interval} onChange={(e) => setR({ interval: Number(e.target.value) || 1 })} aria-label={L('الفاصل', 'Interval')} />
              <Input type="date" value={r.until ?? ''} onChange={(e) => setR({ until: e.target.value || null })} aria-label={L('ينتهي', 'Until')} />
            </div>
          )}
        </div>
        <Textarea label={L('ملاحظات', 'Notes')} value={d.notes} onChange={(e) => set('notes', e.target.value)} />
      </div>
    </Modal>
  );
}
