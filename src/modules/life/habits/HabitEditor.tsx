import { useEffect, useState } from 'react';
import { Plus, Trash2, X, Archive, PauseCircle } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/hooks';
import { create, update } from '@/core/repo';
import { newId } from '@/core/ids';
import { todayKey } from '@/core/dates';
import { toast } from '@/core/toast';
import { Modal } from '@/design/overlay';
import { Button, Chip, IconButton, Input, Label, Select, Segmented } from '@/design/ui';
import { blankHabit, deleteHabit, type Habit, type HabitData } from './model';

const ICONS = ['✅', '💧', '📖', '🏃', '🧘', '🕌', '🦷', '💊', '🛏️', '📵', '🥗', '✍️', '🎯', '🌿', '💪', '🧠'];
const WD_AR = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];
const WD_EN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function HabitEditor({ habit, open, onOpenChange }: { habit: Habit | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { L, lang } = useI18n();
  const settings = useSettings();
  const [d, setD] = useState<HabitData>(blankHabit());
  const [sub, setSub] = useState('');
  useEffect(() => { if (open) setD(habit ? { ...blankHabit(), ...habit.data } : blankHabit()); }, [open, habit]);
  const set = <K extends keyof HabitData>(k: K, v: HabitData[K]) => setD((p) => ({ ...p, [k]: v }));
  const s = d.schedule;

  const save = async () => {
    if (!d.name.trim()) { toast(L('اكتب اسم العادة', 'Name the habit'), { tone: 'error' }); return; }
    if (s.type === 'weekdays' && !s.days?.length) { toast(L('اختر يوماً واحداً على الأقل', 'Pick at least one day'), { tone: 'error' }); return; }
    if (habit) await update<HabitData>(habit.id, { data: d });
    else await create<HabitData>('habit', d, { status: 'active' });
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={habit ? L('تعديل العادة', 'Edit habit') : L('عادة جديدة', 'New habit')}
      footer={<>
        {habit && (
          <div className="me-auto flex gap-1">
            <IconButton label={L('حذف', 'Delete')} tone="danger" onClick={async () => { await deleteHabit(habit); onOpenChange(false); }}><Trash2 size={17} /></IconButton>
            <IconButton label={habit.status === 'archived' ? L('استعادة', 'Unarchive') : L('أرشفة', 'Archive')} onClick={async () => { await update(habit.id, { status: habit.status === 'archived' ? 'active' : 'archived' }); onOpenChange(false); }}><Archive size={17} /></IconButton>
          </div>
        )}
        <Button variant="ghost" onClick={() => onOpenChange(false)}>{L('إلغاء', 'Cancel')}</Button>
        <Button variant="primary" onClick={save}>{L('حفظ', 'Save')}</Button>
      </>}>
      <div className="space-y-4">
        <div className="flex gap-2">
          <input className="field w-14 text-center text-xl" value={d.icon} onChange={(e) => set('icon', e.target.value)} aria-label={L('أيقونة', 'Icon')} />
          <Input className="flex-1" value={d.name} onChange={(e) => set('name', e.target.value)} placeholder={L('مثال: أقرأ 10 صفحات', 'e.g. Read 10 pages')} aria-label={L('الاسم', 'Name')} autoFocus={!habit} />
        </div>
        <div className="flex flex-wrap gap-1">{ICONS.map((i) => <button key={i} onClick={() => set('icon', i)} aria-label={i} className={`size-8 rounded-sm text-lg ${d.icon === i ? 'bg-surface-2 ring-1 ring-line-strong' : ''}`}>{i}</button>)}</div>

        <div>
          <Label>{L('نوع التتبع', 'Tracking')}</Label>
          <Segmented value={d.kind} onChange={(v) => set('kind', v)} options={[{ value: 'check', label: L('نعم/لا', 'Yes/No') }, { value: 'number', label: L('رقم', 'Number') }, { value: 'time', label: L('وقت', 'Time') }]} />
        </div>
        {d.kind !== 'check' && (
          <div className="grid grid-cols-2 gap-3">
            <Input type="number" min={1} label={L('الهدف اليومي', 'Daily target')} value={d.target} onChange={(e) => set('target', Math.max(1, Number(e.target.value) || 1))} />
            <Input label={L('الوحدة', 'Unit')} value={d.unit ?? (d.kind === 'time' ? L('دقيقة', 'min') : '')} onChange={(e) => set('unit', e.target.value || null)} placeholder={d.kind === 'time' ? L('دقيقة', 'min') : L('صفحة، كوب…', 'pages, cups…')} />
          </div>
        )}

        <div>
          <Label>{L('التكرار', 'Frequency')}</Label>
          <Segmented value={s.type} onChange={(v) => set('schedule', { ...s, type: v })} options={[
            { value: 'daily', label: L('يومي', 'Daily') }, { value: 'weekdays', label: L('أيام محددة', 'Weekdays') },
            { value: 'weekly_count', label: L('مرات بالأسبوع', 'Times/week') }, { value: 'interval', label: L('كل N يوم', 'Every N days') },
          ]} />
          {s.type === 'weekdays' && (
            <div className="mt-2 flex gap-1.5">{(lang === 'ar' ? WD_AR : WD_EN).map((w, i) => (
              <button key={i} aria-pressed={s.days?.includes(i)} onClick={() => { const cur = new Set(s.days ?? []); if (cur.has(i)) cur.delete(i); else cur.add(i); set('schedule', { ...s, days: [...cur].sort() }); }}
                className={`size-9 rounded-full border text-sm font-bold ${s.days?.includes(i) ? 'border-accent bg-accent text-on-accent' : 'border-line text-fg-2'}`}>{w}</button>
            ))}</div>
          )}
          {s.type === 'weekly_count' && <Input className="mt-2 w-40" type="number" min={1} max={7} value={s.count ?? 3} onChange={(e) => set('schedule', { ...s, count: Math.max(1, Math.min(7, Number(e.target.value) || 1)) })} aria-label={L('مرات', 'Times')} />}
          {s.type === 'interval' && <Input className="mt-2 w-40" type="number" min={2} value={s.every ?? 2} onChange={(e) => set('schedule', { ...s, every: Math.max(2, Number(e.target.value) || 2) })} aria-label={L('كل كم يوم', 'Every N days')} />}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input type="date" label={L('تبدأ من', 'Starts')} value={d.start ?? ''} onChange={(e) => set('start', e.target.value || null)} />
          <Input type="time" label={L('تذكير', 'Reminder')} value={d.reminder ?? ''} onChange={(e) => set('reminder', e.target.value || null)} />
          <Select label={L('مجال الحياة', 'Life area')} value={d.area ?? ''} onChange={(e) => set('area', e.target.value || null)}>
            <option value="">—</option>
            {settings.lifeAreas.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
          </Select>
          <Input label={L('التصنيف', 'Category')} value={d.category ?? ''} onChange={(e) => set('category', e.target.value || null)} />
        </div>

        <div>
          <Label>{L('خطوات فرعية', 'Sub-steps')}</Label>
          <div className="flex flex-wrap gap-1.5">{d.subtasks.map((x) => <Chip key={x.id} onClick={() => set('subtasks', d.subtasks.filter((y) => y.id !== x.id))}>{x.name} <X size={11} /></Chip>)}</div>
          <form className="mt-1.5 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!sub.trim()) return; set('subtasks', [...d.subtasks, { id: newId('s'), name: sub.trim() }]); setSub(''); }}>
            <input className="field h-9 min-h-0 py-1" value={sub} onChange={(e) => setSub(e.target.value)} placeholder={L('خطوة…', 'Step…')} />
            <IconButton type="submit" label={L('إضافة', 'Add')}><Plus size={18} /></IconButton>
          </form>
        </div>

        <div className="rounded-md border border-line p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold"><PauseCircle size={16} />{L('إيقاف مؤقت وأيام راحة', 'Pause & rest days')}</div>
          <div className="grid grid-cols-2 gap-3">
            <Input type="date" label={L('إيقاف من', 'Pause from')} value={d.paused_from ?? ''} onChange={(e) => set('paused_from', e.target.value || null)} />
            <Input type="date" label={L('حتى', 'Until')} value={d.paused_until ?? ''} onChange={(e) => set('paused_until', e.target.value || null)} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {(d.rest_days ?? []).map((r) => <Chip key={r} onClick={() => set('rest_days', (d.rest_days ?? []).filter((x) => x !== r))}>{r} <X size={11} /></Chip>)}
            <Button size="sm" variant="ghost" onClick={() => set('rest_days', [...new Set([...(d.rest_days ?? []), todayKey()])])}>{L('اليوم راحة', 'Rest today')}</Button>
          </div>
          <p className="mt-1 text-[12px] text-fg-3">{L('أيام الراحة والإيقاف لا تُحسب غياباً ولا تكسر السلسلة.', 'Rest and paused days never count as misses or break a streak.')}</p>
        </div>
      </div>
    </Modal>
  );
}
