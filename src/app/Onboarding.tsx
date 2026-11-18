import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import clsx from 'clsx';
import { useI18n } from '@/core/i18n';
import { updateSettings, useProfile } from '@/core/hooks';
import { upsert } from '@/core/repo';
import { useAuth } from '@/core/auth';
import { Button, Input, Segmented } from '@/design/ui';
import { PRESETS } from './registry';
import { Brand } from './Splash';

/** First launch: three light steps, everything skippable and changeable later in Settings. */
export function Onboarding() {
  const { L, lang } = useI18n();
  const { user, migration } = useAuth();
  const profile = useProfile();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile.display_name ?? user?.name ?? '');
  const [preset, setPreset] = useState<string>(migration && migration.total > 0 ? 'complete' : 'productivity');
  const [language, setLanguage] = useState<'ar' | 'en'>(lang);
  const [busy, setBusy] = useState(false);
  const touched = useRef(false);
  // the migrated v4 display name loads asynchronously — use it unless the user already typed
  useEffect(() => { if (!touched.current && profile.display_name) setName(profile.display_name); }, [profile.display_name]);

  const finish = async (usePreset: boolean) => {
    setBusy(true);
    if (name.trim() && name.trim() !== profile.display_name) await upsert('profile', 'profile', { display_name: name.trim() });
    await updateSettings({ onboarded: true, language, modulePreset: usePreset ? preset : null });
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 py-10">
      <Brand size={36} />
      <div className="mt-2 flex gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => <span key={i} className={clsx('h-1 flex-1 rounded-full', i <= step ? 'bg-life' : 'bg-surface-2')} />)}
      </div>

      {step === 0 && (
        <section className="anim-in mt-10 space-y-5">
          <h1 className="text-2xl font-black">{L('أهلاً بك في دقيق الجديد', 'Welcome to the new Daqeeq')}</h1>
          {migration && migration.total > 0 && (
            <p className="rounded-md border border-line bg-surface p-3 text-sm">
              {L(`نقلنا ${migration.total} عنصر من بياناتك السابقة. كل شي في مكانه.`, `We moved ${migration.total} items from your previous data. Everything is in place.`)}
            </p>
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
          <h1 className="text-2xl font-black">{L('كيف تبي تستخدم دقيق؟', 'How will you use Daqeeq?')}</h1>
          <p className="mt-1 text-sm text-fg-2">{L('نختار لك الوحدات المناسبة. تقدر تغيّرها أي وقت.', 'We pick matching modules. Change them any time.')}</p>
          <div className="mt-5 grid gap-2">
            {Object.entries(PRESETS).map(([id, p]) => (
              <button
                key={id}
                onClick={() => setPreset(id)}
                aria-pressed={preset === id}
                className={clsx('flex items-center gap-3 rounded-md border p-4 text-start transition-colors', preset === id ? 'border-life bg-[color-mix(in_oklab,var(--life)_38%,transparent)]' : 'border-line bg-surface hover:border-line-strong')}
              >
                <span className="flex-1">
                  <span className="block font-bold">{L(p.ar, p.en)}</span>
                  <span className="block text-[13px] text-fg-2">{p.on.length} {L('وحدة', 'modules')}</span>
                </span>
                {preset === id && <Check size={18} className="text-life" />}
              </button>
            ))}
          </div>
          <div className="mt-6 flex gap-2">
            <Button variant="ghost" onClick={() => setStep(0)}>{L('رجوع', 'Back')}</Button>
            <Button variant="primary" size="lg" className="flex-1" onClick={() => setStep(2)}>{L('التالي', 'Next')}</Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="anim-in mt-10 space-y-4">
          <h1 className="text-2xl font-black">{L('جاهز.', 'All set.')}</h1>
          <ul className="space-y-2 text-sm text-fg-2">
            <li>• {L('زر + (أو حرف N) يضيف أي شي بسرعة: مهمة، فكرة، مصروف، ماء…', 'The + button (or N) captures anything: task, idea, expense, water…')}</li>
            <li>• {L('Ctrl + K يفتح البحث والأوامر.', 'Ctrl + K opens search & commands.')}</li>
            <li>• {L('كل الوحدات والتنبيهات والنقاط قابلة للتخصيص من الإعدادات.', 'Every module, reminder and reward is configurable in Settings.')}</li>
          </ul>
          <Button variant="primary" size="lg" className="w-full" loading={busy} onClick={() => finish(true)}>{L('ابدأ', 'Start')}</Button>
          <button className="w-full text-center text-[13px] text-fg-3" onClick={() => finish(false)}>{L('تخطَّ واستخدم الإعدادات الافتراضية', 'Skip and use defaults')}</button>
        </section>
      )}
    </div>
  );
}
