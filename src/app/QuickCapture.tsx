import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Clock, Timer, Hash, Wallet, Droplets, ListChecks, Inbox, StickyNote, BookHeart, CalendarPlus, ArrowUpRight } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/hooks';
import { parseCapture, type CaptureKind } from '@/core/capture/parse';
import { fmtTime, relativeDay } from '@/core/dates';
import { toast } from '@/core/toast';
import { Modal } from '@/design/overlay';
import { Button, Chip, Input } from '@/design/ui';
import { saveCapture } from '@/modules/shared/captureSave';

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
      const [ar, en] = await saveCapture(kind, raw, parsed, settings);
      toast(L(ar, en));
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
