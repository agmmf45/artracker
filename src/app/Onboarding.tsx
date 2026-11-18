import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import clsx from 'clsx';
import { useI18n } from '@/core/i18n';
import { updateSettings, useProfile, useSettings } from '@/core/hooks';
import { upsert } from '@/core/repo';
import { useAuth } from '@/core/auth';
import { parseCapture, type CaptureKind, type Parsed } from '@/core/capture/parse';
import { saveCapture } from '@/modules/shared/captureSave';
import { Button, Input, Segmented } from '@/design/ui';
import { Brand } from './Splash';

/** What the user wants help with → which tool pages are on. Day/Week/Month/Notebook are always on. */
const FOCUS: Array<{ id: string; icon: string; ar: string; en: string; arHint: string; enHint: string; pages: string[] }> = [
  { id: 'plan', icon: '✅', ar: 'تنظيم يومي ومهام', en: 'Daily planning & tasks', arHint: 'مهام، مواعيد، أهداف', enHint: 'tasks, events, goals', pages: ['life.tasks', 'life.calendar', 'life.planner', 'life.goals', 'life.projects', 'life.inbox'] },
  { id: 'study', icon: '📚', ar: 'الدراسة', en: 'Study', arHint: 'مواد، محاضرات، اختبارات، مذاكرة', enHint: 'courses, lectures, exams, focus', pages: ['study.courses', 'study.schedule', 'study.lectures', 'study.assignments', 'study.exams', 'study.planner', 'study.focus', 'study.flashcards', 'study.grades'] },
  { id: 'health', icon: '💪', ar: 'الصحة والتمارين', en: 'Health & training', arHint: 'تمارين، أكل، ماء، نوم، وزن', enHint: 'workouts, food, water, sleep', pages: ['health.workouts', 'health.nutrition', 'health.water', 'health.sleep', 'health.weight'] },
  { id: 'habits', icon: '🌱', ar: 'العادات', en: 'Habits', arHint: 'عادات يومية وسلاسل', enHint: 'daily habits and streaks', pages: ['life.habits', 'life.achievements'] },
  { id: 'money', icon: '💸', ar: 'المصاريف', en: 'Spending', arHint: 'مصروف اليوم، ميزانية، اشتراكات', enHint: 'daily spend, budget, subscriptions', pages: ['life.finance', 'life.subscriptions'] },
  { id: 'journal', icon: '✍️', ar: 'اليوميات والأفكار', en: 'Journal & ideas', arHint: 'يوميات، ملاحظات، مراجعات', enHint: 'journal, notes, reviews', pages: ['life.journal', 'life.notes', 'life.reviews'] },
];

/** Starter lines per focus — tapping one fills the box so the user sees how writing works. */
const STARTERS: Record<string, Array<[string, string]>> = {
  plan: [['اتصل على أبوي بكرة 5 العصر', 'call dad tomorrow 5pm'], ['جدّد الهوية هالأسبوع', 'renew my ID this week']],
  study: [['ذاكر الفصل 3 بكرة 7 المغرب', 'study chapter 3 tomorrow 7pm'], ['موعد اختبار الأحد 9 الصبح', 'exam appointment Sunday 9am']],
  health: [['تمرين أرجل بكرة 6 المغرب', 'leg workout tomorrow 6pm'], ['كوبين ماء', '2 glasses water']],
  habits: [['أقرأ 10 صفحات اليوم', 'read 10 pages today']],
  money: [['قهوة 15', 'coffee 15']],
  journal: [['فكرة: أرتب مذاكرتي بالساعات', 'idea: plan study in hour blocks']],
};

const kindFor = (p: Parsed): CaptureKind => (p.kind === 'inbox' ? 'note' : p.kind);

/** Where a written line ends up, said in the user's words. */
function placeOf(p: Parsed, L: (a: string, e: string) => string): string {
  if (p.scope === 'week' || p.scope === 'next_week') return L('قائمة الأسبوع', 'the week list');
  if (p.scope) return L('مهام الشهر', 'the month list');
  const k = kindFor(p);
  if (k === 'note' || k === 'journal') return L('الدفتر', 'the Notebook');
  if (k === 'water') return L('الماء في صفحة اليوم', 'water on the Day page');
  if (k === 'expense' || k === 'income') return L('«صرفت اليوم» في صفحة اليوم', '“spent today” on the Day page');
  return p.date ? L(`صفحة يوم ${p.date.slice(8)}`, `the Day page of the ${p.date.slice(8)}`) : L('صفحة اليوم', 'the Day page');
}

/**
 * First launch, four light steps: name & language → what you want help with → write your first
 * lines (with suggestions, each showing where it went) → offer the guided tour. All skippable.
 */
