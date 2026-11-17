import type { ComponentType } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { upsert } from '@/core/repo';
import type { WidgetProps } from './widgets';
import {
  WelcomeWidget, GlanceWidget, PrioritiesWidget, TimelineWidget, DeadlinesWidget, SuggestedWidget, RoutineWidget,
  QuickNoteWidget, FocusWidget, BalanceWidget, JourneyWidget, GoalsWidget, MoneyWidget, StudyWidget,
} from './widgets';

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
];

export interface LayoutItem { id: string; size: WSize; hidden: boolean }
export interface LayoutData { items: LayoutItem[]; preset: string }

const all = (ids: string[], hide: string[] = []): LayoutItem[] => {
  const order = [...ids, ...WIDGETS.map((w) => w.id).filter((x) => !ids.includes(x))];
  return order.map((id) => ({ id, size: WIDGETS.find((w) => w.id === id)!.size, hidden: hide.includes(id) || !ids.includes(id) }));
};

export const DASH_PRESETS: Record<string, { ar: string; en: string; items: LayoutItem[] }> = {
  complete: { ar: 'Life OS كامل', en: 'Complete Life OS', items: all(['welcome', 'glance', 'priorities', 'timeline', 'suggested', 'routine', 'deadlines', 'focus', 'study', 'money', 'quicknote', 'balance', 'goals', 'journey']) },
  minimal: { ar: 'بسيط', en: 'Minimal', items: all(['welcome', 'priorities', 'timeline', 'routine']) },
  student: { ar: 'طالب', en: 'Student', items: all(['welcome', 'glance', 'study', 'focus', 'priorities', 'timeline', 'deadlines', 'routine', 'journey']) },
  productivity: { ar: 'إنتاجية', en: 'Productivity', items: all(['welcome', 'priorities', 'timeline', 'suggested', 'deadlines', 'quicknote', 'goals', 'balance', 'journey']) },
  health: { ar: 'صحة', en: 'Health focused', items: all(['welcome', 'glance', 'routine', 'priorities', 'timeline', 'journey']) },
};

export function deviceKind(): 'd' | 'm' {
  return typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches ? 'd' : 'm';
}

export function useLayout(kind: 'd' | 'm'): LayoutData | undefined {
  return useLiveQuery(async () => {
    const own = await db().records.get(`layout:overview:${kind}`);
    const other = own ?? (await db().records.get(`layout:overview:${kind === 'd' ? 'm' : 'd'}`));
    const data = (other?.data as unknown as LayoutData | undefined) ?? { items: DASH_PRESETS.complete.items, preset: 'complete' };
    // add widgets introduced after the layout was saved
    const known = new Set(data.items.map((i) => i.id));
    const items = [...data.items.filter((i) => WIDGETS.some((w) => w.id === i.id)), ...WIDGETS.filter((w) => !known.has(w.id)).map((w) => ({ id: w.id, size: w.size, hidden: true }))];
    return { ...data, items };
  }, [kind]);
}

export function saveLayout(kind: 'd' | 'm', data: LayoutData) {
  return upsert('layout', `layout:overview:${kind}`, data);
}

export const SPAN: Record<WSize, string> = {
  s: 'md:col-span-3 lg:col-span-4',
  m: 'md:col-span-3 lg:col-span-6',
  l: 'md:col-span-6 lg:col-span-8',
  xl: 'md:col-span-6 lg:col-span-12',
};
