import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BellRing, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { updateSettings, useRecords, useSettings } from '@/core/hooks';
import { db } from '@/core/db';
import { create, remove, update } from '@/core/repo';
import { Button, Card, EmptyState, IconButton, Input, PageHeader, Section, Switch } from '@/design/ui';
import type { NotifEntry } from '@/app/ReminderEngine';

const DAYS_AR = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];
const DAYS_EN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function Notifications() {
  const { L, lang } = useI18n();
  const s = useSettings();
  const reminders = useRecords<{ label: string; time: string; days: number[] }>('reminder');
  const log = useLiveQuery(() => db().meta.get('notif_log').then((r) => (r?.value as NotifEntry[]) ?? []), []);
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'denied');
  const [label, setLabel] = useState('');
  const [time, setTime] = useState('08:00');

  const enable = async (v: boolean) => {
    if (v && typeof Notification !== 'undefined' && Notification.permission === 'default') setPerm(await Notification.requestPermission());
    await updateSettings({ notifications: { enabled: v } });
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title={L('التنبيهات', 'Notifications')} />
      <Card className="mb-4 px-4">
        <Switch checked={s.notifications.enabled} onChange={enable} label={L('إشعارات النظام', 'System notifications')}
          hint={perm === 'denied' ? L('المتصفح يمنع الإشعارات — فعّلها من إعدادات المتصفح.', 'Your browser blocks notifications — enable them in browser settings.') : L('تظهر خارج التطبيق أثناء فتح دقيق. التذكيرات داخل التطبيق تعمل دائماً.', 'Shown outside the app while Daqeeq is open. In-app reminders always work.')} />
        <div className="grid grid-cols-3 gap-3 py-3">
          <Input type="time" label={L('بداية الهدوء', 'Quiet from')} value={s.notifications.quietStart} onChange={(e) => updateSettings({ notifications: { quietStart: e.target.value } })} />
          <Input type="time" label={L('نهاية الهدوء', 'Quiet until')} value={s.notifications.quietEnd} onChange={(e) => updateSettings({ notifications: { quietEnd: e.target.value } })} />
          <Input type="number" min={1} max={20} label={L('حد بالساعة', 'Max per hour')} value={s.notifications.maxPerHour} onChange={(e) => updateSettings({ notifications: { maxPerHour: Math.max(1, Number(e.target.value) || 1) } })} />
        </div>
        <p className="pb-3 text-[12px] text-fg-3">{L('ملاحظة صادقة: الإشعارات حالياً تعمل والتطبيق مفتوح (أو في الخلفية على بعض المتصفحات). إشعارات الدفع مع إغلاق التطبيق مخطط لها.', 'Honest note: notifications currently fire while the app is open (or backgrounded on some browsers). Push while closed is planned.')}</p>
      </Card>

      <Section title={L('تذكيرات متكررة', 'Recurring reminders')}>
        <Card className="divide-y divide-line">
          {(reminders ?? []).map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1"><div className="font-bold">{r.data.label}</div><div className="num text-[12px] text-fg-2">{r.data.time}</div></div>
              <div className="flex gap-1">
                {(lang === 'ar' ? DAYS_AR : DAYS_EN).map((d, i) => (
                  <button key={i} aria-pressed={r.data.days.includes(i)} onClick={() => update(r.id, { data: { days: r.data.days.includes(i) ? r.data.days.filter((x) => x !== i) : [...r.data.days, i].sort() } })}
                    className={`size-7 rounded-full text-[11px] font-bold ${r.data.days.includes(i) ? 'bg-accent text-on-accent' : 'bg-surface-2 text-fg-3'}`}>{d}</button>
                ))}
              </div>
              <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={r.status !== 'off'} aria-label={L('مفعّل', 'Enabled')} onChange={(e) => update(r.id, { status: e.target.checked ? 'on' : 'off' })} />
              <IconButton size="sm" tone="danger" label={L('حذف', 'Delete')} onClick={() => remove(r.id)}><Trash2 size={15} /></IconButton>
            </div>
          ))}
          <form className="flex gap-2 p-3" onSubmit={async (e) => { e.preventDefault(); if (!label.trim()) return; await create('reminder', { label: label.trim(), time, days: [0, 1, 2, 3, 4, 5, 6] }, { status: 'on' }); setLabel(''); }}>
            <input className="field flex-1" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={L('مثال: اشرب ماء', 'e.g. Drink water')} />
            <input type="time" className="field w-32" value={time} onChange={(e) => setTime(e.target.value)} aria-label={L('الوقت', 'Time')} />
            <Button type="submit" icon={<Plus size={16} />}>{L('إضافة', 'Add')}</Button>
          </form>
        </Card>
      </Section>

      <Section title={L('مركز التنبيهات (هذا الجهاز)', 'Notification center (this device)')}>
        {!log?.length ? <EmptyState icon={<BellRing size={26} />} title={L('لا تنبيهات بعد', 'No notifications yet')} /> : (
          <Card className="divide-y divide-line">
            {log.slice(0, 30).map((n) => (
              <a key={n.key + n.at} href={n.link} className="block px-4 py-2.5 hover:bg-surface-2">
                <div className="text-sm font-bold">{n.title}</div>
                <div className="text-[12px] text-fg-3">{new Date(n.at).toLocaleString()}</div>
              </a>
            ))}
          </Card>
        )}
      </Section>
    </div>
  );
}
