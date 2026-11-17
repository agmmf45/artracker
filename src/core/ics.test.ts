import { describe, it, expect } from 'vitest';
import { parseIcs, toIcs } from './ics';
import type { EventData } from '@/modules/shared/domain';

const ev = (p: Partial<EventData>): EventData => ({
  title: 'محاضرة تشريح', start: '2026-11-18', start_time: '08:00', end: '2026-11-18', end_time: '09:30', all_day: false,
  category: 'personal', location: 'قاعة 3, مبنى A', notes: 'سطر1\nسطر2', recurrence: null, color: null, reminder_min: 15, ...p,
});

describe('ics', () => {
  it('round-trips a timed event with escaping', () => {
    const out = parseIcs(toIcs([{ id: 'e1', data: ev({}) }]));
    expect(out).toHaveLength(1);
    expect(out[0].data).toMatchObject({ title: 'محاضرة تشريح', start: '2026-11-18', start_time: '08:00', end_time: '09:30', location: 'قاعة 3, مبنى A', notes: 'سطر1\nسطر2' });
    expect(out[0].uid).toBe('e1@daqeeq.org');
  });

  it('round-trips an all-day multi-day event (exclusive DTEND)', () => {
    const out = parseIcs(toIcs([{ id: 'e2', data: ev({ start_time: null, end_time: null, all_day: true, end: '2026-11-20' }) }]));
    expect(out[0].data).toMatchObject({ all_day: true, start: '2026-11-18', end: '2026-11-20' });
  });

  it('round-trips weekly recurrence with weekdays and exceptions', () => {
    const r = { freq: 'weekly' as const, interval: 1, weekdays: [0, 2], until: '2026-12-31', exceptions: ['2026-11-24'] };
    const out = parseIcs(toIcs([{ id: 'e3', data: ev({ recurrence: r }) }]));
    expect(out[0].data.recurrence).toMatchObject({ freq: 'weekly', interval: 1, weekdays: [0, 2], until: '2026-12-31', exceptions: ['2026-11-24'] });
  });

  it('skips malformed events instead of failing the whole import', () => {
    const txt = 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:no start\nEND:VEVENT\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20261201\nSUMMARY:ok\nEND:VEVENT\nEND:VCALENDAR';
    expect(parseIcs(txt).map((e) => e.data.title)).toEqual(['ok']);
  });
});
