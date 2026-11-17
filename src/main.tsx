import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/design/index.css';
import { App } from '@/app/App';
import { applyPrefs, readPrefs } from '@/app/prefs';

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
