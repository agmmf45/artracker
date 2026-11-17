import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { CalendarClock, Wand2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useRecords } from '@/core/hooks';
import { fmtDate, fmtDuration, todayKey } from '@/core/dates';
import { remove } from '@/core/repo';
import { toast } from '@/core/toast';
import { confirm } from '@/design/overlay';
import { Button, Card, Chip, EmptyState, Input, Label, PageHeader, Select } from '@/design/ui';
import { createTask, type TaskData } from '@/modules/life/tasks/model';
import { generatePlan, type ExamData, type Lecture, type LectureData, type PlanBlock } from './model';
import { courseLabel, useCourses } from './shared';

const WD_AR = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Generates a realistic revision plan for an exam. Shows a preview; adds tasks only after confirmation. */
export default function StudyPlanner() {
  const { L, lang, locale } = useI18n();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const exams = useRecords<ExamData>('exam');
  const lectures = useRecords<LectureData>('lecture');
  const tasks = useRecords<TaskData>('task');
  const courses = useCourses();
  const today = todayKey();
  const upcoming = (exams ?? []).filter((e) => (e.date ?? '') > today).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  const [examId, setExamId] = useState<string>(params.get('exam') ?? '');
  const [start, setStart] = useState(today);
  const [daily, setDaily] = useState(120);
  const [skip, setSkip] = useState<number[]>([5]);
  const [preview, setPreview] = useState<PlanBlock[] | null>(null);
  useEffect(() => { if (!examId && upcoming[0]) setExamId(upcoming[0].id); }, [upcoming, examId]);

  const exam = upcoming.find((e) => e.id === examId);
  const covered = useMemo(() => {
    if (!exam) return [];
    const ls = (lectures ?? []).filter((l) => (exam.data.lecture_ids.length ? exam.data.lecture_ids.includes(l.id) : l.data.course_id === exam.data.course_id));
    return ls as Lecture[];
  }, [exam, lectures]);
  const existing = (tasks ?? []).filter((t) => t.data.source === `plan:${examId}` && t.status !== 'done');

  const build = () => {
    if (!exam) return;
    if (!covered.length) { toast(L('حدّد محاضرات الاختبار أولاً', 'Select the exam lectures first'), { tone: 'error' }); return; }
    setPreview(generatePlan({ lectures: covered, examDate: exam.date!, startDate: start, dailyMinutes: daily, skipDays: skip, examTitle: exam.data.title }));
  };

  const apply = async () => {
    if (!exam || !preview) return;
    if (existing.length) {
      const replace = await confirm(L('عندك خطة سابقة لهذا الاختبار', 'You already have a plan for this exam'), {
        message: L(`${existing.length} مهمة مفتوحة من الخطة السابقة. نحذفها ونضع الجديدة؟ (المنجز يبقى)`, `${existing.length} open tasks from the previous plan. Replace them? (completed ones stay)`), okText: L('استبدل', 'Replace'),
      });
      if (!replace) return;
      for (const t of existing) await remove(t.id);
    }
    for (const b of preview) {
      await createTask({ title: b.review ? b.title : `${L('ذاكر', 'Study')}: ${b.title}`, start: b.date, duration_min: b.minutes, estimate_min: b.minutes, category: 'دراسة', course_id: exam.data.course_id, priority: b.review ? 3 : 2, source: `plan:${exam.id}` });
    }
    toast(L(`أُضيفت ${preview.length} جلسة لمهامك وتقويمك`, `${preview.length} sessions added to tasks & calendar`));
    setPreview(null);
  };

  if (!upcoming.length) return <div><PageHeader title={L('مخطط المذاكرة', 'Study planner')} /><EmptyState icon={<CalendarClock size={30} />} title={L('أضف اختباراً قادماً أولاً', 'Add an upcoming exam first')} action={<Button variant="primary" onClick={() => nav('/study/exams')}>{L('الاختبارات', 'Exams')}</Button>} /></div>;

  const byDay = new Map<string, PlanBlock[]>();
  for (const b of preview ?? []) { if (!byDay.has(b.date)) byDay.set(b.date, []); byDay.get(b.date)!.push(b); }

  return (
    <div>
      <PageHeader title={L('مخطط المذاكرة', 'Study planner')} subtitle={L('يوزّع المحاضرات المتبقية حسب الصعوبة والوقت المتاح، مع استراحات ويوم أخير للمراجعة.', 'Spreads remaining lectures by difficulty and time available, with breaks and a final review day.')} />
      <Card className="mb-4 grid gap-3 p-4 sm:grid-cols-4">
        <Select className="sm:col-span-2" label={L('الاختبار', 'Exam')} value={examId} onChange={(e) => { setExamId(e.target.value); setPreview(null); }}>
          {upcoming.map((e) => <option key={e.id} value={e.id}>{e.data.title} · {courseLabel(courses.find((c) => c.id === e.data.course_id))} · {e.date}</option>)}
        </Select>
        <Input type="date" label={L('ابدأ من', 'Start')} value={start} onChange={(e) => setStart(e.target.value)} />
        <Input type="number" min={30} step={15} label={L('دقائق يومياً', 'Minutes / day')} value={daily} onChange={(e) => setDaily(Math.max(30, Number(e.target.value) || 120))} />
        <div className="sm:col-span-4">
          <Label>{L('أيام بدون مذاكرة', 'Days off')}</Label>
          <div className="flex flex-wrap gap-1.5">{(lang === 'ar' ? WD_AR : WD_EN).map((d, i) => <Chip key={i} active={skip.includes(i)} onClick={() => setSkip(skip.includes(i) ? skip.filter((x) => x !== i) : [...skip, i])}>{d}</Chip>)}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-4">
          <span className="text-sm text-fg-2">{L(`${covered.length} محاضرة مشمولة · ${covered.filter((l) => l.status !== 'mastered').length} تحتاج وقت`, `${covered.length} lectures covered · ${covered.filter((l) => l.status !== 'mastered').length} need time`)}</span>
          <span className="flex-1" />
          <Button variant="primary" icon={<Wand2 size={16} />} onClick={build}>{L('اقترح خطة', 'Suggest a plan')}</Button>
        </div>
      </Card>
      {preview && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold">{L(`${preview.length} جلسة · ${fmtDuration(preview.reduce((s, b) => s + b.minutes, 0), lang)}`, `${preview.length} sessions · ${fmtDuration(preview.reduce((s, b) => s + b.minutes, 0), lang)}`)}</span>
            <span className="flex-1" />
            <Button variant="ghost" onClick={() => setPreview(null)}>{L('إلغاء', 'Discard')}</Button>
            <Button variant="primary" onClick={apply}>{L('أضف للمهام والتقويم', 'Add to tasks & calendar')}</Button>
          </div>
          {covered.length && preview.filter((b) => !b.review).length === 0 && <p className="mb-3 text-sm text-warning">{L('كل المحاضرات متقنة — بقيت المراجعة العامة فقط.', 'Everything is mastered — only the final review remains.')}</p>}
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {[...byDay.entries()].map(([d, bs]) => (
              <Card key={d} className="p-3">
                <div className="mb-1.5 flex text-[13px] font-bold"><span className="flex-1">{fmtDate(d, locale, { weekday: 'long', day: 'numeric', month: 'short' })}</span><span className="num text-fg-3">{fmtDuration(bs.reduce((s, b) => s + b.minutes, 0), lang)}</span></div>
                <ul className="space-y-1 text-sm">{bs.map((b, i) => <li key={i} className="flex gap-2"><span className={`flex-1 truncate ${b.review ? 'font-bold text-study' : ''}`}>{b.title}</span><span className="num text-[12px] text-fg-2">{b.minutes}{L('د', 'm')}</span></li>)}</ul>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
