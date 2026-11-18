import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useI18n } from '@/core/i18n';
import { updateSettings, useSettings } from '@/core/hooks';

interface Step { target: string; ar: [string, string]; en: [string, string] }

/** The guided tour of the Day page and the Life tabs. Targets are [data-tour] marks in the UI. */
const STEPS: Step[] = [
  { target: 'focus', ar: ['تركيز اليوم', 'جملة وحدة تقول وش أهم شي اليوم. تكتبها الصبح وتشوفها طول اليوم.'], en: ['Today’s focus', 'One line for what matters most today.'] },
  { target: 'log', ar: ['السجل السريع — هنا تكتب كل شي', 'اكتب مثل ما تتكلم: «ذاكر 4 العصر ساعة»، «قهوة 15»، «فكرة: …». تقدر تبدأ بـ • للمهمة، ○ للموعد، – للملاحظة. لما تخلص مهمة اضغط رمزها يصير ×.'], en: ['Rapid log — write everything here', 'Write the way you talk: “study 4pm 1h”, “coffee 15”, “idea: …”. Tap a task’s bullet to mark it ×.'] },
  { target: 'top3', ar: ['أهم 3', 'اضغط ★ جنب أي سطر في السجل عشان يطلع هنا. ثلاثة بس: لو سويتها اليوم يكفي.'], en: ['Top 3', 'Tap ★ next to any line to put it here. Three only.'] },
  { target: 'hours', ar: ['جدول الساعات', 'أي شي كتبته بوقت ينحط هنا لحاله، وتشوف يومك ساعة بساعة.'], en: ['Hours', 'Anything written with a time lands here by itself.'] },
  { target: 'trackers', ar: ['متتبّعات اليوم', 'الماء والوجبات والنوم والمزاج والعادات — ضغطة وحدة لكل شي.'], en: ['Day trackers', 'Water, meals, sleep, mood and habits — one tap each.'] },
  { target: 'shutdown', ar: ['إغلاق اليوم', 'آخر اليوم: اكتب فوز اليوم، رحّل اللي ما خلص لبكرة، واضغط «سكّر اليوم».'], en: ['Close the day', 'Before bed: write today’s win, move what’s left to tomorrow, close the day.'] },
  { target: 'nav-life.week', ar: ['الأسبوع', 'أهم 3 للأسبوع، وقائمة باللي ما له يوم. اكتب «… هالأسبوع» وينحط هناك، وبعدين وزّعه على الأيام.'], en: ['Week', 'The week’s top 3 and a list of things with no day yet. Write “… this week”.'] },
  { target: 'nav-life.month', ar: ['الشهر', 'أهدافك (2–3)، تقويم التواريخ المهمة، ومتتبّع العادات والمزاج. «… هالشهر» ينحط هناك.'], en: ['Month', 'Your 2–3 goals, the dates calendar, habit and mood trackers.'] },
  { target: 'nav-life.notebook', ar: ['الدفتر', 'أفكارك ويومياتك وامتنانك، يوم بيوم — كل اللي تكتبه عشان تتذكره.'], en: ['Notebook', 'Ideas, journal and gratitude, day by day.'] },
  { target: 'quick-add', ar: ['زر +', 'من أي صفحة: اضغطه واكتب أي شي، وأنا أحطه في مكانه. (أو اضغط حرف N)'], en: ['The + button', 'From any page: tap and write anything. (Or press N.)'] },
];

const visible = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
const find = (t: string) => [...document.querySelectorAll(`[data-tour="${t}"]`)].find(visible) ?? null;

export function Tour() {
  const { L } = useI18n();
  const settings = useSettings();
  const loc = useLocation();
  const nav = useNavigate();
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const on = settings.tourPending;

  useEffect(() => { if (on) { setI(0); if (loc.pathname !== '/life/today') nav('/life/today'); } }, [on]); // eslint-disable-line react-hooks/exhaustive-deps

  const end = useCallback(() => { void updateSettings({ tourPending: false }); setRect(null); }, []);
  const next = useCallback(() => setI((k) => (k + 1 >= STEPS.length ? (end(), k) : k + 1)), [end]);
  const back = () => setI((k) => Math.max(0, k - 1));

  // find the step's target (the page may still be loading), bring it into view, and track it
  useLayoutEffect(() => {
    if (!on || loc.pathname !== '/life/today') return;
    let tries = 0; let raf = 0; let timer = 0;
    const measure = () => { const el = find(STEPS[i].target); if (el) setRect(el.getBoundingClientRect()); };
    const look = () => {
      const el = find(STEPS[i].target);
      if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); timer = window.setTimeout(measure, 380); return; }
      if (++tries > 12) { next(); return; } // a step whose part isn't on screen is skipped
      timer = window.setTimeout(look, 180);
    };
    look();
    const onMove = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); window.removeEventListener('scroll', onMove, true); window.removeEventListener('resize', onMove); };
  }, [on, i, loc.pathname, next]);

  useEffect(() => {
    if (!on) return;
    // Enter on a focused button already clicks it — only advance here when focus is elsewhere
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') end(); if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) next(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [on, end, next]);

  if (!on || !rect) return null;
  const s = STEPS[i];
  const [title, body] = L(s.ar[0], s.en[0]) === s.ar[0] ? s.ar : s.en;
  const pad = 8;
  const vw = window.innerWidth; const vh = window.innerHeight;
  const w = Math.min(340, vw - 24);
  const below = rect.bottom + 14 + 190 < vh || rect.top < 220;
  const top = below ? Math.min(rect.bottom + 14, vh - 200) : Math.max(12, rect.top - 14 - 190);
  const left = Math.min(Math.max(12, rect.left + rect.width / 2 - w / 2), vw - w - 12);

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={L('جولة تعريفية', 'Guided tour')}>
      <div className="absolute inset-0" onClick={next} />
      <div className="pointer-events-none absolute rounded-[16px] ring-2 ring-[var(--reward)] transition-all duration-300"
        style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: Math.min(rect.height + pad * 2, vh - 24), boxShadow: '0 0 0 9999px rgb(20 15 10 / 0.58)' }} />
      <div className="anim-in absolute rounded-lg border border-line bg-elevated p-4 shadow-3" style={{ top, left, width: w }}>
        <div className="mb-1 flex items-center gap-2">
          <span className="num rounded-full bg-[color-mix(in_oklab,var(--reward)_40%,var(--surface))] px-2 text-[12px] font-bold">{i + 1}/{STEPS.length}</span>
          <h2 className="nb-title text-[20px] leading-tight">{title}</h2>
        </div>
        <p className="text-[14px] leading-relaxed text-fg-2">{body}</p>
        <div className="mt-3 flex items-center gap-2">
          <button onClick={end} className="text-[13px] font-bold text-fg-3 hover:text-fg">{L('تخطي الجولة', 'Skip tour')}</button>
          <span className="flex-1" />
          {i > 0 && <button onClick={back} className="h-9 rounded-full border border-line px-3.5 text-[13px] font-bold hover:bg-surface-2">{L('رجوع', 'Back')}</button>}
          <button onClick={next} autoFocus className="h-9 rounded-full bg-fg px-4 text-[13px] font-bold text-bg hover:opacity-90">{i + 1 === STEPS.length ? L('خلاص، يلا نبدأ', 'Done — let’s start') : L('التالي', 'Next')}</button>
        </div>
      </div>
    </div>
  );
}
