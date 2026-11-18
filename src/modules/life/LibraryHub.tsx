import { lazy } from 'react';
import { makeHub } from './plan/makeHub';

/** What you read/watch and how your weeks went — the "look back" shelf. */
export default makeHub('مكتبتي ومراجعاتي', 'Library & reviews', [
  { id: 'library', page: 'life.library', ar: '📚 مكتبتي', en: '📚 Library', C: lazy(() => import('./Library')) },
  { id: 'reviews', page: 'life.reviews', ar: '↻ المراجعات', en: '↻ Reviews', C: lazy(() => import('./Reviews')) },
]);
