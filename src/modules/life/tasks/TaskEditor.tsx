import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, X, Archive, RotateCcw, Copy } from 'lucide-react';
import type { Rec } from '@shared/records';
import { useI18n } from '@/core/i18n';
import { useRecords, useSettings } from '@/core/hooks';
import { newId } from '@/core/ids';
import { remove, revertTo, update } from '@/core/repo';
import { undoToast, toast } from '@/core/toast';
import { describeRecurrence, type Recurrence } from '@/core/recurrence';
import { Modal } from '@/design/overlay';
import { Button, Chip, IconButton, Input, Label, Select, Switch, Textarea } from '@/design/ui';
import { PRIORITY, blankTask, createTask, saveTask, taskDay, type Task, type TaskData, type TaskStatus } from './model';

const WD_AR = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];
const WD_EN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function TaskEditor({ task, open, onOpenChange, defaults }: { task: Task | null; open: boolean; onOpenChange: (v: boolean) => void; defaults?: Partial<TaskData> }) {
  const { L, lang } = useI18n();
  const settings = useSettings();
  const projects = useRecords<{ title: string }>('project');
  const goals = useRecords<{ title: string }>('goal');
  const courses = useRecords<{ name: string; code?: string }>('course');
  const allTasks = useRecords<TaskData>('task');
  const [d, setD] = useState<TaskData>(() => blankTask(defaults));
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [sub, setSub] = useState('');
  const [tag, setTag] = useState('');
  const [cfKey, setCfKey] = useState('');
  const [cfVal, setCfVal] = useState('');

  useEffect(() => {
    if (!open) return;
    setD(task ? { ...blankTask(), ...task.data } : blankTask({ priority: settings.tasks.defaultPriority, ...defaults }));
    setStatus((task?.status as TaskStatus) ?? 'todo');
    setSub(''); setTag('');
  }, [open, task, defaults, settings.tasks.defaultPriority]);

  const set = <K extends keyof TaskData>(k: K, v: TaskData[K]) => setD((p) => ({ ...p, [k]: v }));
  const rec = d.recurrence;
  const setRec = (r: Partial<Recurrence> | null) => set('recurrence', r === null ? null : { ...(rec ?? { freq: 'daily', interval: 1 }), ...r } as Recurrence);

  const depOptions = useMemo(() => (allTasks ?? []).filter((t) => t.id !== task?.id && t.status !== 'done').slice(0, 200), [allTasks, task?.id]);

  const save = async () => {
    if (!d.title.trim()) { toast(L('اكتب عنوان المهمة', 'Add a title'), { tone: 'error' }); return; }
    if (d.recurrence && !taskDay(d)) d.start = new Date().toISOString().slice(0, 10);
    const activity = [...(d.activity ?? []), { at: new Date().toISOString(), what: task ? 'edited' : 'created' }].slice(-30);
    if (task) await saveTask(task.id, { ...d, activity }, { status });
    else await createTask({ ...d, activity }, status === 'done' ? 'todo' : status);
    onOpenChange(false);
  };

  const del = async () => {
    if (!task) return;
    const prev = await remove(task.id);
    onOpenChange(false);
    undoToast(L('حُذفت المهمة', 'Task deleted'), async () => { if (prev) await revertTo(prev); });
  };

  const duplicate = async () => {
    await createTask({ ...d, title: `${d.title} (${L('نسخة', 'copy')})`, completed_at: null, history: [] });
    toast(L('تم النسخ', 'Duplicated'));
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      wide
      panel
      title={task ? L('تعديل المهمة', 'Edit task') : L('مهمة جديدة', 'New task')}
      footer={
        <>
          {task && (
            <div className="me-auto flex gap-1">
              <IconButton label={L('حذف', 'Delete')} tone="danger" onClick={del}><Trash2 size={17} /></IconButton>
              <IconButton label={L('نسخ', 'Duplicate')} onClick={duplicate}><Copy size={17} /></IconButton>
              {task.status !== 'archived'
                ? <IconButton label={L('أرشفة', 'Archive')} onClick={async () => { await update(task.id, { status: 'archived' }); onOpenChange(false); toast(L('أُرشفت', 'Archived')); }}><Archive size={17} /></IconButton>
                : <IconButton label={L('استعادة', 'Restore')} onClick={async () => { await update(task.id, { status: 'todo' }); onOpenChange(false); }}><RotateCcw size={17} /></IconButton>}
            </div>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{L('إلغاء', 'Cancel')}</Button>
          <Button variant="primary" onClick={save}>{L('حفظ', 'Save')}</Button>
        </>
      }
    >
      <div className="space-y-4" onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void save(); }}>
        <Input value={d.title} onChange={(e) => set('title', e.target.value)} placeholder={L('ماذا تريد أن تنجز؟', 'What needs doing?')} aria-label={L('العنوان', 'Title')} autoFocus={!task} className="[&_input]:text-base [&_input]:font-bold" />
        {d.capture_text && d.capture_text !== d.title && <p className="text-[12px] text-fg-3">{L('النص الأصلي:', 'Original:')} {d.capture_text}</p>}
        <Textarea value={d.notes} onChange={(e) => set('notes', e.target.value)} placeholder={L('تفاصيل، روابط، ملاحظات… (Markdown مدعوم)', 'Details, links, notes… (Markdown)')} aria-label={L('الوصف', 'Description')} />

        <div>
          <Label>{L('الأولوية', 'Priority')}</Label>
          <div className="flex flex-wrap gap-1.5">
            {PRIORITY.map((p) => (
              <Chip key={p.v} active={d.priority === p.v} onClick={() => set('priority', p.v)}>
                <span className="size-2 rounded-full" style={{ background: p.color }} /> {L(p.ar, p.en)}
              </Chip>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Input type="date" label={L('موعد العمل', 'Scheduled')} value={d.start ?? ''} onChange={(e) => set('start', e.target.value || null)} />
          <Input type="time" label={L('الوقت', 'Time')} value={d.start_time ?? ''} onChange={(e) => set('start_time', e.target.value || null)} />
          <Input type="number" min={5} step={5} label={L('المدة (د)', 'Duration (min)')} value={d.duration_min ?? ''} onChange={(e) => set('duration_min', e.target.value ? Number(e.target.value) : null)} />
          <Input type="number" min={5} step={5} label={L('التقدير (د)', 'Estimate (min)')} value={d.estimate_min ?? ''} onChange={(e) => set('estimate_min', e.target.value ? Number(e.target.value) : null)} />
          <Input type="date" label={L('الموعد النهائي', 'Deadline')} value={d.due ?? ''} onChange={(e) => set('due', e.target.value || null)} />
          <Input type="time" label={L('وقت التسليم', 'Due time')} value={d.due_time ?? ''} onChange={(e) => set('due_time', e.target.value || null)} />
          <Select label={L('الحالة', 'Status')} value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
            <option value="inbox">{L('الوارد', 'Inbox')}</option>
            <option value="todo">{L('للإنجاز', 'To do')}</option>
            <option value="doing">{L('قيد العمل', 'In progress')}</option>
            <option value="done">{L('منجزة', 'Done')}</option>
          </Select>
          <Select label={L('تذكير', 'Reminder')} value={d.reminder_min ?? ''} onChange={(e) => set('reminder_min', e.target.value === '' ? null : Number(e.target.value))}>
            <option value="">{L('بدون', 'None')}</option>
            <option value="0">{L('وقت المهمة', 'At time')}</option>
            <option value="10">{L('قبل 10 د', '10 min before')}</option>
            <option value="30">{L('قبل 30 د', '30 min before')}</option>
            <option value="60">{L('قبل ساعة', '1 hour before')}</option>
          </Select>
        </div>
        <p className="-mt-2 text-[12px] text-fg-3">{L('موعد العمل = متى ستشتغل عليها. الموعد النهائي لا يتحرك تلقائياً أبداً.', 'Scheduled = when you will work on it. Deadlines never move automatically.')}</p>

        {/* recurrence */}
        <div className="rounded-md border border-line p-3">
          <Switch checked={!!rec} onChange={(v) => setRec(v ? { freq: 'daily', interval: 1 } : null)} label={L('تكرار', 'Repeat')} hint={rec ? describeRecurrence(rec, lang) : undefined} />
          {rec && (
            <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Select label={L('كل', 'Every')} value={rec.freq} onChange={(e) => setRec({ freq: e.target.value as Recurrence['freq'] })}>
                <option value="daily">{L('يوم', 'Day')}</option>
                <option value="weekly">{L('أسبوع', 'Week')}</option>
                <option value="monthly">{L('شهر', 'Month')}</option>
                <option value="yearly">{L('سنة', 'Year')}</option>
              </Select>
              <Input type="number" min={1} label={L('الفاصل', 'Interval')} value={rec.interval} onChange={(e) => setRec({ interval: Math.max(1, Number(e.target.value) || 1) })} />
              <Input type="date" label={L('ينتهي', 'Ends')} value={rec.until ?? ''} onChange={(e) => setRec({ until: e.target.value || null })} />
              <div className="flex items-end"><Switch checked={!!rec.afterCompletion} onChange={(v) => setRec({ afterCompletion: v })} label={L('بعد الإنجاز', 'After completion')} /></div>
              {(rec.freq === 'weekly' || rec.freq === 'daily') && (
                <div className="col-span-full flex gap-1.5">
                  {(lang === 'ar' ? WD_AR : WD_EN).map((w, i) => (
                    <button key={i} aria-pressed={rec.weekdays?.includes(i)} onClick={() => {
                      const cur = new Set(rec.weekdays ?? []);
                      if (cur.has(i)) cur.delete(i); else cur.add(i);
                      setRec({ weekdays: [...cur].sort() });
                    }} className={`size-9 rounded-full border text-sm font-bold ${rec.weekdays?.includes(i) ? 'border-accent bg-accent text-on-accent' : 'border-line text-fg-2'}`}>{w}</button>
                  ))}
                </div>
              )}
              {!!rec.exceptions?.length && (
                <div className="col-span-full flex flex-wrap gap-1 text-[12px] text-fg-3">{L('مستثناة:', 'Skipped:')} {rec.exceptions.map((x) => <Chip key={x} onClick={() => setRec({ exceptions: rec.exceptions!.filter((y) => y !== x) })}>{x} <X size={11} /></Chip>)}</div>
              )}
            </div>
          )}
        </div>

        {/* subtasks */}
        <div>
          <Label>{L('مهام فرعية', 'Subtasks')}</Label>
          <ul className="space-y-1">
            {d.subtasks.map((s, i) => (
              <li key={s.id} className="flex items-center gap-2">
                <input type="checkbox" checked={s.done} onChange={() => set('subtasks', d.subtasks.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))} className="size-4 accent-[var(--accent)]" aria-label={s.title} />
                <input className="field h-9 min-h-0 flex-1 py-1" value={s.title} onChange={(e) => set('subtasks', d.subtasks.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                <IconButton size="sm" label={L('حذف', 'Remove')} onClick={() => set('subtasks', d.subtasks.filter((_, j) => j !== i))}><X size={15} /></IconButton>
              </li>
            ))}
          </ul>
          <form className="mt-1.5 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!sub.trim()) return; set('subtasks', [...d.subtasks, { id: newId('s'), title: sub.trim(), done: false }]); setSub(''); }}>
            <input className="field h-9 min-h-0 py-1" value={sub} onChange={(e) => setSub(e.target.value)} placeholder={L('أضف خطوة…', 'Add a step…')} />
            <IconButton type="submit" label={L('إضافة', 'Add')}><Plus size={18} /></IconButton>
          </form>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Select label={L('التصنيف', 'Category')} value={d.category ?? ''} onChange={(e) => set('category', e.target.value || null)}>
            <option value="">—</option>
            {settings.categories.tasks.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select label={L('مجال الحياة', 'Life area')} value={d.area ?? ''} onChange={(e) => set('area', e.target.value || null)}>
            <option value="">—</option>
            {settings.lifeAreas.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
          </Select>
          <Select label={L('المشروع', 'Project')} value={d.project_id ?? ''} onChange={(e) => set('project_id', e.target.value || null)}>
            <option value="">—</option>
            {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.data.title}</option>)}
          </Select>
          <Select label={L('الهدف', 'Goal')} value={d.goal_id ?? ''} onChange={(e) => set('goal_id', e.target.value || null)}>
            <option value="">—</option>
            {(goals ?? []).map((g) => <option key={g.id} value={g.id}>{g.data.title}</option>)}
          </Select>
          <Select label={L('المقرر', 'Course')} value={d.course_id ?? ''} onChange={(e) => set('course_id', e.target.value || null)}>
            <option value="">—</option>
            {(courses ?? []).map((c) => <option key={c.id} value={c.id}>{c.data.code ? `${c.data.code} · ` : ''}{c.data.name}</option>)}
          </Select>
          <Select label={L('تعتمد على', 'Depends on')} value="" onChange={(e) => { if (e.target.value && !d.depends_on.includes(e.target.value)) set('depends_on', [...d.depends_on, e.target.value]); }}>
            <option value="">{L('أضف مهمة سابقة…', 'Add a prerequisite…')}</option>
            {depOptions.map((t) => <option key={t.id} value={t.id}>{t.data.title}</option>)}
          </Select>
        </div>
        {!!d.depends_on.length && (
          <div className="flex flex-wrap gap-1.5">
            {d.depends_on.map((id) => {
              const t = (allTasks as Array<Rec<TaskData>> | undefined)?.find((x) => x.id === id);
              return <Chip key={id} onClick={() => set('depends_on', d.depends_on.filter((x) => x !== id))}>{t?.data.title ?? id} <X size={11} /></Chip>;
            })}
          </div>
        )}

        <div>
          <Label>{L('وسوم', 'Tags')}</Label>
          <div className="flex flex-wrap items-center gap-1.5">
            {d.tags.map((t) => <Chip key={t} onClick={() => set('tags', d.tags.filter((x) => x !== t))}>#{t} <X size={11} /></Chip>)}
            <input className="field h-8 min-h-0 w-36 py-1 text-[13px]" value={tag} onChange={(e) => setTag(e.target.value)} placeholder={L('وسم + Enter', 'tag + Enter')}
              onKeyDown={(e) => { if (e.key === 'Enter' && tag.trim()) { e.preventDefault(); set('tags', [...new Set([...d.tags, tag.trim().replace(/^#/, '')])]); setTag(''); } }} />
          </div>
        </div>

        <div>
          <Label>{L('حقول مخصصة', 'Custom fields')}</Label>
          {Object.entries(d.custom ?? {}).map(([k, v]) => (
            <div key={k} className="mb-1 flex items-center gap-2 text-sm"><span className="font-bold">{k}:</span><span className="flex-1">{v}</span>
              <IconButton size="sm" label={L('حذف', 'Remove')} onClick={() => { const c = { ...(d.custom ?? {}) }; delete c[k]; set('custom', c); }}><X size={14} /></IconButton></div>
          ))}
          <div className="flex gap-2">
            <input className="field h-9 min-h-0 py-1" placeholder={L('الحقل', 'Field')} value={cfKey} onChange={(e) => setCfKey(e.target.value)} />
            <input className="field h-9 min-h-0 py-1" placeholder={L('القيمة', 'Value')} value={cfVal} onChange={(e) => setCfVal(e.target.value)} />
            <IconButton label={L('إضافة', 'Add')} onClick={() => { if (!cfKey.trim()) return; set('custom', { ...(d.custom ?? {}), [cfKey.trim()]: cfVal }); setCfKey(''); setCfVal(''); }}><Plus size={18} /></IconButton>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-6">
          <Switch checked={d.pinned} onChange={(v) => set('pinned', v)} label={L('تثبيت', 'Pin')} />
          <Switch checked={d.favorite} onChange={(v) => set('favorite', v)} label={L('مفضلة', 'Favorite')} />
        </div>

        {task && (
          <details className="text-[12px] text-fg-3">
            <summary className="cursor-pointer">{L('السجل', 'Activity')}</summary>
            <ul className="mt-1 space-y-0.5">
              <li>{L('أُنشئت', 'Created')} {new Date(task.created_at).toLocaleString()}</li>
              {d.history?.map((h) => <li key={h.at}>✓ {h.date}</li>)}
              {d.completed_at && <li>{L('أُنجزت', 'Completed')} {new Date(d.completed_at).toLocaleString()}</li>}
              {d.activity?.slice(-8).map((a) => <li key={a.at}>{a.what} · {new Date(a.at).toLocaleString()}</li>)}
            </ul>
          </details>
        )}
      </div>
    </Modal>
  );
}
