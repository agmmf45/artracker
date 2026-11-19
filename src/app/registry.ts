import type { ComponentType } from 'react';
import {
  LayoutDashboard, Sun, CalendarDays, Inbox, ListChecks, Repeat, Target, FolderKanban, NotebookPen, Network, BookHeart,
  Wallet, CreditCard, Library, ClipboardCheck, Trophy, Users, GraduationCap, BookOpen, Presentation, FileCheck2, FileClock,
  CalendarRange, Timer, Layers, CircleHelp, Stethoscope, FlaskConical, Link2, Award, BarChart3, HeartPulse, Dumbbell, Apple,
  UtensilsCrossed, Droplets, Moon, Scale, Ruler, Footprints, BatteryCharging, Pill, FileHeart, User, SlidersHorizontal, Palette,
  Boxes, Tags, Bell, Zap, Gamepad2, Plug, Lock, ShieldCheck, Database, CalendarClock, type LucideIcon,
} from 'lucide-react';

export type SectionId = 'life' | 'study' | 'health' | 'settings';

export interface PageDef {
  id: string;
  section: SectionId;
  path: string;
  ar: string;
  en: string;
  icon: LucideIcon;
  /** module file under src/modules, e.g. 'life/Tasks' */
  file: string;
  /** overview/settings pages cannot be hidden */
  core?: boolean;
  defaultOn?: boolean;
  /** a hub page that holds other pages as tabs: it is on when any of these page ids is on */
  members?: string[];
  /** false = reachable by link (e.g. from the Study sheet) but not listed in navigation */
  nav?: boolean;
  /** merged into a hub: not in navigation; its old path redirects here (query string kept) */
  redirect?: string;
}

export interface Page extends PageDef {
  load: () => Promise<{ default: ComponentType }>;
}

// Pages are discovered from the files that exist, so a page only appears in navigation once it is built.
const FILES = import.meta.glob<{ default: ComponentType }>('/src/modules/*/*.tsx');

export interface SectionDef { id: SectionId; ar: string; en: string; icon: LucideIcon; path: string }

export const SECTIONS: SectionDef[] = [
  { id: 'life', ar: 'الحياة', en: 'Life', icon: Sun, path: '/life' },
  { id: 'study', ar: 'الدراسة', en: 'Study', icon: GraduationCap, path: '/study' },
  { id: 'health', ar: 'الصحة', en: 'Health', icon: HeartPulse, path: '/health' },
  { id: 'settings', ar: 'الإعدادات', en: 'Settings', icon: SlidersHorizontal, path: '/settings' },
];

const p = (def: PageDef) => def;

