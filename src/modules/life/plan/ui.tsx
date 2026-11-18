import { useState, type ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { useI18n } from '@/core/i18n';

/** ‹ label › navigation shared by the Week and Month pages. */
export function PeriodNav({ label, onPrev, onNext, onNow, isNow, nowLabel }: { label: string; onPrev: () => void; onNext: () => void; onNow: () => void; isNow: boolean; nowLabel: string }) {
  const { L } = useI18n();
  return (
    <div className="flex items-center rounded-full border border-line bg-surface">
      <button onClick={onPrev} aria-label={L('السابق', 'Previous')} className="grid size-10 place-items-center rounded-full hover:bg-surface-2"><ChevronRight size={18} className="ltr:rotate-180" /></button>
      <button onClick={onNow} disabled={isNow} className="h-10 px-3 text-sm font-bold disabled:text-fg-3" title={label}>{isNow ? label : nowLabel}</button>
      <button onClick={onNext} aria-label={L('التالي', 'Next')} className="grid size-10 place-items-center rounded-full hover:bg-surface-2"><ChevronLeft size={18} className="ltr:rotate-180" /></button>
    </div>
  );
}

export function Tick({ on, onClick, label }: { on: boolean; onClick?: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} aria-label={label} disabled={!onClick}
      className={clsx('grid size-6 shrink-0 place-items-center rounded-[7px] border-[1.5px]', on ? 'border-study-ink bg-study-ink text-surface' : 'border-line-strong bg-surface', onClick && 'cursor-pointer')}>
      {on && <Check size={14} />}
    </button>
  );
}

/**
 * The planning ritual for a level (plan the day / plan the week / close the month): a short
 * checklist the user ticks through. Ticks are a per-device convenience kept in localStorage.
 */
export function Ritual({ title, steps, storeKey }: { title: ReactNode; steps: Array<[string, string]>; storeKey: string }) {
  const { L } = useI18n();
  const [open, setOpen] = useState(false);
  const read = (): number[] => { try { return JSON.parse(localStorage.getItem(storeKey) ?? '[]') as number[]; } catch { return []; } };
  const [done, setDone] = useState<number[]>(read);
  const toggle = (i: number) => {
    const next = done.includes(i) ? done.filter((x) => x !== i) : [...done, i];
    setDone(next);
    try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* private mode */ }
  };
  return (
    <div className="contents">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-fg px-4 text-sm font-bold text-bg hover:opacity-90">
        {title}{done.length > 0 && <span className="num rounded-full bg-bg/20 px-1.5 text-[11.5px]">{done.length}/{steps.length}</span>}
      </button>
      {open && (
        <div className="order-last basis-full rounded-md border-[1.5px] border-fg bg-surface p-3">
          <ol className="flex flex-wrap gap-x-5 gap-y-2">
            {steps.map(([ar, en], i) => (
              <li key={i} className="flex items-center gap-2 text-[14px]">
                <Tick on={done.includes(i)} onClick={() => toggle(i)} label={L(ar, en)} />
                <span className={clsx(done.includes(i) && 'text-fg-2 line-through')}><span className="num">{i + 1}.</span> {L(ar, en)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
