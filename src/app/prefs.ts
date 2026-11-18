/** Tiny localStorage mirror of display prefs so the first paint already has the right language/theme. */
export interface Prefs {
  language: 'ar' | 'en';
  theme: 'system' | 'light' | 'dark';
  legacyTheme: string | null;
  density: 'comfortable' | 'compact';
}

const KEY = 'dq_prefs';

export function readPrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return { language: p.language === 'en' ? 'en' : 'ar', theme: p.theme ?? 'light', legacyTheme: p.legacyTheme ?? null, density: p.density ?? 'comfortable' };
  } catch {
    return { language: 'ar', theme: 'light', legacyTheme: null, density: 'comfortable' };
  }
}

export function applyPrefs(p: Prefs) {
  const el = document.documentElement;
  // two themes only (light / dark); the v4 colour themes were retired — a v4 dark theme maps to dark
  if (p.legacyTheme && ['dark', 'navy', 'inferno', 'electric', 'galaxy', 'nature'].includes(p.legacyTheme)) p = { ...p, theme: 'dark' };
  p = { ...p, legacyTheme: null };
  el.lang = p.language;
  el.dir = p.language === 'ar' ? 'rtl' : 'ltr';
  if (p.theme === 'system') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', p.theme);
  el.removeAttribute('data-legacy-theme');
  el.setAttribute('data-density', p.density);
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode */ }
}
