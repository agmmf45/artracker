import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/design/index.css';
import { App } from '@/app/App';
import { applyPrefs, readPrefs } from '@/app/prefs';

// Bank SMS hand-off from an iOS Shortcut (v4 feature): /?sms=<text>&auto=1 → Finance › log from SMS
try {
  const qs = new URLSearchParams(location.search);
  const sms = qs.get('sms');
  if (sms) {
    sessionStorage.setItem('_pendingSMS', sms);
    sessionStorage.setItem('_pendingAuto', qs.get('auto') === '1' ? '1' : '0');
    history.replaceState({}, '', '/life/finance');
  }
} catch { /* storage unavailable */ }

// Apply language/theme before first paint (mirrored from synced settings into localStorage).
applyPrefs(readPrefs());

// Remove the v4 service-worker caches (artrk-*) — the new SW at the same /sw.js path takes over.
if ('caches' in window) {
  caches.keys().then((keys) => keys.filter((k) => k.startsWith('artrk-')).forEach((k) => caches.delete(k))).catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