const ALL: PageDef[] = [
  // ── LIFE ──
  // the Life notebook: day · week · month · notebook (always on); everything else is a tool page
  p({ id: 'life.today', section: 'life', path: '/life/today', ar: 'اليوم', en: 'Day', icon: Sun, core: true, file: 'life/Today' }),
  p({ id: 'life.week', section: 'life', path: '/life/week', ar: 'الأسبوع', en: 'Week', icon: CalendarRange, core: true, file: 'life/Week' }),
  p({ id: 'life.month', section: 'life', path: '/life/month', ar: 'الشهر', en: 'Month', icon: CalendarDays, core: true, file: 'life/Month' }),
  p({ id: 'life.notebook', section: 'life', path: '/life/notebook', ar: 'الدفتر', en: 'Notebook', icon: BookOpen, core: true, file: 'life/Notebook' }),
  // merged pages: Tasks holds the Inbox; Goals holds Projects and Habits; the Notebook holds Notes
  p({ id: 'life.tasks', section: 'life', path: '/life/tasks', ar: 'المهام', en: 'Tasks', icon: ListChecks, file: 'life/TasksHub', members: ['life.tasks', 'life.inbox'] }),
  p({ id: 'life.goals', section: 'life', path: '/life/goals', ar: 'الأهداف والعادات', en: 'Goals & habits', icon: Target, file: 'life/GoalsHub', members: ['life.goals', 'life.projects', 'life.habits'] }),
  p({ id: 'life.planner', section: 'life', path: '/life/planner', ar: 'المخطط', en: 'Planner', icon: CalendarClock, file: 'life/Planner' }),
  p({ id: 'life.calendar', section: 'life', path: '/life/calendar', ar: 'التقويم', en: 'Calendar', icon: CalendarDays, file: 'life/Calendar' }),
  p({ id: 'life.inbox', section: 'life', path: '/life/inbox', ar: 'الوارد', en: 'Inbox', icon: Inbox, file: 'life/Inbox', redirect: '/life/tasks?tab=inbox' }),
  p({ id: 'life.habits', section: 'life', path: '/life/habits', ar: 'العادات', en: 'Habits', icon: Repeat, file: 'life/Habits', redirect: '/life/goals?tab=habits' }),
  p({ id: 'life.projects', section: 'life', path: '/life/projects', ar: 'المشاريع', en: 'Projects', icon: FolderKanban, file: 'life/Projects', redirect: '/life/goals?tab=projects' }),
  p({ id: 'life.notes', section: 'life', path: '/life/notes', ar: 'الملاحظات', en: 'Notes', icon: NotebookPen, file: 'life/Notes', redirect: '/life/notebook?tab=notes' }),
  p({ id: 'life.brain', section: 'life', path: '/life/brain', ar: 'العقل الثاني', en: 'Second Brain', icon: Network, file: 'life/Brain', redirect: '/life/notebook?tab=notes' }),
  p({ id: 'life.journal', section: 'life', path: '/life/journal', ar: 'اليوميات', en: 'Journal', icon: BookHeart, file: 'life/Journal', redirect: '/life/notebook?tab=journal' }),
  p({ id: 'life.finance', section: 'life', path: '/life/finance', ar: 'المال', en: 'Money', icon: Wallet, file: 'life/FinanceHub', members: ['life.finance', 'life.subscriptions'] }),
  p({ id: 'life.subscriptions', section: 'life', path: '/life/subscriptions', ar: 'الاشتراكات', en: 'Subscriptions', icon: CreditCard, file: 'life/Subscriptions', redirect: '/life/finance?tab=subs' }),
  p({ id: 'life.library', section: 'life', path: '/life/library', ar: 'مكتبتي ومراجعاتي', en: 'Library & reviews', icon: Library, file: 'life/LibraryHub', members: ['life.library', 'life.reviews'] }),
  p({ id: 'life.reviews', section: 'life', path: '/life/reviews', ar: 'المراجعات', en: 'Reviews', icon: ClipboardCheck, file: 'life/Reviews', redirect: '/life/library?tab=reviews' }),
  p({ id: 'life.achievements', section: 'life', path: '/life/achievements', ar: 'رحلتي والأصدقاء', en: 'Journey & friends', icon: Trophy, file: 'life/JourneyHub', members: ['life.achievements', 'life.friends'] }),
  p({ id: 'life.friends', section: 'life', path: '/life/friends', ar: 'الأصدقاء', en: 'Friends', icon: Users, file: 'life/Friends', redirect: '/life/achievements?tab=friends' }),

  // ── STUDY ──
  p({ id: 'study.overview', section: 'study', path: '/study', ar: 'ورقة الدراسة', en: 'Study sheet', icon: LayoutDashboard, core: true, file: 'study/Sheet' }),
  p({ id: 'study.courses', section: 'study', path: '/study/courses', ar: 'المقررات', en: 'Courses', icon: BookOpen, file: 'study/Courses' }),
  p({ id: 'study.schedule', section: 'study', path: '/study/schedule', ar: 'الجدول', en: 'Schedule', icon: CalendarRange, file: 'study/Schedule' }),
  p({ id: 'study.lectures', section: 'study', path: '/study/lectures', ar: 'المحاضرات', en: 'Lectures', icon: Presentation, file: 'study/Lectures', nav: false }),
  p({ id: 'study.assignments', section: 'study', path: '/study/assignments', ar: 'الواجبات', en: 'Assignments', icon: FileCheck2, file: 'study/Assignments', nav: false }),
  p({ id: 'study.exams', section: 'study', path: '/study/exams', ar: 'الاختبارات', en: 'Exams', icon: FileClock, file: 'study/Exams', nav: false }),
  p({ id: 'study.planner', section: 'study', path: '/study/planner', ar: 'مخطط المذاكرة', en: 'Study Planner', icon: CalendarClock, file: 'study/StudyPlanner', nav: false }),
  p({ id: 'study.focus', section: 'study', path: '/study/focus', ar: 'جلسات التركيز', en: 'Focus', icon: Timer, file: 'study/Focus', nav: false }),
  p({ id: 'study.flashcards', section: 'study', path: '/study/flashcards', ar: 'البطاقات', en: 'Flashcards', icon: Layers, file: 'study/Flashcards', nav: false }),
  p({ id: 'study.qbank', section: 'study', path: '/study/qbank', ar: 'بنك الأسئلة', en: 'Question Bank', icon: CircleHelp, file: 'study/QBank', nav: false }),
  p({ id: 'study.clinical', section: 'study', path: '/study/clinical', ar: 'المتطلبات السريرية', en: 'Clinical Tracker', icon: Stethoscope, file: 'study/Clinical' }),
  p({ id: 'study.research', section: 'study', path: '/study/research', ar: 'البحث العلمي', en: 'Research', icon: FlaskConical, file: 'study/Research', nav: false }),
  p({ id: 'study.resources', section: 'study', path: '/study/resources', ar: 'المصادر', en: 'Resources', icon: Link2, file: 'study/Resources', nav: false }),
  p({ id: 'study.grades', section: 'study', path: '/study/grades', ar: 'الدرجات والمعدل', en: 'Grades & GPA', icon: Award, file: 'study/Grades', nav: false }),
  p({ id: 'study.analytics', section: 'study', path: '/study/analytics', ar: 'التحليلات', en: 'Analytics', icon: BarChart3, file: 'study/Analytics', nav: false }),

  // ── HEALTH ──
  p({ id: 'health.overview', section: 'health', path: '/health', ar: 'نظرة عامة', en: 'Overview', icon: LayoutDashboard, core: true, file: 'health/Overview', redirect: '/health/workouts' }),
  p({ id: 'health.workouts', section: 'health', path: '/health/workouts', ar: 'التمارين', en: 'Workouts', icon: Dumbbell, file: 'health/WorkoutsHub', members: ['health.workouts', 'health.weight', 'health.body', 'health.sleep', 'health.activity', 'health.recovery'] }),
  p({ id: 'health.nutrition', section: 'health', path: '/health/nutrition', ar: 'التغذية', en: 'Nutrition', icon: Apple, file: 'health/NutritionHub', members: ['health.nutrition', 'health.meals', 'health.water'] }),
  p({ id: 'health.meals', section: 'health', path: '/health/meals', ar: 'تخطيط الوجبات', en: 'Meal Planner', icon: UtensilsCrossed, file: 'health/MealPlanner', redirect: '/health/nutrition?tab=planner' }),
  p({ id: 'health.water', section: 'health', path: '/health/water', ar: 'الماء', en: 'Water', icon: Droplets, file: 'health/Water', redirect: '/health/nutrition?tab=water' }),
  p({ id: 'health.sleep', section: 'health', path: '/health/sleep', ar: 'النوم', en: 'Sleep', icon: Moon, file: 'health/Sleep', redirect: '/health/workouts?tab=sleep' }),
  p({ id: 'health.weight', section: 'health', path: '/health/weight', ar: 'الوزن', en: 'Weight', icon: Scale, file: 'health/Weight', redirect: '/health/workouts?tab=weight' }),
  p({ id: 'health.body', section: 'health', path: '/health/body', ar: 'القياسات', en: 'Measurements', icon: Ruler, file: 'health/Body', redirect: '/health/workouts?tab=body' }),
  p({ id: 'health.activity', section: 'health', path: '/health/activity', ar: 'النشاط', en: 'Activity', icon: Footprints, file: 'health/Activity', redirect: '/health/workouts?tab=activity' }),
  p({ id: 'health.recovery', section: 'health', path: '/health/recovery', ar: 'الاستشفاء', en: 'Recovery', icon: BatteryCharging, file: 'health/Recovery', redirect: '/health/workouts?tab=recovery' }),
  p({ id: 'health.medication', section: 'health', path: '/health/medication', ar: 'الأدوية', en: 'Medication', icon: Pill, file: 'health/Medication' }),
  p({ id: 'health.records', section: 'health', path: '/health/records', ar: 'السجلات الصحية', en: 'Health Records', icon: FileHeart, file: 'health/Records' }),

  // ── SETTINGS ──
  p({ id: 'settings.profile', section: 'settings', path: '/settings', ar: 'الملف الشخصي', en: 'Profile', icon: User, core: true, file: 'settings/Profile' }),
  p({ id: 'settings.general', section: 'settings', path: '/settings/general', ar: 'عام', en: 'General', icon: SlidersHorizontal, core: true, file: 'settings/General' }),
  p({ id: 'settings.appearance', section: 'settings', path: '/settings/appearance', ar: 'المظهر', en: 'Appearance', icon: Palette, core: true, file: 'settings/Appearance' }),
  p({ id: 'settings.modules', section: 'settings', path: '/settings/modules', ar: 'الوحدات', en: 'Modules', icon: Boxes, core: true, file: 'settings/Modules' }),
  p({ id: 'settings.categories', section: 'settings', path: '/settings/categories', ar: 'التصنيفات', en: 'Categories', icon: Tags, core: true, file: 'settings/Categories' }),
  p({ id: 'settings.notifications', section: 'settings', path: '/settings/notifications', ar: 'التنبيهات', en: 'Notifications', icon: Bell, core: true, file: 'settings/Notifications' }),
  p({ id: 'settings.productivity', section: 'settings', path: '/settings/productivity', ar: 'الإنتاجية', en: 'Productivity', icon: Zap, core: true, file: 'settings/Productivity' }),
  p({ id: 'settings.gamification', section: 'settings', path: '/settings/gamification', ar: 'التحفيز', en: 'Gamification', icon: Gamepad2, core: true, file: 'settings/Gamification' }),
  p({ id: 'settings.integrations', section: 'settings', path: '/settings/integrations', ar: 'التكاملات', en: 'Integrations', icon: Plug, core: true, file: 'settings/Integrations' }),
  p({ id: 'settings.privacy', section: 'settings', path: '/settings/privacy', ar: 'الخصوصية', en: 'Privacy', icon: Lock, core: true, file: 'settings/Privacy' }),
  p({ id: 'settings.security', section: 'settings', path: '/settings/security', ar: 'الأمان', en: 'Security', icon: ShieldCheck, core: true, file: 'settings/Security' }),
  p({ id: 'settings.data', section: 'settings', path: '/settings/data', ar: 'البيانات', en: 'Data', icon: Database, core: true, file: 'settings/Data' }),
];

