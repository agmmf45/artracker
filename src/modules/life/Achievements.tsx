import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Trophy, Gift, Plus, Lock, Sparkles, Check, EyeOff, Sprout } from 'lucide-react';
import clsx from 'clsx';
import { useI18n } from '@/core/i18n';
import { updateSettings, useRecords, useSettings } from '@/core/hooks';
import { db } from '@/core/db';
import { create, remove } from '@/core/repo';
import { todayKey } from '@/core/dates';
import { grantXp, useXp } from '@/core/xp';
import { toast } from '@/core/toast';
import { confirm, Modal } from '@/design/overlay';
import { Bar, Button, Card, EmptyState, IconButton, Input, PageHeader, Segmented, Stat } from '@/design/ui';
import { DEFAULT_LEVEL_TITLES, SKILLS, levelTitle, xpForLevel } from '@shared/xp';
import { ACHIEVEMENTS } from './achievements/engine';
import { confetti } from '@/app/AchievementWatcher';
import { indexLogs, isPaused, isScheduled, logDone, type HabitData } from './habits/model';

const SKILL_L: Record<string, [string, string, string]> = {
  knowledge: ['المعرفة', 'Knowledge', '🧠'], discipline: ['الانضباط', 'Discipline', '🎯'], creativity: ['الإبداع', 'Creativity', '🎨'], fitness: ['اللياقة', 'Fitness', '💪'],
  productivity: ['الإنتاجية', 'Productivity', '⚡'], finance: ['الوعي المالي', 'Financial awareness', '💰'], growth: ['النمو الشخصي', 'Personal growth', '🌱'],
};

