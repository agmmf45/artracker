import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Trash2 } from 'lucide-react';
import type { Rec } from '@shared/records';
import { useI18n } from '@/core/i18n';
import { remove, revertTo, update } from '@/core/repo';
import { toast, undoToast } from '@/core/toast';
import { Modal } from '@/design/overlay';
import { Button, IconButton, Input, Select } from '@/design/ui';
import type { CourseData, ExamData, Session } from '@/modules/study/model';
import type { CalItem } from './sources';

const DAYS: Array<[string, string]> = [['الأحد', 'Sunday'], ['الاثنين', 'Monday'], ['الثلاثاء', 'Tuesday'], ['الأربعاء', 'Wednesday'], ['الخميس', 'Thursday'], ['الجمعة', 'Friday'], ['السبت', 'Saturday']];

/**
 * Tap an exam, a due piece of work or a class in the calendar and change its date/time right there
 * (events and tasks keep their own full editors). A class edits its weekly slot in the course.
 */
export function QuickEdit({ target, onClose }: { target: { item: CalItem; rec: Rec } | null; onClose: () => void }) {
  const { L } = useI18n();
  const rec = target?.rec;
  const d = (rec?.data ?? {}) as Record<string, unknown>;
  const isClass = rec?.type === 'course';
  const slot = isClass && target ? Number(target.item.key.split(':').at(-1)) : -1;
  const sched = isClass ? ((d as unknown as CourseData).schedule ?? []) : [];
  const s: Session | undefined = sched[slot];

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [dur, setDur] = useState('');
  const [place, setPlace] = useState('');
  const [day, setDay] = useState(0);

  useEffect(() => {
    if (!rec) return;
    if (isClass && s) { setDay(s.day); setStart(s.start); setEnd(s.end); setPlace(s.room ?? ''); return; }
    setTitle(String(d.title ?? ''));
    setDate(rec.date?.slice(0, 10) ?? '');
    if (rec.type === 'exam') { const x = d as unknown as ExamData; setStart(x.time ?? ''); setDur(x.duration_min ? String(x.duration_min) : ''); setPlace(x.location ?? ''); }
    else setStart(String(d.due_time ?? ''));
  }, [rec?.id, slot]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!target || !rec) return null;

  const save = async () => {
    if (isClass) {
      if (!start || !end || end <= start) { toast(L('وقت النهاية لازم بعد البداية', 'End must be after start'), { tone: 'error' }); return; }
      const next = sched.map((x, i) => (i === slot ? { ...x, day, start, end, room: place.trim() || undefined } : x));
      const prev = (await update<CourseData>(rec.id, { data: { schedule: next } })) as Rec | undefined;
      undoToast(L('تعدّل موعد المحاضرة — كل أسبوع', 'Class slot changed — every week'), async () => { if (prev) await revertTo(prev); });
    } else {
      if (!date) { toast(L('اختر تاريخ', 'Pick a date'), { tone: 'error' }); return; }
      const patch: Record<string, unknown> = { title: title.trim() || d.title };
      if (rec.type === 'exam') Object.assign(patch, { time: start || null, duration_min: Number(dur) || null, location: place.trim() || null });
      else patch.due_time = start || null;
      if ('due' in d) patch.due = date;
      if ('date' in d) patch.date = date;
      const prev = await update(rec.id, { data: patch, date });
      undoToast(L('تعدّل الموعد', 'Updated'), async () => { if (prev) await revertTo(prev); });
    }
    onClose();
  };

  const del = async () => {
    if (isClass) {
      const prev = (await update<CourseData>(rec.id, { data: { schedule: sched.filter((_, i) => i !== slot) } })) as Rec | undefined;
      undoToast(L('انحذفت المحاضرة من الجدول', 'Class removed from the timetable'), async () => { if (prev) await revertTo(prev); });
    } else {
      const prev = await remove(rec.id);
      undoToast(L('انحذف', 'Deleted'), async () => { if (prev) await revertTo(prev); });
    }
    onClose();
  };

  const heading = isClass ? L('موعد المحاضرة', 'Class slot') : rec.type === 'exam' ? L('الاختبار', 'Exam') : L('التسليم', 'Due work');
  const page = isClass ? `/study/courses?open=${rec.id}` : rec.type === 'exam' ? `/study/exams?open=${rec.id}` : `/study/assignments?open=${rec.id}`;

  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title={heading}
      description={isClass ? `${(d as unknown as CourseData).code ? `${(d as unknown as CourseData).code} · ` : ''}${(d as unknown as CourseData).name}` : undefined}
      footer={<>
        <div className="me-auto flex items-center gap-1">
          <IconButton label={isClass ? L('احذف هذه المحاضرة من الجدول', 'Remove this class') : L('حذف', 'Delete')} tone="danger" onClick={() => void del()}><Trash2 size={17} /></IconButton>
          <Link to={page} onClick={onClose} className="px-2 text-[13px] font-bold text-accent-ink hover:underline">{L('كل التفاصيل', 'All details')}</Link>
        </div>
        <Button variant="ghost" onClick={onClose}>{L('إلغاء', 'Cancel')}</Button>
        <Button variant="primary" onClick={() => void save()}>{L('حفظ', 'Save')}</Button>
      </>}>
      <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="flex flex-col gap-3">
        {isClass ? (
          <>
            <Select label={L('اليوم', 'Day')} value={day} onChange={(e) => setDay(Number(e.target.value))}>
              {DAYS.map(([ar, en], i) => <option key={i} value={i}>{L(ar, en)}</option>)}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Input type="time" label={L('من', 'From')} value={start} onChange={(e) => setStart(e.target.value)} />
              <Input type="time" label={L('إلى', 'To')} value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <Input label={L('القاعة', 'Room')} value={place} onChange={(e) => setPlace(e.target.value)} />
            <p className="text-[12px] text-fg-3">{L('التعديل يطبّق على هالمحاضرة كل أسبوع.', 'This changes the class every week.')}</p>
          </>
        ) : (
          <>
            <Input label={L('العنوان', 'Title')} value={title} onChange={(e) => setTitle(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Input type="date" label={L('التاريخ', 'Date')} value={date} onChange={(e) => setDate(e.target.value)} />
              <Input type="time" label={L('الوقت', 'Time')} value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            {rec.type === 'exam' && (
              <div className="grid grid-cols-2 gap-3">
                <Input type="number" min={5} label={L('المدة (دقيقة)', 'Length (min)')} value={dur} onChange={(e) => setDur(e.target.value)} />
                <Input label={L('المكان', 'Place')} value={place} onChange={(e) => setPlace(e.target.value)} />
              </div>
            )}
          </>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
