import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { Plus, Search, List, Columns3, Grid2x2, GanttChart, CalendarDays, CheckCheck, Trash2, CalendarPlus, X, Save, Filter } from 'lucide-react';
import clsx from 'clsx';
import type { Rec } from '@shared/records';
import { useI18n } from '@/core/i18n';
import { updateSettings, useRecords, useSettings } from '@/core/hooks';
import { dateKey, fmtDate, monthGrid, rangeKeys, relativeDay, shiftKey, todayKey } from '@/core/dates';
import { remove, revertTo, update } from '@/core/repo';
import { undoToast } from '@/core/toast';
import { Button, Chip, EmptyState, IconButton, PageHeader, Segmented, Select } from '@/design/ui';
import { prompt } from '@/design/overlay';
import { TaskRow } from './tasks/TaskRow';
import { TaskEditor } from './tasks/TaskEditor';
import { blocked, completeTask, isDone, isOverdue, priorityColor, saveTask, taskDay, type Task, type TaskData } from './tasks/model';

type ListId = 'today' | 'tomorrow' | 'upcoming' | 'overdue' | 'week' | 'all' | 'nodate' | 'completed' | 'archived' | 'favorites';
type View = 'list' | 'kanban' | 'matrix' | 'timeline' | 'calendar';

interface SavedFilter { id: string; name: string; list: ListId; q: string; category: string; tag: string; priority: string; project: string }

