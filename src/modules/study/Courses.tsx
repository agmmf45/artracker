import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { Plus, BookOpen, ArrowRight, ArrowLeft, Trash2, X, Archive, CalendarRange } from 'lucide-react';
import clsx from 'clsx';
import { useI18n } from '@/core/i18n';
import { useRecords, useSettings } from '@/core/hooks';
import { create, remove, revertTo, update } from '@/core/repo';
import { newId } from '@/core/ids';
import { todayKey } from '@/core/dates';
import { undoToast, toast } from '@/core/toast';
import { Modal } from '@/design/overlay';
import { Bar, Button, Card, Chip, EmptyState, IconButton, Input, PageHeader, Select, Stat } from '@/design/ui';
import { StudyPhotoImport } from './sheet/PhotoImport';
import { blankCourse, courseGrade, pointsFor, type Course, type CourseData, type LectureData, type SemesterData, type Session, LECTURE_STATES } from './model';
import { COURSE_COLORS } from './shared';

const DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Courses() {
  const { L } = useI18n();
  const courses = useRecords<CourseData>('course');
  const semesters = useRecords<SemesterData>('semester');
  const lectures = useRecords<LectureData>('lecture');
  const [params, setParams] = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Course | 'new' | null>(null);
  const [semEdit, setSemEdit] = useState(false);
  const [sem, setSem] = useState<string>('');
  const [archived, setArchived] = useState(false);

  useEffect(() => { const id = params.get('open'); if (id) { setOpenId(id); params.delete('open'); setParams(params, { replace: true }); } }, [params, setParams]);
  useEffect(() => { if (!sem && semesters?.length) setSem(semesters.find((s) => s.data.active)?.id ?? ''); }, [semesters, sem]);
  const current = (courses ?? []).find((c) => c.id === openId) as Course | undefined;
  if (current) return <CourseView c={current} onBack={() => setOpenId(null)} onEdit={() => setEditing(current)} editing={editing} setEditing={setEditing} />;

  const list = (courses ?? []).filter((c) => !!c.data.archived === archived && (!sem || c.data.semester_id === sem));
  return (
    <div>
      <PageHeader title={L('المقررات', 'Courses')} subtitle={L('السنة ← الفصل ← المقرر ← الفصل الدراسي ← المحاضرة', 'Year → Semester → Course → Chapter → Lecture')}
        actions={<><Button icon={<CalendarRange size={16} />} onClick={() => setSemEdit(true)}>{L('الفصول', 'Semesters')}</Button><Button variant="primary" icon={<Plus size={17} />} onClick={() => setEditing('new')}>{L('مقرر', 'Course')}</Button></>} />
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Chip active={!sem} onClick={() => setSem('')}>{L('كل الفصول', 'All semesters')}</Chip>
        {(semesters ?? []).map((s) => <Chip key={s.id} active={sem === s.id} onClick={() => setSem(s.id)}>{s.data.name} {s.data.year}{s.data.active ? ' ●' : ''}</Chip>)}
        <Chip active={archived} onClick={() => setArchived(!archived)}><Archive size={12} />{L('المؤرشفة', 'Archived')}</Chip>
      </div>
      <StudyPhotoImport />
      {!list.length ? <EmptyState icon={<BookOpen size={30} />} title={L('أضف مقرراتك لهذا الفصل', 'Add your courses for this semester')} hint={L('الجدول والمحاضرات والاختبارات والدرجات كلها ترتبط بالمقرر.', 'Schedule, lectures, exams and grades all hang off a course.')} action={<Button variant="primary" onClick={() => setEditing('new')}>{L('أضف مقرراً', 'Add a course')}</Button>} /> : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => {
            const ls = (lectures ?? []).filter((l) => l.data.course_id === c.id);
            const mastered = ls.filter((l) => l.status === 'mastered' || l.status === 'studied').length;
            const g = courseGrade(c.data);
            return (
              <button key={c.id} onClick={() => setOpenId(c.id)} className="card p-4 text-start hover:border-line-strong" style={{ borderTop: `3px solid ${c.data.color ?? 'var(--study)'}` }}>
                <div className="text-[12px] font-bold text-fg-3">{c.data.code} · {c.data.credits} {L('ساعات', 'cr')}</div>
                <div className="text-lg font-bold">{c.data.name}</div>
                {c.data.instructor && <div className="text-[13px] text-fg-2">{c.data.instructor}</div>}
                <div className="mt-3 flex items-center gap-2"><Bar value={mastered} max={Math.max(1, ls.length)} color={c.data.color ?? 'var(--study)'} className="flex-1" /><span className="num text-[12px] text-fg-2">{mastered}/{ls.length}</span></div>
                {g.current !== null && <div className="num mt-1 text-[12px] text-fg-2">{L('الدرجة حتى الآن', 'Grade so far')}: {g.current.toFixed(1)}%</div>}
              </button>
            );
          })}
        </div>
      )}
      {editing && <CourseEditor c={editing === 'new' ? null : editing} defaultSem={sem || null} onClose={() => setEditing(null)} />}
      {semEdit && <SemesterManager onClose={() => setSemEdit(false)} />}
    </div>
  );
}

