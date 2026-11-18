import { Activity as ActivityIcon } from 'lucide-react';
import type { Rec } from '@shared/records';
import { useI18n } from '@/core/i18n';
import { todayKey, rangeKeys, shiftKey, fromKey } from '@/core/dates';
import { Bars } from '@/design/charts';
import { Card, CardHeader, Stat } from '@/design/ui';
import { EntityPage, type EntityConfig } from '@/modules/shared/EntityPage';

const KINDS = [
  { value: 'walk', ar: 'مشي', en: 'Walk' },
  { value: 'run', ar: 'جري', en: 'Run' },
  { value: 'cycle', ar: 'دراجة', en: 'Cycling' },
  { value: 'swim', ar: 'سباحة', en: 'Swimming' },
  { value: 'sport', ar: 'رياضة', en: 'Sport' },
  { value: 'other', ar: 'أخرى', en: 'Other' },
];

/** Daily activity log (walks, runs, sports) with a 14-day minutes chart. */
export default function Activity() {
  const { L, locale, fmtNum } = useI18n();
  const config: EntityConfig = {
    type: 'activity_log', ar: 'النشاط', en: 'Activity', icon: <ActivityIcon size={30} />,
    titleKey: 'title', dateKey: 'date', filterKey: 'kind',
    emptyAr: 'لا نشاط مسجل.', emptyEn: 'No activity logged.',
    defaults: { date: todayKey(), kind: 'walk' },
    fields: [
      { key: 'title', ar: 'الوصف', en: 'Description', type: 'text', full: true, placeholder: L('مثال: مشي صباحي', 'e.g. Morning walk') },
      { key: 'date', ar: 'التاريخ', en: 'Date', type: 'date', required: true },
      { key: 'kind', ar: 'النوع', en: 'Type', type: 'select', options: KINDS },
      { key: 'minutes', ar: 'الدقائق', en: 'Minutes', type: 'number', min: 0 },
      { key: 'steps', ar: 'الخطوات', en: 'Steps', type: 'number', min: 0 },
      { key: 'distance_km', ar: 'المسافة (كم)', en: 'Distance (km)', type: 'number', min: 0 },
      { key: 'notes', ar: 'ملاحظات', en: 'Notes', type: 'textarea' },
    ],
    sort: (a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')),
    meta: (r) => {
      const k = KINDS.find((x) => x.value === r.data.kind);
      return [r.data.date, k ? L(k.ar, k.en) : '', r.data.minutes != null ? `${r.data.minutes} ${L('د', 'min')}` : '', r.data.steps != null ? `${r.data.steps} ${L('خطوة', 'steps')}` : '', r.data.distance_km != null ? `${r.data.distance_km} ${L('كم', 'km')}` : ''].filter(Boolean).join(' · ');
    },
    summary: (rs: Rec[]) => {
      const today = todayKey();
      const days = rangeKeys(shiftKey(today, -13), 14);
      const perDay: Record<string, number> = {};
      for (const r of rs) { const d = String(r.date ?? r.data.date ?? ''); perDay[d] = (perDay[d] ?? 0) + (Number(r.data.minutes) || 0); }
      const week = new Set(days.slice(-7));
      let wMin = 0; let wSteps = 0;
      for (const r of rs) {
        const d = String(r.date ?? r.data.date ?? '');
        if (week.has(d)) { wMin += Number(r.data.minutes) || 0; wSteps += Number(r.data.steps) || 0; }
      }
      return (
        <Card className="p-4">
          <CardHeader title={L('آخر 14 يوماً (دقائق)', 'Last 14 days (minutes)')} icon={<ActivityIcon size={18} />} />
          <Bars color="var(--health)" height={110}
            data={days.map((d) => ({ label: new Intl.DateTimeFormat(locale, { day: 'numeric' }).format(fromKey(d)), value: perDay[d] ?? 0 }))} />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Stat label={L('دقائق هذا الأسبوع', 'Minutes this week')} value={fmtNum(wMin)} />
            <Stat label={L('خطوات هذا الأسبوع', 'Steps this week')} value={fmtNum(wSteps)} />
          </div>
        </Card>
      );
    },
  };
  return <EntityPage config={config} />;
}
