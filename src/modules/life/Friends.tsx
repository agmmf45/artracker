import { useCallback, useEffect, useState } from 'react';
import { Copy, UserPlus, Check, X, Users, Flame, Trophy } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useProfile, useRecords, useRecordsInRange, useSettings } from '@/core/hooks';
import { api } from '@/core/api';
import { upsert } from '@/core/repo';
import { useXp } from '@/core/xp';
import { todayKey, shiftKey } from '@/core/dates';
import { toast } from '@/core/toast';
import { confirm } from '@/design/overlay';
import { Bar, Button, Card, EmptyState, IconButton, Input, PageHeader, Section } from '@/design/ui';
import { Avatar } from '@/modules/shared/Avatar';
import { indexLogs, isPaused, isScheduled, logDone, streak, type HabitData, type HabitLogData } from './habits/model';

interface FriendCard { code: string | null; name: string; avatar_emoji: string | null; avatar_color: string | null; avatar_photo: string | null; status_note: string | null; level: number | null; streak: number | null; today: { date: string; pct: number } | null }
interface FriendsResp { code: string; friends: FriendCard[]; incoming: FriendCard[]; outgoing: FriendCard[] }

/**
 * Friends (kept from v4, rebuilt securely). Friends only see your public card: name, avatar, status,
 * level, best streak and today's habit %. Never tasks, notes, money or health data.
 */
