import { lazy, Suspense, useEffect, useMemo, type ComponentType } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { AuthProvider, useAuth } from '@/core/auth';
import { I18nContext, makeI18n } from '@/core/i18n';
import { useSettings } from '@/core/hooks';
import { ToastHost } from '@/core/toast';
import { ConfirmHost } from '@/design/overlay';
import { applyPrefs, readPrefs } from './prefs';
import { PAGES, isPageOn, SECTIONS } from './registry';
import { Shell } from './Shell';
import { AuthScreen } from './AuthScreen';
import { MigrationScreen, Splash } from './Splash';
import { Onboarding } from './Onboarding';
import { ErrorBoundary } from './ErrorBoundary';
import { PrivacyOverlay } from './PrivacyPolicy';

const lazyPages: Record<string, ComponentType> = Object.fromEntries(PAGES.filter((p) => !p.redirect).map((p) => [p.id, lazy(p.load)]));

/** Old path of a merged page → its hub tab, keeping ?open=… and friends. */
function KeepQuery({ to }: { to: string }) {
  const { search } = useLocation();
  const extra = search.replace(/^\?/, '');
  return <Navigate to={extra ? `${to}${to.includes('?') ? '&' : '?'}${extra}` : to} replace />;
}

function PageLoading() {
  return (
    <div className="space-y-3 p-1" aria-busy="true">
      <div className="skeleton h-8 w-48" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="skeleton h-32" /><div className="skeleton h-32" /><div className="skeleton h-32" />
      </div>
    </div>
  );
}

function Ready() {
  const settings = useSettings();
  const i18n = useMemo(() => makeI18n(settings.language), [settings.language]);

  useEffect(() => {
    applyPrefs({ language: settings.language, theme: settings.theme, legacyTheme: settings.legacyTheme, density: settings.density });
  }, [settings.language, settings.theme, settings.legacyTheme, settings.density]);

  return (
    <I18nContext.Provider value={i18n}>
      {!settings.onboarded ? (
        <Onboarding />
      ) : (
        <BrowserRouter>
          <Routes>
            <Route element={<Shell />}>
              <Route index element={<Navigate to="/life" replace />} />
              <Route path="/life" element={<Navigate to="/life/today" replace />} />
              {/* removed pages: the old dashboard and its settings */}
              <Route path="/life/overview" element={<Navigate to="/life/today" replace />} />
              <Route path="/settings/dashboard" element={<Navigate to="/settings" replace />} />
              {PAGES.map((p) => {
                if (p.redirect) return <Route key={p.id} path={p.path} element={<KeepQuery to={p.redirect} />} />;
                const C = lazyPages[p.id];
                const on = isPageOn(p, settings.modules, settings.modulePreset);
                const fallback = SECTIONS.find((s) => s.id === p.section)!.path;
                return (
                  <Route
                    key={p.id}
                    path={p.path}
                    element={on ? (
                      <ErrorBoundary key={p.id}>
                        <Suspense fallback={<PageLoading />}><C /></Suspense>
                      </ErrorBoundary>
                    ) : <Navigate to={fallback} replace />}
                  />
                );
              })}
              <Route path="*" element={<Navigate to="/life" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      )}
      <ToastHost />
      <ConfirmHost />
    </I18nContext.Provider>
  );
}

function Gate() {
  const { phase } = useAuth();
  const i18n = useMemo(() => makeI18n(readPrefs().language), []);
  if (phase === 'ready') return <Ready />;
  return (
    <I18nContext.Provider value={i18n}>
      {phase === 'loading' && <Splash />}
      {phase === 'stuck' && <Splash stuck />}
      {phase === 'signed-out' && <AuthScreen />}
      {phase === 'migrating' && <MigrationScreen />}
      <ToastHost />
    </I18nContext.Provider>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Gate />
      <PrivacyOverlay />
    </AuthProvider>
  );
}
