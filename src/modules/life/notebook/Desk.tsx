import { useState } from 'react';
import clsx from 'clsx';
import type { Rec } from '@shared/records';
import { useI18n } from '@/core/i18n';
import { db } from '@/core/db';
import { create } from '@/core/repo';
import { fmtDate, rangeKeys, shiftKey, todayKey } from '@/core/dates';
import { toast } from '@/core/toast';
import { blankNote, type JournalData, type NoteData } from '@/modules/shared/domain';
import { dayPageId, patchDayPage, type DayPageData } from '../today/dayPage';

type Mode = 'journal' | 'idea' | 'grat' | 'win';
const MODES: Array<{ id: Mode; sym: string; ar: string; en: string; arPh: string; enPh: string }> = [
  { id: 'journal', sym: '✎', ar: 'يوميات', en: 'Journal', arPh: 'اكتب براحتك… ولا أحد يشوفه غيرك.', enPh: 'Write freely… only you can see it.' },
  { id: 'idea', sym: '💡', ar: 'فكرة', en: 'Idea', arPh: 'فكرة جات في بالك؟ اكتبها قبل لا تطير.', enPh: 'An idea? Catch it before it flies.' },
  { id: 'grat', sym: '♡', ar: 'امتنان', en: 'Gratitude', arPh: 'شي واحد ممتن له اليوم…', enPh: 'One thing you’re grateful for today…' },
  { id: 'win', sym: '🏆', ar: 'فوز اليوم', en: 'Today’s win', arPh: 'وش الشي اللي مشى زين اليوم؟', enPh: 'What went well today?' },
];
const FACES = ['😣', '😕', '😐', '🙂', '😄'];

export interface DeskLine { day: string; kind: string; text: string }

const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

