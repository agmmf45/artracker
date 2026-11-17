import { CalendarDays, Clock, Repeat, ListTree, Pin, Lock, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/hooks';
import { fmtTime, relativeDay, todayKey } from '@/core/dates';
import { CheckCircle } from '@/design/ui';
import { isDone, isOverdue, priorityColor, toggleTask, type Task } from './model';

export function TaskRow({ task, onOpen, blocked, compact, showDate = true, selected, onSelect }: {
  task: Task; onOpen?: (t: Task) => void; blocked?: boolean; compact?: boolean; showDate?: boolean; selected?: boolean; onSelect?: (id: string, v: boolean) => void;
}) {
  const { L, lang, locale } = useI18n();
  const settings = useSettings();
  const d = task.data;
  const done = isDone(task);
  const overdue = isOverdue(task);
  const subDone = d.subtasks?.filter((s) => s.done).length ?? 0;
  const h12 = settings.timeFormat === '12';
  const day = d.start ?? d.due;
  const time = d.start ? d.start_time : d.due_time;

  return (
    <div
      className={clsx(
        'group flex items-start gap-3 rounded-sm px-2 transition-colors hover:bg-surface-2',
        compact ? 'py-1.5' : 'py-2.5',
        selected && 'bg-[color-mix(in_oklab,var(--accent)_10%,transparent)]',
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
}
