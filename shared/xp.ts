/**
 * Gamification rules (documented in docs/DESIGN_SYSTEM.md › Motivation and docs/DATABASE_PLAN.md › XP).
 *
 * Ledger model
 * - Each award is an append-only `xp` record whose id is deterministic: `xp:<base>:<n>`.
 *   <base> identifies the real-life action (e.g. `task:<taskId>:complete`), <n> counts how
 *   many times that action was reversed before. Two devices completing the same task produce the
 *   same id, so the server stores it once (PRIMARY KEY (user_id, id)).
 * - Un-completing writes a reversal record `xp:<base>:<n>:rev` with the negative amount.
 *   Completing again uses n+1. The net XP for one action is therefore always 0 or one award:
 *   toggling cannot farm points.
 * - Balance = SUM(amount) over all xp records. Coins = floor(lifetime positive XP / 10) − spent coins.
 */

export const DEFAULT_XP: Record<XpAction, number> = {
  task: 10,
  task_important: 20,
  habit: 5,
  focus: 15,
  workout: 20,
  daily_review: 10,
  weekly_review: 50,
  milestone: 100,
  project: 150,
  flashcards: 10,
  quest: 15,
};

export type XpAction =
  | 'task' | 'task_important' | 'habit' | 'focus' | 'workout' | 'daily_review'
  | 'weekly_review' | 'milestone' | 'project' | 'flashcards' | 'quest';

export const SKILLS = ['knowledge', 'discipline', 'creativity', 'fitness', 'productivity', 'finance', 'growth'] as const;
export type Skill = (typeof SKILLS)[number];

export const ACTION_SKILL: Record<XpAction, Skill> = {
  task: 'productivity',
  task_important: 'productivity',
  habit: 'discipline',
  focus: 'knowledge',
  workout: 'fitness',
  daily_review: 'growth',
  weekly_review: 'growth',
  milestone: 'growth',
  project: 'productivity',
  flashcards: 'knowledge',
  quest: 'discipline',
};

/** Daily cap per action so heavy data entry is not rewarded more than meaningful progress. */
export const DAILY_CAP: Partial<Record<XpAction, number>> = {
  task: 200,
  habit: 100,
  focus: 120, // 8 sessions; studying without breaks is not rewarded beyond this
  workout: 40, // max two workouts a day earn XP
  flashcards: 50,
};

/** Cumulative XP needed to *reach* level L (L ≥ 1). Deterministic: 100·(L−1)^1.5, rounded. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(100 * Math.pow(level - 1, 1.5));
}

export function levelFromXp(xp: number): { level: number; current: number; next: number; into: number; need: number } {
  let level = 1;
  while (xpForLevel(level + 1) <= xp && level < 999) level++;
  const current = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, current, next, into: xp - current, need: next - current };
}

export const DEFAULT_LEVEL_TITLES: Array<[number, string, string]> = [
  [1, 'مبتدئ', 'Beginner'],
  [5, 'مستكشف', 'Explorer'],
  [10, 'بانٍ', 'Builder'],
  [20, 'منجز', 'Achiever'],
  [35, 'متخصص', 'Specialist'],
  [50, 'متمكّن', 'Master'],
  [100, 'إرث', 'Legacy'],
];

export function levelTitle(level: number, titles = DEFAULT_LEVEL_TITLES, lang: 'ar' | 'en' = 'ar'): string {
  let t = titles[0];
  for (const row of titles) if (level >= row[0]) t = row;
  return lang === 'ar' ? t[1] : t[2];
}

export function xpId(base: string, n: number, reversal = false): string {
  return `xp:${base}:${n}${reversal ? ':rev' : ''}`;
}

export interface XpEntryLike {
  id: string;
  data: { amount?: number };
}

/**
 * Given the existing ledger rows for one action base, decide what to write.
 * Returns the record id + amount to append, or null when nothing should change.
 */
export function planXpChange(
  base: string,
  existingIds: ReadonlySet<string>,
  intent: 'grant' | 'revoke',
): { id: string; reversal: boolean } | null {
  // find the current cycle n: the first n whose award is missing or not yet reversed
  let n = 0;
  while (existingIds.has(xpId(base, n)) && existingIds.has(xpId(base, n, true))) n++;
  const awarded = existingIds.has(xpId(base, n));
  if (intent === 'grant') return awarded ? null : { id: xpId(base, n), reversal: false };
  return awarded ? { id: xpId(base, n, true), reversal: true } : null;
}

export function coinsFromLedger(entries: XpEntryLike[], spent: number): number {
  let earned = 0;
  for (const e of entries) earned += e.data.amount ?? 0;
  return Math.max(0, Math.floor(Math.max(0, earned) / 10) - spent);
}
