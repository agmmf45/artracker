import { useState } from 'react';
import { Plus, Trash2, Award, Info } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useRecords, useSettings } from '@/core/hooks';
import { create, remove, update } from '@/core/repo';
import { Card, EmptyState, IconButton, Input, PageHeader, Section, Stat } from '@/design/ui';
import { courseGrade, gpa, pointsFor, requiredForTarget, type CourseData, type SemesterData } from './model';

interface PastData { term: string; course: string; credits: number; points: number; letter: string }

/** GPA: current semester (from course components or a final grade), past records, cumulative, and target simulation. */
export default function Grades() {
  const { L } = useI18n();
  const settings = useSettings();
  const scale = settings.study.gradeScale;
  const max = settings.study.gpaScale;
  const courses = useRecords<CourseData>('course');
  const semesters = useRecords<SemesterData>('semester');
  const past = useRecords<PastData>('grade');
  const [target, setTarget] = useState(max === 5 ? 4.5 : max === 4 ? 3.6 : 90);
  const [remaining, setRemaining] = useState(30);
  const [row, setRow] = useState({ term: '', course: '', credits: 3, letter: scale[1]?.letter ?? 'A' });

  const activeSem = (semesters ?? []).find((s) => s.data.active);
  const current = (courses ?? []).filter((c) => !c.data.archived && (!activeSem || c.data.semester_id === activeSem.id)).map((c) => {
    const g = courseGrade(c.data);
    const pct = c.data.final_points != null ? null : g.current;
    const pts = c.data.final_points ?? (pct != null ? pointsFor(pct, scale).points : null);
    return { c, pct, pts, letter: c.data.final_letter ?? (pct != null ? pointsFor(pct, scale).letter : null), projected: g.projected };
  });
  const graded = current.filter((x) => x.pts != null);
  const semGpa = gpa(graded.map((x) => ({ credits: x.c.data.credits, points: x.pts! })));
  const pastRows = (past ?? []).map((p) => ({ credits: p.data.credits, points: p.data.points }));
  const doneCredits = pastRows.reduce((s, r) => s + r.credits, 0) + graded.reduce((s, x) => s + x.c.data.credits, 0);
  const cumulative = gpa([...pastRows, ...graded.map((x) => ({ credits: x.c.data.credits, points: x.pts! }))]);
  const need = requiredForTarget(cumulative, doneCredits, remaining, target);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={L('الدرجات والمعدل', 'Grades & GPA')} subtitle={L(`مقياس ${max} · عدّل جدول الدرجات من الإعدادات › الإنتاجية`, `${max}-point scale · edit the grade table in Settings › Productivity`)} />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Card className="p-4"><Stat label={L('معدل الفصل (متوقع)', 'Semester GPA (projected)')} value={semGpa != null ? semGpa.toFixed(2) : '—'} sub={`${graded.length}/${current.length} ${L('مقرر بدرجات', 'courses graded')}`} /></Card>
        <Card className="p-4"><Stat label={L('المعدل التراكمي', 'Cumulative GPA')} value={cumulative != null ? cumulative.toFixed(2) : '—'} sub={`${doneCredits} ${L('ساعة', 'credits')}`} /></Card>
        <Card className="p-4"><Stat label={L('الدرجة القصوى', 'Scale max')} value={max} /></Card>
      </div>

      <Section title={L('الفصل الحالي', 'Current semester')}>
        {!current.length ? <EmptyState icon={<Award size={26} />} title={L('أضف مقرراتك ومكونات الدرجات', 'Add courses and grade components')} /> : (
          <Card className="divide-y divide-line">
            {current.map(({ c, pct, pts, letter, projected }) => (
              <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1"><div className="truncate font-bold">{c.data.code ? `${c.data.code} · ` : ''}{c.data.name}</div><div className="num text-[12px] text-fg-3">{c.data.credits} {L('ساعات', 'cr')}{pct != null ? ` · ${pct.toFixed(1)}% ${L('حتى الآن', 'so far')}` : ''}{projected != null && pct != null ? ` · ${L('متوقع', 'projected')} ${projected.toFixed(1)}%` : ''}</div></div>
                <span className="num w-14 text-center font-black">{letter ?? '—'}</span>
                <span className="num w-12 text-center text-fg-2">{pts != null ? pts.toFixed(2) : '—'}</span>
                <select className="field h-9 min-h-0 w-28 py-0 text-[13px]" value={c.data.final_letter ?? ''} aria-label={L('الدرجة النهائية', 'Final grade')} onChange={(e) => { const row2 = scale.find((s) => s.letter === e.target.value); void update<CourseData>(c.id, { data: { final_letter: row2?.letter ?? null, final_points: row2?.points ?? null } }); }}>
                  <option value="">{L('نهائي…', 'Final…')}</option>{scale.map((s) => <option key={s.letter} value={s.letter}>{s.letter} ({s.points})</option>)}
                </select>
              </div>
            ))}
          </Card>
        )}
        <p className="mt-2 flex items-start gap-1.5 text-[12px] text-fg-3"><Info size={13} className="mt-0.5 shrink-0" />{L('الافتراض: المكونات غير المقيّمة ستكون بنفس مستواك الحالي. حدد الدرجة النهائية عند صدورها لتحل محل التوقع.', 'Assumption: ungraded components will match your current level. Set the final grade when published to replace the projection.')}</p>
      </Section>

      <Section title={L('محاكاة المعدل المستهدف', 'Target GPA simulation')}>
        <Card className="grid gap-3 p-4 sm:grid-cols-3">
          <Input type="number" step="0.01" label={L('المعدل المستهدف', 'Target GPA')} value={target} onChange={(e) => setTarget(Number(e.target.value) || 0)} />
          <Input type="number" label={L('الساعات المتبقية', 'Remaining credits')} value={remaining} onChange={(e) => setRemaining(Number(e.target.value) || 0)} />
          <div><div className="text-[12px] font-bold text-fg-3">{L('تحتاج متوسط', 'You need an average of')}</div>
            <div className="num text-2xl font-black" style={{ color: need != null && need > max ? 'var(--danger)' : undefined }}>{need == null ? '—' : need.toFixed(2)}</div>
            {need != null && need > max && <div className="text-[12px] text-danger">{L('غير ممكن رياضياً بهذه الساعات', 'Not mathematically reachable with these credits')}</div>}
            {need != null && need <= 0 && <div className="text-[12px] text-success">{L('محقق مهما كانت الدرجات', 'Reached regardless of grades')}</div>}
          </div>
        </Card>
      </Section>

      <Section title={L('فصول سابقة', 'Past semesters')}>
        <Card className="p-4">
          <form className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5" onSubmit={async (e) => { e.preventDefault(); if (!row.course.trim()) return; const s = scale.find((x) => x.letter === row.letter); await create<PastData>('grade', { term: row.term, course: row.course.trim(), credits: row.credits, letter: row.letter, points: s?.points ?? 0 }); setRow({ ...row, course: '' }); }}>
            <Input value={row.term} onChange={(e) => setRow({ ...row, term: e.target.value })} placeholder={L('الفصل', 'Term')} aria-label={L('الفصل', 'Term')} />
            <Input className="sm:col-span-2" value={row.course} onChange={(e) => setRow({ ...row, course: e.target.value })} placeholder={L('المقرر', 'Course')} aria-label={L('المقرر', 'Course')} />
            <Input type="number" value={row.credits} onChange={(e) => setRow({ ...row, credits: Number(e.target.value) || 0 })} aria-label={L('الساعات', 'Credits')} />
            <div className="flex gap-1"><select className="field" value={row.letter} onChange={(e) => setRow({ ...row, letter: e.target.value })} aria-label={L('الدرجة', 'Grade')}>{scale.map((s) => <option key={s.letter}>{s.letter}</option>)}</select><IconButton type="submit" label={L('إضافة', 'Add')}><Plus size={17} /></IconButton></div>
          </form>
          <ul className="divide-y divide-line text-sm">{(past ?? []).map((p) => <li key={p.id} className="flex items-center gap-2 py-1.5"><span className="w-24 text-fg-3">{p.data.term}</span><span className="flex-1">{p.data.course}</span><span className="num">{p.data.credits}</span><span className="num w-10 text-center font-bold">{p.data.letter}</span><IconButton size="sm" tone="danger" label={L('حذف', 'Delete')} onClick={() => remove(p.id)}><Trash2 size={13} /></IconButton></li>)}</ul>
        </Card>
      </Section>
    </div>
  );
}
