import { lazy } from 'react';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/hooks';
import { isIdOn } from '@/app/registry';
import { Hub, type HubTab } from './plan/Hub';

const Goals = lazy(() => import('./Goals'));
const Projects = lazy(() => import('./Projects'));
const Habits = lazy(() => import('./Habits'));

/**
 * Goals, projects and habits together — the "why → how → every day" chain: a goal is reached
 * through projects (with milestones and tasks) and kept alive by habits.
 */
export default function GoalsHub() {
  const { L } = useI18n();
  const s = useSettings();
  const on = (id: string) => isIdOn(id, s.modules, s.modulePreset);
  const all: Array<HubTab & { page: string }> = [
    { id: 'goals', page: 'life.goals', ar: '◆ الأهداف', en: '◆ Goals', C: Goals },
    { id: 'projects', page: 'life.projects', ar: '▣ المشاريع', en: '▣ Projects', C: Projects },
    { id: 'habits', page: 'life.habits', ar: '↻ العادات', en: '↻ Habits', C: Habits },
  ];
  const tabs = all.filter((t) => on(t.page));
  return <Hub tabs={tabs.length ? tabs : all.slice(0, 1)} label={L('الأهداف والعادات', 'Goals & habits')} />;
}
