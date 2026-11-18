import { useI18n } from '@/core/i18n';
import { updateSettings, useSettings } from '@/core/hooks';
import { Card, PageHeader, Section, Switch } from '@/design/ui';

export default function Privacy() {
  const { L } = useI18n();
  const s = useSettings();
  const p = s.privacy;
  return (
    <div className="max-w-2xl">
      <PageHeader title={L('الخصوصية', 'Privacy')} subtitle={L('بياناتك لك. لا تحليلات طرف ثالث، ولا إعلانات، ولا مشاركة.', 'Your data is yours. No third-party analytics, ads, or sharing.')} actions={<a href="#/privacy" className="text-sm font-bold text-accent hover:underline">{L('اقرأ سياسة الخصوصية', 'Read the privacy policy')}</a>} />
      <Section title={L('المعاينات', 'Previews')}>
        <Card className="divide-y divide-line px-4">
          <Switch checked={p.hideJournalPreviews} onChange={(v) => updateSettings({ privacy: { hideJournalPreviews: v } })} label={L('أخفِ معاينة اليوميات', 'Hide journal previews')} hint={L('تظهر العناوين فقط في القوائم.', 'Lists show titles only.')} />
          <Switch checked={p.lockJournal} onChange={(v) => updateSettings({ privacy: { lockJournal: v } })} label={L('اطلب تأكيداً قبل فتح اليوميات', 'Ask before opening the journal')} />
          <Switch checked={p.hideHealthInCalendar} onChange={(v) => updateSettings({ privacy: { hideHealthInCalendar: v } })} label={L('لا تعرض بيانات الصحة في التقويم', 'Keep health data out of the calendar')} />
        </Card>
      </Section>
      <Section title={L('المساعد الذكي', 'AI assistant')}>
        <Card className="divide-y divide-line px-4">
          <Switch checked={p.ai.enabled} onChange={(v) => updateSettings({ privacy: { ai: { enabled: v } } })} label={L('السماح باستخدام المساعد الذكي', 'Allow the AI assistant')} hint={L('يُرسل فقط ما تختاره لطلب معيّن، ولا يُحفظ لدى المزوّد لتدريب النماذج.', 'Sends only what you choose for a given request.')} />
          <Switch disabled={!p.ai.enabled} checked={p.ai.health} onChange={(v) => updateSettings({ privacy: { ai: { health: v } } })} label={L('السماح ببيانات الصحة (تحليل الوجبات)', 'Allow health data (meal analysis)')} />
          <Switch disabled={!p.ai.enabled} checked={p.ai.finance} onChange={(v) => updateSettings({ privacy: { ai: { finance: v } } })} label={L('السماح ببيانات المال (قراءة رسائل البنك)', 'Allow finance data (bank SMS parsing)')} />
          <Switch disabled={!p.ai.enabled} checked={p.ai.journal} onChange={(v) => updateSettings({ privacy: { ai: { journal: v } } })} label={L('السماح بنصوص اليوميات', 'Allow journal text')} />
        </Card>
      </Section>
      <p className="text-[12px] text-fg-3">{L('البيانات الخاصة (اليوميات، الصحة، المال) لا تظهر في البحث العام ولا في التقويم ولا تُرسل لأي جهة بدون موافقتك هنا.', 'Private data (journal, health, money) stays out of global search and the calendar and is never sent anywhere without consent here.')}</p>
    </div>
  );
}