export default function TasksPage() {
  const { L, lang, locale } = useI18n();
  const settings = useSettings();
  const tasks = useRecords<TaskData>('task');
  const projects = useRecords<{ title: string }>('project');
  const [params, setParams] = useSearchParams();
  const [list, setList] = useState<ListId>((params.get('list') as ListId) ?? 'all');
  const [view, setView] = useState<View>(settings.tasks.defaultView);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [tag, setTag] = useState('');
  const [priority, setPriority] = useState('');
  const [project, setProject] = useState('');
  const [editing, setEditing] = useState<Task | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const today = todayKey();

  // deep link ?open=<id>
  useEffect(() => {
    const id = params.get('open');
    if (id && tasks) {
      const t = tasks.find((x) => x.id === id);
      if (t) { setEditing(t); setEditorOpen(true); }
      params.delete('open'); setParams(params, { replace: true });
    }
  }, [params, tasks, setParams]);

  const byId = useMemo(() => new Map((tasks ?? []).map((t) => [t.id, t])), [tasks]);
  const savedFilters: SavedFilter[] = ((settings as unknown as { tasks: { savedFilters?: SavedFilter[] } }).tasks.savedFilters) ?? [];

  const filtered = useMemo(() => {
    let xs = (tasks ?? []).filter((t) => t.status !== 'inbox');
    const day = (t: Task) => taskDay(t.data);
    // ticked tasks stay where they were (crossed out) instead of vanishing into "Done"
    const doneOn = (t: Task) => (isDone(t) && t.data.completed_at ? dateKey(new Date(t.data.completed_at)) : null);
    switch (list) {
      case 'today': xs = xs.filter((t) => t.status !== 'archived' && (isDone(t) ? doneOn(t) === today : (day(t) && day(t)! <= today) || t.data.due === today)); break;
      case 'tomorrow': xs = xs.filter((t) => !isDone(t) && day(t) === shiftKey(today, 1)); break;
      case 'upcoming': xs = xs.filter((t) => !isDone(t) && t.status !== 'archived' && !!day(t) && day(t)! > today); break;
      case 'overdue': xs = xs.filter((t) => isOverdue(t, today)); break;
      case 'week': xs = xs.filter((t) => !isDone(t) && !!day(t) && day(t)! >= today && day(t)! <= shiftKey(today, 6)); break;
      case 'nodate': xs = xs.filter((t) => !isDone(t) && t.status !== 'archived' && !day(t)); break;
      case 'completed': xs = xs.filter((t) => isDone(t)); break;
      case 'archived': xs = xs.filter((t) => t.status === 'archived'); break;
      case 'favorites': xs = xs.filter((t) => t.data.favorite && t.status !== 'archived'); break;
      default: xs = xs.filter((t) => t.status !== 'archived' && (!isDone(t) || view === 'kanban' || (doneOn(t) ?? '') >= shiftKey(today, -6)));
    }
    if (q.trim()) { const s = q.trim().toLowerCase(); xs = xs.filter((t) => `${t.data.title} ${t.data.notes} ${t.data.tags.join(' ')}`.toLowerCase().includes(s)); }
    if (category) xs = xs.filter((t) => t.data.category === category);
    if (tag) xs = xs.filter((t) => t.data.tags.includes(tag));
    if (priority) xs = xs.filter((t) => String(t.data.priority) === priority);
    if (project) xs = xs.filter((t) => t.data.project_id === project);
    return xs.sort((a, b) =>
      Number(isDone(a)) - Number(isDone(b)) ||
      Number(b.data.pinned) - Number(a.data.pinned) ||
      (day(a) ?? '9999').localeCompare(day(b) ?? '9999') ||
      (a.data.start_time ?? '99').localeCompare(b.data.start_time ?? '99') ||
      b.data.priority - a.data.priority ||
      a.created_at.localeCompare(b.created_at));
  }, [tasks, list, q, category, tag, priority, project, today, view]);

  const allTags = useMemo(() => [...new Set((tasks ?? []).flatMap((t) => t.data.tags))], [tasks]);
  const open = (t: Task | null) => { setEditing(t); setEditorOpen(true); };

  const counts = useMemo(() => {
    const xs = (tasks ?? []).filter((t) => t.status !== 'inbox' && t.status !== 'archived' && !isDone(t));
    return { overdue: xs.filter((t) => isOverdue(t, today)).length, today: xs.filter((t) => { const d = taskDay(t.data); return (d && d <= today) || t.data.due === today; }).length };
  }, [tasks, today]);

  const LISTS: Array<{ id: ListId; ar: string; en: string; n?: number }> = [
    { id: 'all', ar: 'الكل', en: 'All' },
    { id: 'today', ar: 'اليوم', en: 'Today', n: counts.today },
    { id: 'tomorrow', ar: 'بكرة', en: 'Tomorrow' },
    { id: 'week', ar: '7 أيام', en: 'Next 7 days' },
    { id: 'upcoming', ar: 'القادمة', en: 'Upcoming' },
    { id: 'overdue', ar: 'متأخرة', en: 'Overdue', n: counts.overdue },
    { id: 'nodate', ar: 'بدون تاريخ', en: 'No date' },
    { id: 'favorites', ar: 'المفضلة', en: 'Favorites' },
    { id: 'completed', ar: 'المنجزة', en: 'Completed' },
    { id: 'archived', ar: 'الأرشيف', en: 'Archive' },
  ];

  /* ── bulk ── */
  const sel = (id: string, v: boolean) => setSelected((s) => { const n = new Set(s); if (v) n.add(id); else n.delete(id); return n; });
  const bulkDone = async () => { for (const id of selected) { const t = byId.get(id); if (t && !isDone(t)) await completeTask(t, settings); } setSelected(new Set()); };
  const bulkDelete = async () => {
    const prevs: Rec[] = [];
    for (const id of selected) { const p = await remove(id); if (p) prevs.push(p); }
    setSelected(new Set());
    undoToast(L(`حُذفت ${prevs.length} مهمة`, `${prevs.length} tasks deleted`), async () => { for (const p of prevs) await revertTo(p); });
  };
  const bulkDate = async (d: string | null) => { for (const id of selected) { const t = byId.get(id); if (t) await saveTask(id, { ...t.data, start: d }); } setSelected(new Set()); };

  const saveFilter = async () => {
    const name = await prompt(L('اسم القائمة الذكية', 'Smart list name'));
    if (!name) return;
    const f: SavedFilter = { id: String(Date.now()), name, list, q, category, tag, priority, project };
    await updateSettings({ tasks: { savedFilters: [...savedFilters, f] } } as never);
  };
  const applyFilter = (f: SavedFilter) => { setList(f.list); setQ(f.q); setCategory(f.category); setTag(f.tag); setPriority(f.priority); setProject(f.project); };

  return (
    <div>
      <PageHeader
        title={L('المهام', 'Tasks')}
        subtitle={L(`${filtered.filter((t) => !isDone(t)).length} مفتوحة`, `${filtered.filter((t) => !isDone(t)).length} open`)}
        actions={<Button variant="primary" icon={<Plus size={17} />} onClick={() => open(null)}>{L('مهمة', 'Task')}</Button>}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-fg-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('ابحث في المهام', 'Search tasks')} className="field ps-9" aria-label={L('بحث', 'Search')} />
        </div>
        <IconButton label={L('فلاتر', 'Filters')} onClick={() => setShowFilters(!showFilters)} className={showFilters ? 'bg-surface-2 text-fg' : ''}><Filter size={18} /></IconButton>
        <Segmented value={view} onChange={setView} options={[
          { value: 'list', label: <span className="sr-only md:not-sr-only">{L('قائمة', 'List')}</span>, icon: <List size={15} /> },
          { value: 'kanban', label: <span className="sr-only md:not-sr-only">{L('لوحة', 'Board')}</span>, icon: <Columns3 size={15} /> },
          { value: 'calendar', label: <span className="sr-only md:not-sr-only">{L('تقويم', 'Calendar')}</span>, icon: <CalendarDays size={15} /> },
          { value: 'timeline', label: <span className="sr-only md:not-sr-only">{L('خط زمني', 'Timeline')}</span>, icon: <GanttChart size={15} /> },
          { value: 'matrix', label: <span className="sr-only md:not-sr-only">{L('أيزنهاور', 'Matrix')}</span>, icon: <Grid2x2 size={15} /> },
        ]} />
      </div>

      {showFilters && (
        <div className="anim-in mb-3 grid grid-cols-2 gap-2 rounded-md border border-line bg-surface p-3 md:grid-cols-5">
          <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label={L('التصنيف', 'Category')}>
            <option value="">{L('كل التصنيفات', 'All categories')}</option>
            {settings.categories.tasks.map((c) => <option key={c}>{c}</option>)}
          </Select>
          <Select value={tag} onChange={(e) => setTag(e.target.value)} aria-label={L('الوسم', 'Tag')}>
            <option value="">{L('كل الوسوم', 'All tags')}</option>
            {allTags.map((t) => <option key={t} value={t}>#{t}</option>)}
          </Select>
          <Select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label={L('الأولوية', 'Priority')}>
            <option value="">{L('كل الأولويات', 'Any priority')}</option>
            <option value="4">{L('عاجل', 'Urgent')}</option><option value="3">{L('مهم', 'High')}</option><option value="2">{L('عادي', 'Normal')}</option><option value="1">{L('منخفض', 'Low')}</option>
          </Select>
          <Select value={project} onChange={(e) => setProject(e.target.value)} aria-label={L('المشروع', 'Project')}>
            <option value="">{L('كل المشاريع', 'All projects')}</option>
            {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.data.title}</option>)}
          </Select>
          <Button size="md" icon={<Save size={15} />} onClick={saveFilter}>{L('احفظ كقائمة', 'Save list')}</Button>
        </div>
      )}

      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 scroll-thin">
        {LISTS.map((l) => (
          <Chip key={l.id} active={list === l.id} onClick={() => setList(l.id)}>
            {L(l.ar, l.en)}{l.n ? <span className={clsx('num rounded-full px-1.5 text-[11px]', l.id === 'overdue' ? 'bg-danger text-white' : 'bg-surface-2')}>{l.n}</span> : null}
          </Chip>
        ))}
        {savedFilters.map((f) => (
          <Chip key={f.id} onClick={() => applyFilter(f)}>★ {f.name}
            <span role="button" tabIndex={0} aria-label={L('حذف', 'Delete')} onClick={(e) => { e.stopPropagation(); void updateSettings({ tasks: { savedFilters: savedFilters.filter((x) => x.id !== f.id) } } as never); }}><X size={11} /></span>
          </Chip>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="sticky top-24 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-md border border-line bg-elevated p-2 shadow-2 lg:top-4">
          <span className="px-2 text-sm font-bold">{selected.size} {L('محددة', 'selected')}</span>
          <Button size="sm" icon={<CheckCheck size={15} />} onClick={bulkDone}>{L('إنجاز', 'Complete')}</Button>
          <Button size="sm" icon={<CalendarPlus size={15} />} onClick={() => bulkDate(today)}>{L('لليوم', 'Today')}</Button>
          <Button size="sm" onClick={() => bulkDate(shiftKey(today, 1))}>{L('لبكرة', 'Tomorrow')}</Button>
          <Button size="sm" onClick={() => bulkDate(null)}>{L('بدون تاريخ', 'No date')}</Button>
          <Button size="sm" variant="danger" icon={<Trash2 size={15} />} onClick={bulkDelete}>{L('حذف', 'Delete')}</Button>
          <span className="flex-1" />
          <IconButton size="sm" label={L('إلغاء التحديد', 'Clear')} onClick={() => setSelected(new Set())}><X size={16} /></IconButton>
        </div>
      )}

      {tasks && filtered.length === 0 && view !== 'calendar' ? (
        <EmptyState
          icon={<CheckCheck size={30} />}
          title={list === 'today' ? L('يومك فاضي — استمتع أو أضف خطوة واحدة.', 'Your day is clear — enjoy it or add one step.') : L('ابدأ بمهمة واحدة. الباقي يلحق.', 'Start with one task. Everything else can follow.')}
          action={<Button variant="primary" icon={<Plus size={16} />} onClick={() => open(null)}>{L('أضف مهمة', 'Add a task')}</Button>}
        />
      ) : view === 'list' ? (
        <GroupedList tasks={filtered} byId={byId} onOpen={open} selected={selected} onSelect={sel} grouped={list === 'all' || list === 'upcoming' || list === 'week'} />
      ) : view === 'kanban' ? (
        <Kanban tasks={filtered} onOpen={open} />
      ) : view === 'matrix' ? (
        <Matrix tasks={filtered.filter((t) => !isDone(t))} onOpen={open} />
      ) : view === 'timeline' ? (
        <Timeline tasks={filtered.filter((t) => !isDone(t))} onOpen={open} />
      ) : (
        <MonthTasks tasks={(tasks ?? []).filter((t) => t.status !== 'archived')} onOpen={open} />
      )}

      <TaskEditor task={editing} open={editorOpen} onOpenChange={setEditorOpen} />
      <span className="hidden">{lang}{locale}</span>
    </div>
  );

  function GroupedList({ tasks: xs, byId: map, onOpen, selected: s, onSelect, grouped }: { tasks: Task[]; byId: Map<string, Task>; onOpen: (t: Task) => void; selected: Set<string>; onSelect: (id: string, v: boolean) => void; grouped: boolean }) {
    if (!grouped) return <div className="card divide-y divide-line p-1.5">{xs.map((t) => <TaskRow key={t.id} task={t} onOpen={onOpen} blocked={blocked(t, map)} selected={s.has(t.id)} onSelect={onSelect} />)}</div>;
    const groups = new Map<string, Task[]>();
    for (const t of xs) {
      const d = taskDay(t.data);
      const key = isDone(t) && d && d < today ? 'donePast' : !d ? 'none' : d < today ? 'overdue' : d;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }
    const rank = (k: string) => (k === 'overdue' ? 0 : k === 'none' ? 2 : k === 'donePast' ? 3 : 1);
    const keys = [...groups.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    return (
      <div className="space-y-4">
        {keys.map((k) => (
          <section key={k}>
            <h2 className={clsx('mb-1.5 px-2 text-[13px] font-bold', k === 'overdue' ? 'text-danger' : 'text-fg-2')}>
              {k === 'overdue' ? L('متأخرة', 'Overdue') : k === 'none' ? L('بدون تاريخ', 'No date') : k === 'donePast' ? L('أنجزتها هالأسبوع', 'Done this week') : `${relativeDay(k, lang, locale)} · ${fmtDate(k, locale, { day: 'numeric', month: 'short' })}`}
              <span className="num ms-1.5 text-fg-3">{groups.get(k)!.length}</span>
            </h2>
            <div className="card divide-y divide-line p-1.5">
              {groups.get(k)!.map((t) => <TaskRow key={t.id} task={t} onOpen={onOpen} blocked={blocked(t, map)} selected={s.has(t.id)} onSelect={onSelect} showDate={k === 'overdue'} />)}
            </div>
          </section>
        ))}
      </div>
    );
  }
}

/* ── Kanban (drag between columns) ─────────────────────── */
function Kanban({ tasks, onOpen }: { tasks: Task[]; onOpen: (t: Task) => void }) {
  const { L } = useI18n();
  const settings = useSettings();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }));
  const cols: Array<{ id: string; ar: string; en: string }> = [
    { id: 'todo', ar: 'للإنجاز', en: 'To do' },
    { id: 'doing', ar: 'قيد العمل', en: 'In progress' },
    { id: 'done', ar: 'منجزة', en: 'Done' },
  ];
  const onEnd = async (e: DragEndEvent) => {
    const to = e.over?.id as string | undefined;
    const t = tasks.find((x) => x.id === e.active.id);
    if (!to || !t || t.status === to) return;
    if (to === 'done') await completeTask(t, settings);
    else await update(t.id, { status: to, data: { completed_at: null } });
  };
  return (
    <DndContext sensors={sensors} onDragEnd={onEnd}>
      <div className="grid gap-3 md:grid-cols-3">
        {cols.map((c) => <Column key={c.id} id={c.id} title={L(c.ar, c.en)} tasks={tasks.filter((t) => (t.status === 'done' ? 'done' : t.status === 'doing' ? 'doing' : 'todo') === c.id)} onOpen={onOpen} />)}
      </div>
    </DndContext>
  );
}