function SemesterManager({ onClose }: { onClose: () => void }) {
  const { L } = useI18n();
  const semesters = useRecords<SemesterData>('semester');
  const [d, setD] = useState<SemesterData>({ name: '', year: String(new Date().getFullYear()), start: null, end: null, active: true });
  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title={L('الفصول الدراسية', 'Semesters')}>
      <ul className="mb-4 divide-y divide-line">
        {(semesters ?? []).map((s) => (
          <li key={s.id} className="flex items-center gap-2 py-2">
            <span className="flex-1 text-sm font-bold">{s.data.name} {s.data.year}<span className="ms-2 text-[12px] font-normal text-fg-3">{s.data.start ?? ''} → {s.data.end ?? ''}</span></span>
            <Chip active={s.data.active} onClick={async () => { for (const x of semesters ?? []) if (x.data.active && x.id !== s.id) await update<SemesterData>(x.id, { data: { active: false } }); await update<SemesterData>(s.id, { data: { active: !s.data.active } }); }}>{L('الحالي', 'Current')}</Chip>
            <IconButton size="sm" tone="danger" label={L('حذف', 'Delete')} onClick={() => remove(s.id)}><Trash2 size={14} /></IconButton>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-2">
        <Input label={L('الاسم', 'Name')} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder={L('الفصل الأول', 'Fall')} />
        <Input label={L('السنة الدراسية', 'Academic year')} value={d.year} onChange={(e) => setD({ ...d, year: e.target.value })} />
        <Input type="date" label={L('البداية', 'Start')} value={d.start ?? ''} onChange={(e) => setD({ ...d, start: e.target.value || null })} />
        <Input type="date" label={L('النهاية', 'End')} value={d.end ?? ''} onChange={(e) => setD({ ...d, end: e.target.value || null })} />
      </div>
      <Button className="mt-3" variant="primary" onClick={async () => { if (!d.name.trim()) return; await create<SemesterData>('semester', d); setD({ ...d, name: '' }); }}>{L('إضافة فصل', 'Add semester')}</Button>
    </Modal>
  );
}

function CourseEditor({ c, defaultSem, onClose }: { c: Course | null; defaultSem: string | null; onClose: () => void }) {
  const { L, lang } = useI18n();
  const semesters = useRecords<SemesterData>('semester');
  const [d, setD] = useState<CourseData>(c ? { ...blankCourse(), ...c.data } : blankCourse({ semester_id: defaultSem, color: COURSE_COLORS[Math.floor(Math.random() * COURSE_COLORS.length)] }));
  const set = (p: Partial<CourseData>) => setD((x) => ({ ...x, ...p }));
  const setSession = (i: number, p: Partial<Session>) => set({ schedule: d.schedule.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const save = async () => {
    if (!d.name.trim()) { toast(L('اسم المقرر مطلوب', 'Course name required'), { tone: 'error' }); return; }
    const totalW = d.components.reduce((s, x) => s + x.weight, 0);
    if (d.components.length && totalW !== 100) toast(L(`مجموع الأوزان ${totalW}% (ليس 100%)`, `Weights add up to ${totalW}% (not 100%)`));
    if (c) await update<CourseData>(c.id, { data: d });
    else await create<CourseData>('course', d);
    onClose();
  };
  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title={c ? L('تعديل المقرر', 'Edit course') : L('مقرر جديد', 'New course')} wide
      footer={<><Button variant="ghost" onClick={onClose}>{L('إلغاء', 'Cancel')}</Button><Button variant="primary" onClick={save}>{L('حفظ', 'Save')}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Input className="sm:col-span-2" label={L('اسم المقرر', 'Course name')} value={d.name} onChange={(e) => set({ name: e.target.value })} autoFocus={!c} />
        <Input label={L('الرمز', 'Code')} dir="ltr" value={d.code} onChange={(e) => set({ code: e.target.value })} placeholder="DENT 341" />
        <Input type="number" min={0} label={L('الساعات المعتمدة', 'Credit hours')} value={d.credits} onChange={(e) => set({ credits: Number(e.target.value) || 0 })} />
        <Input label={L('الأستاذ', 'Instructor')} value={d.instructor} onChange={(e) => set({ instructor: e.target.value })} />
        <Input label={L('القاعة', 'Room')} value={d.room} onChange={(e) => set({ room: e.target.value })} />
        <Select label={L('الفصل', 'Semester')} value={d.semester_id ?? ''} onChange={(e) => set({ semester_id: e.target.value || null })}><option value="">—</option>{(semesters ?? []).map((s) => <option key={s.id} value={s.id}>{s.data.name} {s.data.year}</option>)}</Select>
        <div className="sm:col-span-2"><div className="mb-1.5 text-[13px] font-bold text-fg-2">{L('اللون', 'Colour')}</div><div className="flex gap-1.5">{COURSE_COLORS.map((col) => <button key={col} aria-label={col} onClick={() => set({ color: col })} className={clsx('size-7 rounded-full', d.color === col && 'ring-2 ring-fg ring-offset-2 ring-offset-elevated')} style={{ background: col }} />)}</div></div>
      </div>

      <h3 className="mb-2 mt-5 text-[13px] font-bold text-fg-2">{L('الجدول الأسبوعي', 'Weekly schedule')}</h3>
      <div className="space-y-2">
        {d.schedule.map((s, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <select className="field h-9 min-h-0 w-28 py-1" value={s.day} onChange={(e) => setSession(i, { day: Number(e.target.value) })} aria-label={L('اليوم', 'Day')}>{(lang === 'ar' ? DAYS_AR : DAYS_EN).map((n, k) => <option key={k} value={k}>{n}</option>)}</select>
            <input type="time" className="field h-9 min-h-0 w-28 py-1" value={s.start} onChange={(e) => setSession(i, { start: e.target.value })} aria-label={L('من', 'From')} />
            <input type="time" className="field h-9 min-h-0 w-28 py-1" value={s.end} onChange={(e) => setSession(i, { end: e.target.value })} aria-label={L('إلى', 'To')} />
            <select className="field h-9 min-h-0 w-28 py-1" value={s.kind ?? 'lecture'} onChange={(e) => setSession(i, { kind: e.target.value as Session['kind'] })} aria-label={L('النوع', 'Type')}><option value="lecture">{L('محاضرة', 'Lecture')}</option><option value="lab">{L('معمل', 'Lab')}</option><option value="clinical">{L('سريري', 'Clinical')}</option></select>
            <input className="field h-9 min-h-0 w-28 py-1" value={s.room ?? ''} placeholder={L('القاعة', 'Room')} onChange={(e) => setSession(i, { room: e.target.value })} />
            <IconButton size="sm" label={L('حذف', 'Remove')} onClick={() => set({ schedule: d.schedule.filter((_, j) => j !== i) })}><X size={15} /></IconButton>
          </div>
        ))}
        <Button size="sm" icon={<Plus size={14} />} onClick={() => set({ schedule: [...d.schedule, { day: 0, start: '08:00', end: '09:50', kind: 'lecture', room: d.room }] })}>{L('موعد أسبوعي', 'Weekly session')}</Button>
      </div>

      <h3 className="mb-2 mt-5 text-[13px] font-bold text-fg-2">{L('توزيع الدرجات', 'Grade components')} <span className="num font-normal text-fg-3">({d.components.reduce((s, x) => s + x.weight, 0)}%)</span></h3>
      <div className="space-y-2">
        {d.components.map((x, i) => (
          <div key={x.id} className="flex flex-wrap items-center gap-2">
            <input className="field h-9 min-h-0 flex-1 py-1" value={x.name} placeholder={L('الاسم', 'Name')} onChange={(e) => set({ components: d.components.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)) })} />
            <label className="flex items-center gap-1 text-[12px] text-fg-3">{L('الوزن %', 'Weight %')}<input type="number" className="field h-9 min-h-0 w-20 py-1" value={x.weight} onChange={(e) => set({ components: d.components.map((y, j) => (j === i ? { ...y, weight: Number(e.target.value) || 0 } : y)) })} /></label>
            <label className="flex items-center gap-1 text-[12px] text-fg-3">{L('الدرجة', 'Score')}<input type="number" className="field h-9 min-h-0 w-20 py-1" value={x.score ?? ''} onChange={(e) => set({ components: d.components.map((y, j) => (j === i ? { ...y, score: e.target.value === '' ? null : Number(e.target.value) } : y)) })} /></label>
            <label className="flex items-center gap-1 text-[12px] text-fg-3">/<input type="number" className="field h-9 min-h-0 w-20 py-1" value={x.max} onChange={(e) => set({ components: d.components.map((y, j) => (j === i ? { ...y, max: Number(e.target.value) || 100 } : y)) })} /></label>
            <IconButton size="sm" label={L('حذف', 'Remove')} onClick={() => set({ components: d.components.filter((_, j) => j !== i) })}><X size={15} /></IconButton>
          </div>
        ))}
        <Button size="sm" icon={<Plus size={14} />} onClick={() => set({ components: [...d.components, { id: newId('g'), name: '', weight: 0, score: null, max: 100 }] })}>{L('مكوّن', 'Component')}</Button>
      </div>
    </Modal>
  );
}

function CourseView({ c, onBack, onEdit, editing, setEditing }: { c: Course; onBack: () => void; onEdit: () => void; editing: Course | 'new' | null; setEditing: (v: Course | 'new' | null) => void }) {
  const { L, lang } = useI18n();
  const settings = useSettings();
  const nav = useNavigate();
  const lectures = useRecords<LectureData>('lecture');
  const exams = useRecords<{ title: string; course_id: string | null }>('exam');
  const sessions = useRecords<{ course_id: string | null; duration_min: number }>('study_session');
  const ls = (lectures ?? []).filter((l) => l.data.course_id === c.id);
  const g = courseGrade(c.data);
  const studied = (sessions ?? []).filter((s) => s.data.course_id === c.id).reduce((s, x) => s + x.data.duration_min, 0);
  const att = Object.values(c.data.attendance ?? {});
  const present = att.filter((a) => a === 'present' || a === 'late').length;
  const today = todayKey();
  const mark = (v: CourseData['attendance'][string]) => update<CourseData>(c.id, { data: { attendance: { ...(c.data.attendance ?? {}), [today]: v } } });
  const byState = useMemo(() => LECTURE_STATES.map(([s, ar, en, col]) => ({ s, label: L(ar, en), col, n: ls.filter((l) => (l.status ?? 'not_started') === s).length })), [ls, L]);

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-3" icon={lang === 'ar' ? <ArrowRight size={16} /> : <ArrowLeft size={16} />} onClick={onBack}>{L('المقررات', 'Courses')}</Button>
      <PageHeader eyebrow={`${c.data.code} · ${c.data.credits} ${L('ساعات', 'credits')}`} title={c.data.name} subtitle={[c.data.instructor, c.data.room].filter(Boolean).join(' · ')}
        actions={<>
          <Button onClick={onEdit}>{L('تعديل', 'Edit')}</Button>
          <IconButton label={c.data.archived ? L('استعادة', 'Unarchive') : L('أرشفة', 'Archive')} onClick={() => update<CourseData>(c.id, { data: { archived: !c.data.archived } })}><Archive size={17} /></IconButton>
          <IconButton tone="danger" label={L('حذف', 'Delete')} onClick={async () => { const p = await remove(c.id); onBack(); undoToast(L('حُذف المقرر', 'Course deleted'), async () => { if (p) await revertTo(p); }); }}><Trash2 size={17} /></IconButton>
        </>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-4"><Stat label={L('الدرجة حتى الآن', 'Grade so far')} value={g.current === null ? '—' : `${g.current.toFixed(1)}%`} sub={g.current === null ? undefined : `${pointsFor(g.current, settings.study.gradeScale).letter} · ${L('من', 'of')} ${g.graded}% ${L('مُقيّم', 'graded')}`} /></Card>
        <Card className="p-4"><Stat label={L('المحاضرات', 'Lectures')} value={`${ls.filter((l) => l.status === 'mastered' || l.status === 'studied').length}/${ls.length}`} sub={L('مدروسة', 'studied')} /></Card>
        <Card className="p-4"><Stat label={L('وقت المذاكرة', 'Study time')} value={`${Math.round(studied / 60)}${L('س', 'h')}`} /></Card>
        <Card className="p-4"><Stat label={L('الحضور', 'Attendance')} value={att.length ? `${Math.round((present / att.length) * 100)}%` : '—'} sub={`${present}/${att.length}`} /></Card>
      </div>
      <Card className="mb-4 flex flex-wrap items-center gap-2 p-3">
        <span className="text-sm font-bold">{L('حضور اليوم:', "Today's attendance:")}</span>
        {(['present', 'late', 'absent', 'excused'] as const).map((v) => <Chip key={v} active={c.data.attendance?.[today] === v} onClick={() => mark(v)}>{L({ present: 'حاضر', late: 'متأخر', absent: 'غائب', excused: 'بعذر' }[v], { present: 'Present', late: 'Late', absent: 'Absent', excused: 'Excused' }[v])}</Chip>)}
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-2 flex items-center"><h3 className="flex-1 text-[13px] font-bold text-fg-2">{L('المحاضرات', 'Lectures')}</h3><Button size="sm" onClick={() => nav(`/study/lectures?course=${c.id}`)}>{L('إدارة', 'Manage')}</Button></div>
          <div className="mb-3 flex h-2 overflow-hidden rounded-full bg-surface-2">{byState.map((s) => s.n ? <div key={s.s} style={{ width: `${(s.n / Math.max(1, ls.length)) * 100}%`, background: s.col }} title={`${s.label}: ${s.n}`} /> : null)}</div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-fg-2">{byState.map((s) => <span key={s.s} className="inline-flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: s.col }} />{s.label} {s.n}</span>)}</div>
        </Card>
        <Card className="p-4">
          <h3 className="mb-2 text-[13px] font-bold text-fg-2">{L('توزيع الدرجات', 'Grade components')}</h3>
          {!c.data.components.length ? <p className="text-sm text-fg-3">{L('أضف المكونات من التعديل.', 'Add components via Edit.')}</p> : (
            <ul className="space-y-1.5 text-sm">{c.data.components.map((x) => <li key={x.id} className="flex gap-2"><span className="flex-1">{x.name}</span><span className="num text-fg-2">{x.score ?? '—'}/{x.max} · {x.weight}%</span></li>)}</ul>
          )}
          {g.projected !== null && <p className="mt-2 text-[12px] text-fg-3">{L(`التوقع إذا استمر نفس المستوى: ${g.projected.toFixed(1)}%`, `Projection if you keep this level: ${g.projected.toFixed(1)}%`)}</p>}
        </Card>
        <Card className="p-4">
          <h3 className="mb-2 text-[13px] font-bold text-fg-2">{L('الاختبارات', 'Exams')}</h3>
          <ul className="space-y-1 text-sm">{(exams ?? []).filter((e) => e.data.course_id === c.id).map((e) => <li key={e.id}><button className="hover:text-accent" onClick={() => nav(`/study/exams?open=${e.id}`)}>{e.data.title} · {e.date}</button></li>)}</ul>
        </Card>
        <Card className="p-4">
          <h3 className="mb-2 text-[13px] font-bold text-fg-2">{L('الجدول', 'Schedule')}</h3>
          <ul className="space-y-1 text-sm">{c.data.schedule.map((s, i) => <li key={i} className="num">{(lang === 'ar' ? DAYS_AR : DAYS_EN)[s.day]} {s.start}–{s.end} {s.room ? `· ${s.room}` : ''}</li>)}</ul>
        </Card>
      </div>
      {editing && editing !== 'new' && <CourseEditor c={editing} defaultSem={null} onClose={() => setEditing(null)} />}
    </div>
  );
}
