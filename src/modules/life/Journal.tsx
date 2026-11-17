import { useEffect, useMemo, useState } from 'react';
import { Plus, Lock, BookHeart, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import type { Rec } from '@shared/records';
import { useI18n } from '@/core/i18n';
import { useRecords, useSettings } from '@/core/hooks';
import { create, remove, revertTo, update } from '@/core/repo';
import { fmtDate, fromKey, monthGrid, rangeKeys, shiftKey, todayKey } from '@/core/dates';
import { undoToast } from '@/core/toast';
import { Button, Card, EmptyState, IconButton, Input, Label, PageHeader, Segmented, Textarea } from '@/design/ui';
import { Line } from '@/design/charts';
import { Markdown } from '@/modules/shared/markdown';
import type { JournalData } from '@/modules/shared/domain';

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
  const [open, setOpen] = useState<Rec<JournalData> | null>(null);
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
              {!settings.privacy.hideJournalPreviews && <p className="mt-1 line-clamp-3 text-sm text-fg-2">{e.data.body || Object.values(e.data.prompts ?? {}).join(' · ')}</p>}
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

function EntryEditor({ entry, onClose }: { entry: Rec<JournalData>; onClose: () => void }) {
  const { L, locale } = useI18n();
  const [d, setD] = useState<JournalData>({ gratitude: [], wins: [], ...entry.data, prompts: entry.data.prompts ?? {} });
  const [preview, setPreview] = useState(!!entry.data.body);
  const set = (p: Partial<JournalData>) => setD((x) => ({ ...x, ...p }));
  const save = async () => { await update<JournalData>(entry.id, { data: d }); onClose(); };
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg">
      <div className="mx-auto max-w-2xl px-5 py-8">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex-1"><div className="eyebrow">{fmtDate(entry.date!, locale)}</div><input value={d.title ?? ''} onChange={(e) => set({ title: e.target.value })} placeholder={L('عنوان (اختياري)', 'Title (optional)')} className="w-full bg-transparent text-2xl font-black outline-none placeholder:text-fg-3" /></div>
          <IconButton tone="danger" label={L('حذف', 'Delete')} onClick={async () => { const p = await remove(entry.id); onClose(); undoToast(L('حُذفت التدوينة', 'Entry deleted'), async () => { if (p) await revertTo(p); }); }}><Trash2 size={17} /></IconButton>
          <Button variant="ghost" onClick={onClose}>{L('إغلاق', 'Close')}</Button>
          <Button variant="primary" onClick={save}>{L('حفظ', 'Save')}</Button>
        </div>
        <div className="mb-5 grid grid-cols-2 gap-4">
          <div>
            <Label>{L('المزاج', 'Mood')}</Label>
            <div className="flex gap-1">{MOODS.map((m, i) => <button key={m} aria-pressed={d.mood === i + 1} aria-label={`${i + 1}`} onClick={() => set({ mood: d.mood === i + 1 ? null : i + 1 })} className={clsx('size-10 rounded-full text-xl transition-transform', d.mood === i + 1 ? 'scale-110 bg-surface-2 ring-2 ring-life' : 'opacity-60 hover:opacity-100')}>{m}</button>)}</div>
          </div>
          <div>
            <Label>{L('الطاقة', 'Energy')}</Label>
            <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} aria-pressed={d.energy === n} onClick={() => set({ energy: d.energy === n ? null : n })} className={clsx('num size-10 rounded-full font-black', (d.energy ?? 0) >= n ? 'bg-health text-on-accent' : 'bg-surface-2 text-fg-3')}>{n}</button>)}</div>
          </div>
        </div>
        <div className="mb-2 flex justify-end"><Segmented size="sm" value={preview ? 'p' : 'e'} onChange={(v) => setPreview(v === 'p')} options={[{ value: 'e', label: L('كتابة', 'Write') }, { value: 'p', label: L('عرض', 'Read') }]} /></div>
        {preview ? <div className="min-h-40" onDoubleClick={() => setPreview(false)}><Markdown text={d.body || L('*لا شيء بعد*', '*Nothing yet*')} /></div>
          : <textarea autoFocus value={d.body} onChange={(e) => set({ body: e.target.value })} placeholder={L('اكتب بحرية…', 'Write freely…')} className="min-h-56 w-full resize-y bg-transparent text-[17px] leading-[1.9] outline-none placeholder:text-fg-3" />}
        <div className="mt-6 space-y-4 border-t border-line pt-5">
          {PROMPTS.map(([k, ar, en]) => <Textarea key={k} label={L(ar, en)} className="[&_textarea]:min-h-16" value={d.prompts?.[k] ?? ''} onChange={(e) => set({ prompts: { ...(d.prompts ?? {}), [k]: e.target.value } })} />)}
          <div>
            <Label>{L('ممتن لـ (3 أشياء)', 'Grateful for (3 things)')}</Label>
            {[0, 1, 2].map((i) => <Input key={i} className="mb-1.5" value={d.gratitude?.[i] ?? ''} onChange={(e) => { const g = [...(d.gratitude ?? [])]; g[i] = e.target.value; set({ gratitude: g }); }} aria-label={`${i + 1}`} />)}
          </div>
          <Input label={L('إنجاز صغير اليوم', 'A small win today')} value={d.wins?.[0] ?? ''} onChange={(e) => set({ wins: [e.target.value] })} />
        </div>
      </div>
    </div>
  );
}
