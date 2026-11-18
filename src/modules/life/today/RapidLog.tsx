import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Star, CornerDownLeft, Clock } from 'lucide-react';
import clsx from 'clsx';
import type { Rec } from '@shared/records';
import { useI18n } from '@/core/i18n';
import { parseCapture, type CaptureKind } from '@/core/capture/parse';
import { revertTo } from '@/core/repo';
import { fmtTime, relativeDay, shiftKey, todayKey } from '@/core/dates';
import { toast, undoToast } from '@/core/toast';
import type { Settings } from '@/core/settings';
import { saveCapture } from '@/modules/shared/captureSave';
import type { NoteData, TxnData } from '@/modules/shared/domain';
import { isDone, saveTask, toggleTask, type Task } from '../tasks/model';
import type { CalItem } from '../calendar/sources';

/** Bullet-journal keys. The symbol IS the state: tap • to finish (×), ← sends it to tomorrow. */
export const KEYS: Array<{ k: 'task' | 'event' | 'note' | 'expense'; sym: string; ar: string; en: string }> = [
  { k: 'task', sym: '•', ar: 'مهمة', en: 'Task' },
  { k: 'event', sym: '○', ar: 'موعد', en: 'Event' },
  { k: 'note', sym: '–', ar: 'ملاحظة', en: 'Note' },
  { k: 'expense', sym: 'ر.س', ar: 'مصروف', en: 'Expense' },
];

/** A leading bullet typed by hand picks the kind, like writing in a paper notebook. */
export function prefixKind(text: string): { kind: CaptureKind | null; rest: string } {
  const m = /^\s*([•*.○oO°\-–—])\s+(.*)$/s.exec(text);
  if (!m) return { kind: null, rest: text };
  const c = m[1];
  const kind: CaptureKind = '•*.'.includes(c) ? 'task' : '○oO°'.includes(c) ? 'event' : 'note';
  return { kind, rest: m[2] };
}

export function areaColor(t: Task, settings: Settings): string {
  if (t.data.course_id) return 'var(--study)';
  const cat = t.data.category ?? '';
  if (/صحة|health|رياضة|تمرين/i.test(cat)) return 'var(--health)';
  if (/دراسة|study|جامعة/i.test(cat)) return 'var(--study)';
  const area = settings.lifeAreas.find((a) => a.id === t.data.area);
  return area?.color ?? 'var(--life)';
}

type Line =
  | { key: string; kind: 'task'; t: Task; at: string; recurringDone?: boolean }
  | { key: string; kind: 'event'; i: CalItem; at: string }
  | { key: string; kind: 'note'; n: Rec<NoteData>; at: string }
  | { key: string; kind: 'money'; x: Rec<TxnData>; at: string };

