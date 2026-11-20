import { useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { Info, X } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { PAGES } from './registry';
import { PAGE_ABOUT } from './pageAboutText';

const KEY = 'dq_about_hidden';
const readHidden = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]; } catch { return []; } };
const writeHidden = (v: string[]) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage off: only this visit */ } };

/**
 * "What is this page?" — one line at the top of every page (and every hub tab) saying what it's
 * for and what you can do there. Each line can be folded away; the fold is remembered per page.
 */
export function PageAbout() {
  const { L } = useI18n();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const [hidden, setHidden] = useState<string[]>(readHidden);
  const page = PAGES.find((p) => !p.redirect && p.path === pathname);
  if (!page) return null;
  const tab = params.get('tab');
  const key = tab && PAGE_ABOUT[`${page.id}#${tab}`] ? `${page.id}#${tab}` : page.id;
  const text = PAGE_ABOUT[key];
  if (!text) return null;
  const toggle = (hide: boolean) => {
    const next = hide ? [...new Set([...hidden, key])] : hidden.filter((k) => k !== key);
    setHidden(next);
    writeHidden(next);
  };

  if (hidden.includes(key)) {
    return (
      <div className="mb-2 flex justify-end">
        <button onClick={() => toggle(false)} className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-bold text-fg-3 hover:bg-surface-2 hover:text-fg-2" aria-label={L('وش هالصفحة؟', 'What is this page?')}>
          <Info size={14} aria-hidden="true" />{L('وش هالصفحة؟', 'About this page')}
        </button>
      </div>
    );
  }
  return (
    <p className="mb-4 flex items-start gap-2 rounded-md border border-dashed border-line-strong bg-[color-mix(in_oklab,var(--surface)_70%,transparent)] py-2 pe-1.5 ps-3 text-[13px] leading-relaxed text-fg-2">
      <Info size={15} className="mt-[3px] shrink-0 text-accent-ink" aria-hidden="true" />
      <span className="flex-1">{L(text[0], text[1])}</span>
      <button onClick={() => toggle(true)} className="grid size-7 shrink-0 place-items-center rounded-full text-fg-3 hover:bg-surface-2 hover:text-fg" aria-label={L('إخفاء الشرح', 'Hide this note')} title={L('إخفاء', 'Hide')}>
        <X size={14} />
      </button>
    </p>
  );
}
