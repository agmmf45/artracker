import { describe, it, expect } from 'vitest';
import { Rating } from 'ts-fsrs';
import { cloze, isDue, newSrs, review } from './srs';

describe('spaced repetition (FSRS)', () => {
  it('new cards are due; Good schedules later than Again; Easy later than Good', () => {
    const now = new Date('2026-11-17T10:00:00Z');
    const s = newSrs(now);
    expect(isDue(s, now)).toBe(true);
    const again = review(s, Rating.Again, now);
    const good = review(s, Rating.Good, now);
    const easy = review(s, Rating.Easy, now);
    expect(Date.parse(good.due)).toBeGreaterThan(Date.parse(again.due));
    expect(Date.parse(easy.due)).toBeGreaterThan(Date.parse(good.due));
    expect(easy.reps).toBe(1);
  });

  it('intervals grow with successive Good reviews', () => {
    let s = newSrs(new Date('2026-01-01T00:00:00Z'));
    let t = new Date('2026-01-01T00:00:00Z');
    const gaps: number[] = [];
    for (let i = 0; i < 5; i++) { s = review(s, Rating.Good, t); const next = new Date(s.due); gaps.push(next.getTime() - t.getTime()); t = next; }
    expect(gaps[4]).toBeGreaterThan(gaps[2]);
  });

  it('cloze hides answers', () => {
    expect(cloze('The {{c1::mitochondria}} makes ATP').question).toBe('The […] makes ATP');
    expect(cloze('{{c1::Insulin::hormone}} lowers glucose').question).toBe('[hormone] lowers glucose');
  });
});
