import { lazy } from 'react';
import { makeHub } from '@/modules/life/plan/makeHub';

/** Nutrition, like the v4 nutrition page: today's calories and meals first, then the log, meal planning and water. */
export default makeHub('التغذية', 'Nutrition', [
  { id: 'home', page: 'health.nutrition', ar: 'نظرة عامة', en: 'Overview', C: lazy(() => import('./Overview').then((m) => ({ default: m.FoodHome }))) },
  { id: 'meals', page: 'health.nutrition', ar: '🍽 الوجبات', en: '🍽 Meals', C: lazy(() => import('./Nutrition')) },
  { id: 'planner', page: 'health.meals', ar: 'تخطيط الوجبات', en: 'Meal planning', C: lazy(() => import('./MealPlanner')) },
  { id: 'water', page: 'health.water', ar: 'الماء', en: 'Water', C: lazy(() => import('./Water')) },
]);
