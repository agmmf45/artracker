import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Plus, CircleHelp, Play, Star, Timer, Trash2, Check, X } from 'lucide-react';
import clsx from 'clsx';
import type { Rec } from '@shared/records';
import { useI18n } from '@/core/i18n';
import { useNow, useRecords } from '@/core/hooks';
import { create, remove, update } from '@/core/repo';
import { todayKey } from '@/core/dates';
import { toast } from '@/core/toast';
import { Modal } from '@/design/overlay';
import { Bar, Button, Card, Chip, EmptyState, IconButton, Input, PageHeader, Segmented, Select, Stat, Textarea } from '@/design/ui';
import { Markdown } from '@/modules/shared/markdown';
import { CourseSelect, courseLabel, useCourses } from './shared';
import type { LectureData } from './model';

interface QData { course_id: string | null; lecture_id: string | null; type: 'mcq' | 'tf' | 'short'; stem: string; options: string[]; answer: string; explanation: string; reference: string; image_url: string | null; favorite: boolean }
interface AttemptData { question_id: string; correct: boolean; chosen: string; seconds: number; session: string }
type Q = Rec<QData>;

export default function QBank() {
  const { L } = useI18n();
  const questions = useRecords<QData>('question');
  const attempts = useRecords<AttemptData>('question_attempt');
  const courses = useCourses();
  const [params] = useSearchParams();
  const [course, setCourse] = useState<string | null>(null);
  const [editing, setEditing] = useState<Q | 'new' | null>(null);
  const [practice, setPractice] = useState<{ qs: Q[]; timed: number | null } | null>(null);
  const [setup, setSetup] = useState(false);
  const lecture = params.get('lecture');

  const list = (questions ?? []).filter((q) => (!course || q.data.course_id === course) && (!lecture || q.data.lecture_id === lecture)) as Q[];
  const stats = useMemo(() => {
    const last = new Map<string, boolean>();
    for (const a of [...(attempts ?? [])].sort((x, y) => x.created_at.localeCompare(y.created_at))) last.set(a.data.question_id, a.data.correct);
    const all = attempts ?? [];
    const byCourse = new Map<string, { c: number; t: number }>();
    for (const a of all) {
      const q = questions?.find((x) => x.id === a.data.question_id);
      const k = q?.data.course_id ?? '';
      const v = byCourse.get(k) ?? { c: 0, t: 0 };
      v.t++; if (a.data.correct) v.c++;
      byCourse.set(k, v);
    }
    return { last, total: all.length, correct: all.filter((a) => a.data.correct).length, byCourse };
  }, [attempts, questions]);
  const wrong = list.filter((q) => stats.last.get(q.id) === false);

  if (practice) return <Practice qs={practice.qs} timedMin={practice.timed} onDone={() => setPractice(null)} />;

  return (
    <div>
      <PageHeader title={L('بنك الأسئلة', 'Question bank')} actions={<><Button icon={<Plus size={16} />} onClick={() => setEditing('new')}>{L('سؤال', 'Question')}</Button><Button variant="primary" icon={<Play size={16} />} disabled={!list.length} onClick={() => setSetup(true)}>{L('تدرّب', 'Practice')}</Button></>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-4"><Stat label={L('الأسئلة', 'Questions')} value={list.length} /></Card>
        <Card className="p-4"><Stat label={L('محاولات', 'Attempts')} value={stats.total} /></Card>
        <Card className="p-4"><Stat label={L('الدقة', 'Accuracy')} value={stats.total ? `${Math.round((stats.correct / stats.total) * 100)}%` : '—'} /></Card>
        <Card className="p-4"><Stat label={L('أخطاء للمراجعة', 'To re-review')} value={wrong.length} tone={wrong.length ? 'var(--danger)' : undefined} /></Card>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <CourseSelect value={course} onChange={setCourse} all className="w-56" />
        {wrong.length > 0 && <Button size="sm" onClick={() => setPractice({ qs: wrong, timed: null })}>{L('راجع أخطائي', 'Review my mistakes')}</Button>}
        {list.some((q) => q.data.favorite) && <Button size="sm" variant="ghost" icon={<Star size={14} />} onClick={() => setPractice({ qs: list.filter((q) => q.data.favorite), timed: null })}>{L('المفضلة', 'Favorites')}</Button>}
      </div>
      {stats.byCourse.size > 0 && (
        <Card className="mb-4 p-4">
          <div className="mb-2 text-[13px] font-bold text-fg-2">{L('الأداء حسب المقرر', 'Performance by course')}</div>
          <ul className="space-y-2">{[...stats.byCourse.entries()].map(([cid, v]) => (
            <li key={cid}><div className="mb-1 flex text-sm"><span className="flex-1">{courseLabel(courses.find((c) => c.id === cid)) || L('عام', 'General')}</span><span className="num text-fg-2">{Math.round((v.c / v.t) * 100)}% · {v.t}</span></div><Bar value={v.c} max={v.t} color="var(--study)" /></li>
          ))}</ul>
        </Card>
      )}
      {!list.length ? <EmptyState icon={<CircleHelp size={30} />} title={L('ابنِ بنك أسئلتك', 'Build your question bank')} hint={L('اختيار من متعدد، صح/خطأ، أو إجابة قصيرة — مع الشرح والمرجع.', 'MCQ, true/false or short answer — with explanation and reference.')} /> : (
        <Card className="divide-y divide-line">
          {list.map((q) => (
            <button key={q.id} onClick={() => setEditing(q)} className="flex w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-surface-2">
              <span className={clsx('size-2 shrink-0 rounded-full', stats.last.get(q.id) === true ? 'bg-success' : stats.last.get(q.id) === false ? 'bg-danger' : 'bg-line-strong')} />
              <span className="min-w-0 flex-1 truncate text-sm">{q.data.stem}</span>
              {q.data.favorite && <Star size={13} className="text-reward" fill="currentColor" />}
              <span className="text-[11px] uppercase text-fg-3">{q.data.type}</span>
            </button>
          ))}
        </Card>
      )}
      {editing && <QEditor q={editing === 'new' ? null : editing} defaultCourse={course} defaultLecture={lecture} onClose={() => setEditing(null)} />}
      {setup && <PracticeSetup total={list.length} onClose={() => setSetup(false)} onStart={(n, timed, shuffle) => { const qs = shuffle ? [...list].sort(() => Math.random() - 0.5) : list; setPractice({ qs: qs.slice(0, n), timed }); setSetup(false); }} />}
    </div>
  );
}

function PracticeSetup({ total, onClose, onStart }: { total: number; onClose: () => void; onStart: (n: number, timed: number | null, shuffle: boolean) => void }) {
  const { L } = useI18n();
  const [n, setN] = useState(Math.min(20, total));
  const [timed, setTimed] = useState<'no' | 'yes'>('no');
  const [mins, setMins] = useState(Math.max(5, Math.round(Math.min(20, total) * 1.2)));
  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title={L('جلسة تدريب', 'Practice session')} footer={<Button variant="primary" onClick={() => onStart(n, timed === 'yes' ? mins : null, true)}>{L('ابدأ', 'Start')}</Button>}>
      <div className="space-y-3">
        <Input type="number" min={1} max={total} label={L(`عدد الأسئلة (من ${total})`, `Number of questions (of ${total})`)} value={n} onChange={(e) => setN(Math.max(1, Math.min(total, Number(e.target.value) || 1)))} />
        <Segmented value={timed} onChange={setTimed} options={[{ value: 'no', label: L('بدون وقت', 'Untimed') }, { value: 'yes', label: L('اختبار موقوت', 'Timed exam'), icon: <Timer size={14} /> }]} />
        {timed === 'yes' && <Input type="number" min={1} label={L('المدة (دقائق)', 'Duration (minutes)')} value={mins} onChange={(e) => setMins(Number(e.target.value) || 10)} />}
      </div>
    </Modal>
  );
}

