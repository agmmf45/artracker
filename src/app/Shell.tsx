import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { Plus, Search, Cloud, CloudOff, RefreshCw, AlertTriangle, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import clsx from 'clsx';
import { useI18n } from '@/core/i18n';
import { useMedia, useProfile, useSettings } from '@/core/hooks';
import { useSyncStatus, syncNow } from '@/core/sync';
import { LIFE_MAIN, PAGES, SECTIONS, isPageOn, type SectionId } from './registry';
import { Brand } from './Splash';
import { Tour } from './Tour';
import { PageAbout } from './PageAbout';
import { QuickCapture } from './QuickCapture';
import { CommandPalette } from './CommandPalette';
import { UpdatePrompt } from './UpdatePrompt';
import { ReminderEngine } from './ReminderEngine';
import { AchievementWatcher } from './AchievementWatcher';
import { Avatar } from '@/modules/shared/Avatar';

/**
 * Responsive shell, designed per breakpoint (not scaled):
 *  • phone  (< 768)      top bar + page chips · bottom navigation · floating quick-add
 *  • tablet (768–1279)   navigation rail (expandable to a full sidebar) · page tabs · touch-first
 *  • desktop (≥ 1280)    full sidebar with section pages · keyboard shortcuts · wide grid
 */

function useSection(): SectionId {
  const { pathname } = useLocation();
  const s = pathname.split('/')[1];
  return (['life', 'study', 'health', 'settings'].includes(s) ? s : 'life') as SectionId;
}

function SyncBadge({ compact }: { compact?: boolean }) {
  const s = useSyncStatus();
  const { L } = useI18n();
  const map = {
    idle: { icon: <Cloud size={15} />, text: s.pending ? L(`${s.pending} بانتظار المزامنة`, `${s.pending} pending`) : L('متزامن', 'Synced'), tone: 'text-fg-3' },
    syncing: { icon: <RefreshCw size={15} className="animate-spin" />, text: L('جاري المزامنة', 'Syncing'), tone: 'text-fg-3' },
    offline: { icon: <CloudOff size={15} />, text: L('بدون اتصال — محفوظ على جهازك', 'Offline — saved on this device'), tone: 'text-warning' },
    error: { icon: <AlertTriangle size={15} />, text: L('تعذرت المزامنة', 'Sync failed'), tone: 'text-danger' },
    'signed-out': { icon: <CloudOff size={15} />, text: L('انتهت الجلسة', 'Signed out'), tone: 'text-danger' },
  }[s.state];
  return (
    <button onClick={() => void syncNow()} title={s.error ?? map.text} aria-label={map.text} className={clsx('inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[12px] hover:bg-surface-2', map.tone)}>
      {map.icon}
      {!compact && <span className="truncate">{map.text}</span>}
    </button>
  );
}

const RAIL_KEY = 'dq_rail_expanded';

export function Shell() {
  const { L } = useI18n();
  const settings = useSettings();
  const profile = useProfile();
  const section = useSection();
  const nav = useNavigate();
  const loc = useLocation();
  const [capture, setCapture] = useState(false);
  const [palette, setPalette] = useState(false);
  const desktop = useMedia('(min-width: 1280px)');
  const tablet = useMedia('(min-width: 768px)') && !desktop;
  const [railOpen, setRailOpen] = useState(() => { try { return localStorage.getItem(RAIL_KEY) === '1'; } catch { return false; } });
  const toggleRail = () => setRailOpen((v) => { try { localStorage.setItem(RAIL_KEY, v ? '0' : '1'); } catch { /* ignore */ } return !v; });
  const fullSidebar = desktop || (tablet && railOpen);

  const pages = useMemo(() => PAGES.filter((p) => !p.redirect && p.nav !== false && isPageOn(p, settings.modules, settings.modulePreset)), [settings.modules, settings.modulePreset]);
  const sectionPages = pages.filter((p) => p.section === section);
  const sec = SECTIONS.find((s) => s.id === section)!;

  // global shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((v) => !v); return; }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'n' || e.key === 'N' || e.key === 'ى') { e.preventDefault(); setCapture(true); }
      if (e.key === '/') { e.preventDefault(); setPalette(true); }
      if (['1', '2', '3', '4'].includes(e.key)) nav(SECTIONS[Number(e.key) - 1].path);
    };
    const onOpenCapture = () => setCapture(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('dq:capture', onOpenCapture);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('dq:capture', onOpenCapture); };
  }, [nav]);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [loc.pathname]);

  useEffect(() => { try { if (sessionStorage.getItem('_pendingSMS') && loc.pathname !== '/life/finance') nav('/life/finance'); } catch { /* ignore */ } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pageLink = (p: (typeof pages)[number]) => (
    <NavLink
      key={p.id}
      to={p.path}
      end
      data-tour={`nav-${p.id}`}
      className={({ isActive }) => clsx(
        'flex items-center gap-2.5 rounded-full px-3 py-1.5 text-[13.5px] transition-colors',
        isActive ? 'bg-[color-mix(in_oklab,var(--accent)_45%,var(--surface))] font-bold text-fg' : 'text-fg-2 hover:bg-surface-2 hover:text-fg',
      )}
    >
      <p.icon size={15} className="shrink-0 opacity-80" />
      <span className="truncate">{L(p.ar, p.en)}</span>
    </NavLink>
  );

  return (
    <div className={clsx('min-h-dvh', fullSidebar ? 'md:ps-[var(--sidebar-w)]' : 'md:ps-[var(--rail-w)]')}>
      {/* ── Full sidebar (desktop, or tablet when expanded) ── */}
      {fullSidebar && (
        <aside className="fixed inset-y-0 start-0 z-30 hidden w-[var(--sidebar-w)] flex-col border-e border-line bg-surface md:flex" aria-label={L('التنقل الرئيسي', 'Main navigation')}>
          <div className="flex items-center gap-2 px-5 pb-3 pt-5">
            <NavLink to="/life" aria-label="دقيق"><Brand size={30} /></NavLink>
            <span className="flex-1" />
            {tablet && <button onClick={toggleRail} className="grid size-9 place-items-center rounded-full text-fg-2 hover:bg-surface-2" aria-label={L('طيّ القائمة', 'Collapse sidebar')}><PanelLeftClose size={18} className="rtl:-scale-x-100" /></button>}
            {desktop && (
              <button onClick={() => setPalette(true)} className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[11px] text-fg-3 hover:text-fg" aria-label={L('بحث', 'Search')}>
                <Search size={13} /> Ctrl K
              </button>
            )}
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 scroll-thin">
            {SECTIONS.map((s) => {
              const list = pages.filter((p) => p.section === s.id);
              const active = s.id === section;
              return (
                <div key={s.id} className="mb-1" data-section={s.id}>
                  <NavLink to={s.path} end className={clsx('flex items-center gap-2.5 rounded-full px-3 py-2 text-sm font-black', active ? 'tint text-fg' : 'text-fg-2 hover:bg-surface-2 hover:text-fg')}>
                    <span className={clsx('grid size-7 place-items-center rounded-full', active ? 'bg-accent text-on-accent' : 'bg-surface-2')}><s.icon size={15} /></span>
                    {L(s.ar, s.en)}
                  </NavLink>
                  {active && (
                    <div className="mb-2 mt-1 space-y-0.5 ps-4">
                      {s.id === 'life' || s.id === 'study' || s.id === 'health' ? (
                        <>
                          {list.filter((p) => LIFE_MAIN.has(p.id)).map(pageLink)}
                          <div className="px-3 pb-0.5 pt-3 text-[11.5px] font-bold text-fg-3">{L('أدوات', 'Tools')}</div>
                          {list.filter((p) => !LIFE_MAIN.has(p.id)).map(pageLink)}
                        </>
                      ) : list.map(pageLink)}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
          <div className="border-t border-line p-3" data-section="life">
            <button data-tour="quick-add" onClick={() => setCapture(true)} className="mb-2 flex w-full items-center justify-center gap-2 rounded-full border border-[color-mix(in_oklab,var(--life)_70%,var(--life-ink))] bg-life py-2.5 text-sm font-bold text-on-accent hover:bg-[color-mix(in_oklab,var(--life)_85%,var(--life-ink))]">
              <Plus size={17} /> {L('إضافة سريعة', 'Quick add')} {desktop && <kbd className="rounded-full bg-black/10 px-1.5 text-[11px]">N</kbd>}
            </button>
            <div className="flex items-center gap-2">
              <NavLink to="/settings" className="flex min-w-0 flex-1 items-center gap-2 rounded-full p-1 hover:bg-surface-2">
                <Avatar profile={profile} size={30} />
                <span className="truncate text-sm font-bold">{profile.display_name || L('حسابي', 'Account')}</span>
              </NavLink>
              <SyncBadge compact />
            </div>
          </div>
        </aside>
      )}

      {/* ── Tablet navigation rail ── */}
      {tablet && !railOpen && (
        <aside className="fixed inset-y-0 start-0 z-30 flex w-[var(--rail-w)] flex-col items-center gap-1 border-e border-line bg-surface py-4" aria-label={L('التنقل الرئيسي', 'Main navigation')}>
          <button onClick={toggleRail} className="mb-2 grid size-10 place-items-center rounded-full text-fg-2 hover:bg-surface-2" aria-label={L('توسيع القائمة', 'Expand sidebar')}><PanelLeftOpen size={19} className="rtl:-scale-x-100" /></button>
          {SECTIONS.map((s) => {
            const active = s.id === section;
            return (
              <NavLink key={s.id} to={s.path} data-section={s.id} aria-current={active ? 'page' : undefined} className="flex w-full flex-col items-center gap-1 py-1.5 text-[11px] font-bold">
                <span className={clsx('grid h-9 w-14 place-items-center rounded-full transition-colors', active ? 'bg-accent text-on-accent' : 'text-fg-2 hover:bg-surface-2')}><s.icon size={20} /></span>
                <span className={active ? 'text-fg' : 'text-fg-3'}>{L(s.ar, s.en)}</span>
              </NavLink>
            );
          })}
          <span className="flex-1" />
          <button onClick={() => setPalette(true)} className="grid size-10 place-items-center rounded-full text-fg-2 hover:bg-surface-2" aria-label={L('بحث وأوامر', 'Search & commands')}><Search size={19} /></button>
          <button data-tour="quick-add" data-section="life" onClick={() => setCapture(true)} className="my-1 grid size-12 place-items-center rounded-full bg-life text-on-accent shadow-2" aria-label={L('إضافة سريعة', 'Quick add')}><Plus size={22} /></button>
          <SyncBadge compact />
          <NavLink to="/settings" aria-label={L('الملف الشخصي', 'Profile')} className="mt-1"><Avatar profile={profile} size={34} /></NavLink>
        </aside>
      )}

      {/* ── Phone top bar / tablet page tabs ── */}
      {!fullSidebar && (
        <header className="safe-top sticky top-0 z-20 border-b border-line bg-[color-mix(in_oklab,var(--bg)_90%,transparent)] backdrop-blur-md" data-section={section}>
          <div className="flex h-13 items-center gap-2 px-4 md:hidden">
            <span className="grid size-8 place-items-center rounded-full bg-accent text-on-accent"><sec.icon size={16} /></span>
            <span className="text-lg font-black">{L(sec.ar, sec.en)}</span>
            <span className="flex-1" />
            <SyncBadge compact />
            <button onClick={() => setPalette(true)} className="grid size-10 place-items-center rounded-full text-fg-2 hover:bg-surface-2" aria-label={L('بحث وأوامر', 'Search & commands')}><Search size={19} /></button>
            <NavLink to="/settings" aria-label={L('الملف الشخصي', 'Profile')}><Avatar profile={profile} size={32} /></NavLink>
          </div>
          <nav className="flex gap-1.5 overflow-x-auto px-3 pb-2.5 scroll-thin md:px-6 md:py-3" aria-label={L('صفحات القسم', 'Section pages')}>
            {sectionPages.map((p) => (
              <NavLink key={p.id} to={p.path} end data-tour={`nav-${p.id}`}
                className={({ isActive }) => clsx('inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-bold transition-colors', isActive ? 'border-transparent bg-accent text-on-accent' : 'border-line bg-surface text-fg-2')}>
                <p.icon size={14} className="hidden md:block" />{L(p.ar, p.en)}
              </NavLink>
            ))}
          </nav>
        </header>
      )}

      <main data-section={section} className="mx-auto w-full max-w-[var(--content-max)] px-4 pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+92px)] pt-5 md:px-7 md:pb-16 md:pt-7 xl:px-10 xl:pt-9">
        <PageAbout />
        <Outlet />
      </main>

      {/* ── Phone: floating quick-add + bottom navigation ── */}
      <button
        data-section="life"
        data-tour="quick-add"
        onClick={() => setCapture(true)}
        aria-label={L('إضافة سريعة', 'Quick add')}
        className="fixed end-4 z-30 grid size-15 place-items-center rounded-full border border-[color-mix(in_oklab,var(--life)_60%,var(--life-ink))] bg-life text-on-accent shadow-3 transition-transform active:scale-95 md:hidden"
        style={{ bottom: 'calc(var(--bottom-nav-h) + env(safe-area-inset-bottom) + 16px)' }}
      >
        <Plus size={28} />
      </button>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-[color-mix(in_oklab,var(--surface)_94%,transparent)] backdrop-blur-md md:hidden" aria-label={L('الأقسام', 'Sections')}>
        <div className="mx-auto grid h-[var(--bottom-nav-h)] max-w-lg grid-cols-4 px-2">
          {SECTIONS.map((s) => {
            const active = s.id === section;
            return (
              <button key={s.id} data-section={s.id} onClick={() => nav(s.path)} aria-current={active ? 'page' : undefined}
                className="flex flex-col items-center justify-center gap-1 text-[11px] font-bold">
                <span className={clsx('grid h-8 w-14 place-items-center rounded-full transition-colors', active ? 'bg-accent text-on-accent' : 'text-fg-3')}><s.icon size={21} strokeWidth={active ? 2.4 : 2} /></span>
                <span className={active ? 'text-fg' : 'text-fg-3'}>{L(s.ar, s.en)}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <QuickCapture open={capture} onOpenChange={setCapture} />
      <CommandPalette open={palette} onOpenChange={setPalette} onCapture={() => { setPalette(false); setCapture(true); }} />
      <UpdatePrompt />
      <ReminderEngine />
      <AchievementWatcher />
      <Tour />
    </div>
  );
}
