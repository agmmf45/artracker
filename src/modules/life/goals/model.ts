import type { Rec } from '@shared/records';
import type { TaskData } from '../tasks/model';

export interface GoalData {
  title: string;
  description: string;
  why: string;
  area: string | null;
  horizon: 'vision' | 'lifetime' | 'year' | 'quarter' | 'month' | 'week' | 'short' | 'long';
  progress_mode: 'tasks' | 'measure' | 'milestones' | 'habits';
  target: number | null;
  current: number | null;
  unit: string | null;
  due: string | null;
  habit_ids: string[];
  image_url: string | null;
  parent_goal_id?: string | null;
}
export type Goal = Rec<GoalData>;

export interface ProjectData {
  title: string;
  description: string;
  kind: 'personal' | 'academic' | 'business' | 'creative';
  priority: number;
  due: string | null;
  start: string | null;
  goal_id: string | null;
  area: string | null;
  resources: Array<{ title: string; url: string }>;
  next_action: string | null;
  color: string | null;
}
export type Project = Rec<ProjectData>;

export interface MilestoneData { title: string; due: string | null; done_at: string | null; project_id: string | null; goal_id: string | null }
export type Milestone = Rec<MilestoneData>;

/**
 * Progress definitions (shown in the UI as tooltips):
 *  measure    → current / target
 *  tasks      → completed linked tasks / linked tasks
 *  milestones → completed milestones / milestones
 *  habits     → average 30-day consistency of linked habits (computed by caller)
 */
export function goalProgress(g: Goal, tasks: Array<Rec<TaskData>>, milestones: Milestone[], habitConsistency?: number): number | null {
  const d = g.data;
  if (d.progress_mode === 'measure') return d.target ? Math.max(0, Math.min(1, (d.current ?? 0) / d.target)) : null;
  if (d.progress_mode === 'milestones') {
    const ms = milestones.filter((m) => m.data.goal_id === g.id);
    return ms.length ? ms.filter((m) => m.data.done_at).length / ms.length : null;
  }
  if (d.progress_mode === 'habits') return habitConsistency ?? null;
  const ts = tasks.filter((t) => t.data.goal_id === g.id && t.status !== 'archived');
  return ts.length ? ts.filter((t) => t.status === 'done').length / ts.length : null;
}

export function projectProgress(p: Project, tasks: Array<Rec<TaskData>>, milestones: Milestone[]): { pct: number | null; done: number; total: number; msDone: number; msTotal: number } {
  const ts = tasks.filter((t) => t.data.project_id === p.id && t.status !== 'archived');
  const ms = milestones.filter((m) => m.data.project_id === p.id);
  const done = ts.filter((t) => t.status === 'done').length;
  const msDone = ms.filter((m) => m.data.done_at).length;
  const total = ts.length + ms.length;
  return { pct: total ? (done + msDone) / total : null, done, total: ts.length, msDone, msTotal: ms.length };
}

export const HORIZONS: Array<[GoalData['horizon'], string, string]> = [
  ['lifetime', 'مدى الحياة', 'Lifetime'], ['year', 'سنوي', 'Annual'], ['quarter', 'ربعي', 'Quarterly'], ['month', 'شهري', 'Monthly'],
  ['week', 'أسبوعي', 'Weekly'], ['short', 'قصير المدى', 'Short-term'], ['long', 'طويل المدى', 'Long-term'],
];
