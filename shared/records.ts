import { z } from 'zod';

/**
 * Every piece of user data is one "record". The same record is rendered by every
 * screen that needs it (an exam shows in Study, Calendar and Overview from one row).
 */
export const RECORD_TYPES = [
  // singletons
  'settings', 'profile', 'layout',
  // life
  'task', 'project', 'goal', 'milestone', 'area', 'event', 'reminder',
  'habit', 'habit_log', 'routine',
  'note', 'folder', 'journal', 'capture',
  'wallet', 'txn', 'budget', 'subscription',
  'collection', 'collection_item',
  'review',
  // study
  'semester', 'course', 'lecture', 'exam', 'assignment', 'grade',
  'study_session', 'deck', 'flashcard', 'card_review', 'question', 'question_attempt',
  'clinical_req', 'clinical_log', 'research', 'reference',
  // health
  'workout', 'program', 'pr', 'meal', 'food', 'meal_plan', 'water_log', 'sleep_log',
  'measurement', 'medication', 'med_log', 'health_record', 'activity_log',
  // motivation
  'xp', 'achievement', 'reward', 'redemption', 'quest',
  // binary payloads kept inline until R2 is provisioned
  'blob',
] as const;

export type RecordType = (typeof RECORD_TYPES)[number];

/** Types whose rows can only be created, never edited or deleted (append-only ledger). */
export const APPEND_ONLY_TYPES: ReadonlySet<RecordType> = new Set(['xp', 'redemption']);

/** Types that are private by default (never shown in calendar previews or sent to AI without consent). */
export const PRIVATE_TYPES: ReadonlySet<RecordType> = new Set([
  'journal', 'health_record', 'medication', 'med_log', 'measurement', 'txn', 'wallet',
]);

export const MAX_DATA_BYTES = 200_000;
export const MAX_BLOB_BYTES = 1_200_000;

export interface Rec<T = Record<string, unknown>> {
  id: string;
  type: RecordType;
  data: T;
  parent_id: string | null;
  /** primary date (YYYY-MM-DD or ISO datetime) used for range queries */
  date: string | null;
  status: string | null;
  private: 0 | 1;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  /** server revision; 0 until acknowledged by the server */
  rev: number;
}

const isoish = z.string().min(10).max(40);

export const recordEnvelopeSchema = z.object({
  id: z.string().min(1).max(160).regex(/^[\w:.\-]+$/),
  type: z.enum(RECORD_TYPES),
  data: z.record(z.unknown()),
  parent_id: z.string().max(160).nullable(),
  date: z.string().max(40).nullable(),
  status: z.string().max(40).nullable(),
  private: z.union([z.literal(0), z.literal(1)]),
  created_at: isoish,
  updated_at: isoish,
  deleted_at: isoish.nullable(),
});

export type RecordEnvelope = z.infer<typeof recordEnvelopeSchema>;

export const pushBodySchema = z.object({
  mutations: z
    .array(z.object({ mid: z.string().min(8).max(80), record: recordEnvelopeSchema }))
    .max(100),
});

export type PushBody = z.infer<typeof pushBodySchema>;

export interface PullResponse {
  records: Rec[];
  cursor: number;
  more: boolean;
}

export interface PushResponse {
  /** mutation ids that were applied or were already applied before (safe to drop from outbox) */
  acked: string[];
  /** records where the server kept a newer version than the one pushed */
  conflicts: Rec[];
  cursor: number;
}

/** Byte length of a record's serialized data, using the same limit on client and server. */
export function dataSize(data: unknown): number {
  return new TextEncoder().encode(JSON.stringify(data)).length;
}

export function maxBytesFor(type: RecordType): number {
  return type === 'blob' ? MAX_BLOB_BYTES : MAX_DATA_BYTES;
}
