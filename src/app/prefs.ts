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
    return { language: p.language === 'en' ? 'en' : 'ar', theme: p.theme ?? 'system', legacyTheme: p.legacyTheme ?? null, density: p.density ?? 'comfortable' };
  } catch {
    return { language: 'ar', theme: 'system', legacyTheme: null, density: 'comfortable' };
  }
}

const DARK_THEMES = new Set(['dark', 'navy', 'inferno', 'electric', 'galaxy', 'nature']);

export function applyPrefs(p: Prefs) {
  const el = document.documentElement;
  // v4 dark themes only work on the dark palette
  if (p.legacyTheme && DARK_THEMES.has(p.legacyTheme)) p = { ...p, theme: 'dark' };
  el.lang = p.language;
  el.dir = p.language === 'ar' ? 'rtl' : 'ltr';
  if (p.theme === 'system') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', p.theme);
  if (p.legacyTheme) el.setAttribute('data-legacy-theme', p.legacyTheme);
  else el.removeAttribute('data-legacy-theme');
  el.setAttribute('data-density', p.density);
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode */ }
}
