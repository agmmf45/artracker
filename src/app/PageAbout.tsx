import { useLocation, useSearchParams } from 'react-router';
import { Popover } from 'radix-ui';
import { Info, X } from 'lucide-react';
import clsx from 'clsx';
import { useI18n } from '@/core/i18n';
import { PAGES } from './registry';
import { PAGE_ABOUT } from './pageAboutText';

/** The about line for the page on screen (a hub tab's own line wins over its page's). */
function useAboutText(): [string, string] | null {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const page = PAGES.find((p) => !p.redirect && p.path === pathname);
  if (!page) return null;
  const tab = params.get('tab');
  return (tab && PAGE_ABOUT[`${page.id}#${tab}`]) || PAGE_ABOUT[page.id] || null;
}

/**
 * "What is this page?" — a small ⓘ that opens one line about what the page is for and what you
 * do there. It takes no room on the page: in the phone's top bar, or the page's top corner on
 * wider screens.
 */
export function PageAbout({ small = false }: { small?: boolean }) {
  const { L, dir } = useI18n();
  const text = useAboutText();
  if (!text) return null;
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className={clsx('grid place-items-center rounded-full text-fg-3 hover:bg-surface-2 hover:text-fg-2 data-[state=open]:bg-surface-2 data-[state=open]:text-accent-ink', small ? 'size-8' : 'size-10')}
          aria-label={L('وش هالصفحة؟', 'What is this page?')} title={L('وش هالصفحة؟', 'What is this page?')}>
          <Info size={small ? 16 : 18} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content dir={dir} side="bottom" align="end" sideOffset={6} collisionPadding={12}
          className="anim-in z-[70] w-[min(20rem,calc(100vw-24px))] rounded-md border border-line bg-elevated p-3 pe-2 text-[13.5px] leading-relaxed text-fg shadow-3">
          <div className="flex items-start gap-2">
            <p className="flex-1">{L(text[0], text[1])}</p>
            <Popover.Close className="grid size-7 shrink-0 place-items-center rounded-full text-fg-3 hover:bg-surface-2" aria-label={L('إغلاق', 'Close')}><X size={14} /></Popover.Close>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
