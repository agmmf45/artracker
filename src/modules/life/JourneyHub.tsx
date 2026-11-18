import { lazy } from 'react';
import { makeHub } from './plan/makeHub';

/** Your progress and the people cheering you on, in one place. */
export default makeHub('رحلتي والأصدقاء', 'Journey & friends', [
  { id: 'journey', page: 'life.achievements', ar: '🏅 رحلتي', en: '🏅 Journey', C: lazy(() => import('./Achievements')) },
  { id: 'friends', page: 'life.friends', ar: '👥 الأصدقاء', en: '👥 Friends', C: lazy(() => import('./Friends')) },
]);