export function RapidLog({ day, tasks, doneTasks, recurringDone, events, notes, txns, settings, onOpen }: {
  day: string;
  tasks: Task[];
  doneTasks: Task[];
  recurringDone: Task[];
  events: CalItem[];
  notes: Rec<NoteData>[];
  txns: Rec<TxnData>[];
  settings: Settings;
  onOpen: (t: Task) => void;
}) {
  const { L, lang, locale, fmtNum } = useI18n();
  const h12 = settings.timeFormat === '12';
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<CaptureKind | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { kind: prefKind, rest } = prefixKind(text);
  const parsed = useMemo(() => {
    const p = parseCapture(rest);
    // a time with no day word ("4 العصر") belongs to the page's day, not the real today
    if (p.date === todayKey() && !/اليوم|الليلة|today|tonight/i.test(rest)) p.date = day;
    return p;
  }, [rest, day]);
  // a plain line on the daily page is a task; the parser may still spot an expense or water
  const auto: CaptureKind = parsed.kind === 'inbox' || parsed.kind === 'journal' ? 'task' : parsed.kind;
  const kind: CaptureKind = picked ?? prefKind ?? auto;
  const keySym = KEYS.find((x) => x.k === kind)?.sym ?? (kind === 'water' ? '◔' : kind === 'income' ? '+' : '•');

  const save = async () => {
    const raw = rest.trim();
    if (!raw || busy) return;
    setBusy(true);
    try {
      const [ar, en] = await saveCapture(kind, raw, parsed, settings, day);
      toast(L(ar, en));
      setText('');
      setPicked(null);
      inputRef.current?.focus();
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const lines: Line[] = useMemo(() => {
    const xs: Line[] = [
      ...events.map((i) => ({ key: `e:${i.key}`, kind: 'event' as const, i, at: i.start ?? '00:00' })),
      ...[...tasks, ...doneTasks].map((t) => ({ key: `t:${t.id}`, kind: 'task' as const, t, at: t.data.start_time ?? t.data.due_time ?? '99:99' })),
      ...recurringDone.map((t) => ({ key: `r:${t.id}`, kind: 'task' as const, t, at: '99:99', recurringDone: true })),
      ...notes.map((n) => ({ key: `n:${n.id}`, kind: 'note' as const, n, at: new Date(n.created_at).toTimeString().slice(0, 5) })),
      ...txns.map((x) => ({ key: `x:${x.id}`, kind: 'money' as const, x, at: (x.data as TxnData & { time?: string }).time ?? '99:98' })),
    ];
    return xs.sort((a, b) => a.at.localeCompare(b.at));
  }, [events, tasks, doneTasks, recurringDone, notes, txns]);

  const moveTomorrow = async (t: Task) => {
    const to = shiftKey(day, 1);
    await saveTask(t.id, { ...t.data, start: to });
    undoToast(L(`← رُحّلت لـ${relativeDay(to, lang, locale)}`, `→ Moved to ${relativeDay(to, lang, locale)}`), () => revertTo(t as unknown as Rec));
  };
  const toggleStar = (t: Task) => saveTask(t.id, { ...t.data, important: !t.data.important });

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="mb-3">
        <div className="flex items-center gap-2 rounded-full border-[1.5px] border-line-strong bg-surface px-3 focus-within:border-accent-ink">
          <span className="num w-7 shrink-0 text-center text-lg font-black" aria-hidden="true">{keySym}</span>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { setText(''); setPicked(null); } }}
            className="h-12 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-fg-3"
            placeholder={L('دوّن سطر… مثل: مشي 5 العصر لمدة ساعة', 'Log a line… e.g. walk 5pm for 1 hour')}
            aria-label={L('سطر جديد في دفتر اليوم', 'New line in today’s log')}
            enterKeyHint="done"
          />
          <button type="submit" disabled={!rest.trim() || busy} aria-label={L('أضف السطر', 'Add line')} className="grid size-9 shrink-0 place-items-center rounded-full text-fg-2 hover:bg-surface-2 disabled:opacity-40">
            <CornerDownLeft size={17} />
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={L('نوع السطر', 'Line type')}>
          {KEYS.map((x) => (
            <button key={x.k} type="button" role="radio" aria-checked={kind === x.k}
              onClick={() => setPicked(picked === x.k ? null : x.k)}
              className={clsx('inline-flex h-9 items-center gap-1.5 rounded-full border-[1.5px] px-3 text-[13px] font-bold transition',
                kind === x.k ? 'border-fg bg-fg text-bg' : 'border-line bg-surface text-fg-2 hover:border-line-strong')}>
              <span className="num">{x.sym}</span>{L(x.ar, x.en)}
            </button>
          ))}
          {rest.trim() && (parsed.date || parsed.time || parsed.amount != null) && (
            <span className="ms-1 inline-flex flex-wrap gap-1.5 text-[12px] text-fg-2" aria-live="polite">
              {parsed.date && parsed.date !== day && <span className="rounded-full bg-surface-2 px-2 py-0.5">{relativeDay(parsed.date, lang, locale)}</span>}
              {parsed.time && <span className="num rounded-full bg-surface-2 px-2 py-0.5">{fmtTime(parsed.time, locale, h12)}</span>}
              {parsed.duration_min && <span className="num rounded-full bg-surface-2 px-2 py-0.5">{parsed.duration_min} {L('د', 'min')}</span>}
              {parsed.amount != null && <span className="num rounded-full bg-surface-2 px-2 py-0.5">{parsed.amount} {L('ر.س', 'SAR')}</span>}
            </span>
          )}
        </div>
      </form>

      {lines.length === 0 ? (
        <p className="py-6 text-center text-sm text-fg-2">{L('الصفحة فاضية. اكتب أول سطر فوق، ولا تفكّر كثير.', 'Blank page. Write the first line above — don’t overthink it.')}</p>
      ) : (
        <ul className="flex flex-col">
          {lines.map((ln) => {
            if (ln.kind === 'task') {
              const t = ln.t;
              const done = ln.recurringDone || isDone(t);
              return (
                <li key={ln.key} className="nb-line group flex min-h-11 items-center gap-1.5">
                  <button
                    onClick={() => !ln.recurringDone && void toggleTask(t, settings)}
                    disabled={ln.recurringDone}
                    aria-label={done ? L(`تمّت: ${t.data.title} — اضغط للتراجع`, `Done: ${t.data.title} — tap to undo`) : L(`أنجز: ${t.data.title}`, `Complete: ${t.data.title}`)}
                    className="num grid size-9 shrink-0 place-items-center rounded-xs text-xl font-black hover:bg-surface-2 disabled:hover:bg-transparent"
                  >{done ? '×' : '•'}</button>
                  <span className="size-2 shrink-0 rounded-full" style={{ background: areaColor(t, settings) }} aria-hidden="true" />
                  <button onClick={() => onOpen(t)} className={clsx('min-w-0 flex-1 truncate py-2 text-start text-[15px]', done && 'text-fg-2 line-through decoration-life-ink')}>
                    {t.data.title}
                  </button>
                  {(t.data.start_time || t.data.due_time) && <span className="num shrink-0 text-[12px] text-fg-2">{fmtTime(t.data.start_time ?? t.data.due_time, locale, h12)}</span>}
                  {!ln.recurringDone && (
                    <button onClick={() => void toggleStar(t)} aria-pressed={!!t.data.important}
                      aria-label={t.data.important ? L('شيل من أهم 3', 'Remove from top 3') : L('حطها في أهم 3', 'Add to top 3')}
                      className={clsx('grid size-9 shrink-0 place-items-center rounded-xs hover:bg-surface-2', t.data.important ? 'text-reward-ink' : 'text-fg-3 opacity-70 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100')}>
                      <Star size={16} fill={t.data.important ? 'currentColor' : 'none'} />
                    </button>
                  )}
                  {!done && (
                    <button onClick={() => void moveTomorrow(t)} aria-label={L(`رحّل «${t.data.title}» لبكرة`, `Move “${t.data.title}” to tomorrow`)}
                      className="num h-9 shrink-0 rounded-xs px-2 text-[13px] font-bold text-fg-2 hover:bg-surface-2 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100">
                      {L('← بكرة', 'Tmrw →')}
                    </button>
                  )}
                </li>
              );
            }
            if (ln.kind === 'event') {
              const i = ln.i;
              return (
                <li key={ln.key} className="nb-line flex min-h-11 items-center gap-1.5">
                  <span className="grid size-9 shrink-0 place-items-center text-lg font-black" aria-label={L('موعد', 'Event')}>○</span>
                  <span className="size-2 shrink-0 rounded-full" style={{ background: i.color }} aria-hidden="true" />
                  <Link to={`/life/calendar?date=${day}`} className="min-w-0 flex-1 truncate py-2 text-[15px] hover:underline">{i.title}</Link>
                  <span className="num inline-flex shrink-0 items-center gap-1 text-[12px] text-fg-2">
                    {i.allDay ? L('طول اليوم', 'All day') : <><Clock size={12} />{fmtTime(i.start, locale, h12)}</>}
                  </span>
                </li>
              );
            }
            if (ln.kind === 'note') {
              return (
                <li key={ln.key} className="nb-line flex min-h-11 items-center gap-1.5">
                  <span className="grid size-9 shrink-0 place-items-center text-lg font-black" aria-label={L('ملاحظة', 'Note')}>–</span>
                  <span className="size-2 shrink-0" aria-hidden="true" />
                  <Link to="/life/notes" className="min-w-0 flex-1 truncate py-2 text-[15px] text-fg-2 hover:underline">{ln.n.data.title || L('ملاحظة', 'Note')}</Link>
                </li>
              );
            }
            const x = ln.x;
            return (
              <li key={ln.key} className="nb-line flex min-h-11 items-center gap-1.5">
                <span className="grid size-9 shrink-0 place-items-center text-[12px] font-black" aria-label={x.data.kind === 'income' ? L('دخل', 'Income') : L('مصروف', 'Expense')}>{x.data.kind === 'income' ? '+' : L('ر.س', 'SAR')}</span>
                <span className="size-2 shrink-0" aria-hidden="true" />
                <Link to="/life/finance" className="min-w-0 flex-1 truncate py-2 text-[15px] hover:underline">{x.data.description || x.data.category || L('مصروف', 'Expense')}</Link>
                <span className="num shrink-0 text-[13px] font-bold">{fmtNum(x.data.amount)}</span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 rounded-sm border border-dashed border-line-strong px-3 py-2 text-[12.5px] text-fg-2" aria-label={L('مفتاح الرموز', 'Key')}>
        <span><b className="text-fg">•</b> {L('مهمة', 'task')}</span>
        <span><b className="text-fg">×</b> {L('تمّت', 'done')}</span>
        <span><b className="text-fg">{L('←', '→')}</b> {L('رحّلتها لبكرة', 'moved to tomorrow')}</span>
        <span><b className="text-fg">○</b> {L('موعد', 'event')}</span>
        <span><b className="text-fg">–</b> {L('ملاحظة', 'note')}</span>
        <span><Star size={12} className="inline text-reward-ink" fill="currentColor" /> {L('من أهم 3', 'top 3')}</span>
      </div>
    </div>
  );
}
