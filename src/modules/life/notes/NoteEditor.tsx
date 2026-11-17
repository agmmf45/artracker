import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bold, Italic, Heading1, Heading2, List, ListChecks, Table, Code, Quote, Sigma, Link2, Minus, Image, Maximize2, Minimize2, History, Download, Pin, Star, Trash2, ChevronDown, ListTodo, Eye, PenLine, Columns2 } from 'lucide-react';
import clsx from 'clsx';
import type { Rec } from '@shared/records';
import { useI18n } from '@/core/i18n';
import { useRecords, useSettings } from '@/core/hooks';
import { update, remove, revertTo, create } from '@/core/repo';
import { undoToast, toast } from '@/core/toast';
import { download } from '@/core/portability';
import { Modal } from '@/design/overlay';
import { Button, IconButton, Segmented, Select, Chip } from '@/design/ui';
import { Markdown, extractLinks, type MdContext } from '@/modules/shared/markdown';
import { blankNote, type Note, type NoteData } from '@/modules/shared/domain';
import { createTask, toggleTask, type TaskData } from '../tasks/model';

export const NOTE_TYPES: Array<[NoteData['note_type'], string, string]> = [
  ['quick', 'سريعة', 'Quick'], ['personal', 'شخصية', 'Personal'], ['academic', 'أكاديمية', 'Academic'], ['lecture', 'محاضرة', 'Lecture'],
  ['research', 'بحث', 'Research'], ['meeting', 'اجتماع', 'Meeting'], ['project', 'مشروع', 'Project'], ['book', 'كتاب', 'Book'],
  ['idea', 'فكرة', 'Idea'], ['tutorial', 'شرح', 'Tutorial'], ['reference', 'مرجع', 'Reference'],
];

export const TEMPLATES: Record<string, [string, string, string]> = {
  lecture: ['محاضرة', 'Lecture', '## الأهداف\n- \n\n## النقاط الرئيسية\n- \n\n## أسئلة للمراجعة\n- [ ] \n\n> [!tip] الخلاصة\n> '],
  meeting: ['اجتماع', 'Meeting', '**التاريخ:** \n**الحضور:** \n\n## النقاط\n- \n\n## القرارات\n- \n\n## المهام\n- [ ] '],
  book: ['كتاب', 'Book', '**المؤلف:** \n**التقييم:** /5\n\n## الفكرة الرئيسية\n\n## اقتباسات\n> \n\n## ماذا سأطبق\n- [ ] '],
  research: ['بحث', 'Research', '## سؤال البحث\n\n## الفرضية\n\n## المراجع\n- DOI: \n\n## ملاحظات\n'],
  project: ['مشروع', 'Project', '## الهدف\n\n## النطاق\n- \n\n## المراحل\n1. \n\n## المخاطر\n- '],
  daily: ['يومي', 'Daily', '## أهم 3\n- [ ] \n- [ ] \n- [ ] \n\n## ملاحظات\n'],
};

const DRAFT_KEY = (id: string) => `dq_draft_${id}`;