export default function Achievements() {
  const { L, lang } = useI18n();
  const settings = useSettings();
  const xp = useXp();
  const unlocked = useRecords<{ key: string }>('achievement');
  const rewards = useRecords<{ name: string; cost: number; icon: string }>('reward');
  const redemptions = useRecords<{ reward_id: string; cost: number; name: string }>('redemption');
  const [tab, setTab] = useState<'journey' | 'achievements' | 'shop'>('journey');
  const [newReward, setNewReward] = useState(false);
  const g = settings.gamification;

  if (!g.enabled) return (
    <div><PageHeader title={L('رحلتي', 'Journey')} /><EmptyState icon={<Trophy size={30} />} title={L('النقاط والمستويات معطّلة', 'XP and levels are turned off')} hint={L('دقيق يعمل بكامله بدونها. فعّلها من الإعدادات إذا رغبت.', 'Daqeeq works fully without them. Turn them on in Settings if you like.')} /></div>
  );

  const have = new Map((unlocked ?? []).map((u) => [u.data.key, u.date]));
  const lv = xp?.level;
  const titles = g.levelTitles ?? DEFAULT_LEVEL_TITLES;

  return (
    <div>
      <PageHeader title={L('رحلتي', 'Journey')} subtitle={L('تقدّم حقيقي، بلا عقاب على الأيام الفائتة.', 'Real progress, no penalties for missed days.')}
        actions={<Segmented value={tab} onChange={setTab} options={[{ value: 'journey', label: L('الرحلة', 'Journey') }, { value: 'achievements', label: L('الإنجازات', 'Achievements') }, { value: 'shop', label: L('المكافآت', 'Rewards') }]} />} />

      {tab === 'journey' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <Card className="p-5" style={{ borderTop: '3px solid var(--reward)' }}>
              <div className="flex flex-wrap items-center gap-4">
                <div className="grid size-20 place-items-center rounded-full bg-[color-mix(in_oklab,var(--reward)_38%,transparent)]"><div className="text-center"><div className="num text-3xl font-black text-reward">{lv?.level ?? 1}</div><div className="text-[10px] text-fg-3">{L('مستوى', 'level')}</div></div></div>
                <div className="min-w-0 flex-1">
                  <div className="text-xl font-black">{levelTitle(lv?.level ?? 1, titles, lang)}</div>
                  <div className="num mt-1 text-sm text-fg-2">{xp?.total ?? 0} XP · {lv ? lv.need - lv.into : 100} {L('للمستوى التالي', 'to next level')}</div>
                  <Bar className="mt-2" value={lv?.into ?? 0} max={lv?.need ?? 100} color="var(--reward)" />
                </div>
                <Stat label={L('عملات', 'Coins')} value={`🪙 ${xp?.coins ?? 0}`} />
              </div>
            </Card>
            {!g.vacation ? <Quests /> : <Card className="p-4 text-sm text-fg-2">🌴 {L('وضع الإجازة مفعّل — المهام اليومية متوقفة، ولا شيء يُحسب غياباً.', 'Vacation mode is on — daily quests are paused and nothing counts as missed.')}</Card>}
            <Card className="p-4">
              <div className="mb-3 text-[13px] font-bold text-fg-2">{L('شجرة المهارات (من أنشطتك المسجّلة)', 'Skill tree (from your logged activities)')}</div>
              <div className="grid gap-3 sm:grid-cols-2">
                {SKILLS.map((s) => {
                  const v = Math.max(0, xp?.bySkill[s] ?? 0);
                  const sl = Math.floor(Math.sqrt(v / 25)) + 1;
                  const next = (sl ** 2) * 25;
                  const prev = ((sl - 1) ** 2) * 25;
                  return (
                    <div key={s}>
                      <div className="mb-1 flex text-sm"><span className="flex-1">{SKILL_L[s][2]} {L(SKILL_L[s][0], SKILL_L[s][1])}</span><span className="num text-fg-2">{L('مستوى', 'Lv')} {sl}</span></div>
                      <Bar value={v - prev} max={next - prev} color="var(--reward)" />
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] text-fg-3">{L('المهارات تعكس أنشطة سجّلتها، وليست قياساً لذكائك أو كفاءتك المهنية.', 'Skills reflect activities you logged — not a measure of intelligence or professional competence.')}</p>
            </Card>
          </div>
          <div className="space-y-4">
            {g.garden && <Garden xp={xp?.total ?? 0} />}
            <Card className="p-4">
              <div className="mb-2 text-[13px] font-bold text-fg-2">{L('آخر الإنجازات', 'Recent wins')}</div>
              {!xp?.recent.length ? <p className="text-sm text-fg-3">{L('أكمل مهمة أو عادة لتبدأ رحلتك.', 'Complete a task or habit to start your journey.')}</p> : (
                <ul className="space-y-1.5 text-sm">{xp.recent.map((r) => <li key={r.id} className="flex gap-2"><span className="min-w-0 flex-1 truncate">{r.label ?? '—'}</span><span className="num font-bold text-reward">+{r.amount}</span></li>)}</ul>
              )}
            </Card>
            <Card className="p-4">
              <div className="mb-2 text-[13px] font-bold text-fg-2">{L('المستويات القادمة', 'Upcoming levels')}</div>
              <ul className="space-y-1 text-sm">{titles.filter(([l]) => l > (lv?.level ?? 1)).slice(0, 4).map(([l, ar, en]) => <li key={l} className="flex gap-2"><span className="flex-1">{L(ar, en)}</span><span className="num text-fg-3">{L('مستوى', 'Lv')} {l} · {xpForLevel(l)} XP</span></li>)}</ul>
            </Card>
          </div>
        </div>
      )}

      {tab === 'achievements' && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {ACHIEVEMENTS.map((a) => {
            const on = have.has(a.key);
            return (
              <Card key={a.key} className={clsx('p-4 text-center', !on && 'opacity-55')}>
                <div className={clsx('mx-auto mb-2 grid size-14 place-items-center rounded-full text-3xl', on ? 'bg-[color-mix(in_oklab,var(--reward)_38%,transparent)]' : 'bg-surface-2 grayscale')}>{on ? a.icon : <Lock size={20} className="text-fg-3" />}</div>
                <div className="font-bold">{L(a.ar, a.en)}</div>
                <div className="text-[12px] text-fg-2">{L(a.dar, a.den)}</div>
                {on && <div className="num mt-1 text-[11px] text-reward">{have.get(a.key)?.slice(0, 10)}</div>}
              </Card>
            );
          })}
        </div>
      )}

      {tab === 'shop' && (
        <div>
          <div className="mb-3 flex items-center gap-3"><span className="text-sm text-fg-2">{L('رصيدك', 'Balance')}: <b className="num text-reward">🪙 {xp?.coins ?? 0}</b> · {L('كل 10 XP = عملة', '10 XP = 1 coin')}</span><span className="flex-1" /><Button icon={<Plus size={16} />} onClick={() => setNewReward(true)}>{L('مكافأة', 'Reward')}</Button></div>
          <p className="mb-4 text-[12px] text-fg-3">{L('كافئ نفسك بأشياء تحبها. الراحة والأكل والعناية بالنفس ليست مكافآت تُكتسب — هي حق دائم.', 'Treat yourself to things you enjoy. Rest, meals and self-care are never rewards to be earned — they are always yours.')}</p>
          {!rewards?.length ? <EmptyState icon={<Gift size={28} />} title={L('أضف مكافآت حقيقية تحبها', 'Add real-life rewards you love')} hint={L('فيلم، كتاب، وجبة مفضلة، يوم إجازة…', 'A movie, a book, a favourite meal, a day off…')} /> : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rewards.map((r) => {
                const can = (xp?.coins ?? 0) >= r.data.cost;
                return (
                  <Card key={r.id} className="flex items-center gap-3 p-4">
                    <span className="text-3xl">{r.data.icon}</span>
                    <div className="min-w-0 flex-1"><div className="font-bold">{r.data.name}</div><div className="num text-sm text-reward">🪙 {r.data.cost}</div></div>
                    <Button size="sm" variant={can ? 'primary' : 'secondary'} disabled={!can} onClick={async () => {
                      if (!(await confirm(L(`استبدل ${r.data.cost} عملة بـ «${r.data.name}»؟`, `Spend ${r.data.cost} coins on “${r.data.name}”?`)))) return;
                      await create('redemption', { reward_id: r.id, cost: r.data.cost, name: r.data.name }, { date: todayKey() });
                      if (settings.gamification.animations) confetti();
                      toast(L('استمتع! 🎁', 'Enjoy! 🎁'), { tone: 'reward' });
                    }}>{L('استبدل', 'Redeem')}</Button>
                    <IconButton size="sm" tone="danger" label={L('حذف', 'Delete')} onClick={() => remove(r.id)}><EyeOff size={14} /></IconButton>
                  </Card>
                );
              })}
            </div>
          )}
          {!!redemptions?.length && <p className="mt-4 text-[12px] text-fg-3">{L('آخر الاستبدالات:', 'Recent redemptions:')} {[...redemptions].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5).map((r) => r.data.name).join('، ')}</p>}
          {newReward && <RewardEditor onClose={() => setNewReward(false)} />}
        </div>
      )}
    </div>
  );
}

