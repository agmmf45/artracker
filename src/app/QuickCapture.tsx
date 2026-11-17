import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Clock, Timer, Hash, Wallet, Droplets, ListChecks, Inbox, StickyNote, BookHeart, CalendarPlus, ArrowUpRight } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/hooks';
import { parseCapture, type CaptureKind } from '@/core/capture/parse';
import { create } from '@/core/repo';
import { fmtTime, relativeDay, todayKey } from '@/core/dates';
import { toast } from '@/core/toast';
import { Modal } from '@/design/overlay';
import { Button, Chip, Input } from '@/design/ui';
import { createTask } from '@/modules/life/tasks/model';
import { addTxn, blankEvent, blankNote, logWater, type CaptureData, type EventData, type JournalData, type NoteData } from '@/modules/shared/domain';

const KINDS: Array<{ k: CaptureKind; ar: string; en: string; icon: typeof Inbox }> = [
  { k: 'inbox', ar: 'الوارد', en: 'Inbox', icon: Inbox },
  { k: 'task', ar: 'مهمة', en: 'Task', icon: ListChecks },
  { k: 'event', ar: 'موعد', en: 'Event', icon: CalendarPlus },
  { k: 'note', ar: 'ملاحظة', en: 'Note', icon: StickyNote },
  { k: 'expense', ar: 'مصروف', en: 'Expense', icon: Wallet },
  { k: 'income', ar: 'دخل', en: 'Income', icon: ArrowUpRight },
  { k: 'water', ar: 'ماء', en: 'Water', icon: Droplets },
  { k: 'journal', ar: 'يوميات', en: 'Journal', icon: BookHeart },
];

/**
 * Universal capture: one text field, everything else optional. The parser suggests a type, date,
 * time and duration; the user can switch the type with one tap. The original text is always stored.
 */
export function QuickCapture({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { L, lang, locale } = useI18n();
  const settings = useSettings();
  const [text, setText] = useState('');
  const [override, setOverride] = useState<CaptureKind | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setText(''); setOverride(null); setTimeout(() => inputRef.current?.focus(), 60); }
  }, [open]);

  const parsed = useMemo(() => parseCapture(text), [text]);
  const kind: CaptureKind = override ?? parsed.kind;

  const save = async () => {
    const raw = text.trim();
    if (!raw) return;
    setBusy(true);
    try {
      const title = parsed.title || raw;
      switch (kind) {
        case 'task':
          await createTask({
            title, priority: parsed.priority ?? settings.tasks.defaultPriority, tags: parsed.tags, category: parsed.category,
            start: parsed.date, start_time: parsed.time, duration_min: parsed.duration_min, estimate_min: parsed.duration_min, capture_text: raw, source: 'capture',
          });
          toast(L('أُضيفت المهمة', 'Task added'));
          break;
        case 'event':
          await create<EventData>('event', blankEvent({
            title, start: parsed.date ?? todayKey(), end: parsed.date ?? todayKey(), start_time: parsed.time, all_day: !parsed.time,
            end_time: parsed.time && parsed.duration_min ? addMin(parsed.time, parsed.duration_min) : parsed.time ? addMin(parsed.time, 60) : null,
            notes: raw === title ? '' : raw, source: 'capture',
          }), { date: parsed.date ?? todayKey() });
          toast(L('أُضيف الموعد للتقويم', 'Event added to calendar'));
          break;
        case 'note':
          await create<NoteData>('note', blankNote({ title, body: '', tags: parsed.tags, note_type: /فكرة|idea/i.test(raw) ? 'idea' : 'quick' }));
          toast(L('حُفظت الملاحظة', 'Note saved'));
          break;
        case 'expense':
        case 'income':
          if (!parsed.amount) { toast(L('اكتب المبلغ، مثل: قهوة 15', 'Add an amount, e.g. coffee 15'), { tone: 'error' }); setBusy(false); return; }
          await addTxn({ kind, amount: parsed.amount, description: title, category: kind === 'expense' ? parsed.category ?? settings.categories.expenses.at(-1) ?? null : null }, parsed.date ?? todayKey());
          toast(L(`سُجّل ${parsed.amount} ر.س`, `Logged ${parsed.amount} SAR`));
          break;
        case 'water':
          await logWater(parsed.ml ?? 250);
          toast(L(`+${parsed.ml ?? 250} مل ماء`, `+${parsed.ml ?? 250} ml water`));
          break;
        case 'journal':
          await create<JournalData>('journal', { body: raw, time: new Date().toTimeString().slice(0, 5), mood: null, energy: null, prompts: {} }, { date: todayKey() });
          toast(L('أُضيفت لليوميات', 'Added to journal'));
          break;
        default:
          await create<CaptureData>('capture', { text: raw, source: 'quick', parsed }, { status: 'open', date: todayKey() });
          toast(L('في الوارد — رتّبه لاحقاً', 'In your inbox — sort it later'));
      }
      onOpenChange(false);
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={L('إضافة سريعة', 'Quick capture')}
      description={L('اكتب أي شي — مهمة، فكرة، موعد، مصروف، ماء.', 'Type anything — a task, idea, event, expense, water.')}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{L('إلغاء', 'Cancel')}</Button>
          <Button variant="primary" className="flex-1 md:flex-none" loading={busy} disabled={!text.trim()} onClick={save}>{L('حفظ', 'Save')}</Button>
        </>
      }
    >
      <Input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); void save(); } }}
        placeholder={L('مثال: ذاكر باثولوجي بكرة 7 مساءً لمدة ساعة', 'e.g. Study pathology tomorrow at 7pm for 1 hour')}
        aria-label={L('النص', 'Text')}
      />

      <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label={L('النوع', 'Type')}>
        {KINDS.map(({ k, ar, en, icon: Icon }) => (
          <Chip key={k} active={kind === k} onClick={() => setOverride(k === parsed.kind ? null : k)}>
            <Icon size={13} /> {L(ar, en)}
          </Chip>
        ))}
      </div>

      {text.trim() && (
        <div className="mt-4 rounded-md border border-line bg-surface-2 p-3 text-sm" aria-live="polite">
          <div className="mb-1.5 text-[12px] font-bold text-fg-3">{L('سيُحفظ كالتالي', 'Will be saved as')}</div>
          <div className="font-bold">{kind === 'water' ? `${parsed.ml ?? 250} ml` : parsed.title || text}</div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[12px] text-fg-2">
            {parsed.date && <span className="inline-flex items-center gap-1"><CalendarDays size={13} />{relativeDay(parsed.date, lang, locale)}</span>}
            {parsed.time && <span className="inline-flex items-center gap-1"><Clock size={13} />{fmtTime(parsed.time, locale, settings.timeFormat === '12')}</span>}
            {parsed.duration_min && <span className="inline-flex items-center gap-1"><Timer size={13} />{parsed.duration_min} {L('د', 'min')}</span>}
            {parsed.amount != null && <span className="num inline-flex items-center gap-1"><Wallet size={13} />{parsed.amount} {L('ر.س', 'SAR')}</span>}
            {parsed.category && <span>{parsed.category}</span>}
            {parsed.tags.map((t) => <span key={t} className="inline-flex items-center gap-0.5"><Hash size={12} />{t}</span>)}
          </div>
        </div>
      )}
    </Modal>
  );
}

function addMin(time: string, min: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = Math.min(23 * 60 + 59, h * 60 + m + min);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