/** Consecutive days with writing, ending today (or yesterday, so the streak isn't "lost" before you write today). */
function streakOf(days: Set<string>, today: string): { now: number; best: number } {
  let start = days.has(today) ? today : shiftKey(today, -1);
  let now = 0;
  while (days.has(start)) { now++; start = shiftKey(start, -1); }
  const sorted = [...days].sort();
  let best = 0; let run = 0; let prev = '';
  for (const d of sorted) { run = prev && shiftKey(prev, 1) === d ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  return { now, best: Math.max(best, now) };
}

/**
 * The writing desk at the top of the Notebook: one big page to write about your day,
 * what kind of line it is, a mood, and the small things that make you come back — the streak,
 * the last 30 days, and something you wrote on this day before.
 */
export function Desk({ lines, unlocked, paper = 'plain' }: { lines: DeskLine[]; unlocked: boolean; paper?: string }) {
  const { L, locale } = useI18n();
  const today = todayKey();
  const [mode, setMode] = useState<Mode>('journal');
  const [text, setText] = useState('');
  const [mood, setMood] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const m = MODES.find((x) => x.id === mode)!;

  const written = new Set(lines.map((l) => l.day));
  const { now, best } = streakOf(written, today);
  const last30 = rangeKeys(shiftKey(today, -29), 30);
  const monthKey = today.slice(0, 7);
  const monthWords = lines.filter((l) => l.day.startsWith(monthKey)).reduce((a, l) => a + words(l.text), 0);
  const memory = unlocked ? ([[7, 'قبل أسبوع', 'A week ago'], [30, 'قبل شهر', 'A month ago'], [365, 'قبل سنة', 'A year ago']] as const)
    .map(([n, ar, en]) => ({ ar, en, line: lines.find((l) => l.day === shiftKey(today, -n) && l.kind === 'journal') }))
    .find((x) => x.line) : undefined;

  const save = async () => {
    const t = text.trim();
    if (!t) return;
    setBusy(true);
    try {
      const at = new Date();
      const time = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
      if (mode === 'journal') {
        await create<JournalData>('journal', { body: t, time, mood, energy: null, prompts: {} }, { date: today });
      } else if (mode === 'idea') {
        await create<NoteData>('note', blankNote({ title: t, body: '', note_type: 'idea' }));
      } else {
        const page = (await db().records.get(dayPageId(today))) as Rec<DayPageData> | undefined;
        if (mode === 'grat') {
          const g = [...(page?.data.gratitude ?? [])];
          const free = g.findIndex((x) => !x);
          if (free >= 0) g[free] = t; else g.push(t);
          await patchDayPage(today, { gratitude: g });
        } else {
          await patchDayPage(today, { prompts: { ...(page?.data.prompts ?? {}), win: t } });
        }
      }
      if (mood != null && mode !== 'journal') await patchDayPage(today, { mood });
      const n = written.has(today) ? now : now + 1;
      const tail = n > 1 ? L(` · 🔥 ${n} أيام ورا بعض`, ` · 🔥 ${n}-day streak`) : written.has(today) ? '' : L(' · بدأت السلسلة 🔥', ' · streak started 🔥');
      toast(L('انكتب ✓', 'Saved ✓') + tail, { tone: 'reward' });
      setText(''); setMood(null);
    } finally { setBusy(false); }
  };

  return (
    <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <section className={`nb-paper paper-${paper} relative rounded-lg px-5 pb-5 pt-6 shadow-[0_18px_40px_-26px_rgba(47,41,38,.45)] sm:px-7`} aria-label={L('اكتب', 'Write')}>
        <span className="nb-washi -top-3 end-16 rotate-3" style={{ ['--washi' as string]: 'var(--reward)' }} aria-hidden="true" />
        <p className="mb-1 text-[13px] font-bold text-fg-2">{fmtDate(today, locale, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h2 className="nb-title mb-3 text-[24px] leading-snug md:text-[28px]">{L('اكتب عن يومك', 'Write about your day')}</h2>

        <div className="mb-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label={L('وش تكتب؟', 'What are you writing?')}>
          {MODES.map((x) => (
            <button key={x.id} role="radio" aria-checked={mode === x.id} onClick={() => setMode(x.id)}
              className={clsx('h-8 rounded-full border-[1.5px] px-3 text-[13px] font-bold', mode === x.id ? 'border-fg bg-fg text-bg' : 'border-dashed border-line-strong bg-surface hover:border-solid')}>
              {x.sym} {L(x.ar, x.en)}
            </button>
          ))}
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={mode === 'journal' ? 5 : 2} aria-label={L(m.ar, m.en)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void save(); }}
          placeholder={L(m.arPh, m.enPh)}
          className="block w-full resize-y bg-transparent text-[17px] leading-8 outline-none placeholder:text-fg-3" style={{ backgroundImage: 'none' }} />
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-dashed border-line pt-3">
          <span className="text-[12.5px] text-fg-2">{L('مزاجك:', 'Mood:')}</span>
          {FACES.map((f, i) => (
            <button key={f} onClick={() => setMood(mood === i + 1 ? null : i + 1)} aria-pressed={mood === i + 1} aria-label={f}
              className={clsx('grid size-9 place-items-center rounded-full border-[1.5px] text-[18px]', mood === i + 1 ? 'border-reward-ink bg-reward' : 'border-line bg-surface')}>{f}</button>
          ))}
          <span className="flex-1" />
          <span className="num text-[12px] text-fg-3">{words(text)} {L('كلمة', 'words')}</span>
          <button onClick={() => void save()} disabled={!text.trim() || busy} className="h-10 rounded-full bg-fg px-5 text-sm font-bold text-bg hover:opacity-90 disabled:opacity-40">✍️ {L('احفظ في الدفتر', 'Save to notebook')}</button>
        </div>
      </section>

      <aside className="flex flex-col gap-3" aria-label={L('سلسلة الكتابة', 'Writing streak')}>
        <div className="nb-box text-center">
          <div className="text-[34px] leading-none">🔥</div>
          <div className="num mt-1 text-[30px] font-black leading-none">{now}</div>
          <div className="text-[13px] text-fg-2">{now === 1 ? L('يوم كتابة', 'day of writing') : L('أيام ورا بعض', 'days in a row')}</div>
          <p className="mt-1.5 text-[12.5px] font-bold">{written.has(today) ? L('كتبت اليوم ✓', 'Wrote today ✓') : now ? L('اكتب سطر اليوم عشان ما تنقطع', 'Write a line today to keep it going') : L('سطر واحد يبدأ السلسلة', 'One line starts the streak')}</p>
          <div className="mt-3 grid grid-cols-10 gap-1" aria-label={L('آخر 30 يوم', 'Last 30 days')}>
            {last30.map((d) => <span key={d} title={d} className={clsx('aspect-square rounded-[4px]', written.has(d) ? 'bg-reward-ink' : 'bg-surface-2', d === today && 'ring-2 ring-fg/30')} />)}
          </div>
          <p className="mt-2 text-[12px] text-fg-2">{L(`أطول سلسلة ${best} · ${monthWords} كلمة هالشهر`, `Best ${best} · ${monthWords} words this month`)}</p>
        </div>
        {memory?.line && (
          <div className="nb-sticky">
            <p className="text-[12.5px] font-bold">{L(`${memory.ar} كتبت:`, `${memory.en} you wrote:`)}</p>
            <p className="mt-1 line-clamp-4 text-[14px] leading-relaxed">«{memory.line.text}»</p>
          </div>
        )}
      </aside>
    </div>
  );
}