function RewardEditor({ onClose }: { onClose: () => void }) {
  const { L } = useI18n();
  const [name, setName] = useState('');
  const [cost, setCost] = useState(50);
  const [icon, setIcon] = useState('🎁');
  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title={L('مكافأة جديدة', 'New reward')} footer={<Button variant="primary" disabled={!name.trim()} onClick={async () => { await create('reward', { name: name.trim(), cost: Math.max(1, cost), icon }); onClose(); }}>{L('حفظ', 'Save')}</Button>}>
      <div className="space-y-3">
        <div className="flex gap-2"><input className="field w-14 text-center text-xl" value={icon} onChange={(e) => setIcon(e.target.value)} aria-label={L('أيقونة', 'Icon')} /><Input className="flex-1" value={name} onChange={(e) => setName(e.target.value)} placeholder={L('مثال: فيلم في السينما', 'e.g. a cinema night')} autoFocus /></div>
        <Input type="number" min={1} label={L('السعر (عملات)', 'Price (coins)')} value={cost} onChange={(e) => setCost(Number(e.target.value) || 1)} />
      </div>
    </Modal>
  );
}

/** Daily quests generated from the user's own plan — realistic, optional, hideable. */
function Quests() {
  const { L } = useI18n();
  const settings = useSettings();
  const today = todayKey();
  const hidden: string[] = (settings.gamification as unknown as { hiddenQuests?: string[] }).hiddenQuests ?? [];
  const state = useLiveQuery(async () => {
    const rs = await db().records.where('type').anyOf('task', 'study_session', 'habit', 'habit_log', 'journal', 'review', 'xp').filter((r) => !r.deleted_at).toArray();
    const top = (settings as unknown as { top3?: { date: string; ids: string[] } }).top3;
    const topId = top?.date === today ? top.ids[0] : null;
    const tasksDoneToday = rs.filter((r) => r.type === 'task' && r.status === 'done' && String((r.data as { completed_at?: string }).completed_at ?? '').slice(0, 10) === today);
    const habits = rs.filter((r) => r.type === 'habit' && r.status !== 'archived') as unknown as Array<{ id: string; data: HabitData }>;
    const idx = indexLogs(rs.filter((r) => r.type === 'habit_log' && r.date === today) as never);
    const sched = habits.filter((h) => isScheduled(h.data, today) && !isPaused(h.data, today));
    const claimed = new Set(rs.filter((r) => r.type === 'xp' && r.id.startsWith(`xp:quest:${today}:`)).map((r) => r.id.split(':')[3]));
    return {
      claimed,
      list: [
        { id: 'top', ar: 'أنجز أولويتك الأولى', en: 'Complete your top priority', done: topId ? tasksDoneToday.some((t) => t.id === topId) : tasksDoneToday.some((t) => Number((t.data as { priority?: number }).priority) >= 3) },
        { id: 'focus', ar: 'أكمل جلسة مذاكرة واحدة', en: 'Finish one study session', done: rs.some((r) => r.type === 'study_session' && r.date === today) },
        { id: 'habits', ar: 'أكمل عادات اليوم', en: "Complete today's habits", done: sched.length > 0 && sched.every((h) => logDone(h.data, idx.get(h.id)?.get(today) as never)) },
        { id: 'reflect', ar: 'دوّن يومك أو راجعه', en: 'Journal or review your day', done: rs.some((r) => (r.type === 'journal' || r.type === 'review') && r.date === today) },
      ],
    };
  }, [today, settings]);
  const list = (state?.list ?? []).filter((q) => !hidden.includes(q.id));
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-2 text-[13px] font-bold text-fg-2"><Sparkles size={15} className="text-reward" />{L('مهام اليوم (اختيارية)', "Today's quests (optional)")}</div>
      <ul className="space-y-2">
        {list.map((q) => {
          const claimed = state?.claimed.has(q.id);
          return (
            <li key={q.id} className="flex items-center gap-3">
              <span className={clsx('grid size-6 place-items-center rounded-full border-2', q.done ? 'border-reward bg-reward text-on-accent' : 'border-line-strong')}>{q.done && <Check size={14} />}</span>
              <span className={clsx('flex-1 text-sm', q.done && 'text-fg-2')}>{L(q.ar, q.en)}</span>
              {q.done && !claimed && <Button size="sm" variant="primary" onClick={() => grantXp(`quest:${today}:${q.id}`, 'quest', settings, L(q.ar, q.en))}>+XP</Button>}
              {claimed && <span className="text-[12px] font-bold text-reward">✓</span>}
              <IconButton size="sm" label={L('أخفِ هذه المهمة', 'Hide this quest')} onClick={() => updateSettings({ gamification: { hiddenQuests: [...hidden, q.id] } } as never)}><EyeOff size={13} /></IconButton>
            </li>
          );
        })}
      </ul>
      {hidden.length > 0 && <button className="mt-2 text-[12px] text-fg-3 hover:text-fg" onClick={() => updateSettings({ gamification: { hiddenQuests: [] } } as never)}>{L('أظهر المخفية', 'Show hidden')}</button>}
    </Card>
  );
}

