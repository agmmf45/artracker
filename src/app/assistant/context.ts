import type { Rec } from '@shared/records';
import { db } from '@/core/db';
import { fmtDate, hijri, rangeKeys, shiftKey, todayKey } from '@/core/dates';
import type { Settings } from '@/core/settings';

/*
 * A compact, plain-text snapshot of the person's life for the assistant, built on the device.
 * Health, money and journal parts are included only when allowed in Settings › Privacy.
 * Nothing here is stored on the server; it travels with each question.
 */

async function all<T = Record<string, unknown>>(type: string): Promise<Array<Rec<T>>> {
  return (await db().records.where('type').equals(type).filter((r) => !r.deleted_at).toArray()) as unknown as Array<Rec<T>>;
}
async function inRange<T = Record<string, unknown>>(type: string, from: string, to: string): Promise<Array<Rec<T>>> {
  return (await db().records.where('[type+date]').between([type, from], [type, `${to}￿`]).filter((r) => !r.deleted_at).toArray()) as unknown as Array<Rec<T>>;
}
const day = (k: string, locale: string) => `${k} (${fmtDate(k, locale, { weekday: 'long' })})`;
const cut = (s: string, n = 120) => (s.length > n ? `${s.slice(0, n)}…` : s);

export async function buildContext(settings: Settings, locale: string): Promise<string> {
  const today = todayKey();
  const now = new Date();
  const ai = settings.privacy.ai;
  const out: string[] = [];
  const week = rangeKeys(today, 15);
  const horizon = week[week.length - 1];

  out.push(`اليوم: ${day(today, locale)} — ${hijri(today, 'ar')}. الساعة الآن ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}.`);
  const about = (settings as unknown as { assistant?: { about?: string } }).assistant?.about?.trim();
  if (about) out.push(`عن المستخدم (كتبه بنفسه): ${cut(about, 600)}`);

  // ── tasks
  const tasks = await all<{ title: string; start: string | null; start_time: string | null; due: string | null; priority: number; important?: boolean }>('task');
  const open = tasks.filter((t) => t.status !== 'done' && t.status !== 'archived' && t.status !== 'inbox');
  const when = (t: (typeof open)[number]) => t.data.start ?? t.data.due ?? null;
  const overdue = open.filter((t) => when(t) && when(t)! < today);
  const upcoming = open.filter((t) => when(t) && when(t)! >= today && when(t)! <= horizon).sort((a, b) => `${when(a)}${a.data.start_time ?? ''}`.localeCompare(`${when(b)}${b.data.start_time ?? ''}`));
  const undated = open.filter((t) => !when(t));
  const doneToday = tasks.filter((t) => t.status === 'done' && (t.data as unknown as { completed_at?: string }).completed_at?.slice(0, 10) === today);
  out.push('\nالمهام:');
  if (overdue.length) out.push(`- متأخرة (${overdue.length}): ${overdue.slice(0, 8).map((t) => `${t.data.title} [${when(t)}]`).join('؛ ')}`);
  for (const t of upcoming.slice(0, 25)) out.push(`- ${when(t)}${t.data.start_time ? ` ${t.data.start_time}` : ''}: ${t.data.title}${t.data.priority >= 3 ? ' (مهمة)' : ''}`);
  if (undated.length) out.push(`- بدون تاريخ (${undated.length}): ${undated.slice(0, 10).map((t) => t.data.title).join('؛ ')}`);
  if (doneToday.length) out.push(`- أنجز اليوم: ${doneToday.map((t) => t.data.title).join('؛ ')}`);

  // ── calendar
  const events = await inRange<{ title: string; start_time: string | null; end_time: string | null; location?: string | null }>('event', today, horizon);
  if (events.length) {
    out.push('\nالمواعيد:');
    for (const e of events.sort((a, b) => `${a.date}${a.data.start_time ?? ''}`.localeCompare(`${b.date}${b.data.start_time ?? ''}`)).slice(0, 20)) out.push(`- ${e.date}${e.data.start_time ? ` ${e.data.start_time}–${e.data.end_time ?? ''}` : ''}: ${e.data.title}${e.data.location ? ` @${e.data.location}` : ''}`);
  }

  // ── study
  const courses = await all<{ name: string; code: string; archived?: boolean; schedule: Array<{ day: number; start: string; end: string }> }>('course');
  const active = courses.filter((c) => !c.data.archived);
  if (active.length) {
    const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const lectures = await all<{ course_id: string | null }>('lecture');
    out.push('\nالدراسة:');
    for (const c of active) {
      const ls = lectures.filter((l) => l.data.course_id === c.id);
      const left = ls.filter((l) => !l.status || l.status === 'not_started' || l.status === 'in_progress').length;
      out.push(`- ${c.data.code ? `${c.data.code} ` : ''}${c.data.name}: ${(c.data.schedule ?? []).map((s) => `${DAYS[s.day]} ${s.start}–${s.end}`).join('، ') || 'بدون جدول'}${ls.length ? ` — ${left} من ${ls.length} محاضرة ما راجعها` : ''}`);
    }
  }
  const exams = await inRange<{ title: string; time: string | null; course_id: string | null }>('exam', today, shiftKey(today, 45));
  for (const x of exams) out.push(`- اختبار: ${x.data.title} في ${day(x.date!, locale)}${x.data.time ? ` ${x.data.time}` : ''}`);
  const due = await inRange<{ title: string; due_time: string | null }>('assignment', today, horizon);
  for (const a of due.filter((a) => a.status !== 'done')) out.push(`- تسليم: ${a.data.title} في ${a.date}${a.data.due_time ? ` ${a.data.due_time}` : ''}`);

  // ── habits
  const habits = (await all<{ name: string }>('habit')).filter((h) => h.status !== 'archived');
  if (habits.length) {
    const logs = await inRange<{ habit_id: string }>('habit_log', today, today);
    const done = new Set(logs.filter((l) => l.status === 'done').map((l) => l.data.habit_id));
    out.push(`\nالعادات اليوم: ${habits.map((h) => `${h.data.name} ${done.has(h.id) ? '✓' : '✗'}`).join('، ')}`);
  }

  // ── health (only if allowed)
  if (ai.health) {
    const water = await inRange<{ ml: number }>('water_log', today, today);
    out.push(`\nالصحة:\n- الماء اليوم: ${water.reduce((s, w) => s + w.data.ml, 0)} من ${settings.health.waterGoal} مل`);
    const sleep = await inRange<{ hours: number; bed: string; wake: string }>('sleep_log', shiftKey(today, -6), today);
    if (sleep.length) out.push(`- النوم: ${sleep.sort((a, b) => b.date!.localeCompare(a.date!)).slice(0, 4).map((s) => `${s.date} ${s.data.hours} ساعة`).join('، ')}`);
    const workouts = await inRange<{ name: string }>('workout', shiftKey(today, -14), today);
    if (workouts.length) out.push(`- تمارين آخر أسبوعين: ${workouts.sort((a, b) => b.date!.localeCompare(a.date!)).map((w) => `${w.date} ${w.data.name}`).join('، ')}`);
    const weight = (await all<{ kind: string; value: number }>('measurement')).filter((m) => m.data.kind === 'weight' && m.date).sort((a, b) => b.date!.localeCompare(a.date!))[0];
    if (weight) out.push(`- آخر وزن: ${weight.data.value} كجم (${weight.date})`);
  } else out.push('\n(بيانات الصحة غير مسموحة للمساعد)');

  // ── money (only if allowed)
  if (ai.finance) {
    const month = today.slice(0, 7);
    const txns = await inRange<{ kind: string; amount: number; description: string; category: string | null }>('txn', `${month}-01`, today);
    const spent = txns.filter((t) => t.data.kind === 'expense');
    const byCat = new Map<string, number>();
    for (const t of spent) byCat.set(t.data.category ?? 'أخرى', (byCat.get(t.data.category ?? 'أخرى') ?? 0) + t.data.amount);
    out.push(`\nالمال هذا الشهر: صرف ${spent.reduce((s, t) => s + t.data.amount, 0)} ر.س${byCat.size ? ` — ${[...byCat].sort((a, b) => b[1] - a[1]).map(([c, v]) => `${c} ${v}`).join('، ')}` : ''}`);
    const last = spent.sort((a, b) => b.date!.localeCompare(a.date!)).slice(0, 6);
    if (last.length) out.push(`- آخر المصاريف: ${last.map((t) => `${t.date} ${t.data.description} ${t.data.amount}`).join('؛ ')}`);
  } else out.push('(بيانات المال غير مسموحة للمساعد)');
  out.push(`تصنيفات المصاريف: ${settings.categories.expenses.join('، ')}`);

  // ── journal (only if allowed)
  if (ai.journal) {
    const entries = await inRange<{ body: string; title?: string; mood: number | null }>('journal', shiftKey(today, -6), today);
    if (entries.length) {
      out.push('\nاليوميات آخر أسبوع:');
      for (const e of entries.sort((a, b) => b.date!.localeCompare(a.date!)).slice(0, 5)) out.push(`- ${e.date}${e.data.mood ? ` مزاج ${e.data.mood}/5` : ''}: ${cut((e.data.title ? `${e.data.title} — ` : '') + (e.data.body ?? '').replace(/\s+/g, ' '), 200)}`);
    }
  }
  return out.join('\n');
}
