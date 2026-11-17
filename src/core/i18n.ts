import { createContext, useContext } from 'react';

export type Lang = 'ar' | 'en';

export interface I18n {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  /** pick the string for the current language: L('مهام', 'Tasks') */
  L: (ar: string, en: string) => string;
  locale: string;
  fmtNum: (n: number, opts?: Intl.NumberFormatOptions) => string;
}

export function makeI18n(lang: Lang): I18n {
  // Arabic UI with Latin digits reads better for data-heavy screens and matches the v4 app.
  const locale = lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB';
  const nf = new Intl.NumberFormat(locale);
  return {
    lang,
    dir: lang === 'ar' ? 'rtl' : 'ltr',
    L: (ar, en) => (lang === 'ar' ? ar : en),
    locale,
    fmtNum: (n, opts) => (opts ? new Intl.NumberFormat(locale, opts).format(n) : nf.format(n)),
  };
}

export const I18nContext = createContext<I18n>(makeI18n('ar'));
export const useI18n = () => useContext(I18nContext);
export const useL = () => useContext(I18nContext).L;