/** Optional growth garden: one sprout per 50 XP, deterministic layout, never shrinks. */
function Garden({ xp }: { xp: number }) {
  const { L } = useI18n();
  const plants = useMemo(() => {
    const n = Math.min(60, Math.floor(xp / 50));
    let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    return Array.from({ length: n }, (_, i) => ({ x: 14 + rnd() * 272, y: 60 + rnd() * 70, s: 0.6 + rnd() * 0.7, kind: i % 5 === 4 ? '🌸' : i % 7 === 6 ? '🌳' : i % 3 === 2 ? '🌿' : '🌱' }));
  }, [xp]);
  return (
    <Card className="overflow-hidden p-4">
      <div className="mb-2 flex items-center gap-2 text-[13px] font-bold text-fg-2"><Sprout size={15} className="text-health" />{L('حديقتي', 'My garden')}<span className="num ms-auto font-normal text-fg-3">{plants.length}</span></div>
      <svg viewBox="0 0 300 150" className="w-full rounded-md" style={{ background: 'linear-gradient(var(--surface-2), color-mix(in oklab, var(--health) 38%, var(--surface)))' }} role="img" aria-label={L(`${plants.length} نبتة`, `${plants.length} plants`)}>
        <rect x="0" y="120" width="300" height="30" fill="color-mix(in oklab, var(--health) 25%, var(--surface))" />
        {plants.sort((a, b) => a.y - b.y).map((p, i) => <text key={i} x={p.x} y={p.y} fontSize={18 * p.s} textAnchor="middle">{p.kind}</text>)}
        {!plants.length && <text x="150" y="80" textAnchor="middle" fontSize="12" fill="var(--text-3)">{L('كل 50 XP تزرع نبتة', 'Every 50 XP plants a sprout')}</text>}
      </svg>
    </Card>
  );
}
