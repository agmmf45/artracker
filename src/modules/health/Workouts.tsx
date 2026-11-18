import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Play, Plus, Trash2, Check, X, Timer, Trophy, Dumbbell, ListPlus, Square, ChevronDown, ChevronUp, Image as ImageIcon } from 'lucide-react';
import clsx from 'clsx';
import type { Rec } from '@shared/records';
import { useI18n } from '@/core/i18n';
import { useNow, useRecords, useSettings } from '@/core/hooks';
import { db, setMeta } from '@/core/db';
import { create, remove, revertTo, update } from '@/core/repo';
import { newId } from '@/core/ids';
import { dateKey, fmtDate, rangeKeys, shiftKey, todayKey, weekStartKey } from '@/core/dates';
import { grantXp } from '@/core/xp';
import { api } from '@/core/api';
import { toast, undoToast } from '@/core/toast';
import { confirm, Modal, prompt } from '@/design/overlay';
import { Button, Card, Chip, EmptyState, IconButton, Input, PageHeader, Section, Segmented, Stat } from '@/design/ui';
import { Bars } from '@/design/charts';
import { MuscleMap, MUSCLES } from './MuscleMap';
import { bestSets, e1rm, EXDB, EXERCISES, num, setsPerMuscle, TEMPLATES, volume, type ActiveWorkout, type ProgramData, type WExercise, type Workout, type WorkoutData } from './workouts/model';

const muscleName = (id: string, L: (a: string, e: string) => string) => { const m = MUSCLES.find((x) => x.id === id); return m ? L(m.ar, m.en) : id; };

