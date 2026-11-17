import { describe, it, expect } from 'vitest';
import { courseGrade, generatePlan, gpa, pointsFor, requiredForTarget, blankCourse, type Lecture } from './model';
import { DEFAULT_GRADE_SCALE_5 } from '@/core/settings';

const lec = (id: string, status: string, understanding: number | null = 3): Lecture => ({
  id, type: 'lecture', status, parent_id: null, date: null, private: 0, created_at: '', updated_at: '', deleted_at: null, rev: 0,
  data: { title: id, course_id: 'c', chapter: '', number: null, objectives: '', summary: '', topics: [], resources: [], understanding, revisions: [], next_review: null },
});

describe('grades & GPA', () => {
  it('weighted course grade counts only graded components and projects the rest', () => {
    const c = blankCourse({ components: [
      { id: '1', name: 'Mid', weight: 30, score: 24, max: 30 },
      { id: '2', name: 'Quiz', weight: 10, score: 8, max: 10 },
      { id: '3', name: 'Final', weight: 60, score: null, max: 100 },
    ] });
    const g = courseGrade(c);
    expect(g.graded).toBe(40);
    expect(g.current).toBeCloseTo(80);
    expect(g.projected).toBeCloseTo(80);
  });

  it('maps percent to scale and computes credit-weighted GPA', () => {
    expect(pointsFor(91, DEFAULT_GRADE_SCALE_5)).toEqual({ letter: 'A', points: 4.75 });
    expect(gpa([{ credits: 3, points: 5 }, { credits: 2, points: 4 }])).toBeCloseTo(4.6);
  });

  it('target GPA simulation', () => {
    // 60 credits at 4.0, 30 remaining, target 4.2 → need 4.6
    expect(requiredForTarget(4, 60, 30, 4.2)).toBeCloseTo(4.6);
  });
});

describe('study plan generator', () => {
  it('skips mastered lectures, respects the daily budget and keeps the last day for review', () => {
    const plan = generatePlan({
      lectures: [lec('a', 'not_started', 2), lec('b', 'studied', 4), lec('c', 'mastered', 5)],
      examDate: '2026-12-10', startDate: '2026-12-01', dailyMinutes: 120, examTitle: 'Path',
    });
    expect(plan.some((b) => b.lecture_id === 'c')).toBe(false);
    const byDay = new Map<string, number>();
    for (const b of plan.filter((x) => !x.review)) byDay.set(b.date, (byDay.get(b.date) ?? 0) + b.minutes);
    for (const m of byDay.values()) expect(m).toBeLessThanOrEqual(120);
    expect(plan.at(-1)).toMatchObject({ date: '2026-12-09', review: true });
    expect(plan.filter((b) => b.date >= '2026-12-10')).toHaveLength(0);
    // harder, not-started lecture gets more time than a studied one
    const t = (id: string) => plan.filter((b) => b.lecture_id === id).reduce((s, b) => s + b.minutes, 0);
    expect(t('a')).toBeGreaterThan(t('b'));
  });
});
