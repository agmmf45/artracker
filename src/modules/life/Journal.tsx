import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Plus, Lock, BookHeart, Trash2, X, Check } from 'lucide-react';
import clsx from 'clsx';
import type { Rec } from '@shared/records';
import { useI18n } from '@/core/i18n';
import { useRecords, useSettings } from '@/core/hooks';
import { create, remove, revertTo, update } from '@/core/repo';
import { fmtDate, fromKey, monthGrid, rangeKeys, shiftKey, todayKey } from '@/core/dates';
import { undoToast } from '@/core/toast';
import { Button, Card, EmptyState, IconButton, PageHeader, Segmented } from '@/design/ui';
import { Line } from '@/design/charts';
import { plainText, RichText } from '@/modules/shared/RichText';
import type { JournalData } from '@/modules/shared/domain';
import { JOURNAL_TEMPLATES } from '@/modules/shared/legacyContent';

const MOODS = ['😞', '😕', '😐', '🙂', '😄'];
const PROMPTS: Array<[string, string, string]> = [
  ['well', 'وش اللي مشى زين اليوم؟', 'What went well today?'],
  ['learned', 'وش تعلمت؟', 'What did I learn?'],
  ['improve', 'وش ممكن أحسّن؟', 'What could I improve?'],
  ['tomorrow', 'وش المهم بكرة؟', 'What matters tomorrow?'],
];

