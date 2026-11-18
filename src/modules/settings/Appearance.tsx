import clsx from 'clsx';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { updateSettings, useSettings } from '@/core/hooks';
import { Card, PageHeader, Segmented, Section, Switch } from '@/design/ui';

const LEGACY: Array<{ id: string | null; ar: string; en: string; color: string; dark?: boolean }> = [
  { id: null, ar: 'دقيق (افتراضي)', en: 'Daqeeq (default)', color: '#6E62A8' },
  { id: 'classic', ar: 'كلاسيكي', en: 'Classic', color: '#B45309' },
  { id: 'rose', ar: 'وردي', en: 'Rose', color: '#C2557A' },
  { id: 'ocean', ar: 'محيط', en: 'Ocean', color: '#1F7FA8' },
  { id: 'lavender', ar: 'لافندر', en: 'Lavender', color: '#7A5CC4' },
  { id: 'mint', ar: 'نعناع', en: 'Mint', color: '#23876B' },
  { id: 'sunset', ar: 'غروب', en: 'Sunset', color: '#C2622D' },
  { id: 'ice', ar: 'جليد', en: 'Ice', color: '#6CB4EE' },
  { id: 'navy', ar: 'كحلي (داكن)', en: 'Navy (dark)', color: '#0C1322', dark: true },
  { id: 'inferno', ar: 'جحيم (داكن)', en: 'Inferno (dark)', color: '#FF7A45', dark: true },
  { id: 'electric', ar: 'كهربائي (داكن)', en: 'Electric (dark)', color: '#5CE1E6', dark: true },
  { id: 'galaxy', ar: 'مجرة (داكن)', en: 'Galaxy (dark)', color: '#B794F6', dark: true },
  { id: 'nature', ar: 'طبيعة (داكن)', en: 'Nature (dark)', color: '#6FCF97', dark: true },
];

export default function Appearance() {
  const { L } = useI18n();
  const s = useSettings();
  return (
    <div className="max-w-2xl">
      <PageHeader title={L('المظهر', 'Appearance')} />
      <Section title={L('الوضع', 'Mode')}>
        <Segmented value={s.theme} onChange={(v) => updateSettings({ theme: v })} options={[
          { value: 'system', label: L('حسب الجهاز', 'System'), icon: <Monitor size={15} /> },
          { value: 'light', label: L('فاتح', 'Light'), icon: <Sun size={15} /> },
          { value: 'dark', label: L('داكن', 'Dark'), icon: <Moon size={15} /> },
        ]} />
      </Section>
      <Section title={L('لون التمييز', 'Accent')}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {LEGACY.map((t) => (
            <button key={t.id ?? 'default'} onClick={() => updateSettings(t.dark ? { legacyTheme: t.id, theme: 'dark' } : { legacyTheme: t.id })} aria-pressed={s.legacyTheme === t.id}
              className={clsx('flex items-center gap-2 rounded-md border p-3 text-sm font-bold', s.legacyTheme === t.id ? 'border-fg' : 'border-line hover:border-line-strong')}>
              <span className="size-5 rounded-full" style={{ background: t.color }} /> {L(t.ar, t.en)}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-fg-3">{L('ثيمات النسخة السابقة متاحة هنا. ألوان أقسام الدراسة والصحة تبقى ثابتة لسهولة التمييز.', 'Previous-version themes live here. Study and Health keep their own colours for clarity.')}</p>
      </Section>
      <Card className="p-4">
        <Segmented value={s.density} onChange={(v) => updateSettings({ density: v })} options={[{ value: 'comfortable', label: L('مريح', 'Comfortable') }, { value: 'compact', label: L('مضغوط', 'Compact') }]} />
        <Switch checked={s.gamification.animations} onChange={(v) => updateSettings({ gamification: { animations: v } })} label={L('حركات الاحتفال', 'Celebration animations')} hint={L('تُعطّل تلقائياً إذا فعّلت «تقليل الحركة» في جهازك.', 'Automatically off when your device asks for reduced motion.')} />
      </Card>
    </div>
  );
}
