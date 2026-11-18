import { describe, it, expect } from 'vitest';
import { bestSets, e1rm, setsPerMuscle, volume } from './model';

const ex = (name: string, muscle: string, sets: Array<[number, number, boolean?]>) => ({ id: name, name, muscle, notes: '', sets: sets.map(([weight, reps, done = true]) => ({ weight, reps, rpe: '', done })) });

describe('workout math', () => {
  it('volume counts only completed sets', () => {
    expect(volume({ exercises: [ex('bench', 'صدر', [[60, 10], [70, 8], [80, 5, false]])] })).toBe(600 + 560);
  });

  it('PR: heavier wins, ties broken by reps, legacy PRs included', () => {
    const m = bestSets([{ exercises: [ex('bench', 'صدر', [[80, 5], [80, 6]])], date: '2026-11-17' }], [{ exercise: 'bench', weight: 75, reps: 10, date: '2026-01-01' }]);
    expect(m.get('bench')).toEqual({ weight: 80, reps: 6, date: '2026-11-17' });
  });

  it('sets per muscle and e1RM', () => {
    expect(setsPerMuscle([{ exercises: [ex('a', 'صدر', [[1, 1], [1, 1]]), ex('b', 'ظهر', [[1, 1]])] }])).toEqual({ 'صدر': 2, 'ظهر': 1 });
    expect(e1rm(100, 5)).toBe(117);
  });
});