export function NoteEditor({ note, onOpenNote, onClose }: { note: Note; onOpenNote: (id: string) => void; onClose?: () => void }) {
  const { L } = useI18n();
  const settings = useSettings();
  const notes = useRecords<NoteData>('note');
  const folders = useRecords<{ name: string }>('folder');
  const tasks = useRecords<TaskData>('task');
  const courses = useRecords<{ name: string }>('course');
  const projects = useRecords<{ title: string }>('project');
  const [title, setTitle] = useState(note.data.title);
  const [body, setBody] = useState(note.data.body);
  const [mode, setMode] = useState<'edit' | 'preview' | 'split'>(note.data.body ? 'preview' : 'edit');
  const [zen, setZen] = useState(false);
  const [saved, setSaved] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const [external, setExternal] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [meta, setMeta] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const ta = useRef<HTMLTextAreaElement>(null);
  const base = useRef(note.updated_at);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSnap = useRef<number>(Date.parse(note.data.versions?.at(-1)?.at ?? '0'));

  // switching notes / draft recovery
  useEffect(() => {
    setTitle(note.data.title); setBody(note.data.body); base.current = note.updated_at; setSaved('saved'); setExternal(false);
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY(note.id)) ?? 'null') as { title: string; body: string; at: string } | null;
      if (draft && draft.at > note.updated_at && (draft.body !== note.data.body || draft.title !== note.data.title)) {
        toast(L('وجدنا مسودة غير محفوظة', 'Found unsaved changes'), { action: { label: L('استعادة', 'Restore'), run: () => { setTitle(draft.title); setBody(draft.body); setSaved('dirty'); setMode('edit'); } }, ttl: 10000 });
      }
    } catch { /* ignore */ }
  }, [note.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // someone else (another device) changed this note while we have unsaved edits
  useEffect(() => {
    if (note.updated_at !== base.current) {
      if (saved === 'saved') { setTitle(note.data.title); setBody(note.data.body); base.current = note.updated_at; }
      else setExternal(true);
    }
  }, [note.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps

  const persist = useCallback(async (t: string, b: string) => {
    setSaved('saving');
    const now = Date.now();
    const versions = [...(note.data.versions ?? [])];
    if (now - lastSnap.current > 10 * 60_000 && (note.data.body || note.data.title)) {
      versions.push({ at: new Date().toISOString(), title: note.data.title, body: note.data.body });
      lastSnap.current = now;
    }
    // keep history bounded (and the record under the size limit)
    while (versions.length > 20 || JSON.stringify(versions).length > 120_000) versions.shift();
    await update<NoteData>(note.id, { data: { title: t, body: b, versions } });
    const fresh = await import('@/core/db').then(({ db }) => db().records.get(note.id));
    base.current = fresh?.updated_at ?? base.current;
    localStorage.removeItem(DRAFT_KEY(note.id));
    setSaved('saved');
  }, [note]);

  const change = (t: string, b: string) => {
    setTitle(t); setBody(b); setSaved('dirty');
    try { localStorage.setItem(DRAFT_KEY(note.id), JSON.stringify({ title: t, body: b, at: new Date().toISOString() })); } catch { /* quota */ }
    if (timer.current) clearTimeout(timer.current);
    if (!external) timer.current = setTimeout(() => void persist(t, b), 900);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const insert = (before: string, after = '', placeholder = '') => {
    const el = ta.current;
    if (!el) { change(title, `${body}${before}${placeholder}${after}`); return; }
    const s = el.selectionStart; const e = el.selectionEnd;
    const sel = body.slice(s, e) || placeholder;
    const next = body.slice(0, s) + before + sel + after + body.slice(e);
    change(title, next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + before.length, s + before.length + sel.length); });
  };

  const linePrefix = (prefix: string) => {
    const el = ta.current; if (!el) return;
    const s = body.lastIndexOf('\n', el.selectionStart - 1) + 1;
    change(title, body.slice(0, s) + prefix + body.slice(s));
    requestAnimationFrame(() => el.focus());
  };

  /** "- [ ] text" lines in the selection become real tasks referenced as {{task:id}} (single source of truth). */
  const checklistToTasks = async () => {
    const el = ta.current;
    const s = el ? body.lastIndexOf('\n', el.selectionStart - 1) + 1 : 0;
    const e = el ? (body.indexOf('\n', el.selectionEnd) === -1 ? body.length : body.indexOf('\n', el.selectionEnd)) : body.length;
    const chunk = body.slice(s, e);
    let n = 0;
    const lines = await Promise.all(chunk.split('\n').map(async (line) => {
      const m = /^(\s*[-*]\s+)\[( |x)\]\s+(?!\{\{task:)(.+)$/i.exec(line);
      if (!m) return line;
      const t = await createTask({ title: m[3].trim(), note_ids: [note.id], project_id: note.data.project_id ?? null, course_id: note.data.course_id ?? null });
      n++;
      return `${m[1]}{{task:${t.id}}}`;
    }));
    if (!n) { toast(L('ضع المؤشر على سطور بصيغة "- [ ] نص"', 'Put the cursor on "- [ ] text" lines'), { tone: 'error' }); return; }
    change(title, body.slice(0, s) + lines.join('\n') + body.slice(e));
    toast(L(`${n} مهمة في مدير المهام، مرتبطة بهذه الملاحظة`, `${n} tasks created, linked to this note`));
  };

  const ctx: MdContext = useMemo(() => ({
    noteIdByTitle: new Map((notes ?? []).filter((n) => n.data.title).map((n) => [n.data.title.trim().toLowerCase(), n.id])),
    tasks: new Map((tasks ?? []).map((t) => [t.id, { title: t.data.title, done: t.status === 'done' }])),
  }), [notes, tasks]);

  const backlinks = useMemo(() => {
    const t = title.trim().toLowerCase();
    if (!t) return [];
    return (notes ?? []).filter((n) => n.id !== note.id && extractLinks(n.data.body).includes(t));
  }, [notes, title, note.id]);

  const linkedTasks = (tasks ?? []).filter((t) => t.data.note_ids?.includes(note.id));
  const setData = (p: Partial<NoteData>) => update<NoteData>(note.id, { data: p });

  const createLinked = async (t: string) => {
    const r = await create<NoteData>('note', blankNote({ title: t, folder_id: note.data.folder_id }));
    onOpenNote(r.id);
  };

  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  const tools: Array<[React.ReactNode, string, () => void]> = [
    [<Heading1 size={16} />, 'H1', () => linePrefix('# ')],
    [<Heading2 size={16} />, 'H2', () => linePrefix('## ')],
    [<Bold size={16} />, L('عريض', 'Bold'), () => insert('**', '**', L('نص', 'text'))],
    [<Italic size={16} />, L('مائل', 'Italic'), () => insert('*', '*', L('نص', 'text'))],
    [<List size={16} />, L('قائمة', 'List'), () => linePrefix('- ')],
    [<ListChecks size={16} />, L('مهام', 'Checklist'), () => linePrefix('- [ ] ')],
    [<Table size={16} />, L('جدول', 'Table'), () => insert('\n| عمود | عمود |\n|---|---|\n| | |\n')],
    [<Code size={16} />, L('كود', 'Code'), () => insert('\n```\n', '\n```\n', 'code')],
    [<Quote size={16} />, L('تنبيه', 'Callout'), () => insert('\n> [!note] ', '\n', L('ملاحظة', 'Note'))],
    [<ChevronDown size={16} />, L('قسم قابل للطي', 'Collapsible'), () => insert('\n<details><summary>', '</summary>\n\n...\n</details>\n', L('عنوان', 'Title'))],
    [<Sigma size={16} />, L('معادلة', 'Math'), () => insert('$', '$', 'E=mc^2')],
    [<Link2 size={16} />, L('رابط ملاحظة', 'Note link'), () => insert('[[', ']]', L('عنوان', 'Title'))],
    [<Image size={16} />, L('صورة', 'Image'), () => insert('![', '](https://)', L('وصف', 'alt'))],
    [<Minus size={16} />, L('فاصل', 'Divider'), () => insert('\n---\n')],
    [<ListTodo size={16} />, L('حوّل لمهام', 'To tasks'), () => void checklistToTasks()],
  ];

  const editor = (
    <textarea
      ref={ta}
      value={body}
      onChange={(e) => change(title, e.target.value)}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); insert('**', '**'); }
        if ((e.ctrlKey || e.metaKey) && e.key === 'i') { e.preventDefault(); insert('*', '*'); }
        if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); void persist(title, body); }
        if (e.key === 'Enter') {
          const el = e.currentTarget;
          const ls = body.lastIndexOf('\n', el.selectionStart - 1) + 1;
          const m = /^(\s*)([-*]\s(?:\[[ x]\]\s)?|\d+\.\s)/.exec(body.slice(ls, el.selectionStart));
          if (m) {
            e.preventDefault();
            const cont = m[2].includes('[') ? `${m[1]}- [ ] ` : /\d+/.test(m[2]) ? `${m[1]}${Number(m[2]) + 1}. ` : `${m[1]}${m[2]}`;
            if (body.slice(ls, el.selectionStart).trim() === m[2].trim()) { change(title, body.slice(0, ls) + body.slice(el.selectionStart)); return; }
            insert(`\n${cont}`);
          }
        }
      }}
      placeholder={L('اكتب… Markdown مدعوم: # عنوان، **عريض**، - [ ] مهمة، [[ملاحظة أخرى]]، $معادلة$', 'Write… Markdown: # heading, **bold**, - [ ] task, [[other note]], $math$')}
      className={clsx('w-full resize-none bg-transparent leading-[1.8] outline-none placeholder:text-fg-3', zen ? 'min-h-[70vh] text-[17px]' : 'min-h-[50vh] text-[15px]')}
      aria-label={L('محتوى الملاحظة', 'Note content')}
    />
  );
  const preview = (
    <Markdown text={body || L('*فارغة*', '*Empty*')} ctx={ctx} onNote={onOpenNote} onNewNote={createLinked}
      onTask={async (id) => { const t = tasks?.find((x) => x.id === id); if (t) await toggleTask(t, settings); }} className={zen ? 'text-[17px]' : ''} />
  );

  const content = (
    <div className={clsx('flex h-full flex-col', zen && 'mx-auto max-w-3xl px-6 py-10')}>
      {external && (
        <div role="alert" className="mb-3 flex flex-wrap items-center gap-2 rounded-sm bg-[color-mix(in_oklab,var(--warning)_14%,transparent)] px-3 py-2 text-sm">
          <span className="flex-1">{L('تغيّرت هذه الملاحظة من جهاز آخر أثناء كتابتك.', 'This note changed on another device while you were editing.')}</span>
          <Button size="sm" onClick={() => { setTitle(note.data.title); setBody(note.data.body); base.current = note.updated_at; setExternal(false); setSaved('saved'); }}>{L('خذ نسختهم', 'Use theirs')}</Button>
          <Button size="sm" variant="primary" onClick={async () => { setExternal(false); await persist(title, body); }}>{L('احتفظ بنسختي', 'Keep mine')}</Button>
        </div>
      )}
      <div className="mb-2 flex items-center gap-2">
        <input value={title} onChange={(e) => change(e.target.value, body)} placeholder={L('بدون عنوان', 'Untitled')} aria-label={L('العنوان', 'Title')}
          className={clsx('min-w-0 flex-1 bg-transparent font-black outline-none placeholder:text-fg-3', zen ? 'text-3xl' : 'text-2xl')} />
        <span className="text-[11px] text-fg-3" aria-live="polite">{saved === 'saved' ? L('محفوظ', 'Saved') : saved === 'saving' ? L('يحفظ…', 'Saving…') : L('غير محفوظ', 'Unsaved')}</span>
      </div>

      {!zen && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[12px]">
          <IconButton size="sm" label={note.data.pinned ? L('إلغاء التثبيت', 'Unpin') : L('تثبيت', 'Pin')} onClick={() => setData({ pinned: !note.data.pinned })} className={note.data.pinned ? 'text-accent' : ''}><Pin size={15} /></IconButton>
          <IconButton size="sm" label={L('مفضلة', 'Favorite')} onClick={() => setData({ favorite: !note.data.favorite })} className={note.data.favorite ? 'text-reward' : ''}><Star size={15} fill={note.data.favorite ? 'currentColor' : 'none'} /></IconButton>
          {note.data.tags.map((t) => <Chip key={t} onClick={() => setData({ tags: note.data.tags.filter((x) => x !== t) })}>#{t} ×</Chip>)}
          <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder={L('+ وسم', '+ tag')} className="h-7 w-20 rounded-full bg-surface-2 px-2.5 text-[12px] outline-none"
            onKeyDown={(e) => { if (e.key === 'Enter' && tagInput.trim()) { void setData({ tags: [...new Set([...note.data.tags, tagInput.trim().replace(/^#/, '')])] }); setTagInput(''); } }} />
          <button onClick={() => setMeta(!meta)} className="rounded-full px-2 py-1 text-fg-3 hover:bg-surface-2">{L('تفاصيل', 'Details')} ▾</button>
          <span className="flex-1" />
          <span className="num text-fg-3">{words} {L('كلمة', 'words')}</span>
        </div>
      )}
      {meta && !zen && (
        <div className="anim-in mb-3 grid grid-cols-2 gap-2 rounded-md border border-line p-3 md:grid-cols-4">
          <Select value={note.data.note_type} onChange={(e) => setData({ note_type: e.target.value as NoteData['note_type'] })} aria-label={L('النوع', 'Type')}>
            {NOTE_TYPES.map(([v, ar, en]) => <option key={v} value={v}>{L(ar, en)}</option>)}
          </Select>
          <Select value={note.data.folder_id ?? ''} onChange={(e) => setData({ folder_id: e.target.value || null })} aria-label={L('المجلد', 'Folder')}>
            <option value="">{L('بدون مجلد', 'No folder')}</option>
            {(folders ?? []).map((f) => <option key={f.id} value={f.id}>{f.data.name}</option>)}
          </Select>
          <Select value={note.data.para ?? ''} onChange={(e) => setData({ para: (e.target.value || null) as NoteData['para'] })} aria-label="PARA">
            <option value="">PARA —</option><option value="project">{L('مشروع', 'Project')}</option><option value="area">{L('مجال', 'Area')}</option><option value="resource">{L('مصدر', 'Resource')}</option><option value="archive">{L('أرشيف', 'Archive')}</option>
          </Select>
          <Select value={note.parent_id ?? ''} onChange={(e) => update(note.id, { parent_id: e.target.value || null })} aria-label={L('صفحة أم', 'Parent page')}>
            <option value="">{L('صفحة رئيسية', 'Top-level page')}</option>
            {(notes ?? []).filter((n) => n.id !== note.id).map((n) => <option key={n.id} value={n.id}>↳ {n.data.title || L('بدون عنوان', 'Untitled')}</option>)}
          </Select>
          <Select value={note.data.course_id ?? ''} onChange={(e) => setData({ course_id: e.target.value || null })} aria-label={L('المقرر', 'Course')}>
            <option value="">{L('بدون مقرر', 'No course')}</option>
            {(courses ?? []).map((c) => <option key={c.id} value={c.id}>{c.data.name}</option>)}
          </Select>
          <Select value={note.data.project_id ?? ''} onChange={(e) => setData({ project_id: e.target.value || null })} aria-label={L('المشروع', 'Project')}>
            <option value="">{L('بدون مشروع', 'No project')}</option>
            {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.data.title}</option>)}
          </Select>
          <Select value="" onChange={(e) => { const tpl = TEMPLATES[e.target.value]; if (tpl) change(title, `${body}${body ? '\n\n' : ''}${tpl[2]}`); }} aria-label={L('قالب', 'Template')}>
            <option value="">{L('أدرج قالباً…', 'Insert template…')}</option>
            {Object.entries(TEMPLATES).map(([k, [ar, en]]) => <option key={k} value={k}>{L(ar, en)}</option>)}
          </Select>
        </div>
      )}

      <div className="mb-2 flex flex-wrap items-center gap-1">
        <Segmented size="sm" value={mode} onChange={setMode} options={[
          { value: 'edit', label: '', icon: <PenLine size={14} /> }, { value: 'split', label: '', icon: <Columns2 size={14} /> }, { value: 'preview', label: '', icon: <Eye size={14} /> },
        ]} />
        {mode !== 'preview' && <div className="flex flex-wrap gap-0.5">{tools.map(([icon, label, fn], i) => <IconButton key={i} size="sm" label={label} onClick={fn}>{icon}</IconButton>)}</div>}
        <span className="flex-1" />
        <IconButton size="sm" label={L('السجل', 'History')} onClick={() => setHistoryOpen(true)}><History size={15} /></IconButton>
        <IconButton size="sm" label={L('تصدير Markdown', 'Export Markdown')} onClick={() => download(`${(title || 'note').replace(/[\\/:*?"<>|]/g, '_')}.md`, `# ${title}\n\n${body}`, 'text/markdown')}><Download size={15} /></IconButton>
        <IconButton size="sm" label={zen ? L('خروج من وضع التركيز', 'Exit focus mode') : L('وضع الكتابة الهادئ', 'Distraction-free')} onClick={() => setZen(!zen)}>{zen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</IconButton>
        {!zen && <IconButton size="sm" tone="danger" label={L('حذف', 'Delete')} onClick={async () => { const p = await remove(note.id); onClose?.(); undoToast(L('نُقلت للسلة', 'Moved to trash'), async () => { if (p) await revertTo(p); }); }}><Trash2 size={15} /></IconButton>}
      </div>

      <div className={clsx('min-h-0 flex-1', mode === 'split' && 'grid gap-4 md:grid-cols-2')}>
        {(mode === 'edit' || mode === 'split') && editor}
        {(mode === 'preview' || mode === 'split') && <div className={clsx(mode === 'split' && 'border-s border-line ps-4')} onDoubleClick={() => mode === 'preview' && setMode('edit')}>{preview}</div>}
      </div>

      {!zen && (linkedTasks.length > 0 || backlinks.length > 0) && (
        <div className="mt-6 grid gap-4 border-t border-line pt-4 text-sm md:grid-cols-2">
          {backlinks.length > 0 && (
            <div>
              <div className="mb-1.5 text-[12px] font-bold text-fg-3">{L('روابط تشير لهذه الملاحظة', 'Backlinks')}</div>
              <ul className="space-y-1">{backlinks.map((b) => <li key={b.id}><button className="text-accent hover:underline" onClick={() => onOpenNote(b.id)}>{b.data.title}</button></li>)}</ul>
            </div>
          )}
          {linkedTasks.length > 0 && (
            <div>
              <div className="mb-1.5 text-[12px] font-bold text-fg-3">{L('مهام مرتبطة', 'Linked tasks')}</div>
              <ul className="space-y-1">{linkedTasks.map((t) => <li key={t.id} className={t.status === 'done' ? 'text-fg-3 line-through' : ''}>• {t.data.title}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      {zen ? <div className="fixed inset-0 z-50 overflow-y-auto bg-bg">{content}</div> : content}
      <Modal open={historyOpen} onOpenChange={setHistoryOpen} title={L('سجل النسخ', 'Version history')} wide>
        {!note.data.versions?.length ? <p className="text-sm text-fg-2">{L('نحفظ نسخة كل 10 دقائق من التعديل. لا توجد نسخ بعد.', 'A snapshot is kept every 10 minutes of editing. None yet.')}</p> : (
          <ul className="divide-y divide-line">
            {[...note.data.versions].reverse().map((v) => (
              <li key={v.at} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1"><div className="text-sm font-bold">{new Date(v.at).toLocaleString()}</div><div className="truncate text-[12px] text-fg-3">{v.title} · {v.body.slice(0, 80)}</div></div>
                <Button size="sm" onClick={() => { change(v.title, v.body); setHistoryOpen(false); toast(L('استُعيدت النسخة', 'Version restored')); }}>{L('استعادة', 'Restore')}</Button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}

export type { Rec };
