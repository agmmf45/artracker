import { Pill, Check } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useRecords } from '@/core/hooks';
import { todayKey } from '@/core/dates';
import { create, remove } from '@/core/repo';
import { Button, Card, CardHeader } from '@/design/ui';
import { EntityPage, type EntityConfig } from '@/modules/shared/EntityPage';

/** Medications (private) with a daily "taken" checklist backed by med_log records. */
export default function Medication() {
  const { L } = useI18n();
  const meds = useRecords('medication');
  const logs = useRecords('med_log');
  const today = todayKey();
  const todayLogs = (logs ?? []).filter((l) => l.date === today);
  const active = (meds ?? []).filter((m) => (m.data.status ?? 'active') === 'active' && (!m.data.end || String(m.data.end) >= today) && (!m.data.start || String(m.data.start) <= today));
  const slots = active.flatMap((m) => ((m.data.times as string[] | undefined) ?? []).map((t) => ({ m, t }))).sort((a, b) => a.t.localeCompare(b.t));

  const toggle = async (medId: string, time: string, logId?: string) => {
    if (logId) await remove(logId);
    else await create('med_log', { medication_id: medId, time }, { date: today, parent_id: medId });
  };

  const header = (
    <Card className="mb-4 p-4">
      <CardHeader title={L('اليوم', 'Today')} icon={<Pill size={18} />} />
      {slots.length === 0 ? (
        <p className="text-[13px] text-fg-3">{L('لا جرعات مجدولة اليوم.', 'No doses scheduled today.')}</p>
      ) : (
        <ul className="divide-y divide-line">
          {slots.map(({ m, t }) => {
            const log = todayLogs.find((l) => l.data.medication_id === m.id && l.data.time === t);
            return (
              <li key={`${m.id}-${t}`} className="flex items-center gap-3 py-2">
                <span className="num w-14 text-[13px] font-bold text-fg-2" dir="ltr">{t}</span>
                <span className="min-w-0 flex-1 truncate font-bold">{String(m.data.name)}{m.data.dose ? <span className="font-normal text-fg-2"> · {String(m.data.dose)}</span> : null}</span>
                <Button size="sm" variant={log ? 'primary' : 'secondary'} icon={log ? <Check size={15} /> : undefined} onClick={() => toggle(m.id, t, log?.id)}>
                  {log ? L('تم', 'Taken') : L('أخذتها', 'Mark taken')}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-[12px] text-fg-3">{L('للتنظيم الشخصي فقط — لا تغيّر جرعاتك بدون طبيبك.', 'For personal organization only — never change doses without your doctor.')}</p>
    </Card>
  );

  const config: EntityConfig = {
    type: 'medication', ar: 'الأدوية', en: 'Medications', icon: <Pill size={30} />, private: true,
    titleKey: 'name', statusKey: 'status', filterKey: 'status',
    emptyAr: 'لا أدوية مسجلة.', emptyEn: 'No medications recorded.',
    defaults: { status: 'active' },
    headerExtra: header,
    fields: [
      { key: 'name', ar: 'الاسم', en: 'Name', type: 'text', required: true, full: true },
      { key: 'dose', ar: 'الجرعة', en: 'Dose', type: 'text' },
      { key: 'times', ar: 'أوقات الجرعات', en: 'Dose times', type: 'times' },
      { key: 'start', ar: 'البداية', en: 'Start', type: 'date' },
      { key: 'end', ar: 'النهاية', en: 'End', type: 'date' },
      { key: 'status', ar: 'الحالة', en: 'Status', type: 'select', options: [{ value: 'active', ar: 'نشط', en: 'Active' }, { value: 'stopped', ar: 'متوقف', en: 'Stopped' }] },
      { key: 'prescriber', ar: 'الطبيب', en: 'Prescriber', type: 'text' },
      { key: 'notes', ar: 'ملاحظات', en: 'Notes', type: 'textarea' },
    ],
    meta: (r) => [r.data.dose, ((r.data.times as string[] | undefined) ?? []).join(' ')].filter(Boolean).join(' · '),
  };
  return <EntityPage config={config} />;
}
