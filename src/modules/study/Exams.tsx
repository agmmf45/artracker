import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { Plus, FileClock, Trash2, CalendarClock, MapPin } from 'lucide-react';
import clsx from 'clsx';
import type { Rec } from '@shared/records';
import { useI18n } from '@/core/i18n';
import { useRecords } from '@/core/hooks';
import { create, remove, revertTo, update } from '@/core/repo';
import { daysBetween, fmtDate, todayKey } from '@/core/dates';
import { undoToast, toast } from '@/core/toast';
import { Modal } from '@/design/overlay';
import { Bar, Button, Card, Chip, EmptyState, IconButton, Input, PageHeader, Segmented, Select, Textarea } from '@/design/ui';
import { blankExam, type Exam, type ExamData, type LectureData } from './model';
import { CourseSelect, courseLabel, useCourses } from './shared';

const KINDS: Array<[ExamData['kind'], string, string]> = [['quiz', 'كويز', 'Quiz'], ['midterm', 'نصفي', 'Midterm'], ['final', 'نهائي', 'Final'], ['practical', 'عملي', 'Practical'], ['osce', 'OSCE', 'OSCE'], ['other', 'أخرى', 'Other']];

/** Exam center. Each exam is one record — the calendar and Overview read it directly. */
export default function Exams() {
  const { L, locale } = useI18n();
  const nav = useNavigate();
  const exams = useRecords<ExamData>('exam');
  const lectures = useRecords<LectureData>('lecture');
  const courses = useCourses();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [editing, setEditing] = useState<{ e: Exam; isNew: boolean } | null>(null);
  const today = todayKey();

  useEffect(() => {
    const id = params.get('open');
    if (id && exams) { const e = exams.find((x) => x.id === id); if (e) setEditing({ e: e as Exam, isNew: false }); params.delete('open'); setParams(params, { replace: true }); }
  }, [params, exams, setParams]);

  const list = useMemo(() => (exams ?? []).filter((e) => (tab === 'upcoming' ? (e.date ?? '') >= today : (e.date ?? '') < today)).sort((a, b) => (tab === 'upcoming' ? 1 : -1) * (a.date ?? '').localeCompare(b.date ?? '')) as Exam[], [exams, tab, today]);
  const prep = (e: Exam) => {
    const ls = (lectures ?? []).filter((l) => e.data.lecture_ids.includes(l.id));
    const ready = ls.filter((l) => l.status === 'studied' || l.status === 'mastered').length;
    return { total: ls.length, ready };
  };

  return (
    <div>
      <PageHeader title={L('الاختبارات', 'Exams')} actions={<><Segmented value={tab} onChange={setTab} options={[{ value: 'upcoming', label: L('القادمة', 'Upcoming') }, { value: 'past', label: L('السابقة', 'Past') }]} /><Button variant="primary" icon={<Plus size={17} />} onClick={() => setEditing({ e: { data: blankExam(), date: today } as Exam, isNew: true })}>{L('اختبار', 'Exam')}</Button></>} />
      {!list.length ? <EmptyState icon={<FileClock size={30} />} title={tab === 'upcoming' ? L('لا اختبارات قادمة', 'No upcoming exams') : L('لا اختبارات سابقة', 'No past exams')} hint={L('الاختبار يظهر تلقائياً في التقويم والصفحة الرئيسية.', 'Exams appear automatically in the calendar and overview.')} /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((e) => {
            const days = daysBetween(today, e.date!);
            const p = prep(e);
            const c = courses.find((x) => x.id === e.data.course_id);
            return (
              <Card key={e.id} className="p-4" style={{ borderTop: `3px solid ${c?.data.color ?? 'var(--study)'}` }}>
                <button className="flex w-full items-start gap-3 text-start" onClick={() => setEditing({ e, isNew: false })}>
                  {tab === 'upcoming' && (
                    <div className={clsx('num grid size-14 shrink-0 place-items-center rounded-md text-center leading-none', days <= 3 ? 'bg-[color-mix(in_oklab,var(--danger)_15%,transparent)] text-danger' : 'bg-[color-mix(in_oklab,var(--study)_38%,transparent)] text-study')}>
                      <div><div className="text-xl font-black">{days}</div><div className="text-[10px]">{days === 0 ? L('اليوم', 'today') : L('يوم', 'days')}</div></div>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] text-fg-3">{courseLabel(c)} · {L(KINDS.find((k) => k[0] === e.data.kind)?.[1] ?? '', KINDS.find((k) => k[0] === e.data.kind)?.[2] ?? '')}</div>
                    <div className="font-bold">{e.data.title}</div>
                    <div className="text-[12px] text-fg-2">{fmtDate(e.date!, locale)}{e.data.time ? ` · ${e.data.time}` : ''}{e.data.location ? <> · <MapPin size={11} className="inline" /> {e.data.location}</> : null}</div>
                  </div>
                  {e.data.score !== null && <div className="num text-end"><div className="text-lg font-black">{e.data.score}/{e.data.max}</div>{e.data.target !== null && <div className="text-[11px] text-fg-3">{L('الهدف', 'target')} {e.data.target}</div>}</div>}
                </button>
                {p.total > 0 && (
                  <div className="mt-3"><div className="mb-1 flex justify-between text-[12px] text-fg-2"><span>{L('الاستعداد', 'Preparation')}</span><span className="num">{p.ready}/{p.total} {L('محاضرة', 'lectures')}</span></div><Bar value={p.ready} max={p.total} color="var(--study)" /></div>
                )}
                {tab === 'upcoming' && <Button size="sm" variant="ghost" className="mt-2" icon={<CalendarClock size={14} />} onClick={() => nav(`/study/planner?exam=${e.id}`)}>{L('خطة مذاكرة', 'Study plan')}</Button>}
              </Card>
            );
          })}
        </div>
      )}
      {editing && <ExamEditor e={editing.e} isNew={editing.isNew} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ExamEditor({ e, isNew, onClose }: { e: Exam; isNew: boolean; onClose: () => void }) {
  const { L } = useI18n();
  const lectures = useRecords<LectureData>('lecture');
  const [d, setD] = useState<ExamData>({ ...blankExam(), ...e.data });
  const [date, setDate] = useState(e.date ?? todayKey());
  const set = (p: Partial<ExamData>) => setD((x) => ({ ...x, ...p }));
  const courseLectures = (lectures ?? []).filter((l) => !d.course_id || l.data.course_id === d.course_id);
  const save = async () => {
    if (!d.title.trim()) { toast(L('عنوان الاختبار مطلوب', 'Title required'), { tone: 'error' }); return; }
    if (isNew) await create<ExamData>('exam', d, { date, parent_id: d.course_id });
    else await update<ExamData>(e.id, { data: d, date, parent_id: d.course_id });
    onClose();
  };
  return (
    <Modal panel open onOpenChange={(v) => !v && onClose()} title={isNew ? L('اختبار جديد', 'New exam') : L('الاختبار', 'Exam')} wide
      footer={<>
        {!isNew && <IconButton className="me-auto" tone="danger" label={L('حذف', 'Delete')} onClick={async () => { const p = await remove(e.id); onClose(); undoToast(L('حُذف', 'Deleted'), async () => { if (p) await revertTo(p as Rec); }); }}><Trash2 size={17} /></IconButton>}
        <Button variant="ghost" onClick={onClose}>{L('إلغاء', 'Cancel')}</Button><Button variant="primary" onClick={save}>{L('حفظ', 'Save')}</Button>
      </>}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Input className="sm:col-span-2" label={L('العنوان', 'Title')} value={d.title} onChange={(x) => set({ title: x.target.value })} autoFocus={isNew} />
        <Select label={L('النوع', 'Type')} value={d.kind} onChange={(x) => set({ kind: x.target.value as ExamData['kind'] })}>{KINDS.map(([v, ar, en]) => <option key={v} value={v}>{L(ar, en)}</option>)}</Select>
        <CourseSelect label={L('المقرر', 'Course')} value={d.course_id} onChange={(v) => set({ course_id: v })} />
        <Input type="date" label={L('التاريخ', 'Date')} value={date} onChange={(x) => setDate(x.target.value)} />
        <Input type="time" label={L('الوقت', 'Time')} value={d.time ?? ''} onChange={(x) => set({ time: x.target.value || null })} />
        <Input type="number" label={L('المدة (د)', 'Duration (min)')} value={d.duration_min ?? ''} onChange={(x) => set({ duration_min: x.target.value ? Number(x.target.value) : null })} />
        <Input label={L('المكان', 'Location')} value={d.location ?? ''} onChange={(x) => set({ location: x.target.value || null })} />
        <Input type="number" label={L('الوزن من المقرر %', 'Weight %')} value={d.weight ?? ''} onChange={(x) => set({ weight: x.target.value ? Number(x.target.value) : null })} />
        <Input type="number" label={L('الدرجة المستهدفة', 'Target score')} value={d.target ?? ''} onChange={(x) => set({ target: x.target.value ? Number(x.target.value) : null })} />
        <Input type="number" label={L('درجتك الفعلية', 'Actual score')} value={d.score ?? ''} onChange={(x) => set({ score: x.target.value ? Number(x.target.value) : null })} />
        <Input type="number" label={L('من', 'Out of')} value={d.max} onChange={(x) => set({ max: Number(x.target.value) || 100 })} />
      </div>
      <h3 className="mb-2 mt-5 text-[13px] font-bold text-fg-2">{L('المحاضرات المشمولة', 'Covered lectures')} <span className="num font-normal text-fg-3">{d.lecture_ids.length}</span></h3>
      {!courseLectures.length ? <p className="text-sm text-fg-3">{L('أضف محاضرات للمقرر أولاً.', 'Add lectures to the course first.')}</p> : (
        <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto scroll-thin">
          <Chip onClick={() => set({ lecture_ids: courseLectures.map((l) => l.id) })}>{L('الكل', 'All')}</Chip>
          {courseLectures.map((l) => <Chip key={l.id} active={d.lecture_ids.includes(l.id)} onClick={() => set({ lecture_ids: d.lecture_ids.includes(l.id) ? d.lecture_ids.filter((x) => x !== l.id) : [...d.lecture_ids, l.id] })}>{l.data.number ? `${l.data.number}. ` : ''}{l.data.title}</Chip>)}
        </div>
      )}
      <Textarea className="mt-4" label={L('ملاحظات وخطة المراجعة', 'Notes & revision plan')} value={d.notes} onChange={(x) => set({ notes: x.target.value })} />
    </Modal>
  );
}
