import { describe, it, expect } from 'vitest';
import { bestSets, e1rm, exercisesFromLast, muscleRecovery, previousSets, setsPerMuscle, suggestTemplate, volume } from './model';

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

describe('recovery and suggestions', () => {
  it('days since trained, umbrella legs key, and the most-rested template', () => {
    const r = muscleRecovery([
      { date: '2026-11-17', exercises: [ex('bench', 'صدر', [[60, 10]])] },
      { date: '2026-11-15', exercises: [ex('row', 'ظهر', [[60, 10]])] },
      { date: '2026-11-10', exercises: [ex('squat', 'رجل', [[100, 5]])] },
      { date: '2026-11-18', exercises: [ex('curl', 'بايسبس', [[10, 10, false]])] },
    ], '2026-11-18');
    expect(r['صدر']).toEqual({ days: 1, state: 'fresh' });
    expect(r['ظهر'].state).toBe('ready');
    expect(r['فخذ'].days).toBe(8);
    expect(r['بايسبس']).toBeUndefined();
    expect(suggestTemplate(r)).toBe('Legs');
    expect(suggestTemplate({})).toBeNull();
  });

  it('previous sets and starting from the last session of the same name', () => {
    const ws = [
      { name: 'Legs', started_at: '2026-11-10T10:00:00Z', exercises: [ex('squat', 'فخذ', [[95, 5], [95, 4]])] },
      { name: 'Legs', started_at: '2026-11-14T10:00:00Z', exercises: [ex('squat', 'فخذ', [[100, 5]])] },
    ];
    expect(previousSets(ws, 'squat', '2026-11-14T09:00:00Z').map((s) => s.weight)).toEqual([95, 95]);
    let n = 0;
    const next = exercisesFromLast(ws, 'Legs', () => `id${n++}`);
    expect(next[0].sets[0]).toMatchObject({ weight: 100, reps: 5, done: false });
    expect(next[0].id).toBe('id0');
  });
});