export default function Friends() {
  const { L } = useI18n();
  const settings = useSettings();
  const profile = useProfile();
  const xp = useXp();
  const habits = useRecords<HabitData>('habit');
  const logs = useRecordsInRange<HabitLogData>('habit_log', shiftKey(todayKey(), -400), todayKey());
  const [data, setData] = useState<FriendsResp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api<FriendsResp>('/v2/friends').then((r) => { setData(r); setErr(null); }).catch((e) => setErr((e as Error).message)), []);
  useEffect(() => { void load(); const iv = setInterval(load, 60_000); return () => clearInterval(iv); }, [load]);

  // publish my shareable card fields (computed from real data)
  useEffect(() => {
    if (!xp || !habits || !logs || profile.share_progress === false) return;
    const today = todayKey();
    const idx = indexLogs(logs);
    const active = habits.filter((h) => h.status !== 'archived');
    const sched = active.filter((h) => isScheduled(h.data, today) && !isPaused(h.data, today));
    const pct = sched.length ? Math.round((sched.filter((h) => logDone(h.data, idx.get(h.id)?.get(today))).length / sched.length) * 100) : 0;
    const best = Math.max(0, ...active.map((h) => streak(h.data, idx.get(h.id), today, settings.weekStart)));
    const level = settings.gamification.enabled ? xp.level.level : null;
    const cur = profile as unknown as { level?: number | null; best_streak?: number; today?: { date: string; pct: number } };
    if (cur.level !== level || cur.best_streak !== best || cur.today?.date !== today || cur.today?.pct !== pct) {
      void upsert('profile', 'profile', { level, best_streak: best, today: { date: today, pct } });
    }
  }, [xp, habits, logs, profile, settings.weekStart, settings.gamification.enabled]);

  const act = async (path: string, c: string | null, ok: string) => {
    if (!c) return;
    setBusy(true);
    try { await api(`/v2/friends/${path}`, { code: c }); toast(ok); await load(); } catch (e) { toast((e as Error).message, { tone: 'error' }); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={L('الأصدقاء', 'Friends')} subtitle={L('شارك تقدمك مع من تحب — بدون مقارنات مزعجة أو لوحات صدارة عامة.', 'Share progress with people you choose — no public leaderboards.')} />
      {err && <p className="mb-4 rounded-sm bg-surface-2 px-3 py-2 text-sm text-fg-2">{L('الأصدقاء يحتاجون اتصالاً بالإنترنت.', 'Friends need an internet connection.')} ({err})</p>}
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1"><div className="text-[12px] font-bold text-fg-3">{L('كودك', 'Your code')}</div><div className="num text-2xl font-black tracking-widest" dir="ltr">{data?.code ?? '······'}</div></div>
          <Button icon={<Copy size={15} />} disabled={!data} onClick={async () => { try { await navigator.clipboard.writeText(data!.code); toast(L('نُسخ الكود', 'Code copied')); } catch { toast(data!.code); } }}>{L('نسخ', 'Copy')}</Button>
        </div>
        <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); void act('request', code.trim().toUpperCase(), L('أُرسل الطلب', 'Request sent')); setCode(''); }}>
          <Input className="flex-1" dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} placeholder={L('كود صديقك', "Friend's code")} aria-label={L('كود صديقك', "Friend's code")} />
          <Button type="submit" variant="primary" icon={<UserPlus size={16} />} loading={busy} disabled={code.trim().length < 4}>{L('أضف', 'Add')}</Button>
        </form>
        {profile.share_progress === false && <p className="mt-2 text-[12px] text-fg-3">{L('المشاركة مطفأة: أصدقاؤك يرون اسمك وصورتك فقط.', 'Sharing is off: friends only see your name and photo.')}</p>}
      </Card>

      {!!data?.incoming.length && (
        <Section title={L('طلبات واردة', 'Incoming requests')}>
          <Card className="divide-y divide-line">{data.incoming.map((f) => (
            <div key={f.code} className="flex items-center gap-3 px-4 py-3"><Avatar profile={f} size={36} name={f.name} /><span className="flex-1 font-bold">{f.name}</span>
              <IconButton label={L('قبول', 'Accept')} onClick={() => act('accept', f.code, L('صرتوا أصدقاء 🎉', 'You are now friends 🎉'))}><Check size={18} className="text-success" /></IconButton>
              <IconButton label={L('رفض', 'Decline')} onClick={() => act('reject', f.code, L('رُفض الطلب', 'Declined'))}><X size={18} /></IconButton></div>
          ))}</Card>
        </Section>
      )}
      {!!data?.outgoing.length && (
        <Section title={L('طلبات مرسلة', 'Sent requests')}>
          <Card className="divide-y divide-line">{data.outgoing.map((f) => (
            <div key={f.code} className="flex items-center gap-3 px-4 py-2.5"><Avatar profile={f} size={30} name={f.name} /><span className="flex-1 text-sm">{f.name}</span><Button size="sm" variant="ghost" onClick={() => act('cancel', f.code, L('أُلغي الطلب', 'Request cancelled'))}>{L('إلغاء', 'Cancel')}</Button></div>
          ))}</Card>
        </Section>
      )}
      <Section title={L('أصدقائي', 'My friends')}>
        {!data?.friends.length ? <EmptyState icon={<Users size={28} />} title={L('شارك كودك مع صديق', 'Share your code with a friend')} hint={L('تشجيع متبادل، بدون ضغط.', 'Mutual encouragement, no pressure.')} /> : (
          <div className="grid gap-3 sm:grid-cols-2">{data.friends.map((f) => (
            <Card key={f.code} className="p-4">
              <div className="flex items-center gap-3"><Avatar profile={f} size={44} name={f.name} /><div className="min-w-0 flex-1"><div className="truncate font-bold">{f.name}</div>{f.status_note && <div className="truncate text-[13px] text-fg-2">{f.status_note}</div>}</div>
                <IconButton size="sm" label={L('إزالة', 'Remove')} onClick={async () => { if (await confirm(L(`إزالة ${f.name}؟`, `Remove ${f.name}?`))) await act('remove', f.code, L('أُزيل', 'Removed')); }}><X size={15} /></IconButton></div>
              <div className="mt-3 flex flex-wrap gap-3 text-[13px] text-fg-2">
                {f.level != null && <span className="inline-flex items-center gap-1"><Trophy size={13} className="text-reward" />{L('مستوى', 'Level')} {f.level}</span>}
                {f.streak != null && f.streak > 0 && <span className="inline-flex items-center gap-1"><Flame size={13} className="text-reward" />{f.streak}</span>}
              </div>
              {f.today?.date === todayKey() && <div className="mt-2"><div className="mb-1 text-[12px] text-fg-3">{L('عادات اليوم', "Today's habits")} {f.today.pct}%</div><Bar value={f.today.pct} max={100} color="var(--life)" /></div>}
            </Card>
          ))}</div>
        )}
      </Section>
    </div>
  );
}
