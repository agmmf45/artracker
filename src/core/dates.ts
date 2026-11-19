import { addDays, differenceInCalendarDays, parseISO, startOfWeek, format } from 'date-fns';

/** Local calendar day key YYYY-MM-DD (never UTC — the v4 water bug). */
export function dateKey(d: Date = new Date()): string {
  return format(d, 'yyyy-MM-dd');
}
export const todayKey = () => dateKey(new Date());

export function fromKey(key: string): Date {
  return parseISO(key.slice(0, 10));
}

export function shiftKey(key: string, days: number): string {
  return dateKey(addDays(fromKey(key), days));
}

export function daysBetween(a: string, b: string): number {
  return differenceInCalendarDays(fromKey(b), fromKey(a));
}

export function weekStartKey(key: string, weekStartsOn: 0 | 1 | 6): string {
  return dateKey(startOfWeek(fromKey(key), { weekStartsOn }));
}

export function rangeKeys(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => shiftKey(start, i));
}

export function monthGrid(year: number, month: number, weekStartsOn: 0 | 1 | 6): string[] {
  const first = new Date(year, month, 1);
  const start = startOfWeek(first, { weekStartsOn });
  return Array.from({ length: 42 }, (_, i) => dateKey(addDays(start, i)));
}

export function hm(time: string | null | undefined): number | null {
  if (!time) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function fromMinutes(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = Math.round(min % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export function fmtDate(key: string, locale: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }): string {
  return new Intl.DateTimeFormat(locale, opts).format(fromKey(key));
}

export function fmtTime(time: string | null | undefined, locale: string, h12 = true): string {
  const m = hm(time);
  if (m === null) return '';
  const d = new Date(2000, 0, 1, Math.floor(m / 60), m % 60);
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', hour12: h12 }).format(d);
}

export function fmtDuration(min: number, lang: 'ar' | 'en'): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (lang === 'ar') {
    if (h && m) return `${h} س ${m} د`;
    if (h) return `${h} س`;
    return `${m} د`;
  }
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/** Hijri (Umm al-Qura) via Intl — correct for any year, replaces v4's hard-coded 2025–2026 tables. */
export function hijri(key: string, lang: 'ar' | 'en', opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }): string {
  const loc = lang === 'ar' ? 'ar-SA-u-ca-islamic-umalqura-nu-latn' : 'en-u-ca-islamic-umalqura';
  return new Intl.DateTimeFormat(loc, opts).format(fromKey(key));
}

export function hijriParts(key: string): { day: number; month: number; year: number } {
  const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(fromKey(key));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { day: get('day'), month: get('month'), year: get('year') };
}

const ISLAMIC_EVENTS: Array<{ m: number; d: number; ar: string; en: string }> = [
  { m: 1, d: 1, ar: 'رأس السنة الهجرية', en: 'Islamic New Year' },
  { m: 1, d: 10, ar: 'يوم عاشوراء', en: 'Ashura' },
  { m: 9, d: 1, ar: 'بداية رمضان', en: 'Ramadan begins' },
  { m: 10, d: 1, ar: 'عيد الفطر', en: 'Eid al-Fitr' },
  { m: 12, d: 9, ar: 'يوم عرفة', en: 'Day of Arafah' },
  { m: 12, d: 10, ar: 'عيد الأضحى', en: 'Eid al-Adha' },
];
const FIXED_EVENTS: Array<{ m: number; d: number; ar: string; en: string }> = [
  { m: 2, d: 22, ar: 'يوم التأسيس', en: 'Founding Day' },
  { m: 9, d: 23, ar: 'اليوم الوطني', en: 'Saudi National Day' },
];

export function specialDay(key: string, lang: 'ar' | 'en'): string | null {
  const h = hijriParts(key);
  const isl = ISLAMIC_EVENTS.find((e) => e.m === h.month && e.d === h.day);
  if (isl) return lang === 'ar' ? isl.ar : isl.en;
  const g = fromKey(key);
  const fx = FIXED_EVENTS.find((e) => e.m === g.getMonth() + 1 && e.d === g.getDate());
  return fx ? (lang === 'ar' ? fx.ar : fx.en) : null;
}

export function relativeDay(key: string, lang: 'ar' | 'en', locale: string): string {
  const diff = daysBetween(todayKey(), key);
  if (diff === 0) return lang === 'ar' ? 'اليوم' : 'Today';
  if (diff === 1) return lang === 'ar' ? 'بكرة' : 'Tomorrow';
  if (diff === -1) return lang === 'ar' ? 'أمس' : 'Yesterday';
  if (diff > 1 && diff < 7) return fmtDate(key, locale, { weekday: 'long' });
  return fmtDate(key, locale, { day: 'numeric', month: 'short' });
}

/** The day as a word inside a label: «اليوم» / «بكرة» / «أمس», else «يوم 22 نوفمبر» (e.g. «تركيز بكرة»). */
export function dayWord(key: string, lang: 'ar' | 'en', locale: string): string {
  const diff = daysBetween(todayKey(), key);
  if (diff === 0) return lang === 'ar' ? 'اليوم' : 'today';
  if (diff === 1) return lang === 'ar' ? 'بكرة' : 'tomorrow';
  if (diff === -1) return lang === 'ar' ? 'أمس' : 'yesterday';
  const d = fmtDate(key, locale, { day: 'numeric', month: 'long' });
  return lang === 'ar' ? `يوم ${d}` : d;
}

export function greeting(lang: 'ar' | 'en', hour = new Date().getHours()): string {
  if (hour < 5) return lang === 'ar' ? 'ليلة هادئة' : 'Good night';
  if (hour < 12) return lang === 'ar' ? 'صباح الخير' : 'Good morning';
  if (hour < 17) return lang === 'ar' ? 'مساء النور' : 'Good afternoon';
  return lang === 'ar' ? 'مساء الخير' : 'Good evening';
}
