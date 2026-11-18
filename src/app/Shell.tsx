import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { Plus, Search, Cloud, CloudOff, RefreshCw, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { useI18n } from '@/core/i18n';
import { useProfile, useSettings } from '@/core/hooks';
import { useSyncStatus, syncNow } from '@/core/sync';
import { PAGES, SECTIONS, isPageOn, type SectionId } from './registry';
import { Brand } from './Splash';
import { QuickCapture } from './QuickCapture';
import { CommandPalette } from './CommandPalette';
import { UpdatePrompt } from './UpdatePrompt';
import { ReminderEngine } from './ReminderEngine';
import { AchievementWatcher } from './AchievementWatcher';
import { Avatar } from '@/modules/shared/Avatar';

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
    <button onClick={() => void syncNow()} title={s.error ?? map.text} aria-label={map.text} className={clsx('inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[12px] hover:bg-surface-2', map.tone)}>
      {map.icon}
      {!compact && <span className="truncate">{map.text}</span>}
    </button>
  );
}

export function Shell() {
  const { L } = useI18n();
  const settings = useSettings();
  const profile = useProfile();
  const section = useSection();
  const nav = useNavigate();
  const loc = useLocation();
  const [capture, setCapture] = useState(false);
  const [palette, setPalette] = useState(false);

  const pages = useMemo(() => PAGES.filter((p) => isPageOn(p, settings.modules, settings.modulePreset)), [settings.modules, settings.modulePreset]);
  const sectionPages = pages.filter((p) => p.section === section);

  // global shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((v) => !v); return; }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'n' || e.key === 'N' || e.key === 'ى') { e.preventDefault(); setCapture(true); }
      if (e.key === '/') { e.preventDefault(); setPalette(true); }
    };
    const onOpenCapture = () => setCapture(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('dq:capture', onOpenCapture);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('dq:capture', onOpenCapture); };
  }, []);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [loc.pathname]);
  useEffect(() => { try { if (sessionStorage.getItem('_pendingSMS') && loc.pathname !== '/life/finance') nav('/life/finance'); } catch { /* ignore */ } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-dvh lg:ps-[var(--sidebar-w)]">
      {/* ── Desktop sidebar ── */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-[var(--sidebar-w)] flex-col border-e border-line bg-surface lg:flex" aria-label={L('التنقل الرئيسي', 'Main navigation')}>
        <div className="flex items-center gap-2 px-5 pb-3 pt-5">
          <NavLink to="/life" aria-label="دقيق"><Brand size={30} /></NavLink>
          <span className="flex-1" />
          <button onClick={() => setPalette(true)} className="inline-flex items-center gap-1 rounded-sm border border-line px-2 py-1 text-[11px] text-fg-3 hover:text-fg" aria-label={L('بحث', 'Search')}>
            <Search size={13} /> Ctrl K
          </button>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 scroll-thin">
          {SECTIONS.map((s) => {
            const list = pages.filter((p) => p.section === s.id);
            const active = s.id === section;
            return (
              <div key={s.id} className="mb-1" data-section={s.id}>
                <NavLink
                  to={s.path}
                  end
                  className={clsx('flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm font-black', active ? 'text-accent' : 'text-fg-2 hover:text-fg')}
                >
                  <s.icon size={17} /> {L(s.ar, s.en)}
                </NavLink>
                {active && (
                  <div className="mb-2 ms-4 border-s border-line ps-2">
                    {list.map((p) => (
                      <NavLink
                        key={p.id}
                        to={p.path}
                        end
                        className={({ isActive }) => clsx(
                          'flex items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-[13.5px] transition-colors',
                          isActive ? 'bg-[color-mix(in_oklab,var(--accent)_13%,transparent)] font-bold text-fg' : 'text-fg-2 hover:bg-surface-2 hover:text-fg',
                        )}
                      >
                        <p.icon size={15} className="shrink-0 opacity-80" />
                        <span className="truncate">{L(p.ar, p.en)}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="border-t border-line p-3">
          <button onClick={() => setCapture(true)} className="mb-2 flex w-full items-center justify-center gap-2 rounded-sm bg-life py-2.5 text-sm font-bold text-on-accent hover:brightness-105">
            <Plus size={17} /> {L('إضافة سريعة', 'Quick add')} <kbd className="rounded-xs bg-black/10 px-1.5 text-[11px]">N</kbd>
          </button>
          <div className="flex items-center gap-2">
            <NavLink to="/settings" className="flex min-w-0 flex-1 items-center gap-2 rounded-sm p-1 hover:bg-surface-2">
              <Avatar profile={profile} size={30} />
              <span className="truncate text-sm font-bold">{profile.display_name || L('حسابي', 'Account')}</span>
            </NavLink>
            <SyncBadge compact />
          </div>
        </div>
      </aside>

      {/* ── Mobile / tablet top bar + sub-navigation ── */}
      <header className="safe-top sticky top-0 z-20 border-b border-line bg-[color-mix(in_oklab,var(--bg)_88%,transparent)] backdrop-blur-md lg:hidden" data-section={section}>
        <div className="flex h-12 items-center gap-2 px-4">
          <span className="text-lg font-black text-accent">{L(SECTIONS.find((s) => s.id === section)!.ar, SECTIONS.find((s) => s.id === section)!.en)}</span>
          <span className="flex-1" />
          <SyncBadge compact />
          <button onClick={() => setPalette(true)} className="grid size-9 place-items-center rounded-sm text-fg-2 hover:bg-surface-2" aria-label={L('بحث وأوامر', 'Search & commands')}><Search size={19} /></button>
          <NavLink to="/settings" aria-label={L('الملف الشخصي', 'Profile')}><Avatar profile={profile} size={30} /></NavLink>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2 scroll-thin" aria-label={L('صفحات القسم', 'Section pages')}>
          {sectionPages.map((p) => (
            <NavLink
              key={p.id}
              to={p.path}
              end
              className={({ isActive }) => clsx('shrink-0 rounded-full px-3 py-1.5 text-[13px] font-bold transition-colors', isActive ? 'bg-accent text-on-accent' : 'bg-surface-2 text-fg-2')}
            >
              {L(p.ar, p.en)}
            </NavLink>
          ))}
        </nav>
      </header>

      <main data-section={section} className="mx-auto w-full max-w-[var(--content-max)] px-4 pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+88px)] pt-5 md:px-8 lg:pb-16 lg:pt-8">
        <Outlet />
      </main>

      {/* ── Floating quick-add (mobile/tablet) ── */}
      <button
        onClick={() => setCapture(true)}
        aria-label={L('إضافة سريعة', 'Quick add')}
        className="fixed end-4 z-30 grid size-14 place-items-center rounded-full bg-life text-on-accent shadow-3 transition-transform active:scale-95 lg:hidden"
        style={{ bottom: 'calc(var(--bottom-nav-h) + env(safe-area-inset-bottom) + 14px)' }}
      >
        <Plus size={26} />
      </button>

      {/* ── Bottom navigation (mobile/tablet) ── */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-[color-mix(in_oklab,var(--surface)_94%,transparent)] backdrop-blur-md lg:hidden" aria-label={L('الأقسام', 'Sections')}>
        <div className="mx-auto grid h-[var(--bottom-nav-h)] max-w-lg grid-cols-4">
          {SECTIONS.map((s) => {
            const active = s.id === section;
            return (
              <button
                key={s.id}
                data-section={s.id}
                onClick={() => nav(s.path)}
                aria-current={active ? 'page' : undefined}
                className={clsx('flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors', active ? 'text-accent' : 'text-fg-3')}
              >
                <s.icon size={22} strokeWidth={active ? 2.4 : 2} />
                {L(s.ar, s.en)}
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
    </div>
  );
}
