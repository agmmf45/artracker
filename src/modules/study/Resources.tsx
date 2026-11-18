import { Library, ExternalLink } from 'lucide-react';
import type { Rec } from '@shared/records';
import { useI18n } from '@/core/i18n';
import { IconButton } from '@/design/ui';
import { EntityPage, type EntityConfig } from '@/modules/shared/EntityPage';
import { useCourses } from './shared';

const KINDS = [
  { value: 'book', ar: 'كتاب', en: 'Book' },
  { value: 'article', ar: 'مقال', en: 'Article' },
  { value: 'video', ar: 'فيديو', en: 'Video' },
  { value: 'website', ar: 'موقع', en: 'Website' },
  { value: 'slides', ar: 'شرائح', en: 'Slides' },
  { value: 'other', ar: 'أخرى', en: 'Other' },
];

function host(url: unknown) {
  try { return new URL(String(url)).host.replace(/^www\./, ''); } catch { return ''; }
}

/** Study resources: books, articles, videos and links grouped by course. */
export default function Resources() {
  const { L } = useI18n();
  const courses = useCourses();
  const config: EntityConfig = {
    type: 'resource', ar: 'المصادر', en: 'Resources', icon: <Library size={30} />,
    subAr: 'كتب ومقالات وروابط دراستك في مكان واحد.', subEn: 'Your books, articles and study links in one place.',
    titleKey: 'title', groupBy: 'course_id', filterKey: 'kind',
    emptyAr: 'لا مصادر بعد.', emptyEn: 'No resources yet.',
    fields: [
      { key: 'title', ar: 'العنوان', en: 'Title', type: 'text', required: true, full: true },
      { key: 'url', ar: 'الرابط', en: 'URL', type: 'url' },
      { key: 'course_id', ar: 'المقرر', en: 'Course', type: 'select', options: courses.map((c) => ({ value: c.id, ar: c.data.code || c.data.name, en: c.data.code || c.data.name })) },
      { key: 'kind', ar: 'النوع', en: 'Type', type: 'select', options: KINDS },
      { key: 'notes', ar: 'ملاحظات', en: 'Notes', type: 'textarea' },
      { key: 'tags', ar: 'وسوم', en: 'Tags', type: 'tags' },
    ],
    meta: (r) => {
      const k = KINDS.find((x) => x.value === r.data.kind);
      return [k ? L(k.ar, k.en) : '', host(r.data.url)].filter(Boolean).join(' · ');
    },
    extraActions: (r: Rec) => r.data.url ? (
      <a href={String(r.data.url)} target="_blank" rel="noopener noreferrer" aria-label={L('فتح الرابط', 'Open link')}>
        <IconButton size="sm" label={L('فتح الرابط', 'Open link')} tabIndex={-1}><ExternalLink size={16} /></IconButton>
      </a>
    ) : null,
  };
  return <EntityPage config={config} />;
}
