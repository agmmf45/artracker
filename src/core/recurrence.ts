import { RRule, type Options, type Weekday } from 'rrule';
import { addDays } from 'date-fns';
import { dateKey, fromKey } from './dates';

/**
 * A recurring task/event is ONE record. Occurrences are computed, never materialised as rows:
 *  - tasks move their `due` forward on completion (history keeps completed dates)
 *  - events are expanded on the fly for the visible calendar range
 * so recurrence can never create unbounded duplicate records.
 */
export interface Recurrence {
  freq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  /** 0 = Sunday … 6 = Saturday */
  weekdays?: number[];
  until?: string | null;
  count?: number | null;
  /** "repeat after completion": next date counts from when it was done, not from the schedule */
  afterCompletion?: boolean;
  /** skipped occurrence dates (YYYY-MM-DD) */
  exceptions?: string[];
}

const RR_DAYS: Weekday[] = [RRule.SU, RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA];
const FREQ = { daily: RRule.DAILY, weekly: RRule.WEEKLY, monthly: RRule.MONTHLY, yearly: RRule.YEARLY } as const;

/** rrule works in UTC; we feed it "floating" local dates encoded as UTC midnight. */
function toUtc(key: string): Date {
  const d = fromKey(key);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}
function fromUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function toRule(r: Recurrence, start: string): RRule {
  const opts: Partial<Options> = {
    freq: FREQ[r.freq],
    interval: Math.max(1, r.interval || 1),
    dtstart: toUtc(start),
  };
  if (r.weekdays?.length && (r.freq === 'weekly' || r.freq === 'daily')) opts.byweekday = r.weekdays.map((d) => RR_DAYS[d]);
  if (r.until) opts.until = toUtc(r.until);
  if (r.count) opts.count = r.count;
  return new RRule(opts);
}

/** Occurrence dates within [from, to] (inclusive), minus exceptions. */
export function occurrences(r: Recurrence, start: string, from: string, to: string): string[] {
  const rule = toRule(r, start);
  const ex = new Set(r.exceptions ?? []);
  return rule.between(toUtc(from), toUtc(to), true).map(fromUtc).filter((k) => !ex.has(k));
}

/** Next due date after completing the occurrence `current` on `doneOn`. Null when the series ended. */
export function nextAfter(r: Recurrence, start: string, current: string, doneOn: string): string | null {
  if (r.afterCompletion) {
    const step = Math.max(1, r.interval || 1);
    const base = fromKey(doneOn);
    const next = r.freq === 'daily' ? addDays(base, step)
      : r.freq === 'weekly' ? addDays(base, 7 * step)
      : r.freq === 'monthly' ? new Date(base.getFullYear(), base.getMonth() + step, base.getDate())
      : new Date(base.getFullYear() + step, base.getMonth(), base.getDate());
    const k = dateKey(next);
    return r.until && k > r.until ? null : k;
  }
  const rule = toRule(r, start);
  const ex = new Set(r.exceptions ?? []);
  let cursor = toUtc(current);
  for (let i = 0; i < 500; i++) {
    const n = rule.after(cursor, false);
    if (!n) return null;
    const k = fromUtc(n);
    if (!ex.has(k)) return k;
    cursor = n;
  }
  return null;
}

export function describeRecurrence(r: Recurrence, lang: 'ar' | 'en'): string {
  const n = Math.max(1, r.interval || 1);
  const days = lang === 'ar' ? ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const unit = lang === 'ar'
    ? { daily: n === 1 ? 'كل يوم' : `كل ${n} أيام`, weekly: n === 1 ? 'كل أسبوع' : `كل ${n} أسابيع`, monthly: n === 1 ? 'كل شهر' : `كل ${n} أشهر`, yearly: n === 1 ? 'كل سنة' : `كل ${n} سنوات` }
    : { daily: n === 1 ? 'Daily' : `Every ${n} days`, weekly: n === 1 ? 'Weekly' : `Every ${n} weeks`, monthly: n === 1 ? 'Monthly' : `Every ${n} months`, yearly: n === 1 ? 'Yearly' : `Every ${n} years` };
  let s = unit[r.freq];
  if (r.weekdays?.length && r.weekdays.length < 7) s += ` · ${r.weekdays.map((d) => days[d]).join('، ')}`;
  if (r.afterCompletion) s += lang === 'ar' ? ' (بعد الإنجاز)' : ' (after completion)';
  return s;
}
