import type { Rec } from '@shared/records';

/** Exercise library (kept from v4 so existing workouts and programs keep matching). */
export const EXERCISES: Record<string, string[]> = {
  'صدر': ['🏋️ بنش برس', '🔺 إنكلاين بنش', '🔻 ديكلاين بنش', '🤸 تمريرة عرضية', '💪 دمبل فلاي', '🔄 كيبل كروس أوفر', '🏋️ دمبل بنش', '🔺 إنكلاين دمبل'],
  'ظهر': ['🏋️ ديدليفت', '🚣 بار رو', '💪 لات بول داون', '🔄 كيبل رو', '🤸 بول اب', '🏋️ تي بار رو', '💪 دمبل رو', '🔄 سيتد رو'],
  'كتف': ['🏋️ أوفرهيد برس', '↕️ لاترال ريز', '⬆️ فرونت ريز', '🔄 فيس بول', '🔃 ريفيرس فلاي', '🏋️ دمبل شولدر برس', '💪 أرنولد برس', '🔄 شراغز'],
  'بايسبس': ['💪 بار كيرل', '🔄 هامر كيرل', '📐 إنكلاين كيرل', '🔀 كونسنتريشن كيرل', '💪 إي زي بار كيرل', '🔄 كيبل كيرل'],
  'ترايسبس': ['⬇️ تراي بوش داون', '🏠 سكال كراشر', '💎 دايموند بوش اب', '🔄 أوفرهيد إكستنشن', '🏋️ كلوز جريب بنش', '💪 دبس', '🔄 كيكباك'],
  'ساعد': ['🤜 ريست كيرل', '🔄 ريفيرس كيرل', '🤏 فارمر ووك', '🔁 ريست رولر', '💪 هامر كيرل', '🤲 بيهايند باك ريست كيرل'],
  'ترابس': ['🤷 شراغز', '🏋️ بار شراغز', '💪 دمبل شراغز', '🔼 رفعة عمودية', '🤸 فيس بول', '🏋️ رومانيان ديدليفت'],
  'ساق': ['🦶 كالف ريز واقف', '🪑 كالف ريز جالس', '🏋️ ليج برس كالف', '⬆️ سنجل ليج كالف', '🐎 دونكي كالف ريز'],
  'أرداف': ['🍑 هيب ثرست', '🌉 جلوت بريدج', '🏋️ رومانيان ديدليفت', '⬆️ لانج', '💪 بلغاريان سبليت', '🔄 كيك باك', '🏋️ سومو ديدليفت'],
  'خلفي الفخذ': ['🔄 ليج كيرل', '🏋️ رومانيان ديدليفت', '🦵 ستيف ليج ديدليفت', '🌅 جود مورنينج', '⬆️ نورديك كيرل', '🪑 سيتد ليج كيرل'],
  'فخذ': ['🦵 سكوات', '🏋️ ليج برس', '🪑 ليج إكستنشن', '⬆️ لانج', '🦵 هاك سكوات', '🏋️ فرونت سكوات', '💪 بلغاريان سبليت'],
  'أسفل الظهر': ['🌅 جود مورنينج', '🔼 هايبر إكستنشن', '🏋️ رومانيان ديدليفت', '🦵 ستيف ليج ديدليفت', '🧱 بلانك', '🌉 جلوت بريدج'],
  'رجل': ['🦵 سكوات', '🏋️ ليج برس', '⬆️ لانج', '🔄 ليج كيرل', '🦶 كالف ريز', '🏋️ فرونت سكوات', '💪 بلغاريان سبليت', '🔄 ليج إكستنشن', '🦵 هاك سكوات', '🏋️ رومانيان ديدليفت'],
  'بطن': ['🔄 كرنش', '🏋️ بلانك', '🔃 رشيان تويست', '⬆️ ليج ريز', '🔄 ماونتن كلايمبر', '💪 ابـ رول آوت', '🔄 سايد بلانك', '⬆️ هانجنج ليج ريز'],
  'كارديو': ['🏃 ركض', '🚴 دراجة', '🎿 إليبتيكال', '🏊 سباحة', '🪂 جامبينغ جاك', '🏃 هيت', '🚶 مشي سريع', '🚣 رووينج'],
};

