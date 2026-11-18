import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import clsx from 'clsx';
import { useI18n } from '@/core/i18n';
import { updateSettings, useNow, useRecords, useRecordsInRange, useSettings } from '@/core/hooks';
import { db } from '@/core/db';
import { create, update } from '@/core/repo';
import { toast } from '@/core/toast';
import { daysBetween, fmtTime, hm, shiftKey, todayKey, weekStartKey } from '@/core/dates';
import { Box } from '@/modules/life/today/Trackers';
import { blankExam, courseGrade, gpa, pointsFor, type AssignmentData, type Course, type CourseData, type ExamData, type LectureData, type SemesterData, type StudySessionData } from './model';
import { courseLabel, useCourses } from './shared';
import { isDue, type SrsState } from './srs';
import { mmss, useFocusEngine, type ActiveFocus } from './focusEngine';

const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOUR = 44;
const colorOf = (c?: Course | null) => c?.data.color ?? 'var(--study)';
const tint = (c: string, p = 26) => `color-mix(in oklab, ${c} ${p}%, var(--surface))`;

/**
 * Study on one sheet: what's next, a focus timer, today's and the week's timetable, what's due,
 * reminders, flashcards, clinical requirements, a GPA calculator and the courses. Lectures live in
 * each course's schedule, which is also what the Life Day and Week pages show.
 */
