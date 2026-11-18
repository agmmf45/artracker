import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { Plus, Presentation, RotateCcw, Trash2, X, FileText, Layers } from 'lucide-react';
import clsx from 'clsx';
import type { Rec } from '@shared/records';
import { useI18n } from '@/core/i18n';
import { useRecords } from '@/core/hooks';
import { create, remove, revertTo, update } from '@/core/repo';
import { todayKey, relativeDay } from '@/core/dates';
import { undoToast, toast } from '@/core/toast';
import { Modal } from '@/design/overlay';
import { Button, Chip, EmptyState, IconButton, Input, Label, PageHeader, Textarea } from '@/design/ui';
import { blankNote, type NoteData } from '@/modules/shared/domain';
import { blankLecture, nextLectureReview, LECTURE_STATES, type Lecture, type LectureData, type LectureState } from './model';
import { CourseSelect, courseLabel, useCourses } from './shared';

export default function Lectures() {
  const { L, lang, locale } = useI18n();
  const nav = useNavigate();
  const lectures = useRecords<LectureData>('lecture');
  const courses = useCourses();
  const [params, setParams] = useSearchParams();
  const [course, setCourse] = useState<string | null>(params.get('course'));
  const [state, setState] = useState<string>('');
  const [editing, setEditing] = useState<Lecture | null>(null);
  const [isNew, setIsNew] = useState(false);
  const today = todayKey();

  useEffect(() => {
    const id = params.get('open');
    if (id && lectures) { const l = lectures.find((x) => x.id === id); if (l) { setIsNew(false); setEditing(l as Lecture); } params.delete('open'); setParams(params, { replace: true }); }
  }, [params, lectures, setParams]);

  const list = useMemo(() => (lectures ?? []).filter((l) => (!course || l.data.course_id === course) && (!state || (state === 'due' ? !!l.data.next_review && l.data.next_review <= today : (l.status ?? 'not_started') === state))), [lectures, course, state, today]) as Lecture[];
  const groups = useMemo(() => {
    const m = new Map<string, Lecture[]>();
    for (const l of list) { const k = `${l.data.course_id ?? ''}|${l.data.chapter || ''}`; if (!m.has(k)) m.set(k, []); m.get(k)!.push(l); }
    return [...m.entries()].map(([k, ls]) => ({ k, course: courses.find((c) => c.id === k.split('|')[0]), chapter: k.split('|')[1], ls: ls.sort((a, b) => (a.data.number ?? 999) - (b.data.number ?? 999)) }));
  }, [list, courses]);

  const setLState = async (l: Lecture, s: LectureState) => update<LectureData>(l.id, { status: s, data: s === 'mastered' ? { next_review: null } : {} });
  const revised = async (l: Lecture) => {
    const revisions = [...l.data.revisions, today];
    await update<LectureData>(l.id, { data: { revisions, next_review: nextLectureReview(revisions) }, status: l.status === 'not_started' ? 'studied' : l.status });
    toast(L(`المراجعة القادمة ${relativeDay(nextLectureReview(revisions), lang, locale)}`, `Next review ${relativeDay(nextLectureReview(revisions), lang, locale)}`));
  };
  const dueCount = (lectures ?? []).filter((l) => l.data.next_review && l.data.next_review <= today && l.status !== 'mastered').length;

  return (
    <div>
      <PageHeader title={L('المحاضرات', 'Lectures')} actions={<Button variant="primary" icon={<Plus size={17} />} onClick={() => { setIsNew(true); setEditing({ data: blankLecture({ course_id: course }) } as Lecture); }}>{L('محاضرة', 'Lecture')}</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <CourseSelect value={course} onChange={setCourse} all className="w-56" />
        <div className="flex flex-wrap gap-1.5">
          <Chip active={!state} onClick={() => setState('')}>{L('الكل', 'All')}</Chip>
          <Chip active={state === 'due'} onClick={() => setState('due')}><RotateCcw size={12} />{L('مراجعة اليوم', 'Due for review')} {dueCount ? <span className="num">{dueCount}</span> : null}</Chip>
          {LECTURE_STATES.map(([s, ar, en]) => <Chip key={s} active={state === s} onClick={() => setState(s)}>{L(ar, en)}</Chip>)}
        </div>
      </div>
      {!list.length ? <EmptyState icon={<Presentation size={30} />} title={L('لا محاضرات هنا', 'No lectures here')} hint={L('أضف محاضرات المقرر وتابع حالتها من "لم تبدأ" حتى "متقنة".', 'Add lectures and move them from Not started to Mastered.')} /> : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.k}>
              <h2 className="mb-1.5 text-[13px] font-bold text-fg-2">{courseLabel(g.course) || L('بدون مقرر', 'No course')}{g.chapter ? ` · ${g.chapter}` : ''}</h2>
              <div className="card divide-y divide-line">
                {g.ls.map((l) => {
                  const st = LECTURE_STATES.find((x) => x[0] === (l.status ?? 'not_started'))!;
                  const due = l.data.next_review && l.data.next_review <= today && l.status !== 'mastered';
                  return (
                    <div key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <button className="min-w-0 flex-1 text-start" onClick={() => { setIsNew(false); setEditing(l); }}>
                        <div className="truncate font-bold">{l.data.number ? `${l.data.number}. ` : ''}{l.data.title}</div>
                        <div className="flex flex-wrap gap-x-2 text-[12px] text-fg-3">
                          {l.data.understanding && <span>{L('الفهم', 'Understanding')} {l.data.understanding}/5</span>}
                          {l.data.revisions.length > 0 && <span>{l.data.revisions.length} {L('مراجعة', 'reviews')}</span>}
                          {l.data.next_review && l.status !== 'mastered' && <span className={due ? 'font-bold text-danger' : ''}>{L('المراجعة', 'Review')} {relativeDay(l.data.next_review, lang, locale)}</span>}
                        </div>
                      </button>
                      <select value={l.status ?? 'not_started'} onChange={(e) => setLState(l, e.target.value as LectureState)} className="field h-8 min-h-0 w-auto py-0 text-[12px] font-bold" style={{ color: st[3] }} aria-label={L('الحالة', 'State')}>
                        {LECTURE_STATES.map(([s, ar, en]) => <option key={s} value={s}>{L(ar, en)}</option>)}
                      </select>
                      <Button size="sm" variant={due ? 'primary' : 'ghost'} icon={<RotateCcw size={14} />} onClick={() => revised(l)}>{L('راجعتها', 'Reviewed')}</Button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
      {editing && <LectureEditor l={editing} isNew={isNew} onClose={() => setEditing(null)} onOpenNote={(id) => nav(`/life/notes?open=${id}`)} />}
    </div>
  );
}

function LectureEditor({ l, isNew, onClose, onOpenNote }: { l: Lecture; isNew: boolean; onClose: () => void; onOpenNote: (id: string) => void }) {
  const { L } = useI18n();
  const nav = useNavigate();
  const [d, setD] = useState<LectureData>({ ...blankLecture(), ...l.data });
  const [topic, setTopic] = useState('');
  const [res, setRes] = useState({ title: '', url: '' });
  const set = (p: Partial<LectureData>) => setD((x) => ({ ...x, ...p }));
  const save = async () => {
    if (!d.title.trim()) { toast(L('عنوان المحاضرة مطلوب', 'Title required'), { tone: 'error' }); return; }
    if (isNew) await create<LectureData>('lecture', d, { parent_id: d.course_id, status: 'not_started' });
    else await update<LectureData>(l.id, { data: d, parent_id: d.course_id });
    onClose();
  };
  const openNote = async () => {
    if (d.note_id) { onOpenNote(d.note_id); return; }
    if (isNew) { toast(L('احفظ المحاضرة أولاً', 'Save the lecture first')); return; }
    const n = await create<NoteData>('note', blankNote({ title: d.title, note_type: 'lecture', course_id: d.course_id, lecture_id: l.id, body: `## ${L('الأهداف', 'Objectives')}\n${d.objectives}\n\n## ${L('الملاحظات', 'Notes')}\n` }));
    await update<LectureData>(l.id, { data: { note_id: n.id } });
    onOpenNote(n.id);
  };
  return (
    <Modal panel open onOpenChange={(v) => !v && onClose()} title={isNew ? L('محاضرة جديدة', 'New lecture') : L('المحاضرة', 'Lecture')} wide
      footer={<>
        {!isNew && <IconButton className="me-auto" tone="danger" label={L('حذف', 'Delete')} onClick={async () => { const p = await remove(l.id); onClose(); undoToast(L('حُذفت', 'Deleted'), async () => { if (p) await revertTo(p as Rec); }); }}><Trash2 size={17} /></IconButton>}
        <Button variant="ghost" onClick={onClose}>{L('إلغاء', 'Cancel')}</Button><Button variant="primary" onClick={save}>{L('حفظ', 'Save')}</Button>
      </>}>
      <div className="grid gap-3 sm:grid-cols-4">
        <Input className="sm:col-span-3" label={L('العنوان', 'Title')} value={d.title} onChange={(e) => set({ title: e.target.value })} autoFocus={isNew} />
        <Input type="number" label={L('الرقم', 'No.')} value={d.number ?? ''} onChange={(e) => set({ number: e.target.value ? Number(e.target.value) : null })} />
        <CourseSelect className="sm:col-span-2" label={L('المقرر', 'Course')} value={d.course_id} onChange={(v) => set({ course_id: v })} />
        <Input className="sm:col-span-2" label={L('الفصل / الوحدة', 'Chapter / unit')} value={d.chapter} onChange={(e) => set({ chapter: e.target.value })} />
        <div className="sm:col-span-4">
          <Label>{L('مستوى الفهم', 'Understanding level')}</Label>
          <div className="flex gap-1.5">{[1, 2, 3, 4, 5].map((n) => <button key={n} aria-pressed={d.understanding === n} onClick={() => set({ understanding: d.understanding === n ? null : n })} className={clsx('num size-9 rounded-full font-black', (d.understanding ?? 0) >= n ? 'bg-study text-on-accent' : 'bg-surface-2 text-fg-3')}>{n}</button>)}</div>
        </div>
        <Textarea className="sm:col-span-4" label={L('أهداف التعلّم', 'Learning objectives')} value={d.objectives} onChange={(e) => set({ objectives: e.target.value })} />
        <Textarea className="sm:col-span-4" label={L('الخلاصة', 'Summary')} value={d.summary} onChange={(e) => set({ summary: e.target.value })} />
        <div className="sm:col-span-4">
          <Label>{L('مواضيع مهمة', 'Important topics')}</Label>
          <div className="flex flex-wrap items-center gap-1.5">
            {d.topics.map((t) => <Chip key={t} onClick={() => set({ topics: d.topics.filter((x) => x !== t) })}>{t} <X size={11} /></Chip>)}
            <input className="field h-8 min-h-0 w-44 py-1 text-[13px]" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="+ Enter" onKeyDown={(e) => { if (e.key === 'Enter' && topic.trim()) { e.preventDefault(); set({ topics: [...d.topics, topic.trim()] }); setTopic(''); } }} />
          </div>
        </div>
        <div className="sm:col-span-4">
          <Label>{L('ملفات وروابط (PDF، شرائح، فيديو)', 'Files & links (PDF, slides, video)')}</Label>
          <ul className="mb-2 space-y-1 text-sm">{d.resources.map((r, i) => <li key={i} className="flex gap-2"><a className="flex-1 truncate text-accent hover:underline" href={r.url} target="_blank" rel="noopener noreferrer">{r.title || r.url}</a><button aria-label={L('حذف', 'Remove')} onClick={() => set({ resources: d.resources.filter((_, j) => j !== i) })}><X size={13} /></button></li>)}</ul>
          <div className="flex gap-1.5"><input className="field h-9 min-h-0 py-1" placeholder={L('العنوان', 'Title')} value={res.title} onChange={(e) => setRes({ ...res, title: e.target.value })} /><input className="field h-9 min-h-0 py-1" dir="ltr" placeholder="https://" value={res.url} onChange={(e) => setRes({ ...res, url: e.target.value })} />
            <IconButton label={L('إضافة', 'Add')} onClick={() => { if (!/^https?:\/\//.test(res.url)) { toast(L('رابط https مطلوب', 'https link required'), { tone: 'error' }); return; } set({ resources: [...d.resources, res] }); setRes({ title: '', url: '' }); }}><Plus size={17} /></IconButton></div>
        </div>
        {d.revisions.length > 0 && <p className="text-[12px] text-fg-3 sm:col-span-4">{L('سجل المراجعة:', 'Review history:')} {d.revisions.join('، ')}</p>}
        <div className="flex flex-wrap gap-2 sm:col-span-4">
          <Button icon={<FileText size={15} />} onClick={openNote}>{d.note_id ? L('افتح ملاحظات المحاضرة', 'Open lecture notes') : L('ابدأ ملاحظات المحاضرة', 'Start lecture notes')}</Button>
          {!isNew && <Button icon={<Layers size={15} />} onClick={() => nav(`/study/flashcards?lecture=${l.id}`)}>{L('بطاقات المحاضرة', 'Lecture flashcards')}</Button>}
          {!isNew && <Button icon={<Layers size={15} />} onClick={() => nav(`/study/qbank?lecture=${l.id}`)}>{L('أسئلة المحاضرة', 'Lecture questions')}</Button>}
        </div>
      </div>
    </Modal>
  );
}
