import { useEffect, useState } from 'react';
import { Laptop, Smartphone } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { api } from '@/core/api';
import { useAuth } from '@/core/auth';
import { toast } from '@/core/toast';
import { Button, Card, Input, PageHeader, Section } from '@/design/ui';

interface Sess { id: string; created_at: string; last_seen_at: string | null; user_agent: string | null; current: boolean }

export default function Security() {
  const { L } = useI18n();
  const { user, refreshUser } = useAuth();
  const [sessions, setSessions] = useState<Sess[] | null>(null);
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api<{ sessions: Sess[] }>('/auth/sessions').then((r) => setSessions(r.sessions)).catch(() => setSessions([]));
  useEffect(() => { void load(); }, []);

  const change = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/auth/change-password', { current: cur, next });
      toast(L('تم تغيير كلمة السر وتسجيل خروج الأجهزة الأخرى', 'Password changed; other devices signed out'));
      setCur(''); setNext('');
      await refreshUser(); await load();
    } catch (err) { toast((err as Error).message, { tone: 'error' }); } finally { setBusy(false); }
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title={L('الأمان', 'Security')} subtitle={user?.email} />
      <Section title={user?.has_password ? L('تغيير كلمة السر', 'Change password') : L('إضافة كلمة سر', 'Add a password')}>
        <Card className="p-4">
          <form onSubmit={change} className="grid gap-3 sm:grid-cols-2">
            {user?.has_password && <Input type="password" dir="ltr" autoComplete="current-password" label={L('الحالية', 'Current')} value={cur} onChange={(e) => setCur(e.target.value)} required />}
            <Input type="password" dir="ltr" autoComplete="new-password" label={L('الجديدة (8+ أحرف)', 'New (8+ chars)')} value={next} onChange={(e) => setNext(e.target.value)} minLength={8} required />
            <div className="sm:col-span-2"><Button type="submit" variant="primary" loading={busy}>{L('حفظ', 'Save')}</Button></div>
          </form>
          {!user?.has_password && <p className="mt-2 text-[12px] text-fg-3">{L('حسابك مرتبط بـ Google. لإضافة كلمة سر سجّل دخولك من جديد خلال آخر 15 دقيقة.', 'Your account uses Google. To add a password, sign in again within the last 15 minutes.')}</p>}
        </Card>
      </Section>
      <Section title={L('الأجهزة المسجّلة', 'Signed-in devices')} action={<Button size="sm" variant="ghost" onClick={async () => { await api('/auth/sessions/revoke', { all_others: true }); await load(); toast(L('تم تسجيل خروج الأجهزة الأخرى', 'Other devices signed out')); }}>{L('اخرج من الكل عدا هذا', 'Sign out all others')}</Button>}>
        <Card className="divide-y divide-line">
          {sessions === null ? <div className="skeleton m-4 h-10" /> : sessions.map((s) => {
            const mobile = /mobile|iphone|android/i.test(s.user_agent ?? '');
            return (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                {mobile ? <Smartphone size={18} className="text-fg-3" /> : <Laptop size={18} className="text-fg-3" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{(s.user_agent ?? L('جهاز غير معروف', 'Unknown device')).replace(/\(.*?\)/g, '').slice(0, 60)}</div>
                  <div className="text-[12px] text-fg-3">{L('آخر نشاط', 'Last active')} {new Date(s.last_seen_at ?? s.created_at).toLocaleString()}</div>
                </div>
                {s.current ? <span className="text-[12px] font-bold text-success">{L('هذا الجهاز', 'This device')}</span>
                  : <Button size="sm" variant="ghost" onClick={async () => { await api('/auth/sessions/revoke', { id: s.id }); await load(); }}>{L('إخراج', 'Revoke')}</Button>}
              </div>
            );
          })}
        </Card>
      </Section>
      <p className="text-[12px] text-fg-3">{L('الجلسات تنتهي تلقائياً بعد 60 يوماً بدون استخدام، وتُحفظ في كوكي محمية (HttpOnly).', 'Sessions expire after 60 days of inactivity and live in a protected HttpOnly cookie.')}</p>
    </div>
  );
}
