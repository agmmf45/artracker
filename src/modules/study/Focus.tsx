import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Play, Pause, Square, Coffee, Timer, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { useI18n } from '@/core/i18n';
import { useNow, useRecords, useRecordsInRange, useSettings } from '@/core/hooks';
import { db, setMeta } from '@/core/db';
import { create, remove } from '@/core/repo';
import { dateKey, fmtDuration, rangeKeys, shiftKey, todayKey } from '@/core/dates';
import { grantXp } from '@/core/xp';
import { toast } from '@/core/toast';
import { Button, Card, EmptyState, IconButton, PageHeader, Ring, Section, Segmented, Stat, Textarea } from '@/design/ui';
import { Bars } from '@/design/charts';
import type { LectureData, StudySessionData } from './model';
import { CourseSelect, courseLabel, useCourses } from './shared';
import { effectiveMinutes, subtractOverlaps } from './focusLogic';

interface Active {
  phase: 'work' | 'break';
  mode: 'pomodoro' | 'custom' | 'stopwatch';
  started_at: string;
  planned_min: number;
  paused_ms: number;
  paused_at: string | null;
  course_id: string | null;
  lecture_id: string | null;
  cycle: number;
}

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = 660; o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
    o.start(); o.stop(ctx.currentTime + 0.85);
  } catch { /* audio not available */ }
}

