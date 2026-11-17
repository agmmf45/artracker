import { useLiveQuery } from 'dexie-react-hooks';
import { DAILY_CAP, DEFAULT_XP, ACTION_SKILL, levelFromXp, planXpChange, type XpAction, type Skill } from '@shared/xp';
import { db } from './db';
import { create } from './repo';
import { todayKey } from './dates';
import { toast } from './toast';
import type { Settings } from './settings';

interface XpData { amount: number; action: XpAction; skill: Skill; base: string; label?: string }

async function idsFor(base: string): Promise<Set<string>> {
  const rows = await db().records.where('id').startsWith(`xp:${base}:`).primaryKeys();
  return new Set(rows as string[]);
}

/**
 * Grants XP for a real-life action at most once (see shared/xp.ts for the ledger rules).
 * Silent no-op when gamification is disabled or the daily cap for that action is reached.
 */
export async function grantXp(base: string, action: XpAction, settings: Settings, label?: string): Promise<number> {
  if (!settings.gamification.enabled) return 0;
  const plan = planXpChange(base, await idsFor(base), 'grant');
  if (!plan) return 0;
  const amount = settings.gamification.xp[action] ?? DEFAULT_XP[action];
  if (!amount) return 0;
  const cap = DAILY_CAP[action];
  const today = todayKey();
  if (cap) {
    const todays = await db().records.where('[type+date]').equals(['xp', today]).toArray();
    const sum = todays.filter((r) => (r.data as unknown as XpData).action === action).reduce((s, r) => s + ((r.data as unknown as XpData).amount ?? 0), 0);
    if (sum >= cap) return 0;
  }
  await create<XpData>('xp', { amount, action, skill: ACTION_SKILL[action], base, label }, { id: plan.id, date: today });
  if (settings.gamification.animations) toast(`+${amount} XP`, { tone: 'reward', ttl: 1600 });
  return amount;
}

/** Reverses an earlier grant (e.g. a task was un-completed). Net XP for the action returns to 0. */
export async function revokeXp(base: string): Promise<void> {
  const ids = await idsFor(base);
  const plan = planXpChange(base, ids, 'revoke');
  if (!plan) return;
  const award = await db().records.get(plan.id.replace(/:rev$/, ''));
  const amount = (award?.data as unknown as XpData | undefined)?.amount ?? 0;
  const d = award?.data as unknown as XpData | undefined;
  await create<XpData>('xp', { amount: -amount, action: d?.action ?? 'task', skill: d?.skill ?? 'productivity', base }, { id: plan.id, date: todayKey() });
}

export interface XpSummary {
  total: number;
  level: ReturnType<typeof levelFromXp>;
  bySkill: Record<string, number>;
  byDay: Record<string, number>;
  recent: Array<{ id: string; amount: number; label?: string; date: string }>;
  spent: number;
  coins: number;
}

export function useXp(): XpSummary | undefined {
  return useLiveQuery(async () => {
    const rows = await db().records.where('type').equals('xp').toArray();
    const red = await db().records.where('type').equals('redemption').toArray();
    let total = 0;
    let earned = 0;
    const bySkill: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    for (const r of rows) {
      const d = r.data as unknown as XpData;
      total += d.amount ?? 0;
      if ((d.amount ?? 0) > 0) earned += d.amount;
      bySkill[d.skill] = (bySkill[d.skill] ?? 0) + (d.amount ?? 0);
      if (r.date) byDay[r.date] = (byDay[r.date] ?? 0) + (d.amount ?? 0);
    }
    // coins: 1 per 10 XP of net lifetime XP; redemptions are append-only spend records
    const spent = red.reduce((s, r) => s + (Number((r.data as { cost?: number }).cost) || 0), 0);
    const recent = rows
      .filter((r) => (r.data as unknown as XpData).amount > 0)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 12)
      .map((r) => ({ id: r.id, amount: (r.data as unknown as XpData).amount, label: (r.data as unknown as XpData).label, date: r.date ?? '' }));
    const net = Math.max(0, total);
    return { total: net, level: levelFromXp(net), bySkill, byDay, recent, spent, coins: Math.max(0, Math.floor(Math.min(net, earned) / 10) - spent) };
  }, []);
}
