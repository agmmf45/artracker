import { Suspense, type ComponentType, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import clsx from 'clsx';
import { useI18n } from '@/core/i18n';

export interface HubTab { id: string; ar: string; en: string; icon?: ReactNode; badge?: number; C: ComponentType }

/**
 * One page that holds several related pages as tabs (?tab=…), e.g. Tasks + Inbox, or
 * Goals + Projects + Habits. Each tab is the full original page, so nothing is lost.
 */
export function Hub({ tabs, label }: { tabs: HubTab[]; label: string }) {
  const { L } = useI18n();
  const [params, setParams] = useSearchParams();
  const cur = tabs.find((t) => t.id === params.get('tab')) ?? tabs[0];
  const pick = (id: string) => {
    const next = new URLSearchParams(params);
    if (id === tabs[0].id) next.delete('tab'); else next.set('tab', id);
    setParams(next, { replace: true });
  };
  if (!cur) return null;
  return (
    <div>
      {tabs.length > 1 && (
        <div role="tablist" aria-label={label} className="mb-5 flex gap-1.5 overflow-x-auto pb-1 scroll-thin">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={t.id === cur.id} onClick={() => pick(t.id)}
              className={clsx('inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border-[1.5px] px-4 text-[14px] font-bold transition-colors',
                t.id === cur.id ? 'border-fg bg-fg text-bg' : 'border-line bg-surface text-fg-2 hover:border-line-strong hover:text-fg')}>
              {t.icon}{L(t.ar, t.en)}
              {!!t.badge && <span className={clsx('num rounded-full px-1.5 text-[11.5px]', t.id === cur.id ? 'bg-bg/20' : 'bg-[color-mix(in_oklab,var(--life)_45%,var(--surface))] text-fg')}>{t.badge}</span>}
            </button>
          ))}
        </div>
      )}
      <Suspense fallback={<div className="skeleton h-48" />}><cur.C /></Suspense>
    </div>
  );
}
