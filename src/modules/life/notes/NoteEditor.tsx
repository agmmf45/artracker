import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minimize2, History, Download, Pin, Star, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import type { Rec } from '@shared/records';
import { useI18n } from '@/core/i18n';
import { useRecords } from '@/core/hooks';
import { update, remove, revertTo } from '@/core/repo';
import { undoToast, toast } from '@/core/toast';
import { download } from '@/core/portability';
import { Modal } from '@/design/overlay';
import { Button, IconButton, Select, Chip } from '@/design/ui';
import { extractLinks } from '@/modules/shared/markdown';
import { RichText } from '@/modules/shared/RichText';
import type { Note, NoteData } from '@/modules/shared/domain';
import type { TaskData } from '../tasks/model';

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
  const notes = useRecords<NoteData>('note');
  const folders = useRecords<{ name: string }>('folder');
  const tasks = useRecords<TaskData>('task');
  const courses = useRecords<{ name: string }>('course');
  const projects = useRecords<{ title: string }>('project');
  const [title, setTitle] = useState(note.data.title);
  const [body, setBody] = useState(note.data.body);
  const [zen, setZen] = useState(false);
  const [saved, setSaved] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const [external, setExternal] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [meta, setMeta] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const base = useRef(note.updated_at);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSnap = useRef<number>(Date.parse(note.data.versions?.at(-1)?.at ?? '0'));

  // switching notes / draft recovery
  useEffect(() => {
    setTitle(note.data.title); setBody(note.data.body); base.current = note.updated_at; setSaved('saved'); setExternal(false);
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY(note.id)) ?? 'null') as { title: string; body: string; at: string } | null;
      if (draft && draft.at > note.updated_at && (draft.body !== note.data.body || draft.title !== note.data.title)) {
        toast(L('وجدنا مسودة غير محفوظة', 'Found unsaved changes'), { action: { label: L('استعادة', 'Restore'), run: () => { setTitle(draft.title); setBody(draft.body); setSaved('dirty'); } }, ttl: 10000 });
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

  const backlinks = useMemo(() => {
    const t = title.trim().toLowerCase();
    if (!t) return [];
    return (notes ?? []).filter((n) => n.id !== note.id && extractLinks(n.data.body).includes(t));
  }, [notes, title, note.id]);

  const linkedTasks = (tasks ?? []).filter((t) => t.data.note_ids?.includes(note.id));
  const setData = (p: Partial<NoteData>) => update<NoteData>(note.id, { data: p });

  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  const editor = (
    <RichText value={body} onChange={(b) => change(title, b)} autoFocus={!note.data.body} sticky
      placeholder={L('اكتب ملاحظتك…', 'Write your note…')} ariaLabel={L('محتوى الملاحظة', 'Note content')} className={zen ? 'text-[17px]' : ''} />
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
          <Select value={note.data.folder_id ?? ''} onChange={(e) => setData({ folder_id: e.target.value || null })} aria-label={L('المجلد', 'Folder')}>
            <option value="">{L('بدون مجلد', 'No folder')}</option>
            {(folders ?? []).map((f) => <option key={f.id} value={f.id}>{f.data.name}</option>)}
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
        <span className="flex-1" />
        <IconButton size="sm" label={L('السجل', 'History')} onClick={() => setHistoryOpen(true)}><History size={15} /></IconButton>
        <IconButton size="sm" label={L('تصدير Markdown', 'Export Markdown')} onClick={() => download(`${(title || 'note').replace(/[\\/:*?"<>|]/g, '_')}.md`, `# ${title}\n\n${body}`, 'text/markdown')}><Download size={15} /></IconButton>
        <IconButton size="sm" label={zen ? L('خروج من وضع التركيز', 'Exit focus mode') : L('وضع الكتابة الهادئ', 'Distraction-free')} onClick={() => setZen(!zen)}>{zen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</IconButton>
        {!zen && <IconButton size="sm" tone="danger" label={L('حذف', 'Delete')} onClick={async () => { const p = await remove(note.id); onClose?.(); undoToast(L('نُقلت للسلة', 'Moved to trash'), async () => { if (p) await revertTo(p); }); }}><Trash2 size={15} /></IconButton>}
      </div>

      <div className="min-h-0 flex-1">{editor}</div>

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
