import { useEffect, useRef } from 'react';
import { useSettings } from '@/core/hooks';
import { db, getMeta, setMeta } from '@/core/db';
import { fromKey, hm, nowMinutes, todayKey } from '@/core/dates';
import { toast } from '@/core/toast';
import type { TaskData } from '@/modules/life/tasks/model';
import type { EventData } from '@/modules/shared/domain';
import { occurrences } from '@/core/recurrence';

export interface NotifEntry { key: string; title: string; body: string; at: string; link: string; read?: boolean }

/**
 * In-app reminder engine (runs while Daqeeq is open). Shows a toast and, when the user allowed it,
 * a system notification. Respects quiet hours, a per-hour cap, and fires each reminder once per day.
 * Background push while the app is closed needs Web Push keys (documented as Planned).
 */
export function ReminderEngine() {
  const settings = useSettings();
  const ref = useRef(settings);
  ref.current = settings;

  useEffect(() => {
    const tick = async () => {
      const s = ref.current;
      const today = todayKey();
      const now = nowMinutes();
      const quietS = hm(s.notifications.quietStart) ?? 0;
      const quietE = hm(s.notifications.quietEnd) ?? 0;
      const quiet = quietS > quietE ? now >= quietS || now < quietE : now >= quietS && now < quietE;
      if (quiet) return;

      const due: NotifEntry[] = [];
      const add = (key: string, at: number | null, title: string, body: string, link: string) => {
        if (at === null) return;
        if (now >= at && now < at + 3) due.push({ key: `${today}:${key}`, title, body, at: new Date().toISOString(), link });
      };

      const recs = await db().records.where('type').anyOf('reminder', 'task', 'event', 'habit', 'medication').filter((r) => !r.deleted_at).toArray();
      const dow = fromKey(today).getDay();
      for (const r of recs) {
        const d = r.data as Record<string, any>;
        if (r.type === 'reminder' && r.status !== 'off' && (d.days ?? []).includes(dow)) add(r.id, hm(d.time), d.label, '', '/life/today');
        if (r.type === 'task' && r.status !== 'done') {
          const t = d as TaskData;
          const day = t.start ?? t.due;
          const time = t.start ? t.start_time : t.due_time;
          if (day === today && time) add(r.id, (hm(time) ?? 0) - (t.reminder_min ?? 10), t.title, time, '/life/today');
        }
        if (r.type === 'event') {
          const e = d as EventData;
          const on = e.recurrence ? occurrences(e.recurrence, e.start, today, today).length > 0 : e.start === today;
          if (on && e.start_time && e.reminder_min != null) add(r.id, (hm(e.start_time) ?? 0) - e.reminder_min, e.title, e.start_time, '/life/calendar');
        }
        if (r.type === 'habit' && d.reminder && r.status !== 'archived') add(r.id, hm(d.reminder), `${d.icon ?? ''} ${d.name}`, '', '/life/habits');
        if (r.type === 'medication' && r.status !== 'stopped') for (const t of (d.times ?? []) as string[]) add(`${r.id}:${t}`, hm(t), `💊 ${d.name}`, d.dose ?? '', '/health/medication');
      }
      if (!due.length) return;

      const fired = await getMeta<string[]>('notif_fired', []);
      const log = await getMeta<NotifEntry[]>('notif_log', []);
      const hourAgo = Date.now() - 3600_000;
      let sentThisHour = log.filter((l) => Date.parse(l.at) > hourAgo).length;
      const fresh = due.filter((d) => !fired.includes(d.key));
      for (const n of fresh) {
        if (sentThisHour >= s.notifications.maxPerHour) break;
        sentThisHour++;
        toast(`🔔 ${n.title}${n.body ? ` · ${n.body}` : ''}`, { ttl: 8000 });
        if (s.notifications.enabled && 'Notification' in window && Notification.permission === 'granted') {
          try {
            const reg = await navigator.serviceWorker?.getRegistration();
            if (reg) await reg.showNotification(n.title, { body: n.body, icon: '/icon-192.png', tag: n.key, data: { url: n.link } });
            else new Notification(n.title, { body: n.body, icon: '/icon-192.png', tag: n.key });
          } catch { /* ignore */ }
        }
        log.unshift(n);
      }
      await setMeta('notif_fired', [...fresh.map((f) => f.key), ...fired].filter((k) => k.startsWith(today)).slice(0, 500));
      await setMeta('notif_log', log.slice(0, 100));
    };
    void tick();
    const iv = setInterval(() => { void tick(); }, 30_000);
    return () => clearInterval(iv);
  }, []);

  return null;
}