function QEditor({ q, defaultCourse, defaultLecture, onClose }: { q: Q | null; defaultCourse: string | null; defaultLecture: string | null; onClose: () => void }) {
  const { L } = useI18n();
  const lectures = useRecords<LectureData>('lecture');
  const [d, setD] = useState<QData>(q?.data ?? { course_id: defaultCourse, lecture_id: defaultLecture, type: 'mcq', stem: '', options: ['', '', '', ''], answer: '', explanation: '', reference: '', image_url: null, favorite: false });
  const set = (p: Partial<QData>) => setD((x) => ({ ...x, ...p }));
  const save = async () => {
    if (!d.stem.trim() || !d.answer.trim()) { toast(L('السؤال والإجابة الصحيحة مطلوبة', 'Question and correct answer are required'), { tone: 'error' }); return; }
    const data = { ...d, options: d.type === 'mcq' ? d.options.filter((o) => o.trim()) : d.type === 'tf' ? ['صح', 'خطأ'] : [] };
    if (data.type === 'mcq' && !data.options.includes(data.answer)) { toast(L('الإجابة الصحيحة يجب أن تكون أحد الخيارات', 'The correct answer must be one of the options'), { tone: 'error' }); return; }
    if (q) await update<QData>(q.id, { data }); else await create<QData>('question', data, { parent_id: data.course_id });
    onClose();
  };
  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title={q ? L('تعديل السؤال', 'Edit question') : L('سؤال جديد', 'New question')} wide
      footer={<>{q && <IconButton className="me-auto" tone="danger" label={L('حذف', 'Delete')} onClick={async () => { await remove(q.id); onClose(); }}><Trash2 size={17} /></IconButton>}<Button variant="ghost" onClick={onClose}>{L('إلغاء', 'Cancel')}</Button><Button variant="primary" onClick={save}>{L('حفظ', 'Save')}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Segmented className="sm:col-span-2" value={d.type} onChange={(v) => set({ type: v, answer: '' })} options={[{ value: 'mcq', label: L('اختيار متعدد', 'MCQ') }, { value: 'tf', label: L('صح/خطأ', 'True/False') }, { value: 'short', label: L('إجابة قصيرة', 'Short answer') }]} />
        <CourseSelect label={L('المقرر', 'Course')} value={d.course_id} onChange={(v) => set({ course_id: v })} />
        <Select label={L('المحاضرة', 'Lecture')} value={d.lecture_id ?? ''} onChange={(e) => set({ lecture_id: e.target.value || null })}><option value="">—</option>{(lectures ?? []).filter((l) => !d.course_id || l.data.course_id === d.course_id).map((l) => <option key={l.id} value={l.id}>{l.data.title}</option>)}</Select>
        <Textarea className="sm:col-span-2" label={L('السؤال', 'Question')} value={d.stem} onChange={(e) => set({ stem: e.target.value })} />
        <Input className="sm:col-span-2" type="url" dir="ltr" label={L('صورة (رابط، اختياري)', 'Image URL (optional)')} value={d.image_url ?? ''} onChange={(e) => set({ image_url: e.target.value || null })} />
        {d.type === 'mcq' && d.options.map((o, i) => (
          <div key={i} className="flex items-center gap-2 sm:col-span-2">
            <input type="radio" name="ans" checked={!!o && d.answer === o} onChange={() => set({ answer: o })} className="size-4 accent-[var(--success)]" aria-label={L('الإجابة الصحيحة', 'Correct answer')} />
            <input className="field" value={o} onChange={(e) => { const opts = [...d.options]; const was = d.answer === o; opts[i] = e.target.value; set({ options: opts, ...(was ? { answer: e.target.value } : {}) }); }} placeholder={`${L('خيار', 'Option')} ${i + 1}`} />
          </div>
        ))}
        {d.type === 'mcq' && d.options.length < 6 && <Button size="sm" className="w-fit" onClick={() => set({ options: [...d.options, ''] })}>+ {L('خيار', 'Option')}</Button>}
        {d.type === 'tf' && <Segmented className="sm:col-span-2" value={d.answer || 'x'} onChange={(v) => set({ answer: v })} options={[{ value: 'صح', label: L('صح', 'True') }, { value: 'خطأ', label: L('خطأ', 'False') }]} />}
        {d.type === 'short' && <Input className="sm:col-span-2" label={L('الإجابة النموذجية', 'Model answer')} value={d.answer} onChange={(e) => set({ answer: e.target.value })} />}
        <Textarea className="sm:col-span-2" label={L('الشرح', 'Explanation')} value={d.explanation} onChange={(e) => set({ explanation: e.target.value })} />
        <Input className="sm:col-span-2" label={L('المرجع', 'Reference')} value={d.reference} onChange={(e) => set({ reference: e.target.value })} />
      </div>
    </Modal>
  );
}