function Column({ id, title, tasks, onOpen }: { id: string; title: string; tasks: Task[]; onOpen: (t: Task) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={clsx('min-h-40 rounded-lg border p-2 transition-colors', isOver ? 'border-accent bg-[color-mix(in_oklab,var(--accent)_8%,transparent)]' : 'border-line bg-surface')}>
      <div className="mb-2 flex items-center px-1.5 text-[13px] font-bold text-fg-2">{title}<span className="num ms-auto text-fg-3">{tasks.length}</span></div>
      <div className="space-y-1.5">{tasks.map((t) => <DraggableCard key={t.id} task={t} onOpen={onOpen} />)}</div>
    </div>
  );
}

function DraggableCard({ task, onOpen }: { task: Task; onOpen: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={clsx('rounded-sm border border-line bg-elevated', isDragging && 'z-20 shadow-3')}>
      <TaskRow task={task} onOpen={onOpen} />
    </div>
  );
}

/* ── Eisenhower matrix ─────────────────────────────────── */
function Matrix({ tasks, onOpen }: { tasks: Task[]; onOpen: (t: Task) => void }) {
  const { L } = useI18n();
  const today = todayKey();
  const soon = shiftKey(today, 2);
  const urgent = (t: Task) => t.data.urgent ?? (t.data.priority >= 4 || (!!t.data.due && t.data.due <= soon));
  const important = (t: Task) => t.data.important ?? t.data.priority >= 3;
  const quads = [
    { key: 'do', ar: 'افعلها الآن', en: 'Do now', hint: L('مهم وعاجل', 'Important & urgent'), f: (t: Task) => urgent(t) && important(t), color: 'var(--danger)', set: { urgent: true, important: true } },
    { key: 'plan', ar: 'خطط لها', en: 'Schedule', hint: L('مهم وغير عاجل', 'Important, not urgent'), f: (t: Task) => !urgent(t) && important(t), color: 'var(--life)', set: { urgent: false, important: true } },
    { key: 'delegate', ar: 'فوّضها أو اختصرها', en: 'Delegate', hint: L('عاجل وغير مهم', 'Urgent, not important'), f: (t: Task) => urgent(t) && !important(t), color: 'var(--warning)', set: { urgent: true, important: false } },
    { key: 'drop', ar: 'أجّلها', en: 'Later', hint: L('غير مهم وغير عاجل', 'Neither'), f: (t: Task) => !urgent(t) && !important(t), color: 'var(--text-3)', set: { urgent: false, important: false } },
  ];
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }));
  return (
    <DndContext sensors={sensors} onDragEnd={async (e) => {
      const q = quads.find((x) => x.key === e.over?.id);
      if (q) await update(String(e.active.id), { data: q.set });
    }}>
      <div className="grid gap-3 md:grid-cols-2">
        {quads.map((q) => <Quad key={q.key} id={q.key} title={L(q.ar, q.en)} hint={q.hint} color={q.color} tasks={tasks.filter(q.f)} onOpen={onOpen} />)}
      </div>
    </DndContext>
  );
}

