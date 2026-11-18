import { describe, it, expect } from 'vitest';
import { parseCapture } from './parse';

// Fixed "now": Tuesday 2026-11-17 10:00 local
const NOW = new Date(2026, 10, 17, 10, 0);

describe('parseCapture — Arabic', () => {
  it('study task tomorrow 7 PM for one hour', () => {
    const p = parseCapture('ذاكر باثولوجي بكرة الساعة 7 مساءً لمدة ساعة', NOW);
    expect(p.kind).toBe('task');
    expect(p.date).toBe('2026-11-18');
    expect(p.time).toBe('19:00');
    expect(p.duration_min).toBe(60);
    expect(p.title).toBe('ذاكر باثولوجي');
    expect(p.category).toBe('دراسة');
  });

  it('expense with category', () => {
    const p = parseCapture('صرفت 25 على قهوة', NOW);
    expect(p.kind).toBe('expense');
    expect(p.amount).toBe(25);
    expect(p.title).toBe('قهوة');
    expect(p.category).toBe('🍔 أكل');
  });

  it('expense with Arabic digits and "ريال"', () => {
    const p = parseCapture('بنزين ٨٠ ريال', NOW);
    expect(p.kind).toBe('expense');
    expect(p.amount).toBe(80);
    expect(p.category).toBe('🚗 مواصلات');
  });

  it('water in ml and glasses', () => {
    expect(parseCapture('ماء 500', NOW)).toMatchObject({ kind: 'water', ml: 500 });
    expect(parseCapture('شربت 2 كاسات ماء', NOW)).toMatchObject({ kind: 'water', ml: 500 });
  });

  it('event on a weekday with morning time', () => {
    const p = parseCapture('اجتماع مع المشرف الخميس 10 ص', NOW);
    expect(p.kind).toBe('event');
    expect(p.date).toBe('2026-11-19');
    expect(p.time).toBe('10:00');
  });

  it('half hour and "ونص" times', () => {
    const p = parseCapture('راجع المحاضرة اليوم الساعة 9 ونص بالليل لمدة ساعة ونص', NOW);
    expect(p.time).toBe('21:30');
    expect(p.duration_min).toBe(90);
    expect(p.date).toBe('2026-11-17');
  });

  it('plain text with no structure goes to the inbox', () => {
    const p = parseCapture('فكرة لتطبيق عن النباتات', NOW);
    expect(p.kind).toBe('inbox');
    expect(p.title).toBe('فكرة لتطبيق عن النباتات');
  });

  it('prefix forces a kind and tags/priority are extracted', () => {
    const p = parseCapture('مهمة: تجديد الجواز #شخصي !', NOW);
    expect(p.kind).toBe('task');
    expect(p.tags).toEqual(['شخصي']);
    expect(p.priority).toBe(3);
    expect(p.title).toBe('تجديد الجواز');
  });

  it('income', () => {
    expect(parseCapture('راتب 5000', NOW)).toMatchObject({ kind: 'income', amount: 5000 });
  });

  it('"بعد بكرة" beats "بكرة"', () => {
    expect(parseCapture('اتصل بأحمد بعد بكرة', NOW).date).toBe('2026-11-19');
  });
});

describe('parseCapture — English', () => {
  it('prompt example', () => {
    const p = parseCapture('Study pathology tomorrow at 7 PM for one hour', NOW);
    expect(p).toMatchObject({ kind: 'task', date: '2026-11-18', time: '19:00', duration_min: 60, title: 'Study pathology' });
  });

  it('meeting with 24h time', () => {
    const p = parseCapture('meeting with team friday 14:30', NOW);
    expect(p).toMatchObject({ kind: 'event', date: '2026-11-20', time: '14:30' });
  });

  it('spent money', () => {
    expect(parseCapture('spent 40 on lunch', NOW)).toMatchObject({ kind: 'expense', amount: 40, title: 'lunch' });
  });

  it('a bare number is not mistaken for a time', () => {
    const p = parseCapture('read 3 chapters', NOW);
    expect(p.time).toBeNull();
    expect(p.date).toBeNull();
  });
});

describe('plan level (week / month without a day)', () => {
  const now = new Date(2026, 10, 18, 10, 0); // Wed 18 Nov 2026
  it('this week / next week / this month become a scope, not a date', () => {
    const a = parseCapture('جدّد الجواز هالأسبوع', now);
    expect(a).toMatchObject({ kind: 'task', scope: 'week', date: null, title: 'جدّد الجواز' });
    expect(parseCapture('احجز السفر الأسبوع الجاي', now)).toMatchObject({ kind: 'task', scope: 'next_week', date: null, title: 'احجز السفر' });
    expect(parseCapture('أرتب الدولاب هالشهر', now)).toMatchObject({ kind: 'task', scope: 'month', date: null });
    expect(parseCapture('call mom next month', now).scope).toBe('next_month');
  });
  it('a real day wins over the scope', () => {
    const p = parseCapture('ذاكر بكرة الساعة 7 هالأسبوع', now);
    expect(p.scope).toBeNull();
    expect(p.date).toBe('2026-11-19');
  });
});
