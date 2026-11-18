import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { migrateLegacyBlob } from './migrate';

const blob = JSON.parse(readFileSync(new URL('../../tests/fixtures/legacy-blob.json', import.meta.url), 'utf8'));
const NOW = '2026-11-18T10:00:00.000Z';

describe('v4 → v5 migration', () => {
  const r = migrateLegacyBlob(blob, NOW);
  const of = (t: string) => r.records.filter((x) => x.type === t);

  it('converts every feature area', () => {
    expect(of('habit')).toHaveLength(2);
    expect(of('habit_log')).toHaveLength(4);
    expect(of('task')).toHaveLength(2);
    expect(of('wallet')).toHaveLength(2);
    expect(of('journal')).toHaveLength(2);
    expect(of('event')).toHaveLength(1);
    expect(of('reminder')).toHaveLength(1);
    expect(of('achievement')).toHaveLength(1);
    expect(of('workout')).toHaveLength(1);
    expect(of('program')).toHaveLength(1);
    expect(of('measurement')).toHaveLength(2);
    expect(of('pr')).toHaveLength(1);
    expect(of('meal')).toHaveLength(1);
    expect(of('water_log')).toHaveLength(3);
    expect(r.settings.health.calorieGoal).toBe(2200);
    expect(r.settings.health.waterGoal).toBe(2500);
    expect(r.settings.legacyTheme).toBe('ocean');
    expect(r.profile.display_name).toBe('أحمد التجريبي');
  });

  it('turns a linked save+transfer pair into ONE transfer (no double counting)', () => {
    const txns = of('txn');
    expect(txns).toHaveLength(3);
    const tr = txns.find((t) => t.data.kind === 'transfer')!;
    expect(tr.data).toMatchObject({ amount: 300, wallet_id: 'lg:wallet:w_default', to_wallet_id: 'lg:wallet:w_save' });
  });

  it('keeps habit sub-steps and per-day notes', () => {
    const l = of('habit_log').find((x) => x.date === '2026-11-15' && x.data.habit_id === 'lg:habit:h_1')!;
    expect(l.data.subtasks).toEqual({ s1: true });
    expect(of('habit_log').find((x) => x.date === '2026-11-16' && x.data.habit_id === 'lg:habit:h_1')!.data.note).toBe('قرأت فصل التشريح');
  });

  it('is deterministic (re-running yields identical ids → no duplicates)', () => {
    const again = migrateLegacyBlob(blob, '2027-01-01T00:00:00.000Z');
    expect(again.records.map((x) => x.id).sort()).toEqual(r.records.map((x) => x.id).sort());
    expect(new Set(r.records.map((x) => x.id)).size).toBe(r.records.length);
  });

  it('survives garbage input', () => {
    expect(migrateLegacyBlob({ habits_list: 'x', done: null, fitness: { workouts: [null] } }, NOW).records).toEqual([]);
  });
});
