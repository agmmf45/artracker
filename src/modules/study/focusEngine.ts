import { useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useI18n } from '@/core/i18n';
import { useNow, useSettings } from '@/core/hooks';
import { db, setMeta } from '@/core/db';
import { create } from '@/core/repo';
import { dateKey, shiftKey } from '@/core/dates';
import { grantXp } from '@/core/xp';
import { toast } from '@/core/toast';
import type { StudySessionData } from './model';
import { effectiveMinutes, subtractOverlaps } from './focusLogic';

/** The one running focus session (kept in IndexedDB meta, so a refresh or another page never loses it). */
export interface ActiveFocus {
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

export interface StartOpts { mode: ActiveFocus['mode']; customMin?: number; course: string | null; lecture?: string | null }

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = 660; o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
    o.start(); o.stop(ctx.currentTime + 0.85);
  } catch { /* audio not available */ }
}

/**
 * Shared focus timer used by the Study sheet and the Focus page: start / pause / resume / stop,
 * pomodoro breaks, and saving the session (clipped against overlapping ones) when a phase ends —
 * computed from timestamps, so it is right even after a refresh.
 */
export function useFocusEngine(getNotes: () => string = () => '') {
  const { L } = useI18n();
  const settings = useSettings();
  const active = useLiveQuery(() => db().meta.get('focus_active').then((r) => (r?.value as ActiveFocus | null) ?? null), []);
  const now = useNow(1000);
  const finishing = useRef(false);
  const last = useRef<StartOpts>({ mode: 'pomodoro', course: null });

  const start = async (opts: StartOpts, phase: ActiveFocus['phase'] = 'work', cycle = active?.cycle ?? 0) => {
    last.current = opts;
    const f = settings.focus;
    const planned = phase === 'break' ? ((cycle % f.longEvery === 0 && cycle > 0) ? f.long : f.short) : opts.mode === 'pomodoro' ? f.work : opts.mode === 'custom' ? (opts.customMin ?? 45) : 0;
    await setMeta('focus_active', { phase, mode: opts.mode, started_at: new Date().toISOString(), planned_min: planned, paused_ms: 0, paused_at: null, course_id: opts.course, lecture_id: opts.lecture ?? null, cycle } satisfies ActiveFocus);
  };

  const elapsedMs = active ? (active.paused_at ? Date.parse(active.paused_at) : now.getTime()) - Date.parse(active.started_at) - active.paused_ms : 0;
  const remainingMs = active && active.planned_min ? active.planned_min * 60000 - elapsedMs : null;

  const saveSession = async (a: ActiveFocus, endedAt: string) => {
    const mins = effectiveMinutes(a.started_at, endedAt, a.paused_ms);
    if (mins < 1) { toast(L('الجلسة أقصر من دقيقة — لم تُحفظ', 'Session under a minute — not saved')); return 0; }
    const day = dateKey(new Date(a.started_at));
    const existing = (await db().records.where('[type+date]').between(['study_session', shiftKey(day, -1)], ['study_session', `${shiftKey(day, 1)}￿`]).filter((r) => !r.deleted_at).toArray())
      .map((r) => r.data as unknown as StudySessionData).map((s) => ({ start: Date.parse(s.started_at), end: Date.parse(s.ended_at) }));
    const parts = subtractOverlaps({ start: Date.parse(a.started_at), end: Date.parse(endedAt) - a.paused_ms }, existing);
    let saved = 0;
    for (const p of parts) {
      const m = Math.round((p.end - p.start) / 60000);
      saved += m;
      await create<StudySessionData>('study_session', { course_id: a.course_id, lecture_id: a.lecture_id, mode: a.mode, started_at: new Date(p.start).toISOString(), ended_at: new Date(p.end).toISOString(), duration_min: m, notes: getNotes() }, { date: dateKey(new Date(p.start)), parent_id: a.course_id });
    }
    if (saved < mins) toast(L(`تجاهلنا ${mins - saved} دقيقة متداخلة مع جلسة سابقة`, `Ignored ${mins - saved} minutes overlapping an earlier session`));
    if (saved >= 20) await grantXp(`focus:${a.started_at}`, 'focus', settings, L('جلسة تركيز', 'Focus session'));
    return saved;
  };

  // a timed phase ended: save the work, then start the break (pomodoro) or stop
  useEffect(() => {
    if (!active || remainingMs === null || remainingMs > 0 || active.paused_at || finishing.current) return;
    finishing.current = true;
    (async () => {
      const end = new Date(Date.parse(active.started_at) + active.paused_ms + active.planned_min * 60000).toISOString();
      if (settings.focus.sound) beep();
      if (active.phase === 'work') {
        const m = await saveSession(active, end);
        toast(L(`أحسنت! ${m} دقيقة تركيز. خذ استراحة.`, `Nice! ${m} focused minutes. Take a break.`), { tone: 'reward' });
        if (active.mode === 'pomodoro') await start({ mode: active.mode, course: active.course_id, lecture: active.lecture_id }, 'break', active.cycle + 1); else await setMeta('focus_active', null);
      } else {
        toast(L('انتهت الاستراحة', 'Break over'));
        await setMeta('focus_active', null);
      }
      finishing.current = false;
    })();
  }, [remainingMs, active]); // eslint-disable-line react-hooks/exhaustive-deps

  const pause = async () => { if (active) await setMeta('focus_active', { ...active, paused_at: new Date().toISOString() }); };
  const resume = async () => { if (active?.paused_at) await setMeta('focus_active', { ...active, paused_ms: active.paused_ms + (Date.now() - Date.parse(active.paused_at)), paused_at: null }); };
  const stop = async () => {
    if (!active) return 0;
    const a = active.paused_at ? { ...active, paused_ms: active.paused_ms + (Date.now() - Date.parse(active.paused_at)), paused_at: null } : active;
    await setMeta('focus_active', null);
    if (a.phase !== 'work') return 0;
    const m = await saveSession(a, new Date().toISOString());
    if (m) toast(L(`حُفظت ${m} دقيقة`, `Saved ${m} minutes`));
    return m;
  };

  return { active, elapsedMs, remainingMs, start, pause, resume, stop };
}

export const mmss = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
