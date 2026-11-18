import { useMemo } from 'react';
import { Link } from 'react-router';
import { useI18n } from '@/core/i18n';
import { useNow } from '@/core/hooks';
import { fmtTime, hm } from '@/core/dates';
import type { CalItem } from '../calendar/sources';

const HOUR = 44; // px per hour

/**
 * The hour column down the side of the daily page (time blocking). Every timed item of the day
 * — events, scheduled tasks, classes, exams, workouts — sits at its real time; overlaps share
 * the width side by side.
 */
export function TimeBlocks({ items, day, today, dayStart, dayEnd, h12 }: {
  items: CalItem[]; day: string; today: string; dayStart: string; dayEnd: string; h12: boolean;
}) {
  const { L, locale } = useI18n();
  const now = useNow(60_000);

  const { from, to, placed } = useMemo(() => {
    const timed = items.filter((i) => !i.allDay && i.start).map((i) => {
      const s = hm(i.start) ?? 0;
      const e = Math.max(s + 20, hm(i.end) ?? s + 60);
      return { i, s, e };
    }).sort((a, b) => a.s - b.s || b.e - a.e);
    let from = Math.floor((hm(dayStart) ?? 7 * 60) / 60);
    let to = Math.ceil((hm(dayEnd) ?? 23 * 60) / 60);
    for (const t of timed) { from = Math.min(from, Math.floor(t.s / 60)); to = Math.max(to, Math.ceil(t.e / 60)); }
    to = Math.min(24, Math.max(to, from + 1));
    // greedy lanes inside each overlapping cluster
    const placed: Array<{ i: CalItem; s: number; e: number; lane: number; lanes: number }> = [];
    let cluster: typeof placed = [];
    let clusterEnd = -1;
    const flush = () => { const n = Math.max(1, ...cluster.map((c) => c.lane + 1)); for (const c of cluster) c.lanes = n; placed.push(...cluster); cluster = []; };
    for (const t of timed) {
      if (t.s >= clusterEnd && cluster.length) flush();
      const used = new Set(cluster.filter((c) => c.e > t.s).map((c) => c.lane));
      let lane = 0; while (used.has(lane)) lane++;
      cluster.push({ ...t, lane, lanes: 1 });
      clusterEnd = Math.max(clusterEnd, t.e);
    }
    if (cluster.length) flush();
    return { from, to, placed };
  }, [items, dayStart, dayEnd]);

  const hours = Array.from({ length: to - from }, (_, k) => from + k);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const showNow = day === today && nowMin >= from * 60 && nowMin <= to * 60;

  return (
    <div className="relative" style={{ height: (to - from) * HOUR }} aria-label={L('جدول الساعات', 'Hour by hour')} role="group">
      {hours.map((h) => (
        <div key={h} className="absolute inset-x-0 flex gap-2" style={{ top: (h - from) * HOUR }}>
          <span className="num w-10 shrink-0 -translate-y-2 text-[11.5px] text-fg-2">{fmtTime(`${String(h).padStart(2, '0')}:00`, locale, h12).replace(/:00/, '')}</span>
          <span className="mt-px h-px flex-1 border-t border-dashed border-line" />
        </div>
      ))}
      <div className="absolute inset-y-0 end-0 start-12">
        {placed.map(({ i, s, e, lane, lanes }) => (
          <Link
            key={i.key}
            to={`/life/calendar?date=${day}`}
            className="absolute overflow-hidden rounded-xs px-2 py-1 text-[12.5px] leading-tight text-fg hover:brightness-95"
            style={{
              top: ((s - from * 60) / 60) * HOUR + 1,
              height: Math.max(20, ((e - s) / 60) * HOUR - 2),
              insetInlineStart: `${(lane / lanes) * 100}%`,
              width: `calc(${100 / lanes}% - 3px)`,
              background: `color-mix(in oklab, ${i.color} 42%, var(--surface))`, borderInlineStart: `3px solid ${i.color}`,
            }}
            title={`${fmtTime(i.start, locale, h12)} ${i.title}`}
          >
            <span className={`font-bold ${i.done ? 'line-through opacity-70' : ''}`}>{i.title}</span>
            {e - s >= 50 && <span className="num block text-[11px] opacity-80">{fmtTime(i.start, locale, h12)}{i.end ? `–${fmtTime(i.end, locale, h12)}` : ''}</span>}
          </Link>
        ))}
        {showNow && (
          <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: ((nowMin - from * 60) / 60) * HOUR }} aria-hidden="true">
            <span className="size-2.5 -translate-x-1 rounded-full bg-danger rtl:translate-x-1" />
            <span className="h-0.5 flex-1 bg-danger" />
          </div>
        )}
      </div>
      {!placed.length && (
        <p className="absolute inset-x-12 top-6 rounded-sm bg-surface/80 p-2 text-center text-[12.5px] text-fg-2">
          {L('ما فيه شي بوقت محدد. اكتب وقت مع المهمة، مثل «مذاكرة 4 العصر»، وتنحط هنا.', 'Nothing timed yet. Add a time to a line, like “study 4pm”, and it lands here.')}
        </p>
      )}
    </div>
  );
}