export default function Workouts() {
  const { L, lang, locale, fmtNum } = useI18n();
  const settings = useSettings();
  const workouts = useRecords<WorkoutData>('workout') as Workout[] | undefined;
  const programs = useRecords<ProgramData>('program');
  const legacyPrs = useRecords<{ exercise: string; weight: number; reps: number }>('pr');
  const active = useLiveQuery(() => db().meta.get('workout_active').then((r) => (r?.value as ActiveWorkout | null) ?? null), []);
  const [params, setParams] = useSearchParams();
  const [muscle, setMuscle] = useState<string | null>(null);
  const [range, setRange] = useState<7 | 30>(7);
  const [progEdit, setProgEdit] = useState<Rec<ProgramData> | 'new' | null>(null);
  const [detail, setDetail] = useState<Workout | null>(null);
  const today = todayKey();

  const start = async (name: string, program_id: string | null = null, exercises: WExercise[] = []) => {
    if (active && !(await confirm(L('عندك تمرين جارٍ. تبدأ جديداً؟', 'A workout is in progress. Start a new one?'), { message: L('التمرين الحالي سيُلغى بدون حفظ.', 'The current one is discarded without saving.'), danger: true }))) return;
    await setMeta('workout_active', { name, program_id, started_at: new Date().toISOString(), exercises, rest_until: null, rest_ex: null } satisfies ActiveWorkout);
  };
  useEffect(() => { if (params.get('start') && active === null) { params.delete('start'); setParams(params, { replace: true }); void start(L('تمرين', 'Workout')); } }, [params, active]); // eslint-disable-line react-hooks/exhaustive-deps

  const prs = useMemo(() => bestSets((workouts ?? []).map((w) => ({ ...w.data, date: w.date })), (legacyPrs ?? []).map((p) => ({ exercise: p.data.exercise, weight: p.data.weight, reps: p.data.reps, date: p.date }))), [workouts, legacyPrs]);
  const recent = (workouts ?? []).filter((w) => (w.date ?? '') >= shiftKey(today, -(range - 1)));
  const intensity = useMemo(() => { const s = setsPerMuscle(recent.map((w) => w.data)); const max = Math.max(1, ...Object.values(s)); return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v / max])); }, [recent]);
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const ws = shiftKey(weekStartKey(today, settings.weekStart), -7 * (7 - i));
    return { label: fmtDate(ws, locale, { day: 'numeric', month: 'numeric' }), value: (workouts ?? []).filter((w) => (w.date ?? '') >= ws && (w.date ?? '') <= shiftKey(ws, 6)).length };
  });

  if (active) return <ActiveSession a={active} prs={prs} />;

  return (
    <div>
      <PageHeader title={L('التمارين', 'Workouts')} actions={<Button variant="primary" icon={<Play size={16} />} onClick={() => start(L('تمرين', 'Workout'))}>{L('ابدأ تمرين', 'Start workout')}</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-4"><Stat label={L('هذا الأسبوع', 'This week')} value={(workouts ?? []).filter((w) => (w.date ?? '') >= weekStartKey(today, settings.weekStart)).length} /></Card>
        <Card className="p-4"><Stat label={L(`حجم آخر ${range} يوم`, `Volume, ${range} days`)} value={`${fmtNum(Math.round(recent.reduce((s, w) => s + volume(w.data), 0)))} kg`} /></Card>
        <Card className="p-4"><Stat label={L('دقائق', 'Minutes')} value={recent.reduce((s, w) => s + (w.data.duration_min || 0), 0)} sub={L(`آخر ${range} يوم`, `last ${range} days`)} /></Card>
        <Card className="p-4"><Stat label={L('أرقام قياسية', 'Personal records')} value={prs.size} /></Card>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="p-4">
          <div className="mb-2 flex items-center"><h2 className="flex-1 text-[13px] font-bold text-fg-2">{L('العضلات المتمرّنة — اضغط عضلة', 'Muscles trained — tap a muscle')}</h2><Segmented size="sm" value={String(range)} onChange={(v) => setRange(Number(v) as 7 | 30)} options={[{ value: '7', label: L('7 أيام', '7d') }, { value: '30', label: L('30 يوم', '30d') }]} /></div>
          <MuscleMap intensity={intensity} onSelect={setMuscle} selected={muscle} />
          <div className="mt-3 flex flex-wrap gap-1.5">{MUSCLES.filter((m) => !['رجل'].includes(m.id)).map((m) => <Chip key={m.id} onClick={() => setMuscle(m.id)}>{L(m.ar, m.en)}{intensity[m.id] ? ' •' : ''}</Chip>)}</div>
        </Card>
        <div className="space-y-4">
          <Card className="p-4">
            <div className="mb-2 text-[13px] font-bold text-fg-2">{L('ابدأ بسرعة', 'Quick start')}</div>
            <div className="grid grid-cols-2 gap-2">
              {Object.keys(TEMPLATES).map((t) => <Button key={t} onClick={() => start(t)}>{t === 'Push' ? '🫷' : t === 'Pull' ? '🫸' : '🦵'} {t}</Button>)}
              <Button onClick={() => start(L('كارديو', 'Cardio'))}>🏃 {L('كارديو', 'Cardio')}</Button>
            </div>
          </Card>
          <Card className="p-4">
            <div className="mb-2 flex items-center"><span className="flex-1 text-[13px] font-bold text-fg-2">{L('برامجي', 'My programs')}</span><Button size="sm" icon={<Plus size={14} />} onClick={() => setProgEdit('new')}>{L('برنامج', 'Program')}</Button></div>
            {!programs?.length ? <p className="text-sm text-fg-3">{L('برنامج متعدد الأيام (Push/Pull/Legs…)', 'Multi-day programs (Push/Pull/Legs…)')}</p> : (
              <ul className="space-y-2">{programs.map((p) => (
                <li key={p.id} className="rounded-sm border border-line p-2">
                  <div className="flex items-center gap-2"><span className="flex-1 font-bold">{p.data.name}</span><IconButton size="sm" label={L('تعديل', 'Edit')} onClick={() => setProgEdit(p)}><ListPlus size={15} /></IconButton></div>
                  <div className="mt-1 flex flex-wrap gap-1">{p.data.days.map((d, i) => <Chip key={i} onClick={() => start(d.name, p.id, d.exercises.map((e) => ({ id: newId('ex'), name: e.name, muscle: e.muscle, notes: '', sets: Array.from({ length: e.sets ?? 3 }, () => ({ reps: e.reps ?? '', weight: '', rpe: '', done: false })) })))}>▶ {d.name}</Chip>)}</div>
                </li>
              ))}</ul>
            )}
          </Card>
        </div>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-4"><div className="mb-2 text-[13px] font-bold text-fg-2">{L('تمارين بالأسبوع (8 أسابيع)', 'Workouts per week (8 weeks)')}</div><Bars data={weeks} height={100} color="var(--health)" /></Card>
        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-bold text-fg-2"><Trophy size={15} className="text-reward" />{L('أرقامي القياسية', 'Personal records')}</div>
          {!prs.size ? <p className="text-sm text-fg-3">{L('أكمل مجموعات بأوزان لتظهر أرقامك.', 'Complete weighted sets to see records.')}</p> : (
            <ul className="max-h-48 space-y-1 overflow-y-auto text-sm scroll-thin">{[...prs.entries()].sort((a, b) => b[1].weight - a[1].weight).map(([n, p]) => <li key={n} className="flex gap-2"><span className="flex-1 truncate">{n}</span><span className="num font-bold">{p.weight}kg × {p.reps}</span><span className="num text-[11px] text-fg-3">~1RM {e1rm(p.weight, p.reps)}</span></li>)}</ul>
          )}
        </Card>
      </div>

      <Section title={L('السجل', 'History')}>
        {!workouts?.length ? <EmptyState icon={<Dumbbell size={28} />} title={L('أول تمرين يبدأ بضغطة', 'Your first workout is one tap away')} /> : (
          <Card className="divide-y divide-line">
            {[...workouts].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || b.data.started_at.localeCompare(a.data.started_at)).slice(0, 40).map((w) => (
              <button key={w.id} onClick={() => setDetail(w)} className="flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-surface-2">
                <Dumbbell size={16} className="text-health" />
                <div className="min-w-0 flex-1"><div className="truncate font-bold">{w.data.name}</div><div className="truncate text-[12px] text-fg-3">{[...new Set(w.data.exercises.map((e) => muscleName(e.muscle, L)))].join('، ')}</div></div>
                <div className="num text-end text-[12px] text-fg-2"><div>{fmtDate(w.date!, locale, { day: 'numeric', month: 'short' })}</div><div>{w.data.duration_min}{L('د', 'm')} · {fmtNum(Math.round(volume(w.data)))}kg</div></div>
              </button>
            ))}
          </Card>
        )}
      </Section>

      {muscle && <MusclePanel muscle={muscle} onClose={() => setMuscle(null)} workouts={workouts ?? []} />}
      {progEdit && <ProgramEditor p={progEdit === 'new' ? null : progEdit} onClose={() => setProgEdit(null)} />}
      {detail && (
        <Modal open onOpenChange={(v) => !v && setDetail(null)} title={`${detail.data.name} · ${fmtDate(detail.date!, locale, { day: 'numeric', month: 'short' })}`}
          footer={<IconButton tone="danger" label={L('حذف', 'Delete')} onClick={async () => { const p = await remove(detail.id); setDetail(null); undoToast(L('حُذف التمرين', 'Workout deleted'), async () => { if (p) await revertTo(p as Rec); }); }}><Trash2 size={17} /></IconButton>}>
          <p className="mb-3 text-sm text-fg-2">{detail.data.duration_min} {L('دقيقة', 'min')} · {L('الحجم', 'volume')} {fmtNum(Math.round(volume(detail.data)))} kg</p>
          {detail.data.exercises.map((e) => (
            <div key={e.id} className="mb-3">
              <div className="font-bold">{e.name} <span className="text-[12px] font-normal text-fg-3">· {muscleName(e.muscle, L)}</span></div>
              <ul className="num text-sm text-fg-2">{e.sets.map((s, i) => <li key={i}>{i + 1}. {s.weight || 0}kg × {s.reps || 0}{s.rpe ? ` @RPE ${s.rpe}` : ''}</li>)}</ul>
              {e.notes && <p className="text-[12px] text-fg-3">{e.notes}</p>}
            </div>
          ))}
        </Modal>
      )}
      <span className="hidden">{lang}</span>
    </div>
  );
}