function Practice({ qs, timedMin, onDone }: { qs: Q[]; timedMin: number | null; onDone: () => void }) {
  const { L } = useI18n();
  const now = useNow(1000);
  const [session] = useState(() => `s${Date.now()}`);
  const [startedAt] = useState(() => Date.now());
  const [i, setI] = useState(0);
  const [chosen, setChosen] = useState<string>('');
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [qStart, setQStart] = useState(Date.now());
  const remaining = timedMin ? timedMin * 60 - Math.floor((now.getTime() - startedAt) / 1000) : null;
  const finished = i >= qs.length || (remaining !== null && remaining <= 0);
  useEffect(() => { if (remaining !== null && remaining <= 0 && i < qs.length) toast(L('انتهى الوقت', "Time's up")); }, [remaining !== null && remaining <= 0]); // eslint-disable-line react-hooks/exhaustive-deps

  if (finished) {
    const c = results.filter(Boolean).length;
    return (
      <div className="grid min-h-[50vh] place-items-center text-center">
        <div><p className="text-xl font-black">{L('النتيجة', 'Result')}</p><p className="num mt-2 text-4xl font-black text-study">{c}/{results.length}</p><p className="mt-1 text-fg-2">{results.length ? Math.round((c / results.length) * 100) : 0}%</p><Button className="mt-5" variant="primary" onClick={onDone}>{L('رجوع', 'Back')}</Button></div>
      </div>
    );
  }
  const q = qs[i];
  const submit = async (value = chosen) => {
    const correct = q.data.type === 'short' ? value.trim().toLowerCase() === q.data.answer.trim().toLowerCase() : value === q.data.answer;
    await create<AttemptData>('question_attempt', { question_id: q.id, correct, chosen: value, seconds: Math.round((Date.now() - qStart) / 1000), session }, { date: todayKey(), parent_id: q.id });
    setResults([...results, correct]);
    if (timedMin) { next(); } else setRevealed(true);
  };
  const next = () => { setI(i + 1); setChosen(''); setRevealed(false); setQStart(Date.now()); };
  const opts = q.data.type === 'tf' ? ['صح', 'خطأ'] : q.data.options;
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3 flex items-center gap-2 text-sm text-fg-2">
        <span className="num flex-1">{i + 1} / {qs.length}</span>
        {remaining !== null && <span className={clsx('num font-bold', remaining < 60 && 'text-danger')}><Timer size={14} className="inline" /> {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</span>}
        <IconButton size="sm" label={L('مفضلة', 'Favorite')} onClick={() => update<QData>(q.id, { data: { favorite: !q.data.favorite } })}><Star size={16} className={q.data.favorite ? 'text-reward' : ''} fill={q.data.favorite ? 'currentColor' : 'none'} /></IconButton>
        <Button size="sm" variant="ghost" onClick={onDone}>{L('إنهاء', 'End')}</Button>
      </div>
      <Bar value={i} max={qs.length} className="mb-4" color="var(--study)" />
      <Card className="p-6">
        <div className="text-lg font-bold"><Markdown text={q.data.stem} /></div>
        {q.data.image_url && <img src={q.data.image_url} alt="" className="mt-3 max-h-64 rounded-md" referrerPolicy="no-referrer" />}
        <div className="mt-5 space-y-2">
          {q.data.type === 'short' ? (
            <form onSubmit={(e) => { e.preventDefault(); if (!revealed) void submit(); }}><Input value={chosen} onChange={(e) => setChosen(e.target.value)} disabled={revealed} placeholder={L('إجابتك', 'Your answer')} autoFocus /></form>
          ) : opts.map((o) => {
            const isAns = o === q.data.answer;
            return (
              <button key={o} disabled={revealed} onClick={() => { setChosen(o); if (timedMin) void submit(o); }}
                className={clsx('flex w-full items-center gap-3 rounded-md border px-4 py-3 text-start transition-colors', revealed && isAns ? 'border-success bg-[color-mix(in_oklab,var(--success)_12%,transparent)]' : revealed && o === chosen ? 'border-danger bg-[color-mix(in_oklab,var(--danger)_10%,transparent)]' : chosen === o ? 'border-accent' : 'border-line hover:bg-surface-2')}>
                <span className="flex-1">{o}</span>{revealed && isAns && <Check size={17} className="text-success" />}{revealed && !isAns && o === chosen && <X size={17} className="text-danger" />}
              </button>
            );
          })}
        </div>
        {revealed && (q.data.explanation || q.data.type === 'short') && (
          <div className="anim-in mt-5 rounded-md bg-surface-2 p-4 text-sm">
            {q.data.type === 'short' && <p className="mb-1"><b>{L('الإجابة:', 'Answer:')}</b> {q.data.answer}</p>}
            {q.data.explanation && <Markdown text={q.data.explanation} />}
            {q.data.reference && <p className="mt-2 text-[12px] text-fg-3">{L('المرجع:', 'Reference:')} {q.data.reference}</p>}
          </div>
        )}
      </Card>
      {!timedMin && <div className="mt-4">{!revealed ? <Button variant="primary" size="lg" className="w-full" disabled={!chosen} onClick={() => submit()}>{L('تحقق', 'Check')}</Button> : <Button variant="primary" size="lg" className="w-full" onClick={next}>{L('التالي', 'Next')}</Button>}</div>}
      <span className="hidden"><Chip>{''}</Chip></span>
    </div>
  );
}