export default function StudySheet() {
  const { L, lang, locale } = useI18n();
  const settings = useSettings();
  const now = useNow(30_000);
  const today = todayKey();
  const dow = now.getDay();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const h12 = settings.timeFormat === '12';
  const days = lang === 'ar' ? DAYS_AR : DAYS_EN;

  const courses = useCourses();
  const semesters = useRecords<SemesterData>('semester');
  const sem = (semesters ?? []).find((s) => s.data.active);
  const current = courses.filter((c) => !sem || !c.data.semester_id || c.data.semester_id === sem.id);
  const exams = useRecordsInRange<ExamData>('exam', today, shiftKey(today, 120));
  const work = useRecordsInRange<AssignmentData>('assignment', today, shiftKey(today, 45));
  const lectures = useRecords<LectureData>('lecture');
  const sessions = useRecordsInRange<StudySessionData>('study_session', weekStartKey(today, settings.weekStart), today);
  const past = useRecords<{ credits: number; points: number }>('grade');
  const cards = useLiveQuery(async () => (await db().records.where('type').anyOf('flashcard', 'deck').filter((r) => !r.deleted_at).toArray()), []);
  const reqs = useRecords<{ name: string; required: number; course_id: string | null }>('clinical_req');
  const logs = useRecords<{ req_id: string; role: string }>('clinical_log');

  // ── timetable ──
  const slots = useMemo(() => current.flatMap((c) => c.data.schedule.map((s, i) => ({ c, s, key: `${c.id}:${i}`, a: hm(s.start) ?? 0, b: hm(s.end) ?? (hm(s.start) ?? 0) + 60 }))), [current]);
  const weekDays = [...new Set([0, 1, 2, 3, 4, ...slots.map((x) => x.s.day)])].sort((a, b) => ((a - settings.weekStart + 7) % 7) - ((b - settings.weekStart + 7) % 7));
  const h0 = Math.min(8, ...slots.map((x) => Math.floor(x.a / 60)));
  const h1 = Math.max(16, ...slots.map((x) => Math.ceil(x.b / 60)));
  const todaySlots = slots.filter((x) => x.s.day === dow).sort((a, b) => a.a - b.a);
  // next lecture within a week
  const next = useMemo(() => {
    for (let k = 0; k < 8; k++) {
      const d = (dow + k) % 7;
      const xs = slots.filter((x) => x.s.day === d && (k > 0 || x.a > nowMin)).sort((a, b) => a.a - b.a);
      if (xs.length) return { ...xs[0], inDays: k };
    }
    return null;
  }, [slots, dow, nowMin]);
  const [sel, setSel] = useState<string | null>(null);

  // ── due ──
  const dueList = [
    ...(exams ?? []).map((e) => ({ id: e.id, icon: e.data.kind === 'final' ? '🎓' : '★', title: e.data.title, course: e.data.course_id, date: e.date!.slice(0, 10), to: `/study/exams?open=${e.id}` })),
    ...(work ?? []).filter((a) => a.status !== 'done').map((a) => ({ id: a.id, icon: '📝', title: a.data.title, course: a.data.course_id, date: a.date!.slice(0, 10), to: '/study/assignments' })),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 7);
  const leftTxt = (d: string) => { const n = daysBetween(today, d); return n === 0 ? L('اليوم', 'today') : n === 1 ? L('بكرة', 'tomorrow') : L(`بعد ${n} أيام`, `in ${n} days`); };
  const final = (exams ?? []).filter((e) => e.data.kind === 'final').sort((a, b) => a.date!.localeCompare(b.date!))[0];

  // ── cards, clinical, focus stats ──
  const decks = new Map((cards ?? []).filter((r) => r.type === 'deck').map((r) => [r.id, (r.data as { course_id: string | null }).course_id]));
  const dueCards = (cards ?? []).filter((r) => r.type === 'flashcard' && isDue((r.data as { srs?: SrsState }).srs));
  const dueByCourse = new Map<string, number>();
  for (const r of dueCards) { const cid = decks.get((r.data as { deck_id: string }).deck_id) ?? ''; dueByCourse.set(cid, (dueByCourse.get(cid) ?? 0) + 1); }
  const performed = new Map<string, number>();
  for (const l of logs ?? []) if (l.data.role === 'performed') performed.set(l.data.req_id, (performed.get(l.data.req_id) ?? 0) + 1);
  const reqRows = (reqs ?? []).map((r) => ({ r, done: performed.get(r.id) ?? 0 })).sort((a, b) => (a.done / Math.max(1, a.r.data.required)) - (b.done / Math.max(1, b.r.data.required))).slice(0, 4);
  const focusBy = new Map<string, number>(); let focusWeek = 0; let focusToday = 0;
  for (const s of sessions ?? []) { focusWeek += s.data.duration_min; if (s.date === today) focusToday += s.data.duration_min; if (s.data.course_id) focusBy.set(s.data.course_id, (focusBy.get(s.data.course_id) ?? 0) + s.data.duration_min); }
  const hmTxt = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;

  // ── GPA ──
  const scale = settings.study.gradeScale;
  const pointsOf = (c: Course): number | null => {
    if (c.data.final_points != null) return c.data.final_points;
    const exp = (c.data as CourseData & { expected_letter?: string }).expected_letter;
    if (exp) return scale.find((x) => x.letter === exp)?.points ?? null;
    const g = courseGrade(c.data).current;
    return g != null ? pointsFor(g, scale).points : null;
  };
  const rows = current.map((c) => ({ c, pts: pointsOf(c) }));
  const semGpa = gpa(rows.filter((r) => r.pts != null).map((r) => ({ credits: r.c.data.credits, points: r.pts! })));
  const pastRows = (past ?? []).map((p) => ({ credits: p.data.credits, points: p.data.points }));
  const prior = !pastRows.length && settings.study.priorGpa && settings.study.priorCredits ? [{ credits: settings.study.priorCredits, points: settings.study.priorGpa }] : pastRows;
  const cum = gpa([...prior, ...rows.filter((r) => r.pts != null).map((r) => ({ credits: r.c.data.credits, points: r.pts! }))]);
  const credits = current.reduce((a, c) => a + (c.data.credits || 0), 0);
  const letters = scale.slice(0, 6).map((x) => x.letter);

  const weekNo = sem?.data.start ? Math.max(1, Math.floor(daysBetween(sem.data.start, today) / 7) + 1) : null;
  const weeks = sem?.data.start && sem.data.end ? Math.ceil((daysBetween(sem.data.start, sem.data.end) + 1) / 7) : null;
  const rem = settings.study.reminders ?? { lectureMin: 15, examDays: true, dueDay: false, cardsAt: '21:00' };
  const setRem = (p: Partial<typeof rem>) => void updateSettings({ study: { reminders: { ...rem, ...p } } });

  return (
    <div className="mx-auto max-w-[1360px]">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className="text-[13px] font-bold text-fg-2">{[sem?.data.name, weekNo ? L(`الأسبوع ${weekNo}${weeks ? ` من ${weeks}` : ''}`, `Week ${weekNo}${weeks ? ` of ${weeks}` : ''}`) : null].filter(Boolean).join(' · ') || L('الفصل الحالي', 'This semester')}</p>
          <h1 className="nb-title text-[34px] leading-tight md:text-[40px]">{L('الدراسة', 'Study')} {final && <span className="nb-hl text-[0.62em]">{L(`باقي على الفاينل ${daysBetween(today, final.date!.slice(0, 10))} يوم`, `${daysBetween(today, final.date!.slice(0, 10))} days to finals`)}</span>}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex h-9 items-center rounded-full border border-line bg-surface px-3.5 text-[13px] font-bold">📚 {L(`${current.length} مواد · ${credits} ساعة`, `${current.length} courses · ${credits} credits`)}</span>
          {semGpa != null && <span className="inline-flex h-9 items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--study)_35%,var(--surface))] px-3.5 text-[13px] font-bold">{L('المعدل المتوقع', 'Projected GPA')} <span className="num">{semGpa.toFixed(2)}</span></span>}
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border-[1.5px] border-dashed border-study-ink bg-[color-mix(in_oklab,var(--study)_18%,var(--surface))] px-4 py-2.5 text-[13.5px]">
        <span className="text-lg">↔</span>
        <span className="min-w-56 flex-1"><b>{L('الجدول مربوط بالحياة.', 'The timetable is linked to Life.')}</b> {L('كل محاضرة في مادة هنا تطلع لحالها في جدول ساعات اليوم وجدول الأسبوع. المواد والدرجات والمذاكرة تبقى هنا.', 'Every lecture here shows up on your Day hours and Week table by itself. Courses, grades and studying stay here.')}</span>
        <Link to="/life/today" className="font-bold text-study-ink">{L('افتح يومي ←', 'Open my day →')}</Link>
      </div>

      <div className="@container/nb">
        <div className="grid grid-cols-1 gap-4 @[1060px]/nb:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] @[1060px]/nb:gap-0">
          {/* ── page one: now ── */}
          <section className="nb-paper nb-page nb-a paper-grid flex flex-col gap-4 px-4 pb-6 pt-8 sm:px-6" aria-label={L('الحين', 'Now')}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-md bg-fg p-4 text-bg">
                <p className="text-[12.5px] opacity-75">{L('المحاضرة الجاية', 'Next lecture')}</p>
                {next ? (
                  <>
                    <p className="mt-1 text-[21px] font-bold leading-tight">{next.c.data.name}</p>
                    <p className="text-[13.5px] opacity-85">{next.inDays === 0 ? L('اليوم', 'Today') : next.inDays === 1 ? L('بكرة', 'Tomorrow') : days[next.s.day]} {fmtTime(next.s.start, locale, h12)}{next.s.room ? ` · ${next.s.room}` : ''}</p>
                    {next.inDays === 0 && <span className="mt-2 inline-flex h-6 items-center rounded-full bg-reward px-2.5 text-[12px] font-bold text-on-accent">{L(`بعد ${next.a - nowMin < 60 ? `${next.a - nowMin} د` : `${Math.floor((next.a - nowMin) / 60)} س ${(next.a - nowMin) % 60} د`}`, `in ${next.a - nowMin} min`)}</span>}
                  </>
                ) : <p className="mt-1 text-[15px] opacity-85">{L('ما فيه جدول بعد.', 'No timetable yet.')} <Link to="/study/schedule" className="font-bold underline">{L('صوّره أو أضفه', 'Photograph or add it')}</Link></p>}
              </div>
              <Box title={L('اليوم', 'Today')} extra={L(`${todaySlots.length} محاضرات`, `${todaySlots.length} classes`)}>
                {!todaySlots.length ? <p className="text-[13px] text-fg-2">{L('ما عندك محاضرات اليوم.', 'No classes today.')}</p> : (
                  <ul className="flex flex-col gap-1">
                    {todaySlots.map((x) => <li key={x.key} className={clsx('flex items-center gap-2 text-[13.5px]', x.b < nowMin && 'opacity-50')}><span className="size-2.5 rounded-full" style={{ background: colorOf(x.c) }} /><span className="flex-1">{x.c.data.name}</span><span className="num text-[12px] text-fg-2">{fmtTime(x.s.start, locale, h12)}</span></li>)}
                  </ul>
                )}
              </Box>
            </div>

            <FocusCard courses={current} focusToday={hmTxt(focusToday)} focusWeek={hmTxt(focusWeek)} />

            <div>
              <h2 className="nb-title mb-2 text-xl text-study-ink">{L('الجدول الأسبوعي', 'Weekly timetable')} <span className="text-[12px] font-medium text-fg-2" style={{ fontFamily: 'var(--font-sans)' }}>{L('اضغط مادة تحت عشان تبرز', 'Tap a course below to highlight it')}</span></h2>
              {!slots.length ? <p className="rounded-sm bg-surface-2 p-3 text-[13.5px] text-fg-2">{L('الجدول فاضي.', 'Empty.')} <Link to="/study/schedule" className="font-bold text-accent-ink">{L('✨ صوّر جدولك وينزل لحاله', '✨ Photograph your timetable')}</Link></p> : (
                <div className="overflow-x-auto scroll-thin">
                  <div className="grid min-w-[520px] rounded-md border-[1.5px] border-line bg-surface/95" style={{ gridTemplateColumns: `40px repeat(${weekDays.length}, minmax(0, 1fr))` }}>
                    <span />
                    {weekDays.map((d) => <span key={d} className={clsx('border-b border-line py-1.5 text-center text-[12.5px] font-bold', d === dow && 'bg-[color-mix(in_oklab,var(--reward)_30%,var(--surface))]')}>{days[d]}</span>)}
                    <div className="relative" style={{ height: (h1 - h0) * HOUR }}>
                      {Array.from({ length: h1 - h0 }, (_, i) => <span key={i} className="num absolute start-1 text-[10.5px] text-fg-3" style={{ top: i * HOUR + 2 }}>{fmtTime(`${String(h0 + i).padStart(2, '0')}:00`, locale, h12).replace(':00', '')}</span>)}
                    </div>
                    {weekDays.map((d) => (
                      <div key={d} className="relative border-s border-line/70" style={{ height: (h1 - h0) * HOUR, backgroundImage: `repeating-linear-gradient(transparent 0 ${HOUR - 1}px, var(--border) ${HOUR - 1}px ${HOUR}px)` }}>
                        {slots.filter((x) => x.s.day === d).map((x) => (
                          <Link key={x.key} to={`/study/courses?open=${x.c.id}`} className={clsx('absolute inset-x-0.5 overflow-hidden rounded-[7px] border-s-[3px] px-1.5 py-1 text-[11.5px] leading-tight transition-opacity', sel && sel !== x.c.id && 'opacity-25')}
                            style={{ top: ((x.a - h0 * 60) / 60) * HOUR + 2, height: Math.max(22, ((x.b - x.a) / 60) * HOUR - 4), background: tint(colorOf(x.c), 30), borderColor: colorOf(x.c) }}>
                            <b>{x.c.data.name}</b><br /><span className="text-fg-2">{x.s.kind === 'lab' ? L('معمل', 'Lab') : x.s.kind === 'clinical' ? L('سريري', 'Clinical') : L('محاضرة', 'Lecture')}{x.s.room ? ` · ${x.s.room}` : ''}</span>
                          </Link>
                        ))}
                        {d === dow && nowMin > h0 * 60 && nowMin < h1 * 60 && <span className="absolute inset-x-0 h-0.5 bg-danger" style={{ top: ((nowMin - h0 * 60) / 60) * HOUR }} aria-hidden="true" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── page two: what's due, reminders, cards, clinical, GPA ── */}
          <section className="nb-paper nb-page nb-b paper-dots flex flex-col gap-4 px-4 pb-6 pt-8 sm:px-6" aria-label={L('الجاي والمعدل', 'Due and GPA')}>
            <Box title={L('الجاي', 'Coming up')} extra={L('اختبارات وتسليمات', 'exams and due work')}>
              {!dueList.length ? <p className="text-[13.5px] text-fg-2">{L('ما فيه شي قريب 👌', 'Nothing coming up 👌')}</p> : (
                <ul>
                  {dueList.map((x) => {
                    const c = current.find((k) => k.id === x.course);
                    const n = daysBetween(today, x.date);
                    return (
                      <li key={x.id} className={clsx('flex min-h-10 items-center gap-2 border-b border-dashed border-line text-[14px] transition-opacity', sel && sel !== x.course && 'opacity-30')}>
                        <span className="w-5 text-center">{x.icon}</span><span className="size-2.5 shrink-0 rounded-full" style={{ background: colorOf(c) }} />
                        <Link to={x.to} className="min-w-0 flex-1 hover:underline"><b>{x.title}</b> <span className="text-[12px] text-fg-2">{c?.data.name ?? ''}</span></Link>
                        <span className={clsx('num shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-bold', n <= 1 ? 'bg-[color-mix(in_oklab,var(--danger)_22%,var(--surface))] text-danger' : n <= 7 ? 'bg-[color-mix(in_oklab,var(--reward)_40%,var(--surface))]' : 'bg-surface-2 text-fg-2')}>{leftTxt(x.date)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <AddDue courses={current} />
            </Box>

            <div className="grid gap-4 sm:grid-cols-2">
              <Box title={`🔔 ${L('التذكيرات', 'Reminders')}`}>
                <ul className="flex flex-col gap-1.5 text-[13.5px]">
                  <Toggle on={rem.lectureMin != null} onClick={() => setRem({ lectureMin: rem.lectureMin != null ? null : 15 })} label={L('قبل كل محاضرة بـ15 دقيقة', '15 min before each lecture')} />
                  <Toggle on={rem.examDays} onClick={() => setRem({ examDays: !rem.examDays })} label={L('قبل الاختبار بيومين: خطة مراجعة', '2 days before exams')} />
                  <Toggle on={rem.dueDay} onClick={() => setRem({ dueDay: !rem.dueDay })} label={L('قبل التسليم بيوم', 'The day before work is due')} />
                  <Toggle on={!!rem.cardsAt} onClick={() => setRem({ cardsAt: rem.cardsAt ? null : '21:00' })} label={L('كل يوم 9 م: راجع البطاقات', 'Daily 9pm: review cards')} />
                </ul>
              </Box>
              <Box title={`🗂 ${L('البطاقات', 'Flashcards')}`} extra={L('للمراجعة اليوم', 'due today')}>
                <p className="num text-[34px] font-black leading-none">{dueCards.length}</p>
                <ul className="mt-1.5 text-[12.5px]">{[...dueByCourse.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([cid, n]) => { const c = current.find((k) => k.id === cid); return <li key={cid} className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: colorOf(c) }} /><span className="flex-1">{c?.data.name ?? L('عام', 'General')}</span><b className="num">{n}</b></li>; })}</ul>
                <Link to="/study/flashcards" className="mt-2.5 inline-flex h-9 w-full items-center justify-center rounded-full bg-fg text-[13px] font-bold text-bg">{dueCards.length ? L('ابدأ المراجعة', 'Start review') : L('افتح البطاقات', 'Open flashcards')}</Link>
              </Box>
            </div>

            {settings.study.dental && reqRows.length > 0 && (
              <Box title={`🦷 ${L('المتطلبات السريرية', 'Clinical requirements')}`} extra={<Link to="/study/clinical" className="font-bold text-accent-ink">{L('الكل', 'All')}</Link>} className="!bg-[color-mix(in_oklab,var(--health)_14%,var(--surface))]">
                {reqRows.map(({ r, done }) => (
                  <div key={r.id} className="mb-1.5 text-[13px]"><div className="flex"><span className="flex-1">{r.data.name}</span><b className="num">{done} / {r.data.required}</b></div>
                    <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-health-ink" style={{ width: `${Math.min(100, (done / Math.max(1, r.data.required)) * 100)}%` }} /></div></div>
                ))}
              </Box>
            )}

            <Box title={L('حاسبة المعدل', 'GPA calculator')} extra={L('اختر الدرجة المتوقعة', 'pick your expected grade')}>
              {!rows.length ? <p className="text-[13.5px] text-fg-2">{L('أضف موادك أول.', 'Add your courses first.')}</p> : (
                <ul>
                  {rows.map(({ c, pts }) => {
                    const fixed = c.data.final_points != null;
                    const exp = (c.data as CourseData & { expected_letter?: string }).expected_letter;
                    return (
                      <li key={c.id} className="flex min-h-10 flex-wrap items-center gap-2 border-b border-dashed border-line py-1 text-[14px]">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: colorOf(c) }} />
                        <span className="min-w-28 flex-1">{c.data.name} <span className="text-[12px] text-fg-2">{L(`${c.data.credits} س`, `${c.data.credits} cr`)}</span></span>
                        {fixed ? <b className="num">{c.data.final_letter ?? pts}</b> : (
                          <span className="flex flex-wrap gap-1">
                            {letters.map((g) => <button key={g} onClick={() => void update<CourseData & { expected_letter?: string | null }>(c.id, { data: { expected_letter: exp === g ? null : g } })} aria-pressed={exp === g}
                              className={clsx('num h-7 min-w-8 rounded-[7px] border-[1.5px] px-1.5 text-[12px] font-bold', exp === g ? 'border-study-ink bg-study-ink text-surface' : 'border-line bg-surface')}>{g}</button>)}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <div className="rounded-sm bg-[color-mix(in_oklab,var(--study)_30%,var(--surface))] p-3"><p className="text-[12px] text-fg-2">{L('معدل الفصل', 'Semester')}</p><p className="num text-[28px] font-black leading-none">{semGpa != null ? semGpa.toFixed(2) : '—'}</p></div>
                <div className="rounded-sm bg-[color-mix(in_oklab,var(--reward)_32%,var(--surface))] p-3"><p className="text-[12px] text-fg-2">{L('التراكمي بعده', 'Cumulative after')}</p><p className="num text-[28px] font-black leading-none">{cum != null ? cum.toFixed(2) : '—'}</p></div>
              </div>
              {!pastRows.length && (
                <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[12.5px] text-fg-2">{L('معدلك قبل هالفصل:', 'GPA before this term:')}
                  <input type="number" step="0.01" min={0} max={settings.study.gpaScale} defaultValue={settings.study.priorGpa ?? ''} onBlur={(e) => void updateSettings({ study: { priorGpa: e.target.value ? Number(e.target.value) : null } })} className="nb-write num !w-16 text-center" aria-label={L('المعدل السابق', 'Prior GPA')} />
                  {L('على', 'over')}
                  <input type="number" min={0} defaultValue={settings.study.priorCredits ?? ''} onBlur={(e) => void updateSettings({ study: { priorCredits: e.target.value ? Number(e.target.value) : null } })} className="nb-write num !w-14 text-center" aria-label={L('الساعات السابقة', 'Prior credits')} />
                  {L('ساعة', 'credits')}
                </p>
              )}
              <p className="mt-1 text-[11.5px] text-fg-3">{L(`مقياس ${settings.study.gpaScale}. الدرجة النهائية (لو مسجلة) تغلب المتوقعة.`, `${settings.study.gpaScale}-point scale. A recorded final grade wins over the expected one.`)}</p>
            </Box>
          </section>
        </div>
      </div>

      <section className="nb-paper paper-plain mt-4 rounded-lg px-4 pb-5 pt-6 shadow-[0_18px_40px_-26px_rgba(47,41,38,.45)] sm:px-6" aria-label={L('المواد', 'Courses')}>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="nb-title text-2xl text-study-ink">{L('المواد', 'Courses')}</h2>
          <Link to="/study/courses" className="text-[13px] font-bold text-accent-ink">{L('+ مادة يدوياً', '+ Add manually')}</Link>
        </div>
        {!current.length ? <p className="text-[14px] text-fg-2">{L('ما فيه مواد بعد.', 'No courses yet.')} <Link to="/study/courses" className="font-bold text-accent-ink">{L('✨ صوّر موادك وتنضاف بثواني', '✨ Photograph your courses')}</Link></p> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {current.map((c) => {
              const ls = (lectures ?? []).filter((l) => l.data.course_id === c.id);
              const doneL = ls.filter((l) => l.status === 'studied' || l.status === 'revision' || l.status === 'mastered').length;
              const nd = dueList.find((x) => x.course === c.id);
              const when = c.data.schedule.map((s) => `${days[s.day]} ${fmtTime(s.start, locale, h12)}`).join(' · ');
              return (
                <button key={c.id} onClick={() => setSel(sel === c.id ? null : c.id)} aria-pressed={sel === c.id}
                  className={clsx('flex flex-col gap-1.5 rounded-md border-[1.5px] bg-surface/95 p-3 text-start transition-shadow', sel === c.id ? 'border-fg shadow-[inset_0_0_0_1px_var(--text)]' : 'border-line hover:border-line-strong')}>
                  <span className="flex items-center gap-2"><span className="size-3 rounded-full" style={{ background: colorOf(c) }} /><b className="flex-1 truncate">{c.data.name}</b><span className="text-[11.5px] text-fg-3">{c.data.code}</span></span>
                  <span className="truncate text-[12.5px] text-fg-2">{when || L('بدون جدول', 'No timetable')}</span>
                  <span className="text-[12.5px]">{L(`المحاضرات ${doneL} / ${ls.length}`, `Lectures ${doneL} / ${ls.length}`)}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-surface-2"><span className="block h-full rounded-full" style={{ width: `${ls.length ? (doneL / ls.length) * 100 : 0}%`, background: colorOf(c) }} /></span>
                  <span className="flex flex-wrap gap-1.5 text-[12px]">
                    <span className="rounded-full px-2" style={{ background: tint(colorOf(c), 28) }}>⏱ {hmTxt(focusBy.get(c.id) ?? 0)}</span>
                    {nd && <span className="rounded-full bg-surface-2 px-2">{nd.title} · {leftTxt(nd.date)}</span>}
                    <Link to={`/study/courses?open=${c.id}`} onClick={(e) => e.stopPropagation()} className="ms-auto font-bold text-accent-ink">{L('افتح', 'Open')}</Link>
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <p className="mt-3 text-[12.5px] text-fg-2">{L('داخل المادة: المحاضرات، الملاحظات، البطاقات، بنك الأسئلة، المصادر، والدرجات.', 'Inside a course: lectures, notes, flashcards, question bank, resources and grades.')}</p>
      </section>
    </div>
  );
}

/** Add an exam, quiz or piece of work right from the sheet (lands in Exams/Assignments, the calendar and Week). */
function AddDue({ courses }: { courses: Course[] }) {
  const { L } = useI18n();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'exam' | 'quiz' | 'work'>('exam');
  const [title, setTitle] = useState('');
  const [course, setCourse] = useState<string>(courses[0]?.id ?? '');
  const [date, setDate] = useState(shiftKey(todayKey(), 7));
  const [time, setTime] = useState('');
  const save = async () => {
    const t = title.trim() || (kind === 'work' ? L('تسليم', 'Assignment') : kind === 'quiz' ? L('كويز', 'Quiz') : L('اختبار', 'Exam'));
    const cid = course || null;
    if (kind === 'work') await create('assignment', { title: t, course_id: cid, due: date, due_time: time || null, weight: null, score: null, max: 100, notes: '', link: null, state: 'todo' }, { date, status: 'todo', parent_id: cid });
    else await create<ExamData>('exam', blankExam({ title: t, course_id: cid, kind: kind === 'quiz' ? 'quiz' : 'midterm', time: time || null }), { date, parent_id: cid });
    toast(L('انضاف — ويطلع في التقويم والأسبوع', 'Added — it shows in the calendar and Week'));
    setTitle(''); setTime(''); setOpen(false);
  };
  if (!open) return <button onClick={() => setOpen(true)} className="mt-2 text-[13px] font-bold text-accent-ink">+ {L('أضف اختبار أو تسليم', 'Add an exam or due work')}</button>;
  return (
    <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="mt-3 flex flex-col gap-2 rounded-sm border border-dashed border-line-strong p-2.5">
      <div className="flex flex-wrap gap-1.5">
        {([['exam', '★ اختبار', '★ Exam'], ['quiz', '؟ كويز', '? Quiz'], ['work', '📝 تسليم', '📝 Due work']] as const).map(([k, ar, en]) => (
          <button type="button" key={k} onClick={() => setKind(k)} aria-pressed={kind === k} className={clsx('h-8 rounded-full border-[1.5px] px-3 text-[12.5px] font-bold', kind === k ? 'border-fg bg-fg text-bg' : 'border-line bg-surface')}>{L(ar, en)}</button>
        ))}
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={L('العنوان (مثلاً: ميد الأشعة)', 'Title (e.g. Radiology midterm)')} aria-label={L('العنوان', 'Title')} className="nb-write text-[15px]" />
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <select value={course} onChange={(e) => setCourse(e.target.value)} aria-label={L('المادة', 'Course')} className="h-9 rounded-full border border-line bg-surface px-2">
          <option value="">{L('بدون مادة', 'No course')}</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.data.name}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={L('التاريخ', 'Date')} className="h-9 rounded-full border border-line bg-surface px-2" />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label={L('الوقت', 'Time')} className="h-9 rounded-full border border-line bg-surface px-2" />
      </div>
      <div className="flex gap-2"><button type="submit" className="h-9 rounded-full bg-fg px-4 text-[13px] font-bold text-bg">{L('أضف', 'Add')}</button><button type="button" onClick={() => setOpen(false)} className="h-9 rounded-full border border-line px-3 text-[13px] font-bold">{L('إلغاء', 'Cancel')}</button></div>
    </form>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className="flex-1">{label}</span>
      <button role="switch" aria-checked={on} aria-label={label} onClick={onClick}
        className={clsx('relative h-6 w-10 shrink-0 rounded-full transition-colors', on ? 'bg-study-ink' : 'bg-line-strong')}>
        <span className={clsx('absolute top-0.5 size-5 rounded-full bg-surface transition-all', on ? 'start-[18px]' : 'start-0.5')} />
      </button>
    </li>
  );
}

/** Compact focus timer on the sheet — same running session as the Focus page. */
function FocusCard({ courses, focusToday, focusWeek }: { courses: Course[]; focusToday: string; focusWeek: string }) {
  const { L } = useI18n();
  const settings = useSettings();
  const [mode, setMode] = useState<ActiveFocus['mode']>('pomodoro');
  const [course, setCourse] = useState<string | null>(courses[0]?.id ?? null);
  const [mins, setMins] = useState(40);
  const { active, elapsedMs, remainingMs, start, pause, resume, stop } = useFocusEngine();
  const plannedMs = active ? active.planned_min * 60000 : (mode === 'pomodoro' ? settings.focus.work : mode === 'custom' ? mins : 0) * 60000;
  const shown = active ? (remainingMs ?? elapsedMs) : plannedMs;
  const frac = active && remainingMs != null && plannedMs ? 1 - Math.max(0, remainingMs) / plannedMs : 0;
  const cur = courses.find((c) => c.id === (active?.course_id ?? course));
  const color = cur?.data.color ?? 'var(--study)';
  const C = 2 * Math.PI * 52;
  return (
    <Box title={`⏱ ${L('ساعة التركيز', 'Focus clock')}`} extra={L(`اليوم ${focusToday} · الأسبوع ${focusWeek}`, `Today ${focusToday} · Week ${focusWeek}`)}>
      <div className="flex flex-wrap items-center gap-4">
        <svg viewBox="0 0 120 120" className="size-32 shrink-0" aria-label={L('المؤقت', 'Timer')}>
          <circle cx="60" cy="60" r="52" fill="none" stroke="var(--surface-2)" strokeWidth="10" />
          <circle cx="60" cy="60" r="52" fill="none" stroke={active?.phase === 'break' ? 'var(--health-ink)' : color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${C * frac} ${C}`} transform="rotate(-90 60 60)" />
          <text x="60" y="60" textAnchor="middle" fontSize="22" fontWeight="800" fill="var(--text)" className="num">{mmss(shown)}</text>
          <text x="60" y="80" textAnchor="middle" fontSize="10.5" fill="var(--text-2)">{active ? (active.phase === 'break' ? L('استراحة', 'Break') : active.paused_at ? L('متوقف', 'Paused') : L('تركيز', 'Focus')) : L('جاهز', 'Ready')}</text>
        </svg>
        <div className="flex min-w-52 flex-1 flex-col gap-2.5">
          {!active && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {([['pomodoro', `🍅 ${L('طماطم', 'Pomodoro')} ${settings.focus.work}/${settings.focus.short}`], ['custom', L('⏳ مدة أختارها', '⏳ My own length')], ['stopwatch', L('⏱ مفتوح', '⏱ Open-ended')]] as const).map(([m, label]) => (
                  <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m} className={clsx('h-8 rounded-full border-[1.5px] px-3 text-[12.5px] font-bold', mode === m ? 'border-fg bg-fg text-bg' : 'border-line bg-surface')}>{label}</button>
                ))}
              </div>
              {mode === 'custom' && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {[20, 30, 40, 45, 60, 90].map((m) => (
                    <button key={m} onClick={() => setMins(m)} aria-pressed={mins === m} className={clsx('num h-7 rounded-full border-[1.5px] px-2.5 text-[12px] font-bold', mins === m ? 'border-study-ink bg-study-ink text-surface' : 'border-line bg-surface')}>
                      {m === 30 ? L('نص ساعة', '30 min') : m === 60 ? L('ساعة', '1 h') : m === 90 ? L('ساعة ونص', '1.5 h') : L(`${m} د`, `${m} min`)}
                    </button>
                  ))}
                  <label className="flex items-center gap-1 text-[12px] text-fg-2"><input type="number" min={5} max={240} value={mins} onChange={(e) => setMins(Math.max(5, Math.min(240, Number(e.target.value) || 5)))} className="nb-write num !w-14 text-center text-[14px]" aria-label={L('الدقائق', 'Minutes')} />{L('دقيقة', 'min')}</label>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[12.5px] text-fg-2">{L('تذاكر:', 'Studying:')}</span>
                {courses.slice(0, 6).map((c) => (
                  <button key={c.id} onClick={() => setCourse(c.id)} aria-pressed={course === c.id} className={clsx('inline-flex h-7 items-center gap-1.5 rounded-full border-[1.5px] px-2.5 text-[12px] font-bold', course === c.id ? 'border-fg bg-fg text-bg' : 'border-line bg-surface')}>
                    <span className="size-2 rounded-full" style={{ background: c.data.color ?? 'var(--study)' }} />{c.data.name}
                  </button>
                ))}
              </div>
            </>
          )}
          {active && <p className="text-[13.5px]">{L('تذاكر', 'Studying')} <b>{courseLabel(cur) || L('عام', 'General')}</b></p>}
          <div className="flex flex-wrap gap-2">
            {!active && <button onClick={() => void start({ mode, customMin: mins, course })} className="h-10 rounded-full bg-fg px-5 text-sm font-bold text-bg">▶ {L('ابدأ', 'Start')}</button>}
            {active && (active.paused_at
              ? <button onClick={() => void resume()} className="h-10 rounded-full bg-fg px-5 text-sm font-bold text-bg">▶ {L('كمّل', 'Resume')}</button>
              : <button onClick={() => void pause()} className="h-10 rounded-full bg-fg px-5 text-sm font-bold text-bg">⏸ {L('إيقاف مؤقت', 'Pause')}</button>)}
            {active && <button onClick={() => void stop()} className="h-10 rounded-full border border-line px-4 text-sm font-bold">{active.phase === 'work' ? L('إنهاء وحفظ', 'Stop & save') : L('تخطي الاستراحة', 'Skip break')}</button>}
            <Link to="/study/focus" className="ms-auto self-center text-[12.5px] font-bold text-accent-ink">{L('السجل', 'History')}</Link>
          </div>
        </div>
      </div>
    </Box>
  );
}
