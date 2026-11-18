import clsx from 'clsx';
import { Moon, Sun } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { updateSettings, useSettings } from '@/core/hooks';
import { Card, PageHeader, Segmented, Section, Switch } from '@/design/ui';

/** Two themes only, both taken from the notebook mockups. Each card previews its paper and ink. */
const THEMES: Array<{ id: 'light' | 'dark'; ar: string; en: string; desk: string; paper: string; ink: string; line: string; dots: string[]; icon: typeof Sun }> = [
  { id: 'light', ar: 'فاتح — ورق الدفتر', en: 'Light — notebook paper', desk: '#EFE6DA', paper: '#FFFBF5', ink: '#2F2926', line: '#E2D6C9', dots: ['#F2B1A8', '#B9DFC8', '#D8C2F0', '#F2C75C'], icon: Sun },
  { id: 'dark', ar: 'غامق — ألوان زاهية', en: 'Dark — vivid colours', desk: '#15110E', paper: '#221C17', ink: '#F3EBE2', line: '#3A3129', dots: ['#FF7A66', '#34D399', '#B47BFF', '#FFC83D'], icon: Moon },
];

export default function Appearance() {
  const { L } = useI18n();
  const s = useSettings();
  const current = s.theme === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : s.theme;
  return (
    <div className="max-w-2xl">
      <PageHeader title={L('المظهر', 'Appearance')} />
      <Section title={L('الثيم', 'Theme')}>
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={L('الثيم', 'Theme')}>
          {THEMES.map((t) => {
            const on = current === t.id;
            return (
              <button key={t.id} role="radio" aria-checked={on} onClick={() => updateSettings({ theme: t.id, legacyTheme: null })}
                className={clsx('overflow-hidden rounded-md border-2 text-start transition-colors', on ? 'border-fg' : 'border-line hover:border-line-strong')}>
                <div className="p-3" style={{ background: t.desk }}>
                  <div className="rounded-sm p-3" style={{ background: t.paper, border: `1px solid ${t.line}`, backgroundImage: `radial-gradient(${t.line} 1px, transparent 1.3px)`, backgroundSize: '12px 12px' }}>
                    <div className="mb-2 h-2.5 w-16 rounded-full" style={{ background: t.ink, opacity: 0.85 }} />
                    <div className="flex gap-1">{t.dots.map((c) => <span key={c} className="h-2 flex-1 rounded-full" style={{ background: c }} />)}</div>
                    <div className="mt-2 h-1.5 w-24 rounded-full" style={{ background: t.ink, opacity: 0.35 }} />
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-2.5 text-sm font-bold"><t.icon size={16} />{L(t.ar, t.en)}{on && <span className="ms-auto text-[12px] text-fg-2">✓</span>}</div>
              </button>
            );
          })}
        </div>
        {s.theme === 'system' && <p className="mt-2 text-[12px] text-fg-3">{L('حالياً يتبع جهازك. اختر واحد عشان يثبت.', 'Currently following your device. Pick one to keep it.')}</p>}
      </Section>
      <Card className="p-4">
        <Segmented value={s.density} onChange={(v) => updateSettings({ density: v })} options={[{ value: 'comfortable', label: L('مريح', 'Comfortable') }, { value: 'compact', label: L('مضغوط', 'Compact') }]} />
        <Switch checked={s.gamification.animations} onChange={(v) => updateSettings({ gamification: { animations: v } })} label={L('حركات الاحتفال', 'Celebration animations')} hint={L('تُعطّل تلقائياً إذا فعّلت «تقليل الحركة» في جهازك.', 'Automatically off when your device asks for reduced motion.')} />
      </Card>
    </div>
  );
}
