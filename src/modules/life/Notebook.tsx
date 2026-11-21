import { lazy, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import clsx from 'clsx';
import { useI18n } from '@/core/i18n';
import { updateSettings, useRecords, useSettings } from '@/core/hooks';
import { Segmented } from '@/design/ui';
import type { Settings } from '@/core/settings';
import { isIdOn } from '@/app/registry';
import { dateKey, fmtDate, relativeDay, todayKey } from '@/core/dates';
import type { JournalData, NoteData } from '@/modules/shared/domain';
import { dayPageId, type DayPageData } from './today/dayPage';
import { Hub, type HubTab } from './plan/Hub';
import { Desk } from './notebook/Desk';
import { plainText } from '@/modules/shared/RichText';

const Notes = lazy(() => import('./Notes'));
const Journal = lazy(() => import('./Journal'));

type Kind = 'journal' | 'idea' | 'note' | 'grat';
interface Line { key: string; day: string; kind: Kind; text: string; to?: string }

const META: Record<Kind, { sym: string; ar: string; en: string; bg: string }> = {
  journal: { sym: '✎', ar: 'يوميات', en: 'Journal', bg: 'color-mix(in oklab, var(--health) 30%, var(--surface))' },
  idea: { sym: '💡', ar: 'فكرة', en: 'Idea', bg: 'color-mix(in oklab, var(--reward) 32%, var(--surface))' },
  note: { sym: '–', ar: 'ملاحظة', en: 'Note', bg: 'var(--surface-2)' },
  grat: { sym: '♡', ar: 'امتنان', en: 'Gratitude', bg: 'color-mix(in oklab, var(--life) 30%, var(--surface))' },
};
const MOOD = ['', '😣', '😕', '😐', '🙂', '😄'];

/** The Notebook: the writing desk + day-by-day timeline, the journal (entries and mood), and the notes library. */
export default function Notebook() {
  const { L } = useI18n();
  const s = useSettings();
  const tabs: HubTab[] = [
    { id: 'days', ar: '✍️ اكتب', en: '✍️ Write', C: NotebookDays },
    ...(isIdOn('life.journal', s.modules, s.modulePreset) ? [{ id: 'journal', ar: '☺ اليوميات والمزاج', en: '☺ Journal & mood', C: Journal }] : []),
    { id: 'notes', ar: '– الملاحظات والمجلدات', en: '– Notes & folders', C: Notes },
  ];
  return <Hub label={L('الدفتر', 'Notebook')} tabs={tabs} />;
}

/**
 * The notebook: everything written to remember — journal lines, ideas, quick notes, gratitude —
 * on one page, day by day. Each day opens its day page. Plans and money live in Day/Week/Month.
 */
function NotebookDays() {
  const { L, lang, locale } = useI18n();
  const settings = useSettings();
  const notes = useRecords<NoteData>('note');
  const journal = useRecords<DayPageData | JournalData>('journal');
  const [filter, setFilter] = useState<'all' | Kind>('all');
  const paper: NonNullable<Settings['notebook']['writePaper']> = settings.notebook?.writePaper ?? 'plain';
  const [shown, setShown] = useState(21);
  const [unlocked, setUnlocked] = useState(!settings.privacy.lockJournal);
  useEffect(() => { setUnlocked(!settings.privacy.lockJournal); }, [settings.privacy.lockJournal]);

  const lines = useMemo(() => {
    const out: Line[] = [];
    for (const n of notes ?? []) {
      if (n.deleted_at) continue;
      const day = dateKey(new Date(n.created_at));
      const kind: Kind = n.data.note_type === 'idea' ? 'idea' : 'note';
      out.push({ key: n.id, day, kind, text: n.data.title || plainText(n.data.body).slice(0, 160), to: `/life/notebook?tab=notes&open=${n.id}` });
    }
    for (const j of journal ?? []) {
      if (!j.date) continue;
      const d = j.data as DayPageData;
      if (j.id === dayPageId(j.date)) {
        if (d.prompts?.line) out.push({ key: `${j.id}:line`, day: j.date, kind: 'journal', text: d.prompts.line });
        if (d.prompts?.win) out.push({ key: `${j.id}:win`, day: j.date, kind: 'journal', text: `🏆 ${d.prompts.win}` });
        (d.gratitude ?? []).filter(Boolean).forEach((g, i) => out.push({ key: `${j.id}:g${i}`, day: j.date!, kind: 'grat', text: g }));
      } else if (d.body || d.title) out.push({ key: j.id, day: j.date, kind: 'journal', text: d.title ? `${d.title} — ${plainText(d.body)}` : plainText(d.body), to: `/life/notebook?tab=journal&open=${j.id}` });
    }
    return out;
  }, [notes, journal]);

  const moods = useMemo(() => {
    const m = new Map<string, number>();
    for (const j of journal ?? []) if (j.date && j.data.mood != null && (!m.has(j.date) || j.id === dayPageId(j.date))) m.set(j.date, j.data.mood);
    return m;
  }, [journal]);

  const visible = lines.filter((l) => (filter === 'all' || l.kind === filter) && (unlocked || (l.kind !== 'journal' && l.kind !== 'grat')));
  const days = [...new Set(visible.map((l) => l.day))].sort((a, b) => b.localeCompare(a));
  const count = (k: 'all' | Kind) => lines.filter((l) => k === 'all' || l.kind === k).length;
  const today = todayKey();

  return (
    <div className="mx-auto max-w-[1100px]">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className="text-[13px] font-bold text-fg-2">{L('مساحتك تكتب فيها اللي في بالك — خاصة فيك', 'Your space to write what’s on your mind — private')}</p>
          <h1 className="nb-title text-[34px] leading-tight md:text-[40px]">{L('الدفتر', 'Notebook')}</h1>
        </div>
        <Segmented size="sm" value={paper} onChange={(v) => void updateSettings({ notebook: { writePaper: v } })}
          options={[{ value: 'plain', label: L('سادة', 'Plain') }, { value: 'lines', label: L('سطور', 'Lines') }, { value: 'grid', label: L('مربعات', 'Grid') }, { value: 'dots', label: L('نقاط', 'Dots') }]} />
      </header>

      <Desk lines={lines} unlocked={unlocked} paper={paper} />

      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <h2 className="nb-title text-2xl text-life-ink">{L('يوم بيوم', 'Day by day')}</h2>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={L('فلتر', 'Filter')}>
        {(['all', 'journal', 'idea', 'note', 'grat'] as const).map((k) => (
          <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k}
            className={clsx('h-9 rounded-full border-[1.5px] px-3.5 text-[13px] font-bold', filter === k ? 'border-health-ink bg-[color-mix(in_oklab,var(--health)_35%,var(--surface))]' : 'border-dashed border-line-strong bg-surface')}>
            {k === 'all' ? L('الكل', 'All') : L(META[k].ar, META[k].en)} <span className="num opacity-60">{count(k)}</span>
          </button>
        ))}
      </div>
      </div>
      <section className={`nb-paper paper-${paper} relative rounded-lg px-4 pb-6 pt-7 shadow-[0_18px_40px_-26px_rgba(47,41,38,.45)] sm:px-8`}>
        <span className="nb-washi -top-3 end-20 rotate-3" style={{ ['--washi' as string]: 'var(--health)' }} aria-hidden="true" />
        {!unlocked && (
          <p className="mb-3 rounded-sm bg-surface-2 p-2.5 text-[13px]">{L('اليوميات والامتنان مقفلة.', 'Journal and gratitude are locked.')} <button onClick={() => setUnlocked(true)} className="font-bold text-accent-ink">{L('افتحها هنا', 'Show them')}</button></p>
        )}
        {!days.length && <p className="py-10 text-center text-fg-2">{L('الدفتر فاضي. دوّن «فكرة: …» أو اكتب سطر اليوم من صفحة اليوم.', 'Empty. Write “idea: …” or a line of the day on the day page.')}</p>}
        {days.slice(0, shown).map((d) => (
          <div key={d} className="mb-2">
            <div className="flex flex-wrap items-baseline gap-x-3 pt-3">
              <Link to={`/life/today?date=${d}`} className="nb-title text-[23px] hover:underline">
                {d === today ? L('اليوم، ', 'Today, ') : ''}{fmtDate(d, locale, { weekday: 'long', day: 'numeric', month: 'long' })}
              </Link>
              {moods.get(d) != null && unlocked && <span className="text-[15px]" title={L('المزاج', 'Mood')}>{MOOD[moods.get(d)!]}</span>}
              <span className="text-[12px] text-fg-3">{d !== today ? relativeDay(d, lang, locale) : ''}</span>
            </div>
            <ul>
              {visible.filter((l) => l.day === d).sort((a, b) => (a.kind === 'journal' ? 0 : 1) - (b.kind === 'journal' ? 0 : 1)).map((l) => (
                <li key={l.key} className="flex items-baseline gap-2.5 border-b border-dashed border-line py-1.5 text-[15px] leading-relaxed">
                  <b className="w-6 shrink-0 text-center">{META[l.kind].sym}</b>
                  {l.to ? <Link to={l.to} className="min-w-0 flex-1 hover:underline">{l.text}</Link> : <span className="min-w-0 flex-1">{l.text}</span>}
                  <span className="shrink-0 rounded-full px-2 text-[11.5px] font-bold" style={{ background: META[l.kind].bg }}>{L(META[l.kind].ar, META[l.kind].en)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {days.length > shown && <button onClick={() => setShown((n) => n + 21)} className="mt-3 h-10 w-full rounded-full border border-line bg-surface text-sm font-bold hover:bg-surface-2">{L('أيام أقدم', 'Older days')}</button>}
      </section>
    </div>
  );
}