export default function Journal() {
  const { L, locale } = useI18n();
  const settings = useSettings();
  const entries = useRecords<JournalData>('journal');
  const [unlocked, setUnlocked] = useState(!settings.privacy.lockJournal);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [openId, setOpenId] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const id = params.get('open');
    if (!id) return;
    setOpenId(id);
    const next = new URLSearchParams(params); next.delete('open'); setParams(next, { replace: true });
  }, [params, setParams]);
  const setOpen = (r: Rec<JournalData> | null) => setOpenId(r?.id ?? null);
  const open = (entries ?? []).find((e) => e.id === openId) ?? null;
  const [month, setMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  useEffect(() => { setUnlocked(!settings.privacy.lockJournal); }, [settings.privacy.lockJournal]);

  const sorted = useMemo(() => [...(entries ?? [])].sort((a, b) => `${b.date}${b.data.time ?? ''}`.localeCompare(`${a.date}${a.data.time ?? ''}`)), [entries]);
  const byDay = useMemo(() => { const m = new Map<string, Rec<JournalData>[]>(); for (const e of sorted) { const k = e.date ?? ''; if (!m.has(k)) m.set(k, []); m.get(k)!.push(e); } return m; }, [sorted]);
  const moodPts = rangeKeys(shiftKey(todayKey(), -29), 30).map((d) => { const xs = (byDay.get(d) ?? []).filter((e) => e.data.mood); return { x: d.slice(5), y: xs.length ? xs.reduce((s, e) => s + (e.data.mood ?? 0), 0) / xs.length : NaN }; }).filter((p) => !Number.isNaN(p.y));

  const newEntry = async () => {
    const now = new Date();
    const r = await create<JournalData>('journal', { body: '', time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, mood: null, energy: null, prompts: {}, gratitude: [], wins: [] }, { date: todayKey() });
    setOpen(r);
  };

  if (!unlocked) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <div className="text-center">
          <Lock size={32} className="mx-auto text-fg-3" />
          <p className="mt-3 font-bold">{L('اليوميات محمية', 'Journal is locked')}</p>
          <Button className="mt-4" variant="primary" onClick={() => setUnlocked(true)}>{L('افتح', 'Open')}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={L('اليوميات', 'Journal')} subtitle={L('خاصة بك — لا تظهر في البحث العام ولا تُرسل لأي جهة.', 'Private — never in global search, never sent anywhere.')}
        actions={<><Segmented value={view} onChange={setView} options={[{ value: 'list', label: L('خط زمني', 'Timeline') }, { value: 'calendar', label: L('تقويم', 'Calendar') }]} /><Button variant="primary" icon={<Plus size={17} />} onClick={newEntry}>{L('تدوينة', 'Entry')}</Button></>} />

      {moodPts.length >= 2 && (
        <Card className="mb-4 p-4">
          <div className="mb-2 text-[13px] font-bold text-fg-2">{L('مزاجك آخر 30 يوم (كما سجّلته)', 'Your mood, last 30 days (self-reported)')}</div>
          <Line points={moodPts} height={90} color="var(--life)" format={(v) => MOODS[Math.round(v) - 1] ?? v.toFixed(1)} />
        </Card>
      )}

      {!sorted.length ? (
        <EmptyState icon={<BookHeart size={30} />} title={L('صفحة بيضاء، بلا ضغط.', 'A blank page, no pressure.')} hint={L('سطر واحد عن يومك يكفي.', 'One line about your day is enough.')} action={<Button variant="primary" onClick={newEntry}>{L('اكتب أول تدوينة', 'Write your first entry')}</Button>} />
      ) : view === 'list' ? (
        <div className="space-y-3">
          {sorted.map((e) => (
            <button key={e.id} onClick={() => setOpen(e)} className="card block w-full p-4 text-start hover:border-line-strong">
              <div className="flex items-center gap-2 text-[12px] text-fg-3">
                <span className="font-bold text-fg-2">{fmtDate(e.date!, locale)}</span>{e.data.time && <span>· {e.data.time}</span>}
                <span className="ms-auto text-lg">{e.data.mood ? MOODS[e.data.mood - 1] : ''}</span>
              </div>
              {e.data.title && <div className="mt-1 font-bold">{e.data.title}</div>}
              {!settings.privacy.hideJournalPreviews && <p className="mt-1 line-clamp-3 text-sm text-fg-2">{plainText(e.data.body) || Object.values(e.data.prompts ?? {}).join(' · ')}</p>}
            </button>
          ))}
        </div>
      ) : (
        <Card className="p-3">
          <div className="mb-2 flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setMonth(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }))}>‹</Button>
            <div className="flex-1 text-center font-bold">{new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(month.y, month.m, 1))}</div>
            <Button size="sm" variant="ghost" onClick={() => setMonth(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))}>›</Button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthGrid(month.y, month.m, settings.weekStart).map((d) => {
              const es = byDay.get(d) ?? [];
              const mood = es.find((e) => e.data.mood)?.data.mood;
              return (
                <button key={d} disabled={!es.length} onClick={() => setOpen(es[0])} className={clsx('aspect-square rounded-sm text-center text-[12px]', fromKey(d).getMonth() !== month.m && 'opacity-40', es.length ? 'bg-surface-2 hover:bg-line' : 'text-fg-3')}>
                  <div className="num">{fromKey(d).getDate()}</div><div className="text-base leading-none">{mood ? MOODS[mood - 1] : es.length ? '•' : ''}</div>
                </button>
              );
            })}
          </div>
        </Card>
      )}
      {open && <EntryEditor entry={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

const EXTRAS: Array<['prompts' | 'gratitude' | 'win' | 'energy', string, string]> = [
  ['prompts', 'أسئلة تأمل', 'Reflection questions'], ['gratitude', 'امتنان', 'Gratitude'], ['win', 'إنجاز صغير', 'A small win'], ['energy', 'الطاقة', 'Energy'],
];

/**
 * One journal entry: a title, your mood and a page to write on — saved as you type. Reflection
 * questions, gratitude, a small win and energy stay folded behind "+" buttons and only show
 * once you open them or they have something in them.
 */
function EntryEditor({ entry, onClose }: { entry: Rec<JournalData>; onClose: () => void }) {
  const { L, locale } = useI18n();
  const [d, setD] = useState<JournalData>({ gratitude: [], wins: [], ...entry.data, prompts: entry.data.prompts ?? {} });
  const [saved, setSaved] = useState(true);
  const [shown, setShown] = useState<Record<string, boolean>>(() => ({
    prompts: Object.values(entry.data.prompts ?? {}).some((v) => v?.trim()),
    gratitude: (entry.data.gratitude ?? []).some((v) => v?.trim()),
    win: !!entry.data.wins?.[0]?.trim(),
    energy: entry.data.energy != null,
  }));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(d);
  latest.current = d;
  const flush = async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    await update<JournalData>(entry.id, { data: latest.current });
    setSaved(true);
  };
  const set = (p: Partial<JournalData>) => {
    setD((x) => ({ ...x, ...p }));
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 700);
  };
  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); void update<JournalData>(entry.id, { data: latest.current }); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const close = async () => { await flush(); onClose(); };
  const field = 'w-full border-0 border-b-[1.5px] border-dashed border-line bg-transparent px-0.5 py-1.5 text-[15px] outline-none focus:border-solid focus:border-fg-3';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg" role="dialog" aria-modal="true" aria-label={L('تدوينة', 'Journal entry')}>
      <div className="mx-auto max-w-2xl px-4 pb-16 pt-3 sm:px-6 sm:pt-6">
        <div className="sticky top-0 z-20 -mx-4 mb-3 flex items-center gap-2 bg-bg/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
          <IconButton label={L('إغلاق', 'Close')} onClick={() => void close()}><X size={19} /></IconButton>
          <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-fg-2">{L('يوميات', 'Journal')} · {fmtDate(entry.date!, locale, { weekday: 'long', day: 'numeric', month: 'long' })}{d.time ? ` · ${d.time}` : ''}</span>
          <span className={clsx('inline-flex items-center gap-1 text-[12.5px] font-bold', saved ? 'text-success' : 'text-fg-3')} aria-live="polite">{saved ? <><Check size={14} />{L('محفوظ', 'Saved')}</> : L('يحفظ…', 'Saving…')}</span>
          <IconButton tone="danger" label={L('حذف', 'Delete')} onClick={async () => { if (timer.current) clearTimeout(timer.current); const p = await remove(entry.id); onClose(); undoToast(L('حُذفت التدوينة', 'Entry deleted'), async () => { if (p) await revertTo(p); }); }}><Trash2 size={17} /></IconButton>
        </div>

        <input value={d.title ?? ''} onChange={(e) => set({ title: e.target.value })} placeholder={L('عنوان (اختياري)', 'Title (optional)')} aria-label={L('العنوان', 'Title')}
          className="mb-2 w-full bg-transparent text-[24px] font-black outline-none placeholder:text-fg-3" />

        <div className="mb-3 flex flex-wrap items-center gap-1.5" role="group" aria-label={L('المزاج', 'Mood')}>
          {MOODS.map((m, i) => (
            <button key={m} type="button" aria-pressed={d.mood === i + 1} aria-label={`${L('المزاج', 'Mood')} ${i + 1}`} onClick={() => set({ mood: d.mood === i + 1 ? null : i + 1 })}
              className={clsx('grid size-10 place-items-center rounded-full border-[1.5px] text-xl transition-colors', d.mood === i + 1 ? 'border-[color-mix(in_oklab,var(--reward)_60%,var(--fg))] bg-reward' : 'border-line bg-surface hover:bg-surface-2')}>{m}</button>
          ))}
          <span className="ms-1 text-[12.5px] text-fg-3">{d.mood ? '' : L('مزاجك؟ (اختياري)', 'Mood? (optional)')}</span>
        </div>

        <RichText value={d.body} onChange={(body) => set({ body })} autoFocus={!entry.data.body} placeholder={L('اكتب بحرية… ولا أحد يشوفه غيرك.', 'Write freely… only you can see it.')} ariaLabel={L('النص', 'Text')} />

        {shown.energy && (
          <div className="mt-4 border-t-[1.5px] border-dashed border-line pt-3">
            <p className="mb-2 text-[13px] font-bold text-fg-2">{L('الطاقة', 'Energy')}</p>
            <div className="flex gap-1.5">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" aria-pressed={d.energy === n} onClick={() => set({ energy: d.energy === n ? null : n })} className={clsx('num size-10 rounded-full border-[1.5px] font-black', d.energy === n ? 'border-fg bg-fg text-bg' : 'border-line bg-surface')}>{n}</button>)}</div>
          </div>
        )}
        {shown.prompts && (
          <div className="mt-4 space-y-3 border-t-[1.5px] border-dashed border-line pt-3">
            {PROMPTS.map(([k, ar, en]) => (
              <label key={k} className="block"><span className="mb-0.5 block text-[13px] font-bold text-fg-2">{L(ar, en)}</span>
                <input className={field} value={d.prompts?.[k] ?? ''} onChange={(e) => set({ prompts: { ...(d.prompts ?? {}), [k]: e.target.value } })} /></label>
            ))}
          </div>
        )}
        {shown.gratitude && (
          <div className="mt-4 border-t-[1.5px] border-dashed border-line pt-3">
            <p className="mb-1 text-[13px] font-bold text-fg-2">{L('ممتن لـ…', 'Grateful for…')}</p>
            {[0, 1, 2].map((i) => <input key={i} className={field} value={d.gratitude?.[i] ?? ''} placeholder={i === 0 ? L('شي صغير يكفي…', 'Something small is enough…') : ''} aria-label={`${L('امتنان', 'Gratitude')} ${i + 1}`}
              onChange={(e) => { const g = [...(d.gratitude ?? [])]; g[i] = e.target.value; set({ gratitude: g }); }} />)}
          </div>
        )}
        {shown.win && (
          <div className="mt-4 border-t-[1.5px] border-dashed border-line pt-3">
            <label className="block"><span className="mb-0.5 block text-[13px] font-bold text-fg-2">{L('إنجاز صغير اليوم', 'A small win today')}</span>
              <input className={field} value={d.wins?.[0] ?? ''} onChange={(e) => set({ wins: [e.target.value] })} /></label>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-1.5">
          {EXTRAS.filter(([k]) => !shown[k]).map(([k, ar, en]) => (
            <button key={k} type="button" onClick={() => setShown((x) => ({ ...x, [k]: true }))} className="inline-flex min-h-9 items-center rounded-full border-[1.5px] border-dashed border-line-strong px-3 text-[13px] font-semibold text-fg-2 hover:border-solid hover:text-fg">+ {L(ar, en)}</button>
          ))}
          <select className="h-9 rounded-full border-[1.5px] border-dashed border-line-strong bg-transparent px-3 text-[13px] font-semibold text-fg-2" value="" aria-label={L('قالب', 'Template')}
            onChange={(e) => { const t = JOURNAL_TEMPLATES[e.target.value]; if (t) set({ body: d.body ? `${d.body}\n\n${t.text}` : t.text }); }}>
            <option value="">+ {L('قالب', 'Template')}</option>{Object.entries(JOURNAL_TEMPLATES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}
