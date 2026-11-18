import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarClock, Layers, Stethoscope, Timer, RotateCcw, BookOpen, FileCheck2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useRecords, useRecordsInRange, useSettings } from '@/core/hooks';
import { db } from '@/core/db';
import { daysBetween, fmtDuration, fmtTime, relativeDay, shiftKey, todayKey, weekStartKey } from '@/core/dates';
import { Bar, Button, Card, CardHeader, EmptyState, Stat } from '@/design/ui';
import { useCalendarItems } from '@/modules/life/calendar/sources';
import { courseGrade, gpa, pointsFor, type CourseData, type ExamData, type LectureData, type StudySessionData } from './model';
import { isDue, type SrsState } from './srs';
import { useCourses, courseLabel } from './shared';

export default function StudyOverview() {
  const { L, lang, locale } = useI18n();
  const settings = useSettings();
  const today = todayKey();
  const courses = useCourses();
  const items = useCalendarItems(today, today, settings);
  const exams = useRecordsInRange<ExamData>('exam', today, shiftKey(today, 90));
  const assignments = useRecordsInRange<{ title: string; course_id: string | null }>('assignment', shiftKey(today, -30), shiftKey(today, 21));
  const lectures = useRecords<LectureData>('lecture');
  const sessions = useRecordsInRange<StudySessionData>('study_session', weekStartKey(today, settings.weekStart), today);
  const due = useLiveQuery(async () => (await db().records.where('type').equals('flashcard').filter((r) => !r.deleted_at).toArray()).filter((r) => isDue((r.data as { srs: SrsState }).srs)).length, []);
  const clinical = useLiveQuery(async () => {
    const reqs = await db().records.where('type').equals('clinical_req').filter((r) => !r.deleted_at && (r.data as { kind: string }).kind !== 'osce').toArray();
    const logs = await db().records.where('type').equals('clinical_log').filter((r) => !r.deleted_at && (r.data as { role: string }).role === 'performed').toArray();
    const c = new Map<string, number>(); for (const l of logs) c.set((l.data as { req_id: string }).req_id, (c.get((l.data as { req_id: string }).req_id) ?? 0) + 1);
    const need = reqs.reduce((s, r) => s + Number((r.data as { required: number }).required), 0);
    const done = reqs.reduce((s, r) => s + Math.min(Number((r.data as { required: number }).required), c.get(r.id) ?? 0), 0);
    return { need, done };
  }, []);

  const classes = (items ?? []).filter((i) => i.kind === 'class');
  const revision = (lectures ?? []).filter((l) => l.status !== 'mastered' && (l.status === 'revision' || (l.data.next_review && l.data.next_review <= today)));
  const openAssign = (assignments ?? []).filter((a) => a.status !== 'done').sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  const weekMin = (sessions ?? []).reduce((s, x) => s + x.data.duration_min, 0);
  const g = gpa(courses.map((c) => { const cg = courseGrade(c.data as CourseData); const p = c.data.final_points ?? (cg.current != null ? pointsFor(cg.current, settings.study.gradeScale).points : null); return p == null ? null : { credits: c.data.credits, points: p }; }).filter(Boolean) as Array<{ credits: number; points: number }>);

  if (!courses.length && !(exams ?? []).length) return (
    <div><h1 className="mb-5 text-2xl font-black">{L('الدراسة', 'Study')}</h1>
      <EmptyState icon={<BookOpen size={30} />} title={L('ابدأ بإضافة مقرراتك', 'Start by adding your courses')} hint={L('الجدول، المحاضرات، الاختبارات، الدرجات والبطاقات كلها تُبنى على المقررات.', 'Timetable, lectures, exams, grades and flashcards all build on courses.')} action={<Link to="/study/courses"><Button variant="primary">{L('المقررات', 'Courses')}</Button></Link>} />
    </div>
  );

  return (
    <div>
      <h1 className="mb-5 text-2xl font-black">{L('الدراسة', 'Study')}</h1>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-4"><Stat label={L('مذاكرة هذا الأسبوع', 'Studied this week')} value={fmtDuration(weekMin, lang)} /></Card>
        <Card className="p-4"><Stat label={L('مراجعات مستحقة', 'Reviews due')} value={revision.length + (due ?? 0)} sub={`${revision.length} ${L('محاضرة', 'lectures')} · ${due ?? 0} ${L('بطاقة', 'cards')}`} /></Card>
        <Card className="p-4"><Stat label={L('المعدل المتوقع', 'Projected GPA')} value={g != null ? g.toFixed(2) : '—'} /></Card>
        <Card className="p-4"><Stat label={L('السريري', 'Clinical')} value={clinical?.need ? `${clinical.done}/${clinical.need}` : '—'} />{clinical?.need ? <Bar className="mt-2" value={clinical.done} max={clinical.need} color="var(--study)" /> : null}</Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <CardHeader title={L('محاضرات اليوم', "Today's classes")} icon={<BookOpen size={16} />} action={<Link to="/study/schedule" className="text-[12px] font-bold text-study">{L('الجدول', 'Timetable')}</Link>} />
          {!classes.length ? <p className="text-sm text-fg-2">{L('لا محاضرات اليوم.', 'No classes today.')}</p> : (
            <ul className="space-y-2">{classes.map((c) => <li key={c.key} className="flex items-center gap-3"><span className="h-8 w-1 rounded-full" style={{ background: c.color }} /><span className="num w-24 text-[12px] text-fg-2">{fmtTime(c.start, locale, settings.timeFormat === '12')}–{fmtTime(c.end, locale, settings.timeFormat === '12')}</span><span className="min-w-0 flex-1 truncate text-sm font-bold">{c.title}</span>{c.location && <span className="text-[12px] text-fg-3">{c.location}</span>}</li>)}</ul>
          )}
        </Card>
        <Card className="p-4">
          <CardHeader title={L('الاختبارات القادمة', 'Upcoming exams')} icon={<CalendarClock size={16} />} action={<Link to="/study/exams" className="text-[12px] font-bold text-study">{L('الكل', 'All')}</Link>} />
          {!(exams ?? []).length ? <p className="text-sm text-fg-2">{L('لا اختبارات خلال 90 يوماً.', 'No exams in the next 90 days.')}</p> : (
            <ul className="space-y-2">{[...(exams ?? [])].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')).slice(0, 5).map((e) => {
              const covered = (lectures ?? []).filter((l) => e.data.lecture_ids.includes(l.id));
              const ready = covered.filter((l) => l.status === 'studied' || l.status === 'mastered').length;
              return (
                <li key={e.id} className="flex items-center gap-3">
                  <span className="num grid size-11 shrink-0 place-items-center rounded-sm bg-[color-mix(in_oklab,var(--study)_38%,transparent)] text-center text-study"><span><b className="block text-base leading-none">{daysBetween(today, e.date!)}</b><span className="text-[9px]">{L('يوم', 'd')}</span></span></span>
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{e.data.title}</div><div className="text-[12px] text-fg-3">{courseLabel(courses.find((c) => c.id === e.data.course_id))}{covered.length ? ` · ${L('جاهزية', 'ready')} ${ready}/${covered.length}` : ''}</div></div>
                </li>
              );
            })}</ul>
          )}
        </Card>
        <Card className="p-4">
          <CardHeader title={L('الواجبات', 'Assignments')} icon={<FileCheck2 size={16} />} action={<Link to="/study/assignments" className="text-[12px] font-bold text-study">{L('الكل', 'All')}</Link>} />
          {!openAssign.length ? <p className="text-sm text-fg-2">{L('لا واجبات معلقة.', 'No pending assignments.')}</p> : (
            <ul className="space-y-1.5 text-sm">{openAssign.slice(0, 6).map((a) => <li key={a.id} className="flex gap-2"><span className="flex-1 truncate">{a.data.title}</span><span className={`num text-[12px] ${(a.date ?? '') < today ? 'font-bold text-danger' : 'text-fg-2'}`}>{relativeDay(a.date!, lang, locale)}</span></li>)}</ul>
          )}
        </Card>
        <Card className="p-4">
          <CardHeader title={L('قائمة المراجعة', 'Revision queue')} icon={<RotateCcw size={16} />} />
          {!revision.length && !due ? <p className="text-sm text-fg-2">{L('لا مراجعات مستحقة 👌', 'Nothing due 👌')}</p> : (
            <>
              <ul className="mb-3 space-y-1 text-sm">{revision.slice(0, 5).map((l) => <li key={l.id}><Link to={`/study/lectures?open=${l.id}`} className="hover:text-study">• {l.data.title}</Link></li>)}</ul>
              <div className="flex flex-wrap gap-2">
                {!!due && <Link to="/study/flashcards"><Button size="sm" icon={<Layers size={14} />}>{L(`راجع ${due} بطاقة`, `Review ${due} cards`)}</Button></Link>}
                <Link to="/study/focus?start=1"><Button size="sm" variant="primary" icon={<Timer size={14} />}>{L('ابدأ جلسة تركيز', 'Start focus')}</Button></Link>
                <Link to="/study/clinical"><Button size="sm" variant="ghost" icon={<Stethoscope size={14} />}>{L('السريري', 'Clinical')}</Button></Link>
              </div>
            </>
          )}
        </Card>
      </div>
      {courses.length > 0 && (
        <Card className="mt-4 p-4">
          <CardHeader title={L('تقدم المقررات', 'Course progress')} />
          <div className="grid gap-3 md:grid-cols-2">{courses.map((c) => {
            const ls = (lectures ?? []).filter((l) => l.data.course_id === c.id);
            const n = ls.filter((l) => l.status === 'studied' || l.status === 'mastered').length;
            return <Link key={c.id} to={`/study/courses?open=${c.id}`}><div className="mb-1 flex text-sm"><span className="flex-1 truncate">{courseLabel(c)}</span><span className="num text-fg-2">{n}/{ls.length}</span></div><Bar value={n} max={Math.max(1, ls.length)} color={c.data.color ?? 'var(--study)'} /></Link>;
          })}</div>
        </Card>
      )}
    </div>
  );
}
