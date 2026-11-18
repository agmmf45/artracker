import { FileHeart, ExternalLink } from 'lucide-react';
import type { Rec } from '@shared/records';
import { useI18n } from '@/core/i18n';
import { IconButton } from '@/design/ui';
import { EntityPage, type EntityConfig } from '@/modules/shared/EntityPage';

const KINDS = [
  { value: 'appointment', ar: 'موعد', en: 'Appointment' },
  { value: 'vaccination', ar: 'تطعيم', en: 'Vaccination' },
  { value: 'lab', ar: 'تحليل', en: 'Lab result' },
  { value: 'document', ar: 'وثيقة', en: 'Document' },
  { value: 'symptom', ar: 'عَرَض', en: 'Symptom' },
  { value: 'note', ar: 'ملاحظة', en: 'Note' },
];

/** Personal health records (private). */
export default function Records() {
  const { L } = useI18n();
  const config: EntityConfig = {
    type: 'health_record', ar: 'السجل الصحي', en: 'Health records', icon: <FileHeart size={30} />, private: true,
    subAr: 'سجل شخصي — ليس تشخيصاً طبياً.', subEn: 'Personal record — not a medical diagnosis.',
    titleKey: 'title', dateKey: 'date', groupBy: 'kind', filterKey: 'kind',
    emptyAr: 'لا سجلات بعد.', emptyEn: 'No records yet.',
    fields: [
      { key: 'title', ar: 'العنوان', en: 'Title', type: 'text', required: true, full: true },
      { key: 'kind', ar: 'النوع', en: 'Type', type: 'select', options: KINDS },
      { key: 'date', ar: 'التاريخ', en: 'Date', type: 'date', required: true },
      { key: 'value', ar: 'القيمة', en: 'Value', type: 'text' },
      { key: 'unit', ar: 'الوحدة', en: 'Unit', type: 'text' },
      { key: 'provider', ar: 'الجهة / الطبيب', en: 'Provider', type: 'text' },
      { key: 'link', ar: 'رابط الوثيقة', en: 'Document link', type: 'url' },
      { key: 'notes', ar: 'ملاحظات', en: 'Notes', type: 'textarea' },
    ],
    sort: (a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')),
    meta: (r) => [r.data.date, [r.data.value, r.data.unit].filter(Boolean).join(' '), r.data.provider].filter(Boolean).join(' · '),
    extraActions: (r: Rec) => r.data.link ? (
      <a href={String(r.data.link)} target="_blank" rel="noopener noreferrer">
        <IconButton size="sm" label={L('فتح الوثيقة', 'Open document')} tabIndex={-1}><ExternalLink size={16} /></IconButton>
      </a>
    ) : null,
  };
  return <EntityPage config={config} />;
}
