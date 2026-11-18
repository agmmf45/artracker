import { describe, it, expect } from 'vitest';
import { parseExpensesLocally, walletBalance } from './model';
import type { Txn, Wallet } from '@/modules/shared/domain';

const w = (id: string, initial = 0, kind: 'regular' | 'savings' = 'regular'): Wallet => ({ id, type: 'wallet', data: { name: id, icon: '', kind, initial_balance: initial, goal: null, currency: 'SAR', order: 0 }, parent_id: null, date: null, status: null, private: 1, created_at: '', updated_at: '', deleted_at: null, rev: 0 });
const t = (data: Partial<Txn['data']>): Txn => ({ id: Math.random().toString(), type: 'txn', data: { kind: 'expense', amount: 0, description: '', category: null, wallet_id: 'a', ...data } as Txn['data'], parent_id: null, date: '2026-11-17', status: null, private: 1, created_at: '', updated_at: '', deleted_at: null, rev: 0 });

describe('wallet balances', () => {
  it('a transfer into savings is counted once on each side (v4 double-subtraction bug fixed)', () => {
    const a = w('a', 1000);
    const s = w('s', 0, 'savings');
    const txns = [t({ kind: 'expense', amount: 50 }), t({ kind: 'income', amount: 200 }), t({ kind: 'transfer', amount: 100, wallet_id: 'a', to_wallet_id: 's' })];
    expect(walletBalance(a, txns)).toBe(1050);
    expect(walletBalance(s, txns)).toBe(100);
    expect(walletBalance(a, txns) + walletBalance(s, txns)).toBe(1150);
  });
});

describe('offline bank SMS parsing', () => {
  it('reads a typical Saudi POS message', () => {
    const r = parseExpensesLocally('شراء عبر نقاط البيع\nبطاقة مدى\nبقيمة 25.50 SAR\nلدى STARBUCKS\nفي 2026-11-17');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ amount: 25.5, kind: 'expense', category: '🍔 أكل', date: '2026-11-17' });
  });

  it('detects salary deposits and multiple free-text lines', () => {
    const r = parseExpensesLocally('إيداع راتب 8000 ريال\nبنزين 80 ريال\nقهوة 15 ر');
    expect(r.map((x) => [x.kind, x.amount])).toEqual([['income', 8000], ['expense', 80], ['expense', 15]]);
    expect(r[1].category).toBe('🚗 مواصلات');
  });
});
