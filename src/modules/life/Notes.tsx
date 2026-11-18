import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Plus, Search, Folder, FolderPlus, Pin, Star, FileText, ArrowRight, ArrowLeft, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { useI18n } from '@/core/i18n';
import { useMedia, useRecords } from '@/core/hooks';
import { create, remove, update } from '@/core/repo';
import { relativeDay } from '@/core/dates';
import { prompt, confirm } from '@/design/overlay';
import { Button, Chip, EmptyState, IconButton } from '@/design/ui';
import { blankNote, type Note, type NoteData } from '@/modules/shared/domain';
import { NoteEditor, NOTE_TYPES } from './notes/NoteEditor';

export default function Notes() {
  const { L, lang, locale } = useI18n();
  const notes = useRecords<NoteData>('note');
  const folders = useRecords<{ name: string; icon?: string }>('folder');
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [folder, setFolder] = useState<string | 'all' | 'pinned' | 'fav'>('all');
  const [type, setType] = useState('');
  const [tag, setTag] = useState('');
  const desktop = useMedia('(min-width: 1024px)');

  useEffect(() => {
    const id = params.get('open');
    const isNew = params.get('new');
    if (id) { setSelected(id); params.delete('open'); setParams(params, { replace: true }); }
    if (isNew) { params.delete('new'); setParams(params, { replace: true }); void newNote(); }
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  const newNote = async (title = '') => {
    const r = await create<NoteData>('note', blankNote({ title, folder_id: folder !== 'all' && folder !== 'pinned' && folder !== 'fav' ? folder : null }));
    setSelected(r.id);
  };

  const list = useMemo(() => {
    let xs = (notes ?? []) as Note[];
    if (folder === 'pinned') xs = xs.filter((n) => n.data.pinned);
    else if (folder === 'fav') xs = xs.filter((n) => n.data.favorite);
    else if (folder !== 'all') xs = xs.filter((n) => n.data.folder_id === folder);
    if (type) xs = xs.filter((n) => n.data.note_type === type);
    if (tag) xs = xs.filter((n) => n.data.tags.includes(tag));
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      xs = xs.filter((n) => `${n.data.title}\n${n.data.body}\n${n.data.tags.join(' ')}`.toLowerCase().includes(s));
    }
    return [...xs].sort((a, b) => Number(b.data.pinned) - Number(a.data.pinned) || b.updated_at.localeCompare(a.updated_at));
  }, [notes, folder, type, tag, q]);

  const tags = useMemo(() => [...new Set((notes ?? []).flatMap((n) => n.data.tags))].sort(), [notes]);
  const current = (notes ?? []).find((n) => n.id === selected) as Note | undefined;
  const snippet = (n: Note) => {
    if (q.trim()) { const i = n.data.body.toLowerCase().indexOf(q.trim().toLowerCase()); if (i >= 0) return `…${n.data.body.slice(Math.max(0, i - 20), i + 70)}`; }
    return n.data.body.replace(/[#*>`\-[\]]/g, '').slice(0, 90);
  };
  const children = (id: string) => (notes ?? []).filter((n) => n.parent_id === id);

  const sidebar = (
    <aside className="flex min-h-0 flex-col gap-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-fg-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} className="field ps-9" placeholder={L('بحث في كل النصوص', 'Search all text')} aria-label={L('بحث', 'Search')} />
        </div>
        <Button variant="primary" icon={<Plus size={17} />} onClick={() => newNote()} aria-label={L('ملاحظة جديدة', 'New note')} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Chip active={folder === 'all'} onClick={() => setFolder('all')}>{L('الكل', 'All')}</Chip>
        <Chip active={folder === 'pinned'} onClick={() => setFolder('pinned')}><Pin size={12} />{L('مثبتة', 'Pinned')}</Chip>
        <Chip active={folder === 'fav'} onClick={() => setFolder('fav')}><Star size={12} />{L('مفضلة', 'Favorites')}</Chip>
        {(folders ?? []).map((f) => (
          <Chip key={f.id} active={folder === f.id} onClick={() => setFolder(f.id)}><Folder size={12} />{f.data.name}
            {folder === f.id && <span role="button" tabIndex={0} aria-label={L('حذف المجلد', 'Delete folder')} onClick={async (e) => { e.stopPropagation(); if (await confirm(L('حذف المجلد؟ الملاحظات تبقى بدون مجلد.', 'Delete folder? Notes stay, without a folder.'))) { for (const n of (notes ?? []).filter((x) => x.data.folder_id === f.id)) await update<NoteData>(n.id, { data: { folder_id: null } }); await remove(f.id); setFolder('all'); } }}><Trash2 size={11} /></span>}
          </Chip>
        ))}
        <IconButton size="sm" label={L('مجلد جديد', 'New folder')} onClick={async () => { const n = await prompt(L('اسم المجلد', 'Folder name')); if (n?.trim()) await create('folder', { name: n.trim() }); }}><FolderPlus size={16} /></IconButton>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 scroll-thin">
        <select className="field h-8 min-h-0 w-auto py-0 text-[12px]" value={type} onChange={(e) => setType(e.target.value)} aria-label={L('النوع', 'Type')}>
          <option value="">{L('كل الأنواع', 'All types')}</option>
          {NOTE_TYPES.map(([v, ar, en]) => <option key={v} value={v}>{L(ar, en)}</option>)}
        </select>
        {tags.slice(0, 12).map((t) => <Chip key={t} active={tag === t} onClick={() => setTag(tag === t ? '' : t)}>#{t}</Chip>)}
      </div>
      <div className="card min-h-0 flex-1 divide-y divide-line overflow-y-auto scroll-thin lg:max-h-[calc(100dvh-280px)]">
        {!list.length ? <p className="p-6 text-center text-sm text-fg-3">{q ? L('لا نتائج', 'No results') : L('لا ملاحظات هنا بعد', 'No notes here yet')}</p> : list.filter((n) => !n.parent_id || folder !== 'all' || q).map((n) => (
          <div key={n.id}>
            <button onClick={() => setSelected(n.id)} className={clsx('block w-full px-4 py-3 text-start hover:bg-surface-2', n.id === selected && 'bg-[color-mix(in_oklab,var(--accent)_38%,transparent)]')}>
              <div className="flex items-center gap-1.5">
                {n.data.pinned && <Pin size={12} className="shrink-0 text-accent" />}
                <span className="truncate font-bold">{n.data.title || L('بدون عنوان', 'Untitled')}</span>
                <span className="ms-auto shrink-0 text-[11px] text-fg-3">{relativeDay(n.updated_at.slice(0, 10), lang, locale)}</span>
              </div>
              <div className="mt-0.5 line-clamp-2 text-[12.5px] text-fg-2">{snippet(n) || L('فارغة', 'Empty')}</div>
            </button>
            {!q && folder === 'all' && children(n.id).map((c) => (
              <button key={c.id} onClick={() => setSelected(c.id)} className={clsx('block w-full py-2 pe-4 ps-9 text-start text-[13px] hover:bg-surface-2', c.id === selected && 'bg-[color-mix(in_oklab,var(--accent)_38%,transparent)]')}>↳ {c.data.title || L('بدون عنوان', 'Untitled')}</button>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );

  if (!desktop) {
    return current ? (
      <div>
        <Button variant="ghost" size="sm" className="mb-3" icon={lang === 'ar' ? <ArrowRight size={16} /> : <ArrowLeft size={16} />} onClick={() => setSelected(null)}>{L('الملاحظات', 'Notes')}</Button>
        <NoteEditor note={current} onOpenNote={setSelected} onClose={() => setSelected(null)} />
      </div>
    ) : <div><h1 className="mb-4 text-2xl font-black">{L('الملاحظات', 'Notes')}</h1>{sidebar}</div>;
  }

  return (
    <div className="grid min-h-[calc(100dvh-140px)] grid-cols-[340px_1fr] gap-6">
      <div><h1 className="mb-4 text-2xl font-black">{L('الملاحظات', 'Notes')}</h1>{sidebar}</div>
      <div className="min-w-0">
        {current ? <NoteEditor note={current} onOpenNote={setSelected} onClose={() => setSelected(null)} /> : (
          <EmptyState icon={<FileText size={30} />} title={L('اختر ملاحظة أو ابدأ واحدة جديدة', 'Pick a note or start a new one')} hint={L('اربط الأفكار بـ [[عنوان ملاحظة]] لتظهر في العقل الثاني.', 'Link ideas with [[Note title]] to see them in your Second Brain.')} action={<Button variant="primary" icon={<Plus size={16} />} onClick={() => newNote()}>{L('ملاحظة جديدة', 'New note')}</Button>} />
        )}
      </div>
    </div>
  );
}
