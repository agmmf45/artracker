import { describe, it, expect } from 'vitest';
import { nextAfter, occurrences } from './recurrence';

describe('recurrence', () => {
  it('weekly on selected weekdays', () => {
    // Sun & Tue, starting Sunday 2026-11-15
    const r = { freq: 'weekly' as const, interval: 1, weekdays: [0, 2] };
    expect(occurrences(r, '2026-11-15', '2026-11-15', '2026-11-28')).toEqual(['2026-11-15', '2026-11-17', '2026-11-22', '2026-11-24']);
  });

  it('exceptions are skipped in both expansion and next', () => {
    const r = { freq: 'daily' as const, interval: 1, exceptions: ['2026-11-18'] };
    expect(occurrences(r, '2026-11-17', '2026-11-17', '2026-11-19')).toEqual(['2026-11-17', '2026-11-19']);
    expect(nextAfter(r, '2026-11-17', '2026-11-17', '2026-11-17')).toBe('2026-11-19');
  });

  it('repeat after completion counts from the completion date', () => {
    const r = { freq: 'daily' as const, interval: 3, afterCompletion: true };
    expect(nextAfter(r, '2026-11-01', '2026-11-01', '2026-11-10')).toBe('2026-11-13');
  });

  it('series ends at until', () => {
    const r = { freq: 'weekly' as const, interval: 1, until: '2026-11-20' };
    expect(nextAfter(r, '2026-11-10', '2026-11-17', '2026-11-17')).toBeNull();
  });

  it('monthly keeps the day of month', () => {
    const r = { freq: 'monthly' as const, interval: 1 };
    expect(nextAfter(r, '2026-01-15', '2026-11-15', '2026-11-15')).toBe('2026-12-15');
  });

  it('expansion over a long range is bounded by the range, not unbounded rows', () => {
    const r = { freq: 'daily' as const, interval: 1 };
    expect(occurrences(r, '2026-01-01', '2026-03-01', '2026-03-31')).toHaveLength(31);
  });
});
