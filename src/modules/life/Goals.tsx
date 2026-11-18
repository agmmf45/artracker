import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { Plus, Target, Trash2, Check, Sparkles, Image as ImageIcon } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useRecords, useRecordsInRange, useSettings } from '@/core/hooks';
import { create, remove, revertTo, update } from '@/core/repo';
import { shiftKey, todayKey, relativeDay } from '@/core/dates';
import { grantXp } from '@/core/xp';
import { undoToast, toast } from '@/core/toast';
import { Modal } from '@/design/overlay';
import { Bar, Button, Card, Chip, EmptyState, IconButton, Input, PageHeader, Segmented, Select, Textarea } from '@/design/ui';
import { goalProgress, HORIZONS, type Goal, type GoalData, type Milestone, type MilestoneData, type ProjectData } from './goals/model';
import { consistency, indexLogs, type HabitData, type HabitLogData } from './habits/model';
import type { TaskData } from './tasks/model';

const blank = (p: Partial<GoalData> = {}): GoalData => ({ title: '', description: '', why: '', area: null, horizon: 'year', progress_mode: 'tasks', target: null, current: null, unit: null, due: null, habit_ids: [], image_url: null, ...p });

export default function Goals() {
  const { L, lang, locale } = useI18n();
  const settings = useSettings();
  const nav = useNavigate();
  const goals = useRecords<GoalData>('goal');
  const tasks = useRecords<TaskData>('task');
  const milestones = useRecords<MilestoneData>('milestone');
  const projects = useRecords<ProjectData>('project');
  const habits = useRecords<HabitData>('habit');
  const logs = useRecordsInRange<HabitLogData>('habit_log', shiftKey(todayKey(), -31), todayKey());
  const [tab, setTab] = useState<'goals' | 'vision' | 'done'>('goals');
  const [area, setArea] = useState('');
  const [editing, setEditing] = useState<Goal | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    const id = params.get('open');
    if (id && goals) { const g = goals.find((x) => x.id === id); if (g) setEditing(g); params.delete('open'); setParams(params, { replace: true }); }
  }, [params, goals, setParams]);

  const idx = useMemo(() => indexLogs(logs), [logs]);
  const progress = (g: Goal) => {
    const hc = g.data.habit_ids.length ? g.data.habit_ids.map((id) => { const h = habits?.find((x) => x.id === id); return h ? consistency(h.data, idx.get(id), 30) : 0; }).reduce((a, b) => a + b, 0) / g.data.habit_ids.length : undefined;
    return goalProgress(g, tasks ?? [], (milestones ?? []) as Milestone[], hc);
  };

  const list = (goals ?? []).filter((g) => (tab === 'done' ? g.status === 'done' : tab === 'vision' ? g.data.horizon === 'vision' : g.status !== 'done' && g.data.horizon !== 'vision') && (!area || g.data.area === area));
  const grouped = HORIZONS.map(([h, ar, en]) => ({ h, label: L(ar, en), list: list.filter((g) => g.data.horizon === h) })).filter((x) => x.list.length);

  const complete = async (g: Goal) => {
    const prev = await update<GoalData>(g.id, { status: 'done' });
    await grantXp(`goal:${g.id}:done`, 'milestone', settings, g.data.title);
    undoToast(L('مبروك! هدف محقق 🎯', 'Goal achieved 🎯'), async () => { if (prev) await revertTo(prev as never); });
  };

  return (
    <div>
      <PageHeader title={L('الأهداف', 'Goals')} subtitle={L('الرؤية ← مجال الحياة ← هدف ← مشروع ← مرحلة ← مهمة', 'Vision → Life area → Goal → Project → Milestone → Task')}
        actions={<Button variant="primary" icon={<Plus size={17} />} onClick={() => { setIsNew(true); setEditing({ data: blank({ horizon: tab === 'vision' ? 'vision' : 'year' }) } as Goal); }}>{tab === 'vision' ? L('رؤية', 'Vision') : L('هدف', 'Goal')}</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'goals', label: L('الأهداف', 'Goals') }, { value: 'vision', label: L('لوحة الرؤية', 'Vision board') }, { value: 'done', label: L('المحققة', 'Achieved') }]} />
        <div className="flex flex-wrap gap-1.5">
          <Chip active={!area} onClick={() => setArea('')}>{L('كل المجالات', 'All areas')}</Chip>
          {settings.lifeAreas.map((a) => <Chip key={a.id} active={area === a.id} onClick={() => setArea(a.id)}>{a.icon} {a.name}</Chip>)}
        </div>
      </div>

      {tab === 'vision' ? (
        !list.length ? <EmptyState icon={<Sparkles size={30} />} title={L('لوحة رؤيتك', 'Your vision board')} hint={L('جمل وصور عن الحياة التي تريد بناءها. اختيارية تماماً.', 'Statements and images about the life you want to build. Entirely optional.')} /> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((g) => (
              <button key={g.id} onClick={() => { setIsNew(false); setEditing(g); }} className="card overflow-hidden text-start hover:border-line-strong">
                {g.data.image_url && <img src={g.data.image_url} alt="" className="aspect-video w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />}
                <div className="p-4"><div className="font-display text-xl leading-snug">{g.data.title}</div>{g.data.description && <p className="mt-1 text-sm text-fg-2">{g.data.description}</p>}</div>
              </button>
            ))}
          </div>
        )
      ) : !list.length ? (
        <EmptyState icon={<Target size={30} />} title={tab === 'done' ? L('لم تحقق أهدافاً بعد — قريباً.', 'No achieved goals yet — soon.') : L('هدف واحد واضح أفضل من عشرة غامضة.', 'One clear goal beats ten vague ones.')} />
      ) : (
        <div className="space-y-5">
          {grouped.map(({ h, label, list: gs }) => (
            <section key={h}>
              <h2 className="mb-2 text-[13px] font-bold text-fg-2">{label}</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {gs.map((g) => {
                  const p = progress(g);
                  const a = settings.lifeAreas.find((x) => x.id === g.data.area);
                  const linkedProjects = (projects ?? []).filter((x) => x.data.goal_id === g.id);
                  return (
                    <Card key={g.id} className="p-4">
                      <div className="flex items-start gap-2">
                        <button className="min-w-0 flex-1 text-start" onClick={() => { setIsNew(false); setEditing(g); }}>
                          <div className="text-[12px] text-fg-3">{a ? `${a.icon} ${a.name}` : ''}{g.data.due ? ` · ${relativeDay(g.data.due, lang, locale)}` : ''}</div>
                          <div className="font-bold">{g.data.title}</div>
                          {g.data.why && <p className="mt-0.5 line-clamp-2 text-[13px] text-fg-2">{g.data.why}</p>}
                        </button>
                        {g.status !== 'done' && <IconButton size="sm" label={L('تحقق', 'Achieved')} onClick={() => complete(g)}><Check size={17} /></IconButton>}
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <Bar value={p ?? 0} max={1} className="flex-1" />
                        <span className="num w-20 text-end text-[12px] text-fg-2">{p === null ? L('بدون قياس', 'no measure') : g.data.progress_mode === 'measure' ? `${g.data.current ?? 0}/${g.data.target} ${g.data.unit ?? ''}` : `${Math.round(p * 100)}%`}</span>
                      </div>
                      {linkedProjects.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{linkedProjects.map((x) => <Chip key={x.id} onClick={() => nav(`/life/projects?open=${x.id}`)}>📁 {x.data.title}</Chip>)}</div>}
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
      {editing && <GoalEditor goal={editing} isNew={isNew} onClose={() => setEditing(null)} habits={habits ?? []} />}
    </div>
  );
}

function GoalEditor({ goal, isNew, onClose, habits }: { goal: Goal; isNew: boolean; onClose: () => void; habits: Array<{ id: string; data: HabitData }> }) {
  const { L } = useI18n();
  const settings = useSettings();
  const [d, setD] = useState<GoalData>(blank(goal.data));
  const [ms, setMs] = useState('');
  const milestones = useRecords<MilestoneData>('milestone');
  const set = (p: Partial<GoalData>) => setD((x) => ({ ...x, ...p }));
  const mine = (milestones ?? []).filter((m) => m.data.goal_id === goal.id);
  const save = async () => {
    if (!d.title.trim()) { toast(L('اكتب الهدف', 'Write the goal'), { tone: 'error' }); return; }
    if (isNew) await create<GoalData>('goal', d, { status: 'active', date: d.due });
    else await update<GoalData>(goal.id, { data: d, date: d.due });
    onClose();
  };
  const vision = d.horizon === 'vision';
  return (
    <Modal panel open onOpenChange={(v) => !v && onClose()} title={isNew ? (vision ? L('رؤية جديدة', 'New vision') : L('هدف جديد', 'New goal')) : L('تعديل', 'Edit')} wide
      footer={<>
        {!isNew && <IconButton className="me-auto" tone="danger" label={L('حذف', 'Delete')} onClick={async () => { const p = await remove(goal.id); onClose(); undoToast(L('حُذف', 'Deleted'), async () => { if (p) await revertTo(p); }); }}><Trash2 size={17} /></IconButton>}
        <Button variant="ghost" onClick={onClose}>{L('إلغاء', 'Cancel')}</Button><Button variant="primary" onClick={save}>{L('حفظ', 'Save')}</Button>
      </>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input className="sm:col-span-2" label={vision ? L('جملة الرؤية', 'Vision statement') : L('الهدف', 'Goal')} value={d.title} onChange={(e) => set({ title: e.target.value })} autoFocus={isNew} />
        <Textarea className="sm:col-span-2" label={L('الوصف', 'Description')} value={d.description} onChange={(e) => set({ description: e.target.value })} />
        {vision ? (
          <Input className="sm:col-span-2" type="url" dir="ltr" label={<span className="inline-flex items-center gap-1"><ImageIcon size={14} />{L('رابط صورة (اختياري)', 'Image URL (optional)')}</span>} value={d.image_url ?? ''} onChange={(e) => set({ image_url: e.target.value || null })} />
        ) : (
          <>
            <Textarea className="sm:col-span-2" label={L('ليش هذا الهدف مهم لك؟', 'Why does this matter to you?')} value={d.why} onChange={(e) => set({ why: e.target.value })} />
            <Select label={L('الأفق', 'Horizon')} value={d.horizon} onChange={(e) => set({ horizon: e.target.value as GoalData['horizon'] })}>{HORIZONS.map(([v, ar, en]) => <option key={v} value={v}>{L(ar, en)}</option>)}</Select>
            <Select label={L('مجال الحياة', 'Life area')} value={d.area ?? ''} onChange={(e) => set({ area: e.target.value || null })}><option value="">—</option>{settings.lifeAreas.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}</Select>
            <Input type="date" label={L('الموعد المستهدف', 'Target date')} value={d.due ?? ''} onChange={(e) => set({ due: e.target.value || null })} />
            <Select label={L('كيف نقيس التقدم', 'Progress from')} value={d.progress_mode} onChange={(e) => set({ progress_mode: e.target.value as GoalData['progress_mode'] })}>
              <option value="tasks">{L('المهام المرتبطة', 'Linked tasks')}</option><option value="milestones">{L('المراحل', 'Milestones')}</option><option value="measure">{L('رقم أقيسه', 'A number I track')}</option><option value="habits">{L('عادات مرتبطة', 'Linked habits')}</option>
            </Select>
            {d.progress_mode === 'measure' && (
              <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                <Input type="number" label={L('الحالي', 'Current')} value={d.current ?? ''} onChange={(e) => set({ current: e.target.value === '' ? null : Number(e.target.value) })} />
                <Input type="number" label={L('الهدف', 'Target')} value={d.target ?? ''} onChange={(e) => set({ target: e.target.value === '' ? null : Number(e.target.value) })} />
                <Input label={L('الوحدة', 'Unit')} value={d.unit ?? ''} onChange={(e) => set({ unit: e.target.value || null })} />
              </div>
            )}
            {d.progress_mode === 'habits' && (
              <div className="flex flex-wrap gap-1.5 sm:col-span-2">{habits.map((h) => <Chip key={h.id} active={d.habit_ids.includes(h.id)} onClick={() => set({ habit_ids: d.habit_ids.includes(h.id) ? d.habit_ids.filter((x) => x !== h.id) : [...d.habit_ids, h.id] })}>{h.data.icon} {h.data.name}</Chip>)}</div>
            )}
            {!isNew && d.progress_mode === 'milestones' && (
              <div className="sm:col-span-2">
                <ul className="mb-2 space-y-1">{mine.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={!!m.data.done_at} onChange={async () => { await update<MilestoneData>(m.id, { data: { done_at: m.data.done_at ? null : new Date().toISOString() }, status: m.data.done_at ? 'open' : 'done' }); if (!m.data.done_at) await grantXp(`milestone:${m.id}`, 'milestone', settings, m.data.title); }} />
                    <span className={m.data.done_at ? 'text-fg-3 line-through' : ''}>{m.data.title}</span>
                  </li>
                ))}</ul>
                <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (!ms.trim()) return; await create<MilestoneData>('milestone', { title: ms.trim(), due: null, done_at: null, project_id: null, goal_id: goal.id }, { parent_id: goal.id, status: 'open' }); setMs(''); }}>
                  <input className="field" value={ms} onChange={(e) => setMs(e.target.value)} placeholder={L('مرحلة جديدة…', 'New milestone…')} /><IconButton type="submit" label={L('إضافة', 'Add')}><Plus size={18} /></IconButton>
                </form>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
