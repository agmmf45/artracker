import { useI18n } from '@/core/i18n';
import { updateSettings, useSettings } from '@/core/hooks';
import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button, Card, Input, PageHeader, Select, Switch } from '@/design/ui';

function InstallCard() {
  const { L } = useI18n();
  const [prompted, setPrompted] = useState(false);
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone;
  const ev = (window as unknown as { __dqInstall?: { prompt: () => Promise<void> } }).__dqInstall;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (standalone) return null;
  return (
    <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
      <Download size={20} className="text-life" />
      <div className="min-w-0 flex-1"><div className="font-bold">{L('ثبّت دقيق على جهازك', 'Install Daqeeq on your device')}</div><div className="text-[13px] text-fg-2">{ios ? L('في Safari: زر المشاركة ← «إضافة إلى الشاشة الرئيسية».', 'In Safari: Share → “Add to Home Screen”.') : L('يفتح كتطبيق مستقل ويعمل بدون إنترنت.', 'Opens as its own app and works offline.')}</div></div>
      {ev && !prompted && <Button variant="primary" onClick={async () => { setPrompted(true); await ev.prompt(); }}>{L('تثبيت', 'Install')}</Button>}
    </Card>
  );
}

const ZONES = ['Asia/Riyadh', 'Asia/Dubai', 'Asia/Kuwait', 'Asia/Qatar', 'Asia/Bahrain', 'Africa/Cairo', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'Asia/Kuala_Lumpur'];

export default function General() {
  const { L } = useI18n();
  const s = useSettings();
  const zones = ZONES.includes(s.timezone) ? ZONES : [s.timezone, ...ZONES];
  return (
    <div className="max-w-2xl">
      <PageHeader title={L('عام', 'General')} />
      <InstallCard />
      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <Select label={L('اللغة', 'Language')} value={s.language} onChange={(e) => updateSettings({ language: e.target.value as 'ar' | 'en' })}>
          <option value="ar">العربية</option><option value="en">English</option>
        </Select>
        <Select label={L('المنطقة الزمنية', 'Time zone')} value={s.timezone} onChange={(e) => updateSettings({ timezone: e.target.value })}>
          {zones.map((z) => <option key={z} value={z}>{z}</option>)}
        </Select>
        <Select label={L('بداية الأسبوع', 'Week starts on')} value={String(s.weekStart)} onChange={(e) => updateSettings({ weekStart: Number(e.target.value) as 0 | 1 | 6 })}>
          <option value="6">{L('السبت', 'Saturday')}</option><option value="0">{L('الأحد', 'Sunday')}</option><option value="1">{L('الإثنين', 'Monday')}</option>
        </Select>
        <Select label={L('صيغة الوقت', 'Time format')} value={s.timeFormat} onChange={(e) => updateSettings({ timeFormat: e.target.value as '12' | '24' })}>
          <option value="12">{L('12 ساعة', '12-hour')}</option><option value="24">{L('24 ساعة', '24-hour')}</option>
        </Select>
        <Select label={L('التقويم المعروض', 'Calendar shown')} value={s.calendarDisplay} onChange={(e) => updateSettings({ calendarDisplay: e.target.value as 'both' })}>
          <option value="both">{L('ميلادي + هجري', 'Gregorian + Hijri')}</option><option value="gregorian">{L('ميلادي', 'Gregorian')}</option><option value="hijri">{L('هجري', 'Hijri')}</option>
        </Select>
        <Select label={L('العملة', 'Currency')} value={s.currency} onChange={(e) => updateSettings({ currency: e.target.value, finance: { currency: e.target.value } })}>
          {['SAR', 'AED', 'KWD', 'QAR', 'BHD', 'OMR', 'EGP', 'USD', 'EUR', 'GBP'].map((c) => <option key={c}>{c}</option>)}
        </Select>
        <Select label={L('الوحدات', 'Units')} value={s.units} onChange={(e) => updateSettings({ units: e.target.value as 'metric' | 'imperial' })}>
          <option value="metric">{L('متري (كجم، سم)', 'Metric (kg, cm)')}</option><option value="imperial">{L('إمبراطوري (lb, in)', 'Imperial (lb, in)')}</option>
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Input type="time" label={L('يبدأ يومي', 'Day starts')} value={s.dayStart} onChange={(e) => updateSettings({ dayStart: e.target.value })} />
          <Input type="time" label={L('ينتهي يومي', 'Day ends')} value={s.dayEnd} onChange={(e) => updateSettings({ dayEnd: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <Switch checked={s.encouragement} onChange={(v) => updateSettings({ encouragement: v })} label={L('رسائل تشجيعية', 'Encouraging messages')} hint={L('جملة قصيرة متغيرة في الصفحة الرئيسية.', 'A short rotating line on the overview.')} />
          <Switch checked={s.prayer.enabled} onChange={(v) => updateSettings({ prayer: { enabled: v } })} label={L('أوقات الصلاة في التقويم', 'Prayer times in calendar')} hint={L('تُحسب على جهازك من موقعك (حسب إعداد التكاملات).', 'Calculated on your device from your location (see Integrations).')} />
        </div>
      </Card>
    </div>
  );
}