/** Arabic muscle key → ExerciseDB target/bodyPart (from the v4 Exercise Explorer). */
export const EXDB: Record<string, { target: string; bodyPart: string }> = {
  'صدر': { target: 'pectorals', bodyPart: 'chest' }, 'ظهر': { target: 'lats', bodyPart: 'back' }, 'أسفل الظهر': { target: 'spine', bodyPart: 'back' },
  'كتف': { target: 'delts', bodyPart: 'shoulders' }, 'بايسبس': { target: 'biceps', bodyPart: 'upper arms' }, 'باي': { target: 'biceps', bodyPart: 'upper arms' },
  'ترايسبس': { target: 'triceps', bodyPart: 'upper arms' }, 'رجل': { target: 'quads', bodyPart: 'upper legs' }, 'فخذ': { target: 'quads', bodyPart: 'upper legs' },
  'خلفي الفخذ': { target: 'hamstrings', bodyPart: 'upper legs' }, 'ساق': { target: 'calves', bodyPart: 'lower legs' }, 'بطن': { target: 'abs', bodyPart: 'waist' },
  'ساعد': { target: 'forearms', bodyPart: 'lower arms' }, 'ترابس': { target: 'traps', bodyPart: 'back' }, 'كارديو': { target: 'cardiovascular system', bodyPart: 'cardio' },
  'أرداف': { target: 'glutes', bodyPart: 'upper legs' },
};

export const TEMPLATES: Record<string, string[]> = {
  Push: ['صدر', 'كتف', 'ترايسبس'],
  Pull: ['ظهر', 'بايسبس', 'ترابس'],
  Legs: ['فخذ', 'خلفي الفخذ', 'أرداف', 'ساق'],
};

export interface WSet { reps: number | ''; weight: number | ''; rpe: number | '' | string; done: boolean }
export interface WExercise { id: string; name: string; muscle: string; notes: string; sets: WSet[] }
export interface WorkoutData {
  name: string; program_id: string | null; started_at: string; duration_min: number; exercises: WExercise[];
  calories?: number | null; distance?: number | null; source?: string | null; notes?: string;
}
export interface ProgramData { name: string; days: Array<{ name: string; exercises: Array<{ name: string; muscle: string; sets?: number; reps?: number }> }> }
export interface ActiveWorkout { name: string; program_id: string | null; started_at: string; exercises: WExercise[]; rest_until: string | null; rest_ex: string | null }

export type Workout = Rec<WorkoutData>;

export const num = (v: unknown) => (typeof v === 'number' ? v : parseFloat(String(v ?? ''))) || 0;

export function volume(w: Pick<WorkoutData, 'exercises'>): number {
  return w.exercises.reduce((s, e) => s + e.sets.filter((x) => x.done !== false).reduce((a, x) => a + num(x.reps) * num(x.weight), 0), 0);
}

/** Best set per exercise: heavier weight wins; same weight → more reps (v4 rule). */
export function bestSets(workouts: Array<Pick<WorkoutData, 'exercises'> & { date?: string | null }>, legacy: Array<{ exercise: string; weight: number; reps: number; date: string | null }> = []) {
  const m = new Map<string, { weight: number; reps: number; date: string | null }>();
  const consider = (name: string, weight: number, reps: number, date: string | null) => {
    if (!weight || !reps) return;
    const cur = m.get(name);
    if (!cur || weight > cur.weight || (weight === cur.weight && reps > cur.reps)) m.set(name, { weight, reps, date });
  };
  for (const p of legacy) consider(p.exercise, p.weight, p.reps, p.date);
  for (const w of workouts) for (const e of w.exercises) for (const s of e.sets) if (s.done !== false) consider(e.name, num(s.weight), num(s.reps), w.date ?? null);
  return m;
}

/** Estimated 1RM (Epley) — shown as an estimate. */
export const e1rm = (w: number, r: number) => (r <= 1 ? w : Math.round(w * (1 + r / 30)));

export function setsPerMuscle(workouts: Array<Pick<WorkoutData, 'exercises'>>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const w of workouts) for (const e of w.exercises) out[e.muscle] = (out[e.muscle] ?? 0) + e.sets.filter((s) => s.done !== false).length;
  return out;
}
