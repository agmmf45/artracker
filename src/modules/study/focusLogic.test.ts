import { describe, it, expect } from 'vitest';
import { effectiveMinutes, subtractOverlaps } from './focusLogic';

const t = (hm: string) => Date.parse(`2026-11-17T${hm}:00Z`);

describe('focus accounting', () => {
  it('duration comes from timestamps minus pauses', () => {
    expect(effectiveMinutes('2026-11-17T10:00:00Z', '2026-11-17T10:30:00Z', 5 * 60000)).toBe(25);
  });

  it('overlapping sessions never double count', () => {
    const parts = subtractOverlaps({ start: t('10:00'), end: t('11:00') }, [{ start: t('10:20'), end: t('10:40') }]);
    expect(parts).toEqual([{ start: t('10:00'), end: t('10:20') }, { start: t('10:40'), end: t('11:00') }]);
    expect(subtractOverlaps({ start: t('10:00'), end: t('10:30') }, [{ start: t('09:00'), end: t('12:00') }])).toEqual([]);
  });
});
