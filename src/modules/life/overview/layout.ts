import type { ComponentType } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { upsert } from '@/core/repo';
import type { WidgetProps } from './widgets';
import {
  WelcomeWidget, GlanceWidget, PrioritiesWidget, TimelineWidget, DeadlinesWidget, SuggestedWidget, RoutineWidget,
  QuickNoteWidget, FocusWidget, BalanceWidget, JourneyWidget, GoalsWidget, MoneyWidget, StudyWidget,
} from './widgets';
import { InboxWidget, NotesWidget, ProjectsWidget, CalendarWidget, ProgressWidget, HealthWidget, TrendsWidget, RewardWidget } from './widgets2';
import { useMedia } from '@/core/hooks';

export type WSize = 's' | 'm' | 'l' | 'xl';

export interface WidgetDef { id: string; ar: string; en: string; layer: 1 | 2 | 3 | 4 | 5; size: WSize; C: ComponentType<WidgetProps> }

export const WIDGETS: WidgetDef[] = [
  { id: 'welcome', ar: 'الترحيب', en: 'Welcome', layer: 1, size: 'xl', C: WelcomeWidget },
  { id: 'glance', ar: 'نظرة سريعة', en: 'At a glance', layer: 2, size: 'xl', C: GlanceWidget },
  { id: 'priorities', ar: 'أولويات اليوم', en: 'Top priorities', layer: 3, size: 'm', C: PrioritiesWidget },
  { id: 'timeline', ar: 'خط اليوم', en: "Today's timeline", layer: 3, size: 'm', C: TimelineWidget },
  { id: 'suggested', ar: 'الخطوة التالية', en: 'Next step', layer: 3, size: 's', C: SuggestedWidget },
  { id: 'routine', ar: 'روتين اليوم', en: 'Routine', layer: 3, size: 's', C: RoutineWidget },
  { id: 'deadlines', ar: 'المواعيد النهائية', en: 'Deadlines', layer: 3, size: 's', C: DeadlinesWidget },
  { id: 'focus', ar: 'التركيز', en: 'Focus', layer: 3, size: 's', C: FocusWidget },
  { id: 'quicknote', ar: 'ملاحظة سريعة', en: 'Quick note', layer: 3, size: 's', C: QuickNoteWidget as ComponentType<WidgetProps> },
  { id: 'study', ar: 'الدراسة', en: 'Study', layer: 2, size: 's', C: StudyWidget },
  { id: 'money', ar: 'المال', en: 'Money', layer: 2, size: 's', C: MoneyWidget },
  { id: 'balance', ar: 'توازن الحياة', en: 'Life balance', layer: 4, size: 'm', C: BalanceWidget },
  { id: 'goals', ar: 'الأهداف', en: 'Goals', layer: 4, size: 'm', C: GoalsWidget },
  { id: 'journey', ar: 'رحلتي', en: 'Journey', layer: 5, size: 'l', C: JourneyWidget },
  { id: 'progress', ar: 'تقدم المهام', en: 'Task progress', layer: 2, size: 'm', C: ProgressWidget },
  { id: 'calendar', ar: 'لمحة التقويم', en: 'Calendar snapshot', layer: 3, size: 'm', C: CalendarWidget },
  { id: 'inbox', ar: 'الوارد', en: 'Inbox', layer: 3, size: 's', C: InboxWidget },
  { id: 'notes', ar: 'آخر الملاحظات', en: 'Recent notes', layer: 3, size: 's', C: NotesWidget as ComponentType<WidgetProps> },
  { id: 'health', ar: 'لمحة الصحة', en: 'Health snapshot', layer: 2, size: 's', C: HealthWidget },
  { id: 'projects', ar: 'المشاريع', en: 'Projects', layer: 4, size: 's', C: ProjectsWidget as ComponentType<WidgetProps> },
  { id: 'trends', ar: 'اتجاهات النشاط', en: 'Activity trends', layer: 5, size: 'm', C: TrendsWidget },
  { id: 'reward', ar: 'تقدم المكافآت', en: 'Reward progress', layer: 5, size: 's', C: RewardWidget as ComponentType<WidgetProps> },
];

/** Widgets that render nothing when their feature is switched off. */
export const NEEDS_GAMIFICATION = new Set(['reward']);

export interface LayoutItem { id: string; size: WSize; hidden: boolean }
export interface LayoutData { items: LayoutItem[]; preset: string }

const all = (ids: string[], sizes: Record<string, WSize> = {}): LayoutItem[] => {
  const order = [...ids, ...WIDGETS.map((w) => w.id).filter((x) => !ids.includes(x))];
  return order.map((id) => ({ id, size: sizes[id] ?? WIDGETS.find((w) => w.id === id)!.size, hidden: !ids.includes(id) }));
};

