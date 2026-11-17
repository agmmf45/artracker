import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Languages } from 'lucide-react';
import { useAuth } from '@/core/auth';
import { useI18n } from '@/core/i18n';
import { GOOGLE_CLIENT_ID } from '@/core/config';
import { Button, Input } from '@/design/ui';
import { toast } from '@/core/toast';
import { applyPrefs, readPrefs } from './prefs';
import { Brand } from './Splash';

declare global {
  interface Window {
    google?: { accounts: { id: { initialize: (o: object) => void; renderButton: (el: HTMLElement, o: object) => void } } };
  }
}

function loadGis(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('gis'));
    document.head.appendChild(s);
  });
}

export function AuthScreen() {
  const { login, signup, google } = useAuth();
  const { L, lang } = useI18n();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gBtn = useRef<HTMLDivElement>(null);
  const [gisFailed, setGisFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    loadGis()
      .then(() => {
        if (!alive || !gBtn.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (r: { credential: string }) => {
            setBusy(true);
            try { await google(r.credential); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
          },
          auto_select: false,
          ux_mode: 'popup',
        });
        window.google.accounts.id.renderButton(gBtn.current, { theme: 'outline', size: 'large', shape: 'rectangular', width: 320, text: 'continue_with', locale: lang });
      })
      .catch(() => setGisFailed(true));
    return () => { alive = false; };
  }, [google, lang]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') await login(email.trim(), password);
      else await signup(email.trim(), password, name.trim());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleLang = () => {
    const p = readPrefs();
    applyPrefs({ ...p, language: p.language === 'ar' ? 'en' : 'ar' });
    location.reload();
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex justify-end p-4">
        <Button variant="ghost" size="sm" icon={<Languages size={16} />} onClick={toggleLang}>{lang === 'ar' ? 'English' : 'العربية'}</Button>
      </div>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 pb-16">
        <Brand size={52} />
        <h1 className="mt-5 text-2xl font-black leading-snug">{L('حياتك، مرتّبة بهدوء.', 'Your life, beautifully organized.')}</h1>
        <p className="mt-2 text-fg-2">{L('مهامك وعاداتك ودراستك وصحتك ومصاريفك — في مكان واحد.', 'Tasks, habits, study, health and money — in one calm place.')}</p>

        <div className="mt-8 min-h-11" ref={gBtn} aria-label={L('الدخول عبر Google', 'Continue with Google')} />
        {gisFailed && <p className="text-[13px] text-fg-3">{L('تعذر تحميل زر Google، استخدم الإيميل.', 'Google sign-in failed to load — use email.')}</p>}

        <div className="my-6 flex items-center gap-3 text-[12px] text-fg-3"><span className="h-px flex-1 bg-line" />{L('أو بالإيميل', 'or with email')}<span className="h-px flex-1 bg-line" /></div>

        <form onSubmit={submit} className="space-y-3" noValidate>
          {mode === 'signup' && (
            <Input label={L('اسمك', 'Your name')} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          )}
          <Input label={L('الإيميل', 'Email')} type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          <div className="relative">
            <Input
              label={L('كلمة السر', 'Password')}
              hint={mode === 'signup' ? L('(8 أحرف على الأقل)', '(8+ characters)') : undefined}
              type={show ? 'text' : 'password'}
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
            <button type="button" className="absolute bottom-2.5 end-3 text-fg-3 hover:text-fg" aria-label={show ? L('إخفاء', 'Hide') : L('إظهار', 'Show')} onClick={() => setShow(!show)}>
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {error && <p role="alert" className="rounded-sm bg-[color-mix(in_oklab,var(--danger)_12%,transparent)] px-3 py-2 text-sm text-danger">{error}</p>}
          <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>
            {mode === 'login' ? L('دخول', 'Sign in') : L('إنشاء حساب', 'Create account')}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-fg-2">
          {mode === 'login' ? L('ما عندك حساب؟', 'New here?') : L('عندك حساب؟', 'Have an account?')}{' '}
          <button className="font-bold text-life" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}>
            {mode === 'login' ? L('أنشئ حساب', 'Create one') : L('سجّل دخول', 'Sign in')}
          </button>
        </p>
        {mode === 'login' && (
          <button className="mt-2 text-center text-[13px] text-fg-3 hover:text-fg-2" onClick={() => toast(L('تواصل مع الدعم لاستعادة كلمة السر، أو ادخل عبر Google إذا كان نفس الإيميل.', 'Contact support to reset, or use Google with the same email.'))}>
            {L('نسيت كلمة السر؟', 'Forgot password?')}
          </button>
        )}
      </main>
    </div>
  );
}
