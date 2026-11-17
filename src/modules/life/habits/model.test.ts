import { describe, it, expect } from 'vitest';
import type { HabitData, HabitLog } from './model';
import { bestStreak, consistency, indexLogs, streak } from './model';

const habit = (p: Partial<HabitData> = {}): HabitData => ({
  name: 'h', icon: '✅', kind: 'check', target: 1, unit: null, schedule: { type: 'daily' }, subtasks: [], order: 0, category: null, start: '2026-11-01', ...p,
});
const log = (date: string, value = 1): HabitLog => ({
  id: `hl:h:${date}`, type: 'habit_log', data: { habit_id: 'h', value, subtasks: {}, note: null }, parent_id: 'h', date, status: 'done',
  private: 0, created_at: '', updated_at: '', deleted_at: null, rev: 0,
});
const logsFor = (...dates: string[]) => indexLogs(dates.map((d) => log(d))).get('h');

describe('habit streaks', () => {
  it('counts consecutive days and does not reset because today is still open', () => {
    expect(streak(habit(), logsFor('2026-11-14', '2026-11-15', '2026-11-16'), '2026-11-17')).toBe(3);
  });

  it('rest days never break a streak', () => {
    const h = habit({ rest_days: ['2026-11-15'] });
    expect(streak(h, logsFor('2026-11-14', '2026-11-16', '2026-11-17'), '2026-11-17')).toBe(3);
  });

  it('unscheduled weekdays are skipped', () => {
    // Sun(0) Tue(2) Thu(4) only. 2026-11-15 Sun, 17 Tue
    const h = habit({ schedule: { type: 'weekdays', days: [0, 2, 4] } });
    expect(streak(h, logsFor('2026-11-12', '2026-11-15', '2026-11-17'), '2026-11-17')).toBe(3);
  });

  it('a missed scheduled day breaks the streak', () => {
    expect(streak(habit(), logsFor('2026-11-13', '2026-11-15', '2026-11-16'), '2026-11-17')).toBe(2);
  });

  it('best streak and consistency come from real logs', () => {
    const l = logsFor('2026-11-01', '2026-11-02', '2026-11-03', '2026-11-05');
    expect(bestStreak(habit(), l, '2026-11-06')).toBe(3);
    // 5 scheduled past days (1..5), today (6) open and not counted → 4/5
    expect(consistency(habit(), l, 30, '2026-11-06')).toBeCloseTo(0.8);
  });

  it('weekly target habits count weeks', () => {
    const h = habit({ schedule: { type: 'weekly_count', count: 2 } });
    // weeks start Saturday: 2026-11-07..13 and 11-14..20
    expect(streak(h, logsFor('2026-11-08', '2026-11-10', '2026-11-15', '2026-11-16'), '2026-11-17', 6)).toBe(2);
  });
});