export function Onboarding() {
  const { L, lang } = useI18n();
  const settings = useSettings();
  const { user, migration } = useAuth();
  const profile = useProfile();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile.display_name ?? user?.name ?? '');
  const [language, setLanguage] = useState<'ar' | 'en'>(lang);
  const [focus, setFocus] = useState<string[]>(migration && migration.total > 0 ? FOCUS.map((f) => f.id) : ['plan', 'habits']);
  const [text, setText] = useState('');
  const [written, setWritten] = useState<Array<{ text: string; place: string }>>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const touched = useRef(false);
  useEffect(() => { if (!touched.current && profile.display_name) setName(profile.display_name); }, [profile.display_name]);

  const toggle = (id: string) => setFocus((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
  const starters = focus.flatMap((f) => STARTERS[f] ?? []).slice(0, 6);
  const parsed = text.trim() ? parseCapture(text) : null;

  const write = async () => {
    if (!parsed) return;
    setErr('');
    try {
      await saveCapture(kindFor(parsed), text.trim(), parsed, settings);
      setWritten((w) => [...w, { text: text.trim(), place: placeOf(parsed, L) }]);
      setText('');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };

  const finish = async (tour: boolean) => {
    setBusy(true);
    if (name.trim() && name.trim() !== profile.display_name) await upsert('profile', 'profile', { display_name: name.trim() });
    const modules: Record<string, boolean> = {};
    for (const f of FOCUS) for (const p of f.pages) modules[p] = focus.includes(f.id) || modules[p] === true;
    await updateSettings({ onboarded: true, language, modulePreset: null, modules, tourPending: tour });
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 py-10">
      <Brand size={36} />
      <div className="mt-2 flex gap-1.5" aria-hidden>
        {[0, 1, 2, 3].map((i) => <span key={i} className={clsx('h-1 flex-1 rounded-full', i <= step ? 'bg-life' : 'bg-surface-2')} />)}
      </div>

      {step === 0 && (
        <section className="anim-in mt-10 space-y-5">
          <h1 className="nb-title text-3xl">{L('أهلاً بك في دقيق', 'Welcome to Daqeeq')}</h1>
          <p className="text-[15px] text-fg-2">{L('دفترك اليومي: تكتب سطر، ودقيق يحطه في مكانه — يومك، أسبوعك، أو شهرك.', 'Your daily notebook: write a line and Daqeeq puts it in its place — your day, week or month.')}</p>
          {migration && migration.total > 0 && (
            <p className="rounded-md border border-line bg-surface p-3 text-sm">{L(`نقلنا ${migration.total} عنصر من بياناتك السابقة. كل شي في مكانه.`, `We moved ${migration.total} items from your previous data. Everything is in place.`)}</p>
          )}
          <Input label={L('وش نناديك؟', 'What should we call you?')} value={name} onChange={(e) => { touched.current = true; setName(e.target.value); }} />
          <div>
            <div className="mb-1.5 text-[13px] font-bold text-fg-2">{L('اللغة', 'Language')}</div>
            <Segmented value={language} onChange={setLanguage} options={[{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }]} />
          </div>
          <Button variant="primary" size="lg" className="w-full" onClick={() => setStep(1)}>{L('التالي', 'Next')}</Button>
        </section>
      )}

      {step === 1 && (
        <section className="anim-in mt-10">
          <h1 className="nb-title text-3xl">{L('وش تبي دقيق يساعدك فيه؟', 'What should Daqeeq help with?')}</h1>
          <p className="mt-1 text-sm text-fg-2">{L('اختر اللي يهمك. اليوم والأسبوع والشهر والدفتر موجودة دائماً، والباقي تقدر تفتحه بعدين من الإعدادات.', 'Pick what matters. Day, Week, Month and Notebook are always there; turn on more later in Settings.')}</p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            {FOCUS.map((f) => {
              const on = focus.includes(f.id);
              return (
                <button key={f.id} onClick={() => toggle(f.id)} aria-pressed={on}
                  className={clsx('relative rounded-md border-[1.5px] p-3.5 text-start transition-colors', on ? 'border-life-ink bg-[color-mix(in_oklab,var(--life)_30%,var(--surface))]' : 'border-line bg-surface hover:border-line-strong')}>
                  <span className="text-2xl">{f.icon}</span>
                  <span className="mt-1 block font-bold">{L(f.ar, f.en)}</span>
                  <span className="block text-[12.5px] text-fg-2">{L(f.arHint, f.enHint)}</span>
                  {on && <Check size={17} className="absolute end-3 top-3 text-life-ink" />}
                </button>
              );
            })}
          </div>
          <div className="mt-6 flex gap-2">
            <Button variant="ghost" onClick={() => setStep(0)}>{L('رجوع', 'Back')}</Button>
            <Button variant="primary" size="lg" className="flex-1" onClick={() => setStep(2)}>{L('التالي', 'Next')}</Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="anim-in mt-10">
          <h1 className="nb-title text-3xl">{L('اكتب أول أشيائك', 'Write your first things')}</h1>
          <p className="mt-1 text-sm text-fg-2">{L('اكتب مثل ما تتكلم. اذكر اليوم والوقت لو فيه، وأنا أفهم: «بكرة 7 المغرب»، «هالأسبوع»، «قهوة 15».', 'Write the way you talk. Mention a day or time and I’ll get it: “tomorrow 7pm”, “this week”, “coffee 15”.')}</p>
          <div className="nb-paper paper-lines mt-4 rounded-md p-4">
            <form onSubmit={(e) => { e.preventDefault(); void write(); }} className="flex items-center gap-2 rounded-full border-[1.5px] border-line bg-surface px-3">
              <span className="font-bold">•</span>
              <input value={text} onChange={(e) => setText(e.target.value)} aria-label={L('اكتب سطر', 'Write a line')} placeholder={L('مثلاً: ذاكر الفصل 3 بكرة 7 المغرب', 'e.g. study chapter 3 tomorrow 7pm')}
                className="h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none" />
              <button type="submit" disabled={!parsed} className="h-8 rounded-full bg-fg px-4 text-[13px] font-bold text-bg disabled:opacity-40">{L('دوّن', 'Add')}</button>
            </form>
            {parsed && <p className="mt-2 text-[13px] text-fg-2">{L('بينحط في:', 'Goes to:')} <b className="text-fg">{placeOf(parsed, L)}</b>{parsed.time ? ` · ${parsed.time}` : ''}</p>}
            {err && <p className="mt-2 text-[13px] text-danger">{err}</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {starters.map(([ar, en]) => (
                <button key={ar} onClick={() => setText(L(ar, en))} className="rounded-full border-[1.5px] border-dashed border-line-strong bg-surface px-3 py-1.5 text-[13px] hover:border-solid">{L(ar, en)}</button>
              ))}
            </div>
            {written.length > 0 && (
              <ul className="mt-4 space-y-1.5 border-t border-dashed border-line pt-3">
                {written.map((w, i) => (
                  <li key={i} className="flex items-baseline gap-2 text-[14px]"><Check size={14} className="shrink-0 text-success" /><span className="flex-1">{w.text}</span><span className="text-[12.5px] text-fg-2">← {w.place}</span></li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-6 flex gap-2">
            <Button variant="ghost" onClick={() => setStep(1)}>{L('رجوع', 'Back')}</Button>
            <Button variant="primary" size="lg" className="flex-1" onClick={() => setStep(3)}>{written.length ? L('التالي', 'Next') : L('بكتب بعدين', 'I’ll write later')}</Button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="anim-in mt-10 space-y-4">
          <h1 className="nb-title text-3xl">{L('جاهز!', 'All set!')}</h1>
          <p className="text-[15px] text-fg-2">{L('كيف يمشي دقيق، باختصار:', 'How Daqeeq works, in short:')}</p>
          <ul className="space-y-2.5 text-[14.5px]">
            <li className="flex gap-2.5"><span>☀</span><span><b>{L('اليوم', 'Day')}</b> — {L('أهم 3، سجل اليوم، الساعات، والماء والأكل والنوم.', 'top 3, the day’s log, hours, water, food and sleep.')}</span></li>
            <li className="flex gap-2.5"><span>▦</span><span><b>{L('الأسبوع', 'Week')}</b> — {L('أولويات الأسبوع، واللي ما له يوم بعد.', 'the week’s priorities and things with no day yet.')}</span></li>
            <li className="flex gap-2.5"><span>◆</span><span><b>{L('الشهر', 'Month')}</b> — {L('أهدافك، تقويم التواريخ، والمتتبعات.', 'your goals, the dates calendar and trackers.')}</span></li>
            <li className="flex gap-2.5"><span>✎</span><span><b>{L('الدفتر', 'Notebook')}</b> — {L('أفكارك ويومياتك، يوم بيوم.', 'ideas and journal, day by day.')}</span></li>
            <li className="flex gap-2.5"><span>＋</span><span>{L('زر + يضيف أي شي من أي مكان.', 'The + button adds anything from anywhere.')}</span></li>
          </ul>
          <Button variant="primary" size="lg" className="w-full" loading={busy} onClick={() => finish(true)}>{L('خذني جولة سريعة (دقيقة)', 'Give me a quick tour (1 min)')}</Button>
          <button className="w-full text-center text-[13px] text-fg-3" onClick={() => finish(false)}>{L('بدون جولة، ابدأ على طول', 'Skip the tour')}</button>
        </section>
      )}
    </div>
  );
}
