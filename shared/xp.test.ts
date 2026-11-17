import { describe, it, expect } from 'vitest';
import { levelFromXp, planXpChange, xpForLevel, xpId } from './xp';

describe('xp ledger planning', () => {
  it('grants once, then refuses a second grant', () => {
    const ids = new Set<string>();
    const g = planXpChange('task:t1:complete', ids, 'grant');
    expect(g).toEqual({ id: 'xp:task:t1:complete:0', reversal: false });
    ids.add(g!.id);
    expect(planXpChange('task:t1:complete', ids, 'grant')).toBeNull();
  });

  it('toggle complete → uncomplete → complete never nets more than one award', () => {
    const ids = new Set<string>();
    const amounts: number[] = [];
    for (const intent of ['grant', 'revoke', 'grant', 'revoke', 'grant', 'grant'] as const) {
      const p = planXpChange('task:t1:complete', ids, intent);
      if (p) { ids.add(p.id); amounts.push(p.reversal ? -10 : 10); }
    }
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(10);
    expect(ids.has(xpId('task:t1:complete', 2))).toBe(true);
  });

  it('revoke without a grant does nothing', () => {
    expect(planXpChange('habit:h1:2026-11-17', new Set(), 'revoke')).toBeNull();
  });

  it('two devices granting the same action produce the same id (deduplicated by the server)', () => {
    const a = planXpChange('task:t9:complete', new Set(), 'grant');
    const b = planXpChange('task:t9:complete', new Set(), 'grant');
    expect(a!.id).toBe(b!.id);
  });
});

describe('levels', () => {
  it('curve is deterministic and monotonic', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(10)).toBe(2700);
    for (let l = 2; l < 120; l++) expect(xpForLevel(l + 1)).toBeGreaterThan(xpForLevel(l));
  });

  it('levelFromXp reports progress inside the level', () => {
    const r = levelFromXp(150);
    expect(r.level).toBe(2);
    expect(r.into).toBe(50);
    expect(r.need).toBe(xpForLevel(3) - 100);
  });
});
