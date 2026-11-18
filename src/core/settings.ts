import type { XpAction } from '@shared/xp';

export interface LifeArea { id: string; name: string; icon: string; color: string }

export interface Settings {
  onboarded: boolean;
  language: 'ar' | 'en';
  theme: 'system' | 'light' | 'dark';
  legacyTheme: string | null;
  density: 'comfortable' | 'compact';
  weekStart: 0 | 1 | 6;
  timeFormat: '12' | '24';
  calendarDisplay: 'gregorian' | 'hijri' | 'both';
  timezone: string;
  currency: string;
  units: 'metric' | 'imperial';
  dayStart: string;
  dayEnd: string;
  /** page id → visible. Missing ids fall back to the page default. Hiding never deletes data. */
  modules: Record<string, boolean>;
  /** preset chosen in onboarding / Settings › Modules; decides modules the user never toggled */
  modulePreset: string | null;
  intention: { date: string; text: string } | null;
  encouragement: boolean;
  lifeAreas: LifeArea[];
  categories: { tasks: string[]; expenses: string[]; notes: string[] };
  tasks: { defaultPriority: number; showCompletedInToday: boolean; defaultView: 'list' | 'kanban' | 'matrix' | 'timeline' | 'calendar' };
  /** the notebook-style Today page */
  notebook: { paper: 'dots' | 'lines' | 'grid' | 'plain' };
  calendar: { defaultView: 'day' | 'week' | 'month' | 'agenda'; showTasks: boolean; showHealth: boolean };
  focus: { work: number; short: number; long: number; longEvery: number; sound: boolean };
  gamification: { enabled: boolean; xp: Partial<Record<XpAction, number>>; levelTitles: Array<[number, string, string]> | null; vacation: boolean; animations: boolean; garden: boolean };
  notifications: { enabled: boolean; quietStart: string; quietEnd: string; maxPerHour: number };
  privacy: { hideJournalPreviews: boolean; hideHealthInCalendar: boolean; lockJournal: boolean; ai: { enabled: boolean; health: boolean; finance: boolean; journal: boolean } };
  health: { calorieGoal: number; proteinGoal: number | null; carbGoal: number | null; fatGoal: number | null; waterGoal: number; waterServings: number[]; sleepGoalHours: number; heightCm: number | null };
  finance: { monthlyBudget: number | null; currency: string };
  study: { gpaScale: number; gradeScale: Array<{ min: number; letter: string; points: number }>; dailyStudyGoalMin: number; dental: boolean };
  prayer: { enabled: boolean; lat: number | null; lng: number | null; city: string | null; method: 'umm_al_qura' | 'mwl' | 'isna' | 'egypt' };
}

export const DEFAULT_GRADE_SCALE_5 = [
  { min: 95, letter: 'A+', points: 5 },
  { min: 90, letter: 'A', points: 4.75 },
  { min: 85, letter: 'B+', points: 4.5 },
  { min: 80, letter: 'B', points: 4 },
  { min: 75, letter: 'C+', points: 3.5 },
  { min: 70, letter: 'C', points: 3 },
  { min: 65, letter: 'D+', points: 2.5 },
  { min: 60, letter: 'D', points: 2 },
  { min: 0, letter: 'F', points: 1 },
];

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  language: 'ar',
  theme: 'system',
  legacyTheme: null,
  density: 'comfortable',
  weekStart: 6,
  timeFormat: '12',
  calendarDisplay: 'both',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Riyadh',
  currency: 'SAR',
  units: 'metric',
  dayStart: '07:00',
  dayEnd: '23:00',
  modules: {},
  modulePreset: null,
  intention: null,
  encouragement: true,
  lifeAreas: [
    { id: 'personal', name: 'شخصي', icon: '🌱', color: 'var(--viz-1)' },
    { id: 'education', name: 'التعليم', icon: '🎓', color: 'var(--viz-2)' },
    { id: 'career', name: 'المهنة', icon: '💼', color: 'var(--viz-6)' },
    { id: 'health', name: 'الصحة', icon: '💪', color: 'var(--viz-3)' },
    { id: 'finance', name: 'المال', icon: '💰', color: 'var(--viz-4)' },
    { id: 'relationships', name: 'العلاقات', icon: '🤝', color: 'var(--viz-5)' },
    { id: 'growth', name: 'تطوير الذات', icon: '📚', color: 'var(--viz-1)' },
  ],
  categories: {
    tasks: ['شخصي', 'دراسة', 'عمل', 'بيت', 'صحة'],
    expenses: ['🍔 أكل', '🛒 تسوق', '🎮 ترفيه', '🚗 مواصلات', '📋 فواتير', '💊 صحة', '📦 أخرى'],
    notes: ['عام', 'دراسة', 'أفكار', 'مراجع'],
  },
  tasks: { defaultPriority: 2, showCompletedInToday: true, defaultView: 'list' },
  notebook: { paper: 'dots' },
  calendar: { defaultView: 'week', showTasks: true, showHealth: false },
  focus: { work: 25, short: 5, long: 15, longEvery: 4, sound: true },
  gamification: { enabled: true, xp: {}, levelTitles: null, vacation: false, animations: true, garden: true },
  notifications: { enabled: false, quietStart: '23:00', quietEnd: '07:00', maxPerHour: 4 },
  privacy: { hideJournalPreviews: true, hideHealthInCalendar: true, lockJournal: false, ai: { enabled: false, health: false, finance: false, journal: false } },
  health: { calorieGoal: 2000, proteinGoal: null, carbGoal: null, fatGoal: null, waterGoal: 2000, waterServings: [150, 250, 330, 500], sleepGoalHours: 8, heightCm: null },
  finance: { monthlyBudget: null, currency: 'SAR' },
  study: { gpaScale: 5, gradeScale: DEFAULT_GRADE_SCALE_5, dailyStudyGoalMin: 120, dental: true },
  prayer: { enabled: false, lat: null, lng: null, city: null, method: 'umm_al_qura' },
};

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Deep merge where arrays and primitives from `over` replace `base`. */
export function deepMerge<T>(base: T, over: unknown): T {
  if (!isObj(base) || !isObj(over)) return (over === undefined ? base : (over as T));
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined) continue;
    out[k] = isObj(v) && isObj((base as Record<string, unknown>)[k]) ? deepMerge((base as Record<string, unknown>)[k], v) : v;
  }
  return out as T;
}
