import { lazy } from 'react';
import { makeHub } from './plan/makeHub';

/** Money and subscriptions together: a subscription is just money that repeats. */
export default makeHub('المال', 'Money', [
  { id: 'money', page: 'life.finance', ar: 'ر.س المال', en: 'Money', C: lazy(() => import('./Finance')) },
  { id: 'subs', page: 'life.subscriptions', ar: '↻ الاشتراكات', en: '↻ Subscriptions', C: lazy(() => import('./Subscriptions')) },
]);
