/**
 * Natural-language quick capture (Arabic + English). Deterministic rules — no AI needed.
 * The original text is always kept by the caller; this only suggests structure the user can correct.
 *
 * Examples
 *   "ذاكر باثولوجي بكرة الساعة 7 مساءً لمدة ساعة"  → task, tomorrow, 19:00, 60 min
 *   "Study pathology tomorrow at 7 PM for one hour"   → task, tomorrow, 19:00, 60 min
 *   "صرفت 25 على قهوة"                                → expense 25 "قهوة"
 *   "ماء 500"                                         → water 500 ml
 *   "اجتماع مع المشرف الخميس 10 ص"                    → event Thursday 10:00
 */
import { addDays, format } from 'date-fns';

export type CaptureKind = 'inbox' | 'task' | 'event' | 'note' | 'expense' | 'income' | 'water' | 'journal';

export interface Parsed {
  kind: CaptureKind;
  title: string;
  date: string | null;
  time: string | null;
  duration_min: number | null;
  amount: number | null;
  ml: number | null;
  priority: number | null;
  tags: string[];
  category: string | null;
  /** human-readable list of what was detected, for the preview chips */
  detected: string[];
}

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
export function normalizeDigits(s: string): string {
  return s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/٫/g, '.');
}

const WEEKDAYS: Array<[RegExp, number]> = [
  [/(?:يوم\s+)?ال?أحد|(?:on\s+)?sunday|\bsun\b/i, 0],
  [/(?:يوم\s+)?ال?[اإ]ثنين|(?:on\s+)?monday|\bmon\b/i, 1],
  [/(?:يوم\s+)?ال?ثلاثاء|(?:on\s+)?tuesday|\btue\b/i, 2],
  [/(?:يوم\s+)?ال?[اأ]ربعاء|(?:on\s+)?wednesday|\bwed\b/i, 3],
  [/(?:يوم\s+)?ال?خميس|(?:on\s+)?thursday|\bthu\b/i, 4],
  [/(?:يوم\s+)?ال?جمعة|(?:on\s+)?friday|\bfri\b/i, 5],
  [/(?:يوم\s+)?ال?سبت|(?:on\s+)?saturday|\bsat\b/i, 6],
];

const NUM_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, an: 1, a: 1, half: 0.5,
  واحد: 1, وحدة: 1, ساعة: 1, ساعتين: 2, ثلاث: 3, ثلاثة: 3, اربع: 4, أربع: 4, خمس: 5, نص: 0.5, نصف: 0.5,
};

const EXPENSE_CATS: Array<[RegExp, string]> = [
  [/قهوة|مطعم|أكل|اكل|غداء|عشاء|فطور|coffee|food|lunch|dinner|restaurant|مقهى/i, '🍔 أكل'],
  [/بنزين|تاكسي|أوبر|اوبر|كريم|uber|taxi|fuel|gas|مواصلات/i, '🚗 مواصلات'],
  [/فاتورة|كهرب|انترنت|إنترنت|جوال|bill|internet|phone/i, '📋 فواتير'],
  [/صيدلية|دواء|مستشفى|pharmacy|medicine|clinic/i, '💊 صحة'],
  [/سينما|لعبة|ترفيه|netflix|game|movie/i, '🎮 ترفيه'],
  [/سوبرماركت|تسوق|ملابس|amazon|نون|shopping|market|groceries/i, '🛒 تسوق'],
];

function strip(text: string, re: RegExp): string {
  return text.replace(re, ' ');
}

