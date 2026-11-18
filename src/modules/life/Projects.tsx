import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { Plus, FolderKanban, ArrowRight, ArrowLeft, Trash2, Link2, CheckCircle2, Flag, Sparkles, X } from 'lucide-react';
import clsx from 'clsx';
import { useI18n } from '@/core/i18n';
import { useRecords, useSettings } from '@/core/hooks';
import { create, remove, revertTo, update } from '@/core/repo';
import { fmtDate, relativeDay, todayKey } from '@/core/dates';
import { grantXp } from '@/core/xp';
import { api } from '@/core/api';
import { undoToast, toast } from '@/core/toast';
import { confirm, Modal } from '@/design/overlay';
import { Bar, Button, Card, Chip, EmptyState, IconButton, Input, PageHeader, Segmented, Select, Stat, Textarea } from '@/design/ui';
import { TaskRow } from './tasks/TaskRow';
import { TaskEditor } from './tasks/TaskEditor';
import { createTask, type Task, type TaskData } from './tasks/model';
import { projectProgress, type GoalData, type Milestone, type MilestoneData, type Project, type ProjectData } from './goals/model';
import type { NoteData } from '@/modules/shared/domain';

const blank = (p: Partial<ProjectData> = {}): ProjectData => ({ title: '', description: '', kind: 'personal', priority: 2, due: null, start: todayKey(), goal_id: null, area: null, resources: [], next_action: null, color: null, ...p });
const STATUS: Array<[string, string, string]> = [['planning', 'تخطيط', 'Planning'], ['active', 'نشط', 'Active'], ['paused', 'متوقف', 'Paused'], ['done', 'مكتمل', 'Done']];

export default function Projects() {
  const { L, lang, locale } = useI18n();
  const projects = useRecords<ProjectData>('project');
  const tasks = useRecords<TaskData>('task');
  const milestones = useRecords<MilestoneData>('milestone');
  const [params, setParams] = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'open' | 'done'>('open');
  const [creating, setCreating] = useState(false);

  useEffect(() => { const id = params.get('open'); if (id) { setOpenId(id); params.delete('open'); setParams(params, { replace: true }); } }, [params, setParams]);
  const current = (projects ?? []).find((p) => p.id === openId) as Project | undefined;
  if (current) return <ProjectView p={current} onBack={() => setOpenId(null)} />;

  const list = (projects ?? []).filter((p) => (filter === 'done' ? p.status === 'done' : p.status !== 'done')).sort((a, b) => b.data.priority - a.data.priority || (a.data.due ?? '9').localeCompare(b.data.due ?? '9'));
  return (
    <div>
      <PageHeader title={L('المشاريع', 'Projects')} actions={<><Segmented value={filter} onChange={setFilter} options={[{ value: 'open', label: L('الجارية', 'Open') }, { value: 'done', label: L('المكتملة', 'Done') }]} /><Button variant="primary" icon={<Plus size={17} />} onClick={() => setCreating(true)}>{L('مشروع', 'Project')}</Button></>} />
      {!list.length ? <EmptyState icon={<FolderKanban size={30} />} title={L('مشروع = نتيجة لها نهاية', 'A project is an outcome with an end')} hint={L('دراسي، شخصي، تجاري، أو إبداعي.', 'Academic, personal, business or creative.')} action={<Button variant="primary" onClick={() => setCreating(true)}>{L('ابدأ مشروعاً', 'Start a project')}</Button>} /> : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => {
            const pr = projectProgress(p as Project, tasks ?? [], (milestones ?? []) as Milestone[]);
            const st = STATUS.find((s) => s[0] === p.status);
            return (
              <button key={p.id} onClick={() => setOpenId(p.id)} className="card p-4 text-start hover:border-line-strong" style={p.data.color ? { borderTop: `3px solid ${p.data.color}` } : undefined}>
                <div className="flex items-center gap-2 text-[12px] text-fg-3"><span>{st ? L(st[1], st[2]) : ''}</span>{p.data.due && <span>· {relativeDay(p.data.due, lang, locale)}</span>}</div>
                <div className="mt-0.5 text-lg font-bold">{p.data.title}</div>
                {p.data.next_action && <div className="mt-1 truncate text-[13px] text-fg-2">→ {p.data.next_action}</div>}
                <div className="mt-3 flex items-center gap-2"><Bar value={pr.pct ?? 0} max={1} className="flex-1" /><span className="num text-[12px] text-fg-2">{pr.pct === null ? '—' : `${Math.round(pr.pct * 100)}%`}</span></div>
                <div className="num mt-1 text-[11.5px] text-fg-3">{pr.done}/{pr.total} {L('مهمة', 'tasks')} · {pr.msDone}/{pr.msTotal} {L('مرحلة', 'milestones')}</div>
              </button>
            );
          })}
        </div>
      )}
      {creating && <ProjectEditor onClose={() => setCreating(false)} onCreated={setOpenId} />}
    </div>
  );
}

