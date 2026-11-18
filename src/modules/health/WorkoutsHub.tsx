import { lazy } from 'react';
import { makeHub } from '@/modules/life/plan/makeHub';

/**
 * Training, like the v4 fitness hub: an overview first (today's pick, the week, the recovery map,
 * weight and sleep), then the log and the body pages — weight, measurements, sleep, activity, recovery.
 */
export default makeHub('التمارين', 'Training', [
  { id: 'home', page: 'health.workouts', ar: 'نظرة عامة', en: 'Overview', C: lazy(() => import('./Overview')) },
  { id: 'log', page: 'health.workouts', ar: '🏋 السجل والبرامج', en: '🏋 Log & programs', C: lazy(() => import('./Workouts')) },
  { id: 'weight', page: 'health.weight', ar: 'الوزن', en: 'Weight', C: lazy(() => import('./Weight')) },
  { id: 'body', page: 'health.body', ar: 'القياسات', en: 'Measurements', C: lazy(() => import('./Body')) },
  { id: 'sleep', page: 'health.sleep', ar: 'النوم', en: 'Sleep', C: lazy(() => import('./Sleep')) },
  { id: 'activity', page: 'health.activity', ar: 'النشاط', en: 'Activity', C: lazy(() => import('./Activity')) },
  { id: 'recovery', page: 'health.recovery', ar: 'الاستشفاء', en: 'Recovery', C: lazy(() => import('./Recovery')) },
]);
