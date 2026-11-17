import { useI18n } from '@/core/i18n';
import { updateSettings, useSettings } from '@/core/hooks';
import { DEFAULT_XP, DEFAULT_LEVEL_TITLES, DAILY_CAP, xpForLevel, type XpAction } from '@shared/xp';
import { Button, Card, Input, PageHeader, Section, Switch } from '@/design/ui';

const LABELS: Record<XpAction, [string, string]> = {
  task: ['مهمة عادية', 'Standard task'],
  task_important: ['مهمة مهمة', 'Important task'],
  habit: ['عادة مجدولة', 'Scheduled habit'],
  focus: ['جلسة تركيز', 'Focus session'],
  workout: ['تمرين', 'Workout'],
  daily_review: ['مراجعة يومية', 'Daily review'],
  weekly_review: ['مراجعة أسبوعية', 'Weekly review'],
  milestone: ['مرحلة مشروع', 'Milestone'],
  project: ['إنهاء مشروع', 'Project complete'],
  flashcards: ['مراجعة بطاقات', 'Flashcard review'],
  quest: ['مهمة يومية (Quest)', 'Daily quest'],
};

export default function Gamification() {
  const { L } = useI18n();
  const s = useSettings();
  const g = s.gamification;
  const titles = g.levelTitles ?? DEFAULT_LEVEL_TITLES;
  return (
    <div className="max-w-2xl">
      <PageHeader title={L('التحفيز والنقاط', 'Gamification')} subtitle={L('اختياري بالكامل. لا عقاب على الأيام الفائتة، ولا تخسر إنجازاً حققته.', 'Fully optional. No penalties for missed days; you never lose what you earned.')} />
      <Card className="mb-4 px-4">
        <Switch checked={g.enabled} onChange={(v) => updateSettings({ gamification: { enabled: v } })} label={L('تفعيل النقاط والمستويات', 'Enable XP & levels')} />
        <Switch checked={g.vacation} onChange={(v) => updateSettings({ gamification: { vacation: v } })} label={L('وضع الإجازة / التعافي', 'Vacation / recovery mode')} hint={L('يوقف المهام اليومية (Quests) ولا يحسب الأيام كغياب.', 'Pauses daily quests and does not count days as missed.')} />
        <Switch checked={g.garden} onChange={(v) => updateSettings({ gamification: { garden: v } })} label={L('حديقة النمو', 'Growth garden')} hint={L('تنمو بهدوء مع إنجازاتك الحقيقية.', 'Grows quietly with your real progress.')} />
      </Card>
      {g.enabled && (
        <>
          <Section title={L('قيم النقاط', 'XP values')} action={<Button size="sm" variant="ghost" onClick={() => updateSettings({ gamification: { xp: {} } })}>{L('الافتراضي', 'Defaults')}</Button>}>
            <Card className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
              {(Object.keys(DEFAULT_XP) as XpAction[]).map((k) => (
                <Input key={k} type="number" min={0} max={500} label={L(LABELS[k][0], LABELS[k][1])} hint={DAILY_CAP[k] ? L(`(حد يومي ${DAILY_CAP[k]})`, `(daily cap ${DAILY_CAP[k]})`) : undefined}
                  value={g.xp[k] ?? DEFAULT_XP[k]} onChange={(e) => updateSettings({ gamification: { xp: { ...g.xp, [k]: Math.max(0, Math.min(500, Number(e.target.value) || 0)) } } })} />
              ))}
            </Card>
            <p className="mt-2 text-[12px] text-fg-3">{L('الحدود اليومية تمنع جمع النقاط بالإدخال المفرط، ولا نكافئ التمرين المفرط أو المذاكرة بدون استراحة.', 'Daily caps stop point farming; excessive exercise or studying without breaks is not rewarded.')}</p>
          </Section>
          <Section title={L('ألقاب المستويات', 'Level titles')}>
            <Card className="divide-y divide-line">
              {titles.map(([lvl, ar, en], i) => (
                <div key={lvl} className="flex items-center gap-3 px-4 py-2">
                  <span className="num w-20 text-[12px] text-fg-3">{L('مستوى', 'Level')} {lvl} · {xpForLevel(lvl)} XP</span>
                  <input className="field h-9 min-h-0 flex-1 py-1" value={ar} aria-label="ar" onChange={(e) => updateSettings({ gamification: { levelTitles: titles.map((t, j) => (j === i ? [t[0], e.target.value, t[2]] : t)) } })} />
                  <input className="field h-9 min-h-0 flex-1 py-1" dir="ltr" value={en} aria-label="en" onChange={(e) => updateSettings({ gamification: { levelTitles: titles.map((t, j) => (j === i ? [t[0], t[1], e.target.value] : t)) } })} />
                </div>
              ))}
            </Card>
            <p className="mt-2 text-[12px] text-fg-3">{L('منحنى المستويات: XP المطلوبة للمستوى L = 100 × (L−1)^1.5', 'Level curve: XP to reach level L = 100 × (L−1)^1.5')}</p>
          </Section>
        </>
      )}
    </div>
  );
}