function ProjectEditor({ p, onClose, onCreated }: { p?: Project; onClose: () => void; onCreated?: (id: string) => void }) {
  const { L } = useI18n();
  const settings = useSettings();
  const goals = useRecords<GoalData>('goal');
  const [d, setD] = useState<ProjectData>(blank(p?.data));
  const [status, setStatus] = useState(p?.status ?? 'active');
  const set = (x: Partial<ProjectData>) => setD((y) => ({ ...y, ...x }));
  const save = async () => {
    if (!d.title.trim()) { toast(L('سمِّ المشروع', 'Name the project'), { tone: 'error' }); return; }
    if (p) await update<ProjectData>(p.id, { data: d, status, date: d.due });
    else { const r = await create<ProjectData>('project', d, { status, date: d.due }); onCreated?.(r.id); }
    onClose();
  };
  return (
    <Modal panel open onOpenChange={(v) => !v && onClose()} title={p ? L('تعديل المشروع', 'Edit project') : L('مشروع جديد', 'New project')}
      footer={<><Button variant="ghost" onClick={onClose}>{L('إلغاء', 'Cancel')}</Button><Button variant="primary" onClick={save}>{L('حفظ', 'Save')}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input className="sm:col-span-2" label={L('الاسم', 'Name')} value={d.title} onChange={(e) => set({ title: e.target.value })} autoFocus={!p} />
        <Textarea className="sm:col-span-2" label={L('الوصف والنتيجة المطلوبة', 'Description & desired outcome')} value={d.description} onChange={(e) => set({ description: e.target.value })} />
        <Select label={L('النوع', 'Type')} value={d.kind} onChange={(e) => set({ kind: e.target.value as ProjectData['kind'] })}>
          <option value="personal">{L('شخصي', 'Personal')}</option><option value="academic">{L('دراسي', 'Academic')}</option><option value="business">{L('تجاري', 'Business')}</option><option value="creative">{L('إبداعي', 'Creative')}</option>
        </Select>
        <Select label={L('الحالة', 'Status')} value={status} onChange={(e) => setStatus(e.target.value)}>{STATUS.map(([v, ar, en]) => <option key={v} value={v}>{L(ar, en)}</option>)}</Select>
        <Input type="date" label={L('البداية', 'Start')} value={d.start ?? ''} onChange={(e) => set({ start: e.target.value || null })} />
        <Input type="date" label={L('الموعد النهائي', 'Deadline')} value={d.due ?? ''} onChange={(e) => set({ due: e.target.value || null })} />
        <Select label={L('الأولوية', 'Priority')} value={String(d.priority)} onChange={(e) => set({ priority: Number(e.target.value) })}><option value="4">{L('عاجل', 'Urgent')}</option><option value="3">{L('مهم', 'High')}</option><option value="2">{L('عادي', 'Normal')}</option><option value="1">{L('منخفض', 'Low')}</option></Select>
        <Select label={L('الهدف', 'Goal')} value={d.goal_id ?? ''} onChange={(e) => set({ goal_id: e.target.value || null })}><option value="">—</option>{(goals ?? []).filter((g) => g.data.horizon !== 'vision').map((g) => <option key={g.id} value={g.id}>{g.data.title}</option>)}</Select>
        <Select label={L('مجال الحياة', 'Life area')} value={d.area ?? ''} onChange={(e) => set({ area: e.target.value || null })}><option value="">—</option>{settings.lifeAreas.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}</Select>
        <Input label={L('الخطوة التالية', 'Next action')} value={d.next_action ?? ''} onChange={(e) => set({ next_action: e.target.value || null })} />
      </div>
    </Modal>
  );
}

function ProjectView({ p, onBack }: { p: Project; onBack: () => void }) {
  const { L, lang, locale } = useI18n();
  const settings = useSettings();
  const nav = useNavigate();
  const tasks = useRecords<TaskData>('task');
  const milestones = useRecords<MilestoneData>('milestone');
  const notes = useRecords<NoteData>('note');
  const [tab, setTab] = useState<'overview' | 'board' | 'timeline'>('overview');
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [ms, setMs] = useState({ title: '', due: '' });
  const [res, setRes] = useState({ title: '', url: '' });
  const mine = useMemo(() => (tasks ?? []).filter((t) => t.data.project_id === p.id && t.status !== 'archived'), [tasks, p.id]);
  const myMs = ((milestones ?? []) as Milestone[]).filter((m) => m.data.project_id === p.id).sort((a, b) => (a.data.due ?? '9').localeCompare(b.data.due ?? '9'));
  const myNotes = (notes ?? []).filter((n) => n.data.project_id === p.id);
  const pr = projectProgress(p, tasks ?? [], (milestones ?? []) as Milestone[]);
  const activity = [...mine].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 6);

  const finish = async () => {
    if (!(await confirm(L('تعليم المشروع كمكتمل؟', 'Mark project complete?')))) return;
    await update<ProjectData>(p.id, { status: 'done' });
    await grantXp(`project:${p.id}:done`, 'project', settings, p.data.title);
    toast(L('مشروع مكتمل! 🎉', 'Project complete! 🎉'), { tone: 'reward' });
  };
  const toggleMs = async (m: Milestone) => {
    await update<MilestoneData>(m.id, { data: { done_at: m.data.done_at ? null : new Date().toISOString() }, status: m.data.done_at ? 'open' : 'done' });
    if (!m.data.done_at) await grantXp(`milestone:${m.id}`, 'milestone', settings, m.data.title);
  };
  const aiBreak = async () => {
    try {
      const r = await api<{ result: { milestones: Array<{ title: string; tasks: Array<{ title: string; estimate_min?: number }> }> } }>('/ai/break_project', { input: { title: p.data.title, description: p.data.description } });
      const n = r.result.milestones?.reduce((s, m) => s + m.tasks.length, 0) ?? 0;
      if (!(await confirm(L('اقتراح التقسيم', 'Suggested breakdown'), { message: r.result.milestones.map((m) => `■ ${m.title}\n${m.tasks.map((t) => `  - ${t.title}`).join('\n')}`).join('\n'), okText: L(`أضف ${n} مهمة`, `Add ${n} tasks`) }))) return;
      for (const m of r.result.milestones) {
        const rec = await create<MilestoneData>('milestone', { title: m.title, due: null, done_at: null, project_id: p.id, goal_id: null }, { parent_id: p.id, status: 'open' });
        for (const t of m.tasks) await createTask({ title: t.title, project_id: p.id, milestone_id: rec.id, estimate_min: t.estimate_min ?? null, source: 'ai' });
      }
    } catch (e) { toast((e as Error).message, { tone: 'error' }); }
  };

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-3" icon={lang === 'ar' ? <ArrowRight size={16} /> : <ArrowLeft size={16} />} onClick={onBack}>{L('المشاريع', 'Projects')}</Button>
      <PageHeader title={p.data.title} subtitle={p.data.description}
        actions={<>
          <Button onClick={() => setEditing(true)}>{L('تعديل', 'Edit')}</Button>
          {settings.privacy.ai.enabled && <Button icon={<Sparkles size={15} />} onClick={aiBreak}>{L('قسّمه لمهام', 'Break down')}</Button>}
          {p.status !== 'done' && <Button variant="primary" icon={<CheckCircle2 size={16} />} onClick={finish}>{L('إنهاء', 'Complete')}</Button>}
          <IconButton tone="danger" label={L('حذف', 'Delete')} onClick={async () => { const prev = await remove(p.id); onBack(); undoToast(L('حُذف المشروع (المهام باقية)', 'Project deleted (tasks kept)'), async () => { if (prev) await revertTo(prev); }); }}><Trash2 size={17} /></IconButton>
        </>} />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4"><Stat label={L('التقدم', 'Progress')} value={pr.pct === null ? '—' : `${Math.round(pr.pct * 100)}%`} /><Bar className="mt-2" value={pr.pct ?? 0} max={1} /></Card>
        <Card className="p-4"><Stat label={L('المهام', 'Tasks')} value={`${pr.done}/${pr.total}`} /></Card>
        <Card className="p-4"><Stat label={L('المراحل', 'Milestones')} value={`${pr.msDone}/${pr.msTotal}`} /></Card>
        <Card className="p-4"><Stat label={L('الموعد', 'Deadline')} value={p.data.due ? relativeDay(p.data.due, lang, locale) : '—'} /></Card>
      </div>
      {p.data.next_action && <p className="mb-4 rounded-md bg-surface-2 px-4 py-2.5 text-sm"><b>{L('الخطوة التالية:', 'Next action:')}</b> {p.data.next_action}</p>}
      <Segmented className="mb-4" value={tab} onChange={setTab} options={[{ value: 'overview', label: L('نظرة عامة', 'Overview') }, { value: 'board', label: L('لوحة', 'Board') }, { value: 'timeline', label: L('خط زمني', 'Timeline') }]} />

      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="mb-2 flex items-center"><h2 className="flex-1 text-[13px] font-bold text-fg-2">{L('المهام', 'Tasks')}</h2><Button size="sm" icon={<Plus size={14} />} onClick={() => setNewTaskOpen(true)}>{L('مهمة', 'Task')}</Button></div>
            {mine.length ? <Card className="divide-y divide-line p-1.5">{mine.sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done')).map((t) => <TaskRow key={t.id} task={t} onOpen={setEditTask} />)}</Card> : <EmptyState title={L('أضف أول خطوة', 'Add the first step')} />}
          </div>
          <div className="space-y-4">
            <Card className="p-4">
              <div className="mb-2 flex items-center gap-2 text-[13px] font-bold text-fg-2"><Flag size={15} />{L('المراحل', 'Milestones')}</div>
              <ul className="space-y-1.5">{myMs.map((m) => (
                <li key={m.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!m.data.done_at} onChange={() => toggleMs(m)} className="size-4 accent-[var(--accent)]" aria-label={m.data.title} />
                  <span className={clsx('flex-1', m.data.done_at && 'text-fg-3 line-through')}>{m.data.title}</span>
                  {m.data.due && <span className="num text-[11px] text-fg-3">{fmtDate(m.data.due, locale, { day: 'numeric', month: 'short' })}</span>}
                  <button aria-label={L('حذف', 'Delete')} className="text-fg-3" onClick={() => remove(m.id)}><X size={13} /></button>
                </li>
              ))}</ul>
              <form className="mt-2 flex gap-1.5" onSubmit={async (e) => { e.preventDefault(); if (!ms.title.trim()) return; await create<MilestoneData>('milestone', { title: ms.title.trim(), due: ms.due || null, done_at: null, project_id: p.id, goal_id: null }, { parent_id: p.id, status: 'open', date: ms.due || null }); setMs({ title: '', due: '' }); }}>
                <input className="field h-9 min-h-0 py-1" value={ms.title} onChange={(e) => setMs({ ...ms, title: e.target.value })} placeholder={L('مرحلة…', 'Milestone…')} />
                <input type="date" className="field h-9 min-h-0 w-36 py-1" value={ms.due} onChange={(e) => setMs({ ...ms, due: e.target.value })} aria-label={L('التاريخ', 'Date')} />
                <IconButton type="submit" size="sm" label={L('إضافة', 'Add')}><Plus size={16} /></IconButton>
              </form>
            </Card>
            <Card className="p-4">
              <div className="mb-2 flex items-center gap-2 text-[13px] font-bold text-fg-2"><Link2 size={15} />{L('المصادر', 'Resources')}</div>
              <ul className="space-y-1 text-sm">{p.data.resources.map((r, i) => (
                <li key={i} className="flex items-center gap-2"><a href={r.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-accent hover:underline">{r.title || r.url}</a><button aria-label={L('حذف', 'Delete')} className="text-fg-3" onClick={() => update<ProjectData>(p.id, { data: { resources: p.data.resources.filter((_, j) => j !== i) } })}><X size={13} /></button></li>
              ))}</ul>
              <form className="mt-2 grid gap-1.5" onSubmit={async (e) => { e.preventDefault(); if (!/^https?:\/\//.test(res.url)) { toast(L('رابط يبدأ بـ https://', 'URL must start with https://'), { tone: 'error' }); return; } await update<ProjectData>(p.id, { data: { resources: [...p.data.resources, { title: res.title, url: res.url }] } }); setRes({ title: '', url: '' }); }}>
                <input className="field h-9 min-h-0 py-1" value={res.title} onChange={(e) => setRes({ ...res, title: e.target.value })} placeholder={L('العنوان', 'Title')} />
                <div className="flex gap-1.5"><input className="field h-9 min-h-0 py-1" dir="ltr" value={res.url} onChange={(e) => setRes({ ...res, url: e.target.value })} placeholder="https://" /><IconButton type="submit" size="sm" label={L('إضافة', 'Add')}><Plus size={16} /></IconButton></div>
              </form>
            </Card>
            <Card className="p-4">
              <div className="mb-2 flex items-center text-[13px] font-bold text-fg-2"><span className="flex-1">{L('الملاحظات', 'Notes')}</span>
                <button className="text-accent" onClick={async () => { const n = await create<NoteData>('note', { title: p.data.title, body: '', folder_id: null, tags: [], note_type: 'project', pinned: false, favorite: false, para: 'project', project_id: p.id }); nav(`/life/notes?open=${n.id}`); }}>+</button></div>
              <ul className="space-y-1 text-sm">{myNotes.map((n) => <li key={n.id}><button className="text-start hover:text-accent" onClick={() => nav(`/life/notes?open=${n.id}`)}>{n.data.title || '—'}</button></li>)}</ul>
            </Card>
            {activity.length > 0 && <Card className="p-4"><div className="mb-2 text-[13px] font-bold text-fg-2">{L('آخر نشاط', 'Recent activity')}</div><ul className="space-y-1 text-[12.5px] text-fg-2">{activity.map((t) => <li key={t.id}>{t.status === 'done' ? '✓' : '•'} {t.data.title} <span className="text-fg-3">· {relativeDay(t.updated_at.slice(0, 10), lang, locale)}</span></li>)}</ul></Card>}
          </div>
        </div>
      )}

      {tab === 'board' && (
        <div className="grid gap-3 md:grid-cols-3">
          {([['todo', 'للإنجاز', 'To do'], ['doing', 'قيد العمل', 'Doing'], ['done', 'منجزة', 'Done']] as const).map(([s, ar, en]) => (
            <Card key={s} className="p-2">
              <div className="mb-2 px-1.5 text-[13px] font-bold text-fg-2">{L(ar, en)} · {mine.filter((t) => (t.status === 'done' ? 'done' : t.status === 'doing' ? 'doing' : 'todo') === s).length}</div>
              {mine.filter((t) => (t.status === 'done' ? 'done' : t.status === 'doing' ? 'doing' : 'todo') === s).map((t) => (
                <div key={t.id} className="mb-1.5 rounded-sm border border-line bg-elevated">
                  <TaskRow task={t} onOpen={setEditTask} />
                  {s !== 'done' && <div className="flex justify-end gap-1 px-2 pb-1.5">{s === 'todo' && <Button size="sm" variant="ghost" onClick={() => update(t.id, { status: 'doing' })}>{L('ابدأ', 'Start')} →</Button>}{s === 'doing' && <Button size="sm" variant="ghost" onClick={() => update(t.id, { status: 'todo' })}>← {L('رجّع', 'Back')}</Button>}</div>}
                </div>
              ))}
            </Card>
          ))}
        </div>
      )}

      {tab === 'timeline' && (
        <Card className="p-4">
          {!myMs.length && !mine.some((t) => t.data.due) ? <p className="text-sm text-fg-2">{L('أضف تواريخ للمراحل والمهام لتظهر هنا.', 'Add dates to milestones and tasks to see them here.')}</p> : (
            <ol className="relative space-y-3 border-s-2 border-line ps-5">
              {[...myMs.filter((m) => m.data.due).map((m) => ({ k: m.id, d: m.data.due!, t: `🏁 ${m.data.title}`, done: !!m.data.done_at })),
                ...mine.filter((t) => t.data.due).map((t) => ({ k: t.id, d: t.data.due!, t: t.data.title, done: t.status === 'done' }))]
                .sort((a, b) => a.d.localeCompare(b.d)).map((x) => (
                  <li key={x.k} className="relative">
                    <span className={clsx('absolute -start-[27px] top-1 size-3 rounded-full border-2 border-surface', x.done ? 'bg-success' : x.d < todayKey() ? 'bg-danger' : 'bg-accent')} />
                    <div className="num text-[12px] text-fg-3">{fmtDate(x.d, locale, { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                    <div className={clsx('text-sm font-bold', x.done && 'text-fg-3 line-through')}>{x.t}</div>
                  </li>
                ))}
            </ol>
          )}
        </Card>
      )}

      <TaskEditor task={editTask} open={!!editTask || newTaskOpen} defaults={{ project_id: p.id, area: p.data.area }} onOpenChange={(v) => { if (!v) { setEditTask(null); setNewTaskOpen(false); } }} />
      {editing && <ProjectEditor p={p} onClose={() => setEditing(false)} />}
      <span className="hidden"><Chip>{''}</Chip></span>
    </div>
  );
}
