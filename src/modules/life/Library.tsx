import { LibraryBig, Check } from 'lucide-react';
import type { Rec } from '@shared/records';
import { useI18n } from '@/core/i18n';
import { update } from '@/core/repo';
import { IconButton } from '@/design/ui';
import { EntityPage, type EntityConfig } from '@/modules/shared/EntityPage';

const COLLECTIONS = [
  { value: 'books', ar: 'كتب', en: 'Books' },
  { value: 'movies', ar: 'أفلام', en: 'Movies' },
  { value: 'series', ar: 'مسلسلات', en: 'Series' },
  { value: 'shopping', ar: 'تسوق', en: 'Shopping' },
  { value: 'packing', ar: 'قائمة السفر', en: 'Packing' },
  { value: 'travel', ar: 'سفر', en: 'Travel' },
  { value: 'gifts', ar: 'هدايا', en: 'Gifts' },
  { value: 'dates', ar: 'مواعيد مهمة', en: 'Important dates' },
  { value: 'household', ar: 'المنزل', en: 'Household' },
  { value: 'wishlist', ar: 'أمنيات', en: 'Wishlist' },
  { value: 'other', ar: 'أخرى', en: 'Other' },
];

/** Personal collections (books, movies, shopping, packing, gifts…) in one flexible list. */
export default function Library() {
  const { L } = useI18n();
  const config: EntityConfig = {
    type: 'collection_item', ar: 'مجموعاتي', en: 'My collections', icon: <LibraryBig size={30} />,
    subAr: 'كتب وأفلام وتسوق وهدايا وغيرها في مكان واحد.', subEn: 'Books, movies, shopping, gifts and more in one place.',
    titleKey: 'title', dateKey: 'date', statusKey: 'status', groupBy: 'collection', filterKey: 'collection',
    emptyAr: 'لا عناصر بعد.', emptyEn: 'No items yet.',
    defaults: { status: 'todo', collection: 'books' },
    fields: [
      { key: 'title', ar: 'العنوان', en: 'Title', type: 'text', required: true, full: true },
      { key: 'collection', ar: 'المجموعة', en: 'Collection', type: 'select', options: COLLECTIONS },
      { key: 'status', ar: 'الحالة', en: 'Status', type: 'select', options: [
        { value: 'todo', ar: 'للتنفيذ', en: 'To do' }, { value: 'in_progress', ar: 'قيد التنفيذ', en: 'In progress' }, { value: 'done', ar: 'تم', en: 'Done' }] },
      { key: 'rating', ar: 'التقييم', en: 'Rating', type: 'rating' },
      { key: 'date', ar: 'التاريخ / الاستحقاق', en: 'Date / due', type: 'date' },
      { key: 'quantity', ar: 'الكمية', en: 'Quantity', type: 'number', min: 0 },
      { key: 'price', ar: 'السعر', en: 'Price', type: 'number', min: 0 },
      { key: 'link', ar: 'رابط', en: 'Link', type: 'url' },
      { key: 'notes', ar: 'ملاحظات', en: 'Notes', type: 'textarea' },
      { key: 'tags', ar: 'وسوم', en: 'Tags', type: 'tags' },
    ],
    sort: (a, b) => Number(a.status === 'done') - Number(b.status === 'done') || b.created_at.localeCompare(a.created_at),
    meta: (r) => [r.data.rating ? '★'.repeat(Number(r.data.rating)) : '', r.data.date, r.data.quantity != null ? `×${r.data.quantity}` : '', r.data.price != null ? String(r.data.price) : ''].filter(Boolean).join(' · '),
    badge: (r) => r.status === 'done' ? <span className="text-[11px] font-bold text-success">✓ {L('تم', 'Done')}</span> : null,
    extraActions: (r: Rec) => {
      const done = r.status === 'done';
      return (
        <IconButton size="sm" className={done ? 'text-success' : ''} label={done ? L('إعادة للقائمة', 'Mark not done') : L('تم', 'Mark done')}
          onClick={() => { const status = done ? 'todo' : 'done'; return update(r.id, { status, data: { status } }); }}>
          <Check size={17} />
        </IconButton>
      );
    },
  };
  return <EntityPage config={config} />;
}