/** Live session — stored in IndexedDB meta, so a refresh or closed tab never loses it (v4 bug fixed). */
function ActiveSession({ a, prs }: { a: ActiveWorkout; prs: Map<string, { weight: number; reps: number }> }) {
  const { L } = useI18n();
  const settings = useSettings();
  const now = useNow(1000);
  const [pick, setPick] = useState<string | null>(null);
  const [rest, setRest] = useState(90);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const save = (p: Partial<ActiveWorkout>) => setMeta('workout_active', { ...a, ...p });
  const setEx = (id: string, p: Partial<WExercise>) => save({ exercises: a.exercises.map((e) => (e.id === id ? { ...e, ...p } : e)) });
  const elapsed = Math.floor((now.getTime() - Date.parse(a.started_at)) / 1000);
  const restLeft = a.rest_until ? Math.ceil((Date.parse(a.rest_until) - now.getTime()) / 1000) : 0;
  useEffect(() => { if (a.rest_until && restLeft <= 0) { if (navigator.vibrate) navigator.vibrate(200); toast(L('انتهت الراحة — المجموعة التالية', 'Rest over — next set')); void save({ rest_until: null }); } }, [restLeft <= 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const doneSet = async (e: WExercise, i: number) => {
    const sets = e.sets.map((s, j) => (j === i ? { ...s, done: !s.done } : s));
    const s = sets[i];
    await save({ exercises: a.exercises.map((x) => (x.id === e.id ? { ...x, sets } : x)), rest_until: s.done ? new Date(Date.now() + rest * 1000).toISOString() : a.rest_until, rest_ex: e.id });
    const pr = prs.get(e.name);
    if (s.done && num(s.weight) && num(s.reps) && (!pr || num(s.weight) > pr.weight || (num(s.weight) === pr.weight && num(s.reps) > pr.reps))) {
      toast(L(`🎉 رقم قياسي جديد! ${e.name} ${s.weight}كجم × ${s.reps}`, `🎉 New PR! ${e.name} ${s.weight}kg × ${s.reps}`), { tone: 'reward' });
    }
  };
  const finish = async () => {
    const exercises = a.exercises.map((e) => ({ ...e, sets: e.sets.filter((s) => s.done || num(s.reps) || num(s.weight)) })).filter((e) => e.sets.length);
    if (!exercises.length) { toast(L('سجّل مجموعة واحدة على الأقل', 'Log at least one set'), { tone: 'error' }); return; }
    const duration = Math.max(1, Math.round((Date.now() - Date.parse(a.started_at)) / 60000));
    await create<WorkoutData>('workout', { name: a.name, program_id: a.program_id, started_at: a.started_at, duration_min: duration, exercises }, { date: dateKey(new Date(a.started_at)), status: 'done' });
    await setMeta('workout_active', null);
    await grantXp(`workout:${a.started_at}`, 'workout', settings, a.name);
    toast(L(`🎉 تمرين مكتمل! ${duration} دقيقة`, `🎉 Workout complete! ${duration} min`), { tone: 'reward' });
  };
  const cancel = async () => { if (await confirm(L('إلغاء التمرين بدون حفظ؟', 'Discard this workout?'), { danger: true, okText: L('إلغاء التمرين', 'Discard') })) await setMeta('workout_active', null); };
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="sticky top-24 z-10 mb-4 flex items-center gap-3 rounded-md border border-line bg-elevated p-3 shadow-2 lg:top-4">
        <div className="min-w-0 flex-1"><input className="w-full bg-transparent text-lg font-black outline-none" value={a.name} onChange={(e) => save({ name: e.target.value })} aria-label={L('اسم التمرين', 'Workout name')} /><div className="num text-sm text-health"><Timer size={13} className="inline" /> {mmss(elapsed)}</div></div>
        <Button variant="ghost" onClick={cancel}>{L('إلغاء', 'Discard')}</Button>
        <Button variant="primary" icon={<Check size={16} />} onClick={finish}>{L('إنهاء', 'Finish')}</Button>
      </div>
      {a.rest_until && restLeft > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-md bg-[color-mix(in_oklab,var(--health)_15%,transparent)] px-4 py-3">
          <Timer size={18} className="text-health" /><span className="flex-1 font-bold">{L('راحة', 'Rest')}</span>
          <span className="num text-2xl font-black text-health">{mmss(restLeft)}</span>
          <Button size="sm" variant="ghost" onClick={() => save({ rest_until: new Date(Date.parse(a.rest_until!) + 15000).toISOString() })}>+15s</Button>
          <Button size="sm" variant="ghost" onClick={() => save({ rest_until: null })}>{L('تخطَّ', 'Skip')}</Button>
        </div>
      )}
      <div className="mb-3 flex items-center gap-2 text-sm text-fg-2">{L('مدة الراحة', 'Rest time')}: {[60, 90, 120, 180].map((s) => <Chip key={s} active={rest === s} onClick={() => setRest(s)}>{s}s</Chip>)}</div>
      <div className="space-y-3">
        {a.exercises.map((e) => {
          const pr = prs.get(e.name);
          const collapsed = open[e.id] === false;
          return (
            <Card key={e.id} className="p-3">
              <div className="flex items-center gap-2">
                <button className="min-w-0 flex-1 text-start" onClick={() => setOpen({ ...open, [e.id]: collapsed })}>
                  <div className="truncate font-bold">{e.name}</div>
                  <div className="text-[12px] text-fg-3">{muscleName(e.muscle, L)}{pr ? ` · PR ${pr.weight}kg×${pr.reps}` : ''}</div>
                </button>
                {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                <IconButton size="sm" tone="danger" label={L('حذف التمرين', 'Remove exercise')} onClick={() => save({ exercises: a.exercises.filter((x) => x.id !== e.id) })}><X size={15} /></IconButton>
              </div>
              {!collapsed && (
                <>
                  <div className="mt-2 grid grid-cols-[28px_1fr_1fr_64px_40px] items-center gap-1.5 text-[11px] font-bold text-fg-3"><span>#</span><span>{L('الوزن kg', 'Weight kg')}</span><span>{L('التكرار', 'Reps')}</span><span>RPE</span><span /></div>
                  {e.sets.map((s, i) => (
                    <div key={i} className={clsx('mt-1 grid grid-cols-[28px_1fr_1fr_64px_40px] items-center gap-1.5', s.done && 'opacity-70')}>
                      <span className="num text-center text-sm text-fg-3">{i + 1}</span>
                      <input type="number" inputMode="decimal" className="field h-10 min-h-0 py-1 text-center" value={s.weight} onChange={(ev) => setEx(e.id, { sets: e.sets.map((x, j) => (j === i ? { ...x, weight: ev.target.value === '' ? '' : Number(ev.target.value) } : x)) })} aria-label={L('الوزن', 'Weight')} />
                      <input type="number" inputMode="numeric" className="field h-10 min-h-0 py-1 text-center" value={s.reps} onChange={(ev) => setEx(e.id, { sets: e.sets.map((x, j) => (j === i ? { ...x, reps: ev.target.value === '' ? '' : Number(ev.target.value) } : x)) })} aria-label={L('التكرار', 'Reps')} />
                      <input type="number" step="0.5" className="field h-10 min-h-0 py-1 text-center" value={s.rpe} onChange={(ev) => setEx(e.id, { sets: e.sets.map((x, j) => (j === i ? { ...x, rpe: ev.target.value } : x)) })} aria-label="RPE" />
                      <button onClick={() => doneSet(e, i)} aria-label={s.done ? L('إلغاء', 'Undo') : L('تم', 'Done')} className={clsx('grid h-10 place-items-center rounded-sm border', s.done ? 'border-health bg-health text-on-accent' : 'border-line hover:bg-surface-2')}><Check size={17} /></button>
                    </div>
                  ))}
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="subtle" icon={<Plus size={14} />} onClick={() => { const last = e.sets.at(-1); setEx(e.id, { sets: [...e.sets, { reps: last?.reps ?? '', weight: last?.weight ?? '', rpe: last?.rpe ?? '', done: false }] }); }}>{L('مجموعة', 'Set')}</Button>
                    <input className="field h-8 min-h-0 flex-1 py-1 text-[13px]" placeholder={L('ملاحظة…', 'Note…')} value={e.notes} onChange={(ev) => setEx(e.id, { notes: ev.target.value })} />
                  </div>
                </>
              )}
            </Card>
          );
        })}
      </div>
      <Button className="mt-4 w-full" size="lg" icon={<Plus size={17} />} onClick={() => setPick('')}>{L('أضف تمريناً', 'Add exercise')}</Button>
      {pick !== null && (
        <Modal open onOpenChange={(v) => !v && setPick(null)} title={pick ? muscleName(pick, L) : L('اختر العضلة', 'Pick a muscle')}>
          {!pick ? (
            <div className="grid grid-cols-2 gap-2">{MUSCLES.map((m) => <Button key={m.id} onClick={() => setPick(m.id)}>{L(m.ar, m.en)}</Button>)}</div>
          ) : (
            <div className="space-y-1.5">
              {(EXERCISES[pick] ?? []).map((n) => <button key={n} className="block w-full rounded-sm px-3 py-2.5 text-start hover:bg-surface-2" onClick={async () => { await save({ exercises: [...a.exercises, { id: newId('ex'), name: n, muscle: pick, notes: '', sets: [{ reps: '', weight: '', rpe: '', done: false }] }] }); setPick(null); }}>{n}</button>)}
              <form onSubmit={async (ev) => { ev.preventDefault(); const v = (new FormData(ev.currentTarget).get('n') as string).trim(); if (!v) return; await save({ exercises: [...a.exercises, { id: newId('ex'), name: v, muscle: pick, notes: '', sets: [{ reps: '', weight: '', rpe: '', done: false }] }] }); setPick(null); }} className="flex gap-2 pt-2">
                <input name="n" className="field" placeholder={L('تمرين مخصص…', 'Custom exercise…')} /><Button type="submit">{L('أضف', 'Add')}</Button>
              </form>
              <Button variant="ghost" size="sm" onClick={() => setPick('')}>← {L('العضلات', 'Muscles')}</Button>
            </div>
          )}
        </Modal>
      )}
      <span className="hidden"><Square /></span>
    </div>
  );
}

interface ExdbItem { id: string; name: string; target: string; equipment: string; gifUrl?: string; instructions?: string[] }

/** Muscle panel: last trained, quick log, and (when configured) ExerciseDB explorer. All text rendered by React (escaped). */
function MusclePanel({ muscle, onClose, workouts }: { muscle: string; onClose: () => void; workouts: Workout[] }) {
  const { L, lang, locale } = useI18n();
  const settings = useSettings();
  const [tab, setTab] = useState<'log' | 'library'>('log');
  const [lib, setLib] = useState<ExdbItem[] | null>(null);
  const [libState, setLibState] = useState<'idle' | 'loading' | 'off' | 'error'>('idle');
  const [quick, setQuick] = useState<{ name: string; sets: Array<{ weight: string; reps: string }> } | null>(null);
  const last = workouts.filter((w) => w.data.exercises.some((e) => e.muscle === muscle)).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0];

  useEffect(() => {
    if (tab !== 'library' || lib || libState !== 'idle') return;
    const m = EXDB[muscle];
    if (!m) { setLibState('off'); return; }
    setLibState('loading');
    const key = `dq_exdb_${m.target}`;
    try { const c = JSON.parse(sessionStorage.getItem(key) ?? 'null'); if (c) { setLib(c); setLibState('idle'); return; } } catch { /* ignore */ }
    api<{ available: boolean; items: ExdbItem[] }>(`/exercises?target=${encodeURIComponent(m.target)}&limit=15`)
      .then((r) => { if (!r.available) setLibState('off'); else { setLib(r.items); setLibState('idle'); try { sessionStorage.setItem(key, JSON.stringify(r.items)); } catch { /* quota */ } } })
      .catch(() => setLibState('error'));
  }, [tab, muscle, lib, libState]);

  const saveQuick = async () => {
    if (!quick) return;
    const sets = quick.sets.filter((s) => num(s.weight) || num(s.reps)).map((s) => ({ weight: num(s.weight), reps: num(s.reps), rpe: '', done: true }));
    if (!sets.length) { toast(L('أدخل مجموعة واحدة على الأقل', 'Enter at least one set'), { tone: 'error' }); return; }
    const today = todayKey();
    const existing = workouts.find((w) => w.date === today && w.data.source === 'quick');
    const ex = { id: newId('ex'), name: quick.name, muscle, notes: '', sets };
    if (existing) await update<WorkoutData>(existing.id, { data: { exercises: [...existing.data.exercises, ex] } });
    else {
      await create<WorkoutData>('workout', { name: L('تمرين سريع', 'Quick log'), program_id: null, started_at: new Date().toISOString(), duration_min: 0, exercises: [ex], source: 'quick' }, { date: today, status: 'done' });
      await grantXp(`workout:quick:${today}`, 'workout', settings, L('تمرين سريع', 'Quick log'));
    }
    toast(L('سُجّل ✓', 'Logged ✓'));
    setQuick(null);
  };

  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title={muscleName(muscle, L)} wide description={last ? `${L('آخر تمرين', 'Last trained')}: ${fmtDate(last.date!, locale, { weekday: 'long', day: 'numeric', month: 'short' })}` : L('لم تُمرَّن بعد', 'Not trained yet')}>
      <Segmented className="mb-3" value={tab} onChange={setTab} options={[{ value: 'log', label: L('سجّل بسرعة', 'Quick log') }, { value: 'library', label: L('مكتبة التمارين', 'Exercise library'), icon: <ImageIcon size={14} /> }]} />
      {tab === 'log' ? (
        quick ? (
          <div>
            <div className="mb-2 font-bold">{quick.name}</div>
            {quick.sets.map((s, i) => (
              <div key={i} className="mb-1.5 flex items-center gap-2">
                <span className="num w-5 text-fg-3">{i + 1}</span>
                <Input type="number" placeholder="kg" value={s.weight} onChange={(e) => setQuick({ ...quick, sets: quick.sets.map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)) })} aria-label={L('الوزن', 'Weight')} />
                <Input type="number" placeholder={L('تكرار', 'reps')} value={s.reps} onChange={(e) => setQuick({ ...quick, sets: quick.sets.map((x, j) => (j === i ? { ...x, reps: e.target.value } : x)) })} aria-label={L('التكرار', 'Reps')} />
              </div>
            ))}
            <div className="mt-2 flex gap-2"><Button size="sm" onClick={() => setQuick({ ...quick, sets: [...quick.sets, { ...quick.sets.at(-1)! }] })}>+ {L('مجموعة', 'Set')}</Button><span className="flex-1" /><Button variant="ghost" onClick={() => setQuick(null)}>{L('رجوع', 'Back')}</Button><Button variant="primary" onClick={saveQuick}>{L('حفظ', 'Save')}</Button></div>
          </div>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2">{(EXERCISES[muscle] ?? []).map((n) => <button key={n} className="rounded-sm border border-line px-3 py-2.5 text-start hover:bg-surface-2" onClick={() => setQuick({ name: n, sets: [{ weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }] })}>{n}</button>)}</div>
        )
      ) : libState === 'loading' ? <div className="skeleton h-40" /> : libState === 'off' ? <p className="text-sm text-fg-2">{L('مكتبة الصور غير مفعّلة على الخادم (ExerciseDB).', 'The image library is not configured on the server (ExerciseDB).')}</p>
        : libState === 'error' ? <p className="text-sm text-danger">{L('تعذر التحميل، حاول لاحقاً.', 'Could not load, try later.')}</p> : (
          <div className="grid gap-3 sm:grid-cols-2">
            {(lib ?? []).map((x) => (
              <div key={x.id} className="rounded-md border border-line p-3">
                <img src={`/api/exercises/image?id=${encodeURIComponent(x.id)}&res=180`} alt={x.name} loading="lazy" className="mb-2 aspect-square w-full rounded-sm bg-white object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <div className="font-bold capitalize" dir="ltr">{x.name}</div>
                <div className="text-[12px] text-fg-3" dir="ltr">{x.equipment} · {x.target}</div>
                {x.instructions?.length ? <details className="mt-1 text-[12px]" dir="ltr"><summary className="cursor-pointer text-fg-2">{L('الخطوات', 'Steps')}</summary><ol className="list-decimal ps-4">{x.instructions.slice(0, 6).map((s, i) => <li key={i}>{s}</li>)}</ol></details> : null}
                <Button size="sm" className="mt-2" onClick={() => { setTab('log'); setQuick({ name: x.name, sets: [{ weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }] }); }}>{L('سجّل', 'Log')}</Button>
              </div>
            ))}
          </div>
        )}
      <span className="hidden">{lang}{rangeKeys(todayKey(), 1)}</span>
    </Modal>
  );
}

