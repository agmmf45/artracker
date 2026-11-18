import type { Rec } from '@shared/records';
import { db } from '@/core/db';
import { create } from '@/core/repo';
import { shiftKey, todayKey } from '@/core/dates';

/**
 * Achievement definitions. Legacy v4 trophy ids are kept (their unlocks were migrated), new ones added.
 * Unlocks are permanent records `ach:<key>` (deterministic id → never duplicated across devices) and are
 * never revoked because of inactivity.
 */
export interface Snapshot {
  tasksDone: number; tasksTotal: number; openTasks: number; habits: number; habitLogsDone: number; maxHabitCount: number;
  perfectDays: number; perfectStreak: number; txns: number; budget: boolean; underBudget: boolean; notes: number; linkedNotes: number;
  focusMinutes: number; longestFocus: number; projectsDone: number; weeklyReviews: number; earlyTasks: number; prs: number;
  semestersDone: number; researchMilestones: number; workouts: number; flashReviews: number; consistency7: boolean;
}

export interface AchDef { key: string; icon: string; ar: string; en: string; dar: string; den: string; cat: 'habits' | 'tasks' | 'money' | 'study' | 'health' | 'growth'; check: (s: Snapshot) => boolean }

export const ACHIEVEMENTS: AchDef[] = [
  // v4 trophies (same ids)
  { key: 'first_habit', icon: '🌱', ar: 'البداية', en: 'First Step', dar: 'أضف أول عادة', den: 'Add your first habit', cat: 'habits', check: (s) => s.habits >= 1 },
  { key: 'perfect_day', icon: '⚡', ar: 'يوم مثالي', en: 'Perfect Day', dar: 'أكمل كل عادات يوم واحد', den: 'Complete every habit in a day', cat: 'habits', check: (s) => s.perfectDays >= 1 },
  { key: 'week_streak', icon: '🔥', ar: 'أسبوع نار', en: 'Seven Days of Consistency', dar: '7 أيام مثالية متتالية', den: '7 perfect days in a row', cat: 'habits', check: (s) => s.perfectStreak >= 7 },
  { key: 'month_streak', icon: '💎', ar: 'شهر كامل', en: 'A Full Month', dar: '30 يوماً مثالياً متتالياً', den: '30 perfect days in a row', cat: 'habits', check: (s) => s.perfectStreak >= 30 },
  { key: 'habit_100', icon: '🎯', ar: 'مئة مرة', en: 'Habit Builder', dar: 'أكمل عادة 100 مرة', den: 'Complete one habit 100 times', cat: 'habits', check: (s) => s.maxHabitCount >= 100 },
  { key: 'five_habits', icon: '📋', ar: 'منظّم', en: 'Organized', dar: '5 عادات نشطة', den: '5 active habits', cat: 'habits', check: (s) => s.habits >= 5 },
  { key: 'first_expense', icon: '📊', ar: 'مُتتبّع', en: 'Tracker', dar: 'سجّل أول معاملة', den: 'Log your first transaction', cat: 'money', check: (s) => s.txns >= 1 },
  { key: 'ten_expenses', icon: '📈', ar: 'محلل', en: 'Analyst', dar: 'سجّل 10 معاملات', den: 'Log 10 transactions', cat: 'money', check: (s) => s.txns >= 10 },
  { key: 'budget_set', icon: '💰', ar: 'مدبّر', en: 'Planner', dar: 'حدد ميزانية شهرية', den: 'Set a monthly budget', cat: 'money', check: (s) => s.budget },
  { key: 'saver', icon: '🏦', ar: 'موفّر', en: 'Saver', dar: 'بقيت ضمن الميزانية هذا الشهر', den: 'Stayed within budget this month', cat: 'money', check: (s) => s.budget && s.underBudget && s.txns >= 5 },
  { key: 'first_todo', icon: '✅', ar: 'ابدأ الآن', en: 'Start Now', dar: 'أضف أول مهمة', den: 'Add your first task', cat: 'tasks', check: (s) => s.tasksTotal >= 1 },
  { key: 'ten_todos', icon: '🚀', ar: 'منتج', en: 'Productive', dar: 'أكمل 10 مهام', den: 'Complete 10 tasks', cat: 'tasks', check: (s) => s.tasksDone >= 10 },
  { key: 'clear_all', icon: '🧹', ar: 'نظّفت القائمة', en: 'Clean Slate', dar: 'لا مهام مفتوحة بعد إنجاز 5 على الأقل', den: 'No open tasks after finishing at least 5', cat: 'tasks', check: (s) => s.openTasks === 0 && s.tasksDone >= 5 },
  { key: 'fifty_todos', icon: '🏅', ar: 'آلة إنجاز', en: 'Finisher', dar: 'أكمل 50 مهمة', den: 'Complete 50 tasks', cat: 'tasks', check: (s) => s.tasksDone >= 50 },
  // new
  { key: 'deep_focus', icon: '🧠', ar: 'تركيز عميق', en: 'Deep Focus', dar: 'جلسة تركيز 50 دقيقة', den: 'A 50-minute focus session', cat: 'study', check: (s) => s.longestFocus >= 50 },
  { key: 'fifty_hours', icon: '⏳', ar: 'خمسون ساعة', en: 'Fifty Study Hours', dar: '50 ساعة مذاكرة', den: '50 hours of focused study', cat: 'study', check: (s) => s.focusMinutes >= 3000 },
  { key: 'knowledge_collector', icon: '📚', ar: 'جامع المعرفة', en: 'Knowledge Collector', dar: '25 ملاحظة، 5 منها مترابطة', den: '25 notes, 5 of them linked', cat: 'growth', check: (s) => s.notes >= 25 && s.linkedNotes >= 5 },
  { key: 'project_finisher', icon: '🏁', ar: 'منهي المشاريع', en: 'Project Finisher', dar: 'أكمل مشروعاً', den: 'Complete a project', cat: 'tasks', check: (s) => s.projectsDone >= 1 },
  { key: 'early_planner', icon: '🌅', ar: 'مخطط مبكر', en: 'Early Planner', dar: 'أنجز 10 مهام قبل موعدها النهائي', den: 'Finish 10 tasks before their deadline', cat: 'tasks', check: (s) => s.earlyTasks >= 10 },
  { key: 'weekly_reset', icon: '🔄', ar: 'إعادة ضبط أسبوعية', en: 'Weekly Reset', dar: 'أكمل مراجعة أسبوعية', den: 'Complete a weekly review', cat: 'growth', check: (s) => s.weeklyReviews >= 1 },
  { key: 'personal_best', icon: '🏆', ar: 'رقم شخصي', en: 'Personal Best', dar: 'سجّل رقماً قياسياً في تمرين', den: 'Set a lifting personal record', cat: 'health', check: (s) => s.prs >= 1 },
  { key: 'ten_workouts', icon: '💪', ar: 'عشرة تمارين', en: 'Ten Workouts', dar: 'أكمل 10 تمارين', den: 'Complete 10 workouts', cat: 'health', check: (s) => s.workouts >= 10 },
  { key: 'semester_completed', icon: '🎓', ar: 'فصل مكتمل', en: 'Semester Completed', dar: 'أنهِ فصلاً دراسياً', den: 'Finish a semester', cat: 'study', check: (s) => s.semestersDone >= 1 },
  { key: 'research_milestone', icon: '🔬', ar: 'محطة بحثية', en: 'Research Milestone', dar: 'قدّم أو انشر بحثاً', den: 'Submit or publish a paper', cat: 'study', check: (s) => s.researchMilestones >= 1 },
  { key: 'recall_200', icon: '🃏', ar: 'ذاكرة حديدية', en: 'Active Recall', dar: '200 مراجعة بطاقات', den: '200 flashcard reviews', cat: 'study', check: (s) => s.flashReviews >= 200 },
];

