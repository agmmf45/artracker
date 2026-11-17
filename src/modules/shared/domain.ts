/** Shared record shapes used across modules (single source of truth for each entity). */
import type { Rec } from '@shared/records';
import type { Recurrence } from '@/core/recurrence';
import { create } from '@/core/repo';
import { db } from '@/core/db';
import { todayKey } from '@/core/dates';

export interface EventData {
  title: string;
  start: string; // YYYY-MM-DD
  start_time: string | null;
  end: string;
  end_time: string | null;
  all_day: boolean;
  category: string | null;
  location: string | null;
  notes: string;
  recurrence: Recurrence | null;
  color: string | null;
  reminder_min: number | null;
  source?: string | null;
  course_id?: string | null;
  kind?: 'personal' | 'lecture' | 'lab' | 'clinical' | 'appointment' | 'exam' | 'workout' | 'other';
}
export type CalEvent = Rec<EventData>;

export interface NoteData {
  title: string;
  body: string; // markdown
  folder_id: string | null;
  tags: string[];
  note_type: 'quick' | 'personal' | 'academic' | 'lecture' | 'research' | 'meeting' | 'project' | 'book' | 'idea' | 'tutorial' | 'reference';
  pinned: boolean;
  favorite: boolean;
  para: 'project' | 'area' | 'resource' | 'archive' | null;
  course_id?: string | null;
  lecture_id?: string | null;
  project_id?: string | null;
  versions?: Array<{ at: string; body: string; title: string }>;
}
export type Note = Rec<NoteData>;

export interface CaptureData { text: string; source: 'quick' | 'share' | 'voice' | 'sms'; parsed?: unknown }

export interface WalletData { name: string; icon: string; kind: 'regular' | 'savings'; initial_balance: number; goal: number | null; currency: string; order: number; archived?: boolean }
export interface TxnData {
  kind: 'expense' | 'income' | 'transfer';
  amount: number;
  description: string;
  category: string | null;
  wallet_id: string;
  to_wallet_id?: string | null;
  saving?: boolean;
  subscription_id?: string | null;
  note?: string | null;
}
export type Wallet = Rec<WalletData>;
export type Txn = Rec<TxnData>;

export interface WaterData { ml: number; time: string | null }
export interface JournalData { body: string; time: string | null; mood: number | null; energy: number | null; prompts: Record<string, string>; gratitude?: string[]; wins?: string[]; title?: string }

export async function defaultWallet(): Promise<Wallet> {
  const ws = (await db().records.where('type').equals('wallet').filter((r) => !r.deleted_at).toArray()) as unknown as Wallet[];
  const regular = ws.filter((w) => w.data.kind !== 'savings' && !w.data.archived).sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
  if (regular[0]) return regular[0];
  return create<WalletData>('wallet', { name: 'المحفظة الرئيسية', icon: '💰', kind: 'regular', initial_balance: 0, goal: null, currency: 'SAR', order: 0 });
}

export async function logWater(ml: number, date = todayKey()) {
  const now = new Date();
  return create<WaterData>('water_log', { ml, time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` }, { date });
}

export async function addTxn(t: Omit<TxnData, 'wallet_id'> & { wallet_id?: string }, date = todayKey()) {
  const wallet_id = t.wallet_id ?? (await defaultWallet()).id;
  return create<TxnData>('txn', { ...t, wallet_id }, { date, parent_id: wallet_id });
}

export function blankEvent(p: Partial<EventData> = {}): EventData {
  const d = p.start ?? todayKey();
  return { title: '', start: d, start_time: null, end: d, end_time: null, all_day: !p.start_time, category: 'personal', location: null, notes: '', recurrence: null, color: null, reminder_min: 15, ...p };
}

export function blankNote(p: Partial<NoteData> = {}): NoteData {
  return { title: '', body: '', folder_id: null, tags: [], note_type: 'personal', pinned: false, favorite: false, para: null, ...p };
}