/** Each section's main pages, shown first; the rest are grouped under "Tools". */
export const LIFE_MAIN = new Set(['life.today', 'life.week', 'life.month', 'life.notebook', 'life.tasks', 'life.goals', 'life.planner', 'study.overview', 'health.workouts', 'health.nutrition']);

export const PAGES: Page[] = ALL.flatMap((def) => {
  const load = FILES[`/src/modules/${def.file}.tsx`] as Page['load'] | undefined;
  return load ? [{ ...def, load }] : [];
});

/** Modules shown by default. Everything else is one toggle away in Settings › Modules. */
const DEFAULT_ON = new Set([
  'life.today', 'life.planner', 'life.calendar', 'life.inbox', 'life.tasks', 'life.habits', 'life.goals', 'life.projects', 'life.notes',
  'life.journal', 'life.finance', 'life.reviews', 'life.achievements', 'life.friends',
  'study.courses', 'study.schedule', 'study.lectures', 'study.assignments', 'study.exams', 'study.planner', 'study.focus', 'study.flashcards', 'study.grades',
  'health.workouts', 'health.nutrition', 'health.water', 'health.sleep', 'health.weight',
]);

/** Explicit toggle wins; otherwise the chosen preset decides (so new modules follow "Complete"), else defaults. */
export function isPageOn(p: PageDef, modules: Record<string, boolean>, preset?: string | null): boolean {
  if (p.core) return true;
  if (p.members) return p.members.some((id) => isIdOn(id, modules, preset));
  return isIdOn(p.id, modules, preset);
}

