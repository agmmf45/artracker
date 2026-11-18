import { useRef, useState } from 'react';
import { CalendarDays, Clock, Repeat, ListTree, Pin, Lock, AlertCircle, Check, CalendarClock } from 'lucide-react';
import clsx from 'clsx';
import { useI18n } from '@/core/i18n';
import { useMedia, useSettings } from '@/core/hooks';
import { revertTo } from '@/core/repo';
import { undoToast } from '@/core/toast';
import type { Rec } from '@shared/records';
import { fmtTime, relativeDay, shiftKey, todayKey } from '@/core/dates';
import { CheckCircle } from '@/design/ui';
import { isDone, isOverdue, priorityColor, saveTask, toggleTask, type Task } from './model';

const SWIPE_AT = 84;

export function TaskRow({ task, onOpen, blocked, compact, showDate = true, selected, onSelect }: {
  task: Task; onOpen?: (t: Task) => void; blocked?: boolean; compact?: boolean; showDate?: boolean; selected?: boolean; onSelect?: (id: string, v: boolean) => void;
}) {
  const { L, lang, locale, dir } = useI18n();
  const settings = useSettings();
  const phone = useMedia('(max-width: 767px)');
  const [dx, setDx] = useState(0);
  const g = useRef<{ x: number; y: number; axis: 'x' | 'y' | null } | null>(null);
  const d = task.data;
  const done = isDone(task);
  const overdue = isOverdue(task);
  const subDone = d.subtasks?.filter((s) => s.done).length ?? 0;
  const h12 = settings.timeFormat === '12';
  const day = d.start ?? d.due;
  const time = d.start ? d.start_time : d.due_time;

  // Phone swipe actions: swipe from the leading edge = complete, the other way = postpone one day.
  // Postponing never moves a task earlier: it starts from the later of today and the task's own day.
  const lead = (v: number) => (dir === 'rtl' ? v < 0 : v > 0);
  const today = todayKey();
  const base = day && day > today ? day : today;
  const target = shiftKey(base, 1);
  const postponeLabel = base === today ? L('بكرة', 'Tomorrow') : L('أجّل يوماً', '+1 day');
  const postpone = async () => {
    const prev = { ...task } as unknown as Rec;
    if (d.start) await saveTask(task.id, { ...d, start: target, due: d.due && d.due < target ? target : d.due });
    else await saveTask(task.id, { ...d, due: target });
    undoToast(base === today ? L('نُقلت إلى بكرة', 'Moved to tomorrow') : L(`أُجّلت إلى ${relativeDay(target, lang, locale)}`, `Moved to ${relativeDay(target, lang, locale)}`), () => revertTo(prev));
  };
  const swipe = phone ? {
    onTouchStart: (e: React.TouchEvent) => { g.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, axis: null }; },
    onTouchMove: (e: React.TouchEvent) => {
      const s = g.current; if (!s) return;
      const mx = e.touches[0].clientX - s.x; const my = e.touches[0].clientY - s.y;
      if (!s.axis && Math.hypot(mx, my) > 10) s.axis = Math.abs(mx) > Math.abs(my) * 1.3 ? 'x' : 'y';
      if (s.axis === 'x') setDx(Math.max(-130, Math.min(130, mx)));
    },
    onTouchEnd: () => {
      const v = dx; g.current = null; setDx(0);
      if (Math.abs(v) < SWIPE_AT) return;
      if (navigator.vibrate) navigator.vibrate(8);
      if (lead(v)) void toggleTask(task, settings); else if (!done) void postpone();
    },
  } : {};
  const armed = Math.abs(dx) >= SWIPE_AT;

  const row = (
    <div
      {...swipe}
      style={dx ? { transform: `translateX(${dx}px)` } : undefined}
      className={clsx(
        'group relative flex items-start gap-3 rounded-sm bg-surface px-2 hover:bg-surface-2',
        dx ? '' : 'transition-[transform,background-color] duration-200',
        compact ? 'py-1.5' : 'py-2.5',
        selected && 'bg-[color-mix(in_oklab,var(--accent)_38%,transparent)]',
      )}
    >
      {onSelect && (
        <input type="checkbox" checked={!!selected} onChange={(e) => onSelect(task.id, e.target.checked)} aria-label={L('تحديد', 'Select')} className="mt-1 size-4 accent-[var(--accent)]" />
      )}
      <div className="pt-0.5">
        <CheckCircle checked={done} onToggle={() => void toggleTask(task, settings)} label={done ? L('إلغاء الإنجاز', 'Mark not done') : L('إنجاز', 'Complete')} color={priorityColor(d.priority) === 'var(--text-3)' ? undefined : priorityColor(d.priority)} />
      </div>
      <button className="min-w-0 flex-1 text-start" onClick={() => onOpen?.(task)}>
        <div className={clsx('flex items-center gap-1.5 text-[14.5px] leading-snug', done && 'text-fg-3 line-through decoration-1')}>
          {d.pinned && <Pin size={12} className="shrink-0 text-fg-3" />}
          <span className="truncate">{d.title || L('بدون عنوان', 'Untitled')}</span>
        </div>
        {!compact && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-fg-3">
            {showDate && day && (
              <span className={clsx('inline-flex items-center gap-1', overdue && 'font-bold text-danger', day === todayKey() && !done && 'text-accent')}>
                {overdue ? <AlertCircle size={12} /> : <CalendarDays size={12} />}
                {d.start && d.due && d.start !== d.due ? `${relativeDay(d.start, lang, locale)} → ${L('موعد', 'due')} ${relativeDay(d.due, lang, locale)}` : relativeDay(day, lang, locale)}
              </span>
            )}
            {time && <span className="inline-flex items-center gap-1"><Clock size={12} />{fmtTime(time, locale, h12)}{d.duration_min ? ` · ${d.duration_min}${L('د', 'm')}` : ''}</span>}
            {d.recurrence && <Repeat size={12} aria-label={L('متكررة', 'Recurring')} />}
            {!!d.subtasks?.length && <span className="inline-flex items-center gap-1"><ListTree size={12} />{subDone}/{d.subtasks.length}</span>}
            {d.category && <span>{d.category}</span>}
            {d.tags?.map((t) => <span key={t}>#{t}</span>)}
            {blocked && <span className="inline-flex items-center gap-1 text-warning"><Lock size={12} />{L('بانتظار مهمة أخرى', 'Blocked')}</span>}
          </div>
        )}
      </button>
    </div>
  );

  if (!swipe.onTouchStart) return row;
  const leading = lead(dx);
  return (
    <div className="relative overflow-hidden rounded-sm" data-no-swipe>
      {dx !== 0 && (
        <div aria-hidden className={clsx('absolute inset-0 flex items-center px-4 text-[13px] font-bold transition-colors', leading ? 'justify-start' : 'justify-end', leading ? (armed ? 'bg-[color-mix(in_oklab,var(--success)_45%,var(--surface))]' : 'bg-[color-mix(in_oklab,var(--success)_18%,var(--surface))]') : (armed ? 'bg-[color-mix(in_oklab,var(--study)_75%,var(--surface))]' : 'bg-[color-mix(in_oklab,var(--study)_30%,var(--surface))]'))}>
          {leading
            ? <span className="inline-flex items-center gap-1.5"><Check size={17} />{done ? L('إلغاء الإنجاز', 'Undo') : L('إنجاز', 'Done')}</span>
            : <span className="inline-flex items-center gap-1.5"><CalendarClock size={17} />{postponeLabel}</span>}
        </div>
      )}
      {row}
    </div>
  );
}