export default function Focus() {
  const { L, lang } = useI18n();
  const settings = useSettings();
  const courses = useCourses();
  const lectures = useRecords<LectureData>('lecture');
  const [params, setParams] = useSearchParams();
  const active = useLiveQuery(() => db().meta.get('focus_active').then((r) => (r?.value as Active | null) ?? null), []);
  const now = useNow(1000);
  const [mode, setMode] = useState<Active['mode']>('pomodoro');
  const [custom, setCustom] = useState(45);
  const [course, setCourse] = useState<string | null>(null);
  const [lecture, setLecture] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const finishing = useRef(false);
  const sessions = useRecordsInRange<StudySessionData>('study_session', shiftKey(todayKey(), -29), todayKey());

  const start = async (phase: Active['phase'] = 'work', cycle = active?.cycle ?? 0) => {
    const planned = phase === 'break' ? ((cycle % settings.focus.longEvery === 0 && cycle > 0) ? settings.focus.long : settings.focus.short) : mode === 'pomodoro' ? settings.focus.work : mode === 'custom' ? custom : 0;
    await setMeta('focus_active', { phase, mode, started_at: new Date().toISOString(), planned_min: planned, paused_ms: 0, paused_at: null, course_id: course, lecture_id: lecture, cycle } satisfies Active);
  };

  useEffect(() => { if (params.get('start') && active === null) { params.delete('start'); setParams(params, { replace: true }); void start(); } }, [params, active]); // eslint-disable-line react-hooks/exhaustive-deps

  const elapsedMs = active ? (active.paused_at ? Date.parse(active.paused_at) : now.getTime()) - Date.parse(active.started_at) - active.paused_ms : 0;
  const remainingMs = active && active.planned_min ? active.planned_min * 60000 - elapsedMs : null;

  const saveSession = async (a: Active, endedAt: string) => {
    const mins = effectiveMinutes(a.started_at, endedAt, a.paused_ms);
    if (mins < 1) { toast(L('الجلسة أقصر من دقيقة — لم تُحفظ', 'Session under a minute — not saved')); return 0; }
    // clip against existing sessions so overlapping time is never double-counted
    const day = dateKey(new Date(a.started_at));
    const existing = (await db().records.where('[type+date]').between(['study_session', shiftKey(day, -1)], ['study_session', `${shiftKey(day, 1)}￿`]).filter((r) => !r.deleted_at).toArray())
      .map((r) => r.data as unknown as StudySessionData).map((s) => ({ start: Date.parse(s.started_at), end: Date.parse(s.ended_at) }));
    const startMs = Date.parse(a.started_at) + 0;
    const endMs = Date.parse(endedAt) - a.paused_ms;
    const parts = subtractOverlaps({ start: startMs, end: endMs }, existing);
    let saved = 0;
    for (const p of parts) {
      const m = Math.round((p.end - p.start) / 60000);
      saved += m;
      await create<StudySessionData>('study_session', { course_id: a.course_id, lecture_id: a.lecture_id, mode: a.mode, started_at: new Date(p.start).toISOString(), ended_at: new Date(p.end).toISOString(), duration_min: m, notes }, { date: dateKey(new Date(p.start)), parent_id: a.course_id });
    }
    if (saved < mins) toast(L(`تجاهلنا ${mins - saved} دقيقة متداخلة مع جلسة سابقة`, `Ignored ${mins - saved} minutes overlapping an earlier session`));
    if (saved >= 20) await grantXp(`focus:${a.started_at}`, 'focus', settings, L('جلسة تركيز', 'Focus session'));
    setNotes('');
    return saved;
  };

  // auto-complete when a timed phase ends (also works after a refresh: computed from timestamps)
  useEffect(() => {
    if (!active || remainingMs === null || remainingMs > 0 || active.paused_at || finishing.current) return;
    finishing.current = true;
    (async () => {
      const end = new Date(Date.parse(active.started_at) + active.paused_ms + active.planned_min * 60000).toISOString();
      if (settings.focus.sound) beep();
      if (active.phase === 'work') {
        const m = await saveSession(active, end);
        toast(L(`أحسنت! ${m} دقيقة تركيز. خذ استراحة.`, `Nice! ${m} focused minutes. Take a break.`), { tone: 'reward' });
        if (active.mode === 'pomodoro') await start('break', active.cycle + 1); else await setMeta('focus_active', null);
      } else {
        toast(L('انتهت الاستراحة', 'Break over'));
        await setMeta('focus_active', null);
      }
      finishing.current = false;
    })();
  }, [remainingMs, active]); // eslint-disable-line react-hooks/exhaustive-deps

  const pause = async () => active && setMeta('focus_active', { ...active, paused_at: new Date().toISOString() });
  const resume = async () => active?.paused_at && setMeta('focus_active', { ...active, paused_ms: active.paused_ms + (Date.now() - Date.parse(active.paused_at)), paused_at: null });
  const stop = async () => {
    if (!active) return;
    const a = active.paused_at ? { ...active, paused_ms: active.paused_ms + (Date.now() - Date.parse(active.paused_at)), paused_at: null } : active;
    await setMeta('focus_active', null);
    if (a.phase === 'work') { const m = await saveSession(a, new Date().toISOString()); if (m) toast(L(`حُفظت ${m} دقيقة`, `Saved ${m} minutes`)); }
  };

  const today = todayKey();
  const stats = useMemo(() => {
    const xs = sessions ?? [];
    const byDay: Record<string, number> = {};
    const byCourse: Record<string, number> = {};
    for (const s of xs) { byDay[s.date!] = (byDay[s.date!] ?? 0) + s.data.duration_min; byCourse[s.data.course_id ?? ''] = (byCourse[s.data.course_id ?? ''] ?? 0) + s.data.duration_min; }
    return { byDay, byCourse, today: byDay[today] ?? 0, week: rangeKeys(shiftKey(today, -6), 7).reduce((s, d) => s + (byDay[d] ?? 0), 0), count: xs.length };
  }, [sessions, today]);

  const mm = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  const courseLectures = (lectures ?? []).filter((l) => !course || l.data.course_id === course);

  return (
    <div>
      <PageHeader title={L('جلسات التركيز', 'Focus sessions')} subtitle={L('المؤقت يستمر حتى لو أغلقت الصفحة وفتحتها.', 'The timer survives closing and reopening the page.')} />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="flex flex-col items-center p-6 md:p-10">
          {active ? (
            <>
              <div className={clsx('mb-2 rounded-full px-3 py-1 text-[12px] font-bold', active.phase === 'work' ? 'bg-[color-mix(in_oklab,var(--study)_15%,transparent)] text-study' : 'bg-[color-mix(in_oklab,var(--health)_15%,transparent)] text-health')}>
                {active.phase === 'work' ? L('تركيز', 'Focus') : L('استراحة', 'Break')}{active.course_id ? ` · ${courseLabel(courses.find((c) => c.id === active.course_id))}` : ''}
              </div>
              <Ring value={remainingMs === null ? 1 : Math.max(0, remainingMs)} max={remainingMs === null ? 1 : active.planned_min * 60000} size={240} stroke={10} color={active.phase === 'work' ? 'var(--study)' : 'var(--health)'} label={L('الوقت المتبقي', 'Time left')}>
                <div className="num text-5xl font-black tabular-nums">{remainingMs === null ? mm(elapsedMs) : mm(remainingMs)}</div>
              </Ring>
              <div className="mt-6 flex gap-2">
                {active.paused_at ? <Button variant="primary" size="lg" icon={<Play size={18} />} onClick={resume}>{L('استئناف', 'Resume')}</Button> : <Button size="lg" icon={<Pause size={18} />} onClick={pause}>{L('إيقاف مؤقت', 'Pause')}</Button>}
                <Button size="lg" variant="ghost" icon={<Square size={16} />} onClick={stop}>{active.phase === 'work' ? L('إنهاء وحفظ', 'Stop & save') : L('تخطَّ الاستراحة', 'Skip break')}</Button>
              </div>
              {active.phase === 'work' && <Textarea className="mt-6 w-full max-w-md" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={L('ملاحظات الجلسة (اختياري)', 'Session notes (optional)')} aria-label={L('ملاحظات', 'Notes')} />}
            </>
          ) : (
            <>
              <Segmented value={mode} onChange={setMode} options={[{ value: 'pomodoro', label: `Pomodoro ${settings.focus.work}` }, { value: 'custom', label: L('مخصص', 'Custom') }, { value: 'stopwatch', label: L('ساعة إيقاف', 'Stopwatch') }]} />
              {mode === 'custom' && <div className="mt-4 flex items-center gap-2"><input type="number" min={5} max={240} className="field w-24 text-center" value={custom} onChange={(e) => setCustom(Number(e.target.value) || 25)} aria-label={L('الدقائق', 'Minutes')} /> {L('دقيقة', 'min')}</div>}
              <div className="mt-6 grid w-full max-w-md gap-3 sm:grid-cols-2">
                <CourseSelect label={L('المقرر', 'Course')} value={course} onChange={(v) => { setCourse(v); setLecture(null); }} />
                <label className="block"><span className="mb-1.5 block text-[13px] font-bold text-fg-2">{L('المحاضرة', 'Lecture')}</span>
                  <select className="field" value={lecture ?? ''} onChange={(e) => setLecture(e.target.value || null)}><option value="">—</option>{courseLectures.map((l) => <option key={l.id} value={l.id}>{l.data.title}</option>)}</select>
                </label>
              </div>
              <Button variant="primary" size="lg" className="mt-6 min-w-48" icon={<Play size={18} />} onClick={() => start()}>{L('ابدأ', 'Start')}</Button>
              <p className="mt-3 text-[12px] text-fg-3">{L(`استراحة ${settings.focus.short} د، وطويلة ${settings.focus.long} د كل ${settings.focus.longEvery} جلسات. غيّرها من الإعدادات.`, `${settings.focus.short}-min breaks, ${settings.focus.long}-min every ${settings.focus.longEvery}. Change in Settings.`)}</p>
            </>
          )}
        </Card>
        <div className="space-y-4">
          <Card className="grid grid-cols-3 gap-3 p-4">
            <Stat label={L('اليوم', 'Today')} value={fmtDuration(stats.today, lang)} />
            <Stat label={L('7 أيام', '7 days')} value={fmtDuration(stats.week, lang)} />
            <Stat label={L('جلسات', 'Sessions')} value={stats.count} sub={L('30 يوم', '30 days')} />
          </Card>
          <Card className="p-4">
            <div className="mb-2 text-[13px] font-bold text-fg-2">{L('آخر 7 أيام (دقائق)', 'Last 7 days (min)')}</div>
            <Bars data={rangeKeys(shiftKey(today, -6), 7).map((d) => ({ label: d.slice(8), value: stats.byDay[d] ?? 0 }))} height={90} color="var(--study)" goal={settings.study.dailyStudyGoalMin} />
          </Card>
          <Card className="p-4">
            <div className="mb-2 text-[13px] font-bold text-fg-2">{L('حسب المقرر (30 يوم)', 'By course (30 days)')}</div>
            {!Object.keys(stats.byCourse).length ? <p className="text-sm text-fg-3">—</p> : (
              <ul className="space-y-1 text-sm">{Object.entries(stats.byCourse).sort((a, b) => b[1] - a[1]).map(([cid, m]) => <li key={cid} className="flex gap-2"><span className="flex-1 truncate">{courseLabel(courses.find((c) => c.id === cid)) || L('عام', 'General')}</span><span className="num text-fg-2">{fmtDuration(m, lang)}</span></li>)}</ul>
            )}
          </Card>
        </div>
      </div>
      <Section title={L('سجل الجلسات', 'Session history')} className="mt-6">
        {!sessions?.length ? <EmptyState icon={<Timer size={26} />} title={L('أول جلسة تركيز تبدأ بضغطة', 'Your first focus session is one tap away')} /> : (
          <Card className="divide-y divide-line">
            {[...sessions].sort((a, b) => b.data.started_at.localeCompare(a.data.started_at)).slice(0, 20).map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                {s.data.mode === 'pomodoro' ? <Timer size={15} className="text-study" /> : <Coffee size={15} className="text-fg-3" />}
                <span className="num w-28 text-[12px] text-fg-2">{s.date} {new Date(s.data.started_at).toTimeString().slice(0, 5)}</span>
                <span className="min-w-0 flex-1 truncate">{courseLabel(courses.find((c) => c.id === s.data.course_id)) || L('عام', 'General')}{s.data.notes ? ` · ${s.data.notes}` : ''}</span>
                <span className="num font-bold">{s.data.duration_min}{L('د', 'm')}</span>
                <IconButton size="sm" tone="danger" label={L('حذف', 'Delete')} onClick={() => remove(s.id)}><Trash2 size={14} /></IconButton>
              </div>
            ))}
          </Card>
        )}
      </Section>
    </div>
  );
}
