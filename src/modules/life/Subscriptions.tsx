import { Repeat, RefreshCw } from 'lucide-react';
import type { Rec } from '@shared/records';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/hooks';
import { todayKey, shiftKey, fromKey, dateKey, relativeDay } from '@/core/dates';
import { update } from '@/core/repo';
import { Card, CardHeader, IconButton, Stat } from '@/design/ui';
import { EntityPage, type EntityConfig } from '@/modules/shared/EntityPage';

type Cycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

const monthly = (amount: number, cycle: string) =>
  cycle === 'weekly' ? (amount * 52) / 12 : cycle === 'quarterly' ? amount / 3 : cycle === 'yearly' ? amount / 12 : amount;

function advance(key: string, cycle: Cycle): string {
  if (cycle === 'weekly') return shiftKey(key, 7);
  const d = fromKey(key);
  const day = d.getDate();
  const months = cycle === 'monthly' ? 1 : cycle === 'quarterly' ? 3 : 12;
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return dateKey(d);
}

/** Recurring subscriptions with monthly/yearly cost and upcoming renewals. */
export default function Subscriptions() {
  const { L, lang, locale, fmtNum } = useI18n();
  const { currency } = useSettings();
  const config: EntityConfig = {
    type: 'subscription', ar: 'الاشتراكات', en: 'Subscriptions', icon: <Repeat size={30} />,
    titleKey: 'name', dateKey: 'next_date', statusKey: 'status', filterKey: 'status',
    emptyAr: 'لا اشتراكات مسجلة.', emptyEn: 'No subscriptions recorded.',
    defaults: { status: 'active', cycle: 'monthly' },
    fields: [
      { key: 'name', ar: 'الاسم', en: 'Name', type: 'text', required: true, full: true },
      { key: 'amount', ar: 'المبلغ', en: 'Amount', type: 'number', required: true, min: 0 },
      { key: 'cycle', ar: 'الدورة', en: 'Cycle', type: 'select', options: [
        { value: 'weekly', ar: 'أسبوعي', en: 'Weekly' }, { value: 'monthly', ar: 'شهري', en: 'Monthly' },
        { value: 'quarterly', ar: 'ربع سنوي', en: 'Quarterly' }, { value: 'yearly', ar: 'سنوي', en: 'Yearly' }] },
      { key: 'next_date', ar: 'الدفعة القادمة', en: 'Next payment', type: 'date' },
      { key: 'category', ar: 'الفئة', en: 'Category', type: 'text' },
      { key: 'status', ar: 'الحالة', en: 'Status', type: 'select', options: [
        { value: 'active', ar: 'نشط', en: 'Active' }, { value: 'paused', ar: 'متوقف مؤقتاً', en: 'Paused' }, { value: 'cancelled', ar: 'ملغى', en: 'Cancelled' }] },
      { key: 'url', ar: 'الرابط', en: 'URL', type: 'url' },
      { key: 'notes', ar: 'ملاحظات', en: 'Notes', type: 'textarea' },
    ],
    sort: (a, b) => Number(a.status !== 'active') - Number(b.status !== 'active') || String(a.date ?? '9999').localeCompare(String(b.date ?? '9999')),
    meta: (r) => {
      const cyc = ({ weekly: L('أسبوعي', 'weekly'), monthly: L('شهري', 'monthly'), quarterly: L('ربع سنوي', 'quarterly'), yearly: L('سنوي', 'yearly') } as Record<string, string>)[String(r.data.cycle)] ?? '';
      const next = r.data.next_date ? relativeDay(String(r.data.next_date), lang, locale) : '';
      return [`${fmtNum(Number(r.data.amount) || 0)} ${currency}`, cyc, next].filter(Boolean).join(' · ');
    },
    summary: (rs: Rec[]) => {
      const act = rs.filter((r) => r.status === 'active' || r.data.status === 'active');
      const m = act.reduce((s, r) => s + monthly(Number(r.data.amount) || 0, String(r.data.cycle)), 0);
      const today = todayKey();
      const end = shiftKey(today, 7);
      const soon = act.filter((r) => r.data.next_date && String(r.data.next_date) >= today && String(r.data.next_date) <= end)
        .sort((a, b) => String(a.data.next_date).localeCompare(String(b.data.next_date)));
      return (
        <Card className="p-4">
          <div className="grid grid-cols-2 gap-3">
            <Stat label={L('التكلفة الشهرية', 'Monthly cost')} value={`${fmtNum(Math.round(m * 100) / 100)} ${currency}`} />
            <Stat label={L('التكلفة السنوية', 'Yearly cost')} value={`${fmtNum(Math.round(m * 12 * 100) / 100)} ${currency}`} />
          </div>
          {soon.length > 0 && (
            <div className="mt-4">
              <CardHeader title={L('تجديدات خلال 7 أيام', 'Renewals in the next 7 days')} />
              <ul className="space-y-1 text-[13px]">
                {soon.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <span className="truncate font-bold">{String(r.data.name)}</span>
                    <span className="num text-fg-2">{fmtNum(Number(r.data.amount) || 0)} {currency} · {relativeDay(String(r.data.next_date), lang, locale)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      );
    },
    extraActions: (r: Rec) => r.data.next_date ? (
      <IconButton size="sm" label={L('تم التجديد', 'Renewed')} onClick={() => {
        const next = advance(String(r.data.next_date), (String(r.data.cycle) || 'monthly') as Cycle);
        return update(r.id, { data: { next_date: next }, date: next });
      }}><RefreshCw size={16} /></IconButton>
    ) : null,
  };
  return <EntityPage config={config} />;
}
