import { useEffect, useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';

/**
 * Public privacy policy, part of the app itself (no separate page). It opens over any screen —
 * including the sign-in screen — whenever the URL hash is #/privacy, which is the link registered
 * on Google's OAuth consent screen (https://www.daqeeq.org/#/privacy).
 */

export const PRIVACY_HASH = '#/privacy';

export function usePrivacyOpen(): [boolean, () => void] {
  const [open, setOpen] = useState(() => typeof location !== 'undefined' && location.hash === PRIVACY_HASH);
  const [direct] = useState(open);
  useEffect(() => {
    const sync = () => setOpen(location.hash === PRIVACY_HASH);
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  const close = () => {
    if (!direct && history.length > 1) { history.back(); return; }
    history.replaceState(history.state, '', location.pathname + location.search);
    setOpen(false);
  };
  return [open, close];
}

const AR = {
  title: 'سياسة الخصوصية',
  updated: 'آخر تحديث: 18 نوفمبر 2026',
  sections: [
    ['ما الذي نجمعه', [
      'بيانات الحساب: الاسم والبريد الإلكتروني. عند الدخول بحساب Google نستلم منه الاسم والبريد وصورة الملف الشخصي فقط، ولا نصل إلى أي شيء آخر في حسابك.',
      'ما تضيفه بنفسك: المهام والعادات والملاحظات والدراسة والصحة والمصاريف وغيرها من البيانات التي تكتبها في التطبيق.',
    ]],
    ['كيف نستخدمها', [
      'لتشغيل التطبيق وحفظ بياناتك ومزامنتها بين أجهزتك فقط.',
      'لا نبيع بياناتك، ولا نعرض إعلانات، ولا نشاركها مع أي جهة لأغراض تسويقية.',
    ]],
    ['أين تُحفظ', [
      'تُحفظ البيانات على خوادم Cloudflare مرتبطةً بحسابك، ونسخة منها على جهازك لتعمل بدون إنترنت. جلسة الدخول محفوظة في كوكي آمن.',
    ]],
    ['خدمات خارجية', [
      'الذكاء الاصطناعي: عند استخدامك ميزة ذكية (مثل إدخال المصاريف بالنص أو تحليل وجبة أو اقتراح خطة)، يُرسل النص الذي تختاره إلى مزوّد الذكاء الاصطناعي (Anthropic) لمعالجته فقط، وبعد موافقتك على البيانات الحساسة.',
      'تسجيل الدخول: عبر Google عند اختيارك ذلك.',
      'مكتبة التمارين: تُحمَّل من خدمة عامة للتمارين دون إرسال بياناتك الشخصية.',
    ]],
    ['الأصدقاء', ['إذا أضفت صديقاً، يرى اسمك وما تختار مشاركته من تقدّمك فقط.']],
    ['حذف بياناتك', ['تستطيع تصدير بياناتك أو حذف حسابك وكل بياناته نهائياً من الإعدادات › البيانات، أو راسلنا وسنحذفها.']],
  ] as Array<[string, string[]]>,
};

const EN = {
  title: 'Privacy Policy',
  updated: 'Last updated: 18 November 2026',
  sections: [
    ['What we collect', [
      'Account data: your name and email. With Google sign-in we receive only your name, email and profile picture.',
      'Content you add: tasks, habits, notes, study, health, expenses and similar entries.',
    ]],
    ['How we use it', ['Only to run the app and sync your data across your devices. We do not sell your data, show ads, or share it for marketing.']],
    ['Storage', ['Data is stored on Cloudflare servers linked to your account, with a copy on your device for offline use. Your session is kept in a secure cookie.']],
    ['Third-party services', [
      'AI features send only the text you choose to an AI provider (Anthropic) for processing, and sensitive data only after you consent.',
      'Google for sign-in, when you choose it.',
      'Exercise library loaded from a public service; no personal data is sent.',
    ]],
    ['Friends', ['Friends you add see your name and only the progress you choose to share.']],
    ['Deleting your data', ['You can export your data or permanently delete your account from Settings › Data, or email us and we will remove it.']],
  ] as Array<[string, string[]]>,
};

const CONTACT = 'agmmf45@gmail.com';

function Block({ t, lang }: { t: typeof AR; lang: 'ar' | 'en' }) {
  return (
    <section lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'} className="card p-5 md:p-7">
      <h2 className="text-[22px] font-black">{t.title}</h2>
      <p className="text-[12px] text-fg-3">{t.updated}</p>
      {t.sections.map(([h, items]) => (
        <div key={h} className="mt-5">
          <h3 className="mb-1.5 font-bold">{h}</h3>
          <ul className="list-disc space-y-1 ps-5 text-[14.5px] leading-relaxed text-fg-2">{items.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      ))}
      <div className="mt-5">
        <h3 className="mb-1.5 font-bold">{lang === 'ar' ? 'التواصل' : 'Contact'}</h3>
        <a className="text-[14.5px] font-bold text-accent" href={`mailto:${CONTACT}`}>{CONTACT}</a>
      </div>
    </section>
  );
}

export function PrivacyOverlay() {
  const [open, close] = usePrivacyOpen();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.documentElement.style.overflow = prev; };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={AR.title} data-section="life" className="anim-in fixed inset-0 z-[90] overflow-y-auto bg-bg">
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-4 md:px-6">
        <div className="sticky top-0 z-10 -mx-4 mb-4 flex items-center gap-3 bg-[color-mix(in_oklab,var(--bg)_92%,transparent)] px-4 py-3 backdrop-blur-md md:-mx-6 md:px-6">
          <span className="grid size-9 place-items-center rounded-full bg-accent text-on-accent"><ShieldCheck size={18} /></span>
          <span className="flex-1 text-lg font-black">دقيق</span>
          <button onClick={close} autoFocus className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-4 text-sm font-bold hover:bg-surface-2">
            رجوع <ArrowRight size={16} className="ltr:rotate-180" />
          </button>
        </div>
        <div className="space-y-4">
          <Block t={AR} lang="ar" />
          <Block t={EN} lang="en" />
        </div>
      </div>
    </div>
  );
}