/** The on/off rule for one page id (used for hub tabs too). */
export function isIdOn(id: string, modules: Record<string, boolean>, preset?: string | null): boolean {
  if (modules[id] !== undefined) return modules[id];
  if (preset && PRESETS[preset]) return PRESETS[preset].on.includes(id);
  return DEFAULT_ON.has(id);
}

export const PRESETS: Record<string, { ar: string; en: string; on: string[] }> = {
  minimal: { ar: 'بسيط', en: 'Minimal', on: ['life.today', 'life.tasks', 'life.habits', 'life.calendar', 'life.notes'] },
  student: { ar: 'طالب', en: 'Student', on: ['life.today', 'life.tasks', 'life.calendar', 'life.habits', 'life.notes', 'study.courses', 'study.schedule', 'study.lectures', 'study.assignments', 'study.exams', 'study.planner', 'study.focus', 'study.flashcards', 'study.qbank', 'study.clinical', 'study.grades', 'study.analytics'] },
  productivity: { ar: 'إنتاجية', en: 'Productivity', on: ['life.today', 'life.planner', 'life.calendar', 'life.inbox', 'life.tasks', 'life.habits', 'life.goals', 'life.projects', 'life.notes', 'life.brain', 'life.reviews', 'study.focus'] },
  health: { ar: 'صحة', en: 'Health focused', on: ['life.today', 'life.tasks', 'life.habits', 'health.workouts', 'health.nutrition', 'health.meals', 'health.water', 'health.sleep', 'health.weight', 'health.body', 'health.activity', 'health.recovery'] },
  complete: { ar: 'Life OS كامل', en: 'Complete Life OS', on: PAGES.filter((x) => !x.core).map((x) => x.id) },
};
