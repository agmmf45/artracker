import { db } from '@/core/db';
import { daysBetween, shiftKey, todayKey } from '@/core/dates';
import type { Settings } from '@/core/settings';
import { logWater } from '@/modules/shared/domain';

/**
 * "What I noticed today" — a few cards computed on the device (free, no AI): an exam coming up,
 * overdue tasks, a short night, water behind. Each either does something right away (`quick`) or
 * starts a conversation with the assistant (`ask`).
 */
export interface Notice {
  key: string;
  area: [string, string];
  color: string;
  text: [string, string];
  ask?: [string, string];
  askLabel?: [string, string];
  quick?: { label: [string, string]; run: () => Promise<unknown> };
}

const recs = async <T>(type: string, from: string, to: string) =>
  (await db().records.where('[type+date]').between([type, from], [type, `${to}￿`]).filter((r) => !r.deleted_at).toArray()) as unknown as Array<{ id: string; date: string; status: string | null; data: T }>;

export async function noticed(settings: Settings): Promise<Notice[]> {
  const today = todayKey();
  const hour = new Date().getHours();
  const out: Notice[] = [];

  // an exam within a week
  const exams = await recs<{ title: string; course_id: string | null }>('exam', today, shiftKey(today, 7));
  const exam = exams.sort((a, b) => a.date.localeCompare(b.date))[0];
  if (exam) {
    const n = daysBetween(today, exam.date);
    const lectures = exam.data.course_id
      ? (await db().records.where('type').equals('lecture').filter((r) => !r.deleted_at && (r.data as { course_id?: string }).course_id === exam.data.course_id).toArray())
      : [];
    const left = lectures.filter((l) => !l.status || l.status === 'not_started' || l.status === 'in_progress').length;
    const when: [string, string] = n === 0 ? ['اليوم', 'today'] : n === 1 ? ['بكرة', 'tomorrow'] : [`بعد ${n} أيام`, `in ${n} days`];
    out.push({
      key: `exam:${exam.id}`, area: ['الدراسة', 'Study'], color: 'var(--study)',
      text: [`${exam.data.title} ${when[0]}${left ? `، وباقي ${left} محاضرات ما راجعتها` : ''}.`, `${exam.data.title} ${when[1]}${left ? `, with ${left} lectures not revised yet` : ''}.`],
      ask: [`سوّ لي خطة مذاكرة لـ«${exam.data.title}»`, `Make me a revision plan for “${exam.data.title}”`], askLabel: ['سوّ لي خطة', 'Make a plan'],
    });
  }

  // overdue tasks
  const tasks = (await db().records.where('type').equals('task').filter((r) => !r.deleted_at && r.status !== 'done' && r.status !== 'archived').toArray()) as unknown as Array<{ data: { start: string | null; due: string | null } }>;
  const overdue = tasks.filter((t) => { const d = t.data.start ?? t.data.due; return d && d < today; }).length;
  if (overdue) {
    out.push({
      key: 'overdue', area: ['المهام', 'Tasks'], color: 'var(--life)',
      text: [`عندك ${overdue} ${overdue === 1 ? 'مهمة متأخرة' : 'مهام متأخرة'}.`, `You have ${overdue} overdue task${overdue === 1 ? '' : 's'}.`],
      ask: ['رتّب لي المهام المتأخرة على الأيام الجاية', 'Spread my overdue tasks over the coming days'], askLabel: ['رتّبها', 'Sort them'],
    });
  }

  // a short night (only from logged sleep)
  const sleep = (await recs<{ hours: number }>('sleep_log', today, today))[0];
  if (sleep && sleep.data.hours < 6) {
    out.push({
      key: 'sleep', area: ['النوم', 'Sleep'], color: 'var(--health)',
      text: [`نمت ${sleep.data.hours} ساعات بس. تبي أخفّف يومك؟`, `Only ${sleep.data.hours} hours of sleep. Lighten today?`],
      ask: ['نمت قليل، خفّف خطة اليوم وخل الأهم بس', 'I slept little — trim today’s plan to what matters'], askLabel: ['خفّفه', 'Lighten it'],
    });
  }

  // water behind in the afternoon
  if (hour >= 15) {
    const water = (await recs<{ ml: number }>('water_log', today, today)).reduce((s, w) => s + w.data.ml, 0);
    const goal = settings.health.waterGoal;
    if (goal && water < goal / 2) {
      out.push({
        key: 'water', area: ['الماء', 'Water'], color: 'var(--info)',
        text: [`شربت ${water} من ${goal} مل اليوم.`, `${water} of ${goal} ml water today.`],
        quick: { label: ['+ كوب', '+ a cup'], run: () => logWater(settings.health.waterServings?.[1] ?? 250, today) },
      });
    }
  }

  // nothing planned for today yet (morning)
  if (hour < 13 && !out.length) {
    out.push({ key: 'plan', area: ['اليوم', 'Today'], color: 'var(--reward)', text: ['يومك فاضي — نخطّطه سوا؟', 'Nothing planned yet — plan today together?'], ask: ['خطّط يومي', 'Plan my day'], askLabel: ['خطّط يومي', 'Plan my day'] });
  }
  return out.slice(0, 3);
}