export function parseCapture(input: string, now: Date = new Date()): Parsed {
  const original = input.trim();
  let t = ` ${normalizeDigits(original)} `;
  const detected: string[] = [];
  const out: Parsed = { kind: 'inbox', title: original, date: null, time: null, duration_min: null, amount: null, ml: null, priority: null, tags: [], category: null, detected };

  // ── explicit prefixes ──
  const prefix = /^\s*(مهمة|task|todo|فكرة|idea|ملاحظة|note|يوميات|journal|موعد|event)\s*[:：-]\s*/i.exec(t);
  let forced: CaptureKind | null = null;
  if (prefix) {
    const p = prefix[1].toLowerCase();
    forced = /مهمة|task|todo/.test(p) ? 'task' : /فكرة|idea|ملاحظة|note/.test(p) ? 'note' : /يوميات|journal/.test(p) ? 'journal' : 'event';
    t = t.slice(prefix[0].length);
  }

  // ── tags & priority ──
  t = t.replace(/(?:^|\s)#([\p{L}\p{N}_-]{1,30})/gu, (_, tag) => { out.tags.push(tag); return ' '; });
  if (/(?:^|\s)!!(?=\s|$)|عاجل|urgent/i.test(t)) { out.priority = 4; t = strip(t, /(?:^|\s)!!(?=\s|$)|عاجل|urgent/gi); }
  else if (/(?:^|\s)!(?=\s|$)|(?:^|\s)مهم(?=\s|$)|important/i.test(t)) { out.priority = 3; t = strip(t, /(?:^|\s)!(?=\s|$)|(?:^|\s)مهم(?=\s|$)|important/gi); }

  // ── water ──
  const water = /(?:شربت\s+)?(?:ماء|موية|مويه|water)\s*(\d{2,4})\s*(?:مل|ml)?|(\d{2,4})\s*(?:مل|ml)\s*(?:ماء|موية|water)?|(\d)\s*(?:كاسات?|أكواب|اكواب|كوب|glass(?:es)?)\s*(?:ماء|موية|water)?/i.exec(t);
  if (water && !forced) {
    const ml = water[1] ? Number(water[1]) : water[2] ? Number(water[2]) : Number(water[3]) * 250;
    if (ml >= 30 && ml <= 5000) {
      out.kind = 'water'; out.ml = ml; out.title = original; detected.push(`${ml} ml`);
      return out;
    }
  }

  // ── money ──
  const spent = /(?:صرفت|دفعت|اشتريت|شريت|spent|paid|bought)\s+(\d+(?:\.\d+)?)\s*(?:ريال|ر\.?س|ر|sar|sr|\$)?\s*(?:على|في|for|on)?\s*(.*)/i.exec(t);
  const priced = /(.*?)\s+(\d+(?:\.\d+)?)\s*(?:ريال|ر\.?س|sar|sr)(?=\s|$)\s*(.*)/i.exec(t);
  const income = /(?:استلمت|راتب|دخل|received|salary|income)\s+(\d+(?:\.\d+)?)\s*(?:ريال|ر\.?س|ر|sar|sr)?\s*(.*)/i.exec(t);
  if (!forced && (income || spent || priced)) {
    if (income) {
      out.kind = 'income'; out.amount = Number(income[1]); out.title = (income[2] || '').trim() || (/راتب|salary/i.test(t) ? 'راتب' : 'دخل');
    } else if (spent) {
      out.kind = 'expense'; out.amount = Number(spent[1]); out.title = spent[2].trim() || original;
    } else if (priced) {
      out.kind = 'expense'; out.amount = Number(priced[2]); out.title = `${priced[1]} ${priced[3]}`.trim() || original;
    }
    for (const [re, cat] of EXPENSE_CATS) if (re.test(original)) { out.category = cat; break; }
    detected.push(`${out.amount} SAR`);
    if (out.category) detected.push(out.category);
    out.title = out.title.replace(/\s+/g, ' ').trim();
    return out;
  }

  // ── duration ──
  // note: JS \b is ASCII-only, so Arabic words use (?=\s|$) lookaheads instead
  const dur = /(?:لمدة|مدة|for)\s+(?:(\d+(?:\.\d+)?)\s*)?(ساعات|ساعتين|ساعة|hours?|hrs?|h|دقائق|دقيقة|دقايق|د|minutes?|mins?|m)(?:\s*(?:و|and)\s*(نص|نصف|half|ربع))?(?=\s|$)|(?:for\s+)?(an?|one|two|three)\s+(hours?|minutes?)/i.exec(t);
  if (dur) {
    let n: number;
    let unitStr: string;
    if (dur[1] !== undefined || dur[2]) {
      unitStr = dur[2];
      n = dur[1] ? Number(dur[1]) : unitStr === 'ساعتين' ? 2 : 1;
      if (dur[3]) n += /ربع/.test(dur[3]) ? 0.25 : 0.5;
    } else {
      n = NUM_WORDS[dur[4].toLowerCase()] ?? 1;
      unitStr = dur[5];
    }
    const isHour = /ساع|hour|hr|^h$/i.test(unitStr);
    out.duration_min = Math.round(isHour ? n * 60 : n);
    t = strip(t, dur[0] ? new RegExp(dur[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : /$^/);
    detected.push(`${out.duration_min} min`);
  }

  // ── date ──
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let date: Date | null = null;
  const rel: Array<[RegExp, number]> = [
    [/بعد\s+بكر[ةه]|بعد\s+غد|day after tomorrow/i, 2],
    [/بكر[ةه]|غداً|غدا|tomorrow|tmrw/i, 1],
    [/اليوم|الليلة|today|tonight/i, 0],
    [/الأسبوع\s+(?:الجاي|القادم|الياي)|next week/i, 7],
  ];
  for (const [re, days] of rel) {
    if (re.test(t)) { date = addDays(base, days); t = strip(t, re); break; }
  }
  if (!date) {
    const inDays = /(?:بعد|in)\s+(\d+)\s*(?:أيام|ايام|يوم|days?)/i.exec(t);
    if (inDays) { date = addDays(base, Number(inDays[1])); t = strip(t, new RegExp(inDays[0], 'i')); }
  }
  if (!date) {
    const iso = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
    const dm = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(t);
    if (iso) { date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])); t = strip(t, new RegExp(iso[0])); }
    else if (dm) {
      const y = dm[3] ? (dm[3].length === 2 ? 2000 + Number(dm[3]) : Number(dm[3])) : now.getFullYear();
      date = new Date(y, Number(dm[2]) - 1, Number(dm[1]));
      if (!dm[3] && date < base) date = new Date(y + 1, Number(dm[2]) - 1, Number(dm[1]));
      t = strip(t, new RegExp(dm[0].replace(/\//g, '\\/')));
    }
  }
  if (!date) {
    for (const [re, wd] of WEEKDAYS) {
      const m = re.exec(t);
      if (m) {
        const diff = (wd - base.getDay() + 7) % 7 || 7;
        date = addDays(base, diff);
        t = strip(t, re);
        break;
      }
    }
  }

  // ── time ──
  const timeRe = /(?:الساعة|الساعه|ساعة|at|@)?\s*(\d{1,2})(?::(\d{2}))?\s*(?:و\s*(نص|ربع|نصف))?\s*(صباحاً|صباحا|الصبح|الصباح|صباح|ص|am|a\.m\.|مساءً|مساءا|مساء|المساء|بالليل|الليل|العصر|الظهر|م|pm|p\.m\.)?(?=\s|$)/i;
  const tm = timeRe.exec(t);
  const hasTimeCue = tm && (tm[2] || tm[4] || /الساعة|الساعه|at|@/i.test(tm[0]));
  if (tm && hasTimeCue) {
    let h = Number(tm[1]);
    let m = tm[2] ? Number(tm[2]) : 0;
    if (tm[3]) m = /ربع/.test(tm[3]) ? 15 : 30;
    const mer = (tm[4] ?? '').toLowerCase();
    const pm = /مساء|المساء|بالليل|الليل|العصر|^م$|pm|p\.m\./.test(mer);
    const am = /صباح|الصبح|^ص$|am|a\.m\./.test(mer);
    const noon = /الظهر/.test(mer);
    if (pm && h < 12) h += 12;
    if (am && h === 12) h = 0;
    if (noon && h < 11) h += 12;
    if (!pm && !am && !noon && !tm[2] && h >= 1 && h <= 6) h += 12; // "الساعة 5" usually means 5 PM
    if (h <= 23 && m <= 59) {
      out.time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      t = t.replace(tm[0], ' ');
      if (!date) date = base;
    }
  }

  if (date) { out.date = format(date, 'yyyy-MM-dd'); detected.unshift(out.date); }
  if (out.time) detected.push(out.time);
  if (out.priority) detected.push(out.priority === 4 ? '!!' : '!');
  out.tags.forEach((tg) => detected.push(`#${tg}`));

  // ── kind ──
  if (forced) out.kind = forced;
  else if (/موعد|اجتماع|لقاء|meeting|appointment|محاضرة|lecture|حفلة|زواج|عزيمة|دكتور|doctor/i.test(original) && (out.time || out.date)) out.kind = 'event';
  else if (out.date || out.time || out.priority || /^(?:ذاكر|راجع|اكتب|اتصل|ارسل|أرسل|اشتر|خلص|سلّم|سلم|study|review|call|send|buy|finish|submit|write|email|pay)/i.test(original)) out.kind = 'task';
  if (/^(?:ذاكر|راجع|مذاكرة|study|revise|review)/i.test(original)) out.category = 'دراسة';

  // ── clean title ──
  out.title = t
    .replace(/\s(?:في|على|يوم|on|at|for|لمدة|the)\s*$/i, ' ')
    .replace(/^\s*(?:في|على|on|at)\s+/i, ' ')
    .replace(/\s+/g, ' ')
    .trim() || original;
  return out;
}