function ProgramEditor({ p, onClose }: { p: Rec<ProgramData> | null; onClose: () => void }) {
  const { L } = useI18n();
  const [d, setD] = useState<ProgramData>(p?.data ?? { name: '', days: [{ name: 'Push', exercises: [] }] });
  const [adding, setAdding] = useState<number | null>(null);
  const [m, setM] = useState('صدر');
  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title={p ? L('تعديل البرنامج', 'Edit program') : L('برنامج جديد', 'New program')} wide
      footer={<>
        {p && <IconButton className="me-auto" tone="danger" label={L('حذف', 'Delete')} onClick={async () => { await remove(p.id); onClose(); }}><Trash2 size={17} /></IconButton>}
        <Button variant="ghost" onClick={onClose}>{L('إلغاء', 'Cancel')}</Button>
        <Button variant="primary" onClick={async () => { if (!d.name.trim()) return; if (p) await update<ProgramData>(p.id, { data: d }); else await create<ProgramData>('program', d); onClose(); }}>{L('حفظ', 'Save')}</Button>
      </>}>
      <Input label={L('اسم البرنامج', 'Program name')} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} autoFocus={!p} />
      <div className="mt-4 space-y-3">
        {d.days.map((day, i) => (
          <Card key={i} className="p-3">
            <div className="flex items-center gap-2">
              <input className="field h-9 min-h-0 flex-1 py-1 font-bold" value={day.name} onChange={(e) => setD({ ...d, days: d.days.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} aria-label={L('اسم اليوم', 'Day name')} />
              <IconButton size="sm" tone="danger" label={L('حذف اليوم', 'Remove day')} onClick={() => setD({ ...d, days: d.days.filter((_, j) => j !== i) })}><X size={15} /></IconButton>
            </div>
            <ul className="mt-2 space-y-1 text-sm">{day.exercises.map((e, k) => (
              <li key={k} className="flex items-center gap-2"><span className="flex-1">{e.name} <span className="text-[11px] text-fg-3">· {e.muscle}</span></span>
                <input type="number" className="field h-8 min-h-0 w-14 py-0 text-center" value={e.sets ?? 3} onChange={(ev) => setD({ ...d, days: d.days.map((x, j) => (j === i ? { ...x, exercises: x.exercises.map((y, z) => (z === k ? { ...y, sets: Number(ev.target.value) || 3 } : y)) } : x)) })} aria-label={L('مجموعات', 'Sets')} />
                <button aria-label={L('حذف', 'Remove')} onClick={() => setD({ ...d, days: d.days.map((x, j) => (j === i ? { ...x, exercises: x.exercises.filter((_, z) => z !== k) } : x)) })}><X size={13} /></button></li>
            ))}</ul>
            {adding === i ? (
              <div className="mt-2">
                <div className="mb-2 flex flex-wrap gap-1">{MUSCLES.map((x) => <Chip key={x.id} active={m === x.id} onClick={() => setM(x.id)}>{L(x.ar, x.en)}</Chip>)}</div>
                <div className="flex flex-wrap gap-1">{(EXERCISES[m] ?? []).map((n) => <Chip key={n} onClick={() => setD({ ...d, days: d.days.map((x, j) => (j === i ? { ...x, exercises: [...x.exercises, { name: n, muscle: m, sets: 3 }] } : x)) })}>+ {n}</Chip>)}</div>
                <Button size="sm" variant="ghost" className="mt-2" onClick={() => setAdding(null)}>{L('تم', 'Done')}</Button>
              </div>
            ) : <Button size="sm" variant="subtle" className="mt-2" icon={<Plus size={14} />} onClick={() => setAdding(i)}>{L('تمرين', 'Exercise')}</Button>}
          </Card>
        ))}
        <Button icon={<Plus size={15} />} onClick={async () => { const n = await prompt(L('اسم اليوم (مثال: Pull)', 'Day name (e.g. Pull)'), { value: `${L('يوم', 'Day')} ${d.days.length + 1}` }); if (n) setD({ ...d, days: [...d.days, { name: n, exercises: [] }] }); }}>{L('يوم', 'Day')}</Button>
      </div>
    </Modal>
  );
}
