import { createEmptyCard, fsrs, Rating, type Card, type Grade } from 'ts-fsrs';

/**
 * Spaced repetition via FSRS (ts-fsrs, the open, peer-reviewed scheduler used by Anki 23.10+).
 * Card state is stored inside the flashcard record as JSON (dates as ISO strings).
 */
export interface SrsState { due: string; stability: number; difficulty: number; scheduled_days: number; reps: number; lapses: number; learning_steps: number; state: number; last_review: string | null }

const scheduler = fsrs({ enable_fuzz: true });

export function newSrs(now = new Date()): SrsState {
  return toState(createEmptyCard(now));
}

function toState(c: Card): SrsState {
  return {
    due: new Date(c.due).toISOString(), stability: c.stability, difficulty: c.difficulty, scheduled_days: c.scheduled_days, reps: c.reps,
    lapses: c.lapses, learning_steps: (c as Card & { learning_steps?: number }).learning_steps ?? 0, state: c.state, last_review: c.last_review ? new Date(c.last_review).toISOString() : null,
  };
}

function toCard(s: SrsState): Card {
  return { ...s, due: new Date(s.due), last_review: s.last_review ? new Date(s.last_review) : undefined, elapsed_days: 0 } as unknown as Card;
}

export const RATINGS: Array<{ r: Grade; ar: string; en: string; tone: string }> = [
  { r: Rating.Again, ar: 'نسيت', en: 'Again', tone: 'var(--danger)' },
  { r: Rating.Hard, ar: 'صعب', en: 'Hard', tone: 'var(--warning)' },
  { r: Rating.Good, ar: 'جيد', en: 'Good', tone: 'var(--study)' },
  { r: Rating.Easy, ar: 'سهل', en: 'Easy', tone: 'var(--success)' },
];

export function review(s: SrsState, rating: Grade, now = new Date()): SrsState {
  return toState(scheduler.next(toCard(s), now, rating).card);
}

/** Preview of the next interval for each rating (for the buttons). */
export function previewIntervals(s: SrsState, now = new Date()): Record<number, number> {
  const out: Record<number, number> = {};
  for (const { r } of RATINGS) out[r] = Math.max(0, (Date.parse(review(s, r, now).due) - now.getTime()) / 60000);
  return out;
}

export function fmtInterval(min: number, lang: 'ar' | 'en'): string {
  if (min < 60) return `${Math.max(1, Math.round(min))}${lang === 'ar' ? 'د' : 'm'}`;
  if (min < 1440) return `${Math.round(min / 60)}${lang === 'ar' ? 'س' : 'h'}`;
  const d = min / 1440;
  if (d < 30) return `${Math.round(d)}${lang === 'ar' ? 'ي' : 'd'}`;
  if (d < 365) return `${Math.round(d / 30)}${lang === 'ar' ? 'ش' : 'mo'}`;
  return `${(d / 365).toFixed(1)}${lang === 'ar' ? 'سنة' : 'y'}`;
}

/** Cloze: "The {{c1::mitochondria}} is…" → front with [...] and the answer. */
export function cloze(front: string): { question: string; answer: string } {
  const answers: string[] = [];
  const q = front.replace(/\{\{c\d+::(.+?)(?:::(.+?))?\}\}/g, (_, a: string, hint?: string) => { answers.push(a); return hint ? `[${hint}]` : '[…]'; });
  return { question: q, answer: front.replace(/\{\{c\d+::(.+?)(?:::.+?)?\}\}/g, '**$1**') || answers.join(', ') };
}

export function isDue(s: SrsState | undefined, now = new Date()): boolean {
  return !s || Date.parse(s.due) <= now.getTime();
}