async function all<T>(type: string): Promise<Array<Rec<T>>> {
  return (await db().records.where('type').equals(type).filter((r) => !r.deleted_at).toArray()) as unknown as Array<Rec<T>>;
}

export async function snapshot(): Promise<Snapshot> {
  const tasks = await all<{ completed_at?: string | null; due?: string | null; history?: unknown[] }>('task');
  const habits = (await all<{ name: string }>('habit')).filter((h) => h.status !== 'archived');
  const logs = await all<{ habit_id: string; value: number }>('habit_log');
  const done = logs.filter((l) => l.data.value > 0);
  const perDay = new Map<string, Set<string>>();
  const counts = new Map<string, number>();
  for (const l of done) {
    if (!perDay.has(l.date!)) perDay.set(l.date!, new Set());
    perDay.get(l.date!)!.add(l.data.habit_id);
    counts.set(l.data.habit_id, (counts.get(l.data.habit_id) ?? 0) + 1);
  }
  const perfect = new Set([...perDay.entries()].filter(([, s]) => habits.length > 0 && habits.every((h) => s.has(h.id))).map(([d]) => d));
  let streak = 0;
  let best = 0;
  for (const d of [...perfect].sort()) { streak = perfect.has(shiftKey(d, -1)) ? streak + 1 : 1; best = Math.max(best, streak); }
  const txns = await all<{ kind: string; amount: number; saving?: boolean }>('txn');
  const settings = await db().records.get('settings');
  const budget = Number((settings?.data as { finance?: { monthlyBudget?: number } } | undefined)?.finance?.monthlyBudget ?? 0);
  const month = todayKey().slice(0, 7);
  const spent = txns.filter((t) => (t.date ?? '').startsWith(month) && t.data.kind === 'expense' && !t.data.saving).reduce((s, t) => s + t.data.amount, 0);
  const notes = await all<{ body: string }>('note');
  const sessions = await all<{ duration_min: number }>('study_session');
  const projects = await all<object>('project');
  const reviews = await all<{ kind: string }>('review');
  const workouts = await all<{ exercises: Array<{ name: string; sets: Array<{ weight: unknown; reps: unknown; done?: boolean }> }> }>('workout');
  const semesters = await all<{ end?: string | null }>('semester');
  const research = await all<object>('research');
  const cardReviews = await db().records.where('type').equals('card_review').count();
  const prNames = new Set<string>();
  const best1 = new Map<string, number>();
  for (const w of [...workouts].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))) for (const e of w.data.exercises) for (const s of e.sets) {
    const wt = Number(s.weight) || 0;
    if (!wt) continue;
    if (best1.has(e.name) && wt > best1.get(e.name)!) prNames.add(e.name);
    best1.set(e.name, Math.max(best1.get(e.name) ?? 0, wt));
  }
  return {
    tasksDone: tasks.filter((t) => t.status === 'done').length + tasks.reduce((n, t) => n + (t.data.history?.length ?? 0), 0),
    tasksTotal: tasks.length,
    openTasks: tasks.filter((t) => t.status !== 'done' && t.status !== 'archived').length,
    habits: habits.length, habitLogsDone: done.length, maxHabitCount: Math.max(0, ...counts.values()),
    perfectDays: perfect.size, perfectStreak: best,
    txns: txns.length, budget: budget > 0, underBudget: budget > 0 && spent < budget,
    notes: notes.length, linkedNotes: notes.filter((n) => /\[\[[^\]]+\]\]/.test(n.data.body ?? '')).length,
    focusMinutes: sessions.reduce((s, x) => s + (x.data.duration_min ?? 0), 0), longestFocus: Math.max(0, ...sessions.map((s) => s.data.duration_min ?? 0)),
    projectsDone: projects.filter((p) => p.status === 'done').length,
    weeklyReviews: reviews.filter((r) => r.data.kind === 'weekly').length,
    earlyTasks: tasks.filter((t) => t.status === 'done' && t.data.due && t.data.completed_at && t.data.completed_at.slice(0, 10) < t.data.due).length,
    prs: prNames.size, semestersDone: semesters.filter((s) => s.data.end && s.data.end < todayKey()).length,
    researchMilestones: research.filter((r) => ['submitted', 'published'].includes(String((r.data as { status?: string }).status ?? r.status))).length,
    workouts: workouts.length, flashReviews: cardReviews, consistency7: false,
  };
}

/** Returns newly unlocked achievements (and records them). */
export async function checkAchievements(): Promise<AchDef[]> {
  const s = await snapshot();
  const have = new Set((await all<{ key: string }>('achievement')).map((a) => a.data.key));
  const fresh = ACHIEVEMENTS.filter((a) => !have.has(a.key) && a.check(s));
  for (const a of fresh) await create('achievement', { key: a.key }, { id: `ach:${a.key}`, date: todayKey() });
  return fresh;
}
