import { useEffect, useState } from 'react';
import { CheckCircle2, CircleDashed, CircleSlash, MapPin } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { api } from '@/core/api';
import { updateSettings, useSettings } from '@/core/hooks';
import { toast } from '@/core/toast';
import { Button, Card, Input, PageHeader, Select } from '@/design/ui';

type State = 'on' | 'off' | 'planned' | 'blocked';

function Row({ name, desc, state, children }: { name: string; desc: string; state: State; children?: React.ReactNode }) {
  const { L } = useI18n();
  const badge = {
    on: { icon: <CheckCircle2 size={15} />, text: L('يعمل', 'Working'), cls: 'text-success' },
    off: { icon: <CircleSlash size={15} />, text: L('غير مفعّل على الخادم', 'Not configured on server'), cls: 'text-fg-3' },
    planned: { icon: <CircleDashed size={15} />, text: L('مخطط له', 'Planned'), cls: 'text-fg-3' },
    blocked: { icon: <CircleDashed size={15} />, text: L('بانتظار متطلب', 'Blocked'), cls: 'text-warning' },
  }[state];
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1"><div className="font-bold">{name}</div><p className="text-[13px] text-fg-2">{desc}</p></div>
        <span className={`inline-flex shrink-0 items-center gap-1 text-[12px] font-bold ${badge.cls}`}>{badge.icon}{badge.text}</span>
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

export default function Integrations() {
  const { L } = useI18n();
  const s = useSettings();
  const [ai, setAi] = useState<boolean | null>(null);
  const [files, setFiles] = useState<boolean | null>(null);
  const [exdb, setExdb] = useState<boolean | null>(null);
  useEffect(() => {
    api<{ available: boolean }>('/ai/status').then((r) => setAi(r.available)).catch(() => setAi(false));
    api<{ available: boolean }>('/v2/files/status').then((r) => setFiles(r.available)).catch(() => setFiles(false));
    api<{ available: boolean }>('/exercises?target=biceps&limit=1').then((r) => setExdb(r.available)).catch(() => setExdb(false));
  }, []);

  const locate = () => {
    if (!navigator.geolocation) { toast(L('الموقع غير مدعوم', 'Location not supported'), { tone: 'error' }); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => { void updateSettings({ prayer: { lat: Math.round(p.coords.latitude * 1000) / 1000, lng: Math.round(p.coords.longitude * 1000) / 1000 } }); toast(L('حُفظ الموقع على حسابك فقط', 'Location saved to your account only')); },
      () => toast(L('ما سمحت بالوصول للموقع', 'Location permission denied'), { tone: 'error' }),
    );
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title={L('التكاملات', 'Integrations')} subtitle={L('كل تكامل اختياري. ما نعرض تكاملاً كأنه يعمل وهو لا يعمل.', 'Every integration is optional. Nothing is shown as working unless it is.')} />
      <Card className="divide-y divide-line">
        <Row name={L('أوقات الصلاة', 'Prayer times')} desc={L('تُحسب محلياً بطريقة أم القرى أو غيرها، بدون إرسال موقعك لأي جهة.', 'Calculated locally (Umm al-Qura or others); your location is never sent to third parties.')} state={s.prayer.lat != null ? 'on' : 'off'}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Input type="number" step={0.001} label={L('خط العرض', 'Latitude')} value={s.prayer.lat ?? ''} onChange={(e) => updateSettings({ prayer: { lat: e.target.value ? Number(e.target.value) : null } })} />
            <Input type="number" step={0.001} label={L('خط الطول', 'Longitude')} value={s.prayer.lng ?? ''} onChange={(e) => updateSettings({ prayer: { lng: e.target.value ? Number(e.target.value) : null } })} />
            <Select label={L('الطريقة', 'Method')} value={s.prayer.method} onChange={(e) => updateSettings({ prayer: { method: e.target.value as 'mwl' } })}>
              <option value="umm_al_qura">{L('أم القرى', 'Umm al-Qura')}</option><option value="mwl">MWL</option><option value="isna">ISNA</option><option value="egypt">{L('الهيئة المصرية', 'Egyptian')}</option>
            </Select>
            <div className="flex items-end"><Button icon={<MapPin size={15} />} onClick={locate}>{L('موقعي', 'Locate')}</Button></div>
          </div>
        </Row>
        <Row name={L('استيراد/تصدير التقويم (ICS)', 'Calendar import/export (ICS)')} desc={L('من صفحة التقويم: استورد ملف .ics أو صدّر مواعيدك.', 'From the Calendar page: import an .ics file or export your events.')} state="on" />
        <Row name={L('المساعد الذكي', 'AI assistant')} desc={L('يحتاج مفتاح Anthropic على الخادم. التطبيق يعمل كاملاً بدونه.', 'Needs an Anthropic key on the server. The app works fully without it.')} state={ai === null ? 'planned' : ai ? 'on' : 'off'} />
        <Row name={L('تخزين الملفات والصور', 'File & photo storage')} desc={L('مرفقات خاصة (صور الوجبات، صور التقدم، ملفات). يحتاج R2 على Cloudflare.', 'Private attachments (meal & progress photos, files). Needs Cloudflare R2.')} state={files === null ? 'planned' : files ? 'on' : 'off'} />
        <Row name={L('مكتبة التمارين (ExerciseDB)', 'Exercise library (ExerciseDB)')} desc={L('صور وشرح للتمارين حسب العضلة.', 'Exercise images and instructions by muscle.')} state={exdb === null ? 'planned' : exdb ? 'on' : 'off'} />
        <Row name="Google Calendar" desc={L('مزامنة ثنائية الاتجاه تحتاج إعداد OAuth جديد في Google Cloud. حالياً استخدم ICS.', 'Two-way sync needs a new Google Cloud OAuth setup. Use ICS for now.')} state="blocked" />
        <Row name={L('Apple Health / Health Connect', 'Apple Health / Health Connect')} desc={L('يتطلب تطبيق جوال أصلي (Capacitor). كود الربط محفوظ في legacy/health-sync.', 'Requires the native mobile app (Capacitor). Integration code is kept in legacy/health-sync.')} state="blocked" />
      </Card>
    </div>
  );
}