export type Device = 'm' | 't' | 'd';

/**
 * Per-device defaults (spec: "do not simply scale desktop down").
 *  phone   — greeting, top 3, schedule, habits, quick capture, study, health, reward
 *  tablet  — + task progress, goals, quick notes, XP, two columns side by side
 *  desktop — banner, daily focus, priorities, calendar, progress, inbox, habits, notes,
 *            study, health, projects, goals, achievements, trends in a 3–4 column bento
 */
const half = (ids: string[]) => Object.fromEntries(ids.map((i) => [i, 'm' as WSize]));
const small = (ids: string[]) => Object.fromEntries(ids.map((i) => [i, 's' as WSize]));
export const DEVICE_DEFAULTS: Record<Device, LayoutItem[]> = {
  m: all(['welcome', 'priorities', 'timeline', 'routine', 'quicknote', 'study', 'health', 'reward']),
  t: all(['welcome', 'priorities', 'progress', 'timeline', 'routine', 'study', 'health', 'goals', 'quicknote', 'reward'], half(['priorities', 'progress', 'timeline', 'routine', 'study', 'health', 'goals', 'quicknote', 'reward'])),
  d: all(['welcome', 'suggested', 'priorities', 'calendar', 'progress', 'inbox', 'routine', 'notes', 'study', 'health', 'projects', 'goals', 'journey', 'trends'], { ...small(['suggested', 'priorities', 'calendar', 'progress', 'inbox', 'routine', 'notes', 'study', 'health', 'projects', 'goals']), journey: 'm', trends: 'm' }),
};

export const DASH_PRESETS: Record<string, { ar: string; en: string; items: LayoutItem[] }> = {
  complete: { ar: 'Life OS كامل', en: 'Complete Life OS', items: all(['welcome', 'glance', 'priorities', 'calendar', 'progress', 'timeline', 'suggested', 'inbox', 'routine', 'deadlines', 'focus', 'study', 'health', 'money', 'notes', 'quicknote', 'projects', 'balance', 'goals', 'trends', 'journey']) },
  minimal: { ar: 'بسيط', en: 'Minimal', items: all(['welcome', 'priorities', 'timeline', 'routine']) },
  student: { ar: 'طالب', en: 'Student', items: all(['welcome', 'glance', 'study', 'focus', 'priorities', 'timeline', 'deadlines', 'routine', 'trends', 'journey']) },
  productivity: { ar: 'إنتاجية', en: 'Productivity', items: all(['welcome', 'priorities', 'progress', 'calendar', 'timeline', 'suggested', 'inbox', 'deadlines', 'notes', 'quicknote', 'projects', 'goals', 'balance', 'journey']) },
  health: { ar: 'صحة', en: 'Health focused', items: all(['welcome', 'health', 'glance', 'routine', 'priorities', 'timeline', 'journey']) },
};

/** Current device class: phone < 768 ≤ tablet < 1280 ≤ desktop. Re-renders on resize/rotation. */
export function useDevice(): Device {
  const t = useMedia('(min-width: 768px)');
  const d = useMedia('(min-width: 1280px)');
  return d ? 'd' : t ? 't' : 'm';
}

export function deviceKind(): Device {
  if (typeof window === 'undefined') return 'd';
  return window.matchMedia('(min-width: 1280px)').matches ? 'd' : window.matchMedia('(min-width: 768px)').matches ? 't' : 'm';
}

export function useLayout(kind: Device): LayoutData | undefined {
  return useLiveQuery(async () => {
    const own = await db().records.get(`layout:overview:${kind}`);
    const data = (own?.data as unknown as LayoutData | undefined) ?? { items: DEVICE_DEFAULTS[kind], preset: 'device' };
    // add widgets introduced after the layout was saved
    const known = new Set(data.items.map((i) => i.id));
    const items = [...data.items.filter((i) => WIDGETS.some((w) => w.id === i.id)), ...WIDGETS.filter((w) => !known.has(w.id)).map((w) => ({ id: w.id, size: w.size, hidden: true }))];
    return { ...data, items };
  }, [kind]);
}

export function saveLayout(kind: Device, data: LayoutData) {
  return upsert('layout', `layout:overview:${kind}`, data);
}

/**
 * Grid spans. Phone: 1 column. Tablet: 6 tracks (s = third, m = half, l/xl = full).
 * Desktop: 12 tracks — s = 3 per row (4 per row from 1536px), m = half, l = two thirds.
 */
export const SPAN: Record<WSize, string> = {
  s: 'md:col-span-2 xl:col-span-4 2xl:col-span-3',
  m: 'md:col-span-3 xl:col-span-6',
  l: 'md:col-span-6 xl:col-span-8 2xl:col-span-9',
  xl: 'md:col-span-6 xl:col-span-12',
};