function Quad({ id, title, hint, color, tasks, onOpen }: { id: string; title: string; hint: string; color: string; tasks: Task[]; onOpen: (t: Task) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={clsx('min-h-44 rounded-lg border bg-surface p-3', isOver ? 'border-accent' : 'border-line')} style={{ borderTopColor: color, borderTopWidth: 3 }}>
      <div className="mb-1 font-bold">{title} <span className="num text-fg-3">· {tasks.length}</span></div>
      <div className="mb-2 text-[12px] text-fg-3">{hint}</div>
      <div className="space-y-1">{tasks.map((t) => <DraggableCard key={t.id} task={t} onOpen={onOpen} />)}</div>
    </div>
  );
}

/* ── Timeline: next 14 days as lanes ───────────────────── */
function Timeline({ tasks, onOpen }: { tasks: Task[]; onOpen: (t: Task) => void }) {
  const { L, locale } = useI18n();
  const days = rangeKeys(todayKey(), 14);
  const withDates = tasks.filter((t) => t.data.start || t.data.due);
  if (!withDates.length) return <EmptyState title={L('ما فيه مهام بتواريخ', 'No dated tasks')} hint={L('أضف موعد عمل أو موعد نهائي ليظهر هنا.', 'Add a scheduled or due date to see tasks here.')} />;
  return (
    <div className="card overflow-x-auto p-3 scroll-thin">
      <div className="grid min-w-[760px]" style={{ gridTemplateColumns: `200px repeat(${days.length}, 1fr)` }}>
        <div />
        {days.map((d) => <div key={d} className="pb-2 text-center text-[11px] font-bold text-fg-3">{fmtDate(d, locale, { weekday: 'short', day: 'numeric' })}</div>)}
        {withDates.map((t) => {
          const s = t.data.start ?? t.data.due!;
          const e = t.data.due && t.data.due >= s ? t.data.due : s;
          const a = Math.max(0, days.indexOf(s < days[0] ? days[0] : s));
          const b = e > days.at(-1)! ? days.length - 1 : days.indexOf(e);
          return (
            <div key={t.id} className="contents">
              <button className="truncate py-1 text-start text-[13px] hover:text-accent" onClick={() => onOpen(t)}>{t.data.title}</button>
              <div className="relative py-1" style={{ gridColumn: `${a + 2} / ${Math.max(a, b) + 3}` }}>
                <div className="h-6 rounded-xs" style={{ background: `color-mix(in oklab, ${priorityColor(t.data.priority)} 35%, var(--surface-2))`, borderInlineStart: `3px solid ${priorityColor(t.data.priority)}` }} />
              </div>
              <div style={{ gridColumn: `${Math.max(a, b) + 3} / -1` }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Month calendar of tasks ───────────────────────────── */
function MonthTasks({ tasks, onOpen }: { tasks: Task[]; onOpen: (t: Task) => void }) {
  const { locale } = useI18n();
  const settings = useSettings();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const grid = monthGrid(ym.y, ym.m, settings.weekStart);
  const today = todayKey();
  const map = new Map<string, Task[]>();
  for (const t of tasks) { const d = taskDay(t.data); if (d) { if (!map.has(d)) map.set(d, []); map.get(d)!.push(t); } }
  return (
    <div className="card p-3">
      <div className="mb-2 flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => setYm(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }))}>‹</Button>
        <div className="flex-1 text-center font-bold">{new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(ym.y, ym.m, 1))}</div>
        <Button size="sm" variant="ghost" onClick={() => setYm(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))}>›</Button>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-sm bg-line">
        {grid.map((d) => {
          const inMonth = Number(d.slice(5, 7)) - 1 === ym.m;
          return (
            <div key={d} className={clsx('min-h-20 bg-surface p-1', !inMonth && 'opacity-45')}>
              <div className={clsx('num mb-0.5 text-[11px] font-bold', d === today ? 'text-accent' : 'text-fg-3')}>{Number(d.slice(8))}</div>
              {(map.get(d) ?? []).slice(0, 3).map((t) => (
                <button key={t.id} onClick={() => onOpen(t)} className={clsx('mb-0.5 block w-full truncate rounded-[4px] px-1 text-start text-[11px]', isDone(t) ? 'text-fg-3 line-through' : 'bg-surface-2')}>{t.data.title}</button>
              ))}
              {(map.get(d)?.length ?? 0) > 3 && <div className="text-[10px] text-fg-3">+{map.get(d)!.length - 3}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
