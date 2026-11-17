import { useI18n } from '@/core/i18n';
import { replaceSetting, updateSettings, useSettings } from '@/core/hooks';
import { Card, Chip, PageHeader, Section, Switch } from '@/design/ui';
import { PAGES, PRESETS, SECTIONS, isPageOn } from '@/app/registry';
import { toast } from '@/core/toast';

export default function Modules() {
  const { L } = useI18n();
  const s = useSettings();
  const applyPreset = async (id: string) => {
    await replaceSetting('modules', {});
    await updateSettings({ modulePreset: id });
    toast(L('طُبّق القالب', 'Preset applied'));
  };
  return (
    <div className="max-w-2xl">
      <PageHeader title={L('الوحدات', 'Modules')} subtitle={L('أخفِ ما لا تحتاجه. الإخفاء لا يحذف أي بيانات — تقدر ترجعها أي وقت.', "Hide what you don't need. Hiding never deletes data — bring it back any time.")} />
      <Section title={L('قوالب', 'Presets')}>
        <div className="flex flex-wrap gap-1.5">{Object.entries(PRESETS).map(([id, p]) => <Chip key={id} onClick={() => applyPreset(id)}>{L(p.ar, p.en)}</Chip>)}</div>
      </Section>
      {SECTIONS.filter((x) => x.id !== 'settings').map((sec) => (
        <Section key={sec.id} title={L(sec.ar, sec.en)}>
          <Card className="divide-y divide-line px-4" data-section={sec.id}>
            {PAGES.filter((p) => p.section === sec.id).map((p) => (
              <Switch
                key={p.id}
                checked={isPageOn(p, s.modules, s.modulePreset)}
                disabled={p.core}
                onChange={(v) => updateSettings({ modules: { ...s.modules, [p.id]: v } })}
                label={<span className="inline-flex items-center gap-2"><p.icon size={16} className="text-accent" />{L(p.ar, p.en)}</span>}
                hint={p.core ? L('أساسية', 'Always on') : undefined}
              />
            ))}
          </Card>
        </Section>
      ))}
    </div>
  );
}
