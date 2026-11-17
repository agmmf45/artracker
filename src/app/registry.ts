import type { ComponentType } from 'react';
import {
  LayoutDashboard, Sun, CalendarDays, Inbox, ListChecks, Repeat, Target, FolderKanban, NotebookPen, Network, BookHeart,
  Wallet, CreditCard, Library, ClipboardCheck, Trophy, Users, GraduationCap, BookOpen, Presentation, FileCheck2, FileClock,
  CalendarRange, Timer, Layers, CircleHelp, Stethoscope, FlaskConical, Link2, Award, BarChart3, HeartPulse, Dumbbell, Apple,
  UtensilsCrossed, Droplets, Moon, Scale, Ruler, Footprints, BatteryCharging, Pill, FileHeart, User, SlidersHorizontal, Palette,
  LayoutGrid, Boxes, Tags, Bell, Zap, Gamepad2, Plug, Lock, ShieldCheck, Database, CalendarClock, type LucideIcon,
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
  p({ id: 'life.overview', section: 'life', path: '/life', ar: 'نظرة عامة', en: 'Overview', icon: LayoutDashboard, core: true, file: 'life/Overview' }),
  p({ id: 'life.today', section: 'life', path: '/life/today', ar: 'اليوم', en: 'Today', icon: Sun, file: 'life/Today' }),
  p({ id: 'life.planner', section: 'life', path: '/life/planner', ar: 'المخطط', en: 'Planner', icon: CalendarClock, file: 'life/Planner' }),
  p({ id: 'life.calendar', section: 'life', path: '/life/calendar', ar: 'التقويم', en: 'Calendar', icon: CalendarDays, file: 'life/Calendar' }),
  p({ id: 'life.inbox', section: 'life', path: '/life/inbox', ar: 'الوارد', en: 'Inbox', icon: Inbox, file: 'life/Inbox' }),
  p({ id: 'life.tasks', section: 'life', path: '/life/tasks', ar: 'المهام', en: 'Tasks', icon: ListChecks, file: 'life/Tasks' }),
  p({ id: 'life.habits', section: 'life', path: '/life/habits', ar: 'العادات', en: 'Habits', icon: Repeat, file: 'life/Habits' }),
  p({ id: 'life.goals', section: 'life', path: '/life/goals', ar: 'الأهداف', en: 'Goals', icon: Target, file: 'life/Goals' }),
  p({ id: 'life.projects', section: 'life', path: '/life/projects', ar: 'المشاريع', en: 'Projects', icon: FolderKanban, file: 'life/Projects' }),
  p({ id: 'life.notes', section: 'life', path: '/life/notes', ar: 'الملاحظات', en: 'Notes', icon: NotebookPen, file: 'life/Notes' }),
  p({ id: 'life.brain', section: 'life', path: '/life/brain', ar: 'العقل الثاني', en: 'Second Brain', icon: Network, file: 'life/Brain' }),
  p({ id: 'life.journal', section: 'life', path: '/life/journal', ar: 'اليوميات', en: 'Journal', icon: BookHeart, file: 'life/Journal' }),
  p({ id: 'life.finance', section: 'life', path: '/life/finance', ar: 'المال', en: 'Finance', icon: Wallet, file: 'life/Finance' }),
  p({ id: 'life.subscriptions', section: 'life', path: '/life/subscriptions', ar: 'الاشتراكات', en: 'Subscriptions', icon: CreditCard, file: 'life/Subscriptions' }),
  p({ id: 'life.library', section: 'life', path: '/life/library', ar: 'مكتبتي', en: 'Library', icon: Library, file: 'life/Library' }),
  p({ id: 'life.reviews', section: 'life', path: '/life/reviews', ar: 'المراجعات', en: 'Reviews', icon: ClipboardCheck, file: 'life/Reviews' }),
  p({ id: 'life.achievements', section: 'life', path: '/life/achievements', ar: 'رحلتي', en: 'Journey', icon: Trophy, file: 'life/Achievements' }),
  p({ id: 'life.friends', section: 'life', path: '/life/friends', ar: 'الأصدقاء', en: 'Friends', icon: Users, file: 'life/Friends' }),

  // ── STUDY ──
  p({ id: 'study.overview', section: 'study', path: '/study', ar: 'نظرة عامة', en: 'Overview', icon: LayoutDashboard, core: true, file: 'study/Overview' }),
  p({ id: 'study.courses', section: 'study', path: '/study/courses', ar: 'المقررات', en: 'Courses', icon: BookOpen, file: 'study/Courses' }),
  p({ id: 'study.schedule', section: 'study', path: '/study/schedule', ar: 'الجدول', en: 'Schedule', icon: CalendarRange, file: 'study/Schedule' }),
  p({ id: 'study.lectures', section: 'study', path: '/study/lectures', ar: 'المحاضرات', en: 'Lectures', icon: Presentation, file: 'study/Lectures' }),
  p({ id: 'study.assignments', section: 'study', path: '/study/assignments', ar: 'الواجبات', en: 'Assignments', icon: FileCheck2, file: 'study/Assignments' }),
  p({ id: 'study.exams', section: 'study', path: '/study/exams', ar: 'الاختبارات', en: 'Exams', icon: FileClock, file: 'study/Exams' }),
  p({ id: 'study.planner', section: 'study', path: '/study/planner', ar: 'مخطط المذاكرة', en: 'Study Planner', icon: CalendarClock, file: 'study/StudyPlanner' }),
  p({ id: 'study.focus', section: 'study', path: '/study/focus', ar: 'جلسات التركيز', en: 'Focus', icon: Timer, file: 'study/Focus' }),
  p({ id: 'study.flashcards', section: 'study', path: '/study/flashcards', ar: 'البطاقات', en: 'Flashcards', icon: Layers, file: 'study/Flashcards' }),
  p({ id: 'study.qbank', section: 'study', path: '/study/qbank', ar: 'بنك الأسئلة', en: 'Question Bank', icon: CircleHelp, file: 'study/QBank' }),
  p({ id: 'study.clinical', section: 'study', path: '/study/clinical', ar: 'المتطلبات السريرية', en: 'Clinical Tracker', icon: Stethoscope, file: 'study/Clinical' }),
  p({ id: 'study.research', section: 'study', path: '/study/research', ar: 'البحث العلمي', en: 'Research', icon: FlaskConical, file: 'study/Research' }),
  p({ id: 'study.resources', section: 'study', path: '/study/resources', ar: 'المصادر', en: 'Resources', icon: Link2, file: 'study/Resources' }),
  p({ id: 'study.grades', section: 'study', path: '/study/grades', ar: 'الدرجات والمعدل', en: 'Grades & GPA', icon: Award, file: 'study/Grades' }),
  p({ id: 'study.analytics', section: 'study', path: '/study/analytics', ar: 'التحليلات', en: 'Analytics', icon: BarChart3, file: 'study/Analytics' }),

  // ── HEALTH ──
  p({ id: 'health.overview', section: 'health', path: '/health', ar: 'نظرة عامة', en: 'Overview', icon: LayoutDashboard, core: true, file: 'health/Overview' }),
  p({ id: 'health.workouts', section: 'health', path: '/health/workouts', ar: 'التمارين', en: 'Workouts', icon: Dumbbell, file: 'health/Workouts' }),
  p({ id: 'health.nutrition', section: 'health', path: '/health/nutrition', ar: 'التغذية', en: 'Nutrition', icon: Apple, file: 'health/Nutrition' }),
  p({ id: 'health.meals', section: 'health', path: '/health/meals', ar: 'تخطيط الوجبات', en: 'Meal Planner', icon: UtensilsCrossed, file: 'health/MealPlanner' }),
  p({ id: 'health.water', section: 'health', path: '/health/water', ar: 'الماء', en: 'Water', icon: Droplets, file: 'health/Water' }),
  p({ id: 'health.sleep', section: 'health', path: '/health/sleep', ar: 'النوم', en: 'Sleep', icon: Moon, file: 'health/Sleep' }),
  p({ id: 'health.weight', section: 'health', path: '/health/weight', ar: 'الوزن', en: 'Weight', icon: Scale, file: 'health/Weight' }),
  p({ id: 'health.body', section: 'health', path: '/health/body', ar: 'القياسات', en: 'Measurements', icon: Ruler, file: 'health/Body' }),
  p({ id: 'health.activity', section: 'health', path: '/health/activity', ar: 'النشاط', en: 'Activity', icon: Footprints, file: 'health/Activity' }),
  p({ id: 'health.recovery', section: 'health', path: '/health/recovery', ar: 'الاستشفاء', en: 'Recovery', icon: BatteryCharging, file: 'health/Recovery' }),
  p({ id: 'health.medication', section: 'health', path: '/health/medication', ar: 'الأدوية', en: 'Medication', icon: Pill, file: 'health/Medication' }),
  p({ id: 'health.records', section: 'health', path: '/health/records', ar: 'السجلات الصحية', en: 'Health Records', icon: FileHeart, file: 'health/Records' }),

  // ── SETTINGS ──
  p({ id: 'settings.profile', section: 'settings', path: '/settings', ar: 'الملف الشخصي', en: 'Profile', icon: User, core: true, file: 'settings/Profile' }),
  p({ id: 'settings.general', section: 'settings', path: '/settings/general', ar: 'عام', en: 'General', icon: SlidersHorizontal, core: true, file: 'settings/General' }),
  p({ id: 'settings.appearance', section: 'settings', path: '/settings/appearance', ar: 'المظهر', en: 'Appearance', icon: Palette, core: true, file: 'settings/Appearance' }),
  p({ id: 'settings.dashboard', section: 'settings', path: '/settings/dashboard', ar: 'لوحة التحكم', en: 'Dashboard', icon: LayoutGrid, core: true, file: 'settings/DashboardSettings' }),
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

export function isPageOn(p: PageDef, modules: Record<string, boolean>): boolean {
  if (p.core) return true;
  return modules[p.id] ?? DEFAULT_ON.has(p.id);
}

export const PRESETS: Record<string, { ar: string; en: string; on: string[] }> = {
  minimal: { ar: 'بسيط', en: 'Minimal', on: ['life.today', 'life.tasks', 'life.habits', 'life.calendar', 'life.notes'] },
  student: { ar: 'طالب', en: 'Student', on: ['life.today', 'life.tasks', 'life.calendar', 'life.habits', 'life.notes', 'study.courses', 'study.schedule', 'study.lectures', 'study.assignments', 'study.exams', 'study.planner', 'study.focus', 'study.flashcards', 'study.qbank', 'study.clinical', 'study.grades', 'study.analytics'] },
  productivity: { ar: 'إنتاجية', en: 'Productivity', on: ['life.today', 'life.planner', 'life.calendar', 'life.inbox', 'life.tasks', 'life.habits', 'life.goals', 'life.projects', 'life.notes', 'life.brain', 'life.reviews', 'study.focus'] },
  health: { ar: 'صحة', en: 'Health focused', on: ['life.today', 'life.tasks', 'life.habits', 'health.workouts', 'health.nutrition', 'health.meals', 'health.water', 'health.sleep', 'health.weight', 'health.body', 'health.activity', 'health.recovery'] },
  complete: { ar: 'Life OS كامل', en: 'Complete Life OS', on: PAGES.filter((x) => !x.core).map((x) => x.id) },
};
