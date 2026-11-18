import { describe, it, expect } from 'vitest';
import { bedMinutes, bedtimeSpread, fromBedMinutes, sleepHours } from './sleepLogic';

describe('sleep', () => {
  it('handles sleep crossing midnight', () => {
    expect(sleepHours('23:30', '07:00')).toBe(7.5);
    expect(sleepHours('01:15', '08:45')).toBe(7.5);
    expect(sleepHours('14:00', '15:30')).toBe(1.5); // nap
  });
  it('averages bedtimes around midnight correctly', () => {
    const avg = (['23:00', '01:00'].map(bedMinutes).reduce((a, b) => a + b, 0)) / 2;
    expect(fromBedMinutes(avg)).toBe('00:00');
    expect(bedtimeSpread(['23:00', '01:00'])).toBe(60);
  });
});
